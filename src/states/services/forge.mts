// The forged-state fallback (spec 2.5, provenance `forged`, R4). An accepted seed runs on a fork of
// the QA database: an app-service seed writes through the app services (`ctx.app`), a direct-write
// seed inserts its rows. Then the QA app on the fork renders the state on its route, and the target
// photographs it. The files and the row result go to the ledger of the slug with provenance
// `forged`, which the report marks and never counts as a live pass (spec 2.12.2).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Clock, LaunchwrightError, messageOf } from '../../kernel/index.mts';
import type { QaSession, QaTarget } from '../../drivers/target/contract.mts';
import { appendResult, reportPaths } from '../../services/ledger.mts';
import { forkView } from '../../services/runner.mts';
import type { Leg, RowResult, Surface } from '../../services/types.mts';
import type { WorldCtx } from '../../world/services/types.mts';
import { type AcceptedSeed, rowStatements } from './forge-seed.mts';
import { statePath, type StateResult } from './inventory.mts';
import { ledgerRecorder } from './run.mts';

/** What every forged capture carries. A reviewer reads it beside the state. */
export const FORGE_NOTE =
  'A forged state comes from a seed that the library inferred and a reviewer accepted, run on a fork of the QA database. It proves the render only, and it never counts as a live pass.';

/** The QA app on a fork, where a forged seed runs. `worldForkRunner` of the world submodule gives one. */
export interface ForgeFork {
  /** The origin of the QA app on the fork. */
  url: string;
  /** The booted app on the fork and the tenant of the world. */
  world: WorldCtx;
  /** Runs one statement on the fork database: the direct-write last resort. */
  execute(sql: string): Promise<unknown>;
}

/** What the default export of an app-service seed module gets. */
export interface ForgeCtx extends WorldCtx {
  /** The state id, `<union>.<member>`. */
  state: string;
  member: string;
  persona?: string;
}

/** What a forge needs besides the seed and the fork. */
export interface ForgeContext {
  root: string;
  /** The absolute report folder. */
  reportDir: string;
  slug: string;
  leg: Leg;
  target: QaTarget;
  /** Config `qa.baseUrls`: a surface on the QA API moves to the fork server. */
  baseUrls: Partial<Record<Surface, string>>;
  apiPort: number;
  clock: Clock;
  revision: { commit: string; dirty: boolean };
}

/** What the forged artifact file holds: the accepted seed and the note, so a reviewer can read it. */
export interface ForgedArtifact {
  state: string;
  via: AcceptedSeed['via'];
  provenance: 'forged';
  route: string;
  module?: string;
  rows?: AcceptedSeed['rows'];
  note: string;
}

async function runModule(root: string, module: string, ctx: ForgeCtx): Promise<void> {
  const file = isAbsolute(module) ? module : resolve(root, module);
  let mod: { default?: unknown };
  try {
    mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
  } catch (cause) {
    throw new LaunchwrightError('qa.forge.module', `Cannot load the seed module ${module}: ${messageOf(cause)}`, { cause, context: { module } });
  }
  if (typeof mod.default !== 'function') throw new LaunchwrightError('qa.forge.module', `${module} must export a default function (ctx) that writes the state.`, { context: { module } });
  await (mod.default as (ctx: ForgeCtx) => Promise<void>)(ctx);
}

/** Writes the state on the fork: through the app services, or as rows. Throws `qa.forge.seed`. */
async function writeState(seed: AcceptedSeed, fork: ForgeFork, root: string): Promise<void> {
  const member = seed.state.slice(seed.state.indexOf('.') + 1);
  try {
    if (seed.via === 'app-service') {
      const ctx: ForgeCtx = { ...fork.world, state: seed.state, member, ...(seed.persona === undefined ? {} : { persona: seed.persona }) };
      await runModule(root, seed.module as string, ctx);
    } else {
      for (const sql of rowStatements(seed.rows ?? [], fork.world.tenantId)) await fork.execute(sql);
    }
  } catch (cause) {
    throw new LaunchwrightError('qa.forge.seed', `The ${seed.via} seed of ${seed.state} failed: ${messageOf(cause)}`, { cause, context: { state: seed.state } });
  }
}

/** The base URL of the leg on the fork. Throws `qa.forge.surface` for a surface that reads the shared QA database. */
function forkBase(seed: AcceptedSeed, fork: ForgeFork, ctx: ForgeContext): string {
  const view = forkView(ctx.baseUrls, ctx.apiPort, fork.url, `forge ${seed.state}`);
  const blocked = view.blocked[ctx.leg.surface];
  if (blocked !== undefined) throw new LaunchwrightError('qa.forge.surface', blocked, { context: { surface: ctx.leg.surface } });
  return view.baseUrls[ctx.leg.surface] ?? fork.url;
}

/**
 * Forges one state: writes it on the fork, opens its route on the QA app of the fork, and records
 * the screenshot and the seed with provenance `forged`. A row result with the reason `forged` goes to
 * `results.jsonl` of the slug. A failed capture is a failed result; a failed seed throws.
 */
export async function forgeState(seed: AcceptedSeed, fork: ForgeFork, ctx: ForgeContext): Promise<StateResult> {
  const started = ctx.clock.now();
  const dot = seed.state.indexOf('.');
  const union = seed.state.slice(0, dot);
  const member = seed.state.slice(dot + 1);
  await writeState(seed, fork, ctx.root);
  const baseUrl = forkBase(seed, fork, ctx);

  const recorder = ledgerRecorder({ reportDir: ctx.reportDir, slug: ctx.slug, leg: ctx.leg, provenance: 'forged', clock: ctx.clock, revision: ctx.revision });
  const artifactRel = statePath(ctx.slug, seed.state, 'forged', 'json');
  const artifact: ForgedArtifact = {
    state: seed.state,
    via: seed.via,
    provenance: 'forged',
    route: seed.route,
    ...(seed.module ? { module: seed.module } : {}),
    ...(seed.rows ? { rows: seed.rows } : {}),
    note: FORGE_NOTE,
  };
  const artifactFile = join(ctx.reportDir, artifactRel);
  mkdirSync(dirname(artifactFile), { recursive: true });
  writeFileSync(artifactFile, `${JSON.stringify(artifact, null, 2)}\n`);
  await recorder.record({ file: artifactFile, kind: 'log', row: seed.state });

  const shotRel = statePath(ctx.slug, seed.state, 'forged', 'png');
  let error: string | null = null;
  let session: QaSession | null = null;
  try {
    session = await ctx.target.open({ leg: ctx.leg, baseUrl, outDir: join(reportPaths(ctx.reportDir, ctx.slug).assets, 'states'), ...(seed.persona ? { persona: seed.persona } : {}) });
    await session.navigate(seed.route);
    await session.settle(seed.settle ?? { busy: true });
    await session.screenshot(join(ctx.reportDir, shotRel));
    await recorder.record({ file: join(ctx.reportDir, shotRel), kind: 'screenshot', row: seed.state });
  } catch (cause) {
    error = messageOf(cause);
  } finally {
    await session?.close();
  }
  await recorder.flush();

  const ms = ctx.clock.now() - started;
  const result: RowResult = {
    row: seed.state,
    leg: ctx.leg.name,
    status: error === null ? 'passed' : 'failed',
    reason: `forged via ${seed.via}: the render only, never a live pass${error === null ? '' : `; ${error}`}`,
    failures: error === null ? [] : ['crashed'],
    attempts: 1,
    ms,
  };
  await appendResult(reportPaths(ctx.reportDir, ctx.slug).results, result);
  return {
    id: seed.state,
    union,
    member,
    ok: error === null,
    subject: error === null ? shotRel : null,
    context: null,
    provenance: 'forged',
    // No feature function runs over a forged seed. Null is "not checked", never "it agreed".
    verified: null,
    error,
    expect: `forged via ${seed.via}: ${seed.route} renders ${seed.state}. The render only.`,
    ms,
  };
}
