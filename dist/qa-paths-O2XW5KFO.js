import {
  deviceOf,
  ledgerRecorder,
  legByName,
  runDeps
} from "./chunk-CR6DWKU7.js";
import "./chunk-NWIOKD2S.js";
import "./chunk-62VIRJ2H.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-4B5GWDFB.js";
import {
  scanStates
} from "./chunk-NYZ72SDM.js";
import {
  MAX_DEPTH,
  MAX_EDGES_PER_NODE,
  buildCrawlPlan,
  crawl,
  crossReach,
  recordPath,
  routeDrift,
  stamp,
  targetsFrom,
  videoPath
} from "./chunk-AA7FPMJ7.js";
import "./chunk-LBZC23FE.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-3TLMTKDL.js";
import "./chunk-XZN5EDSR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-H3DGWSMZ.js";
import "./chunk-SA2YN55L.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-paths.mts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
var USAGE = [
  "usage: lw qa paths <plan|crawl|record|report> [options]",
  `  plan   [--legs a,b] [--slug s]              write the crawl plan of each leg from the delivery scan`,
  `  crawl  [--base <url>] [--legs a,b] [--slug s] walk each leg, depth ${MAX_DEPTH}, ${MAX_EDGES_PER_NODE} edges per screen. Exit 1 on route drift`,
  "  record [--base <url>] [--only <path-id>] [--slug s]  replay each crawled path with video. Exit 1 on a failed recording",
  "  report [--slug s]                           paths, reachability per union, recordings",
  "--base defaults to qa.baseUrls of the leg surface. A crawl presses every control it finds. Point --base at a QA stack (lw qa world --api), never at a shared database."
];
var DEFAULT_SLUG = "paths";
var DEFAULT_LEGS = ["desktop", "miniapp"];
var VALUES = ["base", "legs", "slug", "only"];
function flag(args, name) {
  return args.values[name] ?? null;
}
function baseFor(args, config, surface) {
  const base = flag(args, "base") ?? config.baseUrls[surface];
  if (!base) throw new LaunchwrightError("qa.paths.usage", `crawl and record need --base <url> or qa.baseUrls.${surface}: the origin of the surface the legs open`);
  return base;
}
function runDir(cwd, slug) {
  return join(cwd, ".lw/qa/paths", slug);
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}
`);
}
function readLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim() !== "").map((l, i) => {
    try {
      return JSON.parse(l);
    } catch (cause) {
      throw new LaunchwrightError("qa.paths.results", `${path} line ${i + 1} is not JSON`, { cause, context: { path, line: i + 1 } });
    }
  });
}
function plansFor(args, opts, config, generated) {
  const slug = flag(args, "slug") ?? DEFAULT_SLUG;
  const named = flag(args, "legs");
  const { inventory } = scanStates(opts.cwd, config, generated);
  const targets = targetsFrom(inventory);
  const plans = (named?.split(",") ?? DEFAULT_LEGS).map((s) => s.trim()).filter(Boolean).map((name) => {
    const leg = legByName(config, name);
    return buildCrawlPlan({ slug, leg: leg.name, surface: leg.surface, targets });
  });
  const empty = plans.filter((p) => p.targets.length === 0);
  if (named !== null && empty.length > 0) {
    throw new LaunchwrightError("qa.paths.no-targets", `The delivery scan names no route on the surface of leg(s) ${empty.map((p) => `${p.leg} (${p.surface})`).join(", ")}. Check qa.routeTables.`);
  }
  const kept = plans.filter((p) => p.targets.length > 0);
  if (kept.length === 0) throw new LaunchwrightError("qa.paths.no-targets", "The delivery scan names no route on any surface of the default legs. Check qa.routeTables.");
  return kept;
}
function planCmd(args, opts, config, generated) {
  for (const plan of plansFor(args, opts, config, generated)) {
    const out = join(runDir(opts.cwd, plan.slug), `plan.${plan.leg}.json`);
    writeJson(out, plan);
    opts.out(`leg ${plan.leg}: ${plan.targets.length} target route(s) -> ${out}`);
  }
  return 0;
}
async function crawlCmd(args, opts, config, deps) {
  let failed = false;
  for (const plan of plansFor(args, opts, config, deps.clock.date().toISOString())) {
    const leg = legByName(config, plan.leg);
    const dir = runDir(opts.cwd, plan.slug);
    writeJson(join(dir, `plan.${plan.leg}.json`), plan);
    const target = deps.targets.get(leg.target);
    const ready = await target.ready(leg);
    if (!ready.ready) {
      failed = true;
      opts.err(`leg ${leg.name}: the target ${leg.target} is not ready: ${ready.reason ?? "no reason given"}`);
      continue;
    }
    let session = null;
    let paths = [];
    try {
      session = await target.open({ leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir });
      paths = (await crawl(session, plan)).paths;
    } finally {
      await session?.close();
    }
    const log = join(dir, `results.${plan.leg}.jsonl`);
    mkdirSync(dirname(log), { recursive: true });
    writeFileSync(log, paths.map((p) => `${JSON.stringify(p)}
`).join(""));
    opts.out(`leg ${plan.leg}: ${paths.length} path(s) over ${plan.targets.length} target route(s) -> ${log}`);
    for (const path of paths) opts.out(`  ${path.readable}`);
    const drift = routeDrift(plan.targets, paths.map((p) => ({ id: p.id, surface: plan.surface, route: p.route })));
    if (drift.length > 0) {
      failed = true;
      opts.err(`leg ${plan.leg}: route-drift, ${drift.length} route(s) the delivery scan does not name:`);
      for (const d of drift) opts.err(`  ${d.id} -> ${d.route}`);
    }
  }
  return failed ? 1 : 0;
}
async function recordCmd(args, opts, config, deps) {
  const slug = flag(args, "slug") ?? DEFAULT_SLUG;
  const only = flag(args, "only");
  const dir = runDir(opts.cwd, slug);
  const legs = (flag(args, "legs")?.split(",") ?? DEFAULT_LEGS).map((s) => s.trim()).filter(Boolean);
  const discovered = legs.flatMap((leg) => readLines(join(dir, `results.${leg}.jsonl`)));
  if (discovered.length === 0) throw new LaunchwrightError("qa.paths.no-paths", `No crawled path under ${dir}. Run "lw qa paths crawl" first.`);
  const wanted = only ? discovered.filter((p) => p.id === only) : discovered;
  if (wanted.length === 0) throw new LaunchwrightError("qa.paths.no-paths", `No crawled path is named ${only}.`);
  const reportDir = resolve(opts.cwd, config.reportDir);
  const revision = deps.revision(opts.cwd);
  const lines = [];
  for (const legName of legs) {
    const mine = wanted.filter((p) => p.leg === legName);
    if (mine.length === 0) continue;
    const leg = legByName(config, legName);
    const target = deps.targets.get(leg.target);
    if (!target.capabilities.has("video")) {
      for (const path of mine) lines.push({ id: path.id, leg: legName, ok: false, reason: "crashed", error: `the target ${leg.target} cannot record video`, na: "video" });
      continue;
    }
    const recorder = ledgerRecorder({ reportDir, slug, leg, provenance: "live", clock: deps.clock, revision });
    let session = null;
    try {
      session = await target.open({ leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir });
      for (const path of mine) {
        const file = join(reportDir, videoPath(slug, path.id, legName, "webm"));
        mkdirSync(dirname(file), { recursive: true });
        const recorded = await recordPath(session, { root: path.from, path, file, device: deviceOf(leg), capS: config.evidence.videoCapS, now: () => deps.clock.now() });
        const kept = recorded.ok ? recorded.file : "file" in recorded ? recorded.file : void 0;
        if (kept !== void 0 && existsSync(kept)) await recorder.record({ file: kept, kind: "video", row: path.id });
        lines.push({ ...recorded, id: path.id, leg: legName });
      }
    } finally {
      await session?.close();
      await recorder.flush();
    }
  }
  writeFileSync(join(dir, "videos.path.jsonl"), lines.map((l) => `${JSON.stringify(l)}
`).join(""));
  let failed = 0;
  for (const line of lines) {
    if (line.ok) {
      if (!existsSync(line.file)) {
        failed += 1;
        opts.err(`${line.leg} ${line.id}: the target reported a recording and wrote no file (${line.file})`);
        continue;
      }
      opts.out(`${line.leg} ${line.id}: ${line.file}`);
    } else if (line.na) {
      opts.out(`${line.leg} ${line.id}: n/a (${line.na}): ${line.error}`);
    } else {
      failed += 1;
      opts.err(`${line.leg} ${line.id}: not recorded (${line.reason}) ${line.error}`);
    }
  }
  return failed > 0 ? 1 : 0;
}
function reportCmd(args, opts, config, generated) {
  const slug = flag(args, "slug") ?? DEFAULT_SLUG;
  const dir = runDir(opts.cwd, slug);
  const legs = (flag(args, "legs")?.split(",") ?? DEFAULT_LEGS).map((s) => s.trim()).filter(Boolean);
  const { inventory } = scanStates(opts.cwd, config, generated);
  const targets = targetsFrom(inventory);
  const paths = legs.flatMap((name) => {
    const leg = legByName(config, name);
    return readLines(join(dir, `results.${name}.jsonl`)).map((p) => ({ ...p, surface: leg.surface }));
  });
  const videos = readLines(join(dir, "videos.path.jsonl"));
  const cross = crossReach(targets, paths);
  const reached = cross.routes.filter((r) => r.reached).length;
  opts.out("## Paths");
  opts.out("");
  opts.out(`${paths.length} path(s), ${reached} of ${cross.routes.length} target routes reached`);
  for (const path of paths) opts.out(`- ${path.readable}`);
  opts.out("");
  opts.out("## Reachability");
  opts.out("");
  opts.out("| Union | Reachable |");
  opts.out("|---|---|");
  for (const row of cross.unions) opts.out(`| ${row.union} | ${row.reachable ? "yes" : "no path found"} |`);
  if (cross.unreachable.length > 0) {
    opts.out("");
    opts.out(`No path found: ${cross.unreachable.length}.`);
    for (const union of cross.unreachable) {
      const where = [...new Set(cross.routes.filter((r) => r.unions.includes(union)).map((r) => r.route))];
      opts.out(`- ${union}: renders on ${where.join(", ")}, and this crawl visited none of them`);
    }
    opts.out(
      `This crawl reached ${reached} of ${cross.routes.length} target routes, at depth ${MAX_DEPTH} and ${MAX_EDGES_PER_NODE} edges per screen, and it counts only a pathname change as a step. A union above renders but is unreachable only when the crawl could have got there.`
    );
  }
  opts.out("");
  opts.out("## Recordings");
  opts.out("");
  if (!videos.some((v) => v.ok)) opts.out("none recorded");
  for (const video of videos) {
    if (!video.ok) {
      opts.out(`${video.leg} ${video.id}: ${video.na ? `n/a (${video.na})` : `not recorded (${video.reason})`} ${video.error}`);
      continue;
    }
    opts.out(`### ${video.id} (${video.leg})`);
    opts.out(`video: ${video.file}  (${video.device}, ${stamp(video.seconds * 1e3)}), provenance ${video.provenance}`);
    for (const step of video.steps) opts.out(`  ${stamp(step.atMs ?? 0)}  ${step.label}`);
  }
  return 0;
}
function createPathsCommand(overrides = {}) {
  return {
    name: "paths",
    summary: "Crawl the taps that reach each route that renders a state, and record them live",
    async run(args, opts) {
      const [action, ...rest] = args;
      if (!action || !["plan", "crawl", "record", "report"].includes(action)) {
        for (const line of USAGE) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const inner = { ...opts, cwd: isAbsolute(opts.cwd) ? opts.cwd : resolve(opts.cwd) };
      try {
        const flags = parseCommandArgs({ values: VALUES }, rest);
        const deps = runDeps(config, opts.app, overrides, opts.targets);
        const generated = deps.clock.date().toISOString();
        if (action === "plan") return planCmd(flags, inner, config, generated);
        if (action === "crawl") return await crawlCmd(flags, inner, config, deps);
        if (action === "record") return await recordCmd(flags, inner, config, deps);
        return reportCmd(flags, inner, config, generated);
      } catch (cause) {
        if (!isCodedError(cause)) throw cause;
        opts.err(`lw qa paths ${action}: ${cause.code}: ${cause.message}`);
        return cause instanceof UsageError || cause.code === "qa.paths.usage" ? 2 : 1;
      }
    }
  };
}
var qa_paths_default = createPathsCommand();
export {
  createPathsCommand,
  qa_paths_default as default
};
//# sourceMappingURL=qa-paths-O2XW5KFO.js.map