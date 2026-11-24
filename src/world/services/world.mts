// `lw qa world reset|status` (spec 2.5.2): drop, create and migrate the QA database, run the base
// seed, then every fact and persona seed through the QA app, and stamp the registry hash.
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type Clock, LaunchwrightError, messageOf } from '../../kernel/index.mts';
import { readTextOrNull } from '../../kernel/services/fs.mts';
import { loadAuth, loadDb } from '../../services/peers.mts';
import { entryConnect, openWorld, type QaAppEntry, type QaDatabaseContext, type QaOverlay, type QaWorld } from './app.mts';
import { seededName, snapshotSeeded } from './fork.mts';
import { personaIds, QA_PROVIDER } from './ids.mts';
import { assertRegistry, listWorld, registryHash } from './registry.mts';
import { type ConnectDb, dbAdmin, type DbAdmin, type DbSection, qaDbSection } from './stack.mts';
import type { WorldEntry, WorldRegistry } from './types.mts';

/** The stamp of the last reset, relative to the project root. The `.lw/` folder is not in git. */
export const STAMP_FILE = '.lw/qa/world.json';

/** What a reset records. `status` compares `hash` with the live registry. */
export interface WorldStamp {
  database: string;
  hash: string;
  seededAt: string;
  entries: WorldEntry[];
}

function isStamp(value: unknown): value is WorldStamp {
  const s = value as Partial<WorldStamp> | null;
  return typeof s === 'object' && s !== null && typeof s.database === 'string' && typeof s.hash === 'string' && typeof s.seededAt === 'string' && Array.isArray(s.entries);
}

/** The stamp, `null` when no reset ran, or `unreadable` for a file that is not a stamp. */
export async function readStamp(root: string): Promise<WorldStamp | null | 'unreadable'> {
  const text = await readTextOrNull(join(root, STAMP_FILE));
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    if (cause instanceof SyntaxError) return 'unreadable';
    throw cause;
  }
  return isStamp(value) ? value : 'unreadable';
}

/** Writes a JSON file through a temp file, so a reader never sees half a file. */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, path);
}

/** `lw db seed` and `lw db seed <name>...`: the only base seed commands that run in process on the QA database. */
const DB_SEED = /^lw\s+db\s+seed(?:\s+(.*))?$/;

/** The seed names of config `qa.seed`: `[]` for every seed, null without a base seed. Throws `qa.world.seed` for another command. */
export function baseSeedNames(command: string | undefined): string[] | null {
  if (command === undefined || command.trim() === '') return null;
  const match = DB_SEED.exec(command.trim());
  if (!match) {
    throw new LaunchwrightError(
      'qa.world.seed',
      `Config qa.seed is "${command}". It must be lw db seed [name...]: the world runs those seeds in process on the QA database, so they never reach another database.`,
    );
  }
  return (match[1] ?? '').split(/\s+/).filter(Boolean);
}

/** The seed names that `QaAppEntry.seed` gets from config `qa.seed`: the words after `lw db seed`, else every word. */
export function hookSeedNames(command: string | undefined): string[] {
  const text = (command ?? '').trim();
  const words = (DB_SEED.exec(text)?.[1] ?? text).split(/\s+/);
  return words.filter(Boolean);
}

/** What a reset needs. */
export interface ResetOptions {
  root: string;
  /** The project config sections. */
  sections: Record<string, unknown>;
  env: string;
  entry: QaAppEntry;
  registry: WorldRegistry;
  /** The fake bot tokens take the registry hash of `registry`. */
  overlay: Omit<QaOverlay, 'registryHash'>;
  /** Config `qa.seed`. */
  seed?: string;
  clock: Clock;
  out: (line: string) => void;
  /** Default: the admin of section `db`, limited to the QA database. */
  admin?: DbAdmin;
}

async function recreate(o: ResetOptions, db: DbSection): Promise<void> {
  const database = o.overlay.database;
  const admin = o.admin ?? (await dbAdmin(db, o.root, (name) => name === database, entryConnect(o.entry)));
  try {
    await admin.drop(database);
    await admin.create(database);
  } finally {
    await admin.close();
  }
  const ctx: QaDatabaseContext = { root: o.root, database, sections: { ...o.sections, db }, out: o.out };
  if (o.entry.migrate) {
    await o.entry.migrate(ctx);
    o.out(`migrated ${database} through qaApp.migrate`);
  } else await migrateWithDbModule(o, db);
  if (o.entry.seed) {
    const names = hookSeedNames(o.seed);
    await o.entry.seed(ctx, names);
    o.out(`base seed through qaApp.seed: ${names.join(', ') || 'default'}`);
  }
}

async function migrateWithDbModule(o: ResetOptions, db: DbSection): Promise<void> {
  const database = o.overlay.database;
  const { createDb, migrate } = await loadDb();
  const conn = await createDb({
    driver: db.driver ?? 'pg',
    url: db.url,
    dataDir: db.dataDir,
    ...(typeof db.schema === 'string' ? { schema: db.schema } : {}),
    ...(db.tables !== undefined ? { tables: db.tables as Record<string, Record<string, string>> } : {}),
  });
  try {
    const dir = resolve(o.root, typeof db.migrations === 'string' ? db.migrations : 'packages/db/migrations');
    const { applied } = await migrate(conn, dir);
    o.out(`migrated ${database}: ${applied.length} migration(s)`);
  } finally {
    await conn.close();
  }
}

async function linkWithAuth(world: QaWorld, userId: string, persona: string, telegramId: number): Promise<void> {
  const auth = await loadAuth();
  if (!world.app.has(auth.USERS)) {
    throw new LaunchwrightError('qa.world.auth', 'The QA app has no auth module, so no persona can sign in. Add the auth module to the project.');
  }
  const users = world.app.get(auth.USERS);
  await users.link(world.tenantId, userId, { provider: QA_PROVIDER, subject: persona });
  await users.link(world.tenantId, userId, { provider: 'telegram', subject: String(telegramId) });
}

/** The user of a persona: through `entry.linkPersona` when the app has it, else through the auth module. */
async function linkPersona(world: QaWorld, entry: Pick<QaAppEntry, 'linkPersona'> | undefined, persona: string, seededUserId: unknown): Promise<string> {
  const ids = personaIds(persona);
  const given = typeof seededUserId === 'string' && seededUserId !== '' ? seededUserId : undefined;
  if (entry?.linkPersona) {
    const linked = await entry.linkPersona(world, { persona, accountId: ids.accountId, telegramId: ids.telegramId, ...(given ? { userId: given } : {}) });
    const userId = typeof linked === 'string' && linked !== '' ? linked : given;
    if (userId === undefined) throw new LaunchwrightError('qa.world.handles', 'Its seed returned no userId, and qaApp.linkPersona returned none.');
    return userId;
  }
  if (given === undefined) throw new LaunchwrightError('qa.world.handles', 'Its seed returned no userId.');
  await linkWithAuth(world, given, persona, ids.telegramId);
  return given;
}

/**
 * Runs the base seed, then each fact and persona seed. A seed that fails names its id and its file.
 * With `entry.seed`, the base seed ran before the boot, so the seed of the db module does not run here.
 */
export async function seedWorld(
  world: QaWorld,
  registry: WorldRegistry,
  o: Pick<ResetOptions, 'root' | 'seed' | 'out'> & { entry?: Pick<QaAppEntry, 'seed' | 'linkPersona'> },
): Promise<WorldEntry[]> {
  const names = o.entry?.seed ? null : baseSeedNames(o.seed);
  if (names !== null) {
    const { DB, runSeeds, seedNames } = await loadDb();
    const dir = join(o.root, 'packages/db/seeds');
    const ran = await runSeeds(world.app.get(DB), dir, names.length > 0 ? names : await seedNames(dir), o.out);
    o.out(`base seed: ${ran.join(', ') || 'none'}`);
  }
  const seeded: WorldEntry[] = [];
  for (const fact of registry.facts) {
    try {
      const handles = await fact.seed(world);
      const missing = fact.handleKeys.filter((key) => !(key in handles));
      if (missing.length > 0) {
        throw new LaunchwrightError('qa.world.handles', `It declares handleKeys ${fact.handleKeys.join(', ')}, and its seed returned ${Object.keys(handles).join(', ') || 'nothing'}.`);
      }
      seeded.push({ kind: 'fact', id: fact.id, summary: fact.summary, feature: fact.feature, handleKeys: [...fact.handleKeys], handles });
    } catch (cause) {
      throw new LaunchwrightError('qa.world.seed', `Fact ${fact.id} (${fact.file}) could not be seeded: ${messageOf(cause)}`, { cause, context: { fact: fact.id } });
    }
  }
  for (const persona of registry.personas) {
    const ids = personaIds(persona.id);
    try {
      const handles = await persona.seed(world, ids);
      const userId = await linkPersona(world, o.entry, persona.id, handles?.userId);
      seeded.push({ kind: 'persona', id: persona.id, summary: persona.summary, feature: persona.feature, handles: { ...handles, userId, telegramId: ids.telegramId } });
    } catch (cause) {
      throw new LaunchwrightError('qa.world.seed', `Persona ${persona.id} (${persona.file}) could not be seeded: ${messageOf(cause)}`, {
        cause,
        context: { persona: persona.id },
      });
    }
  }
  return seeded;
}

/**
 * Drops, creates and migrates the QA database, seeds it through the QA app, and writes the stamp
 * last. A reset that stops half way leaves no stamp, so `status` calls the world unseeded.
 */
export async function resetWorld(o: ResetOptions): Promise<WorldStamp> {
  assertRegistry(o.registry);
  const hash = registryHash(listWorld(o.registry));
  const db = qaDbSection((o.sections.db ?? {}) as DbSection, o.overlay.database, o.root);
  o.out(`resetting ${o.overlay.database}`);
  await rmStamp(o.root);
  const connect = entryConnect(o.entry);
  const snapshot = { root: o.root, db, database: o.overlay.database, ...(connect ? { connect } : {}) };
  await snapshotSeeded(snapshot, 'drop');
  await recreate(o, db);
  const world = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, registryHash: hash });
  let entries: WorldEntry[];
  try {
    entries = await seedWorld(world, o.registry, o);
  } finally {
    await world.close();
  }
  await snapshotSeeded(snapshot, 'replace');
  o.out(`snapshot ${seededName(o.overlay.database)}: each fork copies it`);
  const stamp: WorldStamp = { database: o.overlay.database, hash, seededAt: o.clock.date().toISOString(), entries };
  await writeJson(join(o.root, STAMP_FILE), stamp);
  o.out(`seeded ${entries.length} entries, registry ${stamp.hash}`);
  return stamp;
}

async function rmStamp(root: string): Promise<void> {
  await rm(join(root, STAMP_FILE), { force: true });
}

/** `lw qa world status`. */
export interface WorldStatus {
  database: string;
  exists: boolean;
  /** `current`: seeded from this registry. `stale`: from another one. `unseeded`: no readable stamp. `missing`: no database. */
  state: 'missing' | 'unseeded' | 'current' | 'stale';
  registryHash: string;
  stamp: WorldStamp | null;
}

/** Compares the stamp with the live registry and checks that the QA database exists. */
export async function worldStatus(o: {
  root: string;
  sections: Record<string, unknown>;
  database: string;
  registry: WorldRegistry;
  admin?: DbAdmin;
  /** Opens the maintenance connection of a Postgres server. Default: the db module. */
  connect?: ConnectDb;
}): Promise<WorldStatus> {
  const db = qaDbSection((o.sections.db ?? {}) as DbSection, o.database, o.root);
  const admin = o.admin ?? (await dbAdmin(db, o.root, (name) => name === o.database, o.connect));
  let exists: boolean;
  try {
    exists = await admin.exists(o.database);
  } finally {
    await admin.close();
  }
  const live = registryHash(listWorld(o.registry));
  const read = await readStamp(o.root);
  const stamp = read === 'unreadable' || read === null || read.database !== o.database ? null : read;
  const state = !exists ? 'missing' : stamp === null ? 'unseeded' : stamp.hash === live ? 'current' : 'stale';
  return { database: o.database, exists, state, registryHash: live, stamp };
}
