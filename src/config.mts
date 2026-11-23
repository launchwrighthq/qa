import { appDir, sectionApps, z } from './kernel/index.mts';

/** One leg (spec 2.3). The key of `qa.legs` is its name. */
export const legConfig = z.object({
  surface: z.enum(['web', 'miniapp', 'bot']),
  target: z.string().min(1),
  device: z.string().optional(),
  descriptor: z.string().optional(),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
  deviceScaleFactor: z.number().positive().optional(),
  userAgent: z.string().optional(),
  browser: z.enum(['chromium', 'webkit', 'firefox']).optional(),
  bot: z.string().optional(),
});

/** Config section `qa` (spec 2.2). */
export const qaConfig = z.object({
  reportDir: z.string().default('docs/qa'),
  /** The QA database name. Default: `<dev.project>_qa`, resolved by the world submodule. */
  database: z.string().optional(),
  apiPort: z.number().int().positive().default(9101),
  /**
   * The project module, relative to the project root, that exports `qaApp`: the factory of the
   * QA app (`create`) and its HTTP handler (`serve`). The world submodule boots it on the QA database.
   */
  app: z.string().default('{app:api}/src/main.mts'),
  /** The fake Bot API that the QA app calls (`telegram.apiUrl`). The `lw qa telegram` server. */
  telegramUrl: z.url().default('http://127.0.0.1:9102'),
  /** The project's base seed command, run before the persona and fact seeds. */
  seed: z.string().optional(),
  /**
   * The route that answers the user of a session cookie, for the web persona check (spec 2.6):
   * the `auth` route `session.current`. Move it with `auth.routes.prefix`.
   */
  sessionRoute: z.string().default('/auth/session'),
  /**
   * The route that signs Mini App `initData` in and answers the user, for the Mini App persona
   * check: the `auth` route `telegram.initdata`. `QA_SESSION_PATH` of `client` has the same default.
   */
  miniappSessionRoute: z.string().default('/auth/telegram/initdata'),
  clientRoots: z.array(z.string()).default(['{app:client}/src']),
  /**
   * The production client builds that `lw qa check` scans for the marker `lw-qa-dev-only`
   * (spec 2.6, rule S3). A missing folder is a finding only with `lw qa check --build`.
   */
  buildDirs: z.array(z.string()).default(['{app:client}/dist']),
  /** The origin of each surface that `lw qa session run` opens. `--base <surface>=<url>` overrides one. */
  baseUrls: z.partialRecord(z.enum(['web', 'miniapp', 'bot']), z.url()).default({}),
  /**
   * The route table files the delivery scan reads (spec 2.7, 2.14 rule C4). A string is a table of
   * the `web` surface. The default is the project route file of main spec 2.26.3.
   */
  routeTables: z
    .array(z.union([z.string(), z.object({ file: z.string(), surface: z.enum(['web', 'miniapp', 'bot']) })]))
    .default(['{app:api}/src/routes.mts']),
  /** Folders that only declare types, so the state scan can derive the shape of a parameter type. */
  typeRoots: z.array(z.string()).default([]),
  /** Overrides and additions to the default legs (spec 2.3). `false` removes a default leg. */
  legs: z.record(z.string(), z.union([legConfig, z.literal(false)])).default({}),
  /** Mounts `/__qa/*`. Boot refuses it in production (spec 2.6). */
  routes: z.boolean().default(false),
  evidence: z
    .object({
      blankStdDev: z.number().nonnegative().default(2),
      videoCapS: z.number().positive().default(170),
      blackRatio: z.number().min(0).max(1).default(0.95),
      attempts: z.number().int().positive().default(3),
    })
    .prefault({}),
  /** Key of module `qa-device`, which parses it. The core keeps it whole. */
  device: z.record(z.string(), z.unknown()).default({}),
  /** Key of module `qa-intake`, which parses it. The core keeps it whole. */
  intake: z.record(z.string(), z.unknown()).default({}),
  publish: z.object({ storage: z.string().optional() }).prefault({}),
});
export type QaConfig = z.infer<typeof qaConfig>;
export type LegConfig = z.infer<typeof legConfig>;

/**
 * `cfg` with each `{app:<name>}` of its path keys (`app`, `clientRoots`, `buildDirs`,
 * `routeTables`, `typeRoots`) replaced by the folder of that app in config section `apps`.
 */
export function withAppPaths(cfg: QaConfig, sections: Record<string, unknown> = {}): QaConfig {
  const apps = sectionApps(sections);
  const dir = (p: string): string => appDir(p, apps);
  const routeTables = cfg.routeTables.map((t) => (typeof t === 'string' ? dir(t) : { ...t, file: dir(t.file) }));
  return { ...cfg, app: dir(cfg.app), clientRoots: cfg.clientRoots.map(dir), buildDirs: cfg.buildDirs.map(dir), routeTables, typeRoots: cfg.typeRoots.map(dir) };
}

/** Config section `qa` of `sections`, parsed, with the app folders of `withAppPaths`. */
export function qaConfigOf(sections: Record<string, unknown> = {}): QaConfig {
  return withAppPaths(qaConfig.parse(sections.qa ?? {}), sections);
}
