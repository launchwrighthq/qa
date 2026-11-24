// `lw qa states scan|plan|run|report` (spec 2.7, 2.14 rules C1, C2 and C4).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { type App, isCodedError, LaunchwrightError } from '../kernel/index.mts';
import { type CommandArgs, parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { type QaConfig, qaConfigOf } from '../config.mts';
import { reportPaths } from '../services/ledger.mts';
import { captureGroup } from '../states/services/capture.mts';
import { c1Findings, c4Findings } from '../states/services/check.mts';
import { renderRouteSummary } from '../states/services/delivery.mts';
import { FORGE_NOTE, type ForgeContext, forgeState } from '../states/services/forge.mts';
import { type AcceptedSeed, acceptedSeed, readSeed, seedFile, writeDraft } from '../states/services/forge-seed.mts';
import { inferSeeds, type Inventory, type Mechanism, type SeedProposal, type StateResult } from '../states/services/inventory.mts';
import { buildPlan, finishRun, groupsFor, parseInventory, parseResults, renderNeither, renderPlan, type StatesPlan } from '../states/services/loop.mts';
import { captureMounted, resolveMount } from '../states/services/mount.mts';
import { onSession, sessionPool } from '../states/services/sessions.mts';
import { withDescriptors } from '../states/services/descriptors.mts';
import { scanStates, STATES_FILE } from '../states/services/project.mts';
import { gitRevision, ledgerRecorder, legByName, runClock, type RunDeps, runDeps } from '../states/services/run.mts';
import type { ListenQaApp } from '../world/services/api.mts';
import { loadAppEntry } from '../world/services/app.mts';
import { worldContext } from '../world/services/context.mts';
import { openFork } from '../world/services/fork-server.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa states <scan|plan|infer|forge|run|report> [options]',
  '  scan   [--json]                       read the client roots, derive each route, write .lw/qa/states.json.',
  '                                        Exit 1 on a union no trigger reaches (rules C1, C4) or a bad ignore tag',
  '  plan   [--json] [--files a,b] [--dirs d,e]   print every planned capture. Exit 1 on a neither union',
  '  infer  [--json] [--apply] [--slug <slug>] [--leg <name>]   propose a forged seed for each state no seed and no',
  '                                        route reaches. --apply writes a draft seed under .lw/qa/forge/ for each one,',
  '                                        and forges each accepted seed (spec 2.5)',
  '  forge  <union>.<member> [--seed <file>] [--slug <slug>] [--leg <name>]   run one accepted seed on a fork of the QA',
  '                                        database, photograph its route, and record it with provenance forged',
  '  run    [--base <url>] [--leg <name>] [--slug <slug>] [--files a,b] [--dirs d,e]   (--base defaults to qa.baseUrls of the leg surface)',
  '                                        mount each input member at /__states and intercept each output member.',
  '                                        Images go to <reportDir>/assets/<slug>/states/ and into the ledger',
  '  report [--slug <slug>]                the coverage matrix of the last run of the slug',
  'qa.states.delivery names the file of delivery descriptors (union name to { route, intercept, settle, fixture }) that feeds',
  'intercepted capture, and qa.states.mounts the file of mount hints (union name to { component, props, members, fixture }).',
  'Without them, a run reads .lw/qa/delivery.json and .lw/qa/mounts.json when they exist. fixture.persona signs a persona in first.',
];

/** The default slug of a state run. */
const DEFAULT_SLUG = 'states';

/** The default slug of a forged-seed apply. A consumer passes a report slug to feed its report. */
const DEFAULT_FORGE_SLUG = 'forged';

/** The leg a state run uses when none is named: the harness is a route of the web client. */
const DEFAULT_LEG = 'desktop';

type Action = 'scan' | 'plan' | 'infer' | 'forge' | 'run' | 'report';

/** What a test passes to the states command: run fakes, and the listen of the QA app on a fork. */
export type StatesOverrides = Partial<RunDeps> & { listen?: ListenQaApp };
type Flags = CommandArgs<string, string, never>;

/** The flags of each action. */
const FLAGS: Record<Action, { values: string[]; switches: string[] }> = {
  scan: { values: [], switches: ['json'] },
  plan: { values: ['files', 'dirs'], switches: ['json'] },
  infer: { values: ['slug', 'leg'], switches: ['json', 'apply'] },
  forge: { values: ['seed', 'slug', 'leg'], switches: [] },
  run: { values: ['base', 'leg', 'slug', 'files', 'dirs'], switches: [] },
  report: { values: ['slug'], switches: [] },
};

function flag(args: Flags, name: string): string | null {
  return args.values[name] ?? null;
}

function list(value: string | null): string[] | undefined {
  return value === null ? undefined : value.split(',').map((s) => s.trim()).filter(Boolean);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** The run files of a slug, outside the report assets: the report check refuses an unlisted asset. */
function runFiles(cwd: string, slug: string): { plan: string; results: string } {
  return { plan: join(cwd, '.lw/qa/states', `${slug}.plan.json`), results: join(cwd, '.lw/qa/states', `${slug}.results.jsonl`) };
}

function narrowOf(args: Flags): { files?: string[]; dirs?: string[]; label: string } | undefined {
  const files = list(flag(args, 'files'));
  const dirs = list(flag(args, 'dirs'));
  if (!files && !dirs) return undefined;
  return { ...(files ? { files } : {}), ...(dirs ? { dirs } : {}), label: [...(files ?? []), ...(dirs ?? [])].join(', ') };
}

/** The inventory of a run: a fresh scan, with the descriptors of `qa.states.delivery` and `qa.states.mounts`. */
function freshInventory(cwd: string, config: QaConfig, generated: string): Inventory {
  return withDescriptors(scanStates(cwd, config, generated).inventory, cwd, config);
}

function scan(args: Flags, opts: QaCommandOptions, config: QaConfig, generated: string): number {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  writeJson(join(opts.cwd, STATES_FILE), { ...result.inventory, tables: result.map.tables, problems: result.problems });
  if (args.switches.has('json')) {
    opts.out(JSON.stringify(result.inventory, null, 2));
  } else {
    const states = result.inventory.unions.reduce((n, u) => n + u.members.length, 0);
    const kinds = new Map<string, number>();
    for (const u of result.inventory.unions) kinds.set(u.kind, (kinds.get(u.kind) ?? 0) + 1);
    const tally = [...kinds].sort().map(([k, n]) => `${n} ${k}`).join(', ');
    opts.out(`${result.inventory.unions.length} unions, ${states} states (${tally || 'none'}), ${result.inventory.ignored.length} ignored -> ${STATES_FILE}`);
    for (const line of renderRouteSummary(result.map).split('\n')) opts.out(line);
    for (const g of result.inventory.ignored) opts.out(`ignored ${g.name} (${g.file}:${g.line}): ${g.reason}`);
  }
  for (const p of result.problems.filter((p) => p.code === 'invalid-shape')) opts.err(`warning ${p.file}:${p.line}: ${p.message}`);
  for (const f of findings) opts.err(`${f.rule} ${f.message}`);
  for (const line of renderNeither(result.inventory)) opts.err(line);
  return findings.length > 0 ? 1 : 0;
}

function plan(args: Flags, opts: QaCommandOptions, config: QaConfig, generated: string): number {
  const narrow = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: 'lw qa states scan', slug: DEFAULT_SLUG, generated, ...(narrow ? { narrow } : {}) });
  if (args.switches.has('json')) opts.out(JSON.stringify(built, null, 2));
  else for (const line of renderPlan(built)) opts.out(line);
  for (const line of renderNeither(built.inventory)) opts.err(line);
  return built.inventory.unions.some((u) => u.kind === 'neither') ? 1 : 0;
}

/**
 * `infer`: the forged-state fallback (spec 2.5). It scans the client and server code, finds each
 * declared state that no seed and no route reaches, and proposes a seed. A seed runs through the
 * app services where they exist. A direct row write is the last resort, and the state records
 * provenance `forged`, which never counts as a live pass. With `--apply`, it writes a draft seed for
 * each proposed state and forges each seed a reviewer accepted.
 */
async function infer(args: Flags, opts: QaCommandOptions, config: QaConfig, generated: string, app: App | undefined, overrides: StatesOverrides): Promise<number> {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  const names = new Set(result.inventory.unions.map((u) => u.name));
  const unreachable = new Set(findings.map((f) => f.union).filter((name) => names.has(name)));
  const proposals = inferSeeds(result.inventory, unreachable);
  if (args.switches.has('apply')) return await applyForged(args, opts, config, proposals, app, overrides);
  if (args.switches.has('json')) {
    opts.out(JSON.stringify(proposals, null, 2));
    return 0;
  }
  if (proposals.length === 0) {
    opts.out('no declared state needs a forged seed: every state has a seed or a route.');
    return 0;
  }
  opts.out(`${proposals.length} state(s) no seed and no route reaches. Each one earns a forged seed:`);
  opts.out('A seed runs through the app services where they exist. A direct row write is the last resort, and records provenance forged.');
  for (const p of proposals) {
    opts.out(`  ${p.union} (${p.file}): members ${p.members.join(', ')}.`);
    opts.out(`    seed via ${p.via}, provenance ${p.provenance}: ${p.reason}.`);
    if (p.fields.length > 0) opts.out(`    fields: ${p.fields.map((f) => `${f.interface}.${f.field}`).join(', ')}.`);
  }
  return 0;
}

/**
 * The forge of accepted seeds (spec 2.4, 2.5): each seed gets its own fork of the QA database with
 * the QA app served on it, so a forged write never reaches the shared QA world. The fork drops after
 * the capture, also after a failure.
 */
async function forger(args: Flags, opts: QaCommandOptions, config: QaConfig, app: App | undefined, overrides: StatesOverrides): Promise<(seed: AcceptedSeed) => Promise<StateResult>> {
  const slug = flag(args, 'slug') ?? DEFAULT_FORGE_SLUG;
  const leg = legByName(config, flag(args, 'leg') ?? DEFAULT_LEG);
  const deps = runDeps(config, app, overrides, opts.targets);
  const world = await worldContext({ cwd: opts.cwd, out: opts.out, err: opts.err, ...(opts.config ? { config: opts.config } : {}), ...(opts.env ? { env: opts.env } : {}) });
  const entry = await loadAppEntry(world.root, world.qa);
  const forkOptions = { root: world.root, sections: world.sections, env: world.env, overlay: world.overlay, entry, registry: world.registry, out: opts.out, ...(overrides.listen ? { listen: overrides.listen } : {}) };
  const context: ForgeContext = {
    root: opts.cwd,
    reportDir: resolve(opts.cwd, config.reportDir),
    slug,
    leg,
    target: deps.targets.get(leg.target),
    baseUrls: config.baseUrls,
    apiPort: config.apiPort,
    clock: deps.clock,
    revision: deps.revision(opts.cwd),
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

function forgedLine(r: StateResult): string {
  return r.ok ? `forged    ${r.id}: ${r.subject ?? ''}` : `failed    ${r.id}: ${r.error ?? 'no reason given'}`;
}

/**
 * `infer --apply`: writes a draft seed under `.lw/qa/forge/` for each proposed state that has none,
 * and forges each seed a reviewer accepted (spec 2.5). A draft forges nothing: the library cannot
 * know the route and the writes until a reviewer names them. Exit 1 when a forge fails.
 */
async function applyForged(args: Flags, opts: QaCommandOptions, config: QaConfig, proposals: readonly SeedProposal[], app: App | undefined, overrides: StatesOverrides): Promise<number> {
  if (proposals.length === 0) {
    opts.out('no declared state needs a forged seed: every state has a seed or a route.');
    return 0;
  }
  const ready: AcceptedSeed[] = [];
  let waiting = 0;
  for (const proposal of proposals) {
    for (const member of proposal.members) {
      const state = `${proposal.union}.${member}`;
      if (writeDraft(opts.cwd, proposal, member)) {
        opts.out(`draft     ${state}: wrote ${seedFile(state)}. Review it, then set accepted to true.`);
        waiting += 1;
        continue;
      }
      const seed = acceptedSeed(readSeed(join(opts.cwd, seedFile(state))));
      if (typeof seed === 'string') {
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
  const slug = flag(args, 'slug') ?? DEFAULT_FORGE_SLUG;
  opts.out(`forged ${ready.length - failed} of ${ready.length} accepted seed(s), ${waiting} waiting -> ${relative(opts.cwd, reportPaths(resolve(opts.cwd, config.reportDir), slug).ledger)}`);
  opts.out(FORGE_NOTE);
  return failed > 0 ? 1 : 0;
}

/** `forge <union>.<member>`: forges one accepted seed. Exit 1 when the seed is not accepted or the forge fails. */
async function forge(args: Flags, opts: QaCommandOptions, config: QaConfig, app: App | undefined, overrides: StatesOverrides): Promise<number> {
  const [state, extra] = args.positionals;
  if (state === undefined || extra !== undefined) throw new UsageError('forge needs one state id <union>.<member>');
  const rel = flag(args, 'seed') ?? seedFile(state);
  const path = resolve(opts.cwd, rel);
  if (!existsSync(path)) throw new LaunchwrightError('qa.forge.seed', `${rel} does not exist. Run lw qa states infer --apply to write its draft.`, { context: { state } });
  const seed = readSeed(path);
  if (seed.state !== state) throw new LaunchwrightError('qa.forge.seed', `${rel} is the seed of ${seed.state}, not ${state}.`, { context: { state } });
  const accepted = acceptedSeed(seed);
  if (typeof accepted === 'string') {
    opts.err(`${state} is not forged: ${accepted} (${rel})`);
    return 1;
  }
  const result = await (await forger(args, opts, config, app, overrides))(accepted);
  opts.out(forgedLine(result));
  opts.out(FORGE_NOTE);
  return result.ok ? 0 : 1;
}

async function run(args: Flags, opts: QaCommandOptions, config: QaConfig, deps: RunDeps): Promise<number> {
  const slug = flag(args, 'slug') ?? DEFAULT_SLUG;
  const leg = legByName(config, flag(args, 'leg') ?? DEFAULT_LEG);
  const base = flag(args, 'base') ?? config.baseUrls[leg.surface];
  if (!base) {
    throw new LaunchwrightError('qa.states.usage', `run needs --base <url> or qa.baseUrls.${leg.surface}: the origin of the client dev server that serves /__states`);
  }
  const generated = deps.clock.date().toISOString();
  const narrow = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: 'lw qa states scan', slug, generated, ...(narrow ? { narrow } : {}) });
  for (const line of renderPlan(built)) opts.out(line);

  const reportDir = resolve(opts.cwd, config.reportDir);
  const files = runFiles(opts.cwd, slug);
  const notRun: Partial<Record<Mechanism, string>> = {};
  const target = deps.targets.get(leg.target);
  const ready = await target.ready(leg);
  const { groups, blocked } = groupsFor(built.inventory, built.captures, leg.name, leg.surface);
  const attempts: StateResult[] = [];
  const revision = deps.revision(opts.cwd);
  const now = (): number => deps.clock.now();

  if (!ready.ready) {
    const why = `the target ${leg.target} of leg ${leg.name} is not ready: ${ready.reason ?? 'no reason given'}`;
    notRun.mount = why;
    notRun.solve = why;
  } else {
    const pool = sessionPool(target, { leg, baseUrl: base, outDir: join(reportPaths(reportDir, slug).assets, 'states') });
    try {
      const mounted = ledgerRecorder({ reportDir, slug, leg, provenance: 'mounted', clock: deps.clock, revision });
      for (const capture of built.captures.filter((c) => c.mechanism === 'mount')) {
        const resolved = resolveMount(built.inventory, capture, leg.name);
        attempts.push(...(await onSession(pool, resolved.persona, [capture], async (session) => [await captureMounted(session, resolved, { reportDir, slug, record: mounted.record, now })])));
      }
      await mounted.flush();
      const intercepted = ledgerRecorder({ reportDir, slug, leg, provenance: 'intercepted', clock: deps.clock, revision });
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
        if (notRun.solve !== undefined) break;
      }
      await intercepted.flush();
    } finally {
      await pool.close();
      for (const note of pool.notes) opts.out(`session    ${note}`);
    }
  }
  writeJson(files.plan, { ...built, notRun, blocked });
  mkdirSync(dirname(files.results), { recursive: true });
  writeFileSync(files.results, attempts.map((a) => `${JSON.stringify(a)}\n`).join(''));
  opts.out('');
  opts.out(`plan       ${files.plan}`);
  opts.out(`results    ${files.results}`);
  const finished = finishRun({ plan: built, attempts, notRun, blocked });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}

function report(args: Flags, opts: QaCommandOptions): number {
  const slug = flag(args, 'slug') ?? DEFAULT_SLUG;
  const files = runFiles(opts.cwd, slug);
  if (!existsSync(files.plan)) throw new LaunchwrightError('qa.states.no-run', `No state run of slug ${slug}: ${files.plan} does not exist. Run "lw qa states run" first.`);
  const saved = JSON.parse(readFileSync(files.plan, 'utf8')) as StatesPlan & { notRun?: Partial<Record<Mechanism, string>>; blocked?: Record<string, string> };
  const inventory = parseInventory(JSON.stringify(saved.inventory), files.plan);
  const { attempts, malformed } = parseResults(existsSync(files.results) ? readFileSync(files.results, 'utf8') : '');
  const finished = finishRun({ plan: { ...saved, inventory }, attempts, malformed, notRun: saved.notRun ?? {}, blocked: saved.blocked ?? {} });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}

/** Builds the subcommand. A test passes fake targets, a fake clock and a fixed revision. */
export function createStatesCommand(overrides: StatesOverrides = {}): QaSubcommand {
  return {
    name: 'states',
    summary: 'Scan the state unions, plan, capture mounted, intercepted and forged states, report coverage',
    async run(args: string[], opts: QaCommandOptions): Promise<number> {
      const [action, ...rest] = args;
      if (!action || !['scan', 'plan', 'infer', 'forge', 'run', 'report'].includes(action)) {
        for (const line of USAGE) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const cwd = isAbsolute(opts.cwd) ? opts.cwd : resolve(opts.cwd);
      const inner = { ...opts, cwd };
      try {
        const flags = parseCommandArgs(FLAGS[action as Action], rest);
        const app = opts.app as App | undefined;
        if (action === 'run') return await run(flags, inner, config, runDeps(config, app, overrides, opts.targets));
        if (action === 'report') return report(flags, inner);
        const generated = runClock(app, overrides).date().toISOString();
        if (action === 'scan') return scan(flags, inner, config, generated);
        if (action === 'infer') return await infer(flags, inner, config, generated, app, overrides);
        if (action === 'forge') return await forge(flags, inner, config, app, overrides);
        return plan(flags, inner, config, generated);
      } catch (cause) {
        if (!isCodedError(cause)) throw cause;
        opts.err(`lw qa states ${action}: ${cause.code}: ${cause.message}`);
        return cause instanceof UsageError || cause.code === 'qa.states.usage' ? 2 : 1;
      }
    },
  };
}

export default createStatesCommand();
