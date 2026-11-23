import { messageOf } from './errors.mts';

export interface HealthResult {
  ok: boolean;
  detail?: string;
}

export interface HealthRegistry {
  register(name: string, check: () => Promise<HealthResult>): void;
  /** Runs every check. A check that throws reports `{ ok: false, detail: <message> }`. */
  run(): Promise<Record<string, HealthResult>>;
}

export function createHealthRegistry(): HealthRegistry {
  const checks = new Map<string, () => Promise<HealthResult>>();
  return {
    register(name, check) {
      checks.set(name, check);
    },
    async run() {
      const entries = await Promise.all(
        [...checks].map(async ([name, check]): Promise<[string, HealthResult]> => {
          try {
            return [name, await check()];
          } catch (err) {
            return [name, { ok: false, detail: messageOf(err) }];
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  };
}
