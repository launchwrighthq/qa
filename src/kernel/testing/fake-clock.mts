import { setImmediate as realImmediate } from 'node:timers';
import type { Clock } from '../services/clock.mts';
import { LaunchwrightError } from '../services/errors.mts';

/** A clock that moves only when a test moves it (spec 2.9.4). Bind it with `app.instance(CLOCK, clock)`. */
export interface FakeClock extends Clock {
  /** Moves the clock forward and resolves each sleep whose deadline it passes, in deadline order. */
  advance(ms: number): Promise<void>;
  /** Sets the time. It resolves no sleep; call `runDue()` for that. */
  set(iso: string): void;
  /** Resolves each sleep whose deadline is not after the current time. */
  runDue(): Promise<void>;
}

interface Sleeper {
  deadline: number;
  seq: number;
  resolve: () => void;
}

/** The fake clocks of the running test file. The DOM setup steps them in `waitFor`. */
export const liveClocks = new Set<FakeClock>();

function parse(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new LaunchwrightError('testing.clock', `"${iso}" is not an ISO date. Pass a value such as 2026-01-01T00:00:00Z.`);
  return ms;
}

/** Lets every pending promise continuation run, so a resolved sleep can start the next one. */
function settle(): Promise<void> {
  return new Promise((resolve) => realImmediate(resolve));
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The sleep was aborted', 'AbortError');
}

export function fakeClock(start = '2026-01-01T00:00:00Z'): FakeClock {
  let now = parse(start);
  let seq = 0;
  const sleepers: Sleeper[] = [];

  function nextDue(limit: number): Sleeper | undefined {
    let best: Sleeper | undefined;
    for (const s of sleepers) {
      if (s.deadline <= limit && (!best || s.deadline < best.deadline || (s.deadline === best.deadline && s.seq < best.seq))) best = s;
    }
    return best;
  }

  async function runUntil(limit: number): Promise<void> {
    await settle();
    for (let s = nextDue(limit); s; s = nextDue(limit)) {
      sleepers.splice(sleepers.indexOf(s), 1);
      now = Math.max(now, s.deadline);
      s.resolve();
      await settle();
    }
  }

  const clock: FakeClock = {
    now: () => now,
    date: () => new Date(now),
    sleep(ms, signal) {
      return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(abortReason(signal));
          return;
        }
        if (ms <= 0) {
          resolve();
          return;
        }
        const sleeper: Sleeper = {
          deadline: now + ms,
          seq: seq++,
          resolve: () => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          },
        };
        const onAbort = (): void => {
          const at = sleepers.indexOf(sleeper);
          if (at >= 0) sleepers.splice(at, 1);
          reject(abortReason(signal as AbortSignal));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        sleepers.push(sleeper);
      });
    },
    async advance(ms) {
      if (ms < 0) throw new LaunchwrightError('testing.clock', `advance(${ms}) moves the clock back. Use set(iso) for that.`);
      const target = now + ms;
      await runUntil(target);
      now = target;
    },
    set(iso) {
      now = parse(iso);
    },
    runDue: () => runUntil(now),
  };
  liveClocks.add(clock);
  return clock;
}
