// The QA app on a fork (spec 2.4, R3). `lw qa session run` gives each fork group one QA app on the
// fork database, served on a free loopback port, so the rows of the group read the fork and two
// groups hold the only open giveaway at the same time. `lw qa states forge` reaches a forged state
// on a fork the same way (spec 2.5).
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { type Db, loadDb } from '../../services/peers.mts';
import type { ForkRunner, ForkServer } from '../../services/runner.mts';
import { type ListenQaApp, type Listening, listenQaApp } from './api.mts';
import { openWorld, type QaAppEntry, type QaOverlay, type QaWorld } from './app.mts';
import { armFact, forkUndoFile } from './fixture.mts';
import { createFork, dropFork } from './fork.mts';
import type { WorldRegistry } from './types.mts';

/** What a fork server needs: the project, the QA app entry and the overlay of the QA database. */
export interface ForkWorldOptions {
  root: string;
  /** The project config sections. */
  sections: Record<string, unknown>;
  env: string;
  /** The overlay of the QA database. A fork server keeps it and names the fork database instead. */
  overlay: QaOverlay;
  entry: QaAppEntry;
  registry: WorldRegistry;
  out: (line: string) => void;
  /** Default: `listenQaApp`, the `serveNode` of the http module. */
  listen?: ListenQaApp;
}

/** A fork server with the booted world, so a forged seed writes through the same app. */
export interface ForkInstance extends ForkServer {
  database: string;
  world: QaWorld;
}

/**
 * Boots the QA app on the fork `database` and serves it on a free loopback port. Its arming writes
 * the undo record under `.lw/qa/fork/`, apart from the shared record, so two forks arm at the same
 * time. `disarm` replays nothing: the fork drop removes every armed change. `close` stops the
 * server, shuts the app down and removes the undo record.
 */
export async function serveFork(o: ForkWorldOptions, database: string): Promise<ForkInstance> {
  const world = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, database });
  let listening: Listening | null = null;
  try {
    listening = await (o.listen ?? listenQaApp)(o.entry.serve(world.app), world.app, 0);
  } finally {
    if (listening === null) await world.close();
  }
  const server = listening;
  const undoFile = forkUndoFile(database);
  let closing: Promise<void> | null = null;
  const close = async (): Promise<void> => {
    try {
      await server.close();
    } finally {
      try {
        await world.close();
      } finally {
        await rm(join(o.root, undoFile), { force: true });
      }
    }
  };
  return {
    database,
    world,
    url: `http://127.0.0.1:${server.port}`,
    arming: {
      async arm(state, a) {
        await armFact(world, o.registry, o.root, state, { ...(a.persona === undefined ? {} : { persona: a.persona }), undoFile });
      },
      disarm: async () => undefined,
    },
    close: () => (closing ??= close()),
  };
}

/** A fork with the QA app served on it, as `lw qa states forge` uses it. `release` stops the app and drops the fork. */
export interface OpenFork extends ForkInstance {
  /** Runs one statement on the fork through `QaAppEntry.db`, else token `DB` of the db module. */
  execute(sql: string): Promise<unknown>;
  release(): Promise<void>;
}

/** Forks the QA database for `label` and serves the QA app on the fork. A failed start drops the fork. */
export async function openFork(o: ForkWorldOptions, label: string): Promise<OpenFork> {
  const runner = worldForkRunner(o);
  const database = await runner.create(label);
  let instance: ForkInstance | null = null;
  try {
    instance = await serveFork(o, database);
  } finally {
    if (instance === null) await runner.drop(database);
  }
  const served = instance;
  const db = async (): Promise<Db> => o.entry.db?.(served.world.app) ?? served.world.app.get((await loadDb()).DB);
  return {
    ...served,
    execute: async (sql) => (await db()).execute(sql),
    async release() {
      try {
        await served.close();
      } finally {
        await runner.drop(database);
      }
    },
  };
}

/** The fork runner of `lw qa session run`: fork, serve, drop, on the QA database of `o.overlay`. */
export function worldForkRunner(o: ForkWorldOptions): ForkRunner {
  const fork = { root: o.root, sections: o.sections, database: o.overlay.database, out: o.out };
  return {
    create: (label) => createFork({ ...fork, label }),
    drop: (name) => dropFork({ ...fork, name }),
    serve: (database) => serveFork(o, database),
  };
}
