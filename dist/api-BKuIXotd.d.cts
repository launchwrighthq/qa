import { A as App } from './app-KXgbRXYO.cjs';
import { Q as QaConfig } from './config-Z7lJ4xeJ.cjs';

/** The parts of a database connection that the QA stack and world use. */
interface Db {
    execute(sql: string): Promise<{
        rows: unknown[];
    }>;
    close(): Promise<void>;
}
/** The run record of the dev module that the worktree command reads. */
interface RunRecord {
    checkout: string;
    surfaces: Array<{
        name: string;
        url?: string;
    }>;
}

interface CheckoutFacts {
    /** The project root: the folder of `launchwright.config.ts`. */
    root: string;
    /** The folder that holds `.git`. The root when the project is not in git. */
    toplevel: string;
    /** The git common dir: the `.git` folder of the main checkout. The root outside git. */
    commonDir: string;
    /** True in a linked worktree, false in the main checkout or outside git. */
    linked: boolean;
    /** The project root in the main checkout. */
    mainRoot: string;
}
/** The checkout facts of the project at `root`. */
declare function readCheckout(root: string): Promise<CheckoutFacts>;
/**
 * The project name of `lw dev`: config `dev.project`, else the folder of the main checkout, so the
 * worktrees of one project get one name.
 */
declare function devProjectName(sections: Record<string, unknown>, checkout: CheckoutFacts): string;

/** What a seed gets: the booted QA app and the tenant of the world. */
interface WorldCtx {
    /** The QA app, booted on the QA database. A seed writes through its services, never raw SQL. */
    app: App;
    /** The tenant of every seeded row. One world is one tenant. */
    tenantId: string;
}
/** The ids that the world gives a persona. They are pure functions of the persona id. */
interface PersonaIds {
    persona: string;
    /** `qa:<persona>`: the subject of the `qa` identity that `POST /__qa/session` signs in. */
    accountId: string;
    /** `qaTelegramId(persona)`: the Telegram id of the persona's Mini App launch. */
    telegramId: number;
}
/** What a persona seed returns. `userId` is the auth user that the seed made or reused. */
interface PersonaHandles {
    userId: string;
    readonly [key: string]: string | number;
}
/** The handles that a fact seed returns, for the route parameters of a row (`/shelf/{shelfId}`). */
type FactHandles = Readonly<Record<string, string | number>>;
/** A user in a named state. */
interface Persona {
    /** Kebab case or dotted, unique in the registry, for example `member-expiring`. */
    id: string;
    /** One line in a user's words. The report prints it beside the shot. */
    summary: string;
    seed(ctx: WorldCtx, ids: PersonaIds): Promise<PersonaHandles>;
}
/** What `arm` gets: the world context, the persona of the row, and the undo recorder. */
interface ArmCtx extends WorldCtx {
    persona?: PersonaIds;
    /**
     * Persists one undo step before the change that it undoes. A process that stops between the
     * two leaves a step that undoes nothing, never a change that no step names.
     */
    record(step: unknown): Promise<void>;
}
/** A state of the product data. */
interface Fact {
    /** Kebab case or dotted, unique in the registry, for example `catalog.empty-shelf`. */
    id: string;
    summary: string;
    /**
     * The handle names that the seed returns, declared so a planner can match route parameters
     * without a database. `lw qa world reset` refuses a seed that does not return each one.
     */
    handleKeys: readonly string[];
    seed(ctx: WorldCtx): Promise<FactHandles>;
    /** Makes the fact true on a live QA world (`lw qa fixture arm`). Each change records its undo step first. */
    arm?(ctx: ArmCtx): Promise<void>;
    /** Replays one undo step that `arm` recorded (`lw qa fixture disarm`). */
    undo?(ctx: WorldCtx, step: unknown): Promise<void>;
}
/** What one `<feature>.world.mts` exports as default. */
interface FeatureWorld {
    personas?: readonly Persona[];
    facts?: readonly Fact[];
}
/** A persona or a fact with the feature of its world file. */
type Owned<T> = T & {
    feature: string;
    file: string;
};
/** Every persona and fact of the project, in seed order. */
interface WorldRegistry {
    personas: readonly Owned<Persona>[];
    facts: readonly Owned<Fact>[];
}
/** One registry entry as plain data: what `lw qa world list --json` prints. */
interface WorldEntry {
    kind: 'persona' | 'fact';
    id: string;
    summary: string;
    feature: string;
    /** A fact's declared handle names. */
    handleKeys?: readonly string[];
    /** What the seed returned. Present in the stamp of a reset. */
    handles?: Readonly<Record<string, string | number>>;
}

/** A fetch handler, as `buildHonoApp` of `@launchwrighthq/http` gives it. */
interface QaHandler {
    fetch(request: Request): Response | Promise<Response>;
}
/** What the module of config `qa.app` exports as `qaApp`. */
interface QaAppEntry {
    /** The project app, not booted, built from these config sections and this environment. */
    create(sections: Record<string, unknown>, env: string): App | Promise<App>;
    /** The HTTP handler of the booted app: the project routes and the module routes, `qaRoutes(app)` among them. */
    serve(app: App): QaHandler;
    /** The tenant of the world. Default: `DEFAULT_TENANT_ID` of the db module, for an app without it. */
    tenantId?: string;
    /** The connection a forged direct row write uses (spec 2.5). Default: token `DB` of the db module. */
    db?(app: App): Db;
    /** Brings the schema of the empty QA database up to date, before the app boots. In place of `migrate` of the db module. */
    migrate?(ctx: QaDatabaseContext): Promise<void>;
    /** The base seed, after `migrate` and before the app boots. `names` come from config `qa.seed`. In place of `runSeeds` of the db module. */
    seed?(ctx: QaDatabaseContext, names: string[]): Promise<void>;
    /**
     * Creates or finds the user of a seeded persona, and records its sign-in identity so the app's
     * `/__qa/session` route finds it. A returned id replaces the `userId` of the persona seed. In place of `USERS` of the auth module.
     */
    linkPersona?(world: QaWorld, persona: QaPersonaLink): Promise<string | void>;
    /** Opens a connection to a Postgres URL on this machine, for the create, copy and drop statements. In place of `createDb` of the db module. */
    connect?(url: string): Promise<Db>;
}
/** What `QaAppEntry.migrate` and `seed` get. */
interface QaDatabaseContext {
    root: string;
    /** The QA database name. */
    database: string;
    /** The config sections of the QA app: section `db` points at the QA database. */
    sections: Record<string, unknown>;
    out: (line: string) => void;
}
/** What `QaAppEntry.linkPersona` gets for one persona. */
interface QaPersonaLink {
    persona: string;
    /** `qa:<persona>`: the account id of the persona. */
    accountId: string;
    telegramId: number;
    /** The user id that the persona seed returned, if any. */
    userId?: string;
}
/** The QA database name: config `qa.database`, else `<dev.project>_qa`. */
declare function qaDatabase(sections: Record<string, unknown>, checkout: CheckoutFacts): string;
/** The port of the fake Bot API of `lw qa telegram`. The default `qa.telegramUrl` names it. */
declare const QA_TELEGRAM_PORT = 9102;
/** What `qaSections` changes. */
interface QaOverlay {
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
declare function qaFakeToken(id: number, registryHash: string): string;
/** A bot of the fake Bot API: what `serveFakeTelegram` of `telegram-fake` takes. */
interface QaFakeBot {
    username: string;
    token: string;
}
/** The bots of config `telegram.bots` with their fake tokens, so `lw qa telegram` serves the bots that the QA API calls. */
declare function qaFakeBots(sections: Record<string, unknown>, registryHash: string): QaFakeBot[];
/**
 * The config sections of the QA app:
 * - `db` points at the QA database (same server, other name; or a PGlite folder of its own);
 * - `telegram.apiUrl` is the fake Bot API, and each bot token is replaced by a fake token that
 *   only the fake Bot API knows, so no QA process holds or uses a live token;
 * - `qa.routes` is on, so the `/__qa` routes mount.
 * The input stays unchanged.
 */
declare function qaSections(sections: Record<string, unknown>, o: QaOverlay): Record<string, unknown>;
/** Imports a package as the project resolves it, so a registry in it is the one the project fills. */
declare function importFromProject<T>(root: string, specifier: string): Promise<T>;
/** The `qaApp` export of the module of config `qa.app`. Throws `qa.world.app`. */
declare function loadAppEntry(root: string, qa: Pick<QaConfig, 'app'>): Promise<QaAppEntry>;
/** A booted QA app and the world context of its seeds. */
interface QaWorld extends WorldCtx {
    database: string;
    sections: Record<string, unknown>;
    close(): Promise<void>;
}
/** Builds the QA app from the factory on the overlaid sections and boots it. */
declare function openWorld(entry: QaAppEntry, sections: Record<string, unknown>, env: string, overlay: QaOverlay): Promise<QaWorld>;

/** A QA app that listens on 127.0.0.1. `close` stops the server and keeps the app booted. */
interface Listening {
    port: number;
    close(): Promise<void>;
}
/** Serves a booted QA app on 127.0.0.1. Port 0 takes a free port. */
type ListenQaApp = (handler: QaHandler, app: App, port: number) => Promise<Listening>;
/** The default `ListenQaApp`: `serveNode` of the http module, else a plain node:http server. */
declare const listenQaApp: ListenQaApp;

export { type ArmCtx as A, type CheckoutFacts as C, type Db as D, type FeatureWorld as F, type ListenQaApp as L, type Owned as O, type Persona as P, type QaAppEntry as Q, type RunRecord as R, type WorldRegistry as W, type QaWorld as a, type QaOverlay as b, type Fact as c, type WorldEntry as d, type PersonaIds as e, type FactHandles as f, type Listening as g, type PersonaHandles as h, QA_TELEGRAM_PORT as i, type QaDatabaseContext as j, type QaFakeBot as k, type QaHandler as l, type QaPersonaLink as m, type WorldCtx as n, devProjectName as o, importFromProject as p, listenQaApp as q, loadAppEntry as r, openWorld as s, qaDatabase as t, qaFakeBots as u, qaFakeToken as v, qaSections as w, readCheckout as x };
