import { A as App } from './app-KXgbRXYO.cjs';
import { Q as QaConfig } from './config-Z7lJ4xeJ.cjs';
import { C as Clock } from './clock-BUdCJ9bN.cjs';
import { F as FetchFn } from './bot-api-BiC2rPPD.cjs';
import 'zod';

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

/** The options that a `lw qa` subcommand gets (the fields of `QaCommandOptions` that the world reads). */
interface WorldCommandOptions {
    cwd: string;
    out: (line: string) => void;
    err: (line: string) => void;
    config?: Record<string, unknown>;
    env?: string;
    processEnv?: Record<string, string | undefined>;
    signal?: AbortSignal;
}

/**
 * Arms one state for a row and disarms every armed state (spec 2.5.3). The session runner holds one
 * of these per database: `arm` makes a fact true, `disarm` replays the undo record and shuts the app
 * down. The runner's `FixtureArming` has this same shape.
 */
interface FixtureArming {
    arm(state: string, opts: {
        persona?: string;
    }): Promise<void>;
    disarm(): Promise<void>;
}
/** What `fixtureArming` needs. It opens the QA app on `database`, or on the base QA world without one. */
interface FixtureArmingOptions extends WorldCommandOptions {
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
 * safe to call twice. The session runner arms a fork group's facts into the fork this way (spec 2.4,
 * R3), so the fork, not the shared world, holds the row's single-instance state.
 */
declare function fixtureArming(opts: FixtureArmingOptions): Promise<FixtureArming>;

/** A shift as milliseconds: a number, or `+2d`, `-3h`, `90m`, `15s`, `500ms`, `1w`. Throws `qa.clock.shift`. */
declare function parseShift(shift: unknown): number;
/** A clock that reads its base clock plus `offsetMs`. A sleep waits on the base clock. */
declare class ShiftClock implements Clock {
    readonly base: Clock;
    offsetMs: number;
    constructor(base: Clock);
    now(): number;
    date(): Date;
    sleep(ms: number, signal?: AbortSignal): Promise<void>;
    /** Moves the clock by `ms`. A negative shift moves it back. */
    shift(ms: number): void;
    /** Puts the clock back on its base. */
    reset(): void;
}

/** The default export of a `<feature>.world.mts` file. It returns the world as it is. */
declare function defineWorld(world: FeatureWorld): FeatureWorld;
/** One loaded world file. */
interface LoadedWorld {
    /** The feature: the file name without `.world.mts`. */
    feature: string;
    /** The path relative to the project root. */
    file: string;
    world: FeatureWorld;
}
/** The registry of the loaded world files, in file order. Facts seed before personas. */
declare function buildRegistry(worlds: readonly LoadedWorld[]): WorldRegistry;
/**
 * Why the registry cannot be seeded, or null. An empty registry, a duplicate id, an id that is
 * not kebab case or dotted, a blank summary, a bad handle key and two personas with one Telegram
 * id each give a wrong or unreadable shot, so each one is a refusal.
 */
declare function registryProblem(registry: WorldRegistry): string | null;
/** Throws `qa.world.registry` when the registry cannot be seeded. */
declare function assertRegistry(registry: WorldRegistry): void;
/** The registry as plain data. */
declare function listWorld(registry: WorldRegistry): WorldEntry[];
/**
 * The fingerprint of the registry: 12 hex of SHA-256 over the sorted kind, id, feature and
 * summary of each entry. A changed summary makes the world stale, because a report prints the
 * live summary beside a shot of the seeded world.
 */
declare function registryHash(entries: readonly WorldEntry[]): string;
/** The persona with this id. Throws `qa.world.persona` for an unknown id: an unknown persona is never a fallback user. */
declare function personaById(registry: WorldRegistry, id: string): Owned<Persona>;
/** The fact with this id. Throws `qa.world.fact` for an unknown id. */
declare function factById(registry: WorldRegistry, id: string): Owned<Fact>;

declare const WORLD_SUFFIX = ".world.mts";
/** Every `<feature>.world.mts` of the project. `lw qa check` lints each one. */
declare function worldFiles(root: string): Promise<string[]>;
/** Imports each world file. Throws `qa.world.file` for a file whose default export is not a world. */
declare function loadWorlds(root: string): Promise<LoadedWorld[]>;
/** The registry of the project's world files. */
declare function loadRegistry(root: string): Promise<WorldRegistry>;
/** One lint finding of a world file. */
interface WorldFinding {
    file: string;
    line: number;
    rule: 'world.raw-sql';
    message: string;
}
/** The raw SQL in the text of one world file. A seed writes through the app's own services (spec 2.5.1). */
declare function rawSqlFindings(file: string, text: string): WorldFinding[];
/** The raw SQL findings of every world file of the project. */
declare function worldLintFindings(root: string): Promise<WorldFinding[]>;
/**
 * The `.feature.mts` files that have no `.world.mts` beside them. `lw qa check` fails each one
 * that has a client route (spec 2.5.1); it decides which ones do.
 */
declare function featuresWithoutWorld(root: string): Promise<string[]>;

/** The undo record, relative to the project root. */
declare const UNDO_FILE = ".lw/qa/fixture.json";
/** One armed fact and its undo steps, in the order `arm` made them. */
interface ArmedFact {
    fact: string;
    persona?: string;
    steps: unknown[];
}
/** The undo record of one QA database. */
interface UndoRecord {
    database: string;
    armed: ArmedFact[];
}
/** The undo record, or an empty one for `database`. */
declare function readUndo(root: string, database: string): Promise<UndoRecord>;
/** Arms `factId` on the QA world, for `persona` when the row names one. Refuses a fact that is armed already. */
declare function armFact(world: QaWorld, registry: WorldRegistry, root: string, factId: string, opts?: {
    persona?: string;
}): Promise<ArmedFact>;
/** Replays every undo step in reverse order, removes each fact from the record when its steps are done, and gives the facts. */
declare function disarmFact(world: QaWorld, registry: WorldRegistry, root: string): Promise<string[]>;

/**
 * The Telegram id of a QA persona: FNV-1a (32 bit) over the persona id, folded into
 * `900_000_000 + hash % 1_000_000`. Inlined from client so the engine needs no client peer.
 */
declare function qaTelegramId(persona: string): number;
/** The identity provider of a persona account. The account id is `qa:<persona>`. */
declare const QA_PROVIDER = "qa";
/** The account id of a persona: `qa:<persona>`. */
declare function qaAccountId(persona: string): string;
/** Every id of a persona. */
declare function personaIds(persona: string): PersonaIds;
/** Why a text cannot be a persona or fact id, or null. Kebab case or dotted, so it survives a URL. */
declare function idProblem(id: string): string | null;

/** A registered job of the queue module, limited to the parts the command reads. */
interface AnyJobDef {
    kind: string;
    handle(payload: unknown, ctx: unknown): Promise<unknown> | unknown;
}
/** The parts of the queue module that the command reads: its process job registry. */
interface JobRegistry {
    registeredJobs(): AnyJobDef[];
    jobOf(kind: string): AnyJobDef | undefined;
    parsePayload(def: AnyJobDef, payload: unknown): unknown;
    /** The context of a handler that runs outside a worker, with no effect ledger. A method, so the
     *  queue module's own factory stays assignable under bivariant parameter checking. */
    standaloneContext(options: {
        id: string;
        kind: string;
        attempts: number;
        maxAttempts: number;
        tenantId: string | null;
        container: unknown;
        log: unknown;
    }): unknown;
}
/** The folder of the project jobs in the default app layout (main spec 2.24.3). */
declare const JOBS_DIR: string;
/** Imports each `<jobsDir>/<name>.job.mts`, so its `job()` call registers it. Gives the files. */
declare function importProjectJobs(root: string, jobsDir?: string): Promise<string[]>;
/** The kinds of every registered job, sorted. */
declare function listJobs(registry: Pick<JobRegistry, 'registeredJobs'>): string[];
/** What `runJob` needs besides the world. */
interface RunJobOptions {
    kind: string;
    payload?: unknown;
    /** The tenant of a tenant job. Default: a system job. */
    tenantId?: string;
    clock: Clock;
}
/** Runs one registered job once on the QA app. Throws `qa.job.unknown` for a kind that no job registers. */
declare function runJob(world: QaWorld, registry: JobRegistry, o: RunJobOptions): Promise<void>;

interface MenuOptions {
    /** Config section `telegram`. */
    telegram: unknown;
    /** The bot of `telegram.bots`. Default: the only bot. */
    bot?: string;
    /** The label of the button. */
    text: string;
    url: string;
    /** The `fetch` of the Bot API client. Tests pass the one of `FakeBotApi`. */
    fetch?: FetchFn;
}
/** Sets the default menu button of the bot to open `url` as a Mini App. Throws `qa.menu.bot`. */
declare function setMenuButton(o: MenuOptions): Promise<void>;

/** The fields of config section `db` that the stack reads. */
interface DbSection {
    driver?: 'pg' | 'pglite';
    url?: string;
    dataDir?: string;
    [key: string]: unknown;
}
/** True for `localhost`, `127.0.0.1` and `::1`, also in brackets. */
declare function isLoopbackHost(host: string): boolean;
/** A database name from free text: lower case letters, digits and `_`, a letter first, 63 characters at most. */
declare function databaseName(text: string): string;
/** The same server, role, password and query, with another database. */
declare function urlWithDatabase(url: string, name: string): string;
/**
 * Why `db` is not the QA database `database` of the project at `root`, or null. Two refusals: a
 * host that is not this machine, and a database whose name is not `database`. The developer's
 * database is on the same server and differs by its name alone.
 */
declare function qaTargetProblem(db: DbSection, database: string, root: string): string | null;
/** Throws `qa.stack.target` unless `db` is the QA database. Called before anything destructive. */
declare function assertQaTarget(db: DbSection, database: string, root: string): void;
/** Section `db` pointed at the QA database: the same server with another name, or a PGlite folder of its own. */
declare function qaDbSection(db: DbSection, database: string, root: string): DbSection;
/** Create, copy, list and drop databases. `allowed` guards each name that a create or drop touches. */
interface DbAdmin {
    exists(name: string): Promise<boolean>;
    /** Creates `name`, empty or as a copy of `template`. A template with open sessions fails with `qa.stack.copy`. */
    create(name: string, template?: string): Promise<void>;
    /** Drops `name` when it exists. It ends the open sessions of its own role first; a session of another role fails the drop after 5 s. */
    drop(name: string): Promise<void>;
    /** The databases whose names start with `prefix`. */
    list(prefix: string): Promise<string[]>;
    close(): Promise<void>;
}
/** The admin of a Postgres server on this machine, through its maintenance database. */
declare function pgAdmin(url: string, allowed: (name: string) => boolean): Promise<DbAdmin>;
/** The admin of the PGlite QA databases: one folder each under `.lw/qa/pglite/`. */
declare function pgliteAdmin(root: string, allowed: (name: string) => boolean): DbAdmin;
/** The admin for section `db`: Postgres through its URL, or the PGlite folders of the project. */
declare function dbAdmin(db: DbSection, root: string, allowed: (name: string) => boolean): Promise<DbAdmin>;

/** The stamp of the last reset, relative to the project root. The `.lw/` folder is not in git. */
declare const STAMP_FILE = ".lw/qa/world.json";
/** What a reset records. `status` compares `hash` with the live registry. */
interface WorldStamp {
    database: string;
    hash: string;
    seededAt: string;
    entries: WorldEntry[];
}
/** The stamp, `null` when no reset ran, or `unreadable` for a file that is not a stamp. */
declare function readStamp(root: string): Promise<WorldStamp | null | 'unreadable'>;
/** The seed names of config `qa.seed`: `[]` for every seed, null without a base seed. Throws `qa.world.seed` for another command. */
declare function baseSeedNames(command: string | undefined): string[] | null;
/** What a reset needs. */
interface ResetOptions {
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
/** Runs the base seed, then each fact and persona seed. A seed that fails names its id and its file. */
declare function seedWorld(world: QaWorld, registry: WorldRegistry, o: Pick<ResetOptions, 'root' | 'seed' | 'out'>): Promise<WorldEntry[]>;
/**
 * Drops, creates and migrates the QA database, seeds it through the QA app, and writes the stamp
 * last. A reset that stops half way leaves no stamp, so `status` calls the world unseeded.
 */
declare function resetWorld(o: ResetOptions): Promise<WorldStamp>;
/** `lw qa world status`. */
interface WorldStatus {
    database: string;
    exists: boolean;
    /** `current`: seeded from this registry. `stale`: from another one. `unseeded`: no readable stamp. `missing`: no database. */
    state: 'missing' | 'unseeded' | 'current' | 'stale';
    registryHash: string;
    stamp: WorldStamp | null;
}
/** Compares the stamp with the live registry and checks that the QA database exists. */
declare function worldStatus(o: {
    root: string;
    sections: Record<string, unknown>;
    database: string;
    registry: WorldRegistry;
    admin?: DbAdmin;
}): Promise<WorldStatus>;

/** The run record of the dev module that the worktree command reads. */
interface RunRecord {
    checkout: string;
    surfaces: Array<{
        name: string;
        url?: string;
    }>;
}

/** The outside effects of a worktree run. Tests replace each one. */
interface WorktreeDeps {
    /** The admin of the Postgres server of `url`, limited to the names that `allowed` accepts. */
    admin(url: string, allowed: (name: string) => boolean): Promise<DbAdmin>;
    /** Applies the migrations of `dir` to the database of `url`. Gives the applied names. */
    migrate(url: string, dir: string): Promise<string[]>;
    /** `lw dev --replace` in the foreground. Gives its exit code. */
    runDev(o: {
        root: string;
        commonDir: string;
        err: (line: string) => void;
    }): Promise<number>;
    /** The live runs of the machine-wide run registry. */
    liveRuns(): Promise<RunRecord[]>;
    /** The run record of this checkout, from its pid file. */
    currentRun(root: string): Promise<RunRecord | null>;
    /** Sets the menu button of the dev bot to a Mini App URL. */
    setMenu(url: string): Promise<void>;
    /** Parses the `KEY=value` lines of an env file. */
    parseEnv(text: string): Record<string, string>;
}
interface WorktreeOptions {
    root: string;
    sections: Record<string, unknown>;
    keepDb?: boolean;
    /** Set the menu button of the dev bot to the tunnel URL of this surface, or of the first surface with one. */
    setMenu?: {
        surface?: string;
    };
    out: (line: string) => void;
    err: (line: string) => void;
    deps: WorktreeDeps;
}
/** The facts of a worktree run, before it changes anything. */
interface WorktreePlan {
    checkout: CheckoutFacts;
    envFile: string;
    mainEnvFile: string;
    /** The URL that names the server, from the env file of the worktree or config `db.url`. */
    baseUrl: string;
    source: string;
    copy: string;
    prefix: string;
}
/** The copy prefix of a project: `<dev.project>_wt_`. */
declare function copyPrefix(sections: Record<string, unknown>, checkout: CheckoutFacts): string;
/** The copy of a checkout: the prefix and the folder name of its top level, 63 characters at most. */
declare function copyName(prefix: string, toplevel: string): string;
/** Checks the checkout and the database, and names the source and the copy. Changes nothing but a missing env file. */
declare function planWorktree(o: Pick<WorktreeOptions, 'root' | 'sections' | 'out' | 'deps'>): Promise<WorktreePlan>;
/** Sets `KEY=value` in env file text: replaces the last line of the key, or appends one. */
declare function setEnvLine(text: string, key: string, value: string): string;
/**
 * Copies the dev database, migrates the copy, points the env file of the worktree at it, runs
 * `lw dev --replace` in the foreground, and on exit restores the env file and drops the copy
 * (unless `keepDb`). Gives the exit code of the run.
 */
declare function runWorktree(o: WorktreeOptions): Promise<number>;
/** `--cleanup`: drops each copy of this project whose worktree has no live `lw dev` run. Gives the dropped names. */
declare function cleanupWorktrees(o: Pick<WorktreeOptions, 'root' | 'sections' | 'out' | 'deps'>): Promise<string[]>;

export { type ArmCtx, type ArmedFact, type CheckoutFacts, type DbAdmin, type DbSection, type Fact, type FactHandles, type FeatureWorld, type FixtureArming, type FixtureArmingOptions, JOBS_DIR, type JobRegistry, type LoadedWorld, type MenuOptions, type Owned, type Persona, type PersonaHandles, type PersonaIds, QA_PROVIDER, QA_TELEGRAM_PORT, type QaAppEntry, type QaFakeBot, type QaHandler, type QaOverlay, type QaWorld, type ResetOptions, type RunJobOptions, STAMP_FILE, ShiftClock, UNDO_FILE, type UndoRecord, WORLD_SUFFIX, type WorktreeDeps, type WorktreeOptions, type WorktreePlan, type WorldCtx, type WorldEntry, type WorldFinding, type WorldRegistry, type WorldStamp, type WorldStatus, armFact, assertQaTarget, assertRegistry, baseSeedNames, buildRegistry, cleanupWorktrees, copyName, copyPrefix, databaseName, dbAdmin, defineWorld, devProjectName, disarmFact, factById, featuresWithoutWorld, fixtureArming, idProblem, importFromProject, importProjectJobs, isLoopbackHost, listJobs, listWorld, loadAppEntry, loadRegistry, loadWorlds, openWorld, parseShift, personaById, personaIds, pgAdmin, pgliteAdmin, planWorktree, qaAccountId, qaDatabase, qaDbSection, qaFakeBots, qaFakeToken, qaSections, qaTargetProblem, qaTelegramId, rawSqlFindings, readCheckout, readStamp, readUndo, registryHash, registryProblem, resetWorld, runJob, runWorktree, seedWorld, setEnvLine, setMenuButton, urlWithDatabase, worldFiles, worldLintFindings, worldStatus };
