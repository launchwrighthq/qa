import type { Container } from './container.mts';
import type { Driver } from './driver.mts';
import { bootError, LaunchwrightError, messageOf } from './errors.mts';
import { APP, CONFIG } from '../tokens.mts';

export type DriverFactory<D> = (cfg: Record<string, unknown>, c: Container) => D;

export interface ManagerConfig {
  /** The driver that driver() returns without a name. */
  default: string;
  /** The config of each driver, by driver name. */
  drivers: Record<string, Record<string, unknown>>;
}

/** The key inside a driver config that an error names: from a zod error or from `context.key`. */
function keyOf(err: unknown): string | undefined {
  for (let e: unknown = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    if (e instanceof LaunchwrightError && typeof e.context.key === 'string') return e.context.key;
    const issues = (e as { issues?: Array<{ path?: PropertyKey[] }> }).issues;
    if (Array.isArray(issues) && issues[0]?.path) return issues[0].path.map(String).join('.');
  }
  return undefined;
}

/**
 * A set of replaceable drivers of one kind (spec 2.3, 2.5).
 * A subclass names the kind and the built-in driver factories. A project adds more with extend().
 * A driver entry with the key `driver` uses the factory of that driver, so
 * `drivers.media = { driver: 's3', ... }` is a second s3 driver. The factory does not get the key.
 */
export abstract class Manager<D extends Driver> {
  /** The driver kind and config section, for example `mail`. */
  protected abstract readonly kind: string;
  protected abstract readonly drivers: Record<string, DriverFactory<D>>;
  /** Capabilities that every configured driver must support. checkDrivers() enforces them. */
  protected readonly requiredCapabilities: string[] = [];

  private readonly built = new Map<string, D>();
  private readonly extensions = new Map<string, DriverFactory<D>>();

  constructor(
    protected readonly config: ManagerConfig,
    protected readonly container: Container,
  ) {}

  /**
   * The named driver, or the default driver. Built once per name.
   * Throws LaunchwrightError('kernel.driver.unknown') for a name without a factory.
   */
  driver(name?: string): D {
    const n = name ?? this.config.default;
    const cached = this.built.get(n);
    if (cached) return cached;
    const d = this.construct(n, this.config.drivers?.[n] ?? {});
    this.built.set(n, d);
    return d;
  }

  /**
   * A new driver from the configured settings of `name` with `overrides` on top (top-level keys).
   * The manager does not cache or close it: the caller owns it. driver(name) is unaffected.
   * Throws `kernel.driver.unknown` like driver(), and `kernel.driver.build` when the factory
   * refuses the merged settings.
   */
  build(name: string, overrides: Record<string, unknown> = {}): D {
    return this.construct(name, { ...(this.config.drivers?.[name] ?? {}), ...overrides });
  }

  /** Adds or replaces a driver factory. A built driver of that name is dropped. */
  extend(name: string, f: DriverFactory<D>): this {
    this.extensions.set(name, f);
    this.built.delete(name);
    return this;
  }

  /**
   * Builds the default driver and every driver in the config, and checks requiredCapabilities.
   * In a deployed environment (`app.deployed`), refuses a local driver such as `fake` or `log`
   * with `kernel.driver.local` (see `app.allowsDriver`). A driver with `allowsReplicaLocal` passes. publish-audit: allow
   * Throws BootError that names the module, the key and the env file.
   */
  checkDrivers(): void {
    const envFile = this.container.has(CONFIG) ? this.container.get(CONFIG).envFile : '.env';
    const app = this.container.has(APP) ? this.container.get(APP) : undefined;
    const names = [...new Set([this.config.default, ...Object.keys(this.config.drivers ?? {})])];
    for (const n of names) {
      const isDefault = n === this.config.default;
      const where = `${this.kind}.drivers.${n}`;
      const source = this.factoryName(n);
      if (!this.factoryOf(source)) {
        throw bootError('kernel.driver.unknown', {
          module: this.kind,
          key: isDefault ? `${this.kind}.default` : where,
          envFile,
          reason: `names driver "${source}", which is not known (known: ${this.known().join(', ') || 'none'})`,
        });
      }
      let d: D;
      try {
        d = this.driver(n);
      } catch (err) {
        const key = keyOf(err);
        throw bootError(
          'kernel.driver.config',
          {
            module: this.kind,
            key: key ? `${where}.${key}` : where,
            envFile,
            reason: `is missing or invalid for driver "${n}" (${messageOf(err)})`,
          },
          { cause: err },
        );
      }
      if (app !== undefined && !app.allowsDriver(this.kind, source, { replicaLocal: d.allowsReplicaLocal === true })) {
        throw bootError('kernel.driver.local', { // publish-audit: allow
          module: this.kind,
          key: isDefault ? `${this.kind}.default` : where,
          envFile,
          reason: `selects driver "${source}", which is for local and test runs only, in the deployed environment "${app.config.env ?? ''}". Choose a real driver, or add "${this.kind}.${source}" to kernel.allowLocalDrivers`,
        });
      }
      const missing = this.requiredCapabilities.filter((cap) => !d.supports(cap));
      if (missing.length > 0) {
        throw bootError('kernel.driver.capability', {
          module: this.kind,
          key: isDefault ? `${this.kind}.default` : where,
          envFile,
          reason: `selects driver "${n}", which lacks the capabilities ${missing.map((c) => `"${c}"`).join(', ')}`,
        });
      }
    }
  }

  /** The factory that driver entry `name` uses: its `driver` key, else `name`. */
  factoryName(name: string): string {
    const chosen = this.config.drivers?.[name]?.driver;
    return typeof chosen === 'string' ? chosen : name;
  }

  private construct(n: string, merged: Record<string, unknown>): D {
    const { driver: chosen, ...cfg } = merged;
    const source = typeof chosen === 'string' ? chosen : n;
    const factory = this.factoryOf(source);
    if (!factory) {
      throw new LaunchwrightError(
        'kernel.driver.unknown',
        `Unknown ${this.kind} driver "${source}". Known drivers: ${this.known().join(', ') || 'none'}.`,
        { context: { kind: this.kind, driver: source } },
      );
    }
    try {
      return factory(cfg, this.container);
    } catch (err) {
      if (err instanceof LaunchwrightError) throw err;
      const key = keyOf(err);
      throw new LaunchwrightError('kernel.driver.build', `Cannot build ${this.kind} driver "${n}": ${messageOf(err)}`, {
        cause: err,
        context: { kind: this.kind, driver: n, ...(key ? { key } : {}) },
      });
    }
  }

  private factoryOf(name: string): DriverFactory<D> | undefined {
    return this.extensions.get(name) ?? (Object.hasOwn(this.drivers, name) ? this.drivers[name] : undefined);
  }

  private known(): string[] {
    return [...new Set([...Object.keys(this.drivers), ...this.extensions.keys()])];
  }
}
