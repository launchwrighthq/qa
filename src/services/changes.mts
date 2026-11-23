// What a commit range changed, for a QA report (`lw qa changes`). It resolves a range, groups the
// commits by area, and derives the signals that say where a user-visible change can be. It
// reads git only: every signal comes from the two ends of the range, never from the working tree.
//
// The range: `--since <date>` and `--since <sha>` name the first commit in the range. `--last`
// (the default) continues after the last commit of the newest report, read from its `Range:`
// line. With no report or no `Range:` line, the command refuses. It never guesses a range.
//
// The areas: one per workspace package (the `packages` globs of `pnpm-workspace.yaml` at the head
// of the range), a module's `ts/` folder counted as its module folder. A path outside every
// package takes its first folder, and a file at the root is `root`.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type Clock, LaunchwrightError, systemClock } from '@launchwrighthq/kernel';

/** Git's own empty tree: the base of a range that starts at the first commit. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** Control characters as separators, because a commit subject can hold a tab or a pipe. */
const RECORD = '\u001e';
const FIELD = '\u001f';
export const LOG_FORMAT = `${RECORD}%H${FIELD}%h${FIELD}%cI${FIELD}%an${FIELD}%s`;

/** `YYYY-MM-DD`, with an optional `HH:MM` or `HH:MM:SS`. */
const DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
const SHA = /^[0-9a-f]{7,40}$/i;

/** Documents that a tester can be pointed at, when the range adds them. */
const DOC_DIRS = ['docs/specs/', 'docs/plans/', 'docs/superpowers/plans/'];

/** File kinds the range adds, found by the project anatomy suffixes (main spec 2.24.3). */
const ADDED_KINDS: Record<string, RegExp> = {
  pages: /\.page\.tsx$/,
  features: /\.feature\.mts$/,
  worlds: /\.world\.mts$/,
  jobs: /\.job\.mts$/,
  commands: /\.command\.mts$/,
  endpoints: /(^|\/)http\/[^/]+\.mts$/,
};

/** The milliseconds that one git call may take: a log of a long range on a slow disk. */
const GIT_TIMEOUT_MS = 120_000;

/** Runs `git <args>` in `repo`. With `allowFail`, a non-zero exit gives null. A call past 120 s fails with `qa.git`. */
export function git(repo: string, args: string[], opts: { allowFail?: boolean } = {}): string | null {
  const res = spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: GIT_TIMEOUT_MS, killSignal: 'SIGKILL' });
  if (res.error) throw new LaunchwrightError('qa.git', `Cannot run git ${args.join(' ')}: ${res.error.message}`, { cause: res.error, context: { repo } });
  if (res.status !== 0) {
    if (opts.allowFail) return null;
    throw new LaunchwrightError('qa.git', `git ${args.join(' ')} failed: ${(res.stderr ?? '').trim()}`, { context: { repo, args } });
  }
  return res.stdout;
}

/** `git` that must succeed: the output, never null. */
export function gitOut(repo: string, args: string[]): string {
  return git(repo, args) ?? '';
}

/** Non-empty lines without trailing space. */
export function lines(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
}

/** One commit of a `LOG_FORMAT` log, with the paths of `--name-only`. */
export interface LogCommit {
  sha: string;
  short: string;
  date: string;
  author: string;
  subject: string;
  paths: string[];
}

/** Parses `git log --format=LOG_FORMAT [--name-only]` output. */
export function parseLog(out: string | null): LogCommit[] {
  const commits: LogCommit[] = [];
  for (const chunk of (out ?? '').split(RECORD).slice(1)) {
    const [header = '', ...rest] = chunk.split('\n');
    const [sha = '', short = '', date = '', author = '', subject = ''] = header.split(FIELD);
    commits.push({ sha, short, date: date.slice(0, 10), author, subject, paths: rest.map((l) => l.trim()).filter(Boolean) });
  }
  return commits;
}

/** The repository or worktree root that holds `cwd`. */
export function repoRoot(cwd: string): string {
  const out = git(cwd, ['rev-parse', '--show-toplevel'], { allowFail: true });
  if (!out?.trim()) throw new LaunchwrightError('qa.git.repo', `${cwd} is not inside a git repository.`, { context: { cwd } });
  return out.trim();
}

/**
 * A date as git must read it, with every field written. Git fills a missing time from the current
 * clock, so `2026-02-01` becomes `2026-02-01T00:00:00` and the range does not move with the hour.
 */
export function gitInstant(date: string): string {
  const [day, time = ''] = date.split(/[ T]/);
  const parts = time ? time.split(':') : [];
  while (parts.length < 3) parts.push('00');
  return `${day}T${parts.join(':')}`;
}

/**
 * The sha a report's `Range:` line ends on: the first object name after `->`. The line reads
 * `2026-08-21 abc1234 -> 2026-08-28 def5678, 41 commits`. Null when the text has no such line.
 */
export function parseRangeLine(text: string): string | null {
  for (const line of text.split('\n')) {
    const match = /^Range:\s*(.+)$/.exec(line.trim());
    const after = match?.[1]?.split('->')[1];
    if (!after) continue;
    const sha = /\b([0-9a-f]{7,40})\b/i.exec(after);
    if (sha?.[1]) return sha[1];
  }
  return null;
}

/** The newest `.md` report in `dir` by modification time. Ties go to the later name. */
export function newestReport(dir: string): { name: string; path: string } | null {
  if (!existsSync(dir)) return null;
  const found = readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ name, path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
  return found[0] ?? null;
}

function refuse(message: string, context: Record<string, unknown> = {}): LaunchwrightError {
  return new LaunchwrightError('qa.changes.range', message, { context });
}

const PASS_SINCE = 'Pass --since <date> (2026-08-21), or --since <sha>.';

/** The exclusive base of the range, which is never itself reported, and how it was chosen. */
export function resolveRange(repo: string, opts: { since?: string; head?: string; reportDir: string }): { base: string; basis: string } {
  const head = opts.head ?? 'HEAD';
  const since = opts.since;
  if (since === undefined) {
    const report = newestReport(join(repo, opts.reportDir));
    if (!report) throw refuse(`No report under ${opts.reportDir}/ to continue from. ${PASS_SINCE}`);
    const sha = parseRangeLine(readFileSync(report.path, 'utf8'));
    if (!sha) throw refuse(`${opts.reportDir}/${report.name} has no "Range:" line with a sha after "->". ${PASS_SINCE}`, { report: report.name });
    const resolved = git(repo, ['rev-parse', '--verify', `${sha}^{commit}`], { allowFail: true });
    if (!resolved) throw refuse(`${opts.reportDir}/${report.name} names ${sha}, which is not a commit here. ${PASS_SINCE}`, { sha });
    return { base: resolved.trim(), basis: `--last (after ${sha}, the end of ${opts.reportDir}/${report.name})` };
  }
  if (SHA.test(since)) {
    const resolved = git(repo, ['rev-parse', '--verify', `${since}^{commit}`], { allowFail: true });
    if (!resolved) throw refuse(`--since ${since} is not a commit in this repository.`, { since });
    const start = resolved.trim();
    const parent = git(repo, ['rev-parse', '--verify', `${start}^`], { allowFail: true });
    return { base: parent ? parent.trim() : EMPTY_TREE, basis: `--since ${since} (that commit, included)` };
  }
  if (!DATE.test(since)) throw refuse(`--since ${since} is neither a date (2026-08-21, "2026-08-21 14:00") nor a sha.`, { since });
  // The last commit before the date. The range starts just after it, and it is an ancestor of
  // HEAD, so a merged side branch stays inside the range.
  const before = gitOut(repo, ['rev-list', '-1', `--before=${gitInstant(since)}`, head]).trim();
  const base = before || EMPTY_TREE;
  const count = Number(gitOut(repo, ['rev-list', '--count', `${base}..${head}`]).trim());
  if (count === 0) throw refuse(`No commit at or after ${since} on ${head}.`, { since });
  return { base, basis: `--since ${since} (the first commit at or after it)` };
}

/** The `packages` globs of a `pnpm-workspace.yaml`. Only the list form is read. */
export function workspaceGlobs(yaml: string): string[] {
  const globs: string[] = [];
  let inPackages = false;
  for (const raw of yaml.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = /^\s+-\s*(['"]?)(.+?)\1\s*$/.exec(line);
    if (item?.[2]) globs.push(item[2]);
    else if (/^\S/.test(line)) inPackages = false;
  }
  return globs;
}

function globRegex(glob: string): RegExp {
  const body = glob
    .replace(/\/+$/, '')
    .split('/')
    .map((seg) => (seg === '**' ? '.*' : seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')))
    .join('/');
  return new RegExp(`^${body}$`);
}

/**
 * The area folders of a tree: each workspace package folder, a module's `ts/` folder counted as
 * its module folder. Longest first, so a nested package wins.
 */
export function workspaceAreas(globs: string[], trackedFiles: string[]): string[] {
  const include = globs.filter((g) => !g.startsWith('!')).map(globRegex);
  const exclude = globs.filter((g) => g.startsWith('!')).map((g) => globRegex(g.slice(1)));
  const tracked = new Set(trackedFiles);
  const areas = new Set<string>();
  for (const file of trackedFiles) {
    if (!file.endsWith('/package.json')) continue;
    const dir = file.slice(0, -'/package.json'.length);
    if (!include.some((re) => re.test(dir)) || exclude.some((re) => re.test(dir))) continue;
    const parent = dir.split('/').slice(0, -1).join('/');
    const moduleDir = dir.endsWith('/ts') && tracked.has(`${parent}/module.toml`) ? parent : null;
    areas.add(moduleDir ?? dir);
  }
  return [...areas].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** The area of one path: its package area, else its first folder, else `root`. */
export function areaOf(path: string, areas: string[]): string {
  const hit = areas.find((area) => path === area || path.startsWith(`${area}/`));
  if (hit) return hit;
  const slash = path.indexOf('/');
  return slash === -1 ? 'root' : path.slice(0, slash);
}

/** The areas a set of paths touches, sorted. */
export function areasFor(paths: string[], areas: string[]): string[] {
  return [...new Set(paths.map((p) => areaOf(p, areas)))].sort();
}

/** A commit of the range with the areas its own files touch. */
export interface RangeCommit {
  sha: string;
  short: string;
  date: string;
  author: string;
  subject: string;
  areas: string[];
}

export interface ChangeSignals {
  /** Files the range adds, by kind: `pages`, `features`, `worlds`, `jobs`, `commands`, `endpoints`. */
  added: Record<string, string[]>;
  /** Specs and plans the range adds. A rename into an archive is not an addition. */
  documents: string[];
}

export interface ChangesDigest {
  range: {
    base: string;
    basis: string;
    head: string;
    start: { sha: string; short: string; date: string } | null;
    end: { sha: string; short: string; date: string } | null;
    commits: number;
    /** The value of a report's `Range:` line. */
    line: string;
  };
  /** Commits per area. */
  areas: Record<string, number>;
  commits: RangeCommit[];
  signals: ChangeSignals;
}

/** The whole digest of one range: what the text output prints and what `--json` holds. */
export function digest(repo: string, opts: { since?: string; head?: string; reportDir: string; clock?: Clock }): ChangesDigest {
  const head = opts.head ?? 'HEAD';
  const { base, basis } = resolveRange(repo, opts);
  const globs = workspaceGlobs(git(repo, ['show', `${head}:pnpm-workspace.yaml`], { allowFail: true }) ?? '');
  const areaDirs = workspaceAreas(globs, lines(gitOut(repo, ['ls-tree', '-r', '--name-only', head])));
  const commits: RangeCommit[] = parseLog(gitOut(repo, ['log', '--reverse', '--name-only', `--format=${LOG_FORMAT}`, `${base}..${head}`])).map(
    ({ paths, ...c }) => ({ ...c, areas: areasFor(paths, areaDirs) }),
  );
  const added = lines(gitOut(repo, ['diff', '--name-only', '--diff-filter=A', base, head]));

  const areas: Record<string, number> = {};
  for (const commit of commits) for (const area of commit.areas) areas[area] = (areas[area] ?? 0) + 1;

  const first = commits[0];
  const last = commits.at(-1);
  const clock = opts.clock ?? systemClock;
  return {
    range: {
      base,
      basis,
      head: gitOut(repo, ['rev-parse', '--short', head]).trim(),
      start: first ? { sha: first.sha, short: first.short, date: first.date } : null,
      end: last ? { sha: last.sha, short: last.short, date: last.date } : null,
      commits: commits.length,
      line: first && last ? `${first.date} ${first.short} -> ${last.date} ${last.short}, ${commits.length} commits` : `no commits on ${clock.date().toISOString().slice(0, 10)}`,
    },
    areas,
    commits,
    signals: {
      added: Object.fromEntries(Object.entries(ADDED_KINDS).map(([kind, re]) => [kind, added.filter((p) => re.test(p)).sort()])),
      documents: added.filter((p) => DOC_DIRS.some((d) => p.startsWith(d)) && p.endsWith('.md')).sort(),
    },
  };
}

/** How many commits one area prints. `--json` holds all of them. */
const AREA_COMMITS = 20;

function capped(values: string[], limit = 20): string {
  return values.length <= limit ? values.join(', ') : `${values.slice(0, limit).join(', ')}, +${values.length - limit} more`;
}

/** The text output of `lw qa changes`. It prints no file list. */
export function renderChanges(result: ChangesDigest): string {
  const out = [`range   ${result.range.line}`, `basis   ${result.range.basis}`, `base    ${result.range.base.slice(0, 7)} (the range starts after it)`];
  if (result.commits.length === 0) return [...out, '', 'No commits in that range.'].join('\n');
  out.push('', 'commits by area (a commit that touches two areas is under both)');
  for (const [area, count] of Object.entries(result.areas).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    out.push(`  ${area} (${count})`);
    const inArea = result.commits.filter((c) => c.areas.includes(area));
    for (const commit of inArea.slice(0, AREA_COMMITS)) out.push(`    ${commit.short}  ${commit.date}  ${commit.subject}`);
    if (inArea.length > AREA_COMMITS) out.push(`    +${inArea.length - AREA_COMMITS} more (--json lists them all)`);
  }
  out.push('', 'signals');
  for (const [kind, files] of Object.entries(result.signals.added)) out.push(`  new ${kind.padEnd(10)} ${files.length === 0 ? 'none' : capped(files)}`);
  out.push(`  documents      ${result.signals.documents.length === 0 ? 'none' : capped(result.signals.documents, 10)}`);
  return out.join('\n');
}
