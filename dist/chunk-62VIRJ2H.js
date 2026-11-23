import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/changes.mts
import { spawnSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
var EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
var RECORD = "";
var FIELD = "";
var LOG_FORMAT = `${RECORD}%H${FIELD}%h${FIELD}%cI${FIELD}%an${FIELD}%s`;
var DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
var SHA = /^[0-9a-f]{7,40}$/i;
var DOC_DIRS = ["docs/specs/", "docs/plans/", "docs/superpowers/plans/"];
var ADDED_KINDS = {
  pages: /\.page\.tsx$/,
  features: /\.feature\.mts$/,
  worlds: /\.world\.mts$/,
  jobs: /\.job\.mts$/,
  commands: /\.command\.mts$/,
  endpoints: /(^|\/)http\/[^/]+\.mts$/
};
var GIT_TIMEOUT_MS = 12e4;
function git(repo, args, opts = {}) {
  const res = spawnSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: GIT_TIMEOUT_MS, killSignal: "SIGKILL" });
  if (res.error) throw new LaunchwrightError("qa.git", `Cannot run git ${args.join(" ")}: ${res.error.message}`, { cause: res.error, context: { repo } });
  if (res.status !== 0) {
    if (opts.allowFail) return null;
    throw new LaunchwrightError("qa.git", `git ${args.join(" ")} failed: ${(res.stderr ?? "").trim()}`, { context: { repo, args } });
  }
  return res.stdout;
}
function gitOut(repo, args) {
  return git(repo, args) ?? "";
}
function lines(text) {
  return (text ?? "").split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
}
function parseLog(out) {
  const commits = [];
  for (const chunk of (out ?? "").split(RECORD).slice(1)) {
    const [header = "", ...rest] = chunk.split("\n");
    const [sha = "", short = "", date = "", author = "", subject = ""] = header.split(FIELD);
    commits.push({ sha, short, date: date.slice(0, 10), author, subject, paths: rest.map((l) => l.trim()).filter(Boolean) });
  }
  return commits;
}
function repoRoot(cwd) {
  const out = git(cwd, ["rev-parse", "--show-toplevel"], { allowFail: true });
  if (!out?.trim()) throw new LaunchwrightError("qa.git.repo", `${cwd} is not inside a git repository.`, { context: { cwd } });
  return out.trim();
}
function gitInstant(date) {
  const [day, time = ""] = date.split(/[ T]/);
  const parts = time ? time.split(":") : [];
  while (parts.length < 3) parts.push("00");
  return `${day}T${parts.join(":")}`;
}
function parseRangeLine(text) {
  for (const line of text.split("\n")) {
    const match = /^Range:\s*(.+)$/.exec(line.trim());
    const after = match?.[1]?.split("->")[1];
    if (!after) continue;
    const sha = /\b([0-9a-f]{7,40})\b/i.exec(after);
    if (sha?.[1]) return sha[1];
  }
  return null;
}
function newestReport(dir) {
  if (!existsSync(dir)) return null;
  const found = readdirSync(dir).filter((name) => name.endsWith(".md")).map((name) => ({ name, path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs })).sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
  return found[0] ?? null;
}
function refuse(message, context = {}) {
  return new LaunchwrightError("qa.changes.range", message, { context });
}
var PASS_SINCE = "Pass --since <date> (2026-08-21), or --since <sha>.";
function resolveRange(repo, opts) {
  const head = opts.head ?? "HEAD";
  const since = opts.since;
  if (since === void 0) {
    const report = newestReport(join(repo, opts.reportDir));
    if (!report) throw refuse(`No report under ${opts.reportDir}/ to continue from. ${PASS_SINCE}`);
    const sha = parseRangeLine(readFileSync(report.path, "utf8"));
    if (!sha) throw refuse(`${opts.reportDir}/${report.name} has no "Range:" line with a sha after "->". ${PASS_SINCE}`, { report: report.name });
    const resolved = git(repo, ["rev-parse", "--verify", `${sha}^{commit}`], { allowFail: true });
    if (!resolved) throw refuse(`${opts.reportDir}/${report.name} names ${sha}, which is not a commit here. ${PASS_SINCE}`, { sha });
    return { base: resolved.trim(), basis: `--last (after ${sha}, the end of ${opts.reportDir}/${report.name})` };
  }
  if (SHA.test(since)) {
    const resolved = git(repo, ["rev-parse", "--verify", `${since}^{commit}`], { allowFail: true });
    if (!resolved) throw refuse(`--since ${since} is not a commit in this repository.`, { since });
    const start = resolved.trim();
    const parent = git(repo, ["rev-parse", "--verify", `${start}^`], { allowFail: true });
    return { base: parent ? parent.trim() : EMPTY_TREE, basis: `--since ${since} (that commit, included)` };
  }
  if (!DATE.test(since)) throw refuse(`--since ${since} is neither a date (2026-08-21, "2026-08-21 14:00") nor a sha.`, { since });
  const before = gitOut(repo, ["rev-list", "-1", `--before=${gitInstant(since)}`, head]).trim();
  const base = before || EMPTY_TREE;
  const count = Number(gitOut(repo, ["rev-list", "--count", `${base}..${head}`]).trim());
  if (count === 0) throw refuse(`No commit at or after ${since} on ${head}.`, { since });
  return { base, basis: `--since ${since} (the first commit at or after it)` };
}
function workspaceGlobs(yaml) {
  const globs = [];
  let inPackages = false;
  for (const raw of yaml.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "");
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
function globRegex(glob) {
  const body = glob.replace(/\/+$/, "").split("/").map((seg) => seg === "**" ? ".*" : seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("/");
  return new RegExp(`^${body}$`);
}
function workspaceAreas(globs, trackedFiles) {
  const include = globs.filter((g) => !g.startsWith("!")).map(globRegex);
  const exclude = globs.filter((g) => g.startsWith("!")).map((g) => globRegex(g.slice(1)));
  const tracked = new Set(trackedFiles);
  const areas = /* @__PURE__ */ new Set();
  for (const file of trackedFiles) {
    if (!file.endsWith("/package.json")) continue;
    const dir = file.slice(0, -"/package.json".length);
    if (!include.some((re) => re.test(dir)) || exclude.some((re) => re.test(dir))) continue;
    const parent = dir.split("/").slice(0, -1).join("/");
    const moduleDir = dir.endsWith("/ts") && tracked.has(`${parent}/module.toml`) ? parent : null;
    areas.add(moduleDir ?? dir);
  }
  return [...areas].sort((a, b) => b.length - a.length || a.localeCompare(b));
}
function areaOf(path, areas) {
  const hit = areas.find((area) => path === area || path.startsWith(`${area}/`));
  if (hit) return hit;
  const slash = path.indexOf("/");
  return slash === -1 ? "root" : path.slice(0, slash);
}
function areasFor(paths, areas) {
  return [...new Set(paths.map((p) => areaOf(p, areas)))].sort();
}
function digest(repo, opts) {
  const head = opts.head ?? "HEAD";
  const { base, basis } = resolveRange(repo, opts);
  const globs = workspaceGlobs(git(repo, ["show", `${head}:pnpm-workspace.yaml`], { allowFail: true }) ?? "");
  const areaDirs = workspaceAreas(globs, lines(gitOut(repo, ["ls-tree", "-r", "--name-only", head])));
  const commits = parseLog(gitOut(repo, ["log", "--reverse", "--name-only", `--format=${LOG_FORMAT}`, `${base}..${head}`])).map(
    ({ paths, ...c }) => ({ ...c, areas: areasFor(paths, areaDirs) })
  );
  const added = lines(gitOut(repo, ["diff", "--name-only", "--diff-filter=A", base, head]));
  const areas = {};
  for (const commit of commits) for (const area of commit.areas) areas[area] = (areas[area] ?? 0) + 1;
  const first = commits[0];
  const last = commits.at(-1);
  const clock = opts.clock ?? systemClock;
  return {
    range: {
      base,
      basis,
      head: gitOut(repo, ["rev-parse", "--short", head]).trim(),
      start: first ? { sha: first.sha, short: first.short, date: first.date } : null,
      end: last ? { sha: last.sha, short: last.short, date: last.date } : null,
      commits: commits.length,
      line: first && last ? `${first.date} ${first.short} -> ${last.date} ${last.short}, ${commits.length} commits` : `no commits on ${clock.date().toISOString().slice(0, 10)}`
    },
    areas,
    commits,
    signals: {
      added: Object.fromEntries(Object.entries(ADDED_KINDS).map(([kind, re]) => [kind, added.filter((p) => re.test(p)).sort()])),
      documents: added.filter((p) => DOC_DIRS.some((d) => p.startsWith(d)) && p.endsWith(".md")).sort()
    }
  };
}
var AREA_COMMITS = 20;
function capped(values, limit = 20) {
  return values.length <= limit ? values.join(", ") : `${values.slice(0, limit).join(", ")}, +${values.length - limit} more`;
}
function renderChanges(result) {
  const out = [`range   ${result.range.line}`, `basis   ${result.range.basis}`, `base    ${result.range.base.slice(0, 7)} (the range starts after it)`];
  if (result.commits.length === 0) return [...out, "", "No commits in that range."].join("\n");
  out.push("", "commits by area (a commit that touches two areas is under both)");
  for (const [area, count] of Object.entries(result.areas).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    out.push(`  ${area} (${count})`);
    const inArea = result.commits.filter((c) => c.areas.includes(area));
    for (const commit of inArea.slice(0, AREA_COMMITS)) out.push(`    ${commit.short}  ${commit.date}  ${commit.subject}`);
    if (inArea.length > AREA_COMMITS) out.push(`    +${inArea.length - AREA_COMMITS} more (--json lists them all)`);
  }
  out.push("", "signals");
  for (const [kind, files] of Object.entries(result.signals.added)) out.push(`  new ${kind.padEnd(10)} ${files.length === 0 ? "none" : capped(files)}`);
  out.push(`  documents      ${result.signals.documents.length === 0 ? "none" : capped(result.signals.documents, 10)}`);
  return out.join("\n");
}

export {
  LOG_FORMAT,
  git,
  gitOut,
  lines,
  parseLog,
  repoRoot,
  gitInstant,
  digest,
  renderChanges
};
//# sourceMappingURL=chunk-62VIRJ2H.js.map