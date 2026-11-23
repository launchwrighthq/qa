// `POST /__qa/clock {shift}` (spec 2.6): moves the kernel CLOCK of the QA API, so a time-bound
// state is reachable. `{shift: "reset"}` puts it back. The provider binds the shift clock.
import { CLOCK, isCodedError } from '../kernel/index.mts';
import { type HandlerArgs, loadHttp } from '../services/peers.mts';
import { parseShift, ShiftClock } from '../world/services/clock.mts';

export interface QaClockBody {
  now: string;
  offsetMs: number;
}

export async function moveClock({ ctx, input }: HandlerArgs<{ shift?: unknown }>): Promise<QaClockBody> {
  const { HttpError } = await loadHttp();
  const clock = ctx.get(CLOCK);
  if (!(clock instanceof ShiftClock)) throw new HttpError(409, 'qa.clock.fixed', 'The CLOCK of this app is not the QA shift clock. Mount /__qa/* with config qa.routes on.');
  const shift = input?.shift;
  if (shift === 'reset') clock.reset();
  else {
    try {
      clock.shift(parseShift(shift));
    } catch (cause) {
      if (isCodedError(cause)) throw new HttpError(400, cause.code, cause.message, { cause });
      throw cause;
    }
  }
  return { now: clock.date().toISOString(), offsetMs: clock.offsetMs };
}
