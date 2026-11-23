// The fixture arming of `lw qa session run` (spec 2.5.3). It opens the QA app on a given database
// and arms a fact into it. Without a database it arms the base QA world, as `lw qa fixture` does. A
// fork group arms in the QA app that serves its fork instead (`serveFork`, spec 2.4, R3).
import { loadAppEntry, openWorld, type QaAppEntry } from './app.mts';
import { type WorldCommandOptions, worldContext } from './context.mts';
import { armFact, disarmFact } from './fixture.mts';
import { listWorld, registryHash } from './registry.mts';
import type { WorldRegistry } from './types.mts';

/**
 * Arms one state for a row and disarms every armed state (spec 2.5.3). The session runner holds one
 * of these per database: `arm` makes a fact true, `disarm` replays the undo record and shuts the app
 * down. The runner's `FixtureArming` has this same shape.
 */
export interface FixtureArming {
  arm(state: string, opts: { persona?: string }): Promise<void>;
  disarm(): Promise<void>;
}

/** What `fixtureArming` needs. It opens the QA app on `database`, or on the base QA world without one. */
export interface FixtureArmingOptions extends WorldCommandOptions {
  /** A fork database (spec 2.4). Omit it to arm the shared QA world. */
  database?: string;
  /** The QA app entry. Default: the `qaApp` export that config `qa.app` names. */
  entry?: QaAppEntry;
  /** The world registry. Default: the project's `<feature>.world.mts` files. */
  registry?: WorldRegistry;
}

/**
 * Opens the QA app on `database` and gives an arming bound to it. `arm` runs `armFact`, which writes
 * the undo record before each change. `disarm` replays the record and shuts the app down, and is
 * safe to call twice.
 */
export async function fixtureArming(opts: FixtureArmingOptions): Promise<FixtureArming> {
  const ctx = await worldContext(opts);
  const entry = opts.entry ?? (await loadAppEntry(ctx.root, ctx.qa));
  const registry = opts.registry ?? ctx.registry;
  const database = opts.database ?? ctx.overlay.database;
  const overlay = { ...ctx.overlay, database, registryHash: registryHash(listWorld(registry)) };
  const world = await openWorld(entry, ctx.sections, ctx.env, overlay);
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await world.close();
  };
  return {
    async arm(state, o) {
      await armFact(world, registry, ctx.root, state, o.persona === undefined ? {} : { persona: o.persona });
    },
    async disarm() {
      try {
        await disarmFact(world, registry, ctx.root);
      } finally {
        await close();
      }
    },
  };
}
