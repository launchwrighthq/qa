/** The validated project config, one section per module. */
interface ConfigStore {
    /** The parsed section. Throws LaunchwrightError('kernel.config.missing') for an unknown section. */
    section<T>(name: string): T;
    /** The environment name that createApp received, for example `local` or `production`. */
    readonly env: string | undefined;
    /** The env file that a boot failure names: `.env.<env>`, or `.env`. */
    readonly envFile: string;
}
/** The parts of a process: `web` serves HTTP, `worker` runs queue workers, `all` runs both. */
declare const PROCESS_ROLES: readonly ["all", "web", "worker"];
type ProcessRole = (typeof PROCESS_ROLES)[number];

interface EventDef<T> {
    readonly name: string;
    readonly __type?: T;
}
type EventHandler<T> = (payload: T, c: Container) => void | Promise<void>;
type EventTransport = (name: string, payload: unknown) => Promise<void>;
interface EventBus {
    /** Adds a handler. Returns a function that removes it. */
    on<T>(e: EventDef<T>, h: EventHandler<T>): () => void;
    /**
     * Runs every in-process handler in order, in one new container scope, then
     * forwards the event to the transport when one is set. A failed handler does
     * not stop the others; emit() then throws LaunchwrightError('kernel.event.handler').
     */
    emit<T>(e: EventDef<T>, payload: T): Promise<void>;
    /** Sets the transport that forwards each event out of the process (the queue module's outbox). */
    setTransport(t: EventTransport): void;
}

interface Logger {
    debug(m: string, f?: object): void;
    info(m: string, f?: object): void;
    warn(m: string, f?: object): void;
    error(m: string, f?: object): void;
    child(b: object): Logger;
}

/** A typed container key. No decorators, no reflect-metadata. */
interface Token<T> {
    readonly key: symbol;
    readonly name: string;
    readonly __type?: T;
}

type Factory<T> = (c: Container) => T;
type Lifetime = 'singleton' | 'scoped' | 'transient' | 'instance';
interface Container {
    singleton<T>(t: Token<T>, f: Factory<T>): void;
    /** One instance per createScope(). The root container acts as its own scope. */
    scoped<T>(t: Token<T>, f: Factory<T>): void;
    transient<T>(t: Token<T>, f: Factory<T>): void;
    instance<T>(t: Token<T>, value: T): void;
    /** Throws LaunchwrightError('kernel.unbound') for a token without a binding. */
    get<T>(t: Token<T>): T;
    /** The bound value of `t`, or `fallback` when `t` has no binding. */
    getOr<T, F>(t: Token<T>, fallback: F): T | F;
    has(t: Token<unknown>): boolean;
    createScope(): Container;
    bindings(): Array<{
        token: string;
        lifetime: Lifetime;
        boundBy: string;
    }>;
    /** Calls dispose() on the instances this container built, in reverse creation order. */
    dispose(): Promise<void>;
}

interface HealthResult {
    ok: boolean;
    detail?: string;
}
interface HealthRegistry {
    register(name: string, check: () => Promise<HealthResult>): void;
    /** Runs every check. A check that throws reports `{ ok: false, detail: <message> }`. */
    run(): Promise<Record<string, HealthResult>>;
}

/**
 * `starting` is before the end of `boot()` and while a readiness hold is open. `running` serves
 * traffic. `draining` is the lame-duck window and the drain. `stopped` is after shutdown.
 */
type LifecycleState = 'starting' | 'running' | 'draining' | 'stopped';
/** What a drain hook gets: the end of the drain in epoch milliseconds, and a signal that aborts at that end. */
interface DrainContext {
    readonly deadline: number;
    readonly signal: AbortSignal;
}
type DrainHook = (ctx: DrainContext) => Promise<void>;
/** The lifecycle of an app (spec 2.11.1). A module that holds work, such as a server, adds a drain hook. */
interface Lifecycle {
    readonly state: LifecycleState;
    /** True from the start of the lame-duck window. A health check then fails. */
    readonly draining: boolean;
    /** True while the state is `running`: `boot()` ended and no readiness hold is open. */
    readonly ready: boolean;
    /** Adds a drain hook. It runs after the lame-duck window. Returns a function that removes it. */
    onDrain(name: string, hook: DrainHook): () => void;
    /**
     * Keeps the app `starting` until the returned function runs, for work that boot does not wait
     * for, such as a first config load that retries. A hold can open only while the app is
     * `starting`. Throws `kernel.lifecycle.hold` for a second open hold of one name, or after start.
     */
    hold(name: string): () => void;
    /** The names of the open readiness holds. */
    readonly holds: readonly string[];
    /** Resolves true when the app turns `running`, or false when it drains or stops first. */
    whenReady(): Promise<boolean>;
}

/** A part of the process that `app.runs()` answers for. `jobs` is the scheduled work of a worker. */
type ProcessPart = 'web' | 'worker' | 'jobs';
/** What a boot rule finds: nothing when the config passes, else the refusal with the key it names. */
type BootRuleFinding = {
    key: string;
    reason: string;
} | string | undefined | void;
/** A check across config keys or modules. It reads the app and its config; it starts nothing. */
type BootRuleCheck = (app: App) => BootRuleFinding | Promise<BootRuleFinding>;
interface App extends Container {
    readonly config: ConfigStore;
    readonly events: EventBus;
    readonly log: Logger;
    readonly health: HealthRegistry;
    /** The lifecycle state, the readiness holds and the drain hooks (spec 2.11.1). */
    readonly lifecycle: Lifecycle;
    /** Config `kernel.role`: the parts that this process runs. */
    readonly role: ProcessRole;
    /** Config `kernel.remoteDb`: the process uses a shared database, so it runs no scheduled job. */
    readonly remoteDb: boolean;
    /** True when the environment name is in config `kernel.deployedEnvs`. */
    readonly deployed: boolean;
    /**
     * Whether this process runs `part`. `web`: role `all` or `web`. `worker`: role `all` or `worker`.
     * `jobs`: a worker without `remoteDb`. The scheduler and the interval runner of `queue` read it.
     */
    runs(part: ProcessPart): boolean;
    /**
     * False when a deployed environment refuses driver `driver` of kind `kind`: the name is in
     * `kernel.localDrivers`, `<kind>.<driver>` is not in `kernel.allowLocalDrivers`, and the driver
     * is not a deliberate per-replica cache (`opts.replicaLocal`, from `Driver.allowsReplicaLocal`).
     */
    allowsDriver(kind: string, driver: string, opts?: {
        replicaLocal?: boolean;
    }): boolean;
    /**
     * Adds a boot rule: a check across keys or modules that runs after every `register()` and before
     * the first `boot()`. A finding fails boot with `BootError('kernel.boot.rule')`. A provider calls
     * it in `register()`. Throws `kernel.boot.rule.duplicate` for a second rule of one name.
     */
    bootRule(name: string, check: BootRuleCheck): void;
    /** Runs register() of every provider, then boot() in requires order. A second call returns the first result. */
    boot(): Promise<void>;
    /** Runs shutdown() in reverse boot order, then disposes the singletons. */
    shutdown(): Promise<void>;
    /**
     * Stops the app: the lame-duck window (`kernel.lifecycle.lameDuckMs`, the health check fails), the
     * drain hooks up to `kernel.lifecycle.drainMs`, then `shutdown()`. A second call returns the first result.
     */
    stop(): Promise<void>;
}

export type { App as A, Token as T };
