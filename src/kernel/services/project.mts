// The project config: `launchwright.config.ts` exports `defineConfig({...})` (spec 2.27).
import { z } from 'zod';
import { appsSchema, contractSchema, resolveApps, type ResolveAppsOptions } from './apps.mts';
import { LaunchwrightError } from './errors.mts';
import { type Stamp } from './stamp.mts';
import { projectRoot, projectStamp, type StampSource } from './stamp-source.mts';

const NAME = /^[a-z][a-z0-9-]*$/;
/** An environment name, as `LW_ENV` and the env file `.env.<name>` take it. */
const ENV_NAME = /^[a-z][a-z0-9_-]*$/;

/** One module's options. The module's own config schema checks the keys at boot. */
const moduleOptions = z.record(z.string(), z.unknown());

const STAMP_REFUSED = 'is not allowed: the build sets the stamp from LW_VERSION, LW_RELEASE, LW_COMMIT and LW_BUILT_AT';

/**
 * The zod schema of `launchwright.config.ts`. The known keys are typed. Every other top-level key
 * is a config section of a module (`db`, `ci`, ...): the module's provider validates it at boot.
 */
export const projectConfigSchema = z
  .object({
    /** The project name: lower case letters, digits and `-`. */
    name: z.string().regex(NAME, 'must be lower case letters, digits and -').optional(),
    /** The modules of the project, with the options of each one. */
    modules: z.record(z.string().regex(NAME, 'must be a module name'), moduleOptions).default({}),
    /** The driver of each kind per environment, for example `{ local: { cache: 'memory' } }`. */
    drivers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
    /** Partial module sections per environment, merged over the sections before the `drivers` picks (round 6d N100). */
    environments: z.record(z.string().regex(ENV_NAME, 'must be an environment name: [a-z][a-z0-9_-]*'), z.record(z.string(), moduleOptions)).optional(),
    /** The table map: `{ <module>: { <key>: <table name> } }` (spec 2.10). */
    tables: z.record(z.string(), z.record(z.string(), z.string())).default({}),
    /** The theme package or theme name. */
    theme: z.string().min(1).optional(),
    locales: z
      .object({ default: z.string().min(1), supported: z.array(z.string().min(1)).min(1) })
      .refine((l) => l.supported.includes(l.default), { message: 'default must be one of supported', path: ['default'] })
      .optional(),
    /** The `dev` module's section: surfaces, services, tunnels. The `dev` module validates it. */
    dev: z.record(z.string(), z.unknown()).optional(),
    /** The apps of the project (first-consumer spec 2.2). Absent: `DEFAULT_APPS`. `resolveApps` fills the defaults. */
    apps: appsSchema.optional(),
    /** The folders of the generated `tables.py` (`python`) and TS client (`ts`). */
    contract: contractSchema.optional(),
    /** The harness module's section: `disable` lists hook, rule or skill ids to leave out. */
    harness: z.looseObject({ disable: z.array(z.string()).default([]) }).optional(),
    /** Refused: the project loader fills section `stamp` (versioning spec 2.4). */
    stamp: z.never({ error: STAMP_REFUSED }).optional(),
  })
  .loose()
  .superRefine((config, ctx) => {
    if ('stamp' in config.modules) ctx.addIssue({ code: 'custom', path: ['modules', 'stamp'], message: STAMP_REFUSED });
  });

/** What `launchwright.config.ts` passes to `defineConfig`. */
export type ProjectConfigInput = z.input<typeof projectConfigSchema>;
/** The project config after `parseProjectConfig`: defaults filled in. */
export type ProjectConfig = z.output<typeof projectConfigSchema>;

/**
 * The typed identity function of `launchwright.config.ts`. It checks nothing at import time, so a
 * config file loads in every tool. `parseProjectConfig` and `lw check` validate it.
 */
export function defineConfig<const T extends ProjectConfigInput>(config: T): T {
  return config;
}

/**
 * Validates a project config. Throws LaunchwrightError('kernel.config.stamp') for a `stamp` key,
 * else LaunchwrightError('kernel.project.invalid') that names every bad key.
 */
export function parseProjectConfig(raw: unknown, file = 'launchwright.config.ts'): ProjectConfig {
  const result = projectConfigSchema.safeParse(raw);
  if (result.success) return result.data;
  const stamp = result.error.issues.find((i) => ['stamp', 'modules.stamp'].includes(i.path.map(String).join('.')));
  if (stamp !== undefined) {
    const key = stamp.path.map(String).join('.');
    throw new LaunchwrightError('kernel.config.stamp', `${file}: key "${key}" ${STAMP_REFUSED}. Remove it.`, { cause: result.error, context: { file, key } });
  }
  const keys = result.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'} ${i.message}`);
  throw new LaunchwrightError('kernel.project.invalid', `${file} is invalid: ${keys.join('; ')}`, {
    cause: result.error,
    context: { file, key: result.error.issues[0]?.path.map(String).join('.') },
  });
}

const PROJECT_KEYS = new Set(['name', 'modules', 'drivers', 'environments', 'tables', 'theme', 'locales', 'stamp', 'apps']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * The first step of `projectSections`: each top-level module section merged over the options in
 * `modules.<name>`, with no other step. A top-level key wins. It takes a parsed or a raw config, so
 * a tool that reads a few sections, such as `lw dev`, merges them the same way.
 */
export function moduleSections(config: Record<string, unknown>): Record<string, unknown> {
  const sections: Record<string, unknown> = {};
  const modules = isObject(config.modules) ? config.modules : {};
  for (const [name, options] of Object.entries(modules)) sections[name] = isObject(options) ? { ...options } : options;
  for (const [key, value] of Object.entries(config)) {
    if (PROJECT_KEYS.has(key)) continue;
    const base = sections[key];
    sections[key] = isObject(base) && isObject(value) ? { ...base, ...value } : value;
  }
  return sections;
}

/**
 * `overlay` merged over `base` in deep: an object merges key by key, and any other value, a list
 * included, replaces. Neither input changes. Python `merge_overlay` of the env module follows it.
 */
function mergeOverlay(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = out[key];
    out[key] = isObject(current) && isObject(value) ? mergeOverlay(current, value) : value;
  }
  return out;
}

/**
 * The raw config sections for `createApp`: each top-level module section (`db`, `ci`, `dev`, `harness`), merged
 * over the options in `modules.<name>`. A top-level key wins over the same key in `modules`.
 * Section `db` also gets `tables` from the project table map when it has none. With `env`, each
 * `drivers.<env>.<kind>` pick becomes `default` of section `<kind>`, unless that section sets
 * `default` itself. Section `apps` is `resolveApps(config, apps)`: the apps with every default
 * filled in. `apps.hasPackage` keeps a module out of the default list of a runtime it has no package for.
 * With `env`, `environments.<env>` merges over the sections first (`mergeOverlay`), then the picks apply.
 * Section `stamp` is `stamp.stamp`, else `projectStamp` over `stamp.root`
 * (default: `projectRoot` of the current folder) and `stamp.vars` (default: the process environment).
 */
export function projectSections(config: ProjectConfig, env?: string, stamp: StampOptions = {}, apps: ResolveAppsOptions = {}): Record<string, unknown> {
  const overlay = env === undefined ? undefined : config.environments?.[env];
  const sections = overlay === undefined ? moduleSections(config) : mergeOverlay(moduleSections(config), overlay);
  if (Object.keys(config.tables).length > 0) {
    const db = isObject(sections.db) ? sections.db : {};
    if (db.tables === undefined) sections.db = { ...db, tables: config.tables };
  }
  for (const [kind, name] of Object.entries(env === undefined ? {} : (config.drivers[env] ?? {}))) {
    const section = isObject(sections[kind]) ? sections[kind] : {};
    if (section.default === undefined) sections[kind] = { ...section, default: name };
  }
  sections.apps = resolveApps(config, apps);
  sections.stamp = stamp.stamp ?? projectStamp({ root: stamp.root ?? projectRoot(process.cwd()), vars: stamp.vars ?? process.env, ...(stamp.now ? { now: stamp.now } : {}) });
  return sections;
}

/** Where `projectSections` takes section `stamp`: a ready stamp, or the parts of a `StampSource`. */
export interface StampOptions extends Partial<StampSource> {
  /** A ready stamp, for example from a test or a QA world. */
  stamp?: Stamp;
}
