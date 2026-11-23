/** The time source of the framework. Module code reads time and waits only through it (spec 2.9.4). */
interface Clock {
    /** Milliseconds since the epoch. */
    now(): number;
    date(): Date;
    /** Resolves after `ms` milliseconds. Rejects with an `AbortError` when `signal` aborts. */
    sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export type { Clock as C };
