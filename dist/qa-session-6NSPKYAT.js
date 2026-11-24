import {
  consentGate
} from "./chunk-YX2HHX3H.js";
import {
  fixtureArming
} from "./chunk-IIMOXBEX.js";
import "./chunk-TBOP4L3A.js";
import "./chunk-RZYPGI2F.js";
import "./chunk-L7ICYOID.js";
import {
  createTargetRegistry,
  forkLabel,
  runManifest
} from "./chunk-7YME3OFL.js";
import {
  computeManifest
} from "./chunk-N6G3DBRC.js";
import {
  LOG_FORMAT,
  git,
  gitInstant,
  gitOut,
  lines,
  parseLog,
  repoRoot
} from "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import {
  worldForkRunner
} from "./chunk-7U5DCOOY.js";
import "./chunk-I3IUHHIW.js";
import "./chunk-4M4L73SK.js";
import "./chunk-4HWKGNXL.js";
import {
  loadAppEntry,
  worldContext
} from "./chunk-JPCS27IP.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import "./chunk-I4K4P4GZ.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-RGX37KPN.js";
import "./chunk-B3YQ27NA.js";
import "./chunk-42WWWMVO.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-APRIQSSG.js";
import {
  systemVideoTools
} from "./chunk-OF544TQR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import {
  legDefinitions,
  loadManifest,
  validateManifest
} from "./chunk-TQCRYULZ.js";
import {
  INTAKE_DIR
} from "./chunk-SA2YN55L.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-session.mts
import { readFileSync as readFileSync2 } from "fs";
import { resolve } from "path";

// src/services/resolve.mts
import { existsSync, readFileSync } from "fs";
import { basename, isAbsolute, join, relative, resolve as resolvePath } from "path";
var COMMIT_CAP = 120;
var FILE_CAP = 400;
var MIN_DIR_SEGMENTS = 4;
function specSlug(specPath) {
  return basename(specPath).replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-(design|analysis|build|plan)$/, "");
}
function readKey(all, headerEnd, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`);
  for (let i = 0; i < headerEnd; i++) {
    const match = re.exec(all[i] ?? "");
    if (!match) continue;
    const parts = [(match[1] ?? "").trim()];
    for (let j = i + 1; j < headerEnd; j++) {
      const next = all[j] ?? "";
      if (next.trim() === "" || /^#{1,6}\s/.test(next) || /^[A-Z][A-Za-z-]*:\s/.test(next)) break;
      parts.push(next.trim());
    }
    return parts.join(" ").trim() || null;
  }
  return null;
}
function parseSpec(text) {
  const all = text.split("\n");
  const firstSection = all.findIndex((l) => /^##\s/.test(l));
  const headerEnd = firstSection === -1 ? all.length : firstSection;
  const titleLine = all.slice(0, headerEnd).find((l) => /^#\s+\S/.test(l));
  const statusText = readKey(all, headerEnd, "Status");
  const sections = [];
  all.forEach((line, i) => {
    const match = /^(#{2,4})\s+(.*)$/.exec(line);
    if (match) sections.push({ level: (match[1] ?? "").length, heading: (match[2] ?? "").trim(), line: i + 1 });
  });
  return {
    title: titleLine ? titleLine.replace(/^#\s+/, "").trim() : null,
    date: readKey(all, headerEnd, "Date"),
    status: statusText ? /^([a-z][a-z-]*)/.exec(statusText)?.[1] ?? null : null,
    statusText,
    subject: readKey(all, headerEnd, "Subject"),
    sections
  };
}
function codeSpans(text) {
  const spans = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      spans.push(line);
      continue;
    }
    for (const match of line.matchAll(/`([^`]+)`/g)) spans.push(match[1] ?? "");
  }
  return spans;
}
function pathTokens(span) {
  const found = [];
  for (const match of span.matchAll(/[A-Za-z0-9_@./-]+/g)) {
    const token = match[0].replace(/[.,;:)\]}'"]+$/, "").replace(/#L?\d+(-L?\d+)?$/, "").replace(/:\d+(-\d+)?$/, "").replace(/^\.\//, "").replace(/\/$/, "");
    if (!token.includes("/") || token.startsWith("/") || token.startsWith("http")) continue;
    found.push(token);
  }
  return found;
}
function specPaths(repo, text) {
  const trackedList = lines(gitOut(repo, ["ls-files"]));
  const tracked = new Set(trackedList);
  const dirs = /* @__PURE__ */ new Set();
  for (const path of tracked) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  const files = /* @__PURE__ */ new Set();
  const namedDirs = /* @__PURE__ */ new Set();
  const unknown = /* @__PURE__ */ new Set();
  for (const span of codeSpans(text)) {
    for (const token of pathTokens(span)) {
      if (tracked.has(token)) {
        files.add(token);
        continue;
      }
      if (dirs.has(token)) {
        if (token.split("/").length >= MIN_DIR_SEGMENTS) namedDirs.add(token);
        else unknown.add(`${token} (a folder, too broad to search: needs ${MIN_DIR_SEGMENTS} segments)`);
        continue;
      }
      if (!/\.[a-z0-9]{1,6}$/i.test(token)) continue;
      const matches = trackedList.filter((path) => path.endsWith(`/${token}`));
      if (matches.length === 1) files.add(matches[0]);
      else if (matches.length > 1) unknown.add(`${token} (matches ${matches.length} tracked files, so it is ambiguous)`);
      else unknown.add(token);
    }
  }
  return { files: [...files].sort(), dirs: [...namedDirs].sort(), unknown: [...unknown].sort() };
}
function record(union, commit, source, via = []) {
  const existing = union.get(commit.sha);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    for (const path of via) if (!existing.via.includes(path)) existing.via.push(path);
    return;
  }
  const { sha, short, date, author, subject } = commit;
  union.set(commit.sha, { sha, short, date, author, subject, sources: [source], via: [...via] });
}
function commitAt(repo, rev) {
  const out = git(repo, ["log", "-1", `--format=${LOG_FORMAT}`, `${rev}^{commit}`], { allowFail: true });
  return out ? parseLog(out)[0] ?? null : null;
}
function fromStatus(repo, union, statusText) {
  const claimed = [];
  const rejected = [];
  for (const match of (statusText ?? "").matchAll(/\b[0-9a-f]{7,40}\b/gi)) {
    const commit = commitAt(repo, match[0]);
    if (!commit) {
      rejected.push(match[0]);
      continue;
    }
    claimed.push(commit.short);
    record(union, commit, "status");
  }
  return { claimed, rejected, note: "shas on the Status: line of the spec" };
}
function fromGrep(repo, union, terms) {
  const args = ["log", "--all", "--no-merges", "--fixed-strings", "--regexp-ignore-case", `--format=${LOG_FORMAT}`, ...terms.map((t) => `--grep=${t}`)];
  const commits = parseLog(gitOut(repo, args));
  for (const commit of commits.slice(0, COMMIT_CAP)) record(union, commit, "grep");
  return { terms, matched: commits.length, truncated: commits.length > COMMIT_CAP, note: "commit messages that name the spec file or its title" };
}
function fromPaths(repo, union, paths, since, until) {
  const pathspec = [...paths.files, ...paths.dirs];
  if (pathspec.length === 0) return { pathspec, window: null, matched: 0, truncated: false, note: "the spec names no tracked path" };
  const commits = parseLog(gitOut(repo, ["log", "--all", "--no-merges", `--since=${gitInstant(since)}`, `--until=${until}`, `--format=${LOG_FORMAT}`, "--name-only", "--", ...pathspec]));
  for (const commit of commits.slice(0, COMMIT_CAP)) record(union, commit, "paths", commit.paths);
  return {
    pathspec,
    window: `${gitInstant(since)} .. ${until}`,
    matched: commits.length,
    truncated: commits.length > COMMIT_CAP,
    note: "commits that touched a named path between the spec Date: and today"
  };
}
function filesTouched(repo, shas) {
  if (shas.length === 0) return { count: 0, list: [], truncated: false };
  const files = /* @__PURE__ */ new Set();
  for (const commit of parseLog(gitOut(repo, ["log", "--no-walk", `--format=${LOG_FORMAT}`, "--name-only", ...shas]))) {
    for (const path of commit.paths) files.add(path);
  }
  const list2 = [...files].sort();
  return { count: list2.length, list: list2.slice(0, FILE_CAP), truncated: list2.length > FILE_CAP };
}
function suggestLegs(input) {
  const named = new Set(input.specFiles);
  const paths = [.../* @__PURE__ */ new Set([...input.specFiles, ...input.commitFiles])];
  const browser = (surfaces) => input.legs.filter((l) => surfaces.includes(l.surface) && l.target === "playwright").map((l) => l.name);
  const evidence = [];
  const notes = [];
  const add = (legs, rule, matched) => {
    if (matched.length === 0 || legs.length === 0) return;
    evidence.push({
      legs,
      rule,
      fromSpec: matched.filter((p) => named.has(p)).slice(0, 8),
      fromCommits: matched.filter((p) => !named.has(p)).slice(0, 8),
      matched: matched.length
    });
  };
  const roots = input.clientRoots.map((r) => r.replace(/\/+$/, ""));
  add(
    browser(["web", "miniapp"]),
    `a file under qa.clientRoots (${roots.join(", ")})`,
    paths.filter((p) => roots.some((r) => p.startsWith(`${r}/`)))
  );
  add(browser(["bot"]), "a bot feature file (*.feature.mts)", paths.filter((p) => p.endsWith(".feature.mts")));
  const suggested = input.legs.map((l) => l.name).filter((name) => evidence.some((e) => e.legs.includes(name)));
  if (suggested.length === 0) notes.push("No rule matched. Choose the legs by hand with --legs, and say why in section 4.");
  if (evidence.length > 0 && evidence.every((e) => e.fromSpec.length === 0)) {
    notes.push("Every leg here comes from a file a commit touched, not one the spec names. Check the evidence before trusting the list.");
  }
  return { suggested, evidence, notes };
}
function resolveSpec(opts) {
  const { repo } = opts;
  const abs = isAbsolute(opts.specPath) ? opts.specPath : resolvePath(opts.cwd, opts.specPath);
  if (!existsSync(abs)) throw new LaunchwrightError("qa.session.resolve", `${opts.specPath} does not exist`, { context: { path: opts.specPath } });
  if (!abs.endsWith(".md")) throw new LaunchwrightError("qa.session.resolve", `${opts.specPath} is not a Markdown spec`, { context: { path: opts.specPath } });
  const rel = relative(repo, abs).startsWith("..") ? abs : relative(repo, abs);
  const text = readFileSync(abs, "utf8");
  const spec = parseSpec(text);
  const notes = [];
  if (!rel.startsWith("docs/specs/") && !rel.startsWith("docs/plans/")) notes.push(`${rel} is outside docs/specs/ and docs/plans/, so it may have no spec header.`);
  const filenameDate = /^(\d{4}-\d{2}-\d{2})-/.exec(basename(rel))?.[1] ?? null;
  const dateField = spec.date ? /(\d{4}-\d{2}-\d{2})/.exec(spec.date)?.[1] ?? null : null;
  const since = dateField ?? filenameDate;
  if (!since) notes.push("No Date: line and no YYYY-MM-DD file name prefix, so the source of touched files is skipped.");
  const today = opts.clock.date().toISOString().slice(0, 10);
  const paths = specPaths(repo, text);
  const union = /* @__PURE__ */ new Map();
  const sources = {
    status: fromStatus(repo, union, spec.statusText),
    grep: fromGrep(repo, union, [basename(rel).replace(/\.md$/, ""), spec.title].filter((t) => Boolean(t))),
    paths: since ? fromPaths(repo, union, paths, since, `${today}T23:59:59`) : { pathspec: [], window: null, matched: 0, truncated: false, note: "skipped: the spec has no date" }
  };
  const commits = [...union.values()].sort((a, b) => a.date.localeCompare(b.date) || a.short.localeCompare(b.short));
  const files = filesTouched(
    repo,
    commits.map((c) => c.sha)
  );
  if (commits.length === 0) {
    notes.push(
      `Zero commits. No sha on Status:, no commit message names the spec, and no commit touched its ${paths.files.length} tracked file(s) in its window. Say so in section 2, and still shoot the screens the spec names.`
    );
  }
  if (sources.status.rejected.length > 0) notes.push(`Status: names ${sources.status.rejected.join(", ")}, which are not commits here.`);
  if (paths.unknown.length > 0) notes.push(`${paths.unknown.length} named path(s) are not tracked here: ${paths.unknown.slice(0, 8).join(", ")}`);
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
      assets: `${opts.reportDir}/assets/${slug}/`
    },
    notes
  };
}
var LEG_HINTS = [
  { leg: "safari-ios", words: /\b(iphone|ipad|ios|safari)\b|айфон/giu },
  { leg: "telegram-android", words: /\bandroid\b|андроид/giu },
  { leg: "miniapp", words: /\b(telegram|mini ?app|web ?app)\b|телеграм/giu },
  { leg: "telegram-fake", words: /\b(bot|\/start)\b|бот/giu },
  { leg: "mobile-web", words: /\b(mobile|phone|smartphone|pixel|galaxy|samsung|xiaomi|huawei|oneplus)\b|телефон/giu },
  { leg: "desktop", words: /\b(desktop|laptop|windows|macos|chrome|firefox|edge)\b/giu }
];
function resolveIssue(cwd, id, legNames) {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new LaunchwrightError("qa.session.issue", `${id} is not an intake issue id`, { context: { id } });
  const dir = join(INTAKE_DIR, id);
  const file = join(cwd, dir, "issue.json");
  let issue;
  try {
    issue = JSON.parse(readFileSync(file, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.session.issue", `Cannot read the intake issue ${dir}/issue.json. Run lw qa intake first.`, { cause, context: { id } });
  }
  const text = [issue.title, issue.text, ...issue.thread.map((t) => t.text)].join("\n");
  const known = new Set(legNames);
  const legs = LEG_HINTS.filter((h) => known.has(h.leg)).map((h) => ({ leg: h.leg, words: [...new Set([...text.matchAll(h.words)].map((m) => m[0].toLowerCase()))] })).filter((h) => h.words.length > 0);
  const notes = [];
  if (legs.length === 0) notes.push("The text hints at no leg. Choose the legs by hand, and say why in section 4.");
  if (issue.skipped.length > 0) notes.push(`${issue.skipped.length} attachment(s) were not downloaded: ${issue.skipped.map((s) => s.reason).join(", ")}.`);
  return {
    issue: issue.id,
    title: issue.title,
    claim: issue.text,
    reference: issue.attachments.filter((a) => a.kind === "image" || a.kind === "video").map((a) => ({ kind: a.kind, path: join(dir, a.path) })),
    legs,
    source: `issue:${issue.id}`,
    notes
  };
}

// src/commands/qa-session.mts
var USAGE = [
  "usage: lw qa session resolve <spec.md>",
  "       lw qa session resolve --issue <id> [<id> ...]",
  "       lw qa session check <plan.shots.json>",
  "       lw qa session run <plan.shots.json> [--legs a,b] [--only <id>,<id>] [--base [<surface>=]<url>]... [--allow-all] [--allow <item-id>]...",
  "  resolve   what the spec promised and what was built, or one row seed per intake issue, as JSON",
  "  check     validate a plan and print every problem",
  "  run       run every row on every leg, record the evidence, write the ledger and results.jsonl",
  "  --allow-all   grant every item of the run contract that the pass prints, so a rerun asks nothing (spec 2.6)",
  "  --allow <id>  grant one printed item, for example data:qa-world-arm; repeat it per item"
];
var SURFACES = ["web", "miniapp", "bot"];
function armingBuilder(opts) {
  const factory = fixtureArming;
  if (!factory) return void 0;
  return (database) => {
    let opened = null;
    const open = () => {
      opened ??= factory({ cwd: opts.cwd, out: opts.out, err: opts.err, ...opts.config ? { config: opts.config } : {}, ...opts.env ? { env: opts.env } : {}, ...database ? { database } : {} });
      return opened;
    };
    return {
      arm: async (state, o) => (await open()).arm(state, o),
      disarm: async () => {
        if (opened) await (await opened).disarm();
      }
    };
  };
}
function forkRunner(opts) {
  let built = null;
  const runner = () => built ??= (async () => {
    const ctx = await worldContext({ cwd: opts.cwd, out: opts.out, err: opts.err, ...opts.config ? { config: opts.config } : {}, ...opts.env ? { env: opts.env } : {} });
    const entry = await loadAppEntry(ctx.root, ctx.qa);
    return worldForkRunner({ root: ctx.root, sections: ctx.sections, env: ctx.env, overlay: ctx.overlay, entry, registry: ctx.registry, out: opts.out });
  })();
  return {
    create: async (label) => (await runner()).create(label),
    drop: async (name) => (await runner()).drop(name),
    serve: async (database) => (await runner()).serve(database)
  };
}
function list(value, flag) {
  const parts = (value ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new LaunchwrightError("qa.session.usage", `${flag} needs a comma-separated list`);
  return parts;
}
function baseFlag(value, into) {
  const match = /^(web|miniapp|bot)=(.+)$/.exec(value ?? "");
  const url = match ? match[2] : value ?? "";
  try {
    new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("qa.session.usage", `--base ${value ?? ""} is not [<surface>=]<url>`, { cause });
  }
  for (const surface of match ? [match[1]] : SURFACES) into[surface] = url;
}
function revision(cwd) {
  const commit = git(cwd, ["rev-parse", "HEAD"], { allowFail: true })?.trim();
  if (!commit) throw new LaunchwrightError("qa.session.git", `${cwd} has no commit. The ledger names the commit of each file.`);
  const status = git(cwd, ["status", "--porcelain"], { allowFail: true }) ?? "";
  return { commit, dirty: status.trim() !== "" };
}
function dataNeeds(shots) {
  const needs = [];
  const armed = new Set(shots.filter((shot) => forkLabel(shot) === void 0).flatMap((shot) => shot.fixture.arm));
  if (armed.size > 0) needs.push({ id: "qa-world-arm", title: `Arm ${armed.size} state(s) on the QA world database, then disarm them` });
  const labels = [...new Set(shots.map(forkLabel).filter((label) => label !== void 0))].sort();
  if (labels.length > 0) needs.push({ id: "qa-database-fork", title: `Fork the QA database for row group(s) ${labels.join(", ")}, then drop each fork` });
  return needs;
}
async function consentManifest(planPath, config, filter, targets) {
  const defs = legDefinitions(config);
  const byName = new Map(defs.map((leg) => [leg.name, leg]));
  const plan = await loadManifest(planPath, { legs: defs.map((leg) => leg.name) });
  const used = /* @__PURE__ */ new Set();
  const shots = [];
  for (const shot of plan.shots) {
    if (filter.only && !filter.only.includes(shot.id)) continue;
    const names = shot.legs.filter((name) => !filter.legs || filter.legs.includes(name));
    if (names.length > 0) shots.push(shot);
    for (const name of names) used.add(name);
  }
  const legs = [...used].map((name) => byName.get(name)).filter((leg) => leg !== void 0);
  const registered = new Set(targets.names());
  const credentials = [];
  const outward = [];
  const data = dataNeeds(shots);
  for (const leg of legs) {
    if (!registered.has(leg.target)) continue;
    const needs = targets.get(leg.target).needs?.(leg);
    credentials.push(...needs?.credentials ?? []);
    outward.push(...needs?.outward ?? []);
    data.push(...needs?.data ?? []);
  }
  return computeManifest({ title: plan.title, legs, credentials, outward, data });
}
async function run(args, opts, config) {
  const parsed = parseCommandArgs({ values: ["legs", "only"], switches: ["allow-all"], repeated: ["base", "allow"] }, args);
  const [manifestArg, extra] = parsed.positionals;
  if (!manifestArg) throw new LaunchwrightError("qa.session.usage", "run needs a plan path");
  if (extra !== void 0) throw new LaunchwrightError("qa.session.usage", `run does not know ${extra}`);
  const legs = parsed.values.legs === void 0 ? null : list(parsed.values.legs, "--legs");
  const only = parsed.values.only === void 0 ? null : list(parsed.values.only, "--only");
  const baseUrls = { ...config.baseUrls };
  for (const value of parsed.lists.base) baseFlag(value, baseUrls);
  const manifestPath = resolve(opts.cwd, manifestArg);
  const targets = createTargetRegistry(config, opts.targets ?? {}, systemClock);
  const contract = await consentManifest(manifestPath, config, { legs, only }, targets);
  const choice = { allowAll: parsed.switches.has("allow-all"), allow: parsed.lists.allow };
  if (!await consentGate(contract, { cwd: opts.cwd, out: opts.out, err: opts.err, ...choice })) return 2;
  const build = armingBuilder(opts);
  const fixtures = build?.();
  const summary = await runManifest(
    { manifestPath, legs, only },
    {
      config,
      targets,
      clock: systemClock,
      baseUrls,
      revision: revision(opts.cwd),
      videoTools: systemVideoTools(),
      ...fixtures ? { fixtures } : {},
      fork: forkRunner(opts),
      out: opts.out,
      err: opts.err
    }
  );
  const count = (status) => summary.results.filter((r) => r.status === status).length;
  opts.out(
    `lw qa session run: ${summary.results.length} row and leg pairs: ${count("passed")} passed, ${count("failed")} failed, ${count("n/a")} n/a, ${count("not-run")} not run. Next: lw qa report update ${config.reportDir}/${summary.slug}.md`
  );
  return summary.exitCode;
}
var session = {
  name: "session",
  summary: "Resolve a spec or intake issues, check a plan, run a plan with evidence",
  async run(args, opts) {
    const [action, ...rest] = args;
    const config = qaConfigOf(opts.config);
    const legs = legDefinitions(config);
    try {
      const resolveArgs = action === "resolve" ? parseCommandArgs({ switches: ["issue"] }, rest) : null;
      if (resolveArgs?.switches.has("issue")) {
        const ids = resolveArgs.positionals;
        if (ids.length === 0) throw new UsageError("resolve --issue needs one issue id or more");
        const names = legs.map((l) => l.name);
        opts.out(JSON.stringify({ issues: ids.map((id) => resolveIssue(opts.cwd, id, names)) }, null, 2));
        return 0;
      }
      if (resolveArgs?.positionals.length === 1) {
        const repo = repoRoot(opts.cwd);
        const result = resolveSpec({
          repo,
          cwd: opts.cwd,
          specPath: resolveArgs.positionals[0],
          reportDir: config.reportDir,
          clientRoots: config.clientRoots,
          legs,
          clock: systemClock
        });
        opts.out(JSON.stringify(result, null, 2));
        return 0;
      }
      if (action === "check" && rest.length === 1) {
        const path = resolve(opts.cwd, rest[0]);
        let parsed;
        try {
          parsed = JSON.parse(readFileSync2(path, "utf8"));
        } catch (cause) {
          throw new LaunchwrightError("qa.session.check", `Cannot read ${rest[0]} as JSON.`, { cause });
        }
        const errors = validateManifest(parsed, { legs: legs.map((l) => l.name) });
        if (errors.length > 0) {
          opts.err(`${rest[0]} is invalid: ${errors.length} problem(s)`);
          for (const e of errors) opts.err(`  ${e}`);
          return 1;
        }
        const shots = parsed.shots;
        const used = new Set(shots.flatMap((s) => s.legs));
        opts.out(`ok  ${rest[0]}: ${shots.length} row(s), legs ${legs.filter((l) => used.has(l.name)).map((l) => l.name).join(" ")}`);
        return 0;
      }
      if (action === "run") return await run(rest, opts, config);
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa session ${action}: ${cause.code}: ${cause.message}`);
      return cause instanceof UsageError || cause.code === "qa.session.usage" ? 2 : 1;
    }
    for (const line of USAGE) opts.err(line);
    return 2;
  }
};
var qa_session_default = session;
export {
  qa_session_default as default
};
//# sourceMappingURL=qa-session-6NSPKYAT.js.map