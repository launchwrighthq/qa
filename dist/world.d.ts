import { D as Db, Q as QaAppEntry, W as WorldRegistry, a as QaWorld, b as QaOverlay, L as ListenQaApp, F as FeatureWorld, O as Owned, c as Fact, d as WorldEntry, P as Persona, e as PersonaIds, R as RunRecord, C as CheckoutFacts } from './api-Ds7LG-Mg.js';
export { A as ArmCtx, f as FactHandles, g as Listening, h as PersonaHandles, i as QA_TELEGRAM_PORT, j as QaDatabaseContext, k as QaFakeBot, l as QaHandler, m as QaPersonaLink, n as WorldCtx, o as devProjectName, p as importFromProject, q as listenQaApp, r as loadAppEntry, s as openWorld, t as qaDatabase, u as qaFakeBots, v as qaFakeToken, w as qaSections, x as readCheckout } from './api-Ds7LG-Mg.js';
import { C as Clock } from './clock-BUdCJ9bN.js';
import { F as FetchFn } from './bot-api-BiC2rPPD.js';
import './app-KXgbRXYO.js';
import './config-Z7lJ4xeJ.js';
import 'zod';

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
/** Opens a connection to a Postgres URL on this machine. `QaAppEntry.connect` gives one. */
type ConnectDb = (url: string) => Promise<Db>;
/** The admin of a Postgres server on this machine, through its maintenance database. */
declare function pgAdmin(url: string, allowed: (name: string) => boolean, connect?: ConnectDb): Promise<DbAdmin>;
/** The admin of the PGlite QA databases: one folder each under `.lw/qa/pglite/`. */
declare function pgliteAdmin(root: string, allowed: (name: string) => boolean): DbAdmin;
/** The admin for section `db`: Postgres through its URL and `connect`, or the PGlite folders of the project. */
declare function dbAdmin(db: DbSection, root: string, allowed: (name: string) => boolean, connect?: ConnectDb): Promise<DbAdmin>;

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
interface FixtureArming$1 {
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
 * safe to call twice.
 */
declare function fixtureArming(opts: FixtureArmingOptions): Promise<FixtureArming$1>;

/** The name of a fork of the QA `database` for `label`: `<database>_fork_<label>`, 63 characters at most. */
declare function forkName(database: string, label: string): string;
/**
 * The snapshot that `lw qa world reset` takes of the seeded QA database: `<database>_fork__seeded`.
 * No label gives this name, because `databaseName` starts a label with a letter. A fork copies the
 * snapshot, so it holds the base seeds, and no session of `lw qa world api` blocks the Postgres copy.
 */
declare function seededName(database: string): string;
/** What a fork create or drop needs. */
interface ForkOptions {
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
declare function createFork(o: ForkOptions & {
    label: string;
}): Promise<string>;
/** Drops a fork of the QA database. Refuses a name that is not a fork of `database`. */
declare function dropFork(o: ForkOptions & {
    name: string;
}): Promise<void>;

/** Arms and disarms fixtures on the QA database (`lw qa fixture`, spec 2.5.3). The world submodule gives it. */
interface FixtureArming {
    /** Applies one state for a persona, after its undo record is written. */
    arm(state: string, opts: {
        persona?: string;
    }): Promise<void>;
    /** Replays every undo record. Safe to call twice. */
    disarm(): Promise<void>;
}
/** The QA app booted on a fork database and served on a loopback port (spec 2.4, R3). */
interface ForkServer {
    /** The origin of the server: `http://127.0.0.1:<port>`. */
    url: string;
    /** Fixture arming bound to the app on the fork, so the group arms its single-instance state there. */
    arming: FixtureArming;
    /** Stops the server and shuts the app down. */
    close(): Promise<void>;
}
/**
 * A per-pass database fork for a row group that needs an isolated single-instance state (spec 2.4,
 * R3). For each `fork` label the runner forks the QA database, serves the QA app on the fork, arms
 * the group's facts in that app, and points the rows at it. After the group it stops the server and
 * drops the fork, also after a failure. The world submodule gives `worldForkRunner`.
 */
interface ForkRunner {
    /** Creates a fork for `label` and gives its database name. */
    create(label: string): Promise<string>;
    /** Drops a fork by its database name. The runner calls it after the group, also after a failure. */
    drop(database: string): Promise<void>;
    /** Boots the QA app on the fork database and serves it on a free loopback port. */
    serve(database: string): Promise<ForkServer>;
}

/** What a fork server needs: the project, the QA app entry and the overlay of the QA database. */
interface ForkWorldOptions {
    root: string;
    /** The project config sections. */
    sections: Record<string, unknown>;
    env: string;
    /** The overlay of the QA database. A fork server keeps it and names the fork database instead. */
    overlay: QaOverlay;
    entry: QaAppEntry;
    registry: WorldRegistry;
    out: (line: string) => void;
    /** Default: `listenQaApp`, the `serveNode` of the http module, else a plain node:http server. */
    listen?: ListenQaApp;
}
/** A fork server with the booted world, so a forged seed writes through the same app. */
interface ForkInstance extends ForkServer {
    database: string;
    world: QaWorld;
}
/**
 * Boots the QA app on the fork `database` and serves it on a free loopback port. Its arming writes
 * the undo record under `.lw/qa/fork/`, apart from the shared record, so two forks arm at the same
 * time. `disarm` replays nothing: the fork drop removes every armed change. `close` stops the
 * server, shuts the app down and removes the undo record.
 */
declare function serveFork(o: ForkWorldOptions, database: string): Promise<ForkInstance>;
/** A fork with the QA app served on it, as `lw qa states forge` uses it. `release` stops the app and drops the fork. */
interface OpenFork extends ForkInstance {
    /** Runs one statement on the fork through `QaAppEntry.db`, else token `DB` of the db module. */
    execute(sql: string): Promise<unknown>;
    release(): Promise<void>;
}
/** Forks the QA database for `label` and serves the QA app on the fork. A failed start drops the fork. */
declare function openFork(o: ForkWorldOptions, label: string): Promise<OpenFork>;
/** The fork runner of `lw qa session run`: fork, serve, drop, on the QA database of `o.overlay`. */
declare function worldForkRunner(o: ForkWorldOptions): ForkRunner;

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
/** The undo record of a fork database, relative to the project root. The fork drop removes it. */
declare function forkUndoFile(database: string): string;
/** The undo record in `file` (default `UNDO_FILE`), or an empty one for `database`. */
declare function readUndo(root: string, database: string, file?: string): Promise<UndoRecord>;
/** Arms `factId` on the QA world, for `persona` when the row names one. Refuses a fact that is armed already. */
declare function armFact(world: QaWorld, registry: WorldRegistry, root: string, factId: string, opts?: {
    persona?: string;
    undoFile?: string;
}): Promise<ArmedFact>;
/** Replays every undo step in reverse order, removes each fact from the record when its steps are done, and gives the facts. */
declare function disarmFact(world: QaWorld, registry: WorldRegistry, root: string, file?: string): Promise<string[]>;

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
/** The seed names that `QaAppEntry.seed` gets from config `qa.seed`: the words after `lw db seed`, else every word. */
declare function hookSeedNames(command: string | undefined): string[];
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
/**
 * Runs the base seed, then each fact and persona seed. A seed that fails names its id and its file.
 * With `entry.seed`, the base seed ran before the boot, so the seed of the db module does not run here.
 */
declare function seedWorld(world: QaWorld, registry: WorldRegistry, o: Pick<ResetOptions, 'root' | 'seed' | 'out'> & {
    entry?: Pick<QaAppEntry, 'seed' | 'linkPersona'>;
}): Promise<WorldEntry[]>;
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
    /** Opens the maintenance connection of a Postgres server. Default: the db module. */
    connect?: ConnectDb;
}): Promise<WorldStatus>;

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

export { type ArmedFact, CheckoutFacts, type ConnectDb, type DbAdmin, type DbSection, Fact, FeatureWorld, type FixtureArming$1 as FixtureArming, type FixtureArmingOptions, type ForkInstance, type ForkWorldOptions, JOBS_DIR, type JobRegistry, ListenQaApp, type LoadedWorld, type MenuOptions, type OpenFork, Owned, Persona, PersonaIds, QA_PROVIDER, QaAppEntry, QaOverlay, QaWorld, type ResetOptions, type RunJobOptions, STAMP_FILE, ShiftClock, UNDO_FILE, type UndoRecord, WORLD_SUFFIX, type WorktreeDeps, type WorktreeOptions, type WorktreePlan, WorldEntry, type WorldFinding, WorldRegistry, type WorldStamp, type WorldStatus, armFact, assertQaTarget, assertRegistry, baseSeedNames, buildRegistry, cleanupWorktrees, copyName, copyPrefix, createFork, databaseName, dbAdmin, defineWorld, disarmFact, dropFork, factById, featuresWithoutWorld, fixtureArming, forkName, forkUndoFile, hookSeedNames, idProblem, importProjectJobs, isLoopbackHost, listJobs, listWorld, loadRegistry, loadWorlds, openFork, parseShift, personaById, personaIds, pgAdmin, pgliteAdmin, planWorktree, qaAccountId, qaDbSection, qaTargetProblem, qaTelegramId, rawSqlFindings, readStamp, readUndo, registryHash, registryProblem, resetWorld, runJob, runWorktree, seedWorld, seededName, serveFork, setEnvLine, setMenuButton, urlWithDatabase, worldFiles, worldForkRunner, worldLintFindings, worldStatus };
