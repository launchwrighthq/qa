"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.mts
var src_exports = {};
__export(src_exports, {
  ACT_KINDS: () => ACT_KINDS,
  ANCHOR_KINDS: () => ANCHOR_KINDS,
  BOTFATHER: () => BOTFATHER,
  BOT_STORE_DIR: () => BOT_STORE_DIR,
  COMMENTS_DIR: () => COMMENTS_DIR,
  DEFAULT_SCORE_WEIGHTS: () => DEFAULT_SCORE_WEIGHTS,
  DELETE_CONFIRM: () => DELETE_CONFIRM,
  EXTENSION_PREFIX: () => EXTENSION_PREFIX,
  INTAKE_DIR: () => INTAKE_DIR,
  MIN_VIDEO_S: () => MIN_VIDEO_S,
  QA_TARGETS: () => QA_TARGETS,
  QA_TARGET_CAPABILITIES: () => QA_TARGET_CAPABILITIES,
  QA_TARGET_SPEC_VERSION: () => QA_TARGET_SPEC_VERSION,
  REPORT_STATUSES: () => REPORT_STATUSES,
  ROW_FAILURES: () => ROW_FAILURES,
  SEVERITY_DEDUCTION: () => SEVERITY_DEDUCTION,
  addComment: () => addComment,
  botIdOf: () => botIdOf,
  commentsFile: () => commentsFile,
  computeManifest: () => computeManifest,
  computeScore: () => computeScore,
  configureBot: () => configureBot,
  destroyBot: () => destroyBot,
  diff: () => diff,
  exportTaskList: () => exportTaskList,
  extensionNames: () => extensionNames,
  extensionOf: () => extensionOf,
  extensionTargets: () => extensionTargets,
  fileBotStore: () => fileBotStore,
  fileCommentStore: () => fileCommentStore,
  fileConsentStore: () => fileConsentStore,
  grant: () => grant,
  issueMarkdown: () => issueMarkdown,
  listIssues: () => listIssues,
  loadExtensions: () => loadExtensions,
  makeComment: () => makeComment,
  manifestHash: () => manifestHash,
  mimeOfExtension: () => mimeOfExtension,
  newBot: () => newBot,
  parseBotToken: () => parseBotToken,
  pngSize: () => pngSize,
  qaConfig: () => qaConfig,
  qaConfigOf: () => qaConfigOf,
  qaProvider: () => qaProvider,
  readIssue: () => readIssue,
  recordDir: () => recordDir,
  recordId: () => recordId,
  renderScoreGauge: () => renderScoreGauge,
  replyToComment: () => replyToComment,
  resolveComments: () => resolveComments,
  setStatus: () => setStatus,
  startCommentServer: () => startCommentServer,
  validateAnchor: () => validateAnchor,
  withAppPaths: () => withAppPaths,
  writeIssue: () => writeIssue
});
module.exports = __toCommonJS(src_exports);

// src/commands/extensions.mts
var import_node_url = require("url");

// src/kernel/services/apps.mts
var import_zod = require("zod");

// src/kernel/services/errors.mts
var LaunchwrightError = class extends Error {
  code;
  context;
  constructor(code, message, opts) {
    super(message, opts && "cause" in opts ? { cause: opts.cause } : void 0);
    this.name = new.target.name;
    this.code = code;
    this.context = opts?.context ?? {};
  }
};
var BootError = class extends LaunchwrightError {
};

// src/kernel/services/apps.mts
var APP_RUNTIMES = ["node", "python", "web"];
var APP_NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
var processSchema = import_zod.z.strictObject({
  command: import_zod.z.string().trim().min(1),
  /** Ask the dev port registry for a port. */
  port: import_zod.z.boolean().optional(),
  /** The queue lanes this process consumes (spec 2.6). */
  lanes: import_zod.z.array(import_zod.z.string().min(1)).optional(),
  /** The number of copies of the process. `lw dev` starts each as `<app>.<process>-<i>`. Default 1. */
  count: import_zod.z.number().int().min(1).optional(),
  /** The part of the app's modules that this process starts. Default: every module of the app. */
  modules: import_zod.z.array(import_zod.z.string().min(1)).optional()
});
var appSchema = import_zod.z.strictObject({
  runtime: import_zod.z.enum(APP_RUNTIMES),
  path: import_zod.z.string().min(1).optional(),
  modules: import_zod.z.array(import_zod.z.string().min(1)).optional(),
  processes: import_zod.z.record(import_zod.z.string().regex(APP_NAME, "must be letters, digits and -"), processSchema).optional(),
  /** A `web` app: the `node` app that serves its files. */
  servedBy: import_zod.z.string().min(1).optional()
});
var appsSchema = import_zod.z.record(import_zod.z.string().regex(APP_NAME, "must be letters, digits and -"), appSchema);
var contractSchema = import_zod.z.looseObject({ python: import_zod.z.array(import_zod.z.string().min(1)).optional(), ts: import_zod.z.array(import_zod.z.string().min(1)).optional() });
var DEFAULT_APPS = {
  api: { runtime: "node", path: "apps/api" },
  client: { runtime: "web", path: "apps/client", servedBy: "api" },
  console: { runtime: "web", path: "apps/console", servedBy: "api" },
  ai: { runtime: "python", path: "apps/ai" }
};
function closeOverRequires(modules, requires, keep) {
  const out = [...modules];
  for (let i = 0; i < out.length; i++) {
    for (const r of requires(out[i])) {
      if (r !== "kernel" && !out.includes(r) && keep(r)) out.push(r);
    }
  }
  return { modules: out, added: out.slice(modules.length) };
}
function defaultProcess(name, runtime) {
  if (runtime === "node") return { name, command: "node --import tsx src/main.mts", port: true };
  if (runtime === "web") return { name, command: "vite --configLoader runner", port: true };
  return { name, command: `python -m ${name.replaceAll("-", "_")}` };
}
function checkApps(project) {
  const installed = new Set(Object.keys(project.modules ?? {}));
  const entries = Object.entries(project.apps ?? DEFAULT_APPS);
  const findings = [];
  const paths = /* @__PURE__ */ new Map();
  const nodeApps = entries.filter(([, a]) => a.runtime === "node").map(([n]) => n);
  for (const [name, app] of entries) {
    for (const m of app.modules ?? []) {
      if (!installed.has(m) && m !== "kernel") findings.push({ key: `apps.${name}.modules`, message: `app ${name} names module ${m}, which modules does not hold` });
    }
    const path = app.path ?? `apps/${name}`;
    const other = paths.get(path);
    if (other !== void 0) findings.push({ key: `apps.${name}.path`, message: `apps ${other} and ${name} share the path ${path}` });
    paths.set(path, name);
    if (app.servedBy !== void 0 && !nodeApps.includes(app.servedBy)) findings.push({ key: `apps.${name}.servedBy`, message: `app ${name} is served by ${app.servedBy}, which is not a node app` });
    if (app.runtime === "web" && app.servedBy === void 0 && nodeApps.length > 1) findings.push({ key: `apps.${name}.servedBy`, message: `web app ${name} needs servedBy: the project has the node apps ${nodeApps.join(", ")}` });
  }
  return findings;
}
function resolveApps(project, opts = {}) {
  const parsed = appsSchema.safeParse(project.apps ?? DEFAULT_APPS);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `apps.${i.path.map(String).join(".")} ${i.message}`);
    throw new LaunchwrightError("kernel.apps.invalid", `The apps section is invalid: ${keys.join("; ")}`, { cause: parsed.error, context: { keys } });
  }
  const findings = checkApps({ ...project, apps: parsed.data });
  if (findings.length > 0) {
    throw new LaunchwrightError("kernel.apps.invalid", `The apps section is invalid: ${findings.map((f) => f.message).join("; ")}`, { context: { keys: findings.map((f) => f.key) } });
  }
  const installed = Object.keys(project.modules ?? {});
  const hasPackage = opts.hasPackage ?? (() => true);
  const requires = opts.requires ?? (() => []);
  const nodeApps = Object.entries(parsed.data).filter(([, a]) => a.runtime === "node").map(([n]) => n);
  const apps = Object.entries(parsed.data).map(([name, app]) => {
    const processes = app.processes === void 0 ? [defaultProcess(name, app.runtime)] : Object.entries(app.processes).map(([p, v]) => ({ name: p, ...v }));
    const listed = app.modules ?? (app.runtime === "web" ? [] : installed.filter((m) => hasPackage(m, app.runtime)));
    const { modules, added } = closeOverRequires(listed, requires, (m) => installed.includes(m) && hasPackage(m, app.runtime));
    const servedBy = app.runtime === "web" ? app.servedBy ?? nodeApps[0] : void 0;
    return { name, runtime: app.runtime, path: app.path ?? `apps/${name}`, modules, processes: processes.map((p) => closeProcess(p, modules, requires)), ...servedBy === void 0 ? {} : { servedBy }, ...added.length === 0 ? {} : { added } };
  });
  const outside = apps.flatMap((a) => a.processes.flatMap((p) => (p.modules ?? []).filter((m) => !a.modules.includes(m)).map((m) => ({ key: `apps.${a.name}.processes.${p.name}.modules`, m }))));
  if (outside.length > 0) {
    throw new LaunchwrightError("kernel.apps.invalid", `The apps section is invalid: ${outside.map((o) => `${o.key} names module ${o.m}, which its app does not hold`).join("; ")}`, {
      context: { keys: outside.map((o) => o.key) }
    });
  }
  return apps;
}
function closeProcess(process2, appModules, requires) {
  if (process2.modules === void 0) return process2;
  const { modules, added } = closeOverRequires(process2.modules, requires, (m) => appModules.includes(m));
  return { ...process2, modules, ...added.length === 0 ? {} : { added } };
}
function sectionApps(sections) {
  return Array.isArray(sections.apps) ? sections.apps : resolveApps({});
}
var APP_DIR = /\{app:([A-Za-z0-9][A-Za-z0-9-]*)\}/g;
function appDir(template, apps) {
  return template.replace(APP_DIR, (_m, name) => apps.find((a) => a.name === name)?.path ?? `apps/${name}`);
}

// src/kernel/services/clock.mts
function abortError(signal) {
  return signal.reason ?? new DOMException("The sleep was aborted", "AbortError");
}
var systemClock = {
  now: () => Date.now(),
  date: () => new Date(Date.now()),
  sleep(ms, signal) {
    return new Promise((resolve3, reject) => {
      if (signal?.aborted) {
        reject(abortError(signal));
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(abortError(signal));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve3();
      }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
};

// src/kernel/config.mts
var import_zod2 = require("zod");
var PROCESS_ROLES = ["all", "web", "worker"];
var kernelConfig = import_zod2.z.object({
  lifecycle: import_zod2.z.object({
    lameDuckMs: import_zod2.z.number().int().nonnegative().default(5e3),
    drainMs: import_zod2.z.number().int().positive().default(2e4)
  }).prefault({}),
  role: import_zod2.z.enum(PROCESS_ROLES).default("all"),
  remoteDb: import_zod2.z.boolean().default(false),
  deployedEnvs: import_zod2.z.array(import_zod2.z.string().min(1)).default([]),
  localDrivers: import_zod2.z.array(import_zod2.z.string().min(1)).default(["fake", "log", "memory"]),
  allowLocalDrivers: import_zod2.z.array(import_zod2.z.string().regex(/^[a-z0-9_.-]+\.[a-z0-9_-]+$/, "must be <kind>.<driver>")).default([]),
  sync: import_zod2.z.object({ timeoutSeconds: import_zod2.z.number().positive().optional() }).prefault({})
});

// src/kernel/services/key-words.mts
var SECRET_WORDS = ["password", "secret", "token", "key", "authorization"];
var SECRET_KEY_PATTERN = new RegExp(`^(?:${SECRET_WORDS.join("|")})s?$`, "i");

// src/kernel/provider.mts
function provider(p) {
  return p;
}
var kernelProvider = provider({
  name: "kernel",
  config: { section: "kernel", schema: kernelConfig },
  register: () => void 0
});

// src/kernel/services/stamp.mts
var import_zod3 = require("zod");
var DEV_RELEASE = "dev";
var RELEASE_ID = /^[1-9][0-9]{0,8}-[0-9a-f]{7}$/;
var SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
var stampConfig = import_zod3.z.strictObject({
  version: import_zod3.z.string().regex(SEMVER, "must be semver MAJOR.MINOR.PATCH[-pre] with no build metadata"),
  release: import_zod3.z.string().refine((r) => r === DEV_RELEASE || RELEASE_ID.test(r), `must be ${DEV_RELEASE} or <build>-<sha7>`),
  commit: import_zod3.z.string().regex(/^[0-9a-f]{40}$/, "must be 40 lower-case hex digits").nullable(),
  builtAt: import_zod3.z.iso.datetime({ offset: true, error: "must be an ISO date and time" })
});

// src/kernel/tokens.mts
function token(name) {
  return Object.freeze({ key: Symbol(name), name });
}
var APP = token("kernel.app");
var CONFIG = token("kernel.config");
var LOGGER = token("kernel.logger");
var EVENTS = token("kernel.events");
var CLOCK = token("kernel.clock");
var ACCOUNTS = token("kernel.accounts");

// src/kernel/services/hmac.mts
var import_node_crypto = require("crypto");
var encoder = new TextEncoder();

// src/kernel/services/manifest.mts
var import_promises = require("fs/promises");
var import_node_path = require("path");
var import_smol_toml = require("smol-toml");
var import_zod4 = require("zod");
var manifestSchema = import_zod4.z.object({
  name: import_zod4.z.string().min(1),
  summary: import_zod4.z.string(),
  requires: import_zod4.z.array(import_zod4.z.string()).default([]),
  languages: import_zod4.z.array(import_zod4.z.enum(["ts", "py"])).min(1),
  submodules: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.object({ default: import_zod4.z.boolean().optional(), requires: import_zod4.z.array(import_zod4.z.string()).optional() })).default({}),
  contributes: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.unknown()).default({})
});

// src/kernel/services/module-fixture.mts
var import_node_fs = require("fs");

// src/kernel/services/resolve-import.mts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
var IMPORT_CONDITIONS = /* @__PURE__ */ new Set(["node", "import", "module-sync", "default"]);
function exportTarget(target) {
  if (typeof target === "string") return target;
  if (Array.isArray(target)) {
    for (const item of target) {
      const found = exportTarget(item);
      if (found !== void 0) return found;
    }
    return void 0;
  }
  if (target === null || typeof target !== "object") return void 0;
  for (const [condition, value] of Object.entries(target)) {
    if (!IMPORT_CONDITIONS.has(condition)) continue;
    const found = exportTarget(value);
    if (found !== void 0) return found;
  }
  return void 0;
}
function packageFolder(root, name) {
  for (let dir = root; ; dir = (0, import_node_path2.dirname)(dir)) {
    const candidate = (0, import_node_path2.join)(dir, "node_modules", name);
    if ((0, import_node_fs2.existsSync)((0, import_node_path2.join)(candidate, "package.json"))) return candidate;
    if ((0, import_node_path2.dirname)(dir) === dir) return void 0;
  }
}
function fileAt(base) {
  for (const path of [base, `${base}.js`, (0, import_node_path2.join)(base, "index.js")]) if ((0, import_node_fs2.statSync)(path, { throwIfNoEntry: false })?.isFile()) return path;
  return void 0;
}
function resolveImport(specifier, root) {
  const fail = (reason, cause) => new LaunchwrightError("kernel.resolve.failed", `Cannot resolve ${specifier} from ${root}: ${reason}.`, { ...cause === void 0 ? {} : { cause }, context: { specifier, root } });
  const parts = specifier.split("/");
  const size = specifier.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, size).join("/");
  const subpath = [".", ...parts.slice(size)].join("/");
  const dir = packageFolder(root, name);
  if (dir === void 0) throw fail(`package ${name} is not installed`);
  let manifest;
  try {
    manifest = JSON.parse((0, import_node_fs2.readFileSync)((0, import_node_path2.join)(dir, "package.json"), "utf8"));
  } catch (cause) {
    throw fail(`${(0, import_node_path2.join)(dir, "package.json")} is not valid JSON`, cause);
  }
  let target;
  if (manifest.exports === void 0) {
    target = fileAt((0, import_node_path2.join)(dir, subpath === "." ? typeof manifest.main === "string" ? manifest.main : "index.js" : subpath));
  } else {
    const map = manifest.exports;
    const bySubpath = map !== null && typeof map === "object" && !Array.isArray(map) && Object.keys(map).some((k) => k.startsWith("."));
    const entry = bySubpath ? map[subpath] : subpath === "." ? map : void 0;
    const path = exportTarget(entry);
    if (path === void 0) throw fail(`package ${name} exports no ${subpath} for import`);
    const file = (0, import_node_path2.join)(dir, path);
    target = (0, import_node_fs2.statSync)(file, { throwIfNoEntry: false })?.isFile() ? file : void 0;
  }
  if (target === void 0) throw fail(`${subpath} of package ${name} names a file that does not exist`);
  return (0, import_node_fs2.realpathSync)(target);
}

// src/kernel/services/project.mts
var import_zod5 = require("zod");

// src/kernel/services/stamp-source.mts
var import_node_fs3 = require("fs");
var import_node_path3 = require("path");

// src/kernel/services/project.mts
var NAME = /^[a-z][a-z0-9-]*$/;
var ENV_NAME = /^[a-z][a-z0-9_-]*$/;
var moduleOptions = import_zod5.z.record(import_zod5.z.string(), import_zod5.z.unknown());
var STAMP_REFUSED = "is not allowed: the build sets the stamp from LW_VERSION, LW_RELEASE, LW_COMMIT and LW_BUILT_AT";
var projectConfigSchema = import_zod5.z.object({
  /** The project name: lower case letters, digits and `-`. */
  name: import_zod5.z.string().regex(NAME, "must be lower case letters, digits and -").optional(),
  /** The modules of the project, with the options of each one. */
  modules: import_zod5.z.record(import_zod5.z.string().regex(NAME, "must be a module name"), moduleOptions).default({}),
  /** The driver of each kind per environment, for example `{ local: { cache: 'memory' } }`. */
  drivers: import_zod5.z.record(import_zod5.z.string(), import_zod5.z.record(import_zod5.z.string(), import_zod5.z.string())).default({}),
  /** Partial module sections per environment, merged over the sections before the `drivers` picks (round 6d N100). */
  environments: import_zod5.z.record(import_zod5.z.string().regex(ENV_NAME, "must be an environment name: [a-z][a-z0-9_-]*"), import_zod5.z.record(import_zod5.z.string(), moduleOptions)).optional(),
  /** The table map: `{ <module>: { <key>: <table name> } }` (spec 2.10). */
  tables: import_zod5.z.record(import_zod5.z.string(), import_zod5.z.record(import_zod5.z.string(), import_zod5.z.string())).default({}),
  /** The theme package or theme name. */
  theme: import_zod5.z.string().min(1).optional(),
  locales: import_zod5.z.object({ default: import_zod5.z.string().min(1), supported: import_zod5.z.array(import_zod5.z.string().min(1)).min(1) }).refine((l) => l.supported.includes(l.default), { message: "default must be one of supported", path: ["default"] }).optional(),
  /** The `dev` module's section: surfaces, services, tunnels. The `dev` module validates it. */
  dev: import_zod5.z.record(import_zod5.z.string(), import_zod5.z.unknown()).optional(),
  /** The apps of the project (first-consumer spec 2.2). Absent: `DEFAULT_APPS`. `resolveApps` fills the defaults. */
  apps: appsSchema.optional(),
  /** The folders of the generated `tables.py` (`python`) and TS client (`ts`). */
  contract: contractSchema.optional(),
  /** The harness module's section: `disable` lists hook, rule or skill ids to leave out. */
  harness: import_zod5.z.looseObject({ disable: import_zod5.z.array(import_zod5.z.string()).default([]) }).optional(),
  /** Refused: the project loader fills section `stamp` (versioning spec 2.4). */
  stamp: import_zod5.z.never({ error: STAMP_REFUSED }).optional()
}).loose().superRefine((config, ctx) => {
  if ("stamp" in config.modules) ctx.addIssue({ code: "custom", path: ["modules", "stamp"], message: STAMP_REFUSED });
});

// src/kernel/index.mts
var import_zod6 = require("zod");

// src/commands/extensions.mts
var EXTENSION_PREFIX = "qa-";
function extensionNames(sections = {}) {
  return Object.keys(sections).filter((name) => name.startsWith(EXTENSION_PREFIX)).sort();
}
function isExtension(value) {
  return typeof value === "object" && value !== null && typeof value.name === "string";
}
async function loadExtensions(root, sections = {}) {
  const out = [];
  for (const name of extensionNames(sections)) {
    const specifier = `@launchwrighthq/${name}`;
    let ns;
    try {
      ns = await import((0, import_node_url.pathToFileURL)(resolveImport(specifier, root)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.extension", `The config enables module ${name}, and ${specifier} does not load from ${root}. Install the package or remove section ${name}.`, {
        cause,
        context: { module: name }
      });
    }
    if (!isExtension(ns.qaExtension)) {
      throw new LaunchwrightError("qa.extension", `${specifier} exports no qaExtension, so lw qa cannot use module ${name}.`, { context: { module: name } });
    }
    out.push(ns.qaExtension);
  }
  return out;
}
function extensionTargets(extensions, config, root) {
  return Object.assign({}, ...extensions.map((e) => e.targets?.(config, root) ?? {}));
}

// src/config.mts
var legConfig = import_zod6.z.object({
  surface: import_zod6.z.enum(["web", "miniapp", "bot"]),
  target: import_zod6.z.string().min(1),
  device: import_zod6.z.string().optional(),
  descriptor: import_zod6.z.string().optional(),
  viewport: import_zod6.z.object({ width: import_zod6.z.number().int().positive(), height: import_zod6.z.number().int().positive() }).optional(),
  deviceScaleFactor: import_zod6.z.number().positive().optional(),
  userAgent: import_zod6.z.string().optional(),
  browser: import_zod6.z.enum(["chromium", "webkit", "firefox"]).optional(),
  bot: import_zod6.z.string().optional()
});
var qaConfig = import_zod6.z.object({
  reportDir: import_zod6.z.string().default("docs/qa"),
  /** The QA database name. Default: `<dev.project>_qa`, resolved by the world submodule. */
  database: import_zod6.z.string().optional(),
  apiPort: import_zod6.z.number().int().positive().default(9101),
  /**
   * The project module, relative to the project root, that exports `qaApp`: the factory of the
   * QA app (`create`) and its HTTP handler (`serve`). The world submodule boots it on the QA database.
   */
  app: import_zod6.z.string().default("{app:api}/src/main.mts"),
  /** The fake Bot API that the QA app calls (`telegram.apiUrl`). The `lw qa telegram` server. */
  telegramUrl: import_zod6.z.url().default("http://127.0.0.1:9102"),
  /** The project's base seed command, run before the persona and fact seeds. */
  seed: import_zod6.z.string().optional(),
  /**
   * The route that answers the user of a session cookie, for the web persona check (spec 2.6):
   * the `auth` route `session.current`. Move it with `auth.routes.prefix`.
   */
  sessionRoute: import_zod6.z.string().default("/auth/session"),
  /**
   * The route that signs Mini App `initData` in and answers the user, for the Mini App persona
   * check: the `auth` route `telegram.initdata`. `QA_SESSION_PATH` of `client` has the same default.
   */
  miniappSessionRoute: import_zod6.z.string().default("/auth/telegram/initdata"),
  clientRoots: import_zod6.z.array(import_zod6.z.string()).default(["{app:client}/src"]),
  /**
   * The production client builds that `lw qa check` scans for the marker `lw-qa-dev-only`
   * (spec 2.6, rule S3). A missing folder is a finding only with `lw qa check --build`.
   */
  buildDirs: import_zod6.z.array(import_zod6.z.string()).default(["{app:client}/dist"]),
  /** The origin of each surface that `lw qa session run` opens. `--base <surface>=<url>` overrides one. */
  baseUrls: import_zod6.z.partialRecord(import_zod6.z.enum(["web", "miniapp", "bot"]), import_zod6.z.url()).default({}),
  /**
   * The route table files the delivery scan reads (spec 2.7, 2.14 rule C4). A string is a table of
   * the `web` surface. The default is the project route file of main spec 2.26.3.
   */
  routeTables: import_zod6.z.array(import_zod6.z.union([import_zod6.z.string(), import_zod6.z.object({ file: import_zod6.z.string(), surface: import_zod6.z.enum(["web", "miniapp", "bot"]) })])).default(["{app:api}/src/routes.mts"]),
  /** Folders that only declare types, so the state scan can derive the shape of a parameter type. */
  typeRoots: import_zod6.z.array(import_zod6.z.string()).default([]),
  /** Overrides and additions to the default legs (spec 2.3). `false` removes a default leg. */
  legs: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.union([legConfig, import_zod6.z.literal(false)])).default({}),
  /** Mounts `/__qa/*`. Boot refuses it in production (spec 2.6). */
  routes: import_zod6.z.boolean().default(false),
  evidence: import_zod6.z.object({
    blankStdDev: import_zod6.z.number().nonnegative().default(2),
    videoCapS: import_zod6.z.number().positive().default(170),
    blackRatio: import_zod6.z.number().min(0).max(1).default(0.95),
    attempts: import_zod6.z.number().int().positive().default(3)
  }).prefault({}),
  /** Key of module `qa-device`, which parses it. The core keeps it whole. */
  device: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.unknown()).default({}),
  /** Key of module `qa-intake`, which parses it. The core keeps it whole. */
  intake: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.unknown()).default({}),
  publish: import_zod6.z.object({ storage: import_zod6.z.string().optional() }).prefault({})
});
function withAppPaths(cfg, sections = {}) {
  const apps = sectionApps(sections);
  const dir = (p) => appDir(p, apps);
  const routeTables = cfg.routeTables.map((t) => typeof t === "string" ? dir(t) : { ...t, file: dir(t.file) });
  return { ...cfg, app: dir(cfg.app), clientRoots: cfg.clientRoots.map(dir), buildDirs: cfg.buildDirs.map(dir), routeTables, typeRoots: cfg.typeRoots.map(dir) };
}
function qaConfigOf(sections = {}) {
  return withAppPaths(qaConfig.parse(sections.qa ?? {}), sections);
}

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION = "1";
var QA_TARGET_CAPABILITIES = ["input", "screenshot", "video", "webview", "native", "telegram"];

// src/drivers/target/fake.mts
var import_node_fs4 = require("fs");
var import_node_path4 = require("path");

// src/services/png.mts
var import_node_zlib = require("zlib");
var MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];
function pngSize(bytes) {
  if (bytes.length < 24) return null;
  for (let i = 0; i < MAGIC.length; i += 1) if (bytes[i] !== MAGIC[i]) return null;
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}
function encodePng(width, height, rgba) {
  if (rgba.length !== width * height * 4) {
    throw new LaunchwrightError("qa.png.size", `encodePng: ${rgba.length} bytes is not ${width}x${height} RGBA`);
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from(MAGIC), chunk("IHDR", ihdr), chunk("IDAT", (0, import_node_zlib.deflateSync)(raw)), chunk("IEND", Buffer.alloc(0))]);
}
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 4294967295;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// src/drivers/target/fake.mts
var FAKE_SHOT_SIZE = { width: 64, height: 40 };
var FAKE_CLIP_MS = 2e3;
var DEFAULT_CAPABILITIES = ["input", "screenshot", "video", "webview"];
function fakePng(width, height, flat = false) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dark = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const value = flat ? 128 : dark ? 32 : 224;
      rgba.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  return Buffer.from(encodePng(width, height, rgba));
}
var CLIP_BASE64 = "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";
var FAKE_CLIP = Buffer.from(CLIP_BASE64, "base64");
function write(path, bytes) {
  (0, import_node_fs4.mkdirSync)((0, import_node_path4.dirname)(path), { recursive: true });
  (0, import_node_fs4.writeFileSync)(path, bytes);
}
function capabilityError(target, capability, what) {
  return new LaunchwrightError("qa.target.capability", `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability }
  });
}
var FakeSession = class {
  constructor(target, log) {
    this.target = target;
    this.log = log;
  }
  target;
  log;
  route = "/";
  history = [];
  lines = [];
  videoPath = null;
  videoStart = 0;
  page() {
    return this.target.routes[this.route] ?? {};
  }
  alive(call) {
    if (this.log.closed) throw new LaunchwrightError("qa.target.closed", `The fake session is closed; ${call} needs an open session.`);
    this.log.calls.push(call);
  }
  go(route) {
    const landed = this.target.routes[route]?.redirect ?? route;
    this.route = landed;
    for (const line of this.page().logs ?? []) this.lines.push({ at: this.target.clock.date().toISOString(), ...line });
  }
  has(selector) {
    return selector === "body" || (this.page().selectors ?? []).includes(selector) || selector in (this.page().links ?? {});
  }
  async navigate(route) {
    this.alive(`navigate ${route}`);
    this.history.push(this.route);
    this.go(route);
  }
  async act(step) {
    this.alive(`act ${step.kind}${step.target ? ` ${step.target}` : ""}`);
    if (!this.target.capabilities.has("input")) throw capabilityError(this.target.name, "input", `run the act ${step.kind}`);
    if ((step.kind === "click" || step.kind === "type") && (!step.target || !this.has(step.target))) {
      throw new LaunchwrightError("qa.target.act", `The act ${step.kind} found no element for ${step.target ?? "(no target)"} on ${this.route}.`, {
        context: { act: step, route: this.route }
      });
    }
    if (step.kind === "click" && step.target) {
      const next = this.page().links?.[step.target];
      if (next !== void 0) {
        this.history.push(this.route);
        this.go(next);
      }
    }
    if (step.kind === "back") {
      const previous = this.history.pop();
      if (previous !== void 0) this.route = previous;
    }
  }
  async settle(rule) {
    this.alive("settle");
    const page = this.page();
    const missing = [];
    if (rule.selector !== void 0 && !this.has(rule.selector)) missing.push(`selector ${rule.selector}`);
    if (rule.artwork && !page.artwork) missing.push("artwork");
    if (rule.video && !page.video) missing.push("a playing video");
    if (rule.busy && page.busy) missing.push("no aria-busy element");
    if (missing.length > 0) {
      throw new LaunchwrightError("qa.target.settle", `The fake page ${this.route} never showed ${missing.join(", ")}.`, {
        context: { route: this.route, rule }
      });
    }
  }
  async currentRoute() {
    this.alive("currentRoute");
    return this.route;
  }
  async screenshot(path) {
    this.alive(`screenshot ${path}`);
    if (!this.target.capabilities.has("screenshot")) throw capabilityError(this.target.name, "screenshot", "take a screenshot");
    write(path, fakePng(FAKE_SHOT_SIZE.width, FAKE_SHOT_SIZE.height, this.page().blank === true));
    return { path, ...FAKE_SHOT_SIZE };
  }
  async startVideo(path) {
    this.alive(`startVideo ${path}`);
    if (!this.target.capabilities.has("video")) throw capabilityError(this.target.name, "video", "record a video");
    if (this.videoPath !== null) throw new LaunchwrightError("qa.target.video", `The fake session already records ${this.videoPath}.`);
    this.videoPath = path;
    this.videoStart = this.target.clock.now();
  }
  async stopVideo() {
    this.alive("stopVideo");
    if (!this.target.capabilities.has("video")) throw capabilityError(this.target.name, "video", "record a video");
    if (this.videoPath === null) throw new LaunchwrightError("qa.target.video", "The fake session records no video; call startVideo first.");
    const path = this.videoPath;
    this.videoPath = null;
    write(path, FAKE_CLIP);
    return { path, durationMs: Math.max(FAKE_CLIP_MS, this.target.clock.now() - this.videoStart) };
  }
  async trace(path) {
    this.alive(`trace ${path}`);
    if (!this.target.writesTrace) return null;
    write(path, `fake trace of ${this.log.opts.leg.name}
`);
    return path;
  }
  async dump(path) {
    this.alive(`dump ${path}`);
    if (!this.target.writesDump) return null;
    write(path, `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy route="${this.route}"/>
`);
    return path;
  }
  async logs() {
    this.alive("logs");
    return [...this.lines];
  }
  async close() {
    if (this.log.closed) return;
    this.log.calls.push("close");
    this.log.closed = true;
  }
};
var FakeTargetImpl = class {
  specVersion = QA_TARGET_SPEC_VERSION;
  name;
  capabilities;
  sessions = [];
  routes;
  clock;
  writesTrace;
  writesDump;
  readiness;
  constructor(opts) {
    this.name = opts.name ?? "fake";
    this.capabilities = new Set(opts.capabilities ?? DEFAULT_CAPABILITIES);
    this.routes = opts.routes ?? {};
    this.clock = opts.clock ?? systemClock;
    this.writesTrace = opts.trace ?? false;
    this.writesDump = opts.dump ?? false;
    this.readiness = opts.readiness ?? { ready: true };
  }
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async ready(_leg) {
    return this.readiness;
  }
  async open(opts) {
    if (!this.readiness.ready) {
      throw new LaunchwrightError("qa.target.not-ready", `The ${this.name} target is not ready: ${this.readiness.reason ?? "no reason given"}.`);
    }
    const log = { opts, calls: [], closed: false };
    this.sessions.push(log);
    return new FakeSession(this, log);
  }
};
function createFakeTarget(opts = {}) {
  return new FakeTargetImpl(opts);
}

// src/drivers/target/playwright.mts
var import_node_fs5 = require("fs");
var import_node_path5 = require("path");

// src/services/video.mts
var import_node_child_process = require("child_process");
var MIN_VIDEO_S = 1;

// src/drivers/target/playwright.mts
var PERSONA_SESSION_ROUTE = "/__qa/session";
var CAPABILITIES = ["input", "screenshot", "video", "webview"];
var MIN_CLIP_MS = MIN_VIDEO_S * 1e3 + 500;
var importPlaywright = () => import("@playwright/test");
async function loadPlaywright() {
  try {
    return await importPlaywright();
  } catch (err) {
    throw new LaunchwrightError("qa.target.playwright", "The playwright target needs @playwright/test. Run: pnpm add -D @playwright/test", { cause: err });
  }
}
function browserOf(pw, leg, descriptor) {
  const name = leg.browser ?? descriptor?.defaultBrowserType ?? "chromium";
  return pw[name];
}
function contextOptions(pw, leg) {
  let base = {};
  if (leg.descriptor !== void 0) {
    const found = pw.devices[leg.descriptor];
    if (!found) {
      throw new LaunchwrightError("qa.target.descriptor", `Leg ${leg.name} names the device descriptor "${leg.descriptor}", which Playwright does not know.`, {
        context: { leg: leg.name, descriptor: leg.descriptor }
      });
    }
    base = { ...found };
  }
  return {
    ...base,
    ...leg.viewport ? { viewport: leg.viewport } : {},
    ...leg.deviceScaleFactor !== void 0 ? { deviceScaleFactor: leg.deviceScaleFactor } : {},
    ...leg.userAgent !== void 0 ? { userAgent: leg.userAgent } : {}
  };
}
function basePath(baseUrl) {
  return new URL(baseUrl).pathname.replace(/\/+$/, "");
}
function routeUrl(baseUrl, route, persona) {
  const base = new URL(baseUrl);
  const url = new URL(`${base.origin}${basePath(baseUrl)}${route.startsWith("/") ? route : `/${route}`}`);
  if (persona !== void 0) url.searchParams.set("qa", persona);
  return url.href;
}
function relativeRoute(baseUrl, pageUrl) {
  const base = basePath(baseUrl);
  let path = new URL(pageUrl).pathname;
  if (base !== "" && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length);
  path = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return path === "" ? "/" : path;
}
var SETTLE_SCRIPTS = {
  artwork: () => {
    const images = [...document.images];
    if (images.length > 0) return images.every((i) => i.complete && i.naturalWidth > 0);
    return [...document.querySelectorAll("body *")].some((el) => getComputedStyle(el).backgroundImage.includes("url("));
  },
  video: () => [...document.querySelectorAll("video")].some((v) => v.readyState >= 2 && v.videoWidth > 0 && !v.paused),
  busy: () => document.querySelector('[aria-busy="true"]') === null
};
var PlaywrightSession = class {
  constructor(target, opts, browser, context, page) {
    this.target = target;
    this.opts = opts;
    this.browser = browser;
    this.context = context;
    this.page = page;
    const at = () => target.clock.date().toISOString();
    page.on("pageerror", (err) => this.lines.push({ at: at(), kind: "page-error", text: err.message }));
    page.on("console", (msg) => {
      if (msg.type() === "error") this.lines.push({ at: at(), kind: "console-error", text: msg.text() });
    });
    page.on(
      "requestfailed",
      (req) => this.lines.push({ at: at(), kind: "request-failed", text: `${req.method()} ${req.url()}: ${req.failure()?.errorText ?? "failed"}` })
    );
    page.on("response", (res) => {
      if (res.status() >= 500) this.lines.push({ at: at(), kind: "response-5xx", text: `${res.status()} ${res.request().method()} ${res.url()}` });
    });
  }
  target;
  opts;
  browser;
  context;
  page;
  lines = [];
  tracing = true;
  videoPath = null;
  videoStart = 0;
  closed = false;
  /**
   * `?qa=<persona>` launches a persona on the miniapp surface (spec 2.6). On the bot surface the
   * row's route opens the persona's chat on `/__tg`.
   */
  queryPersona() {
    return this.opts.leg.surface === "miniapp" ? this.opts.persona : void 0;
  }
  fail(code, message, err, context = {}) {
    return new LaunchwrightError(code, message, { cause: err, context: { leg: this.opts.leg.name, ...context } });
  }
  async navigate(route) {
    const url = routeUrl(this.opts.baseUrl, route, this.queryPersona());
    try {
      await this.page.goto(url, { waitUntil: "load" });
    } catch (err) {
      throw this.fail("qa.target.navigate", `Leg ${this.opts.leg.name} could not open ${route}.`, err, { route });
    }
  }
  async act(step) {
    const timeout = this.target.actTimeoutMs;
    const what = `${step.kind}${step.target ? ` ${step.target}` : ""}`;
    try {
      switch (step.kind) {
        case "click":
          await this.page.locator(required(step.target, "click")).first().click({ timeout });
          return;
        case "type":
          await this.page.locator(required(step.target, "type")).first().fill(step.text ?? "", { timeout });
          return;
        case "press": {
          const key = required(step.key ?? step.text, "press");
          if (step.target) await this.page.locator(step.target).first().press(key, { timeout });
          else await this.page.keyboard.press(key);
          return;
        }
        case "scroll":
          await this.scroll(step.dx ?? 0, step.dy ?? 0);
          return;
        case "wait":
          await this.target.clock.sleep(step.ms ?? 0);
          return;
        case "back":
          await this.page.goBack({ waitUntil: "load" });
          return;
      }
    } catch (err) {
      if (err instanceof LaunchwrightError && err.code === "qa.target.act") throw err;
      throw this.fail("qa.target.act", `Leg ${this.opts.leg.name} could not run the act ${what}.`, err, { act: step });
    }
  }
  /** Scrolls the app's own scroll root `[data-page-scroll]`, else the document, and checks that it moved. */
  async scroll(dx, dy) {
    const moved = await this.page.evaluate(
      ([x, y]) => {
        const root = document.querySelector("[data-page-scroll]");
        const el = root ?? document.scrollingElement ?? document.documentElement;
        const before = [el.scrollLeft, el.scrollTop];
        el.scrollBy(x, y);
        return { marked: root !== null, moved: el.scrollLeft !== before[0] || el.scrollTop !== before[1] };
      },
      [dx, dy]
    );
    if (!moved.marked && !moved.moved) {
      throw new LaunchwrightError("qa.target.act", `The act scroll ${dx},${dy} found no [data-page-scroll] root and the document did not move.`, {
        context: { leg: this.opts.leg.name }
      });
    }
  }
  async settle(rule) {
    const timeout = rule.timeout ?? this.target.settleTimeoutMs;
    try {
      if (rule.selector !== void 0) await this.page.locator(rule.selector).first().waitFor({ state: "visible", timeout });
      if (rule.artwork) await this.page.waitForFunction(SETTLE_SCRIPTS.artwork, void 0, { timeout });
      if (rule.video) await this.page.waitForFunction(SETTLE_SCRIPTS.video, void 0, { timeout });
      if (rule.busy) await this.page.waitForFunction(SETTLE_SCRIPTS.busy, void 0, { timeout });
    } catch (err) {
      throw this.fail("qa.target.settle", `Leg ${this.opts.leg.name} did not settle in ${timeout} ms on ${JSON.stringify(rule)}.`, err, { rule });
    }
  }
  async currentRoute() {
    return relativeRoute(this.opts.baseUrl, this.page.url());
  }
  async screenshot(path) {
    (0, import_node_fs5.mkdirSync)((0, import_node_path5.dirname)(path), { recursive: true });
    const png = await this.page.screenshot({ path, animations: "disabled", fullPage: false });
    const size = pngSize(png);
    if (size === null) throw new LaunchwrightError("qa.target.screenshot", `Leg ${this.opts.leg.name} wrote a screenshot that is not a PNG: ${path}.`);
    return { path, ...size };
  }
  async startVideo(path) {
    if (this.videoPath !== null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} already records ${this.videoPath}.`);
    (0, import_node_fs5.mkdirSync)((0, import_node_path5.dirname)(path), { recursive: true });
    const size = this.page.viewportSize() ?? void 0;
    await this.page.screencast.start({ path, ...size ? { size } : {} });
    this.videoPath = path;
    this.videoStart = this.target.clock.now();
  }
  async stopVideo() {
    if (this.videoPath === null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} records no video; call startVideo first.`);
    const path = this.videoPath;
    this.videoPath = null;
    const held = this.target.clock.now() - this.videoStart;
    if (held < MIN_CLIP_MS) await this.target.clock.sleep(MIN_CLIP_MS - held);
    await this.page.screencast.stop();
    return { path, durationMs: this.target.clock.now() - this.videoStart };
  }
  async trace(path) {
    if (!this.tracing) return null;
    this.tracing = false;
    (0, import_node_fs5.mkdirSync)((0, import_node_path5.dirname)(path), { recursive: true });
    await this.context.tracing.stop({ path });
    return path;
  }
  /** The browser target has no accessibility dump file; Android rows carry one (spec 2.11.1). */
  async dump(_path) {
    return null;
  }
  async logs() {
    return [...this.lines];
  }
  async evaluate(expression) {
    return this.page.evaluate(expression);
  }
  routable() {
    return this.page;
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.videoPath !== null) await this.page.screencast.stop();
      if (this.tracing) await this.context.tracing.stop();
      await this.context.close();
    } finally {
      await this.browser.close();
    }
  }
};
function required(value, kind) {
  if (value === void 0 || value === "") {
    throw new LaunchwrightError("qa.target.act", `The act ${kind} needs a ${kind === "press" ? "key" : "target"}.`, { context: { kind } });
  }
  return value;
}
var PlaywrightTarget = class {
  name = "playwright";
  specVersion = QA_TARGET_SPEC_VERSION;
  capabilities = new Set(CAPABILITIES);
  clock;
  actTimeoutMs;
  settleTimeoutMs;
  executablePath;
  constructor(opts) {
    this.clock = opts.clock ?? systemClock;
    this.actTimeoutMs = opts.actTimeoutMs ?? 15e3;
    this.settleTimeoutMs = opts.settleTimeoutMs ?? 2e4;
    this.executablePath = opts.executablePath;
  }
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async launch(pw, leg) {
    const { defaultBrowserType, ...options } = contextOptions(pw, leg);
    const type = browserOf(pw, leg, { defaultBrowserType });
    const browser = await type.launch({ headless: true, ...this.executablePath ? { executablePath: this.executablePath } : {} });
    return { browser, options };
  }
  /** Ready when the leg's browser launches. The reason names the install command. */
  async ready(leg) {
    let pw;
    try {
      pw = await loadPlaywright();
    } catch (err) {
      return { ready: false, reason: err.message };
    }
    try {
      const { browser } = await this.launch(pw, leg);
      await browser.close();
      return { ready: true };
    } catch (err) {
      const first = (err.message ?? String(err)).split("\n")[0];
      return { ready: false, reason: `${first}. Run: npx playwright install ${leg.browser ?? "chromium"}` };
    }
  }
  async open(opts) {
    const pw = await loadPlaywright();
    const { browser, options } = await this.launch(pw, opts.leg).catch((err) => {
      throw new LaunchwrightError("qa.target.launch", `Leg ${opts.leg.name} could not launch ${opts.leg.browser ?? "chromium"}.`, { cause: err });
    });
    try {
      const context = await browser.newContext(options);
      await context.tracing.start({ screenshots: true, snapshots: true });
      if (opts.persona !== void 0 && opts.leg.surface === "web") await signIn(context, opts);
      const page = await context.newPage();
      return new PlaywrightSession(this, opts, browser, context, page);
    } catch (err) {
      await browser.close();
      throw err;
    }
  }
};
async function signIn(context, opts) {
  const url = new URL(PERSONA_SESSION_ROUTE, opts.baseUrl).href;
  const res = await context.request.post(url, { data: { persona: opts.persona } });
  if (!res.ok()) {
    throw new LaunchwrightError("qa.target.persona", `POST ${PERSONA_SESSION_ROUTE} for persona ${opts.persona} answered ${res.status()}.`, {
      context: { leg: opts.leg.name, persona: opts.persona, status: res.status() }
    });
  }
}
function createPlaywrightTarget(opts = {}) {
  return new PlaywrightTarget(opts);
}

// src/services/targets.mts
function createTargetRegistry(_config, extra = {}, clock = systemClock) {
  const targets = {
    playwright: createPlaywrightTarget({ clock }),
    fake: createFakeTarget({ clock }),
    ...extra
  };
  return {
    names: () => Object.keys(targets).sort(),
    get(name) {
      const target = targets[name];
      if (!target) {
        throw new LaunchwrightError("qa.target.unknown", `No qa.target driver is named ${name}. Targets: ${Object.keys(targets).sort().join(", ") || "none"}.`, {
          context: { target: name }
        });
      }
      return target;
    },
    add(more) {
      for (const [name, target] of Object.entries(more)) {
        if (targets[name]) throw new LaunchwrightError("qa.target.duplicate", `A qa.target driver named ${name} is already registered.`, { context: { target: name } });
        targets[name] = target;
      }
    }
  };
}

// src/tokens.mts
var QA_TARGETS = token("qa.targets");

// src/world/services/clock.mts
var ShiftClock = class {
  constructor(base) {
    this.base = base;
  }
  base;
  offsetMs = 0;
  now() {
    return this.base.now() + this.offsetMs;
  }
  date() {
    return new Date(this.now());
  }
  sleep(ms, signal) {
    return this.base.sleep(ms, signal);
  }
  /** Moves the clock by `ms`. A negative shift moves it back. */
  shift(ms) {
    this.offsetMs += ms;
  }
  /** Puts the clock back on its base. */
  reset() {
    this.offsetMs = 0;
  }
};

// src/provider.mts
var qaProvider = provider({
  name: "qa",
  requires: ["kernel"],
  config: { section: "qa", schema: qaConfig },
  register(app) {
    const cfg = app.get(CONFIG).section("qa");
    if (cfg.routes && app.config.env === "production") {
      throw new BootError(
        "qa.routes.production",
        `Boot failed in module "qa": key "qa.routes" is on in the production environment. The /__qa routes sign any persona in; turn qa.routes off. Check ${app.config.envFile}.`,
        { context: { module: "qa", key: "qa.routes", envFile: app.config.envFile } }
      );
    }
    if (cfg.routes) app.instance(CLOCK, new ShiftClock(app.get(CLOCK)));
    app.singleton(QA_TARGETS, (c) => createTargetRegistry(c.get(CONFIG).section("qa")));
  }
});

// src/services/mime.mts
var EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "text/plain": "txt",
  "application/json": "json"
};
function extensionOf(mime) {
  return EXTENSIONS[mime] ?? "bin";
}
function mimeOfExtension(name) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === void 0) return null;
  if (ext === "jpeg") return "image/jpeg";
  return Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] ?? null;
}

// src/services/records.mts
var import_promises3 = require("fs/promises");
var import_node_path6 = require("path");

// src/kernel/services/fs.mts
var import_node_crypto2 = require("crypto");
var import_node_fs6 = require("fs");
var import_promises2 = require("fs/promises");
var import_smol_toml2 = require("smol-toml");
var MISSING = /* @__PURE__ */ new Set(["ENOENT", "ENOTDIR"]);
function isMissing(err) {
  return MISSING.has(String(err?.code));
}
function readError(path, cause) {
  return new LaunchwrightError("kernel.fs.read", `Cannot read ${path}`, { cause, context: { path } });
}
async function readTextOrNull(path) {
  try {
    return await (0, import_promises2.readFile)(path, "utf8");
  } catch (cause) {
    if (isMissing(cause)) return null;
    throw readError(path, cause);
  }
}
function sha256(data) {
  return (0, import_node_crypto2.createHash)("sha256").update(data).digest("hex");
}

// src/services/types.mts
var ACT_KINDS = ["click", "type", "press", "scroll", "wait", "back"];
var ROW_FAILURES = ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error", "expect", "crashed"];
var REPORT_STATUSES = ["planned", "passed", "failed", "partial"];
var INTAKE_DIR = ".lw/qa/intake";

// src/services/records.mts
var ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
function recordId(...parts) {
  return parts.map((p) => String(p).replace(/^@/, "").replace(/[^A-Za-z0-9_.-]+/g, "-")).join("-");
}
function recordDir(root, id) {
  if (!ID.test(id) || id.includes("..")) throw new LaunchwrightError("qa.intake.id", `The intake id "${id}" has a character outside A-Z, a-z, 0-9, _, . and -.`, { context: { id } });
  return (0, import_node_path6.join)(root, INTAKE_DIR, id);
}
function fileName(index, m) {
  const ext = extensionOf(m.mime);
  const stem = (m.name ?? m.kind).replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40) || m.kind;
  return `${String(index).padStart(2, "0")}-${stem}.${ext}`;
}
function quote(text) {
  return text === "" ? "> (no text)" : text.split("\n").map((l) => `> ${l}`).join("\n");
}
function issueMarkdown(issue) {
  const lines = [
    `# ${issue.title}`,
    "",
    `- Id: ${issue.id}`,
    `- Source: ${issue.source}`,
    `- Ref: ${issue.ref}`,
    `- Reported at: ${issue.reportedAt}`,
    `- Reporter: ${issue.reporter}`,
    "",
    quote(issue.text)
  ];
  if (issue.thread.length > 0) {
    lines.push("", "## Thread");
    for (const t of issue.thread) lines.push("", `${t.at}, ${t.author}:`, "", quote(t.text));
  }
  if (issue.attachments.length > 0) {
    lines.push("", "## Attachments", "");
    for (const a of issue.attachments) {
      const link = a.kind === "image" ? `![${a.path}](${a.path})` : `[${a.path}](${a.path})`;
      lines.push(`- ${a.kind}, ${a.mime}, ${a.bytes} bytes: ${link}`);
    }
  }
  if (issue.skipped.length > 0) {
    lines.push("", "## Skipped", "");
    for (const s of issue.skipped) lines.push(`- ${s.reason}: ${s.from}`);
  }
  return `${lines.join("\n")}
`;
}
async function writeIssue(root, draft) {
  const dir = recordDir(root, draft.id);
  await (0, import_promises3.rm)(dir, { recursive: true, force: true });
  await (0, import_promises3.mkdir)((0, import_node_path6.join)(dir, "assets"), { recursive: true });
  const { media, ...rest } = draft;
  const issue = { ...rest, attachments: [], skipped: [] };
  let index = 0;
  for (const m of media) {
    if (m.data === void 0) {
      issue.skipped.push({ from: m.from, reason: m.skipped ?? "unreachable" });
      continue;
    }
    index += 1;
    const path = `assets/${fileName(index, m)}`;
    await (0, import_promises3.writeFile)((0, import_node_path6.join)(dir, path), m.data);
    issue.attachments.push({
      kind: m.kind,
      path,
      sha256: sha256(m.data),
      bytes: m.data.byteLength,
      mime: m.mime,
      from: m.from
    });
  }
  await (0, import_promises3.writeFile)((0, import_node_path6.join)(dir, "issue.json"), `${JSON.stringify(issue, null, 2)}
`);
  await (0, import_promises3.writeFile)((0, import_node_path6.join)(dir, "issue.md"), issueMarkdown(issue));
  return issue;
}
async function readIssue(root, id) {
  const file = (0, import_node_path6.join)(recordDir(root, id), "issue.json");
  let text;
  try {
    text = await (0, import_promises3.readFile)(file, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.intake.missing", `No intake record ${id}. Run lw qa intake list.`, { cause, context: { id } });
  }
  return JSON.parse(text);
}
async function listIssues(root) {
  const base = (0, import_node_path6.join)(root, INTAKE_DIR);
  let names;
  try {
    names = (await (0, import_promises3.readdir)(base, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.intake.read", `Cannot read ${INTAKE_DIR}.`, { cause });
  }
  const out = [];
  for (const name of names.sort()) {
    let text;
    try {
      text = await (0, import_promises3.readFile)((0, import_node_path6.join)(base, name, "issue.json"), "utf8");
    } catch (cause) {
      if (cause.code === "ENOENT") continue;
      throw new LaunchwrightError("qa.intake.read", `Cannot read the intake record ${name}.`, { cause });
    }
    out.push(JSON.parse(text));
  }
  return out;
}

// src/services/contract.mts
var import_promises4 = require("fs/promises");
var import_node_path7 = require("path");
var GROUP_ORDER = { credentials: 0, devices: 1, outward: 2, data: 3 };
var DEVICE_RIGS = {
  "android-adb": "An Android device over adb",
  "android-emulator": "The Android emulator",
  "ios-webkit": "An iOS device over WebKit",
  "ios-simulator": "The iOS simulator",
  browserstack: "A BrowserStack slot"
};
var NAME2 = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FINGERPRINT = /^[0-9a-f]{1,16}$/;
var HEX64 = /^[0-9a-f]{64}$/;
function credentialItem(need) {
  if (Object.hasOwn(need, "value")) {
    throw new LaunchwrightError("qa.consent.secret", `The credential ${need.key} carries a value. Pass set/empty and a short hash only, never the secret.`, { context: { key: need.key } });
  }
  if (need.fingerprint !== void 0 && !FINGERPRINT.test(need.fingerprint)) {
    throw new LaunchwrightError("qa.consent.fingerprint", `The fingerprint of ${need.key} is not a short sha256 of 1 to 16 hex characters. It must never be the value.`, { context: { key: need.key } });
  }
  const item = { id: `credentials:${need.key}`, group: "credentials", title: `${need.key} (${need.present ? "set" : "empty"})`, outward: false, key: need.key, present: need.present };
  if (need.present && need.fingerprint !== void 0) item.fingerprint = need.fingerprint;
  return item;
}
function deviceItems(legs) {
  const items = /* @__PURE__ */ new Map();
  for (const leg of legs) {
    const rig = DEVICE_RIGS[leg.target];
    if (rig === void 0) continue;
    const id = leg.device ? `devices:${leg.target}:${leg.device}` : `devices:${leg.target}`;
    items.set(id, { id, group: "devices", title: leg.device ? `${rig} (${leg.device})` : rig, outward: false });
  }
  return [...items.values()];
}
function namedItem(group, need) {
  if (!NAME2.test(need.id)) {
    throw new LaunchwrightError("qa.consent.id", `The ${group} id "${need.id}" is not kebab case, for example "throwaway-bot".`, { context: { id: need.id } });
  }
  return { id: `${group}:${need.id}`, group, title: need.title, outward: group === "outward" };
}
function computeManifest(input) {
  const items = /* @__PURE__ */ new Map();
  const add = (item) => {
    items.set(item.id, item);
  };
  for (const need of input.credentials ?? []) add(credentialItem(need));
  for (const item of deviceItems(input.legs ?? [])) add(item);
  for (const need of input.outward ?? []) add(namedItem("outward", need));
  for (const need of input.data ?? []) add(namedItem("data", need));
  const sorted = [...items.values()].sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { title: input.title, items: sorted };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v !== void 0) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}
function manifestHash(manifest) {
  return sha256(JSON.stringify(canonical(manifest)));
}
function grant(manifest, choices) {
  const grants = [];
  for (const item of manifest.items) {
    if (choices === "all") grants.push({ id: item.id, via: "all" });
    else if (choices[item.id] === true) grants.push({ id: item.id, via: "item" });
  }
  return { hash: manifestHash(manifest), grants };
}
function diff(prior, manifest) {
  const granted = new Set((prior?.grants ?? []).map((g) => g.id));
  return manifest.items.filter((item) => !granted.has(item.id));
}
function fileConsentStore(dir) {
  const fileFor2 = (hash) => {
    if (!HEX64.test(hash)) throw new LaunchwrightError("qa.consent.hash", `A consent hash is 64 hex characters, not "${hash}".`, { context: { hash } });
    return (0, import_node_path7.join)(dir, `${hash}.json`);
  };
  return {
    async read(hash) {
      const file = fileFor2(hash);
      const text = await readTextOrNull(file);
      if (text === null) return null;
      try {
        return JSON.parse(text);
      } catch (cause) {
        throw new LaunchwrightError("qa.consent.read", `The consent record ${file} is not JSON.`, { cause, context: { hash } });
      }
    },
    async write(hash, record) {
      const file = fileFor2(hash);
      await (0, import_promises4.mkdir)(dir, { recursive: true });
      await (0, import_promises4.writeFile)(file, `${JSON.stringify(record, null, 2)}
`);
    }
  };
}

// src/services/botfather.mts
var BOTFATHER = "BotFather";
var DELETE_CONFIRM = "Yes, I am totally sure.";
var BOT_TOKEN = /(\d{6,12}:[A-Za-z0-9_-]{30,})/;
var RATE_LIMIT = /too many (requests|attempts)|try again later|retry after/i;
function parseBotToken(reply) {
  const match = BOT_TOKEN.exec(reply);
  if (!match) {
    throw new LaunchwrightError("qa.bot.token", "BotFather returned no bot token. The /newbot flow did not finish, or the wording changed.");
  }
  return match[1];
}
function botIdOf(token2) {
  const id = Number.parseInt(token2.slice(0, token2.indexOf(":")), 10);
  if (!Number.isInteger(id) || id <= 0) throw new LaunchwrightError("qa.bot.token", "The bot token has no numeric bot id before the colon.");
  return id;
}
async function exchange(chat, text) {
  await chat.send(text);
  const reply = await chat.reply();
  if (RATE_LIMIT.test(reply)) {
    throw new LaunchwrightError("qa.bot.ratelimit", "BotFather rate-limited the lifecycle. Wait and run the command again.");
  }
  return reply;
}
function handleOf(username) {
  return username.startsWith("@") ? username : `@${username}`;
}
async function newBot(chat, opts) {
  if (!/bot$/i.test(opts.username)) {
    throw new LaunchwrightError("qa.bot.username", `A bot username must end in "bot", not "${opts.username}".`, { context: { username: opts.username } });
  }
  await exchange(chat, "/newbot");
  await exchange(chat, opts.name);
  const reply = await exchange(chat, opts.username);
  const token2 = parseBotToken(reply);
  return { botId: botIdOf(token2), username: opts.username, token: token2 };
}
async function configureBot(chat, opts) {
  const handle2 = handleOf(opts.username);
  if (opts.commands && opts.commands.length > 0) {
    await exchange(chat, "/setcommands");
    await exchange(chat, handle2);
    await exchange(chat, opts.commands.map((c) => `${c.command} - ${c.description}`).join("\n"));
  }
  await exchange(chat, "/setprivacy");
  await exchange(chat, handle2);
  await exchange(chat, opts.privacy ?? true ? "Enable" : "Disable");
}
async function destroyBot(chat, getMe, record) {
  const handle2 = handleOf(record.username);
  await exchange(chat, "/revoke");
  await exchange(chat, handle2);
  await exchange(chat, "/deletebot");
  await exchange(chat, handle2);
  await exchange(chat, DELETE_CONFIRM);
  const me = await getMe(record.token);
  if (me.status !== 401) {
    throw new LaunchwrightError("qa.bot.alive", `The throwaway bot ${record.botId} still answers getMe with ${me.status}, so it is not deleted. Run destroy again.`, { context: { botId: record.botId, status: me.status } });
  }
  return { botId: record.botId, username: record.username, status: me.status };
}

// src/services/bot-store.mts
var import_promises5 = require("fs/promises");
var import_node_path8 = require("path");
var BOT_STORE_DIR = ".lw/qa/bots";
function fileFor(dir, botId) {
  if (!Number.isInteger(botId) || botId <= 0) throw new LaunchwrightError("qa.bot.id", `A bot id is a positive integer, not "${botId}".`, { context: { botId } });
  return (0, import_node_path8.join)(dir, `${botId}.json`);
}
function parse2(dir, botId, text) {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError("qa.bot.record", `The bot record ${fileFor(dir, botId)} is not JSON.`, { cause, context: { botId } });
  }
}
function fileBotStore(dir) {
  return {
    async read(botId) {
      const text = await readTextOrNull(fileFor(dir, botId));
      return text === null ? null : parse2(dir, botId, text);
    },
    async write(record) {
      const file = fileFor(dir, record.botId);
      await (0, import_promises5.mkdir)(dir, { recursive: true });
      await (0, import_promises5.writeFile)(file, `${JSON.stringify(record, null, 2)}
`);
    },
    async list() {
      let names;
      try {
        names = (await (0, import_promises5.readdir)(dir)).filter((n) => /^\d+\.json$/.test(n));
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.bot.record", `Cannot read the bot run store ${dir}.`, { cause });
      }
      const out = [];
      for (const name of names.sort()) {
        const botId = Number.parseInt(name, 10);
        const text = await readTextOrNull((0, import_node_path8.join)(dir, name));
        if (text !== null) out.push(parse2(dir, botId, text));
      }
      return out;
    },
    async remove(botId) {
      await (0, import_promises5.rm)(fileFor(dir, botId), { force: true });
    }
  };
}

// src/services/comments.mts
var import_node_crypto3 = require("crypto");
var import_promises6 = require("fs/promises");
var import_node_path9 = require("path");
var COMMENTS_DIR = ".lw/qa/comments";
var ANCHOR_KINDS = ["step", "text", "region", "time", "flow"];
var SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isFraction = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
var isText = (v) => typeof v === "string" && v.trim() !== "";
function validateAnchor(anchor) {
  if (!isObject(anchor)) return ["the anchor is not an object"];
  const kind = anchor.kind;
  if (typeof kind !== "string" || !ANCHOR_KINDS.includes(kind)) {
    return [`kind "${String(kind)}" is not one of ${ANCHOR_KINDS.join(", ")}`];
  }
  const out = [];
  const need = (field, ok, why) => {
    if (!ok) out.push(`${kind} anchor: ${field} ${why}`);
  };
  if (kind === "step") {
    need("row", isText(anchor.row), "is missing");
    need("leg", isText(anchor.leg), "is missing");
    need("attempt", Number.isInteger(anchor.attempt) && anchor.attempt > 0, "must be a positive integer");
    need("step", Number.isInteger(anchor.step) && anchor.step > 0, "must be a positive integer");
  } else if (kind === "text") {
    need("section", isText(anchor.section), "is missing");
    need("quote", isText(anchor.quote), "is missing");
  } else if (kind === "region") {
    need("screenshot", isText(anchor.screenshot), "is missing");
    need("row", isText(anchor.row), "is missing");
    for (const f of ["x", "y", "w", "h"]) need(f, isFraction(anchor[f]), "must be a fraction from 0 to 1");
  } else if (kind === "time") {
    need("video", isText(anchor.video), "is missing");
    need("row", isText(anchor.row), "is missing");
    need("start", typeof anchor.start === "number" && anchor.start >= 0, "must be a number of seconds");
  } else {
    need("name", isText(anchor.name), "is missing");
  }
  return out;
}
function makeComment(input) {
  const problems = validateAnchor(input.anchor);
  if (problems.length > 0) {
    throw new LaunchwrightError("qa.comment.anchor", `The comment anchor is invalid: ${problems.join("; ")}`, { context: { problems } });
  }
  return { id: input.id ?? (0, import_node_crypto3.randomUUID)(), anchor: input.anchor, author: input.author, body: input.body, createdAt: input.createdAt, status: "open", replies: [] };
}
function addComment(list, comment) {
  if (list.some((c) => c.id === comment.id)) {
    throw new LaunchwrightError("qa.comment.duplicate", `A comment with id ${comment.id} already exists.`, { context: { id: comment.id } });
  }
  return [...list, comment];
}
function replyToComment(list, id, reply) {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to reply to.`, { context: { id } });
  return list.map((c) => c.id === id ? { ...c, replies: [...c.replies, reply] } : c);
}
function setStatus(list, id, status) {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to update.`, { context: { id } });
  return list.map((c) => c.id === id ? { ...c, status } : c);
}
function commentsFile(dir, slug) {
  if (!SLUG.test(slug)) throw new LaunchwrightError("qa.comment.slug", `A report slug is "${slug}", which is not a safe file name.`, { context: { slug } });
  return (0, import_node_path9.join)(dir, `${slug}.json`);
}
function fileCommentStore(dir) {
  return {
    async read(slug) {
      const text = await readTextOrNull(commentsFile(dir, slug));
      if (text === null) return [];
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug)} is not JSON.`, { cause, context: { slug } });
      }
      if (!isObject(parsed) || !Array.isArray(parsed.comments)) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug)} has no comments array.`, { context: { slug } });
      }
      return parsed.comments;
    },
    async write(slug, comments) {
      const file = commentsFile(dir, slug);
      await (0, import_promises6.mkdir)(dir, { recursive: true });
      await (0, import_promises6.writeFile)(file, `${JSON.stringify({ slug, comments }, null, 2)}
`);
    }
  };
}

// src/services/manifest.mts
var import_promises7 = require("fs/promises");

// src/services/legs.mts
var CHROME_MAJOR = 145;
var DESKTOP_USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`;
var DEFAULT_LEGS = Object.freeze({
  desktop: {
    surface: "web",
    target: "playwright",
    browser: "chromium",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent: DESKTOP_USER_AGENT
  },
  "mobile-web": { surface: "web", target: "playwright", browser: "chromium", descriptor: "Pixel 7", userAgent: DESKTOP_USER_AGENT },
  miniapp: { surface: "miniapp", target: "playwright", browser: "chromium", descriptor: "Pixel 7" },
  "telegram-fake": { surface: "bot", target: "playwright", browser: "chromium", viewport: { width: 1280, height: 800 } },
  "telegram-android": { surface: "miniapp", target: "android-adb" },
  "safari-ios": { surface: "web", target: "ios-webkit" }
});

// src/services/comment-export.mts
var oneLine = (text) => text.replace(/\s+/g, " ").trim();
var shotOf = (manifest, row) => manifest.shots.find((s) => s.id === row);
var screenState = (shot) => shot ? `${shot.screen} ${shot.state}` : "";
var inLedger = (entries, path) => entries.some((e) => e.path === path);
function stepOfPath(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? Number(m[1]) : null;
}
function stepScreenshot(entries, row, leg, attempt, step) {
  const stepShot = entries.find((e) => e.kind === "step" && e.row === row && e.leg === leg && e.attempt === attempt && stepOfPath(e.path) === step);
  if (stepShot) return stepShot.path;
  return entries.find((e) => e.kind === "screenshot" && e.row === row && e.leg === leg)?.path;
}
var pct = (v) => Math.round(v * 100);
function resolveAnchor(anchor, ctx) {
  if (anchor.kind === "text") {
    const shot2 = shotOf(ctx.manifest, anchor.section);
    const where = shot2 ? `section ${anchor.section} (${screenState(shot2)})` : `section ${anchor.section}`;
    return { target: where, located: `the words "${oneLine(anchor.quote)}"`, orphaned: false };
  }
  if (anchor.kind === "step") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const file = stepScreenshot(ctx.entries, anchor.row, anchor.leg, anchor.attempt, anchor.step);
    return { target: file ?? `${anchor.row} on ${anchor.leg}`, located: `step ${anchor.step} of ${screenState(shot2) || anchor.row} on ${anchor.leg}`, orphaned: false };
  }
  if (anchor.kind === "region") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const near = stepOfPath(anchor.screenshot);
    const rect = `rectangle ${pct(anchor.x)}%,${pct(anchor.y)}% ${pct(anchor.w)}x${pct(anchor.h)}%`;
    const step = near === null ? "the settle screenshot" : `step ${near}`;
    return { target: anchor.screenshot, located: `${rect} of ${screenState(shot2) || anchor.row}, nearest ${step}`, orphaned: !inLedger(ctx.entries, anchor.screenshot) };
  }
  if (anchor.kind === "time") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const span = anchor.end === void 0 ? `t=${anchor.start}s` : `t=${anchor.start}s to ${anchor.end}s`;
    const active = anchor.step === void 0 ? "" : `, step ${anchor.step} then active`;
    return { target: anchor.video, located: `${span} of ${screenState(shot2) || anchor.row}${active}`, orphaned: !inLedger(ctx.entries, anchor.video) };
  }
  const shot = shotOf(ctx.manifest, anchor.name);
  return { target: shot ? `${screenState(shot)} (${anchor.name})` : `flow ${anchor.name}`, located: `flow ${anchor.name}`, orphaned: false };
}
function resolveComments(comments, ctx) {
  return comments.filter((c) => c.status === "open").map((c) => ({ id: c.id, kind: c.anchor.kind, ...resolveAnchor(c.anchor, ctx), note: oneLine(c.body) }));
}
function exportTaskList(comments, ctx) {
  const resolved = resolveComments(comments, ctx);
  if (resolved.length === 0) return "No open comments to act on.";
  const lines = [`${resolved.length} open comment${resolved.length === 1 ? "" : "s"} to act on:`, ""];
  for (const r of resolved) {
    const orphan = r.orphaned ? " (orphaned: the ledger no longer holds this file)" : "";
    lines.push(`- [${r.kind}] ${r.target}${orphan}: ${r.located}. Note: ${r.note}`);
  }
  return lines.join("\n");
}

// src/services/comment-server.mts
var import_node_http = require("http");
var import_promises8 = require("fs/promises");
var import_node_path10 = require("path");
var MAX_BODY = 1024 * 1024;
var sendJson = (res, status, value) => {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
};
var sendText = (res, status, text) => {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
};
function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes <= MAX_BODY) chunks.push(c);
    });
    req.on("end", () => bytes > MAX_BODY ? fail(new LaunchwrightError("qa.comment.body", "The request body is over 1 MiB.")) : ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
}
async function applyOp(body, store, slug, clock) {
  let op;
  try {
    op = JSON.parse(body || "{}");
  } catch (cause) {
    throw new LaunchwrightError("qa.comment.body", "The POST body is not JSON.", { cause });
  }
  if (typeof op !== "object" || op === null) throw new LaunchwrightError("qa.comment.body", "The POST body is not an object.");
  const req = op;
  const list = await store.read(slug);
  const at = clock.date().toISOString();
  let next;
  if (req.op === "add") {
    const c = req.comment;
    next = addComment(list, makeComment({ anchor: c.anchor, author: String(c.author ?? "reviewer"), body: String(c.body ?? ""), createdAt: at }));
  } else if (req.op === "reply") {
    const r = req.reply;
    next = replyToComment(list, String(req.id), { author: String(r.author ?? "reviewer"), body: String(r.body ?? ""), createdAt: at });
  } else if (req.op === "resolve" || req.op === "reopen") {
    next = setStatus(list, String(req.id), req.op === "resolve" ? "resolved" : "open");
  } else {
    throw new LaunchwrightError("qa.comment.op", `The op "${String(req.op)}" is not add, reply, resolve or reopen.`, { context: { op: req.op } });
  }
  await store.write(slug, next);
  return next;
}
async function serveStatic(res, reportDir, pathname) {
  const target = (0, import_node_path10.resolve)(reportDir, `.${pathname}`);
  if (target !== reportDir && !target.startsWith(reportDir + import_node_path10.sep)) {
    sendText(res, 403, "forbidden");
    return;
  }
  let bytes;
  try {
    bytes = await (0, import_promises8.readFile)(target);
  } catch {
    sendText(res, 404, "not found");
    return;
  }
  const mime = mimeOfExtension(target) ?? "application/octet-stream";
  res.writeHead(200, { "content-type": mime, "content-length": bytes.length });
  res.end(bytes);
}
async function handle(req, res, opts, clock) {
  const base = `/${opts.viewerDir}/`;
  const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (pathname === "/" || pathname === base) {
    res.writeHead(302, { location: `${base}index.html` });
    res.end();
    return;
  }
  if (pathname === `${base}comments`) {
    if (req.method === "GET") return sendJson(res, 200, { slug: opts.slug, comments: await opts.store.read(opts.slug) });
    if (req.method === "POST") return sendJson(res, 200, { slug: opts.slug, comments: await applyOp(await readBody(req), opts.store, opts.slug, clock) });
    return sendText(res, 405, "method not allowed");
  }
  if (pathname.startsWith(base)) {
    const name = pathname.slice(base.length);
    const page = opts.renderPages(await opts.store.read(opts.slug)).get(name);
    if (page !== void 0) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
  }
  await serveStatic(res, opts.reportDir, pathname);
}
async function startCommentServer(opts) {
  const host = opts.host ?? "127.0.0.1";
  const clock = opts.clock ?? systemClock;
  const reportDir = (0, import_node_path10.resolve)(opts.reportDir);
  const server = (0, import_node_http.createServer)((req, res) => {
    void handle(req, res, { ...opts, reportDir }, clock).catch((cause) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const code = cause instanceof LaunchwrightError ? cause.code : "qa.comment.server";
      sendJson(res, 400, { error: code });
    });
  });
  await new Promise((ok, fail) => {
    server.once("error", (cause) => fail(new LaunchwrightError("qa.comment.listen", `The comment server cannot listen on ${host}:${opts.port ?? 0}: ${cause.message}`, { cause })));
    server.listen(opts.port ?? 0, host, ok);
  });
  const port = server.address().port;
  const url = `http://${host}:${port}`;
  return {
    port,
    url,
    indexUrl: `${url}/${opts.viewerDir}/index.html`,
    async close() {
      server.closeAllConnections();
      await new Promise((ok, fail) => server.close((err) => err ? fail(err) : ok()));
    }
  };
}

// src/services/score.mts
var DEFAULT_SCORE_WEIGHTS = {
  findings: 0.35,
  console: 0.1,
  coverage: 0.15,
  evidence: 0.1,
  accessibility: 0.15,
  performance: 0.15
};
var SEVERITY_DEDUCTION = { critical: 25, high: 15, medium: 8, low: 3 };
var clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
function deductScore(counts) {
  const lost = (counts.critical ?? 0) * SEVERITY_DEDUCTION.critical + (counts.high ?? 0) * SEVERITY_DEDUCTION.high + (counts.medium ?? 0) * SEVERITY_DEDUCTION.medium + (counts.low ?? 0) * SEVERITY_DEDUCTION.low;
  return Math.max(0, 100 - lost);
}
function consoleScore(errors) {
  if (errors <= 0) return 100;
  if (errors <= 3) return 70;
  if (errors <= 10) return 40;
  return 10;
}
var percentScore = (fraction) => Math.round(clamp(fraction, 0, 1) * 100);
function computeScore(input, weights = {}) {
  const w = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
  const dimensions = {};
  if (input.findings) dimensions.findings = deductScore(input.findings);
  if (input.consoleErrors !== void 0) dimensions.console = consoleScore(input.consoleErrors);
  if (input.coverage !== void 0) dimensions.coverage = percentScore(input.coverage);
  if (input.evidence !== void 0) dimensions.evidence = percentScore(input.evidence);
  if (input.accessibility) dimensions.accessibility = deductScore(input.accessibility);
  if (input.performance) dimensions.performance = deductScore(input.performance);
  let weighted = 0;
  let total = 0;
  for (const dim of Object.keys(dimensions)) {
    const value = dimensions[dim];
    if (value === void 0) continue;
    weighted += value * w[dim];
    total += w[dim];
  }
  const score = total > 0 ? Math.round(weighted / total) : 0;
  const confidenceParts = [];
  if (input.coverage !== void 0) confidenceParts.push(clamp(input.coverage, 0, 1));
  if (input.evidence !== void 0) confidenceParts.push(clamp(input.evidence, 0, 1));
  const confidence = confidenceParts.length > 0 ? Math.min(...confidenceParts) : 0;
  return { score, dimensions, confidence };
}
var NEUTRAL_RING = "#64748b";
var NEUTRAL_TRACK = "#e2e8f0";
var attr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var content = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function renderScoreGauge(score, opts = {}) {
  const size = opts.size ?? 160;
  const value = clamp(Math.round(score), 0, 100);
  const ring = attr(opts.color ?? NEUTRAL_RING);
  const track = attr(opts.track ?? NEUTRAL_TRACK);
  const stroke = Math.max(2, Math.round(size * 0.09));
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value / 100 * circumference;
  const numberSize = Math.round(size * 0.3);
  const font = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const numberY = opts.label ? center - numberSize * 0.12 : center;
  const label = opts.label ? `<text x="${center}" y="${center + numberSize * 0.72}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${Math.round(size * 0.1)}" fill="${track}">${content(opts.label)}</text>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QA score ${value} of 100">`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${track}" stroke-width="${stroke}"/>`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${ring}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${filled.toFixed(3)} ${(circumference - filled).toFixed(3)}" transform="rotate(-90 ${center} ${center})"/>`,
    `<text x="${center}" y="${numberY}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${numberSize}" font-weight="700" fill="${ring}">${value}</text>`,
    label,
    "</svg>"
  ].join("");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ACT_KINDS,
  ANCHOR_KINDS,
  BOTFATHER,
  BOT_STORE_DIR,
  COMMENTS_DIR,
  DEFAULT_SCORE_WEIGHTS,
  DELETE_CONFIRM,
  EXTENSION_PREFIX,
  INTAKE_DIR,
  MIN_VIDEO_S,
  QA_TARGETS,
  QA_TARGET_CAPABILITIES,
  QA_TARGET_SPEC_VERSION,
  REPORT_STATUSES,
  ROW_FAILURES,
  SEVERITY_DEDUCTION,
  addComment,
  botIdOf,
  commentsFile,
  computeManifest,
  computeScore,
  configureBot,
  destroyBot,
  diff,
  exportTaskList,
  extensionNames,
  extensionOf,
  extensionTargets,
  fileBotStore,
  fileCommentStore,
  fileConsentStore,
  grant,
  issueMarkdown,
  listIssues,
  loadExtensions,
  makeComment,
  manifestHash,
  mimeOfExtension,
  newBot,
  parseBotToken,
  pngSize,
  qaConfig,
  qaConfigOf,
  qaProvider,
  readIssue,
  recordDir,
  recordId,
  renderScoreGauge,
  replyToComment,
  resolveComments,
  setStatus,
  startCommentServer,
  validateAnchor,
  withAppPaths,
  writeIssue
});
//# sourceMappingURL=index.cjs.map