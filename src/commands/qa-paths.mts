// `lw qa paths plan|crawl|record|report` (spec 2.7): which taps reach each route that renders a
// state union, and a live recording of a person taking them. The targets come from the delivery
// scan, never from a route list of this file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { type App, isCodedError, LaunchwrightError } from '../kernel/index.mts';
import { type CommandArgs, parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { type QaConfig, qaConfigOf } from '../config.mts';
import type { OpenOptions, QaSession, QaTarget } from '../drivers/target/contract.mts';
import type { Surface } from '../services/types.mts';
import {
  buildCrawlPlan,
  crawl,
  type CrawlPath,
  type CrawlPlan,
  type CrawlResult,
  crossReach,
  MAX_DEPTH,
  MAX_EDGES_PER_NODE,
  type PathRecording,
  recordPath,
  routeDrift,
  stamp,
  targetResults,
  targetsFrom,
  videoPath,
} from '../services/paths.mts';
import { scanStates } from '../states/services/project.mts';
import { deviceOf, ledgerRecorder, legByName, type RunDeps, runDeps } from '../states/services/run.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa paths <plan|crawl|record|report> [options]',
  `  plan   [--legs a,b] [--slug s]              write the crawl plan of each leg from the delivery scan`,
  `  crawl  [--base <url>] [--legs a,b] [--slug s] walk each leg, depth ${MAX_DEPTH}, ${MAX_EDGES_PER_NODE} edges per screen. Exit 1 on route drift`,
  '  record [--base <url>] [--only <path-id>] [--slug s]  replay each crawled path with video. Exit 1 on a failed recording',
  '  report [--slug s]                           paths, reachability per union, recordings',
  '--base defaults to qa.baseUrls of the leg surface. A crawl presses every control it finds. Point --base at a QA stack (lw qa world --api), never at a shared database.',
];

const DEFAULT_SLUG = 'paths';

/** The legs a crawl walks when none is named: one per route table surface of the web client and the Mini App. */
const DEFAULT_LEGS = ['desktop', 'miniapp'];

/** The flags of every action. An action reads the ones it needs. */
const VALUES = ['base', 'legs', 'slug', 'only'] as const;
type Flags = CommandArgs<(typeof VALUES)[number], never, never>;

function flag(args: Flags, name: (typeof VALUES)[number]): string | null {
  return args.values[name] ?? null;
}

/** The origin a leg opens: `--base`, else `qa.baseUrls` of the leg surface. */
function baseFor(args: Flags, config: QaConfig, surface: Surface): string {
  const base = flag(args, 'base') ?? config.baseUrls[surface];
  if (!base) throw new LaunchwrightError('qa.paths.usage', `crawl and record need --base <url> or qa.baseUrls.${surface}: the origin of the surface the legs open`);
  return base;
}

/** The run files of a slug, outside the report assets. */
function runDir(cwd: string, slug: string): string {
  return join(cwd, '.lw/qa/paths', slug);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readLines<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l, i) => {
      try {
        return JSON.parse(l) as T;
      } catch (cause) {
        throw new LaunchwrightError('qa.paths.results', `${path} line ${i + 1} is not JSON`, { cause, context: { path, line: i + 1 } });
      }
    });
}

function plansFor(args: Flags, opts: QaCommandOptions, config: QaConfig, generated: string): CrawlPlan[] {
  const slug = flag(args, 'slug') ?? DEFAULT_SLUG;
  const named = flag(args, 'legs');
  const { inventory } = scanStates(opts.cwd, config, generated);
  const targets = targetsFrom(inventory);
  const plans = (named?.split(',') ?? DEFAULT_LEGS)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => {
      const leg = legByName(config, name);
      return buildCrawlPlan({ slug, leg: leg.name, surface: leg.surface, targets });
    });
  // A named leg must have targets. A default leg without a route table of its surface is left out.
  const empty = plans.filter((p) => p.targets.length === 0);
  if (named !== null && empty.length > 0) {
    throw new LaunchwrightError('qa.paths.no-targets', `The delivery scan names no route on the surface of leg(s) ${empty.map((p) => `${p.leg} (${p.surface})`).join(', ')}. Check qa.routeTables.`);
  }
  const kept = plans.filter((p) => p.targets.length > 0);
  if (kept.length === 0) throw new LaunchwrightError('qa.paths.no-targets', 'The delivery scan names no route on any surface of the default legs. Check qa.routeTables.');
  return kept;
}

function planCmd(args: Flags, opts: QaCommandOptions, config: QaConfig, generated: string): number {
  for (const plan of plansFor(args, opts, config, generated)) {
    const out = join(runDir(opts.cwd, plan.slug), `plan.${plan.leg}.json`);
    writeJson(out, plan);
    opts.out(`leg ${plan.leg}: ${plan.targets.length} target route(s) -> ${out}`);
  }
  return 0;
}

/**
 * Opens one leg and crawls it. A session that does not open, or a crawl that throws, still gives a
 * row per target, each with the reason, so a leg never ends without its targets.
 */
async function crawlLeg(target: QaTarget, open: OpenOptions, plan: CrawlPlan): Promise<CrawlResult & { crashed: string | null }> {
  let session: QaSession | null = null;
  let result: CrawlResult & { crashed: string | null };
  try {
    session = await target.open(open);
    result = { ...(await crawl(session, plan)), crashed: null };
  } catch (cause) {
    if (isCodedError(cause) && cause.code === 'qa.paths.evaluate') throw cause;
    const why = cause instanceof Error ? cause.message.split('\n')[0] ?? '' : String(cause);
    result = { paths: [], visited: [], failures: [], targets: targetResults(plan, [], why), crashed: why };
  } finally {
    await session?.close();
  }
  const halted = result.targets.find((t) => t.error !== undefined)?.error ?? null;
  return { ...result, crashed: result.crashed ?? halted };
}

async function crawlCmd(args: Flags, opts: QaCommandOptions, config: QaConfig, deps: RunDeps): Promise<number> {
  let failed = false;
  for (const plan of plansFor(args, opts, config, deps.clock.date().toISOString())) {
    const leg = legByName(config, plan.leg);
    const dir = runDir(opts.cwd, plan.slug);
    writeJson(join(dir, `plan.${plan.leg}.json`), plan);
    const target = deps.targets.get(leg.target);
    const ready = await target.ready(leg);
    if (!ready.ready) {
      failed = true;
      opts.err(`leg ${leg.name}: the target ${leg.target} is not ready: ${ready.reason ?? 'no reason given'}`);
      continue;
    }
    const result = await crawlLeg(target, { leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir }, plan);
    const { paths } = result;
    const log = join(dir, `results.${plan.leg}.jsonl`);
    mkdirSync(dirname(log), { recursive: true });
    writeFileSync(log, paths.map((p) => `${JSON.stringify(p)}\n`).join(''));
    writeJson(join(dir, `targets.${plan.leg}.json`), { targets: result.targets, failures: result.failures });
    const reached = result.targets.filter((t) => t.reached).length;
    opts.out(`leg ${plan.leg}: ${paths.length} path(s), ${reached} of ${plan.targets.length} target route(s) reached -> ${log}`);
    for (const path of paths) opts.out(`  ${path.readable}`);
    for (const failure of result.failures) opts.err(`leg ${plan.leg}: step ${failure.kind} on ${failure.route}${failure.label ? ` "${failure.label}"` : ''}: ${failure.error}`);
    if (result.crashed !== null) {
      failed = true;
      opts.err(`leg ${plan.leg}: the crawl did not finish: ${result.crashed}`);
    }
    // A route the crawl reached and the delivery scan never named fails the run.
    const drift = routeDrift(plan.targets, paths.map((p) => ({ id: p.id, surface: plan.surface, route: p.route })));
    if (drift.length > 0) {
      failed = true;
      opts.err(`leg ${plan.leg}: route-drift, ${drift.length} route(s) the delivery scan does not name:`);
      for (const d of drift) opts.err(`  ${d.id} -> ${d.route}`);
    }
  }
  return failed ? 1 : 0;
}

type VideoLine = PathRecording & { id: string; leg: string; na?: string };

async function recordCmd(args: Flags, opts: QaCommandOptions, config: QaConfig, deps: RunDeps): Promise<number> {
  const slug = flag(args, 'slug') ?? DEFAULT_SLUG;
  const only = flag(args, 'only');
  const dir = runDir(opts.cwd, slug);
  const legs = (flag(args, 'legs')?.split(',') ?? DEFAULT_LEGS).map((s) => s.trim()).filter(Boolean);
  const discovered = legs.flatMap((leg) => readLines<CrawlPath>(join(dir, `results.${leg}.jsonl`)));
  if (discovered.length === 0) throw new LaunchwrightError('qa.paths.no-paths', `No crawled path under ${dir}. Run "lw qa paths crawl" first.`);
  const wanted = only ? discovered.filter((p) => p.id === only) : discovered;
  if (wanted.length === 0) throw new LaunchwrightError('qa.paths.no-paths', `No crawled path is named ${only}.`);
  const reportDir = resolve(opts.cwd, config.reportDir);
  const revision = deps.revision(opts.cwd);
  const lines: VideoLine[] = [];
  for (const legName of legs) {
    const mine = wanted.filter((p) => p.leg === legName);
    if (mine.length === 0) continue;
    const leg = legByName(config, legName);
    const target = deps.targets.get(leg.target);
    if (!target.capabilities.has('video')) {
      for (const path of mine) lines.push({ id: path.id, leg: legName, ok: false, reason: 'crashed', error: `the target ${leg.target} cannot record video`, na: 'video' });
      continue;
    }
    const recorder = ledgerRecorder({ reportDir, slug, leg, provenance: 'live', clock: deps.clock, revision });
    let session: QaSession | null = null;
    try {
      session = await target.open({ leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir });
      for (const path of mine) {
        const file = join(reportDir, videoPath(slug, path.id, legName, 'webm'));
        mkdirSync(dirname(file), { recursive: true });
        // A recording that throws fails its own path with the reason, and the next path runs.
        const recorded: PathRecording = await recordPath(session, { root: path.from, path, file, device: deviceOf(leg), capS: config.evidence.videoCapS, now: () => deps.clock.now() }).catch(
          (cause: unknown) => ({ ok: false as const, reason: 'crashed' as const, error: cause instanceof Error ? cause.message.split('\n')[0] ?? '' : String(cause) }),
        );
        const kept = recorded.ok ? recorded.file : 'file' in recorded ? recorded.file : undefined;
        if (kept !== undefined && existsSync(kept)) await recorder.record({ file: kept, kind: 'video', row: path.id });
        lines.push({ ...recorded, id: path.id, leg: legName });
      }
    } finally {
      await session?.close();
      await recorder.flush();
    }
  }
  writeFileSync(join(dir, 'videos.path.jsonl'), lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
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

function reportCmd(args: Flags, opts: QaCommandOptions, config: QaConfig, generated: string): number {
  const slug = flag(args, 'slug') ?? DEFAULT_SLUG;
  const dir = runDir(opts.cwd, slug);
  const legs = (flag(args, 'legs')?.split(',') ?? DEFAULT_LEGS).map((s) => s.trim()).filter(Boolean);
  const { inventory } = scanStates(opts.cwd, config, generated);
  const targets = targetsFrom(inventory);
  const paths = legs.flatMap((name) => {
    const leg = legByName(config, name);
    return readLines<CrawlPath>(join(dir, `results.${name}.jsonl`)).map((p) => ({ ...p, surface: leg.surface }));
  });
  const videos = readLines<VideoLine>(join(dir, 'videos.path.jsonl'));
  const cross = crossReach(targets, paths);
  const reached = cross.routes.filter((r) => r.reached).length;
  opts.out('## Paths');
  opts.out('');
  opts.out(`${paths.length} path(s), ${reached} of ${cross.routes.length} target routes reached`);
  for (const path of paths) opts.out(`- ${path.readable}`);
  opts.out('');
  opts.out('## Reachability');
  opts.out('');
  opts.out('| Union | Reachable |');
  opts.out('|---|---|');
  for (const row of cross.unions) opts.out(`| ${row.union} | ${row.reachable ? 'yes' : 'no path found'} |`);
  if (cross.unreachable.length > 0) {
    opts.out('');
    opts.out(`No path found: ${cross.unreachable.length}.`);
    for (const union of cross.unreachable) {
      const where = [...new Set(cross.routes.filter((r) => r.unions.includes(union)).map((r) => r.route))];
      opts.out(`- ${union}: renders on ${where.join(', ')}, and this crawl visited none of them`);
    }
    // A crawl is bounded, so "no path found" is a gap in the crawl until a person says otherwise.
    opts.out(
      `This crawl reached ${reached} of ${cross.routes.length} target routes, at depth ${MAX_DEPTH} and ${MAX_EDGES_PER_NODE} edges per screen, ` +
        'and it counts only a pathname change as a step. A union above renders but is unreachable only when the crawl could have got there.',
    );
  }
  opts.out('');
  opts.out('## Recordings');
  opts.out('');
  if (!videos.some((v) => v.ok)) opts.out('none recorded');
  for (const video of videos) {
    if (!video.ok) {
      opts.out(`${video.leg} ${video.id}: ${video.na ? `n/a (${video.na})` : `not recorded (${video.reason})`} ${video.error}`);
      continue;
    }
    opts.out(`### ${video.id} (${video.leg})`);
    opts.out(`video: ${video.file}  (${video.device}, ${stamp(video.seconds * 1000)}), provenance ${video.provenance}`);
    for (const step of video.steps) opts.out(`  ${stamp(step.atMs ?? 0)}  ${step.label}`);
  }
  return 0;
}

/** Builds the subcommand. A test passes fake targets, a fake clock and a fixed revision. */
export function createPathsCommand(overrides: Partial<RunDeps> = {}): QaSubcommand {
  return {
    name: 'paths',
    summary: 'Crawl the taps that reach each route that renders a state, and record them live',
    async run(args: string[], opts: QaCommandOptions): Promise<number> {
      const [action, ...rest] = args;
      if (!action || !['plan', 'crawl', 'record', 'report'].includes(action)) {
        for (const line of USAGE) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const inner = { ...opts, cwd: isAbsolute(opts.cwd) ? opts.cwd : resolve(opts.cwd) };
      try {
        const flags = parseCommandArgs({ values: VALUES }, rest);
        const deps = runDeps(config, opts.app as App | undefined, overrides, opts.targets);
        const generated = deps.clock.date().toISOString();
        if (action === 'plan') return planCmd(flags, inner, config, generated);
        if (action === 'crawl') return await crawlCmd(flags, inner, config, deps);
        if (action === 'record') return await recordCmd(flags, inner, config, deps);
        return reportCmd(flags, inner, config, generated);
      } catch (cause) {
        if (!isCodedError(cause)) throw cause;
        opts.err(`lw qa paths ${action}: ${cause.code}: ${cause.message}`);
        return cause instanceof UsageError || cause.code === 'qa.paths.usage' ? 2 : 1;
      }
    },
  };
}

export default createPathsCommand();
