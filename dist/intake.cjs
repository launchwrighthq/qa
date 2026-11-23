"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// node_modules/.pnpm/tsup@8.5.1_postcss@8.5.33_tsx@4.23.15_typescript@6.0.3/node_modules/tsup/assets/cjs_shims.js
var init_cjs_shims = __esm({
  "node_modules/.pnpm/tsup@8.5.1_postcss@8.5.33_tsx@4.23.15_typescript@6.0.3/node_modules/tsup/assets/cjs_shims.js"() {
    "use strict";
  }
});

// src/kernel/services/actor.mts
var init_actor = __esm({
  "src/kernel/services/actor.mts"() {
    "use strict";
    init_cjs_shims();
  }
});

// src/kernel/services/errors.mts
function isCodedError(e) {
  if (e instanceof LaunchwrightError) return true;
  if (typeof e !== "object" || e === null) return false;
  const { code, message } = e;
  return typeof message === "string" && typeof code === "string" && DOTTED_CODE.test(code);
}
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}
var LaunchwrightError, DOTTED_CODE, BootError;
var init_errors = __esm({
  "src/kernel/services/errors.mts"() {
    "use strict";
    init_cjs_shims();
    LaunchwrightError = class extends Error {
      code;
      context;
      constructor(code, message, opts) {
        super(message, opts && "cause" in opts ? { cause: opts.cause } : void 0);
        this.name = new.target.name;
        this.code = code;
        this.context = opts?.context ?? {};
      }
    };
    DOTTED_CODE = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i;
    BootError = class extends LaunchwrightError {
    };
  }
});

// src/kernel/services/apps.mts
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
function appDir(template, apps) {
  return template.replace(APP_DIR, (_m, name) => apps.find((a) => a.name === name)?.path ?? `apps/${name}`);
}
var import_zod, APP_RUNTIMES, APP_NAME, processSchema, appSchema, appsSchema, contractSchema, DEFAULT_APPS, APP_DIR;
var init_apps = __esm({
  "src/kernel/services/apps.mts"() {
    "use strict";
    init_cjs_shims();
    import_zod = require("zod");
    init_errors();
    APP_RUNTIMES = ["node", "python", "web"];
    APP_NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
    processSchema = import_zod.z.strictObject({
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
    appSchema = import_zod.z.strictObject({
      runtime: import_zod.z.enum(APP_RUNTIMES),
      path: import_zod.z.string().min(1).optional(),
      modules: import_zod.z.array(import_zod.z.string().min(1)).optional(),
      processes: import_zod.z.record(import_zod.z.string().regex(APP_NAME, "must be letters, digits and -"), processSchema).optional(),
      /** A `web` app: the `node` app that serves its files. */
      servedBy: import_zod.z.string().min(1).optional()
    });
    appsSchema = import_zod.z.record(import_zod.z.string().regex(APP_NAME, "must be letters, digits and -"), appSchema);
    contractSchema = import_zod.z.looseObject({ python: import_zod.z.array(import_zod.z.string().min(1)).optional(), ts: import_zod.z.array(import_zod.z.string().min(1)).optional() });
    DEFAULT_APPS = {
      api: { runtime: "node", path: "apps/api" },
      client: { runtime: "web", path: "apps/client", servedBy: "api" },
      console: { runtime: "web", path: "apps/console", servedBy: "api" },
      ai: { runtime: "python", path: "apps/ai" }
    };
    APP_DIR = /\{app:([A-Za-z0-9][A-Za-z0-9-]*)\}/g;
  }
});

// src/kernel/services/apps-contract.mts
var init_apps_contract = __esm({
  "src/kernel/services/apps-contract.mts"() {
    "use strict";
    init_cjs_shims();
    init_apps();
  }
});

// src/kernel/services/clock.mts
function abortError(signal) {
  return signal.reason ?? new DOMException("The sleep was aborted", "AbortError");
}
var systemClock;
var init_clock = __esm({
  "src/kernel/services/clock.mts"() {
    "use strict";
    init_cjs_shims();
    systemClock = {
      now: () => Date.now(),
      date: () => new Date(Date.now()),
      sleep(ms, signal) {
        return new Promise((resolve9, reject) => {
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
            resolve9();
          }, ms);
          signal?.addEventListener("abort", onAbort, { once: true });
        });
      }
    };
  }
});

// src/kernel/config.mts
var import_zod2, PROCESS_ROLES, kernelConfig;
var init_config = __esm({
  "src/kernel/config.mts"() {
    "use strict";
    init_cjs_shims();
    import_zod2 = require("zod");
    init_errors();
    PROCESS_ROLES = ["all", "web", "worker"];
    kernelConfig = import_zod2.z.object({
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
  }
});

// src/kernel/services/container.mts
var init_container = __esm({
  "src/kernel/services/container.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
  }
});

// src/kernel/events.mts
var init_events = __esm({
  "src/kernel/events.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
  }
});

// src/kernel/services/health.mts
var init_health = __esm({
  "src/kernel/services/health.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
  }
});

// src/kernel/services/lifecycle.mts
var init_lifecycle = __esm({
  "src/kernel/services/lifecycle.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
  }
});

// src/kernel/services/key-words.mts
var SECRET_WORDS, SECRET_KEY_PATTERN;
var init_key_words = __esm({
  "src/kernel/services/key-words.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
    SECRET_WORDS = ["password", "secret", "token", "key", "authorization"];
    SECRET_KEY_PATTERN = new RegExp(`^(?:${SECRET_WORDS.join("|")})s?$`, "i");
  }
});

// src/kernel/services/logger.mts
var init_logger = __esm({
  "src/kernel/services/logger.mts"() {
    "use strict";
    init_cjs_shims();
    init_clock();
    init_key_words();
  }
});

// src/kernel/services/order.mts
var init_order = __esm({
  "src/kernel/services/order.mts"() {
    "use strict";
    init_cjs_shims();
  }
});

// src/kernel/provider.mts
function provider(p) {
  return p;
}
var kernelProvider;
var init_provider = __esm({
  "src/kernel/provider.mts"() {
    "use strict";
    init_cjs_shims();
    init_config();
    kernelProvider = provider({
      name: "kernel",
      config: { section: "kernel", schema: kernelConfig },
      register: () => void 0
    });
  }
});

// src/kernel/services/stamp.mts
var import_zod3, DEV_RELEASE, RELEASE_ID, SEMVER, stampConfig;
var init_stamp = __esm({
  "src/kernel/services/stamp.mts"() {
    "use strict";
    init_cjs_shims();
    import_zod3 = require("zod");
    init_clock();
    init_errors();
    DEV_RELEASE = "dev";
    RELEASE_ID = /^[1-9][0-9]{0,8}-[0-9a-f]{7}$/;
    SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
    stampConfig = import_zod3.z.strictObject({
      version: import_zod3.z.string().regex(SEMVER, "must be semver MAJOR.MINOR.PATCH[-pre] with no build metadata"),
      release: import_zod3.z.string().refine((r) => r === DEV_RELEASE || RELEASE_ID.test(r), `must be ${DEV_RELEASE} or <build>-<sha7>`),
      commit: import_zod3.z.string().regex(/^[0-9a-f]{40}$/, "must be 40 lower-case hex digits").nullable(),
      builtAt: import_zod3.z.iso.datetime({ offset: true, error: "must be an ISO date and time" })
    });
  }
});

// src/kernel/tokens.mts
function token(name) {
  return Object.freeze({ key: Symbol(name), name });
}
var APP, CONFIG, LOGGER, EVENTS, CLOCK, ACCOUNTS;
var init_tokens = __esm({
  "src/kernel/tokens.mts"() {
    "use strict";
    init_cjs_shims();
    APP = token("kernel.app");
    CONFIG = token("kernel.config");
    LOGGER = token("kernel.logger");
    EVENTS = token("kernel.events");
    CLOCK = token("kernel.clock");
    ACCOUNTS = token("kernel.accounts");
  }
});

// src/kernel/services/app.mts
var init_app = __esm({
  "src/kernel/services/app.mts"() {
    "use strict";
    init_cjs_shims();
    init_apps();
    init_clock();
    init_config();
    init_container();
    init_errors();
    init_events();
    init_health();
    init_lifecycle();
    init_logger();
    init_order();
    init_provider();
    init_stamp();
    init_tokens();
  }
});

// src/kernel/services/hmac.mts
var import_node_crypto, encoder;
var init_hmac = __esm({
  "src/kernel/services/hmac.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto = require("crypto");
    encoder = new TextEncoder();
  }
});

// src/kernel/services/env-grammar.mts
var init_env_grammar = __esm({
  "src/kernel/services/env-grammar.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
  }
});

// src/kernel/services/driver.mts
var BaseDriver;
var init_driver = __esm({
  "src/kernel/services/driver.mts"() {
    "use strict";
    init_cjs_shims();
    BaseDriver = class {
      constructor(name, specVersion, capabilities) {
        this.name = name;
        this.specVersion = specVersion;
        this.capabilities = new Set(capabilities);
      }
      name;
      specVersion;
      capabilities;
      supports(cap) {
        return this.capabilities.has(cap);
      }
    };
  }
});

// src/kernel/services/html.mts
var init_html = __esm({
  "src/kernel/services/html.mts"() {
    "use strict";
    init_cjs_shims();
  }
});

// src/kernel/services/manager.mts
var init_manager = __esm({
  "src/kernel/services/manager.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
    init_tokens();
  }
});

// src/kernel/services/manifest.mts
var import_promises, import_node_path, import_smol_toml, import_zod4, manifestSchema;
var init_manifest = __esm({
  "src/kernel/services/manifest.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises = require("fs/promises");
    import_node_path = require("path");
    import_smol_toml = require("smol-toml");
    import_zod4 = require("zod");
    init_errors();
    init_order();
    manifestSchema = import_zod4.z.object({
      name: import_zod4.z.string().min(1),
      summary: import_zod4.z.string(),
      requires: import_zod4.z.array(import_zod4.z.string()).default([]),
      languages: import_zod4.z.array(import_zod4.z.enum(["ts", "py"])).min(1),
      submodules: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.object({ default: import_zod4.z.boolean().optional(), requires: import_zod4.z.array(import_zod4.z.string()).optional() })).default({}),
      contributes: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.unknown()).default({})
    });
  }
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
var init_peers = __esm({
  "src/kernel/services/peers.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
  }
});

// src/kernel/services/module-fixture.mts
var import_node_fs;
var init_module_fixture = __esm({
  "src/kernel/services/module-fixture.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs = require("fs");
    init_errors();
  }
});

// src/kernel/services/resolve-import.mts
var import_node_fs2, import_node_path2;
var init_resolve_import = __esm({
  "src/kernel/services/resolve-import.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs2 = require("fs");
    import_node_path2 = require("path");
    init_errors();
  }
});

// src/kernel/services/stamp-source.mts
var import_node_fs3, import_node_path3;
var init_stamp_source = __esm({
  "src/kernel/services/stamp-source.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs3 = require("fs");
    import_node_path3 = require("path");
    init_clock();
    init_errors();
    init_stamp();
  }
});

// src/kernel/services/project.mts
var import_zod5, NAME, ENV_NAME, moduleOptions, STAMP_REFUSED, projectConfigSchema;
var init_project = __esm({
  "src/kernel/services/project.mts"() {
    "use strict";
    init_cjs_shims();
    import_zod5 = require("zod");
    init_apps();
    init_errors();
    init_stamp();
    init_stamp_source();
    NAME = /^[a-z][a-z0-9-]*$/;
    ENV_NAME = /^[a-z][a-z0-9_-]*$/;
    moduleOptions = import_zod5.z.record(import_zod5.z.string(), import_zod5.z.unknown());
    STAMP_REFUSED = "is not allowed: the build sets the stamp from LW_VERSION, LW_RELEASE, LW_COMMIT and LW_BUILT_AT";
    projectConfigSchema = import_zod5.z.object({
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
  }
});

// src/kernel/index.mts
var import_zod6;
var init_kernel = __esm({
  "src/kernel/index.mts"() {
    "use strict";
    init_cjs_shims();
    init_actor();
    init_apps();
    init_apps_contract();
    init_app();
    init_config();
    init_container();
    init_clock();
    init_hmac();
    init_env_grammar();
    init_driver();
    init_errors();
    init_events();
    init_health();
    init_html();
    init_lifecycle();
    init_key_words();
    init_logger();
    init_manager();
    init_manifest();
    init_peers();
    init_module_fixture();
    init_resolve_import();
    init_project();
    init_stamp();
    init_stamp_source();
    init_provider();
    init_tokens();
    import_zod6 = require("zod");
  }
});

// src/intake/config.mts
var qaIntakeConfig;
var init_config2 = __esm({
  "src/intake/config.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    qaIntakeConfig = import_zod6.z.object({
      default: import_zod6.z.string().default("github"),
      maxFileMb: import_zod6.z.number().positive().default(200),
      drivers: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.record(import_zod6.z.string(), import_zod6.z.unknown())).default({})
    }).prefault({});
  }
});

// src/intake/drivers/intake/contract.mts
var QA_INTAKE_SPEC_VERSION, QA_INTAKE_CAPABILITIES;
var init_contract = __esm({
  "src/intake/drivers/intake/contract.mts"() {
    "use strict";
    init_cjs_shims();
    QA_INTAKE_SPEC_VERSION = "1";
    QA_INTAKE_CAPABILITIES = ["window", "cursor", "follow"];
  }
});

// src/intake/drivers/intake/fake.mts
var fake_exports = {};
__export(fake_exports, {
  FAKE_INTAKE_ITEMS: () => FAKE_INTAKE_ITEMS,
  FakeIntakeDriver: () => FakeIntakeDriver
});
function after(item, bound) {
  return typeof bound === "number" ? Number(item.id) > bound : Date.parse(item.at) >= bound.getTime();
}
function before(item, bound) {
  return typeof bound === "number" ? Number(item.id) < bound : Date.parse(item.at) < bound.getTime();
}
var bytes, FAKE_INTAKE_ITEMS, FakeIntakeDriver;
var init_fake = __esm({
  "src/intake/drivers/intake/fake.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_contract();
    bytes = (head, size) => {
      const out = new Uint8Array(size);
      out.set(Array.from(head, (c) => c.charCodeAt(0) & 255));
      return out;
    };
    FAKE_INTAKE_ITEMS = [
      {
        id: "101",
        at: "2026-11-01T10:00:00.000Z",
        author: "Tester One",
        text: "The checkout button does nothing on my phone.",
        media: [{ from: "tg:fake/101", kind: "image", mime: "image/png", name: "screen.png", data: bytes("\x89PNG\r\n\n", 64) }]
      },
      {
        id: "102",
        at: "2026-11-01T10:05:00.000Z",
        author: "Tester One",
        text: "Here is a recording of the tap.",
        media: [{ from: "tg:fake/102", kind: "video", mime: "video/mp4", name: "tap.mp4", data: bytes("\0\0\0ftypmp42", 96) }]
      },
      { id: "103", at: "2026-11-01T10:30:00.000Z", author: "Developer", text: "Which phone model is it?", replyTo: "101", media: [] },
      {
        id: "104",
        at: "2026-11-01T10:40:00.000Z",
        author: "Tester One",
        text: "A mid-range Android phone, the newest system version.",
        replyTo: "103",
        media: [{ from: "tg:fake/104", kind: "voice", mime: "audio/ogg", data: bytes("OggS", 32) }]
      },
      {
        id: "105",
        at: "2026-11-02T08:00:00.000Z",
        author: "Tester Two",
        text: "The profile page shows an empty avatar after an upload.",
        media: [{ from: "tg:fake/105", kind: "file", mime: "application/zip", name: "logs.zip", data: bytes("PK", 4096) }]
      },
      { id: "106", at: "2026-11-02T08:20:00.000Z", author: "Tester Two", text: "It happens on the desktop site too.", media: [] }
    ];
    FakeIntakeDriver = class extends BaseDriver {
      constructor(opts = {}) {
        super("fake", QA_INTAKE_SPEC_VERSION, ["window", "cursor", "follow"]);
        this.opts = opts;
        this.source = opts.source ?? "telegram";
      }
      opts;
      source;
      /** Every ref that `fetch` read. */
      refs = [];
      async fetch(ref, window = {}) {
        if (ref.trim() === "") throw new LaunchwrightError("qa.intake.ref", "The fake intake driver needs a ref.");
        this.refs.push(ref);
        if (window.follow && !window.signal) {
          throw new LaunchwrightError("qa.intake.follow", "A follow fetch needs an AbortSignal to stop it.");
        }
        const since = window.since ?? (window.cursor !== void 0 ? Number(window.cursor) : void 0);
        const pool = [...this.opts.items ?? FAKE_INTAKE_ITEMS, ...window.follow ? this.opts.arriving ?? [] : []];
        const items = pool.filter((i) => (since === void 0 || after(i, since)) && (window.until === void 0 || before(i, window.until))).map((i) => this.capped(i));
        if (window.follow && window.signal && !window.signal.aborted) {
          const signal = window.signal;
          await new Promise((resolve9) => signal.addEventListener("abort", () => resolve9(), { once: true }));
        }
        const last = items.at(-1)?.id ?? window.cursor;
        return {
          source: this.source,
          ref,
          ...this.opts.title !== void 0 ? { title: this.opts.title } : {},
          items,
          ...last !== void 0 ? { cursor: last } : {}
        };
      }
      capped(item) {
        const max = this.opts.maxBytes ?? Number.POSITIVE_INFINITY;
        const media = item.media.map((m) => {
          if (m.data === void 0 || m.data.byteLength <= max) return { ...m };
          return { from: m.from, kind: m.kind, mime: m.mime, ...m.name !== void 0 ? { name: m.name } : {}, skipped: "too-large" };
        });
        return { ...item, media };
      }
    };
  }
});

// src/intake/services/links.mts
function isGithubUpload(url) {
  if (UPLOAD_HOSTS.includes(url.hostname)) return true;
  return url.hostname === "github.com" && UPLOAD_PATH.test(url.pathname);
}
function takesGithubToken(url) {
  return url.protocol === "https:" && isGithubUpload(url);
}
function isGithubMediaHost(url) {
  if (url.protocol !== "https:") return false;
  return isGithubUpload(url) || url.hostname.endsWith(".githubusercontent.com") || ASSET_STORE.test(url.hostname);
}
function parse2(raw) {
  const trimmed = raw.replace(/[),.;:!?'"\]>]+$/, "");
  if (!URL.canParse(trimmed)) return null;
  const url = new URL(trimmed);
  return url.protocol === "https:" || url.protocol === "http:" ? url : null;
}
function mediaLinks(markdown) {
  const found = [];
  const add = (index, raw, always) => {
    if (raw === void 0) return;
    const url = parse2(raw);
    if (url === null) return;
    if (always || isGithubUpload(url) || MEDIA_EXTENSION.test(url.pathname)) found.push({ index, url: url.href });
  };
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g)) add(m.index, m[1], true);
  for (const m of markdown.matchAll(/<(?:img|video|source)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m.index, m[1], true);
  for (const m of markdown.matchAll(/https?:\/\/[^\s<>()"'`]+/g)) add(m.index, m[0], false);
  found.sort((a, b) => a.index - b.index);
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const f of found) {
    if (seen.has(f.url)) continue;
    seen.add(f.url);
    out.push(f.url);
  }
  return out;
}
var UPLOAD_HOSTS, UPLOAD_PATH, MEDIA_EXTENSION, ASSET_STORE;
var init_links = __esm({
  "src/intake/services/links.mts"() {
    "use strict";
    init_cjs_shims();
    UPLOAD_HOSTS = ["user-images.githubusercontent.com", "private-user-images.githubusercontent.com"];
    UPLOAD_PATH = /^\/user-attachments\/(assets|files)\//;
    MEDIA_EXTENSION = /\.(png|jpe?g|gif|webp|heic|mp4|mov|webm)$/i;
    ASSET_STORE = /^github-production-user-asset-[a-z0-9]+\.s3\.amazonaws\.com$/;
  }
});

// src/commands/extensions.mts
var import_node_url;
var init_extensions = __esm({
  "src/commands/extensions.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_url = require("url");
    init_kernel();
  }
});

// src/config.mts
function withAppPaths(cfg, sections = {}) {
  const apps = sectionApps(sections);
  const dir = (p) => appDir(p, apps);
  const routeTables = cfg.routeTables.map((t) => typeof t === "string" ? dir(t) : { ...t, file: dir(t.file) });
  return { ...cfg, app: dir(cfg.app), clientRoots: cfg.clientRoots.map(dir), buildDirs: cfg.buildDirs.map(dir), routeTables, typeRoots: cfg.typeRoots.map(dir) };
}
function qaConfigOf(sections = {}) {
  return withAppPaths(qaConfig.parse(sections.qa ?? {}), sections);
}
var legConfig, qaConfig;
var init_config3 = __esm({
  "src/config.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    legConfig = import_zod6.z.object({
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
    qaConfig = import_zod6.z.object({
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
  }
});

// src/commands/qa.command.mts
var init_qa_command = __esm({
  "src/commands/qa.command.mts"() {
    "use strict";
    init_cjs_shims();
    init_config3();
    init_extensions();
  }
});

// src/kernel/services/args.mts
function optionsOf(spec) {
  const options = {};
  for (const name of spec.values ?? []) options[name] = { type: "string" };
  for (const name of spec.switches ?? []) options[name] = { type: "boolean" };
  for (const name of spec.repeated ?? []) options[name] = { type: "string", multiple: true };
  return options;
}
function asUsage(cause) {
  const code = cause?.code;
  if (typeof code !== "string" || !code.startsWith("ERR_PARSE_ARGS_")) return cause;
  return new UsageError(String(cause.message), { cause, context: { code } });
}
function markNegatives(argv, valueFlags) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i];
    if (word === "--") return [...out, ...argv.slice(i)];
    const next = argv[i + 1];
    if (word.startsWith("--") && valueFlags.has(word.slice(2)) && next !== void 0) {
      out.push(...NEGATIVE.test(next) ? [`${word}=${next}`] : [word, next]);
      i++;
    } else out.push(NEGATIVE.test(word) ? NEGATIVE_MARK + word : word);
  }
  return out;
}
function unmark(word) {
  return word.startsWith(NEGATIVE_MARK) ? word.slice(NEGATIVE_MARK.length) : word;
}
function parseCommandArgs(spec, argv) {
  const valueFlags = /* @__PURE__ */ new Set([...spec.values ?? [], ...spec.repeated ?? []]);
  let parsed;
  try {
    parsed = (0, import_node_util.parseArgs)({ args: markNegatives(argv, valueFlags), options: optionsOf(spec), strict: true, allowPositionals: true });
  } catch (cause) {
    throw asUsage(cause);
  }
  const found = parsed.values;
  const values = {};
  for (const name of spec.values ?? []) {
    const value = found[name];
    if (typeof value === "string") values[name] = value;
  }
  const switches = new Set((spec.switches ?? []).filter((name) => found[name] === true));
  const lists = {};
  for (const name of spec.repeated ?? []) {
    const value = found[name];
    lists[name] = Array.isArray(value) ? value : [];
  }
  return { positionals: parsed.positionals.map(unmark), values, switches, lists };
}
var import_node_util, UsageError, NEGATIVE, NEGATIVE_MARK;
var init_args = __esm({
  "src/kernel/services/args.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_util = require("util");
    init_errors();
    UsageError = class extends LaunchwrightError {
      constructor(message, opts) {
        super("kernel.usage", message, opts);
      }
    };
    NEGATIVE = /^-\d+(\.\d+)?$/;
    NEGATIVE_MARK = "\0";
  }
});

// src/kernel/services/fs.mts
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
async function readJsonOrNull(path) {
  const text2 = await readTextOrNull(path);
  if (text2 === null) return null;
  try {
    return JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("kernel.fs.json", `${path} is not valid JSON`, { cause, context: { path } });
  }
}
function sha256(data) {
  return (0, import_node_crypto2.createHash)("sha256").update(data).digest("hex");
}
async function hashFile(path) {
  const hash = (0, import_node_crypto2.createHash)("sha256");
  try {
    for await (const chunk2 of (0, import_node_fs4.createReadStream)(path)) hash.update(chunk2);
  } catch (cause) {
    throw readError(path, cause);
  }
  return hash.digest("hex");
}
var import_node_crypto2, import_node_fs4, import_promises2, import_smol_toml2, MISSING;
var init_fs = __esm({
  "src/kernel/services/fs.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto2 = require("crypto");
    import_node_fs4 = require("fs");
    import_promises2 = require("fs/promises");
    import_smol_toml2 = require("smol-toml");
    init_errors();
    MISSING = /* @__PURE__ */ new Set(["ENOENT", "ENOTDIR"]);
  }
});

// src/services/types.mts
var INTAKE_DIR;
var init_types = __esm({
  "src/services/types.mts"() {
    "use strict";
    init_cjs_shims();
    INTAKE_DIR = ".lw/qa/intake";
  }
});

// src/services/ledger.mts
function reportPaths(reportDir, slug) {
  return {
    md: (0, import_node_path4.join)(reportDir, `${slug}.md`),
    plan: (0, import_node_path4.join)(reportDir, `${slug}.shots.json`),
    assets: (0, import_node_path4.join)(reportDir, assetsRel(slug)),
    ledger: (0, import_node_path4.join)(reportDir, assetsRel(slug), LEDGER_FILE),
    results: (0, import_node_path4.join)(reportDir, assetsRel(slug), RESULTS_FILE),
    html: (0, import_node_path4.join)(reportDir, "dist", `${slug}.html`)
  };
}
async function fileDigest(path) {
  const sha2562 = await hashFile(path);
  return { sha256: sha2562, bytes: (await (0, import_promises3.stat)(path)).size };
}
async function ledgerEntry(reportDir, facts) {
  checkEntryPath(facts.path);
  const { sha256: sha2562, bytes: bytes2 } = await fileDigest((0, import_node_path4.join)(reportDir, facts.path));
  return { ...facts, sha256: sha2562, bytes: bytes2 };
}
function checkEntryPath(path) {
  if (!/^assets\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-][A-Za-z0-9._/-]*$/.test(path) || path.split("/").includes("..")) {
    throw new LaunchwrightError("qa.ledger.path", `Ledger path ${path} is not assets/<slug>/<file>`, { context: { path } });
  }
}
function entryProblem(e) {
  if (!isObject(e)) return "not an object";
  for (const key of ["path", "kind", "sha256", "capturedAt", "commit", "leg", "target", "provenance", "row"]) {
    if (typeof e[key] !== "string" || e[key] === "") return `${key} is missing`;
  }
  if (!/^[0-9a-f]{64}$/.test(e.sha256)) return "sha256 is not 64 hex characters";
  if (typeof e.bytes !== "number" || typeof e.attempt !== "number" || typeof e.dirty !== "boolean") return "bytes, attempt or dirty has the wrong type";
  return null;
}
async function readLedger(path) {
  const raw = await readTextOrNull(path);
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError("qa.ledger.invalid", `The ledger ${path} is not JSON`, { cause, context: { path } });
  }
  if (!isObject(parsed) || parsed.format !== LEDGER_FORMAT || typeof parsed.slug !== "string" || !Array.isArray(parsed.entries)) {
    throw new LaunchwrightError("qa.ledger.invalid", `The ledger ${path} is not format ${LEDGER_FORMAT} with slug and entries`, { context: { path } });
  }
  parsed.entries.forEach((e, i) => {
    const problem = entryProblem(e);
    if (problem) throw new LaunchwrightError("qa.ledger.invalid", `The ledger ${path} entry ${i}: ${problem}`, { context: { path, entry: i } });
  });
  return parsed;
}
async function writeLedger(path, ledger) {
  const paths = /* @__PURE__ */ new Set();
  for (const e of ledger.entries) {
    checkEntryPath(e.path);
    if (paths.has(e.path)) throw new LaunchwrightError("qa.ledger.duplicate", `The ledger lists ${e.path} twice`, { context: { path: e.path } });
    paths.add(e.path);
  }
  const sorted = { ...ledger, entries: [...ledger.entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
  await (0, import_promises3.mkdir)((0, import_node_path4.dirname)(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await (0, import_promises3.writeFile)(tmp, `${JSON.stringify(sorted, null, 2)}
`);
  await (0, import_promises3.rename)(tmp, path);
  return sorted;
}
async function appendLedger(reportDir, slug, entries) {
  const path = reportPaths(reportDir, slug).ledger;
  const current = await readLedger(path) ?? { format: LEDGER_FORMAT, slug, entries: [] };
  const byPath = new Map(current.entries.map((e) => [e.path, e]));
  for (const e of entries) byPath.set(e.path, e);
  return writeLedger(path, { format: LEDGER_FORMAT, slug, entries: [...byPath.values()] });
}
async function appendResult(path, result) {
  await (0, import_promises3.mkdir)((0, import_node_path4.dirname)(path), { recursive: true });
  await (0, import_promises3.writeFile)(path, `${JSON.stringify(result)}
`, { flag: "a" });
}
var import_promises3, import_node_path4, LEDGER_FILE, RESULTS_FILE, LEDGER_FORMAT, assetsRel, isObject;
var init_ledger = __esm({
  "src/services/ledger.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises3 = require("fs/promises");
    import_node_path4 = require("path");
    init_kernel();
    init_fs();
    init_types();
    LEDGER_FILE = "evidence.lock.json";
    RESULTS_FILE = "results.jsonl";
    LEDGER_FORMAT = 1;
    assetsRel = (slug) => `assets/${slug}`;
    isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  }
});

// src/states/services/inventory.mts
function isStateUnionName(name) {
  return STATE_SUFFIXES.some((s) => name.endsWith(s) && name.length > s.length);
}
function kindFor(inputs, outputs) {
  const hasIn = inputs.length > 0;
  const hasOut = outputs.length > 0;
  if (hasIn && hasOut) return "both";
  if (hasIn) return "input";
  if (hasOut) return "output";
  return "neither";
}
function mechanismFor(kind) {
  if (kind === "input" || kind === "both") return "mount";
  if (kind === "output") return "solve";
  return null;
}
function validateInventory(inv) {
  const errors = [];
  if (!isPlainObject(inv)) return ["the inventory is not an object"];
  if (typeof inv.generated !== "string" || inv.generated === "") errors.push("generated: missing");
  if (!Array.isArray(inv.roots) || inv.roots.length === 0 || inv.roots.some((r) => typeof r !== "string")) {
    errors.push("roots: must list the client roots the scan read");
  }
  if (!Array.isArray(inv.unions)) {
    errors.push("unions: must be an array");
    return errors;
  }
  const unions = inv.unions;
  if (inv.ignored !== void 0) {
    if (!Array.isArray(inv.ignored)) {
      errors.push("ignored: must be an array");
    } else {
      for (const [i, g] of inv.ignored.entries()) {
        const at = isPlainObject(g) && typeof g.name === "string" ? `ignored[${i}] "${g.name}"` : `ignored[${i}]`;
        if (!isPlainObject(g)) {
          errors.push(`${at}: not an object`);
          continue;
        }
        if (typeof g.reason !== "string" || g.reason.trim() === "") errors.push(`${at}: needs a reason`);
        if (!Array.isArray(g.members) || g.members.length === 0) {
          errors.push(`${at}: must carry its members, so the report can count what is not covered`);
        }
        if (unions.some((u) => isPlainObject(u) && u.name === g.name)) {
          errors.push(`${at}: is also in unions, so its states would be counted twice`);
        }
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  for (const [i, u] of unions.entries()) {
    const at = isPlainObject(u) && typeof u.name === "string" ? `unions[${i}] "${u.name}"` : `unions[${i}]`;
    if (!isPlainObject(u)) {
      errors.push(`${at}: not an object`);
      continue;
    }
    if (typeof u.name !== "string" || u.name === "") errors.push(`${at}: name is missing`);
    else if (seen.has(u.name)) errors.push(`${at}: duplicate union name`);
    else seen.add(u.name);
    if (typeof u.file !== "string" || u.file === "") errors.push(`${at}: file is missing`);
    if (!Array.isArray(u.members) || u.members.length < 2) {
      errors.push(`${at}: members must list at least two, or it is not a state union`);
    } else if (new Set(u.members).size !== u.members.length) {
      errors.push(`${at}: members repeat`);
    }
    const kindOk = KINDS.includes(u.kind);
    if (!kindOk) errors.push(`${at}: kind "${String(u.kind)}" is not one of ${KINDS.join(" ")}`);
    for (const key of ["inputs", "outputs"]) {
      if (!Array.isArray(u[key])) errors.push(`${at}: ${key} must be an array`);
    }
    if (Array.isArray(u.inputs) && Array.isArray(u.outputs) && kindOk) {
      const expected = kindFor(u.inputs, u.outputs);
      if (expected !== u.kind) errors.push(`${at}: kind is "${String(u.kind)}" but its sites say "${expected}"`);
    }
    for (const [j, o] of (Array.isArray(u.outputs) ? u.outputs : []).entries()) {
      if (!isPlainObject(o)) {
        errors.push(`${at}: outputs[${j}] is not an object`);
        continue;
      }
      if (!Array.isArray(o.params)) errors.push(`${at}: outputs[${j}] (${String(o.fn)}) has no params list`);
      if (o.exported !== true && o.exported !== false) errors.push(`${at}: outputs[${j}] must say whether it is exported`);
    }
  }
  return errors;
}
function plannedCaptures(inv) {
  const out = [];
  for (const u of inv.unions) {
    const mechanism = mechanismFor(u.kind);
    for (const member of u.members) out.push({ id: `${u.name}.${member}`, union: u.name, member, kind: u.kind, mechanism });
    if (u.outputs.some((o) => o.nullable)) out.push({ id: `${u.name}.null`, union: u.name, member: null, kind: u.kind, mechanism });
  }
  return out;
}
function solveSite(union) {
  const exported = union.outputs.filter((site) => site.exported);
  return exported.find((site) => site.params[0]?.shape) ?? exported[0] ?? null;
}
function statesDir(slug) {
  return `assets/${slug}/states`;
}
function statePath(slug, captureId, which, ext = "png") {
  return `${statesDir(slug)}/${captureId}.${which}.${ext}`;
}
function coverageFor(union, results) {
  const mine = results.filter((r) => r.id.startsWith(`${union.name}.`));
  const covered = mine.filter((r) => r.ok);
  const missing = mine.filter((r) => !r.ok).map((r) => r.id.slice(union.name.length + 1));
  return { covered: covered.length, planned: mine.length, missing };
}
function inferSeeds(inventory, unreachable2) {
  const out = [];
  for (const union of inventory.unions) {
    if (!unreachable2.has(union.name)) continue;
    const fields = union.inputs.map((site) => ({ interface: site.interface, field: site.field, file: site.file }));
    const drivable = union.inputs.length > 0 || solveSite(union) !== null;
    out.push({
      union: union.name,
      file: union.file,
      members: [...union.members],
      fields,
      via: drivable ? "app-service" : "direct-write",
      provenance: "forged",
      reason: union.kind === "neither" ? "nothing takes it and nothing returns it" : union.why ?? "no route delivers it and no mount draws it"
    });
  }
  return out;
}
var STATE_SUFFIXES, KINDS, IGNORE_TAG, PROVENANCE, FAIL_REASONS, isPlainObject;
var init_inventory = __esm({
  "src/states/services/inventory.mts"() {
    "use strict";
    init_cjs_shims();
    STATE_SUFFIXES = ["State", "Mark", "Status", "Kind", "Phase", "Variant"];
    KINDS = ["input", "output", "both", "neither"];
    IGNORE_TAG = "qa-states";
    PROVENANCE = ["live", "intercepted", "mounted", "forged"];
    FAIL_REASONS = [
      "unreachable",
      "identical",
      "state-mismatch",
      "unmountable",
      "no-mechanism",
      "blocked",
      "not-run",
      "crashed"
    ];
    isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  }
});

// src/services/paths.mts
function routeMatcher(pattern) {
  const [head = "", ...rest] = String(pattern).split("/");
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = rest.map((segment) => {
    if (!segment.startsWith(":")) return `/${escape(segment)}`;
    return segment.endsWith("?") ? "(?:/[^/]*)?" : "/[^/]+";
  }).join("");
  return new RegExp(`^${escape(head)}${tail}/?$`);
}
function routeMatches(pattern, pathname) {
  return routeMatcher(pattern).test(String(pathname).replace(/[?#].*$/, ""));
}
var init_paths = __esm({
  "src/services/paths.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_inventory();
  }
});

// src/states/services/solve.mts
function canonical(obj) {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(obj).sort().map((k) => [k, obj[k]])
    )
  );
}
function validateShape(shape) {
  const errors = [];
  if (!isPlainObject2(shape)) return ["the shape is not an object"];
  if (typeof shape.type !== "string" || shape.type === "") {
    errors.push("type: missing, and it names the parameter type this shape describes");
  }
  if (!isPlainObject2(shape.fields)) {
    errors.push("fields: must be an object of field descriptors");
    return errors;
  }
  const fields = shape.fields;
  const names = Object.keys(fields);
  if (names.length === 0) errors.push("fields: empty, so nothing can be varied");
  for (const name of names) errors.push(...validateField(fields[name], name));
  if (names.length > 0 && names.every((n) => isPlainObject2(fields[n]) && fields[n].kind === "opaque")) {
    errors.push("fields: every field is opaque, so no candidate can differ from the corpus");
  }
  return errors;
}
function validateField(field, at, insideNullable = false) {
  const errors = [];
  if (!isPlainObject2(field)) return [`${at}: not a field descriptor`];
  if (!FIELD_KINDS.includes(field.kind)) {
    return [`${at}: kind "${String(field.kind)}" is not one of ${FIELD_KINDS.join(" ")}`];
  }
  if (field.optional !== void 0 && typeof field.optional !== "boolean") errors.push(`${at}: optional must be a boolean`);
  if (insideNullable && field.optional === true) errors.push(`${at}: optional inside nullable says nothing new`);
  if (field.kind === "enum" && (!Array.isArray(field.values) || field.values.length < 2)) {
    errors.push(`${at}: enum needs at least two values, or it is a constant`);
  }
  if (field.kind === "number" && field.pivots !== void 0) {
    if (!Array.isArray(field.pivots) || field.pivots.some((p) => !Number.isFinite(p))) {
      errors.push(`${at}: pivots must be an array of finite numbers`);
    }
  }
  if (field.kind === "string" && field.sample !== void 0 && typeof field.sample !== "string") {
    errors.push(`${at}: sample must be a string`);
  }
  if (field.kind === "nullable") {
    if (!isPlainObject2(field.of)) errors.push(`${at}: nullable needs an "of" descriptor`);
    else if (field.of.kind === "nullable") errors.push(`${at}: nullable inside nullable adds a second null`);
    else errors.push(...validateField(field.of, `${at}.of`, true));
  }
  return errors;
}
function fieldValues(field, options = {}) {
  const values = baseValues(field, options);
  return field.optional === true ? [...values, ABSENT] : values;
}
function baseValues(field, options) {
  switch (field.kind) {
    case "boolean":
      return [true, false];
    case "number":
      return numberValues(field, options);
    case "string":
      return [typeof field.sample === "string" ? field.sample : DEFAULT_STRING, ""];
    case "enum":
      return [...field.values ?? []];
    case "nullable":
      return field.of ? [null, ...baseValues(field.of, options)] : [null];
    case "opaque":
      return [];
  }
}
function numberValues(field, options) {
  const pivots = [...field.pivots ?? [], ...options.pivots ?? []];
  const out = [0, 1];
  for (const p of pivots) out.push(p, p + 1, p - 1);
  return [...new Set(out)];
}
function mutate(base, edits) {
  const next = { ...base };
  for (const [field, value] of edits) {
    if (value === ABSENT) delete next[field];
    else next[field] = value;
  }
  return next;
}
function solveError(message, context = {}) {
  return new LaunchwrightError("qa.states.solve", message, { context });
}
function candidatePlan(shape, corpus, options = {}) {
  const errors = validateShape(shape);
  if (errors.length > 0) throw solveError(`The shape is unusable: ${errors.join("; ")}`, { errors });
  if (!Array.isArray(corpus) || corpus.length === 0) {
    throw solveError("The corpus is empty. It holds real objects from the wire, and a search of none reports every state unreachable.");
  }
  for (const [i, entry] of corpus.entries()) {
    if (!isPlainObject2(entry)) throw solveError(`corpus[${i}] is not an object`);
  }
  const limit = options.limit ?? MAX_CANDIDATES;
  if (!Number.isInteger(limit) || limit < 1) throw solveError(`limit must be a positive integer, not ${String(options.limit)}`);
  const values = /* @__PURE__ */ new Map();
  for (const [name, field] of Object.entries(shape.fields)) {
    const list3 = fieldValues(field, options);
    if (list3.length > 0) values.set(name, list3);
  }
  const names = [...values.keys()];
  const valuesOf = (name) => values.get(name) ?? [];
  const plan2 = [];
  const seen = /* @__PURE__ */ new Set();
  const full = () => plan2.length >= limit;
  const add = (candidate, base, baseIndex) => {
    const key = canonical(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    const { changes, text: text2 } = describeCandidate(candidate, base);
    plan2.push({ candidate, base, baseIndex, changes, text: text2 });
  };
  for (const [i, base] of corpus.entries()) {
    if (full()) break;
    add({ ...base }, base, i);
  }
  for (const [i, base] of corpus.entries()) {
    for (const name of names) {
      for (const value of valuesOf(name)) {
        if (full()) return plan2;
        add(mutate(base, [[name, value]]), base, i);
      }
    }
  }
  for (const [i, base] of corpus.entries()) {
    for (let a = 0; a < names.length; a += 1) {
      for (let b = a + 1; b < names.length; b += 1) {
        const first = names[a];
        const second = names[b];
        for (const x of valuesOf(first)) {
          for (const y of valuesOf(second)) {
            if (full()) return plan2;
            add(mutate(base, [[first, x], [second, y]]), base, i);
          }
        }
      }
    }
  }
  return plan2;
}
function describeCandidate(candidate, corpusEntry) {
  const names = [.../* @__PURE__ */ new Set([...Object.keys(corpusEntry), ...Object.keys(candidate)])];
  const changes = [];
  for (const field of names) {
    const had = Object.hasOwn(corpusEntry, field) && corpusEntry[field] !== void 0;
    const has = Object.hasOwn(candidate, field) && candidate[field] !== void 0;
    if (!had && !has) continue;
    if (had && has && same(corpusEntry[field], candidate[field])) continue;
    changes.push({ field, from: had ? corpusEntry[field] : ABSENT, to: has ? candidate[field] : ABSENT });
  }
  const text2 = changes.length === 0 ? "unchanged from the corpus entry" : changes.map((c) => `${c.field}: ${show(c.from)} -> ${show(c.to)}`).join(", ");
  return { changes, text: text2 };
}
function unreachable(union, tried) {
  const covered = union.covered ?? [];
  const missing = union.members.filter((m) => !covered.includes(m));
  if (missing.length === 0) return null;
  const varied = tried.fields.length > 0 ? tried.fields.join(", ") : "no field";
  const produced = covered.length > 0 ? covered.map((m) => show(m)).join(", ") : "nothing";
  return `${union.name}: ${missing.map((m) => show(m)).join(", ")} unreachable. ${tried.count} candidate${tried.count === 1 ? "" : "s"} varied ${varied}, and produced ${produced}. A state the type admits and the data cannot produce is a finding, not a gap in the search.`;
}
function normaliseState(raw) {
  if (raw === null || raw === void 0) return NULL_STATE;
  if (typeof raw !== "string") {
    throw solveError(`The state function answered ${typeof raw}. A state function returns a union member or null, so the wrong function was evaluated.`);
  }
  return raw;
}
async function solve(args) {
  const { shape, corpus, evaluate, members = null, union, limit, pivots } = args;
  const plan2 = candidatePlan(shape, corpus, { ...limit === void 0 ? {} : { limit }, ...pivots === void 0 ? {} : { pivots } });
  const wanted = members === null ? null : new Set(members);
  const covered = {};
  const order = [];
  let tried = 0;
  let hits = 0;
  for (const step of plan2) {
    tried += 1;
    const state = normaliseState(await evaluate(step.candidate));
    if (!Object.hasOwn(covered, state)) {
      covered[state] = { ...step, state };
      order.push(state);
      if (wanted?.has(state)) hits += 1;
    }
    if (wanted !== null && hits === wanted.size) break;
  }
  const name = union ?? shape.type;
  const missing = wanted === null ? [] : [...wanted].filter((m) => !Object.hasOwn(covered, m));
  const extra = wanted === null ? [] : order.filter((s) => !wanted.has(s));
  return {
    covered,
    order,
    tried,
    planned: plan2.length,
    limit: limit ?? MAX_CANDIDATES,
    missing,
    extra,
    sentence: missing.length === 0 || wanted === null ? null : unreachable({ name, members: [...wanted], covered: order }, { count: tried, fields: Object.keys(shape.fields) })
  };
}
function graft(base, candidate, fields) {
  const next = { ...base };
  for (const field of fields) {
    if (Object.hasOwn(candidate, field) && candidate[field] !== void 0) next[field] = candidate[field];
    else delete next[field];
  }
  return next;
}
function sameField(a, b, field) {
  const hasA = Object.hasOwn(a, field) && a[field] !== void 0;
  const hasB = Object.hasOwn(b, field) && b[field] !== void 0;
  if (!hasA && !hasB) return true;
  if (hasA !== hasB) return false;
  return same(a[field], b[field]);
}
async function anchorSubjects(args) {
  const { shape, base, covered, members, evaluate } = args;
  const errors = validateShape(shape);
  if (errors.length > 0) throw solveError(`The shape is unusable: ${errors.join("; ")}`, { errors });
  const shapeFields = Object.keys(shape.fields);
  const subjects = {};
  const fields = [];
  const anchored = [];
  const loose = [];
  const notes = [];
  let evaluations = 0;
  const answers = async (candidate) => {
    evaluations += 1;
    return normaliseState(await evaluate(candidate));
  };
  for (const member of members) {
    const hit = covered[member];
    if (hit === void 0 || !isPlainObject2(hit.candidate)) continue;
    const candidate = hit.candidate;
    let keep = shapeFields.filter((f) => !sameField(base, candidate, f));
    if (await answers(graft(base, candidate, keep)) !== member) {
      subjects[member] = { ...candidate };
      loose.push(member);
      notes.push(
        `${member} could not be anchored on the base row: grafting ${keep.length > 0 ? keep.join(", ") : "no field"} onto it does not produce the state, so the state depends on a field the shape does not declare. This member keeps the solver's own row, and its picture differs from the others in more than the state.`
      );
      continue;
    }
    for (const field of [...keep]) {
      const without = keep.filter((f) => f !== field);
      if (await answers(graft(base, candidate, without)) === member) keep = without;
    }
    subjects[member] = graft(base, candidate, keep);
    anchored.push(member);
    for (const f of keep) if (!fields.includes(f)) fields.push(f);
  }
  return { subjects, fields, anchored, loose, notes, evaluations };
}
var MAX_CANDIDATES, FIELD_KINDS, ABSENT, NULL_STATE, DEFAULT_STRING, isPlainObject2, same, show;
var init_solve = __esm({
  "src/states/services/solve.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    MAX_CANDIDATES = 500;
    FIELD_KINDS = ["boolean", "number", "string", "enum", "nullable", "opaque"];
    ABSENT = /* @__PURE__ */ Symbol.for("lw.qa.solve.absent");
    NULL_STATE = "null";
    DEFAULT_STRING = "qa";
    isPlainObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    same = (a, b) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
    show = (v) => v === ABSENT ? "(absent)" : typeof v === "string" ? JSON.stringify(v) : String(v);
  }
});

// src/states/services/capture.mts
function failureFields(e) {
  if (e instanceof CaptureFailure) return { reason: e.reason, ...e.detail };
  return { reason: "crashed" };
}
function errorText(e) {
  return messageOf(e);
}
function getAtPath(root, path) {
  let node = root;
  for (const key of path.split(".")) {
    if (Array.isArray(node)) {
      const index = Number(key);
      if (!Number.isInteger(index)) return void 0;
      node = node[index];
      continue;
    }
    if (!isPlainObject3(node)) return void 0;
    node = node[key];
  }
  return node;
}
function setAtPath(root, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  if (last === void 0) return false;
  let node = root;
  for (const key of keys) {
    if (Array.isArray(node)) node = node[Number(key)];
    else if (isPlainObject3(node)) node = node[key];
    else return false;
  }
  if (Array.isArray(node)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= node.length) return false;
    node[index] = value;
    return true;
  }
  if (!isPlainObject3(node) || !(last in node)) return false;
  node[last] = value;
  return true;
}
function freshHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !STALE_HEADERS.has(name.toLowerCase())));
}
async function installSubstitution(page, spec) {
  const state = {
    subjects: null,
    hits: 0,
    errors: [],
    corpus: [],
    bodies: []
  };
  const collect = (parsed, container) => {
    if (state.bodies.length < MAX_BODIES) state.bodies.push(parsed);
    for (const row of container) {
      if (state.corpus.length >= MAX_CORPUS) break;
      if (isPlainObject3(row)) state.corpus.push(row);
    }
  };
  const handler = async (route) => {
    try {
      const response = await route.fetch();
      const text2 = await response.text();
      const status = response.status();
      const headers = freshHeaders(response.headers());
      let parsed;
      try {
        parsed = JSON.parse(text2);
      } catch {
        state.errors.push(`${spec.url}: the response is not JSON, so no subject can be put into it`);
        await route.fulfill({ status, headers, body: text2 });
        return;
      }
      const container = getAtPath(parsed, spec.container);
      if (!Array.isArray(container)) {
        const what = container === void 0 ? "not in the response" : "not an array";
        state.errors.push(`${spec.url}: "${spec.container}" is ${what}, so the descriptor assumes a shape the server does not send`);
        await route.fulfill({ status, headers, body: text2 });
        return;
      }
      collect(parsed, container);
      if (state.subjects === null) {
        state.hits += 1;
        await route.fulfill({ status, headers, body: text2 });
        return;
      }
      if (!setAtPath(parsed, spec.container, [...state.subjects])) {
        state.errors.push(`${spec.url}: "${spec.container}" could not be written back`);
        await route.fulfill({ status, headers, body: text2 });
        return;
      }
      state.hits += 1;
      await route.fulfill({ status, headers, body: JSON.stringify(parsed) });
    } catch (e) {
      state.errors.push(`${spec.url}: ${errorText(e)}`);
      await route.continue();
    }
  };
  await page.route(spec.url, handler);
  return {
    get hits() {
      return state.hits;
    },
    get errors() {
      return state.errors;
    },
    get corpus() {
      return state.corpus;
    },
    get bodies() {
      return state.bodies;
    },
    record() {
      state.subjects = null;
      state.hits = 0;
      state.errors = [];
    },
    use(subjects) {
      state.subjects = subjects;
      state.hits = 0;
      state.errors = [];
    },
    assertApplied() {
      if (state.errors.length > 0) throw new CaptureFailure("blocked", `the interception failed: ${state.errors.join("; ")}`);
      if (state.hits === 0) {
        throw new CaptureFailure(
          "blocked",
          `the interception never fired: no request matched ${spec.url} during this rendering, so the page shows what the server really answered. A screenshot here would carry a state that nothing delivered`
        );
      }
    },
    async dispose() {
      await page.unroute(spec.url, handler);
    }
  };
}
function rotate(subjects) {
  if (subjects.length < 2) return [...subjects];
  return [...subjects.slice(1), subjects[0]];
}
function snapshotExpression(root, ignoreAttributes = [], maxNodes = MAX_TREE_NODES) {
  return `(() => {
  const rootSelector = ${JSON.stringify(root)};
  const skip = new Set(${JSON.stringify([...ignoreAttributes])});
  const cap = ${JSON.stringify(maxNodes)};
  const start = document.querySelector(rootSelector);
  if (start === null) throw new Error('qa states: no element matches the diff root ' + rootSelector);
  let seen = 0;
  const walk = (el) => {
    seen += 1;
    if (seen > cap) throw new Error('qa states: the tree under ' + rootSelector + ' exceeds ' + cap + ' nodes');
    const attrs = [];
    for (const a of Array.from(el.attributes)) if (!skip.has(a.name)) attrs.push(a.name + '=' + a.value);
    attrs.sort();
    let own = '';
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += ' ' + (n.textContent || '');
    const text = own.replace(/\\s+/g, ' ').trim();
    return { tag: el.tagName, self: JSON.stringify([el.tagName, attrs, text]), children: Array.from(el.children).map(walk) };
  };
  return walk(start);
})()`;
}
async function snapshotTree(page, options = {}) {
  return await page.evaluate(snapshotExpression(options.root ?? DEFAULT_DIFF_ROOT, options.ignoreAttributes ?? [], options.maxNodes ?? MAX_TREE_NODES));
}
function diffNodes(a, b) {
  const out = [];
  const walk3 = (x, y, path) => {
    if (x.self !== y.self || x.children.length !== y.children.length) {
      out.push(path);
      return;
    }
    for (let i = 0; i < x.children.length; i += 1) walk3(x.children[i], y.children[i], [...path, i]);
  };
  walk3(a, b, []);
  return out;
}
function commonAncestor(paths) {
  const [first] = paths;
  if (first === void 0) return [];
  let depth = first.length;
  for (const p of paths.slice(1)) {
    let i = 0;
    while (i < depth && i < p.length && p[i] === first[i]) i += 1;
    depth = i;
  }
  return first.slice(0, depth);
}
function nodeAt(tree, path) {
  let node = tree;
  for (const i of path) {
    const next = node.children[i];
    if (next === void 0) return null;
    node = next;
  }
  return node;
}
function subtreeDigest(node) {
  return `${node.self}(${node.children.map(subtreeDigest).join(",")})`;
}
function pathSelector(root, path) {
  return [root, ...path.map((i) => `*:nth-child(${i + 1})`)].join(" > ");
}
function diffClusters(tree, diffs) {
  const byPrefix = /* @__PURE__ */ new Map();
  for (const d of diffs) {
    for (let k = 0; k < d.length; k += 1) {
      const key = d.slice(0, k).join(",");
      let entry = byPrefix.get(key);
      if (entry === void 0) {
        entry = { prefix: d.slice(0, k), children: /* @__PURE__ */ new Set(), diffs: 0 };
        byPrefix.set(key, entry);
      }
      entry.children.add(d[k]);
      entry.diffs += 1;
    }
  }
  const out = [];
  for (const entry of byPrefix.values()) {
    const children = [...entry.children].sort((x, y) => x - y);
    const tags = children.map((i) => nodeAt(tree, [...entry.prefix, i])?.tag ?? null);
    const firstTag = tags[0] ?? null;
    const tag = firstTag !== null && tags.every((t) => t === firstTag) ? firstTag : null;
    out.push({ prefix: entry.prefix, children, diffs: entry.diffs, tag });
  }
  out.sort((x, y) => y.prefix.length - x.prefix.length || y.diffs - x.diffs);
  return out;
}
function locateSubjects(a, b, count) {
  const diffs = diffNodes(a, b);
  if (diffs.length === 0) {
    throw new CaptureFailure("identical", "the two renderings are identical: no element differs. Either these states render the same, which is the finding, or the subjects never reached the page");
  }
  if (diffs.some((d) => d.length === 0)) {
    throw new CaptureFailure("crashed", "the diff root itself differs between the two renderings, so the subject was not isolated");
  }
  const clusters = diffClusters(a, diffs).filter((c) => c.tag !== null);
  const exact = clusters.filter((c) => c.children.length === count);
  const [best, second] = exact;
  if (best && second && best.prefix.length === second.prefix.length && best.diffs === second.diffs) {
    throw new CaptureFailure(
      "crashed",
      `two elements each hold ${count} differing children of one tag (${pathSelector("root", best.prefix)} and ${pathSelector("root", second.prefix)}), so which one draws the subjects is a guess. The renderings differ in more than the state`
    );
  }
  if (!best) throw noContainer(a, clusters, diffs, count);
  return { ancestor: best.prefix, paths: best.children.map((slot) => [...best.prefix, slot]) };
}
function noContainer(tree, clusters, diffs, count) {
  const best = [...clusters].sort((x, y) => y.children.length - x.children.length || y.prefix.length - x.prefix.length)[0];
  const span = pathSelector("root", commonAncestor(diffs));
  if (best === void 0) {
    return new CaptureFailure(
      "identical",
      `the ${diffs.length} difference(s) sit under ${span} and no element holds ${count} differing children of one tag, so the ${count} subjects are not told apart. Something other than the subjects changed between the renderings`
    );
  }
  const container = nodeAt(tree, best.prefix);
  const collapsed = [];
  if (best.children.length < count && container !== null && container.children.length === count) {
    for (let slot = 0; slot < count; slot += 1) if (!best.children.includes(slot)) collapsed.push(`${slot} and ${(slot + 1) % count}`);
  }
  return new CaptureFailure(
    "identical",
    `${pathSelector("root", best.prefix)} holds ${best.children.length} differing <${best.tag}> child(ren) for ${count} subjects (${diffs.length} difference(s), spanning ${span}). ` + (collapsed.length > 0 ? `Subjects ${collapsed.join(", and ")} render an identical element, which is the finding` : "Either two consecutive members render identically, which is the finding, or something other than the subjects changed")
  );
}
function identicalRenderings(nodes) {
  const digests = nodes.map(subtreeDigest);
  const pairs = [];
  for (let i = 0; i < digests.length; i += 1) for (let j = i + 1; j < digests.length; j += 1) if (digests[i] === digests[j]) pairs.push([i, j]);
  return pairs;
}
async function assertSubjectIsolated(subject, root, maxRatio) {
  const [box, rootBox] = await Promise.all([subject.boundingBox(), root.boundingBox()]);
  if (box === null || box.width === 0 || box.height === 0) {
    throw new CaptureFailure("crashed", "the located subject has no box on screen, so there is nothing to photograph");
  }
  if (rootBox === null || rootBox.width === 0 || rootBox.height === 0) return;
  const ratio = box.width * box.height / (rootBox.width * rootBox.height);
  if (ratio > maxRatio) {
    throw new CaptureFailure(
      "crashed",
      `the located subject covers ${(ratio * 100).toFixed(0)}% of the diff root, over the ${(maxRatio * 100).toFixed(0)}% bound: the diff is the whole page`
    );
  }
}
function moduleUrl(projectRoot2, relativePath) {
  return `/@fs${import_node_path5.posix.join(projectRoot2.split("\\").join("/"), relativePath)}`;
}
function evaluateBatchExpression(moduleHref, exportName, items, extra = []) {
  return `(async () => {
  const href = ${JSON.stringify(moduleHref)};
  const name = ${JSON.stringify(exportName)};
  const mod = await import(/* @vite-ignore */ href);
  const fn = mod[name];
  if (typeof fn !== 'function') throw new Error('qa states: ' + href + ' exports no function named ' + name);
  const items = ${JSON.stringify(items)};
  const extra = ${JSON.stringify(extra)};
  const out = [];
  for (const item of items) {
    try {
      const answer = await fn(item, ...extra);
      out.push({ state: answer === null || answer === undefined ? null : String(answer), error: null });
    } catch (e) {
      out.push({ state: null, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
})()`;
}
async function evaluateBatch(page, projectRoot2, spec, batch) {
  const answers = await page.evaluate(evaluateBatchExpression(moduleUrl(projectRoot2, spec.module), spec.export, batch, spec.args ?? []));
  if (!Array.isArray(answers) || answers.length !== batch.length) {
    throw new CaptureFailure("crashed", `${spec.export}: the page answered ${Array.isArray(answers) ? answers.length : typeof answers} result(s) for ${batch.length} candidate(s)`);
  }
  return answers;
}
async function verifyInPage(page, projectRoot2, spec, subject) {
  const [answer] = await evaluateBatch(page, projectRoot2, spec, [subject]);
  if (!answer || answer.error !== null) throw new CaptureFailure("crashed", `${spec.export} threw on the injected subject: ${answer?.error ?? "no answer"}`);
  return answer.state ?? "null";
}
async function solveWithPage(page, projectRoot2, args) {
  const { verify, shape, members = null, union, limit, pivots } = args;
  const corpus = [...args.corpus];
  const batchSize = args.batchSize ?? DEFAULT_EVALUATE_BATCH;
  const options = { ...limit === void 0 ? {} : { limit }, ...pivots === void 0 ? {} : { pivots } };
  const plan2 = candidatePlan(shape, corpus, options);
  const memo = /* @__PURE__ */ new Map();
  let batches = 0;
  for (let i = 0; i < plan2.length; i += batchSize) {
    const slice = plan2.slice(i, i + batchSize);
    const answers = await evaluateBatch(page, projectRoot2, verify, slice.map((step) => step.candidate));
    batches += 1;
    for (const [j, answer] of answers.entries()) {
      const step = slice[j];
      if (!step) continue;
      if (answer.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on a candidate its type admits (${step.text}): ${answer.error}`);
      memo.set(canonical(step.candidate), answer.state);
    }
  }
  let memoMisses = 0;
  const result = await solve({
    shape,
    corpus,
    members,
    ...union === void 0 ? {} : { union },
    ...options,
    evaluate: async (candidate) => {
      const key = canonical(candidate);
      if (memo.has(key)) return memo.get(key) ?? null;
      memoMisses += 1;
      const [answer] = await evaluateBatch(page, projectRoot2, verify, [candidate]);
      if (!answer || answer.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on a candidate: ${answer?.error ?? "no answer"}`);
      memo.set(key, answer.state);
      return answer.state;
    }
  });
  return { result, evaluated: plan2.length, batches, memoMisses };
}
function parameterNamesExpression(moduleHref, exportName) {
  return `(async () => {
  const mod = await import(/* @vite-ignore */ ${JSON.stringify(moduleHref)});
  const fn = mod[${JSON.stringify(exportName)}];
  if (typeof fn !== 'function') return [];
  const src = Function.prototype.toString.call(fn);
  const open = src.indexOf('(');
  if (open < 0) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') { depth -= 1; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) return [];
  return src.slice(open + 1, close).split(',').map((p) => p.trim()).map((p) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p) ? p : ''));
})()`;
}
function exportedNumberExpression(moduleHref, name) {
  return `(async () => {
  let mod;
  try { mod = await import(/* @vite-ignore */ ${JSON.stringify(moduleHref)}); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  const found = mod[${JSON.stringify(name)}];
  return { value: typeof found === 'number' && Number.isFinite(found) ? found : null };
})()`;
}
function numbersUnderKey(body, key) {
  const found = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isPlainObject3(node)) return;
    for (const [k, v] of Object.entries(node)) {
      if (k === key && typeof v === "number" && Number.isFinite(v) && !found.includes(v)) found.push(v);
      visit(v);
    }
  };
  visit(body);
  return found;
}
async function resolvePivots(page, projectRoot2, hints, options = {}) {
  const resolved = {};
  const unresolved = {};
  const declaredArgs = options.verify?.args ?? [];
  const modules = [.../* @__PURE__ */ new Set([...options.verify ? [options.verify.module] : [], ...options.modules ?? []])];
  const bodies = options.bodies ?? [];
  const params = options.verify !== void 0 && hints.names.length > 0 ? await page.evaluate(parameterNamesExpression(moduleUrl(projectRoot2, options.verify.module), options.verify.export)) : [];
  for (const name of hints.names) {
    const at = params.indexOf(name);
    const fromArg = at > 0 ? declaredArgs[at - 1] : void 0;
    if (typeof fromArg === "number" && Number.isFinite(fromArg)) {
      resolved[name] = fromArg;
      continue;
    }
    let fromModule = null;
    const importErrors = [];
    for (const rel of modules) {
      const answer = await page.evaluate(exportedNumberExpression(moduleUrl(projectRoot2, rel), name));
      if (answer.error !== void 0) importErrors.push(`${rel}: ${answer.error}`);
      if (typeof answer.value === "number") {
        fromModule = answer.value;
        break;
      }
    }
    if (fromModule !== null) {
      resolved[name] = fromModule;
      continue;
    }
    const seen = [];
    for (const body of bodies) for (const n of numbersUnderKey(body, name)) if (!seen.includes(n)) seen.push(n);
    if (seen.length === 1) {
      resolved[name] = seen[0];
      continue;
    }
    unresolved[name] = seen.length > 1 ? `"${name}" is ${seen.join(", ")} in the captured responses, and choosing one would be a guess` : `"${name}" is no argument of ${options.verify?.export ?? "(no function)"}(${params.join(", ")}), no exported number of ${modules.join(" or ") || "(no module)"}, and under no key of that name in ${bodies.length} captured response(s)` + (importErrors.length > 0 ? `. Import failures: ${importErrors.join("; ")}` : "");
  }
  const pivots = [.../* @__PURE__ */ new Set([...hints.literals, ...Object.values(resolved)])].filter(Number.isFinite);
  return { pivots, resolved, unresolved };
}
async function solveGroupSubjects(page, projectRoot2, group, corpus, bodies) {
  if (group.solve === void 0) throw new CaptureFailure("blocked", `${group.id}: the group has no solve block`);
  const { verify } = group;
  const pivots = await resolvePivots(page, projectRoot2, group.solve.pivots ?? { literals: [], names: [] }, {
    verify,
    ...group.solve.pivotModules ? { modules: group.solve.pivotModules } : {},
    bodies
  });
  const members = group.members.map((m) => m.member ?? "null");
  const report2 = await solveWithPage(page, projectRoot2, {
    verify,
    shape: group.solve.shape,
    corpus,
    members,
    union: group.union,
    ...group.solve.limit === void 0 ? {} : { limit: group.solve.limit },
    pivots: pivots.pivots,
    ...group.solve.batchSize === void 0 ? {} : { batchSize: group.solve.batchSize }
  });
  const base = corpus[0];
  if (base === void 0) throw new CaptureFailure("unreachable", `${group.union}: the corpus is empty`, { fieldsTried: Object.keys(group.solve.shape.fields) });
  const anchor = await anchorSubjects({
    shape: group.solve.shape,
    base,
    covered: report2.result.covered,
    members,
    evaluate: async (candidate) => {
      const [answer] = await evaluateBatch(page, projectRoot2, verify, [candidate]);
      if (!answer || answer.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on an anchored candidate: ${answer?.error ?? "no answer"}`);
      return answer.state;
    }
  });
  const unresolvedNames = Object.values(pivots.unresolved);
  const subjectFor = [];
  const unreachable2 = /* @__PURE__ */ new Map();
  for (const [i, name] of members.entries()) {
    const hit = report2.result.covered[name];
    if (hit === void 0) {
      subjectFor.push(null);
      const why = report2.result.sentence ?? `${group.union}: ${name} was not produced by any candidate`;
      unreachable2.set(i, unresolvedNames.length > 0 ? `${why} Unresolved pivot: ${unresolvedNames.join("; ")}` : why);
      continue;
    }
    subjectFor.push(anchor.subjects[name] ?? hit.candidate);
  }
  return {
    subjectFor,
    unreachable: unreachable2,
    fieldsTried: Object.keys(group.solve.shape.fields),
    fieldsUnderTest: anchor.fields,
    anchor: { fields: anchor.fields, loose: anchor.loose, notes: anchor.notes, evaluations: anchor.evaluations },
    pivots,
    report: report2
  };
}
async function renderOnce(session, group, substitution, subjects) {
  if (subjects === null) substitution.record();
  else substitution.use(subjects);
  await session.navigate(group.route);
  for (const step of group.act ?? []) await session.act(step);
  await session.settle(group.settle);
  const held = await session.currentRoute();
  if (!routeMatches(group.route, held)) {
    throw new CaptureFailure("blocked", `the page left ${group.route} for ${held}, so a picture would be of another screen`);
  }
  substitution.assertApplied();
}
async function prepare(session, page, group, ctx) {
  const diffRoot = group.diffRoot ?? DEFAULT_DIFF_ROOT;
  const snapshotOptions = { root: diffRoot, ignoreAttributes: group.ignoreAttributes ?? [] };
  const notes = [];
  const substitution = await installSubstitution(page, group.intercept);
  try {
    let subjectFor;
    let unreachable2 = /* @__PURE__ */ new Map();
    let fieldsTried = [];
    if (group.solve === void 0) {
      subjectFor = group.members.map((m) => isPlainObject3(m.subject) ? m.subject : null);
    } else {
      await renderOnce(session, group, substitution, null);
      const solved = await solveGroupSubjects(page, ctx.projectRoot, group, substitution.corpus, substitution.bodies);
      subjectFor = solved.subjectFor;
      unreachable2 = solved.unreachable;
      fieldsTried = solved.fieldsTried;
      notes.push(
        `corpus ${substitution.corpus.length} real ${group.solve.shape.type} row(s); ${solved.report.evaluated} candidates in ${solved.report.batches} evaluate(s), ${solved.report.memoMisses} memo miss(es); pivots ${JSON.stringify(solved.pivots.pivots)}`
      );
      for (const why of Object.values(solved.pivots.unresolved)) notes.push(`unresolved pivot: ${why}`);
      notes.push(...solved.anchor.notes);
    }
    const slots = [];
    const subjects = [];
    for (const [i, subject] of subjectFor.entries()) {
      if (subject === null) continue;
      slots.push(i);
      subjects.push(subject);
    }
    if (subjects.length === 0) {
      throw new CaptureFailure("unreachable", `no member of ${group.union} has a subject to render: ${[...unreachable2.values()].join("; ")}`, { fieldsTried });
    }
    if (subjects.length === 1 && group.contrast === void 0) {
      throw new CaptureFailure("blocked", `only one member of ${group.union} has a subject, and the group has no contrast, so there is no second rendering to diff against`);
    }
    const contrast = subjects.length === 1 ? [group.contrast] : rotate(subjects);
    await renderOnce(session, group, substitution, contrast);
    const before2 = await snapshotTree(page, snapshotOptions);
    await renderOnce(session, group, substitution, subjects);
    const tree = await snapshotTree(page, snapshotOptions);
    const { paths } = locateSubjects(tree, before2, subjects.length);
    return { tree, paths, diffRoot, slots, subjectFor, unreachable: unreachable2, fieldsTried, notes };
  } finally {
    await substitution.dispose();
  }
}
function blankResult(group, index) {
  const member = group.members[index];
  return {
    id: member?.id ?? `${group.union}.${index}`,
    union: group.union,
    member: member?.member ?? null,
    ok: false,
    subject: null,
    context: null,
    provenance: "intercepted",
    verified: null,
    answered: null,
    error: null,
    ms: 0
  };
}
async function captureGroup(session, page, group, ctx) {
  const started = ctx.now();
  let prepared;
  try {
    prepared = await prepare(session, page, group, ctx);
  } catch (e) {
    const fields = failureFields(e);
    const ms = ctx.now() - started;
    return { results: group.members.map((_, i) => ({ ...blankResult(group, i), error: errorText(e), ...fields, ms })), notes: [] };
  }
  const { tree, paths, diffRoot, slots, subjectFor, unreachable: unreachable2, fieldsTried, notes } = prepared;
  const nodes = paths.map((p) => nodeAt(tree, p)).filter((n) => n !== null);
  const twins = /* @__PURE__ */ new Map();
  if (nodes.length === paths.length) {
    for (const [a, b] of identicalRenderings(nodes)) {
      const first = group.members[slots[a]];
      const second = group.members[slots[b]];
      if (!first || !second) continue;
      const why = `${first.id} and ${second.id} render an identical subtree`;
      twins.set(slots[a], { why, sameAs: second.id });
      twins.set(slots[b], { why, sameAs: first.id });
    }
  }
  const root = page.locator(diffRoot).first();
  const maxRatio = group.maxSubjectAreaRatio ?? DEFAULT_MAX_SUBJECT_AREA_RATIO;
  const results = [];
  for (const [i, member] of group.members.entries()) {
    const at = ctx.now();
    const result = blankResult(group, i);
    try {
      const missing = unreachable2.get(i);
      if (missing !== void 0) throw new CaptureFailure("unreachable", missing, { fieldsTried });
      const twin = twins.get(i);
      if (twin !== void 0) throw new CaptureFailure("identical", twin.why, { sameAs: twin.sameAs });
      const slot = slots.indexOf(i);
      const path = paths[slot];
      if (slot < 0 || path === void 0) throw new CaptureFailure("blocked", "this member was never rendered, so there is nothing to photograph");
      const answered = await verifyInPage(page, ctx.projectRoot, group.verify, subjectFor[i]);
      const expected = member.expect === void 0 ? member.member ?? "null" : member.expect ?? "null";
      result.answered = answered;
      result.verified = answered === expected;
      if (!result.verified) {
        throw new CaptureFailure(
          "state-mismatch",
          `${group.verify.export} answered "${answered}" for this subject, and the plan asked for "${expected}"`,
          { intended: expected, actual: answered }
        );
      }
      const subject = page.locator(pathSelector(diffRoot, path)).first();
      await assertSubjectIsolated(subject, root, maxRatio);
      await subject.scrollIntoViewIfNeeded();
      const context = statePath(ctx.slug, member.id, "context");
      const subjectFile = statePath(ctx.slug, member.id, "subject");
      await session.screenshot(import_node_path5.posix.join(ctx.reportDir, context));
      await subject.screenshot({ path: import_node_path5.posix.join(ctx.reportDir, subjectFile) });
      await ctx.record({ file: import_node_path5.posix.join(ctx.reportDir, context), kind: "screenshot", row: member.id });
      await ctx.record({ file: import_node_path5.posix.join(ctx.reportDir, subjectFile), kind: "screenshot", row: member.id });
      result.subject = subjectFile;
      result.context = context;
      result.expect = `${group.verify.export} answers ${expected}`;
      result.ok = true;
    } catch (e) {
      result.error = errorText(e);
      Object.assign(result, failureFields(e));
    }
    result.ms = ctx.now() - at;
    results.push(result);
  }
  return { results, notes };
}
var import_node_path5, MAX_TREE_NODES, DEFAULT_MAX_SUBJECT_AREA_RATIO, DEFAULT_DIFF_ROOT, MAX_CORPUS, MAX_BODIES, DEFAULT_EVALUATE_BATCH, CaptureFailure, isPlainObject3, STALE_HEADERS;
var init_capture = __esm({
  "src/states/services/capture.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path5 = require("path");
    init_kernel();
    init_paths();
    init_inventory();
    init_solve();
    MAX_TREE_NODES = 4e4;
    DEFAULT_MAX_SUBJECT_AREA_RATIO = 0.9;
    DEFAULT_DIFF_ROOT = "body";
    MAX_CORPUS = 60;
    MAX_BODIES = 10;
    DEFAULT_EVALUATE_BATCH = 100;
    CaptureFailure = class extends LaunchwrightError {
      reason;
      detail;
      constructor(reason, message, detail = {}, cause) {
        super(`qa.states.${reason}`, message, { ...cause === void 0 ? {} : { cause }, context: { reason, ...detail } });
        this.reason = reason;
        this.detail = detail;
      }
    };
    isPlainObject3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    STALE_HEADERS = /* @__PURE__ */ new Set(["content-length", "content-encoding", "transfer-encoding"]);
  }
});

// src/states/services/scan.mts
function isProductSource(rel) {
  if (!/\.(tsx?|mts)$/.test(rel) || /\.d\.m?ts$/.test(rel)) return false;
  const segments = rel.split("/");
  const base = segments[segments.length - 1] ?? "";
  if (/\.(test|spec)\.(tsx?|mts)$/.test(base)) return false;
  return !segments.some((s) => s === "__tests__" || s === "__mocks__" || s === "node_modules");
}
function parseSource(rel, text2) {
  return import_typescript.default.createSourceFile(rel, text2, import_typescript.default.ScriptTarget.ES2022, true, rel.endsWith(".tsx") ? import_typescript.default.ScriptKind.TSX : import_typescript.default.ScriptKind.TS);
}
function walk(node, visit) {
  visit(node);
  import_typescript.default.forEachChild(node, (child) => walk(child, visit));
}
function isExported(node) {
  return import_typescript.default.canHaveModifiers(node) && (import_typescript.default.getModifiers(node) ?? []).some((m) => m.kind === import_typescript.default.SyntaxKind.ExportKeyword);
}
function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}
function referencedName(typeNode) {
  return typeNode && import_typescript.default.isTypeReferenceNode(typeNode) && import_typescript.default.isIdentifier(typeNode.typeName) ? typeNode.typeName.text : null;
}
function isNullish(typeNode) {
  return import_typescript.default.isLiteralTypeNode(typeNode) && typeNode.literal.kind === import_typescript.default.SyntaxKind.NullKeyword || typeNode.kind === import_typescript.default.SyntaxKind.UndefinedKeyword;
}
function unionParts(typeNode) {
  if (!typeNode || !import_typescript.default.isUnionTypeNode(typeNode)) return null;
  const parts = [];
  for (const member of typeNode.types) {
    if (import_typescript.default.isLiteralTypeNode(member) && import_typescript.default.isStringLiteral(member.literal)) {
      parts.push({ literal: member.literal.text });
      continue;
    }
    const ref = referencedName(member);
    if (!ref) return null;
    parts.push({ ref });
  }
  return parts.length >= 2 ? parts : null;
}
function ignoreReason(node, file, sf) {
  const tags = import_typescript.default.getJSDocTags(node).filter((t) => t.tagName.text === IGNORE_TAG);
  if (tags.length === 0) return { reason: null, problem: null };
  const name = import_typescript.default.isTypeAliasDeclaration(node) ? node.name.text : "<declaration>";
  const line = lineOf(sf, node);
  if (tags.length > 1) {
    return {
      reason: null,
      problem: { code: "ignore-repeated", file, line, union: name, message: `${file}:${line} "${name}" carries ${tags.length} @${IGNORE_TAG} tags. It may carry one.` }
    };
  }
  const [tag] = tags;
  const text2 = (import_typescript.default.getTextOfJSDocComment(tag?.comment) ?? "").replace(/\s+/g, " ").trim();
  const directive = /^ignore(?:\s+(.*))?$/.exec(text2);
  if (!directive) {
    return {
      reason: null,
      problem: {
        code: "ignore-directive",
        file,
        line,
        union: name,
        message: `${file}:${line} "${name}" has @${IGNORE_TAG} "${text2}". The only directive is "ignore <reason>".`
      }
    };
  }
  const reason = (directive[1] ?? "").trim();
  if (!reason) {
    return {
      reason: null,
      problem: {
        code: "ignore-without-reason",
        file,
        line,
        union: name,
        message: `${file}:${line} "${name}" is marked @${IGNORE_TAG} ignore with no reason. A reason is required (spec 2.14 rule C1).`
      }
    };
  }
  return { reason, problem: null };
}
function findUnions(sf, file) {
  const unions = [];
  const problems = [];
  walk(sf, (node) => {
    if (!import_typescript.default.isTypeAliasDeclaration(node) || !isExported(node) || !isStateUnionName(node.name.text)) return;
    const { reason, problem } = ignoreReason(node, file, sf);
    if (problem) problems.push(problem);
    const parts = unionParts(node.type);
    if (parts) unions.push({ name: node.name.text, file, line: lineOf(sf, node), parts, reason });
  });
  return { unions, problems };
}
function flattenUnions(declared) {
  const resolved = /* @__PURE__ */ new Map();
  for (let pass = 0; pass <= declared.size; pass += 1) {
    let progress = false;
    for (const [name, declaration] of declared) {
      if (resolved.has(name)) continue;
      const members = [];
      let complete = true;
      for (const part of declaration.parts) {
        if ("literal" in part) {
          members.push(part.literal);
          continue;
        }
        const inner = resolved.get(part.ref);
        if (!inner) {
          complete = false;
          break;
        }
        members.push(...inner);
      }
      if (!complete) continue;
      resolved.set(name, [...new Set(members)]);
      progress = true;
    }
    if (!progress) break;
  }
  return resolved;
}
function referencedUnions(name, declared, seen = /* @__PURE__ */ new Set()) {
  for (const part of declared.get(name)?.parts ?? []) {
    if (!("ref" in part) || seen.has(part.ref)) continue;
    seen.add(part.ref);
    referencedUnions(part.ref, declared, seen);
  }
  return seen;
}
function holderOf(prop) {
  const parent = prop.parent;
  if (import_typescript.default.isInterfaceDeclaration(parent)) return parent.name.text;
  if (!import_typescript.default.isTypeLiteralNode(parent)) return null;
  let node = parent;
  while (node.parent && (import_typescript.default.isUnionTypeNode(node.parent) || import_typescript.default.isIntersectionTypeNode(node.parent) || import_typescript.default.isParenthesizedTypeNode(node.parent))) {
    node = node.parent;
  }
  return node.parent && import_typescript.default.isTypeAliasDeclaration(node.parent) ? node.parent.name.text : null;
}
function propertyName(prop, sf) {
  return import_typescript.default.isIdentifier(prop.name) ? prop.name.text : prop.name.getText(sf);
}
function findInputSites(sf, file, names) {
  const found = [];
  walk(sf, (node) => {
    if (!import_typescript.default.isPropertySignature(node)) return;
    const union = referencedName(node.type);
    if (!union || !names.has(union)) return;
    const holder = holderOf(node);
    if (!holder) return;
    found.push({ union, interface: holder, field: propertyName(node, sf), optional: Boolean(node.questionToken), file });
  });
  return found;
}
function returnsUnion(typeNode, names) {
  if (typeNode && import_typescript.default.isTypeReferenceNode(typeNode) && referencedName(typeNode) === "Promise" && typeNode.typeArguments?.length === 1) {
    const awaited = returnsUnion(typeNode.typeArguments[0], names);
    return awaited ? { ...awaited, async: true } : null;
  }
  const direct = referencedName(typeNode);
  if (direct && names.has(direct)) return { union: direct, nullable: false, async: false };
  if (!typeNode || !import_typescript.default.isUnionTypeNode(typeNode)) return null;
  let union = null;
  let nullable = false;
  for (const member of typeNode.types) {
    const name = referencedName(member);
    if (name && names.has(name)) {
      if (union) return null;
      union = name;
    } else if (isNullish(member)) nullable = true;
    else return null;
  }
  return union ? { union, nullable, async: false } : null;
}
function functionLike(node) {
  if (import_typescript.default.isFunctionDeclaration(node) && node.name) {
    return { name: node.name.text, fn: node, declaredType: void 0, exported: isExported(node) };
  }
  if (import_typescript.default.isVariableDeclaration(node) && import_typescript.default.isIdentifier(node.name) && node.initializer && (import_typescript.default.isArrowFunction(node.initializer) || import_typescript.default.isFunctionExpression(node.initializer))) {
    const statement = node.parent?.parent;
    return { name: node.name.text, fn: node.initializer, declaredType: node.type, exported: Boolean(statement && isExported(statement)) };
  }
  return null;
}
function reExportedNames(sf) {
  const names = /* @__PURE__ */ new Set();
  walk(sf, (node) => {
    if (!import_typescript.default.isExportDeclaration(node) || !node.exportClause || !import_typescript.default.isNamedExports(node.exportClause) || node.moduleSpecifier) return;
    for (const element of node.exportClause.elements) names.add((element.propertyName ?? element.name).text);
  });
  return names;
}
function paramSite(param, sf, file, resolver, problems) {
  const name = import_typescript.default.isIdentifier(param.name) ? param.name.text : param.name.getText(sf);
  const referenced = referencedName(param.type);
  const type = referenced ?? (param.type ? param.type.getText(sf) : "unknown");
  const declaration = referenced ? resolver.declOf(referenced) : param.type ?? null;
  let shape = shapeFor(type, declaration, (n) => resolver.declOf(n));
  const errors = shape ? validateShape(shape) : [];
  if (errors.length > 0) {
    problems.push({ code: "invalid-shape", file, line: lineOf(sf, param), union: type, message: `The shape derived for "${type}" is invalid: ${errors.join("; ")}` });
    shape = null;
  }
  return { name, type, typeFile: referenced ? resolver.fileOf(referenced) : null, shape };
}
function findOutputSites(sf, file, names, resolver = NO_TYPES, problems = []) {
  const found = [];
  const reExported = reExportedNames(sf);
  walk(sf, (node) => {
    const candidate = functionLike(node);
    if (!candidate) return;
    const hit = returnsUnion(candidate.fn.type, names);
    if (!hit) return;
    const params = candidate.fn.parameters.map((p) => paramSite(p, sf, file, resolver, problems));
    found.push({
      union: hit.union,
      fn: candidate.name,
      file,
      exported: candidate.exported || reExported.has(candidate.name),
      nullable: hit.nullable,
      async: hit.async,
      // A function with no searchable parameter can be evaluated and never steered.
      solvable: params.some((p) => p.shape !== null),
      pivots: pivotsIn(candidate.fn),
      params
    });
  });
  return found;
}
function componentPropsType({ fn, declaredType }) {
  if (declaredType && import_typescript.default.isTypeReferenceNode(declaredType) && declaredType.typeArguments?.length === 1) {
    const argument = referencedName(declaredType.typeArguments[0]);
    if (argument) return argument;
  }
  return fn.parameters.length === 1 ? referencedName(fn.parameters[0]?.type) : null;
}
function findComponentCandidates(sf, file) {
  if (!file.endsWith(".tsx")) return [];
  const found = [];
  walk(sf, (node) => {
    const candidate = functionLike(node);
    if (!candidate || !/^[A-Z]/.test(candidate.name)) return;
    const propsType = componentPropsType(candidate);
    if (propsType) found.push({ component: candidate.name, componentFile: file, propsType });
  });
  return found;
}
function findTypeComposition(sf) {
  const found = [];
  const namesIn = (typeNode) => {
    if (!typeNode) return [];
    if (import_typescript.default.isParenthesizedTypeNode(typeNode)) return namesIn(typeNode.type);
    if (import_typescript.default.isUnionTypeNode(typeNode) || import_typescript.default.isIntersectionTypeNode(typeNode)) return typeNode.types.flatMap(namesIn);
    const name = referencedName(typeNode);
    return name ? [name] : [];
  };
  walk(sf, (node) => {
    if (import_typescript.default.isTypeAliasDeclaration(node)) {
      const of2 = namesIn(node.type);
      if (of2.length) found.push({ name: node.name.text, of: of2 });
      return;
    }
    if (!import_typescript.default.isInterfaceDeclaration(node)) return;
    const of = (node.heritageClauses ?? []).flatMap(
      (clause) => clause.types.flatMap((t) => import_typescript.default.isIdentifier(t.expression) ? [t.expression.text] : [])
    );
    if (of.length) found.push({ name: node.name.text, of });
  });
  return found;
}
function findTypeDeclarations(sf, file) {
  const found = [];
  walk(sf, (node) => {
    if ((import_typescript.default.isInterfaceDeclaration(node) || import_typescript.default.isTypeAliasDeclaration(node) || import_typescript.default.isEnumDeclaration(node) || import_typescript.default.isClassDeclaration(node)) && node.name) {
      found.push({ name: node.name.text, file, node });
    }
  });
  return found;
}
function literalValue(node) {
  if (import_typescript.default.isStringLiteral(node)) return node.text;
  if (import_typescript.default.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === import_typescript.default.SyntaxKind.TrueKeyword) return true;
  if (node.kind === import_typescript.default.SyntaxKind.FalseKeyword) return false;
  if (import_typescript.default.isPrefixUnaryExpression(node) && NEGATIVE2.has(node.operator) && import_typescript.default.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  return void 0;
}
function fieldFor(typeNode, resolve9, hops = 0) {
  if (!typeNode) return { kind: "opaque" };
  const keyword = KEYWORD_KINDS.get(typeNode.kind);
  if (keyword) return { kind: keyword };
  if (import_typescript.default.isUnionTypeNode(typeNode)) {
    const present = typeNode.types.filter((t) => !isNullish(t));
    const nullable = present.length !== typeNode.types.length;
    const inner = unionField(present, resolve9, hops);
    if (!inner) return { kind: "opaque" };
    return nullable ? { kind: "nullable", of: inner } : inner;
  }
  if (import_typescript.default.isTypeReferenceNode(typeNode) && hops < MAX_TYPE_HOPS) {
    const name = referencedName(typeNode);
    const aliased = name ? resolve9(name) : null;
    if (aliased) return fieldFor(aliased, resolve9, hops + 1);
  }
  return { kind: "opaque" };
}
function unionField(present, resolve9, hops) {
  if (present.length === 0) return null;
  if (present.length === 1) {
    const only = fieldFor(present[0], resolve9, hops);
    return only.kind === "nullable" ? { kind: "opaque" } : only;
  }
  const values = present.map((t) => import_typescript.default.isLiteralTypeNode(t) ? literalValue(t.literal) : void 0);
  if (values.every((v) => v !== void 0)) return { kind: "enum", values };
  return { kind: "opaque" };
}
function membersOf(node, resolveDecl, seen = /* @__PURE__ */ new Set()) {
  if (!node) return [];
  if (import_typescript.default.isInterfaceDeclaration(node)) {
    if (seen.has(node)) return [];
    seen.add(node);
    const inherited = (node.heritageClauses ?? []).flatMap(
      (clause) => clause.types.flatMap((t) => import_typescript.default.isIdentifier(t.expression) ? membersOf(resolveDecl(t.expression.text), resolveDecl, seen) : [])
    );
    return [...inherited, ...node.members];
  }
  if (import_typescript.default.isTypeAliasDeclaration(node)) {
    if (seen.has(node)) return [];
    seen.add(node);
    return membersOf(node.type, resolveDecl, seen);
  }
  if (import_typescript.default.isTypeLiteralNode(node)) return [...node.members];
  if (import_typescript.default.isParenthesizedTypeNode(node)) return membersOf(node.type, resolveDecl, seen);
  if (import_typescript.default.isIntersectionTypeNode(node)) return node.types.flatMap((t) => membersOf(t, resolveDecl, seen));
  if (import_typescript.default.isTypeReferenceNode(node)) {
    const name = referencedName(node);
    return name ? membersOf(resolveDecl(name), resolveDecl, seen) : [];
  }
  return [];
}
function shapeFor(typeName, declaration, resolveDecl) {
  const members = membersOf(declaration, resolveDecl);
  const resolveType = (name) => {
    const found = resolveDecl(name);
    return found && import_typescript.default.isTypeAliasDeclaration(found) ? found.type : null;
  };
  const fields = {};
  for (const member of members) {
    if (!import_typescript.default.isPropertySignature(member) || !import_typescript.default.isIdentifier(member.name)) continue;
    const field = fieldFor(member.type, resolveType);
    fields[member.name.text] = member.questionToken ? { ...field, optional: true } : field;
  }
  const names = Object.keys(fields);
  if (names.length === 0 || names.every((n) => fields[n]?.kind === "opaque")) return null;
  return { type: typeName, fields };
}
function pivotsIn(fn) {
  const literals = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Set();
  walk(fn, (node) => {
    if (!import_typescript.default.isBinaryExpression(node)) return;
    const relational = RELATIONAL.has(node.operatorToken.kind);
    if (!relational && !EQUALITY.has(node.operatorToken.kind)) return;
    for (const side of [node.left, node.right]) {
      const value = literalValue(side);
      if (typeof value === "number") literals.add(value);
      else if (relational && import_typescript.default.isIdentifier(side)) names.add(side.text);
    }
  });
  return { literals: [...literals].sort((a, b) => a - b), names: [...names].sort() };
}
function partsOf(name, composedOf) {
  const seen = /* @__PURE__ */ new Set();
  const queue = [...composedOf.get(name) ?? []];
  while (queue.length) {
    const next = queue.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...composedOf.get(next) ?? []);
  }
  return seen;
}
function analyzeSources(input) {
  const { sources, extraTypes = [], roots, generated } = input;
  const parsed = sources.map(({ file, text: text2 }) => ({ file, sf: parseSource(file, text2) }));
  const problems = [];
  const declaredIn = /* @__PURE__ */ new Map();
  for (const { file, sf } of [...parsed, ...extraTypes.map(({ file: file2, text: text2 }) => ({ file: file2, sf: parseSource(file2, text2) }))]) {
    for (const decl of findTypeDeclarations(sf, file)) {
      const seen = declaredIn.get(decl.name);
      if (seen === void 0) declaredIn.set(decl.name, decl);
      else if (seen === null || seen.file !== file) declaredIn.set(decl.name, null);
    }
  }
  const resolver = {
    fileOf: (name) => declaredIn.get(name)?.file ?? null,
    declOf: (name) => declaredIn.get(name)?.node ?? null
  };
  const unions = /* @__PURE__ */ new Map();
  for (const { file, sf } of parsed) {
    const found = findUnions(sf, file);
    problems.push(...found.problems);
    for (const union of found.unions) {
      const clash = unions.get(union.name);
      if (clash) {
        problems.push({
          code: "duplicate-union",
          file,
          line: union.line,
          union: union.name,
          message: `Two state unions are named "${union.name}": ${clash.file}:${clash.line} and ${file}:${union.line}. Rename one.`
        });
        continue;
      }
      unions.set(union.name, union);
    }
  }
  const members = flattenUnions(unions);
  const names = new Set(members.keys());
  const composedOf = /* @__PURE__ */ new Map();
  const candidates = [];
  const inputs = [];
  const outputs = [];
  for (const { file, sf } of parsed) {
    for (const { name, of } of findTypeComposition(sf)) composedOf.set(name, [...composedOf.get(name) ?? [], ...of]);
    candidates.push(...findComponentCandidates(sf, file));
    inputs.push(...findInputSites(sf, file, names));
    outputs.push(...findOutputSites(sf, file, names, resolver, problems));
  }
  candidates.sort((a, b) => a.componentFile.localeCompare(b.componentFile) || a.component.localeCompare(b.component));
  const componentFor = (holder) => candidates.find((c) => c.propsType === holder || partsOf(c.propsType, composedOf).has(holder)) ?? null;
  const sitesFor = (name) => ({
    inputs: inputs.filter((i) => i.union === name).sort((a, b) => a.file.localeCompare(b.file) || a.field.localeCompare(b.field)).map(({ union: _u, ...site }) => {
      const component = componentFor(site.interface);
      return { ...site, component: component?.component ?? null, componentFile: component?.componentFile ?? null };
    }),
    outputs: outputs.filter((o) => o.union === name).sort((a, b) => a.file.localeCompare(b.file) || a.fn.localeCompare(b.fn)).map(({ union: _u, ...site }) => site)
  });
  const absorbed = /* @__PURE__ */ new Set();
  for (const name of names) {
    for (const ref of referencedUnions(name, unions)) {
      if (ref === name || !names.has(ref)) continue;
      const site = sitesFor(ref);
      if (site.inputs.length === 0 && site.outputs.length === 0) absorbed.add(ref);
    }
  }
  const declaration = (name) => unions.get(name);
  const membersOfUnion = (name) => members.get(name) ?? [];
  const ignored = [...names].filter((name) => declaration(name).reason !== null).sort((a, b) => a.localeCompare(b)).map((name) => ({
    name,
    file: declaration(name).file,
    line: declaration(name).line,
    members: membersOfUnion(name),
    reason: declaration(name).reason
  }));
  const isIgnored = new Set(ignored.map((u) => u.name));
  const entries = [...names].filter((name) => !absorbed.has(name) && !isIgnored.has(name)).sort((a, b) => a.localeCompare(b)).map((name) => {
    const mine = sitesFor(name);
    const flattens = [...referencedUnions(name, unions)].filter((ref) => absorbed.has(ref)).sort().map((ref) => ({ name: ref, file: declaration(ref).file, line: declaration(ref).line, members: membersOfUnion(ref) }));
    return {
      name,
      file: declaration(name).file,
      line: declaration(name).line,
      members: membersOfUnion(name),
      kind: kindFor(mine.inputs, mine.outputs),
      flattens,
      inputs: mine.inputs,
      outputs: mine.outputs,
      components: [...new Set(mine.inputs.flatMap((i) => i.component ? [i.component] : []))]
    };
  });
  const inventory = { generated, roots, unions: entries, ignored };
  const errors = validateInventory(inventory);
  if (errors.length > 0) {
    throw new LaunchwrightError("qa.states.inventory", `The scan produced an invalid inventory:
  ${errors.join("\n  ")}`, { context: { errors } });
  }
  return { inventory, problems };
}
function readTree(projectRoot2, dir) {
  const absolute = (0, import_node_path6.join)(projectRoot2, dir);
  if (!(0, import_node_fs5.statSync)(absolute, { throwIfNoEntry: false })?.isDirectory()) {
    throw new LaunchwrightError("qa.states.root", `${dir} is not a folder under ${projectRoot2}. Check qa.clientRoots and qa.typeRoots.`, { context: { dir } });
  }
  const files = [];
  const visit = (at) => {
    for (const entry of (0, import_node_fs5.readdirSync)(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = (0, import_node_path6.join)(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") visit(child);
        continue;
      }
      const rel = (0, import_node_path6.relative)(projectRoot2, child).split(/[\\/]/).join("/");
      if (isProductSource(rel)) files.push({ file: rel, text: (0, import_node_fs5.readFileSync)(child, "utf8") });
    }
  };
  visit(absolute);
  return files;
}
function scanProject(projectRoot2, options) {
  const sources = options.clientRoots.flatMap((dir) => readTree(projectRoot2, dir));
  const extraTypes = (options.typeRoots ?? []).flatMap((dir) => readTree(projectRoot2, dir));
  return { ...analyzeSources({ sources, extraTypes, roots: options.clientRoots, generated: options.generated }), sources };
}
var import_node_fs5, import_node_path6, import_typescript, NO_TYPES, KEYWORD_KINDS, MAX_TYPE_HOPS, NEGATIVE2, RELATIONAL, EQUALITY;
var init_scan = __esm({
  "src/states/services/scan.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs5 = require("fs");
    import_node_path6 = require("path");
    init_kernel();
    import_typescript = __toESM(require("typescript"), 1);
    init_inventory();
    init_solve();
    NO_TYPES = { fileOf: () => null, declOf: () => null };
    KEYWORD_KINDS = /* @__PURE__ */ new Map([
      [import_typescript.default.SyntaxKind.BooleanKeyword, "boolean"],
      [import_typescript.default.SyntaxKind.NumberKeyword, "number"],
      [import_typescript.default.SyntaxKind.StringKeyword, "string"]
    ]);
    MAX_TYPE_HOPS = 6;
    NEGATIVE2 = /* @__PURE__ */ new Set([import_typescript.default.SyntaxKind.MinusToken]);
    RELATIONAL = /* @__PURE__ */ new Set([
      import_typescript.default.SyntaxKind.LessThanToken,
      import_typescript.default.SyntaxKind.LessThanEqualsToken,
      import_typescript.default.SyntaxKind.GreaterThanToken,
      import_typescript.default.SyntaxKind.GreaterThanEqualsToken
    ]);
    EQUALITY = /* @__PURE__ */ new Set([
      import_typescript.default.SyntaxKind.EqualsEqualsEqualsToken,
      import_typescript.default.SyntaxKind.ExclamationEqualsEqualsToken,
      import_typescript.default.SyntaxKind.EqualsEqualsToken,
      import_typescript.default.SyntaxKind.ExclamationEqualsToken
    ]);
  }
});

// src/states/services/delivery.mts
function normaliseTables(entries) {
  return entries.map((entry) => typeof entry === "string" ? { file: entry, surface: "web" } : entry);
}
function importSpecifiers(sf) {
  const found = [];
  const visit = (node) => {
    if ((import_typescript2.default.isImportDeclaration(node) || import_typescript2.default.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (import_typescript2.default.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    } else if (import_typescript2.default.isCallExpression(node) && node.expression.kind === import_typescript2.default.SyntaxKind.ImportKeyword) {
      const [first] = node.arguments;
      if (first && import_typescript2.default.isStringLiteral(first)) found.push(first.text);
    }
    import_typescript2.default.forEachChild(node, visit);
  };
  visit(sf);
  return [...new Set(found)];
}
function resolveSpecifier(fromFile, specifier, files, aliases = {}) {
  let base = null;
  if (specifier.startsWith(".")) base = import_node_path7.posix.normalize(import_node_path7.posix.join(import_node_path7.posix.dirname(fromFile), specifier));
  else {
    for (const alias of Object.keys(aliases).sort((a, b) => b.length - a.length)) {
      const dir = aliases[alias];
      if (specifier === alias) base = dir;
      else if (specifier.startsWith(`${alias}/`)) base = import_node_path7.posix.normalize(`${dir}${specifier.slice(alias.length)}`);
      if (base !== null) break;
    }
  }
  if (base === null) return null;
  const stems = /\.[mc]?js$/.test(base) ? [base.replace(/\.([mc]?)js$/, ".$1ts"), base.replace(/\.[mc]?js$/, ""), base] : [base];
  for (const stem of stems) {
    for (const suffix of CANDIDATES) {
      const candidate = `${stem}${suffix}`;
      if (files.has(candidate)) return candidate;
    }
  }
  return null;
}
function buildGraph(sources, aliases = {}) {
  const parsed = new Map(sources.map(({ file, text: text2 }) => [file, parseSource(file, text2)]));
  const files = new Set(parsed.keys());
  const edges = /* @__PURE__ */ new Map();
  for (const [file, sf] of parsed) {
    const out = [];
    for (const specifier of importSpecifiers(sf)) {
      const target = resolveSpecifier(file, specifier, files, aliases);
      if (target !== null && target !== file) out.push(target);
    }
    edges.set(file, [...new Set(out)]);
  }
  return { edges, parsed };
}
function reachFrom(edges, root) {
  const distance = /* @__PURE__ */ new Map([[root, 0]]);
  const queue = [root];
  while (queue.length > 0) {
    const at = queue.shift();
    const next = (distance.get(at) ?? 0) + 1;
    for (const to of edges.get(at) ?? []) {
      if (distance.has(to)) continue;
      distance.set(to, next);
      queue.push(to);
    }
  }
  return distance;
}
function objectVocabulary(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (import_typescript2.default.isVariableDeclaration(node) && import_typescript2.default.isIdentifier(node.name)) {
      let initializer = node.initializer;
      while (initializer && (import_typescript2.default.isAsExpression(initializer) || import_typescript2.default.isParenthesizedExpression(initializer) || import_typescript2.default.isSatisfiesExpression(initializer))) {
        initializer = initializer.expression;
      }
      if (initializer && import_typescript2.default.isObjectLiteralExpression(initializer)) {
        const paths = /* @__PURE__ */ new Map();
        for (const member of initializer.properties) {
          if (import_typescript2.default.isPropertyAssignment(member) && import_typescript2.default.isIdentifier(member.name) && import_typescript2.default.isStringLiteral(member.initializer)) {
            paths.set(member.name.text, member.initializer.text);
          }
        }
        if (paths.size > 0) found.set(node.name.text, paths);
      }
    }
    import_typescript2.default.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function localConstants(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (import_typescript2.default.isVariableDeclaration(node) && import_typescript2.default.isIdentifier(node.name) && node.initializer && !found.has(node.name.text)) {
      found.set(node.name.text, node.initializer);
    }
    import_typescript2.default.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function evaluatePath(node, vocabulary, constants, depth = 0) {
  if (!node || depth > MAX_HOPS) return null;
  if (import_typescript2.default.isStringLiteral(node) || import_typescript2.default.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (import_typescript2.default.isParenthesizedExpression(node) || import_typescript2.default.isAsExpression(node)) return evaluatePath(node.expression, vocabulary, constants, depth + 1);
  if (import_typescript2.default.isPropertyAccessExpression(node) && import_typescript2.default.isIdentifier(node.expression)) {
    return vocabulary.get(node.expression.text)?.get(node.name.text) ?? null;
  }
  if (import_typescript2.default.isIdentifier(node)) {
    const declared = constants.get(node.text);
    return declared ? evaluatePath(declared, vocabulary, constants, depth + 1) : null;
  }
  if (import_typescript2.default.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const part = evaluatePath(span.expression, vocabulary, constants, depth + 1);
      if (part === null) return null;
      out += part + span.literal.text;
    }
    return out;
  }
  if (import_typescript2.default.isCallExpression(node) && node.arguments.length === 1) {
    const inner = evaluatePath(node.arguments[0], vocabulary, constants, depth + 1);
    return inner !== null && inner.startsWith("/") ? inner : null;
  }
  return null;
}
function isDynamicPath(path) {
  return path.split("/").some((segment) => segment.startsWith(":"));
}
function groupPrefix(node, vocabulary, constants) {
  const prefixes = [];
  let at = node.parent;
  while (at) {
    if (import_typescript2.default.isCallExpression(at) && import_typescript2.default.isPropertyAccessExpression(at.expression) && at.expression.name.text === "group") {
      const [options] = at.arguments;
      if (options && import_typescript2.default.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (import_typescript2.default.isPropertyAssignment(property) && import_typescript2.default.isIdentifier(property.name) && property.name.text === "prefix") {
            const value = evaluatePath(property.initializer, vocabulary, constants);
            if (value) prefixes.unshift(value.replace(/\/+$/, ""));
          }
        }
      }
    }
    at = at.parent;
  }
  return prefixes.join("");
}
function joinPath(prefix, path) {
  if (prefix === "") return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}
function routeRows(sf, vocabulary = objectVocabulary(sf)) {
  const constants = localConstants(sf);
  const rows = [];
  const push = (pathNode, component, pageName, prefix) => {
    const raw = evaluatePath(pathNode, vocabulary, constants);
    if (raw === "*") return;
    const path = raw === null ? null : joinPath(prefix, raw);
    rows.push({ path, component, pageName, source: pathNode ? pathNode.getText(sf) : "<no path>", dynamic: path === null ? false : isDynamicPath(path) });
  };
  const visit = (node) => {
    if (import_typescript2.default.isCallExpression(node) && import_typescript2.default.isPropertyAccessExpression(node.expression) && node.expression.name.text === "page" && node.arguments.length >= 2) {
      const [pathNode, nameNode] = node.arguments;
      const pageName = nameNode && (import_typescript2.default.isStringLiteral(nameNode) || import_typescript2.default.isNoSubstitutionTemplateLiteral(nameNode)) ? nameNode.text : null;
      push(pathNode ?? null, null, pageName, groupPrefix(node, vocabulary, constants));
    }
    const opening = import_typescript2.default.isJsxSelfClosingElement(node) ? node : import_typescript2.default.isJsxElement(node) ? node.openingElement : null;
    if (opening && import_typescript2.default.isIdentifier(opening.tagName) && opening.tagName.text === "Route") {
      const attributes = /* @__PURE__ */ new Map();
      for (const attribute of opening.attributes.properties) {
        if (!import_typescript2.default.isJsxAttribute(attribute) || !import_typescript2.default.isIdentifier(attribute.name) || !attribute.initializer) continue;
        const value = attribute.initializer;
        attributes.set(attribute.name.text, import_typescript2.default.isJsxExpression(value) ? value.expression ?? null : import_typescript2.default.isStringLiteral(value) ? value : null);
      }
      const componentNode = attributes.get("component") ?? null;
      const component = componentNode && import_typescript2.default.isIdentifier(componentNode) ? componentNode.text : null;
      const pathNode = attributes.get("path") ?? null;
      const declared = pathNode && import_typescript2.default.isIdentifier(pathNode) ? constants.get(pathNode.text) : void 0;
      const list3 = declared && import_typescript2.default.isArrayLiteralExpression(declared) ? declared : pathNode;
      const nodes = list3 && import_typescript2.default.isArrayLiteralExpression(list3) ? [...list3.elements] : [pathNode];
      for (const one of nodes) push(one, component, null, "");
    }
    import_typescript2.default.forEachChild(node, visit);
  };
  visit(sf);
  return rows;
}
function importedNames(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (import_typescript2.default.isImportDeclaration(node) && node.importClause && import_typescript2.default.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (clause.name) found.set(clause.name.text, specifier);
      const bindings = clause.namedBindings;
      if (bindings && import_typescript2.default.isNamespaceImport(bindings)) found.set(bindings.name.text, specifier);
      if (bindings && import_typescript2.default.isNamedImports(bindings)) for (const element of bindings.elements) found.set(element.name.text, specifier);
    }
    import_typescript2.default.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function jsxTagsIn(node) {
  const found = /* @__PURE__ */ new Set();
  const visit = (child) => {
    const opening = import_typescript2.default.isJsxSelfClosingElement(child) ? child : import_typescript2.default.isJsxElement(child) ? child.openingElement : null;
    if (opening && import_typescript2.default.isIdentifier(opening.tagName)) found.add(opening.tagName.text);
    import_typescript2.default.forEachChild(child, visit);
  };
  visit(node);
  return found;
}
function componentPages(component, sf, resolve9, seen = /* @__PURE__ */ new Set(), depth = 0) {
  if (component === null || seen.has(component) || depth > MAX_HOPS) return [];
  seen.add(component);
  const imports = importedNames(sf);
  const specifier = imports.get(component);
  if (specifier !== void 0) {
    const file = resolve9(specifier);
    return file === null ? [] : [file];
  }
  const declaration = localConstants(sf).get(component);
  if (!declaration) return [];
  const pages = [];
  for (const tag of jsxTagsIn(declaration)) {
    if (tag === component) continue;
    pages.push(...componentPages(tag, sf, resolve9, seen, depth + 1));
  }
  return [...new Set(pages)];
}
function pageFileFor(pageName, pageRoots, files) {
  for (const root of pageRoots) {
    for (const suffix of PAGE_SUFFIXES) {
      const candidate = import_node_path7.posix.join(root, "pages", `${pageName}${suffix}`);
      if (files.has(candidate)) return candidate;
    }
  }
  return null;
}
function anchorFor(union) {
  const site = solveSite(union) ?? union.outputs[0] ?? null;
  return site?.file ?? union.file;
}
function noRouteReason(anchor, tables) {
  if (tables.every((t) => !t.found)) {
    return `no route table could be read (${tables.map((t) => t.file).join(", ") || "none configured"}), so no route was derived. Check qa.routeTables`;
  }
  if (tables.every((t) => t.rows === 0)) return "the route tables hold no page row, so no route was derived for anything";
  return `no page in the route tables reaches ${anchor} through the import graph. Either nothing mounts this code, or a component draws it that the tables reach in another way`;
}
function buildRouteMap(input) {
  const aliases = input.aliases ?? {};
  const { edges, parsed } = buildGraph(input.sources, aliases);
  const files = new Set(parsed.keys());
  const tables = input.tables.map((table) => {
    const sf = parsed.get(table.file);
    if (!sf) return { table, found: false, routes: [] };
    const resolve9 = (specifier) => resolveSpecifier(table.file, specifier, files, aliases);
    const routes = routeRows(sf).map((row) => ({
      path: row.path,
      dynamic: row.dynamic,
      source: row.source,
      pages: row.pageName !== null ? [pageFileFor(row.pageName, input.pageRoots, files)].filter((f) => f !== null) : componentPages(row.component, sf, resolve9)
    }));
    return { table, found: true, routes };
  });
  const summaries = tables.map(({ table, found, routes }) => ({
    file: table.file,
    surface: table.surface,
    found,
    rows: routes.length,
    resolved: routes.filter((r) => r.path !== null).length,
    unresolved: routes.filter((r) => r.path === null).map((r) => r.source),
    pageless: routes.filter((r) => r.path !== null && r.pages.length === 0).map((r) => r.path)
  }));
  const reach = /* @__PURE__ */ new Map();
  for (const { routes } of tables) for (const route of routes) for (const page of route.pages) if (!reach.has(page)) reach.set(page, reachFrom(edges, page));
  const unions = input.inventory.unions.map((union) => {
    const anchor = anchorFor(union);
    const found = [];
    for (const { table, routes } of tables) {
      for (const route of routes) {
        if (route.path === null) continue;
        let best = null;
        let page = null;
        for (const candidate of route.pages) {
          const distance = reach.get(candidate)?.get(anchor);
          if (distance === void 0) continue;
          if (best === null || distance < best) {
            best = distance;
            page = candidate;
          }
        }
        if (best === null || page === null) continue;
        found.push({ surface: table.surface, route: route.path, page, distance: best, dynamic: route.dynamic, reaches: reach.get(page)?.size ?? 0 });
      }
    }
    found.sort((a, b) => a.distance - b.distance || a.reaches - b.reaches || a.surface.localeCompare(b.surface) || a.route.localeCompare(b.route));
    return {
      union: union.name,
      kind: union.kind,
      mechanism: mechanismFor(union.kind),
      anchor,
      members: union.members,
      routes: found,
      ...found.length === 0 ? { why: noRouteReason(anchor, summaries) } : {}
    };
  });
  return { generated: input.generated, tables: summaries, unions };
}
function attachRoutes(inventory, map) {
  const byName = new Map(map.unions.map((u) => [u.union, u]));
  return {
    ...inventory,
    unions: inventory.unions.map((union) => {
      const mine = byName.get(union.name);
      if (!mine) return union;
      const next = { ...union, routes: mine.routes };
      if (mine.why === void 0) delete next.why;
      else next.why = mine.why;
      return next;
    })
  };
}
function aliasesFromTsconfig(text2, dir) {
  const parsed = import_typescript2.default.parseConfigFileTextToJson("tsconfig.json", text2);
  const options = parsed.config?.compilerOptions;
  const base = import_node_path7.posix.join(dir, options?.baseUrl ?? ".");
  const out = {};
  for (const [key, targets] of Object.entries(options?.paths ?? {})) {
    const [target] = targets;
    if (target === void 0) continue;
    const alias = key.replace(/\/\*$/, "");
    out[alias] = import_node_path7.posix.normalize(import_node_path7.posix.join(base, target.replace(/\/\*$/, "")));
  }
  return out;
}
function renderRouteSummary(map) {
  const out = [];
  for (const table of map.tables) {
    if (!table.found) {
      out.push(`${table.file}  ${table.surface}  not found`);
      continue;
    }
    const extra = [
      table.unresolved.length > 0 ? `unresolved: ${table.unresolved.join(", ")}` : "",
      table.pageless.length > 0 ? `no page module: ${table.pageless.join(", ")}` : ""
    ].filter(Boolean);
    out.push(`${table.file}  ${table.surface}  ${table.resolved} of ${table.rows} route(s) resolved${extra.length > 0 ? `; ${extra.join("; ")}` : ""}`);
  }
  out.push("");
  for (const union of map.unions) {
    out.push(`${union.union}  (${union.kind}, ${union.mechanism ?? "no mechanism"})  ${union.anchor}`);
    if (union.routes.length === 0) out.push(`    no route: ${union.why ?? "none"}`);
    for (const route of union.routes.slice(0, 8)) {
      out.push(`    ${route.surface.padEnd(8)} ${route.route.padEnd(28)} ${route.dynamic ? "dynamic " : "        "}d=${route.distance}  ${route.page ?? ""}`);
    }
    if (union.routes.length > 8) out.push(`    and ${union.routes.length - 8} more`);
  }
  return out.join("\n");
}
var import_node_path7, import_typescript2, MAX_HOPS, CANDIDATES, PAGE_SUFFIXES;
var init_delivery = __esm({
  "src/states/services/delivery.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path7 = require("path");
    import_typescript2 = __toESM(require("typescript"), 1);
    init_inventory();
    init_scan();
    MAX_HOPS = 4;
    CANDIDATES = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx", "/index.mts"];
    PAGE_SUFFIXES = [".page.tsx", ".page.ts", ".page.mts", ".page.jsx"];
  }
});

// src/states/services/project.mts
function readAliases(projectRoot2, clientRoots) {
  const aliases = {};
  for (const root of clientRoots) {
    for (const dir of [root, import_node_path8.posix.dirname(root)]) {
      for (const name of TSCONFIG_NAMES) {
        const path = (0, import_node_path8.join)(projectRoot2, dir, name);
        if (!(0, import_node_fs6.existsSync)(path)) continue;
        for (const [alias, target] of Object.entries(aliasesFromTsconfig((0, import_node_fs6.readFileSync)(path, "utf8"), dir))) aliases[alias] ??= target;
      }
    }
  }
  return aliases;
}
function scanStates(projectRoot2, config, generated) {
  const scanned = scanProject(projectRoot2, { clientRoots: config.clientRoots, typeRoots: config.typeRoots, generated });
  const tables = normaliseTables(config.routeTables);
  const known = new Set(scanned.sources.map((s) => s.file));
  const tableSources = tables.filter((t) => !known.has(t.file) && (0, import_node_fs6.existsSync)((0, import_node_path8.join)(projectRoot2, t.file))).map((t) => ({ file: t.file, text: (0, import_node_fs6.readFileSync)((0, import_node_path8.join)(projectRoot2, t.file), "utf8") }));
  const map = buildRouteMap({
    inventory: scanned.inventory,
    sources: [...scanned.sources, ...tableSources],
    tables,
    pageRoots: config.clientRoots,
    aliases: readAliases(projectRoot2, config.clientRoots),
    generated
  });
  return { inventory: attachRoutes(scanned.inventory, map), problems: scanned.problems, map };
}
var import_node_fs6, import_node_path8, STATES_FILE, TSCONFIG_NAMES;
var init_project2 = __esm({
  "src/states/services/project.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs6 = require("fs");
    import_node_path8 = require("path");
    init_delivery();
    init_scan();
    STATES_FILE = ".lw/qa/states.json";
    TSCONFIG_NAMES = ["tsconfig.json", "tsconfig.app.json"];
  }
});

// src/states/services/check.mts
function c1Findings(inventory, problems) {
  const findings = [];
  for (const union of inventory.unions) {
    if (union.kind !== "neither") continue;
    findings.push({
      rule: "C1",
      union: union.name,
      file: union.file,
      line: union.line,
      message: `${union.file}:${union.line} ${union.name} is neither an input nor an output, so no trigger reaches its ${union.members.length} state(s). Give a component a prop of this type, return it from an exported function, or mark it @qa-states ignore <reason>.`
    });
  }
  for (const problem of problems) {
    if (problem.code === "invalid-shape") continue;
    findings.push({ rule: "C1", union: problem.union, file: problem.file, line: problem.line, message: problem.message });
  }
  return findings;
}
function c4Findings(inventory) {
  const findings = [];
  for (const union of inventory.unions) {
    if (union.kind === "neither") continue;
    if ((union.routes ?? []).length > 0) continue;
    if (union.inputs.some((site) => site.component !== null)) continue;
    findings.push({
      rule: "C4",
      union: union.name,
      file: union.file,
      line: union.line,
      message: `${union.file}:${union.line} ${union.name} has no route and no mount: ${union.why ?? "no route table row reaches it"}. Add its page to the route table, or give a component a prop of this type so /__states can mount it.`
    });
  }
  return findings;
}
var init_check = __esm({
  "src/states/services/check.mts"() {
    "use strict";
    init_cjs_shims();
    init_project2();
  }
});

// src/services/legs.mts
function legDefinitions(config) {
  const merged = new Map(Object.entries(DEFAULT_LEGS));
  for (const [name, def] of Object.entries(config.legs ?? {})) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      throw new LaunchwrightError("qa.legs.name", `qa.legs.${name}: a leg name is kebab case, for example "tablet-web"`, {
        context: { leg: name }
      });
    }
    if (def === false) merged.delete(name);
    else merged.set(name, def);
  }
  return [...merged].map(([name, def]) => ({ name, ...def }));
}
var CHROME_MAJOR, DESKTOP_USER_AGENT, DEFAULT_LEGS;
var init_legs = __esm({
  "src/services/legs.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    CHROME_MAJOR = 145;
    DESKTOP_USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`;
    DEFAULT_LEGS = Object.freeze({
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
  }
});

// src/services/manifest.mts
var import_promises4;
var init_manifest2 = __esm({
  "src/services/manifest.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises4 = require("fs/promises");
    init_kernel();
    init_legs();
    init_types();
  }
});

// src/services/png.mts
function pngSize(bytes2) {
  if (bytes2.length < 24) return null;
  for (let i = 0; i < MAGIC.length; i += 1) if (bytes2[i] !== MAGIC[i]) return null;
  if (String.fromCharCode(bytes2[12], bytes2[13], bytes2[14], bytes2[15]) !== "IHDR") return null;
  const view = new DataView(bytes2.buffer, bytes2.byteOffset, bytes2.byteLength);
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
function crc32(bytes2) {
  let c = 4294967295;
  for (const b of bytes2) c = CRC_TABLE[(c ^ b) & 255] ^ c >>> 8;
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
var import_node_zlib, MAGIC, CRC_TABLE;
var init_png = __esm({
  "src/services/png.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_zlib = require("zlib");
    init_kernel();
    MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];
    CRC_TABLE = (() => {
      const table = new Uint32Array(256);
      for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        table[n] = c >>> 0;
      }
      return table;
    })();
  }
});

// src/services/video.mts
var import_node_child_process, MIN_VIDEO_S;
var init_video = __esm({
  "src/services/video.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process = require("child_process");
    init_kernel();
    MIN_VIDEO_S = 1;
  }
});

// src/services/evidence.mts
var init_evidence = __esm({
  "src/services/evidence.mts"() {
    "use strict";
    init_cjs_shims();
    init_ledger();
    init_manifest2();
    init_png();
    init_video();
  }
});

// src/states-host/names.mts
var QA_STATES_PATH, QA_STATES_ATTRIBUTE;
var init_names = __esm({
  "src/states-host/names.mts"() {
    "use strict";
    init_cjs_shims();
    QA_STATES_PATH = "/__states";
    QA_STATES_ATTRIBUTE = "data-qa-states";
  }
});

// src/states/services/mount.mts
function mountUrl(options) {
  const query = new URLSearchParams({ c: options.component, props: JSON.stringify(options.props ?? {}) });
  if (options.width !== null && options.width !== void 0) query.set("w", String(options.width));
  return `${STATES_HARNESS_PATH}?${query.toString()}`;
}
function siteFor(union, hints) {
  if (typeof hints.component === "string") return union.inputs.find((s) => s.component === hints.component) ?? union.inputs[0] ?? null;
  return union.inputs.find((s) => s.component !== null) ?? union.inputs[0] ?? null;
}
function resolveMount(inventory, capture, defaultLeg) {
  const union = inventory.unions.find((u) => u.name === capture.union);
  const hints = union?.mount ?? {};
  const base = {
    capture,
    leg: hints.leg ?? defaultLeg,
    component: null,
    field: null,
    props: {},
    width: hints.width ?? null,
    settle: hints.settle ?? DEFAULT_MOUNT_SETTLE,
    refusal: null
  };
  const refuse = (refusal) => ({ ...base, refusal });
  if (union === void 0) return refuse(new CaptureFailure("blocked", `the inventory has no union named ${capture.union}`));
  if (union.kind !== "input" && union.kind !== "both") {
    return refuse(new CaptureFailure("blocked", `${union.name} is "${union.kind}", and a mount reaches an input`));
  }
  const site = siteFor(union, hints);
  if (site === null) return refuse(new CaptureFailure("blocked", `${union.name} says it is an input and the scan found no field that holds it`));
  const component = hints.component ?? site.component;
  if (component === null) {
    const where = union.inputs.map((s) => `${s.interface}.${s.field} (${s.file})`).join(", ");
    return refuse(
      new CaptureFailure(
        "unmountable",
        `no component takes ${union.name}: it is a field of ${where}, and none of those is the props type of a component. Give the component that branches on it a prop of type ${union.name}`,
        { missingProp: `${site.interface}.${site.field} (no component takes this union)` }
      )
    );
  }
  if (capture.member === null) {
    return refuse(
      new CaptureFailure("unmountable", `${union.name} asks for the rendering of an absent ${site.field}, and the harness always sets it. The null rendering belongs to the solver`, {
        missingProp: `${site.field} (cannot be made absent through the harness)`
      })
    );
  }
  const props = { ...hints.props, ...hints.members?.[memberKey(capture.member)], [site.field]: capture.member };
  return { ...base, component, field: site.field, props };
}
function harnessStateExpression() {
  return `(() => {
  const harness = document.querySelector(${JSON.stringify(`[${HARNESS_ATTRIBUTE}]`)}) !== null;
  const panel = document.querySelector(${JSON.stringify(HARNESS_ERROR)});
  const reason = panel === null ? null : panel.querySelector('p') || panel;
  const error = reason === null ? null : (reason.textContent || '').replace(/\\s+/g, ' ').trim();
  const roots = document.querySelectorAll(${JSON.stringify(SUBJECT_CHILD)}).length;
  return { harness, error, roots };
})()`;
}
async function harnessState(session) {
  if (!session.evaluate) return null;
  return await session.evaluate(harnessStateExpression());
}
function expectation(r) {
  const extra = Object.keys(r.props).filter((key) => key !== r.field);
  return `${r.component} drawn with ${r.field}="${r.capture.member}"${extra.length === 0 ? "" : ` (plus ${extra.join(", ")})`}`;
}
async function captureMounted(session, r, ctx) {
  const started = ctx.now();
  const result = {
    id: r.capture.id,
    union: r.capture.union,
    member: r.capture.member,
    ok: false,
    subject: null,
    context: null,
    provenance: "mounted",
    // No feature function runs under a mount. Null is "not checked", never "it agreed".
    verified: null,
    error: null,
    ms: 0,
    ...r.component === null ? {} : { component: r.component }
  };
  try {
    if (r.refusal !== null) throw r.refusal;
    if (!session.evaluate) {
      throw new CaptureFailure("blocked", "the target cannot evaluate in the page, so it cannot prove that the page is the state harness");
    }
    const url = mountUrl({ component: r.component, props: r.props, width: r.width });
    await session.navigate(url);
    try {
      await session.settle(r.settle);
    } catch (e) {
      const late = await harnessState(session);
      if (late?.error) throw new CaptureFailure("unmountable", `${r.component} did not mount: ${late.error}`, { missingProp: condense(late.error) }, e);
      if (late && !late.harness) throw new CaptureFailure("blocked", `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`, {}, e);
      throw e;
    }
    const state = await harnessState(session);
    if (!state?.harness) {
      throw new CaptureFailure("blocked", `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`);
    }
    if (state.error) throw new CaptureFailure("unmountable", `the harness refused ${url}: ${state.error}`, { missingProp: condense(state.error) });
    if (state.roots === 0) throw new CaptureFailure("crashed", `${r.component} mounted and drew no element`);
    const held = await session.currentRoute();
    if (!held.startsWith(STATES_HARNESS_PATH)) throw new CaptureFailure("blocked", `the page left the harness for ${held}`);
    const subject = statePath(ctx.slug, r.capture.id, "subject");
    await session.screenshot(import_node_path9.posix.join(ctx.reportDir, subject));
    await ctx.record({ file: import_node_path9.posix.join(ctx.reportDir, subject), kind: "screenshot", row: r.capture.id });
    result.subject = subject;
    result.expect = expectation(r);
    result.ok = true;
  } catch (e) {
    result.error = errorText(e);
    Object.assign(result, failureFields(e));
  }
  result.ms = ctx.now() - started;
  return result;
}
var import_node_path9, STATES_HARNESS_PATH, HARNESS_ATTRIBUTE, SUBJECT_CHILD, HARNESS_ERROR, DEFAULT_MOUNT_SETTLE, memberKey, condense;
var init_mount = __esm({
  "src/states/services/mount.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path9 = require("path");
    init_names();
    init_capture();
    init_inventory();
    STATES_HARNESS_PATH = QA_STATES_PATH;
    HARNESS_ATTRIBUTE = QA_STATES_ATTRIBUTE;
    SUBJECT_CHILD = "[data-qa-subject] > *";
    HARNESS_ERROR = "[data-qa-states-error]";
    DEFAULT_MOUNT_SETTLE = { selector: SUBJECT_CHILD, timeout: 1e4 };
    memberKey = (member) => member === null ? "null" : member;
    condense = (reason) => reason.length <= 120 ? reason : `${reason.slice(0, 117)}...`;
  }
});

// src/services/peers.mts
async function loadPeer(spec, module2) {
  const mod = await optionalPeer(spec, () => import(spec));
  if (!mod) throw new LaunchwrightError(`qa.${module2}.module`, `This lw qa command needs the ${module2} module. Run lw add ${module2}.`);
  return mod;
}
var loadDb, loadHttp;
var init_peers2 = __esm({
  "src/services/peers.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    loadDb = () => loadPeer("@launchwrighthq/db", "db");
    loadHttp = () => loadPeer("@launchwrighthq/http", "http");
  }
});

// src/world/services/stack.mts
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
  return (0, import_node_path10.resolve)(root, PGLITE_DIR, checkIdentifier(name));
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
    const dir = (0, import_node_path10.isAbsolute)(db.dataDir) ? db.dataDir : (0, import_node_path10.resolve)(root, db.dataDir);
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
async function pgAdmin(url, allowed) {
  const remote = remoteHostProblem(url);
  if (remote) throw new LaunchwrightError("qa.stack.host", `Refusing: ${remote}.`, { context: { host: hostOfUrl(url) } });
  const { createDb } = await loadDb();
  const db = await createDb({ driver: "pg", url: urlWithDatabase(url, MAINTENANCE_DATABASE) });
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
  const dir = (0, import_node_path10.resolve)(root, PGLITE_DIR);
  return {
    async exists(name) {
      return await pathKind(pgliteDir(root, name)) === "dir";
    },
    async create(name, template) {
      guard(allowed, name, "create");
      if (template === void 0) await (0, import_promises5.mkdir)(pgliteDir(root, name), { recursive: true });
      else await (0, import_promises5.cp)(pgliteDir(root, template), pgliteDir(root, name), { recursive: true, errorOnExist: true, force: false });
    },
    async drop(name) {
      guard(allowed, name, "drop");
      await (0, import_promises5.rm)(pgliteDir(root, name), { recursive: true, force: true });
    },
    async list(prefix) {
      let names;
      try {
        names = await (0, import_promises5.readdir)(dir);
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.stack.read", `Cannot read ${dir}.`, { cause });
      }
      return names.filter((n) => n.startsWith(prefix)).sort();
    },
    close: async () => void 0
  };
}
function dbAdmin(db, root, allowed) {
  if ((db.driver ?? "pg") === "pglite") return Promise.resolve(pgliteAdmin(root, allowed));
  if (typeof db.url !== "string" || db.url === "") throw new LaunchwrightError("qa.stack.url", "Config db.url is not set, so lw qa has no database server.");
  return pgAdmin(db.url, allowed);
}
var import_promises5, import_node_path10, LOOPBACK_HOSTS, MAINTENANCE_DATABASE, PGLITE_DIR;
var init_stack = __esm({
  "src/world/services/stack.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises5 = require("fs/promises");
    import_node_path10 = require("path");
    init_kernel();
    init_fs();
    init_peers2();
    LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];
    MAINTENANCE_DATABASE = "postgres";
    PGLITE_DIR = ".lw/qa/pglite";
  }
});

// src/services/runner.mts
function forkView(baseUrls, apiPort, forkUrl, label) {
  const view = { baseUrls: {}, blocked: {} };
  for (const [surface, url] of Object.entries(baseUrls)) {
    const parsed = new URL(url);
    if (isLoopbackHost(parsed.hostname) && Number(parsed.port) === apiPort) {
      view.baseUrls[surface] = `${forkUrl}${parsed.pathname.replace(/\/+$/, "")}`;
    } else {
      view.blocked[surface] = `the ${surface} base URL ${url} is not the QA API on port ${apiPort}, so its client reads the shared QA database and cannot show fork ${label}. Serve the ${surface} surface from the QA app (qa.baseUrls.${surface} = http://127.0.0.1:${apiPort}), or run the row without a fork`;
    }
  }
  return view;
}
var import_node_fs7, import_promises6, import_node_path11;
var init_runner = __esm({
  "src/services/runner.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs7 = require("fs");
    import_promises6 = require("fs/promises");
    import_node_path11 = require("path");
    init_kernel();
    init_evidence();
    init_ledger();
    init_legs();
    init_manifest2();
    init_video();
    init_mount();
    init_stack();
  }
});

// src/states/services/forge-seed.mts
function seedFile(state) {
  if (!/^[A-Za-z0-9_$-]+\.[A-Za-z0-9_$.-]+$/.test(state)) throw new LaunchwrightError("qa.forge.state", `${state} is not a state id <union>.<member>.`, { context: { state } });
  return `${FORGE_DIR}/${state}.seed.json`;
}
function draftSeed(proposal, member) {
  return {
    state: `${proposal.union}.${member}`,
    accepted: false,
    via: proposal.via,
    route: null,
    ...proposal.via === "app-service" ? { module: "" } : { rows: [] },
    fields: proposal.fields,
    reason: proposal.reason,
    note: DRAFT_NOTE
  };
}
function writeDraft(root, proposal, member) {
  const path = (0, import_node_path12.join)(root, seedFile(`${proposal.union}.${member}`));
  if ((0, import_node_fs8.existsSync)(path)) return false;
  (0, import_node_fs8.mkdirSync)((0, import_node_path12.dirname)(path), { recursive: true });
  (0, import_node_fs8.writeFileSync)(path, `${JSON.stringify(draftSeed(proposal, member), null, 2)}
`);
  return true;
}
function readSeed(path) {
  let value;
  try {
    value = JSON.parse((0, import_node_fs8.readFileSync)(path, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.forge.seed", `Cannot read ${path} as JSON.`, { cause, context: { path } });
  }
  const parsed = seedSchema.safeParse(value);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `${i.path.map(String).join(".") || "(root)"} ${i.message}`);
    throw new LaunchwrightError("qa.forge.seed", `${path} is not a seed file: ${keys.join("; ")}`, { context: { path } });
  }
  return parsed.data;
}
function acceptedSeed(seed) {
  if (!seed.accepted) return "it is a draft: a reviewer sets accepted to true";
  if (seed.route === null) return "it names no route";
  if (seed.via === "app-service" && !seed.module) return "via app-service needs a module";
  if (seed.via === "direct-write" && (seed.rows ?? []).length === 0) return "via direct-write needs rows";
  return seed;
}
function quoteName(name) {
  return name.split(".").map((part) => `"${part}"`).join(".");
}
function literal(value, tenantId) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new LaunchwrightError("qa.forge.row", `${value} is not a finite number.`);
    return String(value);
  }
  const text2 = value === "{tenantId}" ? tenantId : value;
  return `'${text2.replaceAll("'", "''")}'`;
}
function rowStatements(rows, tenantId) {
  return rows.map((row) => {
    const columns = Object.keys(row.values);
    if (columns.length === 0) throw new LaunchwrightError("qa.forge.row", `A row of ${row.table} has no values.`, { context: { table: row.table } });
    const values = columns.map((c) => literal(row.values[c] ?? null, tenantId));
    return `insert into ${quoteName(row.table)} (${columns.map(quoteName).join(", ")}) values (${values.join(", ")})`;
  });
}
var import_node_fs8, import_node_path12, FORGE_DIR, cell, seedRow, seedSchema, DRAFT_NOTE;
var init_forge_seed = __esm({
  "src/states/services/forge-seed.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs8 = require("fs");
    import_node_path12 = require("path");
    init_kernel();
    FORGE_DIR = ".lw/qa/forge";
    cell = import_zod6.z.union([import_zod6.z.string(), import_zod6.z.number(), import_zod6.z.boolean(), import_zod6.z.null()]);
    seedRow = import_zod6.z.object({ table: import_zod6.z.string().regex(/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i), values: import_zod6.z.record(import_zod6.z.string().regex(/^[a-z_][a-z0-9_]*$/i), cell) });
    seedSchema = import_zod6.z.object({
      state: import_zod6.z.string(),
      accepted: import_zod6.z.boolean(),
      via: import_zod6.z.enum(["app-service", "direct-write"]),
      /** The route that renders the state on the QA app. */
      route: import_zod6.z.string().startsWith("/").nullable(),
      persona: import_zod6.z.string().optional(),
      settle: import_zod6.z.object({ selector: import_zod6.z.string(), artwork: import_zod6.z.boolean(), video: import_zod6.z.boolean(), busy: import_zod6.z.boolean(), timeout: import_zod6.z.number().positive() }).partial().optional(),
      /** app-service: a project-relative module whose default export writes the state through `ctx.app`. */
      module: import_zod6.z.string().optional(),
      /** direct-write: the rows to insert. */
      rows: import_zod6.z.array(seedRow).optional(),
      fields: import_zod6.z.array(import_zod6.z.object({ interface: import_zod6.z.string(), field: import_zod6.z.string(), file: import_zod6.z.string() })).optional(),
      reason: import_zod6.z.string().optional(),
      note: import_zod6.z.string().optional()
    });
    DRAFT_NOTE = "Draft. Set route to the page that renders the state. For via app-service, set module to a project module whose default export writes the state through ctx.app. For via direct-write, list rows. Then set accepted to true and run lw qa states forge.";
  }
});

// src/services/changes.mts
function git(repo, args, opts = {}) {
  const res = (0, import_node_child_process2.spawnSync)("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: GIT_TIMEOUT_MS, killSignal: "SIGKILL" });
  if (res.error) throw new LaunchwrightError("qa.git", `Cannot run git ${args.join(" ")}: ${res.error.message}`, { cause: res.error, context: { repo } });
  if (res.status !== 0) {
    if (opts.allowFail) return null;
    throw new LaunchwrightError("qa.git", `git ${args.join(" ")} failed: ${(res.stderr ?? "").trim()}`, { context: { repo, args } });
  }
  return res.stdout;
}
var import_node_child_process2, import_node_fs9, import_node_path13, RECORD, FIELD, LOG_FORMAT, GIT_TIMEOUT_MS;
var init_changes = __esm({
  "src/services/changes.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process2 = require("child_process");
    import_node_fs9 = require("fs");
    import_node_path13 = require("path");
    init_kernel();
    RECORD = "";
    FIELD = "";
    LOG_FORMAT = `${RECORD}%H${FIELD}%h${FIELD}%cI${FIELD}%an${FIELD}%s`;
    GIT_TIMEOUT_MS = 12e4;
  }
});

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION;
var init_contract2 = __esm({
  "src/drivers/target/contract.mts"() {
    "use strict";
    init_cjs_shims();
    QA_TARGET_SPEC_VERSION = "1";
  }
});

// src/drivers/target/fake.mts
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
function write(path, bytes2) {
  (0, import_node_fs10.mkdirSync)((0, import_node_path14.dirname)(path), { recursive: true });
  (0, import_node_fs10.writeFileSync)(path, bytes2);
}
function capabilityError(target, capability, what) {
  return new LaunchwrightError("qa.target.capability", `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability }
  });
}
function createFakeTarget(opts = {}) {
  return new FakeTargetImpl(opts);
}
var import_node_fs10, import_node_path14, FAKE_SHOT_SIZE, FAKE_CLIP_MS, DEFAULT_CAPABILITIES, CLIP_BASE64, FAKE_CLIP, FakeSession, FakeTargetImpl;
var init_fake2 = __esm({
  "src/drivers/target/fake.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs10 = require("fs");
    import_node_path14 = require("path");
    init_kernel();
    init_png();
    init_contract2();
    FAKE_SHOT_SIZE = { width: 64, height: 40 };
    FAKE_CLIP_MS = 2e3;
    DEFAULT_CAPABILITIES = ["input", "screenshot", "video", "webview"];
    CLIP_BASE64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAqZEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggElTbuMU6uEHFO7a1OsggqD7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiECfQAAAAAAAFlSua8iuAQAAAAAAAD/XgQFzxYhxzzkbkqodspyBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhA7msoDgkLCBILqBIJqBAlWwhFW5gQESVMNn/HNzoGPAgGfImkWjh0VOQ09ERVJEh41MYXZmNjAuMTYuMTAwc3PWY8CLY8WIcc85G5KqHbJnyKFFo4dFTkNPREVSRIeUTGF2YzYwLjMxLjEwMiBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAyLjAwMDAwMDAwMAAfQ7Z1SNfngQCjQvuBAACAMBUAnQEqIAAgAAAHCIWFiIWEiAICAnW6JOn+A/g5+sHN07T9gf0vygnhb+A/gx7K+YB/iX4A8AH+A/xj+2f4D3/+kB/SL0AesB/QH0gP2r+AH9UP7p7h/8W/j13YfHvwz5zj07/WbLXvMfx6/KDSA/h5+QGYB/nn4T/jNlHPBQedz+Yfk9/YPQa/uXuCfyD+Lf2L8lP3t+gHqK/0a9rUTZwb6G+ZDUbbGaZ3HnT4OcCViQD+//8W+SVOYTWnlagaua4GlO6yBXCtSjZlvB3//nMP1p52BDYllDCi9qvwjonmzgbuf5cn8Gz+HU89k4bi/AY9QX4ZQfM5IiSI2Ji45urut7+XdcTDT9Ikp8l1VdnW2qkb5bMejrdvPD+CtS/Lz+yP/6FFeqG5/ZoLlBgKCX4x6lYBjGNLSk4Df+YMPdsQ/Uj1t1VS3QP95vP/9ph5oUlsTJNGQclHQd5B32kCq01WGhU+i6e236ayfoaZ6YCk8eSZUKAZiTfcWUUbZp9R3kH+Eytv8rv48s+Hg8YGo6FbZ3RHUOvwZUZCZzENxp3+MhmR3wxuJBhuLmzgl3LJMEu3bNT1nYvGRMf2kFMvvRT8+S5lUp9+8wCEVPaEiBXCSxId8+AenJwY65g6A/v/9FnmSuHes+itOb+Pmqz73pP/+2TIPB2r+jLmu78Z3Ep3WoHbPyJDNeK5Q4FVVr9eZ7f/8faGBZl+/9m54ieXUjkEh8DhC4qTpRfqiw1+JUUTMDunjFChd//Ist9sz7oqnLnQ4wwaQh6qN/7Mvuuk7TirntQ/G8Vywszu//kw72zrengq0HUvtKrAHD/UafmMBw47y0/lFroTGHu37lf8SNDg+gtxck1QTtWOSAMwmi3/550em5F4owKWmTf//UmGf+JSKQt2RIN/AK3RaJp8HxIadOBk0xAMOLoat9RSP1Q+ZZv9doL17J3x3/FG/yN1zQ+E0ILIqBV6576B2sREelI9wS+vEvaHiYebkNmFtt7BzBKMSXfAo0DRgQD6ADEDAAIQEAAYDEHEoP/m/81gTAFIvIfeAGG8iADF8VMeCc9dibJIKF+z4X//m8g5PCR0/9NLI+EVGCbfy/PHjboj4V1gbGp/J66WZztVgQUCn2qhcGEcZrT2jsy0M7lo7T593oJgmeeggpn//81TP98+6yMQYc165vEAjIWoJYSt//z5bedOP9cR0Vm7SWxJuf4NanlrB2PfKtCePAk2kVaHj4F2MAu7QslBpsdnwqoKERTn+82PBaed/KN8V5H2NLvEZr2hVZyqQhLSYACjQOuBAfQA0QIAAhAQABgDUA3IDp9JTTbmjudGAl7+kMXUYjRQMgXwDNB/FqCH0UmGPgSP8pUyUjwOANi/j//CmajrP9+oLxN32+YVaChf9J5PJkLmFJs6atyUgLEGYZIMB96SFRL4+dK/p3RYxImn/eGM72BDDH0zxIfT/76/Qf4EKiNPRX9TUtuSB6g+5CUXtt/8T4yMGGfyxmTg/+21fueKQENF359Ch2qqhl84nc5W6v8QquQso8cHjB5AwRSSGePa44HG/TMnmElErkJHg4ltxUruDACg0rjXeB392Atwuf//hLJ+3pxIJIAAo0DEgQLuAHECAAAQEAAYAjwExAFlIHLjQFOT9ADF1B0944xb3JNqHjF3MFRsfYtFDdzx70YuDNHp99FeIkNKLegLS0YK9lOQI9JJJ5VF//kFKP/sljZJXGXRKRMJUxAEPp/98+LmTwhWTnQXJPMJukYQl6IlHEjSPIF7HMAeRgFxsO4a75O4PreDS/D2mT/fqnsre1LyBfHFgD6i6pVrwAxokv//oiAIAeFiu714vm4aSTOhgVErb++2+M6fpuJ1P/hFcgwp4KNA1oED6ADxAgAAEBAAGASQCUkitq523sMDJzYCRPP8AMXUHEf/m8d5wwh3c3iyNs0z+lv+z5+47sE144HDndGUzScrcCak0/B+w4ij3mNYfek//Kg6J9o/o7e0JFbpQfIlkxg+kEsMB9dhWzxCk7knOGEKfW+QdVKzLy1dgFz//z5bC5SKiRYpaYztXX8o94f+49dIoBF/F+qtD8oywrW6NlWyP/+X4NYeEhnAjBCDqiFK/HZDzQ0F+0xJa6+XpATRgYMCDZJVGOz2pXFpBPFNk0XZPUsiAACjQNiBBOIAMQMAABAQABgGR/vf9plwxQDfyAClefUm6v0LgMXUHT6WnRyBI/yhdOwjO1br845WXoaWztcpgoX/THlQKR2pkvO/nJGXKQZBd/2HeYecZeTUwD2wDbo2xSXvvfTvlHPMALn+CUxqhgJlTSi2mY5igqcPR9T261ugRQvjhiLfoEtVAe1ELhBHl0GuuGFvzp1WvzNhXXhgM3ALZ0S4H0gYAuZpjCroTo0/OFfSfi59qkUxOt2SCcm51IuDTji/n/1VpBzJFh+vmtdZ//7AOvY6HkYv8ACjQM2BBdwA0QIAABAQABgH7iXALIB6fMXUBp5YBR5muMXUHT5xsYAXc81Z5hv8wcOEFW7haXf3O0/UgFRQEr5gr3JHfcBASdXixtXydcS1e30dhuGhD0bLjH+1AnKQvN4eEQG6xHDEg7xmY1I4bWPCSE5ip3QppZ0pwgkvYvknonvilpQK/7c7Md+ecrPsPSuT2dBNXxxYCxFRDRF+9p7nkwTRBbVBOeGDHRoxkwkYUJX2XipLBudMygwGwZ1K0hF5vP2FC9FMxjSNYJHkj4QAo0DGgQbWAPEBAAAQEBRgAKkAv9AAf46/AMXUHTpczZ0sj4Rhj+rnM//ny2FyhD1mc7YBBI6RfrRaZXJ/TczqUZIBMHUM8DEQGyOSvGSq9L6W5bxIjc2UKaKJq8oZ8ScGgT//U1uX+KPxWGkZVF/94PNbUOPv92os3aJM/lUH//N4+qhE0ACrQ/KQGQ/hAzV6Mj//l+DWHQDBtmlSefI4glVQwxV1KLgWXogTyGTrxFUNDF+zIQfh7G6ng9p2VnBdv/CWf+yAmLAAHFO7a5G7j7OBALeK94EB8YIBpvCBAw==";
    FAKE_CLIP = Buffer.from(CLIP_BASE64, "base64");
    FakeSession = class {
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
    FakeTargetImpl = class {
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
  }
});

// src/drivers/target/playwright.mts
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
function required(value, kind) {
  if (value === void 0 || value === "") {
    throw new LaunchwrightError("qa.target.act", `The act ${kind} needs a ${kind === "press" ? "key" : "target"}.`, { context: { kind } });
  }
  return value;
}
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
var import_node_fs11, import_node_path15, PERSONA_SESSION_ROUTE, CAPABILITIES, MIN_CLIP_MS, importPlaywright, SETTLE_SCRIPTS, PlaywrightSession, PlaywrightTarget;
var init_playwright = __esm({
  "src/drivers/target/playwright.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs11 = require("fs");
    import_node_path15 = require("path");
    init_kernel();
    init_png();
    init_video();
    init_contract2();
    PERSONA_SESSION_ROUTE = "/__qa/session";
    CAPABILITIES = ["input", "screenshot", "video", "webview"];
    MIN_CLIP_MS = MIN_VIDEO_S * 1e3 + 500;
    importPlaywright = () => import("@playwright/test");
    SETTLE_SCRIPTS = {
      artwork: () => {
        const images = [...document.images];
        if (images.length > 0) return images.every((i) => i.complete && i.naturalWidth > 0);
        return [...document.querySelectorAll("body *")].some((el) => getComputedStyle(el).backgroundImage.includes("url("));
      },
      video: () => [...document.querySelectorAll("video")].some((v) => v.readyState >= 2 && v.videoWidth > 0 && !v.paused),
      busy: () => document.querySelector('[aria-busy="true"]') === null
    };
    PlaywrightSession = class {
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
          if (isCodedError(err) && err.code === "qa.target.act") throw err;
          throw this.fail("qa.target.act", `Leg ${this.opts.leg.name} could not run the act ${what}.`, err, { act: step });
        }
      }
      /** Scrolls the app's own scroll root `[data-page-scroll]`, else the document, and checks that it moved. */
      async scroll(dx, dy) {
        const moved = await this.page.evaluate(
          ([x, y]) => {
            const root = document.querySelector("[data-page-scroll]");
            const el = root ?? document.scrollingElement ?? document.documentElement;
            const before2 = [el.scrollLeft, el.scrollTop];
            el.scrollBy(x, y);
            return { marked: root !== null, moved: el.scrollLeft !== before2[0] || el.scrollTop !== before2[1] };
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
        (0, import_node_fs11.mkdirSync)((0, import_node_path15.dirname)(path), { recursive: true });
        const png = await this.page.screenshot({ path, animations: "disabled", fullPage: false });
        const size = pngSize(png);
        if (size === null) throw new LaunchwrightError("qa.target.screenshot", `Leg ${this.opts.leg.name} wrote a screenshot that is not a PNG: ${path}.`);
        return { path, ...size };
      }
      async startVideo(path) {
        if (this.videoPath !== null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} already records ${this.videoPath}.`);
        (0, import_node_fs11.mkdirSync)((0, import_node_path15.dirname)(path), { recursive: true });
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
        (0, import_node_fs11.mkdirSync)((0, import_node_path15.dirname)(path), { recursive: true });
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
    PlaywrightTarget = class {
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
  }
});

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
var init_targets = __esm({
  "src/services/targets.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_fake2();
    init_playwright();
  }
});

// src/tokens.mts
var QA_TARGETS;
var init_tokens2 = __esm({
  "src/tokens.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    QA_TARGETS = token("qa.targets");
  }
});

// src/states/services/run.mts
function gitRevision(cwd) {
  const commit = git(cwd, ["rev-parse", "HEAD"], { allowFail: true })?.trim() || "none";
  const status = git(cwd, ["status", "--porcelain"], { allowFail: true });
  return { commit, dirty: (status ?? "").trim() !== "" };
}
function runClock(app, overrides = {}) {
  return overrides.clock ?? (app ? app.get(CLOCK) : systemClock);
}
function runDeps(config, app, overrides = {}, extra = {}) {
  const clock = runClock(app, overrides);
  return {
    clock,
    targets: overrides.targets ?? (app ? app.get(QA_TARGETS) : createTargetRegistry(config, extra, clock)),
    revision: overrides.revision ?? gitRevision
  };
}
function legByName(config, name) {
  const legs = legDefinitions(config);
  const leg = legs.find((l) => l.name === name);
  if (!leg) {
    throw new LaunchwrightError("qa.legs.unknown", `No leg is named ${name}. Legs: ${legs.map((l) => l.name).join(", ")}.`, { context: { leg: name } });
  }
  return leg;
}
function ledgerRecorder(args) {
  const entries = [];
  const device = args.leg.device;
  return {
    async record({ file, kind, row }) {
      entries.push(
        await ledgerEntry(args.reportDir, {
          path: (0, import_node_path16.relative)(args.reportDir, file).split("\\").join("/"),
          kind,
          capturedAt: args.clock.date().toISOString(),
          commit: args.revision.commit,
          dirty: args.revision.dirty,
          leg: args.leg.name,
          target: args.leg.target,
          ...device === void 0 ? {} : { device },
          provenance: args.provenance,
          row,
          attempt: 1
        })
      );
    },
    async flush() {
      const batch = entries.splice(0);
      if (batch.length > 0) await appendLedger(args.reportDir, args.slug, batch);
      return batch.length;
    }
  };
}
var import_node_path16;
var init_run = __esm({
  "src/states/services/run.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path16 = require("path");
    init_kernel();
    init_changes();
    init_ledger();
    init_legs();
    init_runner();
    init_targets();
    init_tokens2();
  }
});

// src/states/services/forge.mts
async function runModule(root, module2, ctx) {
  const file = (0, import_node_path17.isAbsolute)(module2) ? module2 : (0, import_node_path17.resolve)(root, module2);
  let mod;
  try {
    mod = await import((0, import_node_url2.pathToFileURL)(file).href);
  } catch (cause) {
    throw new LaunchwrightError("qa.forge.module", `Cannot load the seed module ${module2}: ${messageOf(cause)}`, { cause, context: { module: module2 } });
  }
  if (typeof mod.default !== "function") throw new LaunchwrightError("qa.forge.module", `${module2} must export a default function (ctx) that writes the state.`, { context: { module: module2 } });
  await mod.default(ctx);
}
async function writeState(seed, fork, root) {
  const member = seed.state.slice(seed.state.indexOf(".") + 1);
  try {
    if (seed.via === "app-service") {
      const ctx = { ...fork.world, state: seed.state, member, ...seed.persona === void 0 ? {} : { persona: seed.persona } };
      await runModule(root, seed.module, ctx);
    } else {
      for (const sql of rowStatements(seed.rows ?? [], fork.world.tenantId)) await fork.execute(sql);
    }
  } catch (cause) {
    throw new LaunchwrightError("qa.forge.seed", `The ${seed.via} seed of ${seed.state} failed: ${messageOf(cause)}`, { cause, context: { state: seed.state } });
  }
}
function forkBase(seed, fork, ctx) {
  const view = forkView(ctx.baseUrls, ctx.apiPort, fork.url, `forge ${seed.state}`);
  const blocked = view.blocked[ctx.leg.surface];
  if (blocked !== void 0) throw new LaunchwrightError("qa.forge.surface", blocked, { context: { surface: ctx.leg.surface } });
  return view.baseUrls[ctx.leg.surface] ?? fork.url;
}
async function forgeState(seed, fork, ctx) {
  const started = ctx.clock.now();
  const dot = seed.state.indexOf(".");
  const union = seed.state.slice(0, dot);
  const member = seed.state.slice(dot + 1);
  await writeState(seed, fork, ctx.root);
  const baseUrl = forkBase(seed, fork, ctx);
  const recorder = ledgerRecorder({ reportDir: ctx.reportDir, slug: ctx.slug, leg: ctx.leg, provenance: "forged", clock: ctx.clock, revision: ctx.revision });
  const artifactRel = statePath(ctx.slug, seed.state, "forged", "json");
  const artifact = {
    state: seed.state,
    via: seed.via,
    provenance: "forged",
    route: seed.route,
    ...seed.module ? { module: seed.module } : {},
    ...seed.rows ? { rows: seed.rows } : {},
    note: FORGE_NOTE
  };
  const artifactFile = (0, import_node_path17.join)(ctx.reportDir, artifactRel);
  (0, import_node_fs12.mkdirSync)((0, import_node_path17.dirname)(artifactFile), { recursive: true });
  (0, import_node_fs12.writeFileSync)(artifactFile, `${JSON.stringify(artifact, null, 2)}
`);
  await recorder.record({ file: artifactFile, kind: "log", row: seed.state });
  const shotRel = statePath(ctx.slug, seed.state, "forged", "png");
  let error = null;
  let session = null;
  try {
    session = await ctx.target.open({ leg: ctx.leg, baseUrl, outDir: (0, import_node_path17.join)(reportPaths(ctx.reportDir, ctx.slug).assets, "states"), ...seed.persona ? { persona: seed.persona } : {} });
    await session.navigate(seed.route);
    await session.settle(seed.settle ?? { busy: true });
    await session.screenshot((0, import_node_path17.join)(ctx.reportDir, shotRel));
    await recorder.record({ file: (0, import_node_path17.join)(ctx.reportDir, shotRel), kind: "screenshot", row: seed.state });
  } catch (cause) {
    error = messageOf(cause);
  } finally {
    await session?.close();
  }
  await recorder.flush();
  const ms = ctx.clock.now() - started;
  const result = {
    row: seed.state,
    leg: ctx.leg.name,
    status: error === null ? "passed" : "failed",
    reason: `forged via ${seed.via}: the render only, never a live pass${error === null ? "" : `; ${error}`}`,
    failures: error === null ? [] : ["crashed"],
    attempts: 1,
    ms
  };
  await appendResult(reportPaths(ctx.reportDir, ctx.slug).results, result);
  return {
    id: seed.state,
    union,
    member,
    ok: error === null,
    subject: error === null ? shotRel : null,
    context: null,
    provenance: "forged",
    // No feature function runs over a forged seed. Null is "not checked", never "it agreed".
    verified: null,
    error,
    expect: `forged via ${seed.via}: ${seed.route} renders ${seed.state}. The render only.`,
    ms
  };
}
var import_node_fs12, import_node_path17, import_node_url2, FORGE_NOTE;
var init_forge = __esm({
  "src/states/services/forge.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs12 = require("fs");
    import_node_path17 = require("path");
    import_node_url2 = require("url");
    init_kernel();
    init_ledger();
    init_runner();
    init_forge_seed();
    init_inventory();
    init_run();
    FORGE_NOTE = "A forged state comes from a seed that the library inferred and a reviewer accepted, run on a fork of the QA database. It proves the render only, and it never counts as a live pass.";
  }
});

// src/states/services/loop.mts
function reasonOf(row) {
  return FAIL_REASONS.includes(row?.reason) ? row?.reason : "crashed";
}
function parseInventory(text2, source) {
  let parsed;
  try {
    parsed = JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("qa.states.inventory", `${source} is not JSON. Run "lw qa states scan" again.`, { cause, context: { source } });
  }
  const errors = validateInventory(parsed);
  if (errors.length > 0) {
    throw new LaunchwrightError("qa.states.inventory", `The inventory in ${source} is invalid, ${errors.length} problem(s):
${errors.map((e) => `  ${e}`).join("\n")}`, {
      context: { source, errors }
    });
  }
  return parsed;
}
function unionFiles(union) {
  const files = /* @__PURE__ */ new Set([union.file]);
  for (const site of union.inputs) {
    files.add(site.file);
    if (site.componentFile) files.add(site.componentFile);
  }
  for (const site of union.outputs) files.add(site.file);
  return [...files].filter(Boolean).sort();
}
function narrowInventory(inv, paths) {
  const files = new Set(paths.files ?? []);
  const dirs = (paths.dirs ?? []).filter(Boolean).map((d) => d.replace(/\/+$/, ""));
  const touches = (path) => files.has(path) || dirs.some((dir) => path.startsWith(`${dir}/`));
  const kept = [];
  const dropped = [];
  for (const union of inv.unions) {
    if (unionFiles(union).some(touches)) kept.push(union);
    else dropped.push(union.name);
  }
  return { inventory: { ...inv, unions: kept }, kept: kept.map((u) => u.name), dropped };
}
function neitherUnions(inv) {
  return inv.unions.filter((union) => union.kind === "neither");
}
function subjectLabel(union) {
  for (const site of union.inputs) if (site.component) return site.component;
  for (const site of union.outputs) if (site.fn) return site.fn;
  for (const site of union.inputs) if (site.interface) return site.interface;
  return union.file.split("/").pop() ?? union.name;
}
function issueFor(union) {
  const members = union.members.map((m) => `\`${m}\``).join(" ");
  const title = `qa states: \`${union.name}\` is neither an input nor an output`;
  const body = [
    `File: \`${union.file}:${union.line}\``,
    `Members (${union.members.length}): ${members}`,
    "",
    `\`${union.name}\` is an exported closed union, so the QA state run counts its ${union.members.length} members.`,
    "It can reach none of them. No field of a props type holds the type, so a mount cannot set it.",
    "No function returns it, so the solver has nothing to run. The state exists only inside a conditional.",
    "",
    "Declare it in one of two ways:",
    "",
    `- give the component that branches on it a prop of type \`${union.name}\`, which makes it an input; or`,
    `- move the conditional into an exported function that returns \`${union.name}\`, which makes it an output.`,
    "",
    "Or mark it `@qa-states ignore <reason>` when nothing can ever render it.",
    "",
    "Found by `lw qa states scan`."
  ].join("\n");
  return { title, body };
}
function refusalLines(inventory, rows) {
  const lines = [];
  for (const union of neitherUnions(inventory)) {
    lines.push(
      `${union.name} (${union.file}) is neither an input nor an output: nothing takes it and nothing returns it, so no mechanism can reach its ${union.members.length} member(s). The state exists only inside a conditional, and the fix is to declare it.`
    );
  }
  for (const row of rows) {
    if (row.ok) continue;
    const reason = reasonOf(row);
    if (reason === "no-mechanism") continue;
    lines.push(`${row.id}: ${refusalFor(row)}.`);
  }
  return lines;
}
function parseResults(text2) {
  const attempts = [];
  const malformed = [];
  for (const line of text2.split("\n")) {
    if (line.trim() === "") continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformed.push(line.slice(0, 200));
      continue;
    }
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string") attempts.push(parsed);
    else malformed.push(line.slice(0, 200));
  }
  return { attempts, malformed };
}
function mergeRows(captures, attempts, options = {}) {
  const notRun = options.notRun ?? {};
  const blocked = options.blocked ?? {};
  const byId2 = /* @__PURE__ */ new Map();
  for (const attempt of attempts) byId2.set(attempt.id, attempt);
  const rows = [];
  const claimed = /* @__PURE__ */ new Set();
  for (const capture of captures) {
    const attempt = byId2.get(capture.id);
    if (attempt) {
      claimed.add(capture.id);
      rows.push({ ...capture, ...attempt, ok: attempt.ok === true, reported: true });
      continue;
    }
    const blockedWhy = blocked[capture.union];
    const notRunWhy = capture.mechanism === null ? void 0 : notRun[capture.mechanism];
    if (capture.mechanism === null) rows.push({ ...capture, ok: false, reported: false, reason: "no-mechanism" });
    else if (blockedWhy !== void 0) rows.push({ ...capture, ok: false, reported: false, reason: "blocked", why: blockedWhy });
    else if (notRunWhy !== void 0) rows.push({ ...capture, ok: false, reported: false, reason: "not-run", why: notRunWhy });
    else rows.push({ ...capture, ok: false, reported: false, reason: "crashed", error: UNREPORTED });
  }
  for (const attempt of attempts) {
    if (claimed.has(attempt.id)) continue;
    rows.push({ ...attempt, ok: attempt.ok === true, reported: true, extra: true });
  }
  return rows;
}
function cell2(text2) {
  return String(text2 ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}
function provenanceLabel(provenance) {
  if (provenance === "live") return null;
  if (provenance && PROVENANCE.includes(provenance)) return `(${provenance})`;
  return "(provenance not reported)";
}
function verifiedCell(row) {
  if (row.verified === true) return row.answered ? `yes (${cell2(row.answered)})` : "yes";
  if (row.verified === false) return "no";
  return "not verified";
}
function stateCell(union, row) {
  if (row.member === null) return "`null` (the function returned nothing)";
  if (row.member !== void 0) return cell2(row.member);
  const key = row.id.startsWith(`${union.name}.`) ? row.id.slice(union.name.length + 1) : row.id;
  return cell2(key.replace(/#/g, ", ").replace(/-/g, " "));
}
function orderRows(union, rows) {
  const planned = rows.filter((row) => !row.extra);
  const extras = rows.filter((row) => row.extra);
  const taken = /* @__PURE__ */ new Set();
  const out = [];
  for (const row of planned) {
    out.push(row);
    if (row.member === null || row.member === void 0) continue;
    for (const extra of extras) {
      if (taken.has(extra) || !extra.id.startsWith(`${union.name}.${row.member}#`)) continue;
      taken.add(extra);
      out.push(extra);
    }
  }
  for (const extra of extras) if (!taken.has(extra)) out.push(extra);
  return out;
}
function refusalFor(row) {
  const reason = reasonOf(row);
  if (reason === "unreachable") return `no candidate produced it (tried ${(row.fieldsTried ?? []).join(", ") || "nothing"})`;
  if (reason === "identical") return `identical to ${row.sameAs ?? "another member"}: the DOM diff is empty`;
  if (reason === "state-mismatch") return `intended ${row.intended ?? row.member ?? "?"}, the function answered ${row.actual ?? "?"}`;
  if (reason === "unmountable") return `cannot mount ${row.component ?? "the component"}: ${row.missingProp ?? "missing prop not reported"}`;
  if (reason === "blocked" || reason === "not-run") return row.why ?? row.error ?? SENTENCES[reason];
  return row.error ?? SENTENCES[reason];
}
function unionOf(inventory, id) {
  let best = null;
  for (const union of inventory.unions) {
    if (!id.startsWith(`${union.name}.`)) continue;
    if (!best || union.name.length > best.name.length) best = union;
  }
  return best;
}
function renderReport(args) {
  const { inventory, rows, slug, narrowedBy = null, notRun = {} } = args;
  const out = [];
  const totals = { covered: 0, planned: 0 };
  out.push(`## State coverage${slug ? `: ${slug}` : ""}`);
  out.push("");
  if (narrowedBy) out.push(`Narrowed to ${narrowedBy}: ${inventory.unions.length} union(s) its files declare or consume.`);
  out.push(
    "A shot marked `(intercepted)` comes through a rewritten API response: the component is real and the data is synthetic. `(mounted)` is the harness drawing the component directly. A shot with no label comes from live data."
  );
  for (const [mechanism, why] of Object.entries(notRun)) {
    out.push("");
    out.push(`Mechanism \`${mechanism}\` did not run: ${why}. Every capture it owns is uncovered below.`);
  }
  out.push("");
  for (const union of inventory.unions) {
    const mine = rows.filter((row) => row.id.startsWith(`${union.name}.`));
    const { covered, planned } = coverageFor(union, mine);
    totals.covered += covered;
    totals.planned += planned;
    out.push(`### ${subjectLabel(union)}: ${union.name}, ${covered} of ${planned} renderings`);
    out.push("");
    out.push("| State | Shot | Expect | Verified |");
    out.push("|---|---|---|---|");
    for (const row of orderRows(union, mine)) {
      const label = provenanceLabel(row.provenance);
      const shot = row.ok ? [row.subject ? `![${cell2(row.id)}](${row.subject})` : "shot, but no path reported", label].filter(Boolean).join(" ") : "not shot";
      const expect = row.ok ? cell2(row.expect ?? "-") : cell2(refusalFor(row));
      out.push(`| ${stateCell(union, row)} | ${shot} | ${expect || "-"} | ${verifiedCell(row)} |`);
    }
    out.push("");
  }
  const orphans = rows.filter((row) => row.extra && !unionOf(inventory, row.id));
  if (orphans.length > 0) {
    out.push("### Reported by the runner, and in no union of the inventory");
    out.push("");
    for (const row of orphans) out.push(`- \`${cell2(row.id)}\` (${row.ok ? "ok" : "failed"})`);
    out.push("");
  }
  out.push(`${inventory.unions.length} union(s), ${totals.covered} of ${totals.planned} renderings.`);
  return out.join("\n");
}
function groupFor(union, captures, defaultLeg) {
  const delivery = union.delivery ?? null;
  const missing = [];
  const route = typeof delivery?.route === "string" && delivery.route !== "" ? delivery.route : null;
  if (!route) missing.push("route");
  const intercept = delivery?.intercept;
  if (typeof intercept?.url !== "string" || intercept.url === "") missing.push("intercept.url");
  if (typeof intercept?.container !== "string" || intercept.container === "") missing.push("intercept.container");
  const settle = delivery?.settle ?? null;
  if (!settle || !settle.selector && !settle.artwork && !settle.video && !settle.busy) missing.push("settle");
  const site = solveSite(union);
  const shape = site?.params[0]?.shape ?? null;
  if (!site) missing.push("verify");
  else if (!shape) missing.push("solve.shape");
  if (captures.length === 1 && delivery?.contrast === void 0) missing.push("contrast");
  if (missing.length > 0 || !delivery || !route || !intercept || !settle || !site || !shape) return { group: null, missing };
  const group = {
    id: union.name,
    union: union.name,
    leg: delivery.leg ?? defaultLeg,
    route,
    provenance: "intercepted",
    intercept: { url: intercept.url, container: intercept.container },
    settle,
    ...delivery.act ? { act: delivery.act } : {},
    verify: { module: site.file, export: site.fn, async: site.async, ...delivery.verifyArgs ? { args: delivery.verifyArgs } : {} },
    solve: {
      shape,
      pivots: { literals: site.pivots.literals, names: site.pivots.names },
      ...delivery.pivotModules ? { pivotModules: delivery.pivotModules } : {},
      ...typeof delivery.limit === "number" ? { limit: delivery.limit } : {},
      ...typeof delivery.batchSize === "number" ? { batchSize: delivery.batchSize } : {}
    },
    members: captures.map((capture) => ({ id: capture.id, member: capture.member, expect: capture.member })),
    ...delivery.contrast === void 0 ? {} : { contrast: delivery.contrast },
    ...delivery.diffRoot ? { diffRoot: delivery.diffRoot } : {},
    ...delivery.ignoreAttributes ? { ignoreAttributes: delivery.ignoreAttributes } : {},
    ...typeof delivery.maxSubjectAreaRatio === "number" ? { maxSubjectAreaRatio: delivery.maxSubjectAreaRatio } : {}
  };
  return { group, missing: null };
}
function groupsFor(inventory, captures, defaultLeg) {
  const groups = [];
  const blocked = {};
  for (const union of inventory.unions) {
    const mine = captures.filter((capture) => capture.union === union.name && capture.mechanism === "solve");
    if (mine.length === 0) continue;
    const built = groupFor(union, mine, defaultLeg);
    if (built.group) groups.push(built.group);
    else {
      blocked[union.name] = `no capture group could be built. Missing: ${built.missing.join(", ")}. A delivery descriptor beside the union in the inventory gives the route, the intercept and the settle. The shape and the pivots come from the scan`;
    }
  }
  return { groups, blocked };
}
function mergeDelivery(inventory, delivery) {
  return { ...inventory, unions: inventory.unions.map((union) => delivery[union.name] ? { ...union, delivery: delivery[union.name] } : union) };
}
function buildPlan(args) {
  const { inventory: scanned, narrow } = args;
  const inventory = narrow ? narrowInventory(scanned, narrow).inventory : scanned;
  return {
    generated: args.generated,
    slug: args.slug,
    source: args.source,
    scanned: scanned.unions.length,
    narrowedBy: narrow?.label ?? null,
    inventory,
    captures: plannedCaptures(inventory)
  };
}
function renderPlan(plan2) {
  const out = [];
  const byMechanism = /* @__PURE__ */ new Map();
  for (const capture of plan2.captures) {
    const key = capture.mechanism ?? "none";
    byMechanism.set(key, (byMechanism.get(key) ?? 0) + 1);
  }
  out.push(`inventory  ${plan2.source}, ${plan2.scanned} union(s)`);
  if (plan2.narrowedBy) out.push(`narrowed   ${plan2.inventory.unions.length} of ${plan2.scanned} union(s) kept by ${plan2.narrowedBy}`);
  const parts = ["mount", "solve", "none"].filter((key) => byMechanism.has(key)).map((key) => `${key} ${byMechanism.get(key)}`).join(", ");
  out.push(`captures   ${plan2.captures.length}${parts ? ` (${parts})` : ""}`);
  out.push("");
  for (const union of plan2.inventory.unions) {
    const mine = plan2.captures.filter((capture) => capture.union === union.name);
    out.push(
      `  ${union.name.padEnd(24)} ${union.kind.padEnd(8)} ${String(mechanismFor(union.kind) ?? "none").padEnd(6)} ${String(mine.length).padStart(3)} capture(s)  ${union.file}`
    );
  }
  return out;
}
function renderNeither(inventory) {
  const neither = neitherUnions(inventory);
  if (neither.length === 0) return [];
  const out = ["", `REFUSED   ${neither.length} union(s) are neither an input nor an output (spec 2.14 rule C1). Each one earns an issue:`];
  for (const union of neither) {
    const issue = issueFor(union);
    out.push("", `-- issue ${"-".repeat(60)}`, issue.title, "", issue.body, "-".repeat(69));
  }
  return out;
}
function finishRun(args) {
  const { plan: plan2, attempts, malformed = [], notRun = {}, blocked = {} } = args;
  const rows = mergeRows(plan2.captures, attempts, { notRun, blocked });
  const lines = [renderReport({ inventory: plan2.inventory, rows, slug: plan2.slug, narrowedBy: plan2.narrowedBy, notRun })];
  for (const line of malformed) lines.push(`malformed result line, not read: ${line}`);
  const refusals = refusalLines(plan2.inventory, rows);
  if (refusals.length > 0) {
    lines.push("", `REFUSED   ${refusals.length}, and each one is a failure:`);
    for (const line of refusals) lines.push(`  ${line}`);
  }
  const neither = renderNeither(plan2.inventory);
  lines.push(...neither);
  const notRunCount = Object.keys(notRun).length;
  const failed = rows.filter((row) => !row.ok).length;
  const refused = neitherUnions(plan2.inventory).length;
  lines.push("");
  if (failed === 0 && refused === 0 && notRunCount === 0) lines.push("every planned rendering was captured.");
  else lines.push(`${failed} rendering(s) uncovered, ${refused} union(s) refused, ${notRunCount} mechanism(s) not run.`);
  return { lines, code: failed > 0 || refused > 0 || notRunCount > 0 ? 1 : 0, rows };
}
var SENTENCES, UNREPORTED;
var init_loop = __esm({
  "src/states/services/loop.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_inventory();
    SENTENCES = {
      unreachable: "no candidate input produced this member",
      identical: "the DOM diff between two members is empty",
      "state-mismatch": "the feature's own function disagreed after injection",
      unmountable: "the harness could not mount the component",
      "no-mechanism": "the union is neither an input nor an output, so nothing can reach it",
      blocked: "the run could not build a capture group the runner would accept",
      "not-run": "the mechanism was not run",
      crashed: "the capture failed, and the runner reported only a sentence"
    };
    UNREPORTED = "the runner exited without reporting this capture";
  }
});

// src/world/services/checkout.mts
async function text(path) {
  try {
    return (await (0, import_promises7.readFile)(path, "utf8")).trim();
  } catch (cause) {
    throw new LaunchwrightError("qa.checkout.read", `Cannot read ${path}. The git worktree is broken; run git worktree repair.`, { cause });
  }
}
async function readCheckout(root) {
  const start = (0, import_node_path18.resolve)(root);
  for (let dir = start; ; dir = (0, import_node_path18.dirname)(dir)) {
    const kind = await pathKind((0, import_node_path18.join)(dir, ".git"));
    if (kind === "dir") return { root: start, toplevel: dir, commonDir: (0, import_node_path18.join)(dir, ".git"), linked: false, mainRoot: start };
    if (kind === "file") {
      const line = await text((0, import_node_path18.join)(dir, ".git"));
      const match = /^gitdir:\s*(.+)$/.exec(line);
      if (!match) throw new LaunchwrightError("qa.checkout.read", `${(0, import_node_path18.join)(dir, ".git")} does not name a git dir.`);
      const gitDir = (0, import_node_path18.resolve)(dir, match[1]);
      const commonDir = (0, import_node_path18.resolve)(gitDir, await text((0, import_node_path18.join)(gitDir, "commondir")));
      const mainTop = (0, import_node_path18.basename)(commonDir) === ".git" ? (0, import_node_path18.dirname)(commonDir) : commonDir;
      return { root: start, toplevel: dir, commonDir, linked: true, mainRoot: (0, import_node_path18.join)(mainTop, (0, import_node_path18.relative)(dir, start)) };
    }
    if ((0, import_node_path18.dirname)(dir) === dir) return { root: start, toplevel: start, commonDir: start, linked: false, mainRoot: start };
  }
}
function devProjectName(sections, checkout) {
  const dev = sections.dev;
  if (typeof dev?.project === "string" && dev.project !== "") return dev.project;
  return (0, import_node_path18.basename)((0, import_node_path18.basename)(checkout.commonDir) === ".git" ? (0, import_node_path18.dirname)(checkout.commonDir) : checkout.root);
}
var import_promises7, import_node_path18;
var init_checkout = __esm({
  "src/world/services/checkout.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises7 = require("fs/promises");
    import_node_path18 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/world/services/app.mts
function qaDatabase(sections, checkout) {
  const qa = sections.qa;
  if (typeof qa?.database === "string" && qa.database !== "") return qa.database;
  return databaseName(`${devProjectName(sections, checkout)}_qa`);
}
function botId(token2) {
  const match = typeof token2 === "string" ? /^([1-9][0-9]{0,15}):/.exec(token2) : null;
  return match ? Number(match[1]) : void 0;
}
function qaFakeToken(id, registryHash2) {
  return `${id}:${(0, import_node_crypto3.createHash)("sha256").update(`lw-qa-fake-bot:${id}:${registryHash2}`).digest("base64url").slice(0, 32)}`;
}
function qaSections(sections, o) {
  const out = { ...sections };
  out.db = qaDbSection(sections.db ?? {}, o.database, o.root);
  const telegram2 = sections.telegram;
  if (telegram2 !== void 0) {
    const bots = {};
    for (const [name, bot] of Object.entries(telegram2.bots ?? {})) {
      const { token: token2, ...rest } = bot;
      const id = typeof rest.id === "number" ? rest.id : botId(token2);
      bots[name] = id === void 0 ? rest : { ...rest, token: qaFakeToken(id, o.registryHash) };
    }
    out.telegram = { ...telegram2, apiUrl: o.telegramUrl, bots };
  }
  out.qa = { ...sections.qa ?? {}, routes: true };
  return out;
}
function isEntry(value) {
  const v = value;
  return typeof v === "object" && v !== null && typeof v.create === "function" && typeof v.serve === "function";
}
async function loadAppEntry(root, qa) {
  const file = (0, import_node_path19.isAbsolute)(qa.app) ? qa.app : (0, import_node_path19.resolve)(root, qa.app);
  let mod;
  try {
    mod = await import((0, import_node_url3.pathToFileURL)(file).href);
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
  const tenantId = entry.tenantId ?? (await loadDb()).DEFAULT_TENANT_ID;
  return { app, tenantId, database: overlay.database, sections: qa, close: () => app.shutdown() };
}
var import_node_crypto3, import_node_path19, import_node_url3;
var init_app2 = __esm({
  "src/world/services/app.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto3 = require("crypto");
    import_node_path19 = require("path");
    import_node_url3 = require("url");
    init_kernel();
    init_peers2();
    init_checkout();
    init_stack();
  }
});

// src/world/services/ids.mts
function qaTelegramId(persona) {
  if (persona.length === 0) throw new LaunchwrightError("client.qa.persona", "qaTelegramId needs a persona id");
  let hash = 2166136261;
  for (let i = 0; i < persona.length; i += 1) {
    hash ^= persona.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return QA_TELEGRAM_ID_BASE + hash % QA_TELEGRAM_ID_SPAN;
}
function qaAccountId(persona) {
  return `${QA_PROVIDER}:${persona}`;
}
function personaIds(persona) {
  return { persona, accountId: qaAccountId(persona), telegramId: qaTelegramId(persona) };
}
var QA_TELEGRAM_ID_BASE, QA_TELEGRAM_ID_SPAN, QA_PROVIDER;
var init_ids = __esm({
  "src/world/services/ids.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    QA_TELEGRAM_ID_BASE = 9e8;
    QA_TELEGRAM_ID_SPAN = 1e6;
    QA_PROVIDER = "qa";
  }
});

// src/world/services/registry.mts
function buildRegistry(worlds) {
  const own = (w, items) => (items ?? []).map((item) => ({ ...item, feature: w.feature, file: w.file }));
  return {
    personas: worlds.flatMap((w) => own(w, w.world.personas)),
    facts: worlds.flatMap((w) => own(w, w.world.facts))
  };
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
var init_registry = __esm({
  "src/world/services/registry.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_fs();
    init_ids();
  }
});

// src/world/services/discover.mts
async function walk2(root, dir, suffix, out) {
  let entries;
  try {
    entries = await (0, import_promises8.readdir)(dir, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === "ENOENT") return;
    throw new LaunchwrightError("qa.world.walk", `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const path = (0, import_node_path20.join)(dir, entry.name);
    if (entry.isDirectory()) await walk2(root, path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push((0, import_node_path20.relative)(root, path).split(import_node_path20.sep).join("/"));
  }
}
async function filesWithSuffix(root, suffix) {
  const out = [];
  await walk2(root, root, suffix, out);
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
      mod = await import((0, import_node_url4.pathToFileURL)((0, import_node_path20.join)(root, file)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.world.file", `Cannot load world file ${file}: ${messageOf(cause)}`, { cause, context: { file } });
    }
    if (!isWorld(mod.default)) {
      throw new LaunchwrightError("qa.world.file", `${file} needs a default export defineWorld({ personas, facts }).`, { context: { file } });
    }
    out.push({ feature: (0, import_node_path20.basename)(file, WORLD_SUFFIX), file, world: mod.default });
  }
  return out;
}
async function loadRegistry(root) {
  return buildRegistry(await loadWorlds(root));
}
var import_promises8, import_node_path20, import_node_url4, WORLD_SUFFIX, SKIP;
var init_discover = __esm({
  "src/world/services/discover.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises8 = require("fs/promises");
    import_node_path20 = require("path");
    import_node_url4 = require("url");
    init_kernel();
    init_registry();
    WORLD_SUFFIX = ".world.mts";
    SKIP = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "coverage"]);
  }
});

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
var init_context = __esm({
  "src/world/services/context.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_args();
    init_config3();
    init_app2();
    init_checkout();
    init_discover();
    init_registry();
  }
});

// src/world/services/fork.mts
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
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n));
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
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n));
  try {
    await admin.drop(o.name);
    o.out(`dropped ${o.name}`);
  } finally {
    await admin.close();
  }
}
var FORK_MARK;
var init_fork = __esm({
  "src/world/services/fork.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_stack();
    FORK_MARK = "_fork_";
  }
});

// src/world/services/world.mts
async function writeJson(path, value) {
  await (0, import_promises9.mkdir)((0, import_node_path21.dirname)(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await (0, import_promises9.writeFile)(tmp, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
  await (0, import_promises9.rename)(tmp, path);
}
var import_promises9, import_node_path21;
var init_world = __esm({
  "src/world/services/world.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises9 = require("fs/promises");
    import_node_path21 = require("path");
    init_kernel();
    init_fs();
    init_peers2();
    init_app2();
    init_fork();
    init_ids();
    init_registry();
    init_stack();
  }
});

// src/world/services/api.mts
var listenQaApp;
var init_api = __esm({
  "src/world/services/api.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_peers2();
    init_app2();
    init_registry();
    init_world();
    listenQaApp = async (handler, app, port) => {
      const { serveNode } = await loadHttp();
      const { server } = serveNode(handler, port, { hostname: "127.0.0.1", app, signals: false });
      if (!server.listening) await new Promise((resolve9, reject) => {
        server.once("listening", resolve9);
        server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${port}: ${cause.message}`, { cause })));
      });
      return {
        port: server.address().port,
        close: () => new Promise((resolve9, reject) => {
          server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve9());
          server.closeAllConnections?.();
        })
      };
    };
  }
});

// src/world/services/fixture.mts
function forkUndoFile(database) {
  return `.lw/qa/fork/${database}.fixture.json`;
}
async function readUndo(root, database, file = UNDO_FILE) {
  const text2 = await readTextOrNull((0, import_node_path22.join)(root, file));
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
  return writeJson((0, import_node_path22.join)(root, file), record);
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
var import_node_path22, UNDO_FILE;
var init_fixture = __esm({
  "src/world/services/fixture.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path22 = require("path");
    init_kernel();
    init_fs();
    init_ids();
    init_registry();
    init_world();
    UNDO_FILE = ".lw/qa/fixture.json";
  }
});

// src/world/services/fork-server.mts
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
        await (0, import_promises10.rm)((0, import_node_path23.join)(o.root, undoFile), { force: true });
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
  const fork = { root: o.root, sections: o.sections, database: o.overlay.database, out: o.out };
  return {
    create: (label) => createFork({ ...fork, label }),
    drop: (name) => dropFork({ ...fork, name }),
    serve: (database) => serveFork(o, database)
  };
}
var import_promises10, import_node_path23;
var init_fork_server = __esm({
  "src/world/services/fork-server.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises10 = require("fs/promises");
    import_node_path23 = require("path");
    init_peers2();
    init_api();
    init_app2();
    init_fixture();
    init_fork();
  }
});

// src/commands/qa-states.mts
function flag(args, name) {
  return args.values[name] ?? null;
}
function list(value) {
  return value === null ? void 0 : value.split(",").map((s) => s.trim()).filter(Boolean);
}
function writeJson2(path, value) {
  (0, import_node_fs13.mkdirSync)((0, import_node_path24.dirname)(path), { recursive: true });
  (0, import_node_fs13.writeFileSync)(path, `${JSON.stringify(value, null, 2)}
`);
}
function runFiles(cwd, slug) {
  return { plan: (0, import_node_path24.join)(cwd, ".lw/qa/states", `${slug}.plan.json`), results: (0, import_node_path24.join)(cwd, ".lw/qa/states", `${slug}.results.jsonl`) };
}
function narrowOf(args) {
  const files = list(flag(args, "files"));
  const dirs = list(flag(args, "dirs"));
  if (!files && !dirs) return void 0;
  return { ...files ? { files } : {}, ...dirs ? { dirs } : {}, label: [...files ?? [], ...dirs ?? []].join(", ") };
}
function freshInventory(cwd, config, generated) {
  const { inventory } = scanStates(cwd, config, generated);
  const deliveryPath = (0, import_node_path24.join)(cwd, DELIVERY_FILE);
  if (!(0, import_node_fs13.existsSync)(deliveryPath)) return inventory;
  let delivery;
  try {
    delivery = JSON.parse((0, import_node_fs13.readFileSync)(deliveryPath, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.states.delivery", `${DELIVERY_FILE} is not JSON`, { cause, context: { path: deliveryPath } });
  }
  return mergeDelivery(inventory, delivery);
}
function scan(args, opts, config, generated) {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  writeJson2((0, import_node_path24.join)(opts.cwd, STATES_FILE), { ...result.inventory, tables: result.map.tables, problems: result.problems });
  if (args.switches.has("json")) {
    opts.out(JSON.stringify(result.inventory, null, 2));
  } else {
    const states = result.inventory.unions.reduce((n, u) => n + u.members.length, 0);
    const kinds = /* @__PURE__ */ new Map();
    for (const u of result.inventory.unions) kinds.set(u.kind, (kinds.get(u.kind) ?? 0) + 1);
    const tally = [...kinds].sort().map(([k, n]) => `${n} ${k}`).join(", ");
    opts.out(`${result.inventory.unions.length} unions, ${states} states (${tally || "none"}), ${result.inventory.ignored.length} ignored -> ${STATES_FILE}`);
    for (const line of renderRouteSummary(result.map).split("\n")) opts.out(line);
    for (const g of result.inventory.ignored) opts.out(`ignored ${g.name} (${g.file}:${g.line}): ${g.reason}`);
  }
  for (const p of result.problems.filter((p2) => p2.code === "invalid-shape")) opts.err(`warning ${p.file}:${p.line}: ${p.message}`);
  for (const f of findings) opts.err(`${f.rule} ${f.message}`);
  for (const line of renderNeither(result.inventory)) opts.err(line);
  return findings.length > 0 ? 1 : 0;
}
function plan(args, opts, config, generated) {
  const narrow = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: "lw qa states scan", slug: DEFAULT_SLUG, generated, ...narrow ? { narrow } : {} });
  if (args.switches.has("json")) opts.out(JSON.stringify(built, null, 2));
  else for (const line of renderPlan(built)) opts.out(line);
  for (const line of renderNeither(built.inventory)) opts.err(line);
  return built.inventory.unions.some((u) => u.kind === "neither") ? 1 : 0;
}
async function infer(args, opts, config, generated, app, overrides) {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  const names = new Set(result.inventory.unions.map((u) => u.name));
  const unreachable2 = new Set(findings.map((f) => f.union).filter((name) => names.has(name)));
  const proposals = inferSeeds(result.inventory, unreachable2);
  if (args.switches.has("apply")) return await applyForged(args, opts, config, proposals, app, overrides);
  if (args.switches.has("json")) {
    opts.out(JSON.stringify(proposals, null, 2));
    return 0;
  }
  if (proposals.length === 0) {
    opts.out("no declared state needs a forged seed: every state has a seed or a route.");
    return 0;
  }
  opts.out(`${proposals.length} state(s) no seed and no route reaches. Each one earns a forged seed:`);
  opts.out("A seed runs through the app services where they exist. A direct row write is the last resort, and records provenance forged.");
  for (const p of proposals) {
    opts.out(`  ${p.union} (${p.file}): members ${p.members.join(", ")}.`);
    opts.out(`    seed via ${p.via}, provenance ${p.provenance}: ${p.reason}.`);
    if (p.fields.length > 0) opts.out(`    fields: ${p.fields.map((f) => `${f.interface}.${f.field}`).join(", ")}.`);
  }
  return 0;
}
async function forger(args, opts, config, app, overrides) {
  const slug = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const deps = runDeps(config, app, overrides, opts.targets);
  const world = await worldContext({ cwd: opts.cwd, out: opts.out, err: opts.err, ...opts.config ? { config: opts.config } : {}, ...opts.env ? { env: opts.env } : {} });
  const entry = await loadAppEntry(world.root, world.qa);
  const forkOptions = { root: world.root, sections: world.sections, env: world.env, overlay: world.overlay, entry, registry: world.registry, out: opts.out, ...overrides.listen ? { listen: overrides.listen } : {} };
  const context = {
    root: opts.cwd,
    reportDir: (0, import_node_path24.resolve)(opts.cwd, config.reportDir),
    slug,
    leg,
    target: deps.targets.get(leg.target),
    baseUrls: config.baseUrls,
    apiPort: config.apiPort,
    clock: deps.clock,
    revision: deps.revision(opts.cwd)
  };
  return async (seed) => {
    const fork = await openFork(forkOptions, `forge-${seed.state}`);
    try {
      return await forgeState(seed, fork, context);
    } finally {
      await fork.release();
    }
  };
}
function forgedLine(r) {
  return r.ok ? `forged    ${r.id}: ${r.subject ?? ""}` : `failed    ${r.id}: ${r.error ?? "no reason given"}`;
}
async function applyForged(args, opts, config, proposals, app, overrides) {
  if (proposals.length === 0) {
    opts.out("no declared state needs a forged seed: every state has a seed or a route.");
    return 0;
  }
  const ready = [];
  let waiting = 0;
  for (const proposal of proposals) {
    for (const member of proposal.members) {
      const state = `${proposal.union}.${member}`;
      if (writeDraft(opts.cwd, proposal, member)) {
        opts.out(`draft     ${state}: wrote ${seedFile(state)}. Review it, then set accepted to true.`);
        waiting += 1;
        continue;
      }
      const seed = acceptedSeed(readSeed((0, import_node_path24.join)(opts.cwd, seedFile(state))));
      if (typeof seed === "string") {
        opts.out(`waiting   ${state}: ${seed} (${seedFile(state)})`);
        waiting += 1;
      } else ready.push(seed);
    }
  }
  if (ready.length === 0) {
    opts.out(`forged nothing: ${waiting} state(s) wait for a reviewer to accept their seed.`);
    return 0;
  }
  const forgeOne = await forger(args, opts, config, app, overrides);
  let failed = 0;
  for (const seed of ready) {
    try {
      const result = await forgeOne(seed);
      if (!result.ok) failed += 1;
      opts.out(forgedLine(result));
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      failed += 1;
      opts.err(`failed    ${seed.state}: ${cause.code}: ${cause.message}`);
    }
  }
  const slug = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  opts.out(`forged ${ready.length - failed} of ${ready.length} accepted seed(s), ${waiting} waiting -> ${(0, import_node_path24.relative)(opts.cwd, reportPaths((0, import_node_path24.resolve)(opts.cwd, config.reportDir), slug).ledger)}`);
  opts.out(FORGE_NOTE);
  return failed > 0 ? 1 : 0;
}
async function forge(args, opts, config, app, overrides) {
  const [state, extra] = args.positionals;
  if (state === void 0 || extra !== void 0) throw new UsageError("forge needs one state id <union>.<member>");
  const rel = flag(args, "seed") ?? seedFile(state);
  const path = (0, import_node_path24.resolve)(opts.cwd, rel);
  if (!(0, import_node_fs13.existsSync)(path)) throw new LaunchwrightError("qa.forge.seed", `${rel} does not exist. Run lw qa states infer --apply to write its draft.`, { context: { state } });
  const seed = readSeed(path);
  if (seed.state !== state) throw new LaunchwrightError("qa.forge.seed", `${rel} is the seed of ${seed.state}, not ${state}.`, { context: { state } });
  const accepted = acceptedSeed(seed);
  if (typeof accepted === "string") {
    opts.err(`${state} is not forged: ${accepted} (${rel})`);
    return 1;
  }
  const result = await (await forger(args, opts, config, app, overrides))(accepted);
  opts.out(forgedLine(result));
  opts.out(FORGE_NOTE);
  return result.ok ? 0 : 1;
}
async function run(args, opts, config, deps) {
  const slug = flag(args, "slug") ?? DEFAULT_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const base = flag(args, "base") ?? config.baseUrls[leg.surface];
  if (!base) {
    throw new LaunchwrightError("qa.states.usage", `run needs --base <url> or qa.baseUrls.${leg.surface}: the origin of the client dev server that serves /__states`);
  }
  const generated = deps.clock.date().toISOString();
  const narrow = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: "lw qa states scan", slug, generated, ...narrow ? { narrow } : {} });
  for (const line of renderPlan(built)) opts.out(line);
  const reportDir = (0, import_node_path24.resolve)(opts.cwd, config.reportDir);
  const files = runFiles(opts.cwd, slug);
  const notRun = {};
  const target = deps.targets.get(leg.target);
  const ready = await target.ready(leg);
  const { groups, blocked } = groupsFor(built.inventory, built.captures, leg.name);
  const attempts = [];
  const revision = deps.revision(opts.cwd);
  const now = () => deps.clock.now();
  if (!ready.ready) {
    const why = `the target ${leg.target} of leg ${leg.name} is not ready: ${ready.reason ?? "no reason given"}`;
    notRun.mount = why;
    notRun.solve = why;
  } else {
    let session = null;
    try {
      session = await target.open({ leg, baseUrl: base, outDir: (0, import_node_path24.join)(reportPaths(reportDir, slug).assets, "states") });
      const mounted = ledgerRecorder({ reportDir, slug, leg, provenance: "mounted", clock: deps.clock, revision });
      for (const capture of built.captures.filter((c) => c.mechanism === "mount")) {
        attempts.push(await captureMounted(session, resolveMount(built.inventory, capture, leg.name), { reportDir, slug, record: mounted.record, now }));
      }
      await mounted.flush();
      if (groups.length > 0) {
        const page = session.routable?.();
        if (!page) notRun.solve = `the target ${leg.target} gives no routable page, so no response can be intercepted`;
        else {
          const intercepted = ledgerRecorder({ reportDir, slug, leg, provenance: "intercepted", clock: deps.clock, revision });
          for (const group of groups) {
            const { results, notes } = await captureGroup(session, page, group, { projectRoot: opts.cwd, reportDir, slug, record: intercepted.record, now });
            for (const note of notes) opts.out(`${group.union}: ${note}`);
            attempts.push(...results);
          }
          await intercepted.flush();
        }
      }
    } finally {
      await session?.close();
    }
  }
  writeJson2(files.plan, { ...built, notRun, blocked });
  (0, import_node_fs13.mkdirSync)((0, import_node_path24.dirname)(files.results), { recursive: true });
  (0, import_node_fs13.writeFileSync)(files.results, attempts.map((a) => `${JSON.stringify(a)}
`).join(""));
  opts.out("");
  opts.out(`plan       ${files.plan}`);
  opts.out(`results    ${files.results}`);
  const finished = finishRun({ plan: built, attempts, notRun, blocked });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}
function report(args, opts) {
  const slug = flag(args, "slug") ?? DEFAULT_SLUG;
  const files = runFiles(opts.cwd, slug);
  if (!(0, import_node_fs13.existsSync)(files.plan)) throw new LaunchwrightError("qa.states.no-run", `No state run of slug ${slug}: ${files.plan} does not exist. Run "lw qa states run" first.`);
  const saved = JSON.parse((0, import_node_fs13.readFileSync)(files.plan, "utf8"));
  const inventory = parseInventory(JSON.stringify(saved.inventory), files.plan);
  const { attempts, malformed } = parseResults((0, import_node_fs13.existsSync)(files.results) ? (0, import_node_fs13.readFileSync)(files.results, "utf8") : "");
  const finished = finishRun({ plan: { ...saved, inventory }, attempts, malformed, notRun: saved.notRun ?? {}, blocked: saved.blocked ?? {} });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}
function createStatesCommand(overrides = {}) {
  return {
    name: "states",
    summary: "Scan the state unions, plan, capture mounted, intercepted and forged states, report coverage",
    async run(args, opts) {
      const [action, ...rest] = args;
      if (!action || !["scan", "plan", "infer", "forge", "run", "report"].includes(action)) {
        for (const line of USAGE) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const cwd = (0, import_node_path24.isAbsolute)(opts.cwd) ? opts.cwd : (0, import_node_path24.resolve)(opts.cwd);
      const inner = { ...opts, cwd };
      try {
        const flags = parseCommandArgs(FLAGS[action], rest);
        const app = opts.app;
        if (action === "run") return await run(flags, inner, config, runDeps(config, app, overrides, opts.targets));
        if (action === "report") return report(flags, inner);
        const generated = runClock(app, overrides).date().toISOString();
        if (action === "scan") return scan(flags, inner, config, generated);
        if (action === "infer") return await infer(flags, inner, config, generated, app, overrides);
        if (action === "forge") return await forge(flags, inner, config, app, overrides);
        return plan(flags, inner, config, generated);
      } catch (cause) {
        if (!isCodedError(cause)) throw cause;
        opts.err(`lw qa states ${action}: ${cause.code}: ${cause.message}`);
        return cause instanceof UsageError || cause.code === "qa.states.usage" ? 2 : 1;
      }
    }
  };
}
var import_node_fs13, import_node_path24, USAGE, DEFAULT_SLUG, DEFAULT_FORGE_SLUG, DEFAULT_LEG, DELIVERY_FILE, FLAGS, qa_states_default;
var init_qa_states = __esm({
  "src/commands/qa-states.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs13 = require("fs");
    import_node_path24 = require("path");
    init_kernel();
    init_args();
    init_config3();
    init_ledger();
    init_capture();
    init_check();
    init_delivery();
    init_forge();
    init_forge_seed();
    init_inventory();
    init_loop();
    init_mount();
    init_project2();
    init_run();
    init_app2();
    init_context();
    init_fork_server();
    USAGE = [
      "usage: lw qa states <scan|plan|infer|forge|run|report> [options]",
      "  scan   [--json]                       read the client roots, derive each route, write .lw/qa/states.json.",
      "                                        Exit 1 on a union no trigger reaches (rules C1, C4) or a bad ignore tag",
      "  plan   [--json] [--files a,b] [--dirs d,e]   print every planned capture. Exit 1 on a neither union",
      "  infer  [--json] [--apply] [--slug <slug>] [--leg <name>]   propose a forged seed for each state no seed and no",
      "                                        route reaches. --apply writes a draft seed under .lw/qa/forge/ for each one,",
      "                                        and forges each accepted seed (spec 2.5)",
      "  forge  <union>.<member> [--seed <file>] [--slug <slug>] [--leg <name>]   run one accepted seed on a fork of the QA",
      "                                        database, photograph its route, and record it with provenance forged",
      "  run    [--base <url>] [--leg <name>] [--slug <slug>] [--files a,b] [--dirs d,e]   (--base defaults to qa.baseUrls of the leg surface)",
      "                                        mount each input member at /__states and intercept each output member.",
      "                                        Images go to <reportDir>/assets/<slug>/states/ and into the ledger",
      "  report [--slug <slug>]                the coverage matrix of the last run of the slug",
      "A delivery descriptor file .lw/qa/delivery.json (union name to { route, intercept, settle }) feeds intercepted capture."
    ];
    DEFAULT_SLUG = "states";
    DEFAULT_FORGE_SLUG = "forged";
    DEFAULT_LEG = "desktop";
    DELIVERY_FILE = ".lw/qa/delivery.json";
    FLAGS = {
      scan: { values: [], switches: ["json"] },
      plan: { values: ["files", "dirs"], switches: ["json"] },
      infer: { values: ["slug", "leg"], switches: ["json", "apply"] },
      forge: { values: ["seed", "slug", "leg"], switches: [] },
      run: { values: ["base", "leg", "slug", "files", "dirs"], switches: [] },
      report: { values: ["slug"], switches: [] }
    };
    qa_states_default = createStatesCommand();
  }
});

// src/world/services/clock.mts
var ShiftClock;
var init_clock2 = __esm({
  "src/world/services/clock.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    ShiftClock = class {
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
  }
});

// src/provider.mts
var qaProvider;
var init_provider2 = __esm({
  "src/provider.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_config3();
    init_targets();
    init_tokens2();
    init_clock2();
    qaProvider = provider({
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
  }
});

// src/services/mime.mts
function extensionOf(mime) {
  return EXTENSIONS[mime] ?? "bin";
}
function mimeOfExtension(name) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === void 0) return null;
  if (ext === "jpeg") return "image/jpeg";
  return Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] ?? null;
}
var EXTENSIONS;
var init_mime = __esm({
  "src/services/mime.mts"() {
    "use strict";
    init_cjs_shims();
    EXTENSIONS = {
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
  }
});

// src/services/records.mts
function recordId(...parts) {
  return parts.map((p) => String(p).replace(/^@/, "").replace(/[^A-Za-z0-9_.-]+/g, "-")).join("-");
}
function recordDir(root, id) {
  if (!ID.test(id) || id.includes("..")) throw new LaunchwrightError("qa.intake.id", `The intake id "${id}" has a character outside A-Z, a-z, 0-9, _, . and -.`, { context: { id } });
  return (0, import_node_path25.join)(root, INTAKE_DIR, id);
}
function fileName(index, m) {
  const ext = extensionOf(m.mime);
  const stem = (m.name ?? m.kind).replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40) || m.kind;
  return `${String(index).padStart(2, "0")}-${stem}.${ext}`;
}
function quote(text2) {
  return text2 === "" ? "> (no text)" : text2.split("\n").map((l) => `> ${l}`).join("\n");
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
  await (0, import_promises11.rm)(dir, { recursive: true, force: true });
  await (0, import_promises11.mkdir)((0, import_node_path25.join)(dir, "assets"), { recursive: true });
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
    await (0, import_promises11.writeFile)((0, import_node_path25.join)(dir, path), m.data);
    issue.attachments.push({
      kind: m.kind,
      path,
      sha256: sha256(m.data),
      bytes: m.data.byteLength,
      mime: m.mime,
      from: m.from
    });
  }
  await (0, import_promises11.writeFile)((0, import_node_path25.join)(dir, "issue.json"), `${JSON.stringify(issue, null, 2)}
`);
  await (0, import_promises11.writeFile)((0, import_node_path25.join)(dir, "issue.md"), issueMarkdown(issue));
  return issue;
}
async function readIssue(root, id) {
  const file = (0, import_node_path25.join)(recordDir(root, id), "issue.json");
  let text2;
  try {
    text2 = await (0, import_promises11.readFile)(file, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.intake.missing", `No intake record ${id}. Run lw qa intake list.`, { cause, context: { id } });
  }
  return JSON.parse(text2);
}
async function listIssues(root) {
  const base = (0, import_node_path25.join)(root, INTAKE_DIR);
  let names;
  try {
    names = (await (0, import_promises11.readdir)(base, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.intake.read", `Cannot read ${INTAKE_DIR}.`, { cause });
  }
  const out = [];
  for (const name of names.sort()) {
    let text2;
    try {
      text2 = await (0, import_promises11.readFile)((0, import_node_path25.join)(base, name, "issue.json"), "utf8");
    } catch (cause) {
      if (cause.code === "ENOENT") continue;
      throw new LaunchwrightError("qa.intake.read", `Cannot read the intake record ${name}.`, { cause });
    }
    out.push(JSON.parse(text2));
  }
  return out;
}
var import_promises11, import_node_path25, ID;
var init_records = __esm({
  "src/services/records.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises11 = require("fs/promises");
    import_node_path25 = require("path");
    init_kernel();
    init_fs();
    init_mime();
    init_types();
    ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
  }
});

// src/services/contract.mts
var import_promises12, import_node_path26;
var init_contract3 = __esm({
  "src/services/contract.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises12 = require("fs/promises");
    import_node_path26 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/botfather.mts
var init_botfather = __esm({
  "src/services/botfather.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
  }
});

// src/services/bot-store.mts
var import_promises13, import_node_path27;
var init_bot_store = __esm({
  "src/services/bot-store.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises13 = require("fs/promises");
    import_node_path27 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/comments.mts
var import_node_crypto4, import_promises14, import_node_path28;
var init_comments = __esm({
  "src/services/comments.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto4 = require("crypto");
    import_promises14 = require("fs/promises");
    import_node_path28 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/comment-export.mts
var import_promises15, import_node_path29;
var init_comment_export = __esm({
  "src/services/comment-export.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises15 = require("fs/promises");
    import_node_path29 = require("path");
    init_kernel();
    init_manifest2();
    init_png();
  }
});

// src/services/comment-server.mts
var import_node_http, import_promises16, import_node_path30, MAX_BODY;
var init_comment_server = __esm({
  "src/services/comment-server.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_http = require("http");
    import_promises16 = require("fs/promises");
    import_node_path30 = require("path");
    init_kernel();
    init_comments();
    init_mime();
    MAX_BODY = 1024 * 1024;
  }
});

// src/services/score.mts
var init_score = __esm({
  "src/services/score.mts"() {
    "use strict";
    init_cjs_shims();
  }
});

// src/index.mts
var init_src = __esm({
  "src/index.mts"() {
    "use strict";
    init_cjs_shims();
    init_extensions();
    init_qa_command();
    init_qa_states();
    init_config3();
    init_contract2();
    init_playwright();
    init_errors();
    init_provider2();
    init_mime();
    init_png();
    init_records();
    init_contract3();
    init_botfather();
    init_bot_store();
    init_comments();
    init_comment_export();
    init_comment_server();
    init_score();
    init_targets();
    init_types();
    init_video();
    init_tokens2();
  }
});

// src/intake/services/media.mts
function kindOf(mime, voice = false) {
  if (voice) return "voice";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
function ascii(data, from, to) {
  return String.fromCharCode(...data.subarray(from, to));
}
function sniffMime(data) {
  if (data.length >= 8 && data[0] === 137 && ascii(data, 1, 4) === "PNG") return "image/png";
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (ascii(data, 0, 4) === "GIF8") return "image/gif";
  if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 12) === "WEBP") return "image/webp";
  if (ascii(data, 4, 8) === "ftyp") return ascii(data, 8, 10) === "qt" ? "video/quicktime" : "video/mp4";
  if (data.length >= 4 && data[0] === 26 && data[1] === 69 && data[2] === 223 && data[3] === 163) return "video/webm";
  if (ascii(data, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(data, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}
function mimeOf(header, data, name) {
  const declared = (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared !== "" && declared !== "application/octet-stream" && declared !== "binary/octet-stream") return declared;
  return sniffMime(data) ?? (name ? mimeOfExtension(name) : null) ?? "application/octet-stream";
}
function sourceOf(url) {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}
async function readCapped(res, maxBytes) {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}
async function download(url, opts) {
  let at;
  try {
    at = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("qa.intake.url", "An intake media link is not a URL.", { cause });
  }
  const max = opts.maxRedirects ?? 5;
  for (let hop = 0; hop <= max; hop++) {
    if (at.protocol !== "https:" && at.protocol !== "http:") return { skipped: "unsupported" };
    if (opts.allow && !opts.allow(at)) return { skipped: "unsupported" };
    let res;
    try {
      res = await opts.fetch(at.href, { method: "GET", redirect: "manual", headers: opts.headersFor?.(at) ?? {} });
    } catch (cause) {
      if (cause instanceof TypeError) return { skipped: "unreachable" };
      throw cause;
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) return { skipped: "unreachable" };
      at = new URL(location, at);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      return { skipped: "unreachable" };
    }
    const length = Number(res.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(length) && length > opts.maxBytes) {
      await res.body?.cancel();
      return { skipped: "too-large" };
    }
    const data = await readCapped(res, opts.maxBytes);
    if (data === null) return { skipped: "too-large" };
    const mime = mimeOf(res.headers.get("content-type"), data, opts.name ?? at.pathname);
    if (mime === "text/html") return { skipped: "unreachable" };
    return { data, mime };
  }
  return { skipped: "unreachable" };
}
var init_media = __esm({
  "src/intake/services/media.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_src();
  }
});

// src/intake/services/gh.mts
function ghRunner(opts = {}) {
  const bin = opts.bin ?? "gh";
  const timeoutMs = opts.timeoutMs ?? GH_TIMEOUT_MS;
  return (args) => new Promise((resolve9, reject) => {
    const child = (0, import_node_child_process3.spawn)(bin, args, { stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs, killSignal: "SIGKILL" });
    const out = [];
    const err = [];
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => err.push(b));
    child.on("error", (cause) => {
      reject(new LaunchwrightError("qa.intake.github.gh", "Cannot start gh. Install the GitHub CLI and run gh auth login.", { cause }));
    });
    child.on("close", (code, signal) => {
      if (code === null && signal === "SIGKILL") {
        const command = args.slice(0, 2).join(" ");
        reject(new LaunchwrightError("qa.intake.github.timeout", `gh ${command} ran past ${timeoutMs} ms and was stopped.`, { context: { command, timeoutMs } }));
        return;
      }
      resolve9({ code: code ?? 1, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") });
    });
  });
}
var import_node_child_process3, GH_TIMEOUT_MS, spawnGh;
var init_gh = __esm({
  "src/intake/services/gh.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process3 = require("child_process");
    init_kernel();
    GH_TIMEOUT_MS = 6e4;
    spawnGh = ghRunner();
  }
});

// src/intake/drivers/intake/github.mts
var github_exports = {};
__export(github_exports, {
  GithubIntakeDriver: () => GithubIntakeDriver,
  ISSUE_FIELDS: () => ISSUE_FIELDS,
  parseIssueUrl: () => parseIssueUrl
});
function parseIssueUrl(ref) {
  const url = URL.canParse(ref) ? new URL(ref) : null;
  const m = url?.hostname === "github.com" ? /^\/([\w.-]+)\/([\w.-]+)\/(issues|pull|pulls)\/(\d+)\/?$/.exec(url.pathname) : null;
  if (!m) {
    throw new LaunchwrightError("qa.intake.github.ref", "The ref is not a GitHub issue URL: https://github.com/<owner>/<repo>/issues/<n>.", { context: { ref } });
  }
  if (m[3] !== "issues") {
    throw new LaunchwrightError("qa.intake.github.not-issue", "The URL is a pull request. lw qa intake github reads issues only.", { context: { ref } });
  }
  return { owner: m[1], repo: m[2], number: Number(m[4]) };
}
function viewFailure(stderr, ref) {
  const reason = stderr.trim().split("\n")[0]?.slice(0, 300) ?? "";
  if (/pull request/i.test(reason)) {
    return new LaunchwrightError("qa.intake.github.not-issue", "The number is a pull request. lw qa intake github reads issues only.", { context: { ref } });
  }
  if (/gh auth login|authentication|not logged/i.test(reason)) {
    return new LaunchwrightError("qa.intake.github.auth", "gh has no login. Run gh auth login.", { context: { ref, reason } });
  }
  if (/could not resolve|not found|HTTP 40[134]|not accessible|permission/i.test(reason)) {
    return new LaunchwrightError("qa.intake.github.access", "The gh login cannot read this issue or its repository.", { context: { ref, reason } });
  }
  return new LaunchwrightError("qa.intake.github.gh", "gh issue view failed.", { context: { ref, reason } });
}
var ISSUE_FIELDS, GithubIntakeDriver;
var init_github = __esm({
  "src/intake/drivers/intake/github.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_src();
    init_gh();
    init_links();
    init_media();
    init_contract();
    ISSUE_FIELDS = "number,title,body,author,labels,comments,createdAt,url,state";
    GithubIntakeDriver = class extends BaseDriver {
      constructor(opts) {
        super("github", QA_INTAKE_SPEC_VERSION, []);
        this.opts = opts;
        this.gh = opts.gh ?? spawnGh;
        this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
      }
      opts;
      source = "github";
      gh;
      fetchFn;
      async fetch(ref) {
        parseIssueUrl(ref);
        const view = await this.gh(["issue", "view", ref, "--json", ISSUE_FIELDS]);
        if (view.code !== 0) throw viewFailure(view.stderr, ref);
        let issue;
        try {
          issue = JSON.parse(view.stdout);
        } catch (cause) {
          throw new LaunchwrightError("qa.intake.github.gh", "gh issue view did not print JSON.", { cause, context: { ref } });
        }
        if (issue.url.includes("/pull/")) {
          throw new LaunchwrightError("qa.intake.github.not-issue", "The number is a pull request. lw qa intake github reads issues only.", { context: { ref } });
        }
        const posts = [
          { id: "body", author: issue.author, text: issue.body ?? "", at: issue.createdAt },
          ...(issue.comments ?? []).map((c, i) => ({ id: c.id ?? `comment-${i + 1}`, author: c.author, text: c.body ?? "", at: c.createdAt }))
        ];
        const needsToken = posts.some((p) => mediaLinks(p.text).length > 0);
        const token2 = needsToken ? await this.token() : null;
        const items = [];
        for (const p of posts) {
          const media = [];
          for (const link of mediaLinks(p.text)) media.push(await this.media(link, token2));
          items.push({ id: p.id, at: new Date(p.at).toISOString(), author: p.author?.login ?? "ghost", text: p.text, media });
        }
        return { source: "github", ref: issue.url, title: issue.title, items };
      }
      /** The token of the `gh` login, read from the child's stdout. */
      async token() {
        const res = await this.gh(["auth", "token"]);
        const token2 = res.stdout.trim();
        if (res.code !== 0 || token2 === "") {
          throw new LaunchwrightError("qa.intake.github.auth", "gh auth token gave no token. Run gh auth login.");
        }
        return token2;
      }
      async media(link, token2) {
        const name = new URL(link).pathname.split("/").pop() ?? "";
        const got = await download(link, {
          fetch: this.fetchFn,
          maxBytes: this.opts.maxBytes,
          name,
          allow: isGithubMediaHost,
          headersFor: (url) => token2 !== null && takesGithubToken(url) ? { authorization: `Bearer ${token2}` } : {}
        });
        const from = sourceOf(link);
        if ("skipped" in got) {
          const mime = mimeOfExtension(name) ?? "application/octet-stream";
          return { from, kind: kindOf(mime), mime, ...name ? { name } : {}, skipped: got.skipped };
        }
        return { from, kind: kindOf(got.mime), mime: got.mime, ...name ? { name } : {}, data: got.data };
      }
    };
  }
});

// src/telegram/mtproto.mts
async function loadGramJs(importer = (name) => import(name)) {
  const main = "telegram";
  const sessions = "telegram/sessions";
  try {
    const lib = await importer(main);
    const sess = await importer(sessions);
    return { TelegramClient: lib.TelegramClient, StringSession: sess.StringSession };
  } catch (cause) {
    throw new LaunchwrightError("telegram.mtproto.missing", 'The MTProto user client needs GramJS: add the npm package "telegram" (2.26 or later) to the project.', { cause });
  }
}
function socksProxy(url) {
  let u;
  try {
    u = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("telegram.mtproto.proxy", "The proxy is not a URL. Write socks5://[user:password@]host:port.", { cause });
  }
  const port = Number(u.port);
  if (u.protocol !== "socks5:" || u.hostname === "" || !Number.isInteger(port) || port <= 0) {
    throw new LaunchwrightError("telegram.mtproto.proxy", "The proxy must be socks5://[user:password@]host:port.");
  }
  return {
    ip: u.hostname,
    port,
    socksType: 5,
    ...u.username ? { username: decodeURIComponent(u.username) } : {},
    ...u.password ? { password: decodeURIComponent(u.password) } : {}
  };
}
var UserClient;
var init_mtproto = __esm({
  "src/telegram/mtproto.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    UserClient = class _UserClient {
      constructor(raw) {
        this.raw = raw;
      }
      raw;
      /** Connects with a saved session. Sign-in (phone code, 2FA) is a step outside this wrapper. */
      static async connect(opts) {
        if (!Number.isInteger(opts.apiId) || opts.apiId <= 0 || opts.apiHash === "") {
          throw new LaunchwrightError("telegram.mtproto.config", "The user client needs apiId and apiHash from my.telegram.org.", { context: { key: "apiId" } });
        }
        const proxy = opts.proxy === void 0 ? void 0 : socksProxy(opts.proxy);
        const gram = await (opts.loader ?? loadGramJs)();
        const client = new gram.TelegramClient(new gram.StringSession(opts.session), opts.apiId, opts.apiHash, {
          connectionRetries: opts.connectionRetries ?? 5,
          ...proxy ? { proxy } : {}
        });
        try {
          await client.connect();
        } catch (cause) {
          throw new LaunchwrightError("telegram.mtproto.connect", "The MTProto user client cannot connect.", { cause });
        }
        return new _UserClient(client);
      }
      sendMessage(peer, text2) {
        return this.raw.sendMessage(peer, { message: text2 });
      }
      /** Reads messages of a chat. `reverse: true` gives the oldest first, from `minId` or `offsetDate` on. */
      async history(peer, opts = {}) {
        return [...await this.raw.getMessages(peer, { ...opts })];
      }
      /** Reads the messages with these ids. A missing message is absent from the result. */
      async messages(peer, ids) {
        const found = await this.raw.getMessages(peer, { ids });
        return [...found].filter((m) => m !== void 0 && m !== null);
      }
      /** Downloads the media of a message into memory. Throws `telegram.mtproto.download`. */
      async downloadMedia(message) {
        let data;
        try {
          data = await this.raw.downloadMedia(message, {});
        } catch (cause) {
          throw new LaunchwrightError("telegram.mtproto.download", "The MTProto user client cannot download the media of a message.", { cause });
        }
        if (!(data instanceof Uint8Array)) {
          throw new LaunchwrightError("telegram.mtproto.download", "The message has no media to download.", { context: { result: typeof data } });
        }
        return data;
      }
      async close() {
        await this.raw.disconnect();
      }
    };
  }
});

// src/intake/drivers/intake/telegram-mtproto.mts
var telegram_mtproto_exports = {};
__export(telegram_mtproto_exports, {
  GRAMJS_READ_METHODS: () => GRAMJS_READ_METHODS,
  READ_METHODS: () => READ_METHODS,
  ReadOnlyTelegram: () => ReadOnlyTelegram,
  TelegramMtprotoIntakeDriver: () => TelegramMtprotoIntakeDriver,
  guardGramJsClient: () => guardGramJsClient,
  readOnlyGramJs: () => readOnlyGramJs,
  telegramMtprotoConfig: () => telegramMtprotoConfig
});
function methodError(method) {
  return new LaunchwrightError("qa.intake.telegram.method", `Telegram intake is read-only: the method ${method} is not on the allowlist (history, messages, download).`, {
    context: { method }
  });
}
function guardGramJsClient(raw) {
  return new Proxy(raw, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      const name = String(prop);
      if (GRAMJS_READ_METHODS.has(name)) return value.bind(target);
      return () => {
        throw methodError(name);
      };
    }
  });
}
function readOnlyGramJs(mod) {
  const Base = mod.TelegramClient;
  const Guarded = function(...args) {
    return guardGramJsClient(new Base(...args));
  };
  return { TelegramClient: Guarded, StringSession: mod.StringSession };
}
function authorOf(m) {
  if (m.postAuthor) return m.postAuthor;
  const s = m.sender;
  const name = [s?.firstName, s?.lastName].filter((p) => p !== void 0 && p !== "").join(" ");
  if (name !== "") return name;
  if (s?.title) return s.title;
  if (s?.username) return `@${s.username}`;
  return m.senderId !== void 0 && m.senderId !== null ? `user ${m.senderId.toString()}` : "unknown";
}
function peerOf(chat) {
  return /^-?\d+$/.test(chat) ? Number(chat) : chat;
}
function idOf(bound) {
  if (bound === void 0 || bound instanceof Date) return 0;
  const n = Number(bound);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
var telegramMtprotoConfig, GRAMJS_READ_METHODS, READ_METHODS, PAGE, ReadOnlyTelegram, TelegramMtprotoIntakeDriver;
var init_telegram_mtproto = __esm({
  "src/intake/drivers/intake/telegram-mtproto.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_media();
    init_mtproto();
    init_contract();
    telegramMtprotoConfig = import_zod6.z.object({
      apiId: import_zod6.z.coerce.number().int().positive(),
      apiHash: import_zod6.z.string().min(1),
      session: import_zod6.z.string().min(1),
      /** `socks5://[user:password@]host:port`: the exit the account always uses (`QA_TELEGRAM_PROXY`). */
      proxy: import_zod6.z.string().min(1).optional()
    });
    GRAMJS_READ_METHODS = /* @__PURE__ */ new Set(["connect", "disconnect", "getMessages", "downloadMedia"]);
    READ_METHODS = ["history", "messages", "downloadMedia"];
    PAGE = 100;
    ReadOnlyTelegram = class {
      constructor(client) {
        this.client = client;
      }
      client;
      call(method, ...args) {
        if (!READ_METHODS.includes(method)) throw methodError(method);
        const fn = this.client[method];
        return fn.apply(this.client, args);
      }
      close() {
        return this.client.close();
      }
    };
    TelegramMtprotoIntakeDriver = class extends BaseDriver {
      constructor(cfg, opts) {
        super("telegram-mtproto", QA_INTAKE_SPEC_VERSION, ["window", "cursor"]);
        this.opts = opts;
        const parsed = telegramMtprotoConfig.safeParse(cfg);
        if (!parsed.success) {
          const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].map((k) => `qa.intake.drivers.telegram-mtproto.${k}`);
          throw new LaunchwrightError("qa.intake.telegram.config", `Set ${keys.join(", ")} from the secrets store (QA_TELEGRAM_API_ID, QA_TELEGRAM_API_HASH, QA_TELEGRAM_SESSION).`, {
            context: { keys }
          });
        }
        this.cfg = parsed.data;
      }
      opts;
      source = "telegram";
      cfg;
      /** Connects the user client behind the allowlist. */
      async connect() {
        let gram;
        try {
          gram = readOnlyGramJs(await (this.opts.loader ?? loadGramJs)());
        } catch (cause) {
          throw new LaunchwrightError("qa.intake.telegram.peer", 'The telegram-mtproto intake driver reads the chat through GramJS. Add the npm package "telegram" (2.26 or later).', { cause });
        }
        try {
          const client = await UserClient.connect({ ...this.cfg, loader: async () => gram });
          return new ReadOnlyTelegram(client);
        } catch (cause) {
          throw new LaunchwrightError("qa.intake.telegram.connect", "The Telegram user session cannot connect. Check QA_TELEGRAM_SESSION and the API id.", { cause });
        }
      }
      async fetch(ref, window = {}) {
        const chat = ref.trim();
        if (chat === "") throw new LaunchwrightError("qa.intake.telegram.chat", "Telegram intake needs a chat id or a @username.");
        const peer = peerOf(chat);
        const tg = await this.connect();
        try {
          const sinceId = idOf(window.since) || (window.since === void 0 ? idOf(window.cursor) : 0);
          const untilId = idOf(window.until);
          const sinceDate = window.since instanceof Date ? window.since : void 0;
          const untilDate = window.until instanceof Date ? window.until : void 0;
          const items = [];
          let minId = sinceId;
          let last = idOf(window.cursor);
          for (let first = true; ; first = false) {
            let page;
            try {
              page = await tg.call("history", peer, {
                reverse: true,
                limit: PAGE,
                minId,
                ...untilId > 0 ? { maxId: untilId } : {},
                ...first && sinceDate ? { offsetDate: Math.floor(sinceDate.getTime() / 1e3) } : {}
              });
            } catch (cause) {
              if (isCodedError(cause)) throw cause;
              throw new LaunchwrightError("qa.intake.telegram.read", `Cannot read the history of chat ${chat}. The session must be a member of the chat.`, { cause, context: { chat } });
            }
            for (const m of page) {
              minId = Math.max(minId, m.id);
              last = Math.max(last, m.id);
              if (m.action !== void 0 || m.className === "MessageService") continue;
              const at = new Date(m.date * 1e3);
              if (sinceDate && at < sinceDate) continue;
              if (untilDate && at >= untilDate) continue;
              items.push(await this.item(tg, chat, m));
            }
            if (page.length < PAGE) break;
          }
          items.sort((a, b) => Number(a.id) - Number(b.id));
          return { source: "telegram", ref: chat, items, ...last > 0 ? { cursor: String(last) } : {} };
        } finally {
          await tg.close();
        }
      }
      async item(tg, chat, m) {
        const media = m.media ? [await this.media(tg, chat, m, m.media)] : [];
        return {
          id: String(m.id),
          at: new Date(m.date * 1e3).toISOString(),
          author: authorOf(m),
          text: m.message ?? "",
          ...m.replyTo?.replyToMsgId !== void 0 ? { replyTo: String(m.replyTo.replyToMsgId) } : {},
          media: media.filter((x) => x !== null)
        };
      }
      async media(tg, chat, m, media) {
        const from = `tg:${chat}/${m.id}`;
        if (media.className === "MessageMediaWebPage") return null;
        let declared;
        let name;
        let voice = false;
        if (media.className === "MessageMediaPhoto") {
          declared = "image/jpeg";
        } else if (media.className === "MessageMediaDocument" && media.document) {
          const doc = media.document;
          declared = doc.mimeType ?? "application/octet-stream";
          name = doc.attributes?.find((a) => a.className === "DocumentAttributeFilename")?.fileName;
          voice = doc.attributes?.some((a) => a.className === "DocumentAttributeAudio" && a.voice === true) ?? false;
          const size = doc.size === void 0 ? 0 : Number(doc.size.toString());
          if (size > this.opts.maxBytes) return { from, kind: kindOf(declared, voice), mime: declared, ...name ? { name } : {}, skipped: "too-large" };
        } else {
          return { from, kind: "file", mime: "application/octet-stream", skipped: "unsupported" };
        }
        let data;
        try {
          data = await tg.call("downloadMedia", m);
        } catch (cause) {
          if (isCodedError(cause) && cause.code === "telegram.mtproto.download") {
            return { from, kind: kindOf(declared, voice), mime: declared, ...name ? { name } : {}, skipped: "unreachable" };
          }
          throw cause;
        }
        const mime = mimeOf(declared, data, name);
        if (data.byteLength > this.opts.maxBytes) return { from, kind: kindOf(mime, voice), mime, ...name ? { name } : {}, skipped: "too-large" };
        return { from, kind: kindOf(mime, voice), mime, ...name ? { name } : {}, data };
      }
    };
  }
});

// src/telegram/bot-api.mts
function redactToken(text2, token2) {
  const stripped = token2 ? text2.split(token2).join("[redacted]") : text2;
  return stripped.replace(TOKEN_SHAPE, "[redacted]");
}
function reasonOf2(status, errorCode) {
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
function botIdOfToken(token2) {
  const at = token2.indexOf(":");
  const id = Number(token2.slice(0, at));
  if (at <= 0 || !Number.isSafeInteger(id) || id <= 0 || token2.length - at < 2) {
    throw new LaunchwrightError("telegram.token.invalid", "A bot token has the form <bot id>:<secret>.", { context: { key: "token" } });
  }
  return id;
}
var TOKEN_SHAPE, TelegramApiError, BotApi;
var init_bot_api = __esm({
  "src/telegram/bot-api.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    TOKEN_SHAPE = /[0-9]{4,}:[A-Za-z0-9_-]{20,}/g;
    TelegramApiError = class extends LaunchwrightError {
      method;
      /** The HTTP status. 0 when no answer arrived. */
      status;
      /** Telegram's own description, with any token removed. */
      description;
      constructor(method, failure, cause) {
        const reason = reasonOf2(failure.status, failure.error_code);
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
    BotApi = class {
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
        let answer;
        try {
          answer = await response.json();
        } catch (cause) {
          throw new TelegramApiError(method, { status: response.status, description: `the answer is not JSON (HTTP ${response.status})` }, cause);
        }
        if (answer.ok === true) return answer.result;
        throw new TelegramApiError(method, {
          status: response.status,
          ...answer.error_code !== void 0 ? { error_code: answer.error_code } : {},
          ...answer.description !== void 0 ? { description: answer.description } : {}
        });
      }
      getMe() {
        return this.call("getMe");
      }
      setChatMenuButton(menuButton, chatId) {
        return this.call("setChatMenuButton", { menu_button: menuButton, ...chatId !== void 0 ? { chat_id: chatId } : {} });
      }
    };
  }
});

// src/intake/drivers/intake/telegram-bot.mts
var telegram_bot_exports = {};
__export(telegram_bot_exports, {
  BOT_API_MAX_BYTES: () => BOT_API_MAX_BYTES,
  BOT_READ_METHODS: () => BOT_READ_METHODS,
  TelegramBotIntakeDriver: () => TelegramBotIntakeDriver,
  telegramBotConfig: () => telegramBotConfig
});
function messageOfUpdate(u) {
  return u.message ?? u.edited_message ?? u.channel_post ?? u.edited_channel_post;
}
function authorOf2(m) {
  const f = m.from;
  const name = [f?.first_name, f?.last_name].filter((p) => p !== void 0 && p !== "").join(" ");
  if (name !== "") return name;
  if (f?.username) return `@${f.username}`;
  const chat = m.sender_chat?.title ?? m.chat.title;
  return typeof chat === "string" && chat !== "" ? chat : "unknown";
}
function inChat(m, chat) {
  return String(m.chat.id) === chat || m.chat.username !== void 0 && `@${String(m.chat.username)}` === chat;
}
function inWindow(m, w) {
  const at = m.date * 1e3;
  if (w.since !== void 0 && (w.since instanceof Date ? at < w.since.getTime() : m.message_id <= w.since)) return false;
  if (w.until !== void 0 && (w.until instanceof Date ? at >= w.until.getTime() : m.message_id >= w.until)) return false;
  return true;
}
function filesOf(m) {
  const out = [];
  const photo = m.photo;
  const largest = photo?.at(-1);
  if (largest) out.push({ file: largest, mime: "image/jpeg", voice: false });
  for (const key of ["video", "animation", "video_note", "audio", "document"]) {
    const f = m[key];
    if (f) out.push({ file: f, mime: f.mime_type ?? (key === "video_note" ? "video/mp4" : mimeOfExtension(f.file_name ?? "") ?? "application/octet-stream"), voice: false });
  }
  const voice = m.voice;
  if (voice) out.push({ file: voice, mime: voice.mime_type ?? "audio/ogg", voice: true });
  return out;
}
var BOT_API_MAX_BYTES, BOT_READ_METHODS, telegramBotConfig, TelegramBotIntakeDriver;
var init_telegram_bot = __esm({
  "src/intake/drivers/intake/telegram-bot.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_src();
    init_media();
    init_bot_api();
    init_contract();
    BOT_API_MAX_BYTES = 20 * 1024 * 1024;
    BOT_READ_METHODS = /* @__PURE__ */ new Set(["getUpdates", "getFile"]);
    telegramBotConfig = import_zod6.z.object({
      /** The QA bot token. Privacy mode must be off, so the bot sees every message. */
      token: import_zod6.z.string().min(1),
      apiUrl: import_zod6.z.string().url().default("https://api.telegram.org"),
      /** The long poll of a `--follow` read, in seconds. */
      pollTimeoutS: import_zod6.z.number().int().positive().default(30)
    });
    TelegramBotIntakeDriver = class extends BaseDriver {
      constructor(cfg, opts) {
        super("telegram-bot", QA_INTAKE_SPEC_VERSION, ["window", "cursor", "follow"]);
        this.opts = opts;
        const parsed = telegramBotConfig.safeParse(cfg);
        if (!parsed.success) {
          const keys = [...new Set(parsed.error.issues.map((i) => `qa.intake.drivers.telegram-bot.${String(i.path[0])}`))];
          throw new LaunchwrightError("qa.intake.telegram.config", `Set ${keys.join(", ")}.`, { context: { keys } });
        }
        this.cfg = parsed.data;
        this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
        this.api = new BotApi({ token: this.cfg.token, apiUrl: this.cfg.apiUrl, fetch: this.fetchFn });
      }
      opts;
      source = "telegram";
      cfg;
      api;
      fetchFn;
      /** Calls one Bot API method. A method outside `BOT_READ_METHODS` throws `qa.intake.telegram.method`. */
      call(method, params, signal) {
        if (!BOT_READ_METHODS.has(method)) {
          throw new LaunchwrightError("qa.intake.telegram.method", `Telegram intake is read-only: the Bot API method ${method} is not on the allowlist (getUpdates, getFile).`, {
            context: { method }
          });
        }
        const timeoutMs = (this.cfg.pollTimeoutS + 10) * 1e3;
        return this.api.call(method, params, { timeoutMs, ...signal ? { signal } : {} });
      }
      async fetch(ref, window = {}) {
        const chat = ref.trim();
        if (chat === "") throw new LaunchwrightError("qa.intake.telegram.chat", "Telegram intake needs a chat id or a @username.");
        if (window.follow && !window.signal) throw new LaunchwrightError("qa.intake.follow", "A follow read needs an AbortSignal to stop it.");
        let offset = window.cursor !== void 0 ? Number(window.cursor) : void 0;
        const messages = /* @__PURE__ */ new Map();
        for (; ; ) {
          if (window.signal?.aborted) break;
          let updates;
          try {
            updates = await this.call(
              "getUpdates",
              { ...offset !== void 0 ? { offset } : {}, timeout: window.follow ? this.cfg.pollTimeoutS : 0, allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"] },
              window.signal
            );
          } catch (cause) {
            if (window.signal?.aborted) break;
            throw new LaunchwrightError("qa.intake.telegram.bot", "The QA bot cannot read its updates.", { cause });
          }
          for (const u of updates) {
            offset = Math.max(offset ?? 0, u.update_id + 1);
            const m = messageOfUpdate(u);
            if (m && inChat(m, chat) && inWindow(m, window)) messages.set(m.message_id, m);
          }
          if (updates.length === 0 && !window.follow) break;
        }
        const items = [];
        for (const m of [...messages.values()].sort((a, b) => a.message_id - b.message_id)) items.push(await this.item(chat, m));
        return { source: "telegram", ref: chat, items, ...offset !== void 0 ? { cursor: String(offset) } : {} };
      }
      async item(chat, m) {
        const media = [];
        const files = filesOf(m);
        for (const [i, f] of files.entries()) media.push(await this.media(`tg:${chat}/${m.message_id}${files.length > 1 ? `#${i + 1}` : ""}`, f.file, f.mime, f.voice));
        const reply = m.reply_to_message?.message_id;
        return {
          id: String(m.message_id),
          at: new Date(m.date * 1e3).toISOString(),
          author: authorOf2(m),
          text: m.text ?? m.caption ?? "",
          ...reply !== void 0 ? { replyTo: String(reply) } : {},
          media
        };
      }
      async media(from, file, mime, voice) {
        const name = file.file_name;
        const base = { from, kind: kindOf(mime, voice), mime, ...name ? { name } : {} };
        const max = Math.min(this.opts.maxBytes, BOT_API_MAX_BYTES);
        if ((file.file_size ?? 0) > max) return { ...base, skipped: "too-large" };
        let path;
        try {
          path = (await this.call("getFile", { file_id: file.file_id })).file_path;
        } catch (cause) {
          if (!(cause instanceof TelegramApiError)) throw cause;
          return { ...base, skipped: /too big/i.test(cause.description) ? "too-large" : "unreachable" };
        }
        if (path === void 0) return { ...base, skipped: "unreachable" };
        const url = `${this.cfg.apiUrl.replace(/\/+$/, "")}/file/bot${this.cfg.token}/${path}`;
        const got = await download(url, { fetch: this.fetchFn, maxBytes: max, ...name ? { name } : {} });
        if ("skipped" in got) return { ...base, skipped: got.skipped };
        const type = got.mime === "application/octet-stream" ? mime : got.mime;
        return { ...base, kind: kindOf(type, voice), mime: type, data: got.data };
      }
    };
  }
});

// src/intake/services/registry.mts
function maxBytesOf(intake) {
  return Math.floor(intake.maxFileMb * 1024 * 1024);
}
async function createIntakeDriver(name, intake, deps = {}) {
  const ready = deps.drivers?.[name];
  if (ready) return ready;
  const cfg = intake.drivers[name] ?? {};
  const maxBytes = maxBytesOf(intake);
  switch (name) {
    case "github": {
      const { GithubIntakeDriver: GithubIntakeDriver2 } = await Promise.resolve().then(() => (init_github(), github_exports));
      return new GithubIntakeDriver2({ maxBytes, ...deps.gh ? { gh: deps.gh } : {}, ...deps.fetch ? { fetch: deps.fetch } : {} });
    }
    case "telegram-mtproto": {
      const { TelegramMtprotoIntakeDriver: TelegramMtprotoIntakeDriver2 } = await Promise.resolve().then(() => (init_telegram_mtproto(), telegram_mtproto_exports));
      return new TelegramMtprotoIntakeDriver2(cfg, { maxBytes, ...deps.loadGramJs ? { loader: deps.loadGramJs } : {} });
    }
    case "telegram-bot": {
      const { TelegramBotIntakeDriver: TelegramBotIntakeDriver2 } = await Promise.resolve().then(() => (init_telegram_bot(), telegram_bot_exports));
      return new TelegramBotIntakeDriver2(cfg, { maxBytes, ...deps.fetch ? { fetch: deps.fetch } : {} });
    }
    case "fake": {
      const { FakeIntakeDriver: FakeIntakeDriver2 } = await Promise.resolve().then(() => (init_fake(), fake_exports));
      return new FakeIntakeDriver2({ maxBytes });
    }
    default:
      throw new LaunchwrightError("qa.intake.driver", `No intake driver "${name}". Use ${INTAKE_DRIVERS.join(", ")}.`, { context: { driver: name } });
  }
}
var INTAKE_DRIVERS;
var init_registry2 = __esm({
  "src/intake/services/registry.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    INTAKE_DRIVERS = ["github", "telegram-mtproto", "telegram-bot", "fake"];
  }
});

// src/intake/services/telegram.mts
function chatName(chat) {
  return recordId(chat);
}
function chatDir(root, chat) {
  return (0, import_node_path31.join)(root, INTAKE_DIR, "telegram", chatName(chat));
}
function cursorFile(root, chat) {
  return (0, import_node_path31.join)(root, INTAKE_DIR, "telegram", `${chatName(chat)}.cursor`);
}
async function jsonOr(file, fallback) {
  return await readJsonOrNull(file) ?? fallback;
}
async function readCursor(root, chat, driver) {
  const all = await jsonOr(cursorFile(root, chat), {});
  return all[driver];
}
async function writeCursor(root, chat, driver, cursor) {
  const file = cursorFile(root, chat);
  const all = await jsonOr(file, {});
  all[driver] = cursor;
  await (0, import_promises17.mkdir)((0, import_node_path31.join)(root, INTAKE_DIR, "telegram"), { recursive: true });
  await (0, import_promises17.writeFile)(file, `${JSON.stringify(all, null, 2)}
`);
}
function readMessages(root, chat) {
  return jsonOr((0, import_node_path31.join)(chatDir(root, chat), "messages.json"), []);
}
async function stageBatch(root, chat, batch) {
  const dir = chatDir(root, chat);
  await (0, import_promises17.mkdir)((0, import_node_path31.join)(dir, "media"), { recursive: true });
  const all = new Map((await readMessages(root, chat)).map((m) => [m.id, m]));
  for (const item of batch.items) {
    const media = [];
    for (const [i, m] of item.media.entries()) {
      const { data, ...rest } = m;
      if (data === void 0) {
        media.push(rest);
        continue;
      }
      const file = `media/${recordId(item.id)}-${i + 1}.${extensionOf(m.mime)}`;
      await (0, import_promises17.writeFile)((0, import_node_path31.join)(dir, file), data);
      media.push({ ...rest, file });
    }
    all.set(item.id, { ...item, media });
  }
  const messages = [...all.values()].sort(byId);
  await (0, import_promises17.writeFile)((0, import_node_path31.join)(dir, "messages.json"), `${JSON.stringify(messages, null, 2)}
`);
  return messages;
}
function proposeGroups(chat, messages) {
  const sorted = [...messages].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byId(a, b));
  const parent = new Map(sorted.map((m) => [m.id, m.id]));
  const find = (id) => {
    let at = id;
    while (parent.get(at) !== at) at = parent.get(at);
    parent.set(id, at);
    return at;
  };
  const join23 = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const lastOf = /* @__PURE__ */ new Map();
  for (const m of sorted) {
    if (m.replyTo !== void 0 && parent.has(m.replyTo)) join23(m.replyTo, m.id);
    const at = Date.parse(m.at);
    const prev = lastOf.get(m.author);
    if (prev && at - prev.at < JOIN_GAP_MS) join23(prev.id, m.id);
    lastOf.set(m.author, { id: m.id, at });
  }
  const groups = /* @__PURE__ */ new Map();
  for (const m of sorted) {
    const root = find(m.id);
    groups.set(root, [...groups.get(root) ?? [], m.id]);
  }
  return [...groups.values()].map((ids) => ({ title: `Telegram report ${chat}/${ids[0]} (${ids.length} ${ids.length === 1 ? "message" : "messages"})`, messages: ids }));
}
async function writeProposal(root, chat, groups) {
  const file = (0, import_node_path31.join)(chatDir(root, chat), "groups.proposed.json");
  await (0, import_promises17.mkdir)(chatDir(root, chat), { recursive: true });
  await (0, import_promises17.writeFile)(file, `${JSON.stringify({ chat, groups }, null, 2)}
`);
  return file;
}
async function readGroups(root, chat) {
  const file = (0, import_node_path31.join)(chatDir(root, chat), "groups.json");
  const raw = await jsonOr(file, null);
  if (raw === null) {
    throw new LaunchwrightError("qa.intake.telegram.groups", `No groups.json for chat ${chat}. Review groups.proposed.json and write groups.json beside it.`, { context: { chat } });
  }
  const parsed = groupsFile.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new LaunchwrightError("qa.intake.telegram.groups", `groups.json of chat ${chat} is not valid: ${problems}`, { context: { chat } });
  }
  return parsed.data.groups.map((g, i) => ({ title: g.title ?? `Telegram report ${chat} group ${i + 1}`, messages: g.messages }));
}
async function applyGroups(root, chat) {
  const groups = await readGroups(root, chat);
  const messages = new Map((await readMessages(root, chat)).map((m) => [m.id, m]));
  const dir = chatDir(root, chat);
  const out = [];
  for (const g of groups) {
    const missing = g.messages.filter((id) => !messages.has(id));
    if (missing.length > 0) {
      throw new LaunchwrightError("qa.intake.telegram.groups", `groups.json of chat ${chat} names messages that are not staged: ${missing.join(", ")}.`, { context: { chat, missing } });
    }
    const list3 = g.messages.map((id) => messages.get(id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byId(a, b));
    const [first, ...rest] = list3;
    const media = [];
    for (const m of list3) {
      for (const s of m.media) {
        const { file, ...meta } = s;
        media.push(file === void 0 ? meta : { ...meta, data: new Uint8Array(await (0, import_promises17.readFile)((0, import_node_path31.join)(dir, file))) });
      }
    }
    out.push(
      await writeIssue(root, {
        id: recordId("tg", chat, first.id),
        source: "telegram",
        ref: `${chat}#${list3.map((m) => m.id).join(",")}`,
        title: g.title,
        reportedAt: first.at,
        reporter: first.author,
        text: first.text,
        thread: rest.map((m) => ({ at: m.at, author: m.author, text: m.text })),
        media
      })
    );
  }
  return out;
}
var import_promises17, import_node_path31, JOIN_GAP_MS, groupsFile, byId;
var init_telegram = __esm({
  "src/intake/services/telegram.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises17 = require("fs/promises");
    import_node_path31 = require("path");
    init_kernel();
    init_fs();
    init_src();
    JOIN_GAP_MS = 15 * 60 * 1e3;
    groupsFile = import_zod6.z.object({
      groups: import_zod6.z.array(import_zod6.z.object({ title: import_zod6.z.string().min(1).optional(), messages: import_zod6.z.array(import_zod6.z.union([import_zod6.z.string(), import_zod6.z.number()]).transform(String)).min(1) }))
    });
    byId = (a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);
  }
});

// src/intake/commands/qa-intake.mts
var qa_intake_exports = {};
__export(qa_intake_exports, {
  createIntakeCommand: () => createIntakeCommand,
  default: () => qa_intake_default
});
function usage(opts, problem) {
  if (problem) opts.err(`lw qa intake: ${problem}`);
  for (const line of USAGE2) opts.err(line);
  return 2;
}
function intakeConfig(opts) {
  const section = qaConfig.safeParse(opts.config?.qa ?? {});
  const parsed = section.success ? qaIntakeConfig.safeParse(section.data.intake) : section;
  if (!parsed.success) {
    const prefix = section.success ? "qa.intake" : "qa";
    const problems = parsed.error.issues.map((i) => `${[prefix, ...i.path].join(".")}: ${i.message}`).join("; ");
    throw new LaunchwrightError("qa.config", `Config section qa is not valid: ${problems}`);
  }
  return parsed.data;
}
function boundOf(flag2, value) {
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  if (Number.isNaN(at)) throw new LaunchwrightError("qa.intake.window", `${flag2} takes a date (2026-11-01 or an ISO time) or a message id, not "${value}".`);
  return new Date(at);
}
function parseTelegram(args) {
  let parsed;
  try {
    parsed = parseCommandArgs({ values: TELEGRAM_VALUES, switches: ["follow", "apply"] }, args);
  } catch (cause) {
    if (cause instanceof UsageError) return cause.message;
    throw cause;
  }
  const [extra] = parsed.positionals;
  if (extra !== void 0) return `unknown argument ${extra}`;
  return { ...parsed.values, follow: parsed.switches.has("follow"), apply: parsed.switches.has("apply") };
}
async function github(args, opts, deps) {
  if (args.length !== 1) return usage(opts, "github takes one issue URL");
  const driver = await createIntakeDriver("github", intakeConfig(opts), deps);
  const batch = await driver.fetch(args[0]);
  const [body, ...comments] = batch.items;
  if (!body) throw new LaunchwrightError("qa.intake.github.gh", "gh issue view gave no issue body.");
  const m = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/.exec(batch.ref);
  const id = m ? recordId("github", m[1], m[2], m[3]) : recordId("github", batch.ref);
  const issue = await writeIssue(opts.cwd, {
    id,
    source: "github",
    ref: batch.ref,
    title: batch.title ?? id,
    reportedAt: body.at,
    reporter: body.author,
    text: body.text,
    thread: comments.map((c) => ({ at: c.at, author: c.author, text: c.text })),
    media: batch.items.flatMap((i) => i.media)
  });
  opts.out(`wrote ${issue.id}: ${issue.attachments.length} attachments, ${issue.skipped.length} skipped`);
  opts.out(`  ${(0, import_node_path32.relative)(opts.cwd, recordDir(opts.cwd, issue.id))}/issue.md`);
  return 0;
}
function followSignal(opts) {
  if (opts.signal) return { signal: opts.signal, done: () => void 0 };
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  process.once("SIGINT", stop);
  return { signal: ctl.signal, done: () => process.off("SIGINT", stop) };
}
async function telegram(args, opts, deps) {
  const p = parseTelegram(args);
  if (typeof p === "string") return usage(opts, p);
  if (p.chat === void 0) return usage(opts, "telegram needs --chat <id>");
  const chat = p.chat;
  if (p.apply) {
    if (p.since !== void 0 || p.until !== void 0 || p.follow || p.driver !== void 0) return usage(opts, "--apply takes only --chat");
    const issues = await applyGroups(opts.cwd, chat);
    for (const issue of issues) opts.out(`wrote ${issue.id}: ${issue.attachments.length} attachments, ${issue.skipped.length} skipped`);
    opts.out(`${issues.length} records in ${INTAKE_DIR}`);
    return 0;
  }
  const intake = intakeConfig(opts);
  const name = p.driver ?? (TELEGRAM_DRIVERS.includes(intake.default) ? intake.default : "telegram-mtproto");
  if (!TELEGRAM_DRIVERS.includes(name)) return usage(opts, `--driver takes ${TELEGRAM_DRIVERS.join(", ")}`);
  const driver = await createIntakeDriver(name, intake, deps);
  if (p.follow && !driver.supports("follow")) return usage(opts, `the ${name} driver cannot --follow; use --driver telegram-bot`);
  const since = p.since === void 0 ? void 0 : boundOf("--since", p.since);
  const until = p.until === void 0 ? void 0 : boundOf("--until", p.until);
  const cursor = since === void 0 && driver.supports("cursor") ? await readCursor(opts.cwd, chat, name) : void 0;
  const follow = p.follow ? followSignal(opts) : void 0;
  if (follow) opts.out(`following chat ${chat}; stop with Ctrl-C`);
  let batch;
  try {
    batch = await driver.fetch(chat, {
      ...since !== void 0 ? { since } : {},
      ...until !== void 0 ? { until } : {},
      ...cursor !== void 0 ? { cursor } : {},
      ...follow ? { follow: true, signal: follow.signal } : {}
    });
  } finally {
    follow?.done();
  }
  const staged = await stageBatch(opts.cwd, chat, batch);
  if (batch.cursor !== void 0 && driver.supports("cursor")) {
    const next = cursor !== void 0 && Number(cursor) > Number(batch.cursor) ? cursor : batch.cursor;
    await writeCursor(opts.cwd, chat, name, next);
  }
  const groups = proposeGroups(chat, staged);
  const file = await writeProposal(opts.cwd, chat, groups);
  opts.out(`read ${batch.items.length} messages from chat ${chat} with ${name}; ${staged.length} staged`);
  opts.out(`proposed ${groups.length} groups: ${(0, import_node_path32.relative)(opts.cwd, file)}`);
  opts.out(`review it, write groups.json beside it, then run: lw qa intake telegram --chat ${chat} --apply`);
  return 0;
}
async function list2(args, opts) {
  if (args.length > 0) return usage(opts, "list takes no arguments");
  const issues = await listIssues(opts.cwd);
  if (issues.length === 0) {
    opts.out(`no intake records in ${INTAKE_DIR}`);
    return 0;
  }
  const width = Math.max(...issues.map((i) => i.id.length));
  for (const i of issues) opts.out(`${i.id.padEnd(width)}  ${i.source.padEnd(8)}  ${String(i.attachments.length).padStart(3)}  ${i.title}`);
  return 0;
}
function createIntakeCommand(deps = {}) {
  return {
    name: "intake",
    summary: "read a GitHub issue or a Telegram chat into local issue records",
    async run(args, opts) {
      const [sub, ...rest] = args;
      try {
        if (sub === "github") return await github(rest, opts, deps);
        if (sub === "telegram") return await telegram(rest, opts, deps);
        if (sub === "list") return await list2(rest, opts);
      } catch (error) {
        if (!isCodedError(error)) throw error;
        opts.err(`lw qa intake: ${error.message} (${error.code})`);
        return 1;
      }
      return usage(opts, sub === void 0 || sub === "--help" || sub === "-h" ? void 0 : `unknown subcommand ${sub}`);
    }
  };
}
var import_node_path32, USAGE2, TELEGRAM_DRIVERS, TELEGRAM_VALUES, qa_intake_default;
var init_qa_intake = __esm({
  "src/intake/commands/qa-intake.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path32 = require("path");
    init_kernel();
    init_args();
    init_src();
    init_config2();
    init_registry2();
    init_telegram();
    USAGE2 = [
      "usage: lw qa intake github <issue-url>",
      "       lw qa intake telegram --chat <id> [--since <date|message-id>] [--until <date|message-id>] [--driver <d>] [--follow]",
      "       lw qa intake telegram --chat <id> --apply",
      "       lw qa intake list"
    ];
    TELEGRAM_DRIVERS = ["telegram-mtproto", "telegram-bot", "fake"];
    TELEGRAM_VALUES = ["chat", "since", "until", "driver"];
    qa_intake_default = createIntakeCommand();
  }
});

// src/intake/index.mts
var intake_exports = {};
__export(intake_exports, {
  FAKE_INTAKE_ITEMS: () => FAKE_INTAKE_ITEMS,
  FakeIntakeDriver: () => FakeIntakeDriver,
  INTAKE_DRIVERS: () => INTAKE_DRIVERS,
  JOIN_GAP_MS: () => JOIN_GAP_MS,
  QA_INTAKE_CAPABILITIES: () => QA_INTAKE_CAPABILITIES,
  QA_INTAKE_SPEC_VERSION: () => QA_INTAKE_SPEC_VERSION,
  applyGroups: () => applyGroups,
  chatDir: () => chatDir,
  createIntakeDriver: () => createIntakeDriver,
  cursorFile: () => cursorFile,
  download: () => download,
  isGithubMediaHost: () => isGithubMediaHost,
  isGithubUpload: () => isGithubUpload,
  issueMarkdown: () => issueMarkdown,
  kindOf: () => kindOf,
  listIssues: () => listIssues,
  maxBytesOf: () => maxBytesOf,
  mediaLinks: () => mediaLinks,
  mimeOf: () => mimeOf,
  proposeGroups: () => proposeGroups,
  qaExtension: () => qaExtension,
  qaIntakeConfig: () => qaIntakeConfig,
  qaIntakeProvider: () => qaIntakeProvider,
  readCursor: () => readCursor,
  readGroups: () => readGroups,
  readIssue: () => readIssue,
  readMessages: () => readMessages,
  recordDir: () => recordDir,
  recordId: () => recordId,
  sniffMime: () => sniffMime,
  stageBatch: () => stageBatch,
  takesGithubToken: () => takesGithubToken,
  writeCursor: () => writeCursor,
  writeIssue: () => writeIssue,
  writeProposal: () => writeProposal
});
module.exports = __toCommonJS(intake_exports);
init_cjs_shims();
init_config2();
init_contract();
init_fake();
init_links();
init_media();
init_src();

// src/intake/provider.mts
init_cjs_shims();
init_kernel();
init_config2();
var qaIntakeProvider = provider({
  name: "qa-intake",
  requires: ["kernel", "qa"],
  register(app) {
    const parsed = qaIntakeConfig.safeParse(app.get(CONFIG).section("qa").intake);
    if (parsed.success) return;
    const issues = parsed.error.issues.map((i) => `${["qa.intake", ...i.path].join(".")}: ${i.message}`).join("; ");
    throw new BootError("qa.intake.config", `Boot failed in module "qa-intake": ${issues}. Check ${app.config.envFile}.`, {
      cause: parsed.error,
      context: { module: "qa-intake", key: "qa.intake", envFile: app.config.envFile }
    });
  }
});

// src/intake/services/extension.mts
init_cjs_shims();
var qaExtension = {
  name: "qa-intake",
  subcommands: { intake: async () => (await Promise.resolve().then(() => (init_qa_intake(), qa_intake_exports))).default }
};

// src/intake/index.mts
init_registry2();
init_telegram();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FAKE_INTAKE_ITEMS,
  FakeIntakeDriver,
  INTAKE_DRIVERS,
  JOIN_GAP_MS,
  QA_INTAKE_CAPABILITIES,
  QA_INTAKE_SPEC_VERSION,
  applyGroups,
  chatDir,
  createIntakeDriver,
  cursorFile,
  download,
  isGithubMediaHost,
  isGithubUpload,
  issueMarkdown,
  kindOf,
  listIssues,
  maxBytesOf,
  mediaLinks,
  mimeOf,
  proposeGroups,
  qaExtension,
  qaIntakeConfig,
  qaIntakeProvider,
  readCursor,
  readGroups,
  readIssue,
  readMessages,
  recordDir,
  recordId,
  sniffMime,
  stageBatch,
  takesGithubToken,
  writeCursor,
  writeIssue,
  writeProposal
});
//# sourceMappingURL=intake.cjs.map