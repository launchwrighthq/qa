/** The time source of the framework. Module code reads time and waits only through it (spec 2.9.4). */
export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
  date(): Date;
  /** Resolves after `ms` milliseconds. Rejects with an `AbortError` when `signal` aborts. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The sleep was aborted', 'AbortError');
}

export const systemClock: Clock = {
  now: () => Date.now(),
  date: () => new Date(Date.now()),
  sleep(ms, signal) {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError(signal));
        return;
      }
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(abortError(signal as AbortSignal));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  },
};
