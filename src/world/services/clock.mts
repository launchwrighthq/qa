// The clock of the QA app: the kernel CLOCK plus an offset that `POST /__qa/clock` moves, so a
// time-bound state (an expiring plan, a due reminder) is reachable without a wait (spec 2.6).
import { type Clock, LaunchwrightError } from '../../kernel/index.mts';

const UNIT_MS: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** A shift as milliseconds: a number, or `+2d`, `-3h`, `90m`, `15s`, `500ms`, `1w`. Throws `qa.clock.shift`. */
export function parseShift(shift: unknown): number {
  if (typeof shift === 'number' && Number.isFinite(shift)) return Math.trunc(shift);
  const match = typeof shift === 'string' ? /^([+-]?)(\d+)(ms|s|m|h|d|w)$/.exec(shift.trim()) : null;
  if (!match) throw new LaunchwrightError('qa.clock.shift', `Shift ${JSON.stringify(shift)} is not a duration such as +2d, -3h, 90m or a number of ms.`);
  return (match[1] === '-' ? -1 : 1) * Number(match[2]) * UNIT_MS[match[3]!]!;
}

/** A clock that reads its base clock plus `offsetMs`. A sleep waits on the base clock. */
export class ShiftClock implements Clock {
  offsetMs = 0;

  constructor(readonly base: Clock) {}

  now(): number {
    return this.base.now() + this.offsetMs;
  }

  date(): Date {
    return new Date(this.now());
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return this.base.sleep(ms, signal);
  }

  /** Moves the clock by `ms`. A negative shift moves it back. */
  shift(ms: number): void {
    this.offsetMs += ms;
  }

  /** Puts the clock back on its base. */
  reset(): void {
    this.offsetMs = 0;
  }
}
