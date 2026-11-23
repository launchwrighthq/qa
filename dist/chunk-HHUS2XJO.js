import {
  gitRevision,
  ledgerRecorder,
  legByName,
  runClock,
  runDeps
} from "./chunk-CWVGWAJ5.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-4B5GWDFB.js";
import {
  buildPlan,
  finishRun,
  groupsFor,
  mergeDelivery,
  parseInventory,
  parseResults,
  renderNeither,
  renderPlan
} from "./chunk-5KDQJ25J.js";
import {
  c1Findings,
  c4Findings
} from "./chunk-SQO6FPZ2.js";
import {
  STATES_FILE,
  renderRouteSummary,
  scanStates
} from "./chunk-NYZ72SDM.js";
import {
  captureGroup,
  captureMounted,
  resolveMount
} from "./chunk-AA7FPMJ7.js";
import {
  inferSeeds,
  statePath
} from "./chunk-LBZC23FE.js";
import {
  reportPaths
} from "./chunk-3OHR7PBT.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-states.mts
import { existsSync, mkdirSync as mkdirSync2, readFileSync, writeFileSync as writeFileSync2 } from "fs";
import { dirname as dirname2, isAbsolute, join, relative, resolve } from "path";

// src/states/services/forge.mts
import { mkdirSync, writeFileSync } from "fs";
import { dirname, posix } from "path";
var FORGE_CAVEAT = "A forged capture records the inferred seed only. A live apply needs a running app on the real route to render and photograph the state.";
async function captureForged(seed, member, ctx) {
  const started = ctx.now();
  const id = `${seed.union}.${member}`;
  const rel = statePath(ctx.slug, id, "forged", "json");
  const file = posix.join(ctx.reportDir, rel);
  const artifact = {
    union: seed.union,
    member,
    via: seed.via,
    provenance: "forged",
    fields: seed.fields,
    reason: seed.reason,
    note: FORGE_CAVEAT
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(artifact, null, 2)}
`);
  await ctx.record({ file, kind: "log", row: id });
  return {
    id,
    union: seed.union,
    member,
    ok: true,
    subject: null,
    context: null,
    provenance: "forged",
    // No feature function runs over a forged seed. Null is "not checked", never "it agreed".
    verified: null,
    error: null,
    expect: `forged seed via ${seed.via}: a live apply renders ${seed.union}=${member}. Not proven here.`,
    ms: ctx.now() - started
  };
}

// src/commands/qa-states.mts
var USAGE = [
  "usage: lw qa states <scan|plan|infer|run|report> [options]",
  "  scan   [--json]                       read the client roots, derive each route, write .lw/qa/states.json.",
  "                                        Exit 1 on a union no trigger reaches (rules C1, C4) or a bad ignore tag",
  "  plan   [--json] [--files a,b] [--dirs d,e]   print every planned capture. Exit 1 on a neither union",
  "  infer  [--json] [--apply] [--slug <slug>] [--leg <name>]   propose a forged seed for each state no seed and no",
  "                                        route reaches, or with --apply record each as a forged capture (spec 2.5)",
  "  run    [--base <url>] [--leg <name>] [--slug <slug>] [--files a,b] [--dirs d,e]   (--base defaults to qa.baseUrls of the leg surface)",
  "                                        mount each input member at /__states and intercept each output member.",
  "                                        Images go to <reportDir>/assets/<slug>/states/ and into the ledger",
  "  report [--slug <slug>]                the coverage matrix of the last run of the slug",
  "A delivery descriptor file .lw/qa/delivery.json (union name to { route, intercept, settle }) feeds intercepted capture."
];
var DEFAULT_SLUG = "states";
var DEFAULT_FORGE_SLUG = "forged";
var DEFAULT_LEG = "desktop";
var DELIVERY_FILE = ".lw/qa/delivery.json";
var FLAGS = {
  scan: { values: [], switches: ["json"] },
  plan: { values: ["files", "dirs"], switches: ["json"] },
  infer: { values: ["slug", "leg"], switches: ["json", "apply"] },
  run: { values: ["base", "leg", "slug", "files", "dirs"], switches: [] },
  report: { values: ["slug"], switches: [] }
};
function flag(args, name) {
  return args.values[name] ?? null;
}
function list(value) {
  return value === null ? void 0 : value.split(",").map((s) => s.trim()).filter(Boolean);
}
function writeJson(path, value) {
  mkdirSync2(dirname2(path), { recursive: true });
  writeFileSync2(path, `${JSON.stringify(value, null, 2)}
`);
}
function runFiles(cwd, slug) {
  return { plan: join(cwd, ".lw/qa/states", `${slug}.plan.json`), results: join(cwd, ".lw/qa/states", `${slug}.results.jsonl`) };
}
function narrowOf(args) {
  const files = list(flag(args, "files"));
  const dirs = list(flag(args, "dirs"));
  if (!files && !dirs) return void 0;
  return { ...files ? { files } : {}, ...dirs ? { dirs } : {}, label: [...files ?? [], ...dirs ?? []].join(", ") };
}
function freshInventory(cwd, config, generated) {
  const { inventory } = scanStates(cwd, config, generated);
  const deliveryPath = join(cwd, DELIVERY_FILE);
  if (!existsSync(deliveryPath)) return inventory;
  let delivery;
  try {
    delivery = JSON.parse(readFileSync(deliveryPath, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.states.delivery", `${DELIVERY_FILE} is not JSON`, { cause, context: { path: deliveryPath } });
  }
  return mergeDelivery(inventory, delivery);
}
function scan(args, opts, config, generated) {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  writeJson(join(opts.cwd, STATES_FILE), { ...result.inventory, tables: result.map.tables, problems: result.problems });
  if (args.switches.has("json")) {
    opts.out(JSON.stringify(result.inventory, null, 2));
  } else {
    const states = result.inventory.unions.reduce((n, u) => n + u.members.length, 0);
    const kinds = /* @__PURE__ */ new Map();
    for (const u of result.inventory.unions) kinds.set(u.kind, (kinds.get(u.kind) ?? 0) + 1);
    const tally = [...kinds].sort().map(([k, n]) => `${n} ${k}`).join(", ");
    opts.out(`${result.inventory.unions.length} unions, ${states} states (${tally || "none"}), ${result.inventory.ignored.length} ignored -> ${STATES_FILE}`);
    for (const line of renderRouteSummary(result.map).split("\n")) opts.out(line);
    for (const g of result.inventory.ignored) opts.out(`ignored ${g.name} (${g.file}:${g.line}): ${g.reason}`);
  }
  for (const p of result.problems.filter((p2) => p2.code === "invalid-shape")) opts.err(`warning ${p.file}:${p.line}: ${p.message}`);
  for (const f of findings) opts.err(`${f.rule} ${f.message}`);
  for (const line of renderNeither(result.inventory)) opts.err(line);
  return findings.length > 0 ? 1 : 0;
}
function plan(args, opts, config, generated) {
  const narrow = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: "lw qa states scan", slug: DEFAULT_SLUG, generated, ...narrow ? { narrow } : {} });
  if (args.switches.has("json")) opts.out(JSON.stringify(built, null, 2));
  else for (const line of renderPlan(built)) opts.out(line);
  for (const line of renderNeither(built.inventory)) opts.err(line);
  return built.inventory.unions.some((u) => u.kind === "neither") ? 1 : 0;
}
async function infer(args, opts, config, generated, app, overrides) {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  const names = new Set(result.inventory.unions.map((u) => u.name));
  const unreachable = new Set(findings.map((f) => f.union).filter((name) => names.has(name)));
  const proposals = inferSeeds(result.inventory, unreachable);
  if (args.switches.has("apply")) return await applyForged(args, opts, config, proposals, app, overrides);
  if (args.switches.has("json")) {
    opts.out(JSON.stringify(proposals, null, 2));
    return 0;
  }
  if (proposals.length === 0) {
    opts.out("no declared state needs a forged seed: every state has a seed or a route.");
    return 0;
  }
  opts.out(`${proposals.length} state(s) no seed and no route reaches. Each one earns a forged seed:`);
  opts.out("A seed runs through the app services where they exist. A direct row write is the last resort, and records provenance forged.");
  for (const p of proposals) {
    opts.out(`  ${p.union} (${p.file}): members ${p.members.join(", ")}.`);
    opts.out(`    seed via ${p.via}, provenance ${p.provenance}: ${p.reason}.`);
    if (p.fields.length > 0) opts.out(`    fields: ${p.fields.map((f) => `${f.interface}.${f.field}`).join(", ")}.`);
  }
  return 0;
}
async function applyForged(args, opts, config, proposals, app, overrides) {
  if (proposals.length === 0) {
    opts.out("no declared state needs a forged seed: every state has a seed or a route.");
    return 0;
  }
  const slug = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const reportDir = resolve(opts.cwd, config.reportDir);
  const clock = runClock(app, overrides);
  const revision = (overrides.revision ?? gitRevision)(opts.cwd);
  const recorder = ledgerRecorder({ reportDir, slug, leg, provenance: "forged", clock, revision });
  const now = () => clock.now();
  for (const seed of proposals) {
    for (const member of seed.members) await captureForged(seed, member, { reportDir, slug, record: recorder.record, now });
  }
  const recorded = await recorder.flush();
  opts.out(`applied ${proposals.length} forged seed(s): ${recorded} forged capture(s) -> ${relative(opts.cwd, reportPaths(reportDir, slug).ledger)}`);
  opts.out(FORGE_CAVEAT);
  for (const seed of proposals) opts.out(`  forged ${seed.union} via ${seed.via}: members ${seed.members.join(", ")}.`);
  return 0;
}
async function run(args, opts, config, deps) {
  const slug = flag(args, "slug") ?? DEFAULT_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const base = flag(args, "base") ?? config.baseUrls[leg.surface];
  if (!base) {
    throw new LaunchwrightError("qa.states.usage", `run needs --base <url> or qa.baseUrls.${leg.surface}: the origin of the client dev server that serves /__states`);
  }
  const generated = deps.clock.date().toISOString();
  const narrow = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: "lw qa states scan", slug, generated, ...narrow ? { narrow } : {} });
  for (const line of renderPlan(built)) opts.out(line);
  const reportDir = resolve(opts.cwd, config.reportDir);
  const files = runFiles(opts.cwd, slug);
  const notRun = {};
  const target = deps.targets.get(leg.target);
  const ready = await target.ready(leg);
  const { groups, blocked } = groupsFor(built.inventory, built.captures, leg.name);
  const attempts = [];
  const revision = deps.revision(opts.cwd);
  const now = () => deps.clock.now();
  if (!ready.ready) {
    const why = `the target ${leg.target} of leg ${leg.name} is not ready: ${ready.reason ?? "no reason given"}`;
    notRun.mount = why;
    notRun.solve = why;
  } else {
    let session = null;
    try {
      session = await target.open({ leg, baseUrl: base, outDir: join(reportPaths(reportDir, slug).assets, "states") });
      const mounted = ledgerRecorder({ reportDir, slug, leg, provenance: "mounted", clock: deps.clock, revision });
      for (const capture of built.captures.filter((c) => c.mechanism === "mount")) {
        attempts.push(await captureMounted(session, resolveMount(built.inventory, capture, leg.name), { reportDir, slug, record: mounted.record, now }));
      }
      await mounted.flush();
      if (groups.length > 0) {
        const page = session.routable?.();
        if (!page) notRun.solve = `the target ${leg.target} gives no routable page, so no response can be intercepted`;
        else {
          const intercepted = ledgerRecorder({ reportDir, slug, leg, provenance: "intercepted", clock: deps.clock, revision });
          for (const group of groups) {
            const { results, notes } = await captureGroup(session, page, group, { projectRoot: opts.cwd, reportDir, slug, record: intercepted.record, now });
            for (const note of notes) opts.out(`${group.union}: ${note}`);
            attempts.push(...results);
          }
          await intercepted.flush();
        }
      }
    } finally {
      await session?.close();
    }
  }
  writeJson(files.plan, { ...built, notRun, blocked });
  mkdirSync2(dirname2(files.results), { recursive: true });
  writeFileSync2(files.results, attempts.map((a) => `${JSON.stringify(a)}
`).join(""));
  opts.out("");
  opts.out(`plan       ${files.plan}`);
  opts.out(`results    ${files.results}`);
  const finished = finishRun({ plan: built, attempts, notRun, blocked });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}
function report(args, opts) {
  const slug = flag(args, "slug") ?? DEFAULT_SLUG;
  const files = runFiles(opts.cwd, slug);
  if (!existsSync(files.plan)) throw new LaunchwrightError("qa.states.no-run", `No state run of slug ${slug}: ${files.plan} does not exist. Run "lw qa states run" first.`);
  const saved = JSON.parse(readFileSync(files.plan, "utf8"));
  const inventory = parseInventory(JSON.stringify(saved.inventory), files.plan);
  const { attempts, malformed } = parseResults(existsSync(files.results) ? readFileSync(files.results, "utf8") : "");
  const finished = finishRun({ plan: { ...saved, inventory }, attempts, malformed, notRun: saved.notRun ?? {}, blocked: saved.blocked ?? {} });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}
function createStatesCommand(overrides = {}) {
  return {
    name: "states",
    summary: "Scan the state unions, plan, capture mounted and intercepted states, report coverage",
    async run(args, opts) {
      const [action, ...rest] = args;
      if (!action || !["scan", "plan", "infer", "run", "report"].includes(action)) {
        for (const line of USAGE) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const cwd = isAbsolute(opts.cwd) ? opts.cwd : resolve(opts.cwd);
      const inner = { ...opts, cwd };
      try {
        const flags = parseCommandArgs(FLAGS[action], rest);
        const app = opts.app;
        if (action === "run") return await run(flags, inner, config, runDeps(config, app, overrides, opts.targets));
        if (action === "report") return report(flags, inner);
        const generated = runClock(app, overrides).date().toISOString();
        if (action === "scan") return scan(flags, inner, config, generated);
        if (action === "infer") return await infer(flags, inner, config, generated, app, overrides);
        return plan(flags, inner, config, generated);
      } catch (cause) {
        if (!isCodedError(cause)) throw cause;
        opts.err(`lw qa states ${action}: ${cause.code}: ${cause.message}`);
        return cause instanceof UsageError || cause.code === "qa.states.usage" ? 2 : 1;
      }
    }
  };
}
var qa_states_default = createStatesCommand();

export {
  createStatesCommand,
  qa_states_default
};
//# sourceMappingURL=chunk-HHUS2XJO.js.map