import {
  deviceOf,
  ledgerRecorder,
  legByName,
  runDeps
} from "./chunk-IVS4OOQ5.js";
import "./chunk-N736V2LB.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-X6J22AIF.js";
import {
  sessionPool
} from "./chunk-5BUZECXG.js";
import {
  scanStates
} from "./chunk-OSGSGOS2.js";
import {
  MAX_DEPTH,
  MAX_EDGES_PER_NODE,
  buildCrawlPlan,
  crawl,
  crossReach,
  dismissEntries,
  recordPath,
  routeDrift,
  stamp,
  targetResults,
  targetsFrom,
  videoPath
} from "./chunk-FA2UE7YP.js";
import "./chunk-42WWWMVO.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-APRIQSSG.js";
import "./chunk-OF544TQR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-TQCRYULZ.js";
import "./chunk-SA2YN55L.js";
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
    return buildCrawlPlan({ slug, leg: leg.name, surface: leg.surface, targets, ...overlayRule(config) });
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
function overlayRule(config) {
  return { dismiss: dismissEntries(config.paths.dismiss), overlayWaitMs: config.paths.overlayWaitMs };
}
function personaOf(config) {
  return config.paths.fixture.persona ?? null;
}
async function crawlLeg(target, open, plan, persona) {
  const pool = sessionPool(target, open);
  let result;
  try {
    await pool.get(persona);
    result = { ...await crawl({ get: () => pool.get(persona) }, plan), crashed: null };
  } catch (cause) {
    if (isCodedError(cause) && cause.code === "qa.paths.evaluate") throw cause;
    const why = cause instanceof Error ? cause.message.split("\n")[0] ?? "" : String(cause);
    result = { paths: [], visited: [], failures: [], dismissals: [], targets: targetResults(plan, [], why), crashed: why };
  } finally {
    await pool.close();
  }
  const halted = result.targets.find((t) => t.error !== void 0)?.error ?? null;
  return { ...result, crashed: result.crashed ?? halted, notes: [...pool.notes] };
}
function dismissLines(dismissals) {
  const counts = /* @__PURE__ */ new Map();
  for (const d of dismissals) {
    const failed = !d.cleared;
    const text = `dismiss (${d.by}) ${d.press} on ${d.route}${d.overlay === null ? "" : ` over ${d.overlay}`}: ${failed ? `not cleared${d.error === void 0 ? "" : `, ${d.error}`}` : "cleared"}`;
    const seen = counts.get(text);
    if (seen) seen.count += 1;
    else counts.set(text, { count: 1, failed, text });
  }
  return [...counts.values()].map((c) => ({ line: c.count > 1 ? `${c.text} (${c.count} times)` : c.text, failed: c.failed }));
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
    const persona = personaOf(config);
    const result = await crawlLeg(target, { leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir }, plan, persona);
    const { paths } = result;
    const log = join(dir, `results.${plan.leg}.jsonl`);
    mkdirSync(dirname(log), { recursive: true });
    writeFileSync(log, paths.map((p) => `${JSON.stringify(p)}
`).join(""));
    writeJson(join(dir, `targets.${plan.leg}.json`), { persona, targets: result.targets, failures: result.failures, dismissals: result.dismissals });
    const reached = result.targets.filter((t) => t.reached).length;
    opts.out(`leg ${plan.leg}: ${paths.length} path(s), ${reached} of ${plan.targets.length} target route(s) reached${persona === null ? "" : ` as persona ${persona}`} -> ${log}`);
    for (const path of paths) opts.out(`  ${path.readable}`);
    for (const { line, failed: failed2 } of dismissLines(result.dismissals)) (failed2 ? opts.err : opts.out)(`leg ${plan.leg}: ${line}`);
    for (const note of result.notes) opts.out(`leg ${plan.leg}: ${note}`);
    for (const failure of result.failures) opts.err(`leg ${plan.leg}: step ${failure.kind} on ${failure.route}${failure.label ? ` "${failure.label}"` : ""}: ${failure.error}`);
    const crashedRows = result.targets.filter((t) => t.crashed !== void 0);
    if (crashedRows.length > 0) {
      failed = true;
      for (const row of crashedRows) opts.err(`leg ${plan.leg}: target ${row.route}: ${row.crashed}. A new session opened and the crawl went on.`);
    }
    if (result.crashed !== null) {
      failed = true;
      opts.err(`leg ${plan.leg}: the crawl did not finish: ${result.crashed}`);
    }
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
    const pool = sessionPool(target, { leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir });
    const persona = personaOf(config);
    const failOf = (cause) => ({ ok: false, reason: "crashed", error: cause instanceof Error ? cause.message.split("\n")[0] ?? "" : String(cause) });
    try {
      for (const path of mine) {
        const file = join(reportDir, videoPath(slug, path.id, legName, "webm"));
        mkdirSync(dirname(file), { recursive: true });
        const recorded = await pool.get(persona).then((session) => recordPath(session, { root: path.from, path, file, device: deviceOf(leg), capS: config.evidence.videoCapS, overlays: overlayRule(config), now: () => deps.clock.now() })).catch(failOf);
        const kept = recorded.ok ? recorded.file : "file" in recorded ? recorded.file : void 0;
        if (kept !== void 0 && existsSync(kept)) await recorder.record({ file: kept, kind: "video", row: path.id });
        lines.push({ ...recorded, id: path.id, leg: legName });
      }
    } finally {
      await pool.close();
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
//# sourceMappingURL=qa-paths-SCQDS4K4.js.map