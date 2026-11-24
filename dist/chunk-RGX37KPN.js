import {
  DEFAULT_GAUGE_COLOR
} from "./chunk-2VQTE6KZ.js";
import {
  appDir,
  sectionApps,
  z
} from "./chunk-5AJ7M7K5.js";

// src/services/score-config.mts
var NAMED_COLORS = new Set(
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor".split(" ")
);
var HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
var FUNCTIONAL = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-+0-9.%a-z\s,/]+\)$/i;
function isCssColor(value) {
  const v = value.trim();
  return HEX.test(v) || FUNCTIONAL.test(v) || NAMED_COLORS.has(v.toLowerCase());
}
var weight = z.number().nonnegative();
var scoreConfig = z.object({
  weights: z.strictObject({
    findings: weight.optional(),
    console: weight.optional(),
    coverage: weight.optional(),
    evidence: weight.optional(),
    accessibility: weight.optional(),
    performance: weight.optional()
  }).default({}),
  gaugeColor: z.string().refine(isCssColor, { message: "qa.score.gaugeColor must be a CSS colour: #rgb, #rrggbb, rgb(...), hsl(...), oklch(...) or a named colour" }).default(DEFAULT_GAUGE_COLOR)
});

// src/config.mts
var legConfig = z.object({
  surface: z.enum(["web", "miniapp", "bot"]),
  target: z.string().min(1),
  device: z.string().optional(),
  descriptor: z.string().optional(),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
  deviceScaleFactor: z.number().positive().optional(),
  userAgent: z.string().optional(),
  browser: z.enum(["chromium", "webkit", "firefox"]).optional(),
  bot: z.string().optional()
});
var qaConfig = z.object({
  reportDir: z.string().default("docs/qa"),
  /** The QA database name. Default: `<dev.project>_qa`, resolved by the world submodule. */
  database: z.string().optional(),
  apiPort: z.number().int().positive().default(9101),
  /**
   * The project module, relative to the project root, that exports `qaApp`: the factory of the
   * QA app (`create`) and its HTTP handler (`serve`). The world submodule boots it on the QA database.
   */
  app: z.string().default("{app:api}/src/main.mts"),
  /** The fake Bot API that the QA app calls (`telegram.apiUrl`). The `lw qa telegram` server. */
  telegramUrl: z.url().default("http://127.0.0.1:9102"),
  /** The project's base seed command, run before the persona and fact seeds. */
  seed: z.string().optional(),
  /**
   * The route that answers the user of a session cookie, for the web persona check (spec 2.6):
   * the `auth` route `session.current`. Move it with `auth.routes.prefix`.
   */
  sessionRoute: z.string().default("/auth/session"),
  /**
   * The route that signs Mini App `initData` in and answers the user, for the Mini App persona
   * check: the `auth` route `telegram.initdata`. `QA_SESSION_PATH` of `client` has the same default.
   */
  miniappSessionRoute: z.string().default("/auth/telegram/initdata"),
  clientRoots: z.array(z.string()).default(["{app:client}/src"]),
  /**
   * The production client builds that `lw qa check` scans for the marker `lw-qa-dev-only`
   * (spec 2.6, rule S3). A missing folder is a finding only with `lw qa check --build`.
   */
  buildDirs: z.array(z.string()).default(["{app:client}/dist"]),
  /** The origin of each surface that `lw qa session run` opens. `--base <surface>=<url>` overrides one. */
  baseUrls: z.partialRecord(z.enum(["web", "miniapp", "bot"]), z.url()).default({}),
  /**
   * The route table files the delivery scan reads (spec 2.7, 2.14 rule C4). A string is a table of
   * the `web` surface. The default is the project route file of main spec 2.26.3.
   */
  routeTables: z.array(z.union([z.string(), z.object({ file: z.string(), surface: z.enum(["web", "miniapp", "bot"]) })])).default(["{app:api}/src/routes.mts"]),
  /**
   * Path wrappers of the route tables, by function name, to the prefix each one adds, for example
   * `{ localized = "/:lang?" }`. The delivery scan reads a wrapper body it can follow by itself;
   * this key is for a wrapper it cannot, such as one imported from a package.
   */
  routeWrappers: z.record(z.string(), z.string().startsWith("/")).default({}),
  /**
   * The tracked files of a state run (spec 2.7). `delivery`: union name to its delivery descriptor.
   * `mounts`: union name to its mount hints. A path is project-relative. When a key is not set,
   * the run reads `.lw/qa/delivery.json` and `.lw/qa/mounts.json` if they exist.
   */
  states: z.object({ delivery: z.string().min(1).optional(), mounts: z.string().min(1).optional() }).prefault({}),
  /** Folders that only declare types, so the state scan can derive the shape of a parameter type. */
  typeRoots: z.array(z.string()).default([]),
  /** Overrides and additions to the default legs (spec 2.3). `false` removes a default leg. */
  legs: z.record(z.string(), z.union([legConfig, z.literal(false)])).default({}),
  /** Mounts `/__qa/*`. Boot refuses it in production (spec 2.6). */
  routes: z.boolean().default(false),
  evidence: z.object({
    blankStdDev: z.number().nonnegative().default(2),
    videoCapS: z.number().positive().default(170),
    blackRatio: z.number().min(0).max(1).default(0.95),
    attempts: z.number().int().positive().default(3)
  }).prefault({}),
  /** The 0-100 score (spec 2.11): weight overrides per dimension and the gauge ring colour. */
  score: scoreConfig.prefault({}),
  /** Key of module `qa-device`, which parses it. The core keeps it whole. */
  device: z.record(z.string(), z.unknown()).default({}),
  /** Key of module `qa-intake`, which parses it. The core keeps it whole. */
  intake: z.record(z.string(), z.unknown()).default({}),
  publish: z.object({ storage: z.string().optional() }).prefault({})
});
function withAppPaths(cfg, sections = {}) {
  const apps = sectionApps(sections);
  const dir = (p) => appDir(p, apps);
  const routeTables = cfg.routeTables.map((t) => typeof t === "string" ? dir(t) : { ...t, file: dir(t.file) });
  const states = {
    ...cfg.states.delivery === void 0 ? {} : { delivery: dir(cfg.states.delivery) },
    ...cfg.states.mounts === void 0 ? {} : { mounts: dir(cfg.states.mounts) }
  };
  return { ...cfg, app: dir(cfg.app), clientRoots: cfg.clientRoots.map(dir), buildDirs: cfg.buildDirs.map(dir), routeTables, typeRoots: cfg.typeRoots.map(dir), states };
}
function qaConfigOf(sections = {}) {
  return withAppPaths(qaConfig.parse(sections.qa ?? {}), sections);
}

export {
  isCssColor,
  scoreConfig,
  qaConfig,
  withAppPaths,
  qaConfigOf
};
//# sourceMappingURL=chunk-RGX37KPN.js.map