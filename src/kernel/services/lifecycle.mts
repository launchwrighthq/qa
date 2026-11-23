import type { Clock } from './clock.mts';
import { LaunchwrightError, messageOf } from './errors.mts';
import type { Logger } from './logger.mts';

/**
 * `starting` is before the end of `boot()` and while a readiness hold is open. `running` serves
 * traffic. `draining` is the lame-duck window and the drain. `stopped` is after shutdown.
 */
export type LifecycleState = 'starting' | 'running' | 'draining' | 'stopped';

/** What a drain hook gets: the end of the drain in epoch milliseconds, and a signal that aborts at that end. */
export interface DrainContext {
  readonly deadline: number;
  readonly signal: AbortSignal;
}

export type DrainHook = (ctx: DrainContext) => Promise<void>;

/** The lifecycle of an app (spec 2.11.1). A module that holds work, such as a server, adds a drain hook. */
export interface Lifecycle {
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

/** The times of `app.stop()`, from config section `lifecycle`. */
export interface DrainTimes {
  /** The time in which the health check fails while the app still serves, so a load balancer moves traffic away. */
  lameDuckMs: number;
  /** The longest time for the drain hooks after the lame-duck window. */
  drainMs: number;
}

/** The lifecycle that `KernelApp` holds. `drain` runs the lame-duck window and the drain hooks. */
export class KernelLifecycle implements Lifecycle {
  private current: LifecycleState = 'starting';
  private readonly hooks = new Map<string, DrainHook>();
  private readonly open = new Set<string>();
  private booted = false;
  private readonly waiters: Array<(ready: boolean) => void> = [];

  get state(): LifecycleState {
    return this.current;
  }

  /** Sets the state. Leaving `starting` settles every `whenReady()`. */
  set state(next: LifecycleState) {
    this.current = next;
    if (next === 'starting') return;
    for (const resolve of this.waiters.splice(0)) resolve(next === 'running');
  }

  get draining(): boolean {
    return this.current === 'draining';
  }

  get ready(): boolean {
    return this.current === 'running';
  }

  get holds(): readonly string[] {
    return [...this.open];
  }

  hold(name: string): () => void {
    if (this.current !== 'starting') {
      throw new LaunchwrightError('kernel.lifecycle.hold', `Readiness hold "${name}" cannot open: the app is ${this.current}.`, { context: { hold: name, state: this.current } });
    }
    if (this.open.has(name)) throw new LaunchwrightError('kernel.lifecycle.hold', `A readiness hold named "${name}" is open.`, { context: { hold: name } });
    this.open.add(name);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.open.delete(name);
      this.settle();
    };
  }

  whenReady(): Promise<boolean> {
    if (this.current !== 'starting') return Promise.resolve(this.current === 'running');
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** The end of `boot()`. The app turns `running` when no hold is open. */
  markBooted(): void {
    this.booted = true;
    this.settle();
  }

  private settle(): void {
    if (this.current === 'starting' && this.booted && this.open.size === 0) this.state = 'running';
  }

  onDrain(name: string, hook: DrainHook): () => void {
    if (this.hooks.has(name)) throw new LaunchwrightError('kernel.lifecycle.duplicate', `A drain hook named "${name}" exists.`, { context: { hook: name } });
    this.hooks.set(name, hook);
    return () => {
      if (this.hooks.get(name) === hook) this.hooks.delete(name);
    };
  }

  /**
   * Sets `draining`, waits `lameDuckMs`, then runs every drain hook at once up to `drainMs`. A hook
   * that is still open at the deadline gets an aborted signal and one log line; the drain then ends.
   * Throws `kernel.drain` with every hook error after all hooks end or the deadline passes. The
   * waits and the deadline read `clock`.
   */
  async drain(times: DrainTimes, log: Logger, clock: Clock): Promise<void> {
    this.state = 'draining';
    log.info('kernel.drain.start', { lameDuckMs: times.lameDuckMs, drainMs: times.drainMs, hooks: [...this.hooks.keys()] });
    await clock.sleep(times.lameDuckMs);
    const deadline = clock.now() + times.drainMs;
    const abort = new AbortController();
    const open = new Set(this.hooks.keys());
    const errors: unknown[] = [];
    const runs = [...this.hooks].map(async ([name, hook]) => {
      try {
        await hook({ deadline, signal: abort.signal });
      } catch (err) {
        errors.push(new LaunchwrightError('kernel.drain', `Drain hook "${name}" failed: ${messageOf(err)}`, { cause: err, context: { hook: name } }));
      } finally {
        open.delete(name);
      }
    });
    const timer = new AbortController();
    const late = clock.sleep(times.drainMs, timer.signal).then(
      () => 'late' as const,
      () => 'done' as const,
    );
    const outcome = await Promise.race([Promise.all(runs).then(() => 'done' as const), late]);
    timer.abort();
    if (outcome === 'late') {
      abort.abort(new LaunchwrightError('kernel.drain.deadline', `The drain passed its deadline of ${times.drainMs} ms.`));
      log.warn('kernel.drain.deadline', { drainMs: times.drainMs, open: [...open] });
    }
    log.info('kernel.drain.end', { open: [...open], errors: errors.length });
    if (errors.length > 0) {
      throw new LaunchwrightError('kernel.drain', `Drain failed: ${errors.map(messageOf).join('; ')}`, {
        cause: errors.length === 1 ? errors[0] : new AggregateError(errors),
      });
    }
  }
}

/** The part of `process` that `stopOnSignals` uses. Tests pass an `EventEmitter`. */
export interface SignalSource {
  on(signal: string, fn: () => void): unknown;
  off(signal: string, fn: () => void): unknown;
}

export interface StopOnSignalsOptions {
  /** Default: `SIGTERM` and `SIGINT`. */
  signals?: readonly string[];
  /** Default: `process`. */
  source?: SignalSource;
  /** Ends the process. Default: `process.exit`. It gets 0 after a clean stop, else 1. */
  exit?: (code: number) => void;
}

/**
 * On the first signal, runs `app.stop()` (lame duck, drain, shutdown), then exits with 0, or with 1
 * after a stop error. A second signal exits with 1 at once. Returns a function that removes the listeners.
 */
export function stopOnSignals(app: { stop(): Promise<void>; readonly log: Logger }, opts: StopOnSignalsOptions = {}): () => void {
  const source = opts.source ?? process;
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  const signals = opts.signals ?? ['SIGTERM', 'SIGINT'];
  let stopping = false;
  const listeners = signals.map((signal) => {
    const fn = (): void => {
      if (stopping) {
        app.log.warn('kernel.signal.again', { signal });
        exit(1);
        return;
      }
      stopping = true;
      app.log.info('kernel.signal', { signal });
      app.stop().then(
        () => exit(0),
        (err: unknown) => {
          app.log.error('kernel.stop.failed', { error: messageOf(err) });
          exit(1);
        },
      );
    };
    return { signal, fn };
  });
  for (const l of listeners) source.on(l.signal, l.fn);
  return () => {
    for (const l of listeners) source.off(l.signal, l.fn);
  };
}
