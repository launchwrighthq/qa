import {
  FEATURE_SUFFIX,
  WORLD_SUFFIX,
  featuresWithoutWorld,
  worldLintFindings
} from "./chunk-I4K4P4GZ.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfig,
  withAppPaths
} from "./chunk-7OHVK72J.js";
import {
  stateFindings
} from "./chunk-SQO6FPZ2.js";
import {
  readTree
} from "./chunk-NYZ72SDM.js";
import "./chunk-LBZC23FE.js";
import {
  QA_DEV_MARKER
} from "./chunk-277Y4WQJ.js";
import {
  pathKind,
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/services/check.mts
import { readdir, readFile } from "fs/promises";
import { basename, join, posix, relative, sep } from "path";
var C3_PATTERNS = [
  { name: "query", pattern: /[?&]qa=/, what: "reads the ?qa= persona parameter" },
  { name: "search-params", pattern: /\.(?:get|getAll|has)\(\s*(['"`])qa\1\s*\)/, what: "reads the query parameter 'qa'" },
  { name: "param-constant", pattern: /\bQA_PERSONA_PARAM\b/, what: "reads the persona parameter through QA_PERSONA_PARAM" },
  { name: "env-flag", pattern: /\b(?:import\.meta\.env|process\.env)\.\w*QA\w*/, what: "branches on a QA env flag" },
  { name: "global-flag", pattern: /\b(?:window|globalThis|self)\.__?\w*[qQ][aA]\w*/, what: "branches on a QA global" },
  { name: "flag-name", pattern: /\b(?:isQa|isQA|qaMode|QA_MODE|__QA__|inQa|underQa)\b/, what: "branches on a QA flag" }
];
var WAIT_PATTERN = /\bwaitForTimeout\b/;
var CLIENT_ROUTE_PATTERN = /\bweb_app\b|\bwebApp\w*|\bminiApp\w*/;
var SKIP = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "coverage"]);
var CODE_FILE = /\.(?:[cm]?[jt]sx?|json)$/;
function toPosix(path) {
  return path.split(sep).join("/");
}
function isCommentLine(line) {
  return /^\s*(?:\/\/|\/\*|\*|#)/.test(line);
}
function c3Findings(file, text) {
  if (text.includes(QA_DEV_MARKER)) return [];
  const out = [];
  text.split("\n").forEach((line, i) => {
    if (isCommentLine(line)) return;
    const hit = C3_PATTERNS.find((p) => p.pattern.test(line));
    if (hit) {
      out.push({
        rule: "C3",
        file,
        line: i + 1,
        message: `${hit.what}. A component reaches a QA state through a persona or a fact, never through a test flag.`
      });
    }
  });
  return out;
}
function clientRootFindings(root, clientRoots) {
  return clientRoots.flatMap((dir) => readTree(root, dir)).flatMap((source) => c3Findings(source.file, source.text));
}
function waitFindings(file, text) {
  const out = [];
  text.split("\n").forEach((line, i) => {
    if (!isCommentLine(line) && WAIT_PATTERN.test(line)) {
      out.push({ rule: "wait", file, line: i + 1, message: "waitForTimeout in a QA file. Settle on a selector, artwork, a video or aria-busy instead." });
    }
  });
  return out;
}
function isQaFile(rel, reportDir) {
  if (!CODE_FILE.test(rel)) return false;
  const report = posix.normalize(reportDir).replace(/\/$/, "");
  if (rel.startsWith(`${report}/assets/`) || rel.startsWith(`${report}/dist/`)) return false;
  if (rel.endsWith(WORLD_SUFFIX) || rel.endsWith(".shots.json")) return true;
  return rel.split("/").slice(0, -1).includes("qa");
}
async function entriesOf(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    throw new LaunchwrightError("qa.check.read", `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
}
async function projectFiles(root, keep) {
  const out = [];
  const visit = async (dir) => {
    for (const entry of await entriesOf(dir)) {
      if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && keep(toPosix(relative(root, path)))) out.push(toPosix(relative(root, path)));
    }
  };
  await visit(root);
  return out.sort();
}
async function projectText(root, file) {
  const text = await readTextOrNull(join(root, file));
  if (text === null) throw new LaunchwrightError("qa.check.read", `Cannot read ${file}.`, { context: { file } });
  return text;
}
async function projectWaitFindings(root, reportDir) {
  const out = [];
  for (const file of await projectFiles(root, (rel) => isQaFile(rel, reportDir))) out.push(...waitFindings(file, await projectText(root, file)));
  return out;
}
async function worldFindings(root) {
  const out = (await worldLintFindings(root)).map((f) => ({ rule: "S1", file: f.file, line: f.line, message: f.message }));
  for (const feature of await featuresWithoutWorld(root)) {
    const text = await projectText(root, feature);
    if (!CLIENT_ROUTE_PATTERN.test(text)) continue;
    const world = `${basename(feature, FEATURE_SUFFIX)}${WORLD_SUFFIX}`;
    out.push({
      rule: "S1",
      file: feature,
      line: 0,
      message: `the feature opens a client route and has no ${world} beside it. Add one with a persona or a fact for each state it shows.`
    });
  }
  return out;
}
function markerLine(text) {
  const at = text.indexOf(QA_DEV_MARKER);
  return text.slice(0, at).split("\n").length;
}
async function buildFiles(dir) {
  const out = [];
  const visit = async (at) => {
    for (const entry of await entriesOf(at)) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  await visit(dir);
  return out.sort();
}
async function bundleFindings(root, buildDirs, requireBuild) {
  const out = [];
  for (const dir of buildDirs) {
    if (await pathKind(join(root, dir)) !== "dir") {
      if (requireBuild) out.push({ rule: "S3", file: dir, line: 0, message: "the production client build is missing. Build the client, or fix qa.buildDirs." });
      continue;
    }
    for (const path of await buildFiles(join(root, dir))) {
      let bytes;
      try {
        bytes = await readFile(path);
      } catch (cause) {
        throw new LaunchwrightError("qa.check.read", `Cannot read ${path}.`, { cause });
      }
      if (!bytes.includes(QA_DEV_MARKER)) continue;
      out.push({
        rule: "S3",
        file: toPosix(relative(root, path)),
        line: markerLine(bytes.toString("utf8")),
        message: `the production build holds ${QA_DEV_MARKER}. Dev-only QA code reached the bundle: import it only from the dev server.`
      });
    }
  }
  return out;
}
async function runChecks(o) {
  const states = stateFindings(o.root, o.qa, o.generated).map((f) => ({
    rule: f.rule,
    file: f.file,
    line: f.line,
    message: f.message.startsWith(`${f.file}:${f.line} `) ? f.message.slice(`${f.file}:${f.line} `.length) : f.message
  }));
  const all = [
    ...states,
    ...clientRootFindings(o.root, o.qa.clientRoots),
    ...await worldFindings(o.root),
    ...await projectWaitFindings(o.root, o.qa.reportDir),
    ...await bundleFindings(o.root, o.qa.buildDirs, o.requireBuild)
  ];
  return all.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
}
function findingLine(f) {
  return `${f.rule} ${f.file}:${f.line} ${f.message}`;
}

// src/commands/qa-check.mts
var USAGE = [
  "usage: lw qa check [--build]",
  "  C1, C4  every state union is reachable live, mounted or intercepted (the state scan)",
  "  C3      no component in qa.clientRoots reads ?qa= or branches on a QA flag",
  "  S1      no raw SQL in a .world.mts, and a feature with a client route has a .world.mts",
  "  wait    no waitForTimeout in a .world.mts, a .shots.json or a file under a qa/ folder",
  "  S3      no file in qa.buildDirs holds lw-qa-dev-only",
  "  --build a missing folder of qa.buildDirs is a finding too"
];
async function run(args, opts) {
  let build;
  try {
    const parsed2 = parseCommandArgs({ switches: ["build"] }, args);
    const [extra] = parsed2.positionals;
    if (extra !== void 0) throw new UsageError(`unknown argument ${extra}`);
    build = parsed2.switches.has("build");
  } catch (cause) {
    if (!(cause instanceof UsageError)) throw cause;
    opts.err(`lw qa check: ${cause.message}`);
    for (const line of USAGE) opts.err(line);
    return 2;
  }
  const parsed = qaConfig.safeParse(opts.config?.qa ?? {});
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `qa.${i.path.map(String).join(".")} ${i.message}`);
    throw new LaunchwrightError("qa.config.invalid", `Config section qa is invalid: ${keys.join("; ")}`, { context: { keys } });
  }
  const findings = await runChecks({ root: opts.cwd, qa: withAppPaths(parsed.data, opts.config), generated: systemClock.date().toISOString(), requireBuild: build });
  for (const f of findings) opts.out(findingLine(f));
  opts.err(findings.length === 0 ? "lw qa check: no finding" : `lw qa check: ${findings.length} finding(s)`);
  return findings.length === 0 ? 0 : 1;
}
var check = {
  name: "check",
  summary: "Check testability: state triggers, no QA flag in components, world files, no waitForTimeout, no dev marker in the build",
  async run(args, opts) {
    if (args[0] === "--help" || args[0] === "-h") {
      for (const line of USAGE) opts.err(line);
      return 0;
    }
    try {
      return await run(args, opts);
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa check: ${cause.message} (${cause.code})`);
      return 1;
    }
  }
};
var qa_check_default = check;
export {
  qa_check_default as default
};
//# sourceMappingURL=qa-check-6IACF37M.js.map