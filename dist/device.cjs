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
  const out2 = [...modules];
  for (let i = 0; i < out2.length; i++) {
    for (const r of requires(out2[i])) {
      if (r !== "kernel" && !out2.includes(r) && keep(r)) out2.push(r);
    }
  }
  return { modules: out2, added: out2.slice(modules.length) };
}
function defaultProcess(name, runtime) {
  if (runtime === "node") return { name, command: "node --import tsx src/main.mts", port: true };
  if (runtime === "web") return { name, command: "vite --configLoader runner", port: true };
  return { name, command: `python -m ${name.replaceAll("-", "_")}` };
}
function checkApps(project) {
  const installed2 = new Set(Object.keys(project.modules ?? {}));
  const entries = Object.entries(project.apps ?? DEFAULT_APPS);
  const findings = [];
  const paths = /* @__PURE__ */ new Map();
  const nodeApps = entries.filter(([, a]) => a.runtime === "node").map(([n]) => n);
  for (const [name, app] of entries) {
    for (const m of app.modules ?? []) {
      if (!installed2.has(m) && m !== "kernel") findings.push({ key: `apps.${name}.modules`, message: `app ${name} names module ${m}, which modules does not hold` });
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
  const installed2 = Object.keys(project.modules ?? {});
  const hasPackage = opts.hasPackage ?? (() => true);
  const requires = opts.requires ?? (() => []);
  const nodeApps = Object.entries(parsed.data).filter(([, a]) => a.runtime === "node").map(([n]) => n);
  const apps = Object.entries(parsed.data).map(([name, app]) => {
    const processes = app.processes === void 0 ? [defaultProcess(name, app.runtime)] : Object.entries(app.processes).map(([p, v]) => ({ name: p, ...v }));
    const listed = app.modules ?? (app.runtime === "web" ? [] : installed2.filter((m) => hasPackage(m, app.runtime)));
    const { modules, added } = closeOverRequires(listed, requires, (m) => installed2.includes(m) && hasPackage(m, app.runtime));
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
        return new Promise((resolve5, reject) => {
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
            resolve5();
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
function safeEqual(a, b) {
  const x = typeof a === "string" ? encoder.encode(a) : a;
  const y = typeof b === "string" ? encoder.encode(b) : b;
  if (x.byteLength !== y.byteLength) return false;
  return (0, import_node_crypto.timingSafeEqual)(x, y);
}
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
var init_driver = __esm({
  "src/kernel/services/driver.mts"() {
    "use strict";
    init_cjs_shims();
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
var init_config2 = __esm({
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
    init_config2();
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
  const out2 = [];
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i];
    if (word === "--") return [...out2, ...argv.slice(i)];
    const next = argv[i + 1];
    if (word.startsWith("--") && valueFlags.has(word.slice(2)) && next !== void 0) {
      out2.push(...NEGATIVE.test(next) ? [`${word}=${next}`] : [word, next]);
      i++;
    } else out2.push(NEGATIVE.test(word) ? NEGATIVE_MARK + word : word);
  }
  return out2;
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
async function readTextOrNull(path) {
  try {
    return await (0, import_promises2.readFile)(path, "utf8");
  } catch (cause) {
    if (isMissing(cause)) return null;
    throw readError(path, cause);
  }
}
async function readJsonOrNull(path) {
  const text = await readTextOrNull(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
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
var init_types = __esm({
  "src/services/types.mts"() {
    "use strict";
    init_cjs_shims();
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
  const { sha256: sha2562, bytes } = await fileDigest((0, import_node_path4.join)(reportDir, facts.path));
  return { ...facts, sha256: sha2562, bytes };
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
  const out2 = [];
  for (const u of inv.unions) {
    const mechanism = mechanismFor(u.kind);
    for (const member of u.members) out2.push({ id: `${u.name}.${member}`, union: u.name, member, kind: u.kind, mechanism });
    if (u.outputs.some((o) => o.nullable)) out2.push({ id: `${u.name}.null`, union: u.name, member: null, kind: u.kind, mechanism });
  }
  return out2;
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
  const out2 = [];
  for (const union of inventory.unions) {
    if (!unreachable2.has(union.name)) continue;
    const fields = union.inputs.map((site) => ({ interface: site.interface, field: site.field, file: site.file }));
    const drivable = union.inputs.length > 0 || solveSite(union) !== null;
    out2.push({
      union: union.name,
      file: union.file,
      members: [...union.members],
      fields,
      via: drivable ? "app-service" : "direct-write",
      provenance: "forged",
      reason: union.kind === "neither" ? "nothing takes it and nothing returns it" : union.why ?? "no route delivers it and no mount draws it"
    });
  }
  return out2;
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
  const out2 = [0, 1];
  for (const p of pivots) out2.push(p, p + 1, p - 1);
  return [...new Set(out2)];
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
    const list2 = fieldValues(field, options);
    if (list2.length > 0) values.set(name, list2);
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
    const { changes, text } = describeCandidate(candidate, base);
    plan2.push({ candidate, base, baseIndex, changes, text });
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
  const text = changes.length === 0 ? "unchanged from the corpus entry" : changes.map((c) => `${c.field}: ${show(c.from)} -> ${show(c.to)}`).join(", ");
  return { changes, text };
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
  const collect2 = (parsed, container) => {
    if (state.bodies.length < MAX_BODIES) state.bodies.push(parsed);
    for (const row of container) {
      if (state.corpus.length >= MAX_CORPUS) break;
      if (isPlainObject3(row)) state.corpus.push(row);
    }
  };
  const handler = async (route) => {
    try {
      const response = await route.fetch();
      const text = await response.text();
      const status = response.status();
      const headers = freshHeaders(response.headers());
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        state.errors.push(`${spec.url}: the response is not JSON, so no subject can be put into it`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      const container = getAtPath(parsed, spec.container);
      if (!Array.isArray(container)) {
        const what = container === void 0 ? "not in the response" : "not an array";
        state.errors.push(`${spec.url}: "${spec.container}" is ${what}, so the descriptor assumes a shape the server does not send`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      collect2(parsed, container);
      if (state.subjects === null) {
        state.hits += 1;
        await route.fulfill({ status, headers, body: text });
        return;
      }
      if (!setAtPath(parsed, spec.container, [...state.subjects])) {
        state.errors.push(`${spec.url}: "${spec.container}" could not be written back`);
        await route.fulfill({ status, headers, body: text });
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
  const out2 = [];
  const walk2 = (x, y, path) => {
    if (x.self !== y.self || x.children.length !== y.children.length) {
      out2.push(path);
      return;
    }
    for (let i = 0; i < x.children.length; i += 1) walk2(x.children[i], y.children[i], [...path, i]);
  };
  walk2(a, b, []);
  return out2;
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
  const out2 = [];
  for (const entry of byPrefix.values()) {
    const children = [...entry.children].sort((x, y) => x - y);
    const tags = children.map((i) => nodeAt(tree, [...entry.prefix, i])?.tag ?? null);
    const firstTag = tags[0] ?? null;
    const tag = firstTag !== null && tags.every((t) => t === firstTag) ? firstTag : null;
    out2.push({ prefix: entry.prefix, children, diffs: entry.diffs, tag });
  }
  out2.sort((x, y) => y.prefix.length - x.prefix.length || y.diffs - x.diffs);
  return out2;
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
    const before = await snapshotTree(page, snapshotOptions);
    await renderOnce(session, group, substitution, subjects);
    const tree = await snapshotTree(page, snapshotOptions);
    const { paths } = locateSubjects(tree, before, subjects.length);
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
function parseSource(rel, text) {
  return import_typescript.default.createSourceFile(rel, text, import_typescript.default.ScriptTarget.ES2022, true, rel.endsWith(".tsx") ? import_typescript.default.ScriptKind.TSX : import_typescript.default.ScriptKind.TS);
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
  const text = (import_typescript.default.getTextOfJSDocComment(tag?.comment) ?? "").replace(/\s+/g, " ").trim();
  const directive = /^ignore(?:\s+(.*))?$/.exec(text);
  if (!directive) {
    return {
      reason: null,
      problem: {
        code: "ignore-directive",
        file,
        line,
        union: name,
        message: `${file}:${line} "${name}" has @${IGNORE_TAG} "${text}". The only directive is "ignore <reason>".`
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
  for (let pass2 = 0; pass2 <= declared.size; pass2 += 1) {
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
function fieldFor(typeNode, resolve5, hops = 0) {
  if (!typeNode) return { kind: "opaque" };
  const keyword = KEYWORD_KINDS.get(typeNode.kind);
  if (keyword) return { kind: keyword };
  if (import_typescript.default.isUnionTypeNode(typeNode)) {
    const present = typeNode.types.filter((t) => !isNullish(t));
    const nullable = present.length !== typeNode.types.length;
    const inner = unionField(present, resolve5, hops);
    if (!inner) return { kind: "opaque" };
    return nullable ? { kind: "nullable", of: inner } : inner;
  }
  if (import_typescript.default.isTypeReferenceNode(typeNode) && hops < MAX_TYPE_HOPS) {
    const name = referencedName(typeNode);
    const aliased = name ? resolve5(name) : null;
    if (aliased) return fieldFor(aliased, resolve5, hops + 1);
  }
  return { kind: "opaque" };
}
function unionField(present, resolve5, hops) {
  if (present.length === 0) return null;
  if (present.length === 1) {
    const only = fieldFor(present[0], resolve5, hops);
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
  const parsed = sources.map(({ file, text }) => ({ file, sf: parseSource(file, text) }));
  const problems = [];
  const declaredIn = /* @__PURE__ */ new Map();
  for (const { file, sf } of [...parsed, ...extraTypes.map(({ file: file2, text }) => ({ file: file2, sf: parseSource(file2, text) }))]) {
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
  const parsed = new Map(sources.map(({ file, text }) => [file, parseSource(file, text)]));
  const files = new Set(parsed.keys());
  const edges = /* @__PURE__ */ new Map();
  for (const [file, sf] of parsed) {
    const out2 = [];
    for (const specifier of importSpecifiers(sf)) {
      const target = resolveSpecifier(file, specifier, files, aliases);
      if (target !== null && target !== file) out2.push(target);
    }
    edges.set(file, [...new Set(out2)]);
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
    let out2 = node.head.text;
    for (const span of node.templateSpans) {
      const part = evaluatePath(span.expression, vocabulary, constants, depth + 1);
      if (part === null) return null;
      out2 += part + span.literal.text;
    }
    return out2;
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
      const list2 = declared && import_typescript2.default.isArrayLiteralExpression(declared) ? declared : pathNode;
      const nodes = list2 && import_typescript2.default.isArrayLiteralExpression(list2) ? [...list2.elements] : [pathNode];
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
function componentPages(component, sf, resolve5, seen = /* @__PURE__ */ new Set(), depth = 0) {
  if (component === null || seen.has(component) || depth > MAX_HOPS) return [];
  seen.add(component);
  const imports = importedNames(sf);
  const specifier = imports.get(component);
  if (specifier !== void 0) {
    const file = resolve5(specifier);
    return file === null ? [] : [file];
  }
  const declaration = localConstants(sf).get(component);
  if (!declaration) return [];
  const pages = [];
  for (const tag of jsxTagsIn(declaration)) {
    if (tag === component) continue;
    pages.push(...componentPages(tag, sf, resolve5, seen, depth + 1));
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
    const resolve5 = (specifier) => resolveSpecifier(table.file, specifier, files, aliases);
    const routes = routeRows(sf).map((row) => ({
      path: row.path,
      dynamic: row.dynamic,
      source: row.source,
      pages: row.pageName !== null ? [pageFileFor(row.pageName, input.pageRoots, files)].filter((f) => f !== null) : componentPages(row.component, sf, resolve5)
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
function aliasesFromTsconfig(text, dir) {
  const parsed = import_typescript2.default.parseConfigFileTextToJson("tsconfig.json", text);
  const options = parsed.config?.compilerOptions;
  const base = import_node_path7.posix.join(dir, options?.baseUrl ?? ".");
  const out2 = {};
  for (const [key, targets] of Object.entries(options?.paths ?? {})) {
    const [target] = targets;
    if (target === void 0) continue;
    const alias = key.replace(/\/\*$/, "");
    out2[alias] = import_node_path7.posix.normalize(import_node_path7.posix.join(base, target.replace(/\/\*$/, "")));
  }
  return out2;
}
function renderRouteSummary(map) {
  const out2 = [];
  for (const table of map.tables) {
    if (!table.found) {
      out2.push(`${table.file}  ${table.surface}  not found`);
      continue;
    }
    const extra = [
      table.unresolved.length > 0 ? `unresolved: ${table.unresolved.join(", ")}` : "",
      table.pageless.length > 0 ? `no page module: ${table.pageless.join(", ")}` : ""
    ].filter(Boolean);
    out2.push(`${table.file}  ${table.surface}  ${table.resolved} of ${table.rows} route(s) resolved${extra.length > 0 ? `; ${extra.join("; ")}` : ""}`);
  }
  out2.push("");
  for (const union of map.unions) {
    out2.push(`${union.union}  (${union.kind}, ${union.mechanism ?? "no mechanism"})  ${union.anchor}`);
    if (union.routes.length === 0) out2.push(`    no route: ${union.why ?? "none"}`);
    for (const route of union.routes.slice(0, 8)) {
      out2.push(`    ${route.surface.padEnd(8)} ${route.route.padEnd(28)} ${route.dynamic ? "dynamic " : "        "}d=${route.distance}  ${route.page ?? ""}`);
    }
    if (union.routes.length > 8) out2.push(`    and ${union.routes.length - 8} more`);
  }
  return out2.join("\n");
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

// src/states/services/forge.mts
async function captureForged(seed, member, ctx) {
  const started = ctx.now();
  const id = `${seed.union}.${member}`;
  const rel = statePath(ctx.slug, id, "forged", "json");
  const file = import_node_path9.posix.join(ctx.reportDir, rel);
  const artifact = {
    union: seed.union,
    member,
    via: seed.via,
    provenance: "forged",
    fields: seed.fields,
    reason: seed.reason,
    note: FORGE_CAVEAT
  };
  (0, import_node_fs7.mkdirSync)((0, import_node_path9.dirname)(file), { recursive: true });
  (0, import_node_fs7.writeFileSync)(file, `${JSON.stringify(artifact, null, 2)}
`);
  await ctx.record({ file, kind: "log", row: id });
  return {
    id,
    union: seed.union,
    member,
    ok: true,
    subject: null,
    context: null,
    provenance: "forged",
    // No feature function runs over a forged seed. Null is "not checked", never "it agreed".
    verified: null,
    error: null,
    expect: `forged seed via ${seed.via}: a live apply renders ${seed.union}=${member}. Not proven here.`,
    ms: ctx.now() - started
  };
}
var import_node_fs7, import_node_path9, FORGE_CAVEAT;
var init_forge = __esm({
  "src/states/services/forge.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs7 = require("fs");
    import_node_path9 = require("path");
    init_inventory();
    FORGE_CAVEAT = "A forged capture records the inferred seed only. A live apply needs a running app on the real route to render and photograph the state.";
  }
});

// src/states/services/loop.mts
function reasonOf(row) {
  return FAIL_REASONS.includes(row?.reason) ? row?.reason : "crashed";
}
function parseInventory(text, source) {
  let parsed;
  try {
    parsed = JSON.parse(text);
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
function parseResults(text) {
  const attempts = [];
  const malformed = [];
  for (const line of text.split("\n")) {
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
  const byId = /* @__PURE__ */ new Map();
  for (const attempt of attempts) byId.set(attempt.id, attempt);
  const rows = [];
  const claimed = /* @__PURE__ */ new Set();
  for (const capture of captures) {
    const attempt = byId.get(capture.id);
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
function cell(text) {
  return String(text ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}
function provenanceLabel(provenance) {
  if (provenance === "live") return null;
  if (provenance && PROVENANCE.includes(provenance)) return `(${provenance})`;
  return "(provenance not reported)";
}
function verifiedCell(row) {
  if (row.verified === true) return row.answered ? `yes (${cell(row.answered)})` : "yes";
  if (row.verified === false) return "no";
  return "not verified";
}
function stateCell(union, row) {
  if (row.member === null) return "`null` (the function returned nothing)";
  if (row.member !== void 0) return cell(row.member);
  const key = row.id.startsWith(`${union.name}.`) ? row.id.slice(union.name.length + 1) : row.id;
  return cell(key.replace(/#/g, ", ").replace(/-/g, " "));
}
function orderRows(union, rows) {
  const planned = rows.filter((row) => !row.extra);
  const extras = rows.filter((row) => row.extra);
  const taken = /* @__PURE__ */ new Set();
  const out2 = [];
  for (const row of planned) {
    out2.push(row);
    if (row.member === null || row.member === void 0) continue;
    for (const extra of extras) {
      if (taken.has(extra) || !extra.id.startsWith(`${union.name}.${row.member}#`)) continue;
      taken.add(extra);
      out2.push(extra);
    }
  }
  for (const extra of extras) if (!taken.has(extra)) out2.push(extra);
  return out2;
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
  const out2 = [];
  const totals = { covered: 0, planned: 0 };
  out2.push(`## State coverage${slug ? `: ${slug}` : ""}`);
  out2.push("");
  if (narrowedBy) out2.push(`Narrowed to ${narrowedBy}: ${inventory.unions.length} union(s) its files declare or consume.`);
  out2.push(
    "A shot marked `(intercepted)` comes through a rewritten API response: the component is real and the data is synthetic. `(mounted)` is the harness drawing the component directly. A shot with no label comes from live data."
  );
  for (const [mechanism, why] of Object.entries(notRun)) {
    out2.push("");
    out2.push(`Mechanism \`${mechanism}\` did not run: ${why}. Every capture it owns is uncovered below.`);
  }
  out2.push("");
  for (const union of inventory.unions) {
    const mine = rows.filter((row) => row.id.startsWith(`${union.name}.`));
    const { covered, planned } = coverageFor(union, mine);
    totals.covered += covered;
    totals.planned += planned;
    out2.push(`### ${subjectLabel(union)}: ${union.name}, ${covered} of ${planned} renderings`);
    out2.push("");
    out2.push("| State | Shot | Expect | Verified |");
    out2.push("|---|---|---|---|");
    for (const row of orderRows(union, mine)) {
      const label = provenanceLabel(row.provenance);
      const shot = row.ok ? [row.subject ? `![${cell(row.id)}](${row.subject})` : "shot, but no path reported", label].filter(Boolean).join(" ") : "not shot";
      const expect = row.ok ? cell(row.expect ?? "-") : cell(refusalFor(row));
      out2.push(`| ${stateCell(union, row)} | ${shot} | ${expect || "-"} | ${verifiedCell(row)} |`);
    }
    out2.push("");
  }
  const orphans = rows.filter((row) => row.extra && !unionOf(inventory, row.id));
  if (orphans.length > 0) {
    out2.push("### Reported by the runner, and in no union of the inventory");
    out2.push("");
    for (const row of orphans) out2.push(`- \`${cell(row.id)}\` (${row.ok ? "ok" : "failed"})`);
    out2.push("");
  }
  out2.push(`${inventory.unions.length} union(s), ${totals.covered} of ${totals.planned} renderings.`);
  return out2.join("\n");
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
  const out2 = [];
  const byMechanism = /* @__PURE__ */ new Map();
  for (const capture of plan2.captures) {
    const key = capture.mechanism ?? "none";
    byMechanism.set(key, (byMechanism.get(key) ?? 0) + 1);
  }
  out2.push(`inventory  ${plan2.source}, ${plan2.scanned} union(s)`);
  if (plan2.narrowedBy) out2.push(`narrowed   ${plan2.inventory.unions.length} of ${plan2.scanned} union(s) kept by ${plan2.narrowedBy}`);
  const parts = ["mount", "solve", "none"].filter((key) => byMechanism.has(key)).map((key) => `${key} ${byMechanism.get(key)}`).join(", ");
  out2.push(`captures   ${plan2.captures.length}${parts ? ` (${parts})` : ""}`);
  out2.push("");
  for (const union of plan2.inventory.unions) {
    const mine = plan2.captures.filter((capture) => capture.union === union.name);
    out2.push(
      `  ${union.name.padEnd(24)} ${union.kind.padEnd(8)} ${String(mechanismFor(union.kind) ?? "none").padEnd(6)} ${String(mine.length).padStart(3)} capture(s)  ${union.file}`
    );
  }
  return out2;
}
function renderNeither(inventory) {
  const neither = neitherUnions(inventory);
  if (neither.length === 0) return [];
  const out2 = ["", `REFUSED   ${neither.length} union(s) are neither an input nor an output (spec 2.14 rule C1). Each one earns an issue:`];
  for (const union of neither) {
    const issue = issueFor(union);
    out2.push("", `-- issue ${"-".repeat(60)}`, issue.title, "", issue.body, "-".repeat(69));
  }
  return out2;
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
    await session.screenshot(import_node_path10.posix.join(ctx.reportDir, subject));
    await ctx.record({ file: import_node_path10.posix.join(ctx.reportDir, subject), kind: "screenshot", row: r.capture.id });
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
var import_node_path10, STATES_HARNESS_PATH, HARNESS_ATTRIBUTE, SUBJECT_CHILD, HARNESS_ERROR, DEFAULT_MOUNT_SETTLE, memberKey, condense;
var init_mount = __esm({
  "src/states/services/mount.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path10 = require("path");
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

// src/services/changes.mts
function git(repo, args, opts = {}) {
  const res = (0, import_node_child_process.spawnSync)("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: GIT_TIMEOUT_MS, killSignal: "SIGKILL" });
  if (res.error) throw new LaunchwrightError("qa.git", `Cannot run git ${args.join(" ")}: ${res.error.message}`, { cause: res.error, context: { repo } });
  if (res.status !== 0) {
    if (opts.allowFail) return null;
    throw new LaunchwrightError("qa.git", `git ${args.join(" ")} failed: ${(res.stderr ?? "").trim()}`, { context: { repo, args } });
  }
  return res.stdout;
}
var import_node_child_process, import_node_fs8, import_node_path11, RECORD, FIELD, LOG_FORMAT, GIT_TIMEOUT_MS;
var init_changes = __esm({
  "src/services/changes.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process = require("child_process");
    import_node_fs8 = require("fs");
    import_node_path11 = require("path");
    init_kernel();
    RECORD = "";
    FIELD = "";
    LOG_FORMAT = `${RECORD}%H${FIELD}%h${FIELD}%cI${FIELD}%an${FIELD}%s`;
    GIT_TIMEOUT_MS = 12e4;
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
function crc32(bytes) {
  let c = 4294967295;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function chunk(type, data) {
  const out2 = Buffer.alloc(12 + data.length);
  out2.writeUInt32BE(data.length, 0);
  out2.write(type, 4, "ascii");
  Buffer.from(data).copy(out2, 8);
  out2.writeUInt32BE(crc32(out2.subarray(4, 8 + data.length)), 8 + data.length);
  return out2;
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
var import_node_child_process2, MIN_VIDEO_S;
var init_video = __esm({
  "src/services/video.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process2 = require("child_process");
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

// src/services/runner.mts
var import_node_fs9, import_promises5, import_node_path12;
var init_runner = __esm({
  "src/services/runner.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs9 = require("fs");
    import_promises5 = require("fs/promises");
    import_node_path12 = require("path");
    init_kernel();
    init_evidence();
    init_ledger();
    init_legs();
    init_manifest2();
    init_video();
    init_mount();
  }
});

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION;
var init_contract = __esm({
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
function write(path, bytes) {
  (0, import_node_fs10.mkdirSync)((0, import_node_path13.dirname)(path), { recursive: true });
  (0, import_node_fs10.writeFileSync)(path, bytes);
}
function capabilityError(target, capability, what) {
  return new LaunchwrightError("qa.target.capability", `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability }
  });
}
function createFakeTarget(opts = {}) {
  return new FakeTargetImpl(opts);
}
var import_node_fs10, import_node_path13, FAKE_SHOT_SIZE, FAKE_CLIP_MS, DEFAULT_CAPABILITIES, CLIP_BASE64, FAKE_CLIP, FakeSession, FakeTargetImpl;
var init_fake = __esm({
  "src/drivers/target/fake.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs10 = require("fs");
    import_node_path13 = require("path");
    init_kernel();
    init_png();
    init_contract();
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
var import_node_fs11, import_node_path14, PERSONA_SESSION_ROUTE, CAPABILITIES, MIN_CLIP_MS, importPlaywright, SETTLE_SCRIPTS, PlaywrightSession, PlaywrightTarget;
var init_playwright = __esm({
  "src/drivers/target/playwright.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs11 = require("fs");
    import_node_path14 = require("path");
    init_kernel();
    init_png();
    init_video();
    init_contract();
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
        (0, import_node_fs11.mkdirSync)((0, import_node_path14.dirname)(path), { recursive: true });
        const png = await this.page.screenshot({ path, animations: "disabled", fullPage: false });
        const size = pngSize(png);
        if (size === null) throw new LaunchwrightError("qa.target.screenshot", `Leg ${this.opts.leg.name} wrote a screenshot that is not a PNG: ${path}.`);
        return { path, ...size };
      }
      async startVideo(path) {
        if (this.videoPath !== null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} already records ${this.videoPath}.`);
        (0, import_node_fs11.mkdirSync)((0, import_node_path14.dirname)(path), { recursive: true });
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
        (0, import_node_fs11.mkdirSync)((0, import_node_path14.dirname)(path), { recursive: true });
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
    init_fake();
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
          path: (0, import_node_path15.relative)(args.reportDir, file).split("\\").join("/"),
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
var import_node_path15;
var init_run = __esm({
  "src/states/services/run.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path15 = require("path");
    init_kernel();
    init_changes();
    init_ledger();
    init_legs();
    init_runner();
    init_targets();
    init_tokens2();
  }
});

// src/commands/qa-states.mts
function flag(args, name) {
  return args.values[name] ?? null;
}
function list(value) {
  return value === null ? void 0 : value.split(",").map((s) => s.trim()).filter(Boolean);
}
function writeJson(path, value) {
  (0, import_node_fs12.mkdirSync)((0, import_node_path16.dirname)(path), { recursive: true });
  (0, import_node_fs12.writeFileSync)(path, `${JSON.stringify(value, null, 2)}
`);
}
function runFiles(cwd, slug) {
  return { plan: (0, import_node_path16.join)(cwd, ".lw/qa/states", `${slug}.plan.json`), results: (0, import_node_path16.join)(cwd, ".lw/qa/states", `${slug}.results.jsonl`) };
}
function narrowOf(args) {
  const files = list(flag(args, "files"));
  const dirs = list(flag(args, "dirs"));
  if (!files && !dirs) return void 0;
  return { ...files ? { files } : {}, ...dirs ? { dirs } : {}, label: [...files ?? [], ...dirs ?? []].join(", ") };
}
function freshInventory(cwd, config, generated) {
  const { inventory } = scanStates(cwd, config, generated);
  const deliveryPath = (0, import_node_path16.join)(cwd, DELIVERY_FILE);
  if (!(0, import_node_fs12.existsSync)(deliveryPath)) return inventory;
  let delivery;
  try {
    delivery = JSON.parse((0, import_node_fs12.readFileSync)(deliveryPath, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.states.delivery", `${DELIVERY_FILE} is not JSON`, { cause, context: { path: deliveryPath } });
  }
  return mergeDelivery(inventory, delivery);
}
function scan(args, opts, config, generated) {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  writeJson((0, import_node_path16.join)(opts.cwd, STATES_FILE), { ...result.inventory, tables: result.map.tables, problems: result.problems });
  if (args.switches.has("json")) {
    opts.out(JSON.stringify(result.inventory, null, 2));
  } else {
    const states = result.inventory.unions.reduce((n, u) => n + u.members.length, 0);
    const kinds2 = /* @__PURE__ */ new Map();
    for (const u of result.inventory.unions) kinds2.set(u.kind, (kinds2.get(u.kind) ?? 0) + 1);
    const tally = [...kinds2].sort().map(([k, n]) => `${n} ${k}`).join(", ");
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
async function applyForged(args, opts, config, proposals, app, overrides) {
  if (proposals.length === 0) {
    opts.out("no declared state needs a forged seed: every state has a seed or a route.");
    return 0;
  }
  const slug = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const reportDir = (0, import_node_path16.resolve)(opts.cwd, config.reportDir);
  const clock = runClock(app, overrides);
  const revision = (overrides.revision ?? gitRevision)(opts.cwd);
  const recorder2 = ledgerRecorder({ reportDir, slug, leg, provenance: "forged", clock, revision });
  const now = () => clock.now();
  for (const seed of proposals) {
    for (const member of seed.members) await captureForged(seed, member, { reportDir, slug, record: recorder2.record, now });
  }
  const recorded = await recorder2.flush();
  opts.out(`applied ${proposals.length} forged seed(s): ${recorded} forged capture(s) -> ${(0, import_node_path16.relative)(opts.cwd, reportPaths(reportDir, slug).ledger)}`);
  opts.out(FORGE_CAVEAT);
  for (const seed of proposals) opts.out(`  forged ${seed.union} via ${seed.via}: members ${seed.members.join(", ")}.`);
  return 0;
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
  const reportDir = (0, import_node_path16.resolve)(opts.cwd, config.reportDir);
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
      session = await target.open({ leg, baseUrl: base, outDir: (0, import_node_path16.join)(reportPaths(reportDir, slug).assets, "states") });
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
  writeJson(files.plan, { ...built, notRun, blocked });
  (0, import_node_fs12.mkdirSync)((0, import_node_path16.dirname)(files.results), { recursive: true });
  (0, import_node_fs12.writeFileSync)(files.results, attempts.map((a) => `${JSON.stringify(a)}
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
  if (!(0, import_node_fs12.existsSync)(files.plan)) throw new LaunchwrightError("qa.states.no-run", `No state run of slug ${slug}: ${files.plan} does not exist. Run "lw qa states run" first.`);
  const saved = JSON.parse((0, import_node_fs12.readFileSync)(files.plan, "utf8"));
  const inventory = parseInventory(JSON.stringify(saved.inventory), files.plan);
  const { attempts, malformed } = parseResults((0, import_node_fs12.existsSync)(files.results) ? (0, import_node_fs12.readFileSync)(files.results, "utf8") : "");
  const finished = finishRun({ plan: { ...saved, inventory }, attempts, malformed, notRun: saved.notRun ?? {}, blocked: saved.blocked ?? {} });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}
function createStatesCommand(overrides = {}) {
  return {
    name: "states",
    summary: "Scan the state unions, plan, capture mounted and intercepted states, report coverage",
    async run(args, opts) {
      const [action, ...rest] = args;
      if (!action || !["scan", "plan", "infer", "run", "report"].includes(action)) {
        for (const line of USAGE) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const cwd = (0, import_node_path16.isAbsolute)(opts.cwd) ? opts.cwd : (0, import_node_path16.resolve)(opts.cwd);
      const inner = { ...opts, cwd };
      try {
        const flags = parseCommandArgs(FLAGS[action], rest);
        const app = opts.app;
        if (action === "run") return await run(flags, inner, config, runDeps(config, app, overrides, opts.targets));
        if (action === "report") return report(flags, inner);
        const generated = runClock(app, overrides).date().toISOString();
        if (action === "scan") return scan(flags, inner, config, generated);
        if (action === "infer") return await infer(flags, inner, config, generated, app, overrides);
        return plan(flags, inner, config, generated);
      } catch (cause) {
        if (!isCodedError(cause)) throw cause;
        opts.err(`lw qa states ${action}: ${cause.code}: ${cause.message}`);
        return cause instanceof UsageError || cause.code === "qa.states.usage" ? 2 : 1;
      }
    }
  };
}
var import_node_fs12, import_node_path16, USAGE, DEFAULT_SLUG, DEFAULT_FORGE_SLUG, DEFAULT_LEG, DELIVERY_FILE, FLAGS, qa_states_default;
var init_qa_states = __esm({
  "src/commands/qa-states.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs12 = require("fs");
    import_node_path16 = require("path");
    init_kernel();
    init_args();
    init_config2();
    init_ledger();
    init_capture();
    init_check();
    init_delivery();
    init_forge();
    init_inventory();
    init_loop();
    init_mount();
    init_project2();
    init_run();
    USAGE = [
      "usage: lw qa states <scan|plan|infer|run|report> [options]",
      "  scan   [--json]                       read the client roots, derive each route, write .lw/qa/states.json.",
      "                                        Exit 1 on a union no trigger reaches (rules C1, C4) or a bad ignore tag",
      "  plan   [--json] [--files a,b] [--dirs d,e]   print every planned capture. Exit 1 on a neither union",
      "  infer  [--json] [--apply] [--slug <slug>] [--leg <name>]   propose a forged seed for each state no seed and no",
      "                                        route reaches, or with --apply record each as a forged capture (spec 2.5)",
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
    init_config2();
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
var init_mime = __esm({
  "src/services/mime.mts"() {
    "use strict";
    init_cjs_shims();
  }
});

// src/services/records.mts
var import_promises6, import_node_path17;
var init_records = __esm({
  "src/services/records.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises6 = require("fs/promises");
    import_node_path17 = require("path");
    init_kernel();
    init_fs();
    init_mime();
    init_types();
  }
});

// src/services/contract.mts
function credentialNeed(envKey, value, legs) {
  const present = value !== void 0 && value !== "";
  return {
    key: envKey,
    present,
    ...present ? { fingerprint: sha256(value).slice(0, FINGERPRINT_LENGTH) } : {},
    ...legs && legs.length > 0 ? { legs: [...legs] } : {}
  };
}
var import_promises7, import_node_path18, FINGERPRINT_LENGTH;
var init_contract2 = __esm({
  "src/services/contract.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises7 = require("fs/promises");
    import_node_path18 = require("path");
    init_kernel();
    init_fs();
    FINGERPRINT_LENGTH = 12;
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
var import_promises8, import_node_path19;
var init_bot_store = __esm({
  "src/services/bot-store.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises8 = require("fs/promises");
    import_node_path19 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/comments.mts
var import_node_crypto3, import_promises9, import_node_path20;
var init_comments = __esm({
  "src/services/comments.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto3 = require("crypto");
    import_promises9 = require("fs/promises");
    import_node_path20 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/comment-export.mts
var import_promises10, import_node_path21;
var init_comment_export = __esm({
  "src/services/comment-export.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises10 = require("fs/promises");
    import_node_path21 = require("path");
    init_kernel();
    init_manifest2();
    init_png();
  }
});

// src/services/comment-server.mts
var import_node_http, import_promises11, import_node_path22, MAX_BODY;
var init_comment_server = __esm({
  "src/services/comment-server.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_http = require("http");
    import_promises11 = require("fs/promises");
    import_node_path22 = require("path");
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
    init_config2();
    init_contract();
    init_playwright();
    init_errors();
    init_provider2();
    init_mime();
    init_png();
    init_records();
    init_contract2();
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

// src/device/services/device-kinds.mts
function registerDeviceKind(name, kind) {
  kinds.set(name, Object.freeze({ ...kind }));
}
function deviceKindNames() {
  return [...kinds.keys()].sort();
}
function deviceKind(kind) {
  const found = kinds.get(kind);
  if (found === void 0) {
    throw new LaunchwrightError("qa.device.kind", `No device kind ${kind}. Kinds: ${deviceKindNames().join(", ")}. registerDeviceKind adds one.`, { context: { kind } });
  }
  return found;
}
var kinds;
var init_device_kinds = __esm({
  "src/device/services/device-kinds.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    kinds = /* @__PURE__ */ new Map();
    registerDeviceKind("android", { access: "adb", target: "android-adb" });
    registerDeviceKind("android-emulator", { access: "adb", target: "android-emulator", emulator: true });
    registerDeviceKind("ios", { access: "webkit", target: "ios-webkit" });
    registerDeviceKind("ios-simulator", { access: "webkit", target: "ios-simulator", simulator: true });
    registerDeviceKind("ios-safari", { access: "webdriver", target: "browserstack", browser: "safari" });
    registerDeviceKind("android-chrome", { access: "webdriver", target: "browserstack", browser: "chrome", console: true });
  }
});

// src/device/config.mts
function issuesOf(error) {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
function withDevice(cfg) {
  const parsed = qaDeviceConfig.safeParse(cfg.device);
  if (parsed.success) return { ...cfg, device: parsed.data };
  const issues = issuesOf(parsed.error);
  throw new LaunchwrightError("qa.device.config", `qa.device is not valid: ${issues}.`, { cause: parsed.error });
}
function qaConfigOf2(sections = {}) {
  return withDevice(qaConfigOf(sections));
}
function deviceKeys(name, device, schema) {
  const parsed = schema.safeParse(device);
  if (parsed.success) return parsed.data;
  const issues = issuesOf(parsed.error);
  throw new LaunchwrightError("qa.device.config", `qa.device.devices.${name} (kind ${device.kind}) is not valid: ${issues}.`, {
    cause: parsed.error,
    context: { device: name, kind: device.kind }
  });
}
var hostProxyConfig, deviceToolsConfig, telegramDeviceConfig, browserstackConfig, rigConfig, deviceConfig, qaDeviceConfig, recorder, androidDeviceKeys, emulatorDeviceKeys, iosDeviceKeys, simulatorDeviceKeys, cloudDeviceKeys;
var init_config3 = __esm({
  "src/device/config.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_src();
    init_device_kinds();
    hostProxyConfig = import_zod6.z.object({
      /** The address that serves the tunnel hostname, for example the tailnet address of the ingress. */
      upstream: import_zod6.z.string().min(1),
      /** The loopback port of the proxy on the rig, and of `adb reverse` on the device. */
      port: import_zod6.z.number().int().positive().default(8899)
    });
    deviceToolsConfig = import_zod6.z.object({
      adb: import_zod6.z.string().min(1).default("adb"),
      ssh: import_zod6.z.string().min(1).default("ssh"),
      scrcpy: import_zod6.z.string().min(1).default("scrcpy"),
      /** The scrcpy version the doctor accepts as the minimum. Older builds fail on Android 15 and later. */
      scrcpyVersion: import_zod6.z.string().regex(/^\d+(\.\d+)*$/).default("3.1"),
      ffmpeg: import_zod6.z.string().min(1).default("ffmpeg")
    });
    telegramDeviceConfig = import_zod6.z.object({
      /** The Android package of the Telegram build on the device. */
      package: import_zod6.z.string().min(1).default("org.telegram.messenger.web"),
      /** Where `lw qa device install` fetches the APK. */
      apkUrl: import_zod6.z.string().url().default("https://telegram.org/dl/android/apk"),
      /** The SHA-256 the fetched APK must have. `install` refuses an APK without a pin. */
      apkSha256: import_zod6.z.string().regex(/^[0-9a-f]{64}$/).optional()
    });
    browserstackConfig = import_zod6.z.object({
      username: import_zod6.z.string().min(1).optional(),
      accessKey: import_zod6.z.string().min(1).optional(),
      hub: import_zod6.z.string().url().default("https://hub-cloud.browserstack.com/wd/hub"),
      api: import_zod6.z.string().url().default("https://api.browserstack.com/automate"),
      /** The minutes one run may spend. A session past it closes with `qa.device.browserstack.budget`. */
      budgetMinutes: import_zod6.z.number().positive().default(5),
      /** Seconds a session may sit idle before BrowserStack ends it. Its own ceiling is 300. */
      idleTimeoutS: import_zod6.z.number().int().min(1).max(300).default(120),
      project: import_zod6.z.string().min(1).default("launchwright-qa"),
      build: import_zod6.z.string().min(1).default("qa")
    });
    rigConfig = import_zod6.z.object({
      transport: import_zod6.z.enum(["local", "ssh", "cloud"]),
      host: import_zod6.z.string().optional(),
      adbPort: import_zod6.z.number().int().positive().optional(),
      webkitPorts: import_zod6.z.array(import_zod6.z.number().int().positive()).optional(),
      ingress: import_zod6.z.enum(["direct", "host-proxy"]).default("direct"),
      /** The proxy target of `ingress: host-proxy`. */
      hostProxy: hostProxyConfig.optional()
    });
    deviceConfig = import_zod6.z.object({
      rig: import_zod6.z.string().min(1),
      /** A kind of `registerDeviceKind`: the built-in ones, or one that the project adds. */
      kind: import_zod6.z.string().min(1).refine((kind) => deviceKindNames().includes(kind), "is no registered device kind; registerDeviceKind adds one")
    }).passthrough();
    qaDeviceConfig = import_zod6.z.object({
      rigs: import_zod6.z.record(import_zod6.z.string(), rigConfig).prefault({ local: { transport: "local" } }),
      devices: import_zod6.z.record(import_zod6.z.string(), deviceConfig).default({}),
      tools: deviceToolsConfig.prefault({}),
      telegram: telegramDeviceConfig.prefault({}),
      browserstack: browserstackConfig.prefault({})
    }).prefault({});
    recorder = import_zod6.z.enum(["screenrecord", "scrcpy"]).default("screenrecord");
    androidDeviceKeys = import_zod6.z.object({
      serial: import_zod6.z.string().min(1),
      recorder,
      /** The browser package for a `web` leg. */
      browserPackage: import_zod6.z.string().min(1).default("com.android.chrome")
    });
    emulatorDeviceKeys = import_zod6.z.object({
      /** The AVD name. Letters, digits, `.`, `_` and `-`, as `avdmanager` allows. */
      avd: import_zod6.z.string().regex(/^[\w.-]+$/),
      /** The emulator console port. Even, 5554 to 5682. The serial is `emulator-<port>`. */
      port: import_zod6.z.number().int().min(5554).max(5682).refine((p) => p % 2 === 0, "the console port is even").default(5554),
      gpu: import_zod6.z.string().min(1).default("swiftshader_indirect"),
      recorder,
      browserPackage: import_zod6.z.string().min(1).default("com.android.chrome")
    });
    iosDeviceKeys = import_zod6.z.object({
      /** Picks the phone out of the proxy device list. Never printed. */
      udid: import_zod6.z.string().min(1).optional(),
      /** A substring of the page URL or title. Default: the host of the leg base URL. */
      match: import_zod6.z.string().min(1).optional()
    });
    simulatorDeviceKeys = import_zod6.z.object({
      /** The simulator UDID. Default: the booted simulator. */
      udid: import_zod6.z.string().min(1).optional(),
      /** The tool that taps on the simulator. `simctl` has no input verb, so the target is not ready without one. */
      inputTool: import_zod6.z.string().min(1).optional(),
      /**
       * The rig port of an `ios_webkit_debug_proxy` that serves the simulator (`-s unix:<webinspectord_sim socket>`).
       * Settle, the route and the logs read the page through it.
       */
      inspectorPort: import_zod6.z.number().int().positive().optional()
    });
    cloudDeviceKeys = import_zod6.z.object({
      model: import_zod6.z.string().min(1),
      os: import_zod6.z.string().min(1)
    });
  }
});

// src/device/services/process.mts
function out(res) {
  return res.stdout.toString("utf8");
}
function said(res) {
  return (res.stderr.trim() || out(res).trim()).slice(0, 600);
}
function orFail(res, code, what, context = {}) {
  if (res.code === 0) return out(res);
  throw new LaunchwrightError(code, `${what} failed (exit ${res.code}): ${said(res) || "no output"}`, { context: { ...context, exit: res.code } });
}
function collect(cmd, args, opts) {
  const child = (0, import_node_child_process3.spawn)(cmd, args, {
    stdio: [opts.input === void 0 ? "ignore" : "pipe", "pipe", "pipe"],
    ...opts.env ? { env: { ...process.env, ...opts.env } } : {},
    ...opts.detached ? { detached: true } : {}
  });
  const chunks = [];
  let stderr = "";
  let timer;
  const done = new Promise((resolve5) => {
    child.stdout?.on("data", (d) => chunks.push(d));
    child.stderr?.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve5({ code: -1, stdout: Buffer.concat(chunks), stderr: `${cmd}: ${e.message}` });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve5({ code: code ?? (signal ? 128 : -1), stdout: Buffer.concat(chunks), stderr });
    });
  });
  if (opts.input !== void 0) {
    child.stdin?.on("error", (e) => {
      if (e.code !== "EPIPE") stderr += `stdin: ${e.message}`;
    });
    child.stdin?.end(opts.input);
  }
  if (opts.timeoutMs !== NO_TIMEOUT) {
    timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs);
  }
  return {
    done,
    signal(sig) {
      child.kill(sig);
    }
  };
}
function freeLoopbackPort() {
  return new Promise((resolve5, reject) => {
    const srv = (0, import_node_net.createServer)();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve5(port));
    });
  });
}
function systemDeviceDeps(root) {
  return {
    root,
    run: nodeRunner,
    socket: globalSocket,
    fetch: (input, init) => fetch(input, init),
    clock: { now: () => systemClock.now(), sleep: (ms) => systemClock.sleep(ms) },
    freePort: freeLoopbackPort
  };
}
function deferred() {
  let resolve5;
  let reject;
  const promise = new Promise((ok, no) => {
    resolve5 = ok;
    reject = no;
  });
  return { promise, resolve: resolve5, reject };
}
async function poll(clock, probe, opts) {
  const deadline = clock.now() + opts.timeoutMs;
  for (; ; ) {
    const value = await probe();
    if (value !== null) return value;
    if (clock.now() >= deadline) {
      throw new LaunchwrightError(opts.code, `${opts.what} did not happen within ${Math.round(opts.timeoutMs / 1e3)} s.`);
    }
    await clock.sleep(opts.everyMs);
  }
}
var import_node_child_process3, import_node_net, DEFAULT_RUN_TIMEOUT_MS, NO_TIMEOUT, nodeRunner, globalSocket;
var init_process = __esm({
  "src/device/services/process.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process3 = require("child_process");
    import_node_net = require("net");
    init_kernel();
    DEFAULT_RUN_TIMEOUT_MS = 12e4;
    NO_TIMEOUT = "none";
    nodeRunner = {
      run: (cmd, args, opts = {}) => collect(cmd, args, { ...opts, timeoutMs: opts.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS }).done,
      start: (cmd, args, opts) => collect(cmd, args, opts)
    };
    globalSocket = (url, opts) => {
      const init = opts?.origin ? { headers: { origin: opts.origin } } : void 0;
      return new WebSocket(url, init);
    };
  }
});

// src/device/services/adb.mts
function createAdb(rig, serial, deps, bin) {
  const argv = async (args) => [...await rig.adbServer(), "-s", serial, ...args];
  const adb = {
    serial,
    rig,
    async run(args, opts) {
      return deps.run.run(bin, await argv(args), { timeoutMs: opts?.timeoutMs ?? 6e4 });
    },
    async start(args, opts) {
      return deps.run.start(bin, await argv(args), opts);
    },
    async shell(args, code = "qa.device.adb") {
      return orFail(await adb.run(["shell", ...args]), code, `adb -s ${serial} shell ${args.join(" ")}`, { serial });
    }
  };
  return adb;
}
function parseDevices(stdout) {
  return stdout.split("\n").slice(1).map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 2 && p[0]).map(([serial, state]) => ({ serial, state }));
}
async function deviceState(rig, serial, deps, bin) {
  const res = await deps.run.run(bin, [...await rig.adbServer(), "devices"]);
  if (res.code !== 0) {
    throw new LaunchwrightError("qa.device.adb", `adb devices failed (exit ${res.code}): ${said(res)}`, { context: { rig: rig.name } });
  }
  return parseDevices(out(res)).find((d) => d.serial === serial)?.state ?? "absent";
}
function parseKeyguard(text) {
  const block = text.slice(text.indexOf("KeyguardServiceDelegate"));
  if (!/^\s*showing=true\b/m.test(block)) return "open";
  return /^\s*inputRestricted=true\b/m.test(block) ? "credential" : "swipe";
}
async function keyguard(adb) {
  return parseKeyguard(await adb.shell(["dumpsys", "window", "policy"]));
}
function decodeEntities(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function parseNodes(xml) {
  const nodes = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attrs = {};
    for (const a of (m[1] ?? "").matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = decodeEntities(a[2]);
    const b = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attrs.bounds ?? "");
    nodes.push({
      text: attrs.text ?? "",
      desc: attrs["content-desc"] ?? "",
      id: attrs["resource-id"] ?? "",
      cls: attrs.class ?? "",
      clickable: attrs.clickable === "true",
      bounds: b ? { x1: Number(b[1]), y1: Number(b[2]), x2: Number(b[3]), y2: Number(b[4]) } : null
    });
  }
  return nodes;
}
function findNode(nodes, needle) {
  return nodes.filter((n) => n.bounds && labelOf(n).includes(needle)).sort((a, b) => labelOf(a).length - labelOf(b).length)[0] ?? null;
}
function parseWmSize(stdout) {
  const over = /Override size:\s*(\d+)x(\d+)/.exec(stdout);
  const phys = /Physical size:\s*(\d+)x(\d+)/.exec(stdout);
  const m = over ?? phys;
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}
async function uiDump(adb) {
  const dumped = await adb.run(["shell", "uiautomator", "dump", DUMP_PATH]);
  if (!/dumped to/i.test(`${out(dumped)}${dumped.stderr}`)) return null;
  const read = await adb.run(["shell", "cat", DUMP_PATH]);
  const xml = out(read);
  return read.code === 0 && xml.includes("<hierarchy") ? xml : null;
}
async function screencap(adb) {
  const res = await adb.run(["exec-out", "screencap", "-p"]);
  if (res.code !== 0) throw new LaunchwrightError("qa.device.screencap", `screencap on ${adb.serial} failed: ${said(res)}`, { context: { serial: adb.serial } });
  if (!res.stdout.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new LaunchwrightError("qa.device.screencap", `screencap on ${adb.serial} returned ${res.stdout.length} bytes that are not a PNG.`, {
      context: { serial: adb.serial }
    });
  }
  return res.stdout;
}
async function tap(adb, x, y) {
  await adb.shell(["input", "tap", String(Math.round(x)), String(Math.round(y))]);
}
async function backGesture(adb, height) {
  const y = String(Math.round(height / 2));
  await adb.shell(["input", "swipe", "2", y, String(Math.round(height / 3)), y, "200"]);
}
async function keyevent(adb, key) {
  await adb.shell(["input", "keyevent", key]);
}
async function wmSize(adb) {
  const text = await adb.shell(["wm", "size"]);
  const size = parseWmSize(text);
  if (!size) throw new LaunchwrightError("qa.device.adb", `wm size on ${adb.serial} printed no size: ${text.trim().slice(0, 120)}`);
  return size;
}
function screenrecordCapS(seconds) {
  return Math.min(Math.max(1, Math.round(seconds)), SCREENRECORD_MAX_S);
}
function screenrecordArgs(seconds, remote, size) {
  const capped = screenrecordCapS(seconds);
  return ["shell", "screenrecord", "--time-limit", String(capped), ...size ? ["--size", size] : [], remote];
}
async function startScreenrecord(adb, deps, seconds, label) {
  const remote = `/sdcard/lw-qa-${label.replace(/[^\w.-]/g, "_")}.mp4`;
  await adb.run(["shell", "rm", "-f", remote]);
  const proc = await adb.start(screenrecordArgs(seconds, remote), { timeoutMs: (screenrecordCapS(seconds) + SCREENRECORD_GRACE_S) * 1e3 });
  const startedAt = deps.clock.now();
  return {
    path: remote,
    startedAt,
    async stop() {
      await adb.run(["shell", "pkill", "-INT", "-x", "screenrecord"]);
      await proc.done;
      const pulled = await adb.run(["exec-out", "cat", remote], { timeoutMs: 12e4 });
      if (pulled.code !== 0 || pulled.stdout.length === 0) {
        throw new LaunchwrightError("qa.device.record", `pulling ${remote} from ${adb.serial} failed: ${said(pulled) || "empty file"}`);
      }
      if (pulled.stdout.subarray(4, 8).toString("latin1") !== "ftyp") {
        throw new LaunchwrightError("qa.device.record", `${remote} on ${adb.serial} is not an MP4 (${pulled.stdout.length} bytes).`);
      }
      await adb.run(["shell", "rm", "-f", remote]);
      return pulled.stdout;
    }
  };
}
function devtoolsSockets(text) {
  const byName = /* @__PURE__ */ new Map();
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8 || parts[0] === "Num" || !parts[0].endsWith(":")) continue;
    const raw = parts[7];
    if (!raw.startsWith("@")) continue;
    const name = raw.slice(1);
    if (!/_devtools_remote(_\d+)?$/.test(name)) continue;
    const pid = /_(\d+)$/.exec(name);
    const listening = parts[5] === "01";
    const seen = byName.get(name);
    if (seen) {
      seen.listening ||= listening;
      continue;
    }
    byName.set(name, { name, pid: pid ? Number(pid[1]) : null, kind: name.startsWith("webview_devtools_remote") ? "webview" : "other", listening });
  }
  return [...byName.values()];
}
function processNameFromCmdline(text) {
  return (text.split("\0")[0] ?? "").trim();
}
function processBelongsTo(name, pkg) {
  return name === pkg || name.startsWith(`${pkg}:`);
}
function isBrowserSocket(name, pkg) {
  return name === "chrome_devtools_remote" || name === `${pkg}_devtools_remote`;
}
function chooseSocket(sockets2, pkg) {
  const rank = (s) => s.process === pkg ? 0 : s.process && processBelongsTo(s.process, pkg) ? 1 : s.kind === "webview" ? 2 : 3;
  return [...sockets2].sort((a, b) => rank(a) - rank(b) || (a.pid ?? 0) - (b.pid ?? 0));
}
async function sockets(adb, pkg) {
  const found = devtoolsSockets(await adb.shell(["cat", "/proc/net/unix"]));
  const named = [];
  for (const s of found) {
    let proc = null;
    if (s.pid !== null) {
      const res = await adb.run(["exec-out", "cat", `/proc/${s.pid}/cmdline`]);
      proc = res.code === 0 ? processNameFromCmdline(out(res)) || null : null;
    }
    named.push({ ...s, process: proc });
  }
  return chooseSocket(named, pkg);
}
function parseExistingForward(listing, socketName) {
  const remote = `localabstract:${socketName}`;
  for (const line of listing.split("\n")) {
    const m = /\btcp:(\d+)\s+(\S+)\s*$/.exec(line.trim());
    if (m && m[2] === remote) return Number(m[1]);
  }
  return null;
}
async function forwardSocket(adb, socketName) {
  const list2 = await adb.run(["forward", "--list"]);
  const held = parseExistingForward(out(list2), socketName);
  if (held !== null) return { port: held, reused: true };
  const res = await adb.run(["forward", "tcp:0", `localabstract:${socketName}`]);
  const text = orFail(res, "qa.device.forward", `adb forward of ${socketName}`).trim();
  if (!/^\d+$/.test(text)) {
    throw new LaunchwrightError("qa.device.forward", `adb forward of ${socketName} printed ${JSON.stringify(text)}, which names no port.`);
  }
  return { port: Number(text), reused: false };
}
async function removeForward(adb, port) {
  const res = await adb.run(["forward", "--remove", `tcp:${port}`]);
  orFail(res, "qa.device.forward", `adb forward --remove tcp:${port}`);
}
var labelOf, DUMP_PATH, PNG_MAGIC, SCREENRECORD_MAX_S, SCREENRECORD_GRACE_S;
var init_adb = __esm({
  "src/device/services/adb.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_process();
    labelOf = (n) => n.text || n.desc;
    DUMP_PATH = "/sdcard/window_dump.xml";
    PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    SCREENRECORD_MAX_S = 180;
    SCREENRECORD_GRACE_S = 30;
  }
});

// src/device/services/page-script.mts
function parseSelector(selector) {
  const s = selector.trim();
  if (!s) throw new LaunchwrightError("qa.device.selector", "A selector is empty.");
  const m = ROLE_FORM.exec(s);
  if (m) return { kind: "role", role: m[1].toLowerCase(), name: m[2] ?? m[3] ?? m[4] ?? "" };
  return { kind: "css", css: s };
}
function resolveSnippet(p) {
  return p.kind === "css" ? `document.querySelector(${JSON.stringify(p.css)})` : `__byRole(${JSON.stringify(p.role)}, ${JSON.stringify(p.name)})`;
}
function pushRouteExpression(path) {
  if (!path.startsWith("/")) throw new LaunchwrightError("qa.device.route", `A route starts with /, not ${JSON.stringify(path)}.`);
  return iife(`
  const target = ${JSON.stringify(path)};
  history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  return location.pathname + location.search;`);
}
function hrefExpression(url) {
  return `(() => { location.href = ${JSON.stringify(url)}; return true; })()`;
}
function actExpression(step) {
  switch (step.kind) {
    case "click": {
      const sel = parseSelector(need(step.target, "click", "target"));
      return iife(`
  const el = ${resolveSnippet(sel)};
  if (!el) return { ok: false, error: 'no element for ' + ${JSON.stringify(step.target)} };
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const failed = [];
  const fire = (make) => { try { el.dispatchEvent(make()); } catch (e) { failed.push(String(e && e.message || e)); } };
  const mouse = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0 };
  const pointer = Object.assign({ pointerId: 1, pointerType: 'touch', isPrimary: true }, mouse);
  fire(() => new PointerEvent('pointerdown', pointer));
  fire(() => new MouseEvent('mousedown', mouse));
  fire(() => new PointerEvent('pointerup', pointer));
  fire(() => new MouseEvent('mouseup', mouse));
  fire(() => new MouseEvent('click', mouse));
  return { ok: true, label: __label(el).slice(0, 60), failed };`);
    }
    case "type": {
      const sel = parseSelector(need(step.target, "type", "target"));
      const text = need(step.text, "type", "text");
      return iife(`
  const el = ${resolveSnippet(sel)};
  if (!el) return { ok: false, error: 'no element for ' + ${JSON.stringify(step.target)} };
  el.focus();
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value');
  if (setter && setter.set) setter.set.call(el, ${JSON.stringify(text)}); else el.value = ${JSON.stringify(text)};
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: ${JSON.stringify(text)} }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };`);
    }
    case "press": {
      const key = need(step.key, "press", "key");
      return iife(`
  const target = document.activeElement || document.body;
  const init = { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new KeyboardEvent('keydown', init));
  target.dispatchEvent(new KeyboardEvent('keyup', init));
  if (${JSON.stringify(key)} === 'Enter' && target.form) target.form.requestSubmit();
  return { ok: true };`);
    }
    case "scroll": {
      const dx = step.dx ?? 0;
      const dy = step.dy ?? 0;
      return iife(`
  const all = [document.scrollingElement].concat(Array.prototype.slice.call(document.querySelectorAll('*')));
  const scrollable = all.filter((el) => el && (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4));
  scrollable.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
  const root = scrollable[0];
  if (!root) return { ok: false, error: 'nothing on this page scrolls' };
  root.scrollBy(${dx}, ${dy});
  return { ok: true };`);
    }
    default:
      throw new LaunchwrightError("qa.target.act", `Act ${step.kind} does not run in the page.`);
  }
}
function need(value, kind, field) {
  if (value === void 0 || value === "") throw new LaunchwrightError("qa.target.act", `Act ${kind} needs ${field}.`);
  return value;
}
function settleExpression(rule) {
  const checks = [];
  if (rule.selector) checks.push(`{ name: ${JSON.stringify(`selector ${rule.selector}`)}, ok: __shown(${resolveSnippet(parseSelector(rule.selector))}) }`);
  if (rule.artwork) checks.push(`{ name: 'artwork', ok: __artwork() }`);
  if (rule.video) checks.push(`{ name: 'video', ok: Array.prototype.slice.call(document.querySelectorAll('video')).some((v) => v.readyState >= 2) }`);
  if (rule.busy) checks.push(`{ name: 'busy', ok: document.readyState === 'complete' && !document.querySelector('[aria-busy="true"]') }`);
  if (checks.length !== 1) {
    throw new LaunchwrightError("qa.device.settle", `A settle rule names exactly one of selector, artwork, video, busy; this one names ${checks.length}.`);
  }
  return iife(`
  const checks = [${checks.join(", ")}];
  return { ok: checks.every((c) => c.ok), missing: checks.filter((c) => !c.ok).map((c) => c.name) };`);
}
function chooseVisiblePage(answers) {
  const census = answers.map((p) => `${p.url ?? p.id} (${p.visibility})`).join(", ") || "none";
  const visible = answers.filter((p) => p.visibility === "visible");
  if (visible.length === 1) return visible[0];
  if (visible.length === 0) {
    throw new LaunchwrightError("qa.device.page", `No page is visible: the app is closed or in the background. Pages: ${census}.`);
  }
  throw new LaunchwrightError("qa.device.page", `${visible.length} pages claim to be visible, and nothing can choose between them: ${census}.`);
}
function routeUrl2(baseUrl, route) {
  const base = new URL(baseUrl);
  const basePath2 = base.pathname.replace(/\/$/, "");
  const target = new URL(`${basePath2}${route.startsWith("/") ? route : `/${route}`}`, base.origin);
  return { url: target.toString(), path: `${target.pathname}${target.search}`, origin: target.origin };
}
function relativeRoute2(baseUrl, pageRoute) {
  const basePath2 = new URL(baseUrl).pathname.replace(/\/$/, "");
  if (basePath2 && (pageRoute === basePath2 || pageRoute.startsWith(`${basePath2}/`) || pageRoute.startsWith(`${basePath2}?`))) {
    return pageRoute.slice(basePath2.length) || "/";
  }
  return pageRoute;
}
var ROLE_FORM, IMPLICIT_ROLES, HELPERS, iife, VISIBILITY_EXPRESSION, ROUTE_EXPRESSION;
var init_page_script = __esm({
  "src/device/services/page-script.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    ROLE_FORM = /^role=([a-zA-Z][a-zA-Z0-9-]*)(?:\[name=(?:"([^"]*)"|'([^']*)'|([^\]]*))\])?$/;
    IMPLICIT_ROLES = Object.freeze({
      article: "article",
      button: "button, input[type=button], input[type=submit], input[type=reset]",
      checkbox: "input[type=checkbox]",
      combobox: "select",
      dialog: "dialog",
      form: "form[aria-label], form[aria-labelledby]",
      heading: "h1, h2, h3, h4, h5, h6",
      img: 'img[alt]:not([alt=""])',
      link: "a[href]",
      list: "ul, ol",
      listitem: "li",
      main: "main",
      navigation: "nav",
      radio: "input[type=radio]",
      region: "section[aria-label], section[aria-labelledby]",
      table: "table",
      textbox: "input:not([type]), input[type=text], input[type=email], input[type=search], input[type=tel], input[type=url], textarea"
    });
    HELPERS = `
  const __label = (el) => String(el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || '').replace(/\\s+/g, ' ').trim();
  const __roles = ${JSON.stringify(IMPLICIT_ROLES)};
  const __byRole = (role, name) => {
    const sel = '[role=' + role + ']' + (__roles[role] ? ', ' + __roles[role] : '');
    const hits = Array.prototype.slice.call(document.querySelectorAll(sel)).filter((el) => !name || __label(el).includes(name));
    hits.sort((a, b) => __label(a).length - __label(b).length);
    return hits[0] || null;
  };
  const __shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const __artwork = () => {
    if (Array.prototype.slice.call(document.images).some((i) => i.complete && i.naturalWidth > 0)) return true;
    return Array.prototype.slice.call(document.querySelectorAll('*')).some((el) => { const bg = getComputedStyle(el).backgroundImage; return bg !== 'none' && bg.includes('url('); });
  };
`;
    iife = (body) => `(() => {${HELPERS}${body}
})()`;
    VISIBILITY_EXPRESSION = "document.visibilityState";
    ROUTE_EXPRESSION = "location.pathname + location.search";
  }
});

// src/device/services/cdp.mts
async function devtoolsJson(deps, port, path) {
  const url = `http://127.0.0.1:${port}${path}`;
  let res;
  try {
    res = await deps.fetch(url, { signal: AbortSignal.timeout(5e3) });
  } catch (err) {
    throw new LaunchwrightError("qa.device.cdp", `GET ${url} did not answer: ${err.message}`, { cause: err });
  }
  const body = await res.text();
  if (!res.ok) throw new LaunchwrightError("qa.device.cdp", `GET ${url} answered ${res.status}: ${body.slice(0, 200)}`);
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new LaunchwrightError("qa.device.cdp", `GET ${url} answered ${body.length} bytes that are not JSON.`, { cause: err });
  }
}
function rewriteWsUrl(wsUrl, port) {
  const u = new URL(wsUrl);
  u.host = `127.0.0.1:${port}`;
  return u.toString();
}
function attachablePages(targets) {
  return (Array.isArray(targets) ? targets : []).filter(
    (t) => t?.type === "page" && typeof t.webSocketDebuggerUrl === "string" && t.webSocketDebuggerUrl !== ""
  );
}
function connectCdp(deps, wsUrl, onEvent) {
  const ready = deferred();
  const resolve5 = ready.resolve;
  const reject = ready.reject;
  const ws = deps.socket(wsUrl);
  const pending = /* @__PURE__ */ new Map();
  let nextId = 1;
  let closed = null;
  let opened = false;
  const failAll = (err) => {
    closed ??= err;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
  };
  const opening = setTimeout(() => {
    reject(new LaunchwrightError("qa.device.cdp", `The page socket did not open within 10 s: ${wsUrl}`));
    ws.close();
  }, 1e4);
  ws.onerror = () => {
    clearTimeout(opening);
    const err = new LaunchwrightError("qa.device.cdp", `The page socket failed: ${wsUrl}`);
    failAll(err);
    if (!opened) reject(err);
  };
  ws.onclose = (ev) => {
    clearTimeout(opening);
    failAll(new LaunchwrightError("qa.device.cdp", `The page socket closed (${ev.code ?? "?"} ${ev.reason || "no reason given"}).`));
  };
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch (err) {
      failAll(new LaunchwrightError("qa.device.cdp", "The page sent a frame that is not JSON.", { cause: err }));
      ws.close();
      return;
    }
    if (msg.id === void 0) {
      if (msg.method && onEvent) onEvent({ method: msg.method, ...msg.params ? { params: msg.params } : {} });
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.error) p.reject(new LaunchwrightError("qa.device.cdp", `CDP ${p.method} failed: ${msg.error.message ?? JSON.stringify(msg.error)}`));
    else p.resolve(msg.result ?? {});
  };
  const client = {
    send(method, params = {}, timeoutMs = 15e3) {
      if (closed) return Promise.reject(closed);
      const id = nextId++;
      const answer = deferred();
      const timer = setTimeout(() => {
        pending.delete(id);
        answer.reject(new LaunchwrightError("qa.device.cdp", `CDP ${method} did not answer within ${timeoutMs / 1e3} s.`));
      }, timeoutMs);
      pending.set(id, { resolve: answer.resolve, reject: answer.reject, timer, method });
      ws.send(JSON.stringify({ id, method, params }));
      return answer.promise;
    },
    async evaluate(expression) {
      const res = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      const thrown = res.exceptionDetails;
      if (thrown) {
        throw new LaunchwrightError("qa.device.eval", `The page threw: ${thrown.exception?.description ?? thrown.text ?? "unknown error"}`.slice(0, 600));
      }
      return res.result?.value;
    },
    close() {
      ws.onclose = null;
      failAll(new LaunchwrightError("qa.device.cdp", "The client closed."));
      ws.close();
    }
  };
  ws.onopen = () => {
    opened = true;
    clearTimeout(opening);
    resolve5(client);
  };
  return ready.promise;
}
async function openVisiblePage(deps, port, onEvent) {
  const pages = attachablePages(await devtoolsJson(deps, port, "/json/list"));
  const answers = [];
  const open = /* @__PURE__ */ new Map();
  for (const target of pages) {
    let client = null;
    try {
      client = await connectCdp(deps, rewriteWsUrl(target.webSocketDebuggerUrl, port), onEvent);
      answers.push({ id: target.id, ...target.url ? { url: target.url } : {}, visibility: String(await client.evaluate(VISIBILITY_EXPRESSION)) });
      open.set(target.id, { target, client });
    } catch (err) {
      answers.push({ id: target.id, ...target.url ? { url: target.url } : {}, visibility: `unreachable: ${err.message}` });
      client?.close();
    }
  }
  let chosen;
  try {
    chosen = chooseVisiblePage(answers);
  } catch (err) {
    for (const o of open.values()) o.client.close();
    throw err;
  }
  for (const [id, o] of open) if (id !== chosen.id) o.client.close();
  return open.get(chosen.id);
}
function logLineOf(ev, at) {
  const p = ev.params ?? {};
  switch (ev.method) {
    case "Runtime.exceptionThrown":
      return { at, kind: "page-error", text: String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception").slice(0, 500) };
    case "Runtime.consoleAPICalled":
      if (p.type !== "error") return null;
      return { at, kind: "console-error", text: (p.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 500) };
    case "Log.entryAdded":
      return p.entry?.level === "error" ? { at, kind: "console-error", text: String(p.entry?.text ?? "").slice(0, 500) } : null;
    case "Network.loadingFailed":
      return p.canceled ? null : { at, kind: "request-failed", text: `${p.errorText ?? "failed"} ${p.type ?? ""}`.trim() };
    case "Network.responseReceived":
      return Number(p.response?.status) >= 500 ? { at, kind: "response-5xx", text: `${p.response.status} ${String(p.response.url).slice(0, 200)}` } : null;
    default:
      return null;
  }
}
var init_cdp = __esm({
  "src/device/services/cdp.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_page_script();
    init_process();
  }
});

// src/kernel/services/text.mts
function shq(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
var init_text = __esm({
  "src/kernel/services/text.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
    init_stamp();
  }
});

// src/device/services/rigs.mts
function resolveDevice(config, name) {
  const devices = config.device.devices;
  const names = Object.keys(devices).sort();
  if (!name) {
    if (names.length === 1) return resolveDevice(config, names[0]);
    throw new LaunchwrightError(
      "qa.device.unknown",
      `Name a device with --device. Devices in qa.device.devices: ${names.join(", ") || "none"}.`
    );
  }
  const device = devices[name];
  if (!device) {
    throw new LaunchwrightError("qa.device.unknown", `No device ${name} in qa.device.devices. Devices: ${names.join(", ") || "none"}.`, {
      context: { device: name }
    });
  }
  const rig = config.device.rigs[device.rig];
  if (!rig) {
    const rigs = Object.keys(config.device.rigs).sort().join(", ");
    throw new LaunchwrightError("qa.device.rig.unknown", `Device ${name} names rig ${device.rig}, which qa.device.rigs does not hold. Rigs: ${rigs}.`, {
      context: { device: name, rig: device.rig }
    });
  }
  return { name, device, rigName: device.rig, rig };
}
function controlPath(root, rig, home = (0, import_node_os.homedir)()) {
  const id = sha256(`${root}\0${rig}`).slice(0, 16);
  const path = (0, import_node_path23.join)(home, SSH_SOCKET_DIR, `${id}.sock`);
  if (Buffer.byteLength(path) > MAX_SOCKET_PATH) {
    throw new LaunchwrightError(
      "qa.device.ssh.path",
      `The ssh control socket ${path} is longer than ${MAX_SOCKET_PATH} bytes, and ssh cannot bind it. Run with a shorter HOME.`,
      { context: { rig } }
    );
  }
  return path;
}
function masterArgs(ctl, host) {
  return [
    "-M",
    "-S",
    ctl,
    "-f",
    "-N",
    "-o",
    "BatchMode=yes",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ConnectTimeout=10",
    "-o",
    "ServerAliveInterval=30",
    host
  ];
}
function sshRig(name, config, deps, ssh) {
  const host = config.host;
  if (!host) {
    throw new LaunchwrightError("qa.device.rig.host", `Rig ${name} has transport ssh and no host. Set qa.device.rigs.${name}.host to its ssh alias.`, {
      context: { rig: name }
    });
  }
  const ctl = controlPath(deps.root, name);
  const forwards = /* @__PURE__ */ new Map();
  let opening = null;
  let adbLocal = null;
  async function open() {
    const check = await deps.run.run(ssh, ["-S", ctl, "-O", "check", host]);
    if (check.code === 0) return;
    await (0, import_promises12.mkdir)((0, import_node_path23.dirname)(ctl), { recursive: true, mode: 448 });
    const res = await deps.run.run(ssh, masterArgs(ctl, host), { timeoutMs: 3e4 });
    if (res.code !== 0) {
      throw new LaunchwrightError(
        "qa.device.ssh",
        `ssh to rig ${name} (${host}) failed: ${said(res) || `exit ${res.code}`}. The rig needs a login without a prompt: BatchMode=yes refuses a password. Run ssh ${host} once by hand to accept the host key, and add your key with ssh-copy-id.`,
        { context: { rig: name, exit: res.code } }
      );
    }
  }
  const rig = {
    name,
    config,
    remote: true,
    stateDir: RIG_STATE_DIR,
    ensure() {
      opening ??= open().catch((err) => {
        opening = null;
        throw err;
      });
      return opening;
    },
    async exec(command, opts) {
      await rig.ensure();
      return deps.run.run(ssh, ["-S", ctl, "-o", "BatchMode=yes", host, `${REMOTE_PATH}; ${command}`], { timeoutMs: 12e4, ...opts });
    },
    async forward(remotePort, localPort) {
      const held = forwards.get(remotePort);
      if (held !== void 0 && (localPort === void 0 || held === localPort)) return held;
      await rig.ensure();
      const local = localPort ?? await deps.freePort();
      const res = await deps.run.run(ssh, ["-S", ctl, "-O", "forward", "-L", `${local}:127.0.0.1:${remotePort}`, host]);
      orFail(res, "qa.device.ssh.forward", `ssh forward :${local} to ${name}:${remotePort}`, { rig: name });
      forwards.set(remotePort, local);
      return local;
    },
    async unforward(remotePort) {
      const local = forwards.get(remotePort);
      if (local === void 0) return;
      forwards.delete(remotePort);
      const res = await deps.run.run(ssh, ["-S", ctl, "-O", "cancel", "-L", `${local}:127.0.0.1:${remotePort}`, host]);
      orFail(res, "qa.device.ssh.forward", `ssh cancel of the forward :${local} to ${name}:${remotePort}`, { rig: name });
    },
    async adbPort() {
      if (adbLocal !== null) return adbLocal;
      if (config.adbPort) {
        await rig.ensure();
        const res = await deps.run.run(ssh, ["-S", ctl, "-O", "forward", "-L", `${config.adbPort}:127.0.0.1:${ADB_SERVER_PORT}`, host]);
        orFail(res, "qa.device.ssh.forward", `ssh forward of the adb server to :${config.adbPort}`, { rig: name });
        forwards.set(ADB_SERVER_PORT, config.adbPort);
        adbLocal = config.adbPort;
      } else {
        adbLocal = await rig.forward(ADB_SERVER_PORT);
      }
      return adbLocal;
    },
    async adbServer() {
      return ["-L", `tcp:127.0.0.1:${await rig.adbPort()}`];
    },
    async writeFile(path, content) {
      const res = await rig.exec(`mkdir -p "$(dirname ${shq(path)})" && cat > ${shq(path)}`, { input: content });
      orFail(res, "qa.device.rig.write", `writing ${path} on rig ${name}`, { rig: name });
    },
    async down() {
      opening = null;
      forwards.clear();
      adbLocal = null;
      const res = await deps.run.run(ssh, ["-S", ctl, "-O", "exit", host]);
      if (res.code !== 0 && !/No such file|Control socket connect/i.test(said(res))) {
        orFail(res, "qa.device.ssh", `closing the ssh master of rig ${name}`, { rig: name });
      }
    }
  };
  return rig;
}
function localRig(name, config, deps) {
  return {
    name,
    config,
    remote: false,
    stateDir: (0, import_node_path23.join)(deps.root, DEVICE_STATE_DIR),
    ensure: async () => {
    },
    exec: (command, opts) => deps.run.run("sh", ["-c", command], { timeoutMs: 12e4, ...opts }),
    forward: async (remotePort) => remotePort,
    unforward: async () => {
    },
    adbServer: async () => [],
    adbPort: async () => ADB_SERVER_PORT,
    async writeFile(path, content) {
      await (0, import_promises12.mkdir)((0, import_node_path23.dirname)(path), { recursive: true });
      await (0, import_promises12.writeFile)(path, content);
    },
    down: async () => {
    }
  };
}
function cloudRig(name, config) {
  const refuse = () => {
    throw new LaunchwrightError("qa.device.rig.cloud", `Rig ${name} is a cloud rig: it has no shell and no ports. Its devices run on the browserstack target.`, {
      context: { rig: name }
    });
  };
  return {
    name,
    config,
    remote: true,
    stateDir: "",
    ensure: async () => {
    },
    exec: async () => refuse(),
    forward: async () => refuse(),
    unforward: async () => refuse(),
    adbServer: async () => refuse(),
    adbPort: async () => refuse(),
    writeFile: async () => refuse(),
    down: async () => {
    }
  };
}
function createDeviceContext(config, deps) {
  return { config, deps, rigs: createRigPool(config, deps) };
}
function createRigPool(config, deps) {
  const rigs = /* @__PURE__ */ new Map();
  return {
    get(name) {
      const held = rigs.get(name);
      if (held) return held;
      const cfg = config.device.rigs[name];
      if (!cfg) {
        throw new LaunchwrightError("qa.device.rig.unknown", `No rig ${name} in qa.device.rigs.`, { context: { rig: name } });
      }
      const rig = cfg.transport === "ssh" ? sshRig(name, cfg, deps, config.device.tools.ssh) : cfg.transport === "cloud" ? cloudRig(name, cfg) : localRig(name, cfg, deps);
      rigs.set(name, rig);
      return rig;
    },
    async downAll() {
      for (const rig of rigs.values()) await rig.down();
    }
  };
}
var import_promises12, import_node_os, import_node_path23, DEVICE_STATE_DIR, RIG_STATE_DIR, MAX_SOCKET_PATH, SSH_SOCKET_DIR, REMOTE_PATH, ADB_SERVER_PORT;
var init_rigs = __esm({
  "src/device/services/rigs.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises12 = require("fs/promises");
    import_node_os = require("os");
    import_node_path23 = require("path");
    init_kernel();
    init_fs();
    init_text();
    init_process();
    DEVICE_STATE_DIR = ".lw/qa/device";
    RIG_STATE_DIR = ".lw-qa";
    MAX_SOCKET_PATH = 104 - 1 - 17;
    SSH_SOCKET_DIR = ".lw-qa/ssh";
    REMOTE_PATH = 'export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/Library/Android/sdk/platform-tools:$HOME/Android/Sdk/platform-tools:$HOME/Library/Android/sdk/emulator:$HOME/Android/Sdk/emulator"';
    ADB_SERVER_PORT = 5037;
  }
});

// src/device/services/emulator.mts
function emulatorSerial(port) {
  return `emulator-${port}`;
}
function avdDir(avd) {
  return `"$HOME/.android/avd/${avd}.avd"`;
}
function snapshotRoot(rig) {
  return `${rig.stateDir}/snapshots`;
}
async function sdkRoot(rig) {
  const res = await rig.exec(SDK_ROOT_SCRIPT);
  return res.code === 0 ? out(res).trim().split("\n")[0] || null : null;
}
async function avdExists(rig, avd) {
  return (await rig.exec(`test -d ${avdDir(avd)}`)).code === 0;
}
async function booted(adb) {
  const res = await adb.run(["shell", "getprop", "sys.boot_completed"], { timeoutMs: 15e3 });
  return res.code === 0 && out(res).trim() === "1";
}
function emulatorArgs(keys) {
  return ["-avd", keys.avd, "-port", String(keys.port), "-no-boot-anim", "-no-audio", "-no-snapshot", "-no-window", "-netdelay", "none", "-netspeed", "full", "-gpu", keys.gpu];
}
async function bootEmulator(rig, adb, keys, deps) {
  if (await booted(adb)) return "already";
  const sdk = await sdkRoot(rig);
  if (!sdk) throw new LaunchwrightError("qa.device.sdk", `Rig ${rig.name} has no Android SDK. Install the SDK command-line tools there, then the emulator package.`);
  if (!await avdExists(rig, keys.avd)) {
    throw new LaunchwrightError("qa.device.avd", `Rig ${rig.name} has no AVD ${keys.avd}. Create it with avdmanager on that rig.`, { context: { avd: keys.avd } });
  }
  const log = `${rig.stateDir}/${keys.avd}.log`;
  const start = `mkdir -p ${shq(rig.stateDir)} && nohup ${shq(`${sdk}/emulator/emulator`)} ${emulatorArgs(keys).map(shq).join(" ")} > ${shq(log)} 2>&1 & echo started`;
  orFail(await rig.exec(start), "qa.device.emulator", `starting AVD ${keys.avd} on rig ${rig.name}`);
  await poll(deps.clock, async () => await booted(adb) ? true : null, {
    timeoutMs: 42e4,
    everyMs: 2e3,
    code: "qa.device.emulator.boot",
    what: `The boot of AVD ${keys.avd} on rig ${rig.name} (log: ${log})`
  });
  return "booted";
}
async function stopEmulator(rig, adb, deps) {
  const kill = rig.remote ? await rig.exec(`adb -s ${shq(adb.serial)} emu kill`) : await adb.run(["emu", "kill"]);
  orFail(kill, "qa.device.emulator.stop", `adb emu kill of ${adb.serial} on rig ${rig.name}`, { rig: rig.name });
  await poll(deps.clock, async () => await booted(adb) ? null : true, {
    timeoutMs: 9e4,
    everyMs: 500,
    code: "qa.device.emulator.stop",
    what: `The clean shutdown of ${adb.serial}`
  });
}
function safeLabel(label) {
  return label.replace(/[^\w-]/g, "").slice(0, 40);
}
async function snapshotAvd(rig, avd, label, now) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const tag = label ? `${stamp}-${safeLabel(label)}` : stamp;
  const dest = `${snapshotRoot(rig)}/${avd}-${tag}`;
  const cmd = `mkdir -p ${shq(snapshotRoot(rig))} && (cp -Rc ${avdDir(avd)} ${shq(dest)} 2>/dev/null || cp -R ${avdDir(avd)} ${shq(dest)}) && test -f ${shq(`${dest}/userdata-qemu.img.qcow2`)}`;
  const res = await rig.exec(cmd, { timeoutMs: 6e5 });
  if (res.code !== 0) throw new LaunchwrightError("qa.device.snapshot", `Snapshot of AVD ${avd} on rig ${rig.name} failed or has no userdata: ${said(res)}`);
  return dest;
}
async function listSnapshots(rig, avd) {
  const res = await rig.exec(`ls -1dt ${shq(snapshotRoot(rig))}/${avd}-* 2>/dev/null || true`);
  return out(res).trim().split("\n").filter(Boolean);
}
async function restoreAvd(rig, adb, avd, from, force) {
  if (await booted(adb)) throw new LaunchwrightError("qa.device.restore", `The emulator ${adb.serial} is running. Stop it with lw qa device down first.`);
  if (!force) {
    throw new LaunchwrightError(
      "qa.device.telegram.signed-in",
      `Restore replaces AVD ${avd}, and the Telegram sign-in on it. Run it again with --force after the owner of that account agrees.`
    );
  }
  const snaps = await listSnapshots(rig, avd);
  const src = from ?? snaps[0];
  if (!src) throw new LaunchwrightError("qa.device.restore", `No snapshot of AVD ${avd} on rig ${rig.name}. Take one with lw qa device snapshot.`);
  if (!snaps.includes(src)) throw new LaunchwrightError("qa.device.restore", `${src} is not a snapshot of AVD ${avd}. Snapshots: ${snaps.join(", ") || "none"}.`);
  const cmd = `rm -rf ${avdDir(avd)} && (cp -Rc ${shq(src)} ${avdDir(avd)} 2>/dev/null || cp -R ${shq(src)} ${avdDir(avd)})`;
  orFail(await rig.exec(cmd, { timeoutMs: 6e5 }), "qa.device.restore", `restoring AVD ${avd} from ${src}`);
  return src;
}
var SDK_ROOT_SCRIPT;
var init_emulator = __esm({
  "src/device/services/emulator.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_text();
    init_process();
    init_rigs();
    SDK_ROOT_SCRIPT = 'for d in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do [ -n "$d" ] && [ -d "$d" ] && { echo "$d"; exit 0; }; done; exit 1';
  }
});

// src/device/services/host-proxy.mts
var HOST_PROXY_SCRIPT;
var init_host_proxy = __esm({
  "src/device/services/host-proxy.mts"() {
    "use strict";
    init_cjs_shims();
    HOST_PROXY_SCRIPT = `import http from 'node:http';
import net from 'node:net';

const [, , portArg, HOST, UPSTREAM] = process.argv;
const PORT = Number(portArg);
if (!PORT || !HOST || !UPSTREAM) {
  console.error('usage: host-proxy.mjs <port> <hostname> <upstream>');
  process.exit(2);
}
const dialFor = (name) => (name === HOST ? UPSTREAM : name);

const server = http.createServer((req, res) => {
  if (req.url === '/__ingress') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ host: HOST, upstream: UPSTREAM, port: PORT, pid: process.pid }));
    return;
  }
  let target;
  try {
    target = new URL(req.url);
  } catch {
    res.writeHead(400).end('absolute URL required');
    return;
  }
  const up = http.request(
    { host: dialFor(target.hostname), port: target.port || 80, path: target.pathname + target.search, method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode || 502, answer.headers);
      answer.pipe(res);
    },
  );
  up.on('error', (err) => {
    console.error('upstream ' + target.hostname + ': ' + err.message);
    res.destroy();
  });
  req.pipe(up);
});

server.on('connect', (req, socket, head) => {
  const at = req.url.lastIndexOf(':');
  const name = at === -1 ? req.url : req.url.slice(0, at);
  const port = at === -1 ? 443 : Number(req.url.slice(at + 1)) || 443;
  const up = net.connect(port, dialFor(name), () => {
    socket.write('HTTP/1.1 200 Connection Established\\r\\n\\r\\n');
    if (head && head.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', (err) => {
    console.error('connect ' + name + ': ' + err.message);
    socket.destroy();
  });
  socket.on('error', () => up.destroy());
});

server.listen(PORT, '127.0.0.1', () => console.log('host-proxy 127.0.0.1:' + PORT + ' ' + HOST + ' -> ' + UPSTREAM));
`;
  }
});

// src/device/services/ingress.mts
function proxyAddress(port) {
  return `127.0.0.1:${port}`;
}
function parseIdentity(text) {
  try {
    const id = JSON.parse(text.trim());
    return typeof id.host === "string" && typeof id.upstream === "string" && typeof id.pid === "number" ? { host: id.host, upstream: id.upstream, pid: id.pid } : null;
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}
async function identity(rig, port) {
  const res = await rig.exec(`curl -s -m 3 http://127.0.0.1:${port}/__ingress || true`, { timeoutMs: 15e3 });
  return parseIdentity(out(res));
}
async function clearIngress(adb, port) {
  const held = (await adb.shell(["settings", "get", "global", "http_proxy"])).trim();
  if (held !== proxyAddress(port)) return false;
  await adb.shell(["settings", "put", "global", "http_proxy", ":0"]);
  return true;
}
async function startProxy(rig, deps, port, host, upstream) {
  const script = `${rig.stateDir}/host-proxy.mjs`;
  const log = `${rig.stateDir}/host-proxy.log`;
  await rig.writeFile(script, HOST_PROXY_SCRIPT);
  const start = `NODE="$(command -v node)"; [ -n "$NODE" ] || { echo "node is not installed on this rig" >&2; exit 3; }; nohup "$NODE" ${shq(script)} ${port} ${shq(host)} ${shq(upstream)} > ${shq(log)} 2>&1 &`;
  orFail(await rig.exec(start), "qa.device.ingress", `starting the host proxy on rig ${rig.name}`, { rig: rig.name });
  await poll(
    deps.clock,
    async () => {
      const id = await identity(rig, port);
      return id && id.host === host && id.upstream === upstream ? id : null;
    },
    { timeoutMs: 5e3, everyMs: 250, code: "qa.device.ingress", what: `The host proxy answering on rig ${rig.name} port ${port} (log: ${log})` }
  );
}
async function ensureIngress(adb, rig, deps, baseUrl) {
  const port = rig.config.hostProxy?.port ?? DEFAULT_PROXY_PORT;
  if (rig.config.ingress === "direct") return { mode: "direct", changed: await clearIngress(adb, port) };
  const upstream = rig.config.hostProxy?.upstream;
  if (!upstream) {
    throw new LaunchwrightError(
      "qa.device.ingress.config",
      `Rig ${rig.name} has ingress host-proxy and no hostProxy.upstream. Set qa.device.rigs.${rig.name}.hostProxy.upstream to the address that serves the tunnel hostname.`,
      { context: { rig: rig.name } }
    );
  }
  const host = new URL(baseUrl).hostname;
  const live = await identity(rig, port);
  if (!live || live.host !== host || live.upstream !== upstream) {
    if (live) orFail(await rig.exec(`kill ${live.pid}`), "qa.device.ingress", `stopping the stale host proxy (pid ${live.pid})`);
    await startProxy(rig, deps, port, host, upstream);
  }
  orFail(await adb.run(["reverse", `tcp:${port}`, `tcp:${port}`]), "qa.device.ingress", `adb reverse tcp:${port}`);
  const held = (await adb.shell(["settings", "get", "global", "http_proxy"])).trim();
  const changed = held !== proxyAddress(port);
  if (changed) await adb.shell(["settings", "put", "global", "http_proxy", proxyAddress(port)]);
  return { mode: "host-proxy", changed };
}
var DEFAULT_PROXY_PORT;
var init_ingress = __esm({
  "src/device/services/ingress.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_text();
    init_host_proxy();
    init_process();
    init_rigs();
    DEFAULT_PROXY_PORT = 8899;
  }
});

// src/device/services/session-base.mts
function capabilityError2(target, capability, what) {
  return new LaunchwrightError("qa.target.capability", `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability }
  });
}
function closedError(target, call) {
  return new LaunchwrightError("qa.target.closed", `The ${target} session is closed; ${call} needs an open session.`);
}
async function pollSettle(clock, rule, evaluate, target) {
  const expression = settleExpression(rule);
  const timeout = rule.timeout ?? SETTLE_TIMEOUT_MS;
  const deadline = clock.now() + timeout;
  let missing = ["not evaluated"];
  for (; ; ) {
    try {
      const answer = await evaluate(expression);
      if (answer?.ok) return;
      missing = answer?.missing ?? ["no answer"];
    } catch (err) {
      if (!isCodedError(err)) throw err;
      missing = [`the check threw: ${err.message}`];
    }
    if (clock.now() >= deadline) {
      throw new LaunchwrightError("qa.target.settle", `The ${target} page never showed ${missing.join(", ")} within ${timeout} ms.`, {
        context: { rule, missing }
      });
    }
    await clock.sleep(SETTLE_EVERY_MS);
  }
}
async function pageAct(step, evaluate, target) {
  const answer = await evaluate(actExpression(step));
  if (answer && answer.ok === false) {
    throw new LaunchwrightError("qa.target.act", `The act ${step.kind} on the ${target} page failed: ${answer.error ?? "no reason given"}.`, {
      context: { kind: step.kind, target: step.target }
    });
  }
}
async function writePng(path, bytes, target) {
  const size = pngSize(bytes);
  if (size === null) throw new LaunchwrightError("qa.target.screenshot", `The ${target} target returned ${bytes.length} bytes that are not a PNG.`);
  await (0, import_promises13.mkdir)((0, import_node_path24.dirname)(path), { recursive: true });
  await (0, import_promises13.writeFile)(path, bytes);
  return { path, ...size };
}
async function writeBytes(path, bytes) {
  await (0, import_promises13.mkdir)((0, import_node_path24.dirname)(path), { recursive: true });
  await (0, import_promises13.writeFile)(path, bytes);
}
async function holdLastFrame(deps, ffmpeg, path, durationMs) {
  const seconds = (durationMs / 1e3).toFixed(3);
  const held = `${path}.held.mp4`;
  const args = ["-y", "-v", "error", "-i", path, "-vf", `tpad=stop_mode=clone:stop_duration=${seconds}`, "-t", seconds, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", held];
  orFail(await deps.run.run(ffmpeg, args, { timeoutMs: 12e4 }), "qa.device.record", `holding the last frame of ${path} with ${ffmpeg}`);
  await (0, import_promises13.rename)(held, path);
}
function consoleLogKind(line) {
  if (line.level !== "error" && line.level !== "SEVERE") return null;
  if (line.source === "javascript") return "page-error";
  if (line.source === "console-api") return "console-error";
  if (line.source === "network") return /status of 5\d\d\b/.test(line.text) ? "response-5xx" : "request-failed";
  return null;
}
async function waitAct(clock, step) {
  if (!step.why) throw new LaunchwrightError("qa.target.act", "A wait act needs a why: it names what the row waits for.");
  await clock.sleep(step.ms ?? 0);
}
var import_promises13, import_node_path24, SETTLE_TIMEOUT_MS, SETTLE_EVERY_MS;
var init_session_base = __esm({
  "src/device/services/session-base.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises13 = require("fs/promises");
    import_node_path24 = require("path");
    init_kernel();
    init_src();
    init_page_script();
    init_process();
    SETTLE_TIMEOUT_MS = 2e4;
    SETTLE_EVERY_MS = 250;
  }
});

// src/device/services/telegram.mts
function apkPath(root) {
  return (0, import_node_path25.join)(root, DEVICE_STATE_DIR, "telegram.apk");
}
function pinOf(cfg) {
  if (!cfg.apkSha256) {
    throw new LaunchwrightError(
      "qa.device.telegram.pin",
      "qa.device.telegram.apkSha256 is not set. Pin the APK you trust: fetch it once, check it, and set the key to its sha256sum."
    );
  }
  return cfg.apkSha256;
}
function checkPin(bytes, cfg) {
  const want = pinOf(cfg);
  const got = sha256(bytes);
  if (!safeEqual(got, want)) {
    throw new LaunchwrightError(
      "qa.device.telegram.pin",
      `The Telegram APK has sha256 ${got}, not the pinned ${want}. Telegram may have published a new build: check it, then move the pin in qa.device.telegram.apkSha256.`,
      { context: { got, want } }
    );
  }
}
async function fetchApk(cfg, deps) {
  const path = apkPath(deps.root);
  let bytes = null;
  try {
    bytes = await (0, import_promises14.readFile)(path);
  } catch (err) {
    if (err.code !== "ENOENT") throw new LaunchwrightError("qa.device.telegram.apk", `Cannot read ${path}.`, { cause: err });
  }
  if (bytes) {
    checkPin(bytes, cfg);
    return path;
  }
  pinOf(cfg);
  const res = await deps.fetch(cfg.apkUrl, { redirect: "follow", signal: AbortSignal.timeout(6e5) });
  if (!res.ok) throw new LaunchwrightError("qa.device.telegram.apk", `GET ${cfg.apkUrl} answered ${res.status}.`);
  const body = Buffer.from(await res.arrayBuffer());
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared && body.length !== declared) {
    throw new LaunchwrightError("qa.device.telegram.apk", `The APK download is truncated: ${body.length} of ${declared} bytes.`);
  }
  checkPin(body, cfg);
  await (0, import_promises14.mkdir)((0, import_node_path25.dirname)(path), { recursive: true });
  await (0, import_promises14.writeFile)(path, body);
  return path;
}
async function installed(adb, pkg) {
  const res = await adb.run(["shell", "pm", "path", pkg]);
  return res.code === 0 && out(res).includes("package:");
}
async function installTelegram(adb, cfg, deps, force) {
  const path = await fetchApk(cfg, deps);
  if (!force && await installed(adb, cfg.package)) {
    throw new LaunchwrightError(
      "qa.device.telegram.signed-in",
      `${cfg.package} is installed on ${adb.serial} and may be signed in to a real account. Install over it only with --force, after its owner agrees.`,
      { context: { serial: adb.serial } }
    );
  }
  const res = await adb.run(["install", "-r", "-g", path], { timeoutMs: 3e5 });
  const text = `${out(res)}${res.stderr}`.trim();
  if (res.code !== 0 || !/\bSuccess\b/.test(text)) throw new LaunchwrightError("qa.device.telegram.install", `adb install on ${adb.serial} failed: ${text.slice(0, 400)}`);
  return path;
}
function miniAppLink(bot, startParam = DEFAULT_START_PARAM) {
  if (!/^[A-Za-z][\w]{3,31}$/.test(bot)) throw new LaunchwrightError("qa.device.telegram.bot", `${JSON.stringify(bot)} is not a Telegram bot username.`);
  return `tg://resolve?domain=${bot}&startapp=${encodeURIComponent(startParam || DEFAULT_START_PARAM)}`;
}
async function viewIntent(adb, uri, pkg) {
  const res = await adb.run(["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", `'${uri.replaceAll("'", "")}'`, ...pkg ? [pkg] : []]);
  orFail(res, "qa.device.intent", `am start ${uri.split("?")[0]}`);
  if (/Error:/i.test(out(res))) throw new LaunchwrightError("qa.device.intent", `am start ${uri.split("?")[0]} failed: ${out(res).trim().slice(0, 300)}`);
}
async function forceStop(adb, pkg) {
  await adb.shell(["am", "force-stop", pkg]);
}
var import_promises14, import_node_path25, DEFAULT_START_PARAM;
var init_telegram = __esm({
  "src/device/services/telegram.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises14 = require("fs/promises");
    import_node_path25 = require("path");
    init_kernel();
    init_fs();
    init_process();
    init_rigs();
    DEFAULT_START_PARAM = "lw";
  }
});

// src/device/services/android-session.mts
function androidHandle(ctx, deviceName, target, emulatorOnly = false) {
  const resolved = resolveDevice(ctx.config, deviceName);
  const kind = deviceKind(resolved.device.kind);
  if (kind.access !== "adb" || emulatorOnly && kind.emulator !== true) {
    const drives = emulatorOnly ? "an Android emulator" : "an adb device";
    throw new LaunchwrightError("qa.device.kind", `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives ${drives}.`, {
      context: { device: resolved.name, target }
    });
  }
  const rig = ctx.rigs.get(resolved.rigName);
  const bin = ctx.config.device.tools.adb;
  if (kind.emulator === true) {
    const keys2 = deviceKeys(resolved.name, resolved.device, emulatorDeviceKeys);
    return { resolved, rig, adb: createAdb(rig, emulatorSerial(keys2.port), ctx.deps, bin), emulator: keys2, recorder: keys2.recorder, browserPackage: keys2.browserPackage };
  }
  const keys = deviceKeys(resolved.name, resolved.device, androidDeviceKeys);
  return { resolved, rig, adb: createAdb(rig, keys.serial, ctx.deps, bin), emulator: null, recorder: keys.recorder, browserPackage: keys.browserPackage };
}
function stateFix(state, serial, rig) {
  switch (state) {
    case "device":
      return "";
    case "unauthorized":
      return `${serial} on rig ${rig} is unauthorized: unlock it and accept the USB debugging prompt.`;
    case "offline":
      return `${serial} on rig ${rig} is offline: reconnect the cable, or restart the adb server on the rig.`;
    case "absent":
      return `${serial} is not attached to the adb server of rig ${rig}: plug it in with USB debugging on, or boot the emulator.`;
    default:
      return `${serial} on rig ${rig} is ${state}.`;
  }
}
async function attachSocket(ctx, h, pkg, surface) {
  try {
    return await poll(
      ctx.deps.clock,
      async () => {
        const found = await sockets(h.adb, pkg);
        const own = found.find((s) => s.process !== null && processBelongsTo(s.process, pkg));
        const browser = surface === "web" ? found.find((s) => isBrowserSocket(s.name, pkg)) : void 0;
        return (own ?? browser)?.name ?? null;
      },
      { timeoutMs: 3e4, everyMs: 1e3, code: "qa.device.webview", what: `A debuggable WebView of ${pkg} on ${h.adb.serial}` }
    );
  } catch (err) {
    if (!isCodedError(err) || err.code !== "qa.device.webview") throw err;
    if (surface === "web") {
      throw new LaunchwrightError(
        "qa.device.webview",
        `${err.message} A browser publishes its devtools socket only after its first-run screens. Finish them once on the device (lw qa device mirror --device ${h.resolved.name}).`,
        { cause: err }
      );
    }
    throw new LaunchwrightError(
      "qa.device.webview",
      `${err.message} A Telegram release build makes its Mini App WebView debuggable only after Enable WebView Debug: in Telegram Settings, press and hold the version number twice, then choose it.`,
      { cause: err }
    );
  }
}
var import_node_path26, MIN_CLIP_MS2, SCRCPY_GRACE_S, AndroidSession;
var init_android_session = __esm({
  "src/device/services/android-session.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path26 = require("path");
    init_kernel();
    init_src();
    init_adb();
    init_cdp();
    init_config3();
    init_device_kinds();
    init_emulator();
    init_ingress();
    init_page_script();
    init_process();
    init_rigs();
    init_session_base();
    init_telegram();
    MIN_CLIP_MS2 = MIN_VIDEO_S * 1e3 + 500;
    SCRCPY_GRACE_S = 30;
    AndroidSession = class _AndroidSession {
      constructor(ctx, h, opts, target, page, rigPort, reused) {
        this.ctx = ctx;
        this.h = h;
        this.opts = opts;
        this.target = target;
        this.page = page;
        this.rigPort = rigPort;
        this.reused = reused;
      }
      ctx;
      h;
      opts;
      target;
      page;
      rigPort;
      reused;
      closed = false;
      lines = [];
      video = null;
      height = null;
      /** Boots an emulator when needed, applies the ingress, opens the app and attaches to its visible page. */
      static async open(ctx, h, opts, target) {
        const { leg } = opts;
        if (leg.surface === "bot") {
          throw new LaunchwrightError("qa.target.surface", `The ${target} target runs web and miniapp legs; leg ${leg.name} is a bot leg. Use the telegram-fake leg for a bot chat.`);
        }
        await h.rig.ensure();
        if (h.emulator) await bootEmulator(h.rig, h.adb, h.emulator, ctx.deps);
        const state = await deviceState(h.rig, h.adb.serial, ctx.deps, ctx.config.device.tools.adb);
        if (state !== "device") throw new LaunchwrightError("qa.target.not-ready", stateFix(state, h.adb.serial, h.rig.name));
        const ingress = await ensureIngress(h.adb, h.rig, ctx.deps, opts.baseUrl);
        let pkg;
        if (leg.surface === "miniapp") {
          pkg = ctx.config.device.telegram.package;
          if (!leg.bot) throw new LaunchwrightError("qa.target.leg", `Leg ${leg.name} opens a Mini App in Telegram and names no bot. Set qa.legs.${leg.name}.bot.`);
          if (!await installed(h.adb, pkg)) {
            throw new LaunchwrightError("qa.target.not-ready", `${pkg} is not installed on ${h.adb.serial}. Run lw qa device install --device ${h.resolved.name}, then sign in by hand.`);
          }
          if (ingress.changed) await forceStop(h.adb, pkg);
          await viewIntent(h.adb, miniAppLink(leg.bot), pkg);
        } else {
          pkg = h.browserPackage;
          if (ingress.changed) await forceStop(h.adb, pkg);
          await viewIntent(h.adb, routeUrl2(opts.baseUrl, "/").url, pkg);
        }
        const socket = await attachSocket(ctx, h, pkg, leg.surface);
        const fwd = await forwardSocket(h.adb, socket);
        const local = await h.rig.forward(fwd.port);
        const holder = { session: null, early: [] };
        const onEvent = (ev) => {
          if (holder.session) holder.session.record(ev);
          else holder.early.push(ev);
        };
        const page = await openVisiblePage(ctx.deps, local, onEvent);
        const session = new _AndroidSession(ctx, h, opts, target, page, fwd.port, fwd.reused);
        holder.session = session;
        for (const ev of holder.early) session.record(ev);
        for (const domain of ["Runtime.enable", "Log.enable", "Network.enable"]) await page.client.send(domain);
        return session;
      }
      record(ev) {
        const line = logLineOf(ev, new Date(this.ctx.deps.clock.now()).toISOString());
        if (line) this.lines.push(line);
      }
      alive(call) {
        if (this.closed) throw closedError(this.target, call);
      }
      async evaluate(expression) {
        this.alive("evaluate");
        return this.page.client.evaluate(expression);
      }
      async navigate(route) {
        this.alive("navigate");
        const { url, path } = routeUrl2(this.opts.baseUrl, route);
        if (this.opts.leg.surface === "miniapp") {
          await this.evaluate(pushRouteExpression(path));
          return;
        }
        await this.page.client.send("Page.navigate", { url });
        await poll(this.ctx.deps.clock, async () => await this.evaluate("document.readyState") === "loading" ? null : true, {
          timeoutMs: 15e3,
          everyMs: 200,
          code: "qa.target.navigate",
          what: `The load of ${route} on ${this.h.adb.serial}`
        });
      }
      async act(step) {
        this.alive("act");
        if (step.kind === "wait") return waitAct(this.ctx.deps.clock, step);
        if (step.kind === "back") {
          const before = await this.currentRoute();
          this.height ??= (await wmSize(this.h.adb)).height;
          await backGesture(this.h.adb, this.height);
          const deadline = this.ctx.deps.clock.now() + 3e3;
          while (this.ctx.deps.clock.now() < deadline && await this.currentRoute() === before) await this.ctx.deps.clock.sleep(200);
          return;
        }
        await pageAct(step, (e) => this.evaluate(e), this.target);
      }
      async settle(rule) {
        this.alive("settle");
        await pollSettle(this.ctx.deps.clock, rule, (e) => this.evaluate(e), this.target);
      }
      async currentRoute() {
        this.alive("currentRoute");
        return relativeRoute2(this.opts.baseUrl, String(await this.evaluate(ROUTE_EXPRESSION)));
      }
      async screenshot(path) {
        this.alive("screenshot");
        const visibility = String(await this.evaluate(VISIBILITY_EXPRESSION));
        if (visibility !== "visible") {
          throw new LaunchwrightError("qa.target.screenshot", `The page this row drove is ${visibility} on ${this.h.adb.serial}: the screenshot would show another page.`);
        }
        return writePng(path, await screencap(this.h.adb), this.target);
      }
      async startVideo(path) {
        this.alive("startVideo");
        if (this.video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session already records ${this.video.path}.`);
        const capS = Math.min(this.ctx.config.evidence.videoCapS, SCREENRECORD_MAX_S);
        const startedAt = this.ctx.deps.clock.now();
        if (this.h.recorder === "screenrecord") {
          const rec = await startScreenrecord(this.h.adb, this.ctx.deps, capS, (0, import_node_path26.basename)(path));
          this.video = { path, startedAt, stop: () => rec.stop() };
          return;
        }
        this.video = { path, startedAt, stop: await this.startScrcpy(path, capS) };
      }
      /** `scrcpy --record` on this machine. Over an ssh rig its video socket rides the master on one port number. */
      async startScrcpy(path, capS) {
        const port = await this.ctx.deps.freePort();
        const args = ["-s", this.h.adb.serial, "--no-playback", "--no-audio", "--no-window", `--record=${path}`, `--time-limit=${capS}`, "-p", String(port)];
        const env = {};
        if (this.h.rig.remote) {
          await this.h.rig.forward(port, port);
          args.push("--force-adb-forward");
          env.ANDROID_ADB_SERVER_PORT = String(await this.h.rig.adbPort());
        }
        const proc = this.ctx.deps.run.start(this.ctx.config.device.tools.scrcpy, args, { env, timeoutMs: (capS + SCRCPY_GRACE_S) * 1e3 });
        return async () => {
          proc.signal("SIGINT");
          const res = await proc.done;
          if (this.h.rig.remote) await this.h.rig.unforward(port);
          if (res.code !== 0 && res.code !== 128) throw new LaunchwrightError("qa.device.record", `scrcpy --record exited ${res.code}: ${res.stderr.trim().slice(0, 300)}`);
          return null;
        };
      }
      async stopVideo() {
        this.alive("stopVideo");
        const video = this.video;
        if (!video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session records no video; call startVideo first.`);
        this.video = null;
        const short = MIN_CLIP_MS2 - (this.ctx.deps.clock.now() - video.startedAt);
        if (short > 0) await this.ctx.deps.clock.sleep(short);
        const bytes = await video.stop();
        const durationMs = this.ctx.deps.clock.now() - video.startedAt;
        if (bytes) await writeBytes(video.path, bytes);
        await holdLastFrame(this.ctx.deps, this.ctx.config.device.tools.ffmpeg, video.path, durationMs);
        return { path: video.path, durationMs };
      }
      async trace() {
        this.alive("trace");
        return null;
      }
      async dump(path) {
        this.alive("dump");
        const xml = await poll(this.ctx.deps.clock, () => uiDump(this.h.adb), {
          timeoutMs: 8e3,
          everyMs: 800,
          code: "qa.device.dump",
          what: `A uiautomator dump of ${this.h.adb.serial}`
        });
        await writeBytes(path, Buffer.from(xml));
        return path;
      }
      async logs() {
        return [...this.lines];
      }
      async close() {
        if (this.closed) return;
        this.closed = true;
        const video = this.video;
        this.video = null;
        this.page.client.close();
        if (video) await video.stop();
        if (!this.reused) {
          await this.h.rig.unforward(this.rigPort);
          await removeForward(this.h.adb, this.rigPort);
        }
      }
    };
  }
});

// src/kernel/services/fetch.mts
function isRedirect(res) {
  return res.type === "opaqueredirect" || REDIRECT_STATUSES.has(res.status);
}
var REDIRECT_STATUSES;
var init_fetch = __esm({
  "src/kernel/services/fetch.mts"() {
    "use strict";
    init_cjs_shims();
    init_clock();
    init_errors();
    REDIRECT_STATUSES = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
  }
});

// src/device/services/browserstack.mts
async function redirected(call, res) {
  await res.body?.cancel();
  return new LaunchwrightError("qa.device.browserstack.redirect", `${call} answered a redirect ${res.status}, which is not followed`, { context: { status: res.status } });
}
function createBrowserstackClient(cfg, deps) {
  if (!cfg.username || !cfg.accessKey) {
    throw new LaunchwrightError(
      "qa.device.browserstack.keys",
      "BrowserStack needs qa.device.browserstack.username and accessKey. Store BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in the secret store and map them into the qa config."
    );
  }
  const authorization = `Basic ${Buffer.from(`${cfg.username}:${cfg.accessKey}`).toString("base64")}`;
  return {
    async wd(method, path, body, timeoutMs = 9e4) {
      const res = await deps.fetch(`${cfg.hub}${path}`, {
        method,
        headers: { "content-type": "application/json", authorization },
        ...body === void 0 ? {} : { body: JSON.stringify(body) },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (isRedirect(res)) throw await redirected(`${method} ${path}`, res);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (err) {
        throw new WebDriverError(`${method} ${path} answered ${res.status} with no JSON: ${text.slice(0, 200)}`, res.status, "no json", err);
      }
      const error = json.value?.error;
      if (!res.ok || error) {
        throw new WebDriverError(`${method} ${path} answered ${res.status}: ${error ?? ""} ${String(json.value?.message ?? "").slice(0, 300)}`.trim(), res.status, error ?? "");
      }
      return json.value;
    },
    async api(path) {
      const res = await deps.fetch(`${cfg.api}${path}`, { headers: { authorization }, redirect: "manual", signal: AbortSignal.timeout(3e4) });
      if (isRedirect(res)) throw await redirected(`GET ${path}`, res);
      const text = await res.text();
      if (!res.ok) throw new LaunchwrightError("qa.device.browserstack.api", `GET ${path} answered ${res.status}: ${text.slice(0, 200)}`);
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new LaunchwrightError("qa.device.browserstack.api", `GET ${path} answered ${text.length} bytes that are not JSON.`, { cause: err });
      }
    }
  };
}
function capabilities(kind, keys, cfg, sessionName) {
  const traits = deviceKind(kind);
  return {
    capabilities: {
      alwaysMatch: {
        browserName: traits.browser ?? "safari",
        // A kind with `console` keeps the page console for `se/log` (chromedriver); Safari over WebDriver has none.
        ...traits.console === true ? { "goog:loggingPrefs": { browser: "ALL" } } : {},
        "bstack:options": {
          deviceName: keys.model,
          osVersion: keys.os,
          realMobile: "true",
          projectName: cfg.project,
          buildName: cfg.build,
          sessionName,
          idleTimeout: cfg.idleTimeoutS,
          debug: false,
          networkLogs: false
        }
      }
    }
  };
}
function asyncScript(expression) {
  const expr = expression.trim().replace(/;+\s*$/, "");
  return `var done = arguments[arguments.length - 1];
var fail = function (e) { done({ ok: false, error: String((e && e.stack) || e) }); };
try {
  Promise.resolve((function () { return (
${expr}
); })()).then(function (v) { done({ ok: true, value: v === undefined ? null : v }); }, fail);
} catch (e) { fail(e); }`;
}
function minuteSummary(sessions, plan2) {
  const seconds = sessions.map((s) => Number(s.duration) || 0);
  return {
    plan: String(plan2.automate_plan ?? "unknown"),
    sessions: seconds.length,
    minutes: Math.round(seconds.reduce((a, b) => a + b, 0) / 6) / 10,
    billedMinutes: seconds.reduce((a, s) => a + Math.ceil(s / 60), 0),
    running: Number(plan2.parallel_sessions_running ?? 0),
    parallel: Number(plan2.parallel_sessions_max_allowed ?? 0)
  };
}
function budgetLine(s, cfg) {
  return `Automate plan ${s.plan}: ${s.minutes} min used over ${s.sessions} session(s), ${s.billedMinutes} min rounded up; ${s.running} of ${s.parallel} parallel running; per-run budget ${cfg.budgetMinutes} min`;
}
async function allSessions(client) {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const builds = await client.api(`/builds.json?limit=100&offset=${offset}`);
    for (const { automation_build: b } of builds) {
      for (let so = 0; ; so += 100) {
        const page = await client.api(`/builds/${b.hashed_id}/sessions.json?limit=100&offset=${so}`);
        rows.push(...page.map((p) => p.automation_session));
        if (page.length < 100) break;
      }
    }
    if (builds.length < 100) return rows;
  }
}
async function budget(client) {
  const [plan2, sessions] = await Promise.all([client.api("/plan.json"), allSessions(client)]);
  return minuteSummary(sessions, plan2);
}
function heldSessionPath(root) {
  return (0, import_node_path27.join)(root, DEVICE_STATE_DIR, "browserstack-session.json");
}
async function readHeld(root) {
  return await readJsonOrNull(heldSessionPath(root));
}
async function writeHeld(root, held) {
  const path = heldSessionPath(root);
  if (held === null) {
    await (0, import_promises15.rm)(path, { force: true });
    return;
  }
  await (0, import_promises15.mkdir)((0, import_node_path27.dirname)(path), { recursive: true });
  await (0, import_promises15.writeFile)(path, `${JSON.stringify(held, null, 1)}
`);
}
function checkBudget(startedAt, now, cfg) {
  const usedMin = (now - startedAt) / 6e4;
  if (usedMin > cfg.budgetMinutes) {
    throw new LaunchwrightError(
      "qa.device.browserstack.budget",
      `The BrowserStack session has run ${usedMin.toFixed(1)} min, past the per-run budget of ${cfg.budgetMinutes} min (qa.device.browserstack.budgetMinutes). It was closed.`,
      { context: { usedMin, budgetMinutes: cfg.budgetMinutes } }
    );
  }
}
var import_promises15, import_node_path27, WebDriverError;
var init_browserstack = __esm({
  "src/device/services/browserstack.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises15 = require("fs/promises");
    import_node_path27 = require("path");
    init_kernel();
    init_fetch();
    init_fs();
    init_device_kinds();
    init_rigs();
    WebDriverError = class extends LaunchwrightError {
      constructor(message, status, wdCode, cause) {
        super("qa.device.browserstack.webdriver", message, { ...cause === void 0 ? {} : { cause }, context: { status, wdCode } });
        this.status = status;
        this.wdCode = wdCode;
      }
      status;
      wdCode;
    };
  }
});

// src/device/services/simctl.mts
function parseSimList(stdout) {
  const devices = [];
  let runtime = "";
  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line) continue;
    const heading = /^--\s*(.+?)\s*--$/.exec(line);
    if (heading) {
      runtime = heading[1];
      continue;
    }
    const row = /^\s{2,}(.+?)\s+\(([0-9A-Fa-f-]{36})\)\s+\(([A-Za-z]+)\)(.*)$/.exec(line);
    if (!row) continue;
    devices.push({
      name: row[1],
      udid: row[2],
      runtime,
      state: row[3],
      booted: row[3] === "Booted",
      available: !/unavailable/i.test(row[4] ?? "")
    });
  }
  return devices;
}
function simctl(args) {
  return [XCRUN, "simctl", ...args].map(shq).join(" ");
}
async function listSimulators(rig) {
  return parseSimList(orFail(await rig.exec(simctl(["list", "devices"])), "qa.device.simctl", "simctl list devices"));
}
async function bootedSimulator(rig, udid) {
  const all = await listSimulators(rig);
  const booted2 = all.filter((d) => d.booted);
  const hit = udid ? booted2.find((d) => d.udid === udid) : booted2.length === 1 ? booted2[0] : void 0;
  if (hit) return hit;
  const why = udid ? "the configured simulator is not booted" : `${booted2.length} simulators are booted, and the device names no udid`;
  throw new LaunchwrightError(
    "qa.device.simctl.booted",
    `No simulator to drive on rig ${rig.name}: ${why}. Booting one is an operator step, because a simulator can hold a signed-in Telegram.`
  );
}
async function openUrl(rig, udid, url) {
  if (!/^https?:\/\//i.test(url)) throw new LaunchwrightError("qa.device.simctl", `simctl openurl takes an http(s) URL, not ${url.split(":")[0]}:.`);
  orFail(await rig.exec(simctl(["openurl", udid, url])), "qa.device.simctl", "simctl openurl");
}
async function simScreenshot(rig, udid, remotePath) {
  const text = orFail(await rig.exec(simctl(["io", udid, "screenshot", remotePath])), "qa.device.simctl", "simctl io screenshot");
  if (!/Wrote screenshot to/i.test(text)) throw new LaunchwrightError("qa.device.simctl", `simctl io screenshot said nothing about ${remotePath}.`);
  const read = await rig.exec(`cat ${shq(remotePath)} && rm -f ${shq(remotePath)}`, { timeoutMs: 6e4 });
  orFail(read, "qa.device.simctl", `reading ${remotePath}`);
  return read.stdout;
}
async function startSimVideo(rig, udid, remotePath) {
  const cmd = `rm -f ${shq(remotePath)}; nohup ${simctl(["io", udid, "recordVideo", "--codec=h264", "--force", remotePath])} >/dev/null 2>&1 & echo $!`;
  const pid = Number(orFail(await rig.exec(cmd), "qa.device.simctl", "simctl io recordVideo").trim().split("\n").pop());
  if (!Number.isInteger(pid) || pid <= 0) throw new LaunchwrightError("qa.device.simctl", "simctl io recordVideo printed no pid.");
  return pid;
}
async function stopSimVideo(rig, pid, remotePath) {
  const wait = `kill -INT ${pid}; i=0; while kill -0 ${pid} 2>/dev/null; do i=$((i+1)); [ $i -ge 50 ] && exit 3; sleep 0.2; done`;
  const stopped = await rig.exec(wait, { timeoutMs: 3e4 });
  if (stopped.code !== 0) throw new LaunchwrightError("qa.device.simctl", `The simulator recorder (pid ${pid}) did not stop within 10 s: ${said(stopped)}`);
  const read = await rig.exec(`cat ${shq(remotePath)} && rm -f ${shq(remotePath)}`, { timeoutMs: 12e4 });
  orFail(read, "qa.device.simctl", `reading ${remotePath}`);
  if (read.stdout.length === 0) throw new LaunchwrightError("qa.device.simctl", "The simulator recorder wrote an empty file.");
  return read.stdout;
}
var XCRUN;
var init_simctl = __esm({
  "src/device/services/simctl.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_text();
    init_process();
    init_rigs();
    XCRUN = "/usr/bin/xcrun";
  }
});

// src/device/services/webkit.mts
function parseDeviceList(json) {
  if (!Array.isArray(json)) throw new LaunchwrightError("qa.device.webkit", `The proxy device list is not an array (got ${typeof json}).`);
  return json.map((row, i) => {
    const id = String(row?.deviceId ?? "").trim();
    if (!id) throw new LaunchwrightError("qa.device.webkit", `Device ${i} in the proxy list has no deviceId.`);
    const m = /:(\d+)$/.exec(String(row.url ?? "").trim());
    const port = m ? Number(m[1]) : 0;
    if (!(port > 0 && port < 65536)) throw new LaunchwrightError("qa.device.webkit", `Device ${i} in the proxy list has no page port in its url.`);
    return { id, name: String(row.deviceName ?? "").trim(), version: String(row.deviceOSVersion ?? "").trim(), port };
  });
}
function isDocument(page) {
  return Boolean(page.url) && page.title !== "JSContext";
}
function pickPage(list2, match) {
  const pages = Array.isArray(list2) ? list2 : [];
  const docs = pages.filter(isDocument);
  const seen = pages.length ? `${pages.length} page(s)` : "no pages";
  if (docs.length === 0) {
    throw new LaunchwrightError("qa.device.webkit.page", `No inspectable page (${seen}). Unlock the iPhone and open the page in Safari or the Mini App.`);
  }
  if (!match) return docs.find((p) => !String(p.url).startsWith("about:blank")) ?? docs[0];
  const needle = match.toLowerCase();
  const hit = docs.find((p) => `${p.url ?? ""} ${p.title ?? ""}`.toLowerCase().includes(needle));
  if (!hit) throw new LaunchwrightError("qa.device.webkit.page", `No page matches ${JSON.stringify(match)} (${seen}).`);
  return hit;
}
function localise(wsUrl, port) {
  const url = String(wsUrl ?? "");
  if (!/^wss?:\/\/[^/]+\//.test(url)) throw new LaunchwrightError("qa.device.webkit", "The page has no usable webSocketDebuggerUrl.");
  return url.replace(/^wss?:\/\/[^/]+/, `ws://127.0.0.1:${port}`);
}
function framed(targetId, id, method, params = {}) {
  return { id, method: "Target.sendMessageToTarget", params: { targetId, message: JSON.stringify({ id, method, params }) } };
}
function unframe(raw) {
  const frame = JSON.parse(String(raw));
  if (frame.method === "Target.targetCreated") return { kind: "target-created", targetId: String(frame.params?.targetInfo?.targetId ?? "") };
  if (frame.method === "Target.dispatchMessageFromTarget") {
    const m = frame.params?.message;
    return { kind: "from-target", message: typeof m === "string" ? JSON.parse(m) : m };
  }
  return frame.method ? { kind: "other", method: frame.method } : { kind: "other" };
}
function proxyCommand(listPort, pagePort) {
  return `sudo ios_webkit_debug_proxy -c null:${listPort},:${pagePort}-${pagePort + 77}`;
}
function withTarget(deps, page, port, timeoutMs, fn) {
  const url = localise(page.webSocketDebuggerUrl, port);
  const done = deferred();
  const resolve5 = done.resolve;
  const reject = done.reject;
  const ws = deps.socket(url, { origin: `http://127.0.0.1:${port}` });
  const pending = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  let targetId = null;
  let nextId = 0;
  let settled = false;
  const timer = setTimeout(() => {
    finish(
      new LaunchwrightError(
        "qa.device.webkit.timeout",
        targetId ? `The page did not answer within ${timeoutMs / 1e3} s.` : `The page announced no target within ${timeoutMs / 1e3} s. The iPhone is locked, or the page is gone.`
      )
    );
  }, timeoutMs);
  function finish(error, value) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    for (const slot of pending.values()) slot.reject(new LaunchwrightError("qa.device.webkit", `${slot.method} was in flight when the session ended.`));
    pending.clear();
    listeners.clear();
    ws.onclose = null;
    ws.close();
    if (error) reject(error);
    else resolve5(value);
  }
  const session = {
    send(method, params = {}) {
      return new Promise((ok, no) => {
        if (settled || !targetId) {
          no(new LaunchwrightError("qa.device.webkit", `${method} was sent outside a live target.`));
          return;
        }
        nextId += 1;
        pending.set(nextId, { method, resolve: ok, reject: no });
        ws.send(JSON.stringify(framed(targetId, nextId, method, params)));
      });
    },
    on(handler) {
      listeners.add(handler);
    }
  };
  ws.onmessage = (ev) => {
    let frame;
    try {
      frame = unframe(ev.data);
    } catch (err) {
      finish(new LaunchwrightError("qa.device.webkit", "The inspector sent a frame that is not JSON.", { cause: err }));
      return;
    }
    if (frame.kind === "target-created") {
      if (targetId) return;
      targetId = frame.targetId;
      fn(session).then(
        (v) => finish(null, v),
        (e) => finish(e instanceof Error ? e : new LaunchwrightError("qa.device.webkit", String(e)))
      );
      return;
    }
    if (frame.kind === "from-target") {
      const inner = frame.message;
      const slot = inner.id === void 0 ? void 0 : pending.get(inner.id);
      if (!slot) {
        if (inner.method) for (const h of [...listeners]) h({ method: inner.method, ...inner.params ? { params: inner.params } : {} });
        return;
      }
      pending.delete(inner.id);
      if (inner.error) slot.reject(new LaunchwrightError("qa.device.webkit", `${slot.method} failed: ${JSON.stringify(inner.error)}`));
      else slot.resolve(inner.result ?? {});
      return;
    }
    if (frame.method === "Target.targetDestroyed") finish(new LaunchwrightError("qa.device.webkit", "The page closed its inspector target."));
  };
  ws.onerror = () => finish(new LaunchwrightError("qa.device.webkit", `The inspector socket failed (${url}).`));
  ws.onclose = () => finish(new LaunchwrightError("qa.device.webkit", "The inspector socket closed before the command finished."));
  return done.promise;
}
function refuseIfThrown(reply) {
  if (!reply.wasThrown && !reply.exceptionDetails) return;
  const remote = reply.result ?? {};
  throw new LaunchwrightError("qa.device.eval", `The page threw on the iPhone: ${String(remote.description ?? remote.value ?? "unknown error").slice(0, 500)}`);
}
function unwrap(reply) {
  refuseIfThrown(reply);
  const remote = reply.result ?? {};
  if (remote.type === "undefined") return void 0;
  return "value" in remote ? remote.value : remote;
}
async function webkitEvaluate(s, expression) {
  await s.send("Runtime.enable");
  const first = await s.send("Runtime.evaluate", { expression, returnByValue: false });
  refuseIfThrown(first);
  const remote = first.result ?? {};
  if (remote.className === "Promise" && remote.objectId) return unwrap(await s.send("Runtime.awaitPromise", { promiseObjectId: remote.objectId, returnByValue: true }));
  if (remote.objectId) {
    return unwrap(await s.send("Runtime.callFunctionOn", { objectId: remote.objectId, functionDeclaration: "function () { return this; }", returnByValue: true }));
  }
  return unwrap(first);
}
async function webkitSnapshot(s) {
  const size = await webkitEvaluate(s, "({ w: innerWidth, h: innerHeight })");
  const width = Math.round(size?.w ?? 0);
  const height = Math.round(size?.h ?? 0);
  if (!(width > 0 && height > 0)) throw new LaunchwrightError("qa.device.webkit", `The page reported a ${width}x${height} viewport, which cannot be captured.`);
  await s.send("Page.enable");
  const shot = await s.send("Page.snapshotRect", { x: 0, y: 0, width, height, coordinateSystem: "Viewport" });
  const dataURL = typeof shot.dataURL === "string" ? shot.dataURL : "";
  const at = dataURL.indexOf("base64,");
  if (at === -1) throw new LaunchwrightError("qa.device.webkit", "Page.snapshotRect answered no base64 dataURL.");
  return Buffer.from(dataURL.slice(at + "base64,".length), "base64");
}
async function webkitConsole(deps, s, ms) {
  const lines = [];
  s.on((ev) => {
    if (ev.method !== "Console.messageAdded") return;
    const m = ev.params?.message ?? {};
    lines.push({ source: m.source ?? "other", level: m.level ?? "log", text: String(m.text ?? "").slice(0, 500) });
  });
  await s.send("Console.enable");
  await deps.clock.sleep(ms);
  return lines;
}
async function proxyJson(deps, port, what) {
  const url = `http://127.0.0.1:${port}/json`;
  let res;
  try {
    res = await deps.fetch(url, { signal: AbortSignal.timeout(8e3) });
  } catch (err) {
    throw new LaunchwrightError("qa.device.webkit.proxy", `The ${what} on :${port} did not answer: ${err.message}. Is ios_webkit_debug_proxy running on the rig?`, { cause: err });
  }
  if (!res.ok) throw new LaunchwrightError("qa.device.webkit.proxy", `The ${what} on :${port} answered HTTP ${res.status}.`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new LaunchwrightError("qa.device.webkit.proxy", `The ${what} on :${port} did not answer JSON.`, { cause: err });
  }
}
var init_webkit = __esm({
  "src/device/services/webkit.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_process();
  }
});

// src/device/services/ios-session.mts
async function webkitAccess(ctx, rig, listPort, match, udid) {
  const listLocal = await rig.forward(listPort);
  const phones = parseDeviceList(await proxyJson(ctx.deps, listLocal, "device list"));
  const phone = udid ? phones.find((p) => p.id === udid) : phones.length === 1 ? phones[0] : void 0;
  if (!phone) {
    throw new LaunchwrightError(
      "qa.device.webkit.pairing",
      udid ? `The configured iPhone is not in the proxy device list on rig ${rig.name} (${phones.length} listed). Unlock it, trust the rig, and turn on Web Inspector in Settings > Safari > Advanced.` : `The proxy on rig ${rig.name} lists ${phones.length} devices. Set the udid of the device to pick one.`
    );
  }
  const pageLocal = await rig.forward(phone.port);
  const on = async (timeoutMs, fn) => {
    const page = pickPage(await proxyJson(ctx.deps, pageLocal, "page list"), match);
    return withTarget(ctx.deps, page, pageLocal, timeoutMs, fn);
  };
  return {
    on,
    evaluate: (expression) => on(INSPECTOR_TIMEOUT_MS, (s) => webkitEvaluate(s, expression)),
    snapshot: () => on(3e4, (s) => webkitSnapshot(s)),
    async logs() {
      const lines = await on(INSPECTOR_TIMEOUT_MS + CONSOLE_WINDOW_MS, (s) => webkitConsole(ctx.deps, s, CONSOLE_WINDOW_MS));
      const at = new Date(ctx.deps.clock.now()).toISOString();
      return lines.flatMap((l) => {
        const kind = consoleLogKind(l);
        return kind ? [{ at, kind, text: l.text }] : [];
      });
    },
    async close() {
      await rig.unforward(phone.port);
      await rig.unforward(listPort);
    }
  };
}
async function deviceAccess(ctx, name, match) {
  const { resolved, rig, kind } = iosDevice(ctx, name, "ios");
  await rig.ensure();
  if (kind.simulator !== true) {
    const keys2 = deviceKeys(resolved.name, resolved.device, iosDeviceKeys);
    return webkitAccess(ctx, rig, rig.config.webkitPorts?.[0] ?? DEFAULT_WEBKIT_PORTS[0], match ?? keys2.match, keys2.udid);
  }
  const keys = deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys);
  if (!keys.inspectorPort) throw noInspector(rig.name, resolved.name);
  return webkitAccess(ctx, rig, keys.inspectorPort, match);
}
function noInspector(rig, device) {
  return new LaunchwrightError(
    "qa.device.simulator.inspector",
    `Simulator ${device} has no page access: start ios_webkit_debug_proxy on the simulator socket of rig ${rig} (-s unix:<webinspectord_sim socket>) and set qa.device.devices.${device}.inspectorPort.`
  );
}
async function loadAndWait(ctx, access, load, route) {
  const before = await access.evaluate("performance.timeOrigin");
  await load();
  await poll(
    ctx.deps.clock,
    async () => {
      try {
        const [origin, state] = await access.evaluate("[performance.timeOrigin, document.readyState]");
        return origin !== before && state !== "loading" ? true : null;
      } catch (err) {
        if (isCodedError(err) && err.code.startsWith("qa.device.webkit")) return null;
        throw err;
      }
    },
    { timeoutMs: 3e4, everyMs: 300, code: "qa.target.navigate", what: `The load of ${route}` }
  );
}
function iosDevice(ctx, deviceName, target, simulator) {
  const resolved = resolveDevice(ctx.config, deviceName);
  const kind = deviceKind(resolved.device.kind);
  if (kind.access !== "webkit" || simulator !== void 0 && kind.simulator === true !== simulator) {
    const drives = simulator === void 0 ? "an iOS device" : simulator ? "an iOS simulator" : "an iPhone";
    throw new LaunchwrightError("qa.device.kind", `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives ${drives}.`);
  }
  return { resolved, rig: ctx.rigs.get(resolved.rigName), kind };
}
function simulatorReadiness(name, keys) {
  if (keys.inputTool) return null;
  return `The ios-simulator target has no input tool: simctl opens URLs and films the screen, and cannot tap. No input tool is configured in qa.device.devices.${name}.inputTool, so rows with act steps are n/a on this device.`;
}
var DEFAULT_WEBKIT_PORTS, INSPECTOR_TIMEOUT_MS, CONSOLE_WINDOW_MS, PhoneSession, SimulatorSession;
var init_ios_session = __esm({
  "src/device/services/ios-session.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_config3();
    init_page_script();
    init_process();
    init_device_kinds();
    init_rigs();
    init_session_base();
    init_simctl();
    init_webkit();
    DEFAULT_WEBKIT_PORTS = [9221, 9222];
    INSPECTOR_TIMEOUT_MS = 2e4;
    CONSOLE_WINDOW_MS = 500;
    PhoneSession = class _PhoneSession {
      constructor(ctx, opts, access, target) {
        this.ctx = ctx;
        this.opts = opts;
        this.access = access;
        this.target = target;
      }
      ctx;
      opts;
      access;
      target;
      closed = false;
      static async open(ctx, opts, target) {
        const { resolved } = iosDevice(ctx, opts.leg.device, target, false);
        const keys = deviceKeys(resolved.name, resolved.device, iosDeviceKeys);
        const access = await deviceAccess(ctx, resolved.name, keys.match ?? new URL(opts.baseUrl).host);
        return new _PhoneSession(ctx, opts, access, target);
      }
      alive(call) {
        if (this.closed) throw closedError(this.target, call);
      }
      async evaluate(expression) {
        this.alive("evaluate");
        return this.access.evaluate(expression);
      }
      async navigate(route) {
        this.alive("navigate");
        const { url } = routeUrl2(this.opts.baseUrl, route);
        await loadAndWait(this.ctx, this.access, () => this.access.evaluate(hrefExpression(url)), route);
      }
      async act(_step) {
        this.alive("act");
        throw capabilityError2(this.target, "input", "run an act step (it navigates by location.href only)");
      }
      async settle(rule) {
        this.alive("settle");
        await pollSettle(this.ctx.deps.clock, rule, (e) => this.access.evaluate(e), this.target);
      }
      async currentRoute() {
        this.alive("currentRoute");
        return relativeRoute2(this.opts.baseUrl, String(await this.access.evaluate(ROUTE_EXPRESSION)));
      }
      async screenshot(path) {
        this.alive("screenshot");
        return writePng(path, await this.access.snapshot(), this.target);
      }
      async startVideo(_path) {
        this.alive("startVideo");
        throw capabilityError2(this.target, "video", "record a video");
      }
      async stopVideo() {
        this.alive("stopVideo");
        throw capabilityError2(this.target, "video", "record a video");
      }
      async trace() {
        return null;
      }
      async dump() {
        return null;
      }
      async logs() {
        this.alive("logs");
        return this.access.logs();
      }
      async close() {
        if (this.closed) return;
        this.closed = true;
        await this.access.close();
      }
    };
    SimulatorSession = class _SimulatorSession {
      constructor(ctx, opts, rig, udid, access, name, target) {
        this.ctx = ctx;
        this.opts = opts;
        this.rig = rig;
        this.udid = udid;
        this.access = access;
        this.name = name;
        this.target = target;
      }
      ctx;
      opts;
      rig;
      udid;
      access;
      name;
      target;
      closed = false;
      video = null;
      shots = 0;
      static async open(ctx, opts, target) {
        const { resolved, rig } = iosDevice(ctx, opts.leg.device, target, true);
        const keys = deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys);
        await rig.ensure();
        const sim = await bootedSimulator(rig, keys.udid);
        const access = keys.inspectorPort ? await deviceAccess(ctx, resolved.name, new URL(opts.baseUrl).host) : null;
        return new _SimulatorSession(ctx, opts, rig, sim.udid, access, resolved.name, target);
      }
      alive(call) {
        if (this.closed) throw closedError(this.target, call);
      }
      /** The page access, or a refusal that names the config key. */
      page() {
        if (this.access) return this.access;
        throw noInspector(this.rig.name, this.name);
      }
      remote(ext) {
        this.shots += 1;
        return `/tmp/lw-qa-${this.udid.slice(0, 8)}-${this.ctx.deps.clock.now()}-${this.shots}.${ext}`;
      }
      async evaluate(expression) {
        this.alive("evaluate");
        return this.page().evaluate(expression);
      }
      async navigate(route) {
        this.alive("navigate");
        const { url } = routeUrl2(this.opts.baseUrl, route);
        if (!this.access) {
          await openUrl(this.rig, this.udid, url);
          return;
        }
        await loadAndWait(this.ctx, this.access, () => openUrl(this.rig, this.udid, url), route);
      }
      async act(_step) {
        this.alive("act");
        throw capabilityError2(this.target, "input", "run an act step (simctl has no input verb)");
      }
      async settle(rule) {
        this.alive("settle");
        const page = this.page();
        await pollSettle(this.ctx.deps.clock, rule, (e) => page.evaluate(e), this.target);
      }
      async currentRoute() {
        this.alive("currentRoute");
        return relativeRoute2(this.opts.baseUrl, String(await this.page().evaluate(ROUTE_EXPRESSION)));
      }
      async screenshot(path) {
        this.alive("screenshot");
        return writePng(path, await simScreenshot(this.rig, this.udid, this.remote("png")), this.target);
      }
      async startVideo(path) {
        this.alive("startVideo");
        if (this.video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session already records ${this.video.path}.`);
        const remote = this.remote("mp4");
        const pid = await startSimVideo(this.rig, this.udid, remote);
        this.video = { path, pid, remote, startedAt: this.ctx.deps.clock.now() };
      }
      async stopVideo() {
        this.alive("stopVideo");
        const video = this.video;
        if (!video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session records no video; call startVideo first.`);
        this.video = null;
        await writeBytes(video.path, await stopSimVideo(this.rig, video.pid, video.remote));
        return { path: video.path, durationMs: this.ctx.deps.clock.now() - video.startedAt };
      }
      async trace() {
        return null;
      }
      async dump() {
        return null;
      }
      async logs() {
        this.alive("logs");
        return this.page().logs();
      }
      async close() {
        if (this.closed) return;
        this.closed = true;
        const video = this.video;
        this.video = null;
        if (video) await stopSimVideo(this.rig, video.pid, video.remote);
        await this.access?.close();
      }
    };
  }
});

// src/device/services/doctor.mts
function parseScrcpyVersion(text) {
  const m = /scrcpy\s+v?(\d+(?:\.\d+)*)/i.exec(text);
  return m ? m[1].split(".").map(Number) : null;
}
function versionAtLeast(have, want) {
  for (let i = 0; i < Math.max(have.length, want.length); i += 1) {
    const a = have[i] ?? 0;
    const b = want[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}
async function guard(scope, name, fn) {
  try {
    return await fn();
  } catch (err) {
    if (isCodedError(err)) return fail(scope, name, err.code, err.message);
    throw err;
  }
}
async function toolChecks(ctx, devices) {
  const tools = ctx.config.device.tools;
  const run2 = (bin, args) => ctx.deps.run.run(bin, args, { timeoutMs: 15e3 });
  const android = devices.filter((d) => deviceKind(d.device.kind).access === "adb");
  const checks = [];
  if (android.length > 0) {
    const adb = await run2(tools.adb, ["version"]);
    checks.push(
      adb.code === 0 ? pass("tool", "adb", out(adb).split("\n")[0]?.trim() ?? "") : fail("tool", "adb", said(adb) || `exit ${adb.code}`, 'Install Android platform-tools (sdkmanager "platform-tools", or the distro adb), or set qa.device.tools.adb.')
    );
    const usesScrcpy = android.some((d) => d.device.recorder === "scrcpy");
    const sc = await run2(tools.scrcpy, ["--version"]);
    const have = sc.code === 0 ? parseScrcpyVersion(out(sc)) : null;
    const want = tools.scrcpyVersion.split(".").map(Number);
    const fix = `Install scrcpy ${tools.scrcpyVersion} or newer (github.com/Genymobile/scrcpy/releases), or set qa.device.tools.scrcpy. Older builds fail on Android 15 and later.`;
    if (!have) checks.push(fail("tool", "scrcpy", said(sc) || "not installed", fix, !usesScrcpy));
    else if (!versionAtLeast(have, want)) checks.push(fail("tool", "scrcpy", `version ${have.join(".")} is older than ${tools.scrcpyVersion}`, fix, !usesScrcpy));
    else checks.push(pass("tool", "scrcpy", `version ${have.join(".")}`));
  }
  if (devices.length > 0) {
    const ff = await run2(tools.ffmpeg, ["-version"]);
    checks.push(
      ff.code === 0 ? pass("tool", "ffmpeg", out(ff).split("\n")[0]?.trim() ?? "") : fail("tool", "ffmpeg", said(ff) || "not installed", "Install ffmpeg: the blank-video check of every device video needs it. Or set qa.device.tools.ffmpeg.")
    );
  }
  return checks;
}
async function rigChecks(ctx, devices) {
  const checks = [];
  for (const name of [...new Set(devices.map((d) => d.rigName))].sort()) {
    const rig = ctx.rigs.get(name);
    if (rig.config.transport !== "ssh") continue;
    checks.push(
      await guard(`rig ${name}`, "ssh", async () => {
        await rig.ensure();
        return pass(`rig ${name}`, "ssh", `master open to ${rig.config.host}, BatchMode=yes`);
      })
    );
  }
  return checks;
}
async function androidChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const checks = [];
  const h = androidHandle(ctx, d.name, deviceKind(d.device.kind).target);
  if (h.emulator) {
    const avd = h.emulator.avd;
    checks.push(
      await guard(scope, "sdk", async () => {
        const root = await sdkRoot(h.rig);
        return root ? pass(scope, "sdk", root) : fail(scope, "sdk", `no Android SDK on rig ${h.rig.name}`, `Install the Android SDK command-line tools on rig ${h.rig.name}, then run sdkmanager "emulator" "platform-tools" and the system image of AVD ${avd}.`);
      }),
      await guard(
        scope,
        "avd",
        async () => await avdExists(h.rig, avd) ? pass(scope, "avd", avd) : fail(scope, "avd", `no AVD ${avd} on rig ${h.rig.name}`, `Create AVD ${avd} with avdmanager on rig ${h.rig.name}.`)
      ),
      await guard(
        scope,
        "boot",
        async () => pass(scope, "boot", await booted(h.adb) ? `${h.adb.serial} booted` : `${h.adb.serial} not booted; lw qa device open boots it`)
      )
    );
    return checks;
  }
  checks.push(
    await guard(scope, "pairing", async () => {
      const state = await deviceState(h.rig, h.adb.serial, ctx.deps, ctx.config.device.tools.adb);
      return state === "device" ? pass(scope, "pairing", `${h.adb.serial} attached`) : fail(scope, "pairing", `adb state ${state}`, stateFix(state, h.adb.serial, h.rig.name));
    })
  );
  if (checks.at(-1)?.ok) {
    checks.push(
      await guard(scope, "screen lock", async () => {
        const lock = await keyguard(h.adb);
        if (lock === "open") return pass(scope, "screen lock", "unlocked");
        if (lock === "swipe") return fail(scope, "screen lock", "the lock screen shows", `Dismiss it: adb -s ${h.adb.serial} shell wm dismiss-keyguard on rig ${h.rig.name}.`);
        return fail(scope, "screen lock", "locked with a PIN, pattern or password", `A person unlocks ${d.name} by hand. lw never enters a credential.`);
      })
    );
  }
  return checks;
}
async function iosChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const rig = ctx.rigs.get(d.rigName);
  const [listPort, pagePort] = [rig.config.webkitPorts?.[0] ?? DEFAULT_WEBKIT_PORTS[0], rig.config.webkitPorts?.[1] ?? DEFAULT_WEBKIT_PORTS[1]];
  const proxy = await guard(scope, "ios_webkit_debug_proxy", async () => {
    const res = await rig.exec("command -v ios_webkit_debug_proxy || true; echo ---; pgrep -x ios_webkit_debug_proxy | wc -l");
    const [head = "", tail = ""] = out(res).split("---");
    const path = head.trim().split("\n")[0] ?? "";
    if (!path) return fail(scope, "ios_webkit_debug_proxy", `not installed on rig ${rig.name}`, `Run brew install ios-webkit-debug-proxy on rig ${rig.name}.`);
    if (!(Number(tail.trim()) > 0)) {
      return fail(scope, "ios_webkit_debug_proxy", `installed on rig ${rig.name} and not running`, `Start it at the console of rig ${rig.name}: ${proxyCommand(listPort, pagePort)}. It runs under sudo, so lw never starts it.`);
    }
    return pass(scope, "ios_webkit_debug_proxy", `running on rig ${rig.name}`);
  });
  const checks = [proxy];
  if (proxy.ok) {
    checks.push(
      await guard(scope, "pairing", async () => {
        const access = await deviceAccess(ctx, d.name);
        await access.close();
        return pass(scope, "pairing", "the iPhone is in the proxy device list");
      })
    );
  }
  return checks;
}
async function simulatorChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const rig = ctx.rigs.get(d.rigName);
  const keys = deviceKeys(d.name, d.device, simulatorDeviceKeys);
  const sims = await guard(scope, "simctl", async () => {
    const all = await listSimulators(rig);
    const up = all.filter((s) => s.booted && (!keys.udid || s.udid === keys.udid));
    return up.length > 0 ? pass(scope, "simctl", `${up.length} booted simulator(s)`) : fail(scope, "simctl", "no booted simulator", `Boot the simulator at the console of rig ${rig.name}. lw never boots one: it can hold a signed-in Telegram.`);
  });
  const reason = simulatorReadiness(d.name, keys);
  return [sims, reason ? fail(scope, "input tool", "no input tool is configured", reason) : pass(scope, "input tool", String(keys.inputTool))];
}
async function cloudChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const cfg = ctx.config.device.browserstack;
  return [
    await guard(scope, "browserstack", async () => pass(scope, "browserstack", budgetLine(await budget(createBrowserstackClient(cfg, ctx.deps)), cfg)))
  ];
}
function checksOf(kind) {
  if (kind.access === "adb") return androidChecks;
  if (kind.access === "webkit") return kind.simulator === true ? simulatorChecks : iosChecks;
  return cloudChecks;
}
async function collectDoctor(ctx, deviceName) {
  const names = deviceName ? [deviceName] : Object.keys(ctx.config.device.devices).sort();
  const devices = names.map((n) => resolveDevice(ctx.config, n));
  const checks = [...await toolChecks(ctx, devices), ...await rigChecks(ctx, devices)];
  const rigDown = new Set(checks.filter((c) => c.scope.startsWith("rig ") && !c.ok).map((c) => c.scope.slice(4)));
  for (const d of devices) {
    if (rigDown.has(d.rigName)) {
      checks.push(fail(`device ${d.name}`, "rig", `rig ${d.rigName} is not reachable`, `Fix the ssh check of rig ${d.rigName} first.`));
      continue;
    }
    try {
      checks.push(...await checksOf(deviceKind(d.device.kind))(ctx, d));
    } catch (err) {
      if (!isCodedError(err)) throw err;
      checks.push(fail(`device ${d.name}`, "config", err.code, err.message));
    }
  }
  return checks;
}
function formatDoctor(checks) {
  const lines = [];
  for (const c of checks) {
    const mark = c.ok ? "ok  " : c.optional ? "warn" : "FAIL";
    lines.push(`${mark} ${c.scope.padEnd(18)} ${c.name.padEnd(24)} ${c.detail}`);
    if (!c.ok && c.fix) lines.push(`     fix: ${c.fix}`);
  }
  const blocking = checks.filter((c) => !c.ok && !c.optional).length;
  lines.push(blocking === 0 ? "verdict: ready" : `verdict: ${blocking} check(s) fail`);
  return lines;
}
var pass, fail;
var init_doctor = __esm({
  "src/device/services/doctor.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_config3();
    init_adb();
    init_android_session();
    init_browserstack();
    init_device_kinds();
    init_emulator();
    init_ios_session();
    init_process();
    init_rigs();
    init_simctl();
    init_webkit();
    pass = (scope, name, detail) => ({ scope, name, ok: true, detail });
    fail = (scope, name, detail, fix, optional = false) => ({ scope, name, ok: false, detail, fix, ...optional ? { optional } : {} });
  }
});

// src/device/services/probes.mts
var VIDEO_PROBE, PROBES;
var init_probes = __esm({
  "src/device/services/probes.mts"() {
    "use strict";
    init_cjs_shims();
    VIDEO_PROBE = `(function () {
  function kind(v) {
    var s = v.currentSrc || v.getAttribute('src') || '';
    if (!s) return 'none';
    if (s.indexOf('blob:') === 0) return 'blob (MediaSource)';
    if (/\\.m3u8/.test(s)) return 'm3u8 (native HLS)';
    if (/\\.mp4/.test(s)) return 'mp4';
    return 'other';
  }
  function sample(v) {
    try {
      var c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      var g = c.getContext('2d');
      g.drawImage(v, 0, 0, 32, 32);
      var d = g.getImageData(0, 0, 32, 32).data, sum = 0, max = 0;
      for (var i = 0; i < d.length; i += 4) {
        var l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += l;
        if (l > max) max = l;
      }
      return { meanLuma: Math.round(sum / 1024), maxLuma: Math.round(max) };
    } catch (e) {
      return { error: String(e) };
    }
  }
  function label(el) {
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
  }
  var out = { href: location.href, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight, mse: typeof MediaSource, mms: typeof ManagedMediaSource, videos: [] };
  Array.prototype.slice.call(document.querySelectorAll('video')).forEach(function (v, i) {
    var r = v.getBoundingClientRect();
    var q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
    var rec = {
      i: i, kind: kind(v), readyState: v.readyState, networkState: v.networkState, paused: v.paused, muted: v.muted,
      t: +v.currentTime.toFixed(2), dur: +(v.duration || 0).toFixed(1), w: v.videoWidth, h: v.videoHeight,
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      quality: q ? { total: q.totalVideoFrames, dropped: q.droppedVideoFrames } : null
    };
    if (v.readyState >= 2) rec.luma = sample(v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    if (r.width > 0 && cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) {
      var hit = document.elementFromPoint(cx, cy);
      rec.atCentre = hit ? label(hit) : null;
    }
    out.videos.push(rec);
  });
  return out;
})()`;
    PROBES = { video: VIDEO_PROBE };
  }
});

// src/device/services/device-verbs.mts
async function expressionOf(rest, cwd) {
  const arg = rest.join(" ").trim();
  if (!arg) throw new LaunchwrightError("qa.device.usage", "Give an expression, or @path/to/file.js.");
  return arg.startsWith("@") ? (0, import_promises16.readFile)((0, import_node_path28.resolve)(cwd, arg.slice(1)), "utf8") : arg;
}
function str(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 1);
}
var import_promises16, import_node_path28, VERBS, DeviceVerbs;
var init_device_verbs = __esm({
  "src/device/services/device-verbs.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises16 = require("fs/promises");
    import_node_path28 = require("path");
    init_kernel();
    init_config3();
    init_adb();
    init_android_session();
    init_browserstack();
    init_cdp();
    init_device_kinds();
    init_doctor();
    init_emulator();
    init_ingress();
    init_ios_session();
    init_probes();
    init_process();
    init_rigs();
    init_simctl();
    init_telegram();
    init_webkit();
    init_session_base();
    VERBS = ["list", "doctor", "open", "eval", "logs", "mirror", "tap", "point", "back", "key", "shot", "record", "snapshot", "restore", "install", "down", "budget"];
    DeviceVerbs = class {
      constructor(ctx, opts) {
        this.ctx = ctx;
        this.opts = opts;
      }
      ctx;
      opts;
      get config() {
        return this.ctx.config;
      }
      /** The device, its kind and the traits of its kind. The verbs read the traits, never the kind name. */
      kind(device) {
        const r = resolveDevice(this.config, device);
        return { name: r.name, kind: r.device.kind, traits: deviceKind(r.device.kind) };
      }
      android(device) {
        const { name, kind, traits } = this.kind(device);
        if (traits.access !== "adb") {
          throw new LaunchwrightError("qa.device.verb", `Device ${name} is ${kind}; this verb drives an Android device.`);
        }
        return androidHandle(this.ctx, name, traits.target);
      }
      emulator(device) {
        const h = this.android(device);
        if (!h.emulator) throw new LaunchwrightError("qa.device.verb", `Device ${h.resolved.name} is a phone; snapshot and restore work on an emulator.`);
        return h;
      }
      /** Boots the emulator of an emulator handle, and says whether it was up. A phone needs nothing. */
      async bootIfEmulator(h) {
        if (!h.emulator) return;
        this.out(`emulator ${await bootEmulator(h.rig, h.adb, h.emulator, this.ctx.deps) === "already" ? "already booted" : "booted"}`);
      }
      out(line) {
        this.opts.out(line);
      }
      file(given, name, ext) {
        return given ? (0, import_node_path28.resolve)(this.opts.cwd, given) : (0, import_node_path28.join)(this.ctx.deps.root, DEVICE_STATE_DIR, `${name}.${ext}`);
      }
      /** Attaches to the visible WebView page of an Android device and runs `fn` with its client. */
      async onAndroidPage(h, pkg, fn, onEvent) {
        await h.rig.ensure();
        const found = await sockets(h.adb, pkg);
        const sock = found.find((s) => s.process !== null && processBelongsTo(s.process, pkg)) ?? found.find((s) => s.kind === "webview") ?? found[0];
        if (!sock) throw new LaunchwrightError("qa.device.webview", `No debuggable WebView on ${h.adb.serial}. Open the page first with lw qa device open.`);
        const fwd = await forwardSocket(h.adb, sock.name);
        const local = await h.rig.forward(fwd.port);
        const page = await openVisiblePage(this.ctx.deps, local, onEvent);
        try {
          return await fn(page);
        } finally {
          page.client.close();
          if (!fwd.reused) {
            await h.rig.unforward(fwd.port);
            await removeForward(h.adb, fwd.port);
          }
        }
      }
      async run(verb, p) {
        switch (verb) {
          case "list":
            return this.list();
          case "doctor": {
            const checks = await collectDoctor(this.ctx, p.device);
            for (const line of formatDoctor(checks)) this.out(line);
            return checks.some((c) => !c.ok && !c.optional) ? 1 : 0;
          }
          case "open":
            return this.open(p);
          case "eval":
            return this.evaluate(p);
          case "logs":
            return this.logs(p);
          case "mirror":
            return this.mirror(p);
          case "tap": {
            const h = this.android(p.device);
            const needle = p.rest.join(" ");
            if (!needle) throw new LaunchwrightError("qa.device.usage", "Give the label to tap.");
            const xml = await uiDump(h.adb);
            if (!xml) throw new LaunchwrightError("qa.device.dump", `uiautomator dump on ${h.adb.serial} failed: the UI may be animating. Try again.`);
            const node = findNode(parseNodes(xml), needle);
            if (!node?.bounds) throw new LaunchwrightError("qa.device.tap", `No control on ${h.adb.serial} has a label with ${JSON.stringify(needle)}.`);
            const fx = typeof p.flags.x === "string" ? Number(p.flags.x) : 0.5;
            const x = node.bounds.x1 + (node.bounds.x2 - node.bounds.x1) * fx;
            const y = (node.bounds.y1 + node.bounds.y2) / 2;
            await tap(h.adb, x, y);
            this.out(`tapped ${JSON.stringify(node.text || node.desc)} at ${Math.round(x)},${Math.round(y)}`);
            return 0;
          }
          case "point": {
            const [x, y] = p.rest.map(Number);
            if (!Number.isFinite(x) || !Number.isFinite(y)) throw new LaunchwrightError("qa.device.usage", "Give x and y.");
            if (this.kind(p.device).traits.access === "webdriver") {
              await this.cloud(
                p.device,
                (wd, id) => wd("POST", `/session/${id}/actions`, {
                  actions: [
                    {
                      type: "pointer",
                      id: "finger1",
                      parameters: { pointerType: "touch" },
                      actions: [{ type: "pointerMove", duration: 0, x, y, origin: "viewport" }, { type: "pointerDown", button: 0 }, { type: "pause", duration: 80 }, { type: "pointerUp", button: 0 }]
                    }
                  ]
                })
              );
            } else {
              await tap(this.android(p.device).adb, x, y);
            }
            this.out(`tapped ${x},${y}`);
            return 0;
          }
          case "back": {
            if (this.kind(p.device).traits.access === "webdriver") await this.cloud(p.device, (wd, id) => wd("POST", `/session/${id}/back`, {}));
            else {
              const h = this.android(p.device);
              await backGesture(h.adb, (await wmSize(h.adb)).height);
            }
            this.out("back gesture sent");
            return 0;
          }
          case "key": {
            const h = this.android(p.device);
            const code = p.rest[0] ?? "KEYCODE_BACK";
            await keyevent(h.adb, code);
            this.out(`keyevent ${code}`);
            return 0;
          }
          case "shot":
            return this.shot(p);
          case "record":
            return this.record(p);
          case "snapshot": {
            const h = this.emulator(p.device);
            const path = await snapshotAvd(h.rig, h.emulator.avd, p.rest[0] ?? "", this.ctx.deps.clock.now());
            this.out(`snapshot ${path}`);
            return 0;
          }
          case "restore": {
            const h = this.emulator(p.device);
            const from = await restoreAvd(h.rig, h.adb, h.emulator.avd, p.rest[0], p.flags.force === true);
            this.out(`restored AVD ${h.emulator.avd} from ${from}`);
            const left = await listSnapshots(h.rig, h.emulator.avd);
            this.out(`${left.length} snapshot(s) on rig ${h.rig.name}`);
            return 0;
          }
          case "install": {
            const h = this.android(p.device);
            await h.rig.ensure();
            await this.bootIfEmulator(h);
            const path = await installTelegram(h.adb, this.config.device.telegram, this.ctx.deps, p.flags.force === true);
            this.out(`installed ${this.config.device.telegram.package} from ${path} (sha256 matches the pin) on ${h.resolved.name}`);
            return 0;
          }
          case "down":
            return this.down(p);
          case "budget": {
            const cfg = this.config.device.browserstack;
            this.out(budgetLine(await budget(createBrowserstackClient(cfg, this.ctx.deps)), cfg));
            const held = await readHeld(this.ctx.deps.root);
            this.out(held ? `held session on ${held.device}, open ${Math.round((this.ctx.deps.clock.now() - held.startedAt) / 1e3)} s: run lw qa device down` : "no session held");
            return 0;
          }
        }
      }
      list() {
        const { rigs, devices } = this.config.device;
        for (const [name, rig] of Object.entries(rigs).sort()) {
          this.out(`rig    ${name.padEnd(16)} ${rig.transport}${rig.host ? ` ${rig.host}` : ""}${rig.transport === "ssh" ? `, ingress ${rig.ingress}` : ""}`);
        }
        for (const [name, d] of Object.entries(devices).sort()) this.out(`device ${name.padEnd(16)} ${d.kind.padEnd(17)} rig ${d.rig}`);
        if (Object.keys(devices).length === 0) this.out("no devices in qa.device.devices");
        return 0;
      }
      /** One call on the held BrowserStack session. */
      async cloud(device, fn) {
        this.kind(device);
        const held = await readHeld(this.ctx.deps.root);
        if (!held) throw new LaunchwrightError("qa.device.browserstack.session", "No BrowserStack session is held. Run lw qa device open --url <url> first.");
        const client = createBrowserstackClient(this.config.device.browserstack, this.ctx.deps);
        return fn((m, path, body) => client.wd(m, path, body), held.id);
      }
      async open(p) {
        const { name, kind, traits } = this.kind(p.device);
        const url = typeof p.flags.url === "string" ? p.flags.url : void 0;
        const bot = typeof p.flags.bot === "string" ? p.flags.bot : void 0;
        if (traits.access === "webdriver") {
          if (!url) throw new LaunchwrightError("qa.device.usage", "open on a cloud device needs --url.");
          const cfg = this.config.device.browserstack;
          const client = createBrowserstackClient(cfg, this.ctx.deps);
          this.out(budgetLine(await budget(client), cfg));
          const keys = deviceKeys(name, resolveDevice(this.config, name).device, cloudDeviceKeys);
          const created = await client.wd("POST", "/session", capabilities(kind, keys, cfg, `lw qa device ${name}`), 3e5);
          await writeHeld(this.ctx.deps.root, { id: created.sessionId, device: name, startedAt: this.ctx.deps.clock.now() });
          await client.wd("POST", `/session/${created.sessionId}/url`, { url });
          this.out(`BrowserStack session open on ${name} at ${url}. It spends minutes until lw qa device down.`);
          return 0;
        }
        if (traits.access === "webkit") {
          const access = await deviceAccess(this.ctx, name);
          await access.close();
          this.out(`${name}: the inspector proxy answers. Open the page on the device; lw qa device eval reaches it.`);
          return 0;
        }
        const h = this.android(name);
        if (!url && !bot) throw new LaunchwrightError("qa.device.usage", "open needs --bot <bot username> for a Mini App or --url <url> for the browser.");
        await h.rig.ensure();
        await this.bootIfEmulator(h);
        const pkg = bot ? this.config.device.telegram.package : h.browserPackage;
        if (url) {
          const ingress = await ensureIngress(h.adb, h.rig, this.ctx.deps, url);
          this.out(`ingress ${ingress.mode}${ingress.changed ? ", proxy setting changed" : ""}`);
          if (ingress.changed) await forceStop(h.adb, pkg);
        }
        await viewIntent(h.adb, bot ? miniAppLink(bot) : url, pkg);
        const title = await this.onAndroidPage(h, pkg, async (page) => `${page.target.title ?? ""} ${page.target.url ?? ""}`.trim());
        this.out(`attached: ${title}`);
        return 0;
      }
      async evaluate(p) {
        const probe = typeof p.flags.probe === "string" ? p.flags.probe : void 0;
        if (probe !== void 0 && !PROBES[probe]) throw new LaunchwrightError("qa.device.usage", `No probe ${probe}. Probes: ${Object.keys(PROBES).join(", ")}.`);
        const expr = probe ? PROBES[probe] : await expressionOf(p.rest, this.opts.cwd);
        const { name, traits } = this.kind(p.device);
        let value;
        if (traits.access === "webdriver") {
          const answer = await this.cloud(name, (wd, id) => wd("POST", `/session/${id}/execute/async`, { script: asyncScript(expr), args: [] }));
          if (!answer?.ok) throw new LaunchwrightError("qa.device.eval", `The page threw: ${answer?.error ?? "no answer"}`);
          value = answer.value;
        } else if (traits.access === "webkit") {
          value = await this.onIosPage(name, p, 3e4, (s) => webkitEvaluate(s, expr));
        } else {
          const h = this.android(name);
          const pkg = typeof p.flags.package === "string" ? p.flags.package : this.config.device.telegram.package;
          value = await this.onAndroidPage(h, pkg, (page) => page.client.evaluate(expr));
        }
        this.out(str(value));
        return 0;
      }
      /** Runs `fn` in one inspector session on the page of an iOS device. `--match` picks the page. */
      async onIosPage(name, p, timeoutMs, fn) {
        const access = await deviceAccess(this.ctx, name, typeof p.flags.match === "string" ? p.flags.match : void 0);
        try {
          return await access.on(timeoutMs, fn);
        } finally {
          await access.close();
        }
      }
      async logs(p) {
        const seconds = Number(p.rest[0] ?? 15);
        if (!(seconds > 0)) throw new LaunchwrightError("qa.device.usage", "logs takes a number of seconds.");
        const { name, traits } = this.kind(p.device);
        if (traits.access === "webdriver") throw new LaunchwrightError("qa.device.verb", "WebDriver on a cloud phone exposes no console. The BrowserStack dashboard keeps the session log.");
        this.out(`collecting for ${seconds} s`);
        if (traits.access === "webkit") {
          const lines2 = await this.onIosPage(name, p, seconds * 1e3 + 2e4, (s) => webkitConsole(this.ctx.deps, s, seconds * 1e3));
          for (const l of lines2) this.out(`${`${l.source}.${l.level}`.padEnd(22)} ${l.text}`);
          if (lines2.length === 0) this.out("nothing logged");
          return 0;
        }
        const h = this.android(name);
        const pkg = typeof p.flags.package === "string" ? p.flags.package : this.config.device.telegram.package;
        const lines = [];
        await this.onAndroidPage(
          h,
          pkg,
          async (page) => {
            for (const d of ["Runtime.enable", "Log.enable", "Network.enable"]) await page.client.send(d);
            await this.ctx.deps.clock.sleep(seconds * 1e3);
          },
          (ev) => {
            if (ev.method === "Runtime.consoleAPICalled") {
              const params = ev.params;
              lines.push(`${`console.${params.type}`.padEnd(22)} ${(params.args ?? []).map((a) => str(a.value ?? a.description)).join(" ").slice(0, 300)}`);
              return;
            }
            const line = logLineOf(ev, "");
            if (line) lines.push(`${line.kind.padEnd(22)} ${line.text}`);
          }
        );
        for (const l of lines) this.out(l);
        if (lines.length === 0) this.out("nothing logged");
        return 0;
      }
      async mirror(p) {
        const h = this.android(p.device);
        await h.rig.ensure();
        const args = ["-s", h.adb.serial, "--stay-awake", "--window-title", `${h.resolved.name} (${h.rig.name})`];
        const env = {};
        if (h.rig.remote) {
          const port = await this.ctx.deps.freePort();
          await h.rig.forward(port, port);
          args.push("--force-adb-forward", "-p", String(port));
          env.ANDROID_ADB_SERVER_PORT = String(await h.rig.adbPort());
        }
        this.ctx.deps.run.start(this.config.device.tools.scrcpy, args, { env, detached: true, timeoutMs: NO_TIMEOUT });
        this.out(`scrcpy started for ${h.resolved.name}; the window is on this machine`);
        return 0;
      }
      async shot(p) {
        const { name, traits } = this.kind(p.device);
        const path = this.file(p.rest[0], name, "png");
        let bytes;
        if (traits.access === "webdriver") bytes = Buffer.from(String(await this.cloud(name, (wd, id) => wd("GET", `/session/${id}/screenshot`))), "base64");
        else if (traits.access === "webkit" && traits.simulator === true) {
          const { resolved, rig } = iosDevice(this.ctx, name, traits.target, true);
          await rig.ensure();
          const sim = await bootedSimulator(rig, deviceKeys(name, resolved.device, simulatorDeviceKeys).udid);
          bytes = await simScreenshot(rig, sim.udid, `/tmp/lw-qa-shot-${this.ctx.deps.clock.now()}.png`);
        } else if (traits.access === "webkit") {
          bytes = await this.onIosPage(name, p, 3e4, (s) => webkitSnapshot(s));
        } else {
          const h = this.android(name);
          await h.rig.ensure();
          bytes = await screencap(h.adb);
        }
        await writeBytes(path, bytes);
        this.out(`${bytes.length} bytes -> ${path}`);
        return 0;
      }
      async record(p) {
        const seconds = Number(p.rest[0]);
        const cap = this.config.evidence.videoCapS;
        if (!(seconds > 0) || seconds > cap) throw new LaunchwrightError("qa.device.usage", `record takes 1 to ${cap} seconds (qa.evidence.videoCapS).`);
        const { name, kind, traits } = this.kind(p.device);
        const path = this.file(p.rest[1], name, "mp4");
        if (traits.access === "webkit" && traits.simulator === true) {
          const { resolved, rig } = iosDevice(this.ctx, name, traits.target, true);
          await rig.ensure();
          const sim = await bootedSimulator(rig, deviceKeys(name, resolved.device, simulatorDeviceKeys).udid);
          const remote = `/tmp/lw-qa-rec-${this.ctx.deps.clock.now()}.mp4`;
          const pid = await startSimVideo(rig, sim.udid, remote);
          await this.ctx.deps.clock.sleep(seconds * 1e3);
          await writeBytes(path, await stopSimVideo(rig, pid, remote));
        } else if (traits.access === "adb") {
          const h = this.android(name);
          await h.rig.ensure();
          const rec = await startScreenrecord(h.adb, this.ctx.deps, seconds + 1, name);
          await this.ctx.deps.clock.sleep(seconds * 1e3);
          await writeBytes(path, await rec.stop());
        } else {
          throw new LaunchwrightError("qa.device.verb", `Device ${name} is ${kind}: it has no recorder here. A BrowserStack session keeps its own video.`);
        }
        this.out(`${seconds} s -> ${path}`);
        return 0;
      }
      async down(p) {
        const names = p.device ? [p.device] : Object.keys(this.config.device.devices).sort();
        for (const name of names) {
          const { traits } = this.kind(name);
          if (traits.access === "webdriver") {
            const held = await readHeld(this.ctx.deps.root);
            if (held && held.device === name) {
              await createBrowserstackClient(this.config.device.browserstack, this.ctx.deps).wd("DELETE", `/session/${held.id}`);
              await writeHeld(this.ctx.deps.root, null);
              this.out(`${name}: BrowserStack session ended after ${Math.round((this.ctx.deps.clock.now() - held.startedAt) / 1e3)} s`);
            }
            continue;
          }
          if (traits.access !== "adb") continue;
          const h = this.android(name);
          await h.rig.ensure();
          const state = (await h.adb.run(["get-state"])).code === 0;
          if (!state) {
            this.out(`${name}: not attached`);
            continue;
          }
          const cleared = await clearIngress(h.adb, h.rig.config.hostProxy?.port ?? DEFAULT_PROXY_PORT);
          if (cleared) this.out(`${name}: ingress proxy setting cleared`);
          if (h.emulator) {
            await stopEmulator(h.rig, h.adb, this.ctx.deps);
            this.out(`${name}: emulator stopped cleanly`);
          }
        }
        if (!p.device) {
          await this.ctx.rigs.downAll();
          this.out("ssh masters closed");
        }
        return 0;
      }
    };
  }
});

// src/device/commands/qa-device.mts
var qa_device_exports = {};
__export(qa_device_exports, {
  default: () => qa_device_default,
  parseDeviceArgs: () => parseDeviceArgs,
  runDeviceCommand: () => runDeviceCommand
});
function parseDeviceArgs(args) {
  const parsed = parseCommandArgs({ values: ["device", "bot", "url", "x", "match", "package", "probe"], switches: ["force"] }, args);
  const flags = { ...parsed.values };
  for (const name of parsed.switches) flags[name] = true;
  return { device: parsed.values.device, flags, rest: parsed.positionals };
}
async function runDeviceCommand(args, opts, deps = systemDeviceDeps(opts.cwd)) {
  const [verb, ...rest] = args;
  if (!verb || verb === "--help" || verb === "-h" || !VERBS.includes(verb)) {
    if (verb && verb !== "--help" && verb !== "-h") opts.err(`lw qa device: unknown verb ${verb}`);
    opts.err(USAGE2);
    return 2;
  }
  let parsed;
  let ctx;
  try {
    parsed = parseDeviceArgs(rest);
    ctx = createDeviceContext(qaConfigOf2(opts.config), deps);
  } catch (err) {
    if (!isCodedError(err)) throw err;
    opts.err(`lw qa device ${verb}: ${err.message}`);
    return 2;
  }
  try {
    return await new DeviceVerbs(ctx, opts).run(verb, parsed);
  } catch (err) {
    if (!isCodedError(err)) throw err;
    opts.err(`lw qa device ${verb}: ${err.message} [${err.code}]`);
    return err.code === "qa.device.usage" ? 2 : 1;
  }
}
var USAGE2, qaDevice, qa_device_default;
var init_qa_device = __esm({
  "src/device/commands/qa-device.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_args();
    init_config3();
    init_device_verbs();
    init_process();
    init_rigs();
    USAGE2 = `usage: lw qa device <verb> [--device <name>] [args]
  list                       rigs and devices from qa.device
  doctor                     ssh, adb, the SDK, ios_webkit_debug_proxy, scrcpy, ffmpeg and pairing, each with its fix
  open --bot <bot> | --url <url>   boot, apply the ingress, open the Mini App or the page, attach
  eval <js | @file>          evaluate in the visible page; --probe video reads every <video>
  logs [seconds]             page errors, console output and failed requests (default 15 s)
  mirror                     scrcpy the Android screen onto this machine
  tap <label> [--x 0..1]     tap a native control by its accessibility label
  point <x> <y>              tap a screen point
  back                       the system back gesture
  key <code>                 an Android keyevent
  shot [file]                a PNG of the screen
  record <seconds> [file]    a video of the screen
  snapshot [label]           copy the AVD folder on the rig (cp -c)
  restore [path] --force     put a snapshot back over the AVD
  install [--force]          the pinned Telegram APK
  down                       stop the emulator, clear the ingress, close the ssh master, end a BrowserStack session
  budget                     BrowserStack minutes used and the per-run budget`;
    qaDevice = {
      name: "device",
      summary: "Rigs and devices: list, doctor, open, eval, logs, mirror, tap, shot, record, snapshot, restore, install, down, budget",
      run: (args, opts) => runDeviceCommand(args, opts)
    };
    qa_device_default = qaDevice;
  }
});

// src/device/index.mts
var device_exports = {};
__export(device_exports, {
  DEFAULT_RUN_TIMEOUT_MS: () => DEFAULT_RUN_TIMEOUT_MS,
  NO_TIMEOUT: () => NO_TIMEOUT,
  androidDeviceKeys: () => androidDeviceKeys,
  browserstackConfig: () => browserstackConfig,
  cloudDeviceKeys: () => cloudDeviceKeys,
  collectDoctor: () => collectDoctor,
  createDeviceContext: () => createDeviceContext,
  deviceConfig: () => deviceConfig,
  deviceKind: () => deviceKind,
  deviceKindNames: () => deviceKindNames,
  deviceTargets: () => deviceTargets,
  deviceToolsConfig: () => deviceToolsConfig,
  emulatorDeviceKeys: () => emulatorDeviceKeys,
  formatDoctor: () => formatDoctor,
  hostProxyConfig: () => hostProxyConfig,
  iosDeviceKeys: () => iosDeviceKeys,
  qaConfigOf: () => qaConfigOf2,
  qaDeviceConfig: () => qaDeviceConfig,
  qaDeviceProvider: () => qaDeviceProvider,
  qaExtension: () => qaExtension,
  registerDeviceKind: () => registerDeviceKind,
  resolveDevice: () => resolveDevice,
  rigConfig: () => rigConfig,
  simulatorDeviceKeys: () => simulatorDeviceKeys,
  systemDeviceDeps: () => systemDeviceDeps,
  telegramDeviceConfig: () => telegramDeviceConfig,
  withDevice: () => withDevice
});
module.exports = __toCommonJS(device_exports);
init_cjs_shims();
init_config3();

// src/device/provider.mts
init_cjs_shims();
init_kernel();
init_src();
init_config3();

// src/device/services/targets.mts
init_cjs_shims();

// src/device/drivers/target/android-adb.mts
init_cjs_shims();
init_kernel();
init_adb();
init_android_session();
init_emulator();

// src/device/drivers/target/contract.mts
init_cjs_shims();
init_src();

// src/device/drivers/target/android-adb.mts
var ANDROID_CAPABILITIES = ["input", "screenshot", "video", "webview", "native", "telegram"];
var AndroidTarget = class {
  constructor(name, ctx, emulatorOnly = false) {
    this.name = name;
    this.ctx = ctx;
    this.emulatorOnly = emulatorOnly;
  }
  name;
  ctx;
  emulatorOnly;
  specVersion = QA_TARGET_SPEC_VERSION;
  capabilities = new Set(ANDROID_CAPABILITIES);
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async ready(leg) {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    try {
      const h = androidHandle(this.ctx, leg.device, this.name, this.emulatorOnly);
      if (this.emulatorOnly && h.emulator) {
        if (await avdExists(h.rig, h.emulator.avd)) return { ready: true };
        return { ready: false, reason: `Rig ${h.rig.name} has no AVD ${h.emulator.avd}. Create it with avdmanager on that rig.` };
      }
      const state = await deviceState(h.rig, h.adb.serial, this.ctx.deps, this.ctx.config.device.tools.adb);
      return state === "device" ? { ready: true } : { ready: false, reason: stateFix(state, h.adb.serial, h.rig.name) };
    } catch (err) {
      if (isCodedError(err)) return { ready: false, reason: err.message };
      throw err;
    }
  }
  open(opts) {
    return AndroidSession.open(this.ctx, androidHandle(this.ctx, opts.leg.device, this.name, this.emulatorOnly), opts, this.name);
  }
};
function createAndroidAdbTarget(ctx) {
  return new AndroidTarget("android-adb", ctx);
}

// src/device/drivers/target/android-emulator.mts
init_cjs_shims();
function createAndroidEmulatorTarget(ctx) {
  return new AndroidTarget("android-emulator", ctx, true);
}

// src/device/drivers/target/browserstack.mts
init_cjs_shims();
init_kernel();
init_src();
init_config3();

// src/device/services/cloud-session.mts
init_cjs_shims();
init_kernel();
init_config3();
init_browserstack();
init_page_script();
init_process();
init_device_kinds();
init_rigs();
init_session_base();
function isMp4(bytes) {
  return bytes.subarray(4, 8).toString("latin1") === "ftyp";
}
var CloudSession = class _CloudSession {
  constructor(ctx, opts, client, kind, keys, device, budget2, target) {
    this.ctx = ctx;
    this.opts = opts;
    this.client = client;
    this.kind = kind;
    this.keys = keys;
    this.device = device;
    this.budget = budget2;
    this.target = target;
  }
  ctx;
  opts;
  client;
  kind;
  keys;
  device;
  budget;
  target;
  closed = false;
  id = "";
  used = false;
  href = "";
  video = null;
  lines = [];
  static async open(ctx, opts, budget2, target) {
    const resolved = resolveDevice(ctx.config, opts.leg.device);
    if (deviceKind(resolved.device.kind).access !== "webdriver") {
      throw new LaunchwrightError("qa.device.kind", `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives a cloud phone over WebDriver.`);
    }
    const keys = deviceKeys(resolved.name, resolved.device, cloudDeviceKeys);
    const client = createBrowserstackClient(ctx.config.device.browserstack, ctx.deps);
    const session = new _CloudSession(ctx, opts, client, resolved.device.kind, keys, resolved.name, budget2, target);
    await session.begin();
    return session;
  }
  async begin() {
    const cfg = this.ctx.config.device.browserstack;
    this.budget.startedAt ??= this.ctx.deps.clock.now();
    checkBudget(this.budget.startedAt, this.ctx.deps.clock.now(), cfg);
    const created = await this.client.wd("POST", "/session", capabilities(this.kind, this.keys, cfg, `${this.opts.leg.name} ${this.device}`), 3e5);
    if (!created.sessionId) throw new LaunchwrightError("qa.device.browserstack.webdriver", "POST /session answered no sessionId.");
    this.id = created.sessionId;
    this.used = false;
    await writeHeld(this.ctx.deps.root, { id: this.id, device: this.device, startedAt: this.ctx.deps.clock.now() });
    await this.client.wd("POST", `/session/${this.id}/timeouts`, { script: 3e4, pageLoad: 6e4 });
    if (this.href) await this.client.wd("POST", `/session/${this.id}/url`, { url: this.href });
  }
  /** Ends the live session. Its console lines are read first: they go with the session. */
  async end() {
    const id = this.id;
    try {
      await this.drainLogs();
    } finally {
      this.id = "";
      await this.client.wd("DELETE", `/session/${id}`);
      await writeHeld(this.ctx.deps.root, null);
    }
    return id;
  }
  /** One WebDriver call on the live session, after the budget check. A spent budget ends the session. */
  async wd(method, path, body) {
    if (this.closed) throw closedError(this.target, path);
    try {
      checkBudget(this.budget.startedAt ?? this.ctx.deps.clock.now(), this.ctx.deps.clock.now(), this.ctx.config.device.browserstack);
    } catch (err) {
      await this.close();
      throw err;
    }
    this.used = true;
    return this.client.wd(method, `/session/${this.id}${path}`, body);
  }
  async evaluate(expression) {
    const answer = await this.wd("POST", "/execute/async", { script: asyncScript(expression), args: [] });
    if (!answer?.ok) throw new LaunchwrightError("qa.device.eval", `The page threw on BrowserStack: ${String(answer?.error ?? "no answer").slice(0, 500)}`);
    return answer.value;
  }
  async navigate(route) {
    const { url } = routeUrl2(this.opts.baseUrl, route);
    await this.wd("POST", "/url", { url });
    this.href = String(await this.wd("GET", "/url"));
  }
  async act(step) {
    if (this.closed) throw closedError(this.target, "act");
    if (step.kind === "wait") return waitAct(this.ctx.deps.clock, step);
    if (step.kind === "back") {
      await this.wd("POST", "/back", {});
    } else {
      await pageAct(step, (e) => this.evaluate(e), this.target);
    }
    this.href = String(await this.wd("GET", "/url"));
  }
  async settle(rule) {
    await pollSettle(this.ctx.deps.clock, rule, (e) => this.evaluate(e), this.target);
  }
  async currentRoute() {
    return relativeRoute2(this.opts.baseUrl, String(await this.evaluate(ROUTE_EXPRESSION)));
  }
  async screenshot(path) {
    const b64 = String(await this.wd("GET", "/screenshot"));
    return writePng(path, Buffer.from(b64, "base64"), this.target);
  }
  async startVideo(path) {
    if (this.closed) throw closedError(this.target, "startVideo");
    if (this.video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session already records ${this.video.path}.`);
    if (this.used) {
      await this.end();
      await this.begin();
    }
    this.video = { path, startedAt: this.ctx.deps.clock.now() };
  }
  async stopVideo() {
    if (this.closed) throw closedError(this.target, "stopVideo");
    const video = this.video;
    if (!video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session records no video; call startVideo first.`);
    this.video = null;
    const durationMs = this.ctx.deps.clock.now() - video.startedAt;
    const id = await this.end();
    await writeBytes(video.path, await this.film(id));
    await this.begin();
    return { path: video.path, durationMs };
  }
  /**
   * The film of an ended session. BrowserStack writes `video_url` some seconds after the end, and the
   * URL can answer an XML `NoSuchKey` error before the file is stored, so the poll waits for MP4 bytes.
   */
  async film(id) {
    const opts = { timeoutMs: 12e4, everyMs: 3e3, code: "qa.device.browserstack.video", what: `The video of BrowserStack session ${id}` };
    const url = await poll(
      this.ctx.deps.clock,
      async () => {
        const row = await this.client.api(`/sessions/${id}.json`);
        return row.automation_session?.video_url || null;
      },
      opts
    );
    return poll(
      this.ctx.deps.clock,
      async () => {
        const res = await this.ctx.deps.fetch(url, { signal: AbortSignal.timeout(12e4) });
        const bytes = Buffer.from(await res.arrayBuffer());
        return res.ok && isMp4(bytes) ? bytes : null;
      },
      { ...opts, what: `${opts.what} as an MP4 file` }
    );
  }
  async trace() {
    return null;
  }
  async dump() {
    return null;
  }
  /**
   * Chrome keeps the page console for `se/log` (type `browser`), which empties it on each read, so
   * the lines collect here. Safari over WebDriver exposes no console at all: the log is refused
   * rather than given empty, because an empty log reads as a page without errors.
   */
  async logs() {
    if (this.closed) throw closedError(this.target, "logs");
    if (deviceKind(this.kind).console !== true) throw capabilityError2(this.target, "webview", `read the page console of ${this.kind} (its WebDriver session has none)`);
    await this.drainLogs();
    return [...this.lines];
  }
  async drainLogs() {
    if (deviceKind(this.kind).console !== true || !this.id) return;
    const entries = await this.client.wd("POST", `/session/${this.id}/se/log`, { type: "browser" });
    for (const e of entries) {
      const kind = consoleLogKind({ source: e.source ?? "", level: e.level, text: e.message });
      if (kind) this.lines.push({ at: new Date(e.timestamp ?? this.ctx.deps.clock.now()).toISOString(), kind, text: e.message.slice(0, 500) });
    }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.video = null;
    if (this.id) await this.end();
  }
};

// src/device/drivers/target/browserstack.mts
init_device_kinds();
init_browserstack();
init_rigs();
var BrowserstackTarget = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  name = "browserstack";
  specVersion = QA_TARGET_SPEC_VERSION;
  capabilities = /* @__PURE__ */ new Set(["input", "screenshot", "video"]);
  budget = { startedAt: null };
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async ready(leg) {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    const cfg = this.ctx.config.device.browserstack;
    try {
      const resolved = resolveDevice(this.ctx.config, leg.device);
      if (deviceKind(resolved.device.kind).access !== "webdriver") return { ready: false, reason: `Device ${resolved.name} is ${resolved.device.kind}, not a cloud device.` };
      deviceKeys(resolved.name, resolved.device, cloudDeviceKeys);
      if (!cfg.username || !cfg.accessKey) {
        return { ready: false, reason: "qa.device.browserstack.username and accessKey are not set. Map BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY from the secret store." };
      }
      if (this.budget.startedAt !== null) checkBudget(this.budget.startedAt, this.ctx.deps.clock.now(), cfg);
      return { ready: true };
    } catch (err) {
      if (isCodedError(err)) return { ready: false, reason: err.message };
      throw err;
    }
  }
  open(opts) {
    return CloudSession.open(this.ctx, opts, this.budget, this.name);
  }
  /** The two secret store keys that the config maps into `qa.device.browserstack` (spec 2.6). */
  needs(leg) {
    const cfg = this.ctx.config.device.browserstack;
    return { credentials: [credentialNeed("BROWSERSTACK_USERNAME", cfg.username, [leg.name]), credentialNeed("BROWSERSTACK_ACCESS_KEY", cfg.accessKey, [leg.name])] };
  }
};
function createBrowserstackTarget(ctx) {
  return new BrowserstackTarget(ctx);
}

// src/device/drivers/target/ios-simulator.mts
init_cjs_shims();
init_kernel();
init_config3();
init_ios_session();
var IosSimulatorTarget = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  name = "ios-simulator";
  specVersion = QA_TARGET_SPEC_VERSION;
  capabilities = /* @__PURE__ */ new Set(["screenshot", "video", "webview"]);
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async ready(leg) {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    try {
      const { resolved } = iosDevice(this.ctx, leg.device, this.name, true);
      const reason = simulatorReadiness(resolved.name, deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys));
      return reason ? { ready: false, reason } : { ready: true };
    } catch (err) {
      if (isCodedError(err)) return { ready: false, reason: err.message };
      throw err;
    }
  }
  open(opts) {
    return SimulatorSession.open(this.ctx, opts, this.name);
  }
};
function createIosSimulatorTarget(ctx) {
  return new IosSimulatorTarget(ctx);
}

// src/device/drivers/target/ios-webkit.mts
init_cjs_shims();
init_kernel();
init_ios_session();
var IosWebkitTarget = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  name = "ios-webkit";
  specVersion = QA_TARGET_SPEC_VERSION;
  capabilities = /* @__PURE__ */ new Set(["screenshot", "webview", "telegram"]);
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async ready(leg) {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    try {
      const { resolved } = iosDevice(this.ctx, leg.device, this.name, false);
      const access = await deviceAccess(this.ctx, resolved.name);
      await access.close();
      return { ready: true };
    } catch (err) {
      if (isCodedError(err)) return { ready: false, reason: err.message };
      throw err;
    }
  }
  open(opts) {
    return PhoneSession.open(this.ctx, opts, this.name);
  }
};
function createIosWebkitTarget(ctx) {
  return new IosWebkitTarget(ctx);
}

// src/device/services/targets.mts
init_process();
init_rigs();
function deviceTargets(config, deps = systemDeviceDeps(process.cwd())) {
  const ctx = createDeviceContext(config, deps);
  return {
    "android-adb": createAndroidAdbTarget(ctx),
    "android-emulator": createAndroidEmulatorTarget(ctx),
    "ios-webkit": createIosWebkitTarget(ctx),
    "ios-simulator": createIosSimulatorTarget(ctx),
    browserstack: createBrowserstackTarget(ctx)
  };
}

// src/device/provider.mts
var qaDeviceProvider = provider({
  name: "qa-device",
  requires: ["kernel", "qa"],
  register: () => void 0,
  boot(app) {
    const config = withDevice(app.get(CONFIG).section("qa"));
    app.get(QA_TARGETS).add(deviceTargets(config));
  }
});

// src/device/index.mts
init_device_kinds();
init_doctor();

// src/device/services/extension.mts
init_cjs_shims();
init_config3();
init_process();
var qaExtension = {
  name: "qa-device",
  subcommands: { device: async () => (await Promise.resolve().then(() => (init_qa_device(), qa_device_exports))).default },
  targets: (config, root) => deviceTargets(withDevice(config), systemDeviceDeps(root))
};

// src/device/index.mts
init_process();
init_rigs();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_RUN_TIMEOUT_MS,
  NO_TIMEOUT,
  androidDeviceKeys,
  browserstackConfig,
  cloudDeviceKeys,
  collectDoctor,
  createDeviceContext,
  deviceConfig,
  deviceKind,
  deviceKindNames,
  deviceTargets,
  deviceToolsConfig,
  emulatorDeviceKeys,
  formatDoctor,
  hostProxyConfig,
  iosDeviceKeys,
  qaConfigOf,
  qaDeviceConfig,
  qaDeviceProvider,
  qaExtension,
  registerDeviceKind,
  resolveDevice,
  rigConfig,
  simulatorDeviceKeys,
  systemDeviceDeps,
  telegramDeviceConfig,
  withDevice
});
//# sourceMappingURL=device.cjs.map