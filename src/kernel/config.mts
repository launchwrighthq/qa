import { z, type ZodType } from 'zod';
import { bootError, envFileFor, LaunchwrightError } from './services/errors.mts';

/** The validated project config, one section per module. */
export interface ConfigStore {
  /** The parsed section. Throws LaunchwrightError('kernel.config.missing') for an unknown section. */
  section<T>(name: string): T;
  /** The environment name that createApp received, for example `local` or `production`. */
  readonly env: string | undefined;
  /** The env file that a boot failure names: `.env.<env>`, or `.env`. */
  readonly envFile: string;
}

/** The parts of a process: `web` serves HTTP, `worker` runs queue workers, `all` runs both. */
export const PROCESS_ROLES = ['all', 'web', 'worker'] as const;
export type ProcessRole = (typeof PROCESS_ROLES)[number];

/**
 * Config section `kernel`.
 * - `lifecycle`: the times of `app.stop()` (spec 2.11.1): the lame-duck window in which the health
 *   check fails while the app still serves, then the longest drain. The defaults (5 s and 20 s) fit
 *   inside the 30 s that Kubernetes and ECS give between SIGTERM and SIGKILL.
 * - `role`: the parts that this process runs. Default `all`.
 * - `remoteDb`: true when the process uses a database that a deployed environment shares, such as
 *   a laptop on the staging database. It then runs no scheduled job. Default false.
 * - `deployedEnvs`: the environment names that count as deployed. Default none.
 * - `localDrivers`: the driver names that a deployed environment refuses. Default `fake`, `log` and
 *   `memory`. A driver with `allowsReplicaLocal` passes all the same (spec D3).
 * - `allowLocalDrivers`: `<kind>.<driver>` entries that a deployed environment accepts all the same.
 * - `sync.timeoutSeconds`: Python only. The longest blocking call through `to_sync` (spec 2.4.1).
 */
export const kernelConfig = z.object({
  lifecycle: z
    .object({
      lameDuckMs: z.number().int().nonnegative().default(5_000),
      drainMs: z.number().int().positive().default(20_000),
    })
    .prefault({}),
  role: z.enum(PROCESS_ROLES).default('all'),
  remoteDb: z.boolean().default(false),
  deployedEnvs: z.array(z.string().min(1)).default([]),
  localDrivers: z.array(z.string().min(1)).default(['fake', 'log', 'memory']),
  allowLocalDrivers: z.array(z.string().regex(/^[a-z0-9_.-]+\.[a-z0-9_-]+$/, 'must be <kind>.<driver>')).default([]),
  sync: z.object({ timeoutSeconds: z.number().positive().optional() }).prefault({}),
});
export type KernelConfig = z.infer<typeof kernelConfig>;

/** A config section that a provider declares. */
export interface ConfigSection {
  module: string;
  section: string;
  schema: ZodType;
}

/**
 * Validates each declared section with its zod schema and returns the store.
 * A section that is absent from `raw` is parsed as `{}`, so a schema with defaults needs no entry.
 * Throws BootError that names the module, the first bad key and the env file.
 */
export function createConfigStore(raw: Record<string, unknown>, sections: ConfigSection[], env?: string): ConfigStore {
  const envFile = envFileFor(env);
  const parsed = new Map<string, unknown>();
  for (const s of sections) {
    const result = s.schema.safeParse(raw[s.section] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = (issue?.path ?? []).map(String);
      const key = [s.section, ...path].join('.');
      const others = result.error.issues.slice(1).map((i) => [s.section, ...i.path.map(String)].join('.'));
      throw bootError(
        'kernel.config.invalid',
        {
          module: s.module,
          key,
          envFile,
          reason: `is invalid (${issue?.message ?? 'invalid value'})${others.length > 0 ? `; other bad keys: ${others.join(', ')}` : ''}`,
        },
        { cause: result.error, context: { section: s.section } },
      );
    }
    parsed.set(s.section, result.data);
  }
  return {
    env,
    envFile,
    section<T>(name: string): T {
      if (parsed.has(name)) return parsed.get(name) as T;
      if (name in raw) return raw[name] as T;
      throw new LaunchwrightError('kernel.config.missing', `No config section "${name}". Add it to the project config.`, {
        context: { section: name, envFile },
      });
    },
  };
}
