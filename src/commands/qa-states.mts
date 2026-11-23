// `lw qa states scan|plan|run|report` (spec 2.7, 2.14 rules C1, C2 and C4).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { type App, isCodedError, LaunchwrightError } from '../kernel/index.mts';
import { type CommandArgs, parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { type QaConfig, qaConfigOf } from '../config.mts';
import type { QaSession } from '../drivers/target/contract.mts';
import { reportPaths } from '../services/ledger.mts';
import { captureGroup } from '../states/services/capture.mts';
import { c1Findings, c4Findings } from '../states/services/check.mts';
import { renderRouteSummary } from '../states/services/delivery.mts';
import { captureForged, FORGE_CAVEAT } from '../states/services/forge.mts';
import { type DeliveryDescriptor, inferSeeds, type Inventory, type Mechanism, type SeedProposal, type StateResult } from '../states/services/inventory.mts';
import { buildPlan, finishRun, groupsFor, mergeDelivery, parseInventory, parseResults, renderNeither, renderPlan, type StatesPlan } from '../states/services/loop.mts';
import { captureMounted, resolveMount } from '../states/services/mount.mts';
import { scanStates, STATES_FILE } from '../states/services/project.mts';
import { gitRevision, ledgerRecorder, legByName, runClock, type RunDeps, runDeps } from '../states/services/run.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa states <scan|plan|infer|run|report> [options]',
  '  scan   [--json]                       read the client roots, derive each route, write .lw/qa/states.json.',
  '                                        Exit 1 on a union no trigger reaches (rules C1, C4) or a bad ignore tag',
  '  plan   [--json] [--files a,b] [--dirs d,e]   print every planned capture. Exit 1 on a neither union',
  '  infer  [--json] [--apply] [--slug <slug>] [--leg <name>]   propose a forged seed for each state no seed and no',
  '                                        route reaches, or with --apply record each as a forged capture (spec 2.5)',
  '  run    [--base <url>] [--leg <name>] [--slug <slug>] [--files a,b] [--dirs d,e]   (--base defaults to qa.baseUrls of the leg surface)',
  '                                        mount each input member at /__states and intercept each output member.',
  '                                        Images go to <reportDir>/assets/<slug>/states/ and into the ledger',
  '  report [--slug <slug>]                the coverage matrix of the last run of the slug',
  'A delivery descriptor file .lw/qa/delivery.json (union name to { route, intercept, settle }) feeds intercepted capture.',
];

/** The default slug of a state run. */
const DEFAULT_SLUG = 'states';

/** The default slug of a forged-seed apply. A consumer passes a report slug to feed its report. */
const DEFAULT_FORGE_SLUG = 'forged';

/** The leg a state run uses when none is named: the harness is a route of the web client. */
const DEFAULT_LEG = 'desktop';

/** The delivery descriptors of intercepted capture, by union name. */
const DELIVERY_FILE = '.lw/qa/delivery.json';

type Action = 'scan' | 'plan' | 'infer' | 'run' | 'report';
type Flags = CommandArgs<string, string, never>;

/** The flags of each action. */
const FLAGS: Record<Action, { values: string[]; switches: string[] }> = {
  scan: { values: [], switches: ['json'] },
  plan: { values: ['files', 'dirs'], switches: ['json'] },
  infer: { values: ['slug', 'leg'], switches: ['json', 'apply'] },
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

/** The inventory of a run: a fresh scan, with the delivery descriptors of `.lw/qa/delivery.json`. */
function freshInventory(cwd: string, config: QaConfig, generated: string): Inventory {
  const { inventory } = scanStates(cwd, config, generated);
  const deliveryPath = join(cwd, DELIVERY_FILE);
  if (!existsSync(deliveryPath)) return inventory;
  let delivery: Record<string, DeliveryDescriptor>;
  try {
    delivery = JSON.parse(readFileSync(deliveryPath, 'utf8')) as Record<string, DeliveryDescriptor>;
  } catch (cause) {
    throw new LaunchwrightError('qa.states.delivery', `${DELIVERY_FILE} is not JSON`, { cause, context: { path: deliveryPath } });
  }
  return mergeDelivery(inventory, delivery);
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
 * provenance `forged`, which never counts as a live pass. With `--apply`, it records each proposed
 * seed as a forged capture in the ledger of the slug.
 */
async function infer(args: Flags, opts: QaCommandOptions, config: QaConfig, generated: string, app: App | undefined, overrides: Partial<RunDeps>): Promise<number> {
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
 * `infer --apply`: records each proposed seed as a forged capture (spec 2.5). The library reached
 * none of these states by a route or a mount, so it writes the inferred seed as the evidence and
 * records it with provenance `forged`. The forged entries land in the ledger of the slug, where a
 * report of that slug reads them, marks the state and never counts it as a live pass (spec 2.12.2).
 */
async function applyForged(args: Flags, opts: QaCommandOptions, config: QaConfig, proposals: readonly SeedProposal[], app: App | undefined, overrides: Partial<RunDeps>): Promise<number> {
  if (proposals.length === 0) {
    opts.out('no declared state needs a forged seed: every state has a seed or a route.');
    return 0;
  }
  const slug = flag(args, 'slug') ?? DEFAULT_FORGE_SLUG;
  const leg = legByName(config, flag(args, 'leg') ?? DEFAULT_LEG);
  const reportDir = resolve(opts.cwd, config.reportDir);
  const clock = runClock(app, overrides);
  const revision = (overrides.revision ?? gitRevision)(opts.cwd);
  const recorder = ledgerRecorder({ reportDir, slug, leg, provenance: 'forged', clock, revision });
  const now = (): number => clock.now();
  for (const seed of proposals) {
    for (const member of seed.members) await captureForged(seed, member, { reportDir, slug, record: recorder.record, now });
  }
  const recorded = await recorder.flush();
  opts.out(`applied ${proposals.length} forged seed(s): ${recorded} forged capture(s) -> ${relative(opts.cwd, reportPaths(reportDir, slug).ledger)}`);
  opts.out(FORGE_CAVEAT);
  for (const seed of proposals) opts.out(`  forged ${seed.union} via ${seed.via}: members ${seed.members.join(', ')}.`);
  return 0;
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
  const { groups, blocked } = groupsFor(built.inventory, built.captures, leg.name);
  const attempts: StateResult[] = [];
  const revision = deps.revision(opts.cwd);
  const now = (): number => deps.clock.now();

  if (!ready.ready) {
    const why = `the target ${leg.target} of leg ${leg.name} is not ready: ${ready.reason ?? 'no reason given'}`;
    notRun.mount = why;
    notRun.solve = why;
  } else {
    let session: QaSession | null = null;
    try {
      session = await target.open({ leg, baseUrl: base, outDir: join(reportPaths(reportDir, slug).assets, 'states') });
      const mounted = ledgerRecorder({ reportDir, slug, leg, provenance: 'mounted', clock: deps.clock, revision });
      for (const capture of built.captures.filter((c) => c.mechanism === 'mount')) {
        attempts.push(await captureMounted(session, resolveMount(built.inventory, capture, leg.name), { reportDir, slug, record: mounted.record, now }));
      }
      await mounted.flush();
      if (groups.length > 0) {
        const page = session.routable?.();
        if (!page) notRun.solve = `the target ${leg.target} gives no routable page, so no response can be intercepted`;
        else {
          const intercepted = ledgerRecorder({ reportDir, slug, leg, provenance: 'intercepted', clock: deps.clock, revision });
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
export function createStatesCommand(overrides: Partial<RunDeps> = {}): QaSubcommand {
  return {
    name: 'states',
    summary: 'Scan the state unions, plan, capture mounted and intercepted states, report coverage',
    async run(args: string[], opts: QaCommandOptions): Promise<number> {
      const [action, ...rest] = args;
      if (!action || !['scan', 'plan', 'infer', 'run', 'report'].includes(action)) {
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
