// Lazy loaders for the framework packages that the QA legs use (spec 2.13, D1). kernel is the only
// framework package the engine always needs; every other one is an optional peer. A loader throws
// qa.<module>.module when a leg runs without its peer installed. The specifier is a variable, so a
// bundle that leaves a leg out leaves its peer out too.
import { isCodedError, LaunchwrightError, messageOf, optionalPeer, type Token } from '../kernel/index.mts';
import type { AddressInfo } from 'node:net';

/**
 * True for the stub module that Vite gives in place of an optional peer that is not installed. Its
 * import throws `Could not resolve "<spec>" imported by ...`, not the `ERR_MODULE_NOT_FOUND` of Node.
 */
function isViteMissingPeer(err: unknown, spec: string): boolean {
  if (!isCodedError(err) || err.code !== 'kernel.peer.load') return false;
  return messageOf((err as { cause?: unknown }).cause).startsWith(`Could not resolve "${spec}" imported by`);
}

/** The peer `spec`, or undefined when it is not installed. `spec` is a parameter, so no bundler resolves it. */
async function peerOrUndefined<T>(spec: string): Promise<T | undefined> {
  try {
    return await optionalPeer<T>(spec, () => import(spec) as Promise<T>);
  } catch (err) {
    if (isViteMissingPeer(err, spec)) return undefined;
    throw err;
  }
}

async function loadPeer<T>(spec: string, module: string): Promise<T> {
  const mod = await peerOrUndefined<T>(spec);
  if (!mod) throw new LaunchwrightError(`qa.${module}.module`, `This lw qa command needs the ${module} module. Run lw add ${module}.`);
  return mod;
}

/** The parts of a database connection that the QA stack and world use. */
export interface Db {
  execute(sql: string): Promise<{ rows: unknown[] }>;
  close(): Promise<void>;
}

interface CreateDbOptions {
  driver?: string;
  url?: string;
  dataDir?: string;
  schema?: string;
  tables?: Record<string, Record<string, string>>;
}

interface DbPeer {
  createDb(options: CreateDbOptions): Promise<Db>;
  migrate(db: Db, dir: string): Promise<{ applied: string[] }>;
  runSeeds(db: Db, dir: string, names: string[], out: (line: string) => void): Promise<string[]>;
  seedNames(dir: string): Promise<string[]>;
  DB: Token<Db>;
  DEFAULT_TENANT_ID: string;
  TENANT_SCOPE: Token<unknown>;
  tenantScope(tenantId: string): unknown;
}

const DB_PEER = '@launchwrighthq/db';
export const loadDb = (): Promise<DbPeer> => loadPeer<DbPeer>(DB_PEER, 'db');
/** The db module, or undefined when the project does not install it. */
export const optionalDb = (): Promise<DbPeer | undefined> => peerOrUndefined<DbPeer>(DB_PEER);

/** The request facts a QA route handler reads. A local copy of the http module's RequestContext. */
export interface RequestContext {
  req: Request;
  readonly url: URL;
  params: Record<string, string>;
  ip?: string;
  get<T>(token: Token<T>): T;
}

/** What a QA route handler gets. */
export interface HandlerArgs<I = unknown> {
  ctx: RequestContext;
  input: I;
}

interface NodeServer {
  listening: boolean;
  once(event: 'error', listener: (error: Error) => void): void;
  once(event: 'listening', listener: () => void): void;
  once(event: string, listener: (...args: unknown[]) => void): void;
  address(): AddressInfo | null;
  close(callback: (error?: Error) => void): void;
  closeAllConnections?(): void;
}

interface HttpPeer {
  serveNode(hono: unknown, port: number, options: { hostname: string; app: unknown; signals: boolean }): { server: NodeServer };
  HttpError: new (status: number, code: string, message: string, options?: { cause?: unknown; context?: Record<string, unknown>; headers?: Record<string, string>; fields?: Record<string, unknown> }) => Error;
}

const HTTP_PEER = '@launchwrighthq/http';
export const loadHttp = (): Promise<HttpPeer> => loadPeer<HttpPeer>(HTTP_PEER, 'http');
/** The http module, or undefined when the project does not install it. */
export const optionalHttp = (): Promise<HttpPeer | undefined> => peerOrUndefined<HttpPeer>(HTTP_PEER);

interface UsersService {
  link(tenantId: string, userId: string, identity: { provider: string; subject: string }): Promise<unknown>;
  resolve(
    tenantId: string,
    identity: { provider: string; subject: string },
    options: { mergeVerifiedEmail: boolean; signUp: boolean },
  ): Promise<{ user: { id: string; status: string } }>;
}

interface SessionsService {
  create(options: { tenantId: string; userId: string; method: string; place: unknown }): Promise<{ token: string; session: unknown }>;
  settings: { cookie: string };
  cookie(token: string, session: unknown): string;
}

interface AuthPeer {
  USERS: Token<UsersService>;
  SESSIONS: Token<SessionsService>;
  placeOf(request: Request, ip?: string): unknown;
  requestTenant(ctx: RequestContext): string | null | undefined;
}

export const loadAuth = (): Promise<AuthPeer> => loadPeer<AuthPeer>('@launchwrighthq/auth', 'auth');

/** A storage disk driver. A local copy of the storage module's StorageDriver. */
export interface StorageDriver {
  supports(capability: string): boolean;
  put(key: string, body: Buffer, options: { contentType: string }): Promise<void>;
  presign(key: string, options: { method: string; expiresIn: number }): Promise<string>;
}

interface StoragePeer {
  STORAGE: Token<{ driver(disk: string): StorageDriver }>;
}

export const loadStorage = (): Promise<StoragePeer> => loadPeer<StoragePeer>('@launchwrighthq/storage', 'storage');

/** The run record of the dev module that the worktree command reads. */
export interface RunRecord {
  checkout: string;
  surfaces: Array<{ name: string; url?: string }>;
}

interface DevPeer {
  defaultConfigDir(env: Record<string, string | undefined>, home: string): string;
  runDev(
    context: {
      root: string;
      commonDir: string;
      configDir: string;
      env: Record<string, string | undefined>;
      out: (line: string) => void;
      err: (line: string) => void;
      signal: AbortSignal;
    },
    options: { replace: boolean },
  ): Promise<number>;
  RunRegistry: new (configDir: string) => { list(): Promise<RunRecord[]> };
  readRun(pidFile: string): Promise<RunRecord | null>;
  pidFile(root: string, env: string): string;
  parseEnvText(text: string): Record<string, string>;
}

export const loadDev = (): Promise<DevPeer> => loadPeer<DevPeer>('@launchwrighthq/dev', 'dev');

/** An open tunnel of the tunnel module. */
export interface Tunnel {
  url: string;
  close(): Promise<void>;
}

/** A tunnel manager of the tunnel module. */
export interface TunnelManagerInstance {
  driver(): { open(port: number, options: { name: string }): Promise<Tunnel> };
}

interface TunnelPeer {
  tunnelConfig: {
    safeParse(input: unknown): { success: true; data: unknown } | { success: false; error: { issues: Array<{ path: unknown[]; message: string }> } };
  };
  TunnelManager: new (config: unknown, container: unknown) => TunnelManagerInstance;
}

export const loadTunnel = (): Promise<TunnelPeer> => loadPeer<TunnelPeer>('@launchwrighthq/tunnel', 'tunnel');
