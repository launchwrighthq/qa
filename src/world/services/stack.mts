// The QA stack (spec 2.5.2): the QA database, its refusals, and the statements that create, copy
// and drop a database. Ported from the source `qa-stack.mjs` (`qaTargetProblem`, `assertQaTarget`).
// A QA database is written freely and dropped without a question, so only its name and a
// loopback host make it safe. Both are checked here, in one place. A message names the host and
// the database, never the URL: the URL holds a password.
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { LaunchwrightError, messageOf } from '../../kernel/index.mts';
import { pathKind } from '../../kernel/services/fs.mts';
import { type Db, loadDb } from '../../services/peers.mts';

/** The hosts that a QA or worktree database may live on. */
export const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1'];

/** The database that a drop or a create runs from: a session cannot drop its own database. */
export const MAINTENANCE_DATABASE = 'postgres';

/** The folder of the PGlite QA databases, relative to the project root. */
export const PGLITE_DIR = '.lw/qa/pglite';

/** The fields of config section `db` that the stack reads. */
export interface DbSection {
  driver?: 'pg' | 'pglite';
  url?: string;
  dataDir?: string;
  [key: string]: unknown;
}

/** True for `localhost`, `127.0.0.1` and `::1`, also in brackets. */
export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.includes(host.replace(/^\[|\]$/g, ''));
}

/** A database name from free text: lower case letters, digits and `_`, a letter first, 63 characters at most. */
export function databaseName(text: string): string {
  const name = text.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^[^a-z]+/, '').replace(/_+$/, '');
  return (name === '' ? 'app' : name).slice(0, 63);
}

/** Throws `qa.stack.name` unless `name` is a plain identifier: it goes into a statement as text. */
export function checkIdentifier(name: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    throw new LaunchwrightError('qa.stack.name', `"${name}" is not a plain database name (lower case letters, digits and _, a letter first).`, { context: { database: name } });
  }
  return name;
}

/** The folder of a PGlite QA database. */
export function pgliteDir(root: string, name: string): string {
  return resolve(root, PGLITE_DIR, checkIdentifier(name));
}

function parsePgUrl(url: string): URL | string {
  if (!URL.canParse(url)) return 'the database URL cannot be parsed';
  const parsed = new URL(url);
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') return `${parsed.protocol.replace(':', '')} is not a postgres URL`;
  return parsed;
}

/** The database name of a Postgres URL. */
export function databaseOfUrl(url: string): string {
  const parsed = parsePgUrl(url);
  if (typeof parsed === 'string') throw new LaunchwrightError('qa.stack.url', `Refusing: ${parsed}.`);
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

/** The host of a Postgres URL, for a message. Never the URL. */
export function hostOfUrl(url: string): string {
  const parsed = parsePgUrl(url);
  return typeof parsed === 'string' ? 'an unreadable host' : parsed.host;
}

/** The same server, role, password and query, with another database. */
export function urlWithDatabase(url: string, name: string): string {
  const parsed = parsePgUrl(url);
  if (typeof parsed === 'string') throw new LaunchwrightError('qa.stack.url', `Refusing: ${parsed}.`);
  parsed.pathname = `/${checkIdentifier(name)}`;
  return parsed.toString();
}

/** Why a Postgres URL is not on this machine, or null. */
export function remoteHostProblem(url: string): string | null {
  const parsed = parsePgUrl(url);
  if (typeof parsed === 'string') return parsed;
  const host = parsed.hostname;
  return isLoopbackHost(host) ? null : `host ${host} is not this machine, and lw qa writes and drops databases on this machine only`;
}

/**
 * Why `db` is not the QA database `database` of the project at `root`, or null. Two refusals: a
 * host that is not this machine, and a database whose name is not `database`. The developer's
 * database is on the same server and differs by its name alone.
 */
export function qaTargetProblem(db: DbSection, database: string, root: string): string | null {
  if ((db.driver ?? 'pg') === 'pglite') {
    if (typeof db.dataDir !== 'string' || db.dataDir === '') return 'the PGlite database has no data folder, so it is the in-memory database of the process';
    const dir = isAbsolute(db.dataDir) ? db.dataDir : resolve(root, db.dataDir);
    return dir === pgliteDir(root, database) ? null : `the PGlite folder ${dir} is not ${pgliteDir(root, database)}`;
  }
  if (typeof db.url !== 'string' || db.url === '') return 'no database URL at all';
  const remote = remoteHostProblem(db.url);
  if (remote) return remote;
  const name = databaseOfUrl(db.url);
  return name === database ? null : `database ${name || '(none named)'} is not ${database}, and lw qa may only touch ${database}`;
}

/** Throws `qa.stack.target` unless `db` is the QA database. Called before anything destructive. */
export function assertQaTarget(db: DbSection, database: string, root: string): void {
  const problem = qaTargetProblem(db, database, root);
  if (problem) throw new LaunchwrightError('qa.stack.target', `Refusing: ${problem}.`, { context: { database } });
}

/** Section `db` pointed at the QA database: the same server with another name, or a PGlite folder of its own. */
export function qaDbSection(db: DbSection, database: string, root: string): DbSection {
  checkIdentifier(database);
  if ((db.driver ?? 'pg') === 'pglite') return { ...db, driver: 'pglite', dataDir: pgliteDir(root, database) };
  if (typeof db.url !== 'string' || db.url === '') {
    throw new LaunchwrightError('qa.stack.url', 'Config db.url is not set, so the QA world has no server. Set DATABASE_URL in the env file of the run.');
  }
  const out = { ...db, url: urlWithDatabase(db.url, database) };
  assertQaTarget(out, database, root);
  return out;
}

/** Create, copy, list and drop databases. `allowed` guards each name that a create or drop touches. */
export interface DbAdmin {
  exists(name: string): Promise<boolean>;
  /** Creates `name`, empty or as a copy of `template`. A template with open sessions fails with `qa.stack.copy`. */
  create(name: string, template?: string): Promise<void>;
  /** Drops `name` when it exists. It ends the open sessions of its own role first; a session of another role fails the drop after 5 s. */
  drop(name: string): Promise<void>;
  /** The databases whose names start with `prefix`. */
  list(prefix: string): Promise<string[]>;
  close(): Promise<void>;
}

function guard(allowed: (name: string) => boolean, name: string, what: string): string {
  checkIdentifier(name);
  if (!allowed(name)) throw new LaunchwrightError('qa.stack.guard', `Refusing to ${what} database ${name}: lw qa may not touch it.`, { context: { database: name } });
  return name;
}

function quoted(name: string): string {
  return `"${checkIdentifier(name)}"`;
}

/** Opens a connection to a Postgres URL on this machine. `QaAppEntry.connect` gives one. */
export type ConnectDb = (url: string) => Promise<Db>;

/** The default `ConnectDb`: `createDb` of the db module. */
export const dbModuleConnect: ConnectDb = async (url) => (await loadDb()).createDb({ driver: 'pg', url });

/** The admin of a Postgres server on this machine, through its maintenance database. */
export async function pgAdmin(url: string, allowed: (name: string) => boolean, connect: ConnectDb = dbModuleConnect): Promise<DbAdmin> {
  const remote = remoteHostProblem(url);
  if (remote) throw new LaunchwrightError('qa.stack.host', `Refusing: ${remote}.`, { context: { host: hostOfUrl(url) } });
  const db: Db = await connect(urlWithDatabase(url, MAINTENANCE_DATABASE));
  const names = async (): Promise<string[]> => {
    const result = await db.execute('select datname from pg_database where not datistemplate');
    return (result.rows as Array<{ datname: string }>).map((r) => r.datname);
  };
  return {
    exists: async (name) => (await names()).includes(checkIdentifier(name)),
    async create(name, template) {
      guard(allowed, name, 'create');
      try {
        await db.execute(`create database ${quoted(name)}${template === undefined ? '' : ` template ${quoted(template)}`}`);
      } catch (cause) {
        const message = messageOf(cause);
        if (template !== undefined && /being accessed by other users/.test(message)) {
          throw new LaunchwrightError('qa.stack.copy', `Cannot copy ${template}: other sessions use it. Stop the run that holds it (lw stop in its checkout), then try again.`, {
            cause,
            context: { database: name, template },
          });
        }
        throw new LaunchwrightError('qa.stack.create', `Cannot create database ${name}: ${message}`, { cause, context: { database: name } });
      }
    },
    async drop(name) {
      guard(allowed, name, 'drop');
      // No FORCE: a role may not end an autovacuum worker, and a plain drop stops one.
      await db.execute(
        `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${checkIdentifier(name)}' and usename = current_user and pid <> pg_backend_pid()`,
      );
      await db.execute(`drop database if exists ${quoted(name)}`);
    },
    list: async (prefix) => (await names()).filter((n) => n.startsWith(prefix)).sort(),
    close: () => db.close(),
  };
}

/** The admin of the PGlite QA databases: one folder each under `.lw/qa/pglite/`. */
export function pgliteAdmin(root: string, allowed: (name: string) => boolean): DbAdmin {
  const dir = resolve(root, PGLITE_DIR);
  return {
    async exists(name) {
      return (await pathKind(pgliteDir(root, name))) === 'dir';
    },
    async create(name, template) {
      guard(allowed, name, 'create');
      if (template === undefined) await mkdir(pgliteDir(root, name), { recursive: true });
      else await cp(pgliteDir(root, template), pgliteDir(root, name), { recursive: true, errorOnExist: true, force: false });
    },
    async drop(name) {
      guard(allowed, name, 'drop');
      await rm(pgliteDir(root, name), { recursive: true, force: true });
    },
    async list(prefix) {
      let names: string[];
      try {
        names = await readdir(dir);
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new LaunchwrightError('qa.stack.read', `Cannot read ${dir}.`, { cause });
      }
      return names.filter((n) => n.startsWith(prefix)).sort();
    },
    close: async () => undefined,
  };
}

/** The admin for section `db`: Postgres through its URL and `connect`, or the PGlite folders of the project. */
export function dbAdmin(db: DbSection, root: string, allowed: (name: string) => boolean, connect?: ConnectDb): Promise<DbAdmin> {
  if ((db.driver ?? 'pg') === 'pglite') return Promise.resolve(pgliteAdmin(root, allowed));
  if (typeof db.url !== 'string' || db.url === '') throw new LaunchwrightError('qa.stack.url', 'Config db.url is not set, so lw qa has no database server.');
  return pgAdmin(db.url, allowed, connect);
}

/** The folder name of a path, as a database name part. */
export function folderName(path: string): string {
  return databaseName(basename(path));
}
