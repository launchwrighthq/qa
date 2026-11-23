// The QA app: the project app on the QA database (spec 2.5.2).
//
// The kernel has no config layer to override. A project's config sections are plain data that
// its code passes to `createApp`. So the QA overlay is a function of the sections (`qaSections`),
// and the project gives a factory that builds its app from any sections: `export const qaApp` in
// the module that config `qa.app` names (default `apps/api/src/main.mts`). `lw qa world reset`,
// `lw qa world api`, `lw qa fixture` and `lw qa job` all boot that factory on the overlaid sections.
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type App, LaunchwrightError, messageOf, resolveImport } from '../../kernel/index.mts';
import { loadDb } from '../../services/peers.mts';
import type { QaConfig } from '../../config.mts';
import { type CheckoutFacts, devProjectName } from './checkout.mts';
import { databaseName, type DbSection, qaDbSection } from './stack.mts';
import type { WorldCtx } from './types.mts';

/** A fetch handler, as `buildHonoApp` of `@launchwrighthq/http` gives it. */
export interface QaHandler {
  fetch(request: Request): Response | Promise<Response>;
}

/** What the module of config `qa.app` exports as `qaApp`. */
export interface QaAppEntry {
  /** The project app, not booted, built from these config sections and this environment. */
  create(sections: Record<string, unknown>, env: string): App | Promise<App>;
  /** The HTTP handler of the booted app: the project routes and the module routes, `qaRoutes(app)` among them. */
  serve(app: App): QaHandler;
}

/** The QA database name: config `qa.database`, else `<dev.project>_qa`. */
export function qaDatabase(sections: Record<string, unknown>, checkout: CheckoutFacts): string {
  const qa = sections.qa as { database?: unknown } | undefined;
  if (typeof qa?.database === 'string' && qa.database !== '') return qa.database;
  return databaseName(`${devProjectName(sections, checkout)}_qa`);
}

function botId(token: unknown): number | undefined {
  const match = typeof token === 'string' ? /^([1-9][0-9]{0,15}):/.exec(token) : null;
  return match ? Number(match[1]) : undefined;
}

/** The port of the fake Bot API of `lw qa telegram`. The default `qa.telegramUrl` names it. */
export const QA_TELEGRAM_PORT = 9102;

/** What `qaSections` changes. */
export interface QaOverlay {
  root: string;
  database: string;
  /** The fake Bot API: config `qa.telegramUrl`. */
  telegramUrl: string;
  /** The hash of the world registry. The fake bot tokens derive from it. */
  registryHash: string;
}

/**
 * The fake token of a bot on the QA API: `<botId>:<32 characters>` from the bot id and the
 * registry hash. Only the fake Bot API knows it, so a QA process never holds a live token.
 */
export function qaFakeToken(id: number, registryHash: string): string {
  return `${id}:${createHash('sha256').update(`lw-qa-fake-bot:${id}:${registryHash}`).digest('base64url').slice(0, 32)}`;
}

/** A bot of the fake Bot API: what `serveFakeTelegram` of `telegram-fake` takes. */
export interface QaFakeBot {
  username: string;
  token: string;
}

/** The bots of config `telegram.bots` with their fake tokens, so `lw qa telegram` serves the bots that the QA API calls. */
export function qaFakeBots(sections: Record<string, unknown>, registryHash: string): QaFakeBot[] {
  const telegram = sections.telegram as { bots?: Record<string, { token?: unknown; id?: unknown; username?: unknown }> } | undefined;
  const out: QaFakeBot[] = [];
  for (const [name, bot] of Object.entries(telegram?.bots ?? {})) {
    const id = typeof bot.id === 'number' ? bot.id : botId(bot.token);
    if (id === undefined) continue;
    out.push({ username: typeof bot.username === 'string' ? bot.username : name, token: qaFakeToken(id, registryHash) });
  }
  return out;
}

/**
 * The config sections of the QA app:
 * - `db` points at the QA database (same server, other name; or a PGlite folder of its own);
 * - `telegram.apiUrl` is the fake Bot API, and each bot token is replaced by a fake token that
 *   only the fake Bot API knows, so no QA process holds or uses a live token;
 * - `qa.routes` is on, so the `/__qa` routes mount.
 * The input stays unchanged.
 */
export function qaSections(sections: Record<string, unknown>, o: QaOverlay): Record<string, unknown> {
  const out: Record<string, unknown> = { ...sections };
  out.db = qaDbSection((sections.db ?? {}) as DbSection, o.database, o.root);
  const telegram = sections.telegram as { bots?: Record<string, Record<string, unknown>> } | undefined;
  if (telegram !== undefined) {
    const bots: Record<string, Record<string, unknown>> = {};
    for (const [name, bot] of Object.entries(telegram.bots ?? {})) {
      const { token, ...rest } = bot;
      const id = typeof rest.id === 'number' ? rest.id : botId(token);
      bots[name] = id === undefined ? rest : { ...rest, token: qaFakeToken(id, o.registryHash) };
    }
    out.telegram = { ...telegram, apiUrl: o.telegramUrl, bots };
  }
  out.qa = { ...((sections.qa as Record<string, unknown> | undefined) ?? {}), routes: true };
  return out;
}

/** Imports a package as the project resolves it, so a registry in it is the one the project fills. */
export async function importFromProject<T>(root: string, specifier: string): Promise<T> {
  let url: string;
  try {
    url = pathToFileURL(resolveImport(specifier, root)).href;
  } catch (cause) {
    throw new LaunchwrightError('qa.world.import', `The project at ${root} cannot resolve ${specifier}. Install it in the project.`, { cause, context: { specifier } });
  }
  return (await import(url)) as T;
}

function isEntry(value: unknown): value is QaAppEntry {
  const v = value as Partial<QaAppEntry> | null;
  return typeof v === 'object' && v !== null && typeof v.create === 'function' && typeof v.serve === 'function';
}

/** The `qaApp` export of the module of config `qa.app`. Throws `qa.world.app`. */
export async function loadAppEntry(root: string, qa: Pick<QaConfig, 'app'>): Promise<QaAppEntry> {
  const file = isAbsolute(qa.app) ? qa.app : resolve(root, qa.app);
  let mod: { qaApp?: unknown };
  try {
    mod = (await import(pathToFileURL(file).href)) as { qaApp?: unknown };
  } catch (cause) {
    throw new LaunchwrightError('qa.world.app', `Cannot load ${file} (config qa.app): ${messageOf(cause)}`, { cause, context: { file } });
  }
  if (!isEntry(mod.qaApp)) {
    throw new LaunchwrightError('qa.world.app', `${file} (config qa.app) must export qaApp = { create(sections, env), serve(app) }.`, { context: { file } });
  }
  return mod.qaApp;
}

/** A booted QA app and the world context of its seeds. */
export interface QaWorld extends WorldCtx {
  database: string;
  sections: Record<string, unknown>;
  close(): Promise<void>;
}

/** Builds the QA app from the factory on the overlaid sections and boots it. */
export async function openWorld(entry: QaAppEntry, sections: Record<string, unknown>, env: string, overlay: QaOverlay): Promise<QaWorld> {
  const qa = qaSections(sections, overlay);
  const app = await entry.create(qa, env);
  try {
    await app.boot();
  } catch (cause) {
    try {
      await app.shutdown();
    } catch (shutdown) {
      throw new LaunchwrightError('qa.world.boot', 'The QA app did not boot, and its shutdown failed too.', { cause: new AggregateError([cause, shutdown]) });
    }
    throw cause;
  }
  const { DEFAULT_TENANT_ID } = await loadDb();
  return { app, tenantId: DEFAULT_TENANT_ID, database: overlay.database, sections: qa, close: () => app.shutdown() };
}
