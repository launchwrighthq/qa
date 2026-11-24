"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/world/index.mts
var world_exports = {};
__export(world_exports, {
  JOBS_DIR: () => JOBS_DIR,
  QA_PROVIDER: () => QA_PROVIDER,
  QA_TELEGRAM_PORT: () => QA_TELEGRAM_PORT,
  STAMP_FILE: () => STAMP_FILE,
  ShiftClock: () => ShiftClock,
  UNDO_FILE: () => UNDO_FILE,
  WORLD_SUFFIX: () => WORLD_SUFFIX,
  armFact: () => armFact,
  assertQaTarget: () => assertQaTarget,
  assertRegistry: () => assertRegistry,
  baseSeedNames: () => baseSeedNames,
  buildRegistry: () => buildRegistry,
  cleanupWorktrees: () => cleanupWorktrees,
  copyName: () => copyName,
  copyPrefix: () => copyPrefix,
  createFork: () => createFork,
  databaseName: () => databaseName,
  dbAdmin: () => dbAdmin,
  defineWorld: () => defineWorld,
  devProjectName: () => devProjectName,
  disarmFact: () => disarmFact,
  dropFork: () => dropFork,
  factById: () => factById,
  featuresWithoutWorld: () => featuresWithoutWorld,
  fixtureArming: () => fixtureArming,
  forkName: () => forkName,
  forkUndoFile: () => forkUndoFile,
  hookSeedNames: () => hookSeedNames,
  idProblem: () => idProblem,
  importFromProject: () => importFromProject,
  importProjectJobs: () => importProjectJobs,
  isLoopbackHost: () => isLoopbackHost,
  listJobs: () => listJobs,
  listWorld: () => listWorld,
  listenQaApp: () => listenQaApp,
  loadAppEntry: () => loadAppEntry,
  loadRegistry: () => loadRegistry,
  loadWorlds: () => loadWorlds,
  openFork: () => openFork,
  openWorld: () => openWorld,
  parseShift: () => parseShift,
  personaById: () => personaById,
  personaIds: () => personaIds,
  pgAdmin: () => pgAdmin,
  pgliteAdmin: () => pgliteAdmin,
  planWorktree: () => planWorktree,
  qaAccountId: () => qaAccountId,
  qaDatabase: () => qaDatabase,
  qaDbSection: () => qaDbSection,
  qaFakeBots: () => qaFakeBots,
  qaFakeToken: () => qaFakeToken,
  qaSections: () => qaSections,
  qaTargetProblem: () => qaTargetProblem,
  qaTelegramId: () => qaTelegramId,
  rawSqlFindings: () => rawSqlFindings,
  readCheckout: () => readCheckout,
  readStamp: () => readStamp,
  readUndo: () => readUndo,
  registryHash: () => registryHash,
  registryProblem: () => registryProblem,
  resetWorld: () => resetWorld,
  runJob: () => runJob,
  runWorktree: () => runWorktree,
  seedWorld: () => seedWorld,
  seededName: () => seededName,
  serveFork: () => serveFork,
  setEnvLine: () => setEnvLine,
  setMenuButton: () => setMenuButton,
  urlWithDatabase: () => urlWithDatabase,
  worldFiles: () => worldFiles,
  worldForkRunner: () => worldForkRunner,
  worldLintFindings: () => worldLintFindings,
  worldStatus: () => worldStatus
});
module.exports = __toCommonJS(world_exports);

// src/world/services/app.mts
var import_node_crypto3 = require("crypto");
var import_node_path6 = require("path");
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
var DOTTED_CODE = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i;
function isCodedError(e) {
  if (e instanceof LaunchwrightError) return true;
  if (typeof e !== "object" || e === null) return false;
  const { code, message } = e;
  return typeof message === "string" && typeof code === "string" && DOTTED_CODE.test(code);
}
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

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
function appPath(sections, runtime, fallback) {
  return sectionApps(sections).find((a) => a.runtime === runtime)?.path ?? fallback;
}

// src/kernel/services/clock.mts
function abortError(signal) {
  return signal.reason ?? new DOMException("The sleep was aborted", "AbortError");
}
var systemClock = {
  now: () => Date.now(),
  date: () => new Date(Date.now()),
  sleep(ms, signal) {
    return new Promise((resolve6, reject) => {
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
        resolve6();
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

// src/kernel/services/peers.mts
function packageOf(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0] ?? specifier;
}
function missingSpecifier(message) {
  return /['"]([^'"]+)['"]/.exec(message)?.[1];
}
function isMissingPeer(cause, name) {
  if (cause?.code !== "ERR_MODULE_NOT_FOUND") return false;
  const missing = missingSpecifier(String(cause.message ?? ""));
  return missing === name || missing === packageOf(name);
}
async function optionalPeer(name, load) {
  try {
    return await (load ? load() : import(
      /* @vite-ignore */
      name
    ));
  } catch (cause) {
    if (isMissingPeer(cause, name)) return void 0;
    throw new LaunchwrightError("kernel.peer.load", `Cannot load the optional peer ${name}`, { cause, context: { name } });
  }
}

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

// src/services/peers.mts
function isViteMissingPeer(err, spec) {
  if (!isCodedError(err) || err.code !== "kernel.peer.load") return false;
  return messageOf(err.cause).startsWith(`Could not resolve "${spec}" imported by`);
}
async function peerOrUndefined(spec) {
  try {
    return await optionalPeer(spec, () => import(spec));
  } catch (err) {
    if (isViteMissingPeer(err, spec)) return void 0;
    throw err;
  }
}
async function loadPeer(spec, module2) {
  const mod = await peerOrUndefined(spec);
  if (!mod) throw new LaunchwrightError(`qa.${module2}.module`, `This lw qa command needs the ${module2} module. Run lw add ${module2}.`);
  return mod;
}
var DB_PEER = "@launchwrighthq/db";
var loadDb = () => loadPeer(DB_PEER, "db");
var optionalDb = () => peerOrUndefined(DB_PEER);
var HTTP_PEER = "@launchwrighthq/http";
var optionalHttp = () => peerOrUndefined(HTTP_PEER);
var loadAuth = () => loadPeer("@launchwrighthq/auth", "auth");

// src/world/services/checkout.mts
var import_promises3 = require("fs/promises");
var import_node_path4 = require("path");

// src/kernel/services/fs.mts
var import_node_crypto2 = require("crypto");
var import_node_fs4 = require("fs");
var import_promises2 = require("fs/promises");
var import_smol_toml2 = require("smol-toml");
var MISSING = /* @__PURE__ */ new Set(["ENOENT", "ENOTDIR"]);
function isMissing(err) {
  return MISSING.has(String(err?.code));
}
function readError(path, cause) {
  return new LaunchwrightError("kernel.fs.read", `Cannot read ${path}`, { cause, context: { path } });
}
async function pathKind(path) {
  try {
    return (await (0, import_promises2.stat)(path)).isDirectory() ? "dir" : "file";
  } catch (cause) {
    if (isMissing(cause)) return "missing";
    throw readError(path, cause);
  }
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

// src/world/services/checkout.mts
async function text(path) {
  try {
    return (await (0, import_promises3.readFile)(path, "utf8")).trim();
  } catch (cause) {
    throw new LaunchwrightError("qa.checkout.read", `Cannot read ${path}. The git worktree is broken; run git worktree repair.`, { cause });
  }
}
async function readCheckout(root) {
  const start = (0, import_node_path4.resolve)(root);
  for (let dir = start; ; dir = (0, import_node_path4.dirname)(dir)) {
    const kind = await pathKind((0, import_node_path4.join)(dir, ".git"));
    if (kind === "dir") return { root: start, toplevel: dir, commonDir: (0, import_node_path4.join)(dir, ".git"), linked: false, mainRoot: start };
    if (kind === "file") {
      const line = await text((0, import_node_path4.join)(dir, ".git"));
      const match = /^gitdir:\s*(.+)$/.exec(line);
      if (!match) throw new LaunchwrightError("qa.checkout.read", `${(0, import_node_path4.join)(dir, ".git")} does not name a git dir.`);
      const gitDir = (0, import_node_path4.resolve)(dir, match[1]);
      const commonDir = (0, import_node_path4.resolve)(gitDir, await text((0, import_node_path4.join)(gitDir, "commondir")));
      const mainTop = (0, import_node_path4.basename)(commonDir) === ".git" ? (0, import_node_path4.dirname)(commonDir) : commonDir;
      return { root: start, toplevel: dir, commonDir, linked: true, mainRoot: (0, import_node_path4.join)(mainTop, (0, import_node_path4.relative)(dir, start)) };
    }
    if ((0, import_node_path4.dirname)(dir) === dir) return { root: start, toplevel: start, commonDir: start, linked: false, mainRoot: start };
  }
}
function devProjectName(sections, checkout) {
  const dev = sections.dev;
  if (typeof dev?.project === "string" && dev.project !== "") return dev.project;
  return (0, import_node_path4.basename)((0, import_node_path4.basename)(checkout.commonDir) === ".git" ? (0, import_node_path4.dirname)(checkout.commonDir) : checkout.root);
}

// src/world/services/stack.mts
var import_promises4 = require("fs/promises");
var import_node_path5 = require("path");
var LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];
var MAINTENANCE_DATABASE = "postgres";
var PGLITE_DIR = ".lw/qa/pglite";
function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.includes(host.replace(/^\[|\]$/g, ""));
}
function databaseName(text2) {
  const name = text2.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "").replace(/_+$/, "");
  return (name === "" ? "app" : name).slice(0, 63);
}
function checkIdentifier(name) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    throw new LaunchwrightError("qa.stack.name", `"${name}" is not a plain database name (lower case letters, digits and _, a letter first).`, { context: { database: name } });
  }
  return name;
}
function pgliteDir(root, name) {
  return (0, import_node_path5.resolve)(root, PGLITE_DIR, checkIdentifier(name));
}
function parsePgUrl(url) {
  if (!URL.canParse(url)) return "the database URL cannot be parsed";
  const parsed = new URL(url);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return `${parsed.protocol.replace(":", "")} is not a postgres URL`;
  return parsed;
}
function databaseOfUrl(url) {
  const parsed = parsePgUrl(url);
  if (typeof parsed === "string") throw new LaunchwrightError("qa.stack.url", `Refusing: ${parsed}.`);
  return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
}
function hostOfUrl(url) {
  const parsed = parsePgUrl(url);
  return typeof parsed === "string" ? "an unreadable host" : parsed.host;
}
function urlWithDatabase(url, name) {
  const parsed = parsePgUrl(url);
  if (typeof parsed === "string") throw new LaunchwrightError("qa.stack.url", `Refusing: ${parsed}.`);
  parsed.pathname = `/${checkIdentifier(name)}`;
  return parsed.toString();
}
function remoteHostProblem(url) {
  const parsed = parsePgUrl(url);
  if (typeof parsed === "string") return parsed;
  const host = parsed.hostname;
  return isLoopbackHost(host) ? null : `host ${host} is not this machine, and lw qa writes and drops databases on this machine only`;
}
function qaTargetProblem(db, database, root) {
  if ((db.driver ?? "pg") === "pglite") {
    if (typeof db.dataDir !== "string" || db.dataDir === "") return "the PGlite database has no data folder, so it is the in-memory database of the process";
    const dir = (0, import_node_path5.isAbsolute)(db.dataDir) ? db.dataDir : (0, import_node_path5.resolve)(root, db.dataDir);
    return dir === pgliteDir(root, database) ? null : `the PGlite folder ${dir} is not ${pgliteDir(root, database)}`;
  }
  if (typeof db.url !== "string" || db.url === "") return "no database URL at all";
  const remote = remoteHostProblem(db.url);
  if (remote) return remote;
  const name = databaseOfUrl(db.url);
  return name === database ? null : `database ${name || "(none named)"} is not ${database}, and lw qa may only touch ${database}`;
}
function assertQaTarget(db, database, root) {
  const problem = qaTargetProblem(db, database, root);
  if (problem) throw new LaunchwrightError("qa.stack.target", `Refusing: ${problem}.`, { context: { database } });
}
function qaDbSection(db, database, root) {
  checkIdentifier(database);
  if ((db.driver ?? "pg") === "pglite") return { ...db, driver: "pglite", dataDir: pgliteDir(root, database) };
  if (typeof db.url !== "string" || db.url === "") {
    throw new LaunchwrightError("qa.stack.url", "Config db.url is not set, so the QA world has no server. Set DATABASE_URL in the env file of the run.");
  }
  const out = { ...db, url: urlWithDatabase(db.url, database) };
  assertQaTarget(out, database, root);
  return out;
}
function guard(allowed, name, what) {
  checkIdentifier(name);
  if (!allowed(name)) throw new LaunchwrightError("qa.stack.guard", `Refusing to ${what} database ${name}: lw qa may not touch it.`, { context: { database: name } });
  return name;
}
function quoted(name) {
  return `"${checkIdentifier(name)}"`;
}
var dbModuleConnect = async (url) => (await loadDb()).createDb({ driver: "pg", url });
async function pgAdmin(url, allowed, connect = dbModuleConnect) {
  const remote = remoteHostProblem(url);
  if (remote) throw new LaunchwrightError("qa.stack.host", `Refusing: ${remote}.`, { context: { host: hostOfUrl(url) } });
  const db = await connect(urlWithDatabase(url, MAINTENANCE_DATABASE));
  const names = async () => {
    const result = await db.execute("select datname from pg_database where not datistemplate");
    return result.rows.map((r) => r.datname);
  };
  return {
    exists: async (name) => (await names()).includes(checkIdentifier(name)),
    async create(name, template) {
      guard(allowed, name, "create");
      try {
        await db.execute(`create database ${quoted(name)}${template === void 0 ? "" : ` template ${quoted(template)}`}`);
      } catch (cause) {
        const message = messageOf(cause);
        if (template !== void 0 && /being accessed by other users/.test(message)) {
          throw new LaunchwrightError("qa.stack.copy", `Cannot copy ${template}: other sessions use it. Stop the run that holds it (lw stop in its checkout), then try again.`, {
            cause,
            context: { database: name, template }
          });
        }
        throw new LaunchwrightError("qa.stack.create", `Cannot create database ${name}: ${message}`, { cause, context: { database: name } });
      }
    },
    async drop(name) {
      guard(allowed, name, "drop");
      await db.execute(
        `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${checkIdentifier(name)}' and usename = current_user and pid <> pg_backend_pid()`
      );
      await db.execute(`drop database if exists ${quoted(name)}`);
    },
    list: async (prefix) => (await names()).filter((n) => n.startsWith(prefix)).sort(),
    close: () => db.close()
  };
}
function pgliteAdmin(root, allowed) {
  const dir = (0, import_node_path5.resolve)(root, PGLITE_DIR);
  return {
    async exists(name) {
      return await pathKind(pgliteDir(root, name)) === "dir";
    },
    async create(name, template) {
      guard(allowed, name, "create");
      if (template === void 0) await (0, import_promises4.mkdir)(pgliteDir(root, name), { recursive: true });
      else await (0, import_promises4.cp)(pgliteDir(root, template), pgliteDir(root, name), { recursive: true, errorOnExist: true, force: false });
    },
    async drop(name) {
      guard(allowed, name, "drop");
      await (0, import_promises4.rm)(pgliteDir(root, name), { recursive: true, force: true });
    },
    async list(prefix) {
      let names;
      try {
        names = await (0, import_promises4.readdir)(dir);
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.stack.read", `Cannot read ${dir}.`, { cause });
      }
      return names.filter((n) => n.startsWith(prefix)).sort();
    },
    close: async () => void 0
  };
}
function dbAdmin(db, root, allowed, connect) {
  if ((db.driver ?? "pg") === "pglite") return Promise.resolve(pgliteAdmin(root, allowed));
  if (typeof db.url !== "string" || db.url === "") throw new LaunchwrightError("qa.stack.url", "Config db.url is not set, so lw qa has no database server.");
  return pgAdmin(db.url, allowed, connect);
}

// src/world/services/app.mts
function entryConnect(entry) {
  const connect = entry.connect;
  return connect === void 0 ? void 0 : (url) => connect.call(entry, url);
}
function qaDatabase(sections, checkout) {
  const qa = sections.qa;
  if (typeof qa?.database === "string" && qa.database !== "") return qa.database;
  return databaseName(`${devProjectName(sections, checkout)}_qa`);
}
function botId(token2) {
  const match = typeof token2 === "string" ? /^([1-9][0-9]{0,15}):/.exec(token2) : null;
  return match ? Number(match[1]) : void 0;
}
var QA_TELEGRAM_PORT = 9102;
function qaFakeToken(id, registryHash2) {
  return `${id}:${(0, import_node_crypto3.createHash)("sha256").update(`lw-qa-fake-bot:${id}:${registryHash2}`).digest("base64url").slice(0, 32)}`;
}
function qaFakeBots(sections, registryHash2) {
  const telegram = sections.telegram;
  const out = [];
  for (const [name, bot] of Object.entries(telegram?.bots ?? {})) {
    const id = typeof bot.id === "number" ? bot.id : botId(bot.token);
    if (id === void 0) continue;
    out.push({ username: typeof bot.username === "string" ? bot.username : name, token: qaFakeToken(id, registryHash2) });
  }
  return out;
}
function qaSections(sections, o) {
  const out = { ...sections };
  out.db = qaDbSection(sections.db ?? {}, o.database, o.root);
  const telegram = sections.telegram;
  if (telegram !== void 0) {
    const bots = {};
    for (const [name, bot] of Object.entries(telegram.bots ?? {})) {
      const { token: token2, ...rest } = bot;
      const id = typeof rest.id === "number" ? rest.id : botId(token2);
      bots[name] = id === void 0 ? rest : { ...rest, token: qaFakeToken(id, o.registryHash) };
    }
    out.telegram = { ...telegram, apiUrl: o.telegramUrl, bots };
  }
  out.qa = { ...sections.qa ?? {}, routes: true };
  return out;
}
async function importFromProject(root, specifier) {
  let url;
  try {
    url = (0, import_node_url.pathToFileURL)(resolveImport(specifier, root)).href;
  } catch (cause) {
    throw new LaunchwrightError("qa.world.import", `The project at ${root} cannot resolve ${specifier}. Install it in the project.`, { cause, context: { specifier } });
  }
  return await import(url);
}
function isEntry(value) {
  const v = value;
  return typeof v === "object" && v !== null && typeof v.create === "function" && typeof v.serve === "function";
}
async function loadAppEntry(root, qa) {
  const file = (0, import_node_path6.isAbsolute)(qa.app) ? qa.app : (0, import_node_path6.resolve)(root, qa.app);
  let mod;
  try {
    mod = await import((0, import_node_url.pathToFileURL)(file).href);
  } catch (cause) {
    throw new LaunchwrightError("qa.world.app", `Cannot load ${file} (config qa.app): ${messageOf(cause)}`, { cause, context: { file } });
  }
  if (!isEntry(mod.qaApp)) {
    throw new LaunchwrightError("qa.world.app", `${file} (config qa.app) must export qaApp = { create(sections, env), serve(app) }.`, { context: { file } });
  }
  return mod.qaApp;
}
async function openWorld(entry, sections, env, overlay) {
  const qa = qaSections(sections, overlay);
  const tenantId = await entryTenant(entry);
  const app = await entry.create(qa, env);
  try {
    await app.boot();
  } catch (cause) {
    try {
      await app.shutdown();
    } catch (shutdown) {
      throw new LaunchwrightError("qa.world.boot", "The QA app did not boot, and its shutdown failed too.", { cause: new AggregateError([cause, shutdown]) });
    }
    throw cause;
  }
  return { app, tenantId, database: overlay.database, sections: qa, close: () => app.shutdown() };
}
async function entryTenant(entry) {
  if (entry.tenantId !== void 0) return entry.tenantId;
  const db = await optionalDb();
  if (db) return db.DEFAULT_TENANT_ID;
  throw new LaunchwrightError("qa.world.tenant", "qaApp sets no tenantId, and the db module that has a default tenant is not installed. Set qaApp.tenantId.");
}

// src/kernel/services/args.mts
var import_node_util = require("util");

// src/services/score.mts
var DEFAULT_GAUGE_COLOR = "#7c3aed";

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
var weight = import_zod6.z.number().nonnegative();
var scoreConfig = import_zod6.z.object({
  weights: import_zod6.z.strictObject({
    findings: weight.optional(),
    console: weight.optional(),
    coverage: weight.optional(),
    evidence: weight.optional(),
    accessibility: weight.optional(),
    performance: weight.optional()
  }).default({}),
  gaugeColor: import_zod6.z.string().refine(isCssColor, { message: "qa.score.gaugeColor must be a CSS colour: #rgb, #rrggbb, rgb(...), hsl(...), oklch(...) or a named colour" }).default(DEFAULT_GAUGE_COLOR)
});

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
  /** The 0-100 score (spec 2.11): weight overrides per dimension and the gauge ring colour. */
  score: scoreConfig.prefault({}),
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

// src/world/services/discover.mts
var import_promises5 = require("fs/promises");
var import_node_path7 = require("path");
var import_node_url2 = require("url");

// src/world/services/ids.mts
var QA_TELEGRAM_ID_BASE = 9e8;
var QA_TELEGRAM_ID_SPAN = 1e6;
function qaTelegramId(persona) {
  if (persona.length === 0) throw new LaunchwrightError("client.qa.persona", "qaTelegramId needs a persona id");
  let hash = 2166136261;
  for (let i = 0; i < persona.length; i += 1) {
    hash ^= persona.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return QA_TELEGRAM_ID_BASE + hash % QA_TELEGRAM_ID_SPAN;
}
var QA_PROVIDER = "qa";
function qaAccountId(persona) {
  return `${QA_PROVIDER}:${persona}`;
}
function personaIds(persona) {
  return { persona, accountId: qaAccountId(persona), telegramId: qaTelegramId(persona) };
}
function idProblem(id) {
  if (id.length === 0) return "an id is empty";
  if (id.length > 64) return `${id} has more than 64 characters`;
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id) ? null : `${id} is not a kebab case or dotted id, and it must survive a URL`;
}

// src/world/services/registry.mts
function defineWorld(world) {
  return world;
}
function buildRegistry(worlds) {
  const own = (w, items) => (items ?? []).map((item) => ({ ...item, feature: w.feature, file: w.file }));
  return {
    personas: worlds.flatMap((w) => own(w, w.world.personas)),
    facts: worlds.flatMap((w) => own(w, w.world.facts))
  };
}
function registryProblem(registry) {
  if (registry.personas.length === 0) return "no world file declares a persona, so there is no user to be";
  if (registry.facts.length === 0) return "no world file declares a fact, so there is no state to address";
  const seen = /* @__PURE__ */ new Map();
  for (const entry of [...registry.personas, ...registry.facts]) {
    if (typeof entry.id !== "string") return `an entry of ${entry.file} has no id`;
    const bad = idProblem(entry.id);
    if (bad) return `${bad} (${entry.file})`;
    const other = seen.get(entry.id);
    if (other !== void 0) return `duplicate id ${entry.id} in ${other} and ${entry.file}`;
    seen.set(entry.id, entry.file);
    if (typeof entry.summary !== "string" || entry.summary.trim() === "") return `${entry.id} has no summary, so its report row is blank`;
    if (typeof entry.seed !== "function") return `${entry.id} has no seed function`;
  }
  for (const fact of registry.facts) {
    if (!Array.isArray(fact.handleKeys)) return `${fact.id} declares no handleKeys; write [] when it has none`;
    for (const key of fact.handleKeys) {
      if (typeof key !== "string" || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) return `${fact.id} declares handle key "${String(key)}", which cannot name a route parameter`;
    }
    if (fact.arm === void 0 !== (fact.undo === void 0)) return `${fact.id} declares only one of arm and undo; an armed fact needs both`;
  }
  const ids = /* @__PURE__ */ new Map();
  for (const persona of registry.personas) {
    const tid = qaTelegramId(persona.id);
    const clash = ids.get(tid);
    if (clash !== void 0) return `${persona.id} and ${clash} both map to Telegram id ${tid}`;
    ids.set(tid, persona.id);
  }
  return null;
}
function assertRegistry(registry) {
  const problem = registryProblem(registry);
  if (problem) throw new LaunchwrightError("qa.world.registry", `The QA world cannot be seeded: ${problem}.`, { context: { problem } });
}
function listWorld(registry) {
  return [
    ...registry.personas.map((p) => ({ kind: "persona", id: p.id, summary: p.summary, feature: p.feature })),
    ...registry.facts.map((f) => ({ kind: "fact", id: f.id, summary: f.summary, feature: f.feature, handleKeys: [...f.handleKeys] }))
  ];
}
function registryHash(entries) {
  const lines = entries.map((e) => `${e.kind}	${e.id}	${e.feature}	${e.summary}`).sort();
  return sha256(lines.join("\n")).slice(0, 12);
}
function personaById(registry, id) {
  const found = registry.personas.find((p) => p.id === id);
  if (!found) throw new LaunchwrightError("qa.world.persona", `No world file declares persona ${id}. Run lw qa world list.`, { context: { persona: id } });
  return found;
}
function factById(registry, id) {
  const found = registry.facts.find((f) => f.id === id);
  if (!found) throw new LaunchwrightError("qa.world.fact", `No world file declares fact ${id}. Run lw qa world list.`, { context: { fact: id } });
  return found;
}

// src/world/services/discover.mts
var WORLD_SUFFIX = ".world.mts";
var FEATURE_SUFFIX = ".feature.mts";
var SKIP = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "coverage"]);
async function walk(root, dir, suffix, out) {
  let entries;
  try {
    entries = await (0, import_promises5.readdir)(dir, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === "ENOENT") return;
    throw new LaunchwrightError("qa.world.walk", `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const path = (0, import_node_path7.join)(dir, entry.name);
    if (entry.isDirectory()) await walk(root, path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push((0, import_node_path7.relative)(root, path).split(import_node_path7.sep).join("/"));
  }
}
async function filesWithSuffix(root, suffix) {
  const out = [];
  await walk(root, root, suffix, out);
  return out.sort();
}
function worldFiles(root) {
  return filesWithSuffix(root, WORLD_SUFFIX);
}
function isWorld(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const w = value;
  return (w.personas === void 0 || Array.isArray(w.personas)) && (w.facts === void 0 || Array.isArray(w.facts));
}
async function loadWorlds(root) {
  const out = [];
  for (const file of await worldFiles(root)) {
    let mod;
    try {
      mod = await import((0, import_node_url2.pathToFileURL)((0, import_node_path7.join)(root, file)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.world.file", `Cannot load world file ${file}: ${messageOf(cause)}`, { cause, context: { file } });
    }
    if (!isWorld(mod.default)) {
      throw new LaunchwrightError("qa.world.file", `${file} needs a default export defineWorld({ personas, facts }).`, { context: { file } });
    }
    out.push({ feature: (0, import_node_path7.basename)(file, WORLD_SUFFIX), file, world: mod.default });
  }
  return out;
}
async function loadRegistry(root) {
  return buildRegistry(await loadWorlds(root));
}
var RAW_SQL = [
  { pattern: /\bsql\s*`/, what: "a sql template" },
  { pattern: /\bsql\.(raw|join|identifier)\s*\(/, what: "a sql helper" },
  { pattern: /\.execute\s*[<(]/, what: "an execute() call" },
  { pattern: /import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/, what: "an import of sql from drizzle-orm" }
];
function rawSqlFindings(file, text2) {
  const out = [];
  text2.split("\n").forEach((line, i) => {
    for (const { pattern, what } of RAW_SQL) {
      if (pattern.test(line)) {
        out.push({ file, line: i + 1, rule: "world.raw-sql", message: `${what}: a seed calls the services of ctx.app, never raw SQL` });
        break;
      }
    }
  });
  return out;
}
async function worldLintFindings(root) {
  const out = [];
  for (const file of await worldFiles(root)) out.push(...rawSqlFindings(file, await (0, import_promises5.readFile)((0, import_node_path7.join)(root, file), "utf8")));
  return out;
}
async function featuresWithoutWorld(root) {
  const worlds = new Set(await worldFiles(root));
  return (await filesWithSuffix(root, FEATURE_SUFFIX)).filter((f) => {
    const world = (0, import_node_path7.join)((0, import_node_path7.dirname)(f), `${(0, import_node_path7.basename)(f, FEATURE_SUFFIX)}${WORLD_SUFFIX}`).split(import_node_path7.sep).join("/");
    return !worlds.has(world);
  });
}

// src/world/services/context.mts
async function worldContext(opts, clock = systemClock) {
  const sections = opts.config ?? {};
  const parsed = qaConfig.safeParse(sections.qa ?? {});
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `qa.${i.path.map(String).join(".")} ${i.message}`);
    throw new LaunchwrightError("qa.config.invalid", `Config section qa is invalid: ${keys.join("; ")}`, { context: { keys } });
  }
  const checkout = await readCheckout(opts.cwd);
  const database = qaDatabase(sections, checkout);
  const registry = await loadRegistry(opts.cwd);
  return {
    root: opts.cwd,
    sections,
    env: opts.env ?? "local",
    qa: withAppPaths(parsed.data, sections),
    checkout,
    overlay: { root: opts.cwd, database, telegramUrl: parsed.data.telegramUrl, registryHash: registryHash(listWorld(registry)) },
    registry,
    clock
  };
}

// src/world/services/fixture.mts
var import_node_path9 = require("path");

// src/world/services/world.mts
var import_promises6 = require("fs/promises");
var import_node_path8 = require("path");

// src/world/services/fork.mts
var FORK_MARK = "_fork_";
function forkName(database, label) {
  checkIdentifier(database);
  return `${database}${FORK_MARK}${databaseName(label)}`.slice(0, 63);
}
function seededName(database) {
  checkIdentifier(database);
  return `${database}${FORK_MARK}_seeded`.slice(0, 63);
}
function isForkOf(database, name) {
  return name.startsWith(`${database}${FORK_MARK}`);
}
async function createFork(o) {
  const db = qaDbSection(o.sections.db ?? {}, o.database, o.root);
  assertQaTarget(db, o.database, o.root);
  const name = forkName(o.database, o.label);
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n), o.connect);
  try {
    const seeded = seededName(o.database);
    const template = await admin.exists(seeded) ? seeded : o.database;
    o.out(`forking ${template} to ${name}`);
    await admin.create(name, template);
  } finally {
    await admin.close();
  }
  return name;
}
async function dropFork(o) {
  if (!isForkOf(o.database, o.name)) {
    throw new LaunchwrightError("qa.fork.name", `${o.name} is not a fork of ${o.database}, so lw qa will not drop it.`, { context: { database: o.name } });
  }
  const db = qaDbSection(o.sections.db ?? {}, o.database, o.root);
  assertQaTarget(db, o.database, o.root);
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n), o.connect);
  try {
    await admin.drop(o.name);
    o.out(`dropped ${o.name}`);
  } finally {
    await admin.close();
  }
}
async function snapshotSeeded(o, action) {
  const seeded = seededName(o.database);
  const admin = o.admin ?? await dbAdmin(o.db, o.root, (n) => n === seeded, o.connect);
  try {
    await admin.drop(seeded);
    if (action === "replace") await admin.create(seeded, o.database);
  } finally {
    if (!o.admin) await admin.close();
  }
}

// src/world/services/world.mts
var STAMP_FILE = ".lw/qa/world.json";
function isStamp(value) {
  const s = value;
  return typeof s === "object" && s !== null && typeof s.database === "string" && typeof s.hash === "string" && typeof s.seededAt === "string" && Array.isArray(s.entries);
}
async function readStamp(root) {
  const text2 = await readTextOrNull((0, import_node_path8.join)(root, STAMP_FILE));
  if (text2 === null) return null;
  let value;
  try {
    value = JSON.parse(text2);
  } catch (cause) {
    if (cause instanceof SyntaxError) return "unreadable";
    throw cause;
  }
  return isStamp(value) ? value : "unreadable";
}
async function writeJson(path, value) {
  await (0, import_promises6.mkdir)((0, import_node_path8.dirname)(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await (0, import_promises6.writeFile)(tmp, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
  await (0, import_promises6.rename)(tmp, path);
}
var DB_SEED = /^lw\s+db\s+seed(?:\s+(.*))?$/;
function baseSeedNames(command) {
  if (command === void 0 || command.trim() === "") return null;
  const match = DB_SEED.exec(command.trim());
  if (!match) {
    throw new LaunchwrightError(
      "qa.world.seed",
      `Config qa.seed is "${command}". It must be lw db seed [name...]: the world runs those seeds in process on the QA database, so they never reach another database.`
    );
  }
  return (match[1] ?? "").split(/\s+/).filter(Boolean);
}
function hookSeedNames(command) {
  const text2 = (command ?? "").trim();
  const words = (DB_SEED.exec(text2)?.[1] ?? text2).split(/\s+/);
  return words.filter(Boolean);
}
async function recreate(o, db) {
  const database = o.overlay.database;
  const admin = o.admin ?? await dbAdmin(db, o.root, (name) => name === database, entryConnect(o.entry));
  try {
    await admin.drop(database);
    await admin.create(database);
  } finally {
    await admin.close();
  }
  const ctx = { root: o.root, database, sections: { ...o.sections, db }, out: o.out };
  if (o.entry.migrate) {
    await o.entry.migrate(ctx);
    o.out(`migrated ${database} through qaApp.migrate`);
  } else await migrateWithDbModule(o, db);
  if (o.entry.seed) {
    const names = hookSeedNames(o.seed);
    await o.entry.seed(ctx, names);
    o.out(`base seed through qaApp.seed: ${names.join(", ") || "default"}`);
  }
}
async function migrateWithDbModule(o, db) {
  const database = o.overlay.database;
  const { createDb, migrate } = await loadDb();
  const conn = await createDb({
    driver: db.driver ?? "pg",
    url: db.url,
    dataDir: db.dataDir,
    ...typeof db.schema === "string" ? { schema: db.schema } : {},
    ...db.tables !== void 0 ? { tables: db.tables } : {}
  });
  try {
    const dir = (0, import_node_path8.resolve)(o.root, typeof db.migrations === "string" ? db.migrations : "packages/db/migrations");
    const { applied } = await migrate(conn, dir);
    o.out(`migrated ${database}: ${applied.length} migration(s)`);
  } finally {
    await conn.close();
  }
}
async function linkWithAuth(world, userId, persona, telegramId) {
  const auth = await loadAuth();
  if (!world.app.has(auth.USERS)) {
    throw new LaunchwrightError("qa.world.auth", "The QA app has no auth module, so no persona can sign in. Add the auth module to the project.");
  }
  const users = world.app.get(auth.USERS);
  await users.link(world.tenantId, userId, { provider: QA_PROVIDER, subject: persona });
  await users.link(world.tenantId, userId, { provider: "telegram", subject: String(telegramId) });
}
async function linkPersona(world, entry, persona, seededUserId) {
  const ids = personaIds(persona);
  const given = typeof seededUserId === "string" && seededUserId !== "" ? seededUserId : void 0;
  if (entry?.linkPersona) {
    const linked = await entry.linkPersona(world, { persona, accountId: ids.accountId, telegramId: ids.telegramId, ...given ? { userId: given } : {} });
    const userId = typeof linked === "string" && linked !== "" ? linked : given;
    if (userId === void 0) throw new LaunchwrightError("qa.world.handles", "Its seed returned no userId, and qaApp.linkPersona returned none.");
    return userId;
  }
  if (given === void 0) throw new LaunchwrightError("qa.world.handles", "Its seed returned no userId.");
  await linkWithAuth(world, given, persona, ids.telegramId);
  return given;
}
async function seedWorld(world, registry, o) {
  const names = o.entry?.seed ? null : baseSeedNames(o.seed);
  if (names !== null) {
    const { DB, runSeeds, seedNames } = await loadDb();
    const dir = (0, import_node_path8.join)(o.root, "packages/db/seeds");
    const ran = await runSeeds(world.app.get(DB), dir, names.length > 0 ? names : await seedNames(dir), o.out);
    o.out(`base seed: ${ran.join(", ") || "none"}`);
  }
  const seeded = [];
  for (const fact of registry.facts) {
    try {
      const handles = await fact.seed(world);
      const missing = fact.handleKeys.filter((key) => !(key in handles));
      if (missing.length > 0) {
        throw new LaunchwrightError("qa.world.handles", `It declares handleKeys ${fact.handleKeys.join(", ")}, and its seed returned ${Object.keys(handles).join(", ") || "nothing"}.`);
      }
      seeded.push({ kind: "fact", id: fact.id, summary: fact.summary, feature: fact.feature, handleKeys: [...fact.handleKeys], handles });
    } catch (cause) {
      throw new LaunchwrightError("qa.world.seed", `Fact ${fact.id} (${fact.file}) could not be seeded: ${messageOf(cause)}`, { cause, context: { fact: fact.id } });
    }
  }
  for (const persona of registry.personas) {
    const ids = personaIds(persona.id);
    try {
      const handles = await persona.seed(world, ids);
      const userId = await linkPersona(world, o.entry, persona.id, handles?.userId);
      seeded.push({ kind: "persona", id: persona.id, summary: persona.summary, feature: persona.feature, handles: { ...handles, userId, telegramId: ids.telegramId } });
    } catch (cause) {
      throw new LaunchwrightError("qa.world.seed", `Persona ${persona.id} (${persona.file}) could not be seeded: ${messageOf(cause)}`, {
        cause,
        context: { persona: persona.id }
      });
    }
  }
  return seeded;
}
async function resetWorld(o) {
  assertRegistry(o.registry);
  const hash = registryHash(listWorld(o.registry));
  const db = qaDbSection(o.sections.db ?? {}, o.overlay.database, o.root);
  o.out(`resetting ${o.overlay.database}`);
  await rmStamp(o.root);
  const connect = entryConnect(o.entry);
  const snapshot = { root: o.root, db, database: o.overlay.database, ...connect ? { connect } : {} };
  await snapshotSeeded(snapshot, "drop");
  await recreate(o, db);
  const world = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, registryHash: hash });
  let entries;
  try {
    entries = await seedWorld(world, o.registry, o);
  } finally {
    await world.close();
  }
  await snapshotSeeded(snapshot, "replace");
  o.out(`snapshot ${seededName(o.overlay.database)}: each fork copies it`);
  const stamp = { database: o.overlay.database, hash, seededAt: o.clock.date().toISOString(), entries };
  await writeJson((0, import_node_path8.join)(o.root, STAMP_FILE), stamp);
  o.out(`seeded ${entries.length} entries, registry ${stamp.hash}`);
  return stamp;
}
async function rmStamp(root) {
  await (0, import_promises6.rm)((0, import_node_path8.join)(root, STAMP_FILE), { force: true });
}
async function worldStatus(o) {
  const db = qaDbSection(o.sections.db ?? {}, o.database, o.root);
  const admin = o.admin ?? await dbAdmin(db, o.root, (name) => name === o.database, o.connect);
  let exists;
  try {
    exists = await admin.exists(o.database);
  } finally {
    await admin.close();
  }
  const live = registryHash(listWorld(o.registry));
  const read = await readStamp(o.root);
  const stamp = read === "unreadable" || read === null || read.database !== o.database ? null : read;
  const state = !exists ? "missing" : stamp === null ? "unseeded" : stamp.hash === live ? "current" : "stale";
  return { database: o.database, exists, state, registryHash: live, stamp };
}

// src/world/services/fixture.mts
var UNDO_FILE = ".lw/qa/fixture.json";
function forkUndoFile(database) {
  return `.lw/qa/fork/${database}.fixture.json`;
}
async function readUndo(root, database, file = UNDO_FILE) {
  const text2 = await readTextOrNull((0, import_node_path9.join)(root, file));
  if (text2 === null) return { database, armed: [] };
  let record;
  try {
    record = JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("qa.fixture.read", `${file} is not JSON. Restore it from the run log, or delete it after lw qa world reset.`, { cause });
  }
  if (record.armed.length > 0 && record.database !== database) {
    throw new LaunchwrightError("qa.fixture.database", `${file} holds facts armed on ${record.database}, not on ${database}. Disarm them on that database first.`, {
      context: { database: record.database }
    });
  }
  return { database, armed: record.armed };
}
function writeUndo(root, record, file) {
  return writeJson((0, import_node_path9.join)(root, file), record);
}
async function armFact(world, registry, root, factId, opts = {}) {
  const file = opts.undoFile ?? UNDO_FILE;
  const fact = factById(registry, factId);
  if (fact.arm === void 0) {
    throw new LaunchwrightError("qa.fixture.no-arm", `Fact ${fact.id} (${fact.file}) has no arm(). Seed it with lw qa world reset, or give it arm() and undo().`, {
      context: { fact: fact.id }
    });
  }
  const persona = opts.persona === void 0 ? void 0 : personaIds(personaById(registry, opts.persona).id);
  const record = await readUndo(root, world.database, file);
  if (record.armed.some((a) => a.fact === fact.id)) {
    throw new LaunchwrightError("qa.fixture.armed", `Fact ${fact.id} is armed already. Run lw qa fixture disarm first.`, { context: { fact: fact.id } });
  }
  const entry = { fact: fact.id, ...persona ? { persona: persona.persona } : {}, steps: [] };
  record.armed.push(entry);
  await writeUndo(root, record, file);
  await fact.arm({
    app: world.app,
    tenantId: world.tenantId,
    ...persona ? { persona } : {},
    async record(step) {
      entry.steps.push(step);
      await writeUndo(root, record, file);
    }
  });
  return entry;
}
async function disarmFact(world, registry, root, file = UNDO_FILE) {
  const record = await readUndo(root, world.database, file);
  const done = [];
  while (record.armed.length > 0) {
    const entry = record.armed[record.armed.length - 1];
    const fact = factById(registry, entry.fact);
    if (fact.undo === void 0) throw new LaunchwrightError("qa.fixture.no-undo", `Fact ${fact.id} has no undo(), so its steps cannot be replayed.`, { context: { fact: fact.id } });
    while (entry.steps.length > 0) {
      await fact.undo(world, entry.steps[entry.steps.length - 1]);
      entry.steps.pop();
      await writeUndo(root, record, file);
    }
    record.armed.pop();
    await writeUndo(root, record, file);
    done.push(entry.fact);
  }
  return done;
}

// src/world/services/arming.mts
async function fixtureArming(opts) {
  const ctx = await worldContext(opts);
  const entry = opts.entry ?? await loadAppEntry(ctx.root, ctx.qa);
  const registry = opts.registry ?? ctx.registry;
  const database = opts.database ?? ctx.overlay.database;
  const overlay = { ...ctx.overlay, database, registryHash: registryHash(listWorld(registry)) };
  const world = await openWorld(entry, ctx.sections, ctx.env, overlay);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await world.close();
  };
  return {
    async arm(state, o) {
      await armFact(world, registry, ctx.root, state, o.persona === void 0 ? {} : { persona: o.persona });
    },
    async disarm() {
      try {
        await disarmFact(world, registry, ctx.root);
      } finally {
        await close();
      }
    }
  };
}

// src/world/services/node-listen.mts
var import_node_http = require("http");
async function bodyOf(req) {
  if (req.method === "GET" || req.method === "HEAD") return void 0;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return new Uint8Array(Buffer.concat(chunks));
}
function requestOf(req, body) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) for (const one of value) headers.append(name, one);
  }
  return new Request(`http://${req.headers.host ?? "127.0.0.1"}${req.url ?? "/"}`, { method: req.method ?? "GET", headers, ...body ? { body } : {} });
}
async function answer(handler, req, res) {
  const response = await handler.fetch(requestOf(req, await bodyOf(req)));
  const headers = {};
  for (const [name, value] of response.headers) if (name !== "set-cookie") headers[name] = value;
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}
async function nodeListen(handler, port) {
  const server = (0, import_node_http.createServer)((req, res) => {
    answer(handler, req, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`QA app error: ${messageOf(err)}`);
    });
  });
  await new Promise((resolve6, reject) => {
    server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${port}: ${cause.message}`, { cause })));
    server.listen(port, "127.0.0.1", resolve6);
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve6, reject) => {
      server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve6());
      server.closeAllConnections();
    })
  };
}

// src/world/services/api.mts
var listenQaApp = async (handler, app, port) => {
  const http = await optionalHttp();
  if (http === void 0) return nodeListen(handler, port);
  const { serveNode } = http;
  const { server } = serveNode(handler, port, { hostname: "127.0.0.1", app, signals: false });
  if (!server.listening) await new Promise((resolve6, reject) => {
    server.once("listening", resolve6);
    server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${port}: ${cause.message}`, { cause })));
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve6, reject) => {
      server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve6());
      server.closeAllConnections?.();
    })
  };
};

// src/world/services/fork-server.mts
var import_promises7 = require("fs/promises");
var import_node_path10 = require("path");
async function serveFork(o, database) {
  const world = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, database });
  let listening = null;
  try {
    listening = await (o.listen ?? listenQaApp)(o.entry.serve(world.app), world.app, 0);
  } finally {
    if (listening === null) await world.close();
  }
  const server = listening;
  const undoFile = forkUndoFile(database);
  let closing = null;
  const close = async () => {
    try {
      await server.close();
    } finally {
      try {
        await world.close();
      } finally {
        await (0, import_promises7.rm)((0, import_node_path10.join)(o.root, undoFile), { force: true });
      }
    }
  };
  return {
    database,
    world,
    url: `http://127.0.0.1:${server.port}`,
    arming: {
      async arm(state, a) {
        await armFact(world, o.registry, o.root, state, { ...a.persona === void 0 ? {} : { persona: a.persona }, undoFile });
      },
      disarm: async () => void 0
    },
    close: () => closing ??= close()
  };
}
async function openFork(o, label) {
  const runner = worldForkRunner(o);
  const database = await runner.create(label);
  let instance = null;
  try {
    instance = await serveFork(o, database);
  } finally {
    if (instance === null) await runner.drop(database);
  }
  const served = instance;
  const db = async () => o.entry.db?.(served.world.app) ?? served.world.app.get((await loadDb()).DB);
  return {
    ...served,
    execute: async (sql) => (await db()).execute(sql),
    async release() {
      try {
        await served.close();
      } finally {
        await runner.drop(database);
      }
    }
  };
}
function worldForkRunner(o) {
  const connect = entryConnect(o.entry);
  const fork = { root: o.root, sections: o.sections, database: o.overlay.database, out: o.out, ...connect ? { connect } : {} };
  return {
    create: (label) => createFork({ ...fork, label }),
    drop: (name) => dropFork({ ...fork, name }),
    serve: (database) => serveFork(o, database)
  };
}

// src/world/services/clock.mts
var UNIT_MS = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
function parseShift(shift) {
  if (typeof shift === "number" && Number.isFinite(shift)) return Math.trunc(shift);
  const match = typeof shift === "string" ? /^([+-]?)(\d+)(ms|s|m|h|d|w)$/.exec(shift.trim()) : null;
  if (!match) throw new LaunchwrightError("qa.clock.shift", `Shift ${JSON.stringify(shift)} is not a duration such as +2d, -3h, 90m or a number of ms.`);
  return (match[1] === "-" ? -1 : 1) * Number(match[2]) * UNIT_MS[match[3]];
}
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

// src/world/services/jobs.mts
var import_promises8 = require("fs/promises");
var import_node_path11 = require("path");
var import_node_url3 = require("url");
function jobsDirOf(sections = {}) {
  return `${appPath(sections, "node", "apps/api")}/src/jobs`;
}
var JOBS_DIR = jobsDirOf();
async function importProjectJobs(root, jobsDir = JOBS_DIR) {
  const dir = (0, import_node_path11.join)(root, jobsDir);
  let names;
  try {
    names = await (0, import_promises8.readdir)(dir);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.job.read", `Cannot read ${dir}.`, { cause });
  }
  const files = names.filter((n) => n.endsWith(".job.mts")).sort();
  for (const file of files) await import((0, import_node_url3.pathToFileURL)((0, import_node_path11.join)(dir, file)).href);
  return files;
}
function listJobs(registry) {
  return registry.registeredJobs().map((j) => j.kind).sort();
}
async function runJob(world, registry, o) {
  const def = registry.jobOf(o.kind);
  if (def === void 0) {
    throw new LaunchwrightError("qa.job.unknown", `No registered job has kind ${o.kind}. Jobs: ${listJobs(registry).join(", ") || "none"}.`, { context: { kind: o.kind } });
  }
  const payload = registry.parsePayload(def, o.payload ?? {});
  const scope = world.app.createScope();
  if (o.tenantId !== void 0) {
    const { TENANT_SCOPE, tenantScope } = await loadDb();
    scope.instance(TENANT_SCOPE, tenantScope(o.tenantId));
  }
  const ctx = registry.standaloneContext({
    id: `qa-${o.kind}-${o.clock.now()}`,
    kind: o.kind,
    attempts: 1,
    maxAttempts: 1,
    tenantId: o.tenantId ?? null,
    container: scope,
    log: world.app.log
  });
  try {
    await def.handle(payload, ctx);
  } finally {
    await scope.dispose();
  }
}

// src/telegram/bot-api.mts
var TOKEN_SHAPE = /[0-9]{4,}:[A-Za-z0-9_-]{20,}/g;
function redactToken(text2, token2) {
  const stripped = token2 ? text2.split(token2).join("[redacted]") : text2;
  return stripped.replace(TOKEN_SHAPE, "[redacted]");
}
function reasonOf(status, errorCode) {
  const code = errorCode ?? status;
  if (status === 0) return "network";
  if (code === 429) return "rate_limited";
  if (code >= 500) return "server";
  if (code === 401 || code === 404) return "unauthorized";
  if (code === 403) return "forbidden";
  if (code === 409) return "conflict";
  if (code === 400) return "bad_request";
  return "unknown";
}
var TelegramApiError = class extends LaunchwrightError {
  method;
  /** The HTTP status. 0 when no answer arrived. */
  status;
  /** Telegram's own description, with any token removed. */
  description;
  constructor(method, failure, cause) {
    const reason = reasonOf(failure.status, failure.error_code);
    const raw = failure.description ?? (failure.status === 0 ? "no answer from the Bot API" : `HTTP ${failure.status}`);
    super(`telegram.api.${reason}`, redactToken(`Bot API ${method} failed (${failure.error_code ?? failure.status}): ${raw}`), {
      cause,
      context: { method, status: failure.status, errorCode: failure.error_code, reason }
    });
    this.method = method;
    this.status = failure.status;
    this.description = redactToken(raw);
  }
};
function botIdOfToken(token2) {
  const at = token2.indexOf(":");
  const id = Number(token2.slice(0, at));
  if (at <= 0 || !Number.isSafeInteger(id) || id <= 0 || token2.length - at < 2) {
    throw new LaunchwrightError("telegram.token.invalid", "A bot token has the form <bot id>:<secret>.", { context: { key: "token" } });
  }
  return id;
}
var BotApi = class {
  botId;
  token;
  apiUrl;
  timeoutMs;
  fetchFn;
  constructor(opts) {
    this.botId = botIdOfToken(opts.token);
    this.token = opts.token;
    this.apiUrl = (opts.apiUrl ?? "https://api.telegram.org").replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 1e4;
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
  }
  /** Calls one Bot API method and returns its `result`. A failed call throws `TelegramApiError`. */
  async call(method, params = {}, opts = {}) {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? this.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    let response;
    try {
      response = await this.fetchFn(`${this.apiUrl}/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal
      });
    } catch (cause) {
      if (opts.signal?.aborted) throw new LaunchwrightError("telegram.api.aborted", `Bot API ${method} was aborted.`, { cause, context: { method } });
      throw new TelegramApiError(method, { status: 0 }, cause);
    }
    let answer2;
    try {
      answer2 = await response.json();
    } catch (cause) {
      throw new TelegramApiError(method, { status: response.status, description: `the answer is not JSON (HTTP ${response.status})` }, cause);
    }
    if (answer2.ok === true) return answer2.result;
    throw new TelegramApiError(method, {
      status: response.status,
      ...answer2.error_code !== void 0 ? { error_code: answer2.error_code } : {},
      ...answer2.description !== void 0 ? { description: answer2.description } : {}
    });
  }
  getMe() {
    return this.call("getMe");
  }
  setChatMenuButton(menuButton, chatId) {
    return this.call("setChatMenuButton", { menu_button: menuButton, ...chatId !== void 0 ? { chat_id: chatId } : {} });
  }
};

// src/world/services/menu.mts
async function setMenuButton(o) {
  const section = o.telegram ?? {};
  const bots = Object.entries(section.bots ?? {});
  const picked = o.bot === void 0 ? bots.length === 1 ? bots[0] : void 0 : bots.find(([name2]) => name2 === o.bot);
  if (picked === void 0) {
    const names = bots.map(([name2]) => name2).join(", ") || "none";
    throw new LaunchwrightError("qa.menu.bot", o.bot === void 0 ? `Name the dev bot with --bot. Bots: ${names}.` : `No bot ${o.bot} in config telegram.bots. Bots: ${names}.`);
  }
  const [name, bot] = picked;
  if (bot.token === void 0) throw new LaunchwrightError("qa.menu.bot", `Bot ${name} has no token in config, so lw qa cannot set its menu button.`);
  const api = new BotApi({ token: bot.token, ...section.apiUrl ? { apiUrl: section.apiUrl } : {}, ...o.fetch ? { fetch: o.fetch } : {} });
  await api.setChatMenuButton({ type: "web_app", text: o.text, web_app: { url: o.url } });
}

// src/world/services/worktree.mts
var import_promises9 = require("fs/promises");
var import_node_path12 = require("path");
var DEFAULT_LOCAL_ENV_FILE = [".env", "local"].join(".");
function envFileName(sections) {
  const dev = sections.dev;
  const name = dev?.envFiles?.local;
  return typeof name === "string" ? name : DEFAULT_LOCAL_ENV_FILE;
}
function copyPrefix(sections, checkout) {
  return `${databaseName(devProjectName(sections, checkout))}_wt_`;
}
function copyName(prefix, toplevel) {
  return `${prefix}${databaseName((0, import_node_path12.basename)(toplevel))}`.slice(0, 63);
}
async function planWorktree(o) {
  const checkout = await readCheckout(o.root);
  if (!checkout.linked) {
    throw new LaunchwrightError("qa.worktree.main", "This is the main checkout. Run lw qa worktree from a linked worktree: git worktree add .claude/worktrees/<name>.", {
      context: { root: o.root }
    });
  }
  const db = o.sections.db ?? {};
  if ((db.driver ?? "pg") === "pglite") {
    throw new LaunchwrightError("qa.worktree.driver", "The project uses PGlite. lw qa worktree copies a Postgres database; a PGlite project gives each worktree its own data folder.");
  }
  const name = envFileName(o.sections);
  const envFile = (0, import_node_path12.join)(o.root, name);
  const mainEnvFile = (0, import_node_path12.join)(checkout.mainRoot, name);
  if (await readTextOrNull(envFile) === null) {
    if (await readTextOrNull(mainEnvFile) === null) throw new LaunchwrightError("qa.worktree.env", `No ${name} in this worktree and none in the main checkout to copy.`);
    await (0, import_promises9.copyFile)(mainEnvFile, envFile);
    o.out(`copied ${name} from the main checkout`);
  }
  const values = o.deps.parseEnv(await readTextOrNull(envFile) ?? "");
  const baseUrl = values.DATABASE_URL || (typeof db.url === "string" ? db.url : "");
  if (baseUrl === "") throw new LaunchwrightError("qa.worktree.url", `DATABASE_URL is not set in ${name}, and config db.url is not set.`);
  const remote = remoteHostProblem(baseUrl);
  if (remote) throw new LaunchwrightError("qa.worktree.host", `Refusing: ${remote}.`, { context: { host: hostOfUrl(baseUrl) } });
  const mainValues = o.deps.parseEnv(await readTextOrNull(mainEnvFile) ?? "");
  const source = databaseOfUrl(mainValues.DATABASE_URL || baseUrl);
  const prefix = copyPrefix(o.sections, checkout);
  const copy = copyName(prefix, checkout.toplevel);
  if (source === copy || source.startsWith(prefix)) {
    throw new LaunchwrightError("qa.worktree.source", `The source database ${source} is a worktree copy. Point DATABASE_URL of the main checkout at the dev database.`);
  }
  return { checkout, envFile, mainEnvFile, baseUrl, source, copy, prefix };
}
function setEnvLine(text2, key, value) {
  const lines = text2.split("\n");
  const at = lines.findLastIndex((l) => l.replace(/^\s*(export\s+)?/, "").startsWith(`${key}=`));
  if (at === -1) return `${text2}${text2 === "" || text2.endsWith("\n") ? "" : "\n"}${key}=${value}
`;
  lines[at] = `${key}=${value}`;
  return lines.join("\n");
}
async function writePrivate(path, text2) {
  const tmp = `${path}.${process.pid}.tmp`;
  await (0, import_promises9.writeFile)(tmp, text2, { mode: 384 });
  await (0, import_promises9.rename)(tmp, path);
}
function menuWatcher(o) {
  let done = false;
  let busy = false;
  return (line) => {
    o.err(line);
    if (done || busy || o.setMenu === void 0) return;
    busy = true;
    void (async () => {
      const run = await o.deps.currentRun(o.root);
      const surface = run?.surfaces.find((s) => s.url !== void 0 && (o.setMenu?.surface === void 0 || s.name === o.setMenu.surface));
      if (surface?.url) {
        done = true;
        await o.deps.setMenu(surface.url);
        o.out(`menu button of the dev bot: ${surface.url}`);
      }
    })().catch((cause) => {
      done = true;
      o.err(`cannot set the menu button: ${messageOf(cause)}`);
    }).finally(() => {
      busy = false;
    });
  };
}
async function runWorktree(o) {
  const plan = await planWorktree(o);
  const allowed = (name) => name.startsWith(plan.prefix);
  const admin = await o.deps.admin(plan.baseUrl, allowed);
  const copyUrl = urlWithDatabase(plan.baseUrl, plan.copy);
  const original = await readTextOrNull(plan.envFile) ?? "";
  let code = 1;
  try {
    o.out(`worktree ${plan.checkout.toplevel}`);
    if (await admin.exists(plan.copy)) o.out(`reusing ${plan.copy}`);
    else {
      o.out(`copying ${plan.source} to ${plan.copy}`);
      await admin.create(plan.copy, plan.source);
    }
    await writePrivate(plan.envFile, setEnvLine(original, "DATABASE_URL", copyUrl));
    o.out(`DATABASE_URL names ${plan.copy}`);
    const dir = (0, import_node_path12.join)(o.root, typeof o.sections.db?.migrations === "string" ? o.sections.db.migrations : "packages/db/migrations");
    const applied = await o.deps.migrate(copyUrl, dir);
    o.out(`migrated ${plan.copy}: ${applied.length} migration(s)`);
    code = await o.deps.runDev({ root: o.root, commonDir: plan.checkout.commonDir, err: menuWatcher(o) });
  } finally {
    await writePrivate(plan.envFile, original);
    try {
      if (o.keepDb) o.out(`keeping ${plan.copy} (--keep-db)`);
      else {
        await admin.drop(plan.copy);
        o.out(`dropped ${plan.copy}`);
      }
    } finally {
      await admin.close();
    }
  }
  return code;
}
async function cleanupWorktrees(o) {
  const plan = await planWorktree(o);
  const live = /* @__PURE__ */ new Set();
  for (const run of await o.deps.liveRuns()) live.add(copyName(plan.prefix, (await readCheckout(run.checkout)).toplevel));
  const admin = await o.deps.admin(plan.baseUrl, (name) => name.startsWith(plan.prefix));
  const dropped = [];
  try {
    for (const name of await admin.list(plan.prefix)) {
      if (live.has(name)) {
        o.out(`keeping ${name}: its run is live`);
        continue;
      }
      await admin.drop(name);
      dropped.push(name);
      o.out(`dropped ${name}`);
    }
  } finally {
    await admin.close();
  }
  return dropped;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  JOBS_DIR,
  QA_PROVIDER,
  QA_TELEGRAM_PORT,
  STAMP_FILE,
  ShiftClock,
  UNDO_FILE,
  WORLD_SUFFIX,
  armFact,
  assertQaTarget,
  assertRegistry,
  baseSeedNames,
  buildRegistry,
  cleanupWorktrees,
  copyName,
  copyPrefix,
  createFork,
  databaseName,
  dbAdmin,
  defineWorld,
  devProjectName,
  disarmFact,
  dropFork,
  factById,
  featuresWithoutWorld,
  fixtureArming,
  forkName,
  forkUndoFile,
  hookSeedNames,
  idProblem,
  importFromProject,
  importProjectJobs,
  isLoopbackHost,
  listJobs,
  listWorld,
  listenQaApp,
  loadAppEntry,
  loadRegistry,
  loadWorlds,
  openFork,
  openWorld,
  parseShift,
  personaById,
  personaIds,
  pgAdmin,
  pgliteAdmin,
  planWorktree,
  qaAccountId,
  qaDatabase,
  qaDbSection,
  qaFakeBots,
  qaFakeToken,
  qaSections,
  qaTargetProblem,
  qaTelegramId,
  rawSqlFindings,
  readCheckout,
  readStamp,
  readUndo,
  registryHash,
  registryProblem,
  resetWorld,
  runJob,
  runWorktree,
  seedWorld,
  seededName,
  serveFork,
  setEnvLine,
  setMenuButton,
  urlWithDatabase,
  worldFiles,
  worldForkRunner,
  worldLintFindings,
  worldStatus
});
//# sourceMappingURL=world.cjs.map