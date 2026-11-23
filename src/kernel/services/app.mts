import { closeOverRequires, processModules, resolveApp, type ResolvedApp, sectionApps } from './apps.mts';
import { systemClock } from './clock.mts';
import { createConfigStore, type ConfigStore, type KernelConfig, kernelConfig, type ProcessRole } from '../config.mts';
import { type Container, KernelContainer } from './container.mts';
import { BootError, LaunchwrightError, messageOf } from './errors.mts';
import { createEventBus, type EventBus } from '../events.mts';
import { createHealthRegistry, type HealthRegistry } from './health.mts';
import { KernelLifecycle, type Lifecycle } from './lifecycle.mts';
import { jsonLogger, type Logger } from './logger.mts';
import { orderByRequires } from './order.mts';
import type { ProjectConfig } from './project.mts';
import { kernelProvider, type Provider } from '../provider.mts';
import { devStamp, type Stamp, stampConfig } from './stamp.mts';
import { APP, CLOCK, CONFIG, EVENTS, LOGGER, type Token } from '../tokens.mts';

/** A part of the process that `app.runs()` answers for. `jobs` is the scheduled work of a worker. */
export type ProcessPart = 'web' | 'worker' | 'jobs';

/** What a boot rule finds: nothing when the config passes, else the refusal with the key it names. */
export type BootRuleFinding = { key: string; reason: string } | string | undefined | void;

/** A check across config keys or modules. It reads the app and its config; it starts nothing. */
export type BootRuleCheck = (app: App) => BootRuleFinding | Promise<BootRuleFinding>;

export interface App extends Container {
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
  allowsDriver(kind: string, driver: string, opts?: { replicaLocal?: boolean }): boolean;
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

export interface CreateAppOptions {
  providers: Provider[];
  /** The project config, one entry per config section. Without section `stamp`, the app gets `devStamp()`. */
  config: Record<string, unknown>;
  /** The environment name, for example `local` or `production`. Boot errors name `.env.<env>`. */
  env?: string;
  /** Default: `jsonLogger` with `release` of section `stamp` on every line. A given logger is used as it is. */
  logger?: Logger;
  /**
   * The app of `project.apps` that this process runs (first-consumer spec 2.2.2), as `<app>` or
   * `<app>.<process>`. The app starts only the modules it lists, or that the process lists, and
   * each module that one of them requires: a provider of another project module is left out, and
   * a token of that module raises `kernel.module.not_in_app`. Each started module needs a passed
   * provider, else `kernel.module.not_in_app`. Needs `project`.
   */
  app?: string;
  /** The parsed project config. `app` reads its `modules` and `apps`. */
  project?: ProjectConfig;
}

class KernelApp extends KernelContainer implements App {
  readonly events: EventBus;
  readonly health: HealthRegistry = createHealthRegistry();
  readonly lifecycle = new KernelLifecycle();
  private stopping: Promise<void> | undefined;
  private booting: Promise<void> | undefined;
  private readonly booted: Provider[] = [];
  private readonly rules = new Map<string, { module: string; check: BootRuleCheck }>();

  constructor(
    private readonly providers: Provider[],
    readonly config: ConfigStore,
    readonly log: Logger,
    private readonly outside: AppScope = { app: '', started: [], modules: new Set() },
  ) {
    super();
    this.events = createEventBus(this);
    this.binder = 'kernel';
    this.instance(APP, this as App);
    this.instance(CONFIG, config);
    this.instance(LOGGER, log);
    this.instance(EVENTS, this.events);
    this.instance(CLOCK, systemClock);
    this.binder = 'app';
  }

  override get<T>(t: Token<T>): T {
    const owner = t.name.split('.')[0] as string;
    if (this.outside.modules.has(owner) && !this.has(t)) {
      const { app } = this.outside;
      throw new LaunchwrightError('kernel.module.not_in_app', `Module "${owner}" is not in app "${app}", so token "${t.name}" is not wired. Add "${owner}" to apps.${app}.modules.`, {
        context: { app, module: owner, token: t.name },
      });
    }
    return super.get(t);
  }

  boot(): Promise<void> {
    this.booting ??= this.start();
    return this.booting;
  }

  stop(): Promise<void> {
    this.stopping ??= this.runStop();
    return this.stopping;
  }

  private async runStop(): Promise<void> {
    let drainError: unknown;
    try {
      await this.lifecycle.drain(this.kernelConfig().lifecycle, this.log, this.get(CLOCK));
    } catch (err) {
      drainError = err;
    }
    await this.shutdown();
    if (drainError !== undefined) throw drainError;
  }

  get role(): ProcessRole {
    return this.kernelConfig().role;
  }

  get remoteDb(): boolean {
    return this.kernelConfig().remoteDb;
  }

  get deployed(): boolean {
    const env = this.config.env;
    return env !== undefined && this.kernelConfig().deployedEnvs.includes(env);
  }

  runs(part: ProcessPart): boolean {
    const role = this.role;
    if (part === 'web') return role !== 'worker';
    const worker = role !== 'web';
    return part === 'worker' ? worker : worker && !this.remoteDb;
  }

  allowsDriver(kind: string, driver: string, opts: { replicaLocal?: boolean } = {}): boolean {
    if (!this.deployed || opts.replicaLocal === true) return true;
    const cfg = this.kernelConfig();
    return !cfg.localDrivers.includes(driver) || cfg.allowLocalDrivers.includes(`${kind}.${driver}`);
  }

  bootRule(name: string, check: BootRuleCheck): void {
    if (this.rules.has(name)) {
      throw new LaunchwrightError('kernel.boot.rule.duplicate', `A boot rule named "${name}" exists. Give each rule its own name.`, { context: { rule: name } });
    }
    this.rules.set(name, { module: this.binder, check });
  }

  /** Runs every boot rule. The first finding throws `BootError('kernel.boot.rule')`. */
  private async checkRules(): Promise<void> {
    const envFile = this.config.envFile;
    for (const [name, rule] of this.rules) {
      let finding: BootRuleFinding;
      try {
        finding = await rule.check(this);
      } catch (err) {
        throw new BootError('kernel.boot.rule', `Boot failed in module "${rule.module}": boot rule "${name}" threw: ${messageOf(err)}. Check ${envFile}.`, {
          cause: err,
          context: { module: rule.module, rule: name, envFile },
        });
      }
      if (finding === undefined) continue;
      const { key, reason } = typeof finding === 'string' ? { key: undefined, reason: finding } : finding;
      const where = key === undefined ? '' : `key "${key}" `;
      throw new BootError('kernel.boot.rule', `Boot failed in module "${rule.module}": boot rule "${name}" refuses the config: ${where}${reason}. Check ${envFile}.`, {
        context: { module: rule.module, rule: name, envFile, ...(key === undefined ? {} : { key }) },
      });
    }
  }

  /** Config section `kernel`, or its defaults when a project passes its own `kernel` provider. */
  private kernelConfig(): KernelConfig {
    try {
      return this.config.section<KernelConfig>('kernel');
    } catch (err) {
      if (err instanceof LaunchwrightError && err.code === 'kernel.config.missing') return kernelConfig.parse({});
      throw err;
    }
  }

  async shutdown(): Promise<void> {
    this.lifecycle.state = 'stopped';
    const errors: unknown[] = [];
    for (const p of this.booted.splice(0).reverse()) {
      if (!p.shutdown) continue;
      try {
        await p.shutdown(this);
      } catch (err) {
        errors.push(new LaunchwrightError('kernel.shutdown', `Module "${p.name}" failed to shut down: ${messageOf(err)}`, { cause: err }));
      }
    }
    try {
      await this.dispose();
    } catch (err) {
      errors.push(err);
    }
    if (errors.length > 0) {
      throw new LaunchwrightError('kernel.shutdown', `Shutdown failed: ${errors.map(messageOf).join('; ')}`, {
        cause: errors.length === 1 ? errors[0] : new AggregateError(errors),
      });
    }
  }

  private async start(): Promise<void> {
    for (const p of this.providers) {
      this.binder = p.name;
      try {
        p.register(this);
      } catch (err) {
        throw this.failure(p, 'register', err);
      } finally {
        this.binder = 'app';
      }
    }
    await this.checkRules();
    for (const p of this.providers) {
      try {
        await p.boot?.(this);
      } catch (err) {
        throw this.failure(p, 'boot', err);
      }
      this.booted.push(p);
    }
    this.lifecycle.markBooted();
  }

  private failure(p: Provider, phase: 'register' | 'boot', err: unknown): BootError {
    if (err instanceof BootError) return err;
    const context = err instanceof LaunchwrightError ? err.context : {};
    return new BootError('kernel.boot', `Boot failed in module "${p.name}" during ${phase}: ${messageOf(err)}. Check ${this.config.envFile}.`, {
      cause: err,
      context: { ...context, module: p.name, phase, envFile: this.config.envFile },
    });
  }
}

/**
 * Builds an app: orders the providers by `requires` and validates every config section.
 * Throws BootError for a missing or duplicate provider, a provider cycle, or a bad config key.
 * Call boot() next.
 */
export function createApp(opts: CreateAppOptions): App {
  const outside = appScope(opts);
  const passed = new Set(opts.providers.map((p) => p.name));
  const absent = outside.started.find((m) => m !== 'kernel' && !passed.has(m));
  if (absent !== undefined) {
    throw new BootError('kernel.module.not_in_app', `App "${outside.app}" starts module "${absent}", but createApp got no provider of it. Pass its provider, or remove "${absent}" from apps.${outside.app}.modules.`, {
      context: { app: outside.app, module: absent },
    });
  }
  const given = opts.providers.filter((p) => !outside.modules.has(p.name));
  const list = given.some((p) => p.name === 'kernel') ? given : [kernelProvider, ...given];
  const seen = new Set<string>();
  for (const p of list) {
    if (seen.has(p.name)) {
      throw new BootError('kernel.provider.duplicate', `Two providers have the name "${p.name}". Pass each provider once.`, {
        context: { module: p.name },
      });
    }
    seen.add(p.name);
  }
  const ordered = orderByRequires(
    list,
    (p) => p.name,
    (p) => p.requires ?? [],
    (problem) =>
      problem.kind === 'missing' && outside.modules.has(problem.missing)
        ? new BootError(
            'kernel.module.not_in_app',
            `Module "${problem.item}" requires module "${problem.missing}", which app "${outside.app}" does not list. Add "${problem.missing}" to apps.${outside.app}.modules.`,
            { context: { app: outside.app, module: problem.item, missing: problem.missing } },
          )
        : problem.kind === 'missing'
        ? new BootError(
            'kernel.provider.missing',
            `Module "${problem.item}" requires provider "${problem.missing}", which is not in the provider list. Add the "${problem.missing}" module to the project.`,
            { context: { module: problem.item, missing: problem.missing } },
          )
        : new BootError('kernel.provider.cycle', `Provider cycle: ${problem.chain.join(' -> ')}`, {
            context: { chain: problem.chain },
          }),
  );
  const sections = ordered.flatMap((p) => (p.config ? [{ module: p.name, section: p.config.section, schema: p.config.schema }] : []));
  sections.push({ module: 'kernel', section: 'stamp', schema: stampConfig });
  const config = createConfigStore({ ...opts.config, stamp: opts.config.stamp ?? devStamp() }, sections, opts.env);
  const { release } = config.section<Stamp>('stamp');
  return new KernelApp(ordered, config, opts.logger ?? jsonLogger({ bindings: { release } }), outside);
}

/** The app of a process, the modules it starts and the project modules it leaves out. */
interface AppScope {
  app: string;
  started: string[];
  modules: Set<string>;
}

/**
 * The app `name`: from section `apps` of the config when `projectSections` filled it, which knows
 * the packages of each runtime, else from the project config.
 */
function selectApp(opts: CreateAppOptions & { project: ProjectConfig }, name: string): ResolvedApp {
  if (!Array.isArray(opts.config.apps)) return resolveApp(opts.project, name);
  const apps = sectionApps(opts.config);
  const app = apps.find((a) => a.name === name);
  if (app === undefined) throw new LaunchwrightError('kernel.apps.unknown', `The project has no app "${name}". Apps: ${apps.map((a) => a.name).join(', ')}.`, { context: { app: name } });
  return app;
}

/**
 * The modules that `opts.app` starts, closed over the `requires` of their providers, and the
 * project modules it leaves out. None without `opts.app`.
 */
function appScope(opts: CreateAppOptions): AppScope {
  if (opts.app === undefined) return { app: '', started: [], modules: new Set() };
  if (opts.project === undefined) {
    throw new BootError('kernel.apps.project', `createApp got app "${opts.app}" without the project config. Pass project: parseProjectConfig(config).`, { context: { app: opts.app } });
  }
  const [name = opts.app, process] = opts.app.split('.');
  const app = selectApp({ ...opts, project: opts.project }, name);
  if (process !== undefined && !app.processes.some((p) => p.name === process)) {
    throw new LaunchwrightError('kernel.apps.unknown', `App "${name}" has no process "${process}".`, { context: { app: name, process } });
  }
  const installed = new Set(Object.keys(opts.project.modules));
  const requires = new Map(opts.providers.map((p) => [p.name, p.requires ?? []]));
  const { modules: started } = closeOverRequires(processModules(app, process), (m) => requires.get(m) ?? [], (m) => installed.has(m));
  return { app: name, started, modules: new Set([...installed].filter((m) => !started.includes(m))) };
}
