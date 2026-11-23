// The QA session runner (`lw qa session run`, spec 2.4, 2.11). It arms the fixtures of the plan,
// runs every planned row on every leg through its `qa.target` driver, records the evidence of
// spec 2.11.1, checks it by spec 2.11.2, and writes the ledger and `results.jsonl`. It disarms
// the fixtures in a `finally` block and on SIGINT and SIGTERM, also when a row fails.
//
// One attempt of a row on a leg:
//   open (persona) -> startVideo -> navigate -> settle -> screenshot -> each act and its step
//   screenshot -> stopVideo -> logs -> trace -> dump -> close
// A device leg has up to `qa.evidence.attempts` attempts and stops at the first clean one. A
// browser leg has one. Every attempt's files go into the ledger.
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { type Clock, LaunchwrightError, messageOf } from '../kernel/index.mts';
import type { QaConfig } from '../config.mts';
import type { QaSession, QaTarget, QaTargetCapability, QaTargetRegistry, SessionLogLine } from '../drivers/target/contract.mts';
import { attemptFailures } from './evidence.mts';
import { appendLedger, appendResult, dropRowLeg, ledgerEntry, reportPaths } from './ledger.mts';
import { legDefinitions } from './legs.mts';
import { type EvidencePathOptions, evidencePath, expectedPageErrors, loadManifest, type Manifest, type Shot } from './manifest.mts';
import type { EvidenceKind, Isolation, Leg, LedgerEntry, RowFailure, RowResult, Surface } from './types.mts';
import { measureVideo, type VideoMeasure, type VideoTools } from './video.mts';
import { STATES_HARNESS_PATH } from '../states/services/mount.mts';

/**
 * The provenance of the files of a row (spec 2.7). A route on the state page `/__states` proves
 * the rendering of a mounted state only, so its files are `mounted`. Every other route is `live`.
 */
export function routeProvenance(route: string): 'live' | 'mounted' {
  const path = route.split(/[?#]/)[0] ?? '';
  return path === STATES_HARNESS_PATH || path.startsWith(`${STATES_HARNESS_PATH}/`) ? 'mounted' : 'live';
}

/** Arms and disarms fixtures on the QA database (`lw qa fixture`, spec 2.5.3). The world submodule gives it. */
export interface FixtureArming {
  /** Applies one state for a persona, after its undo record is written. */
  arm(state: string, opts: { persona?: string }): Promise<void>;
  /** Replays every undo record. Safe to call twice. */
  disarm(): Promise<void>;
}

/**
 * A per-pass database fork for a row group that needs an isolated single-instance state (spec 2.4,
 * R3). The runner forks the QA database once per `fork` label, arms the group's facts on the fork,
 * runs the group, then drops the fork in a `finally`. The world submodule builds this from
 * `createFork`, `dropFork` and the fixture arming of the fork database.
 */
export interface ForkRunner {
  /** Creates a fork for `label` and gives its database name. */
  create(label: string): Promise<string>;
  /** Drops a fork by its database name. The runner calls it after the group, also after a failure. */
  drop(database: string): Promise<void>;
  /** Fixture arming bound to the fork database, so the group arms its single-instance state there. */
  arming?(database: string): FixtureArming;
}

/** Where a signal handler goes. Default: `process`. */
export interface SignalSource {
  on(signal: 'SIGINT' | 'SIGTERM', handler: () => void): unknown;
  off(signal: 'SIGINT' | 'SIGTERM', handler: () => void): unknown;
}

export interface RunnerDeps {
  config: QaConfig;
  targets: QaTargetRegistry;
  clock: Clock;
  /** The surface origins: `{ web: 'http://127.0.0.1:5173' }`. A leg on a surface without one is `not-run`. */
  baseUrls: Partial<Record<Surface, string>>;
  /** The commit and the dirty flag of the checkout, for each ledger entry. */
  revision: { commit: string; dirty: boolean };
  /** Measures a video: duration and black time. Default: `measureVideo` with the given tools. */
  measure?: (path: string) => Promise<VideoMeasure>;
  videoTools?: VideoTools;
  fixtures?: FixtureArming;
  /** Forks the QA database for a row group that declares a `fork` label (spec 2.4, R3). */
  fork?: ForkRunner;
  /** The sentences of the project's boot-failure screen (spec 2.11.2 `not-booted`). */
  bootFailureSentences?: readonly string[];
  signals?: SignalSource;
  /** Ends the process after a signal. Default: `process.exit`. */
  exit?: (code: number) => void;
  out: (line: string) => void;
  err: (line: string) => void;
}

export interface RunOptions {
  /** `<reportDir>/<slug>.shots.json`. */
  manifestPath: string;
  /** Run only these legs. */
  legs?: readonly string[] | null;
  /** Run only these row ids. */
  only?: readonly string[] | null;
}

export interface RunSummary {
  slug: string;
  results: RowResult[];
  /** Fixture states that could not be armed, with the reason. */
  warnings: string[];
  /** 0 when no row and leg failed. */
  exitCode: number;
}

/** The targets whose legs are browser legs: one attempt (spec 2.11.4). Every other target is a device. */
export const BROWSER_TARGETS: ReadonlySet<string> = new Set(['playwright', 'fake']);

/** The slug of a plan path: `<reportDir>/<slug>.shots.json`. */
export function planSlug(manifestPath: string): string {
  const name = basename(manifestPath);
  if (!name.endsWith('.shots.json')) {
    throw new LaunchwrightError('qa.session.plan', `${manifestPath}: a plan is <reportDir>/<slug>.shots.json`, { context: { path: manifestPath } });
  }
  return name.slice(0, -'.shots.json'.length);
}

/** A `{handleKey}` that the sweep planner could not fill. Such a route cannot be opened. */
const UNFILLED = /\{([A-Za-z0-9_]+)\}/;

const PAGE_TEXT = 'document.body ? document.body.innerText : ""';

function narrow(manifest: Manifest, legNames: Set<string>, opts: RunOptions): Array<{ shot: Shot; legs: string[] }> {
  for (const leg of opts.legs ?? []) {
    if (!legNames.has(leg)) throw new LaunchwrightError('qa.session.legs', `--legs ${leg} is not a leg. Legs: ${[...legNames].join(' ')}`, { context: { leg } });
  }
  const ids = new Set(manifest.shots.map((s) => s.id));
  for (const id of opts.only ?? []) {
    if (!ids.has(id)) throw new LaunchwrightError('qa.session.only', `--only ${id} is not a row of ${opts.manifestPath}`, { context: { id } });
  }
  const plan = manifest.shots
    .filter((s) => !opts.only || opts.only.includes(s.id))
    .map((shot) => ({ shot, legs: opts.legs ? shot.legs.filter((l) => opts.legs?.includes(l)) : [...shot.legs] }))
    .filter((p) => p.legs.length > 0);
  if (plan.length === 0) throw new LaunchwrightError('qa.session.empty', '--legs and --only leave no row on any leg', {});
  return plan;
}

/** One planned row and the legs it runs, as `narrow` gives them. */
type PlanItem = { shot: Shot; legs: string[] };

/** The fork label a row declares, or undefined for a row on the shared QA world (spec 2.4). */
export function forkLabel(shot: Shot): string | undefined {
  const label = (shot as Shot & Isolation).fork;
  return typeof label === 'string' && label.trim() !== '' ? label : undefined;
}

/** Runs once, also when two paths call it: the `finally` block and a signal handler. */
function once(fn: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    running ??= fn();
    return running;
  };
}

interface Attempt {
  failures: RowFailure[];
  notes: string[];
  entries: LedgerEntry[];
}

/** The runner of one plan. */
class Run {
  private readonly reportDir: string;
  private readonly slug: string;
  private readonly paths: ReturnType<typeof reportPaths>;
  private readonly ready = new Map<string, { ready: boolean; reason?: string }>();

  constructor(
    private readonly deps: RunnerDeps,
    manifestPath: string,
  ) {
    this.reportDir = dirname(manifestPath);
    this.slug = planSlug(manifestPath);
    this.paths = reportPaths(this.reportDir, this.slug);
  }

  get slugName(): string {
    return this.slug;
  }

  /** The leg as a result before any session: `n/a` or `not-run` with the reason, or null to run it. */
  private async gate(shot: Shot, leg: Leg, target: QaTarget | null, needs: QaTargetCapability[]): Promise<Pick<RowResult, 'status' | 'reason'> | null> {
    if (!target) return { status: 'n/a', reason: 'no target' };
    const missing = needs.filter((cap) => !target.capabilities.has(cap));
    if (missing.length > 0) return { status: 'n/a', reason: `the ${target.name} target has no ${missing.join(', ')} capability` };
    const unfilled = UNFILLED.exec(shot.route);
    if (unfilled) return { status: 'not-run', reason: `the route ${shot.route} has an unfilled handle {${unfilled[1]}}. Run lw qa world reset, then plan the sweep again` };
    if (this.deps.baseUrls[leg.surface] === undefined) {
      return { status: 'not-run', reason: `no base URL for the ${leg.surface} surface. Pass --base ${leg.surface}=<url> or set qa.baseUrls.${leg.surface}` };
    }
    let readiness = this.ready.get(leg.name);
    if (!readiness) {
      readiness = await target.ready(leg);
      this.ready.set(leg.name, readiness);
    }
    if (!readiness.ready) return { status: 'not-run', reason: `the ${target.name} target is not ready: ${readiness.reason ?? 'no reason given'}` };
    return null;
  }

  async row(shot: Shot, leg: Leg, target: QaTarget | null): Promise<RowResult> {
    const started = this.deps.clock.now();
    const needs: QaTargetCapability[] = ['screenshot', ...(shot.act && shot.act.length > 0 ? (['input'] as const) : [])];
    const gated = await this.gate(shot, leg, target, needs);
    if (gated || !target) return { row: shot.id, leg: leg.name, failures: [], attempts: 0, ms: 0, status: gated?.status ?? 'n/a', reason: gated?.reason ?? 'no target' };

    const device = !BROWSER_TARGETS.has(target.name);
    const wantsVideo = device || shot.video === true || (shot.act?.length ?? 0) > 0;
    const video = wantsVideo && target.capabilities.has('video');
    const limit = device ? this.deps.config.evidence.attempts : 1;
    let last: Attempt = { failures: [], notes: [], entries: [] };
    let attempts = 0;
    await dropRowLeg(this.reportDir, this.slug, shot.id, leg.name);
    while (attempts < limit) {
      attempts += 1;
      last = await this.attempt(shot, leg, target, { attempt: attempts, video, device });
      await appendLedger(this.reportDir, this.slug, last.entries);
      if (last.failures.length === 0) break;
    }
    const notes = [...last.notes];
    if (wantsVideo && !video) notes.unshift(`video n/a: the ${target.name} target has no video capability`);
    return {
      row: shot.id,
      leg: leg.name,
      status: last.failures.length === 0 ? 'passed' : 'failed',
      ...(notes.length > 0 ? { reason: notes.join('; ') } : {}),
      failures: last.failures,
      attempts,
      ms: this.deps.clock.now() - started,
    };
  }

  private rel(leg: string, row: string, kind: EvidenceKind, opts: EvidencePathOptions): string {
    return evidencePath(this.slug, leg, row, kind, opts);
  }

  private async attempt(shot: Shot, leg: Leg, target: QaTarget, opts: { attempt: number; video: boolean; device: boolean }): Promise<Attempt> {
    const { attempt } = opts;
    const files: Array<{ rel: string; kind: EvidenceKind; at: string }> = [];
    const pngs: string[] = [];
    const notes: string[] = [];
    const failures = new Set<RowFailure>();
    const now = (): string => this.deps.clock.date().toISOString();
    const abs = (rel: string): string => join(this.reportDir, rel);
    const videoExt = opts.device ? 'mp4' : 'webm';
    let session: QaSession | null = null;
    let recording = false;
    let videoPath: string | null = null;
    let pageText: string | null = null;
    let landed: string | null = null;
    let logs: SessionLogLine[] = [];

    try {
      session = await target.open({
        leg,
        baseUrl: this.deps.baseUrls[leg.surface] as string,
        outDir: this.paths.assets,
        ...(shot.fixture.persona ? { persona: shot.fixture.persona } : {}),
      });
      if (opts.video) {
        const rel = this.rel(leg.name, shot.id, 'video', { attempt, videoExt });
        await session.startVideo(abs(rel));
        recording = true;
        videoPath = rel;
      }
      await session.navigate(shot.route);
      await session.settle(shot.settle);
      if (session.evaluate) pageText = String(await session.evaluate(PAGE_TEXT));
      landed = await session.currentRoute();
      const shotRel = this.rel(leg.name, shot.id, 'screenshot', { attempt });
      await session.screenshot(abs(shotRel));
      files.push({ rel: shotRel, kind: 'screenshot', at: now() });
      pngs.push(shotRel);
      for (const [i, step] of (shot.act ?? []).entries()) {
        await session.act(step);
        const stepRel = this.rel(leg.name, shot.id, 'step', { attempt, step: i + 1 });
        await session.screenshot(abs(stepRel));
        files.push({ rel: stepRel, kind: 'step', at: now() });
        pngs.push(stepRel);
      }
    } catch (err) {
      const code = err instanceof LaunchwrightError ? err.code : '';
      failures.add(code === 'qa.target.settle' || code === 'qa.target.act' ? 'expect' : 'crashed');
      notes.push(failureText(err));
    }

    // Collect what the session holds, also after a failure: the video, the logs, the trace.
    if (session) {
      try {
        if (recording && videoPath) {
          recording = false;
          await session.stopVideo();
          files.push({ rel: videoPath, kind: 'video', at: now() });
        }
        const read = await session.logs().then(
          (lines) => ({ lines }),
          (err: unknown) => {
            // A target that cannot read the page console (iOS Safari over WebDriver) refuses with
            // qa.target.capability. The log item is then n/a with that reason (spec 2.11.1).
            if (err instanceof LaunchwrightError && err.code === 'qa.target.capability') return { na: failureText(err) };
            throw err;
          },
        );
        if ('na' in read) notes.push(`log n/a: ${read.na}`);
        else {
          logs = read.lines;
          const logRel = this.rel(leg.name, shot.id, 'log', { attempt });
          mkdirSync(dirname(abs(logRel)), { recursive: true });
          writeFileSync(abs(logRel), logs.map((l) => JSON.stringify(l)).join('\n') + (logs.length > 0 ? '\n' : ''));
          files.push({ rel: logRel, kind: 'log', at: now() });
        }
        const traceRel = this.rel(leg.name, shot.id, 'trace', { attempt });
        if ((await session.trace(abs(traceRel))) !== null) files.push({ rel: traceRel, kind: 'trace', at: now() });
        const uiRel = this.rel(leg.name, shot.id, 'ui', { attempt });
        if ((await session.dump(abs(uiRel))) !== null) files.push({ rel: uiRel, kind: 'ui', at: now() });
      } catch (err) {
        failures.add('crashed');
        notes.push(`collecting the evidence failed: ${failureText(err)}`);
      } finally {
        await session.close();
      }
    }

    const screenshots = await Promise.all(pngs.map((rel) => readFile(abs(rel))));
    const videos: VideoMeasure[] = [];
    if (videoPath && files.some((f) => f.rel === videoPath)) {
      try {
        videos.push(await this.measure(abs(videoPath)));
      } catch (err) {
        failures.add('blank-video');
        notes.push(`the video cannot be measured: ${failureText(err)}`);
      }
    }
    const checked = attemptFailures(
      {
        screenshots,
        ...(pageText !== null ? { page: { text: pageText, bootFailureSentences: this.deps.bootFailureSentences ?? [] } } : {}),
        ...(landed !== null ? { route: { requested: shot.route, landedPath: landed } } : {}),
        logs,
        expectedPageErrors: expectedPageErrors(shot),
        videos,
      },
      this.deps.config.evidence,
    );
    for (const f of checked) failures.add(f);
    if (failures.has('route-drift') && landed !== null) notes.push(`the session left ${shot.route} for ${landed}`);

    const entries = await Promise.all(
      files.map((f) =>
        ledgerEntry(this.reportDir, {
          path: f.rel,
          kind: f.kind,
          capturedAt: f.at,
          commit: this.deps.revision.commit,
          dirty: this.deps.revision.dirty,
          leg: leg.name,
          target: target.name,
          ...(leg.device ? { device: leg.device } : {}),
          provenance: routeProvenance(shot.route),
          row: shot.id,
          attempt,
        }),
      ),
    );
    const order: RowFailure[] = ['blank', 'not-booted', 'route-drift', 'blank-video', 'over-budget', 'page-error', 'expect', 'crashed'];
    return { failures: order.filter((f) => failures.has(f)), notes, entries };
  }

  private measure(path: string): Promise<VideoMeasure> {
    if (this.deps.measure) return this.deps.measure(path);
    if (!this.deps.videoTools) throw new LaunchwrightError('qa.session.video', 'The runner has no video tools to measure a video.');
    return measureVideo(path, this.deps.videoTools);
  }

  get resultsPath(): string {
    return this.paths.results;
  }
}

/** The message of `err`, after its code when it has one. */
function failureText(err: unknown): string {
  if (err instanceof LaunchwrightError) return `${err.code}: ${err.message}`;
  return messageOf(err);
}

/** The states to arm: each `fixture.arm` state with the persona of its row, once. */
function armList(plan: Array<{ shot: Shot }>): Array<{ state: string; persona?: string }> {
  const seen = new Map<string, { state: string; persona?: string }>();
  for (const { shot } of plan) {
    for (const state of shot.fixture.arm) {
      const persona = shot.fixture.persona;
      seen.set(`${state}\u0000${persona ?? ''}`, { state, ...(persona ? { persona } : {}) });
    }
  }
  return [...seen.values()];
}

/** Splits a plan into the rows on the shared QA world and one group per fork label, in plan order. */
function forkGroups(plan: PlanItem[]): { shared: PlanItem[]; groups: Map<string, PlanItem[]> } {
  const shared: PlanItem[] = [];
  const groups = new Map<string, PlanItem[]>();
  for (const item of plan) {
    const label = forkLabel(item.shot);
    if (label === undefined) shared.push(item);
    else {
      const group = groups.get(label);
      if (group) group.push(item);
      else groups.set(label, [item]);
    }
  }
  return { shared, groups };
}

/**
 * Runs a plan. The rows on the shared QA world arm once, run, then disarm. Each fork group forks the
 * QA database, arms its single-instance facts on the fork, runs, then disarms and drops the fork
 * (spec 2.4, R3). It disarms and drops in `finally` and on SIGINT and SIGTERM, also after a failure,
 * and appends one `RowResult` per row and leg to `results.jsonl`.
 */
export async function runManifest(opts: RunOptions, deps: RunnerDeps): Promise<RunSummary> {
  const legs = new Map(legDefinitions(deps.config).map((l) => [l.name, l]));
  const manifest = await loadManifest(opts.manifestPath, { legs: legs.keys() });
  const plan = narrow(manifest, new Set(legs.keys()), opts);
  const run = new Run(deps, opts.manifestPath);
  const registered = new Set(deps.targets.names());
  const { shared, groups } = forkGroups(plan);

  const warnings: string[] = [];
  const results: RowResult[] = [];

  // One teardown runs at a time: the phase in progress sets it, the `finally` and the signal
  // handler call it. Each phase clears it when it finishes, so the next phase sets a fresh one.
  let teardown: (() => Promise<void>) | null = null;
  const runTeardown = async (): Promise<void> => {
    const current = teardown;
    teardown = null;
    if (current) await current();
  };

  const signals = deps.signals ?? process;
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const onSignal = (code: number) => () => {
    deps.err('interrupted: disarming the fixtures before exit');
    runTeardown().then(
      () => exit(code),
      (err: unknown) => {
        deps.err(`disarm failed: ${failureText(err)}. Run lw qa fixture disarm before anyone uses the QA database.`);
        exit(code);
      },
    );
  };
  const onInt = onSignal(130);
  const onTerm = onSignal(143);
  signals.on('SIGINT', onInt);
  signals.on('SIGTERM', onTerm);

  const armGroup = async (group: PlanItem[], arming: FixtureArming | undefined, label: string | null): Promise<void> => {
    const toArm = armList(group);
    if (toArm.length > 0 && !arming) warnings.push(`no fixture was armed (${toArm.map((a) => a.state).join(', ')}): the world submodule gives no fixture arming`);
    for (const item of arming ? toArm : []) {
      deps.out(`arm       ${item.state}${item.persona ? ` for ${item.persona}` : ''}${label ? ` in fork ${label}` : ''}`);
      try {
        await arming?.arm(item.state, item.persona ? { persona: item.persona } : {});
      } catch (err) {
        warnings.push(`${item.state} was not armed${label ? ` in fork ${label}` : ''}: ${failureText(err)}`);
      }
    }
  };

  const runRows = async (group: PlanItem[]): Promise<void> => {
    for (const { shot, legs: legNames } of group) {
      for (const name of legNames) {
        const leg = legs.get(name) as Leg;
        const target = registered.has(leg.target) ? deps.targets.get(leg.target) : null;
        const result = await run.row(shot, leg, target);
        await appendResult(run.resultsPath, result);
        results.push(result);
        deps.out(`${result.status.padEnd(8)}  ${leg.name.padEnd(16)} ${shot.id}${result.failures.length > 0 ? ` (${result.failures.join(', ')})` : ''}${result.reason ? `: ${result.reason}` : ''}`);
      }
    }
  };

  // Arms the group, runs its rows, then disarms it and drops its fork (also after a failure).
  const runPhase = async (group: PlanItem[], arming: FixtureArming | undefined, label: string | null, dropFork?: () => Promise<void>): Promise<void> => {
    teardown = once(async () => {
      try {
        if (arming) {
          deps.out('disarm    the fixtures of this run');
          await arming.disarm();
        }
      } finally {
        if (dropFork) await dropFork();
      }
    });
    try {
      await armGroup(group, arming, label);
      await runRows(group);
    } finally {
      await runTeardown();
    }
  };

  try {
    await runPhase(shared, deps.fixtures, null);
    for (const [label, group] of groups) {
      if (!deps.fork) {
        warnings.push(`the fork group "${label}" is not isolated: no fork runner was given, so it ran on the shared QA world`);
        await runPhase(group, deps.fixtures, label);
        continue;
      }
      const forker = deps.fork;
      const database = await forker.create(label);
      deps.out(`fork      ${label} -> ${database}`);
      const arming = forker.arming ? forker.arming(database) : deps.fixtures;
      await runPhase(group, arming, label, () => forker.drop(database));
    }
  } finally {
    try {
      await runTeardown();
    } finally {
      signals.off('SIGINT', onInt);
      signals.off('SIGTERM', onTerm);
    }
  }
  for (const w of warnings) deps.err(`fixture caveat: ${w}`);
  const failed = results.filter((r) => r.status === 'failed').length;
  // A run where no pair ran proves nothing, so CI must not read it as green.
  const ran = results.filter((r) => r.status === 'passed' || r.status === 'failed').length;
  const notRun = results.filter((r) => r.status === 'not-run').length;
  if (ran === 0 && notRun > 0) deps.err(`no row and leg pair ran: ${notRun} not run. The run proves nothing, so it exits 1.`);
  return { slug: run.slugName, results, warnings, exitCode: failed > 0 || (ran === 0 && notRun > 0) ? 1 : 0 };
}
