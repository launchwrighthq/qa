// `lw qa fixture arm|disarm` (spec 2.5.3): makes a fact true on the live QA world for one row,
// and puts it back. Ported from the source `qa-fixture` undo discipline:
// - each undo step is on disk before the change that it undoes;
// - `disarm` replays the steps in reverse order and works from any process, on any day;
// - only the QA database: the world comes from `openWorld`, which refuses any other database.
import { join } from 'node:path';
import { LaunchwrightError } from '../../kernel/index.mts';
import { readTextOrNull } from '../../kernel/services/fs.mts';
import type { QaWorld } from './app.mts';
import { personaIds } from './ids.mts';
import { factById, personaById } from './registry.mts';
import type { WorldRegistry } from './types.mts';
import { writeJson } from './world.mts';

/** The undo record, relative to the project root. */
export const UNDO_FILE = '.lw/qa/fixture.json';

/** One armed fact and its undo steps, in the order `arm` made them. */
export interface ArmedFact {
  fact: string;
  persona?: string;
  steps: unknown[];
}

/** The undo record of one QA database. */
export interface UndoRecord {
  database: string;
  armed: ArmedFact[];
}

/** The undo record of a fork database, relative to the project root. The fork drop removes it. */
export function forkUndoFile(database: string): string {
  return `.lw/qa/fork/${database}.fixture.json`;
}

/** The undo record in `file` (default `UNDO_FILE`), or an empty one for `database`. */
export async function readUndo(root: string, database: string, file: string = UNDO_FILE): Promise<UndoRecord> {
  const text = await readTextOrNull(join(root, file));
  if (text === null) return { database, armed: [] };
  let record: UndoRecord;
  try {
    record = JSON.parse(text) as UndoRecord;
  } catch (cause) {
    throw new LaunchwrightError('qa.fixture.read', `${file} is not JSON. Restore it from the run log, or delete it after lw qa world reset.`, { cause });
  }
  if (record.armed.length > 0 && record.database !== database) {
    throw new LaunchwrightError('qa.fixture.database', `${file} holds facts armed on ${record.database}, not on ${database}. Disarm them on that database first.`, {
      context: { database: record.database },
    });
  }
  return { database, armed: record.armed };
}

function writeUndo(root: string, record: UndoRecord, file: string): Promise<void> {
  return writeJson(join(root, file), record);
}

/** Arms `factId` on the QA world, for `persona` when the row names one. Refuses a fact that is armed already. */
export async function armFact(
  world: QaWorld,
  registry: WorldRegistry,
  root: string,
  factId: string,
  opts: { persona?: string; undoFile?: string } = {},
): Promise<ArmedFact> {
  const file = opts.undoFile ?? UNDO_FILE;
  const fact = factById(registry, factId);
  if (fact.arm === undefined) {
    throw new LaunchwrightError('qa.fixture.no-arm', `Fact ${fact.id} (${fact.file}) has no arm(). Seed it with lw qa world reset, or give it arm() and undo().`, {
      context: { fact: fact.id },
    });
  }
  const persona = opts.persona === undefined ? undefined : personaIds(personaById(registry, opts.persona).id);
  const record = await readUndo(root, world.database, file);
  if (record.armed.some((a) => a.fact === fact.id)) {
    throw new LaunchwrightError('qa.fixture.armed', `Fact ${fact.id} is armed already. Run lw qa fixture disarm first.`, { context: { fact: fact.id } });
  }
  const entry: ArmedFact = { fact: fact.id, ...(persona ? { persona: persona.persona } : {}), steps: [] };
  record.armed.push(entry);
  await writeUndo(root, record, file);
  await fact.arm({
    app: world.app,
    tenantId: world.tenantId,
    ...(persona ? { persona } : {}),
    async record(step: unknown) {
      entry.steps.push(step);
      await writeUndo(root, record, file);
    },
  });
  return entry;
}

/** Replays every undo step in reverse order, removes each fact from the record when its steps are done, and gives the facts. */
export async function disarmFact(world: QaWorld, registry: WorldRegistry, root: string, file: string = UNDO_FILE): Promise<string[]> {
  const record = await readUndo(root, world.database, file);
  const done: string[] = [];
  while (record.armed.length > 0) {
    const entry = record.armed[record.armed.length - 1]!;
    const fact = factById(registry, entry.fact);
    if (fact.undo === undefined) throw new LaunchwrightError('qa.fixture.no-undo', `Fact ${fact.id} has no undo(), so its steps cannot be replayed.`, { context: { fact: fact.id } });
    while (entry.steps.length > 0) {
      await fact.undo(world, entry.steps[entry.steps.length - 1]);
      entry.steps.pop();
      await writeUndo(root, record, file);
    }
    record.armed.pop();
    await writeUndo(root, record, file);
    done.push(entry.fact);
  }
  return done;
}
