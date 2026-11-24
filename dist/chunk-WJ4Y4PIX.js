import {
  ledgerRecorder,
  legByName,
  runClock,
  runDeps
} from "./chunk-IVS4OOQ5.js";
import {
  forkView
} from "./chunk-N736V2LB.js";
import {
  openFork
} from "./chunk-PJ4EVPMV.js";
import {
  loadAppEntry,
  worldContext
} from "./chunk-XCKU4A2P.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-X6J22AIF.js";
import {
  buildPlan,
  finishRun,
  groupsFor,
  parseInventory,
  parseResults,
  renderNeither,
  renderPlan,
  withDescriptors
} from "./chunk-2ZWT4EZS.js";
import {
  onSession,
  sessionPool
} from "./chunk-5BUZECXG.js";
import {
  c1Findings,
  c4Findings
} from "./chunk-ZRBKWAMJ.js";
import {
  STATES_FILE,
  renderRouteSummary,
  scanStates
} from "./chunk-OSGSGOS2.js";
import {
  captureGroup,
  captureMounted,
  resolveMount
} from "./chunk-FA2UE7YP.js";
import {
  inferSeeds,
  statePath
} from "./chunk-42WWWMVO.js";
import {
  appendResult,
  reportPaths
} from "./chunk-3OHR7PBT.js";
import {
  z
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-states.mts
import { existsSync as existsSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync3 } from "fs";
import { dirname as dirname3, isAbsolute as isAbsolute2, join as join3, relative, resolve as resolve2 } from "path";

// src/states/services/forge.mts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "fs";
import { dirname as dirname2, isAbsolute, join as join2, resolve } from "path";
import { pathToFileURL } from "url";

// src/states/services/forge-seed.mts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
var FORGE_DIR = ".lw/qa/forge";
function seedFile(state) {
  if (!/^[A-Za-z0-9_$-]+\.[A-Za-z0-9_$.-]+$/.test(state)) throw new LaunchwrightError("qa.forge.state", `${state} is not a state id <union>.<member>.`, { context: { state } });
  return `${FORGE_DIR}/${state}.seed.json`;
}
var cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
var seedRow = z.object({ table: z.string().regex(/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i), values: z.record(z.string().regex(/^[a-z_][a-z0-9_]*$/i), cell) });
var seedSchema = z.object({
  state: z.string(),
  accepted: z.boolean(),
  via: z.enum(["app-service", "direct-write"]),
  /** The route that renders the state on the QA app. */
  route: z.string().startsWith("/").nullable(),
  persona: z.string().optional(),
  settle: z.object({ selector: z.string(), artwork: z.boolean(), video: z.boolean(), busy: z.boolean(), timeout: z.number().positive() }).partial().optional(),
  /** app-service: a project-relative module whose default export writes the state through `ctx.app`. */
  module: z.string().optional(),
  /** direct-write: the rows to insert. */
  rows: z.array(seedRow).optional(),
  fields: z.array(z.object({ interface: z.string(), field: z.string(), file: z.string() })).optional(),
  reason: z.string().optional(),
  note: z.string().optional()
});
var DRAFT_NOTE = "Draft. Set route to the page that renders the state. For via app-service, set module to a project module whose default export writes the state through ctx.app. For via direct-write, list rows. Then set accepted to true and run lw qa states forge.";
function draftSeed(proposal, member) {
  return {
    state: `${proposal.union}.${member}`,
    accepted: false,
    via: proposal.via,
    route: null,
    ...proposal.via === "app-service" ? { module: "" } : { rows: [] },
    fields: proposal.fields,
    reason: proposal.reason,
    note: DRAFT_NOTE
  };
}
function writeDraft(root, proposal, member) {
  const path = join(root, seedFile(`${proposal.union}.${member}`));
  if (existsSync(path)) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(draftSeed(proposal, member), null, 2)}
`);
  return true;
}
function readSeed(path) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.forge.seed", `Cannot read ${path} as JSON.`, { cause, context: { path } });
  }
  const parsed = seedSchema.safeParse(value);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `${i.path.map(String).join(".") || "(root)"} ${i.message}`);
    throw new LaunchwrightError("qa.forge.seed", `${path} is not a seed file: ${keys.join("; ")}`, { context: { path } });
  }
  return parsed.data;
}
function acceptedSeed(seed) {
  if (!seed.accepted) return "it is a draft: a reviewer sets accepted to true";
  if (seed.route === null) return "it names no route";
  if (seed.via === "app-service" && !seed.module) return "via app-service needs a module";
  if (seed.via === "direct-write" && (seed.rows ?? []).length === 0) return "via direct-write needs rows";
  return seed;
}
function quoteName(name) {
  return name.split(".").map((part) => `"${part}"`).join(".");
}
function literal(value, tenantId) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new LaunchwrightError("qa.forge.row", `${value} is not a finite number.`);
    return String(value);
  }
  const text = value === "{tenantId}" ? tenantId : value;
  return `'${text.replaceAll("'", "''")}'`;
}
function rowStatements(rows, tenantId) {
  return rows.map((row) => {
    const columns = Object.keys(row.values);
    if (columns.length === 0) throw new LaunchwrightError("qa.forge.row", `A row of ${row.table} has no values.`, { context: { table: row.table } });
    const values = columns.map((c) => literal(row.values[c] ?? null, tenantId));
    return `insert into ${quoteName(row.table)} (${columns.map(quoteName).join(", ")}) values (${values.join(", ")})`;
  });
}

// src/states/services/forge.mts
var FORGE_NOTE = "A forged state comes from a seed that the library inferred and a reviewer accepted, run on a fork of the QA database. It proves the render only, and it never counts as a live pass.";
async function runModule(root, module, ctx) {
  const file = isAbsolute(module) ? module : resolve(root, module);
  let mod;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (cause) {
    throw new LaunchwrightError("qa.forge.module", `Cannot load the seed module ${module}: ${messageOf(cause)}`, { cause, context: { module } });
  }
  if (typeof mod.default !== "function") throw new LaunchwrightError("qa.forge.module", `${module} must export a default function (ctx) that writes the state.`, { context: { module } });
  await mod.default(ctx);
}
async function writeState(seed, fork, root) {
  const member = seed.state.slice(seed.state.indexOf(".") + 1);
  try {
    if (seed.via === "app-service") {
      const ctx = { ...fork.world, state: seed.state, member, ...seed.persona === void 0 ? {} : { persona: seed.persona } };
      await runModule(root, seed.module, ctx);
    } else {
      for (const sql of rowStatements(seed.rows ?? [], fork.world.tenantId)) await fork.execute(sql);
    }
  } catch (cause) {
    throw new LaunchwrightError("qa.forge.seed", `The ${seed.via} seed of ${seed.state} failed: ${messageOf(cause)}`, { cause, context: { state: seed.state } });
  }
}
function forkBase(seed, fork, ctx) {
  const view = forkView(ctx.baseUrls, ctx.apiPort, fork.url, `forge ${seed.state}`);
  const blocked = view.blocked[ctx.leg.surface];
  if (blocked !== void 0) throw new LaunchwrightError("qa.forge.surface", blocked, { context: { surface: ctx.leg.surface } });
  return view.baseUrls[ctx.leg.surface] ?? fork.url;
}
async function forgeState(seed, fork, ctx) {
  const started = ctx.clock.now();
  const dot = seed.state.indexOf(".");
  const union = seed.state.slice(0, dot);
  const member = seed.state.slice(dot + 1);
  await writeState(seed, fork, ctx.root);
  const baseUrl = forkBase(seed, fork, ctx);
  const recorder = ledgerRecorder({ reportDir: ctx.reportDir, slug: ctx.slug, leg: ctx.leg, provenance: "forged", clock: ctx.clock, revision: ctx.revision });
  const artifactRel = statePath(ctx.slug, seed.state, "forged", "json");
  const artifact = {
    state: seed.state,
    via: seed.via,
    provenance: "forged",
    route: seed.route,
    ...seed.module ? { module: seed.module } : {},
    ...seed.rows ? { rows: seed.rows } : {},
    note: FORGE_NOTE
  };
  const artifactFile = join2(ctx.reportDir, artifactRel);
  mkdirSync2(dirname2(artifactFile), { recursive: true });
  writeFileSync2(artifactFile, `${JSON.stringify(artifact, null, 2)}
`);
  await recorder.record({ file: artifactFile, kind: "log", row: seed.state });
  const shotRel = statePath(ctx.slug, seed.state, "forged", "png");
  let error = null;
  let session = null;
  try {
    session = await ctx.target.open({ leg: ctx.leg, baseUrl, outDir: join2(reportPaths(ctx.reportDir, ctx.slug).assets, "states"), ...seed.persona ? { persona: seed.persona } : {} });
    await session.navigate(seed.route);
    await session.settle(seed.settle ?? { busy: true });
    await session.screenshot(join2(ctx.reportDir, shotRel));
    await recorder.record({ file: join2(ctx.reportDir, shotRel), kind: "screenshot", row: seed.state });
  } catch (cause) {
    error = messageOf(cause);
  } finally {
    await session?.close();
  }
  await recorder.flush();
  const ms = ctx.clock.now() - started;
  const result = {
    row: seed.state,
    leg: ctx.leg.name,
    status: error === null ? "passed" : "failed",
    reason: `forged via ${seed.via}: the render only, never a live pass${error === null ? "" : `; ${error}`}`,
    failures: error === null ? [] : ["crashed"],
    attempts: 1,
    ms
  };
  await appendResult(reportPaths(ctx.reportDir, ctx.slug).results, result);
  return {
    id: seed.state,
    union,
    member,
    ok: error === null,
    subject: error === null ? shotRel : null,
    context: null,
    provenance: "forged",
    // No feature function runs over a forged seed. Null is "not checked", never "it agreed".
    verified: null,
    error,
    expect: `forged via ${seed.via}: ${seed.route} renders ${seed.state}. The render only.`,
    ms
  };
}

// src/commands/qa-states.mts
var USAGE = [
  "usage: lw qa states <scan|plan|infer|forge|run|report> [options]",
  "  scan   [--json]                       read the client roots, derive each route, write .lw/qa/states.json.",
  "                                        Exit 1 on a union no trigger reaches (rules C1, C4) or a bad ignore tag",
  "  plan   [--json] [--files a,b] [--dirs d,e]   print every planned capture. Exit 1 on a neither union",
  "  infer  [--json] [--apply] [--slug <slug>] [--leg <name>]   propose a forged seed for each state no seed and no",
  "                                        route reaches. --apply writes a draft seed under .lw/qa/forge/ for each one,",
  "                                        and forges each accepted seed (spec 2.5)",
  "  forge  <union>.<member> [--seed <file>] [--slug <slug>] [--leg <name>]   run one accepted seed on a fork of the QA",
  "                                        database, photograph its route, and record it with provenance forged",
  "  run    [--base <url>] [--leg <name>] [--slug <slug>] [--files a,b] [--dirs d,e]   (--base defaults to qa.baseUrls of the leg surface)",
  "                                        mount each input member at /__states and intercept each output member.",
  "                                        Images go to <reportDir>/assets/<slug>/states/ and into the ledger",
  "  report [--slug <slug>]                the coverage matrix of the last run of the slug",
  "qa.states.delivery names the file of delivery descriptors (union name to { route, intercept, settle, fixture }) that feeds",
  "intercepted capture, and qa.states.mounts the file of mount hints (union name to { component, props, members, fixture }).",
  "Without them, a run reads .lw/qa/delivery.json and .lw/qa/mounts.json when they exist. fixture.persona signs a persona in first."
];
var DEFAULT_SLUG = "states";
var DEFAULT_FORGE_SLUG = "forged";
var DEFAULT_LEG = "desktop";
var FLAGS = {
  scan: { values: [], switches: ["json"] },
  plan: { values: ["files", "dirs"], switches: ["json"] },
  infer: { values: ["slug", "leg"], switches: ["json", "apply"] },
  forge: { values: ["seed", "slug", "leg"], switches: [] },
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
  mkdirSync3(dirname3(path), { recursive: true });
  writeFileSync3(path, `${JSON.stringify(value, null, 2)}
`);
}
function runFiles(cwd, slug) {
  return { plan: join3(cwd, ".lw/qa/states", `${slug}.plan.json`), results: join3(cwd, ".lw/qa/states", `${slug}.results.jsonl`) };
}
function narrowOf(args) {
  const files = list(flag(args, "files"));
  const dirs = list(flag(args, "dirs"));
  if (!files && !dirs) return void 0;
  return { ...files ? { files } : {}, ...dirs ? { dirs } : {}, label: [...files ?? [], ...dirs ?? []].join(", ") };
}
function freshInventory(cwd, config, generated) {
  return withDescriptors(scanStates(cwd, config, generated).inventory, cwd, config);
}
function scan(args, opts, config, generated) {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  writeJson(join3(opts.cwd, STATES_FILE), { ...result.inventory, tables: result.map.tables, problems: result.problems });
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
async function forger(args, opts, config, app, overrides) {
  const slug = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const deps = runDeps(config, app, overrides, opts.targets);
  const world = await worldContext({ cwd: opts.cwd, out: opts.out, err: opts.err, ...opts.config ? { config: opts.config } : {}, ...opts.env ? { env: opts.env } : {} });
  const entry = await loadAppEntry(world.root, world.qa);
  const forkOptions = { root: world.root, sections: world.sections, env: world.env, overlay: world.overlay, entry, registry: world.registry, out: opts.out, ...overrides.listen ? { listen: overrides.listen } : {} };
  const context = {
    root: opts.cwd,
    reportDir: resolve2(opts.cwd, config.reportDir),
    slug,
    leg,
    target: deps.targets.get(leg.target),
    baseUrls: config.baseUrls,
    apiPort: config.apiPort,
    clock: deps.clock,
    revision: deps.revision(opts.cwd)
  };
  return async (seed) => {
    const fork = await openFork(forkOptions, `forge-${seed.state}`);
    try {
      return await forgeState(seed, fork, context);
    } finally {
      await fork.release();
    }
  };
}
function forgedLine(r) {
  return r.ok ? `forged    ${r.id}: ${r.subject ?? ""}` : `failed    ${r.id}: ${r.error ?? "no reason given"}`;
}
async function applyForged(args, opts, config, proposals, app, overrides) {
  if (proposals.length === 0) {
    opts.out("no declared state needs a forged seed: every state has a seed or a route.");
    return 0;
  }
  const ready = [];
  let waiting = 0;
  for (const proposal of proposals) {
    for (const member of proposal.members) {
      const state = `${proposal.union}.${member}`;
      if (writeDraft(opts.cwd, proposal, member)) {
        opts.out(`draft     ${state}: wrote ${seedFile(state)}. Review it, then set accepted to true.`);
        waiting += 1;
        continue;
      }
      const seed = acceptedSeed(readSeed(join3(opts.cwd, seedFile(state))));
      if (typeof seed === "string") {
        opts.out(`waiting   ${state}: ${seed} (${seedFile(state)})`);
        waiting += 1;
      } else ready.push(seed);
    }
  }
  if (ready.length === 0) {
    opts.out(`forged nothing: ${waiting} state(s) wait for a reviewer to accept their seed.`);
    return 0;
  }
  const forgeOne = await forger(args, opts, config, app, overrides);
  let failed = 0;
  for (const seed of ready) {
    try {
      const result = await forgeOne(seed);
      if (!result.ok) failed += 1;
      opts.out(forgedLine(result));
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      failed += 1;
      opts.err(`failed    ${seed.state}: ${cause.code}: ${cause.message}`);
    }
  }
  const slug = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  opts.out(`forged ${ready.length - failed} of ${ready.length} accepted seed(s), ${waiting} waiting -> ${relative(opts.cwd, reportPaths(resolve2(opts.cwd, config.reportDir), slug).ledger)}`);
  opts.out(FORGE_NOTE);
  return failed > 0 ? 1 : 0;
}
async function forge(args, opts, config, app, overrides) {
  const [state, extra] = args.positionals;
  if (state === void 0 || extra !== void 0) throw new UsageError("forge needs one state id <union>.<member>");
  const rel = flag(args, "seed") ?? seedFile(state);
  const path = resolve2(opts.cwd, rel);
  if (!existsSync2(path)) throw new LaunchwrightError("qa.forge.seed", `${rel} does not exist. Run lw qa states infer --apply to write its draft.`, { context: { state } });
  const seed = readSeed(path);
  if (seed.state !== state) throw new LaunchwrightError("qa.forge.seed", `${rel} is the seed of ${seed.state}, not ${state}.`, { context: { state } });
  const accepted = acceptedSeed(seed);
  if (typeof accepted === "string") {
    opts.err(`${state} is not forged: ${accepted} (${rel})`);
    return 1;
  }
  const result = await (await forger(args, opts, config, app, overrides))(accepted);
  opts.out(forgedLine(result));
  opts.out(FORGE_NOTE);
  return result.ok ? 0 : 1;
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
  const reportDir = resolve2(opts.cwd, config.reportDir);
  const files = runFiles(opts.cwd, slug);
  const notRun = {};
  const target = deps.targets.get(leg.target);
  const ready = await target.ready(leg);
  const { groups, blocked } = groupsFor(built.inventory, built.captures, leg.name, leg.surface);
  const attempts = [];
  const revision = deps.revision(opts.cwd);
  const now = () => deps.clock.now();
  if (!ready.ready) {
    const why = `the target ${leg.target} of leg ${leg.name} is not ready: ${ready.reason ?? "no reason given"}`;
    notRun.mount = why;
    notRun.solve = why;
  } else {
    const pool = sessionPool(target, { leg, baseUrl: base, outDir: join3(reportPaths(reportDir, slug).assets, "states") });
    try {
      const mounted = ledgerRecorder({ reportDir, slug, leg, provenance: "mounted", clock: deps.clock, revision });
      for (const capture of built.captures.filter((c) => c.mechanism === "mount")) {
        const resolved = resolveMount(built.inventory, capture, leg.name);
        attempts.push(...await onSession(pool, resolved.persona, [capture], async (session) => [await captureMounted(session, resolved, { reportDir, slug, record: mounted.record, now })]));
      }
      await mounted.flush();
      const intercepted = ledgerRecorder({ reportDir, slug, leg, provenance: "intercepted", clock: deps.clock, revision });
      for (const group of groups) {
        const members = group.members.map((m) => ({ id: m.id, union: group.union, member: m.member }));
        const results = await onSession(pool, group.persona ?? null, members, async (session) => {
          const page = session.routable?.();
          if (!page) {
            notRun.solve = `the target ${leg.target} gives no routable page, so no response can be intercepted`;
            return [];
          }
          const captured = await captureGroup(session, page, group, { projectRoot: opts.cwd, reportDir, slug, record: intercepted.record, now });
          for (const note of captured.notes) opts.out(`${group.union}: ${note}`);
          return captured.results;
        });
        attempts.push(...results);
        if (notRun.solve !== void 0) break;
      }
      await intercepted.flush();
    } finally {
      await pool.close();
      for (const note of pool.notes) opts.out(`session    ${note}`);
    }
  }
  writeJson(files.plan, { ...built, notRun, blocked });
  mkdirSync3(dirname3(files.results), { recursive: true });
  writeFileSync3(files.results, attempts.map((a) => `${JSON.stringify(a)}
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
  if (!existsSync2(files.plan)) throw new LaunchwrightError("qa.states.no-run", `No state run of slug ${slug}: ${files.plan} does not exist. Run "lw qa states run" first.`);
  const saved = JSON.parse(readFileSync2(files.plan, "utf8"));
  const inventory = parseInventory(JSON.stringify(saved.inventory), files.plan);
  const { attempts, malformed } = parseResults(existsSync2(files.results) ? readFileSync2(files.results, "utf8") : "");
  const finished = finishRun({ plan: { ...saved, inventory }, attempts, malformed, notRun: saved.notRun ?? {}, blocked: saved.blocked ?? {} });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}
function createStatesCommand(overrides = {}) {
  return {
    name: "states",
    summary: "Scan the state unions, plan, capture mounted, intercepted and forged states, report coverage",
    async run(args, opts) {
      const [action, ...rest] = args;
      if (!action || !["scan", "plan", "infer", "forge", "run", "report"].includes(action)) {
        for (const line of USAGE) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const cwd = isAbsolute2(opts.cwd) ? opts.cwd : resolve2(opts.cwd);
      const inner = { ...opts, cwd };
      try {
        const flags = parseCommandArgs(FLAGS[action], rest);
        const app = opts.app;
        if (action === "run") return await run(flags, inner, config, runDeps(config, app, overrides, opts.targets));
        if (action === "report") return report(flags, inner);
        const generated = runClock(app, overrides).date().toISOString();
        if (action === "scan") return scan(flags, inner, config, generated);
        if (action === "infer") return await infer(flags, inner, config, generated, app, overrides);
        if (action === "forge") return await forge(flags, inner, config, app, overrides);
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
//# sourceMappingURL=chunk-WJ4Y4PIX.js.map