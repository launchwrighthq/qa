// `lw qa session resolve`: what a pass needs before it plans rows (spec 2.4, 2.15.4).
//
// For a spec it answers what the spec promised and what was built, with the evidence for each
// answer: the spec header and sections, the paths it names, and the commits from three sources
// (shas on its `Status:` line, commit messages that name it, commits that touched the files it
// names inside its window). For intake issues it gives one row seed per issue. The agent writes
// the rows; this file decides nothing a person would argue about.
import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve as resolvePath } from 'node:path';
import { type Clock, LaunchwrightError } from '@launchwrighthq/kernel';
import { git, gitInstant, gitOut, lines, LOG_FORMAT, type LogCommit, parseLog } from './changes.mts';
import { INTAKE_DIR, type Leg, type QaIssue, type Surface } from './types.mts';

/** How many commits one source adds before the list is cut and flagged. */
const COMMIT_CAP = 120;
/** How many touched files the answer lists. */
const FILE_CAP = 400;
/** A folder a spec names counts as a pathspec only at this depth or deeper. A shallower one is too broad. */
const MIN_DIR_SEGMENTS = 4;

/** The report slug of a spec: the file name without the date, the `.md` and a kind suffix. */
export function specSlug(specPath: string): string {
  return basename(specPath)
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/-(design|analysis|build|plan)$/, '');
}

/** One header value with its wrapped lines. A blank line, a heading or another `Key:` ends it. */
function readKey(all: string[], headerEnd: number, key: string): string | null {
  const re = new RegExp(`^${key}:\\s*(.*)$`);
  for (let i = 0; i < headerEnd; i++) {
    const match = re.exec(all[i] ?? '');
    if (!match) continue;
    const parts = [(match[1] ?? '').trim()];
    for (let j = i + 1; j < headerEnd; j++) {
      const next = all[j] ?? '';
      if (next.trim() === '' || /^#{1,6}\s/.test(next) || /^[A-Z][A-Za-z-]*:\s/.test(next)) break;
      parts.push(next.trim());
    }
    return parts.join(' ').trim() || null;
  }
  return null;
}

export interface SpecHeader {
  title: string | null;
  date: string | null;
  /** The status word alone: `approved`, `superseded-by`. */
  status: string | null;
  statusText: string | null;
  subject: string | null;
  sections: Array<{ level: number; heading: string; line: number }>;
}

/** The header (everything before the first `## `) and the section headings of a spec. */
export function parseSpec(text: string): SpecHeader {
  const all = text.split('\n');
  const firstSection = all.findIndex((l) => /^##\s/.test(l));
  const headerEnd = firstSection === -1 ? all.length : firstSection;
  const titleLine = all.slice(0, headerEnd).find((l) => /^#\s+\S/.test(l));
  const statusText = readKey(all, headerEnd, 'Status');
  const sections: SpecHeader['sections'] = [];
  all.forEach((line, i) => {
    const match = /^(#{2,4})\s+(.*)$/.exec(line);
    if (match) sections.push({ level: (match[1] ?? '').length, heading: (match[2] ?? '').trim(), line: i + 1 });
  });
  return {
    title: titleLine ? titleLine.replace(/^#\s+/, '').trim() : null,
    date: readKey(all, headerEnd, 'Date'),
    status: statusText ? (/^([a-z][a-z-]*)/.exec(statusText)?.[1] ?? null) : null,
    statusText,
    subject: readKey(all, headerEnd, 'Subject'),
    sections,
  };
}

/** The body of every fenced block line and every inline code span. */
function codeSpans(text: string): string[] {
  const spans: string[] = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      spans.push(line);
      continue;
    }
    for (const match of line.matchAll(/`([^`]+)`/g)) spans.push(match[1] ?? '');
  }
  return spans;
}

/**
 * The repository paths a code span names. A line suffix (`file.mts:169-178`, `file.ts#L20`) and
 * trailing punctuation go, so the path works as a pathspec.
 */
export function pathTokens(span: string): string[] {
  const found: string[] = [];
  for (const match of span.matchAll(/[A-Za-z0-9_@./-]+/g)) {
    const token = match[0]
      .replace(/[.,;:)\]}'"]+$/, '')
      .replace(/#L?\d+(-L?\d+)?$/, '')
      .replace(/:\d+(-\d+)?$/, '')
      .replace(/^\.\//, '')
      .replace(/\/$/, '');
    if (!token.includes('/') || token.startsWith('/') || token.startsWith('http')) continue;
    found.push(token);
  }
  return found;
}

export interface SpecPaths {
  files: string[];
  dirs: string[];
  /** Named paths the repository does not hold, with the reason. Reported, never dropped. */
  unknown: string[];
}

function specPaths(repo: string, text: string): SpecPaths {
  const trackedList = lines(gitOut(repo, ['ls-files']));
  const tracked = new Set(trackedList);
  const dirs = new Set<string>();
  for (const path of tracked) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const files = new Set<string>();
  const namedDirs = new Set<string>();
  const unknown = new Set<string>();
  for (const span of codeSpans(text)) {
    for (const token of pathTokens(span)) {
      if (tracked.has(token)) {
        files.add(token);
        continue;
      }
      if (dirs.has(token)) {
        if (token.split('/').length >= MIN_DIR_SEGMENTS) namedDirs.add(token);
        else unknown.add(`${token} (a folder, too broad to search: needs ${MIN_DIR_SEGMENTS} segments)`);
        continue;
      }
      if (!/\.[a-z0-9]{1,6}$/i.test(token)) continue;
      // A suffix of exactly one tracked file names that file. Two matches are ambiguous.
      const matches = trackedList.filter((path) => path.endsWith(`/${token}`));
      if (matches.length === 1) files.add(matches[0] as string);
      else if (matches.length > 1) unknown.add(`${token} (matches ${matches.length} tracked files, so it is ambiguous)`);
      else unknown.add(token);
    }
  }
  return { files: [...files].sort(), dirs: [...namedDirs].sort(), unknown: [...unknown].sort() };
}

export interface ResolvedCommit {
  sha: string;
  short: string;
  date: string;
  author: string;
  subject: string;
  /** `status`, `grep`, `paths`. */
  sources: string[];
  /** The named paths that brought the commit in, for the `paths` source. */
  via: string[];
}

function record(union: Map<string, ResolvedCommit>, commit: LogCommit, source: string, via: string[] = []): void {
  const existing = union.get(commit.sha);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    for (const path of via) if (!existing.via.includes(path)) existing.via.push(path);
    return;
  }
  const { sha, short, date, author, subject } = commit;
  union.set(commit.sha, { sha, short, date, author, subject, sources: [source], via: [...via] });
}

function commitAt(repo: string, rev: string): LogCommit | null {
  const out = git(repo, ['log', '-1', `--format=${LOG_FORMAT}`, `${rev}^{commit}`], { allowFail: true });
  return out ? (parseLog(out)[0] ?? null) : null;
}

/** Source 1: the shas on the `Status:` line. `git rev-parse` filters the hex runs that are not commits. */
function fromStatus(repo: string, union: Map<string, ResolvedCommit>, statusText: string | null) {
  const claimed: string[] = [];
  const rejected: string[] = [];
  for (const match of (statusText ?? '').matchAll(/\b[0-9a-f]{7,40}\b/gi)) {
    const commit = commitAt(repo, match[0]);
    if (!commit) {
      rejected.push(match[0]);
      continue;
    }
    claimed.push(commit.short);
    record(union, commit, 'status');
  }
  return { claimed, rejected, note: 'shas on the Status: line of the spec' };
}

/** Source 2: commit messages that name the spec file or its title, on every branch. */
function fromGrep(repo: string, union: Map<string, ResolvedCommit>, terms: string[]) {
  const args = ['log', '--all', '--no-merges', '--fixed-strings', '--regexp-ignore-case', `--format=${LOG_FORMAT}`, ...terms.map((t) => `--grep=${t}`)];
  const commits = parseLog(gitOut(repo, args));
  for (const commit of commits.slice(0, COMMIT_CAP)) record(union, commit, 'grep');
  return { terms, matched: commits.length, truncated: commits.length > COMMIT_CAP, note: 'commit messages that name the spec file or its title' };
}

/** Source 3: commits on every branch that touched a named path, from the spec date to the end of today. */
function fromPaths(repo: string, union: Map<string, ResolvedCommit>, paths: SpecPaths, since: string, until: string) {
  const pathspec = [...paths.files, ...paths.dirs];
  if (pathspec.length === 0) return { pathspec, window: null, matched: 0, truncated: false, note: 'the spec names no tracked path' };
  const commits = parseLog(gitOut(repo, ['log', '--all', '--no-merges', `--since=${gitInstant(since)}`, `--until=${until}`, `--format=${LOG_FORMAT}`, '--name-only', '--', ...pathspec]));
  for (const commit of commits.slice(0, COMMIT_CAP)) record(union, commit, 'paths', commit.paths);
  return {
    pathspec,
    window: `${gitInstant(since)} .. ${until}`,
    matched: commits.length,
    truncated: commits.length > COMMIT_CAP,
    note: 'commits that touched a named path between the spec Date: and today',
  };
}

function filesTouched(repo: string, shas: string[]): { count: number; list: string[]; truncated: boolean } {
  if (shas.length === 0) return { count: 0, list: [], truncated: false };
  const files = new Set<string>();
  for (const commit of parseLog(gitOut(repo, ['log', '--no-walk', `--format=${LOG_FORMAT}`, '--name-only', ...shas]))) {
    for (const path of commit.paths) files.add(path);
  }
  const list = [...files].sort();
  return { count: list.length, list: list.slice(0, FILE_CAP), truncated: list.length > FILE_CAP };
}

export interface LegSuggestion {
  suggested: string[];
  evidence: Array<{ legs: string[]; rule: string; fromSpec: string[]; fromCommits: string[]; matched: number }>;
  notes: string[];
}

/**
 * The legs the touched paths suggest, with the evidence for each rule. A client file suggests
 * every browser leg of the `web` and `miniapp` surfaces; a bot feature suggests the browser legs
 * of the `bot` surface. A device leg is never suggested: a row names it on purpose.
 */
export function suggestLegs(input: { specFiles: string[]; commitFiles: string[]; clientRoots: string[]; legs: Leg[] }): LegSuggestion {
  const named = new Set(input.specFiles);
  const paths = [...new Set([...input.specFiles, ...input.commitFiles])];
  const browser = (surfaces: Surface[]): string[] => input.legs.filter((l) => surfaces.includes(l.surface) && l.target === 'playwright').map((l) => l.name);
  const evidence: LegSuggestion['evidence'] = [];
  const notes: string[] = [];
  const add = (legs: string[], rule: string, matched: string[]): void => {
    if (matched.length === 0 || legs.length === 0) return;
    evidence.push({
      legs,
      rule,
      fromSpec: matched.filter((p) => named.has(p)).slice(0, 8),
      fromCommits: matched.filter((p) => !named.has(p)).slice(0, 8),
      matched: matched.length,
    });
  };
  const roots = input.clientRoots.map((r) => r.replace(/\/+$/, ''));
  add(
    browser(['web', 'miniapp']),
    `a file under qa.clientRoots (${roots.join(', ')})`,
    paths.filter((p) => roots.some((r) => p.startsWith(`${r}/`))),
  );
  add(browser(['bot']), 'a bot feature file (*.feature.mts)', paths.filter((p) => p.endsWith('.feature.mts')));
  const suggested = input.legs.map((l) => l.name).filter((name) => evidence.some((e) => e.legs.includes(name)));
  if (suggested.length === 0) notes.push('No rule matched. Choose the legs by hand with --legs, and say why in section 4.');
  if (evidence.length > 0 && evidence.every((e) => e.fromSpec.length === 0)) {
    notes.push('Every leg here comes from a file a commit touched, not one the spec names. Check the evidence before trusting the list.');
  }
  return { suggested, evidence, notes };
}

export interface ResolveSpecOptions {
  repo: string;
  cwd: string;
  specPath: string;
  reportDir: string;
  clientRoots: string[];
  legs: Leg[];
  clock: Clock;
}

/** Everything a pass needs about a spec before it plans rows. Zero commits is a valid answer. */
export function resolveSpec(opts: ResolveSpecOptions) {
  const { repo } = opts;
  const abs = isAbsolute(opts.specPath) ? opts.specPath : resolvePath(opts.cwd, opts.specPath);
  if (!existsSync(abs)) throw new LaunchwrightError('qa.session.resolve', `${opts.specPath} does not exist`, { context: { path: opts.specPath } });
  if (!abs.endsWith('.md')) throw new LaunchwrightError('qa.session.resolve', `${opts.specPath} is not a Markdown spec`, { context: { path: opts.specPath } });
  const rel = relative(repo, abs).startsWith('..') ? abs : relative(repo, abs);
  const text = readFileSync(abs, 'utf8');
  const spec = parseSpec(text);
  const notes: string[] = [];
  if (!rel.startsWith('docs/specs/') && !rel.startsWith('docs/plans/')) notes.push(`${rel} is outside docs/specs/ and docs/plans/, so it may have no spec header.`);

  const filenameDate = /^(\d{4}-\d{2}-\d{2})-/.exec(basename(rel))?.[1] ?? null;
  const dateField = spec.date ? (/(\d{4}-\d{2}-\d{2})/.exec(spec.date)?.[1] ?? null) : null;
  const since = dateField ?? filenameDate;
  if (!since) notes.push('No Date: line and no YYYY-MM-DD file name prefix, so the source of touched files is skipped.');

  const today = opts.clock.date().toISOString().slice(0, 10);
  const paths = specPaths(repo, text);
  const union = new Map<string, ResolvedCommit>();
  const sources = {
    status: fromStatus(repo, union, spec.statusText),
    grep: fromGrep(repo, union, [basename(rel).replace(/\.md$/, ''), spec.title].filter((t): t is string => Boolean(t))),
    paths: since
      ? fromPaths(repo, union, paths, since, `${today}T23:59:59`)
      : { pathspec: [], window: null, matched: 0, truncated: false, note: 'skipped: the spec has no date' },
  };
  const commits = [...union.values()].sort((a, b) => a.date.localeCompare(b.date) || a.short.localeCompare(b.short));
  const files = filesTouched(
    repo,
    commits.map((c) => c.sha),
  );
  if (commits.length === 0) {
    notes.push(
      `Zero commits. No sha on Status:, no commit message names the spec, and no commit touched its ${paths.files.length} tracked file(s) in its window. ` +
        'Say so in section 2, and still shoot the screens the spec names.',
    );
  }
  if (sources.status.rejected.length > 0) notes.push(`Status: names ${sources.status.rejected.join(', ')}, which are not commits here.`);
  if (paths.unknown.length > 0) notes.push(`${paths.unknown.length} named path(s) are not tracked here: ${paths.unknown.slice(0, 8).join(', ')}`);

  const slug = `${today}-${specSlug(rel)}`;
  return {
    spec: { path: rel, slug, title: spec.title, date: spec.date, dateUsed: since, status: spec.status, statusText: spec.statusText, subject: spec.subject, sections: spec.sections },
    paths,
    commits: { count: commits.length, list: commits },
    sources,
    files,
    legs: suggestLegs({ specFiles: paths.files, commitFiles: files.list, clientRoots: opts.clientRoots, legs: opts.legs }),
    report: {
      path: `${opts.reportDir}/${slug}.md`,
      manifest: `${opts.reportDir}/${slug}.shots.json`,
      assets: `${opts.reportDir}/assets/${slug}/`,
    },
    notes,
  };
}

/** Words in an issue that hint at a leg, by leg name. A hint names only a leg the config has. */
const LEG_HINTS: Array<{ leg: string; words: RegExp }> = [
  { leg: 'safari-ios', words: /\b(iphone|ipad|ios|safari)\b|айфон/giu },
  { leg: 'telegram-android', words: /\bandroid\b|андроид/giu },
  { leg: 'miniapp', words: /\b(telegram|mini ?app|web ?app)\b|телеграм/giu },
  { leg: 'telegram-fake', words: /\b(bot|\/start)\b|бот/giu },
  { leg: 'mobile-web', words: /\b(mobile|phone|smartphone|pixel|galaxy|samsung|xiaomi|huawei|oneplus)\b|телефон/giu },
  { leg: 'desktop', words: /\b(desktop|laptop|windows|macos|chrome|firefox|edge)\b/giu },
];

/** One row seed per issue (spec 2.15.4). The agent writes the rows from it. */
export interface IssueSeed {
  issue: string;
  title: string;
  /** The reporter's text: the claim the row checks. */
  claim: string;
  /** The reporter's images and videos, relative to the project root. */
  reference: Array<{ kind: string; path: string }>;
  /** Leg names the text hints at, with the words found. */
  legs: Array<{ leg: string; words: string[] }>;
  /** The `source` value of every row of this issue. */
  source: string;
  notes: string[];
}

/** Reads `.lw/qa/intake/<id>/issue.json` and gives its row seed. */
export function resolveIssue(cwd: string, id: string, legNames: readonly string[]): IssueSeed {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new LaunchwrightError('qa.session.issue', `${id} is not an intake issue id`, { context: { id } });
  const dir = join(INTAKE_DIR, id);
  const file = join(cwd, dir, 'issue.json');
  let issue: QaIssue;
  try {
    issue = JSON.parse(readFileSync(file, 'utf8')) as QaIssue;
  } catch (cause) {
    throw new LaunchwrightError('qa.session.issue', `Cannot read the intake issue ${dir}/issue.json. Run lw qa intake first.`, { cause, context: { id } });
  }
  const text = [issue.title, issue.text, ...issue.thread.map((t) => t.text)].join('\n');
  const known = new Set(legNames);
  const legs = LEG_HINTS.filter((h) => known.has(h.leg))
    .map((h) => ({ leg: h.leg, words: [...new Set([...text.matchAll(h.words)].map((m) => m[0].toLowerCase()))] }))
    .filter((h) => h.words.length > 0);
  const notes: string[] = [];
  if (legs.length === 0) notes.push('The text hints at no leg. Choose the legs by hand, and say why in section 4.');
  if (issue.skipped.length > 0) notes.push(`${issue.skipped.length} attachment(s) were not downloaded: ${issue.skipped.map((s) => s.reason).join(', ')}.`);
  return {
    issue: issue.id,
    title: issue.title,
    claim: issue.text,
    reference: issue.attachments.filter((a) => a.kind === 'image' || a.kind === 'video').map((a) => ({ kind: a.kind, path: join(dir, a.path) })),
    legs,
    source: `issue:${issue.id}`,
    notes,
  };
}
