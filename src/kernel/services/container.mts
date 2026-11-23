import { LaunchwrightError, messageOf } from './errors.mts';
import type { Token } from '../tokens.mts';

export type Factory<T> = (c: Container) => T;
export type Lifetime = 'singleton' | 'scoped' | 'transient' | 'instance';

export interface Container {
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
  bindings(): Array<{ token: string; lifetime: Lifetime; boundBy: string }>;
  /** Calls dispose() on the instances this container built, in reverse creation order. */
  dispose(): Promise<void>;
}

interface Binding {
  readonly token: Token<unknown>;
  readonly lifetime: Lifetime;
  readonly factory?: Factory<unknown>;
  readonly value?: unknown;
  readonly boundBy: string;
  readonly owner: KernelContainer;
}

/** The bindings that are being resolved now. get() is synchronous, so one stack is enough. */
const resolving: Binding[] = [];

function hasDispose(v: unknown): v is { dispose(): unknown } {
  return typeof v === 'object' && v !== null && typeof (v as { dispose?: unknown }).dispose === 'function';
}

export class KernelContainer implements Container {
  /** The name that bindings() reports as `boundBy`. createApp sets it to the provider that registers. */
  protected binder = 'app';
  private readonly own = new Map<symbol, Binding>();
  private readonly cache = new Map<Binding, unknown>();
  private readonly created: unknown[] = [];
  private readonly root: KernelContainer;

  constructor(private readonly parent?: KernelContainer) {
    this.root = parent ? parent.root : this;
  }

  singleton<T>(t: Token<T>, f: Factory<T>): void {
    this.bind(t, 'singleton', { factory: f as Factory<unknown> });
  }

  scoped<T>(t: Token<T>, f: Factory<T>): void {
    this.bind(t, 'scoped', { factory: f as Factory<unknown> });
  }

  transient<T>(t: Token<T>, f: Factory<T>): void {
    this.bind(t, 'transient', { factory: f as Factory<unknown> });
  }

  instance<T>(t: Token<T>, value: T): void {
    this.bind(t, 'instance', { value });
  }

  has(t: Token<unknown>): boolean {
    return this.lookup(t.key) !== undefined;
  }

  get<T>(t: Token<T>): T {
    const b = this.lookup(t.key);
    if (!b) {
      throw new LaunchwrightError('kernel.unbound', `No binding for token "${t.name}". Bind it in a provider's register().`, {
        context: { token: t.name },
      });
    }
    switch (b.lifetime) {
      case 'instance':
        return b.value as T;
      case 'singleton':
        return b.owner.build(b) as T;
      case 'scoped':
        return this.build(b) as T;
      case 'transient':
        return this.run(b) as T;
    }
  }

  getOr<T, F>(t: Token<T>, fallback: F): T | F {
    return this.has(t) ? this.get(t) : fallback;
  }

  createScope(): Container {
    return new KernelContainer(this);
  }

  bindings(): Array<{ token: string; lifetime: Lifetime; boundBy: string }> {
    const chain: KernelContainer[] = [this];
    for (let c = this.parent; c; c = c.parent) chain.unshift(c);
    const merged = new Map<symbol, Binding>();
    for (const c of chain) {
      for (const [key, b] of c.own) {
        merged.delete(key);
        merged.set(key, b);
      }
    }
    return [...merged.values()].map((b) => ({ token: b.token.name, lifetime: b.lifetime, boundBy: b.boundBy }));
  }

  async dispose(): Promise<void> {
    const items = this.created.splice(0).reverse();
    this.cache.clear();
    const errors: unknown[] = [];
    for (const item of items) {
      if (!hasDispose(item)) continue;
      try {
        await item.dispose();
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length > 0) {
      throw new LaunchwrightError('kernel.dispose', `${errors.length} instance(s) failed to dispose: ${errors.map(messageOf).join('; ')}`, {
        cause: errors.length === 1 ? errors[0] : new AggregateError(errors),
      });
    }
  }

  private bind(t: Token<unknown>, lifetime: Lifetime, rest: { factory?: Factory<unknown>; value?: unknown }): void {
    this.own.delete(t.key);
    this.own.set(t.key, { token: t, lifetime, ...rest, boundBy: this.root.binder, owner: this });
  }

  private lookup(key: symbol): Binding | undefined {
    return this.own.get(key) ?? this.parent?.lookup(key);
  }

  /** Builds a binding once per container and keeps the instance for dispose(). */
  private build(b: Binding): unknown {
    if (this.cache.has(b)) return this.cache.get(b);
    const value = this.run(b);
    this.cache.set(b, value);
    this.created.push(value);
    return value;
  }

  private run(b: Binding): unknown {
    if (resolving.includes(b)) {
      const chain = [...resolving.slice(resolving.indexOf(b)), b].map((x) => x.token.name).join(' -> ');
      throw new LaunchwrightError('kernel.cycle', `Circular dependency: ${chain}`, { context: { chain } });
    }
    resolving.push(b);
    try {
      return (b.factory as Factory<unknown>)(this);
    } catch (err) {
      if (err instanceof LaunchwrightError) throw err;
      throw new LaunchwrightError('kernel.resolve', `Cannot build "${b.token.name}": ${messageOf(err)}`, {
        cause: err,
        context: { token: b.token.name },
      });
    } finally {
      resolving.pop();
    }
  }
}

/** A bare container, for tests and for code that needs no providers. */
export function createContainer(): Container {
  return new KernelContainer();
}
