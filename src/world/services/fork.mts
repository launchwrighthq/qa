// `lw qa world fork <label>` (spec 2.4): a per-pass copy of the QA database, so two rows that each
// need a single-instance state run at the same time. The copy takes the seeded snapshot of the QA
// database as its template (a Postgres `create database ... template`, or a PGlite folder copy), and
// a drop removes it. assertQaTarget guards the template, so a fork only runs from a loopback host and
// the `_qa` database. The fork name derives from that database name, so a fork never touches the dev
// database.
import { LaunchwrightError } from '../../kernel/index.mts';
import { assertQaTarget, checkIdentifier, type ConnectDb, databaseName, dbAdmin, type DbAdmin, type DbSection, qaDbSection } from './stack.mts';

/** The part of a fork name between the QA database and the label: `<database>_fork_<label>`. */
export const FORK_MARK = '_fork_';

/** The name of a fork of the QA `database` for `label`: `<database>_fork_<label>`, 63 characters at most. */
export function forkName(database: string, label: string): string {
  checkIdentifier(database);
  return `${database}${FORK_MARK}${databaseName(label)}`.slice(0, 63);
}

/**
 * The snapshot that `lw qa world reset` takes of the seeded QA database: `<database>_fork__seeded`.
 * No label gives this name, because `databaseName` starts a label with a letter. A fork copies the
 * snapshot, so it holds the base seeds, and no session of `lw qa world api` blocks the Postgres copy.
 */
export function seededName(database: string): string {
  checkIdentifier(database);
  return `${database}${FORK_MARK}_seeded`.slice(0, 63);
}

/** True for a fork of the QA `database`: `<database>_fork_...`. The admin guard and the drop use it. */
export function isForkOf(database: string, name: string): boolean {
  return name.startsWith(`${database}${FORK_MARK}`);
}

/** What a fork create or drop needs. */
export interface ForkOptions {
  root: string;
  /** The project config sections. */
  sections: Record<string, unknown>;
  /** The QA database name, the fork's template. */
  database: string;
  out: (line: string) => void;
  /** Opens the maintenance connection of a Postgres server. Default: the db module. */
  connect?: ConnectDb;
}

/**
 * Creates a fork of the QA database and gives the fork name. The template is the seeded snapshot when
 * it exists, else the QA database itself, which a Postgres server copies only when no session uses it.
 */
export async function createFork(o: ForkOptions & { label: string }): Promise<string> {
  const db = qaDbSection((o.sections.db ?? {}) as DbSection, o.database, o.root);
  assertQaTarget(db, o.database, o.root);
  const name = forkName(o.database, o.label);
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n), o.connect);
  try {
    const seeded = seededName(o.database);
    const template = (await admin.exists(seeded)) ? seeded : o.database;
    o.out(`forking ${template} to ${name}`);
    await admin.create(name, template);
  } finally {
    await admin.close();
  }
  return name;
}

/** Drops a fork of the QA database. Refuses a name that is not a fork of `database`. */
export async function dropFork(o: ForkOptions & { name: string }): Promise<void> {
  if (!isForkOf(o.database, o.name)) {
    throw new LaunchwrightError('qa.fork.name', `${o.name} is not a fork of ${o.database}, so lw qa will not drop it.`, { context: { database: o.name } });
  }
  const db = qaDbSection((o.sections.db ?? {}) as DbSection, o.database, o.root);
  assertQaTarget(db, o.database, o.root);
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n), o.connect);
  try {
    await admin.drop(o.name);
    o.out(`dropped ${o.name}`);
  } finally {
    await admin.close();
  }
}

/**
 * Replaces the seeded snapshot of the QA database (`replace`) or drops it (`drop`). `lw qa world
 * reset` drops it first and copies the seeded QA database last, so a reset that stops half way
 * leaves no stale snapshot. `admin` defaults to the admin of section `db`, limited to the snapshot.
 */
export async function snapshotSeeded(
  o: { root: string; db: DbSection; database: string; admin?: DbAdmin; connect?: ConnectDb },
  action: 'replace' | 'drop',
): Promise<void> {
  const seeded = seededName(o.database);
  const admin = o.admin ?? (await dbAdmin(o.db, o.root, (n) => n === seeded, o.connect));
  try {
    await admin.drop(seeded);
    if (action === 'replace') await admin.create(seeded, o.database);
  } finally {
    if (!o.admin) await admin.close();
  }
}
