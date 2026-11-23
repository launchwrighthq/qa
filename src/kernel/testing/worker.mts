import { LaunchwrightError } from '../services/errors.mts';

/**
 * The number of this test worker, from 1: `VITEST_POOL_ID` (Vitest starts at 1), else the xdist
 * index of `PYTEST_XDIST_WORKER` plus 1 (xdist starts at `gw0`), else 1. Test databases and Redis
 * indexes of a worker derive from it (testing spec 2.10).
 */
export function workerNumber(env: Record<string, string | undefined> = process.env): number {
  const pool = env.VITEST_POOL_ID;
  if (pool !== undefined && pool !== '') {
    if (!/^[1-9]\d*$/.test(pool)) throw new LaunchwrightError('testing.worker', `VITEST_POOL_ID is "${pool}", not a number from 1.`);
    return Number(pool);
  }
  const xdist = env.PYTEST_XDIST_WORKER;
  if (xdist !== undefined && xdist !== '') {
    const match = /^gw(\d+)$/.exec(xdist);
    if (!match) throw new LaunchwrightError('testing.worker', `PYTEST_XDIST_WORKER is "${xdist}", not gw<N>.`);
    return Number(match[1]) + 1;
  }
  return 1;
}

/**
 * The lane of this test run, from 0: `LW_TEST_LANE`, set by `lw test` and the runner presets, else 0.
 * Two runs of one checkout at once hold two lanes, so their test databases differ (testing spec 2.10.2).
 */
export function laneNumber(env: Record<string, string | undefined> = process.env): number {
  const lane = env.LW_TEST_LANE;
  if (lane === undefined || lane === '') return 0;
  if (!/^(0|[1-9]\d*)$/.test(lane)) throw new LaunchwrightError('testing.lane', `LW_TEST_LANE is "${lane}", not a number from 0. lw test sets it; do not set it by hand.`);
  return Number(lane);
}

/** Redis has 16 databases. The worker cap of 16 (testing spec 2.8.2) matches them. */
const REDIS_DATABASES = 16;

/** `LW_TEST_REDIS_URL` with the database index of this worker: the worker number minus 1 (testing spec 2.10.3). */
export function redisTestUrl(env: Record<string, string | undefined> = process.env): string {
  const base = env.LW_TEST_REDIS_URL;
  if (!base) {
    throw new LaunchwrightError(
      'testing.services',
      'LW_TEST_REDIS_URL is not set. Run the tests with lw test: it starts the Redis of this checkout that the installed modules need and sets the URL.',
    );
  }
  const index = workerNumber(env) - 1;
  if (index >= REDIS_DATABASES) {
    throw new LaunchwrightError('testing.services', `Worker ${index + 1} has no Redis database: Redis has ${REDIS_DATABASES}. Run at most ${REDIS_DATABASES} workers.`, {
      context: { worker: index + 1 },
    });
  }
  const url = new URL(base);
  url.pathname = `/${index}`;
  return url.toString();
}
