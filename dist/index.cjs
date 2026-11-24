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
var getImportMetaUrl, importMetaUrl;
var init_cjs_shims = __esm({
  "node_modules/.pnpm/tsup@8.5.1_postcss@8.5.33_tsx@4.23.15_typescript@6.0.3/node_modules/tsup/assets/cjs_shims.js"() {
    "use strict";
    getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
    importMetaUrl = /* @__PURE__ */ getImportMetaUrl();
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
function appPath(sections, runtime, fallback) {
  return sectionApps(sections).find((a) => a.runtime === runtime)?.path ?? fallback;
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
        return new Promise((resolve17, reject) => {
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
            resolve17();
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
function hasDispose(v) {
  return typeof v === "object" && v !== null && typeof v.dispose === "function";
}
function createContainer() {
  return new KernelContainer();
}
var resolving, KernelContainer;
var init_container = __esm({
  "src/kernel/services/container.mts"() {
    "use strict";
    init_cjs_shims();
    init_errors();
    resolving = [];
    KernelContainer = class _KernelContainer {
      constructor(parent) {
        this.parent = parent;
        this.root = parent ? parent.root : this;
      }
      parent;
      /** The name that bindings() reports as `boundBy`. createApp sets it to the provider that registers. */
      binder = "app";
      own = /* @__PURE__ */ new Map();
      cache = /* @__PURE__ */ new Map();
      created = [];
      root;
      singleton(t, f) {
        this.bind(t, "singleton", { factory: f });
      }
      scoped(t, f) {
        this.bind(t, "scoped", { factory: f });
      }
      transient(t, f) {
        this.bind(t, "transient", { factory: f });
      }
      instance(t, value) {
        this.bind(t, "instance", { value });
      }
      has(t) {
        return this.lookup(t.key) !== void 0;
      }
      get(t) {
        const b = this.lookup(t.key);
        if (!b) {
          throw new LaunchwrightError("kernel.unbound", `No binding for token "${t.name}". Bind it in a provider's register().`, {
            context: { token: t.name }
          });
        }
        switch (b.lifetime) {
          case "instance":
            return b.value;
          case "singleton":
            return b.owner.build(b);
          case "scoped":
            return this.build(b);
          case "transient":
            return this.run(b);
        }
      }
      getOr(t, fallback) {
        return this.has(t) ? this.get(t) : fallback;
      }
      createScope() {
        return new _KernelContainer(this);
      }
      bindings() {
        const chain = [this];
        for (let c = this.parent; c; c = c.parent) chain.unshift(c);
        const merged = /* @__PURE__ */ new Map();
        for (const c of chain) {
          for (const [key, b] of c.own) {
            merged.delete(key);
            merged.set(key, b);
          }
        }
        return [...merged.values()].map((b) => ({ token: b.token.name, lifetime: b.lifetime, boundBy: b.boundBy }));
      }
      async dispose() {
        const items = this.created.splice(0).reverse();
        this.cache.clear();
        const errors = [];
        for (const item of items) {
          if (!hasDispose(item)) continue;
          try {
            await item.dispose();
          } catch (err) {
            errors.push(err);
          }
        }
        if (errors.length > 0) {
          throw new LaunchwrightError("kernel.dispose", `${errors.length} instance(s) failed to dispose: ${errors.map(messageOf).join("; ")}`, {
            cause: errors.length === 1 ? errors[0] : new AggregateError(errors)
          });
        }
      }
      bind(t, lifetime, rest) {
        this.own.delete(t.key);
        this.own.set(t.key, { token: t, lifetime, ...rest, boundBy: this.root.binder, owner: this });
      }
      lookup(key) {
        return this.own.get(key) ?? this.parent?.lookup(key);
      }
      /** Builds a binding once per container and keeps the instance for dispose(). */
      build(b) {
        if (this.cache.has(b)) return this.cache.get(b);
        const value = this.run(b);
        this.cache.set(b, value);
        this.created.push(value);
        return value;
      }
      run(b) {
        if (resolving.includes(b)) {
          const chain = [...resolving.slice(resolving.indexOf(b)), b].map((x) => x.token.name).join(" -> ");
          throw new LaunchwrightError("kernel.cycle", `Circular dependency: ${chain}`, { context: { chain } });
        }
        resolving.push(b);
        try {
          return b.factory(this);
        } catch (err) {
          if (err instanceof LaunchwrightError) throw err;
          throw new LaunchwrightError("kernel.resolve", `Cannot build "${b.token.name}": ${messageOf(err)}`, {
            cause: err,
            context: { token: b.token.name }
          });
        } finally {
          resolving.pop();
        }
      }
    };
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
function hmac(key, data) {
  const h = (0, import_node_crypto.createHmac)("sha256", key);
  for (const part of typeof data === "string" || data instanceof Uint8Array ? [data] : data) h.update(part);
  return h.digest();
}
function hmacHex(key, data) {
  return hmac(key, data).toString("hex");
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
function escapeHtml(text2) {
  return text2.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}
var ENTITIES;
var init_html = __esm({
  "src/kernel/services/html.mts"() {
    "use strict";
    init_cjs_shims();
    ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
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
async function optionalPeer(name, load2) {
  try {
    return await (load2 ? load2() : import(
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
  const size2 = specifier.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, size2).join("/");
  const subpath = [".", ...parts.slice(size2)].join("/");
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
var import_node_fs2, import_node_path2, IMPORT_CONDITIONS;
var init_resolve_import = __esm({
  "src/kernel/services/resolve-import.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs2 = require("fs");
    import_node_path2 = require("path");
    init_errors();
    IMPORT_CONDITIONS = /* @__PURE__ */ new Set(["node", "import", "module-sync", "default"]);
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

// src/services/score.mts
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
function renderScoreGauge(score, opts = {}) {
  const size2 = opts.size ?? 160;
  const value = clamp(Math.round(score), 0, 100);
  const ring = attr(opts.color ?? DEFAULT_GAUGE_COLOR);
  const track = attr(opts.track ?? NEUTRAL_TRACK);
  const stroke = Math.max(2, Math.round(size2 * 0.09));
  const radius = (size2 - stroke) / 2;
  const center = size2 / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value / 100 * circumference;
  const numberSize = Math.round(size2 * 0.3);
  const font = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const numberY = opts.label ? center - numberSize * 0.12 : center;
  const label = opts.label ? `<text x="${center}" y="${center + numberSize * 0.72}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${Math.round(size2 * 0.1)}" fill="${LABEL_INK}">${content(opts.label)}</text>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size2} ${size2}" width="${size2}" height="${size2}" role="img" aria-label="QA score ${value} of 100">`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${track}" stroke-width="${stroke}"/>`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${ring}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${filled.toFixed(3)} ${(circumference - filled).toFixed(3)}" transform="rotate(-90 ${center} ${center})"/>`,
    `<text x="${center}" y="${numberY}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${numberSize}" font-weight="700" fill="${ring}">${value}</text>`,
    label,
    "</svg>"
  ].join("");
}
function scoreRows(result, weights = {}, notes = {}) {
  const w = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
  return SCORE_DIMENSIONS.map(({ dimension, label }) => {
    const score = result.dimensions[dimension] ?? null;
    return { dimension, label, score, weight: w[dimension], counted: score !== null, note: notes[dimension] ?? (score === null ? "untested" : "") };
  });
}
function renderScoreBreakdown(rows) {
  const body = rows.map((r) => {
    const state = r.counted ? "counted" : "untested";
    return `<tr data-dimension="${r.dimension}" data-counted="${r.counted}"><td>${content(r.label)}</td><td>${r.score ?? "-"}</td><td>${r.weight}</td><td>${state}</td><td>${content(r.note)}</td></tr>`;
  }).join("");
  return `<table class="qa-score-table"><thead><tr><th>Dimension</th><th>Score</th><th>Weight</th><th>Counted</th><th>From</th></tr></thead><tbody>${body}</tbody></table>`;
}
var DEFAULT_SCORE_WEIGHTS, SEVERITY_DEDUCTION, clamp, percentScore, DEFAULT_GAUGE_COLOR, NEUTRAL_TRACK, LABEL_INK, attr, content, SCORE_DIMENSIONS;
var init_score = __esm({
  "src/services/score.mts"() {
    "use strict";
    init_cjs_shims();
    DEFAULT_SCORE_WEIGHTS = {
      findings: 0.35,
      console: 0.1,
      coverage: 0.15,
      evidence: 0.1,
      accessibility: 0.15,
      performance: 0.15
    };
    SEVERITY_DEDUCTION = { critical: 25, high: 15, medium: 8, low: 3 };
    clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
    percentScore = (fraction) => Math.round(clamp(fraction, 0, 1) * 100);
    DEFAULT_GAUGE_COLOR = "#7c3aed";
    NEUTRAL_TRACK = "#e2e8f0";
    LABEL_INK = "#64748b";
    attr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    content = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    SCORE_DIMENSIONS = [
      { dimension: "findings", label: "Findings" },
      { dimension: "console", label: "Console and page errors" },
      { dimension: "coverage", label: "Coverage" },
      { dimension: "evidence", label: "Evidence" },
      { dimension: "accessibility", label: "Accessibility" },
      { dimension: "performance", label: "Performance" }
    ];
  }
});

// src/services/score-config.mts
function isCssColor(value) {
  const v = value.trim();
  return HEX.test(v) || FUNCTIONAL.test(v) || NAMED_COLORS.has(v.toLowerCase());
}
var NAMED_COLORS, HEX, FUNCTIONAL, weight, scoreConfig;
var init_score_config = __esm({
  "src/services/score-config.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_score();
    NAMED_COLORS = new Set(
      "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor".split(" ")
    );
    HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    FUNCTIONAL = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-+0-9.%a-z\s,/]+\)$/i;
    weight = import_zod6.z.number().nonnegative();
    scoreConfig = import_zod6.z.object({
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
  }
});

// src/config.mts
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
var legConfig, qaConfig;
var init_config2 = __esm({
  "src/config.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_score_config();
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
      /**
       * Path wrappers of the route tables, by function name, to the prefix each one adds, for example
       * `{ localized = "/:lang?" }`. The delivery scan reads a wrapper body it can follow by itself;
       * this key is for a wrapper it cannot, such as one imported from a package.
       */
      routeWrappers: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.string().startsWith("/")).default({}),
      /**
       * The tracked files of a state run (spec 2.7). `delivery`: union name to its delivery descriptor.
       * `mounts`: union name to its mount hints. A path is project-relative. When a key is not set,
       * the run reads `.lw/qa/delivery.json` and `.lw/qa/mounts.json` if they exist.
       */
      states: import_zod6.z.object({ delivery: import_zod6.z.string().min(1).optional(), mounts: import_zod6.z.string().min(1).optional() }).prefault({}),
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
function gitOut(repo, args) {
  return git(repo, args) ?? "";
}
function lines(text2) {
  return (text2 ?? "").split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
}
function parseLog(out) {
  const commits = [];
  for (const chunk2 of (out ?? "").split(RECORD).slice(1)) {
    const [header = "", ...rest] = chunk2.split("\n");
    const [sha = "", short = "", date = "", author = "", subject = ""] = header.split(FIELD);
    commits.push({ sha, short, date: date.slice(0, 10), author, subject, paths: rest.map((l) => l.trim()).filter(Boolean) });
  }
  return commits;
}
function repoRoot(cwd) {
  const out = git(cwd, ["rev-parse", "--show-toplevel"], { allowFail: true });
  if (!out?.trim()) throw new LaunchwrightError("qa.git.repo", `${cwd} is not inside a git repository.`, { context: { cwd } });
  return out.trim();
}
function gitInstant(date) {
  const [day, time = ""] = date.split(/[ T]/);
  const parts = time ? time.split(":") : [];
  while (parts.length < 3) parts.push("00");
  return `${day}T${parts.join(":")}`;
}
function parseRangeLine(text2) {
  for (const line of text2.split("\n")) {
    const match = /^Range:\s*(.+)$/.exec(line.trim());
    const after = match?.[1]?.split("->")[1];
    if (!after) continue;
    const sha = /\b([0-9a-f]{7,40})\b/i.exec(after);
    if (sha?.[1]) return sha[1];
  }
  return null;
}
function newestReport(dir) {
  if (!(0, import_node_fs4.existsSync)(dir)) return null;
  const found = (0, import_node_fs4.readdirSync)(dir).filter((name) => name.endsWith(".md")).map((name) => ({ name, path: (0, import_node_path4.join)(dir, name), mtime: (0, import_node_fs4.statSync)((0, import_node_path4.join)(dir, name)).mtimeMs })).sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
  return found[0] ?? null;
}
function refuse(message, context = {}) {
  return new LaunchwrightError("qa.changes.range", message, { context });
}
function resolveRange(repo, opts) {
  const head = opts.head ?? "HEAD";
  const since = opts.since;
  if (since === void 0) {
    const report3 = newestReport((0, import_node_path4.join)(repo, opts.reportDir));
    if (!report3) throw refuse(`No report under ${opts.reportDir}/ to continue from. ${PASS_SINCE}`);
    const sha = parseRangeLine((0, import_node_fs4.readFileSync)(report3.path, "utf8"));
    if (!sha) throw refuse(`${opts.reportDir}/${report3.name} has no "Range:" line with a sha after "->". ${PASS_SINCE}`, { report: report3.name });
    const resolved = git(repo, ["rev-parse", "--verify", `${sha}^{commit}`], { allowFail: true });
    if (!resolved) throw refuse(`${opts.reportDir}/${report3.name} names ${sha}, which is not a commit here. ${PASS_SINCE}`, { sha });
    return { base: resolved.trim(), basis: `--last (after ${sha}, the end of ${opts.reportDir}/${report3.name})` };
  }
  if (SHA.test(since)) {
    const resolved = git(repo, ["rev-parse", "--verify", `${since}^{commit}`], { allowFail: true });
    if (!resolved) throw refuse(`--since ${since} is not a commit in this repository.`, { since });
    const start = resolved.trim();
    const parent = git(repo, ["rev-parse", "--verify", `${start}^`], { allowFail: true });
    return { base: parent ? parent.trim() : EMPTY_TREE, basis: `--since ${since} (that commit, included)` };
  }
  if (!DATE.test(since)) throw refuse(`--since ${since} is neither a date (2026-08-21, "2026-08-21 14:00") nor a sha.`, { since });
  const before = gitOut(repo, ["rev-list", "-1", `--before=${gitInstant(since)}`, head]).trim();
  const base = before || EMPTY_TREE;
  const count = Number(gitOut(repo, ["rev-list", "--count", `${base}..${head}`]).trim());
  if (count === 0) throw refuse(`No commit at or after ${since} on ${head}.`, { since });
  return { base, basis: `--since ${since} (the first commit at or after it)` };
}
function workspaceGlobs(yaml) {
  const globs = [];
  let inPackages = false;
  for (const raw of yaml.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "");
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = /^\s+-\s*(['"]?)(.+?)\1\s*$/.exec(line);
    if (item?.[2]) globs.push(item[2]);
    else if (/^\S/.test(line)) inPackages = false;
  }
  return globs;
}
function globRegex(glob) {
  const body = glob.replace(/\/+$/, "").split("/").map((seg) => seg === "**" ? ".*" : seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("/");
  return new RegExp(`^${body}$`);
}
function workspaceAreas(globs, trackedFiles) {
  const include = globs.filter((g) => !g.startsWith("!")).map(globRegex);
  const exclude = globs.filter((g) => g.startsWith("!")).map((g) => globRegex(g.slice(1)));
  const tracked = new Set(trackedFiles);
  const areas = /* @__PURE__ */ new Set();
  for (const file of trackedFiles) {
    if (!file.endsWith("/package.json")) continue;
    const dir = file.slice(0, -"/package.json".length);
    if (!include.some((re) => re.test(dir)) || exclude.some((re) => re.test(dir))) continue;
    const parent = dir.split("/").slice(0, -1).join("/");
    const moduleDir = dir.endsWith("/ts") && tracked.has(`${parent}/module.toml`) ? parent : null;
    areas.add(moduleDir ?? dir);
  }
  return [...areas].sort((a, b) => b.length - a.length || a.localeCompare(b));
}
function areaOf(path, areas) {
  const hit = areas.find((area) => path === area || path.startsWith(`${area}/`));
  if (hit) return hit;
  const slash = path.indexOf("/");
  return slash === -1 ? "root" : path.slice(0, slash);
}
function areasFor(paths, areas) {
  return [...new Set(paths.map((p) => areaOf(p, areas)))].sort();
}
function digest(repo, opts) {
  const head = opts.head ?? "HEAD";
  const { base, basis } = resolveRange(repo, opts);
  const globs = workspaceGlobs(git(repo, ["show", `${head}:pnpm-workspace.yaml`], { allowFail: true }) ?? "");
  const areaDirs = workspaceAreas(globs, lines(gitOut(repo, ["ls-tree", "-r", "--name-only", head])));
  const commits = parseLog(gitOut(repo, ["log", "--reverse", "--name-only", `--format=${LOG_FORMAT}`, `${base}..${head}`])).map(
    ({ paths, ...c }) => ({ ...c, areas: areasFor(paths, areaDirs) })
  );
  const added = lines(gitOut(repo, ["diff", "--name-only", "--diff-filter=A", base, head]));
  const areas = {};
  for (const commit of commits) for (const area of commit.areas) areas[area] = (areas[area] ?? 0) + 1;
  const first = commits[0];
  const last = commits.at(-1);
  const clock = opts.clock ?? systemClock;
  return {
    range: {
      base,
      basis,
      head: gitOut(repo, ["rev-parse", "--short", head]).trim(),
      start: first ? { sha: first.sha, short: first.short, date: first.date } : null,
      end: last ? { sha: last.sha, short: last.short, date: last.date } : null,
      commits: commits.length,
      line: first && last ? `${first.date} ${first.short} -> ${last.date} ${last.short}, ${commits.length} commits` : `no commits on ${clock.date().toISOString().slice(0, 10)}`
    },
    areas,
    commits,
    signals: {
      added: Object.fromEntries(Object.entries(ADDED_KINDS).map(([kind, re]) => [kind, added.filter((p) => re.test(p)).sort()])),
      documents: added.filter((p) => DOC_DIRS.some((d) => p.startsWith(d)) && p.endsWith(".md")).sort()
    }
  };
}
function capped(values, limit = 20) {
  return values.length <= limit ? values.join(", ") : `${values.slice(0, limit).join(", ")}, +${values.length - limit} more`;
}
function renderChanges(result) {
  const out = [`range   ${result.range.line}`, `basis   ${result.range.basis}`, `base    ${result.range.base.slice(0, 7)} (the range starts after it)`];
  if (result.commits.length === 0) return [...out, "", "No commits in that range."].join("\n");
  out.push("", "commits by area (a commit that touches two areas is under both)");
  for (const [area, count] of Object.entries(result.areas).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    out.push(`  ${area} (${count})`);
    const inArea = result.commits.filter((c) => c.areas.includes(area));
    for (const commit of inArea.slice(0, AREA_COMMITS)) out.push(`    ${commit.short}  ${commit.date}  ${commit.subject}`);
    if (inArea.length > AREA_COMMITS) out.push(`    +${inArea.length - AREA_COMMITS} more (--json lists them all)`);
  }
  out.push("", "signals");
  for (const [kind, files] of Object.entries(result.signals.added)) out.push(`  new ${kind.padEnd(10)} ${files.length === 0 ? "none" : capped(files)}`);
  out.push(`  documents      ${result.signals.documents.length === 0 ? "none" : capped(result.signals.documents, 10)}`);
  return out.join("\n");
}
var import_node_child_process, import_node_fs4, import_node_path4, EMPTY_TREE, RECORD, FIELD, LOG_FORMAT, DATE, SHA, DOC_DIRS, ADDED_KINDS, GIT_TIMEOUT_MS, PASS_SINCE, AREA_COMMITS;
var init_changes = __esm({
  "src/services/changes.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process = require("child_process");
    import_node_fs4 = require("fs");
    import_node_path4 = require("path");
    init_kernel();
    EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
    RECORD = "";
    FIELD = "";
    LOG_FORMAT = `${RECORD}%H${FIELD}%h${FIELD}%cI${FIELD}%an${FIELD}%s`;
    DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
    SHA = /^[0-9a-f]{7,40}$/i;
    DOC_DIRS = ["docs/specs/", "docs/plans/", "docs/superpowers/plans/"];
    ADDED_KINDS = {
      pages: /\.page\.tsx$/,
      features: /\.feature\.mts$/,
      worlds: /\.world\.mts$/,
      jobs: /\.job\.mts$/,
      commands: /\.command\.mts$/,
      endpoints: /(^|\/)http\/[^/]+\.mts$/
    };
    GIT_TIMEOUT_MS = 12e4;
    PASS_SINCE = "Pass --since <date> (2026-08-21), or --since <sha>.";
    AREA_COMMITS = 20;
  }
});

// src/commands/qa-changes.mts
var qa_changes_exports = {};
__export(qa_changes_exports, {
  default: () => qa_changes_default
});
var USAGE, changes, qa_changes_default;
var init_qa_changes = __esm({
  "src/commands/qa-changes.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_args();
    init_config2();
    init_changes();
    USAGE = [
      "usage: lw qa changes [--since <date|sha> | --last] [--json]",
      '  --since 2026-08-21 | "2026-08-21 14:00" | <sha>   the first commit of the range',
      "  --last    continue after the Range: line of the newest report (the default)",
      "  --json    the whole digest as JSON"
    ];
    changes = {
      name: "changes",
      summary: "Group the commits of a range by area and list the signals of user-visible change",
      async run(args, opts) {
        let parsed;
        try {
          parsed = parseCommandArgs({ values: ["since"], switches: ["json", "last"] }, args);
        } catch (cause) {
          if (!(cause instanceof UsageError)) throw cause;
          parsed = void 0;
        }
        if (!parsed || parsed.positionals.length > 0) {
          for (const line of USAGE) opts.err(line);
          return 2;
        }
        const since = parsed.switches.has("last") ? void 0 : parsed.values.since;
        const json = parsed.switches.has("json");
        const config = qaConfigOf(opts.config);
        try {
          const result = digest(repoRoot(opts.cwd), { ...since !== void 0 ? { since } : {}, reportDir: config.reportDir, clock: systemClock });
          opts.out(json ? JSON.stringify(result, null, 2) : renderChanges(result));
          return 0;
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa changes: ${cause.message}`);
          return 1;
        }
      }
    };
    qa_changes_default = changes;
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
function readTextOrNullSync(path) {
  try {
    return (0, import_node_fs5.readFileSync)(path, "utf8");
  } catch (cause) {
    if (isMissing(cause)) return null;
    throw readError(path, cause);
  }
}
function sha256(data) {
  return (0, import_node_crypto2.createHash)("sha256").update(data).digest("hex");
}
async function hashFile(path) {
  const hash = (0, import_node_crypto2.createHash)("sha256");
  try {
    for await (const chunk2 of (0, import_node_fs5.createReadStream)(path)) hash.update(chunk2);
  } catch (cause) {
    throw readError(path, cause);
  }
  return hash.digest("hex");
}
var import_node_crypto2, import_node_fs5, import_promises2, import_smol_toml2, MISSING;
var init_fs = __esm({
  "src/kernel/services/fs.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto2 = require("crypto");
    import_node_fs5 = require("fs");
    import_promises2 = require("fs/promises");
    import_smol_toml2 = require("smol-toml");
    init_errors();
    MISSING = /* @__PURE__ */ new Set(["ENOENT", "ENOTDIR"]);
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
function credentialItem(need) {
  if (Object.hasOwn(need, "value")) {
    throw new LaunchwrightError("qa.consent.secret", `The credential ${need.key} carries a value. Pass set/empty and a short hash only, never the secret.`, { context: { key: need.key } });
  }
  if (need.fingerprint !== void 0 && !FINGERPRINT.test(need.fingerprint)) {
    throw new LaunchwrightError("qa.consent.fingerprint", `The fingerprint of ${need.key} is not a short sha256 of 1 to 16 hex characters. It must never be the value.`, { context: { key: need.key } });
  }
  const item = { id: `credentials:${need.key}`, group: "credentials", title: `${need.key} (${need.present ? "set" : "empty"})`, outward: false, key: need.key, present: need.present };
  if (need.present && need.fingerprint !== void 0) item.fingerprint = need.fingerprint;
  if (need.legs !== void 0 && need.legs.length > 0) item.legs = [...new Set(need.legs)].sort();
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
    const legs = [.../* @__PURE__ */ new Set([...items.get(item.id)?.legs ?? [], ...item.legs ?? []])].sort();
    items.set(item.id, legs.length > 0 ? { ...item, legs } : item);
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
function grantedIds(prior) {
  const records = prior === null ? [] : Array.isArray(prior) ? prior : [prior];
  return new Set(records.flatMap((record3) => record3.grants.map((g) => g.id)));
}
function diff(prior, manifest) {
  const granted = grantedIds(prior);
  return manifest.items.filter((item) => !granted.has(item.id));
}
function recordGrants(manifest, prior, choice) {
  const listed = new Set(manifest.items.map((item) => item.id));
  const unlisted = choice === "all" ? [] : choice.filter((id) => !listed.has(id));
  if (unlisted.length > 0) {
    throw new LaunchwrightError("qa.consent.unlisted", `The manifest "${manifest.title}" does not list ${unlisted.join(", ")}. Grant only an item it lists: ${[...listed].join(", ") || "none"}.`, {
      context: { unlisted }
    });
  }
  const before = new Map(prior.flatMap((record3) => record3.grants.map((g) => [g.id, g.via])));
  const grants = [];
  for (const item of manifest.items) {
    const via = before.get(item.id) ?? (choice === "all" ? "all" : choice.includes(item.id) ? "item" : void 0);
    if (via !== void 0) grants.push({ id: item.id, via });
  }
  return { hash: manifestHash(manifest), title: manifest.title, items: manifest.items, grants };
}
function missingCredentials(manifest) {
  return manifest.items.filter((item) => item.group === "credentials" && item.present === false);
}
function fileConsentStore(dir) {
  const fileFor2 = (hash) => {
    if (!HEX64.test(hash)) throw new LaunchwrightError("qa.consent.hash", `A consent hash is 64 hex characters, not "${hash}".`, { context: { hash } });
    return (0, import_node_path5.join)(dir, `${hash}.json`);
  };
  return {
    async read(hash) {
      const file = fileFor2(hash);
      const text2 = await readTextOrNull(file);
      if (text2 === null) return null;
      try {
        return JSON.parse(text2);
      } catch (cause) {
        throw new LaunchwrightError("qa.consent.read", `The consent record ${file} is not JSON.`, { cause, context: { hash } });
      }
    },
    async write(hash, record3) {
      const file = fileFor2(hash);
      await (0, import_promises3.mkdir)(dir, { recursive: true });
      await (0, import_promises3.writeFile)(file, `${JSON.stringify(record3, null, 2)}
`);
    },
    async list() {
      const records = [];
      for (const hash of await recordHashes(dir)) {
        const record3 = await this.read(hash);
        if (record3 !== null) records.push(record3);
      }
      return records;
    },
    async remove(hash) {
      const hashes = hash === void 0 ? await recordHashes(dir) : [hash];
      let removed = 0;
      for (const h of hashes) {
        const file = fileFor2(h);
        if (await readTextOrNull(file) === null) continue;
        await (0, import_promises3.rm)(file);
        removed += 1;
      }
      return removed;
    }
  };
}
async function recordHashes(dir) {
  let names;
  try {
    names = await (0, import_promises3.readdir)(dir);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.consent.list", `Cannot list the consent records in ${dir}.`, { cause });
  }
  return names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length)).filter((hash) => HEX64.test(hash)).sort();
}
var import_promises3, import_node_path5, GROUP_ORDER, FINGERPRINT_LENGTH, CONSENT_DIR, DEVICE_RIGS, NAME2, FINGERPRINT, HEX64;
var init_contract = __esm({
  "src/services/contract.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises3 = require("fs/promises");
    import_node_path5 = require("path");
    init_kernel();
    init_fs();
    GROUP_ORDER = { credentials: 0, devices: 1, outward: 2, data: 3 };
    FINGERPRINT_LENGTH = 12;
    CONSENT_DIR = ".lw/qa/consent";
    DEVICE_RIGS = {
      "android-adb": "An Android device over adb",
      "android-emulator": "The Android emulator",
      "ios-webkit": "An iOS device over WebKit",
      "ios-simulator": "The iOS simulator",
      browserstack: "A BrowserStack slot"
    };
    NAME2 = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    FINGERPRINT = /^[0-9a-f]{1,16}$/;
    HEX64 = /^[0-9a-f]{64}$/;
  }
});

// src/services/consent-gate.mts
function itemLine(item) {
  const legs = item.legs ? `  (leg ${item.legs.join(", ")})` : "";
  return `  ${item.group.padEnd(11)} ${item.id}  ${item.title}${item.outward ? "  [outward]" : ""}${legs}`;
}
function consentStoreOf(opts) {
  return opts.store ?? fileConsentStore((0, import_node_path6.join)(opts.cwd, CONSENT_DIR));
}
async function consentGate(manifest, opts) {
  if (manifest.items.length === 0) return true;
  const store = consentStoreOf(opts);
  opts.out(`run contract for "${manifest.title}": ${manifest.items.length} item(s) need consent`);
  for (const item of manifest.items) opts.out(itemLine(item));
  const listed = new Set(manifest.items.map((item) => item.id));
  const unlisted = opts.allow.filter((id) => !listed.has(id));
  if (unlisted.length > 0) {
    opts.err(`run contract: --allow ${unlisted.join(", ")} names no item of this manifest. Grant only an item it lists.`);
    return false;
  }
  const prior = await store.list();
  const missing = missingCredentials(manifest);
  const record3 = recordGrants(manifest, prior, missing.length > 0 ? [] : opts.allowAll ? "all" : opts.allow);
  await store.write(record3.hash, record3);
  if (missing.length > 0) {
    opts.err(`run contract: ${missing.length} credential(s) are empty, so nothing starts:`);
    for (const item of missing) opts.err(`  ${item.key ?? item.id}${item.legs ? `  needed by leg ${item.legs.join(", ")}` : ""}`);
    opts.err(`Set each key from the secret store${missing.some((item) => item.legs) ? ", or drop the leg that needs it with --legs" : ""}.`);
    return false;
  }
  const pending2 = diff(prior, manifest);
  if (pending2.length === 0) {
    opts.out("run contract: every item is granted; asking nothing");
    return true;
  }
  const remaining = diff(record3, manifest);
  const recorded = pending2.length - remaining.length;
  if (opts.allowAll) opts.out(`run contract: allow all recorded ${recorded} grant(s) under ${CONSENT_DIR}`);
  else if (recorded > 0) opts.out(`run contract: recorded ${recorded} grant(s) under ${CONSENT_DIR}`);
  if (remaining.length === 0) return true;
  opts.err(`run contract: ${remaining.length} item(s) need a grant. Re-run with --allow <id> for each, or --allow-all to grant every listed item:`);
  for (const item of remaining) opts.err(`  ${item.outward ? "outward " : ""}${item.id}  ${item.title}`);
  opts.err("Or grant one item with: lw qa consent grant <id>");
  return false;
}
var import_node_path6;
var init_consent_gate = __esm({
  "src/services/consent-gate.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path6 = require("path");
    init_contract();
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

// src/services/types.mts
var ACT_KINDS, ROW_FAILURES, REPORT_STATUSES, INTAKE_DIR;
var init_types = __esm({
  "src/services/types.mts"() {
    "use strict";
    init_cjs_shims();
    ACT_KINDS = ["click", "type", "press", "scroll", "wait", "back"];
    ROW_FAILURES = ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error", "expect", "crashed"];
    REPORT_STATUSES = ["planned", "passed", "failed", "partial"];
    INTAKE_DIR = ".lw/qa/intake";
  }
});

// src/services/manifest.mts
function checkAct(at, step, errors) {
  if (!isObject(step)) {
    errors.push(`${at}: not an object`);
    return;
  }
  for (const key of Object.keys(step)) if (!ACT_FIELDS.has(key)) errors.push(`${at}: "${key}" is not an act field`);
  const kind = step.kind;
  if (typeof kind !== "string" || !ACT_KINDS.includes(kind)) {
    errors.push(`${at}: kind "${String(kind)}" is not one of ${ACT_KINDS.join(" ")}. The list is closed so every target can run it.`);
    return;
  }
  if ((kind === "click" || kind === "type") && !isText(step.target)) errors.push(`${at}: a ${kind} needs a target selector`);
  if (kind === "type" && typeof step.text !== "string") errors.push(`${at}: a type needs text`);
  if (kind === "press" && !isText(step.key)) errors.push(`${at}: a press needs a key`);
  if (kind === "scroll" && typeof step.dx !== "number" && typeof step.dy !== "number") errors.push(`${at}: a scroll needs dx or dy`);
  if (kind === "wait") {
    if (typeof step.ms !== "number" || step.ms <= 0) errors.push(`${at}: a wait needs ms above 0`);
    if (!isText(step.why)) errors.push(`${at}: a wait needs a why that names what it waits for`);
  }
}
function checkFixture(at, fixture3, errors) {
  if (!isObject(fixture3)) {
    errors.push(`${at}: fixture must be an object with arm`);
    return;
  }
  const { account, arm, persona, facts } = fixture3;
  if (account !== void 0) errors.push(`${at}: fixture.account is refused. Use fixture.persona, a persona id from the world registry.`);
  if (persona !== void 0 && (typeof persona !== "string" || !KEBAB.test(persona))) {
    errors.push(`${at}: fixture.persona must be a kebab-case persona id`);
  }
  if (facts !== void 0) {
    if (!Array.isArray(facts)) errors.push(`${at}: fixture.facts must be an array of fact ids`);
    else for (const fact of facts) if (typeof fact !== "string" || !FACT_ID.test(fact)) errors.push(`${at}: fixture.facts holds "${String(fact)}", which is not a fact id`);
  }
  if (!Array.isArray(arm)) errors.push(`${at}: fixture.arm must be an array, empty when nothing is armed`);
  else for (const state of arm) if (typeof state !== "string" || !KEBAB.test(state)) errors.push(`${at}: fixture.arm holds "${String(state)}", which is not a state name`);
}
function checkSettle(at, settle, errors) {
  if (!isObject(settle)) {
    errors.push(`${at}: settle must be an object`);
    return;
  }
  const rules = SETTLE_RULES.filter((rule) => rule === "selector" ? isText(settle.selector) : settle[rule] === true);
  if (rules.length !== 1) {
    errors.push(`${at}: settle needs exactly one of ${SETTLE_RULES.join(", ")}; it has ${rules.length === 0 ? "none" : rules.join(", ")}`);
  }
  if (settle.timeout !== void 0 && (typeof settle.timeout !== "number" || settle.timeout <= 0)) {
    errors.push(`${at}: settle.timeout must be a number of milliseconds above 0`);
  }
}
function checkExpect(at, expect, errors) {
  if (isText(expect)) return;
  if (!isObject(expect)) {
    errors.push(`${at}: expect must be a claim, or an object with text and pageErrors`);
    return;
  }
  if (!isText(expect.text)) errors.push(`${at}: expect.text is missing`);
  if (expect.pageErrors !== void 0 && (!Array.isArray(expect.pageErrors) || !expect.pageErrors.every(isText))) {
    errors.push(`${at}: expect.pageErrors must be an array of page error texts`);
  }
}
function checkShot(shot, i, seen, legs, bases, errors) {
  const at = isObject(shot) && typeof shot.id === "string" ? `shots[${i}] "${shot.id}"` : `shots[${i}]`;
  if (!isObject(shot)) {
    errors.push(`${at}: not an object`);
    return;
  }
  for (const field of SHOT_FIELDS) if (shot[field] === void 0) errors.push(`${at}: ${field} is missing`);
  if (typeof shot.id === "string") {
    if (seen.has(shot.id)) errors.push(`${at}: duplicate id`);
    seen.add(shot.id);
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(shot.id)) errors.push(`${at}: id must be <screen>.<state-slug>, lower case and hyphenated`);
  }
  for (const field of ["screen", "state"]) {
    if (shot[field] !== void 0 && !isText(shot[field])) errors.push(`${at}: ${field} must be a text`);
  }
  if (shot.specRef !== void 0 && (typeof shot.specRef !== "string" || !/^\d+(\.\d+)*$/.test(shot.specRef))) {
    errors.push(`${at}: specRef is digits and dots, the spec section this row checks`);
  }
  if (shot.source !== void 0) {
    if (!Array.isArray(shot.source) || shot.source.length === 0) {
      errors.push(`${at}: source must hold at least one of spec:<path>#<id>, commit:<sha>, issue:<intake-id>`);
    } else {
      for (const s of shot.source) if (typeof s !== "string" || !SOURCE_RE.test(s)) errors.push(`${at}: source "${String(s)}" is not spec:<path>#<id>, commit:<sha> or issue:<intake-id>`);
    }
  }
  if (Array.isArray(shot.legs)) {
    if (shot.legs.length === 0) errors.push(`${at}: legs is empty, so the row runs nowhere`);
    for (const leg of shot.legs) if (typeof leg !== "string" || !legs.has(leg)) errors.push(`${at}: "${String(leg)}" is not a leg. Legs: ${[...legs].join(" ")}`);
    if (new Set(shot.legs).size !== shot.legs.length) errors.push(`${at}: legs names one leg twice`);
  } else if (shot.legs !== void 0) {
    errors.push(`${at}: legs must be an array`);
  }
  if (shot.route !== void 0) {
    if (typeof shot.route !== "string" || !shot.route.startsWith("/")) errors.push(`${at}: route must start with /`);
    else {
      const base = bases.find((b) => b !== "" && (shot.route === b || shot.route.startsWith(`${b}/`)));
      if (base !== void 0) errors.push(`${at}: route is relative to the surface base, so drop ${base}. Each leg adds its own base.`);
    }
  }
  if (shot.video !== void 0 && typeof shot.video !== "boolean") errors.push(`${at}: video must be true, false or absent`);
  if (shot.fixture !== void 0) checkFixture(at, shot.fixture, errors);
  if (shot.settle !== void 0) checkSettle(at, shot.settle, errors);
  if (shot.expect !== void 0) checkExpect(at, shot.expect, errors);
  if (shot.act !== void 0) {
    if (!Array.isArray(shot.act)) errors.push(`${at}: act must be an array`);
    else shot.act.forEach((step, j) => checkAct(`${at}: act[${j}]`, step, errors));
  }
}
function validateManifest(m, opts = {}) {
  const errors = [];
  if (!isObject(m)) return ["the manifest is not an object"];
  for (const field of ["title", "generated"]) if (!isText(m[field])) errors.push(`${field}: missing`);
  for (const field of ["spec", "range"]) if (m[field] !== void 0 && !isText(m[field])) errors.push(`${field}: must be a text`);
  for (const field of ["issues", "commits"]) {
    if (m[field] !== void 0 && (!Array.isArray(m[field]) || !m[field].every(isText))) errors.push(`${field}: must be an array of texts`);
  }
  if (!Array.isArray(m.shots) || m.shots.length === 0) {
    errors.push("shots: must be a non-empty array");
    return errors;
  }
  const legs = new Set(opts.legs ?? Object.keys(DEFAULT_LEGS));
  const seen = /* @__PURE__ */ new Set();
  m.shots.forEach((shot, i) => checkShot(shot, i, seen, legs, opts.bases ?? [], errors));
  return errors;
}
async function loadManifest(path, opts = {}) {
  let raw;
  try {
    raw = await (0, import_promises4.readFile)(path, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.manifest.read", `Cannot read the manifest ${path}`, { cause, context: { path } });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError("qa.manifest.json", `The manifest ${path} is not JSON`, { cause, context: { path } });
  }
  const errors = validateManifest(parsed, opts);
  if (errors.length > 0) {
    throw new LaunchwrightError("qa.manifest.invalid", `The manifest ${path} is invalid:
  ${errors.join("\n  ")}`, {
      context: { path, errors }
    });
  }
  return parsed;
}
function expectText(shot) {
  return typeof shot.expect === "string" ? shot.expect : shot.expect.text;
}
function expectedPageErrors(shot) {
  return typeof shot.expect === "string" ? [] : shot.expect.pageErrors ?? [];
}
function evidencePath(slug3, leg, rowId, kind, opts = {}) {
  const attempt = opts.attempt !== void 0 && opts.attempt > 1 ? `.a${opts.attempt}` : "";
  let suffix;
  if (kind === "screenshot") suffix = "png";
  else if (kind === "step") {
    if (opts.step === void 0) throw new LaunchwrightError("qa.evidence.step", `A step screenshot of ${rowId} on ${leg} needs a step number`);
    suffix = `${opts.step}.png`;
  } else if (kind === "video") suffix = opts.videoExt ?? "webm";
  else suffix = SUFFIX[kind];
  return `assets/${slug3}/${leg}-${rowId}${attempt}.${suffix}`;
}
var import_promises4, SHOT_FIELDS, ACT_FIELDS, SETTLE_RULES, SOURCE_RE, KEBAB, FACT_ID, isObject, isText, SUFFIX;
var init_manifest2 = __esm({
  "src/services/manifest.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises4 = require("fs/promises");
    init_kernel();
    init_legs();
    init_types();
    SHOT_FIELDS = ["id", "screen", "state", "source", "legs", "route", "fixture", "settle", "expect"];
    ACT_FIELDS = /* @__PURE__ */ new Set(["kind", "target", "text", "key", "dx", "dy", "ms", "why"]);
    SETTLE_RULES = ["selector", "artwork", "video", "busy"];
    SOURCE_RE = /^(?:spec:[^\s#]+#[A-Za-z0-9._-]+|commit:[0-9a-f]{7,40}|issue:[A-Za-z0-9._-]+)$/;
    KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    FACT_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
    isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    isText = (v) => typeof v === "string" && v.trim() !== "";
    SUFFIX = {
      trace: "trace.zip",
      log: "log.jsonl",
      ui: "ui.xml"
    };
  }
});

// src/services/resolve.mts
function specSlug(specPath) {
  return (0, import_node_path7.basename)(specPath).replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-(design|analysis|build|plan)$/, "");
}
function readKey(all, headerEnd, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`);
  for (let i = 0; i < headerEnd; i++) {
    const match = re.exec(all[i] ?? "");
    if (!match) continue;
    const parts = [(match[1] ?? "").trim()];
    for (let j = i + 1; j < headerEnd; j++) {
      const next = all[j] ?? "";
      if (next.trim() === "" || /^#{1,6}\s/.test(next) || /^[A-Z][A-Za-z-]*:\s/.test(next)) break;
      parts.push(next.trim());
    }
    return parts.join(" ").trim() || null;
  }
  return null;
}
function parseSpec(text2) {
  const all = text2.split("\n");
  const firstSection = all.findIndex((l) => /^##\s/.test(l));
  const headerEnd = firstSection === -1 ? all.length : firstSection;
  const titleLine = all.slice(0, headerEnd).find((l) => /^#\s+\S/.test(l));
  const statusText = readKey(all, headerEnd, "Status");
  const sections = [];
  all.forEach((line, i) => {
    const match = /^(#{2,4})\s+(.*)$/.exec(line);
    if (match) sections.push({ level: (match[1] ?? "").length, heading: (match[2] ?? "").trim(), line: i + 1 });
  });
  return {
    title: titleLine ? titleLine.replace(/^#\s+/, "").trim() : null,
    date: readKey(all, headerEnd, "Date"),
    status: statusText ? /^([a-z][a-z-]*)/.exec(statusText)?.[1] ?? null : null,
    statusText,
    subject: readKey(all, headerEnd, "Subject"),
    sections
  };
}
function codeSpans(text2) {
  const spans = [];
  let fenced = false;
  for (const line of text2.split("\n")) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      spans.push(line);
      continue;
    }
    for (const match of line.matchAll(/`([^`]+)`/g)) spans.push(match[1] ?? "");
  }
  return spans;
}
function pathTokens(span) {
  const found = [];
  for (const match of span.matchAll(/[A-Za-z0-9_@./-]+/g)) {
    const token2 = match[0].replace(/[.,;:)\]}'"]+$/, "").replace(/#L?\d+(-L?\d+)?$/, "").replace(/:\d+(-\d+)?$/, "").replace(/^\.\//, "").replace(/\/$/, "");
    if (!token2.includes("/") || token2.startsWith("/") || token2.startsWith("http")) continue;
    found.push(token2);
  }
  return found;
}
function specPaths(repo, text2) {
  const trackedList = lines(gitOut(repo, ["ls-files"]));
  const tracked = new Set(trackedList);
  const dirs = /* @__PURE__ */ new Set();
  for (const path of tracked) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  const files = /* @__PURE__ */ new Set();
  const namedDirs = /* @__PURE__ */ new Set();
  const unknown = /* @__PURE__ */ new Set();
  for (const span of codeSpans(text2)) {
    for (const token2 of pathTokens(span)) {
      if (tracked.has(token2)) {
        files.add(token2);
        continue;
      }
      if (dirs.has(token2)) {
        if (token2.split("/").length >= MIN_DIR_SEGMENTS) namedDirs.add(token2);
        else unknown.add(`${token2} (a folder, too broad to search: needs ${MIN_DIR_SEGMENTS} segments)`);
        continue;
      }
      if (!/\.[a-z0-9]{1,6}$/i.test(token2)) continue;
      const matches = trackedList.filter((path) => path.endsWith(`/${token2}`));
      if (matches.length === 1) files.add(matches[0]);
      else if (matches.length > 1) unknown.add(`${token2} (matches ${matches.length} tracked files, so it is ambiguous)`);
      else unknown.add(token2);
    }
  }
  return { files: [...files].sort(), dirs: [...namedDirs].sort(), unknown: [...unknown].sort() };
}
function record(union, commit, source, via = []) {
  const existing = union.get(commit.sha);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    for (const path of via) if (!existing.via.includes(path)) existing.via.push(path);
    return;
  }
  const { sha, short, date, author, subject } = commit;
  union.set(commit.sha, { sha, short, date, author, subject, sources: [source], via: [...via] });
}
function commitAt(repo, rev) {
  const out = git(repo, ["log", "-1", `--format=${LOG_FORMAT}`, `${rev}^{commit}`], { allowFail: true });
  return out ? parseLog(out)[0] ?? null : null;
}
function fromStatus(repo, union, statusText) {
  const claimed = [];
  const rejected = [];
  for (const match of (statusText ?? "").matchAll(/\b[0-9a-f]{7,40}\b/gi)) {
    const commit = commitAt(repo, match[0]);
    if (!commit) {
      rejected.push(match[0]);
      continue;
    }
    claimed.push(commit.short);
    record(union, commit, "status");
  }
  return { claimed, rejected, note: "shas on the Status: line of the spec" };
}
function fromGrep(repo, union, terms) {
  const args = ["log", "--all", "--no-merges", "--fixed-strings", "--regexp-ignore-case", `--format=${LOG_FORMAT}`, ...terms.map((t) => `--grep=${t}`)];
  const commits = parseLog(gitOut(repo, args));
  for (const commit of commits.slice(0, COMMIT_CAP)) record(union, commit, "grep");
  return { terms, matched: commits.length, truncated: commits.length > COMMIT_CAP, note: "commit messages that name the spec file or its title" };
}
function fromPaths(repo, union, paths, since, until) {
  const pathspec = [...paths.files, ...paths.dirs];
  if (pathspec.length === 0) return { pathspec, window: null, matched: 0, truncated: false, note: "the spec names no tracked path" };
  const commits = parseLog(gitOut(repo, ["log", "--all", "--no-merges", `--since=${gitInstant(since)}`, `--until=${until}`, `--format=${LOG_FORMAT}`, "--name-only", "--", ...pathspec]));
  for (const commit of commits.slice(0, COMMIT_CAP)) record(union, commit, "paths", commit.paths);
  return {
    pathspec,
    window: `${gitInstant(since)} .. ${until}`,
    matched: commits.length,
    truncated: commits.length > COMMIT_CAP,
    note: "commits that touched a named path between the spec Date: and today"
  };
}
function filesTouched(repo, shas) {
  if (shas.length === 0) return { count: 0, list: [], truncated: false };
  const files = /* @__PURE__ */ new Set();
  for (const commit of parseLog(gitOut(repo, ["log", "--no-walk", `--format=${LOG_FORMAT}`, "--name-only", ...shas]))) {
    for (const path of commit.paths) files.add(path);
  }
  const list3 = [...files].sort();
  return { count: list3.length, list: list3.slice(0, FILE_CAP), truncated: list3.length > FILE_CAP };
}
function suggestLegs(input) {
  const named2 = new Set(input.specFiles);
  const paths = [.../* @__PURE__ */ new Set([...input.specFiles, ...input.commitFiles])];
  const browser = (surfaces) => input.legs.filter((l) => surfaces.includes(l.surface) && l.target === "playwright").map((l) => l.name);
  const evidence = [];
  const notes = [];
  const add = (legs, rule, matched) => {
    if (matched.length === 0 || legs.length === 0) return;
    evidence.push({
      legs,
      rule,
      fromSpec: matched.filter((p) => named2.has(p)).slice(0, 8),
      fromCommits: matched.filter((p) => !named2.has(p)).slice(0, 8),
      matched: matched.length
    });
  };
  const roots = input.clientRoots.map((r) => r.replace(/\/+$/, ""));
  add(
    browser(["web", "miniapp"]),
    `a file under qa.clientRoots (${roots.join(", ")})`,
    paths.filter((p) => roots.some((r) => p.startsWith(`${r}/`)))
  );
  add(browser(["bot"]), "a bot feature file (*.feature.mts)", paths.filter((p) => p.endsWith(".feature.mts")));
  const suggested = input.legs.map((l) => l.name).filter((name) => evidence.some((e) => e.legs.includes(name)));
  if (suggested.length === 0) notes.push("No rule matched. Choose the legs by hand with --legs, and say why in section 4.");
  if (evidence.length > 0 && evidence.every((e) => e.fromSpec.length === 0)) {
    notes.push("Every leg here comes from a file a commit touched, not one the spec names. Check the evidence before trusting the list.");
  }
  return { suggested, evidence, notes };
}
function resolveSpec(opts) {
  const { repo } = opts;
  const abs = (0, import_node_path7.isAbsolute)(opts.specPath) ? opts.specPath : (0, import_node_path7.resolve)(opts.cwd, opts.specPath);
  if (!(0, import_node_fs6.existsSync)(abs)) throw new LaunchwrightError("qa.session.resolve", `${opts.specPath} does not exist`, { context: { path: opts.specPath } });
  if (!abs.endsWith(".md")) throw new LaunchwrightError("qa.session.resolve", `${opts.specPath} is not a Markdown spec`, { context: { path: opts.specPath } });
  const rel = (0, import_node_path7.relative)(repo, abs).startsWith("..") ? abs : (0, import_node_path7.relative)(repo, abs);
  const text2 = (0, import_node_fs6.readFileSync)(abs, "utf8");
  const spec = parseSpec(text2);
  const notes = [];
  if (!rel.startsWith("docs/specs/") && !rel.startsWith("docs/plans/")) notes.push(`${rel} is outside docs/specs/ and docs/plans/, so it may have no spec header.`);
  const filenameDate = /^(\d{4}-\d{2}-\d{2})-/.exec((0, import_node_path7.basename)(rel))?.[1] ?? null;
  const dateField = spec.date ? /(\d{4}-\d{2}-\d{2})/.exec(spec.date)?.[1] ?? null : null;
  const since = dateField ?? filenameDate;
  if (!since) notes.push("No Date: line and no YYYY-MM-DD file name prefix, so the source of touched files is skipped.");
  const today = opts.clock.date().toISOString().slice(0, 10);
  const paths = specPaths(repo, text2);
  const union = /* @__PURE__ */ new Map();
  const sources = {
    status: fromStatus(repo, union, spec.statusText),
    grep: fromGrep(repo, union, [(0, import_node_path7.basename)(rel).replace(/\.md$/, ""), spec.title].filter((t) => Boolean(t))),
    paths: since ? fromPaths(repo, union, paths, since, `${today}T23:59:59`) : { pathspec: [], window: null, matched: 0, truncated: false, note: "skipped: the spec has no date" }
  };
  const commits = [...union.values()].sort((a, b) => a.date.localeCompare(b.date) || a.short.localeCompare(b.short));
  const files = filesTouched(
    repo,
    commits.map((c) => c.sha)
  );
  if (commits.length === 0) {
    notes.push(
      `Zero commits. No sha on Status:, no commit message names the spec, and no commit touched its ${paths.files.length} tracked file(s) in its window. Say so in section 2, and still shoot the screens the spec names.`
    );
  }
  if (sources.status.rejected.length > 0) notes.push(`Status: names ${sources.status.rejected.join(", ")}, which are not commits here.`);
  if (paths.unknown.length > 0) notes.push(`${paths.unknown.length} named path(s) are not tracked here: ${paths.unknown.slice(0, 8).join(", ")}`);
  const slug3 = `${today}-${specSlug(rel)}`;
  return {
    spec: { path: rel, slug: slug3, title: spec.title, date: spec.date, dateUsed: since, status: spec.status, statusText: spec.statusText, subject: spec.subject, sections: spec.sections },
    paths,
    commits: { count: commits.length, list: commits },
    sources,
    files,
    legs: suggestLegs({ specFiles: paths.files, commitFiles: files.list, clientRoots: opts.clientRoots, legs: opts.legs }),
    report: {
      path: `${opts.reportDir}/${slug3}.md`,
      manifest: `${opts.reportDir}/${slug3}.shots.json`,
      assets: `${opts.reportDir}/assets/${slug3}/`
    },
    notes
  };
}
function resolveIssue(cwd, id, legNames2) {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new LaunchwrightError("qa.session.issue", `${id} is not an intake issue id`, { context: { id } });
  const dir = (0, import_node_path7.join)(INTAKE_DIR, id);
  const file = (0, import_node_path7.join)(cwd, dir, "issue.json");
  let issue;
  try {
    issue = JSON.parse((0, import_node_fs6.readFileSync)(file, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.session.issue", `Cannot read the intake issue ${dir}/issue.json. Run lw qa intake first.`, { cause, context: { id } });
  }
  const text2 = [issue.title, issue.text, ...issue.thread.map((t) => t.text)].join("\n");
  const known = new Set(legNames2);
  const legs = LEG_HINTS.filter((h) => known.has(h.leg)).map((h) => ({ leg: h.leg, words: [...new Set([...text2.matchAll(h.words)].map((m) => m[0].toLowerCase()))] })).filter((h) => h.words.length > 0);
  const notes = [];
  if (legs.length === 0) notes.push("The text hints at no leg. Choose the legs by hand, and say why in section 4.");
  if (issue.skipped.length > 0) notes.push(`${issue.skipped.length} attachment(s) were not downloaded: ${issue.skipped.map((s) => s.reason).join(", ")}.`);
  return {
    issue: issue.id,
    title: issue.title,
    claim: issue.text,
    reference: issue.attachments.filter((a) => a.kind === "image" || a.kind === "video").map((a) => ({ kind: a.kind, path: (0, import_node_path7.join)(dir, a.path) })),
    legs,
    source: `issue:${issue.id}`,
    notes
  };
}
var import_node_fs6, import_node_path7, COMMIT_CAP, FILE_CAP, MIN_DIR_SEGMENTS, LEG_HINTS;
var init_resolve = __esm({
  "src/services/resolve.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs6 = require("fs");
    import_node_path7 = require("path");
    init_kernel();
    init_changes();
    init_types();
    COMMIT_CAP = 120;
    FILE_CAP = 400;
    MIN_DIR_SEGMENTS = 4;
    LEG_HINTS = [
      { leg: "safari-ios", words: /\b(iphone|ipad|ios|safari)\b|айфон/giu },
      { leg: "telegram-android", words: /\bandroid\b|андроид/giu },
      { leg: "miniapp", words: /\b(telegram|mini ?app|web ?app)\b|телеграм/giu },
      { leg: "telegram-fake", words: /\b(bot|\/start)\b|бот/giu },
      { leg: "mobile-web", words: /\b(mobile|phone|smartphone|pixel|galaxy|samsung|xiaomi|huawei|oneplus)\b|телефон/giu },
      { leg: "desktop", words: /\b(desktop|laptop|windows|macos|chrome|firefox|edge)\b/giu }
    ];
  }
});

// src/services/ledger.mts
function reportPaths(reportDir, slug3) {
  return {
    md: (0, import_node_path8.join)(reportDir, `${slug3}.md`),
    plan: (0, import_node_path8.join)(reportDir, `${slug3}.shots.json`),
    assets: (0, import_node_path8.join)(reportDir, assetsRel(slug3)),
    ledger: (0, import_node_path8.join)(reportDir, assetsRel(slug3), LEDGER_FILE),
    results: (0, import_node_path8.join)(reportDir, assetsRel(slug3), RESULTS_FILE),
    html: (0, import_node_path8.join)(reportDir, "dist", `${slug3}.html`)
  };
}
async function fileDigest(path) {
  const sha2562 = await hashFile(path);
  return { sha256: sha2562, bytes: (await (0, import_promises5.stat)(path)).size };
}
async function ledgerEntry(reportDir, facts) {
  checkEntryPath(facts.path);
  const { sha256: sha2562, bytes } = await fileDigest((0, import_node_path8.join)(reportDir, facts.path));
  return { ...facts, sha256: sha2562, bytes };
}
function checkEntryPath(path) {
  if (!/^assets\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-][A-Za-z0-9._/-]*$/.test(path) || path.split("/").includes("..")) {
    throw new LaunchwrightError("qa.ledger.path", `Ledger path ${path} is not assets/<slug>/<file>`, { context: { path } });
  }
}
function entryProblem(e) {
  if (!isObject2(e)) return "not an object";
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
  if (!isObject2(parsed) || parsed.format !== LEDGER_FORMAT || typeof parsed.slug !== "string" || !Array.isArray(parsed.entries)) {
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
  await (0, import_promises5.mkdir)((0, import_node_path8.dirname)(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await (0, import_promises5.writeFile)(tmp, `${JSON.stringify(sorted, null, 2)}
`);
  await (0, import_promises5.rename)(tmp, path);
  return sorted;
}
async function appendLedger(reportDir, slug3, entries) {
  const path = reportPaths(reportDir, slug3).ledger;
  const current = await readLedger(path) ?? { format: LEDGER_FORMAT, slug: slug3, entries: [] };
  const byPath = new Map(current.entries.map((e) => [e.path, e]));
  for (const e of entries) byPath.set(e.path, e);
  return writeLedger(path, { format: LEDGER_FORMAT, slug: slug3, entries: [...byPath.values()] });
}
async function dropRowLeg(reportDir, slug3, row, leg) {
  const path = reportPaths(reportDir, slug3).ledger;
  const current = await readLedger(path);
  if (!current) return;
  const stale = current.entries.filter((e) => e.row === row && e.leg === leg);
  if (stale.length === 0) return;
  for (const e of stale) {
    checkEntryPath(e.path);
    if (!e.path.startsWith(`${assetsRel(slug3)}/`)) {
      throw new LaunchwrightError("qa.ledger.path", `Ledger path ${e.path} is outside ${assetsRel(slug3)}`, { context: { path: e.path } });
    }
  }
  for (const e of stale) await (0, import_promises5.rm)((0, import_node_path8.join)(reportDir, e.path), { force: true });
  await writeLedger(path, { ...current, entries: current.entries.filter((e) => !(e.row === row && e.leg === leg)) });
}
async function verifyLedger(reportDir, entries) {
  const out = [];
  for (const e of entries) {
    const file = (0, import_node_path8.join)(reportDir, e.path);
    const where = `row ${e.row}, leg ${e.leg}`;
    try {
      await (0, import_promises5.stat)(file);
    } catch (cause) {
      if (cause.code !== "ENOENT") throw new LaunchwrightError("qa.ledger.read", `Cannot read ${file}`, { cause });
      out.push({ code: "missing-file", path: e.path, row: e.row, leg: e.leg, message: `${e.path} is in the ledger and missing on disk (${where})` });
      continue;
    }
    const actual = await fileDigest(file);
    if (actual.sha256 !== e.sha256 || actual.bytes !== e.bytes) {
      out.push({ code: "hash", path: e.path, row: e.row, leg: e.leg, message: `${e.path} does not match its ledger hash (${where})` });
    }
  }
  return out;
}
async function readResults(path) {
  const raw = await readTextOrNull(path);
  if (raw === null) return [];
  const out = [];
  raw.split("\n").forEach((line, i) => {
    if (line.trim() === "") return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (cause) {
      throw new LaunchwrightError("qa.results.invalid", `${path}:${i + 1} is not JSON`, { cause, context: { path, line: i + 1 } });
    }
    if (!isObject2(parsed) || typeof parsed.row !== "string" || typeof parsed.leg !== "string" || typeof parsed.status !== "string" || !Array.isArray(parsed.failures)) {
      throw new LaunchwrightError("qa.results.invalid", `${path}:${i + 1} is not a row result`, { context: { path, line: i + 1 } });
    }
    out.push(parsed);
  });
  return out;
}
async function appendResult(path, result) {
  await (0, import_promises5.mkdir)((0, import_node_path8.dirname)(path), { recursive: true });
  await (0, import_promises5.writeFile)(path, `${JSON.stringify(result)}
`, { flag: "a" });
}
var import_promises5, import_node_path8, LEDGER_FILE, RESULTS_FILE, LEDGER_FORMAT, assetsRel, isObject2, pairKey;
var init_ledger = __esm({
  "src/services/ledger.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises5 = require("fs/promises");
    import_node_path8 = require("path");
    init_kernel();
    init_fs();
    init_types();
    LEDGER_FILE = "evidence.lock.json";
    RESULTS_FILE = "results.jsonl";
    LEDGER_FORMAT = 1;
    assetsRel = (slug3) => `assets/${slug3}`;
    isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    pairKey = (row, leg) => `${row}\0${leg}`;
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
function bad(message, cause) {
  return new LaunchwrightError("qa.png.unsupported", `PNG decode: ${message}`, cause === void 0 ? {} : { cause });
}
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
function decodePngRgba(bytes) {
  const size2 = pngSize(bytes);
  if (!size2) throw bad("not a PNG");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let depth = 0;
  let colorType = -1;
  let palette = null;
  const idat = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      depth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw bad("interlaced images are not supported");
    } else if (type === "PLTE") palette = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const channels = CHANNELS[colorType];
  if (channels === void 0) throw bad(`color type ${colorType}`);
  if (!(depth === 8 || depth === 16 && colorType !== 3)) throw bad(`bit depth ${depth} with color type ${colorType}`);
  if (colorType === 3 && !palette) throw bad("a palette image without PLTE");
  let raw;
  try {
    raw = (0, import_node_zlib.inflateSync)(Buffer.concat(idat));
  } catch (cause) {
    throw bad("the image data does not inflate", cause);
  }
  const bpp = channels * depth / 8;
  const stride = size2.width * bpp;
  if (raw.length < (stride + 1) * size2.height) throw bad("the image data is shorter than the header says");
  const rgba = new Uint8Array(size2.width * size2.height * 4);
  let prev = new Uint8Array(stride);
  let line = new Uint8Array(stride);
  for (let y = 0; y < size2.height; y += 1) {
    const offset = y * (stride + 1);
    const filter = raw[offset];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[offset + 1 + x];
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let out;
      if (filter === 0) out = value;
      else if (filter === 1) out = value + a;
      else if (filter === 2) out = value + b;
      else if (filter === 3) out = value + (a + b >> 1);
      else if (filter === 4) out = value + paeth(a, b, c);
      else throw bad(`filter type ${filter} on row ${y}`);
      line[x] = out & 255;
    }
    const sample = (px, ch) => depth === 8 ? line[px * bpp + ch] : line[px * bpp + ch * 2];
    for (let px = 0; px < size2.width; px += 1) {
      const o = (y * size2.width + px) * 4;
      if (colorType === 3) {
        const i = line[px] * 3;
        rgba[o] = palette[i] ?? 0;
        rgba[o + 1] = palette[i + 1] ?? 0;
        rgba[o + 2] = palette[i + 2] ?? 0;
        rgba[o + 3] = 255;
      } else if (colorType === 0 || colorType === 4) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = sample(px, 0);
        rgba[o + 3] = colorType === 4 ? sample(px, 1) : 255;
      } else {
        rgba[o] = sample(px, 0);
        rgba[o + 1] = sample(px, 1);
        rgba[o + 2] = sample(px, 2);
        rgba[o + 3] = colorType === 6 ? sample(px, 3) : 255;
      }
    }
    [prev, line] = [line, prev];
  }
  return { ...size2, rgba };
}
function decodePngLuma(bytes) {
  const { width, height, rgba } = decodePngRgba(bytes);
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i += 1) {
    luma[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return { width, height, luma };
}
function pixelBox(size2, rect) {
  const clamp2 = (v, max) => Math.min(max, Math.max(0, v));
  const left = clamp2(Math.round(rect.x * size2.width), size2.width - 1);
  const top = clamp2(Math.round(rect.y * size2.height), size2.height - 1);
  const right = clamp2(Math.round((rect.x + rect.w) * size2.width), size2.width);
  const bottom = clamp2(Math.round((rect.y + rect.h) * size2.height), size2.height);
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
function cropPng(bytes, rect) {
  const image = decodePngRgba(bytes);
  const box = pixelBox(image, rect);
  const out = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    const from = ((box.top + y) * image.width + box.left) * 4;
    out.set(image.rgba.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return { png: encodePng(box.width, box.height, out), width: box.width, height: box.height };
}
function lumaStdDev(bytes) {
  const { luma } = decodePngLuma(bytes);
  let mean = 0;
  let m2 = 0;
  for (let i = 0; i < luma.length; i += 1) {
    const v = luma[i];
    const delta = v - mean;
    mean += delta / (i + 1);
    m2 += delta * (v - mean);
  }
  return Math.sqrt(m2 / luma.length);
}
function blankFailure(bytes, blankStdDev) {
  return lumaStdDev(bytes) < blankStdDev ? "blank" : null;
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
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
var import_node_zlib, MAGIC, CHANNELS, CRC_TABLE;
var init_png = __esm({
  "src/services/png.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_zlib = require("zlib");
    init_kernel();
    MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];
    CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
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
function runFile(bin, timeoutMs) {
  return (args) => new Promise((resolve17, reject) => {
    (0, import_node_child_process2.execFile)(bin, [...args], { maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
      if (error?.killed && error.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        reject(new LaunchwrightError("qa.video.timeout", `${bin} ran past ${timeoutMs} ms and was stopped.`, { cause: error, context: { bin, timeoutMs } }));
        return;
      }
      if (error && typeof error.code !== "number") {
        reject(new LaunchwrightError("qa.video.tool", `Cannot run ${bin}. Install ffmpeg, or check the doctor.`, { cause: error, context: { bin } }));
        return;
      }
      resolve17({ code: typeof error?.code === "number" ? error.code : 0, stdout, stderr });
    });
  });
}
function systemVideoTools(bins = {}) {
  const timeoutMs = bins.timeoutMs ?? VIDEO_TOOL_TIMEOUT_MS;
  return { ffprobe: runFile(bins.ffprobe ?? "ffprobe", timeoutMs), ffmpeg: runFile(bins.ffmpeg ?? "ffmpeg", timeoutMs) };
}
function probeArgs(path) {
  return ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path];
}
function blackdetectArgs(path) {
  return ["-hide_banner", "-nostdin", "-i", path, "-vf", BLACKDETECT_FILTER, "-an", "-f", "null", "-"];
}
function parseProbeDuration(stdout) {
  const value = Number.parseFloat(stdout.trim());
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function parseBlackdetect(stderr) {
  let blackS = 0;
  for (const m of stderr.matchAll(/black_duration:\s*([\d.]+)/g)) blackS += Number(m[1]);
  const header = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
  let durationS = header ? hms(header[1], header[2], header[3]) : null;
  if (durationS === null) {
    const times = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
    const last = times.at(-1);
    if (last) durationS = hms(last[1], last[2], last[3]);
  }
  return { blackS, durationS };
}
async function measureVideo(path, tools) {
  const probe = await tools.ffprobe(probeArgs(path));
  const decoded = await tools.ffmpeg(blackdetectArgs(path));
  if (decoded.code !== 0) {
    throw new LaunchwrightError("qa.video.measure", `ffmpeg cannot decode ${path} (exit ${decoded.code})`, {
      context: { path, stderr: decoded.stderr.slice(-2e3) }
    });
  }
  const black = parseBlackdetect(decoded.stderr);
  const durationS = (probe.code === 0 ? parseProbeDuration(probe.stdout) : null) ?? black.durationS;
  if (durationS === null) {
    throw new LaunchwrightError("qa.video.measure", `Neither ffprobe nor ffmpeg gives a duration for ${path}`, { context: { path } });
  }
  return { durationS, blackS: black.blackS };
}
function videoFailures(m, evidence) {
  const out = [];
  if (m.durationS < MIN_VIDEO_S || m.blackS / m.durationS > evidence.blackRatio) out.push("blank-video");
  if (m.durationS > evidence.videoCapS) out.push("over-budget");
  return out;
}
var import_node_child_process2, BLACKDETECT_FILTER, VIDEO_TOOL_TIMEOUT_MS, hms, MIN_VIDEO_S;
var init_video = __esm({
  "src/services/video.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_child_process2 = require("child_process");
    init_kernel();
    BLACKDETECT_FILTER = "blackdetect=d=0.1:pix_th=0.10";
    VIDEO_TOOL_TIMEOUT_MS = 3e5;
    hms = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s);
    MIN_VIDEO_S = 1;
  }
});

// src/services/evidence.mts
function isBootFailure(text2, sentences) {
  const body = text2.trim();
  if (body === "") return true;
  return sentences.some((s) => s.trim() !== "" && (body === s.trim() || body.startsWith(s.trim())));
}
function routeHeld(requested, landedPath, base = "", locale) {
  const want = trimSlash(requested.split("?")[0] ?? "") || "/";
  let got = trimSlash(landedPath.split("?")[0] ?? "") || "/";
  if (base !== "" && (got === base || got.startsWith(`${base}/`))) got = trimSlash(got.slice(base.length)) || "/";
  if (got === want) return true;
  if (!locale) return false;
  return (trimSlash(got.replace(locale, "")) || "/") === want;
}
function unexpectedPageErrors(lines2, expected) {
  return lines2.filter((l) => l.kind === "page-error" && !expected.some((e) => l.text.includes(e)));
}
function attemptFailures(facts, evidence) {
  const out = /* @__PURE__ */ new Set();
  for (const png of facts.screenshots ?? []) if (blankFailure(png, evidence.blankStdDev)) out.add("blank");
  if (facts.page && isBootFailure(facts.page.text, facts.page.bootFailureSentences)) out.add("not-booted");
  if (facts.route && !routeHeld(facts.route.requested, facts.route.landedPath, facts.route.base, facts.route.locale)) out.add("route-drift");
  for (const v of facts.videos ?? []) for (const f of videoFailures(v, evidence)) out.add(f);
  if (unexpectedPageErrors(facts.logs ?? [], facts.expectedPageErrors ?? []).length > 0) out.add("page-error");
  const order = ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error"];
  return order.filter((f) => out.has(f));
}
function naturalCompare(a, b) {
  const pa = a.split(/(\d+)/);
  const pb = b.split(/(\d+)/);
  for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    if (i % 2 === 1) return Number(x) - Number(y) || (x < y ? -1 : 1);
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}
function compareEntries(a, b) {
  return a.attempt - b.attempt || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || naturalCompare(a.path, b.path);
}
function cell(text2) {
  return text2.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[/g, "&#91;").replace(/\]/g, "&#93;").trim();
}
function provenanceLabel(provenance) {
  return provenance === "live" ? "" : ` (${provenance})`;
}
function stepOf(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? m[1] : null;
}
function caption(e, showAttempt, extra = "") {
  const device = e.device ? ` (${e.device})` : "";
  const step = e.kind === "step" ? `, step ${stepOf(e.path) ?? "?"}` : "";
  const video = e.kind === "video" ? ", video" : "";
  const attempt = showAttempt ? `, attempt ${e.attempt}` : "";
  return cell(`${e.leg} on ${e.target}${device}${step}${video}${attempt}${extra}${provenanceLabel(e.provenance)}`);
}
function embed(e, shot) {
  const what = shot ? `${shot.screen} ${shot.state}` : e.row;
  const step = e.kind === "step" ? ` step ${stepOf(e.path) ?? "?"}` : "";
  return `![${altText(`${e.leg} ${what}${step}${e.kind === "video" ? " video" : ""}`)}](${e.path})`;
}
function resultText(r) {
  if (!r) return "no result";
  const attempts = `${r.attempts} attempt${r.attempts === 1 ? "" : "s"}`;
  const reason = r.reason ? `: ${cell(r.reason)}` : "";
  if (r.status === "passed") return `passed, ${attempts}`;
  if (r.status === "failed") return `failed (${r.failures.join(", ") || "no failure named"}), ${attempts}${reason}`;
  return `${r.status === "n/a" ? "n/a" : "not run"}${reason}`;
}
function rowFiles(entries, shot, sizeOf, multiAttempt) {
  const out = [];
  const portraits = [];
  const links = [];
  for (const e of entries) {
    const showAttempt = multiAttempt.has(pairKey(e.row, e.leg));
    if (STILL.has(e.kind)) {
      const size2 = sizeOf(e.path);
      if (size2 && size2.width <= size2.height) {
        portraits.push(e);
        continue;
      }
      out.push(caption(e, showAttempt, size2 ? "" : ", shape unknown"), "", embed(e, shot), "");
    } else if (e.kind === "video") {
      out.push(caption(e, showAttempt), "", embed(e, shot), "");
    } else {
      links.push(e);
    }
  }
  for (let i = 0; i < portraits.length; i += PER_ROW) {
    const group = portraits.slice(i, i + PER_ROW);
    const heads = [];
    const cells = [];
    for (let j = 0; j < PER_ROW; j += 1) {
      const e = group[j];
      heads.push(e ? caption(e, multiAttempt.has(pairKey(e.row, e.leg))) : "");
      cells.push(e ? embed(e, shot) : "");
    }
    out.push(`| ${heads.join(" | ")} |`, `|${"---|".repeat(PER_ROW)}`, `| ${cells.join(" | ")} |`, "");
  }
  if (links.length > 0) {
    const items = links.map((e) => {
      const attempt = multiAttempt.has(pairKey(e.row, e.leg)) ? ` attempt ${e.attempt}` : "";
      return `[${altText(`${e.leg} ${LINKED[e.kind] ?? e.kind}${attempt}`)}](${e.path})`;
    });
    out.push(`Files: ${items.join(", ")}.`, "");
  }
  return out;
}
function plannedPairs(manifest) {
  return manifest.shots.flatMap((shot) => shot.legs.map((leg) => ({ shot, leg })));
}
function evidenceSection(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const multiAttempt = /* @__PURE__ */ new Set();
  for (const e of input.entries) if (e.attempt > 1) multiAttempt.add(pairKey(e.row, e.leg));
  for (const r of latest.values()) if (r.attempts > 1) multiAttempt.add(pairKey(r.row, r.leg));
  const out = [
    "The runner writes this part from the ledger. `lw qa report check` renders it again and refuses an edit.",
    "A label in parentheses names a provenance other than live.",
    ""
  ];
  const counts = { passed: 0, failed: 0, na: 0, notRun: 0, none: 0 };
  const planned = /* @__PURE__ */ new Set();
  for (const shot of input.manifest.shots) {
    out.push(`### ${cell(shot.screen)}, ${cell(shot.state)}`, "");
    out.push(`Row \`${shot.id}\`. Route \`${cell(shot.route).replace(/`/g, "%60")}\`. Expect: ${cell(expectText(shot))}`, "");
    for (const leg of shot.legs) {
      planned.add(pairKey(shot.id, leg));
      const r = latest.get(pairKey(shot.id, leg));
      if (!r) counts.none += 1;
      else if (r.status === "passed") counts.passed += 1;
      else if (r.status === "failed") counts.failed += 1;
      else if (r.status === "n/a") counts.na += 1;
      else counts.notRun += 1;
      out.push(`- \`${leg}\`: ${resultText(r)}`);
    }
    out.push("");
    const files = input.entries.filter((e) => e.row === shot.id && shot.legs.includes(e.leg)).sort((a, b) => shot.legs.indexOf(a.leg) - shot.legs.indexOf(b.leg) || compareEntries(a, b));
    out.push(...rowFiles(files, shot, input.sizeOf, multiAttempt));
  }
  const outside = input.entries.filter((e) => !planned.has(pairKey(e.row, e.leg))).sort((a, b) => naturalCompare(a.row, b.row) || naturalCompare(a.leg, b.leg) || compareEntries(a, b));
  if (outside.length > 0) {
    out.push("### Files outside the plan", "", "These ledger files belong to no planned row and leg.", "");
    out.push(...rowFiles(outside, null, input.sizeOf, multiAttempt));
  }
  const pairs = counts.passed + counts.failed + counts.na + counts.notRun + counts.none;
  out.push(
    `Totals: ${input.manifest.shots.length} rows, ${pairs} row legs, ${counts.passed} passed, ${counts.failed} failed, ${counts.na} n/a, ${counts.notRun} not run, ${counts.none} with no result.`
  );
  return out.join("\n");
}
function coverageSection(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const out = [];
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const r = latest.get(pairKey(shot.id, leg));
    if (r && r.status !== "passed") out.push(`- \`${shot.id}\` on \`${leg}\`: ${resultText(r)}`);
  }
  const world2 = input.world ?? [];
  if (world2.length > 0) {
    const covered = coveredStates(input);
    const open = world2.filter((w) => !covered.has(w.id));
    if (out.length > 0) out.push("");
    out.push(`${world2.length - open.length} of ${world2.length} world states have a passed row with evidence.`);
    if (open.length > 0) {
      out.push("", "| State | Feature | Why it has no evidence |", "|---|---|---|");
      for (const w of open) {
        const named2 = input.manifest.shots.some((s) => s.fixture.persona === w.id || (s.fixture.facts ?? []).includes(w.id));
        out.push(`| \`${w.id}\` | ${cell(w.feature ?? "")} | ${named2 ? "a row names it and no leg passed" : "no row names it"} |`);
      }
    }
  }
  if (out.length === 0) out.push("Every planned row and leg ran and passed.");
  return out.join("\n");
}
function coveredStates(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const out = /* @__PURE__ */ new Set();
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const key = pairKey(shot.id, leg);
    if (latest.get(key)?.status !== "passed" || !withFiles.has(key)) continue;
    if (shot.fixture.persona) out.add(shot.fixture.persona);
    for (const f of shot.fixture.facts ?? []) out.add(f);
  }
  return out;
}
function legsLine(manifest, results) {
  const legs = [];
  for (const shot of manifest.shots) for (const leg of shot.legs) if (!legs.includes(leg)) legs.push(leg);
  const latest = /* @__PURE__ */ new Map();
  for (const r of results) latest.set(pairKey(r.row, r.leg), r);
  const ran = [];
  const not = [];
  for (const leg of legs) {
    const rs = manifest.shots.filter((s) => s.legs.includes(leg)).map((s) => latest.get(pairKey(s.id, leg)));
    if (rs.some((r) => r?.status === "passed" || r?.status === "failed")) ran.push(leg);
    else {
      const reason = rs.find((r) => r?.reason)?.reason;
      not.push(`${leg} (${reason ? cell(reason) : rs.every((r) => !r) ? "no result" : "not run"})`);
    }
  }
  return [ran.length > 0 ? ran.join(", ") : "none ran", not.length > 0 ? `not run: ${not.join(", ")}` : ""].filter(Boolean).join("; ");
}
function coverageLine(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const pairs = plannedPairs(input.manifest);
  const passed = pairs.filter(({ shot, leg }) => latest.get(pairKey(shot.id, leg))?.status === "passed" && withFiles.has(pairKey(shot.id, leg))).length;
  const base = `${passed} of ${pairs.length} row legs passed with evidence`;
  const world2 = input.world ?? [];
  if (world2.length === 0) return base;
  const covered = coveredStates(input);
  return `${base}, ${world2.filter((w) => covered.has(w.id)).length} of ${world2.length} world states`;
}
var EVIDENCE_START, EVIDENCE_END, COVERAGE_START, COVERAGE_END, trimSlash, KIND_ORDER, STILL, LINKED, PER_ROW, altText, NOT_COVERED_LINE;
var init_evidence = __esm({
  "src/services/evidence.mts"() {
    "use strict";
    init_cjs_shims();
    init_ledger();
    init_manifest2();
    init_png();
    init_video();
    EVIDENCE_START = "<!-- qa:evidence:start -->";
    EVIDENCE_END = "<!-- qa:evidence:end -->";
    COVERAGE_START = "<!-- qa:coverage:start -->";
    COVERAGE_END = "<!-- qa:coverage:end -->";
    trimSlash = (p) => p.length > 1 ? p.replace(/\/+$/, "") : p;
    KIND_ORDER = { screenshot: 0, step: 1, video: 2, trace: 3, log: 4, ui: 5 };
    STILL = /* @__PURE__ */ new Set(["screenshot", "step"]);
    LINKED = { trace: "trace", log: "log", ui: "UI dump" };
    PER_ROW = 2;
    altText = (text2) => cell(text2).replace(/[[\]]/g, "");
    NOT_COVERED_LINE = /^- `([a-z0-9-]+\.[a-z0-9-]+)` on `([a-z0-9-]+)`: (.*\S.*)$/;
  }
});

// src/states-host/names.mts
var QA_DEV_MARKER, QA_STATES_PATH, QA_STATES_ATTRIBUTE;
var init_names = __esm({
  "src/states-host/names.mts"() {
    "use strict";
    init_cjs_shims();
    QA_DEV_MARKER = "lw-qa-dev-only";
    QA_STATES_PATH = "/__states";
    QA_STATES_ATTRIBUTE = "data-qa-states";
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
function statesDir(slug3) {
  return `assets/${slug3}/states`;
}
function statePath(slug3, captureId, which, ext = "png") {
  return `${statesDir(slug3)}/${captureId}.${which}.${ext}`;
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
function cleanLabel(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
}
function chooseEdges(controls, max = MAX_EDGES_PER_NODE) {
  const all = controls ?? [];
  if (all.length <= max) return [...all];
  const stride = all.length / max;
  const picked = [];
  for (let i = 0; i < max; i += 1) picked.push(all[Math.floor(i * stride)]);
  return picked;
}
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
function isRoutePattern(route) {
  return String(route).split("/").some((segment) => segment.startsWith(":"));
}
function specificity(pattern) {
  const segments = pattern.split("/").filter((s) => s !== "");
  const optional = segments.filter((s) => s.startsWith(":") && s.endsWith("?")).length;
  const required2 = segments.filter((s) => s.startsWith(":") && !s.endsWith("?")).length;
  return [segments.length - optional - required2, required2, -optional];
}
function bestRoute(routes, pathname) {
  let best = null;
  let rank = null;
  for (const route of routes) {
    if (!routeMatches(route, pathname)) continue;
    const own = specificity(route);
    const wins = rank === null || own[0] > rank[0] || own[0] === rank[0] && (own[1] > rank[1] || own[1] === rank[1] && own[2] > rank[2]);
    if (wins) {
      best = route;
      rank = own;
    }
  }
  return best;
}
function openRoute(pattern) {
  const kept = [];
  for (const segment of pattern.split("/")) {
    if (segment.startsWith(":") && segment.endsWith("?")) continue;
    if (segment.startsWith(":")) return null;
    kept.push(segment);
  }
  const route = kept.join("/");
  return route === "" ? "/" : route;
}
function reachedTarget(targets, surface, route) {
  const mine = targets.filter((t) => t.surface === surface).map((t) => t.route);
  if (mine.includes(route)) return route;
  return isRoutePattern(route) ? null : bestRoute(mine, route);
}
function targetsFrom(delivery) {
  const byKey = /* @__PURE__ */ new Map();
  for (const union of delivery?.unions ?? []) {
    const name = union.union ?? union.name ?? "";
    for (const row of union.routes ?? []) {
      const key = `${row.surface} ${row.route}`;
      const seen = byKey.get(key);
      if (seen) {
        if (!seen.unions.includes(name)) seen.unions.push(name);
        continue;
      }
      byKey.set(key, { surface: row.surface, route: row.route, page: row.page ?? null, dynamic: Boolean(row.dynamic), unions: [name] });
    }
  }
  return [...byKey.values()].sort((a, b) => a.surface.localeCompare(b.surface) || a.route.localeCompare(b.route));
}
function pathId(path) {
  const slug3 = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "root";
  const tail = (path.steps ?? []).map((s) => slug3(s.label)).join(".");
  return [path.leg, slug3(path.from), tail].filter(Boolean).join(".");
}
function formatPath(path) {
  const steps = (path.steps ?? []).map((s) => `"${s.label}"`);
  const ends = path.route ?? path.steps?.at(-1)?.route ?? path.from;
  return [path.from, ...steps, ends].join(" -> ");
}
function crossReach(targets, paths) {
  const rows = targets.map((target) => {
    const reached = paths.filter((p) => p.surface === target.surface && p.route !== void 0 && reachedTarget(targets, p.surface, p.route) === target.route);
    return { ...target, reached: reached.length > 0, by: reached.map((e) => e.id) };
  });
  const unionState = /* @__PURE__ */ new Map();
  for (const row of rows) for (const union of row.unions) unionState.set(union, (unionState.get(union) ?? false) || row.reached);
  return {
    routes: rows,
    unions: [...unionState.entries()].map(([union, reachable]) => ({ union, reachable })).sort((a, b) => a.union.localeCompare(b.union)),
    unreachable: [...unionState.entries()].filter(([, reachable]) => !reachable).map(([union]) => union).sort()
  };
}
function routeDrift(targets, paths) {
  return paths.filter((p) => p.route !== void 0 && reachedTarget(targets, p.surface, p.route) === null).map((p) => ({ id: p.id, route: p.route }));
}
function videoRecord(args) {
  const { kind, file, provenance, device, seconds, marks = [], steps = [] } = args;
  if (!VIDEO_KINDS.includes(kind)) return { ok: false, reason: "crashed", error: `unknown video kind ${kind}` };
  if (!PROVENANCE.includes(provenance)) {
    return { ok: false, reason: "unlabelled-video", error: `provenance must be one of ${PROVENANCE.join(", ")}` };
  }
  if (kind === "path" && provenance !== "live") return { ok: false, reason: "unlabelled-video", error: "a path video is live by construction: real taps, real data" };
  if (kind === "state" && provenance === "live") return { ok: false, reason: "unlabelled-video", error: "a state video is mounted or intercepted, never live" };
  if (!device) return { ok: false, reason: "no-serial", error: "a video names the device it was taken on" };
  return { ok: true, kind, file, provenance, device, seconds, marks, steps };
}
function controlsExpression() {
  return `(() => {
  const out = [];
  for (const el of Array.from(document.querySelectorAll(${JSON.stringify(CONTROL_SELECTOR)}))) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim();
    if (name === '') continue;
    out.push({ label: name, role: el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button') });
  }
  return out;
})()`;
}
function clickByNameExpression(label, role) {
  return `(() => {
  const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim().slice(0, ${MAX_LABEL});
  const want = norm(${JSON.stringify(String(label))});
  const wantRole = ${JSON.stringify(String(role))};
  const before = window.location.pathname;
  for (const el of Array.from(document.querySelectorAll(${JSON.stringify(CONTROL_SELECTOR)}))) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    const r = el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button');
    if (r !== wantRole) continue;
    const name = norm(el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '');
    if (name !== want) continue;
    el.click();
    return { ok: true, before };
  }
  return { ok: false, error: 'no ' + wantRole + ' called ' + JSON.stringify(want) + ' on ' + before };
})()`;
}
function normaliseControls(raw) {
  const seen = /* @__PURE__ */ new Set();
  const controls = [];
  for (const c of raw) {
    const label = cleanLabel(c.label);
    const role = String(c.role ?? "button");
    if (label === "" || seen.has(`${role} ${label}`)) continue;
    seen.add(`${role} ${label}`);
    controls.push({ label, role });
  }
  return controls.sort((a, b) => a.label.localeCompare(b.label) || a.role.localeCompare(b.role));
}
function pathsDir(slug3) {
  return `assets/${slug3}/paths`;
}
function videoPath(slug3, id, leg, ext) {
  return `${pathsDir(slug3)}/${id}.${leg}.${ext}`;
}
function stamp(ms) {
  const total = Math.max(0, Math.round(ms / 1e3));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function budgetCheck(args) {
  const limitMs = args.seconds * 1e3;
  const over = args.steps.find((s) => (s.atMs ?? 0) > limitMs);
  if (!over) return { ok: true };
  return { ok: false, reason: "over-budget", error: `the recorder stopped at ${stamp(limitMs)} and the path was still on "${over.label}" at ${stamp(over.atMs ?? 0)}` };
}
function buildCrawlPlan(args) {
  return {
    slug: args.slug,
    leg: args.leg,
    surface: args.surface,
    root: args.root ?? "/",
    maxDepth: MAX_DEPTH,
    maxEdges: MAX_EDGES_PER_NODE,
    targets: args.targets.filter((t) => t.surface === args.surface),
    settle: args.settle ?? CLICK_SETTLE,
    stepTimeoutMs: args.stepTimeoutMs ?? STEP_TIMEOUT_MS
  };
}
function resolveRoute(landed, targets) {
  return bestRoute(
    targets.map((t) => t.route),
    landed
  );
}
function targetResults(plan2, paths, error) {
  const cross = crossReach(
    plan2.targets,
    paths.map((p) => ({ id: p.id, route: p.route, surface: plan2.surface }))
  );
  return cross.routes.map((row) => ({
    route: row.route,
    unions: row.unions,
    reached: row.reached,
    by: row.by,
    ...error !== void 0 && !row.reached ? { error } : {}
  }));
}
async function withinStep(ms, what, work, late) {
  let timer;
  const bound = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeout("qa.paths.step-timeout", `${what} took longer than ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, bound]);
  } catch (err) {
    if (err instanceof StepTimeout) work.then(void 0, late);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
function requireEvaluate(session2) {
  if (!session2.evaluate) {
    throw new LaunchwrightError("qa.paths.evaluate", "The target cannot evaluate in the page, so the crawl cannot list or press controls. Use a browser or WebView target.");
  }
  return session2.evaluate.bind(session2);
}
async function settleSoft(session2, rule) {
  try {
    await session2.settle(rule);
    return null;
  } catch (err) {
    if (isCodedError(err) && err.code === "qa.target.settle") return firstLine(err);
    throw err;
  }
}
async function followEdge(session2, control, before, settle) {
  const evaluate = requireEvaluate(session2);
  const pressed = await evaluate(clickByNameExpression(control.label, control.role));
  if (!pressed.ok) return { moved: false, landed: before, settled: null, ...pressed.error === void 0 ? {} : { error: pressed.error } };
  const settled = await settleSoft(session2, settle);
  const landed = pathnameOf(await session2.currentRoute());
  return { moved: landed !== before, landed, settled };
}
async function crawl(session2, plan2) {
  const evaluate = requireEvaluate(session2);
  const found = [];
  const failures = [];
  const rootTarget = resolveRoute(plan2.root, plan2.targets);
  const visited = /* @__PURE__ */ new Set([plan2.root, ...rootTarget === null ? [] : [rootTarget]]);
  const halt = { why: null };
  const attempt = async (route, label, kind, work) => {
    const where = label === void 0 ? `open ${route}` : `press "${label}" on ${route}`;
    const at = { route, ...label === void 0 ? {} : { label } };
    try {
      return await withinStep(plan2.stepTimeoutMs, where, work(), (late) => failures.push({ ...at, kind: "timeout", error: `after the bound: ${firstLine(late)}` }));
    } catch (err) {
      const closed = session2.isClosed?.() === true;
      failures.push({ ...at, kind: closed ? "closed" : err instanceof StepTimeout ? "timeout" : kind, error: firstLine(err) });
      if (closed) halt.why = `the browser closed during ${where}: ${firstLine(err)}`;
      return null;
    }
  };
  const openPage = async (route) => {
    await session2.navigate(route);
    const settled = await settleSoft(session2, plan2.settle);
    if (settled !== null) failures.push({ route, kind: "settle", error: settled });
    return pathnameOf(await session2.currentRoute());
  };
  let frontier = [{ open: plan2.root, steps: [] }];
  for (let depth = 0; depth < plan2.maxDepth && frontier.length > 0 && halt.why === null; depth += 1) {
    const next = [];
    for (const node of frontier) {
      if (halt.why !== null) break;
      const controls = await attempt(node.open, void 0, "navigate", async () => {
        await openPage(node.open);
        return chooseEdges(normaliseControls(await evaluate(controlsExpression())), plan2.maxEdges);
      });
      if (controls === null && depth === 0) halt.why ??= `${plan2.root} did not open: ${failures.at(-1)?.error ?? "no reason given"}`;
      for (const control of controls ?? []) {
        if (halt.why !== null) break;
        const edge = await attempt(node.open, control.label, "press", async () => {
          const from = await openPage(node.open);
          return { from, ...await followEdge(session2, control, from, plan2.settle) };
        });
        if (edge === null) continue;
        if (edge.settled !== null) failures.push({ route: edge.from, label: control.label, kind: "settle", error: edge.settled });
        if (!edge.moved) continue;
        const resolved = resolveRoute(edge.landed, plan2.targets);
        const route = resolved ?? edge.landed;
        if (visited.has(route)) continue;
        visited.add(route);
        const steps = [...node.steps, { label: control.label, role: control.role, route }];
        const path = { leg: plan2.leg, from: plan2.root, steps, route };
        found.push({ id: pathId(path), leg: plan2.leg, from: plan2.root, route, landed: edge.landed, resolved: resolved !== null, steps, readable: formatPath(path), depth: depth + 1 });
        next.push({ open: edge.landed, steps });
      }
    }
    frontier = next;
  }
  return { paths: found, visited: [...visited], failures, targets: targetResults(plan2, found, halt.why ?? void 0) };
}
async function recordPath(session2, args) {
  const settle = args.settle ?? CLICK_SETTLE;
  const steps = [];
  await session2.navigate(args.root);
  let current = pathnameOf(await session2.currentRoute());
  await session2.startVideo(args.file);
  const startedAt = args.now();
  let driveError = null;
  let file = args.file;
  try {
    for (const step of args.path.steps) {
      const { moved, landed, error } = await followEdge(session2, step, current, settle);
      steps.push({ label: step.label, role: step.role, route: landed, atMs: args.now() - startedAt });
      if (!moved) {
        driveError = error ?? `"${step.label}" no longer navigates`;
        break;
      }
      current = landed;
    }
  } finally {
    file = (await session2.stopVideo()).path;
  }
  const budget = budgetCheck({ steps, seconds: args.capS });
  if (!budget.ok) return { ...budget, file, steps };
  if (driveError !== null) return { ok: false, reason: "state-mismatch", error: driveError, file, steps };
  const seconds = (args.now() - startedAt) / 1e3;
  return videoRecord({ kind: "path", file, provenance: "live", device: args.device, seconds, steps, marks: steps.map((s) => `${stamp(s.atMs ?? 0)}  ${s.label}`) });
}
var MAX_DEPTH, MAX_EDGES_PER_NODE, CONTROL_SELECTOR, MAX_LABEL, VIDEO_KINDS, CLICK_SETTLE, STEP_TIMEOUT_MS, pathnameOf, StepTimeout, firstLine;
var init_paths = __esm({
  "src/services/paths.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_inventory();
    MAX_DEPTH = 3;
    MAX_EDGES_PER_NODE = 12;
    CONTROL_SELECTOR = 'button, a, [role="button"], [role="link"], [role="tab"]';
    MAX_LABEL = 60;
    VIDEO_KINDS = ["path", "state"];
    CLICK_SETTLE = { busy: true, timeout: 4e3 };
    STEP_TIMEOUT_MS = 3e4;
    pathnameOf = (route) => route.replace(/[?#].*$/, "") || "/";
    StepTimeout = class extends LaunchwrightError {
    };
    firstLine = (err) => (err instanceof Error ? err.message : String(err)).split("\n")[0] ?? "";
  }
});

// src/states/services/solve.mts
function canonical2(obj) {
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
    const key = canonical2(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    const { changes: changes2, text: text2 } = describeCandidate(candidate, base);
    plan2.push({ candidate, base, baseIndex, changes: changes2, text: text2 });
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
  const changes2 = [];
  for (const field of names) {
    const had = Object.hasOwn(corpusEntry, field) && corpusEntry[field] !== void 0;
    const has = Object.hasOwn(candidate, field) && candidate[field] !== void 0;
    if (!had && !has) continue;
    if (had && has && same(corpusEntry[field], candidate[field])) continue;
    changes2.push({ field, from: had ? corpusEntry[field] : ABSENT, to: has ? candidate[field] : ABSENT });
  }
  const text2 = changes2.length === 0 ? "unchanged from the corpus entry" : changes2.map((c) => `${c.field}: ${show(c.from)} -> ${show(c.to)}`).join(", ");
  return { changes: changes2, text: text2 };
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
async function installSubstitution(page2, spec) {
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
  await page2.route(spec.url, handler);
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
      await page2.unroute(spec.url, handler);
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
async function snapshotTree(page2, options = {}) {
  return await page2.evaluate(snapshotExpression(options.root ?? DEFAULT_DIFF_ROOT, options.ignoreAttributes ?? [], options.maxNodes ?? MAX_TREE_NODES));
}
function diffNodes(a, b) {
  const out = [];
  const walk5 = (x, y, path) => {
    if (x.self !== y.self || x.children.length !== y.children.length) {
      out.push(path);
      return;
    }
    for (let i = 0; i < x.children.length; i += 1) walk5(x.children[i], y.children[i], [...path, i]);
  };
  walk5(a, b, []);
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
  return `/@fs${import_node_path9.posix.join(projectRoot2.split("\\").join("/"), relativePath)}`;
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
async function evaluateBatch(page2, projectRoot2, spec, batch) {
  const answers = await page2.evaluate(evaluateBatchExpression(moduleUrl(projectRoot2, spec.module), spec.export, batch, spec.args ?? []));
  if (!Array.isArray(answers) || answers.length !== batch.length) {
    throw new CaptureFailure("crashed", `${spec.export}: the page answered ${Array.isArray(answers) ? answers.length : typeof answers} result(s) for ${batch.length} candidate(s)`);
  }
  return answers;
}
async function verifyInPage(page2, projectRoot2, spec, subject) {
  const [answer2] = await evaluateBatch(page2, projectRoot2, spec, [subject]);
  if (!answer2 || answer2.error !== null) throw new CaptureFailure("crashed", `${spec.export} threw on the injected subject: ${answer2?.error ?? "no answer"}`);
  return answer2.state ?? "null";
}
async function solveWithPage(page2, projectRoot2, args) {
  const { verify, shape, members = null, union, limit, pivots } = args;
  const corpus = [...args.corpus];
  const batchSize = args.batchSize ?? DEFAULT_EVALUATE_BATCH;
  const options = { ...limit === void 0 ? {} : { limit }, ...pivots === void 0 ? {} : { pivots } };
  const plan2 = candidatePlan(shape, corpus, options);
  const memo = /* @__PURE__ */ new Map();
  let batches = 0;
  for (let i = 0; i < plan2.length; i += batchSize) {
    const slice = plan2.slice(i, i + batchSize);
    const answers = await evaluateBatch(page2, projectRoot2, verify, slice.map((step) => step.candidate));
    batches += 1;
    for (const [j, answer2] of answers.entries()) {
      const step = slice[j];
      if (!step) continue;
      if (answer2.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on a candidate its type admits (${step.text}): ${answer2.error}`);
      memo.set(canonical2(step.candidate), answer2.state);
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
      const key = canonical2(candidate);
      if (memo.has(key)) return memo.get(key) ?? null;
      memoMisses += 1;
      const [answer2] = await evaluateBatch(page2, projectRoot2, verify, [candidate]);
      if (!answer2 || answer2.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on a candidate: ${answer2?.error ?? "no answer"}`);
      memo.set(key, answer2.state);
      return answer2.state;
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
async function resolvePivots(page2, projectRoot2, hints, options = {}) {
  const resolved = {};
  const unresolved = {};
  const declaredArgs = options.verify?.args ?? [];
  const modules = [.../* @__PURE__ */ new Set([...options.verify ? [options.verify.module] : [], ...options.modules ?? []])];
  const bodies = options.bodies ?? [];
  const params = options.verify !== void 0 && hints.names.length > 0 ? await page2.evaluate(parameterNamesExpression(moduleUrl(projectRoot2, options.verify.module), options.verify.export)) : [];
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
      const answer2 = await page2.evaluate(exportedNumberExpression(moduleUrl(projectRoot2, rel), name));
      if (answer2.error !== void 0) importErrors.push(`${rel}: ${answer2.error}`);
      if (typeof answer2.value === "number") {
        fromModule = answer2.value;
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
async function solveGroupSubjects(page2, projectRoot2, group, corpus, bodies) {
  if (group.solve === void 0) throw new CaptureFailure("blocked", `${group.id}: the group has no solve block`);
  const { verify } = group;
  const pivots = await resolvePivots(page2, projectRoot2, group.solve.pivots ?? { literals: [], names: [] }, {
    verify,
    ...group.solve.pivotModules ? { modules: group.solve.pivotModules } : {},
    bodies
  });
  const members = group.members.map((m) => m.member ?? "null");
  const report3 = await solveWithPage(page2, projectRoot2, {
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
    covered: report3.result.covered,
    members,
    evaluate: async (candidate) => {
      const [answer2] = await evaluateBatch(page2, projectRoot2, verify, [candidate]);
      if (!answer2 || answer2.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on an anchored candidate: ${answer2?.error ?? "no answer"}`);
      return answer2.state;
    }
  });
  const unresolvedNames = Object.values(pivots.unresolved);
  const subjectFor = [];
  const unreachable2 = /* @__PURE__ */ new Map();
  for (const [i, name] of members.entries()) {
    const hit = report3.result.covered[name];
    if (hit === void 0) {
      subjectFor.push(null);
      const why = report3.result.sentence ?? `${group.union}: ${name} was not produced by any candidate`;
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
    report: report3
  };
}
async function renderOnce(session2, group, substitution, subjects) {
  if (subjects === null) substitution.record();
  else substitution.use(subjects);
  await session2.navigate(openRoute(group.route) ?? group.route);
  for (const step of group.act ?? []) await session2.act(step);
  await session2.settle(group.settle);
  const held = await session2.currentRoute();
  if (!routeMatches(group.route, held)) {
    throw new CaptureFailure("blocked", `the page left ${group.route} for ${held}, so a picture would be of another screen`);
  }
  substitution.assertApplied();
}
async function prepare(session2, page2, group, ctx) {
  const diffRoot = group.diffRoot ?? DEFAULT_DIFF_ROOT;
  const snapshotOptions = { root: diffRoot, ignoreAttributes: group.ignoreAttributes ?? [] };
  const notes = [];
  const substitution = await installSubstitution(page2, group.intercept);
  try {
    let subjectFor;
    let unreachable2 = /* @__PURE__ */ new Map();
    let fieldsTried = [];
    if (group.solve === void 0) {
      subjectFor = group.members.map((m) => isPlainObject3(m.subject) ? m.subject : null);
    } else {
      await renderOnce(session2, group, substitution, null);
      const solved = await solveGroupSubjects(page2, ctx.projectRoot, group, substitution.corpus, substitution.bodies);
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
    await renderOnce(session2, group, substitution, contrast);
    const before = await snapshotTree(page2, snapshotOptions);
    await renderOnce(session2, group, substitution, subjects);
    const tree = await snapshotTree(page2, snapshotOptions);
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
async function captureGroup(session2, page2, group, ctx) {
  const started = ctx.now();
  let prepared;
  try {
    prepared = await prepare(session2, page2, group, ctx);
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
  const root = page2.locator(diffRoot).first();
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
      const answered = await verifyInPage(page2, ctx.projectRoot, group.verify, subjectFor[i]);
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
      const subject = page2.locator(pathSelector(diffRoot, path)).first();
      await assertSubjectIsolated(subject, root, maxRatio);
      await subject.scrollIntoViewIfNeeded();
      const context = statePath(ctx.slug, member.id, "context");
      const subjectFile = statePath(ctx.slug, member.id, "subject");
      await session2.screenshot(import_node_path9.posix.join(ctx.reportDir, context));
      await subject.screenshot({ path: import_node_path9.posix.join(ctx.reportDir, subjectFile) });
      await ctx.record({ file: import_node_path9.posix.join(ctx.reportDir, context), kind: "screenshot", row: member.id });
      await ctx.record({ file: import_node_path9.posix.join(ctx.reportDir, subjectFile), kind: "screenshot", row: member.id });
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
var import_node_path9, MAX_TREE_NODES, DEFAULT_MAX_SUBJECT_AREA_RATIO, DEFAULT_DIFF_ROOT, MAX_CORPUS, MAX_BODIES, DEFAULT_EVALUATE_BATCH, CaptureFailure, isPlainObject3, STALE_HEADERS;
var init_capture = __esm({
  "src/states/services/capture.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path9 = require("path");
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
    persona: hints.fixture?.persona ?? null,
    refusal: null
  };
  const refuse2 = (refusal) => ({ ...base, refusal });
  if (union === void 0) return refuse2(new CaptureFailure("blocked", `the inventory has no union named ${capture.union}`));
  if (union.kind !== "input" && union.kind !== "both") {
    return refuse2(new CaptureFailure("blocked", `${union.name} is "${union.kind}", and a mount reaches an input`));
  }
  const site = siteFor(union, hints);
  if (site === null) return refuse2(new CaptureFailure("blocked", `${union.name} says it is an input and the scan found no field that holds it`));
  const component = hints.component ?? site.component;
  if (component === null) {
    const where = union.inputs.map((s) => `${s.interface}.${s.field} (${s.file})`).join(", ");
    return refuse2(
      new CaptureFailure(
        "unmountable",
        `no component takes ${union.name}: it is a field of ${where}, and none of those is the props type of a component. Give the component that branches on it a prop of type ${union.name}`,
        { missingProp: `${site.interface}.${site.field} (no component takes this union)` }
      )
    );
  }
  if (capture.member === null) {
    return refuse2(
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
async function harnessState(session2) {
  if (!session2.evaluate) return null;
  return await session2.evaluate(harnessStateExpression());
}
function expectation(r) {
  const extra = Object.keys(r.props).filter((key) => key !== r.field);
  return `${r.component} drawn with ${r.field}="${r.capture.member}"${extra.length === 0 ? "" : ` (plus ${extra.join(", ")})`}`;
}
async function captureMounted(session2, r, ctx) {
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
    if (!session2.evaluate) {
      throw new CaptureFailure("blocked", "the target cannot evaluate in the page, so it cannot prove that the page is the state harness");
    }
    const url = mountUrl({ component: r.component, props: r.props, width: r.width });
    await session2.navigate(url);
    try {
      await session2.settle(r.settle);
    } catch (e) {
      const late = await harnessState(session2);
      if (late?.error) throw new CaptureFailure("unmountable", `${r.component} did not mount: ${late.error}`, { missingProp: condense(late.error) }, e);
      if (late && !late.harness) throw new CaptureFailure("blocked", `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`, {}, e);
      throw e;
    }
    const state = await harnessState(session2);
    if (!state?.harness) {
      throw new CaptureFailure("blocked", `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`);
    }
    if (state.error) throw new CaptureFailure("unmountable", `the harness refused ${url}: ${state.error}`, { missingProp: condense(state.error) });
    if (state.roots === 0) throw new CaptureFailure("crashed", `${r.component} mounted and drew no element`);
    const held = await session2.currentRoute();
    if (!held.startsWith(STATES_HARNESS_PATH)) throw new CaptureFailure("blocked", `the page left the harness for ${held}`);
    const subject = statePath(ctx.slug, r.capture.id, "subject");
    await session2.screenshot(import_node_path10.posix.join(ctx.reportDir, subject));
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
var DB_PEER, loadDb, optionalDb, HTTP_PEER, optionalHttp, loadAuth, loadStorage, loadDev, loadTunnel;
var init_peers2 = __esm({
  "src/services/peers.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    DB_PEER = "@launchwrighthq/db";
    loadDb = () => loadPeer(DB_PEER, "db");
    optionalDb = () => peerOrUndefined(DB_PEER);
    HTTP_PEER = "@launchwrighthq/http";
    optionalHttp = () => peerOrUndefined(HTTP_PEER);
    loadAuth = () => loadPeer("@launchwrighthq/auth", "auth");
    loadStorage = () => loadPeer("@launchwrighthq/storage", "storage");
    loadDev = () => loadPeer("@launchwrighthq/dev", "dev");
    loadTunnel = () => loadPeer("@launchwrighthq/tunnel", "tunnel");
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
  return (0, import_node_path11.resolve)(root, PGLITE_DIR, checkIdentifier(name));
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
    const dir = (0, import_node_path11.isAbsolute)(db.dataDir) ? db.dataDir : (0, import_node_path11.resolve)(root, db.dataDir);
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
function guard(allowed2, name, what) {
  checkIdentifier(name);
  if (!allowed2(name)) throw new LaunchwrightError("qa.stack.guard", `Refusing to ${what} database ${name}: lw qa may not touch it.`, { context: { database: name } });
  return name;
}
function quoted(name) {
  return `"${checkIdentifier(name)}"`;
}
async function pgAdmin(url, allowed2, connect2 = dbModuleConnect) {
  const remote = remoteHostProblem(url);
  if (remote) throw new LaunchwrightError("qa.stack.host", `Refusing: ${remote}.`, { context: { host: hostOfUrl(url) } });
  const db = await connect2(urlWithDatabase(url, MAINTENANCE_DATABASE));
  const names = async () => {
    const result = await db.execute("select datname from pg_database where not datistemplate");
    return result.rows.map((r) => r.datname);
  };
  return {
    exists: async (name) => (await names()).includes(checkIdentifier(name)),
    async create(name, template) {
      guard(allowed2, name, "create");
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
      guard(allowed2, name, "drop");
      await db.execute(
        `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${checkIdentifier(name)}' and usename = current_user and pid <> pg_backend_pid()`
      );
      await db.execute(`drop database if exists ${quoted(name)}`);
    },
    list: async (prefix) => (await names()).filter((n) => n.startsWith(prefix)).sort(),
    close: () => db.close()
  };
}
function pgliteAdmin(root, allowed2) {
  const dir = (0, import_node_path11.resolve)(root, PGLITE_DIR);
  return {
    async exists(name) {
      return await pathKind(pgliteDir(root, name)) === "dir";
    },
    async create(name, template) {
      guard(allowed2, name, "create");
      if (template === void 0) await (0, import_promises6.mkdir)(pgliteDir(root, name), { recursive: true });
      else await (0, import_promises6.cp)(pgliteDir(root, template), pgliteDir(root, name), { recursive: true, errorOnExist: true, force: false });
    },
    async drop(name) {
      guard(allowed2, name, "drop");
      await (0, import_promises6.rm)(pgliteDir(root, name), { recursive: true, force: true });
    },
    async list(prefix) {
      let names;
      try {
        names = await (0, import_promises6.readdir)(dir);
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.stack.read", `Cannot read ${dir}.`, { cause });
      }
      return names.filter((n) => n.startsWith(prefix)).sort();
    },
    close: async () => void 0
  };
}
function dbAdmin(db, root, allowed2, connect2) {
  if ((db.driver ?? "pg") === "pglite") return Promise.resolve(pgliteAdmin(root, allowed2));
  if (typeof db.url !== "string" || db.url === "") throw new LaunchwrightError("qa.stack.url", "Config db.url is not set, so lw qa has no database server.");
  return pgAdmin(db.url, allowed2, connect2);
}
var import_promises6, import_node_path11, LOOPBACK_HOSTS, MAINTENANCE_DATABASE, PGLITE_DIR, dbModuleConnect;
var init_stack = __esm({
  "src/world/services/stack.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises6 = require("fs/promises");
    import_node_path11 = require("path");
    init_kernel();
    init_fs();
    init_peers2();
    LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];
    MAINTENANCE_DATABASE = "postgres";
    PGLITE_DIR = ".lw/qa/pglite";
    dbModuleConnect = async (url) => (await loadDb()).createDb({ driver: "pg", url });
  }
});

// src/services/runner.mts
function routeProvenance(route) {
  const path = route.split(/[?#]/)[0] ?? "";
  return path === STATES_HARNESS_PATH || path.startsWith(`${STATES_HARNESS_PATH}/`) ? "mounted" : "live";
}
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
function planSlug(manifestPath) {
  const name = (0, import_node_path12.basename)(manifestPath);
  if (!name.endsWith(".shots.json")) {
    throw new LaunchwrightError("qa.session.plan", `${manifestPath}: a plan is <reportDir>/<slug>.shots.json`, { context: { path: manifestPath } });
  }
  return name.slice(0, -".shots.json".length);
}
function narrow(manifest, legNames2, opts) {
  for (const leg of opts.legs ?? []) {
    if (!legNames2.has(leg)) throw new LaunchwrightError("qa.session.legs", `--legs ${leg} is not a leg. Legs: ${[...legNames2].join(" ")}`, { context: { leg } });
  }
  const ids = new Set(manifest.shots.map((s) => s.id));
  for (const id of opts.only ?? []) {
    if (!ids.has(id)) throw new LaunchwrightError("qa.session.only", `--only ${id} is not a row of ${opts.manifestPath}`, { context: { id } });
  }
  const plan2 = manifest.shots.filter((s) => !opts.only || opts.only.includes(s.id)).map((shot) => ({ shot, legs: opts.legs ? shot.legs.filter((l) => opts.legs?.includes(l)) : [...shot.legs] })).filter((p) => p.legs.length > 0);
  if (plan2.length === 0) throw new LaunchwrightError("qa.session.empty", "--legs and --only leave no row on any leg", {});
  return plan2;
}
function forkLabel(shot) {
  const label = shot.fork;
  return typeof label === "string" && label.trim() !== "" ? label : void 0;
}
function once(fn) {
  let running = null;
  return () => {
    running ??= fn();
    return running;
  };
}
function failureText(err) {
  if (isCodedError(err)) return `${err.code}: ${err.message}`;
  return messageOf(err);
}
function armList(plan2) {
  const seen = /* @__PURE__ */ new Map();
  for (const { shot } of plan2) {
    for (const state of shot.fixture.arm) {
      const persona = shot.fixture.persona;
      seen.set(`${state}\0${persona ?? ""}`, { state, ...persona ? { persona } : {} });
    }
  }
  return [...seen.values()];
}
function forkGroups(plan2) {
  const shared = [];
  const groups = /* @__PURE__ */ new Map();
  for (const item of plan2) {
    const label = forkLabel(item.shot);
    if (label === void 0) shared.push(item);
    else {
      const group = groups.get(label);
      if (group) group.push(item);
      else groups.set(label, [item]);
    }
  }
  return { shared, groups };
}
async function pool(items, limit, fn) {
  const errors = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      try {
        await fn(item);
      } catch (err) {
        errors.push(err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return errors;
}
function oneError(errors) {
  if (errors.length === 1) return errors[0];
  return new LaunchwrightError("qa.session.fork", `${errors.length} fork groups failed: ${errors.map(failureText).join("; ")}`, { cause: new AggregateError(errors) });
}
async function runManifest(opts, deps) {
  const legs = new Map(legDefinitions(deps.config).map((l) => [l.name, l]));
  const manifest = await loadManifest(opts.manifestPath, { legs: legs.keys() });
  const plan2 = narrow(manifest, new Set(legs.keys()), opts);
  const run10 = new Run(deps, opts.manifestPath);
  const registered = new Set(deps.targets.names());
  const { shared, groups } = forkGroups(plan2);
  const sharedView = { baseUrls: deps.baseUrls, blocked: {} };
  const warnings = [];
  const results = [];
  const active = /* @__PURE__ */ new Set();
  const runActive = async () => {
    const list3 = [...active];
    active.clear();
    const failed2 = (await Promise.allSettled(list3.map((t) => t()))).flatMap((r) => r.status === "rejected" ? [r.reason] : []);
    if (failed2.length > 0) throw oneError(failed2);
  };
  const withTeardown = async (teardown, body) => {
    active.add(teardown);
    try {
      await body();
    } finally {
      active.delete(teardown);
      await teardown();
    }
  };
  const signals = deps.signals ?? process;
  const exit = deps.exit ?? ((code) => process.exit(code));
  const onSignal = (code) => () => {
    deps.err("interrupted: disarming the fixtures and dropping the forks before exit");
    runActive().then(
      () => exit(code),
      (err) => {
        deps.err(`disarm failed: ${failureText(err)}. Run lw qa fixture disarm and lw qa world fork drop before anyone uses the QA database.`);
        exit(code);
      }
    );
  };
  const onInt = onSignal(130);
  const onTerm = onSignal(143);
  signals.on("SIGINT", onInt);
  signals.on("SIGTERM", onTerm);
  const armGroup = async (group, arming, label) => {
    const toArm = armList(group);
    if (toArm.length > 0 && !arming) warnings.push(`no fixture was armed (${toArm.map((a) => a.state).join(", ")}): the world submodule gives no fixture arming`);
    for (const item of arming ? toArm : []) {
      deps.out(`arm       ${item.state}${item.persona ? ` for ${item.persona}` : ""}${label ? ` in fork ${label}` : ""}`);
      try {
        await arming?.arm(item.state, item.persona ? { persona: item.persona } : {});
      } catch (err) {
        warnings.push(`${item.state} was not armed${label ? ` in fork ${label}` : ""}: ${failureText(err)}`);
      }
    }
  };
  const report3 = async (shot, leg, result) => {
    await run10.record(result);
    results.push(result);
    deps.out(`${result.status.padEnd(8)}  ${leg.name.padEnd(16)} ${shot.id}${result.failures.length > 0 ? ` (${result.failures.join(", ")})` : ""}${result.reason ? `: ${result.reason}` : ""}`);
  };
  const runRows = async (group, view) => {
    for (const { shot, legs: legNames2 } of group) {
      for (const name of legNames2) {
        const leg = legs.get(name);
        const target = registered.has(leg.target) ? deps.targets.get(leg.target) : null;
        await report3(shot, leg, await run10.row(shot, leg, target, view));
      }
    }
  };
  const notRunGroup = async (group, reason) => {
    warnings.push(reason);
    for (const { shot, legs: legNames2 } of group) {
      for (const name of legNames2) await report3(shot, legs.get(name), { row: shot.id, leg: name, status: "not-run", reason, failures: [], attempts: 0, ms: 0 });
    }
  };
  const sharedPhase = async (group, label) => {
    const arming = deps.fixtures;
    const teardown = once(async () => {
      if (!arming) return;
      deps.out("disarm    the fixtures of this run");
      await arming.disarm();
    });
    await withTeardown(teardown, async () => {
      await armGroup(group, arming, label);
      await runRows(group, sharedView);
    });
  };
  let creating = Promise.resolve();
  const createInTurn = (forker, label) => {
    const next = creating.then(
      () => forker.create(label),
      () => forker.create(label)
    );
    creating = next.catch(() => void 0);
    return next;
  };
  const forkPhase = async (forker, label, group) => {
    let database;
    try {
      database = await createInTurn(forker, label);
    } catch (err) {
      await notRunGroup(group, `fork ${label} was not created: ${failureText(err)}`);
      return;
    }
    deps.out(`fork      ${label} -> ${database}`);
    let server = null;
    const teardown = once(async () => {
      try {
        if (server) await server.close();
      } finally {
        await forker.drop(database);
      }
    });
    await withTeardown(teardown, async () => {
      try {
        server = await forker.serve(database);
      } catch (err) {
        await notRunGroup(group, `the QA app did not start on fork ${label}: ${failureText(err)}`);
        return;
      }
      deps.out(`serve     fork ${label} on ${server.url}`);
      await armGroup(group, server.arming, label);
      await runRows(group, forkView(deps.baseUrls, deps.config.apiPort, server.url, label));
    });
  };
  try {
    await sharedPhase(shared, null);
    const forker = deps.fork;
    if (!forker) {
      for (const [label, group] of groups) {
        warnings.push(`the fork group "${label}" is not isolated: no fork runner was given, so it ran on the shared QA world`);
        await sharedPhase(group, label);
      }
    } else {
      const errors = await pool([...groups], deps.forkConcurrency ?? FORK_CONCURRENCY, ([label, group]) => forkPhase(forker, label, group));
      if (errors.length > 0) throw oneError(errors);
    }
  } finally {
    try {
      await runActive();
    } finally {
      signals.off("SIGINT", onInt);
      signals.off("SIGTERM", onTerm);
    }
  }
  for (const w of warnings) deps.err(`fixture caveat: ${w}`);
  const failed = results.filter((r) => r.status === "failed").length;
  const ran = results.filter((r) => r.status === "passed" || r.status === "failed").length;
  const notRun = results.filter((r) => r.status === "not-run").length;
  if (ran === 0 && notRun > 0) deps.err(`no row and leg pair ran: ${notRun} not run. The run proves nothing, so it exits 1.`);
  return { slug: run10.slugName, results, warnings, exitCode: failed > 0 || ran === 0 && notRun > 0 ? 1 : 0 };
}
var import_node_fs7, import_promises7, import_node_path12, FORK_CONCURRENCY, BROWSER_TARGETS, UNFILLED, PAGE_TEXT, Run;
var init_runner = __esm({
  "src/services/runner.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs7 = require("fs");
    import_promises7 = require("fs/promises");
    import_node_path12 = require("path");
    init_kernel();
    init_evidence();
    init_ledger();
    init_legs();
    init_manifest2();
    init_video();
    init_mount();
    init_stack();
    FORK_CONCURRENCY = 2;
    BROWSER_TARGETS = /* @__PURE__ */ new Set(["playwright", "fake"]);
    UNFILLED = /\{([A-Za-z0-9_]+)\}/;
    PAGE_TEXT = 'document.body ? document.body.innerText : ""';
    Run = class {
      constructor(deps, manifestPath) {
        this.deps = deps;
        this.reportDir = (0, import_node_path12.dirname)(manifestPath);
        this.slug = planSlug(manifestPath);
        this.paths = reportPaths(this.reportDir, this.slug);
      }
      deps;
      reportDir;
      slug;
      paths;
      ready = /* @__PURE__ */ new Map();
      /** The ledger and `results.jsonl` writes, one at a time: fork groups run rows at the same time. */
      writes = Promise.resolve();
      get slugName() {
        return this.slug;
      }
      serial(fn) {
        const next = this.writes.then(fn, fn);
        this.writes = next.then(
          () => void 0,
          () => void 0
        );
        return next;
      }
      /** Appends one row result to `results.jsonl`. */
      record(result) {
        return this.serial(() => appendResult(this.paths.results, result));
      }
      /** The leg as a result before any session: `n/a` or `not-run` with the reason, or null to run it. */
      async gate(shot, leg, target, needs, view) {
        if (!target) return { status: "n/a", reason: "no target" };
        const missing = needs.filter((cap) => !target.capabilities.has(cap));
        if (missing.length > 0) return { status: "n/a", reason: `the ${target.name} target has no ${missing.join(", ")} capability` };
        const unfilled = UNFILLED.exec(shot.route);
        if (unfilled) return { status: "not-run", reason: `the route ${shot.route} has an unfilled handle {${unfilled[1]}}. Run lw qa world reset, then plan the sweep again` };
        const blocked = view.blocked[leg.surface];
        if (blocked !== void 0) return { status: "not-run", reason: blocked };
        if (view.baseUrls[leg.surface] === void 0) {
          return { status: "not-run", reason: `no base URL for the ${leg.surface} surface. Pass --base ${leg.surface}=<url> or set qa.baseUrls.${leg.surface}` };
        }
        let readiness = this.ready.get(leg.name);
        if (!readiness) {
          readiness = await target.ready(leg);
          this.ready.set(leg.name, readiness);
        }
        if (!readiness.ready) return { status: "not-run", reason: `the ${target.name} target is not ready: ${readiness.reason ?? "no reason given"}` };
        return null;
      }
      async row(shot, leg, target, view) {
        const started = this.deps.clock.now();
        const needs = ["screenshot", ...shot.act && shot.act.length > 0 ? ["input"] : []];
        const gated = await this.gate(shot, leg, target, needs, view);
        if (gated || !target) return { row: shot.id, leg: leg.name, failures: [], attempts: 0, ms: 0, status: gated?.status ?? "n/a", reason: gated?.reason ?? "no target" };
        const device = !BROWSER_TARGETS.has(target.name);
        const wantsVideo2 = device || shot.video === true || (shot.act?.length ?? 0) > 0;
        const video = wantsVideo2 && target.capabilities.has("video");
        const limit = device ? this.deps.config.evidence.attempts : 1;
        let last = { failures: [], notes: [], entries: [] };
        let attempts = 0;
        await this.serial(() => dropRowLeg(this.reportDir, this.slug, shot.id, leg.name));
        const baseUrl = view.baseUrls[leg.surface];
        while (attempts < limit) {
          attempts += 1;
          last = await this.attempt(shot, leg, target, { attempt: attempts, video, device, baseUrl });
          const entries = last.entries;
          await this.serial(() => appendLedger(this.reportDir, this.slug, entries));
          if (last.failures.length === 0) break;
        }
        const notes = [...last.notes];
        if (wantsVideo2 && !video) notes.unshift(`video n/a: the ${target.name} target has no video capability`);
        return {
          row: shot.id,
          leg: leg.name,
          status: last.failures.length === 0 ? "passed" : "failed",
          ...notes.length > 0 ? { reason: notes.join("; ") } : {},
          failures: last.failures,
          attempts,
          ms: this.deps.clock.now() - started
        };
      }
      rel(leg, row, kind, opts) {
        return evidencePath(this.slug, leg, row, kind, opts);
      }
      async attempt(shot, leg, target, opts) {
        const { attempt } = opts;
        const files = [];
        const pngs = [];
        const notes = [];
        const failures = /* @__PURE__ */ new Set();
        const now = () => this.deps.clock.date().toISOString();
        const abs = (rel) => (0, import_node_path12.join)(this.reportDir, rel);
        const videoExt = opts.device ? "mp4" : "webm";
        let session2 = null;
        let recording = false;
        let videoPath2 = null;
        let pageText = null;
        let landed = null;
        let logs = [];
        try {
          session2 = await target.open({
            leg,
            baseUrl: opts.baseUrl,
            outDir: this.paths.assets,
            ...shot.fixture.persona ? { persona: shot.fixture.persona } : {}
          });
          if (opts.video) {
            const rel = this.rel(leg.name, shot.id, "video", { attempt, videoExt });
            await session2.startVideo(abs(rel));
            recording = true;
            videoPath2 = rel;
          }
          await session2.navigate(shot.route);
          await session2.settle(shot.settle);
          if (session2.evaluate) pageText = String(await session2.evaluate(PAGE_TEXT));
          landed = await session2.currentRoute();
          const shotRel = this.rel(leg.name, shot.id, "screenshot", { attempt });
          await session2.screenshot(abs(shotRel));
          files.push({ rel: shotRel, kind: "screenshot", at: now() });
          pngs.push(shotRel);
          for (const [i, step] of (shot.act ?? []).entries()) {
            await session2.act(step);
            const stepRel = this.rel(leg.name, shot.id, "step", { attempt, step: i + 1 });
            await session2.screenshot(abs(stepRel));
            files.push({ rel: stepRel, kind: "step", at: now() });
            pngs.push(stepRel);
          }
        } catch (err) {
          const code = isCodedError(err) ? err.code : "";
          failures.add(code === "qa.target.settle" || code === "qa.target.act" ? "expect" : "crashed");
          notes.push(failureText(err));
        }
        if (session2) {
          try {
            if (recording && videoPath2) {
              recording = false;
              await session2.stopVideo();
              files.push({ rel: videoPath2, kind: "video", at: now() });
            }
            const read = await session2.logs().then(
              (lines2) => ({ lines: lines2 }),
              (err) => {
                if (isCodedError(err) && err.code === "qa.target.capability") return { na: failureText(err) };
                throw err;
              }
            );
            if ("na" in read) notes.push(`log n/a: ${read.na}`);
            else {
              logs = read.lines;
              const logRel = this.rel(leg.name, shot.id, "log", { attempt });
              (0, import_node_fs7.mkdirSync)((0, import_node_path12.dirname)(abs(logRel)), { recursive: true });
              (0, import_node_fs7.writeFileSync)(abs(logRel), logs.map((l) => JSON.stringify(l)).join("\n") + (logs.length > 0 ? "\n" : ""));
              files.push({ rel: logRel, kind: "log", at: now() });
            }
            const traceRel = this.rel(leg.name, shot.id, "trace", { attempt });
            if (await session2.trace(abs(traceRel)) !== null) files.push({ rel: traceRel, kind: "trace", at: now() });
            const uiRel = this.rel(leg.name, shot.id, "ui", { attempt });
            if (await session2.dump(abs(uiRel)) !== null) files.push({ rel: uiRel, kind: "ui", at: now() });
          } catch (err) {
            failures.add("crashed");
            notes.push(`collecting the evidence failed: ${failureText(err)}`);
          } finally {
            await session2.close();
          }
        }
        const screenshots = await Promise.all(pngs.map((rel) => (0, import_promises7.readFile)(abs(rel))));
        const videos = [];
        if (videoPath2 && files.some((f) => f.rel === videoPath2)) {
          try {
            videos.push(await this.measure(abs(videoPath2)));
          } catch (err) {
            failures.add("blank-video");
            notes.push(`the video cannot be measured: ${failureText(err)}`);
          }
        }
        const checked = attemptFailures(
          {
            screenshots,
            ...pageText !== null ? { page: { text: pageText, bootFailureSentences: this.deps.bootFailureSentences ?? [] } } : {},
            ...landed !== null ? { route: { requested: shot.route, landedPath: landed } } : {},
            logs,
            expectedPageErrors: expectedPageErrors(shot),
            videos
          },
          this.deps.config.evidence
        );
        for (const f of checked) failures.add(f);
        if (failures.has("route-drift") && landed !== null) notes.push(`the session left ${shot.route} for ${landed}`);
        const entries = await Promise.all(
          files.map(
            (f) => ledgerEntry(this.reportDir, {
              path: f.rel,
              kind: f.kind,
              capturedAt: f.at,
              commit: this.deps.revision.commit,
              dirty: this.deps.revision.dirty,
              leg: leg.name,
              target: target.name,
              ...leg.device ? { device: leg.device } : {},
              provenance: routeProvenance(shot.route),
              row: shot.id,
              attempt
            })
          )
        );
        const order = ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error", "expect", "crashed"];
        return { failures: order.filter((f) => failures.has(f)), notes, entries };
      }
      measure(path) {
        if (this.deps.measure) return this.deps.measure(path);
        if (!this.deps.videoTools) throw new LaunchwrightError("qa.session.video", "The runner has no video tools to measure a video.");
        return measureVideo(path, this.deps.videoTools);
      }
    };
  }
});

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION, QA_TARGET_CAPABILITIES;
var init_contract2 = __esm({
  "src/drivers/target/contract.mts"() {
    "use strict";
    init_cjs_shims();
    QA_TARGET_SPEC_VERSION = "1";
    QA_TARGET_CAPABILITIES = ["input", "screenshot", "video", "webview", "native", "telegram"];
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
  (0, import_node_fs8.mkdirSync)((0, import_node_path13.dirname)(path), { recursive: true });
  (0, import_node_fs8.writeFileSync)(path, bytes);
}
function capabilityError(target, capability, what) {
  return new LaunchwrightError("qa.target.capability", `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability }
  });
}
function createFakeTarget(opts = {}) {
  return new FakeTargetImpl(opts);
}
var import_node_fs8, import_node_path13, FAKE_SHOT_SIZE, FAKE_CLIP_MS, DEFAULT_CAPABILITIES, CLIP_BASE64, FAKE_CLIP, FakeSession, FakeTargetImpl;
var init_fake = __esm({
  "src/drivers/target/fake.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs8 = require("fs");
    import_node_path13 = require("path");
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
        const page2 = this.page();
        const missing = [];
        if (rule.selector !== void 0 && !this.has(rule.selector)) missing.push(`selector ${rule.selector}`);
        if (rule.artwork && !page2.artwork) missing.push("artwork");
        if (rule.video && !page2.video) missing.push("a playing video");
        if (rule.busy && page2.busy) missing.push("no aria-busy element");
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
var import_node_fs9, import_node_path14, PERSONA_SESSION_ROUTE, CAPABILITIES, MIN_CLIP_MS, importPlaywright, SETTLE_SCRIPTS, PlaywrightSession, PlaywrightTarget;
var init_playwright = __esm({
  "src/drivers/target/playwright.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs9 = require("fs");
    import_node_path14 = require("path");
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
      constructor(target, opts, browser, context, page2) {
        this.target = target;
        this.opts = opts;
        this.browser = browser;
        this.context = context;
        this.page = page2;
        const at = () => target.clock.date().toISOString();
        page2.on("crash", () => {
          this.broken = true;
        });
        browser.on("disconnected", () => {
          this.broken = true;
        });
        page2.on("pageerror", (err) => this.lines.push({ at: at(), kind: "page-error", text: err.message }));
        page2.on("console", (msg) => {
          if (msg.type() === "error") this.lines.push({ at: at(), kind: "console-error", text: msg.text() });
        });
        page2.on(
          "requestfailed",
          (req) => this.lines.push({ at: at(), kind: "request-failed", text: `${req.method()} ${req.url()}: ${req.failure()?.errorText ?? "failed"}` })
        );
        page2.on("response", (res) => {
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
      shut = false;
      /** Set when the page crashed or the browser disconnected: the session cannot run another step. */
      broken = false;
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
          await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: this.target.navigateTimeoutMs });
        } catch (err) {
          throw this.fail("qa.target.navigate", `Leg ${this.opts.leg.name} could not open ${route}.`, err, { route });
        }
        await this.loadGrace();
      }
      /** Waits a bounded time for `load`. A page that never fires it is no failure: the settle rule decides. */
      async loadGrace() {
        try {
          await this.page.waitForLoadState("load", { timeout: this.target.loadGraceMs });
        } catch (err) {
          if (err.name !== "TimeoutError") throw this.fail("qa.target.navigate", `Leg ${this.opts.leg.name} lost the page while it loaded.`, err);
        }
      }
      isClosed() {
        return this.shut || this.broken || this.page.isClosed() || !this.browser.isConnected();
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
              await this.page.goBack({ waitUntil: "domcontentloaded", timeout: this.target.navigateTimeoutMs });
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
        (0, import_node_fs9.mkdirSync)((0, import_node_path14.dirname)(path), { recursive: true });
        const png = await this.page.screenshot({ path, animations: "disabled", fullPage: false });
        const size2 = pngSize(png);
        if (size2 === null) throw new LaunchwrightError("qa.target.screenshot", `Leg ${this.opts.leg.name} wrote a screenshot that is not a PNG: ${path}.`);
        return { path, ...size2 };
      }
      async startVideo(path) {
        if (this.videoPath !== null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} already records ${this.videoPath}.`);
        (0, import_node_fs9.mkdirSync)((0, import_node_path14.dirname)(path), { recursive: true });
        const size2 = this.page.viewportSize() ?? void 0;
        await this.page.screencast.start({ path, ...size2 ? { size: size2 } : {} });
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
        (0, import_node_fs9.mkdirSync)((0, import_node_path14.dirname)(path), { recursive: true });
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
        if (this.shut) return;
        this.shut = true;
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
      navigateTimeoutMs;
      loadGraceMs;
      executablePath;
      constructor(opts) {
        this.clock = opts.clock ?? systemClock;
        this.actTimeoutMs = opts.actTimeoutMs ?? 15e3;
        this.settleTimeoutMs = opts.settleTimeoutMs ?? 2e4;
        this.navigateTimeoutMs = opts.navigateTimeoutMs ?? 15e3;
        this.loadGraceMs = opts.loadGraceMs ?? 2e3;
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
          const page2 = await context.newPage();
          return new PlaywrightSession(this, opts, browser, context, page2);
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

// src/world/services/checkout.mts
async function text(path) {
  try {
    return (await (0, import_promises8.readFile)(path, "utf8")).trim();
  } catch (cause) {
    throw new LaunchwrightError("qa.checkout.read", `Cannot read ${path}. The git worktree is broken; run git worktree repair.`, { cause });
  }
}
async function readCheckout(root) {
  const start = (0, import_node_path15.resolve)(root);
  for (let dir = start; ; dir = (0, import_node_path15.dirname)(dir)) {
    const kind = await pathKind((0, import_node_path15.join)(dir, ".git"));
    if (kind === "dir") return { root: start, toplevel: dir, commonDir: (0, import_node_path15.join)(dir, ".git"), linked: false, mainRoot: start };
    if (kind === "file") {
      const line = await text((0, import_node_path15.join)(dir, ".git"));
      const match = /^gitdir:\s*(.+)$/.exec(line);
      if (!match) throw new LaunchwrightError("qa.checkout.read", `${(0, import_node_path15.join)(dir, ".git")} does not name a git dir.`);
      const gitDir = (0, import_node_path15.resolve)(dir, match[1]);
      const commonDir = (0, import_node_path15.resolve)(gitDir, await text((0, import_node_path15.join)(gitDir, "commondir")));
      const mainTop = (0, import_node_path15.basename)(commonDir) === ".git" ? (0, import_node_path15.dirname)(commonDir) : commonDir;
      return { root: start, toplevel: dir, commonDir, linked: true, mainRoot: (0, import_node_path15.join)(mainTop, (0, import_node_path15.relative)(dir, start)) };
    }
    if ((0, import_node_path15.dirname)(dir) === dir) return { root: start, toplevel: start, commonDir: start, linked: false, mainRoot: start };
  }
}
function devProjectName(sections, checkout) {
  const dev = sections.dev;
  if (typeof dev?.project === "string" && dev.project !== "") return dev.project;
  return (0, import_node_path15.basename)((0, import_node_path15.basename)(checkout.commonDir) === ".git" ? (0, import_node_path15.dirname)(checkout.commonDir) : checkout.root);
}
var import_promises8, import_node_path15;
var init_checkout = __esm({
  "src/world/services/checkout.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises8 = require("fs/promises");
    import_node_path15 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/world/services/app.mts
function entryConnect(entry) {
  const connect2 = entry.connect;
  return connect2 === void 0 ? void 0 : (url) => connect2.call(entry, url);
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
function qaFakeToken(id, registryHash2) {
  return `${id}:${(0, import_node_crypto3.createHash)("sha256").update(`lw-qa-fake-bot:${id}:${registryHash2}`).digest("base64url").slice(0, 32)}`;
}
function qaFakeBots(sections, registryHash2) {
  const telegram2 = sections.telegram;
  const out = [];
  for (const [name, bot] of Object.entries(telegram2?.bots ?? {})) {
    const id = typeof bot.id === "number" ? bot.id : botId(bot.token);
    if (id === void 0) continue;
    out.push({ username: typeof bot.username === "string" ? bot.username : name, token: qaFakeToken(id, registryHash2) });
  }
  return out;
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
async function importFromProject(root, specifier) {
  let url;
  try {
    url = (0, import_node_url2.pathToFileURL)(resolveImport(specifier, root)).href;
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
  const file = (0, import_node_path16.isAbsolute)(qa.app) ? qa.app : (0, import_node_path16.resolve)(root, qa.app);
  let mod;
  try {
    mod = await import((0, import_node_url2.pathToFileURL)(file).href);
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
var import_node_crypto3, import_node_path16, import_node_url2, QA_TELEGRAM_PORT;
var init_app2 = __esm({
  "src/world/services/app.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto3 = require("crypto");
    import_node_path16 = require("path");
    import_node_url2 = require("url");
    init_kernel();
    init_peers2();
    init_checkout();
    init_stack();
    QA_TELEGRAM_PORT = 9102;
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
function idProblem(id) {
  if (id.length === 0) return "an id is empty";
  if (id.length > 64) return `${id} has more than 64 characters`;
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id) ? null : `${id} is not a kebab case or dotted id, and it must survive a URL`;
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
function registryProblem(registry) {
  if (registry.personas.length === 0) return "no world file declares a persona, so there is no user to be";
  if (registry.facts.length === 0) return "no world file declares a fact, so there is no state to address";
  const seen = /* @__PURE__ */ new Map();
  for (const entry of [...registry.personas, ...registry.facts]) {
    if (typeof entry.id !== "string") return `an entry of ${entry.file} has no id`;
    const bad2 = idProblem(entry.id);
    if (bad2) return `${bad2} (${entry.file})`;
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
  const lines2 = entries.map((e) => `${e.kind}	${e.id}	${e.feature}	${e.summary}`).sort();
  return sha256(lines2.join("\n")).slice(0, 12);
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
async function walk(root, dir, suffix, out) {
  let entries;
  try {
    entries = await (0, import_promises9.readdir)(dir, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === "ENOENT") return;
    throw new LaunchwrightError("qa.world.walk", `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const path = (0, import_node_path17.join)(dir, entry.name);
    if (entry.isDirectory()) await walk(root, path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push((0, import_node_path17.relative)(root, path).split(import_node_path17.sep).join("/"));
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
      mod = await import((0, import_node_url3.pathToFileURL)((0, import_node_path17.join)(root, file)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.world.file", `Cannot load world file ${file}: ${messageOf(cause)}`, { cause, context: { file } });
    }
    if (!isWorld(mod.default)) {
      throw new LaunchwrightError("qa.world.file", `${file} needs a default export defineWorld({ personas, facts }).`, { context: { file } });
    }
    out.push({ feature: (0, import_node_path17.basename)(file, WORLD_SUFFIX), file, world: mod.default });
  }
  return out;
}
async function loadRegistry(root) {
  return buildRegistry(await loadWorlds(root));
}
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
  for (const file of await worldFiles(root)) out.push(...rawSqlFindings(file, await (0, import_promises9.readFile)((0, import_node_path17.join)(root, file), "utf8")));
  return out;
}
async function featuresWithoutWorld(root) {
  const worlds = new Set(await worldFiles(root));
  return (await filesWithSuffix(root, FEATURE_SUFFIX)).filter((f) => {
    const world2 = (0, import_node_path17.join)((0, import_node_path17.dirname)(f), `${(0, import_node_path17.basename)(f, FEATURE_SUFFIX)}${WORLD_SUFFIX}`).split(import_node_path17.sep).join("/");
    return !worlds.has(world2);
  });
}
var import_promises9, import_node_path17, import_node_url3, WORLD_SUFFIX, FEATURE_SUFFIX, SKIP, RAW_SQL;
var init_discover = __esm({
  "src/world/services/discover.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises9 = require("fs/promises");
    import_node_path17 = require("path");
    import_node_url3 = require("url");
    init_kernel();
    init_registry();
    WORLD_SUFFIX = ".world.mts";
    FEATURE_SUFFIX = ".feature.mts";
    SKIP = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "coverage"]);
    RAW_SQL = [
      { pattern: /\bsql\s*`/, what: "a sql template" },
      { pattern: /\bsql\.(raw|join|identifier)\s*\(/, what: "a sql helper" },
      { pattern: /\.execute\s*[<(]/, what: "an execute() call" },
      { pattern: /import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/, what: "an import of sql from drizzle-orm" }
    ];
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
function worldConnect(ctx) {
  return async (url) => {
    const db = await optionalDb();
    if (db) return db.createDb({ driver: "pg", url });
    const connect2 = entryConnect(await loadAppEntry(ctx.root, ctx.qa));
    if (connect2 === void 0) {
      throw new LaunchwrightError("qa.world.connect", `The db module is not installed, and qaApp of ${ctx.qa.app} has no connect(url). Add qaApp.connect, or install the db module.`, {
        context: { app: ctx.qa.app }
      });
    }
    return connect2(url);
  };
}
async function withWorld(ctx, fn) {
  const entry = await loadAppEntry(ctx.root, ctx.qa);
  const world2 = await openWorld(entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    return await fn(world2, ctx.registry);
  } finally {
    await world2.close();
  }
}
function parseArgs2(args, flags, values = []) {
  const parsed = parseCommandArgs({ switches: flags, values }, args);
  const options = {};
  for (const [name, value] of Object.entries(parsed.values)) if (value !== void 0) options[name] = value;
  for (const name of parsed.switches) options[name] = true;
  return { words: parsed.positionals, options };
}
async function guarded(command, opts, body) {
  try {
    return await body();
  } catch (cause) {
    if (!isCodedError(cause)) throw cause;
    opts.err(`lw qa ${command}: ${cause.message} (${cause.code})`);
    return cause.code === USAGE_CODE ? 2 : 1;
  }
}
function processSignal(given) {
  if (given) return { signal: given, dispose: () => void 0 };
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return {
    signal: controller.signal,
    dispose() {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
  };
}
var USAGE_CODE;
var init_context = __esm({
  "src/world/services/context.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_args();
    init_config2();
    init_peers2();
    init_app2();
    init_checkout();
    init_discover();
    init_registry();
    USAGE_CODE = "kernel.usage";
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
function isStamp(value) {
  const s = value;
  return typeof s === "object" && s !== null && typeof s.database === "string" && typeof s.hash === "string" && typeof s.seededAt === "string" && Array.isArray(s.entries);
}
async function readStamp(root) {
  const text2 = await readTextOrNull((0, import_node_path18.join)(root, STAMP_FILE));
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
  await (0, import_promises10.mkdir)((0, import_node_path18.dirname)(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await (0, import_promises10.writeFile)(tmp, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
  await (0, import_promises10.rename)(tmp, path);
}
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
    const dir = (0, import_node_path18.resolve)(o.root, typeof db.migrations === "string" ? db.migrations : "packages/db/migrations");
    const { applied } = await migrate(conn, dir);
    o.out(`migrated ${database}: ${applied.length} migration(s)`);
  } finally {
    await conn.close();
  }
}
async function linkWithAuth(world2, userId, persona, telegramId) {
  const auth = await loadAuth();
  if (!world2.app.has(auth.USERS)) {
    throw new LaunchwrightError("qa.world.auth", "The QA app has no auth module, so no persona can sign in. Add the auth module to the project.");
  }
  const users = world2.app.get(auth.USERS);
  await users.link(world2.tenantId, userId, { provider: QA_PROVIDER, subject: persona });
  await users.link(world2.tenantId, userId, { provider: "telegram", subject: String(telegramId) });
}
async function linkPersona(world2, entry, persona, seededUserId) {
  const ids = personaIds(persona);
  const given = typeof seededUserId === "string" && seededUserId !== "" ? seededUserId : void 0;
  if (entry?.linkPersona) {
    const linked = await entry.linkPersona(world2, { persona, accountId: ids.accountId, telegramId: ids.telegramId, ...given ? { userId: given } : {} });
    const userId = typeof linked === "string" && linked !== "" ? linked : given;
    if (userId === void 0) throw new LaunchwrightError("qa.world.handles", "Its seed returned no userId, and qaApp.linkPersona returned none.");
    return userId;
  }
  if (given === void 0) throw new LaunchwrightError("qa.world.handles", "Its seed returned no userId.");
  await linkWithAuth(world2, given, persona, ids.telegramId);
  return given;
}
async function seedWorld(world2, registry, o) {
  const names = o.entry?.seed ? null : baseSeedNames(o.seed);
  if (names !== null) {
    const { DB, runSeeds, seedNames } = await loadDb();
    const dir = (0, import_node_path18.join)(o.root, "packages/db/seeds");
    const ran = await runSeeds(world2.app.get(DB), dir, names.length > 0 ? names : await seedNames(dir), o.out);
    o.out(`base seed: ${ran.join(", ") || "none"}`);
  }
  const seeded = [];
  for (const fact of registry.facts) {
    try {
      const handles = await fact.seed(world2);
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
      const handles = await persona.seed(world2, ids);
      const userId = await linkPersona(world2, o.entry, persona.id, handles?.userId);
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
  const connect2 = entryConnect(o.entry);
  const snapshot = { root: o.root, db, database: o.overlay.database, ...connect2 ? { connect: connect2 } : {} };
  await snapshotSeeded(snapshot, "drop");
  await recreate(o, db);
  const world2 = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, registryHash: hash });
  let entries;
  try {
    entries = await seedWorld(world2, o.registry, o);
  } finally {
    await world2.close();
  }
  await snapshotSeeded(snapshot, "replace");
  o.out(`snapshot ${seededName(o.overlay.database)}: each fork copies it`);
  const stamp2 = { database: o.overlay.database, hash, seededAt: o.clock.date().toISOString(), entries };
  await writeJson((0, import_node_path18.join)(o.root, STAMP_FILE), stamp2);
  o.out(`seeded ${entries.length} entries, registry ${stamp2.hash}`);
  return stamp2;
}
async function rmStamp(root) {
  await (0, import_promises10.rm)((0, import_node_path18.join)(root, STAMP_FILE), { force: true });
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
  const stamp2 = read === "unreadable" || read === null || read.database !== o.database ? null : read;
  const state = !exists ? "missing" : stamp2 === null ? "unseeded" : stamp2.hash === live ? "current" : "stale";
  return { database: o.database, exists, state, registryHash: live, stamp: stamp2 };
}
var import_promises10, import_node_path18, STAMP_FILE, DB_SEED;
var init_world = __esm({
  "src/world/services/world.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises10 = require("fs/promises");
    import_node_path18 = require("path");
    init_kernel();
    init_fs();
    init_peers2();
    init_app2();
    init_fork();
    init_ids();
    init_registry();
    init_stack();
    STAMP_FILE = ".lw/qa/world.json";
    DB_SEED = /^lw\s+db\s+seed(?:\s+(.*))?$/;
  }
});

// src/world/services/fixture.mts
function forkUndoFile(database) {
  return `.lw/qa/fork/${database}.fixture.json`;
}
async function readUndo(root, database, file = UNDO_FILE) {
  const text2 = await readTextOrNull((0, import_node_path19.join)(root, file));
  if (text2 === null) return { database, armed: [] };
  let record3;
  try {
    record3 = JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("qa.fixture.read", `${file} is not JSON. Restore it from the run log, or delete it after lw qa world reset.`, { cause });
  }
  if (record3.armed.length > 0 && record3.database !== database) {
    throw new LaunchwrightError("qa.fixture.database", `${file} holds facts armed on ${record3.database}, not on ${database}. Disarm them on that database first.`, {
      context: { database: record3.database }
    });
  }
  return { database, armed: record3.armed };
}
function writeUndo(root, record3, file) {
  return writeJson((0, import_node_path19.join)(root, file), record3);
}
async function armFact(world2, registry, root, factId, opts = {}) {
  const file = opts.undoFile ?? UNDO_FILE;
  const fact = factById(registry, factId);
  if (fact.arm === void 0) {
    throw new LaunchwrightError("qa.fixture.no-arm", `Fact ${fact.id} (${fact.file}) has no arm(). Seed it with lw qa world reset, or give it arm() and undo().`, {
      context: { fact: fact.id }
    });
  }
  const persona = opts.persona === void 0 ? void 0 : personaIds(personaById(registry, opts.persona).id);
  const record3 = await readUndo(root, world2.database, file);
  if (record3.armed.some((a) => a.fact === fact.id)) {
    throw new LaunchwrightError("qa.fixture.armed", `Fact ${fact.id} is armed already. Run lw qa fixture disarm first.`, { context: { fact: fact.id } });
  }
  const entry = { fact: fact.id, ...persona ? { persona: persona.persona } : {}, steps: [] };
  record3.armed.push(entry);
  await writeUndo(root, record3, file);
  await fact.arm({
    app: world2.app,
    tenantId: world2.tenantId,
    ...persona ? { persona } : {},
    async record(step) {
      entry.steps.push(step);
      await writeUndo(root, record3, file);
    }
  });
  return entry;
}
async function disarmFact(world2, registry, root, file = UNDO_FILE) {
  const record3 = await readUndo(root, world2.database, file);
  const done = [];
  while (record3.armed.length > 0) {
    const entry = record3.armed[record3.armed.length - 1];
    const fact = factById(registry, entry.fact);
    if (fact.undo === void 0) throw new LaunchwrightError("qa.fixture.no-undo", `Fact ${fact.id} has no undo(), so its steps cannot be replayed.`, { context: { fact: fact.id } });
    while (entry.steps.length > 0) {
      await fact.undo(world2, entry.steps[entry.steps.length - 1]);
      entry.steps.pop();
      await writeUndo(root, record3, file);
    }
    record3.armed.pop();
    await writeUndo(root, record3, file);
    done.push(entry.fact);
  }
  return done;
}
var import_node_path19, UNDO_FILE;
var init_fixture = __esm({
  "src/world/services/fixture.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path19 = require("path");
    init_kernel();
    init_fs();
    init_ids();
    init_registry();
    init_world();
    UNDO_FILE = ".lw/qa/fixture.json";
  }
});

// src/world/services/arming.mts
async function fixtureArming(opts) {
  const ctx = await worldContext(opts);
  const entry = opts.entry ?? await loadAppEntry(ctx.root, ctx.qa);
  const registry = opts.registry ?? ctx.registry;
  const database = opts.database ?? ctx.overlay.database;
  const overlay = { ...ctx.overlay, database, registryHash: registryHash(listWorld(registry)) };
  const world2 = await openWorld(entry, ctx.sections, ctx.env, overlay);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await world2.close();
  };
  return {
    async arm(state, o) {
      await armFact(world2, registry, ctx.root, state, o.persona === void 0 ? {} : { persona: o.persona });
    },
    async disarm() {
      try {
        await disarmFact(world2, registry, ctx.root);
      } finally {
        await close();
      }
    }
  };
}
var init_arming = __esm({
  "src/world/services/arming.mts"() {
    "use strict";
    init_cjs_shims();
    init_app2();
    init_context();
    init_fixture();
    init_registry();
  }
});

// src/world/services/node-listen.mts
async function bodyOf(req) {
  if (req.method === "GET" || req.method === "HEAD") return void 0;
  const chunks = [];
  for await (const chunk2 of req) chunks.push(chunk2);
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
async function nodeListen(handler, port2) {
  const server = (0, import_node_http.createServer)((req, res) => {
    answer(handler, req, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`QA app error: ${messageOf(err)}`);
    });
  });
  await new Promise((resolve17, reject) => {
    server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${port2}: ${cause.message}`, { cause })));
    server.listen(port2, "127.0.0.1", resolve17);
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve17, reject) => {
      server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve17());
      server.closeAllConnections();
    })
  };
}
var import_node_http;
var init_node_listen = __esm({
  "src/world/services/node-listen.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_http = require("http");
    init_kernel();
  }
});

// src/world/services/api.mts
async function serveWorld(ctx, o) {
  const stamp2 = await readStamp(ctx.root);
  if (stamp2 === null || stamp2 === "unreadable" || stamp2.database !== ctx.overlay.database) {
    throw new LaunchwrightError("qa.world.unseeded", `${ctx.overlay.database} holds no seeded world. Run lw qa world reset.`);
  }
  if (stamp2.hash !== registryHash(listWorld(o.registry))) o.out(`warning: ${ctx.overlay.database} was seeded from registry ${stamp2.hash}; the world files changed since. Run lw qa world reset.`);
  const world2 = await openWorld(o.entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    const listening = await listenQaApp(o.entry.serve(world2.app), world2.app, o.port);
    o.out(`qa api on http://127.0.0.1:${listening.port} against ${ctx.overlay.database}, Bot API ${ctx.overlay.telegramUrl}`);
    o.onListen?.(listening.port);
    if (!o.signal.aborted) await new Promise((resolve17) => o.signal.addEventListener("abort", () => resolve17(), { once: true }));
    await listening.close();
  } finally {
    await world2.close();
  }
}
var listenQaApp;
var init_api = __esm({
  "src/world/services/api.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_peers2();
    init_app2();
    init_node_listen();
    init_registry();
    init_world();
    listenQaApp = async (handler, app, port2) => {
      const http = await optionalHttp();
      if (http === void 0) return nodeListen(handler, port2);
      const { serveNode } = http;
      const { server } = serveNode(handler, port2, { hostname: "127.0.0.1", app, signals: false });
      if (!server.listening) await new Promise((resolve17, reject) => {
        server.once("listening", resolve17);
        server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${port2}: ${cause.message}`, { cause })));
      });
      return {
        port: server.address().port,
        close: () => new Promise((resolve17, reject) => {
          server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve17());
          server.closeAllConnections?.();
        })
      };
    };
  }
});

// src/world/services/fork-server.mts
async function serveFork(o, database) {
  const world2 = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, database });
  let listening = null;
  try {
    listening = await (o.listen ?? listenQaApp)(o.entry.serve(world2.app), world2.app, 0);
  } finally {
    if (listening === null) await world2.close();
  }
  const server = listening;
  const undoFile = forkUndoFile(database);
  let closing = null;
  const close = async () => {
    try {
      await server.close();
    } finally {
      try {
        await world2.close();
      } finally {
        await (0, import_promises11.rm)((0, import_node_path20.join)(o.root, undoFile), { force: true });
      }
    }
  };
  return {
    database,
    world: world2,
    url: `http://127.0.0.1:${server.port}`,
    arming: {
      async arm(state, a) {
        await armFact(world2, o.registry, o.root, state, { ...a.persona === void 0 ? {} : { persona: a.persona }, undoFile });
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
  const connect2 = entryConnect(o.entry);
  const fork = { root: o.root, sections: o.sections, database: o.overlay.database, out: o.out, ...connect2 ? { connect: connect2 } : {} };
  return {
    create: (label) => createFork({ ...fork, label }),
    drop: (name) => dropFork({ ...fork, name }),
    serve: (database) => serveFork(o, database)
  };
}
var import_promises11, import_node_path20;
var init_fork_server = __esm({
  "src/world/services/fork-server.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises11 = require("fs/promises");
    import_node_path20 = require("path");
    init_peers2();
    init_api();
    init_app2();
    init_fixture();
    init_fork();
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

// src/world/services/jobs.mts
function jobsDirOf(sections = {}) {
  return `${appPath(sections, "node", "apps/api")}/src/jobs`;
}
async function importProjectJobs(root, jobsDir = JOBS_DIR) {
  const dir = (0, import_node_path21.join)(root, jobsDir);
  let names;
  try {
    names = await (0, import_promises12.readdir)(dir);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.job.read", `Cannot read ${dir}.`, { cause });
  }
  const files = names.filter((n) => n.endsWith(".job.mts")).sort();
  for (const file of files) await import((0, import_node_url4.pathToFileURL)((0, import_node_path21.join)(dir, file)).href);
  return files;
}
function listJobs(registry) {
  return registry.registeredJobs().map((j) => j.kind).sort();
}
async function runJob(world2, registry, o) {
  const def = registry.jobOf(o.kind);
  if (def === void 0) {
    throw new LaunchwrightError("qa.job.unknown", `No registered job has kind ${o.kind}. Jobs: ${listJobs(registry).join(", ") || "none"}.`, { context: { kind: o.kind } });
  }
  const payload = registry.parsePayload(def, o.payload ?? {});
  const scope = world2.app.createScope();
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
    log: world2.app.log
  });
  try {
    await def.handle(payload, ctx);
  } finally {
    await scope.dispose();
  }
}
var import_promises12, import_node_path21, import_node_url4, JOBS_DIR;
var init_jobs = __esm({
  "src/world/services/jobs.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises12 = require("fs/promises");
    import_node_path21 = require("path");
    import_node_url4 = require("url");
    init_kernel();
    init_peers2();
    JOBS_DIR = jobsDirOf();
  }
});

// src/telegram/bot-api.mts
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
  }
});

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
var init_menu = __esm({
  "src/world/services/menu.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_bot_api();
  }
});

// src/world/services/worktree.mts
function envFileName(sections) {
  const dev = sections.dev;
  const name = dev?.envFiles?.local;
  return typeof name === "string" ? name : DEFAULT_LOCAL_ENV_FILE;
}
function copyPrefix(sections, checkout) {
  return `${databaseName(devProjectName(sections, checkout))}_wt_`;
}
function copyName(prefix, toplevel) {
  return `${prefix}${databaseName((0, import_node_path22.basename)(toplevel))}`.slice(0, 63);
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
  const envFile = (0, import_node_path22.join)(o.root, name);
  const mainEnvFile = (0, import_node_path22.join)(checkout.mainRoot, name);
  if (await readTextOrNull(envFile) === null) {
    if (await readTextOrNull(mainEnvFile) === null) throw new LaunchwrightError("qa.worktree.env", `No ${name} in this worktree and none in the main checkout to copy.`);
    await (0, import_promises13.copyFile)(mainEnvFile, envFile);
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
  const lines2 = text2.split("\n");
  const at = lines2.findLastIndex((l) => l.replace(/^\s*(export\s+)?/, "").startsWith(`${key}=`));
  if (at === -1) return `${text2}${text2 === "" || text2.endsWith("\n") ? "" : "\n"}${key}=${value}
`;
  lines2[at] = `${key}=${value}`;
  return lines2.join("\n");
}
async function writePrivate(path, text2) {
  const tmp = `${path}.${process.pid}.tmp`;
  await (0, import_promises13.writeFile)(tmp, text2, { mode: 384 });
  await (0, import_promises13.rename)(tmp, path);
}
function menuWatcher(o) {
  let done = false;
  let busy = false;
  return (line) => {
    o.err(line);
    if (done || busy || o.setMenu === void 0) return;
    busy = true;
    void (async () => {
      const run10 = await o.deps.currentRun(o.root);
      const surface = run10?.surfaces.find((s) => s.url !== void 0 && (o.setMenu?.surface === void 0 || s.name === o.setMenu.surface));
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
  const plan2 = await planWorktree(o);
  const allowed2 = (name) => name.startsWith(plan2.prefix);
  const admin = await o.deps.admin(plan2.baseUrl, allowed2);
  const copyUrl = urlWithDatabase(plan2.baseUrl, plan2.copy);
  const original = await readTextOrNull(plan2.envFile) ?? "";
  let code = 1;
  try {
    o.out(`worktree ${plan2.checkout.toplevel}`);
    if (await admin.exists(plan2.copy)) o.out(`reusing ${plan2.copy}`);
    else {
      o.out(`copying ${plan2.source} to ${plan2.copy}`);
      await admin.create(plan2.copy, plan2.source);
    }
    await writePrivate(plan2.envFile, setEnvLine(original, "DATABASE_URL", copyUrl));
    o.out(`DATABASE_URL names ${plan2.copy}`);
    const dir = (0, import_node_path22.join)(o.root, typeof o.sections.db?.migrations === "string" ? o.sections.db.migrations : "packages/db/migrations");
    const applied = await o.deps.migrate(copyUrl, dir);
    o.out(`migrated ${plan2.copy}: ${applied.length} migration(s)`);
    code = await o.deps.runDev({ root: o.root, commonDir: plan2.checkout.commonDir, err: menuWatcher(o) });
  } finally {
    await writePrivate(plan2.envFile, original);
    try {
      if (o.keepDb) o.out(`keeping ${plan2.copy} (--keep-db)`);
      else {
        await admin.drop(plan2.copy);
        o.out(`dropped ${plan2.copy}`);
      }
    } finally {
      await admin.close();
    }
  }
  return code;
}
async function cleanupWorktrees(o) {
  const plan2 = await planWorktree(o);
  const live = /* @__PURE__ */ new Set();
  for (const run10 of await o.deps.liveRuns()) live.add(copyName(plan2.prefix, (await readCheckout(run10.checkout)).toplevel));
  const admin = await o.deps.admin(plan2.baseUrl, (name) => name.startsWith(plan2.prefix));
  const dropped = [];
  try {
    for (const name of await admin.list(plan2.prefix)) {
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
var import_promises13, import_node_path22, DEFAULT_LOCAL_ENV_FILE;
var init_worktree = __esm({
  "src/world/services/worktree.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises13 = require("fs/promises");
    import_node_path22 = require("path");
    init_kernel();
    init_fs();
    init_checkout();
    init_stack();
    DEFAULT_LOCAL_ENV_FILE = [".env", "local"].join(".");
  }
});

// src/world/index.mts
var init_world2 = __esm({
  "src/world/index.mts"() {
    "use strict";
    init_cjs_shims();
    init_app2();
    init_arming();
    init_api();
    init_fork();
    init_fork_server();
    init_checkout();
    init_clock2();
    init_discover();
    init_fixture();
    init_ids();
    init_jobs();
    init_menu();
    init_registry();
    init_stack();
    init_world();
    init_worktree();
  }
});

// src/commands/qa-session.mts
var qa_session_exports = {};
__export(qa_session_exports, {
  default: () => qa_session_default
});
function armingBuilder(opts) {
  const factory = fixtureArming;
  if (!factory) return void 0;
  return (database) => {
    let opened = null;
    const open = () => {
      opened ??= factory({ cwd: opts.cwd, out: opts.out, err: opts.err, ...opts.config ? { config: opts.config } : {}, ...opts.env ? { env: opts.env } : {}, ...database ? { database } : {} });
      return opened;
    };
    return {
      arm: async (state, o) => (await open()).arm(state, o),
      disarm: async () => {
        if (opened) await (await opened).disarm();
      }
    };
  };
}
function forkRunner(opts) {
  let built = null;
  const runner = () => built ??= (async () => {
    const ctx = await worldContext({ cwd: opts.cwd, out: opts.out, err: opts.err, ...opts.config ? { config: opts.config } : {}, ...opts.env ? { env: opts.env } : {} });
    const entry = await loadAppEntry(ctx.root, ctx.qa);
    return worldForkRunner({ root: ctx.root, sections: ctx.sections, env: ctx.env, overlay: ctx.overlay, entry, registry: ctx.registry, out: opts.out });
  })();
  return {
    create: async (label) => (await runner()).create(label),
    drop: async (name) => (await runner()).drop(name),
    serve: async (database) => (await runner()).serve(database)
  };
}
function list(value, flag3) {
  const parts = (value ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new LaunchwrightError("qa.session.usage", `${flag3} needs a comma-separated list`);
  return parts;
}
function baseFlag(value, into) {
  const match = /^(web|miniapp|bot)=(.+)$/.exec(value ?? "");
  const url = match ? match[2] : value ?? "";
  try {
    new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("qa.session.usage", `--base ${value ?? ""} is not [<surface>=]<url>`, { cause });
  }
  for (const surface of match ? [match[1]] : SURFACES) into[surface] = url;
}
function revision(cwd) {
  const commit = git(cwd, ["rev-parse", "HEAD"], { allowFail: true })?.trim();
  if (!commit) throw new LaunchwrightError("qa.session.git", `${cwd} has no commit. The ledger names the commit of each file.`);
  const status = git(cwd, ["status", "--porcelain"], { allowFail: true }) ?? "";
  return { commit, dirty: status.trim() !== "" };
}
function dataNeeds(shots) {
  const needs = [];
  const armed = new Set(shots.filter((shot) => forkLabel(shot) === void 0).flatMap((shot) => shot.fixture.arm));
  if (armed.size > 0) needs.push({ id: "qa-world-arm", title: `Arm ${armed.size} state(s) on the QA world database, then disarm them` });
  const labels = [...new Set(shots.map(forkLabel).filter((label) => label !== void 0))].sort();
  if (labels.length > 0) needs.push({ id: "qa-database-fork", title: `Fork the QA database for row group(s) ${labels.join(", ")}, then drop each fork` });
  return needs;
}
async function consentManifest(planPath, config, filter, targets) {
  const defs = legDefinitions(config);
  const byName = new Map(defs.map((leg) => [leg.name, leg]));
  const plan2 = await loadManifest(planPath, { legs: defs.map((leg) => leg.name) });
  const used = /* @__PURE__ */ new Set();
  const shots = [];
  for (const shot of plan2.shots) {
    if (filter.only && !filter.only.includes(shot.id)) continue;
    const names = shot.legs.filter((name) => !filter.legs || filter.legs.includes(name));
    if (names.length > 0) shots.push(shot);
    for (const name of names) used.add(name);
  }
  const legs = [...used].map((name) => byName.get(name)).filter((leg) => leg !== void 0);
  const registered = new Set(targets.names());
  const credentials = [];
  const outward = [];
  const data = dataNeeds(shots);
  for (const leg of legs) {
    if (!registered.has(leg.target)) continue;
    const needs = targets.get(leg.target).needs?.(leg);
    credentials.push(...needs?.credentials ?? []);
    outward.push(...needs?.outward ?? []);
    data.push(...needs?.data ?? []);
  }
  return computeManifest({ title: plan2.title, legs, credentials, outward, data });
}
async function run(args, opts, config) {
  const parsed = parseCommandArgs({ values: ["legs", "only"], switches: ["allow-all"], repeated: ["base", "allow"] }, args);
  const [manifestArg, extra] = parsed.positionals;
  if (!manifestArg) throw new LaunchwrightError("qa.session.usage", "run needs a plan path");
  if (extra !== void 0) throw new LaunchwrightError("qa.session.usage", `run does not know ${extra}`);
  const legs = parsed.values.legs === void 0 ? null : list(parsed.values.legs, "--legs");
  const only = parsed.values.only === void 0 ? null : list(parsed.values.only, "--only");
  const baseUrls = { ...config.baseUrls };
  for (const value of parsed.lists.base) baseFlag(value, baseUrls);
  const manifestPath = (0, import_node_path23.resolve)(opts.cwd, manifestArg);
  const targets = createTargetRegistry(config, opts.targets ?? {}, systemClock);
  const contract = await consentManifest(manifestPath, config, { legs, only }, targets);
  const choice = { allowAll: parsed.switches.has("allow-all"), allow: parsed.lists.allow };
  if (!await consentGate(contract, { cwd: opts.cwd, out: opts.out, err: opts.err, ...choice })) return 2;
  const build = armingBuilder(opts);
  const fixtures = build?.();
  const summary = await runManifest(
    { manifestPath, legs, only },
    {
      config,
      targets,
      clock: systemClock,
      baseUrls,
      revision: revision(opts.cwd),
      videoTools: systemVideoTools(),
      ...fixtures ? { fixtures } : {},
      fork: forkRunner(opts),
      out: opts.out,
      err: opts.err
    }
  );
  const count = (status) => summary.results.filter((r) => r.status === status).length;
  opts.out(
    `lw qa session run: ${summary.results.length} row and leg pairs: ${count("passed")} passed, ${count("failed")} failed, ${count("n/a")} n/a, ${count("not-run")} not run. Next: lw qa report update ${config.reportDir}/${summary.slug}.md`
  );
  return summary.exitCode;
}
var import_node_fs10, import_node_path23, USAGE2, SURFACES, session, qa_session_default;
var init_qa_session = __esm({
  "src/commands/qa-session.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs10 = require("fs");
    import_node_path23 = require("path");
    init_kernel();
    init_args();
    init_config2();
    init_changes();
    init_consent_gate();
    init_contract();
    init_legs();
    init_manifest2();
    init_resolve();
    init_runner();
    init_targets();
    init_video();
    init_world2();
    init_context();
    init_fork_server();
    USAGE2 = [
      "usage: lw qa session resolve <spec.md>",
      "       lw qa session resolve --issue <id> [<id> ...]",
      "       lw qa session check <plan.shots.json>",
      "       lw qa session run <plan.shots.json> [--legs a,b] [--only <id>,<id>] [--base [<surface>=]<url>]... [--allow-all] [--allow <item-id>]...",
      "  resolve   what the spec promised and what was built, or one row seed per intake issue, as JSON",
      "  check     validate a plan and print every problem",
      "  run       run every row on every leg, record the evidence, write the ledger and results.jsonl",
      "  --allow-all   grant every item of the run contract that the pass prints, so a rerun asks nothing (spec 2.6)",
      "  --allow <id>  grant one printed item, for example data:qa-world-arm; repeat it per item"
    ];
    SURFACES = ["web", "miniapp", "bot"];
    session = {
      name: "session",
      summary: "Resolve a spec or intake issues, check a plan, run a plan with evidence",
      async run(args, opts) {
        const [action, ...rest] = args;
        const config = qaConfigOf(opts.config);
        const legs = legDefinitions(config);
        try {
          const resolveArgs = action === "resolve" ? parseCommandArgs({ switches: ["issue"] }, rest) : null;
          if (resolveArgs?.switches.has("issue")) {
            const ids = resolveArgs.positionals;
            if (ids.length === 0) throw new UsageError("resolve --issue needs one issue id or more");
            const names = legs.map((l) => l.name);
            opts.out(JSON.stringify({ issues: ids.map((id) => resolveIssue(opts.cwd, id, names)) }, null, 2));
            return 0;
          }
          if (resolveArgs?.positionals.length === 1) {
            const repo = repoRoot(opts.cwd);
            const result = resolveSpec({
              repo,
              cwd: opts.cwd,
              specPath: resolveArgs.positionals[0],
              reportDir: config.reportDir,
              clientRoots: config.clientRoots,
              legs,
              clock: systemClock
            });
            opts.out(JSON.stringify(result, null, 2));
            return 0;
          }
          if (action === "check" && rest.length === 1) {
            const path = (0, import_node_path23.resolve)(opts.cwd, rest[0]);
            let parsed;
            try {
              parsed = JSON.parse((0, import_node_fs10.readFileSync)(path, "utf8"));
            } catch (cause) {
              throw new LaunchwrightError("qa.session.check", `Cannot read ${rest[0]} as JSON.`, { cause });
            }
            const errors = validateManifest(parsed, { legs: legs.map((l) => l.name) });
            if (errors.length > 0) {
              opts.err(`${rest[0]} is invalid: ${errors.length} problem(s)`);
              for (const e of errors) opts.err(`  ${e}`);
              return 1;
            }
            const shots = parsed.shots;
            const used = new Set(shots.flatMap((s) => s.legs));
            opts.out(`ok  ${rest[0]}: ${shots.length} row(s), legs ${legs.filter((l) => used.has(l.name)).map((l) => l.name).join(" ")}`);
            return 0;
          }
          if (action === "run") return await run(rest, opts, config);
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa session ${action}: ${cause.code}: ${cause.message}`);
          return cause instanceof UsageError || cause.code === "qa.session.usage" ? 2 : 1;
        }
        for (const line of USAGE2) opts.err(line);
        return 2;
      }
    };
    qa_session_default = session;
  }
});

// src/services/sweep.mts
function invalid(message) {
  return new LaunchwrightError("qa.sweep.input", message);
}
function readWorld(parsed) {
  const entries = Array.isArray(parsed) ? parsed : isObject3(parsed) && Array.isArray(parsed.entries) ? parsed.entries : isObject3(parsed) && Array.isArray(parsed.world) ? parsed.world : isObject3(parsed) && isObject3(parsed.stamp) && Array.isArray(parsed.stamp.entries) ? parsed.stamp.entries : null;
  if (entries === null) throw invalid("The world file is not `lw qa world list --json` output: no array, and none under entries, world or stamp.entries.");
  if (entries.length === 0) throw invalid("The world declares no state, so there is nothing to sweep.");
  entries.forEach((entry, i) => {
    const at = `world[${i}]`;
    if (!isObject3(entry)) throw invalid(`${at} is not an entry`);
    if (entry.kind !== "persona" && entry.kind !== "fact") throw invalid(`${at} kind is not persona or fact`);
    for (const field of ["id", "summary", "feature"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") throw invalid(`${at} has no ${field}`);
    }
  });
  return entries;
}
function readDelivery(delivery) {
  if (!isObject3(delivery) || !Array.isArray(delivery.unions)) throw invalid("The delivery file has no unions array.");
  const out = [];
  for (const union of delivery.unions) {
    if (!isObject3(union)) continue;
    const anchor = typeof union.anchor === "string" ? union.anchor : typeof union.file === "string" ? union.file : "";
    for (const route of Array.isArray(union.routes) ? union.routes : []) {
      if (!isObject3(route) || typeof route.route !== "string") continue;
      out.push({
        route: route.route,
        surface: route.surface,
        page: typeof route.page === "string" ? route.page : "",
        distance: typeof route.distance === "number" ? route.distance : Number.MAX_SAFE_INTEGER,
        reaches: typeof route.reaches === "number" ? route.reaches : Number.MAX_SAFE_INTEGER,
        anchor
      });
    }
  }
  return out;
}
function namesFor(entry) {
  const names = [entry.feature.toLowerCase()];
  const head = entry.id.includes(".") ? (entry.id.split(".")[0] ?? "").toLowerCase() : null;
  if (head && !names.includes(head)) names.push(head);
  return names;
}
function segmentsOf(path) {
  const cut = path.indexOf("/src/");
  const tail = cut === -1 ? path : path.slice(cut + "/src/".length);
  return tail.split("/").filter((seg) => seg !== "" && !seg.startsWith(":") && !seg.startsWith("{")).flatMap((seg) => seg.split(".")).map((seg) => seg.toLowerCase()).filter((seg) => seg !== "");
}
function nameRank(candidate, names) {
  const hits = (path) => segmentsOf(path).some((seg) => names.includes(seg));
  if (hits(candidate.route)) return 0;
  if (hits(candidate.page)) return 1;
  if (hits(candidate.anchor)) return 2;
  return null;
}
function handleKeyFor(name, handles) {
  const keys = Object.keys(handles);
  const want = name.toLowerCase();
  const exact = keys.filter((key) => key.toLowerCase() === want);
  if (exact.length === 1) return exact[0];
  if (want.length < MIN_FUZZY_SEGMENT) return null;
  const near = keys.filter((key) => key.toLowerCase().includes(want));
  return near.length === 1 ? near[0] : null;
}
function handleNames(entry) {
  if (entry.handles && Object.keys(entry.handles).length > 0) return { ...entry.handles };
  return Object.fromEntries((entry.handleKeys ?? []).map((key) => [key, null]));
}
function fillRoute(routePath, handles) {
  const out = [];
  for (const seg of routePath.split("/")) {
    if (!seg.startsWith(":")) {
      out.push(seg);
      continue;
    }
    const optional = seg.endsWith("?");
    const key = handleKeyFor(seg.slice(1, optional ? -1 : void 0), handles);
    if (key !== null) {
      const value = handles[key];
      out.push(value === null || value === void 0 ? `{${key}}` : encodeURIComponent(String(value)));
    } else if (!optional) return { route: null, missing: seg };
  }
  const route = out.join("/");
  return { route: route === "" ? "/" : route, missing: null };
}
function addressesFor(entry, addresses) {
  const names = namesFor(entry);
  const byRoute = /* @__PURE__ */ new Map();
  let dropped = null;
  let named2 = 0;
  for (const address of addresses) {
    const rank = nameRank(address, names);
    if (rank === null) continue;
    named2 += 1;
    const filled = fillRoute(address.route, handleNames(entry));
    if (filled.route === null) {
      if (dropped === null || rank < dropped.rank || rank === dropped.rank && address.distance < dropped.distance) {
        dropped = { segment: filled.missing, route: address.route, rank, distance: address.distance };
      }
      continue;
    }
    const held = byRoute.get(filled.route);
    if (held === void 0) {
      byRoute.set(filled.route, { route: filled.route, surfaces: /* @__PURE__ */ new Set([address.surface]), page: address.page, rank, distance: address.distance, reaches: address.reaches });
      continue;
    }
    held.surfaces.add(address.surface);
    if (rank < held.rank || rank === held.rank && address.distance < held.distance) {
      held.rank = rank;
      held.distance = address.distance;
      held.reaches = address.reaches;
      held.page = address.page;
    }
  }
  const rows = [...byRoute.values()].sort((a, b) => a.rank - b.rank || a.distance - b.distance || a.reaches - b.reaches || a.route.localeCompare(b.route));
  return { rows, dropped, named: named2, names };
}
function screenSlug(route) {
  const parts = route.split("?")[0]?.split("/").filter((seg) => seg !== "" && !seg.startsWith("{") && !seg.startsWith(":")).map(slug).filter((seg) => seg !== "");
  return !parts || parts.length === 0 ? "home" : parts.join("-");
}
function pageName(page2) {
  const parts = page2.split("/");
  const file = parts.pop() ?? "";
  const stem = file.split(".")[0] ?? "";
  return stem === "index" ? parts.pop() ?? "" : stem;
}
function planSweep(opts) {
  const cap = opts.cap ?? DEFAULT_CAP;
  if (!Number.isInteger(cap) || cap < 1) throw invalid(`--cap must be a whole number of addresses above 0, got ${cap}`);
  const entries = readWorld(opts.world);
  const addresses = readDelivery(opts.delivery);
  const spec = opts.spec ?? "qa.world";
  const browserLegs = opts.legs.filter((l) => l.target === "playwright");
  const shots = [];
  const owed = [];
  const covered = [];
  const taken = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    const { rows, dropped, named: named2, names } = addressesFor(entry, addresses);
    const naming = names.map((n) => `"${n}"`).join(" or ");
    const legsOf = (surfaces) => browserLegs.filter((l) => surfaces.has(l.surface)).map((l) => l.name);
    const usable = rows.filter((r) => legsOf(r.surfaces).length > 0);
    if (usable.length === 0) {
      const noSeed = named2 > 0 && dropped !== null;
      owed.push({
        kind: entry.kind,
        id: entry.id,
        feature: entry.feature,
        reason: noSeed ? "no-seed" : "no-route",
        why: noSeed ? `every address that names ${naming} is dynamic and no handle fills ${dropped.segment}, so the world owes this state a seed` : `no route, page or component of the delivery map names ${naming} on a surface with a browser leg`
      });
      continue;
    }
    const chosen = usable.slice(0, cap);
    const ids = [];
    for (const address of chosen) {
      let id = `${screenSlug(address.route)}.${slug(entry.id)}`;
      while (taken.has(id)) id = `${id}-b`;
      taken.add(id);
      shots.push({
        id,
        screen: pageName(address.page) || screenSlug(address.route),
        state: entry.summary.trim(),
        ...opts.specRef ? { specRef: opts.specRef } : {},
        source: [`spec:${spec}#${entry.id}`],
        legs: legsOf(address.surfaces),
        route: address.route,
        fixture: entry.kind === "persona" ? { arm: [], persona: entry.id } : { arm: [], facts: [entry.id] },
        settle: { busy: true, timeout: SETTLE_TIMEOUT_MS },
        expect: `${address.route} as ${entry.id}: ${entry.summary.trim().replace(/\.$/, "")}. Judge whether the screen shows that state.`
      });
      ids.push(id);
    }
    const first = chosen[0];
    covered.push({
      kind: entry.kind,
      id: entry.id,
      feature: entry.feature,
      shots: ids,
      addresses: usable.length,
      // A state shot at a weaker address than its best one, because the best one needs a handle.
      ...dropped !== null && (dropped.rank < first.rank || dropped.rank === first.rank && dropped.distance < first.distance) ? { droppedDynamic: dropped.route, droppedSegment: dropped.segment } : {}
    });
  }
  if (covered.length + owed.length !== entries.length) {
    throw new LaunchwrightError("qa.sweep.count", `${covered.length} covered and ${owed.length} owed is not ${entries.length} declared.`);
  }
  return {
    title: opts.title ?? "QA sweep of the world registry",
    generated: opts.generated,
    spec,
    commits: [],
    shots,
    sweep: {
      cap,
      declared: entries.length,
      covered: covered.length,
      owed: owed.length,
      personas: entries.filter((e) => e.kind === "persona").length,
      facts: entries.filter((e) => e.kind === "fact").length,
      states: covered,
      owedStates: owed
    }
  };
}
function renderSweep(manifest) {
  const s = manifest.sweep;
  const out = [
    `world: ${s.declared} state(s) declared: ${s.personas} persona(s), ${s.facts} fact(s)`,
    `plan:  ${manifest.shots.length} row(s) over ${s.covered} state(s), at most ${s.cap} address(es) each`
  ];
  for (const state of s.states) {
    const lost = state.droppedDynamic ? `  (${state.droppedDynamic} needs a handle for ${state.droppedSegment})` : "";
    out.push(`  ${state.id.padEnd(28)} ${state.shots.join(" ")}${lost}`);
  }
  out.push(`owed:  ${s.owed} state(s)`);
  for (const row of s.owedStates) out.push(`  ${row.reason.padEnd(9)} ${row.id.padEnd(28)} ${row.feature.padEnd(12)} ${row.why}`);
  return out.join("\n");
}
var DEFAULT_CAP, SETTLE_TIMEOUT_MS, MIN_FUZZY_SEGMENT, isObject3, slug;
var init_sweep = __esm({
  "src/services/sweep.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    DEFAULT_CAP = 2;
    SETTLE_TIMEOUT_MS = 2e4;
    MIN_FUZZY_SEGMENT = 3;
    isObject3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    slug = (text2) => text2.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
});

// src/commands/qa-sweep.mts
var qa_sweep_exports = {};
__export(qa_sweep_exports, {
  default: () => qa_sweep_default
});
function inputJson(cwd, path, what) {
  const at = (0, import_node_path24.resolve)(cwd, path);
  const raw = readTextOrNullSync(at);
  if (raw === null) throw new LaunchwrightError("qa.sweep.input", `Cannot read the ${what} file ${at}.`);
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError("qa.sweep.input", `The ${what} file ${at} is not JSON.`, { cause });
  }
}
var import_node_fs11, import_node_path24, USAGE3, VALUE_FLAGS, sweep, qa_sweep_default;
var init_qa_sweep = __esm({
  "src/commands/qa-sweep.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs11 = require("fs");
    import_node_path24 = require("path");
    init_kernel();
    init_args();
    init_fs();
    init_config2();
    init_legs();
    init_manifest2();
    init_sweep();
    USAGE3 = [
      "usage: lw qa sweep plan --world <world.json> --delivery <delivery.json> [--out <plan.shots.json>]",
      `         [--cap <n>] [--spec <path>] [--title <text>] [--spec-ref <n.n>] [--strict]`,
      "  --world      lw qa world list --json, or lw qa world status --json for seeded handle values",
      "  --delivery   the route map of lw qa states scan",
      `  --cap        addresses per state, default ${DEFAULT_CAP}`,
      "  --strict     exit 1 when a state is owed"
    ];
    VALUE_FLAGS = ["world", "delivery", "out", "cap", "spec", "title", "spec-ref"];
    sweep = {
      name: "sweep",
      summary: "Plan one row per world state and address from the world registry and the delivery map",
      async run(args, opts) {
        const [action, ...rest] = args;
        let parsed;
        try {
          parsed = parseCommandArgs({ values: VALUE_FLAGS, switches: ["strict"] }, rest);
        } catch (cause) {
          if (!(cause instanceof UsageError)) throw cause;
          parsed = void 0;
        }
        const flags = parsed?.values ?? {};
        if (action !== "plan" || !parsed || parsed.positionals.length > 0 || flags.world === void 0 || flags.delivery === void 0) {
          for (const line of USAGE3) opts.err(line);
          return 2;
        }
        const strict = parsed.switches.has("strict");
        const config = qaConfigOf(opts.config);
        const legs = legDefinitions(config);
        try {
          const cap = flags.cap !== void 0 ? Number(flags.cap) : DEFAULT_CAP;
          const manifest = planSweep({
            world: inputJson(opts.cwd, flags.world, "world"),
            delivery: inputJson(opts.cwd, flags.delivery, "delivery"),
            legs,
            cap,
            generated: systemClock.date().toISOString(),
            ...flags.spec !== void 0 ? { spec: flags.spec } : {},
            ...flags.title !== void 0 ? { title: flags.title } : {},
            ...flags["spec-ref"] !== void 0 ? { specRef: flags["spec-ref"] } : {}
          });
          const errors = validateManifest(manifest, { legs: legs.map((l) => l.name) });
          if (errors.length > 0) {
            opts.err("lw qa sweep: the plan is not a valid manifest");
            for (const e of errors) opts.err(`  ${e}`);
            return 1;
          }
          const json = `${JSON.stringify(manifest, null, 2)}
`;
          const out = flags.out;
          if (out) {
            const target = (0, import_node_path24.resolve)(opts.cwd, out);
            (0, import_node_fs11.mkdirSync)((0, import_node_path24.dirname)(target), { recursive: true });
            (0, import_node_fs11.writeFileSync)(target, json);
            opts.out(`${renderSweep(manifest)}
plan -> ${target}`);
          } else {
            opts.out(json.trimEnd());
            opts.err(renderSweep(manifest));
          }
          return strict && manifest.sweep.owed > 0 ? 1 : 0;
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa sweep: ${cause.message}`);
          return 1;
        }
      }
    };
    qa_sweep_default = sweep;
  }
});

// src/services/findings.mts
function parseFindings(lines2, from = 0, to = lines2.length) {
  const out = [];
  let fence = false;
  for (let i = from; i < to; i += 1) {
    const line = lines2[i].trim();
    if (line.startsWith("```")) fence = !fence;
    if (fence) continue;
    const m = FINDING_RE.exec(line);
    if (!m) continue;
    const rest = m[2].trim();
    const t = TAG_RE.exec(rest);
    const tag = t ? t[1].trim().toLowerCase() : null;
    out.push({ line: i, status: m[1], tag, severity: tag !== null && isSeverity(tag) ? tag : null, claim: t ? t[2].trim() : rest });
  }
  return out;
}
function tallyFindings(findings) {
  const confirmed = { critical: 0, high: 0, medium: 0, low: 0 };
  let suspected = 0;
  for (const f of findings) {
    if (f.status === "SUSPECTED") suspected += 1;
    else if (f.severity) confirmed[f.severity] += 1;
  }
  return { confirmed, suspected };
}
function findingProblems(findings) {
  const out = [];
  const form = `"CONFIRMED [${SEVERITIES.join("|")}] <claim>"`;
  for (const f of findings) {
    const at = `line ${f.line + 1}`;
    if (f.tag !== null && f.severity === null) out.push(`${at}: the ${f.status} finding has the tag [${f.tag}], which is not a severity. Write ${form}.`);
    else if (f.status === "CONFIRMED" && f.tag === null) out.push(`${at}: the CONFIRMED finding "${f.claim}" has no severity tag. Write ${form}.`);
  }
  return out;
}
var SEVERITIES, FINDING_RE, TAG_RE, isSeverity;
var init_findings = __esm({
  "src/services/findings.mts"() {
    "use strict";
    init_cjs_shims();
    SEVERITIES = ["critical", "high", "medium", "low"];
    FINDING_RE = /^(?:[-*+]\s+|#{3,6}\s+)?\**(CONFIRMED|SUSPECTED)\b\**:?\s*(.*)$/;
    TAG_RE = /^\[([^\]]*)\]\s*(.*)$/;
    isSeverity = (tag) => SEVERITIES.includes(tag);
  }
});

// src/services/report-score.mts
function runFacts(input) {
  const pairs = plannedPairs(input.manifest);
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const provenances = /* @__PURE__ */ new Map();
  const withFile = /* @__PURE__ */ new Set();
  for (const e of input.entries) {
    const key = pairKey(e.row, e.leg);
    const set = provenances.get(key) ?? /* @__PURE__ */ new Set();
    set.add(e.provenance);
    provenances.set(key, set);
    if (e.kind === "screenshot" || e.kind === "step" || e.kind === "video") withFile.add(key);
  }
  const facts = { pairs: pairs.length, covered: 0, evidenced: 0, ran: 0, pageErrors: 0 };
  for (const { shot, leg } of pairs) {
    const key = pairKey(shot.id, leg);
    const provs = provenances.get(key);
    if (provs?.has("live") || provs?.has("mounted")) facts.covered += 1;
    const r = latest.get(key);
    if (r) facts.ran += 1;
    if (r?.status === "passed" && withFile.has(key)) facts.evidenced += 1;
    if (r?.failures.includes("page-error")) facts.pageErrors += 1;
  }
  return facts;
}
function inputOf(facts, findings) {
  if (facts.pairs === 0) return {};
  const out = { coverage: facts.covered / facts.pairs, evidence: facts.evidenced / facts.pairs };
  if (facts.ran > 0) out.consoleErrors = facts.pageErrors;
  if (facts.ran > 0 && findings) out.findings = findings.confirmed;
  return out;
}
function findingsNote(findings, ran) {
  if (!findings) return "untested: the section 4 findings were not read";
  if (ran === 0) return "untested: no row ran";
  const c = findings.confirmed;
  const total = c.critical + c.high + c.medium + c.low;
  const levels = ["critical", "high", "medium", "low"].filter((s) => c[s] > 0).map((s) => `${c[s]} ${s}`);
  const confirmed = total === 0 ? "no CONFIRMED finding" : `${total} CONFIRMED (${levels.join(", ")})`;
  return findings.suspected > 0 ? `${confirmed}; ${findings.suspected} SUSPECTED, not scored` : confirmed;
}
function reportScore(input, weights = {}) {
  const facts = runFacts(input);
  const scoreInput = inputOf(facts, input.findings);
  if (Object.keys(scoreInput).length === 0) return null;
  const result = computeScore(scoreInput, weights);
  const notRun = "untested: no row ran";
  const notes = {
    findings: findingsNote(input.findings, facts.ran),
    console: facts.ran === 0 ? notRun : `${facts.pageErrors} of ${facts.ran} row legs that ran had a page error`,
    coverage: `${facts.covered} of ${facts.pairs} row legs live or mounted`,
    evidence: `${facts.evidenced} of ${facts.pairs} row legs passed with a file`,
    accessibility: "untested: the ledger holds no accessibility finding",
    performance: "untested: the ledger holds no timing measure"
  };
  return { input: scoreInput, result, rows: scoreRows(result, weights, notes) };
}
var init_report_score = __esm({
  "src/services/report-score.mts"() {
    "use strict";
    init_cjs_shims();
    init_evidence();
    init_findings();
    init_ledger();
    init_score();
  }
});

// src/render/services/spec-render.mts
function templateDir() {
  let dir = (0, import_node_path25.dirname)((0, import_node_url5.fileURLToPath)(importMetaUrl));
  let packageRoot = null;
  for (let up = 0; up <= TEMPLATE_SEARCH_DEPTH; up += 1) {
    const candidate = (0, import_node_path25.join)(dir, "assets", "renderer");
    if ((0, import_node_fs12.existsSync)((0, import_node_path25.join)(candidate, "spec-template.html"))) return candidate;
    if (packageRoot === null && (0, import_node_fs12.existsSync)((0, import_node_path25.join)(dir, "package.json"))) packageRoot = dir;
    dir = (0, import_node_path25.dirname)(dir);
  }
  return (0, import_node_path25.join)(packageRoot ?? (0, import_node_path25.dirname)((0, import_node_url5.fileURLToPath)(importMetaUrl)), "assets", "renderer");
}
function asBlock(html) {
  return LONE_IMAGE_RE.test(html) ? `<figure class="figure">${html}</figure>` : `<p>${html}</p>`;
}
function domainOf(sourceName) {
  const match = DOMAIN_RE.exec(posixify(sourceName));
  const found = match ? DOMAINS.find((domain) => domain.dir === match[1]) : void 0;
  if (!found) {
    throw new SpecError(
      `${sourceName}: not under ${DOMAINS.map((domain) => `${domain.dir}/`).join(", ")}, so it has no document kind`
    );
  }
  return found;
}
function assetPrefixFor(sourceName) {
  const domain = domainOf(sourceName);
  const posix6 = posixify(sourceName);
  const relative11 = posix6.slice(posix6.indexOf(`${domain.dir}/`) + domain.dir.length + 1);
  return "../".repeat(relative11.split("/").length);
}
function imageProblem(url) {
  if (/^data:/i.test(url)) {
    return `an inline data: image belongs in the domain's assets/, where it can be seen and reused`;
  }
  if (!/^assets\/[^/]/.test(url)) return `an image must be referenced as assets/<file>, not '${url}'`;
  return null;
}
function checkImages(line, fail) {
  for (const match of line.matchAll(IMAGE_RE)) {
    const problem = imageProblem(match[2]);
    if (problem) fail(problem);
  }
}
function esc(text2, quote2 = false) {
  const out = text2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return quote2 ? out.replace(/"/g, "&quot;").replace(/'/g, "&#x27;") : out;
}
function slug2(text2) {
  return text2.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function plain(text2) {
  return text2.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}
function emphasis(text2) {
  let out = text2.replace(/\*\*(.+?)\*\*/g, (_m, inner) => `<strong>${emphasis(inner)}</strong>`);
  out = out.replace(/~~(.+?)~~/g, "<s>$1</s>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/(?<![A-Za-z0-9_])_(.+?)_(?![A-Za-z0-9_])/g, "<em>$1</em>");
  return out;
}
function splitCodeSpans(text2) {
  const pieces = [];
  let buffer = "";
  let i = 0;
  const runLength = (at) => {
    let n = 0;
    while (text2[at + n] === "`") n += 1;
    return n;
  };
  while (i < text2.length) {
    if (text2[i] !== "`") {
      buffer += text2[i];
      i += 1;
      continue;
    }
    const open = runLength(i);
    const contentStart = i + open;
    let j = contentStart;
    let close = -1;
    while (j < text2.length) {
      if (text2[j] !== "`") {
        j += 1;
        continue;
      }
      const run10 = runLength(j);
      if (run10 === open) {
        close = j;
        break;
      }
      j += run10;
    }
    if (close === -1) {
      buffer += text2.slice(i, contentStart);
      i = contentStart;
      continue;
    }
    if (buffer) {
      pieces.push({ code: false, text: buffer });
      buffer = "";
    }
    let content2 = text2.slice(contentStart, close);
    if (content2.length > 1 && content2.startsWith(" ") && content2.endsWith(" ") && content2.trim()) {
      content2 = content2.slice(1, -1);
    }
    pieces.push({ code: true, text: content2 });
    i = close + open;
  }
  if (buffer) pieces.push({ code: false, text: buffer });
  return pieces;
}
function withoutCodeSpans(text2) {
  return splitCodeSpans(text2).filter((piece) => !piece.code).map((piece) => piece.text).join("");
}
function inline(text2, assetPrefix = "") {
  const codes = [];
  const links = [];
  let staged = "";
  for (const piece of splitCodeSpans(text2)) {
    if (piece.code) {
      codes.push(piece.text);
      staged += `\0${codes.length - 1}\0`;
    } else {
      staged += piece.text;
    }
  }
  staged = staged.replace(IMAGE_RE, (_m, alt, url) => {
    const problem = imageProblem(url);
    if (problem) throw new SpecError(problem);
    const src = esc(assetPrefix + url, true);
    links.push(
      VIDEO_RE.test(url) ? (
        // `playsinline` so iOS does not take the recording fullscreen, `preload="metadata"` so a
        // page of ten recordings costs ten headers rather than ten files, and `alt` becomes the
        // fallback sentence for a browser that will not play it.
        `<video src="${src}" controls playsinline preload="metadata">${esc(alt)}</video>`
      ) : `<img src="${src}" alt="${esc(alt, true)}" loading="lazy">`
    );
    return `${links.length - 1}`;
  });
  staged = staged.replace(MD_LINK_RE, (_m, label, url) => {
    const href = /^assets\/[^/]/.test(url) ? assetPrefix + url : url;
    links.push(`<a href="${esc(href, true)}">${emphasis(esc(label))}</a>`);
    return `${links.length - 1}`;
  });
  staged = esc(staged);
  staged = emphasis(staged);
  staged = staged.replace(/\u0001(\d+)\u0001/g, (_m, n) => links[Number(n)]);
  staged = staged.replace(/\u0000(\d+)\u0000/g, (_m, n) => `<code>${esc(codes[Number(n)])}</code>`);
  return staged;
}
function renderBody(input) {
  return new Renderer([...input.lines], input.source, input.bodyStart, input.assetPrefix).run();
}
var import_node_fs12, import_node_path25, import_node_url5, TEMPLATE_SEARCH_DEPTH, TEMPLATE_DIR, TEMPLATE, STATUS_VALUES, IMAGE_RE, MD_LINK_RE, LONE_IMAGE_RE, VIDEO_RE, SpecError, DOMAINS, DOMAIN_RE, posixify, indentOf, opensBlock, FENCE_LEAVES_ITEM, Renderer;
var init_spec_render = __esm({
  "src/render/services/spec-render.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs12 = require("fs");
    import_node_path25 = require("path");
    import_node_url5 = require("url");
    TEMPLATE_SEARCH_DEPTH = 5;
    TEMPLATE_DIR = templateDir();
    TEMPLATE = (0, import_node_path25.join)(TEMPLATE_DIR, "spec-template.html");
    STATUS_VALUES = [
      "draft",
      "approved",
      "in-progress",
      "analysis",
      "blocked",
      "implemented",
      "superseded-by",
      "abandoned",
      "answered"
    ];
    IMAGE_RE = /!\[([^\]]*)\]\(([^)]*)\)/g;
    MD_LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;
    LONE_IMAGE_RE = /^<(?:img [^>]*>|video [^>]*>[^<]*<\/video>)$/;
    VIDEO_RE = /\.(?:mp4|webm)$/i;
    SpecError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "SpecError";
      }
    };
    DOMAINS = [
      { dir: "docs/specs", kind: "spec", label: "SPECIFICATION", statuses: STATUS_VALUES },
      { dir: "docs/superpowers/plans", kind: "plan", label: "PLAN", statuses: STATUS_VALUES }
    ];
    DOMAIN_RE = /(?:^|\/)(docs\/specs|docs\/superpowers\/plans)\//;
    posixify = (path) => path.split("\\").join("/");
    indentOf = (line) => line.length - line.replace(/^\s+/, "").length;
    opensBlock = (line) => /^(```|>)/.test(line.trimStart());
    FENCE_LEAVES_ITEM = "a fenced code block in a list item has a line at or left of the item marker. Indent every line of the block, the closing fence too, under the item text, or end the list with a blank line and start the fence at the left margin below it";
    Renderer = class {
      i = 0;
      out = [];
      tocEntries = [];
      anchors = /* @__PURE__ */ new Set();
      /**
       * @param start how many lines of `sourceName` were consumed by the header block, so a
       * 0-based index into `lines` reports as the real 1-based line of the source file.
       */
      lines;
      sourceName;
      start;
      assetPrefix;
      // Plain fields, not parameter properties, so node runs this file with type stripping alone.
      constructor(lines2, sourceName, start = 0, assetPrefix = assetPrefixFor(sourceName)) {
        this.lines = lines2;
        this.sourceName = sourceName;
        this.start = start;
        this.assetPrefix = assetPrefix;
      }
      peek() {
        return this.i < this.lines.length ? this.lines[this.i] : null;
      }
      run() {
        while (this.i < this.lines.length) {
          const line = this.lines[this.i];
          if (!line.trim()) this.i += 1;
          else if (line.startsWith("```")) this.out.push(this.code());
          else if (line.startsWith(">")) this.out.push(this.quote());
          else if (line.startsWith("#")) this.heading();
          else if (line.startsWith("| ")) this.table();
          else if (/^- /.test(line)) this.ulist(0);
          else if (/^\d+\. /.test(line)) this.olist(0);
          else this.para();
        }
        return { body: this.out.join("\n"), toc: this.tocEntries };
      }
      fail(index, message) {
        throw new SpecError(`${this.sourceName}:${this.start + index + 1}: ${message}`);
      }
      /** Refuse what this renderer cannot express, rather than emit a silently wrong page. */
      checkLine(line, index) {
        checkImages(withoutCodeSpans(line), (message) => this.fail(index, message));
      }
      /**
       * A slug unique within this render.
       *
       * Two headings with identical text otherwise emit the same id, and every rail link aimed
       * at the second scrolls to the first. `slug()` has no memory of what it already emitted;
       * this is that memory, appending `-2`, `-3`, ... on a collision.
       */
      anchor(text2) {
        const base = slug2(text2);
        let anchor = base;
        let n = 2;
        while (this.anchors.has(anchor)) {
          anchor = `${base}-${n}`;
          n += 1;
        }
        this.anchors.add(anchor);
        return anchor;
      }
      heading() {
        const index = this.i;
        const line = this.lines[this.i];
        this.i += 1;
        this.checkLine(line, index);
        const level = line.length - line.replace(/^#+/, "").length;
        const text2 = line.slice(level).trim();
        const numbered = /^(\d+(?:\.\d+)*)(\.?)\s+(.*)$/.exec(text2);
        const anchor = this.anchor(text2);
        const eyebrow = numbered ? numbered[1] : "";
        const dot = numbered ? numbered[2] : "";
        const title = numbered ? numbered[3] : text2;
        if (level === 2) this.tocEntries.push({ anchor, eyebrow, title });
        const eb = eyebrow ? `<span class="eyebrow">${eyebrow}${dot} </span>` : "";
        this.out.push(
          `<h${level} id="${anchor}" class="h${level}${eyebrow ? "" : " no-eyebrow"}">${eb}${inline(title, this.assetPrefix)}</h${level}>`
        );
      }
      para() {
        this.checkLine(this.lines[this.i], this.i);
        const buffer = [this.lines[this.i].trim()];
        this.i += 1;
        for (; ; ) {
          const next = this.peek();
          if (next === null || !next.trim() || /^(```|#|\||- |\d+\. |>)/.test(next)) break;
          this.checkLine(next, this.i);
          buffer.push(next.trim());
          this.i += 1;
        }
        this.out.push(asBlock(inline(buffer.join(" "), this.assetPrefix)));
      }
      /** A blockquote. In a list item, `marker` is the column of the item marker: each line sits
       * right of it, and its indent is stripped. */
      quote(marker = -1) {
        const buffer = [];
        for (; ; ) {
          const line = this.peek();
          if (line === null || marker >= 0 && indentOf(line) <= marker) break;
          const text2 = marker >= 0 ? line.trimStart() : line;
          if (!text2.startsWith(">")) break;
          this.checkLine(line, this.i);
          const stripped = text2.replace(/^>\s?/, "").trim();
          if (stripped) buffer.push(stripped);
          this.i += 1;
        }
        return `<blockquote><p>${inline(buffer.join(" "), this.assetPrefix)}</p></blockquote>`;
      }
      /** A fenced code block. In a list item, `marker` is the column of the item marker. Each body
       * line loses the indent of the opening fence, as in CommonMark, and a line at or left of the
       * marker is refused. */
      code(marker = -1) {
        const opening = this.lines[this.i];
        const width = marker >= 0 ? indentOf(opening) : 0;
        const lang = opening.slice(width + 3).trim() || "text";
        this.i += 1;
        const body = [];
        for (; ; ) {
          const line = this.peek();
          if (line === null) break;
          if (marker >= 0 && line.trim() && indentOf(line) <= marker) this.fail(this.i, FENCE_LEAVES_ITEM);
          const text2 = line.slice(Math.min(width, indentOf(line)));
          if ((marker >= 0 ? text2.trimStart() : text2).startsWith("```")) break;
          body.push(text2);
          this.i += 1;
        }
        this.i += 1;
        return `<div class="code" data-lang="${esc(lang, true)}"><pre><code>${esc(body.join("\n"))}</code></pre></div>`;
      }
      table() {
        const rows = [];
        for (; ; ) {
          const line = this.peek();
          if (line === null || !line.startsWith("|")) break;
          this.checkLine(line, this.i);
          rows.push(
            line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell4) => cell4.trim())
          );
          this.i += 1;
        }
        const head = rows[0];
        const body = rows.slice(2);
        const th = head.map((cell4) => `<th>${inline(cell4, this.assetPrefix)}</th>`).join("");
        const trs = body.map((row) => `<tr>${row.map((cell4) => `<td>${inline(cell4, this.assetPrefix)}</td>`).join("")}</tr>`).join("");
        this.out.push(`<div class="scroller"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`);
      }
      /** Consume one list item's own text, including the lines it wraps onto. Any list marker
       * ends it, at any indent: a shallower one is the next item, a deeper one is a nested list,
       * and `itemBlocks` takes both. */
      itemText(indent, marker) {
        const index = this.i;
        const line = this.lines[this.i];
        this.checkLine(line, index);
        const text2 = line.trim().replace(marker, "");
        this.i += 1;
        const cont = [];
        for (; ; ) {
          const next = this.peek();
          if (next === null || !next.trim()) break;
          if (/^\s*(- |\d+\. )/.test(next)) break;
          if (next.startsWith("#") || next.startsWith("|") || opensBlock(next)) break;
          this.checkLine(next, this.i);
          cont.push(next.trim());
          this.i += 1;
        }
        return [text2, ...cont].join(" ");
      }
      /**
       * The blocks that belong to an item under its own text: a nested list, a fenced code block,
       * a blockquote, and a continuation paragraph. Anything indented deeper than the item's
       * marker is part of the item and must NOT close the list.
       *
       * That last point is the whole reason this exists. An ordered list which closes and
       * reopens restarts its numbering, so a list of ten items, three of them carrying an indented
       * paragraph, rendered as a list of nine followed by a list of three, and its tenth item
       * printed as "1.". Nothing was refused and nothing looked broken.
       *
       * @returns markup to append to the still-open `<li>`.
       */
      itemBlocks(indent) {
        let html = "";
        for (; ; ) {
          let j = this.i;
          while (j < this.lines.length && !this.lines[j].trim()) j += 1;
          if (j >= this.lines.length) break;
          const next = this.lines[j];
          const cur = indentOf(next);
          if (cur <= indent) break;
          this.i = j;
          if (next.trimStart().startsWith("```")) html += this.code(indent);
          else if (next.trimStart().startsWith(">")) html += this.quote(indent);
          else if (/^\s*- /.test(next)) html += this.ulist(cur);
          else if (/^\s*\d+\. /.test(next)) html += this.olist(cur);
          else html += this.itemParagraph(indent);
        }
        return html;
      }
      /** One continuation paragraph inside a list item. It ends at a blank line, at a line no
       * deeper than the item's marker, at a nested list, or at a code block or a blockquote. */
      itemParagraph(indent) {
        const buffer = [];
        for (; ; ) {
          const line = this.peek();
          if (line === null || !line.trim() || indentOf(line) <= indent) break;
          if (buffer.length && (/^\s*(- |\d+\. )/.test(line) || opensBlock(line))) break;
          this.checkLine(line, this.i);
          buffer.push(line.trim());
          this.i += 1;
        }
        return `<p>${inline(buffer.join(" "), this.assetPrefix)}</p>`;
      }
      /** @returns the markup when `indent` is non-zero, so the caller can put it inside the
       * `<li>` that owns it; the empty string when the list is top level and already out. */
      ulist(indent) {
        const items = [];
        for (; ; ) {
          const line = this.peek();
          if (line === null) break;
          if (!line.trim()) {
            const next = this.lines[this.i + 1] ?? "";
            if (!/^\s*- /.test(next) || indentOf(next) !== indent) break;
            this.i += 1;
            continue;
          }
          if (!/^\s*- /.test(line) || indentOf(line) !== indent) break;
          items.push(`<li>${inline(this.itemText(indent, /^- /), this.assetPrefix)}${this.itemBlocks(indent)}`);
        }
        const chunk2 = `<ul>${items.map((item) => `${item}</li>`).join("")}</ul>`;
        if (indent) return chunk2;
        this.out.push(chunk2);
        return "";
      }
      /** The ordered twin of `ulist`, with the same contract. */
      olist(indent) {
        const items = [];
        for (; ; ) {
          const line = this.peek();
          if (line === null) break;
          if (!line.trim()) {
            const next = this.lines[this.i + 1] ?? "";
            if (!/^\s*\d+\. /.test(next) || indentOf(next) !== indent) break;
            this.i += 1;
            continue;
          }
          if (!/^\s*\d+\. /.test(line) || indentOf(line) !== indent) break;
          items.push(`<li>${inline(this.itemText(indent, /^\d+\. /), this.assetPrefix)}${this.itemBlocks(indent)}`);
        }
        const chunk2 = `<ol>${items.map((item) => `${item}</li>`).join("")}</ol>`;
        if (indent) return chunk2;
        this.out.push(chunk2);
        return "";
      }
    };
  }
});

// src/render/index.mts
var init_render = __esm({
  "src/render/index.mts"() {
    "use strict";
    init_cjs_shims();
    init_spec_render();
  }
});

// src/services/report.mts
function slugOf(mdPath) {
  const slug3 = (0, import_node_path26.basename)(mdPath).replace(/\.md$/, "");
  if (!mdPath.endsWith(".md") || !SLUG_RE.test(slug3)) {
    throw new LaunchwrightError("qa.report.slug", `${mdPath}: a report is <reportDir>/YYYY-MM-DD-<name>.md, with a kebab-case name`, { context: { path: mdPath } });
  }
  return slug3;
}
function computeStatus(input) {
  if (input.results.length === 0) return "planned";
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.filter((e) => e.provenance !== "forged").map((e) => pairKey(e.row, e.leg)));
  let failed = false;
  let incomplete = false;
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const key = pairKey(shot.id, leg);
    const r = latest.get(key);
    if (r?.status === "failed") failed = true;
    else if (r?.status !== "passed" || !withFiles.has(key)) incomplete = true;
  }
  if (failed) return "failed";
  return incomplete ? "partial" : "passed";
}
function parse2(text2) {
  const lines2 = text2.split("\n");
  const first = lines2.findIndex((l) => l.startsWith("## "));
  const bodyStart = first === -1 ? lines2.length : first;
  const fields = /* @__PURE__ */ new Map();
  let title = null;
  for (let i = 0; i < bodyStart; i += 1) {
    const line = lines2[i];
    if (title === null && /^#\s/.test(line)) title = line.slice(1).trim();
    const m = FIELD_RE.exec(line);
    if (m && !fields.has(m[1])) fields.set(m[1], { value: m[2].trim(), line: i });
  }
  const sections = /* @__PURE__ */ new Map();
  let fence = false;
  lines2.forEach((line, i) => {
    if (line.startsWith("```")) fence = !fence;
    if (fence) return;
    const m = SECTION_RE.exec(line);
    if (m) sections.set(Number(m[1]), [...sections.get(Number(m[1])) ?? [], i]);
  });
  return { lines: lines2, bodyStart, title, fields, sections };
}
function sectionRange(p, n) {
  const at = p.sections.get(n)?.[0];
  if (at === void 0) return null;
  let end = p.lines.length;
  for (let i = at + 1; i < p.lines.length; i += 1) {
    if (/^##\s/.test(p.lines[i])) {
      end = i;
      break;
    }
  }
  return [at + 1, end];
}
function findBlock(p, range, start, end) {
  const starts = [];
  const ends = [];
  p.lines.forEach((l, i) => {
    if (l.trim() === start) starts.push(i);
    if (l.trim() === end) ends.push(i);
  });
  if (starts.length !== 1 || ends.length !== 1) return `the report needs one ${start} and one ${end}; it has ${starts.length} and ${ends.length}`;
  const from = starts[0];
  const to = ends[0];
  if (to <= from) return `${end} comes before ${start}`;
  if (!range || from < range[0] || to >= range[1]) return `the ${start} block is not inside its section`;
  return { from, to };
}
function references(lines2) {
  const out = [];
  let fence = false;
  lines2.forEach((raw, i) => {
    if (raw.startsWith("```")) {
      fence = !fence;
      return;
    }
    if (fence) return;
    const line = raw.replace(/`[^`]*`/g, "");
    const rest = line.replace(/!\[[^\]]*\]\(([^)]*)\)/g, (_m, url) => {
      out.push({ url: url.trim(), image: true, line: i });
      return "";
    });
    for (const m of rest.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) {
      const url = m[1].trim();
      if (url.startsWith("assets/") || url.startsWith("./assets/") || url.startsWith("../") || url.includes(INTAKE_DIR)) out.push({ url, image: false, line: i });
    }
  });
  return out;
}
function rewriteLinks(lines2, fn) {
  let fence = false;
  return lines2.map((raw) => {
    if (raw.startsWith("```")) {
      fence = !fence;
      return raw;
    }
    if (fence) return raw;
    return raw.split(/(`[^`]*`)/).map((piece, i) => i % 2 === 1 ? piece : piece.replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, (m, alt, url) => fn({ alt, url: url.trim() }) ?? m)).join("");
  });
}
function intakeTarget(fromDir, root, url) {
  if (url === "" || (0, import_node_path26.isAbsolute)(url) || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#")) return null;
  const rel = (0, import_node_path26.relative)((0, import_node_path26.resolve)(root, INTAKE_DIR), (0, import_node_path26.resolve)(fromDir, url)).split(import_node_path26.sep).join("/");
  const m = /^([A-Za-z0-9._-]+)\/assets\/([^/]+)$/.exec(rel);
  if (!m || m[1] === ".." || m[2] === "..") return null;
  return { id: m[1], file: `assets/${m[2]}` };
}
function withoutIntakeLinks(text2, reportDir, root) {
  return rewriteLinks(text2.split("\n"), ({ url }) => {
    const target = intakeTarget(reportDir, root, url);
    return target ? intakeStaysLocal(target.id) : null;
  }).join("\n");
}
function reportFindings(text2) {
  const p = parse2(text2);
  const s4 = sectionRange(p, 4);
  return s4 ? parseFindings(p.lines, s4[0], s4[1]) : [];
}
function headerIssues(p) {
  return (p.fields.get("Issues")?.value ?? "").split(/[\s,]+/).filter(Boolean);
}
async function readIntakeRecord(root, id) {
  const file = (0, import_node_path26.join)(root, INTAKE_DIR, id, "issue.json");
  const text2 = await readTextOrNull(file);
  if (text2 === null) return null;
  try {
    return JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("qa.report.read", `The intake record ${INTAKE_DIR}/${id}/issue.json is not JSON`, { cause, context: { id } });
  }
}
async function walk2(dir) {
  let names;
  try {
    names = await (0, import_promises14.readdir)(dir, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.report.read", `Cannot list ${dir}`, { cause });
  }
  const out = [];
  for (const d of names) {
    if (d.isDirectory()) for (const f of await walk2((0, import_node_path26.join)(dir, d.name))) out.push(`${d.name}/${f}`);
    else out.push(d.name);
  }
  return out.sort();
}
async function loadReport(mdPath, opts = {}) {
  const slug3 = slugOf(mdPath);
  const reportDir = (0, import_node_path26.dirname)(mdPath);
  const paths = reportPaths(reportDir, slug3);
  let text2;
  try {
    text2 = await (0, import_promises14.readFile)(mdPath, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.report.read", `Cannot read the report ${mdPath}`, { cause, context: { path: mdPath } });
  }
  let manifest = null;
  let manifestErrors = [];
  let planRaw = null;
  try {
    planRaw = await (0, import_promises14.readFile)(paths.plan, "utf8");
  } catch (cause) {
    if (cause.code !== "ENOENT") throw new LaunchwrightError("qa.report.read", `Cannot read the plan ${paths.plan}`, { cause });
    manifestErrors = [`the plan ${(0, import_node_path26.basename)(paths.plan)} is missing`];
  }
  if (planRaw !== null) {
    let parsed = null;
    try {
      parsed = JSON.parse(planRaw);
    } catch (cause) {
      manifestErrors = [`the plan ${(0, import_node_path26.basename)(paths.plan)} is not JSON: ${cause.message}`];
    }
    if (manifestErrors.length === 0) {
      manifestErrors = validateManifest(parsed, opts);
      if (manifestErrors.length === 0) manifest = parsed;
    }
  }
  return { mdPath, reportDir, slug: slug3, text: text2, manifest, manifestErrors, results: await readResults(paths.results), ledger: await readLedger(paths.ledger) };
}
async function stillSizes(reportDir, entries) {
  const out = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (e.kind !== "screenshot" && e.kind !== "step") continue;
    let bytes = null;
    try {
      bytes = await (0, import_promises14.readFile)((0, import_node_path26.join)(reportDir, e.path));
    } catch (cause) {
      if (cause.code !== "ENOENT") throw new LaunchwrightError("qa.report.read", `Cannot read ${e.path}`, { cause });
    }
    out.set(e.path, bytes ? pngSize(bytes) : null);
  }
  return out;
}
async function renderEvidence(r) {
  const entries = r.ledger?.entries ?? [];
  const sizes = await stillSizes(r.reportDir, entries);
  return evidenceSection({ slug: r.slug, manifest: r.manifest, results: r.results, entries, sizeOf: (p) => sizes.get(p) ?? null });
}
async function intakeLinkProblem(input) {
  const { root, target, url, line } = input;
  const at = `line ${line + 1}: ${url}`;
  if (!input.inSection4) return `${at} links reporter media of issue ${target.id} outside section 4`;
  if (!input.issues.includes(target.id)) return `${at} links issue ${target.id}, which the Issues: header line does not list`;
  const record3 = await readIntakeRecord(root, target.id);
  if (!record3) return `${at} links issue ${target.id}, which has no record in ${INTAKE_DIR}/`;
  if (!record3.attachments.some((a) => a.path === target.file)) return `${at} is not an attachment of issue ${target.id} in its issue.json`;
  if (!("missing" !== await pathKind((0, import_node_path26.join)(root, INTAKE_DIR, target.id, target.file)))) return `${at} is missing from ${INTAKE_DIR}/${target.id}/`;
  return null;
}
function issueStatementProblems(p, manifest, entries) {
  const out = [];
  const issues = headerIssues(p);
  const s4 = sectionRange(p, 4);
  const stated = /* @__PURE__ */ new Map();
  let fence = false;
  if (s4) for (let i = s4[0]; i < s4[1]; i += 1) {
    const line = p.lines[i].trim();
    if (line.startsWith("```")) fence = !fence;
    if (fence) continue;
    const m = ISSUE_STATEMENT.exec(line);
    if (!m) {
      if (STATEMENT_LIKE.test(line)) out.push({ code: "issue-statement", message: `line ${i + 1}: "${line}" is not "- issue <id>: REPRODUCED" or "- issue <id>: NOT REPRODUCED"` });
      continue;
    }
    const id = m[1];
    if (stated.has(id)) out.push({ code: "issue-statement", message: `line ${i + 1}: issue ${id} has a second statement in section 4` });
    stated.set(id, i);
  }
  const withFiles = new Set(entries.map((e) => e.row));
  const planIssues = /* @__PURE__ */ new Set([...manifest.issues ?? [], ...manifest.shots.flatMap((s) => s.source.filter((x) => x.startsWith("issue:")).map((x) => x.slice(6)))]);
  for (const id of planIssues) {
    if (!issues.includes(id)) out.push({ code: "issue-statement", message: `the plan names issue ${id}, and the header has no Issues: line that lists it` });
  }
  for (const id of issues) {
    if (!stated.has(id)) out.push({ code: "issue-statement", message: `issue ${id} of the Issues: line has no section 4 line "- issue ${id}: REPRODUCED" or "- issue ${id}: NOT REPRODUCED"` });
  }
  for (const [id, line] of stated) {
    if (!issues.includes(id)) {
      out.push({ code: "issue-unknown", message: `line ${line + 1}: issue ${id} is not on the Issues: header line` });
      continue;
    }
    const rows = manifest.shots.filter((s) => s.source.includes(`issue:${id}`)).map((s) => s.id);
    if (!rows.some((row) => withFiles.has(row))) {
      out.push({ code: "issue-evidence", message: `line ${line + 1}: issue ${id} has a statement and no ledger evidence. No row with source issue:${id} has a file in the ledger${rows.length === 0 ? ", and the plan has no such row" : ""}.` });
    }
  }
  return out;
}
async function checkReport(mdPath, opts = {}) {
  const r = await loadReport(mdPath, opts);
  const p = parse2(r.text);
  const problems = [];
  const add = (code, message, where = {}) => {
    problems.push({ code, message, ...where });
  };
  if (p.title === null) add("header", 'the report has no "# " title line');
  for (const field of ["Date", "Status", "Legs", "Coverage"]) if (!p.fields.has(field)) add("header", `the header line ${field}: is missing`);
  if (!p.fields.has("Range") && !p.fields.has("Spec") && !p.fields.has("Issues")) add("header", "the header needs a Range:, Spec: or Issues: line");
  const order = [];
  for (const { n } of REPORT_SECTIONS) {
    const at = p.sections.get(n) ?? [];
    if (at.length === 0) add("section", `section ${n} is missing: "## ${n} ..."`);
    if (at.length > 1) add("section", `section ${n} appears ${at.length} times`);
    if (at.length > 0) order.push(at[0]);
  }
  if (order.some((v, i) => i > 0 && v < order[i - 1])) add("section", "the sections are not in the order 1 to 6");
  for (const message of findingProblems(reportFindings(r.text))) add("finding-severity", message);
  for (const e of r.manifestErrors) add("plan", e);
  if (!r.manifest) return problems;
  const manifest = r.manifest;
  const entries = r.ledger?.entries ?? [];
  if (r.ledger && r.ledger.slug !== r.slug) add("ledger", `the ledger names slug ${r.ledger.slug}, not ${r.slug}`);
  const ledgerProblems = await verifyLedger(r.reportDir, entries);
  for (const lp of ledgerProblems) add(lp.code, lp.message, { row: lp.row, leg: lp.leg });
  const listed = new Set(entries.map((e) => e.path));
  const assetsRel2 = `assets/${r.slug}`;
  for (const file of await walk2((0, import_node_path26.join)(r.reportDir, assetsRel2))) {
    if (file === LEDGER_FILE || file === RESULTS_FILE) continue;
    if (!listed.has(`${assetsRel2}/${file}`)) add("unlisted-file", `${assetsRel2}/${file} is in the report folder and not in the ledger. Only the runner captures evidence.`);
  }
  const block = findBlock(p, sectionRange(p, 3), EVIDENCE_START, EVIDENCE_END);
  const inBlock = /* @__PURE__ */ new Map();
  if (typeof block === "string") add("block", block);
  else {
    const fresh = await renderEvidence({ ...r, manifest });
    const current = blockText(p.lines, block.from, block.to);
    if (current !== fresh.trim()) {
      const a = current.split("\n");
      const b = fresh.trim().split("\n");
      let i = 0;
      while (i < a.length && a[i] === b[i]) i += 1;
      add("block-edited", `the generated section 3 differs from a fresh render of the ledger at report line ${block.from + 2 + i}. Run lw qa report update, never edit the block.`);
    }
    for (const ref of references(p.lines.slice(block.from + 1, block.to))) inBlock.set(ref.url, (inBlock.get(ref.url) ?? 0) + 1);
  }
  for (const e of entries) {
    const n = inBlock.get(e.path) ?? 0;
    if (typeof block !== "string" && n === 0) add("unembedded", `${e.path} is in the ledger and not embedded in section 3`, { row: e.row, leg: e.leg });
    if (n > 1) add("embedded-twice", `${e.path} is embedded ${n} times in section 3`, { row: e.row, leg: e.leg });
  }
  const s4 = sectionRange(p, 4);
  const issues = headerIssues(p);
  for (const ref of references(p.lines)) {
    const target = opts.root === void 0 ? null : intakeTarget(r.reportDir, opts.root, ref.url);
    if (target && opts.root !== void 0) {
      const inSection4 = s4 !== null && ref.line >= s4[0] && ref.line < s4[1];
      const problem = await intakeLinkProblem({ root: opts.root, target, url: ref.url, line: ref.line, inSection4, issues });
      if (problem) add("intake-link", problem);
    } else if (!ref.url.startsWith(`${assetsRel2}/`) || ref.url.split("/").includes("..")) {
      add("embed-outside", `line ${ref.line + 1}: ${ref.url} is outside ${assetsRel2}/`);
    } else if (!listed.has(ref.url)) {
      add("embed-unledgered", `line ${ref.line + 1}: ${ref.url} has no ledger entry`);
    }
  }
  const status = computeStatus({ manifest, results: r.results, entries });
  const written = p.fields.get("Status")?.value.split(/\s/)[0] ?? "";
  if (p.fields.has("Status") && written !== status) {
    add("status", `Status: ${written || "(empty)"} differs from the computed status ${status}${REPORT_STATUSES.includes(written) ? "" : `. Statuses: ${REPORT_STATUSES.join(", ")}`}`);
  }
  if (status !== "planned") {
    problems.push(...issueStatementProblems(p, manifest, entries));
    const s5 = sectionRange(p, 5);
    const reasons = /* @__PURE__ */ new Set();
    if (s5) for (const line of p.lines.slice(s5[0], s5[1])) {
      const m = NOT_COVERED_LINE.exec(line.trim());
      if (m) reasons.add(pairKey(m[1], m[2]));
    }
    const withFiles = new Set(entries.map((e) => pairKey(e.row, e.leg)));
    for (const { shot, leg } of plannedPairs(manifest)) {
      const key = pairKey(shot.id, leg);
      if (!withFiles.has(key) && !reasons.has(key)) {
        add("no-evidence", `row ${shot.id} on leg ${leg} has no ledger evidence and no section 5 line "- \`${shot.id}\` on \`${leg}\`: <reason>"`, { row: shot.id, leg });
      }
    }
    const latest = /* @__PURE__ */ new Map();
    for (const res of r.results) latest.set(pairKey(res.row, res.leg), res);
    const broken = new Set(ledgerProblems.map((x) => x.path));
    for (const e of entries) {
      if (e.kind !== "screenshot" && e.kind !== "step" || broken.has(e.path)) continue;
      if (latest.get(pairKey(e.row, e.leg))?.status !== "passed") continue;
      let blank2;
      try {
        blank2 = blankFailure(await (0, import_promises14.readFile)((0, import_node_path26.join)(r.reportDir, e.path)), opts.blankStdDev ?? 2);
      } catch (cause) {
        if (!isCodedError(cause) || cause.code !== "qa.png.unsupported") throw cause;
        add("blank", `${e.path} cannot be read as a PNG (${cause.message}), and its row passed (row ${e.row}, leg ${e.leg})`, { row: e.row, leg: e.leg });
        continue;
      }
      if (blank2) add("blank", `${e.path} is blank and its row passed (row ${e.row}, leg ${e.leg})`, { row: e.row, leg: e.leg });
    }
  }
  return problems;
}
function putBlock(lines2, start, end, body, section) {
  const p = parse2(lines2.join("\n"));
  const block = findBlock(p, sectionRange(p, section), start, end);
  if (typeof block !== "string") return [...lines2.slice(0, block.from + 1), ...body.split("\n"), ...lines2.slice(block.to)];
  if (lines2.some((l) => l.trim() === start || l.trim() === end)) {
    throw new LaunchwrightError("qa.report.block", `The report markers are broken: ${block}`);
  }
  const range = sectionRange(p, section);
  if (!range) throw new LaunchwrightError("qa.report.section", `The report has no section ${section}`);
  let at = range[1];
  while (at > range[0] && lines2[at - 1].trim() === "") at -= 1;
  return [...lines2.slice(0, at), "", start, ...body.split("\n"), end, "", ...lines2.slice(range[1])];
}
function putField(lines2, field, value) {
  const p = parse2(lines2.join("\n"));
  const at = p.fields.get(field)?.line;
  if (at !== void 0) return lines2.map((l, i) => i === at ? `${field}: ${value}` : l);
  const last = Math.max(...[...p.fields.values()].map((f) => f.line), lines2.findIndex((l) => /^#\s/.test(l)));
  return [...lines2.slice(0, last + 1), `${field}: ${value}`, ...lines2.slice(last + 1)];
}
async function updateReport(mdPath, opts = {}) {
  const r = await loadReport(mdPath, opts);
  if (!r.manifest) {
    throw new LaunchwrightError("qa.report.plan", `The plan of ${mdPath} is invalid:
  ${r.manifestErrors.join("\n  ")}`, { context: { errors: r.manifestErrors } });
  }
  const entries = r.ledger?.entries ?? [];
  const input = { manifest: r.manifest, results: r.results, entries, ...opts.world ? { world: opts.world } : {} };
  let lines2 = r.text.split("\n");
  lines2 = putBlock(lines2, EVIDENCE_START, EVIDENCE_END, await renderEvidence({ ...r, manifest: r.manifest }), 3);
  lines2 = putBlock(lines2, COVERAGE_START, COVERAGE_END, coverageSection(input), 5);
  const status = computeStatus(input);
  lines2 = putField(lines2, "Status", status);
  lines2 = putField(lines2, "Legs", legsLine(r.manifest, r.results));
  lines2 = putField(lines2, "Coverage", coverageLine(input));
  await (0, import_promises14.writeFile)(mdPath, lines2.join("\n"));
  return status;
}
function loadedScore(loaded, weights = {}) {
  const entries = loaded.ledger?.entries ?? [];
  if (!loaded.manifest || loaded.results.length === 0 && entries.length === 0) return null;
  return reportScore({ manifest: loaded.manifest, results: loaded.results, entries, findings: tallyFindings(reportFindings(loaded.text)) }, weights);
}
async function scoreReport(mdPath, opts = {}) {
  return loadedScore(await loadReport(mdPath, opts), opts.score?.weights);
}
function scoreBlock(loaded, opts) {
  const s = loadedScore(loaded, opts.weights);
  if (!s) return "";
  const { score, confidence } = s.result;
  const percent = Math.round(confidence * 100);
  const gauge = renderScoreGauge(score, { size: 132, label: `${percent}%`, ...opts.gaugeColor ? { color: opts.gaugeColor } : {} });
  return [
    '<div class="qa-score" style="margin:0 0 2.4rem">',
    '<div style="display:flex;align-items:center;gap:1.1rem;flex-wrap:wrap">',
    `<div style="flex:0 0 auto">${gauge}</div>`,
    `<p style="margin:0;max-width:34ch;color:var(--ink-soft)">QA score <strong style="color:var(--ink)">${score}</strong> of 100. The weighted score averages the counted dimensions below. Confidence ${percent}% comes from the live coverage and the evidence.</p>`,
    "</div>",
    `<div style="overflow-x:auto">${renderScoreBreakdown(s.rows)}</div>`,
    "</div>",
    ""
  ].join("\n");
}
async function renderReport(mdPath, rendererDir, root, opts = {}) {
  const slug3 = slugOf(mdPath);
  const template = (0, import_node_path26.join)(rendererDir, "spec-template.html");
  let shell;
  try {
    shell = await (0, import_promises14.readFile)(template, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.report.renderer", `The page template of the spec renderer is not at ${template}. Reinstall @launchwrighthq/qa.`, { cause, context: { template } });
  }
  const loaded = await loadReport(mdPath, opts);
  const text2 = loaded.text;
  const p = parse2(text2);
  if (p.title === null) throw new LaunchwrightError("qa.report.header", `${mdPath}: the report has no "# " title line`);
  const reportDir = (0, import_node_path26.dirname)(mdPath);
  const body = rewriteLinks(p.lines.slice(p.bodyStart), ({ alt, url }) => intakeTarget(reportDir, root, url) === null ? null : `[${alt || "reporter media"}](../${url})`);
  let rendered;
  try {
    rendered = renderBody({ lines: body, source: mdPath, bodyStart: p.bodyStart, assetPrefix: "../" });
  } catch (cause) {
    throw new LaunchwrightError("qa.report.render", `${mdPath}: ${cause.message}`, { cause });
  }
  const consumed = new Set([...p.fields.values()].map((f) => f.line));
  const standfirst = p.lines.slice(0, p.bodyStart).filter((l, i) => !consumed.has(i) && !/^#\s/.test(l)).join("\n").split(/\n\s*\n/).map((para) => para.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
  const field = (f) => p.fields.get(f)?.value ?? null;
  const subject = field("Spec") ?? field("Issues");
  const range = field("Range");
  const values = /* @__PURE__ */ new Map([
    ["NAV", rendered.toc.map((e) => `<li><a href="#${e.anchor}"><span class="n">${e.eyebrow}</span>${escapeHtml(plain(e.title))}</a></li>`).join("")],
    ["BODY", scoreBlock(loaded, opts.score ?? {}) + rendered.body],
    ["TITLE", escapeHtml(p.title)],
    ["DATE", escapeHtml(field("Date") ?? slug3.slice(0, 10))],
    ["STATUS", escapeHtml(field("Status") ?? "")],
    ["SUBJECT", subject === null ? "" : escapeHtml(subject)],
    ["RANGE", range === null ? "" : escapeHtml(range)],
    ["STANDFIRST", inline(standfirst, "../")],
    ["KIND", "QA REPORT"],
    ["KIND_CLASS", "kind-spec"],
    ["SOURCE", escapeHtml((0, import_node_path26.relative)((0, import_node_path26.dirname)(mdPath), mdPath))]
  ]);
  const chip = (v) => v === "" ? "" : `<li class="chip">${v}</li>`;
  const html = shell.replace(/<li class="chip">\{\{(STATUS|SUBJECT|RANGE)\}\}<\/li>|\{\{(\w+)\}\}/g, (_m, chipName, name) => {
    if (chipName) return chip(values.get(chipName));
    const value = values.get(name);
    if (value === void 0) throw new LaunchwrightError("qa.report.template", `The renderer template has {{${name}}}, which the QA render does not fill`);
    return value;
  });
  const out = reportPaths((0, import_node_path26.dirname)(mdPath), slug3).html;
  await (0, import_promises14.mkdir)((0, import_node_path26.dirname)(out), { recursive: true });
  await (0, import_promises14.writeFile)(out, html);
  return out;
}
var import_promises14, import_node_path26, REPORT_SECTIONS, SLUG_RE, FIELD_RE, SECTION_RE, blockText, intakeStaysLocal, ISSUE_STATEMENT, STATEMENT_LIKE, RENDERER_DIR;
var init_report = __esm({
  "src/services/report.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises14 = require("fs/promises");
    import_node_path26 = require("path");
    init_kernel();
    init_fs();
    init_evidence();
    init_ledger();
    init_manifest2();
    init_png();
    init_findings();
    init_report_score();
    init_score();
    init_render();
    init_types();
    init_report_score();
    REPORT_SECTIONS = [
      { n: 1, title: "What this run covered" },
      { n: 2, title: "What the code claims" },
      { n: 3, title: "What was seen" },
      { n: 4, title: "Findings" },
      { n: 5, title: "Not covered" },
      { n: 6, title: "How to retest" }
    ];
    SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
    FIELD_RE = /^(Date|Status|Range|Spec|Issues|Legs|Coverage):\s*(.*)$/;
    SECTION_RE = /^##\s+(\d+)\.?(?:\s|$)/;
    blockText = (lines2, from, to) => lines2.slice(from + 1, to).join("\n").trim();
    intakeStaysLocal = (id) => `reporter media of issue ${id} stays local`;
    ISSUE_STATEMENT = /^- issue ([A-Za-z0-9._-]+): (REPRODUCED|NOT REPRODUCED)$/;
    STATEMENT_LIKE = /^- issue \S+:/;
    RENDERER_DIR = TEMPLATE_DIR;
  }
});

// src/services/viewer.mts
function stepOf2(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? Number(m[1]) : null;
}
function actLabel(act) {
  const parts = [act.kind];
  if (act.target) parts.push(act.target);
  else if (act.key) parts.push(act.key);
  else if (act.text) parts.push(`"${act.text}"`);
  else if (act.why) parts.push(act.why);
  return parts.join(" ");
}
function isDeviceLeg(entries) {
  return entries.some((e) => e.device !== void 0 || /^(android|ios)/i.test(e.target));
}
function blank(label) {
  return `<div class="qa-blank" role="note"><span class="qa-blank-mark">no evidence</span> ${esc2(label)}</div>`;
}
function lastAttempt(pairEntries) {
  const maxAttempt = pairEntries.reduce((n, e) => Math.max(n, e.attempt), 0);
  return pairEntries.filter((e) => e.attempt === maxAttempt);
}
function entriesByPair(entries) {
  const byPair = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const key = pairKey(e.row, e.leg);
    const list3 = byPair.get(key);
    if (list3) list3.push(e);
    else byPair.set(key, [e]);
  }
  return byPair;
}
function legViews(shot, leg, pairEntries) {
  const current = lastAttempt(pairEntries);
  const screenshot = current.find((e) => e.kind === "screenshot");
  const videos = current.filter((e) => e.kind === "video");
  const stepEntries = current.filter((e) => e.kind === "step");
  const links = current.filter((e) => e.kind === "trace" || e.kind === "log" || e.kind === "ui");
  const views = [];
  if (screenshot) {
    views.push({ id: "screen", label: "Screen", body: `<img src="${mediaSrc(screenshot.path)}" alt="${esc2(`${leg} ${shot.screen} ${shot.state}`)}" loading="lazy">` });
  }
  const acts = shot.act ?? [];
  const usedSteps = /* @__PURE__ */ new Set();
  acts.forEach((act, i) => {
    const stepNum = i + 1;
    usedSteps.add(stepNum);
    const entry = stepEntries.find((e) => stepOf2(e.path) === stepNum);
    const label = `Step ${stepNum}: ${actLabel(act)}`;
    const body = entry ? `<img src="${mediaSrc(entry.path)}" alt="${esc2(`${leg} step ${stepNum}`)}" loading="lazy">` : blank(`${shot.id} on ${leg} has no screenshot for step ${stepNum} in the ledger`);
    views.push({ id: `step-${stepNum}`, label, body });
  });
  for (const e of stepEntries) {
    const n = stepOf2(e.path);
    if (n !== null && !usedSteps.has(n)) {
      views.push({ id: `step-${n}`, label: `Step ${n}`, body: `<img src="${mediaSrc(e.path)}" alt="${esc2(`${leg} step ${n}`)}" loading="lazy">` });
    }
  }
  videos.forEach((v, i) => {
    const label = videos.length > 1 ? `Video ${i + 1}` : "Video";
    const video = `<video src="${mediaSrc(v.path)}" data-qa-video data-row="${esc2(shot.id)}" data-leg="${esc2(leg)}" data-path="${esc2(v.path)}" controls playsinline preload="metadata">${esc2(`${leg} ${shot.state} video`)}</video>`;
    const timebar = `<div class="qa-timebar"><button type="button" class="qa-time-add" data-qa-time disabled>Comment at this time</button></div>`;
    views.push({ id: videos.length > 1 ? `video-${i + 1}` : "video", label, body: `${video}${timebar}` });
  });
  if (isDeviceLeg(current) && screenshot) {
    views.push({ id: "device", label: "Device frame", body: `<div class="qa-device"><img src="${mediaSrc(screenshot.path)}" alt="${esc2(`${leg} device frame`)}" loading="lazy"></div>` });
  }
  return { views, links };
}
function linkLine(links) {
  if (links.length === 0) return "";
  const names = { trace: "trace", log: "log", ui: "UI dump" };
  const items = links.map((e) => `<a href="${mediaSrc(e.path)}">${esc2(names[e.kind] ?? e.kind)}</a>`);
  return `<p class="qa-files">Files: ${items.join(", ")}.</p>`;
}
function rowViewer(shot, byPair) {
  const legTabs = [];
  const legPanels = [];
  shot.legs.forEach((leg, legIndex) => {
    const activeLeg = legIndex === 0;
    legTabs.push(`<button type="button" data-leg="${esc2(leg)}" aria-selected="${activeLeg}">${esc2(leg)}</button>`);
    const { views, links } = legViews(shot, leg, byPair.get(pairKey(shot.id, leg)) ?? []);
    if (views.length === 0) {
      legPanels.push(`<div class="qa-legpanel" data-leg="${esc2(leg)}"${activeLeg ? "" : " hidden"}>${blank(`${shot.id} on ${leg} has no evidence in the ledger`)}${linkLine(links)}</div>`);
      return;
    }
    const viewTabs = views.map((v, i) => `<button type="button" data-view="${esc2(v.id)}" aria-selected="${i === 0}">${esc2(v.label)}</button>`).join("");
    const stage = views.map((v, i) => `<div class="qa-view" data-view="${esc2(v.id)}"${i === 0 ? "" : " hidden"}>${v.body}</div>`).join("");
    legPanels.push(
      `<div class="qa-legpanel" data-leg="${esc2(leg)}"${activeLeg ? "" : " hidden"}><div class="qa-view-switch" data-qa-view-switch role="tablist" aria-label="view">${viewTabs}</div><div class="qa-stage">${stage}</div>${linkLine(links)}</div>`
    );
  });
  const legSwitch = shot.legs.length > 1 ? `<div class="qa-leg-switch" data-qa-leg-switch role="tablist" aria-label="leg">${legTabs.join("")}</div>` : "";
  return `<div class="qa-viewer" data-qa-viewer>${legSwitch}<div class="qa-legpanels">${legPanels.join("")}</div></div>`;
}
function stateGallery(shot, byPair) {
  const cells = shot.legs.map((leg) => {
    const still = lastAttempt(byPair.get(pairKey(shot.id, leg)) ?? []).find((e) => e.kind === "screenshot" || e.kind === "step");
    const media = still ? `<img src="${mediaSrc(still.path)}" alt="${esc2(`${leg} ${shot.screen} ${shot.state}`)}" loading="lazy">` : blank(`no still for ${leg} in the ledger`);
    return `<figure class="qa-cell"><figcaption>${esc2(leg)}</figcaption>${media}</figure>`;
  });
  return `<div class="qa-gallery">${cells.join("")}</div>`;
}
function provenanceNote(shot, entries) {
  const provs = new Set(entries.filter((e) => shot.legs.includes(e.leg) && e.row === shot.id).map((e) => e.provenance));
  provs.delete("live");
  if (provs.size === 0) return "";
  const forged = provs.has("forged") ? " A forged state never counts as a live pass." : "";
  return `<p class="qa-prov">Provenance: ${esc2([...provs].join(", "))}.${forged}</p>`;
}
function anchorLabel(a) {
  if (a.kind === "step") return `step ${a.step} on ${a.row} / ${a.leg}`;
  if (a.kind === "text") return `text in ${a.section}`;
  if (a.kind === "region") return `region of ${a.screenshot}`;
  if (a.kind === "time") return `time ${a.start}s on ${a.row}`;
  return `flow ${a.name}`;
}
function marksShot(a, shotId) {
  if (a.kind === "step" || a.kind === "region" || a.kind === "time") return a.row === shotId;
  if (a.kind === "text") return a.section === shotId;
  return a.name === shotId;
}
function commentMark(c, n) {
  const coords = c.anchor.kind === "region" ? ` data-x="${c.anchor.x}" data-y="${c.anchor.y}" data-w="${c.anchor.w}" data-h="${c.anchor.h}"` : "";
  return `<button type="button" class="qa-mark qa-mark-${c.anchor.kind}" data-qa-mark data-comment-id="${esc2(c.id)}" data-status="${c.status}" title="${esc2(anchorLabel(c.anchor))}"${coords}>${n}</button>`;
}
function marksStrip(comments2, numberOf, loose = false) {
  if (comments2.length === 0) return "";
  const marks = comments2.map((c) => commentMark(c, numberOf.get(c.id) ?? 0)).join("");
  return `<div class="qa-marks${loose ? " qa-marks-loose" : ""}" data-qa-marks>${marks}</div>`;
}
function commentCard(c, n) {
  const replies = c.replies.map((r) => `<li><strong>${esc2(r.author)}</strong>: ${esc2(r.body)}</li>`).join("");
  const resolveOp = c.status === "resolved" ? "reopen" : "resolve";
  const resolveLabel = c.status === "resolved" ? "Reopen" : "Resolve";
  return [
    `<article class="qa-comment" data-comment-id="${esc2(c.id)}" data-status="${c.status}">`,
    `<header class="qa-comment-head"><span class="qa-mark-n">${n}</span><span class="qa-comment-author">${esc2(c.author)}</span><span class="qa-comment-status">${esc2(c.status)}</span></header>`,
    `<p class="qa-comment-anchor" title="${esc2(anchorLabel(c.anchor))}">${esc2(anchorLabel(c.anchor))}</p>`,
    `<p class="qa-comment-body">${esc2(c.body)}</p>`,
    replies ? `<ul class="qa-replies">${replies}</ul>` : "",
    '<div class="qa-comment-actions" data-qa-actions hidden>',
    '<form class="qa-reply" data-qa-reply><input type="text" name="author" placeholder="you"><input type="text" name="body" placeholder="reply"><button type="submit" disabled>Reply</button></form>',
    `<button type="button" class="qa-resolve" data-qa-resolve data-op="${resolveOp}" disabled>${resolveLabel}</button>`,
    "</div>",
    "</article>"
  ].filter(Boolean).join("");
}
function commentSidebar(comments2, numberOf, page2) {
  const cards = comments2.map((c) => commentCard(c, numberOf.get(c.id) ?? 0)).join("");
  const empty = comments2.length === 0 ? '<p class="qa-comment-empty">No comments yet.</p>' : "";
  return [
    `<aside class="qa-comments" data-qa-comments data-page="${esc2(page2)}" aria-label="reviewer comments">`,
    '<div class="qa-comments-head"><h2>Comments</h2>',
    '<button type="button" class="qa-add-open" data-qa-add-open disabled hidden>Add a note</button></div>',
    '<form class="qa-add" data-qa-add hidden><p class="qa-add-target" data-qa-add-target>Flow note</p>',
    '<input type="text" name="author" placeholder="you"><textarea name="body" placeholder="note" rows="3"></textarea>',
    '<input type="hidden" name="anchor"><div class="qa-add-row"><button type="submit" disabled>Save note</button><button type="button" data-qa-add-cancel>Cancel</button></div></form>',
    empty,
    `<div class="qa-comment-list">${cards}</div>`,
    "</aside>"
  ].join("");
}
function commentsData(comments2) {
  const json = JSON.stringify(comments2).replace(/</g, "\\u003c");
  return `<script type="application/json" data-qa-comments-data>${json}</script>`;
}
function renderState(shot, latest, byPair, entries, marks = "") {
  const legLines = shot.legs.map((leg) => `<li><code>${esc2(leg)}</code>: ${esc2(resultText(latest.get(pairKey(shot.id, leg))))}</li>`).join("");
  const specRef = shot.specRef ? `<span>Spec <code>${esc2(shot.specRef)}</code></span>` : "";
  return [
    `<section class="qa-state" id="${stateAnchor(shot.id)}" data-row="${esc2(shot.id)}" data-qa-section="${esc2(shot.id)}">`,
    `<h3>${esc2(shot.screen)} <span class="qa-state-name">${esc2(shot.state)}</span></h3>`,
    marks,
    '<div class="qa-meta">',
    `<span>Row <code>${esc2(shot.id)}</code></span>`,
    `<span>Route <code>${esc2(shot.route)}</code></span>`,
    specRef,
    "</div>",
    `<p class="qa-expect">Expect: ${esc2(expectText(shot))}</p>`,
    provenanceNote(shot, entries),
    `<ul class="qa-legresults">${legLines}</ul>`,
    stateGallery(shot, byPair),
    rowViewer(shot, byPair),
    "</section>"
  ].filter(Boolean).join("\n");
}
function page(input) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc2(input.title)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    `<header class="qa-top"><div class="qa-top-in">${input.crumb}<div class="qa-wordmark">QA viewer</div></div></header>`,
    '<div class="qa-layout">',
    `<main class="qa-main"><h1>${esc2(input.heading)}</h1>${input.body}</main>`,
    input.sidebar ?? "",
    "</div>",
    input.data ?? "",
    `<script>${SCRIPT}</script>`,
    "</body>",
    "</html>"
  ].join("\n");
}
function scoreBlock2(input, opts) {
  const s = reportScore(input, opts.weights);
  if (!s) {
    return '<div class="qa-score"><p>No rows have run yet, so the score has no dimension to average.</p></div>';
  }
  const { score, confidence } = s.result;
  const percent = Math.round(confidence * 100);
  const gauge = renderScoreGauge(score, { size: 148, label: `${percent}%`, ...opts.gaugeColor ? { color: opts.gaugeColor } : {} });
  return [
    '<div class="qa-score">',
    `<div class="qa-gauge">${gauge}</div>`,
    '<div class="qa-score-text">',
    `<p>QA score <strong>${score}</strong> of 100. The weighted score averages the counted dimensions. Confidence ${percent}% comes from the live coverage and the evidence. A low coverage or evidence caps the confidence, so a thin run does not read as a clean pass.</p>`,
    `<div class="qa-score-scroll">${renderScoreBreakdown(s.rows)}</div>`,
    "</div>",
    "</div>"
  ].join("");
}
function findingsBlock(input, latest, featureOf) {
  const rows = [];
  let na = 0;
  let notRun = 0;
  let noResult = 0;
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const r = latest.get(pairKey(shot.id, leg));
    if (!r) noResult += 1;
    else if (r.status === "failed") {
      const feature = featureOf.get(shot.id.split(".")[0] ?? shot.id);
      const href = feature ? `${esc2(feature.file)}#${stateAnchor(shot.id)}` : "";
      const where = href ? `<a href="${href}"><code>${esc2(shot.id)}</code></a>` : `<code>${esc2(shot.id)}</code>`;
      rows.push(`<tr><td>${where}</td><td><code>${esc2(leg)}</code></td><td>${esc2(r.failures.join(", ") || "no failure named")}</td><td>${esc2(r.reason ?? "")}</td></tr>`);
    } else if (r.status === "n/a") na += 1;
    else if (r.status === "not-run") notRun += 1;
  }
  const parts = ['<section class="qa-findings"><h2>Open findings</h2>'];
  if (rows.length === 0) parts.push("<p>No planned row and leg failed.</p>");
  else parts.push(`<table><thead><tr><th>Row</th><th>Leg</th><th>Failures</th><th>Reason</th></tr></thead><tbody>${rows.join("")}</tbody></table>`);
  const gaps = [];
  if (na > 0) gaps.push(`${na} n/a`);
  if (notRun > 0) gaps.push(`${notRun} not run`);
  if (noResult > 0) gaps.push(`${noResult} with no result`);
  if (gaps.length > 0) parts.push(`<p class="qa-gaps">Not covered: ${gaps.join(", ")}.</p>`);
  parts.push("</section>");
  return parts.join("");
}
function firstOnLegs(shot, byPair, kind) {
  for (const leg of shot.legs) {
    const hit = lastAttempt(byPair.get(pairKey(shot.id, leg)) ?? []).find((e) => e.kind === kind);
    if (hit) return hit;
  }
  return void 0;
}
function featureMedia(feature, byPair) {
  let key;
  for (const shot of feature.shots) {
    const entry = firstOnLegs(shot, byPair, "screenshot");
    if (entry) {
      key = { shot, entry };
      break;
    }
  }
  const thumb = key ? `<a class="qa-thumb" href="${esc2(feature.file)}#${stateAnchor(key.shot.id)}"><img src="${mediaSrc(key.entry.path)}" alt="${esc2(`${key.entry.leg} ${key.shot.screen} ${key.shot.state}`)}" loading="lazy"></a>` : blank(`${feature.name} has no settled screenshot in the ledger`);
  const clips = [];
  for (const shot of feature.shots) {
    const video = firstOnLegs(shot, byPair, "video");
    const caption2 = `<figcaption><a href="${esc2(feature.file)}#${stateAnchor(shot.id)}"><code>${esc2(shot.id)}</code></a>${video ? ` on <code>${esc2(video.leg)}</code>` : ""}</figcaption>`;
    if (video) {
      clips.push(`<figure class="qa-clip">${caption2}<video src="${mediaSrc(video.path)}" controls playsinline preload="metadata">${esc2(`${video.leg} ${shot.state} video`)}</video></figure>`);
    } else if (wantsVideo(shot)) {
      clips.push(`<figure class="qa-clip">${caption2}${blank(`${shot.id} asks for a video and the ledger has none`)}</figure>`);
    }
  }
  const shown = clips.slice(0, INDEX_VIDEOS_PER_FEATURE);
  const more = clips.length - shown.length;
  const moreLink = more > 0 ? `<p class="qa-more"><a href="${esc2(feature.file)}">${more} more on the feature page</a></p>` : "";
  const clipBlock = shown.length > 0 ? `<div class="qa-clips">${shown.join("")}</div>${moreLink}` : "";
  return [
    `<article class="qa-media-feature" data-feature="${esc2(feature.token)}">`,
    `<h3><a href="${esc2(feature.file)}">${esc2(feature.name)}</a></h3>`,
    thumb,
    clipBlock,
    "</article>"
  ].join("");
}
function mediaBlock(features, entries) {
  const byPair = entriesByPair(entries);
  return `<section class="qa-media"><h2>Media</h2><div class="qa-media-grid">${features.map((f) => featureMedia(f, byPair)).join("")}</div></section>`;
}
function featureCards(features, latest) {
  const cards = features.map((f) => {
    let passed = 0;
    let failed = 0;
    let legs = 0;
    for (const shot of f.shots) for (const leg of shot.legs) {
      legs += 1;
      const r = latest.get(pairKey(shot.id, leg));
      if (r?.status === "passed") passed += 1;
      if (r?.status === "failed") failed += 1;
    }
    const tone = failed > 0 ? "fail" : passed === legs && legs > 0 ? "pass" : "partial";
    return [
      `<a class="qa-card" href="${esc2(f.file)}">`,
      `<span class="qa-card-name">${esc2(f.name)}</span>`,
      `<span class="qa-card-meta">${f.shots.length} state${f.shots.length === 1 ? "" : "s"}, ${legs} row leg${legs === 1 ? "" : "s"}</span>`,
      `<span class="qa-dot qa-dot-${tone}"></span>`,
      "</a>"
    ].join("");
  });
  return `<section class="qa-features"><h2>Features</h2><div class="qa-cardgrid">${cards.join("")}</div></section>`;
}
function renderIndex(input, features, latest, opts, comments2, numberOf) {
  const featureOf = new Map(features.map((f) => [f.token, f]));
  const totals = { rows: input.manifest.shots.length, legs: plannedPairs(input.manifest).length };
  const loose = comments2.filter((c) => c.anchor.kind === "flow" && c.anchor.name === INDEX_PAGE || c.anchor.kind === "text" && c.anchor.section === INDEX_PAGE);
  const body = [
    `<p class="qa-sub"><span class="${chipClass(input.status)}">${esc2(input.status)}</span> ${esc2(input.date)}, ${totals.rows} row${totals.rows === 1 ? "" : "s"}, ${totals.legs} row leg${totals.legs === 1 ? "" : "s"}.</p>`,
    marksStrip(loose, numberOf, true),
    scoreBlock2(input, opts),
    findingsBlock(input, latest, featureOf),
    mediaBlock(features, input.entries),
    featureCards(features, latest)
  ].join("\n");
  return page({ title: `QA: ${input.title}`, heading: input.title, crumb: '<span class="qa-crumb">Overview</span>', body, sidebar: commentSidebar(comments2, numberOf, INDEX_PAGE), data: commentsData(comments2) });
}
function renderFeature(input, feature, latest, comments2, numberOf) {
  const byPair = entriesByPair(input.entries);
  const markFor = (shotId) => marksStrip(comments2.filter((c) => marksShot(c.anchor, shotId)), numberOf);
  const states = feature.shots.map((shot) => renderState(shot, latest, byPair, input.entries, markFor(shot.id))).join("\n");
  const screenId = feature.token;
  const loose = comments2.filter((c) => c.anchor.kind === "flow" && c.anchor.name === screenId || c.anchor.kind === "text" && c.anchor.section === screenId);
  const body = `<p class="qa-sub"><a href="index.html">Overview</a></p>${marksStrip(loose, numberOf, true)}${states}`;
  return page({ title: `QA: ${feature.name}`, heading: feature.name, crumb: '<a class="qa-crumb" href="index.html">Overview</a>', body, sidebar: commentSidebar(comments2, numberOf, feature.token), data: commentsData(comments2) });
}
function featuresOf(manifest) {
  const features = [];
  const byToken = /* @__PURE__ */ new Map();
  for (const shot of manifest.shots) {
    const token2 = shot.id.split(".")[0] ?? shot.id;
    let feature = byToken.get(token2);
    if (!feature) {
      feature = { token: token2, name: shot.screen, file: `feature-${token2}.html`, shots: [] };
      byToken.set(token2, feature);
      features.push(feature);
    }
    feature.shots.push(shot);
  }
  return features;
}
function renderViewerBundle(input, opts = {}) {
  const features = featuresOf(input.manifest);
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const comments2 = input.comments ?? opts.comments ?? [];
  const numberOf = new Map(comments2.map((c, i) => [c.id, i + 1]));
  const pages = /* @__PURE__ */ new Map();
  pages.set("index.html", renderIndex(input, features, latest, opts, comments2, numberOf));
  for (const feature of features) pages.set(feature.file, renderFeature(input, feature, latest, comments2, numberOf));
  return { pages };
}
function titleOf(text2) {
  for (const line of text2.split("\n")) {
    if (/^#\s/.test(line)) return line.replace(/^#\s+/, "").replace(/^QA:\s*/, "").trim();
    if (/^##\s/.test(line)) break;
  }
  return null;
}
async function loadViewerInput(mdPath, opts = {}) {
  const loaded = await loadReport(mdPath, opts);
  if (!loaded.manifest) {
    throw new LaunchwrightError("qa.viewer.plan", `The plan of ${mdPath} is invalid:
  ${loaded.manifestErrors.join("\n  ")}`, { context: { errors: loaded.manifestErrors } });
  }
  const manifest = loaded.manifest;
  const entries = loaded.ledger?.entries ?? [];
  const status = computeStatus({ manifest, results: loaded.results, entries });
  const input = {
    title: titleOf(loaded.text) ?? manifest.title,
    date: manifest.generated.slice(0, 10) || loaded.slug.slice(0, 10),
    status,
    manifest,
    results: loaded.results,
    entries,
    findings: tallyFindings(reportFindings(loaded.text))
  };
  return { input, slug: loaded.slug, reportDir: loaded.reportDir };
}
async function buildViewer(mdPath, opts = {}) {
  const { input, slug: slug3, reportDir } = await loadViewerInput(mdPath, { ...opts.legs ? { legs: opts.legs } : {}, ...opts.bases ? { bases: opts.bases } : {} });
  const bundle = renderViewerBundle(input, opts);
  const dir = (0, import_node_path27.join)(reportDir, "dist", viewerDirName(slug3));
  await (0, import_promises15.mkdir)(dir, { recursive: true });
  const written = [];
  const index = (0, import_node_path27.join)(dir, "index.html");
  await (0, import_promises15.writeFile)(index, bundle.pages.get("index.html"));
  written.push(index);
  for (const [name, html] of bundle.pages) {
    if (name === "index.html") continue;
    const file = (0, import_node_path27.join)(dir, name);
    await (0, import_promises15.writeFile)(file, html);
    written.push(file);
  }
  return { dir, index, pages: written };
}
var import_promises15, import_node_path27, MEDIA_PREFIX, viewerDirName, esc2, mediaSrc, stateAnchor, chipClass, INDEX_VIDEOS_PER_FEATURE, wantsVideo, INDEX_PAGE, STYLE, SCRIPT;
var init_viewer = __esm({
  "src/services/viewer.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises15 = require("fs/promises");
    import_node_path27 = require("path");
    init_kernel();
    init_evidence();
    init_ledger();
    init_manifest2();
    init_findings();
    init_report();
    init_report_score();
    init_score();
    MEDIA_PREFIX = "../../";
    viewerDirName = (slug3) => `${slug3}-viewer`;
    esc2 = (text2) => escapeHtml(text2);
    mediaSrc = (path) => esc2(MEDIA_PREFIX + path);
    stateAnchor = (rowId) => `state-${rowId.replace(/\./g, "-")}`;
    chipClass = (status) => `qa-chip qa-chip-${status}`;
    INDEX_VIDEOS_PER_FEATURE = 3;
    wantsVideo = (shot) => shot.video === true || (shot.act?.length ?? 0) > 0;
    INDEX_PAGE = "overview";
    STYLE = `
:root{color-scheme:light;--ground:#f4f7f6;--surface:#fff;--sunk:#edf2f1;--ink:#0f1a19;--ink-soft:#546360;--rule:#d9e2e0;--accent:#15605a;--accent-soft:#e2efec;--pass:#15605a;--fail:#8c2b2b;--fail-soft:#f8e9e7;--partial:#9a5b08;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--ground:#0d1413;--surface:#141e1d;--sunk:#101917;--ink:#dbe4e2;--ink-soft:#94a6a3;--rule:#243231;--accent:#63c0b3;--accent-soft:#16302d;--pass:#63c0b3;--fail:#e08a8a;--fail-soft:#311e1e;--partial:#dca648}}
:root[data-theme="dark"]{color-scheme:dark;--ground:#0d1413;--surface:#141e1d;--sunk:#101917;--ink:#dbe4e2;--ink-soft:#94a6a3;--rule:#243231;--accent:#63c0b3;--accent-soft:#16302d;--pass:#63c0b3;--fail:#e08a8a;--fail-soft:#311e1e;--partial:#dca648}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6}
img{max-width:100%}
code{font-family:var(--mono);font-size:.86em;background:var(--sunk);padding:.08em .35em;border-radius:4px}
a{color:var(--accent)}
.qa-top{position:sticky;top:0;z-index:5;background:var(--surface);border-bottom:1px solid var(--rule);padding:env(safe-area-inset-top,0) 0 0}
.qa-top-in{max-width:70rem;margin:0 auto;padding:.7rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.qa-crumb{color:var(--ink-soft);text-decoration:none;font-weight:600}
.qa-wordmark{font-family:var(--mono);font-size:.82rem;color:var(--ink-soft)}
.qa-main{max-width:70rem;margin:0 auto;padding:1.4rem 1rem 4rem}
h1{font-size:1.7rem;margin:.6rem 0 .2rem}
h2{font-size:1.2rem;margin:2rem 0 .8rem}
h3{font-size:1.1rem;margin:0 0 .5rem}
.qa-sub{color:var(--ink-soft);margin:.2rem 0 1.4rem}
.qa-chip{display:inline-block;font-size:.76rem;font-weight:700;padding:.1rem .5rem;border-radius:999px;text-transform:uppercase;letter-spacing:.03em;background:var(--accent-soft);color:var(--accent)}
.qa-chip-failed{background:var(--fail-soft);color:var(--fail)}
.qa-chip-partial,.qa-chip-planned{background:var(--sunk);color:var(--ink-soft)}
.qa-score{display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap;background:var(--surface);border:1px solid var(--rule);border-radius:14px;padding:1.2rem;margin:0 0 1rem}
.qa-score p{margin:0;max-width:46ch;color:var(--ink-soft)}
.qa-score strong{color:var(--ink);font-size:1.15em}
.qa-gauge{flex:0 0 auto}
.qa-score-text{flex:1 1 22rem;min-width:0}
.qa-score-scroll{overflow-x:auto;margin-top:.8rem}
.qa-score-table{width:100%;border-collapse:collapse;font-size:.86rem}
.qa-score-table th,.qa-score-table td{text-align:left;padding:.3rem .5rem;border-bottom:1px solid var(--rule)}
.qa-score-table th{color:var(--ink-soft);font-weight:600}
.qa-score-table tr[data-counted="false"] td{color:var(--ink-soft)}
.qa-findings table{width:100%;border-collapse:collapse;font-size:.92rem}
.qa-findings th,.qa-findings td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--rule);vertical-align:top}
.qa-findings th{color:var(--ink-soft);font-weight:600}
.qa-gaps,.qa-prov,.qa-files,.qa-expect{color:var(--ink-soft);font-size:.92rem}
.qa-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:.8rem}
.qa-media-feature{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:.8rem;display:flex;flex-direction:column;gap:.6rem;min-width:0}
.qa-media-feature h3{margin:0;font-size:1rem}
.qa-thumb{display:block;background:var(--sunk);border:1px solid var(--rule);border-radius:8px;padding:.4rem}
.qa-thumb img{display:block;margin:0 auto;max-height:18rem;width:auto;border-radius:6px}
.qa-clips{display:flex;flex-direction:column;gap:.6rem}
.qa-clip{margin:0;display:flex;flex-direction:column;gap:.3rem}
.qa-clip figcaption{font-size:.82rem;color:var(--ink-soft)}
.qa-clip video{display:block;max-width:100%;max-height:18rem;border-radius:6px;background:var(--sunk)}
.qa-more{margin:0;font-size:.86rem}
.qa-cardgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:.8rem}
.qa-card{display:flex;flex-direction:column;gap:.25rem;position:relative;background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:1rem;text-decoration:none;color:var(--ink)}
.qa-card:hover{border-color:var(--accent)}
.qa-card-name{font-weight:700}
.qa-card-meta{color:var(--ink-soft);font-size:.86rem}
.qa-dot{position:absolute;top:1rem;right:1rem;width:.6rem;height:.6rem;border-radius:999px;background:var(--partial)}
.qa-dot-pass{background:var(--pass)}
.qa-dot-fail{background:var(--fail)}
.qa-state{background:var(--surface);border:1px solid var(--rule);border-radius:14px;padding:1.2rem;margin:0 0 1.4rem}
.qa-state-name{color:var(--ink-soft);font-weight:500}
.qa-meta{display:flex;flex-wrap:wrap;gap:.3rem 1rem;color:var(--ink-soft);font-size:.9rem;margin:0 0 .4rem}
.qa-legresults{margin:.4rem 0 1rem;padding-left:1.1rem;color:var(--ink-soft);font-size:.92rem}
.qa-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.7rem;margin:0 0 1.2rem}
.qa-cell{margin:0;background:var(--sunk);border:1px solid var(--rule);border-radius:10px;padding:.5rem;display:flex;flex-direction:column;gap:.4rem}
.qa-cell figcaption,.qa-cell>figcaption{font-family:var(--mono);font-size:.78rem;color:var(--ink-soft)}
.qa-cell img{border-radius:6px;display:block}
.qa-viewer{border-top:1px solid var(--rule);padding-top:1rem}
.qa-leg-switch,.qa-view-switch{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .7rem}
.qa-leg-switch button,.qa-view-switch button{font:inherit;font-size:.84rem;cursor:pointer;background:var(--sunk);color:var(--ink);border:1px solid var(--rule);border-radius:999px;padding:.25rem .8rem}
.qa-leg-switch button[aria-selected="true"],.qa-view-switch button[aria-selected="true"]{background:var(--accent);color:var(--surface);border-color:var(--accent)}
.qa-stage{background:var(--sunk);border:1px solid var(--rule);border-radius:10px;padding:.6rem;min-height:4rem}
.qa-stage img,.qa-stage video{display:block;max-width:100%;height:auto;border-radius:6px;margin:0 auto}
.qa-device{max-width:20rem;margin:0 auto;padding:.7rem;background:var(--ink);border-radius:1.6rem;box-shadow:0 0 0 2px var(--rule) inset}
.qa-device img{border-radius:.9rem}
.qa-blank{background:var(--fail-soft);color:var(--fail);border:1px dashed var(--fail);border-radius:8px;padding:.7rem .8rem;font-size:.9rem}
.qa-blank-mark{font-family:var(--mono);font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;margin-right:.3rem}
@media (max-width:540px){.qa-score{flex-direction:column;align-items:flex-start}}
.qa-layout{display:flex;align-items:flex-start;gap:1rem;max-width:88rem;margin:0 auto}
.qa-layout .qa-main{flex:1 1 auto;min-width:0}
.qa-comments{flex:0 0 20rem;position:sticky;top:3.4rem;align-self:flex-start;max-height:calc(100vh - 4rem);overflow:auto;background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:.9rem;margin:1.4rem 1rem 0 0}
.qa-comments-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.qa-comments-head h2{margin:0;font-size:1rem}
.qa-comment-empty{color:var(--ink-soft);font-size:.9rem}
.qa-comment{border:1px solid var(--rule);border-radius:10px;padding:.6rem;margin:.6rem 0;background:var(--sunk)}
.qa-comment[data-status="resolved"]{opacity:.6}
.qa-comment-head{display:flex;align-items:center;gap:.4rem;font-size:.8rem;color:var(--ink-soft)}
.qa-comment-author{font-weight:600;color:var(--ink)}
.qa-comment-anchor{font-family:var(--mono);font-size:.74rem;color:var(--ink-soft);margin:.2rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qa-comment-body{margin:.2rem 0;font-size:.9rem}
.qa-replies{margin:.3rem 0;padding-left:1rem;font-size:.84rem;color:var(--ink-soft)}
.qa-mark-n{display:inline-flex;align-items:center;justify-content:center;min-width:1.3rem;height:1.3rem;border-radius:999px;background:var(--accent);color:var(--surface);font-size:.74rem;font-weight:700}
.qa-marks{display:flex;flex-wrap:wrap;gap:.3rem;margin:0 0 .6rem}
.qa-mark{cursor:pointer;min-width:1.5rem;height:1.5rem;border-radius:999px;border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700;font-size:.78rem}
.qa-mark[data-status="resolved"]{border-color:var(--rule);background:var(--sunk);color:var(--ink-soft)}
.qa-comment-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem}
.qa-reply{display:flex;gap:.3rem;flex-wrap:wrap}
.qa-reply input,.qa-add input,.qa-add textarea{font:inherit;font-size:.82rem;border:1px solid var(--rule);border-radius:6px;padding:.2rem .4rem;background:var(--ground);color:var(--ink);max-width:100%}
.qa-add{display:flex;flex-direction:column;gap:.4rem;margin:.5rem 0;padding:.5rem;border:1px solid var(--rule);border-radius:8px}
.qa-add-target{margin:0;font-weight:600;font-size:.84rem}
.qa-add-row{display:flex;gap:.4rem}
.qa-add-open,.qa-reply button,.qa-resolve,.qa-add button,.qa-time-add,.qa-add-row button{font:inherit;font-size:.8rem;cursor:pointer;border:1px solid var(--rule);border-radius:6px;padding:.2rem .6rem;background:var(--sunk);color:var(--ink)}
.qa-add-open[disabled],.qa-reply button[disabled],.qa-resolve[disabled],.qa-add button[disabled],.qa-time-add[disabled]{cursor:not-allowed;opacity:.5}
.qa-timebar{margin-top:.4rem}
.qa-comment.qa-hit{outline:2px solid var(--accent);outline-offset:2px}
@media (max-width:860px){.qa-layout{flex-direction:column}.qa-comments{position:static;flex-basis:auto;width:auto;max-height:none;margin:0 1rem 1.4rem}}
`;
    SCRIPT = `
document.addEventListener('click',function(ev){
  var legBtn=ev.target.closest('[data-qa-leg-switch] button[data-leg]');
  if(legBtn){
    var viewer=legBtn.closest('[data-qa-viewer]');
    var leg=legBtn.getAttribute('data-leg');
    viewer.querySelectorAll('[data-qa-leg-switch] button[data-leg]').forEach(function(b){b.setAttribute('aria-selected',String(b===legBtn));});
    viewer.querySelectorAll('.qa-legpanels > .qa-legpanel[data-leg]').forEach(function(p){
      var show=p.getAttribute('data-leg')===leg;
      p.hidden=!show;
      if(!show){var v=p.querySelector('video');if(v){v.pause();}}
    });
    return;
  }
  var viewBtn=ev.target.closest('[data-qa-view-switch] button[data-view]');
  if(viewBtn){
    var panel=viewBtn.closest('.qa-legpanel')||viewBtn.closest('[data-qa-viewer]');
    var view=viewBtn.getAttribute('data-view');
    viewBtn.closest('[data-qa-view-switch]').querySelectorAll('button[data-view]').forEach(function(b){b.setAttribute('aria-selected',String(b===viewBtn));});
    panel.querySelectorAll('.qa-stage > .qa-view[data-view]').forEach(function(vw){
      var show=vw.getAttribute('data-view')===view;
      vw.hidden=!show;
      if(!show){var v=vw.querySelector('video');if(v){v.pause();}}
    });
  }
});

// Reviewer comments (spec 2.9). A mark scrolls to its sidebar card in any mode. When the page is
// served (not file://), the add, reply and resolve controls turn on and write through the store.
(function(){
  var served=location.protocol!=='file:';
  function post(payload){
    return fetch(new URL('comments',location.href).href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){if(!r.ok)throw new Error('post failed');location.reload();})
      .catch(function(err){console.error('qa comments:',err);});
  }
  document.addEventListener('click',function(ev){
    var mark=ev.target.closest('[data-qa-mark]');
    if(!mark)return;
    var id=mark.getAttribute('data-comment-id');
    var sel=(window.CSS&&CSS.escape)?CSS.escape(id):id;
    var card=document.querySelector('.qa-comment[data-comment-id="'+sel+'"]');
    if(card){card.scrollIntoView({block:'center'});card.classList.add('qa-hit');setTimeout(function(){card.classList.remove('qa-hit');},1200);}
  });
  if(!served)return;
  document.querySelectorAll('[data-qa-add-open]').forEach(function(b){b.disabled=false;b.hidden=false;});
  document.querySelectorAll('[data-qa-actions]').forEach(function(a){a.hidden=false;a.querySelectorAll('button').forEach(function(b){b.disabled=false;});});
  document.querySelectorAll('[data-qa-time]').forEach(function(b){b.disabled=false;});
  var side=document.querySelector('[data-qa-comments]');
  var form=side&&side.querySelector('[data-qa-add]');
  var anchorField=form&&form.querySelector('[name=anchor]');
  var targetLabel=form&&form.querySelector('[data-qa-add-target]');
  function openAdd(anchor,label){
    if(!form)return;
    anchorField.value=JSON.stringify(anchor);
    if(targetLabel)targetLabel.textContent=label;
    form.hidden=false;
    var body=form.querySelector('[name=body]');if(body)body.focus();
  }
  document.querySelectorAll('[data-qa-add-open]').forEach(function(b){
    b.addEventListener('click',function(){
      var page=side.getAttribute('data-page')||'overview';
      var sel=window.getSelection&&window.getSelection();
      var quote=sel&&String(sel).trim();
      if(quote){
        var node=sel.anchorNode;var host=node&&(node.nodeType===1?node:node.parentElement);
        var sect=host&&host.closest('[data-qa-section]');
        if(sect){openAdd({kind:'text',section:sect.getAttribute('data-qa-section'),quote:quote},'Text note');return;}
      }
      openAdd({kind:'flow',name:page},'Flow note');
    });
  });
  if(form){
    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      var anchor;try{anchor=JSON.parse(anchorField.value);}catch(e){return;}
      post({op:'add',comment:{anchor:anchor,author:(form.querySelector('[name=author]').value||'reviewer'),body:(form.querySelector('[name=body]').value||'')}});
    });
    var cancel=form.querySelector('[data-qa-add-cancel]');
    if(cancel)cancel.addEventListener('click',function(){form.hidden=true;});
  }
  document.querySelectorAll('.qa-stage img').forEach(function(img){
    img.addEventListener('click',function(ev){
      var state=img.closest('[data-row]');if(!state)return;
      var row=state.getAttribute('data-row');
      var panel=img.closest('.qa-legpanel');var leg=panel&&panel.getAttribute('data-leg');
      var view=img.closest('.qa-view');var vid=view&&view.getAttribute('data-view');
      if(vid&&vid.indexOf('step-')===0){openAdd({kind:'step',row:row,leg:leg||'',attempt:1,step:Number(vid.slice(5))},'Step note');return;}
      var rect=img.getBoundingClientRect();
      var x=(ev.clientX-rect.left)/rect.width,y=(ev.clientY-rect.top)/rect.height;
      var path=img.getAttribute('src').replace(/^(\\.\\.\\/)+/,'');
      openAdd({kind:'region',screenshot:path,row:row,x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y)),w:0.1,h:0.1},'Region note');
    });
  });
  document.querySelectorAll('[data-qa-time]').forEach(function(b){
    b.addEventListener('click',function(){
      var view=b.closest('.qa-view');var video=view&&view.querySelector('[data-qa-video]');
      if(!video)return;
      openAdd({kind:'time',video:video.getAttribute('data-path'),row:video.getAttribute('data-row'),start:Math.round(video.currentTime*100)/100},'Time note');
    });
  });
  document.querySelectorAll('[data-qa-reply]').forEach(function(f){
    f.addEventListener('submit',function(ev){
      ev.preventDefault();
      var art=f.closest('[data-comment-id]');
      post({op:'reply',id:art.getAttribute('data-comment-id'),reply:{author:(f.querySelector('[name=author]').value||'reviewer'),body:(f.querySelector('[name=body]').value||'')}});
    });
  });
  document.querySelectorAll('[data-qa-resolve]').forEach(function(b){
    b.addEventListener('click',function(){
      var art=b.closest('[data-comment-id]');
      post({op:b.getAttribute('data-op'),id:art.getAttribute('data-comment-id')});
    });
  });
})();
`;
  }
});

// src/commands/qa-report.mts
var qa_report_exports = {};
__export(qa_report_exports, {
  default: () => qa_report_default
});
var import_node_path28, ACTIONS, USAGE4, report, qa_report_default;
var init_qa_report = __esm({
  "src/commands/qa-report.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path28 = require("path");
    init_kernel();
    init_config2();
    init_legs();
    init_report();
    init_viewer();
    ACTIONS = ["check", "update", "render", "viewer"];
    USAGE4 = [
      "usage: lw qa report <check|update|render|viewer> <report.md>",
      "  check   exit 1 and list every problem: missing, blank, unembedded or edited evidence, a wrong Status, an issue with no statement, a CONFIRMED finding with no severity",
      "  update  write section 3, the section 5 lines and the Status, Legs and Coverage lines from the ledger, and print the score",
      "  render  write <reportDir>/dist/<slug>.html with the spec renderer",
      "  viewer  write the interactive multi-page viewer under <reportDir>/dist/<slug>-viewer/"
    ];
    report = {
      name: "report",
      summary: "Check, update or render a QA report",
      async run(args, opts) {
        const [action, file, ...rest] = args;
        if (!action || !file || rest.length > 0 || !ACTIONS.includes(action)) {
          for (const line of USAGE4) opts.err(line);
          return 2;
        }
        const md = (0, import_node_path28.isAbsolute)(file) ? file : (0, import_node_path28.resolve)(opts.cwd, file);
        const config = qaConfigOf(opts.config);
        const legs = legDefinitions(config).map((l) => l.name);
        try {
          if (action === "check") {
            const problems = await checkReport(md, { legs, blankStdDev: config.evidence.blankStdDev, root: opts.cwd });
            if (problems.length === 0) {
              opts.out(`lw qa report check: ${file} passes`);
              return 0;
            }
            opts.err(`lw qa report check: ${file} has ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
            for (const p of problems) opts.err(`  ${p.code}: ${p.message}`);
            return 1;
          }
          const score = config.score;
          if (action === "update") {
            const status = await updateReport(md, { legs });
            const scored = await scoreReport(md, { legs, score });
            const scoreText = scored ? `, score ${scored.result.score} of 100, confidence ${Math.round(scored.result.confidence * 100)}%` : "";
            opts.out(`lw qa report update: ${file} Status: ${status}${scoreText}`);
            return 0;
          }
          if (action === "viewer") {
            const result = await buildViewer(md, { legs, weights: score.weights, gaugeColor: score.gaugeColor });
            opts.out(`lw qa report viewer: wrote ${result.pages.length} pages, open ${result.index}`);
            return 0;
          }
          const page2 = await renderReport(md, RENDERER_DIR, opts.cwd, { legs, score });
          opts.out(`lw qa report render: wrote ${page2}`);
          return 0;
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa report ${action}: ${cause.code}: ${cause.message}`);
          return 1;
        }
      }
    };
    qa_report_default = report;
  }
});

// src/services/publish.mts
async function walk3(dir) {
  const out = [];
  for (const d of await (0, import_promises16.readdir)(dir, { withFileTypes: true })) {
    const path = (0, import_node_path29.join)(dir, d.name);
    if (d.isDirectory()) out.push(...await walk3(path));
    else out.push(path);
  }
  return out;
}
function pageWithoutIntakeLinks(html, pageDir, root) {
  return html.replace(/<a href="([^"]*)">[\s\S]*?<\/a>|<img src="([^"]*)"[^>]*>|<video src="([^"]*)"[^>]*>[\s\S]*?<\/video>/g, (m, a, img, video) => {
    const target = intakeTarget(pageDir, root, a ?? img ?? video);
    return target === null ? m : intakeStaysLocal(target.id);
  });
}
async function publishReport(input) {
  const dir = (0, import_node_path29.resolve)(input.root, input.reportDir);
  const paths = reportPaths(dir, input.slug);
  if (!("missing" !== await pathKind(paths.md))) {
    throw new LaunchwrightError("qa.publish.missing", `No report ${paths.md}`, { context: { slug: input.slug } });
  }
  const problems = await checkReport(paths.md, { ...input.check, root: input.root });
  if (problems.length > 0) {
    throw new LaunchwrightError("qa.publish.check", `The report ${input.slug} fails lw qa report check:
  ${problems.map((p) => p.message).join("\n  ")}`, {
      context: { slug: input.slug, problems: problems.length }
    });
  }
  const files = [paths.md, paths.plan];
  if ("missing" !== await pathKind(paths.html)) files.push(paths.html);
  if ("missing" !== await pathKind(paths.assets)) files.push(...await walk3(paths.assets));
  const intake = (0, import_node_path29.resolve)(input.root, INTAKE_DIR);
  const intakeReal = "missing" !== await pathKind(intake) ? await (0, import_promises16.realpath)(intake) : intake;
  for (const file of files) {
    const real = await (0, import_promises16.realpath)(file);
    if (real === intakeReal || real.startsWith(intakeReal + import_node_path29.sep) || real.startsWith(intake + import_node_path29.sep)) {
      throw new LaunchwrightError("qa.publish.intake", `${(0, import_node_path29.relative)(input.root, file)} is intake content, which never leaves ${INTAKE_DIR}/`, {
        context: { file: (0, import_node_path29.relative)(input.root, file) }
      });
    }
  }
  const bodies = /* @__PURE__ */ new Map();
  for (const file of files) {
    let body = await (0, import_promises16.readFile)(file);
    if (file === paths.md || file === paths.html) {
      const text2 = body.toString("utf8");
      const published = file === paths.md ? withoutIntakeLinks(text2, dir, input.root) : pageWithoutIntakeLinks(text2, (0, import_node_path29.dirname)(paths.html), input.root);
      if (published.includes(INTAKE_DIR)) {
        throw new LaunchwrightError("qa.publish.intake", `${(0, import_node_path29.relative)(input.root, file)} names ${INTAKE_DIR}/ outside a section 4 link to reporter media. Intake content stays local.`, {
          context: { file: (0, import_node_path29.relative)(input.root, file) }
        });
      }
      body = Buffer.from(published, "utf8");
    }
    bodies.set(file, body);
  }
  const out = [];
  const presign = input.driver.supports("presign");
  for (const file of files) {
    const rel = (0, import_node_path29.relative)(dir, file).split(import_node_path29.sep).join("/");
    const key = `${PUBLISH_PREFIX}/${rel}`;
    const body = bodies.get(file);
    try {
      await input.driver.put(key, body, { contentType: contentType(file) });
    } catch (cause) {
      throw new LaunchwrightError("qa.publish.put", `Cannot publish ${rel} as ${key}`, { cause, context: { key } });
    }
    const url = presign ? await input.driver.presign(key, { method: "GET", expiresIn: LINK_TTL_S }) : void 0;
    out.push({ key, bytes: body.length, ...url !== void 0 ? { url } : {} });
  }
  return out;
}
var import_promises16, import_node_path29, PUBLISH_PREFIX, LINK_TTL_S, CONTENT_TYPES, contentType;
var init_publish = __esm({
  "src/services/publish.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises16 = require("fs/promises");
    import_node_path29 = require("path");
    init_kernel();
    init_fs();
    init_ledger();
    init_report();
    init_types();
    PUBLISH_PREFIX = "qa";
    LINK_TTL_S = 604800;
    CONTENT_TYPES = {
      ".md": "text/markdown; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".json": "application/json",
      ".jsonl": "application/x-ndjson",
      ".png": "image/png",
      ".webm": "video/webm",
      ".mp4": "video/mp4",
      ".zip": "application/zip",
      ".xml": "application/xml"
    };
    contentType = (file) => CONTENT_TYPES[/\.[^./]+$/.exec(file)?.[0] ?? ""] ?? "application/octet-stream";
  }
});

// src/commands/qa-publish.mts
var qa_publish_exports = {};
__export(qa_publish_exports, {
  default: () => qa_publish_default,
  publishManifest: () => publishManifest
});
function publishManifest(disk) {
  const id = `storage-publish-${disk.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "disk"}`;
  return computeManifest({ title: "lw qa publish", legs: [], outward: [{ id, title: `Copy QA reports and their evidence to the storage disk ${disk}` }] });
}
var USAGE5, publish, qa_publish_default;
var init_qa_publish = __esm({
  "src/commands/qa-publish.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_args();
    init_config2();
    init_consent_gate();
    init_contract();
    init_peers2();
    init_legs();
    init_publish();
    USAGE5 = "usage: lw qa publish <slug> [--allow-all | --allow <item-id>]   the slug is the report file name without .md";
    publish = {
      name: "publish",
      summary: "Copy a report, its ledger and its evidence to the qa.publish.storage disk",
      async run(args, opts) {
        let parsed;
        try {
          parsed = parseCommandArgs({ switches: ["allow-all"], repeated: ["allow"] }, args);
        } catch (cause) {
          if (!(cause instanceof UsageError)) throw cause;
          opts.err(`lw qa publish: ${cause.message}`);
          opts.err(USAGE5);
          return 2;
        }
        const [slug3, ...rest] = parsed.positionals;
        if (!slug3 || rest.length > 0) {
          opts.err(USAGE5);
          return 2;
        }
        const config = qaConfigOf(opts.config);
        const disk = config.publish.storage;
        if (!disk) {
          opts.err("lw qa publish: set qa.publish.storage to a storage disk name in launchwright.config.ts");
          return 1;
        }
        const app = opts.app;
        if (!app) {
          opts.err("lw qa publish: the command needs the booted app with the storage module");
          return 1;
        }
        const choice = { allowAll: parsed.switches.has("allow-all"), allow: parsed.lists.allow };
        if (!await consentGate(publishManifest(disk), { cwd: opts.cwd, out: opts.out, err: opts.err, ...choice })) return 2;
        try {
          const { STORAGE } = await loadStorage();
          const driver = app.get(STORAGE).driver(disk);
          const files = await publishReport({
            root: opts.cwd,
            reportDir: config.reportDir,
            slug: slug3,
            driver,
            check: { legs: legDefinitions(config).map((l) => l.name), blankStdDev: config.evidence.blankStdDev }
          });
          for (const f of files) opts.out(`${f.key}  ${f.bytes} bytes${f.url ? `  ${f.url}` : ""}`);
          opts.out(`lw qa publish: ${files.length} files to storage disk ${disk}`);
          return 0;
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa publish: ${cause.code}: ${cause.message}`);
          return 1;
        }
      }
    };
    qa_publish_default = publish;
  }
});

// src/services/gc.mts
async function size(path) {
  let s;
  try {
    s = await (0, import_promises17.stat)(path);
  } catch (cause) {
    if (cause.code === "ENOENT") return 0;
    throw new LaunchwrightError("qa.gc.read", `Cannot read ${path}`, { cause });
  }
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const name of await (0, import_promises17.readdir)(path)) total += await size((0, import_node_path30.join)(path, name));
  return total;
}
async function gcReports(reportDir, keep) {
  if (!Number.isInteger(keep) || keep < 0) throw new LaunchwrightError("qa.gc.keep", `--keep must be a whole number of reports, not ${keep}`);
  let names;
  try {
    names = await (0, import_promises17.readdir)(reportDir);
  } catch (cause) {
    if (cause.code === "ENOENT") return { kept: [], deleted: [] };
    throw new LaunchwrightError("qa.gc.read", `Cannot list ${reportDir}`, { cause });
  }
  const slugs = names.map((n) => REPORT_RE.exec(n)?.[1]).filter((s) => s !== void 0).sort().reverse();
  const result = { kept: slugs.slice(0, keep), deleted: [] };
  for (const slug3 of slugs.slice(keep)) {
    const paths = reportPaths(reportDir, slug3);
    const bytes = await size(paths.assets) + await size(paths.html);
    await (0, import_promises17.rm)(paths.assets, { recursive: true, force: true });
    await (0, import_promises17.rm)(paths.html, { force: true });
    if (bytes > 0) result.deleted.push({ slug: slug3, bytes });
  }
  return result;
}
var import_promises17, import_node_path30, REPORT_RE;
var init_gc = __esm({
  "src/services/gc.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises17 = require("fs/promises");
    import_node_path30 = require("path");
    init_kernel();
    init_ledger();
    REPORT_RE = /^(\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
  }
});

// src/commands/qa-gc.mts
var qa_gc_exports = {};
__export(qa_gc_exports, {
  default: () => qa_gc_default
});
var import_node_path31, gc, qa_gc_default;
var init_qa_gc = __esm({
  "src/commands/qa-gc.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path31 = require("path");
    init_kernel();
    init_args();
    init_config2();
    init_gc();
    gc = {
      name: "gc",
      summary: "Delete the evidence of older reports and keep the report files",
      async run(args, opts) {
        let given;
        try {
          const parsed = parseCommandArgs({ values: ["keep"] }, args);
          if (parsed.positionals.length === 0) given = parsed.values.keep;
        } catch (cause) {
          if (!(cause instanceof UsageError)) throw cause;
        }
        const keep = given !== void 0 && /^\d+$/.test(given) ? Number(given) : null;
        if (keep === null) {
          opts.err("usage: lw qa gc --keep <n>   keep the evidence of the n newest reports");
          return 2;
        }
        const config = qaConfigOf(opts.config);
        try {
          const result = await gcReports((0, import_node_path31.resolve)(opts.cwd, config.reportDir), keep);
          for (const d of result.deleted) opts.out(`deleted the evidence of ${d.slug} (${d.bytes} bytes)`);
          opts.out(`lw qa gc: kept the evidence of ${result.kept.length} reports, deleted ${result.deleted.length}`);
          return 0;
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa gc: ${cause.code}: ${cause.message}`);
          return 1;
        }
      }
    };
    qa_gc_default = gc;
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
function walk4(node, visit) {
  visit(node);
  import_typescript.default.forEachChild(node, (child) => walk4(child, visit));
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
  walk4(sf, (node) => {
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
  walk4(sf, (node) => {
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
  walk4(sf, (node) => {
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
  walk4(sf, (node) => {
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
  walk4(sf, (node) => {
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
  walk4(sf, (node) => {
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
  walk4(sf, (node) => {
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
function fieldFor(typeNode, resolve17, hops = 0) {
  if (!typeNode) return { kind: "opaque" };
  const keyword = KEYWORD_KINDS.get(typeNode.kind);
  if (keyword) return { kind: keyword };
  if (import_typescript.default.isUnionTypeNode(typeNode)) {
    const present = typeNode.types.filter((t) => !isNullish(t));
    const nullable = present.length !== typeNode.types.length;
    const inner = unionField(present, resolve17, hops);
    if (!inner) return { kind: "opaque" };
    return nullable ? { kind: "nullable", of: inner } : inner;
  }
  if (import_typescript.default.isTypeReferenceNode(typeNode) && hops < MAX_TYPE_HOPS) {
    const name = referencedName(typeNode);
    const aliased = name ? resolve17(name) : null;
    if (aliased) return fieldFor(aliased, resolve17, hops + 1);
  }
  return { kind: "opaque" };
}
function unionField(present, resolve17, hops) {
  if (present.length === 0) return null;
  if (present.length === 1) {
    const only = fieldFor(present[0], resolve17, hops);
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
  walk4(fn, (node) => {
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
  const absolute = (0, import_node_path32.join)(projectRoot2, dir);
  if (!(0, import_node_fs13.statSync)(absolute, { throwIfNoEntry: false })?.isDirectory()) {
    throw new LaunchwrightError("qa.states.root", `${dir} is not a folder under ${projectRoot2}. Check qa.clientRoots and qa.typeRoots.`, { context: { dir } });
  }
  const files = [];
  const visit = (at) => {
    for (const entry of (0, import_node_fs13.readdirSync)(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = (0, import_node_path32.join)(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") visit(child);
        continue;
      }
      const rel = (0, import_node_path32.relative)(projectRoot2, child).split(/[\\/]/).join("/");
      if (isProductSource(rel)) files.push({ file: rel, text: (0, import_node_fs13.readFileSync)(child, "utf8") });
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
var import_node_fs13, import_node_path32, import_typescript, NO_TYPES, KEYWORD_KINDS, MAX_TYPE_HOPS, NEGATIVE2, RELATIONAL, EQUALITY;
var init_scan = __esm({
  "src/states/services/scan.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs13 = require("fs");
    import_node_path32 = require("path");
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
  if (specifier.startsWith(".")) base = import_node_path33.posix.normalize(import_node_path33.posix.join(import_node_path33.posix.dirname(fromFile), specifier));
  else {
    for (const alias of Object.keys(aliases).sort((a, b) => b.length - a.length)) {
      const dir = aliases[alias];
      if (specifier === alias) base = dir;
      else if (specifier.startsWith(`${alias}/`)) base = import_node_path33.posix.normalize(`${dir}${specifier.slice(alias.length)}`);
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
          if (import_typescript2.default.isPropertyAssignment(member) && import_typescript2.default.isIdentifier(member.name) && (import_typescript2.default.isStringLiteral(member.initializer) || import_typescript2.default.isNoSubstitutionTemplateLiteral(member.initializer))) {
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
function localFunctions(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (import_typescript2.default.isFunctionDeclaration(node) && node.name && node.body && !found.has(node.name.text)) found.set(node.name.text, node);
    import_typescript2.default.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function fileScope(sf) {
  return { vocabulary: objectVocabulary(sf), constants: localConstants(sf), functions: localFunctions(sf), imported: () => null };
}
function moduleLinks(sf) {
  const named2 = /* @__PURE__ */ new Map();
  const star = [];
  for (const statement of sf.statements) {
    if (import_typescript2.default.isImportDeclaration(statement) && statement.importClause && import_typescript2.default.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause.name) named2.set(clause.name.text, { specifier, name: "default" });
      if (clause.namedBindings && import_typescript2.default.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) named2.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
    if (import_typescript2.default.isExportDeclaration(statement) && statement.moduleSpecifier && import_typescript2.default.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (!statement.exportClause) star.push(specifier);
      else if (import_typescript2.default.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) named2.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
  }
  return { named: named2, star };
}
function moduleScopes(parsed, resolve17) {
  const made = /* @__PURE__ */ new Map();
  const scopeOf = (file) => {
    const held = made.get(file);
    if (held) return held;
    const sf = parsed.get(file);
    if (!sf) return null;
    const own = fileScope(sf);
    let links = null;
    const scope = {
      vocabulary: own.vocabulary,
      constants: own.constants,
      functions: own.functions,
      imported(name) {
        links ??= moduleLinks(sf);
        const link = links.named.get(name);
        if (link) {
          const target = resolve17(file, link.specifier);
          const targetScope = target === null ? null : scopeOf(target);
          return targetScope ? { scope: targetScope, name: link.name } : null;
        }
        for (const specifier of links.star) {
          const target = resolve17(file, specifier);
          const targetScope = target === null ? null : scopeOf(target);
          if (targetScope && (targetScope.constants.has(name) || targetScope.vocabulary.has(name) || targetScope.functions.has(name))) return { scope: targetScope, name };
        }
        return null;
      }
    };
    made.set(file, scope);
    return scope;
  };
  return scopeOf;
}
function declarationOf(scope, name, depth = 0) {
  if (depth > MAX_HOPS) return null;
  const local = scope.constants.get(name);
  if (local) return { expression: local, scope };
  const link = scope.imported(name);
  return link ? declarationOf(link.scope, link.name, depth + 1) : null;
}
function vocabularyOf(scope, name, depth = 0) {
  if (depth > MAX_HOPS) return null;
  const local = scope.vocabulary.get(name);
  if (local) return local;
  if (scope.constants.has(name)) return null;
  const link = scope.imported(name);
  return link ? vocabularyOf(link.scope, link.name, depth + 1) : null;
}
function functionOf(scope, name, depth = 0) {
  if (depth > MAX_HOPS) return null;
  const declared = scope.functions.get(name);
  if (declared) return { fn: declared, scope };
  let constant = scope.constants.get(name);
  while (constant && (import_typescript2.default.isParenthesizedExpression(constant) || import_typescript2.default.isAsExpression(constant) || import_typescript2.default.isSatisfiesExpression(constant))) constant = constant.expression;
  if (constant) return import_typescript2.default.isArrowFunction(constant) || import_typescript2.default.isFunctionExpression(constant) ? { fn: constant, scope } : null;
  const link = scope.imported(name);
  return link ? functionOf(link.scope, link.name, depth + 1) : null;
}
function evaluateCondition(node, scope, depth, env) {
  if (import_typescript2.default.isParenthesizedExpression(node)) return evaluateCondition(node.expression, scope, depth + 1, env);
  if (!import_typescript2.default.isBinaryExpression(node)) return null;
  const op = node.operatorToken.kind;
  const equal = op === import_typescript2.default.SyntaxKind.EqualsEqualsEqualsToken || op === import_typescript2.default.SyntaxKind.EqualsEqualsToken;
  if (!equal && op !== import_typescript2.default.SyntaxKind.ExclamationEqualsEqualsToken && op !== import_typescript2.default.SyntaxKind.ExclamationEqualsToken) return null;
  const left = evaluatePath(node.left, scope, depth + 1, env);
  const right = evaluatePath(node.right, scope, depth + 1, env);
  if (left === null || right === null) return null;
  return equal ? left === right : left !== right;
}
function evaluateBody(body, scope, depth, env) {
  if (!import_typescript2.default.isBlock(body) && !import_typescript2.default.isReturnStatement(body) && !import_typescript2.default.isIfStatement(body)) return import_typescript2.default.isExpression(body) ? evaluatePath(body, scope, depth + 1, env) : null;
  const statements = import_typescript2.default.isBlock(body) ? body.statements : [body];
  for (const statement of statements) {
    if (import_typescript2.default.isReturnStatement(statement)) return evaluatePath(statement.expression, scope, depth + 1, env);
    if (!import_typescript2.default.isIfStatement(statement)) return null;
    const taken = evaluateCondition(statement.expression, scope, depth, env);
    if (taken === null) return null;
    const branch = taken ? statement.thenStatement : statement.elseStatement;
    if (branch === void 0) continue;
    return evaluateBody(branch, scope, depth + 1, env);
  }
  return null;
}
function wrappedPath(call, inner, scope, depth, env) {
  const name = import_typescript2.default.isIdentifier(call.expression) ? call.expression.text : import_typescript2.default.isPropertyAccessExpression(call.expression) ? call.expression.name.text : null;
  if (name === null) return inner;
  const found = import_typescript2.default.isIdentifier(call.expression) ? functionOf(scope, name) : null;
  const param = found?.fn.parameters[0]?.name;
  if (found && found.fn.body && param && import_typescript2.default.isIdentifier(param)) {
    const out = evaluateBody(found.fn.body, found.scope, depth + 1, { ...env, bindings: /* @__PURE__ */ new Map([[param.text, inner]]) });
    if (out !== null && out.startsWith("/")) return out;
  }
  const prefix = env.wrappers?.[name];
  return prefix === void 0 ? inner : joinPath(prefix.replace(/\/+$/, ""), inner);
}
function evaluatePath(node, scope, depth = 0, env = {}) {
  if (!node || depth > MAX_HOPS * 4) return null;
  if (import_typescript2.default.isStringLiteral(node) || import_typescript2.default.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (import_typescript2.default.isParenthesizedExpression(node) || import_typescript2.default.isAsExpression(node) || import_typescript2.default.isSatisfiesExpression(node)) return evaluatePath(node.expression, scope, depth + 1, env);
  if (import_typescript2.default.isPropertyAccessExpression(node) && import_typescript2.default.isIdentifier(node.expression)) {
    return vocabularyOf(scope, node.expression.text)?.get(node.name.text) ?? null;
  }
  if (import_typescript2.default.isIdentifier(node)) {
    const bound = env.bindings?.get(node.text);
    if (bound !== void 0) return bound;
    const declared = declarationOf(scope, node.text);
    return declared ? evaluatePath(declared.expression, declared.scope, depth + 1, env) : null;
  }
  if (import_typescript2.default.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const part = evaluatePath(span.expression, scope, depth + 1, env);
      if (part === null) return null;
      out += part + span.literal.text;
    }
    return out;
  }
  if (import_typescript2.default.isBinaryExpression(node) && node.operatorToken.kind === import_typescript2.default.SyntaxKind.PlusToken) {
    const left = evaluatePath(node.left, scope, depth + 1, env);
    const right = left === null ? null : evaluatePath(node.right, scope, depth + 1, env);
    return left === null || right === null ? null : left + right;
  }
  if (import_typescript2.default.isConditionalExpression(node)) {
    const taken = evaluateCondition(node.condition, scope, depth, env);
    return taken === null ? null : evaluatePath(taken ? node.whenTrue : node.whenFalse, scope, depth + 1, env);
  }
  if (import_typescript2.default.isCallExpression(node) && node.arguments.length === 1) {
    const inner = evaluatePath(node.arguments[0], scope, depth + 1, env);
    return inner !== null && inner.startsWith("/") ? wrappedPath(node, inner, scope, depth, env) : null;
  }
  return null;
}
function isDynamicPath(path) {
  return path.split("/").some((segment) => segment.startsWith(":") && !segment.endsWith("?"));
}
function groupPrefix(node, scope, env) {
  const prefixes = [];
  let at = node.parent;
  while (at) {
    if (import_typescript2.default.isCallExpression(at) && import_typescript2.default.isPropertyAccessExpression(at.expression) && at.expression.name.text === "group") {
      const [options] = at.arguments;
      if (options && import_typescript2.default.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (import_typescript2.default.isPropertyAssignment(property) && import_typescript2.default.isIdentifier(property.name) && property.name.text === "prefix") {
            const value = evaluatePath(property.initializer, scope, 0, env);
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
function routeRows(sf, scope = fileScope(sf), env = {}) {
  const rows = [];
  const push = (pathNode, component, pageName2, prefix, at = scope) => {
    const raw = evaluatePath(pathNode, at, 0, env);
    if (raw === "*") return;
    const path = raw === null ? null : joinPath(prefix, raw);
    rows.push({ path, component, pageName: pageName2, source: pathNode ? pathNode.getText(pathNode.getSourceFile()) : "<no path>", dynamic: path === null ? false : isDynamicPath(path) });
  };
  const visit = (node) => {
    if (import_typescript2.default.isCallExpression(node) && import_typescript2.default.isPropertyAccessExpression(node.expression) && node.expression.name.text === "page" && node.arguments.length >= 2) {
      const [pathNode, nameNode] = node.arguments;
      const pageName2 = nameNode && (import_typescript2.default.isStringLiteral(nameNode) || import_typescript2.default.isNoSubstitutionTemplateLiteral(nameNode)) ? nameNode.text : null;
      push(pathNode ?? null, null, pageName2, groupPrefix(node, scope, env));
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
      const declared = pathNode && import_typescript2.default.isIdentifier(pathNode) ? declarationOf(scope, pathNode.text) : null;
      if (declared && import_typescript2.default.isArrayLiteralExpression(declared.expression)) for (const one of declared.expression.elements) push(one, component, null, "", declared.scope);
      else if (pathNode && import_typescript2.default.isArrayLiteralExpression(pathNode)) for (const one of pathNode.elements) push(one, component, null, "");
      else push(pathNode, component, null, "");
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
function localDeclarations(sf) {
  const found = new Map(localConstants(sf));
  for (const statement of sf.statements) {
    if (import_typescript2.default.isFunctionDeclaration(statement) && statement.name && !found.has(statement.name.text)) found.set(statement.name.text, statement);
  }
  return found;
}
function localCalleesIn(node, locals) {
  const found = /* @__PURE__ */ new Set();
  const visit = (child) => {
    if (import_typescript2.default.isCallExpression(child) && import_typescript2.default.isIdentifier(child.expression) && locals.has(child.expression.text)) found.add(child.expression.text);
    import_typescript2.default.forEachChild(child, visit);
  };
  visit(node);
  return found;
}
function componentPages(component, sf, resolve17, seen = /* @__PURE__ */ new Set(), depth = 0) {
  if (component === null || seen.has(component) || depth > MAX_HOPS) return [];
  seen.add(component);
  const imports = importedNames(sf);
  const specifier = imports.get(component);
  if (specifier !== void 0) {
    const file = resolve17(specifier);
    return file === null ? [] : [file];
  }
  const locals = localDeclarations(sf);
  const declaration = locals.get(component);
  if (!declaration) return [];
  const pages = [];
  for (const name of /* @__PURE__ */ new Set([...jsxTagsIn(declaration), ...localCalleesIn(declaration, locals)])) {
    if (name === component) continue;
    pages.push(...componentPages(name, sf, resolve17, seen, depth + 1));
  }
  return [...new Set(pages)];
}
function pageFileFor(pageName2, pageRoots, files) {
  for (const root of pageRoots) {
    for (const suffix of PAGE_SUFFIXES) {
      const candidate = import_node_path33.posix.join(root, "pages", `${pageName2}${suffix}`);
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
  const scopeOf = moduleScopes(parsed, (from, specifier) => resolveSpecifier(from, specifier, files, aliases));
  const tables = input.tables.map((table) => {
    const sf = parsed.get(table.file);
    if (!sf) return { table, found: false, routes: [] };
    const resolve17 = (specifier) => resolveSpecifier(table.file, specifier, files, aliases);
    const routes = routeRows(sf, scopeOf(table.file) ?? fileScope(sf), { wrappers: input.wrappers ?? {} }).map((row) => ({
      path: row.path,
      dynamic: row.dynamic,
      source: row.source,
      pages: row.pageName !== null ? [pageFileFor(row.pageName, input.pageRoots, files)].filter((f) => f !== null) : componentPages(row.component, sf, resolve17)
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
  for (const { routes } of tables) for (const route of routes) for (const page2 of route.pages) if (!reach.has(page2)) reach.set(page2, reachFrom(edges, page2));
  const unions = input.inventory.unions.map((union) => {
    const anchor = anchorFor(union);
    const found = [];
    for (const { table, routes } of tables) {
      for (const route of routes) {
        if (route.path === null) continue;
        let best = null;
        let page2 = null;
        for (const candidate of route.pages) {
          const distance = reach.get(candidate)?.get(anchor);
          if (distance === void 0) continue;
          if (best === null || distance < best) {
            best = distance;
            page2 = candidate;
          }
        }
        if (best === null || page2 === null) continue;
        found.push({ surface: table.surface, route: route.path, page: page2, distance: best, dynamic: route.dynamic, reaches: reach.get(page2)?.size ?? 0 });
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
  const base = import_node_path33.posix.join(dir, options?.baseUrl ?? ".");
  const out = {};
  for (const [key, targets] of Object.entries(options?.paths ?? {})) {
    const [target] = targets;
    if (target === void 0) continue;
    const alias = key.replace(/\/\*$/, "");
    out[alias] = import_node_path33.posix.normalize(import_node_path33.posix.join(base, target.replace(/\/\*$/, "")));
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
var import_node_path33, import_typescript2, MAX_HOPS, CANDIDATES, PAGE_SUFFIXES;
var init_delivery = __esm({
  "src/states/services/delivery.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path33 = require("path");
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
    for (const dir of [root, import_node_path34.posix.dirname(root)]) {
      for (const name of TSCONFIG_NAMES) {
        const path = (0, import_node_path34.join)(projectRoot2, dir, name);
        if (!(0, import_node_fs14.existsSync)(path)) continue;
        for (const [alias, target] of Object.entries(aliasesFromTsconfig((0, import_node_fs14.readFileSync)(path, "utf8"), dir))) aliases[alias] ??= target;
      }
    }
  }
  return aliases;
}
function scanStates(projectRoot2, config, generated) {
  const scanned = scanProject(projectRoot2, { clientRoots: config.clientRoots, typeRoots: config.typeRoots, generated });
  const tables = normaliseTables(config.routeTables);
  const known = new Set(scanned.sources.map((s) => s.file));
  const tableSources = tables.filter((t) => !known.has(t.file) && (0, import_node_fs14.existsSync)((0, import_node_path34.join)(projectRoot2, t.file))).map((t) => ({ file: t.file, text: (0, import_node_fs14.readFileSync)((0, import_node_path34.join)(projectRoot2, t.file), "utf8") }));
  const map = buildRouteMap({
    inventory: scanned.inventory,
    sources: [...scanned.sources, ...tableSources],
    tables,
    pageRoots: config.clientRoots,
    aliases: readAliases(projectRoot2, config.clientRoots),
    wrappers: config.routeWrappers ?? {},
    generated
  });
  return { inventory: attachRoutes(scanned.inventory, map), problems: scanned.problems, map };
}
var import_node_fs14, import_node_path34, STATES_FILE, TSCONFIG_NAMES;
var init_project2 = __esm({
  "src/states/services/project.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs14 = require("fs");
    import_node_path34 = require("path");
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
function stateFindings(projectRoot2, config, generated) {
  const { inventory, problems } = scanStates(projectRoot2, config, generated);
  return [...c1Findings(inventory, problems), ...c4Findings(inventory)].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}
var init_check = __esm({
  "src/states/services/check.mts"() {
    "use strict";
    init_cjs_shims();
    init_project2();
  }
});

// src/services/check.mts
function toPosix(path) {
  return path.split(import_node_path35.sep).join("/");
}
function isCommentLine(line) {
  return /^\s*(?:\/\/|\/\*|\*|#)/.test(line);
}
function c3Findings(file, text2) {
  if (text2.includes(QA_DEV_MARKER)) return [];
  const out = [];
  text2.split("\n").forEach((line, i) => {
    if (isCommentLine(line)) return;
    const hit = C3_PATTERNS.find((p) => p.pattern.test(line));
    if (hit) {
      out.push({
        rule: "C3",
        file,
        line: i + 1,
        message: `${hit.what}. A component reaches a QA state through a persona or a fact, never through a test flag.`
      });
    }
  });
  return out;
}
function clientRootFindings(root, clientRoots) {
  return clientRoots.flatMap((dir) => readTree(root, dir)).flatMap((source) => c3Findings(source.file, source.text));
}
function waitFindings(file, text2) {
  const out = [];
  text2.split("\n").forEach((line, i) => {
    if (!isCommentLine(line) && WAIT_PATTERN.test(line)) {
      out.push({ rule: "wait", file, line: i + 1, message: "waitForTimeout in a QA file. Settle on a selector, artwork, a video or aria-busy instead." });
    }
  });
  return out;
}
function isQaFile(rel, reportDir) {
  if (!CODE_FILE.test(rel)) return false;
  const report3 = import_node_path35.posix.normalize(reportDir).replace(/\/$/, "");
  if (rel.startsWith(`${report3}/assets/`) || rel.startsWith(`${report3}/dist/`)) return false;
  if (rel.endsWith(WORLD_SUFFIX) || rel.endsWith(".shots.json")) return true;
  return rel.split("/").slice(0, -1).includes("qa");
}
async function entriesOf(dir) {
  try {
    return await (0, import_promises18.readdir)(dir, { withFileTypes: true });
  } catch (cause) {
    throw new LaunchwrightError("qa.check.read", `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
}
async function projectFiles(root, keep) {
  const out = [];
  const visit = async (dir) => {
    for (const entry of await entriesOf(dir)) {
      if (entry.name.startsWith(".") || SKIP2.has(entry.name)) continue;
      const path = (0, import_node_path35.join)(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && keep(toPosix((0, import_node_path35.relative)(root, path)))) out.push(toPosix((0, import_node_path35.relative)(root, path)));
    }
  };
  await visit(root);
  return out.sort();
}
async function projectText(root, file) {
  const text2 = await readTextOrNull((0, import_node_path35.join)(root, file));
  if (text2 === null) throw new LaunchwrightError("qa.check.read", `Cannot read ${file}.`, { context: { file } });
  return text2;
}
async function projectWaitFindings(root, reportDir) {
  const out = [];
  for (const file of await projectFiles(root, (rel) => isQaFile(rel, reportDir))) out.push(...waitFindings(file, await projectText(root, file)));
  return out;
}
async function worldFindings(root) {
  const out = (await worldLintFindings(root)).map((f) => ({ rule: "S1", file: f.file, line: f.line, message: f.message }));
  for (const feature of await featuresWithoutWorld(root)) {
    const text2 = await projectText(root, feature);
    if (!CLIENT_ROUTE_PATTERN.test(text2)) continue;
    const world2 = `${(0, import_node_path35.basename)(feature, FEATURE_SUFFIX)}${WORLD_SUFFIX}`;
    out.push({
      rule: "S1",
      file: feature,
      line: 0,
      message: `the feature opens a client route and has no ${world2} beside it. Add one with a persona or a fact for each state it shows.`
    });
  }
  return out;
}
function markerLine(text2) {
  const at = text2.indexOf(QA_DEV_MARKER);
  return text2.slice(0, at).split("\n").length;
}
async function buildFiles(dir) {
  const out = [];
  const visit = async (at) => {
    for (const entry of await entriesOf(at)) {
      const path = (0, import_node_path35.join)(at, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  await visit(dir);
  return out.sort();
}
async function bundleFindings(root, buildDirs, requireBuild) {
  const out = [];
  for (const dir of buildDirs) {
    if (await pathKind((0, import_node_path35.join)(root, dir)) !== "dir") {
      if (requireBuild) out.push({ rule: "S3", file: dir, line: 0, message: "the production client build is missing. Build the client, or fix qa.buildDirs." });
      continue;
    }
    for (const path of await buildFiles((0, import_node_path35.join)(root, dir))) {
      let bytes;
      try {
        bytes = await (0, import_promises18.readFile)(path);
      } catch (cause) {
        throw new LaunchwrightError("qa.check.read", `Cannot read ${path}.`, { cause });
      }
      if (!bytes.includes(QA_DEV_MARKER)) continue;
      out.push({
        rule: "S3",
        file: toPosix((0, import_node_path35.relative)(root, path)),
        line: markerLine(bytes.toString("utf8")),
        message: `the production build holds ${QA_DEV_MARKER}. Dev-only QA code reached the bundle: import it only from the dev server.`
      });
    }
  }
  return out;
}
async function runChecks(o) {
  const states = stateFindings(o.root, o.qa, o.generated).map((f) => ({
    rule: f.rule,
    file: f.file,
    line: f.line,
    message: f.message.startsWith(`${f.file}:${f.line} `) ? f.message.slice(`${f.file}:${f.line} `.length) : f.message
  }));
  const all = [
    ...states,
    ...clientRootFindings(o.root, o.qa.clientRoots),
    ...await worldFindings(o.root),
    ...await projectWaitFindings(o.root, o.qa.reportDir),
    ...await bundleFindings(o.root, o.qa.buildDirs, o.requireBuild)
  ];
  return all.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
}
function findingLine(f) {
  return `${f.rule} ${f.file}:${f.line} ${f.message}`;
}
var import_promises18, import_node_path35, C3_PATTERNS, WAIT_PATTERN, CLIENT_ROUTE_PATTERN, SKIP2, CODE_FILE;
var init_check2 = __esm({
  "src/services/check.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises18 = require("fs/promises");
    import_node_path35 = require("path");
    init_kernel();
    init_fs();
    init_names();
    init_check();
    init_scan();
    init_discover();
    C3_PATTERNS = [
      { name: "query", pattern: /[?&]qa=/, what: "reads the ?qa= persona parameter" },
      { name: "search-params", pattern: /\.(?:get|getAll|has)\(\s*(['"`])qa\1\s*\)/, what: "reads the query parameter 'qa'" },
      { name: "param-constant", pattern: /\bQA_PERSONA_PARAM\b/, what: "reads the persona parameter through QA_PERSONA_PARAM" },
      { name: "env-flag", pattern: /\b(?:import\.meta\.env|process\.env)\.\w*QA\w*/, what: "branches on a QA env flag" },
      { name: "global-flag", pattern: /\b(?:window|globalThis|self)\.__?\w*[qQ][aA]\w*/, what: "branches on a QA global" },
      { name: "flag-name", pattern: /\b(?:isQa|isQA|qaMode|QA_MODE|__QA__|inQa|underQa)\b/, what: "branches on a QA flag" }
    ];
    WAIT_PATTERN = /\bwaitForTimeout\b/;
    CLIENT_ROUTE_PATTERN = /\bweb_app\b|\bwebApp\w*|\bminiApp\w*/;
    SKIP2 = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "coverage"]);
    CODE_FILE = /\.(?:[cm]?[jt]sx?|json)$/;
  }
});

// src/commands/qa-check.mts
var qa_check_exports = {};
__export(qa_check_exports, {
  default: () => qa_check_default
});
async function run2(args, opts) {
  let build;
  try {
    const parsed2 = parseCommandArgs({ switches: ["build"] }, args);
    const [extra] = parsed2.positionals;
    if (extra !== void 0) throw new UsageError(`unknown argument ${extra}`);
    build = parsed2.switches.has("build");
  } catch (cause) {
    if (!(cause instanceof UsageError)) throw cause;
    opts.err(`lw qa check: ${cause.message}`);
    for (const line of USAGE6) opts.err(line);
    return 2;
  }
  const parsed = qaConfig.safeParse(opts.config?.qa ?? {});
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `qa.${i.path.map(String).join(".")} ${i.message}`);
    throw new LaunchwrightError("qa.config.invalid", `Config section qa is invalid: ${keys.join("; ")}`, { context: { keys } });
  }
  const findings = await runChecks({ root: opts.cwd, qa: withAppPaths(parsed.data, opts.config), generated: systemClock.date().toISOString(), requireBuild: build });
  for (const f of findings) opts.out(findingLine(f));
  opts.err(findings.length === 0 ? "lw qa check: no finding" : `lw qa check: ${findings.length} finding(s)`);
  return findings.length === 0 ? 0 : 1;
}
var USAGE6, check, qa_check_default;
var init_qa_check = __esm({
  "src/commands/qa-check.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_args();
    init_config2();
    init_check2();
    USAGE6 = [
      "usage: lw qa check [--build]",
      "  C1, C4  every state union is reachable live, mounted or intercepted (the state scan)",
      "  C3      no component in qa.clientRoots reads ?qa= or branches on a QA flag",
      "  S1      no raw SQL in a .world.mts, and a feature with a client route has a .world.mts",
      "  wait    no waitForTimeout in a .world.mts, a .shots.json or a file under a qa/ folder",
      "  S3      no file in qa.buildDirs holds lw-qa-dev-only",
      "  --build a missing folder of qa.buildDirs is a finding too"
    ];
    check = {
      name: "check",
      summary: "Check testability: state triggers, no QA flag in components, world files, no waitForTimeout, no dev marker in the build",
      async run(args, opts) {
        if (args[0] === "--help" || args[0] === "-h") {
          for (const line of USAGE6) opts.err(line);
          return 0;
        }
        try {
          return await run2(args, opts);
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa check: ${cause.message} (${cause.code})`);
          return 1;
        }
      }
    };
    qa_check_default = check;
  }
});

// src/commands/qa-world.mts
var qa_world_exports = {};
__export(qa_world_exports, {
  default: () => qa_world_default
});
async function run3(args, opts) {
  const { words, options } = parseArgs2(args, ["json", "reset", "status", "api", "list"]);
  const sub = words[0] ?? ["reset", "status", "api", "list"].find((f) => options[f] === true);
  const json = options.json === true;
  const ctx = await worldContext(opts);
  switch (sub) {
    case "list": {
      const registry = ctx.registry;
      const entries = listWorld(registry);
      const problem = registryProblem(registry);
      if (json) opts.out(JSON.stringify({ hash: registryHash(entries), problem, entries }, null, 2));
      else {
        for (const e of entries) opts.out(`${e.kind.padEnd(8)} ${e.id.padEnd(32)} ${e.feature.padEnd(16)} ${e.summary}`);
        opts.out(`${entries.length} entries, registry ${registryHash(entries)}${problem ? `; not seedable: ${problem}` : ""}`);
      }
      return problem ? 1 : 0;
    }
    case "reset": {
      const registry = ctx.registry;
      const entry = await loadAppEntry(ctx.root, ctx.qa);
      await resetWorld({
        root: ctx.root,
        sections: ctx.sections,
        env: ctx.env,
        entry,
        registry,
        overlay: ctx.overlay,
        ...ctx.qa.seed !== void 0 ? { seed: ctx.qa.seed } : {},
        clock: ctx.clock,
        out: opts.out
      });
      return 0;
    }
    case "status": {
      const status = await worldStatus({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, registry: ctx.registry, connect: worldConnect(ctx) });
      if (json) opts.out(JSON.stringify(status, null, 2));
      else {
        opts.out(`database ${status.database}: ${status.exists ? "exists" : "missing"}`);
        opts.out(`world    ${status.state}${status.stamp ? ` (seeded ${status.stamp.seededAt} from registry ${status.stamp.hash})` : ""}`);
        opts.out(`registry ${status.registryHash}`);
        if (status.state !== "current") opts.out("Run lw qa world reset.");
      }
      return status.state === "current" ? 0 : 1;
    }
    case "api": {
      const registry = ctx.registry;
      const entry = await loadAppEntry(ctx.root, ctx.qa);
      const stop = processSignal(opts.signal);
      try {
        await serveWorld(ctx, { entry, registry, port: ctx.qa.apiPort, signal: stop.signal, out: opts.out });
      } finally {
        stop.dispose();
      }
      return 0;
    }
    case "fork": {
      if (words[1] === "drop") {
        const name = words[2];
        if (name === void 0) {
          opts.err("usage: lw qa world fork drop <name>");
          return 2;
        }
        await dropFork({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, name, out: opts.out, connect: worldConnect(ctx) });
        return 0;
      }
      const label = words[1];
      if (label === void 0) {
        opts.err("usage: lw qa world fork <label>");
        return 2;
      }
      opts.out(await createFork({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, label, out: opts.out, connect: worldConnect(ctx) }));
      return 0;
    }
    default:
      for (const line of USAGE7) opts.err(line);
      return 2;
  }
}
var USAGE7, world, qa_world_default;
var init_qa_world = __esm({
  "src/commands/qa-world.mts"() {
    "use strict";
    init_cjs_shims();
    init_app2();
    init_api();
    init_context();
    init_fork();
    init_registry();
    init_world();
    USAGE7 = [
      "usage: lw qa world reset          drop, create and migrate the QA database, then run every seed",
      "       lw qa world status [--json] whether the QA database exists and was seeded from these world files",
      "       lw qa world api             serve the QA app on qa.apiPort until Ctrl-C",
      "       lw qa world list [--json]   the personas and facts of the world files",
      "       lw qa world fork <label>    copy the QA database to a per-pass fork and print its name",
      "       lw qa world fork drop <name> drop a per-pass fork of the QA database"
    ];
    world = {
      name: "world",
      summary: "the QA world: reset, status, api, fork and list of the personas and facts",
      run: (args, opts) => guarded("world", opts, () => run3(args, opts))
    };
    qa_world_default = world;
  }
});

// src/commands/qa-fixture.mts
var qa_fixture_exports = {};
__export(qa_fixture_exports, {
  default: () => qa_fixture_default
});
async function run4(args, opts) {
  const { words, options } = parseArgs2(args, [], ["persona"]);
  const [sub, fact] = words;
  if (sub === "arm" && fact !== void 0) {
    const ctx = await worldContext(opts);
    const persona = typeof options.persona === "string" ? options.persona : void 0;
    const armed = await withWorld(ctx, (world2, registry) => armFact(world2, registry, ctx.root, fact, persona === void 0 ? {} : { persona }));
    opts.out(`armed ${armed.fact}${armed.persona ? ` for ${armed.persona}` : ""} on ${ctx.overlay.database}: ${armed.steps.length} undo step(s). Disarm with lw qa fixture disarm.`);
    return 0;
  }
  if (sub === "disarm") {
    const ctx = await worldContext(opts);
    const done = await withWorld(ctx, (world2, registry) => disarmFact(world2, registry, ctx.root));
    opts.out(done.length > 0 ? `disarmed ${done.join(", ")}` : "nothing armed");
    return 0;
  }
  for (const line of USAGE8) opts.err(line);
  return 2;
}
var USAGE8, fixture, qa_fixture_default;
var init_qa_fixture = __esm({
  "src/commands/qa-fixture.mts"() {
    "use strict";
    init_cjs_shims();
    init_context();
    init_fixture();
    USAGE8 = [
      "usage: lw qa fixture arm <fact> [--persona <p>]  make a fact true on the QA database; the undo record is written first",
      "       lw qa fixture disarm                       replay every undo step in reverse order"
    ];
    fixture = {
      name: "fixture",
      summary: "arm a fact on the QA database for one row, and disarm it",
      run: (args, opts) => guarded("fixture", opts, () => run4(args, opts))
    };
    qa_fixture_default = fixture;
  }
});

// src/commands/qa-worktree.mts
var qa_worktree_exports = {};
__export(qa_worktree_exports, {
  default: () => qa_worktree_default
});
async function realDeps(opts, sections, menu, signal) {
  const dev = await loadDev();
  const { createDb, migrate } = await loadDb();
  const env = opts.processEnv ?? process.env;
  const configDir = dev.defaultConfigDir(env, (0, import_node_os.homedir)());
  return {
    admin: pgAdmin,
    async migrate(url, dir) {
      const db = await createDb({ driver: "pg", url });
      try {
        return (await migrate(db, dir)).applied;
      } finally {
        await db.close();
      }
    },
    runDev: (o) => dev.runDev({ root: o.root, commonDir: o.commonDir, configDir, env, out: opts.out, err: o.err, signal }, { replace: true }),
    liveRuns: () => new dev.RunRegistry(configDir).list(),
    currentRun: (root) => dev.readRun(dev.pidFile(root, "local")),
    setMenu: (url) => setMenuButton({ telegram: sections.telegram, ...menu.bot ? { bot: menu.bot } : {}, text: menu.text, url }),
    parseEnv: dev.parseEnvText
  };
}
async function run5(args, opts) {
  const { words, options } = parseArgs2(args, FLAGS, ["bot", "menu-text", "surface"]);
  if (words.length > 0) {
    opts.err("usage: lw qa worktree [--keep-db] [--cleanup] [--set-menu [--bot <name>] [--menu-text <text>] [--surface <s>]]");
    return 2;
  }
  const sections = opts.config ?? {};
  const stop = processSignal(opts.signal);
  try {
    const menu = { ...typeof options.bot === "string" ? { bot: options.bot } : {}, text: typeof options["menu-text"] === "string" ? options["menu-text"] : "Open" };
    const deps = await realDeps(opts, sections, menu, stop.signal);
    if (options.cleanup === true) {
      const dropped = await cleanupWorktrees({ root: opts.cwd, sections, out: opts.out, deps });
      opts.out(dropped.length > 0 ? `dropped ${dropped.length} copy(ies)` : "no copy of a dead run");
      return 0;
    }
    return await runWorktree({
      root: opts.cwd,
      sections,
      keepDb: options["keep-db"] === true,
      ...options["set-menu"] === true ? { setMenu: typeof options.surface === "string" ? { surface: options.surface } : {} } : {},
      out: opts.out,
      err: opts.err,
      deps
    });
  } finally {
    stop.dispose();
  }
}
var import_node_os, FLAGS, worktree, qa_worktree_default;
var init_qa_worktree = __esm({
  "src/commands/qa-worktree.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_os = require("os");
    init_peers2();
    init_context();
    init_menu();
    init_stack();
    init_worktree();
    FLAGS = ["keep-db", "cleanup", "set-menu"];
    worktree = {
      name: "worktree",
      summary: "run this worktree as the dev stack on a copy of the dev database, dropped on exit",
      run: (args, opts) => guarded("worktree", opts, () => run5(args, opts))
    };
    qa_worktree_default = worktree;
  }
});

// src/commands/qa-job.mts
var qa_job_exports = {};
__export(qa_job_exports, {
  default: () => qa_job_default
});
function payloadOf(text2) {
  if (typeof text2 !== "string") return void 0;
  try {
    return JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("qa.job.payload", "--payload is not JSON.", { cause });
  }
}
async function run6(args, opts) {
  const { words, options } = parseArgs2(args, [], ["payload", "tenant"]);
  const [sub = "list", kind] = words;
  if (sub !== "list" && !(sub === "run" && kind !== void 0)) {
    for (const line of USAGE9) opts.err(line);
    return 2;
  }
  const ctx = await worldContext(opts);
  await loadAppEntry(ctx.root, ctx.qa);
  await importProjectJobs(ctx.root, `${appPath(opts.config ?? {}, "node", "apps/api")}/src/jobs`);
  const queue = await importFromProject(ctx.root, "@launchwrighthq/queue");
  if (sub === "list") {
    const kinds = listJobs(queue);
    for (const k of kinds) opts.out(k);
    if (kinds.length === 0) opts.out("no registered job");
    return 0;
  }
  const payload = payloadOf(options.payload);
  const tenantId = typeof options.tenant === "string" ? options.tenant : void 0;
  await withWorld(ctx, (world2) => runJob(world2, queue, { kind, payload, ...tenantId ? { tenantId } : {}, clock: ctx.clock }));
  opts.out(`ran ${kind} once on ${ctx.overlay.database}`);
  return 0;
}
var USAGE9, job, qa_job_default;
var init_qa_job = __esm({
  "src/commands/qa-job.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_app2();
    init_context();
    init_jobs();
    USAGE9 = [
      "usage: lw qa job [list]                                      list the registered jobs",
      "       lw qa job run <kind> [--payload <json>] [--tenant <id>] run one job once on the QA app"
    ];
    job = {
      name: "job",
      summary: "list the registered jobs, or run one once on the QA app",
      run: (args, opts) => guarded("job", opts, () => run6(args, opts))
    };
    qa_job_default = job;
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
  const path = (0, import_node_path36.join)(root, seedFile(`${proposal.union}.${member}`));
  if ((0, import_node_fs15.existsSync)(path)) return false;
  (0, import_node_fs15.mkdirSync)((0, import_node_path36.dirname)(path), { recursive: true });
  (0, import_node_fs15.writeFileSync)(path, `${JSON.stringify(draftSeed(proposal, member), null, 2)}
`);
  return true;
}
function readSeed(path) {
  let value;
  try {
    value = JSON.parse((0, import_node_fs15.readFileSync)(path, "utf8"));
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
var import_node_fs15, import_node_path36, FORGE_DIR, cell2, seedRow, seedSchema, DRAFT_NOTE;
var init_forge_seed = __esm({
  "src/states/services/forge-seed.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs15 = require("fs");
    import_node_path36 = require("path");
    init_kernel();
    FORGE_DIR = ".lw/qa/forge";
    cell2 = import_zod6.z.union([import_zod6.z.string(), import_zod6.z.number(), import_zod6.z.boolean(), import_zod6.z.null()]);
    seedRow = import_zod6.z.object({ table: import_zod6.z.string().regex(/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i), values: import_zod6.z.record(import_zod6.z.string().regex(/^[a-z_][a-z0-9_]*$/i), cell2) });
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
function deviceOf(leg) {
  if (BROWSER_TARGETS.has(leg.target)) return `browser ${leg.browser ?? "chromium"}`;
  return leg.device ?? null;
}
function ledgerRecorder(args) {
  const entries = [];
  const device = args.leg.device;
  return {
    async record({ file, kind, row }) {
      entries.push(
        await ledgerEntry(args.reportDir, {
          path: (0, import_node_path37.relative)(args.reportDir, file).split("\\").join("/"),
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
var import_node_path37;
var init_run = __esm({
  "src/states/services/run.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path37 = require("path");
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
  const file = (0, import_node_path38.isAbsolute)(module2) ? module2 : (0, import_node_path38.resolve)(root, module2);
  let mod;
  try {
    mod = await import((0, import_node_url6.pathToFileURL)(file).href);
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
  const artifactFile = (0, import_node_path38.join)(ctx.reportDir, artifactRel);
  (0, import_node_fs16.mkdirSync)((0, import_node_path38.dirname)(artifactFile), { recursive: true });
  (0, import_node_fs16.writeFileSync)(artifactFile, `${JSON.stringify(artifact, null, 2)}
`);
  await recorder.record({ file: artifactFile, kind: "log", row: seed.state });
  const shotRel = statePath(ctx.slug, seed.state, "forged", "png");
  let error = null;
  let session2 = null;
  try {
    session2 = await ctx.target.open({ leg: ctx.leg, baseUrl, outDir: (0, import_node_path38.join)(reportPaths(ctx.reportDir, ctx.slug).assets, "states"), ...seed.persona ? { persona: seed.persona } : {} });
    await session2.navigate(seed.route);
    await session2.settle(seed.settle ?? { busy: true });
    await session2.screenshot((0, import_node_path38.join)(ctx.reportDir, shotRel));
    await recorder.record({ file: (0, import_node_path38.join)(ctx.reportDir, shotRel), kind: "screenshot", row: seed.state });
  } catch (cause) {
    error = messageOf(cause);
  } finally {
    await session2?.close();
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
var import_node_fs16, import_node_path38, import_node_url6, FORGE_NOTE;
var init_forge = __esm({
  "src/states/services/forge.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs16 = require("fs");
    import_node_path38 = require("path");
    import_node_url6 = require("url");
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
function reasonOf2(row) {
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
  const lines2 = [];
  for (const union of neitherUnions(inventory)) {
    lines2.push(
      `${union.name} (${union.file}) is neither an input nor an output: nothing takes it and nothing returns it, so no mechanism can reach its ${union.members.length} member(s). The state exists only inside a conditional, and the fix is to declare it.`
    );
  }
  for (const row of rows) {
    if (row.ok) continue;
    const reason = reasonOf2(row);
    if (reason === "no-mechanism") continue;
    lines2.push(`${row.id}: ${refusalFor(row)}.`);
  }
  return lines2;
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
function cell3(text2) {
  return String(text2 ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}
function provenanceLabel2(provenance) {
  if (provenance === "live") return null;
  if (provenance && PROVENANCE.includes(provenance)) return `(${provenance})`;
  return "(provenance not reported)";
}
function verifiedCell(row) {
  if (row.verified === true) return row.answered ? `yes (${cell3(row.answered)})` : "yes";
  if (row.verified === false) return "no";
  return "not verified";
}
function stateCell(union, row) {
  if (row.member === null) return "`null` (the function returned nothing)";
  if (row.member !== void 0) return cell3(row.member);
  const key = row.id.startsWith(`${union.name}.`) ? row.id.slice(union.name.length + 1) : row.id;
  return cell3(key.replace(/#/g, ", ").replace(/-/g, " "));
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
  const reason = reasonOf2(row);
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
function renderReport2(args) {
  const { inventory, rows, slug: slug3, narrowedBy = null, notRun = {} } = args;
  const out = [];
  const totals = { covered: 0, planned: 0 };
  out.push(`## State coverage${slug3 ? `: ${slug3}` : ""}`);
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
      const label = provenanceLabel2(row.provenance);
      const shot = row.ok ? [row.subject ? `![${cell3(row.id)}](${row.subject})` : "shot, but no path reported", label].filter(Boolean).join(" ") : "not shot";
      const expect = row.ok ? cell3(row.expect ?? "-") : cell3(refusalFor(row));
      out.push(`| ${stateCell(union, row)} | ${shot} | ${expect || "-"} | ${verifiedCell(row)} |`);
    }
    out.push("");
  }
  const orphans = rows.filter((row) => row.extra && !unionOf(inventory, row.id));
  if (orphans.length > 0) {
    out.push("### Reported by the runner, and in no union of the inventory");
    out.push("");
    for (const row of orphans) out.push(`- \`${cell3(row.id)}\` (${row.ok ? "ok" : "failed"})`);
    out.push("");
  }
  out.push(`${inventory.unions.length} union(s), ${totals.covered} of ${totals.planned} renderings.`);
  return out.join("\n");
}
function groupFor(union, captures, defaultLeg, surface) {
  const delivery = union.delivery ?? null;
  const missing = [];
  const derived = (union.routes ?? []).find((r) => !r.dynamic && (surface === void 0 || r.surface === surface))?.route ?? null;
  const route = typeof delivery?.route === "string" && delivery.route !== "" ? delivery.route : derived;
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
    ...typeof delivery.maxSubjectAreaRatio === "number" ? { maxSubjectAreaRatio: delivery.maxSubjectAreaRatio } : {},
    ...delivery.fixture?.persona ? { persona: delivery.fixture.persona } : {}
  };
  return { group, missing: null };
}
function groupsFor(inventory, captures, defaultLeg, surface) {
  const groups = [];
  const blocked = {};
  for (const union of inventory.unions) {
    const mine = captures.filter((capture) => capture.union === union.name && capture.mechanism === "solve");
    if (mine.length === 0) continue;
    const built = groupFor(union, mine, defaultLeg, surface);
    if (built.group) groups.push(built.group);
    else {
      blocked[union.name] = `no capture group could be built. Missing: ${built.missing.join(", ")}. A delivery descriptor beside the union in the inventory gives the intercept and the settle, and the route when the scan derives no static route. The shape and the pivots come from the scan`;
    }
  }
  return { groups, blocked };
}
function buildPlan(args) {
  const { inventory: scanned, narrow: narrow2 } = args;
  const inventory = narrow2 ? narrowInventory(scanned, narrow2).inventory : scanned;
  return {
    generated: args.generated,
    slug: args.slug,
    source: args.source,
    scanned: scanned.unions.length,
    narrowedBy: narrow2?.label ?? null,
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
  const lines2 = [renderReport2({ inventory: plan2.inventory, rows, slug: plan2.slug, narrowedBy: plan2.narrowedBy, notRun })];
  for (const line of malformed) lines2.push(`malformed result line, not read: ${line}`);
  const refusals = refusalLines(plan2.inventory, rows);
  if (refusals.length > 0) {
    lines2.push("", `REFUSED   ${refusals.length}, and each one is a failure:`);
    for (const line of refusals) lines2.push(`  ${line}`);
  }
  const neither = renderNeither(plan2.inventory);
  lines2.push(...neither);
  const notRunCount = Object.keys(notRun).length;
  const failed = rows.filter((row) => !row.ok).length;
  const refused = neitherUnions(plan2.inventory).length;
  lines2.push("");
  if (failed === 0 && refused === 0 && notRunCount === 0) lines2.push("every planned rendering was captured.");
  else lines2.push(`${failed} rendering(s) uncovered, ${refused} union(s) refused, ${notRunCount} mechanism(s) not run.`);
  return { lines: lines2, code: failed > 0 || refused > 0 || notRunCount > 0 ? 1 : 0, rows };
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

// src/states/services/sessions.mts
function sessionPool(target, base) {
  const held = /* @__PURE__ */ new Map();
  const notes = [];
  const label = (persona) => persona === null ? "no persona" : `persona ${persona}`;
  const dispose = async (session2, persona) => {
    try {
      await session2.close();
    } catch (err) {
      notes.push(`the lost session of ${label(persona)} did not close: ${messageOf(err).split("\n")[0]}`);
    }
  };
  const lost = (session2) => session2.isClosed?.() === true;
  return {
    notes,
    lost,
    async get(persona) {
      const key = persona ?? "";
      const open = held.get(key);
      if (open && !lost(open)) return open;
      if (open) {
        held.delete(key);
        await dispose(open, persona);
        notes.push(`the browser of ${label(persona)} closed, so a new session opened`);
      }
      const session2 = await target.open({ ...base, ...persona === null ? {} : { persona } });
      if (persona !== null && base.leg.surface === "miniapp") {
        try {
          await session2.navigate(PERSONA_LAUNCH_ROUTE);
        } catch (err) {
          await dispose(session2, persona);
          throw err;
        }
      }
      held.set(key, session2);
      return session2;
    },
    async close() {
      const all = [...held.entries()];
      held.clear();
      for (const [key, session2] of all) {
        if (lost(session2)) await dispose(session2, key === "" ? null : key);
        else await session2.close();
      }
    }
  };
}
function failedResult(capture, reason, error) {
  return { id: capture.id, union: capture.union, member: capture.member, ok: false, subject: null, context: null, provenance: null, verified: null, error, reason, ms: 0 };
}
async function onSession(pool2, persona, captures, work) {
  let session2;
  try {
    session2 = await pool2.get(persona);
  } catch (err) {
    const who = persona === null ? "the session" : `the session of persona ${persona}`;
    return captures.map((c) => failedResult(c, "blocked", `${who} did not open: ${firstLine2(err)}`));
  }
  let results;
  try {
    results = await work(session2);
  } catch (err) {
    if (!pool2.lost(session2)) throw err;
    results = captures.map((c) => failedResult(c, "crashed", firstLine2(err)));
  }
  if (!pool2.lost(session2)) return results;
  return results.map((r) => r.ok ? r : { ...r, reason: "crashed", error: `the browser closed during this capture: ${r.error ?? "no reason given"}` });
}
var PERSONA_LAUNCH_ROUTE, firstLine2;
var init_sessions = __esm({
  "src/states/services/sessions.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    PERSONA_LAUNCH_ROUTE = "/";
    firstLine2 = (err) => messageOf(err).split("\n")[0] ?? "";
  }
});

// src/states/services/descriptors.mts
function issueLines(error) {
  return error.issues.map((issue) => `  ${issue.path.map(String).join(".") || "(file)"}: ${issue.message}`);
}
function readDescriptors(kind, root, config, unions) {
  const { key, fallback, schema } = KINDS2[kind];
  const named2 = config.states[kind];
  const rel = named2 ?? fallback;
  const path = (0, import_node_path39.join)(root, rel);
  if (!(0, import_node_fs17.existsSync)(path)) {
    if (named2 === void 0) return { file: null, entries: {} };
    throw new LaunchwrightError("qa.states.descriptors", `${key} names ${rel}, and the file does not exist.`, { context: { key, file: rel } });
  }
  let parsed;
  try {
    parsed = JSON.parse((0, import_node_fs17.readFileSync)(path, "utf8"));
  } catch (cause) {
    throw new LaunchwrightError("qa.states.descriptors", `${rel} (${key}) is not JSON.`, { cause, context: { key, file: rel } });
  }
  const result = import_zod6.z.record(import_zod6.z.string(), schema).safeParse(parsed);
  if (!result.success) {
    throw new LaunchwrightError("qa.states.descriptors", `${rel} (${key}) does not match its schema:
${issueLines(result.error).join("\n")}`, {
      context: { key, file: rel }
    });
  }
  const unknown = Object.keys(result.data).filter((name) => !unions.includes(name));
  if (unknown.length > 0) {
    throw new LaunchwrightError("qa.states.descriptors", `${rel} (${key}) names ${unknown.join(", ")}, and the state scan finds no union of that name.`, {
      context: { key, file: rel, unknown }
    });
  }
  return { file: rel, entries: result.data };
}
function withDescriptors(inventory, root, config) {
  const names = [...inventory.unions.map((u) => u.name), ...inventory.ignored.map((g) => g.name)];
  const delivery = readDescriptors("delivery", root, config, names).entries;
  const mounts = readDescriptors("mounts", root, config, names).entries;
  return {
    ...inventory,
    unions: inventory.unions.map((union) => ({
      ...union,
      ...delivery[union.name] ? { delivery: delivery[union.name] } : {},
      ...mounts[union.name] ? { mount: mounts[union.name] } : {}
    }))
  };
}
var import_node_fs17, import_node_path39, DEFAULT_DELIVERY_FILE, DEFAULT_MOUNTS_FILE, fixture2, deliverySchema, mountSchema, KINDS2;
var init_descriptors = __esm({
  "src/states/services/descriptors.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs17 = require("fs");
    import_node_path39 = require("path");
    init_kernel();
    init_manifest2();
    DEFAULT_DELIVERY_FILE = ".lw/qa/delivery.json";
    DEFAULT_MOUNTS_FILE = ".lw/qa/mounts.json";
    fixture2 = import_zod6.z.strictObject({ persona: import_zod6.z.string().regex(KEBAB, "must be a kebab-case persona id").optional() });
    deliverySchema = import_zod6.z.strictObject({
      route: import_zod6.z.string().startsWith("/").optional(),
      leg: import_zod6.z.string().min(1).optional(),
      intercept: import_zod6.z.strictObject({ url: import_zod6.z.string().min(1), container: import_zod6.z.string().min(1) }),
      settle: import_zod6.z.strictObject({
        selector: import_zod6.z.string().min(1).optional(),
        artwork: import_zod6.z.boolean().optional(),
        video: import_zod6.z.boolean().optional(),
        busy: import_zod6.z.boolean().optional(),
        timeout: import_zod6.z.number().int().positive().optional()
      }),
      act: import_zod6.z.array(import_zod6.z.unknown()).optional(),
      verifyArgs: import_zod6.z.array(import_zod6.z.unknown()).optional(),
      pivotModules: import_zod6.z.array(import_zod6.z.string()).optional(),
      limit: import_zod6.z.number().int().positive().optional(),
      batchSize: import_zod6.z.number().int().positive().optional(),
      contrast: import_zod6.z.unknown().optional(),
      diffRoot: import_zod6.z.string().min(1).optional(),
      ignoreAttributes: import_zod6.z.array(import_zod6.z.string()).optional(),
      maxSubjectAreaRatio: import_zod6.z.number().positive().max(1).optional(),
      fixture: fixture2.optional()
    });
    mountSchema = import_zod6.z.strictObject({
      component: import_zod6.z.string().min(1).optional(),
      leg: import_zod6.z.string().min(1).optional(),
      width: import_zod6.z.string().min(1).optional(),
      props: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.unknown()).optional(),
      members: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.record(import_zod6.z.string(), import_zod6.z.unknown())).optional(),
      settle: import_zod6.z.strictObject({ selector: import_zod6.z.string().min(1).optional(), timeout: import_zod6.z.number().int().positive().optional() }).optional(),
      fixture: fixture2.optional()
    });
    KINDS2 = {
      delivery: { key: "qa.states.delivery", fallback: DEFAULT_DELIVERY_FILE, schema: deliverySchema },
      mounts: { key: "qa.states.mounts", fallback: DEFAULT_MOUNTS_FILE, schema: mountSchema }
    };
  }
});

// src/commands/qa-states.mts
var qa_states_exports = {};
__export(qa_states_exports, {
  createStatesCommand: () => createStatesCommand,
  default: () => qa_states_default
});
function flag(args, name) {
  return args.values[name] ?? null;
}
function list2(value) {
  return value === null ? void 0 : value.split(",").map((s) => s.trim()).filter(Boolean);
}
function writeJson2(path, value) {
  (0, import_node_fs18.mkdirSync)((0, import_node_path40.dirname)(path), { recursive: true });
  (0, import_node_fs18.writeFileSync)(path, `${JSON.stringify(value, null, 2)}
`);
}
function runFiles(cwd, slug3) {
  return { plan: (0, import_node_path40.join)(cwd, ".lw/qa/states", `${slug3}.plan.json`), results: (0, import_node_path40.join)(cwd, ".lw/qa/states", `${slug3}.results.jsonl`) };
}
function narrowOf(args) {
  const files = list2(flag(args, "files"));
  const dirs = list2(flag(args, "dirs"));
  if (!files && !dirs) return void 0;
  return { ...files ? { files } : {}, ...dirs ? { dirs } : {}, label: [...files ?? [], ...dirs ?? []].join(", ") };
}
function freshInventory(cwd, config, generated) {
  return withDescriptors(scanStates(cwd, config, generated).inventory, cwd, config);
}
function scan(args, opts, config, generated) {
  const result = scanStates(opts.cwd, config, generated);
  const findings = [...c1Findings(result.inventory, result.problems), ...c4Findings(result.inventory)];
  writeJson2((0, import_node_path40.join)(opts.cwd, STATES_FILE), { ...result.inventory, tables: result.map.tables, problems: result.problems });
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
  const narrow2 = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: "lw qa states scan", slug: DEFAULT_SLUG, generated, ...narrow2 ? { narrow: narrow2 } : {} });
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
  const slug3 = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const deps = runDeps(config, app, overrides, opts.targets);
  const world2 = await worldContext({ cwd: opts.cwd, out: opts.out, err: opts.err, ...opts.config ? { config: opts.config } : {}, ...opts.env ? { env: opts.env } : {} });
  const entry = await loadAppEntry(world2.root, world2.qa);
  const forkOptions = { root: world2.root, sections: world2.sections, env: world2.env, overlay: world2.overlay, entry, registry: world2.registry, out: opts.out, ...overrides.listen ? { listen: overrides.listen } : {} };
  const context = {
    root: opts.cwd,
    reportDir: (0, import_node_path40.resolve)(opts.cwd, config.reportDir),
    slug: slug3,
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
      const seed = acceptedSeed(readSeed((0, import_node_path40.join)(opts.cwd, seedFile(state))));
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
  const slug3 = flag(args, "slug") ?? DEFAULT_FORGE_SLUG;
  opts.out(`forged ${ready.length - failed} of ${ready.length} accepted seed(s), ${waiting} waiting -> ${(0, import_node_path40.relative)(opts.cwd, reportPaths((0, import_node_path40.resolve)(opts.cwd, config.reportDir), slug3).ledger)}`);
  opts.out(FORGE_NOTE);
  return failed > 0 ? 1 : 0;
}
async function forge(args, opts, config, app, overrides) {
  const [state, extra] = args.positionals;
  if (state === void 0 || extra !== void 0) throw new UsageError("forge needs one state id <union>.<member>");
  const rel = flag(args, "seed") ?? seedFile(state);
  const path = (0, import_node_path40.resolve)(opts.cwd, rel);
  if (!(0, import_node_fs18.existsSync)(path)) throw new LaunchwrightError("qa.forge.seed", `${rel} does not exist. Run lw qa states infer --apply to write its draft.`, { context: { state } });
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
async function run7(args, opts, config, deps) {
  const slug3 = flag(args, "slug") ?? DEFAULT_SLUG;
  const leg = legByName(config, flag(args, "leg") ?? DEFAULT_LEG);
  const base = flag(args, "base") ?? config.baseUrls[leg.surface];
  if (!base) {
    throw new LaunchwrightError("qa.states.usage", `run needs --base <url> or qa.baseUrls.${leg.surface}: the origin of the client dev server that serves /__states`);
  }
  const generated = deps.clock.date().toISOString();
  const narrow2 = narrowOf(args);
  const built = buildPlan({ inventory: freshInventory(opts.cwd, config, generated), source: "lw qa states scan", slug: slug3, generated, ...narrow2 ? { narrow: narrow2 } : {} });
  for (const line of renderPlan(built)) opts.out(line);
  const reportDir = (0, import_node_path40.resolve)(opts.cwd, config.reportDir);
  const files = runFiles(opts.cwd, slug3);
  const notRun = {};
  const target = deps.targets.get(leg.target);
  const ready = await target.ready(leg);
  const { groups, blocked } = groupsFor(built.inventory, built.captures, leg.name, leg.surface);
  const attempts = [];
  const revision2 = deps.revision(opts.cwd);
  const now = () => deps.clock.now();
  if (!ready.ready) {
    const why = `the target ${leg.target} of leg ${leg.name} is not ready: ${ready.reason ?? "no reason given"}`;
    notRun.mount = why;
    notRun.solve = why;
  } else {
    const pool2 = sessionPool(target, { leg, baseUrl: base, outDir: (0, import_node_path40.join)(reportPaths(reportDir, slug3).assets, "states") });
    try {
      const mounted = ledgerRecorder({ reportDir, slug: slug3, leg, provenance: "mounted", clock: deps.clock, revision: revision2 });
      for (const capture of built.captures.filter((c) => c.mechanism === "mount")) {
        const resolved = resolveMount(built.inventory, capture, leg.name);
        attempts.push(...await onSession(pool2, resolved.persona, [capture], async (session2) => [await captureMounted(session2, resolved, { reportDir, slug: slug3, record: mounted.record, now })]));
      }
      await mounted.flush();
      const intercepted = ledgerRecorder({ reportDir, slug: slug3, leg, provenance: "intercepted", clock: deps.clock, revision: revision2 });
      for (const group of groups) {
        const members = group.members.map((m) => ({ id: m.id, union: group.union, member: m.member }));
        const results = await onSession(pool2, group.persona ?? null, members, async (session2) => {
          const page2 = session2.routable?.();
          if (!page2) {
            notRun.solve = `the target ${leg.target} gives no routable page, so no response can be intercepted`;
            return [];
          }
          const captured = await captureGroup(session2, page2, group, { projectRoot: opts.cwd, reportDir, slug: slug3, record: intercepted.record, now });
          for (const note of captured.notes) opts.out(`${group.union}: ${note}`);
          return captured.results;
        });
        attempts.push(...results);
        if (notRun.solve !== void 0) break;
      }
      await intercepted.flush();
    } finally {
      await pool2.close();
      for (const note of pool2.notes) opts.out(`session    ${note}`);
    }
  }
  writeJson2(files.plan, { ...built, notRun, blocked });
  (0, import_node_fs18.mkdirSync)((0, import_node_path40.dirname)(files.results), { recursive: true });
  (0, import_node_fs18.writeFileSync)(files.results, attempts.map((a) => `${JSON.stringify(a)}
`).join(""));
  opts.out("");
  opts.out(`plan       ${files.plan}`);
  opts.out(`results    ${files.results}`);
  const finished = finishRun({ plan: built, attempts, notRun, blocked });
  for (const line of finished.lines) opts.out(line);
  return finished.code;
}
function report2(args, opts) {
  const slug3 = flag(args, "slug") ?? DEFAULT_SLUG;
  const files = runFiles(opts.cwd, slug3);
  if (!(0, import_node_fs18.existsSync)(files.plan)) throw new LaunchwrightError("qa.states.no-run", `No state run of slug ${slug3}: ${files.plan} does not exist. Run "lw qa states run" first.`);
  const saved = JSON.parse((0, import_node_fs18.readFileSync)(files.plan, "utf8"));
  const inventory = parseInventory(JSON.stringify(saved.inventory), files.plan);
  const { attempts, malformed } = parseResults((0, import_node_fs18.existsSync)(files.results) ? (0, import_node_fs18.readFileSync)(files.results, "utf8") : "");
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
        for (const line of USAGE10) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const cwd = (0, import_node_path40.isAbsolute)(opts.cwd) ? opts.cwd : (0, import_node_path40.resolve)(opts.cwd);
      const inner = { ...opts, cwd };
      try {
        const flags = parseCommandArgs(FLAGS2[action], rest);
        const app = opts.app;
        if (action === "run") return await run7(flags, inner, config, runDeps(config, app, overrides, opts.targets));
        if (action === "report") return report2(flags, inner);
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
var import_node_fs18, import_node_path40, USAGE10, DEFAULT_SLUG, DEFAULT_FORGE_SLUG, DEFAULT_LEG, FLAGS2, qa_states_default;
var init_qa_states = __esm({
  "src/commands/qa-states.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs18 = require("fs");
    import_node_path40 = require("path");
    init_kernel();
    init_args();
    init_config2();
    init_ledger();
    init_capture();
    init_check();
    init_delivery();
    init_forge();
    init_forge_seed();
    init_inventory();
    init_loop();
    init_mount();
    init_sessions();
    init_descriptors();
    init_project2();
    init_run();
    init_app2();
    init_context();
    init_fork_server();
    USAGE10 = [
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
      "qa.states.delivery names the file of delivery descriptors (union name to { route, intercept, settle, fixture }) that feeds",
      "intercepted capture, and qa.states.mounts the file of mount hints (union name to { component, props, members, fixture }).",
      "Without them, a run reads .lw/qa/delivery.json and .lw/qa/mounts.json when they exist. fixture.persona signs a persona in first."
    ];
    DEFAULT_SLUG = "states";
    DEFAULT_FORGE_SLUG = "forged";
    DEFAULT_LEG = "desktop";
    FLAGS2 = {
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

// src/commands/qa-paths.mts
var qa_paths_exports = {};
__export(qa_paths_exports, {
  createPathsCommand: () => createPathsCommand,
  default: () => qa_paths_default
});
function flag2(args, name) {
  return args.values[name] ?? null;
}
function baseFor(args, config, surface) {
  const base = flag2(args, "base") ?? config.baseUrls[surface];
  if (!base) throw new LaunchwrightError("qa.paths.usage", `crawl and record need --base <url> or qa.baseUrls.${surface}: the origin of the surface the legs open`);
  return base;
}
function runDir(cwd, slug3) {
  return (0, import_node_path41.join)(cwd, ".lw/qa/paths", slug3);
}
function writeJson3(path, value) {
  (0, import_node_fs19.mkdirSync)((0, import_node_path41.dirname)(path), { recursive: true });
  (0, import_node_fs19.writeFileSync)(path, `${JSON.stringify(value, null, 2)}
`);
}
function readLines(path) {
  if (!(0, import_node_fs19.existsSync)(path)) return [];
  return (0, import_node_fs19.readFileSync)(path, "utf8").split("\n").filter((l) => l.trim() !== "").map((l, i) => {
    try {
      return JSON.parse(l);
    } catch (cause) {
      throw new LaunchwrightError("qa.paths.results", `${path} line ${i + 1} is not JSON`, { cause, context: { path, line: i + 1 } });
    }
  });
}
function plansFor(args, opts, config, generated) {
  const slug3 = flag2(args, "slug") ?? DEFAULT_SLUG2;
  const named2 = flag2(args, "legs");
  const { inventory } = scanStates(opts.cwd, config, generated);
  const targets = targetsFrom(inventory);
  const plans = (named2?.split(",") ?? DEFAULT_LEGS2).map((s) => s.trim()).filter(Boolean).map((name) => {
    const leg = legByName(config, name);
    return buildCrawlPlan({ slug: slug3, leg: leg.name, surface: leg.surface, targets });
  });
  const empty = plans.filter((p) => p.targets.length === 0);
  if (named2 !== null && empty.length > 0) {
    throw new LaunchwrightError("qa.paths.no-targets", `The delivery scan names no route on the surface of leg(s) ${empty.map((p) => `${p.leg} (${p.surface})`).join(", ")}. Check qa.routeTables.`);
  }
  const kept = plans.filter((p) => p.targets.length > 0);
  if (kept.length === 0) throw new LaunchwrightError("qa.paths.no-targets", "The delivery scan names no route on any surface of the default legs. Check qa.routeTables.");
  return kept;
}
function planCmd(args, opts, config, generated) {
  for (const plan2 of plansFor(args, opts, config, generated)) {
    const out = (0, import_node_path41.join)(runDir(opts.cwd, plan2.slug), `plan.${plan2.leg}.json`);
    writeJson3(out, plan2);
    opts.out(`leg ${plan2.leg}: ${plan2.targets.length} target route(s) -> ${out}`);
  }
  return 0;
}
async function crawlLeg(target, open, plan2) {
  let session2 = null;
  let result;
  try {
    session2 = await target.open(open);
    result = { ...await crawl(session2, plan2), crashed: null };
  } catch (cause) {
    if (isCodedError(cause) && cause.code === "qa.paths.evaluate") throw cause;
    const why = cause instanceof Error ? cause.message.split("\n")[0] ?? "" : String(cause);
    result = { paths: [], visited: [], failures: [], targets: targetResults(plan2, [], why), crashed: why };
  } finally {
    await session2?.close();
  }
  const halted = result.targets.find((t) => t.error !== void 0)?.error ?? null;
  return { ...result, crashed: result.crashed ?? halted };
}
async function crawlCmd(args, opts, config, deps) {
  let failed = false;
  for (const plan2 of plansFor(args, opts, config, deps.clock.date().toISOString())) {
    const leg = legByName(config, plan2.leg);
    const dir = runDir(opts.cwd, plan2.slug);
    writeJson3((0, import_node_path41.join)(dir, `plan.${plan2.leg}.json`), plan2);
    const target = deps.targets.get(leg.target);
    const ready = await target.ready(leg);
    if (!ready.ready) {
      failed = true;
      opts.err(`leg ${leg.name}: the target ${leg.target} is not ready: ${ready.reason ?? "no reason given"}`);
      continue;
    }
    const result = await crawlLeg(target, { leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir }, plan2);
    const { paths } = result;
    const log = (0, import_node_path41.join)(dir, `results.${plan2.leg}.jsonl`);
    (0, import_node_fs19.mkdirSync)((0, import_node_path41.dirname)(log), { recursive: true });
    (0, import_node_fs19.writeFileSync)(log, paths.map((p) => `${JSON.stringify(p)}
`).join(""));
    writeJson3((0, import_node_path41.join)(dir, `targets.${plan2.leg}.json`), { targets: result.targets, failures: result.failures });
    const reached = result.targets.filter((t) => t.reached).length;
    opts.out(`leg ${plan2.leg}: ${paths.length} path(s), ${reached} of ${plan2.targets.length} target route(s) reached -> ${log}`);
    for (const path of paths) opts.out(`  ${path.readable}`);
    for (const failure of result.failures) opts.err(`leg ${plan2.leg}: step ${failure.kind} on ${failure.route}${failure.label ? ` "${failure.label}"` : ""}: ${failure.error}`);
    if (result.crashed !== null) {
      failed = true;
      opts.err(`leg ${plan2.leg}: the crawl did not finish: ${result.crashed}`);
    }
    const drift = routeDrift(plan2.targets, paths.map((p) => ({ id: p.id, surface: plan2.surface, route: p.route })));
    if (drift.length > 0) {
      failed = true;
      opts.err(`leg ${plan2.leg}: route-drift, ${drift.length} route(s) the delivery scan does not name:`);
      for (const d of drift) opts.err(`  ${d.id} -> ${d.route}`);
    }
  }
  return failed ? 1 : 0;
}
async function recordCmd(args, opts, config, deps) {
  const slug3 = flag2(args, "slug") ?? DEFAULT_SLUG2;
  const only = flag2(args, "only");
  const dir = runDir(opts.cwd, slug3);
  const legs = (flag2(args, "legs")?.split(",") ?? DEFAULT_LEGS2).map((s) => s.trim()).filter(Boolean);
  const discovered = legs.flatMap((leg) => readLines((0, import_node_path41.join)(dir, `results.${leg}.jsonl`)));
  if (discovered.length === 0) throw new LaunchwrightError("qa.paths.no-paths", `No crawled path under ${dir}. Run "lw qa paths crawl" first.`);
  const wanted = only ? discovered.filter((p) => p.id === only) : discovered;
  if (wanted.length === 0) throw new LaunchwrightError("qa.paths.no-paths", `No crawled path is named ${only}.`);
  const reportDir = (0, import_node_path41.resolve)(opts.cwd, config.reportDir);
  const revision2 = deps.revision(opts.cwd);
  const lines2 = [];
  for (const legName of legs) {
    const mine = wanted.filter((p) => p.leg === legName);
    if (mine.length === 0) continue;
    const leg = legByName(config, legName);
    const target = deps.targets.get(leg.target);
    if (!target.capabilities.has("video")) {
      for (const path of mine) lines2.push({ id: path.id, leg: legName, ok: false, reason: "crashed", error: `the target ${leg.target} cannot record video`, na: "video" });
      continue;
    }
    const recorder = ledgerRecorder({ reportDir, slug: slug3, leg, provenance: "live", clock: deps.clock, revision: revision2 });
    let session2 = null;
    try {
      session2 = await target.open({ leg, baseUrl: baseFor(args, config, leg.surface), outDir: dir });
      for (const path of mine) {
        const file = (0, import_node_path41.join)(reportDir, videoPath(slug3, path.id, legName, "webm"));
        (0, import_node_fs19.mkdirSync)((0, import_node_path41.dirname)(file), { recursive: true });
        const recorded = await recordPath(session2, { root: path.from, path, file, device: deviceOf(leg), capS: config.evidence.videoCapS, now: () => deps.clock.now() }).catch(
          (cause) => ({ ok: false, reason: "crashed", error: cause instanceof Error ? cause.message.split("\n")[0] ?? "" : String(cause) })
        );
        const kept = recorded.ok ? recorded.file : "file" in recorded ? recorded.file : void 0;
        if (kept !== void 0 && (0, import_node_fs19.existsSync)(kept)) await recorder.record({ file: kept, kind: "video", row: path.id });
        lines2.push({ ...recorded, id: path.id, leg: legName });
      }
    } finally {
      await session2?.close();
      await recorder.flush();
    }
  }
  (0, import_node_fs19.writeFileSync)((0, import_node_path41.join)(dir, "videos.path.jsonl"), lines2.map((l) => `${JSON.stringify(l)}
`).join(""));
  let failed = 0;
  for (const line of lines2) {
    if (line.ok) {
      if (!(0, import_node_fs19.existsSync)(line.file)) {
        failed += 1;
        opts.err(`${line.leg} ${line.id}: the target reported a recording and wrote no file (${line.file})`);
        continue;
      }
      opts.out(`${line.leg} ${line.id}: ${line.file}`);
    } else if (line.na) {
      opts.out(`${line.leg} ${line.id}: n/a (${line.na}): ${line.error}`);
    } else {
      failed += 1;
      opts.err(`${line.leg} ${line.id}: not recorded (${line.reason}) ${line.error}`);
    }
  }
  return failed > 0 ? 1 : 0;
}
function reportCmd(args, opts, config, generated) {
  const slug3 = flag2(args, "slug") ?? DEFAULT_SLUG2;
  const dir = runDir(opts.cwd, slug3);
  const legs = (flag2(args, "legs")?.split(",") ?? DEFAULT_LEGS2).map((s) => s.trim()).filter(Boolean);
  const { inventory } = scanStates(opts.cwd, config, generated);
  const targets = targetsFrom(inventory);
  const paths = legs.flatMap((name) => {
    const leg = legByName(config, name);
    return readLines((0, import_node_path41.join)(dir, `results.${name}.jsonl`)).map((p) => ({ ...p, surface: leg.surface }));
  });
  const videos = readLines((0, import_node_path41.join)(dir, "videos.path.jsonl"));
  const cross = crossReach(targets, paths);
  const reached = cross.routes.filter((r) => r.reached).length;
  opts.out("## Paths");
  opts.out("");
  opts.out(`${paths.length} path(s), ${reached} of ${cross.routes.length} target routes reached`);
  for (const path of paths) opts.out(`- ${path.readable}`);
  opts.out("");
  opts.out("## Reachability");
  opts.out("");
  opts.out("| Union | Reachable |");
  opts.out("|---|---|");
  for (const row of cross.unions) opts.out(`| ${row.union} | ${row.reachable ? "yes" : "no path found"} |`);
  if (cross.unreachable.length > 0) {
    opts.out("");
    opts.out(`No path found: ${cross.unreachable.length}.`);
    for (const union of cross.unreachable) {
      const where = [...new Set(cross.routes.filter((r) => r.unions.includes(union)).map((r) => r.route))];
      opts.out(`- ${union}: renders on ${where.join(", ")}, and this crawl visited none of them`);
    }
    opts.out(
      `This crawl reached ${reached} of ${cross.routes.length} target routes, at depth ${MAX_DEPTH} and ${MAX_EDGES_PER_NODE} edges per screen, and it counts only a pathname change as a step. A union above renders but is unreachable only when the crawl could have got there.`
    );
  }
  opts.out("");
  opts.out("## Recordings");
  opts.out("");
  if (!videos.some((v) => v.ok)) opts.out("none recorded");
  for (const video of videos) {
    if (!video.ok) {
      opts.out(`${video.leg} ${video.id}: ${video.na ? `n/a (${video.na})` : `not recorded (${video.reason})`} ${video.error}`);
      continue;
    }
    opts.out(`### ${video.id} (${video.leg})`);
    opts.out(`video: ${video.file}  (${video.device}, ${stamp(video.seconds * 1e3)}), provenance ${video.provenance}`);
    for (const step of video.steps) opts.out(`  ${stamp(step.atMs ?? 0)}  ${step.label}`);
  }
  return 0;
}
function createPathsCommand(overrides = {}) {
  return {
    name: "paths",
    summary: "Crawl the taps that reach each route that renders a state, and record them live",
    async run(args, opts) {
      const [action, ...rest] = args;
      if (!action || !["plan", "crawl", "record", "report"].includes(action)) {
        for (const line of USAGE11) opts.err(line);
        return 2;
      }
      const config = qaConfigOf(opts.config);
      const inner = { ...opts, cwd: (0, import_node_path41.isAbsolute)(opts.cwd) ? opts.cwd : (0, import_node_path41.resolve)(opts.cwd) };
      try {
        const flags = parseCommandArgs({ values: VALUES }, rest);
        const deps = runDeps(config, opts.app, overrides, opts.targets);
        const generated = deps.clock.date().toISOString();
        if (action === "plan") return planCmd(flags, inner, config, generated);
        if (action === "crawl") return await crawlCmd(flags, inner, config, deps);
        if (action === "record") return await recordCmd(flags, inner, config, deps);
        return reportCmd(flags, inner, config, generated);
      } catch (cause) {
        if (!isCodedError(cause)) throw cause;
        opts.err(`lw qa paths ${action}: ${cause.code}: ${cause.message}`);
        return cause instanceof UsageError || cause.code === "qa.paths.usage" ? 2 : 1;
      }
    }
  };
}
var import_node_fs19, import_node_path41, USAGE11, DEFAULT_SLUG2, DEFAULT_LEGS2, VALUES, qa_paths_default;
var init_qa_paths = __esm({
  "src/commands/qa-paths.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_fs19 = require("fs");
    import_node_path41 = require("path");
    init_kernel();
    init_args();
    init_config2();
    init_paths();
    init_project2();
    init_run();
    USAGE11 = [
      "usage: lw qa paths <plan|crawl|record|report> [options]",
      `  plan   [--legs a,b] [--slug s]              write the crawl plan of each leg from the delivery scan`,
      `  crawl  [--base <url>] [--legs a,b] [--slug s] walk each leg, depth ${MAX_DEPTH}, ${MAX_EDGES_PER_NODE} edges per screen. Exit 1 on route drift`,
      "  record [--base <url>] [--only <path-id>] [--slug s]  replay each crawled path with video. Exit 1 on a failed recording",
      "  report [--slug s]                           paths, reachability per union, recordings",
      "--base defaults to qa.baseUrls of the leg surface. A crawl presses every control it finds. Point --base at a QA stack (lw qa world --api), never at a shared database."
    ];
    DEFAULT_SLUG2 = "paths";
    DEFAULT_LEGS2 = ["desktop", "miniapp"];
    VALUES = ["base", "legs", "slug", "only"];
    qa_paths_default = createPathsCommand();
  }
});

// src/telegram-fake/chat-page.mts
function chatPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fake Telegram</title>
<style>${CSS}</style>
</head>
<body>
<nav aria-label="Chats"><h1>Fake Telegram</h1><ul id="chats"></ul></nav>
<main id="app">
<header><h2 id="title">Pick a chat</h2><button type="button" id="menu" data-qa-menu-button hidden></button></header>
<div id="log" role="log" aria-label="Messages" data-qa-log></div>
<div id="notice" role="status" data-qa-notice></div>
<div id="error" role="alert" data-qa-error></div>
<div id="reply"></div>
<form id="composer" data-qa-composer hidden><input id="input" aria-label="Message" placeholder="Message or /command" autocomplete="off" data-qa-input><button type="submit" data-qa-send>Send</button></form>
</main>
<script>${JS}</script>
</body>
</html>
`;
}
var CSS, JS;
var init_chat_page = __esm({
  "src/telegram-fake/chat-page.mts"() {
    "use strict";
    init_cjs_shims();
    CSS = `
:root { color-scheme: light; --bg: #e6ebee; --panel: #ffffff; --line: #d9dee2; --text: #111111; --hint: #707579; --accent: #3390ec; --mine: #e3fee0; --error: #c0392b; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; }
body { background: var(--bg); color: var(--text); font: 15px/1.4 system-ui, sans-serif; display: flex; }
nav { width: 240px; flex: none; background: var(--panel); border-right: 1px solid var(--line); overflow-y: auto; }
nav h1 { font-size: 16px; margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--line); }
nav ul { list-style: none; margin: 0; padding: 0; }
nav .bot { padding: 8px 16px 4px; color: var(--hint); font-size: 13px; }
nav a { display: block; padding: 8px 16px 8px 24px; color: inherit; text-decoration: none; }
nav a[aria-current="page"] { background: var(--accent); color: #ffffff; }
main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
header { background: var(--panel); border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; gap: 12px; align-items: center; }
header h2 { font-size: 16px; margin: 0; flex: 1; }
#log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 75%; background: var(--panel); border-radius: 12px; padding: 8px 12px; align-self: flex-start; }
.msg.user { align-self: flex-end; background: var(--mine); }
.msg.service { align-self: center; background: transparent; color: var(--hint); font-size: 13px; }
.msg p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.msg img { display: block; max-width: 100%; border-radius: 8px; margin-bottom: 4px; }
.keyboard { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.row { display: flex; gap: 4px; }
.row > * { flex: 1; }
button, .row a { font: inherit; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: #f4f4f5; color: var(--accent); cursor: pointer; text-align: center; text-decoration: none; }
.invoice h3 { margin: 0 0 4px; font-size: 15px; }
#notice, #error { padding: 6px 16px; }
#notice:empty, #error:empty { display: none; }
#notice { background: #fffbe6; }
#error { background: #fdecea; color: var(--error); }
#reply { padding: 6px 16px; background: var(--panel); border-top: 1px solid var(--line); }
#reply:empty { display: none; }
form { display: flex; gap: 8px; padding: 10px 16px; background: var(--panel); border-top: 1px solid var(--line); }
form input { flex: 1; font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }
@media (max-width: 640px) { nav { width: 140px; } .msg { max-width: 92%; } }
`;
    JS = `
(function () {
  var query = new URLSearchParams(location.search);
  var sel = { bot: query.get('bot'), persona: query.get('persona') };
  var shown = '';
  var byId = function (id) { return document.getElementById(id); };

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showError(text) { byId('error').textContent = text || ''; }

  function plain(text, mode) {
    if (mode !== 'HTML') return text;
    return new DOMParser().parseFromString(text, 'text/html').body.textContent || '';
  }

  function act(action, body) {
    var payload = Object.assign({ bot: sel.bot, persona: sel.persona }, body);
    return fetch('/__tg/api/' + action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (answer) {
        showError(answer.ok ? '' : answer.error);
        refresh(true);
        return answer.ok ? answer : null;
      }, function (cause) {
        showError('The fake Telegram server does not answer: ' + cause);
        return null;
      });
  }

  function openApp(url, source) {
    // The window opens at the click, so no popup blocker stops it. The signed URL follows.
    var win = window.open('about:blank', 'lw-tg-miniapp');
    act('webapp', { url: url, source: source }).then(function (answer) {
      if (!answer) { if (win) win.close(); return; }
      byId('app').setAttribute('data-qa-webapp-opened', url);
      if (win) win.location.href = answer.url;
      else showError('The browser blocked the Mini App window.');
    });
  }

  function select(bot, persona) {
    sel = { bot: bot, persona: persona };
    history.replaceState(null, '', '?bot=' + encodeURIComponent(bot) + '&persona=' + encodeURIComponent(persona));
    showError('');
    refresh(true);
  }

  function inlineButton(m, b) {
    if (b.kind === 'url') {
      return el('a', { href: b.url, target: '_blank', rel: 'noopener', 'data-qa-inline-button': b.text, 'data-qa-kind': 'url' }, b.text);
    }
    var button = el('button', { type: 'button', 'data-qa-inline-button': b.text, 'data-qa-kind': b.kind }, b.text);
    button.addEventListener('click', function () {
      if (b.kind === 'callback') act('callback', { messageId: m.id, data: b.data });
      else if (b.kind === 'web_app') openApp(b.url, 'inline');
      else if (b.kind === 'pay') act('pay', { messageId: m.id, link: b.url });
    });
    return button;
  }

  function renderNav(s) {
    var list = byId('chats');
    list.textContent = '';
    s.bots.forEach(function (b) {
      var group = el('li', { 'data-qa-bot': b.username });
      group.appendChild(el('div', { class: 'bot' }, '@' + b.username));
      var chats = el('ul');
      s.personas.forEach(function (p) {
        var current = sel.bot === b.username && sel.persona === p.id;
        var link = el('a', { href: '?bot=' + encodeURIComponent(b.username) + '&persona=' + encodeURIComponent(p.id), 'data-qa-chat': b.username + ':' + p.id, 'aria-current': current ? 'page' : 'false' }, p.firstName + ' (' + p.id + ')');
        link.addEventListener('click', function (event) { event.preventDefault(); select(b.username, p.id); });
        var item = el('li');
        item.appendChild(link);
        chats.appendChild(item);
      });
      group.appendChild(chats);
      list.appendChild(group);
    });
  }

  function renderMessage(m) {
    var who = m.from === 'user' ? 'You' : m.from === 'bot' ? 'Bot' : 'Service';
    var item = el('article', { class: 'msg ' + m.from, 'data-qa-message': String(m.id), 'data-qa-from': m.from, 'aria-label': who });
    if (m.photo) item.appendChild(el('img', { src: m.photo, alt: m.text || 'Photo', 'data-qa-photo': '' }));
    if (m.document) {
      var doc = m.document.url ? el('a', { href: m.document.url, target: '_blank', rel: 'noopener', 'data-qa-document': '' }, m.document.name) : el('span', { 'data-qa-document': '' }, m.document.name);
      item.appendChild(doc);
    }
    if (m.invoice) {
      var invoice = el('div', { class: 'invoice', 'data-qa-invoice': m.invoice.payload });
      invoice.appendChild(el('h3', null, m.invoice.title));
      invoice.appendChild(el('p', null, m.invoice.description));
      if (m.invoice.paid) invoice.appendChild(el('p', { 'data-qa-paid': '' }, 'Paid'));
      else {
        var unit = m.invoice.currency === 'XTR' ? 'Stars' : m.invoice.currency;
        var pay = el('button', { type: 'button', 'data-qa-pay': m.invoice.payload }, 'Pay ' + m.invoice.total + ' ' + unit);
        pay.addEventListener('click', function () { act('pay', { messageId: m.id }); });
        invoice.appendChild(pay);
      }
      item.appendChild(invoice);
    }
    if (m.text !== undefined) item.appendChild(el('p', { 'data-qa-text': '' }, plain(m.text, m.parseMode)));
    if (m.buttons && !(m.invoice && m.invoice.paid)) {
      var keyboard = el('div', { class: 'keyboard', role: 'group', 'aria-label': 'Inline keyboard', 'data-qa-inline-keyboard': '' });
      m.buttons.forEach(function (row) {
        var line = el('div', { class: 'row' });
        row.forEach(function (b) { line.appendChild(inlineButton(m, b)); });
        keyboard.appendChild(line);
      });
      item.appendChild(keyboard);
    }
    return item;
  }

  function renderReply(keyboard) {
    var reply = byId('reply');
    reply.textContent = '';
    if (!keyboard) return;
    var group = el('div', { class: 'keyboard', role: 'group', 'aria-label': 'Reply keyboard', 'data-qa-reply-keyboard': '' });
    keyboard.rows.forEach(function (row) {
      var line = el('div', { class: 'row' });
      row.forEach(function (b) {
        var button = el('button', { type: 'button', 'data-qa-reply-button': b.text, 'data-qa-kind': b.web_app ? 'web_app' : 'text' }, b.text);
        button.addEventListener('click', function () {
          if (b.web_app) openApp(b.web_app.url, 'keyboard');
          else act('send', { text: b.text });
        });
        line.appendChild(button);
      });
      group.appendChild(line);
    });
    reply.appendChild(group);
  }

  function render(s) {
    if (!sel.bot && s.bots.length > 0 && s.personas.length > 0) {
      select(s.bots[0].username, s.personas[0].id);
      return;
    }
    renderNav(s);
    var chat = s.chat;
    var log = byId('log');
    log.textContent = '';
    byId('title').textContent = chat ? '@' + chat.bot + ' with ' + chat.persona : 'Pick a chat';
    byId('composer').hidden = !chat;
    var menu = byId('menu');
    menu.hidden = !(chat && chat.menuButton);
    if (chat && chat.menuButton) {
      menu.textContent = chat.menuButton.text;
      menu.setAttribute('data-qa-url', chat.menuButton.url);
    }
    byId('notice').textContent = chat && chat.notice ? chat.notice : '';
    if (chat && chat.error) showError(chat.error);
    renderReply(chat && chat.replyKeyboard);
    if (chat) chat.messages.forEach(function (m) { log.appendChild(renderMessage(m)); });
    log.scrollTop = log.scrollHeight;
    document.body.setAttribute('data-qa-version', String(s.version));
  }

  function refresh(force) {
    var qs = sel.bot ? '?bot=' + encodeURIComponent(sel.bot) + '&persona=' + encodeURIComponent(sel.persona || '') : '';
    return fetch('/__tg/api/state' + qs)
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var key = s.version + '|' + sel.bot + '|' + sel.persona;
        if (force || key !== shown) { shown = key; render(s); }
      }, function (cause) { showError('The fake Telegram server does not answer: ' + cause); });
  }

  byId('menu').addEventListener('click', function () { openApp(byId('menu').getAttribute('data-qa-url'), 'menu'); });
  byId('composer').addEventListener('submit', function (event) {
    event.preventDefault();
    var input = byId('input');
    var text = input.value;
    if (!text.trim()) return;
    input.value = '';
    act('send', { text: text });
  });
  refresh(true);
  setInterval(function () { refresh(false); }, 300);
})();
`;
  }
});

// src/telegram-fake/fake-bot-api.mts
async function readParams(init) {
  const body = init?.body;
  if (body === void 0 || body === null) return {};
  if (typeof body === "string") return JSON.parse(body);
  if (body instanceof FormData) {
    const out = {};
    for (const [key, value] of body.entries()) {
      if (typeof value === "string") {
        try {
          out[key] = JSON.parse(value);
        } catch {
          out[key] = value;
        }
      } else out[key] = { filename: value.name, size: value.size, type: value.type };
    }
    return out;
  }
  throw new TypeError("The fake Bot API reads JSON and multipart bodies only.");
}
var FAKE_API_URL, FakeBotApi;
var init_fake_bot_api = __esm({
  "src/telegram-fake/fake-bot-api.mts"() {
    "use strict";
    init_cjs_shims();
    FAKE_API_URL = "https://bot-api.test";
    FakeBotApi = class {
      constructor(apiUrl = FAKE_API_URL) {
        this.apiUrl = apiUrl;
      }
      apiUrl;
      calls = [];
      answers = /* @__PURE__ */ new Map();
      failures = [];
      updates = /* @__PURE__ */ new Map();
      webhooks = /* @__PURE__ */ new Map();
      profiles = /* @__PURE__ */ new Map();
      queueListeners = /* @__PURE__ */ new Set();
      files = /* @__PURE__ */ new Map();
      messageId = 1e3;
      /** The time source of `RecordedCall.at`. */
      now;
      on(method, answer2) {
        this.answers.set(method, answer2);
        return this;
      }
      /** The next `times` calls of `method` (that `match`) fail with `failure`. */
      fail(method, failure, opts = {}) {
        this.failures.push({ method, failure, times: opts.times ?? 1, ...opts.match ? { match: opts.match } : {} });
        return this;
      }
      /** Queues updates for `getUpdates` of a bot. */
      queueUpdates(botId2, updates) {
        this.updates.set(botId2, [...this.updates.get(botId2) ?? [], ...updates]);
        for (const listener of this.queueListeners) listener(botId2);
        return this;
      }
      /** True when `getUpdates` of the bot with this offset has an update to return. */
      hasUpdates(botId2, offset = 0) {
        return (this.updates.get(botId2) ?? []).some((u) => u.update_id >= offset);
      }
      /** Calls `listener` with the bot id after each `queueUpdates`. Returns the function that removes it. */
      onQueue(listener) {
        this.queueListeners.add(listener);
        return () => this.queueListeners.delete(listener);
      }
      /** The names that `getMe` answers for a bot. */
      describeBot(botId2, profile) {
        this.profiles.set(botId2, profile);
        return this;
      }
      /** The webhook of a bot after `setWebhook`, or undefined after `deleteWebhook`. */
      webhookOf(botId2) {
        return this.webhooks.get(botId2);
      }
      /** A file that `getFile` answers for its `file_id`. */
      registerFile(file) {
        this.files.set(file.file_id, file);
        return this;
      }
      /** The next message id. The bot messages and the messages of a fake user share one sequence. */
      nextMessageId() {
        this.messageId += 1;
        return this.messageId;
      }
      callsOf(method) {
        return this.calls.filter((c) => c.method === method).map((c) => c.params);
      }
      reset() {
        this.calls.length = 0;
        this.answers.clear();
        this.failures.length = 0;
        this.updates.clear();
        this.webhooks.clear();
      }
      message(p) {
        return { message_id: this.nextMessageId(), date: 17e8, chat: { id: p.chat_id, type: Number(p.chat_id) < 0 ? "supergroup" : "private" }, ...p.text ? { text: p.text } : {} };
      }
      defaultAnswer(call) {
        const p = call.params;
        switch (call.method) {
          case "getMe": {
            const profile = this.profiles.get(call.botId);
            return { id: call.botId, is_bot: true, first_name: profile?.firstName ?? `Bot ${call.botId}`, username: profile?.username ?? `bot${call.botId}_bot`, can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false };
          }
          case "sendMessage":
          case "sendPhoto":
          case "sendVideo":
          case "sendAnimation":
          case "sendDocument":
          case "sendAudio":
          case "sendInvoice":
            return this.message(p);
          case "copyMessage":
            return { message_id: this.nextMessageId() };
          case "editMessageText":
            return { message_id: p.message_id, date: 17e8, chat: { id: p.chat_id, type: "private" }, text: p.text };
          case "editMessageReplyMarkup":
          case "editMessageCaption":
            return p.inline_message_id === void 0 ? { message_id: p.message_id, date: 17e8, chat: { id: p.chat_id, type: "private" } } : true;
          case "setWebhook":
            this.webhooks.set(call.botId, { url: String(p.url), ...typeof p.secret_token === "string" ? { secretToken: p.secret_token } : {} });
            if (p.drop_pending_updates === true) this.updates.delete(call.botId);
            return true;
          case "deleteWebhook":
            this.webhooks.delete(call.botId);
            if (p.drop_pending_updates === true) this.updates.delete(call.botId);
            return true;
          case "getFile":
            return this.files.get(String(p.file_id)) ?? true;
          case "getWebhookInfo":
            return { url: this.webhooks.get(call.botId)?.url ?? "", has_custom_certificate: false, pending_update_count: 0 };
          case "getMyCommands":
            return [];
          case "getUpdates": {
            const queued = this.updates.get(call.botId) ?? [];
            const offset = typeof p.offset === "number" ? p.offset : 0;
            const pending2 = queued.filter((u) => u.update_id >= offset);
            this.updates.set(call.botId, pending2);
            return pending2.slice(0, typeof p.limit === "number" ? p.limit : 100);
          }
          case "getManagedBotToken":
            return `${p.user_id}:MANAGED-${p.user_id}-token-abcdefghijklmnop`;
          case "createInvoiceLink":
            return `https://t.me/$invoice-${String(p.payload)}`;
          case "getStarTransactions":
            return { transactions: [] };
          default:
            return true;
        }
      }
      /** The `fetch` to pass as `BotApiOptions.fetch`. */
      fetch = async (input, init) => {
        const url = new URL(input);
        const m = /^\/bot(\d+):[^/]+\/(\w+)$/.exec(url.pathname);
        if (!m) return Response.json({ ok: false, error_code: 404, description: "Not Found" }, { status: 404 });
        const call = { botId: Number(m[1]), method: m[2], params: await readParams(init), ...this.now ? { at: this.now() } : {} };
        this.calls.push(call);
        const rule = this.failures.find((f) => f.method === call.method && f.times > 0 && (!f.match || f.match(call.params)));
        if (rule) {
          rule.times -= 1;
          if (rule.failure === "network") throw new TypeError("fetch failed");
          if (rule.failure === "not_connected") throw new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
          if (rule.failure === "reset") throw new TypeError("fetch failed", { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
          return Response.json({ ok: false, ...rule.failure }, { status: rule.failure.error_code });
        }
        const answer2 = this.answers.get(call.method);
        const result = answer2 === void 0 ? this.defaultAnswer(call) : typeof answer2 === "function" ? answer2(call.params, call) : answer2;
        return Response.json({ ok: true, result });
      };
    };
  }
});

// src/kernel/services/init-data.mts
function initDataCheckString(params, skip = ["hash"]) {
  return [...params.entries()].filter(([k]) => !skip.includes(k)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("\n");
}
var import_node_crypto4;
var init_init_data = __esm({
  "src/kernel/services/init-data.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto4 = require("crypto");
    init_errors();
    init_hmac();
  }
});

// src/telegram-fake/protocol.mts
function botIdOfToken2(token2) {
  const at = token2.indexOf(":");
  const id = Number(token2.slice(0, at));
  if (at <= 0 || !Number.isSafeInteger(id) || id <= 0 || token2.length - at < 2) {
    throw new LaunchwrightError("telegram.token.invalid", "A bot token has the form <bot id>:<secret>.", { context: { key: "token" } });
  }
  return id;
}
function webhookSecret(master, botId2) {
  if (master.length < 32) throw new LaunchwrightError("telegram.webhook.secret", "The webhook master secret must be at least 32 characters.", { context: { key: "webhook.secret" } });
  return (0, import_node_crypto5.createHmac)("sha256", master).update(String(botId2)).digest("hex");
}
function signInitData(fields, botToken) {
  const params = new URLSearchParams(fields);
  const secret = (0, import_node_crypto5.createHmac)("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", hmacHex(secret, initDataCheckString(params)));
  return params.toString();
}
var import_node_crypto5;
var init_protocol = __esm({
  "src/telegram-fake/protocol.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto5 = require("crypto");
    init_errors();
    init_hmac();
    init_init_data();
  }
});

// src/telegram-fake/fake-server.mts
function fakeError(code, message, context = {}, cause) {
  return new LaunchwrightError(`telegram.fake.${code}`, message, { context, ...cause === void 0 ? {} : { cause } });
}
function record2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function str(value) {
  return typeof value === "string" ? value : void 0;
}
function sendJson(res, status, body) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  let size2 = 0;
  for await (const chunk2 of req) {
    size2 += chunk2.length;
    if (size2 > BODY_LIMIT) throw fakeError("body", `The request body is larger than ${BODY_LIMIT} bytes.`);
    chunks.push(chunk2);
  }
  return Buffer.concat(chunks);
}
async function botApiInit(req, url) {
  const raw = await readBody(req);
  const type = (req.headers["content-type"] ?? "").toLowerCase();
  if (raw.length === 0) {
    if ([...url.searchParams.keys()].length === 0) return { method: "POST" };
    const form = new FormData();
    for (const [k, v] of url.searchParams) form.append(k, v);
    return { method: "POST", body: form };
  }
  if (type.startsWith("multipart/form-data") || type.startsWith("application/x-www-form-urlencoded")) {
    const body = await new Request(url, { method: "POST", headers: { "content-type": type }, body: new Uint8Array(raw) }).formData();
    return { method: "POST", body };
  }
  return { method: "POST", body: raw.toString("utf8") };
}
async function serveFakeTelegram(opts) {
  if (opts.env === "production") throw fakeError("production", "The fake Telegram server does not start in the production environment.", { env: opts.env });
  const host = opts.host ?? "127.0.0.1";
  if (!LOOPBACK.has(host)) throw fakeError("host", `The fake Telegram server binds loopback only, not ${host}.`, { host });
  const fake = new FakeTelegramServer(opts);
  const allowedHosts = /* @__PURE__ */ new Set();
  const server = (0, import_node_http2.createServer)((req, res) => {
    if (!allowedHosts.has(req.headers.host ?? "")) {
      sendJson(res, 421, { ok: false, error_code: 421, description: "Misdirected Request: the Host is not this loopback server" });
      return;
    }
    if (req.method === "POST" && (req.url ?? "").startsWith("/__tg/api/")) {
      const origin2 = req.headers.origin;
      const json = (req.headers["content-type"] ?? "").split(";")[0]?.trim() === "application/json";
      if (!json || origin2 !== void 0 && !allowedHosts.has(origin2.replace(/^http:\/\//, ""))) {
        sendJson(res, 403, { ok: false, error_code: 403, description: "Forbidden: a page action needs a JSON body from this origin" });
        return;
      }
    }
    fake.handle(req, res).catch((cause) => {
      sendJson(res, 500, { ok: false, error_code: 500, description: `Internal Server Error: ${messageOf(cause)}` });
    });
  });
  await new Promise((resolve17, reject) => {
    server.once("error", (cause) => reject(fakeError("listen", `The fake Telegram server cannot listen on ${host}:${opts.port ?? 0}.`, { host, port: opts.port ?? 0 }, cause)));
    server.listen(opts.port ?? 0, host, () => resolve17());
  });
  const { port: port2 } = server.address();
  const origin = `http://${host.includes(":") ? `[${host}]` : host}:${port2}`;
  for (const name of [host.includes(":") ? `[${host}]` : host, "localhost", "127.0.0.1", "[::1]"]) allowedHosts.add(`${name}:${port2}`);
  return {
    url: origin,
    api: fake.api,
    close: () => new Promise((resolve17, reject) => {
      fake.stopWaiting();
      server.close((cause) => cause ? reject(fakeError("close", "The fake Telegram server did not close.", {}, cause)) : resolve17());
      server.closeAllConnections();
    })
  };
}
var import_node_http2, LOOPBACK, BODY_LIMIT, MEDIA_FIELDS, THEME, FakeTelegramServer;
var init_fake_server = __esm({
  "src/telegram-fake/fake-server.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_http2 = require("http");
    init_kernel();
    init_chat_page();
    init_fake_bot_api();
    init_protocol();
    LOOPBACK = /* @__PURE__ */ new Set(["127.0.0.1", "::1", "localhost"]);
    BODY_LIMIT = 20 * 1024 * 1024;
    MEDIA_FIELDS = ["photo", "document", "video", "animation", "audio"];
    THEME = { bg_color: "#ffffff", text_color: "#000000", hint_color: "#707579", link_color: "#3390ec", button_color: "#3390ec", button_text_color: "#ffffff", secondary_bg_color: "#f4f4f5" };
    FakeTelegramServer = class {
      constructor(opts) {
        this.opts = opts;
        this.clock = opts.clock ?? systemClock;
        for (const b of opts.bots) {
          if (!b.username) throw fakeError("config", "Each fake bot needs a username.");
          const id = botIdOfToken2(b.token);
          if (this.bots.has(id)) throw fakeError("config", `Two fake bots have the bot id ${id}.`, { botId: id });
          this.bots.set(id, { id, username: b.username, token: b.token });
          this.api.describeBot(id, { username: b.username, firstName: b.username });
        }
        for (const p of opts.personas) {
          if (!Number.isSafeInteger(p.telegramId) || p.telegramId <= 0) throw fakeError("config", `Persona ${p.id} needs a positive telegramId.`, { persona: p.id });
          if (this.personas.has(p.id)) throw fakeError("config", `Two personas have the id ${p.id}.`, { persona: p.id });
          this.personas.set(p.id, p);
        }
      }
      opts;
      api = new FakeBotApi();
      bots = /* @__PURE__ */ new Map();
      personas = /* @__PURE__ */ new Map();
      chats = /* @__PURE__ */ new Map();
      files = /* @__PURE__ */ new Map();
      invoiceLinks = /* @__PURE__ */ new Map();
      callbacks = /* @__PURE__ */ new Map();
      checkouts = /* @__PURE__ */ new Map();
      botMenus = /* @__PURE__ */ new Map();
      waiters = /* @__PURE__ */ new Set();
      clock;
      version = 0;
      sequence = 0;
      updateId = 0;
      async handle(req, res) {
        const url = new URL(req.url ?? "/", "http://fake-telegram.invalid");
        const path = url.pathname;
        const botCall = /^\/bot([^/]+)\/(\w+)$/.exec(path);
        if (botCall) return this.botApi(req, res, url, botCall[1], botCall[2]);
        const fileGet = /^\/file\/bot([^/]+)\/(.+)$/.exec(path);
        if (fileGet && req.method === "GET") return this.botFile(res, fileGet[1], fileGet[2]);
        if (path === "/__tg" && req.method === "GET") {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
          res.end(chatPageHtml());
          return;
        }
        const pageFile = /^\/__tg\/files\/([\w-]+)$/.exec(path);
        if (pageFile && req.method === "GET") return this.serveFile(res, this.files.get(pageFile[1]));
        if (path === "/__tg/api/state" && req.method === "GET") return sendJson(res, 200, this.state(url.searchParams.get("bot"), url.searchParams.get("persona")));
        const action = /^\/__tg\/api\/(send|callback|webapp|pay)$/.exec(path);
        if (action && req.method === "POST") return this.pageAction(req, res, action[1]);
        sendJson(res, 404, { ok: false, error_code: 404, description: "Not Found" });
      }
      // The Bot API.
      botOf(token2) {
        const at = token2.indexOf(":");
        const bot = this.bots.get(Number(token2.slice(0, at)));
        return bot && safeEqual(bot.token, token2) ? bot : void 0;
      }
      async botApi(req, res, url, token2, method) {
        const bot = this.botOf(token2);
        if (!bot) return sendJson(res, 401, { ok: false, error_code: 401, description: "Unauthorized" });
        const init = await botApiInit(req, url);
        let params;
        try {
          params = await readParams(init);
        } catch (cause) {
          return sendJson(res, 400, { ok: false, error_code: 400, description: `Bad Request: ${messageOf(cause)}` });
        }
        const uploads = init.body instanceof FormData ? await this.storeUploads(init.body) : {};
        if (method === "getUpdates") await this.waitForUpdates(bot.id, params, res);
        if (res.destroyed) return;
        let response;
        try {
          response = await this.api.fetch(`${this.api.apiUrl}/bot${token2}/${method}`, init);
        } catch (cause) {
          if (cause instanceof TypeError) {
            res.destroy();
            return;
          }
          throw cause;
        }
        const answer2 = await response.json();
        if (answer2.ok) this.apply(bot, method, params, answer2.result, uploads);
        sendJson(res, response.status, answer2);
      }
      /** Waits for an update when `getUpdates` has a `timeout` and nothing is queued: the long poll. */
      async waitForUpdates(botId2, params, res) {
        const timeoutSec = typeof params.timeout === "number" ? params.timeout : 0;
        const offset = typeof params.offset === "number" ? params.offset : 0;
        if (timeoutSec <= 0 || this.api.hasUpdates(botId2, offset)) return;
        const stop = new AbortController();
        const unsubscribe = this.api.onQueue((id) => {
          if (id === botId2) stop.abort();
        });
        const onClose = () => stop.abort();
        res.on("close", onClose);
        this.waiters.add(stop);
        try {
          await this.clock.sleep(timeoutSec * 1e3, stop.signal);
        } catch (cause) {
          if (!stop.signal.aborted) throw cause;
        } finally {
          unsubscribe();
          res.off("close", onClose);
          this.waiters.delete(stop);
        }
      }
      /** Keeps each uploaded file, so `/file/bot<token>/<path>` and the chat page can serve it. */
      async storeUploads(form) {
        const out = {};
        for (const [field, value] of form.entries()) {
          if (typeof value === "string") continue;
          this.sequence += 1;
          const fileId = `fake-file-${this.sequence}`;
          const ext = /\.[A-Za-z0-9]{1,8}$/.exec(value.name)?.[0] ?? "";
          const path = `${field === "photo" ? "photos" : `${field}s`}/file_${this.sequence}${ext}`;
          const stored = { fileId, path, bytes: new Uint8Array(await value.arrayBuffer()), contentType: value.type || "application/octet-stream", name: value.name };
          this.files.set(fileId, stored);
          this.api.registerFile({ file_id: fileId, file_unique_id: `u-${fileId}`, file_size: value.size, file_path: path });
          out[field] = stored;
        }
        return out;
      }
      botFile(res, token2, path) {
        const bot = this.botOf(token2);
        if (!bot) return sendJson(res, 401, { ok: false, error_code: 401, description: "Unauthorized" });
        this.serveFile(res, [...this.files.values()].find((f) => f.path === path));
      }
      serveFile(res, file) {
        if (!file) return sendJson(res, 404, { ok: false, error_code: 404, description: "Not Found: file" });
        res.writeHead(200, { "content-type": file.contentType, "content-length": String(file.bytes.byteLength) });
        res.end(file.bytes);
      }
      /** The chat page effect of one Bot API call that succeeded. */
      apply(bot, method, p, result, uploads) {
        const chatId = Number(p.chat_id);
        const sent = record2(result);
        const messageId = typeof sent?.message_id === "number" ? sent.message_id : Number(p.message_id);
        switch (method) {
          case "sendMessage":
            this.addEntry(bot.id, chatId, { id: messageId, from: "bot", text: str(p.text) ?? "", ...str(p.parse_mode) ? { parseMode: str(p.parse_mode) } : {} }, p.reply_markup);
            break;
          case "sendPhoto":
          case "sendDocument":
          case "sendVideo":
          case "sendAnimation":
          case "sendAudio": {
            const field = MEDIA_FIELDS.find((f) => p[f] !== void 0) ?? "document";
            const media = this.mediaOf(uploads[field], p[field]);
            const entry = { id: messageId, from: "bot", ...str(p.caption) ? { text: str(p.caption) } : {}, ...str(p.parse_mode) ? { parseMode: str(p.parse_mode) } : {} };
            if (method === "sendPhoto" && media.url) entry.photo = media.url;
            else entry.document = { name: media.name, ...media.url ? { url: media.url } : {} };
            this.addEntry(bot.id, chatId, entry, p.reply_markup);
            break;
          }
          case "sendInvoice":
            this.addEntry(bot.id, chatId, { id: messageId, from: "bot", invoice: this.invoiceOf(p) }, p.reply_markup);
            break;
          case "createInvoiceLink":
            if (typeof result === "string") this.invoiceLinks.set(result, this.invoiceOf(p));
            break;
          case "editMessageText":
          case "editMessageCaption":
          case "editMessageReplyMarkup": {
            const entry = this.chat(bot.id, chatId).entries.find((e) => e.id === Number(p.message_id));
            if (!entry) break;
            if (method === "editMessageText") entry.text = str(p.text) ?? "";
            if (method === "editMessageCaption") entry.text = str(p.caption) ?? "";
            if (method === "editMessageReplyMarkup" || p.reply_markup !== void 0) {
              const rows = record2(p.reply_markup)?.inline_keyboard;
              if (Array.isArray(rows)) entry.buttons = rows;
              else delete entry.buttons;
            }
            this.touch();
            break;
          }
          case "deleteMessage": {
            const chat = this.chat(bot.id, chatId);
            chat.entries = chat.entries.filter((e) => e.id !== Number(p.message_id));
            this.touch();
            break;
          }
          case "answerCallbackQuery": {
            const key = this.callbacks.get(String(p.callback_query_id));
            if (key === void 0) break;
            this.callbacks.delete(String(p.callback_query_id));
            const text2 = str(p.text);
            const chat = this.chats.get(key);
            if (chat && text2) chat.notice = text2;
            this.touch();
            break;
          }
          case "answerPreCheckoutQuery":
            this.answerCheckout(String(p.pre_checkout_query_id), p.ok === true, str(p.error_message));
            break;
          case "setChatMenuButton": {
            const button = record2(p.menu_button);
            const webApp = record2(button?.web_app);
            const menu = button?.type === "web_app" && typeof webApp?.url === "string" ? { text: str(button.text) ?? "Open", url: webApp.url } : void 0;
            if (p.chat_id === void 0) {
              if (menu) this.botMenus.set(bot.id, menu);
              else this.botMenus.delete(bot.id);
            } else {
              const chat = this.chat(bot.id, chatId);
              if (menu) chat.menuButton = menu;
              else delete chat.menuButton;
            }
            this.touch();
            break;
          }
          default:
            break;
        }
      }
      mediaOf(upload, value) {
        if (upload) return { name: upload.name, url: `/__tg/files/${upload.fileId}` };
        if (typeof value === "string" && /^https?:\/\//.test(value)) return { name: value, url: value };
        if (typeof value === "string" && this.files.has(value)) return { name: this.files.get(value).name, url: `/__tg/files/${value}` };
        return { name: typeof value === "string" ? value : "file" };
      }
      invoiceOf(p) {
        const prices = Array.isArray(p.prices) ? p.prices : [];
        return {
          title: str(p.title) ?? "",
          description: str(p.description) ?? "",
          payload: str(p.payload) ?? "",
          currency: str(p.currency) ?? "XTR",
          total: prices.reduce((sum, price) => sum + (typeof price.amount === "number" ? price.amount : 0), 0)
        };
      }
      // Chats.
      key(botId2, chatId) {
        return `${botId2}:${chatId}`;
      }
      chat(botId2, chatId) {
        const key = this.key(botId2, chatId);
        let chat = this.chats.get(key);
        if (!chat) {
          chat = { entries: [] };
          this.chats.set(key, chat);
        }
        return chat;
      }
      touch() {
        this.version += 1;
      }
      addEntry(botId2, chatId, entry, markup) {
        const chat = this.chat(botId2, chatId);
        const m = record2(markup);
        if (Array.isArray(m?.inline_keyboard)) entry.buttons = m.inline_keyboard;
        if (Array.isArray(m?.keyboard)) chat.replyKeyboard = { rows: m.keyboard, oneTime: m.one_time_keyboard === true };
        if (m?.remove_keyboard === true) delete chat.replyKeyboard;
        chat.entries.push(entry);
        this.touch();
      }
      userOf(persona) {
        return { id: persona.telegramId, is_bot: false, first_name: persona.firstName, language_code: "en" };
      }
      nowSec() {
        return Math.floor(this.clock.now() / 1e3);
      }
      nextUpdateId() {
        this.updateId += 1;
        return this.updateId;
      }
      /** Sends an update to the bot's webhook, or keeps it for `getUpdates`. */
      async deliver(bot, update) {
        const set = this.api.webhookOf(bot.id);
        const hook = set ?? (this.opts.webhook ? { url: this.opts.webhook.url.replaceAll("{botId}", String(bot.id)), secretToken: webhookSecret(this.opts.webhook.secret, bot.id) } : void 0);
        if (!hook) {
          this.api.queueUpdates(bot.id, [update]);
          return;
        }
        let response;
        try {
          response = await fetch(hook.url, {
            method: "POST",
            headers: { "content-type": "application/json", ...hook.secretToken ? { "x-telegram-bot-api-secret-token": hook.secretToken } : {} },
            body: JSON.stringify(update)
          });
        } catch (cause) {
          throw fakeError("webhook", `The webhook ${hook.url} of bot ${bot.username} does not answer.`, { url: hook.url, botId: bot.id }, cause);
        }
        await response.arrayBuffer();
        if (!response.ok) throw fakeError("webhook", `The webhook ${hook.url} of bot ${bot.username} answered HTTP ${response.status}.`, { url: hook.url, botId: bot.id, status: response.status });
      }
      // The chat page.
      state(botName, personaId) {
        const bot = [...this.bots.values()].find((b) => b.username === botName);
        const persona = personaId === null ? void 0 : this.personas.get(personaId);
        const chat = bot && persona ? this.chats.get(this.key(bot.id, persona.telegramId)) : void 0;
        return {
          version: this.version,
          bots: [...this.bots.values()].map((b) => ({ username: b.username })),
          personas: [...this.personas.values()].map((p) => ({ id: p.id, firstName: p.firstName, telegramId: p.telegramId })),
          chat: bot && persona ? {
            bot: bot.username,
            persona: persona.id,
            messages: (chat?.entries ?? []).map((e) => this.view(e)),
            replyKeyboard: chat?.replyKeyboard ?? null,
            notice: chat?.notice ?? null,
            error: chat?.error ?? null,
            menuButton: chat?.menuButton ?? this.botMenus.get(bot.id) ?? null
          } : null
        };
      }
      view(e) {
        const buttons = e.buttons?.map(
          (row) => row.map((b) => {
            if (b.callback_data !== void 0) return { text: b.text, kind: "callback", data: b.callback_data };
            if (b.web_app) return { text: b.text, kind: "web_app", url: b.web_app.url };
            if (b.pay === true || b.url !== void 0 && this.invoiceLinks.has(b.url)) return { text: b.text, kind: "pay", ...b.url ? { url: b.url } : {} };
            if (b.url !== void 0) return { text: b.text, kind: "url", url: b.url };
            return { text: b.text, kind: "other" };
          })
        );
        return { ...e, ...buttons ? { buttons } : {} };
      }
      async pageAction(req, res, action) {
        let body;
        try {
          body = record2(JSON.parse((await readBody(req)).toString("utf8"))) ?? {};
        } catch (cause) {
          return sendJson(res, 400, { ok: false, error: `The body is not a JSON object: ${messageOf(cause)}` });
        }
        const bot = [...this.bots.values()].find((b) => b.username === body.bot);
        const persona = typeof body.persona === "string" ? this.personas.get(body.persona) : void 0;
        if (!bot || !persona) return sendJson(res, 404, { ok: false, error: `No chat of bot ${String(body.bot)} and persona ${String(body.persona)}.` });
        const chat = this.chat(bot.id, persona.telegramId);
        delete chat.error;
        try {
          const result = await this.runAction(action, bot, persona, chat, body);
          sendJson(res, 200, { ok: true, ...result });
        } catch (cause) {
          chat.error = messageOf(cause);
          this.touch();
          const status = isCodedError(cause) && cause.code === "telegram.fake.webhook" ? 502 : 400;
          sendJson(res, status, { ok: false, error: chat.error, code: isCodedError(cause) ? cause.code : "telegram.fake.action" });
        }
      }
      async runAction(action, bot, persona, chat, body) {
        const from = this.userOf(persona);
        const tgChat = { id: persona.telegramId, type: "private", first_name: persona.firstName };
        if (action === "send") {
          const text2 = str(body.text)?.trim();
          if (!text2) throw fakeError("action", "The message is empty.");
          const message = { message_id: this.api.nextMessageId(), date: this.nowSec(), chat: tgChat, from, text: text2 };
          const command = /^\/\w+(@\w+)?/.exec(text2);
          if (command) message.entities = [{ type: "bot_command", offset: 0, length: command[0].length }];
          chat.entries.push({ id: message.message_id, from: "user", text: text2 });
          if (chat.replyKeyboard?.oneTime && chat.replyKeyboard.rows.some((row) => row.some((b) => b.text === text2))) delete chat.replyKeyboard;
          delete chat.notice;
          this.touch();
          await this.deliver(bot, { update_id: this.nextUpdateId(), message });
          return { messageId: message.message_id };
        }
        if (action === "callback") {
          const entry2 = chat.entries.find((e) => e.id === Number(body.messageId));
          const data = str(body.data);
          if (!entry2 || data === void 0) throw fakeError("action", `Message ${String(body.messageId)} has no button with this data.`);
          this.sequence += 1;
          const id2 = `fake-cq-${this.sequence}`;
          this.callbacks.set(id2, this.key(bot.id, persona.telegramId));
          delete chat.notice;
          this.touch();
          const message = { message_id: entry2.id, date: this.nowSec(), chat: tgChat, ...entry2.text !== void 0 ? { text: entry2.text } : {} };
          await this.deliver(bot, { update_id: this.nextUpdateId(), callback_query: { id: id2, from, message, chat_instance: String(persona.telegramId), data } });
          return { callbackQueryId: id2 };
        }
        if (action === "webapp") {
          const url = str(body.url);
          if (!url || !/^https?:\/\//.test(url)) throw fakeError("action", "A web_app button needs an http(s) URL.");
          return { url: this.miniAppUrl(bot, persona, url, body.source === "inline") };
        }
        const link = str(body.link);
        const entry = body.messageId === void 0 ? void 0 : chat.entries.find((e) => e.id === Number(body.messageId));
        const invoice = entry?.invoice ?? (link ? this.invoiceLinks.get(link) : void 0);
        if (!invoice) throw fakeError("action", "No invoice to pay: give the message id of an invoice or a link from createInvoiceLink.");
        this.sequence += 1;
        const id = `fake-pcq-${this.sequence}`;
        this.checkouts.set(id, { bot, persona, invoice });
        await this.deliver(bot, { update_id: this.nextUpdateId(), pre_checkout_query: { id, from, currency: invoice.currency, total_amount: invoice.total, invoice_payload: invoice.payload } });
        return { preCheckoutQueryId: id };
      }
      /** The Mini App URL with launch parameters in the hash and `initData` signed with the bot token. */
      miniAppUrl(bot, persona, url, inline2) {
        this.sequence += 1;
        const fields = {
          user: JSON.stringify({ id: persona.telegramId, first_name: persona.firstName, language_code: "en", allows_write_to_pm: true }),
          auth_date: String(this.nowSec()),
          chat_type: "sender",
          chat_instance: String(persona.telegramId),
          ...inline2 ? { query_id: `fake-q-${this.sequence}` } : {}
        };
        const target = new URL(url);
        target.hash = new URLSearchParams({
          tgWebAppData: signInitData(fields, bot.token),
          tgWebAppVersion: "8.0",
          tgWebAppPlatform: "android",
          tgWebAppThemeParams: JSON.stringify(THEME)
        }).toString();
        return target.toString();
      }
      answerCheckout(id, ok, errorMessage) {
        const checkout = this.checkouts.get(id);
        if (!checkout) return;
        this.checkouts.delete(id);
        const { bot, persona, invoice } = checkout;
        const chat = this.chat(bot.id, persona.telegramId);
        if (!ok) {
          chat.notice = errorMessage ?? "The payment was refused.";
          this.touch();
          return;
        }
        invoice.paid = true;
        this.sequence += 1;
        const message = {
          message_id: this.api.nextMessageId(),
          date: this.nowSec(),
          chat: { id: persona.telegramId, type: "private" },
          from: this.userOf(persona),
          successful_payment: { currency: invoice.currency, total_amount: invoice.total, invoice_payload: invoice.payload, telegram_payment_charge_id: `fake-charge-${this.sequence}`, provider_payment_charge_id: "" }
        };
        chat.entries.push({ id: message.message_id, from: "service", text: `Paid ${invoice.total} ${invoice.currency === "XTR" ? "Stars" : invoice.currency} for ${invoice.title || invoice.payload}` });
        this.touch();
        setImmediate(() => {
          this.deliver(bot, { update_id: this.nextUpdateId(), message }).catch((cause) => {
            chat.error = messageOf(cause);
            this.touch();
          });
        });
      }
      stopWaiting() {
        for (const stop of this.waiters) stop.abort();
      }
    };
  }
});

// src/services/bot-store.mts
function fileFor(dir, botId2) {
  if (!Number.isInteger(botId2) || botId2 <= 0) throw new LaunchwrightError("qa.bot.id", `A bot id is a positive integer, not "${botId2}".`, { context: { botId: botId2 } });
  return (0, import_node_path42.join)(dir, `${botId2}.json`);
}
function parse3(dir, botId2, text2) {
  try {
    return JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("qa.bot.record", `The bot record ${fileFor(dir, botId2)} is not JSON.`, { cause, context: { botId: botId2 } });
  }
}
function fileBotStore(dir) {
  return {
    async read(botId2) {
      const text2 = await readTextOrNull(fileFor(dir, botId2));
      return text2 === null ? null : parse3(dir, botId2, text2);
    },
    async write(record3) {
      const file = fileFor(dir, record3.botId);
      await (0, import_promises19.mkdir)(dir, { recursive: true });
      await (0, import_promises19.writeFile)(file, `${JSON.stringify(record3, null, 2)}
`);
    },
    async list() {
      let names;
      try {
        names = (await (0, import_promises19.readdir)(dir)).filter((n) => /^\d+\.json$/.test(n));
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.bot.record", `Cannot read the bot run store ${dir}.`, { cause });
      }
      const out = [];
      for (const name of names.sort()) {
        const botId2 = Number.parseInt(name, 10);
        const text2 = await readTextOrNull((0, import_node_path42.join)(dir, name));
        if (text2 !== null) out.push(parse3(dir, botId2, text2));
      }
      return out;
    },
    async remove(botId2) {
      await (0, import_promises19.rm)(fileFor(dir, botId2), { force: true });
    }
  };
}
var import_promises19, import_node_path42, BOT_STORE_DIR;
var init_bot_store = __esm({
  "src/services/bot-store.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises19 = require("fs/promises");
    import_node_path42 = require("path");
    init_kernel();
    init_fs();
    BOT_STORE_DIR = ".lw/qa/bots";
  }
});

// src/services/botfather.mts
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
function refusalOf(reply) {
  if (BOT_TOKEN.test(reply)) return null;
  const text2 = reply.replace(/\s+/g, " ").trim();
  const wait = WAIT.exec(reply);
  if (wait) {
    const seconds = Number(wait[1]) * (UNIT_SECONDS[(wait[2] ?? "s").charAt(0).toLowerCase()] ?? 1);
    return new LaunchwrightError("qa.bot.limit", `BotFather limits this account: wait ${seconds} seconds, then run the command again. BotFather said: "${text2}"`, { context: { seconds } });
  }
  if (REFUSAL.test(reply)) return new LaunchwrightError("qa.bot.refused", `BotFather refused the step. BotFather said: "${text2}"`);
  if (HELP_MENU.test(reply)) {
    return new LaunchwrightError("qa.bot.refused", `BotFather sent its help menu where a prompt was due, so it dropped the dialog. BotFather said: "${text2.slice(0, 200)}"`);
  }
  return null;
}
async function exchange(chat, text2) {
  await chat.send(text2);
  const reply = await chat.reply();
  const refusal = refusalOf(reply);
  if (refusal) throw refusal;
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
async function destroyBot(chat, getMe, record3) {
  const handle2 = handleOf(record3.username);
  await exchange(chat, "/revoke");
  await exchange(chat, handle2);
  await exchange(chat, "/deletebot");
  await exchange(chat, handle2);
  await exchange(chat, DELETE_CONFIRM);
  const me = await getMe(record3.token);
  if (me.status !== 401) {
    throw new LaunchwrightError("qa.bot.alive", `The throwaway bot ${record3.botId} still answers getMe with ${me.status}, so it is not deleted. Run destroy again.`, { context: { botId: record3.botId, status: me.status } });
  }
  return { botId: record3.botId, username: record3.username, status: me.status };
}
var BOTFATHER, DELETE_CONFIRM, BOT_TOKEN, WAIT, REFUSAL, HELP_MENU, UNIT_SECONDS;
var init_botfather = __esm({
  "src/services/botfather.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    BOTFATHER = "BotFather";
    DELETE_CONFIRM = "Yes, I am totally sure.";
    BOT_TOKEN = /(\d{6,12}:[A-Za-z0-9_-]{30,})/;
    WAIT = /(?:try again in|retry after)\s+(\d+)\s*(seconds?|minutes?|hours?)?/i;
    REFUSAL = /cannot create new bots|can't create new bots|too many (?:requests|attempts)|try again later|@SpamBot|^\s*sorry\b/im;
    HELP_MENU = /I can help you create and manage Telegram bots/i;
    UNIT_SECONDS = { s: 1, m: 60, h: 3600 };
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
  const port2 = Number(u.port);
  if (u.protocol !== "socks5:" || u.hostname === "" || !Number.isInteger(port2) || port2 <= 0) {
    throw new LaunchwrightError("telegram.mtproto.proxy", "The proxy must be socks5://[user:password@]host:port.");
  }
  return {
    ip: u.hostname,
    port: port2,
    socksType: 5,
    ...u.username ? { username: decodeURIComponent(u.username) } : {},
    ...u.password ? { password: decodeURIComponent(u.password) } : {}
  };
}
function connectUserClient(opts) {
  return UserClient.connect(opts);
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

// src/commands/qa-telegram-bot.mts
var qa_telegram_bot_exports = {};
__export(qa_telegram_bot_exports, {
  envUserbotProvider: () => envUserbotProvider,
  runBot: () => runBot,
  runTelegramBot: () => runTelegramBot
});
function envUserbotProvider(env) {
  return {
    async lease() {
      const apiId = Number(env.QA_TELEGRAM_API_ID);
      const apiHash = env.QA_TELEGRAM_API_HASH ?? "";
      const session2 = env.QA_TELEGRAM_SESSION ?? "";
      if (!Number.isInteger(apiId) || apiId <= 0 || apiHash === "" || session2 === "") {
        throw new LaunchwrightError(
          "qa.bot.userbot",
          "The throwaway bot needs an authorized userbot for this run. Set QA_TELEGRAM_API_ID, QA_TELEGRAM_API_HASH and QA_TELEGRAM_SESSION."
        );
      }
      const proxy = env.QA_TELEGRAM_PROXY;
      return { apiId, apiHash, session: session2, ...proxy ? { proxy } : {} };
    },
    needs: () => USERBOT_KEYS.map((name) => credentialNeed(name, env[name]))
  };
}
async function connect(lease) {
  try {
    return await connectUserClient({ apiId: lease.apiId, apiHash: lease.apiHash, session: lease.session, ...lease.proxy ? { proxy: lease.proxy } : {} });
  } catch (cause) {
    if (isCodedError(cause) && cause.code === "telegram.mtproto.missing") {
      throw new LaunchwrightError("qa.bot.module", 'lw qa telegram bot needs GramJS. Add the npm package "telegram" (2.26 or later).', { cause });
    }
    throw cause;
  }
}
function userClientChat(client, clock) {
  let lastId = 0;
  return {
    async send(text2) {
      if (lastId === 0) {
        const seen = await client.history(BOTFATHER, { limit: 5 });
        lastId = seen.reduce((max, m) => typeof m.id === "number" && m.id > max ? m.id : max, 0);
      }
      await client.sendMessage(BOTFATHER, text2);
    },
    async reply() {
      for (let poll = 0; poll < REPLY_POLLS; poll += 1) {
        const history = await client.history(BOTFATHER, { limit: 5 });
        const next = history.filter((m) => !m.out && typeof m.id === "number" && m.id > lastId).sort((a, b) => a.id - b.id).at(-1);
        if (next) {
          lastId = next.id;
          return next.message ?? "";
        }
        await clock.sleep(REPLY_WAIT_MS);
      }
      throw new LaunchwrightError("qa.bot.reply", "BotFather did not reply in time.");
    }
  };
}
async function botApiGetMe(token2) {
  try {
    await new BotApi({ token: token2 }).getMe();
    return { ok: true, status: 200 };
  } catch (cause) {
    if (cause instanceof TelegramApiError && cause.status !== 0) return { ok: false, status: cause.status };
    throw cause;
  }
}
async function realBotDeps(opts) {
  const env = opts.processEnv ?? process.env;
  const provider2 = envUserbotProvider(env);
  return {
    async openChat() {
      const lease = await provider2.lease();
      const client = await connect(lease);
      return {
        chat: userClientChat(client, systemClock),
        async close() {
          try {
            await client.close();
          } finally {
            if (provider2.release) await provider2.release(lease);
          }
        }
      };
    },
    getMe: botApiGetMe,
    store: fileBotStore((0, import_node_path43.join)(opts.cwd, BOT_STORE_DIR)),
    clock: systemClock,
    credentials: () => provider2.needs?.() ?? []
  };
}
function allowed(verb, choice, opts, deps) {
  const manifest = computeManifest({ title: `lw qa telegram bot ${verb}`, legs: [], credentials: deps.credentials?.() ?? [], outward: [OUTWARD[verb]] });
  return consentGate(manifest, { cwd: opts.cwd, out: opts.out, err: opts.err, ...choice, ...deps.consent ? { store: deps.consent } : {} });
}
function choiceOf(parsed) {
  return { allowAll: parsed.switches.has("allow-all"), allow: parsed.lists.allow };
}
async function create(args, opts, deps) {
  const parsed = parseCommandArgs({ values: ["name", "username"], ...GRANT_FLAGS }, args);
  const { name, username } = parsed.values;
  if (parsed.positionals.length > 0 || name === void 0 || username === void 0) {
    throw new LaunchwrightError("qa.bot.usage", "lw qa telegram bot create needs --name and --username.");
  }
  if (!await allowed("create", choiceOf(parsed), opts, deps)) return 2;
  const { chat, close } = await deps.openChat();
  try {
    const created = await newBot(chat, { name, username });
    const record3 = { botId: created.botId, username: created.username, token: created.token, createdAt: deps.clock.date().toISOString() };
    await deps.store.write(record3);
    await configureBot(chat, { username: created.username, commands: DEFAULT_COMMANDS, privacy: true });
    opts.out(`created throwaway bot ${created.botId} @${created.username}`);
    opts.out("token stored in .lw/qa/bots; remove it with lw qa telegram bot destroy");
    return 0;
  } finally {
    await close();
  }
}
async function pending(store, bot) {
  if (bot !== void 0) {
    const record3 = await store.read(Number(bot));
    if (!record3) throw new LaunchwrightError("qa.bot.missing", `No throwaway bot ${bot} in the run store.`, { context: { bot } });
    return [record3];
  }
  return await store.list();
}
async function destroy(args, opts, deps) {
  const parsed = parseCommandArgs({ values: ["bot"], ...GRANT_FLAGS }, args);
  if (parsed.positionals.length > 0) throw new LaunchwrightError("qa.bot.usage", "lw qa telegram bot destroy takes no positional argument.");
  const records = await pending(deps.store, parsed.values.bot);
  if (records.length === 0) {
    opts.out("no throwaway bot to destroy");
    return 0;
  }
  if (!await allowed("destroy", choiceOf(parsed), opts, deps)) return 2;
  const { chat, close } = await deps.openChat();
  try {
    for (const record3 of records) {
      const dead = await destroyBot(chat, deps.getMe, record3);
      await deps.store.remove(dead.botId);
      opts.out(`destroyed throwaway bot ${dead.botId} @${dead.username}, getMe ${dead.status}`);
    }
    return 0;
  } finally {
    await close();
  }
}
async function runBot(args, opts, deps) {
  const [verb, ...rest] = args;
  if (verb === void 0 || verb === "--help" || verb === "-h") {
    for (const line of USAGE12) opts.err(line);
    return verb === void 0 ? 2 : 0;
  }
  const env = opts.env ?? "local";
  if (env === "production") {
    throw new LaunchwrightError("qa.bot.production", "lw qa telegram bot does not run in the production environment (spec 2.14 rule S3).");
  }
  if (verb === "create") return create(rest, opts, deps);
  if (verb === "destroy") return destroy(rest, opts, deps);
  opts.err(`lw qa telegram bot: unknown verb ${verb}`);
  for (const line of USAGE12) opts.err(line);
  return 2;
}
async function runTelegramBot(args, opts) {
  return runBot(args, opts, await realBotDeps(opts));
}
var import_node_path43, USAGE12, OUTWARD, GRANT_FLAGS, DEFAULT_COMMANDS, REPLY_POLLS, REPLY_WAIT_MS, USERBOT_KEYS;
var init_qa_telegram_bot = __esm({
  "src/commands/qa-telegram-bot.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path43 = require("path");
    init_kernel();
    init_args();
    init_bot_store();
    init_botfather();
    init_consent_gate();
    init_contract();
    init_bot_api();
    init_mtproto();
    USAGE12 = [
      "usage: lw qa telegram bot <create|destroy> [options] [--allow-all | --allow <item-id>...]",
      "  create --name <name> --username <name>bot   create a throwaway bot through BotFather",
      "  destroy [--bot <id>]                         revoke and delete the bot(s), confirm each dead",
      "  each verb is an outward action: it prints the run contract and needs a grant (spec 2.6)"
    ];
    OUTWARD = {
      create: { id: "throwaway-bot-create", title: "Create a throwaway bot through BotFather with the authorized userbot" },
      destroy: { id: "throwaway-bot-destroy", title: "Revoke and delete throwaway bots through BotFather with the authorized userbot" }
    };
    GRANT_FLAGS = { switches: ["allow-all"], repeated: ["allow"] };
    DEFAULT_COMMANDS = [{ command: "start", description: "Start" }];
    REPLY_POLLS = 20;
    REPLY_WAIT_MS = 1e3;
    USERBOT_KEYS = ["QA_TELEGRAM_API_ID", "QA_TELEGRAM_API_HASH", "QA_TELEGRAM_SESSION"];
  }
});

// src/commands/qa-telegram.mts
var qa_telegram_exports = {};
__export(qa_telegram_exports, {
  default: () => qa_telegram_default,
  fakePersonas: () => fakePersonas,
  firstNameOf: () => firstNameOf,
  qaWebhook: () => qaWebhook,
  telegramPort: () => telegramPort
});
function firstNameOf(persona) {
  const words = persona.replace(/[-.]+/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
function fakePersonas(registry) {
  return registry.personas.map((p) => ({ id: p.id, telegramId: qaTelegramId(p.id), firstName: firstNameOf(p.id) }));
}
function qaWebhook(sections, apiPort) {
  const telegram2 = sections.telegram;
  const bots = Object.values(telegram2?.bots ?? {});
  if (!bots.some((b) => (b.transport ?? "webhook") === "webhook")) return void 0;
  const secret = telegram2?.webhook?.secret;
  if (typeof secret !== "string" || secret === "") {
    throw new LaunchwrightError(
      "qa.telegram.webhook",
      "A bot of telegram.bots uses the webhook transport, and telegram.webhook.secret is not set, so the fake server cannot sign its updates. Set the secret, or set transport: polling on each bot."
    );
  }
  const path = typeof telegram2?.webhook?.path === "string" ? telegram2.webhook.path : WEBHOOK_PATH;
  return { url: `http://127.0.0.1:${apiPort}${path}/{botId}`, secret };
}
function telegramPort(option, telegramUrl) {
  if (option === void 0) {
    const url = new URL(telegramUrl);
    return url.port === "" ? url.protocol === "https:" ? 443 : 80 : Number(url.port);
  }
  const n = Number(option);
  if (typeof option !== "string" || !/^\d+$/.test(option) || n > 65535) {
    throw new LaunchwrightError("qa.telegram.usage", `--port must be an integer from 0 (a free port) to 65535, not ${String(option)}.`);
  }
  return n;
}
async function run8(args, opts) {
  if (args[0] === "bot") {
    const { runTelegramBot: runTelegramBot2 } = await Promise.resolve().then(() => (init_qa_telegram_bot(), qa_telegram_bot_exports));
    return runTelegramBot2(args.slice(1), opts);
  }
  const { words, options } = parseArgs2(args, ["help"], ["port"]);
  if (options.help === true || words.length > 0 || Object.keys(options).some((k) => k !== "port")) {
    for (const line of USAGE13) opts.err(line);
    return options.help === true ? 0 : 2;
  }
  const env = opts.env ?? "local";
  if (env === "production") {
    throw new LaunchwrightError("qa.telegram.production", "lw qa telegram does not start in the production environment (spec 2.14 rule S3).");
  }
  const ctx = await worldContext(opts);
  const bots = qaFakeBots(ctx.sections, ctx.overlay.registryHash);
  if (bots.length === 0) {
    throw new LaunchwrightError("qa.telegram.no-bot", "Config telegram.bots has no bot with a token or an id, so the fake server has nothing to serve.");
  }
  const port2 = telegramPort(options.port, ctx.qa.telegramUrl);
  const webhook = qaWebhook(ctx.sections, ctx.qa.apiPort);
  const fake = await serveFakeTelegram({ port: port2, host: "127.0.0.1", bots, personas: fakePersonas(ctx.registry), webhook, env });
  const stop = processSignal(opts.signal);
  try {
    opts.out(fake.url);
    opts.out(`${fake.url}/__tg`);
    opts.err(`lw qa telegram: ${bots.length} bot(s), ${ctx.registry.personas.length} persona(s), ${webhook ? `updates to the webhook ${webhook.url}` : "updates kept for getUpdates"}; Ctrl-C stops it`);
    if (options.port !== void 0 && fake.url !== new URL(ctx.qa.telegramUrl).origin) {
      opts.err(`lw qa telegram: the QA API calls qa.telegramUrl ${ctx.qa.telegramUrl}, not this server.`);
    }
    if (!stop.signal.aborted) await new Promise((resolve17) => stop.signal.addEventListener("abort", () => resolve17(), { once: true }));
  } finally {
    stop.dispose();
    await fake.close();
  }
  return 0;
}
var USAGE13, WEBHOOK_PATH, telegram, qa_telegram_default;
var init_qa_telegram = __esm({
  "src/commands/qa-telegram.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_fake_server();
    init_app2();
    init_context();
    init_ids();
    USAGE13 = [
      "usage: lw qa telegram [--port <p>]",
      "  serves the fake Bot API and the /__tg chat page on 127.0.0.1 until Ctrl-C.",
      `  --port  default: the port of qa.telegramUrl (${QA_TELEGRAM_PORT})`,
      "usage: lw qa telegram bot <create|destroy>  the throwaway bot lifecycle (spec 2.7)"
    ];
    WEBHOOK_PATH = "/tg/bots";
    telegram = {
      name: "telegram",
      summary: "Serve the fake Bot API and the /__tg chat page on loopback for the QA API",
      run: (args, opts) => guarded("telegram", opts, () => run8(args, opts))
    };
    qa_telegram_default = telegram;
  }
});

// src/sink/services/faults.mts
function parseFault(text2) {
  const m = RULE.exec(text2.trim());
  const g = m?.groups;
  if (!g) throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text2}" is not valid: ${GRAMMAR}.`, { context: { rule: text2 } });
  const limit = {
    ...g.count !== void 0 ? { count: Number(g.count) } : {},
    ...g.ratio !== void 0 ? { ratio: Number(g.ratio) } : {}
  };
  if (limit.count === 0) throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text2}" has count 0, so it never fires.`, { context: { rule: text2 } });
  if (g.plain !== void 0) return { text: text2, kind: g.plain, ...limit };
  if (g.ms !== void 0) return { text: text2, kind: "slow", ms: Number(g.ms), ...limit };
  const url = g.url;
  let location;
  try {
    location = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text2}": ${url} is not an absolute URL.`, { cause, context: { rule: text2 } });
  }
  if (location.protocol !== "http:" && location.protocol !== "https:") {
    throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text2}": the 302 target must be an http or https URL.`, { context: { rule: text2 } });
  }
  return { text: text2, kind: "302", location: url, ...limit };
}
function parseFaults(texts) {
  return texts.map(parseFault);
}
function replyOf(rule) {
  switch (rule.kind) {
    case "503":
      return { status: 503, headers: {}, body: "busy", holdMs: 0 };
    case "429":
      return { status: 429, headers: { "retry-after": String(RETRY_AFTER_S) }, body: "slow down", holdMs: 0 };
    case "410":
      return { status: 410, headers: {}, body: "gone", holdMs: 0 };
    case "302":
      return { status: 302, headers: { location: rule.location }, body: "", holdMs: 0 };
    case "slow":
      return { ...OK_REPLY, holdMs: rule.ms };
  }
}
function seededSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var RETRY_AFTER_S, OK_REPLY, RULE, GRAMMAR, FaultPlan;
var init_faults = __esm({
  "src/sink/services/faults.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    RETRY_AFTER_S = 30;
    OK_REPLY = { status: 200, headers: {}, body: "ok", holdMs: 0 };
    RULE = /^(?:(?<plain>503|429|410)|302:(?<url>.+?)|slow:(?<ms>\d{1,7}))(?:x(?<count>\d{1,9})|@(?<ratio>0(?:\.\d+)?|1(?:\.0+)?))?$/;
    GRAMMAR = "a rule is 503, 429, 410, 302:<url> or slow:<ms>, with an optional count (503x2) or ratio (503@0.5)";
    FaultPlan = class {
      constructor(rules, random) {
        this.rules = rules;
        this.random = random;
        this.used = rules.map(() => 0);
      }
      rules;
      random;
      used;
      next() {
        for (const [i, rule] of this.rules.entries()) {
          if (!this.fires(rule, i)) continue;
          return { rule, reply: replyOf(rule) };
        }
        return { rule: null, reply: OK_REPLY };
      }
      fires(rule, i) {
        if (rule.count !== void 0) {
          if (this.used[i] >= rule.count) return false;
          this.used[i] = this.used[i] + 1;
          return true;
        }
        if (rule.ratio !== void 0) return this.random() < rule.ratio;
        return true;
      }
    };
  }
});

// src/sink/services/server.mts
function maskHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === void 0) continue;
    out[name] = SECRET_HEADER.test(name) || ADDRESS_HEADER.test(name) ? MASK : value;
  }
  return out;
}
function readBody2(req, max) {
  return new Promise((resolve17, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (chunk2) => {
      if (bytes < max) chunks.push(chunk2.subarray(0, max - bytes));
      bytes += chunk2.length;
    });
    req.on("end", () => resolve17({ text: Buffer.concat(chunks).toString("utf8"), bytes, truncated: bytes > max }));
    req.on("error", reject);
    req.on("close", () => {
      if (!req.complete) reject(new Error("the sender closed the request before its end"));
    });
  });
}
async function startSink(opts = {}) {
  const rules = (opts.faults ?? []).map((r) => typeof r === "string" ? parseFault(r) : r);
  const plan2 = new FaultPlan(rules, seededSource(opts.seed ?? 1));
  const clock = opts.clock ?? systemClock;
  const max = opts.maxBodyBytes ?? MAX_BODY_BYTES;
  const records = [];
  let writes = Promise.resolve();
  let writeError;
  const stopping = new AbortController();
  const pending2 = /* @__PURE__ */ new Set();
  if (opts.file !== void 0) await (0, import_promises20.mkdir)((0, import_node_path44.dirname)(opts.file), { recursive: true, mode: 448 });
  const persist = (record3) => {
    const file = opts.file;
    if (file === void 0) return;
    writes = writes.then(
      () => (0, import_promises20.appendFile)(file, `${JSON.stringify(record3)}
`, { mode: 384 }).catch((err) => {
        writeError ??= err;
      })
    );
  };
  const server = (0, import_node_http3.createServer)((req, res) => {
    const at = clock.date().toISOString();
    const n = records.length + 1;
    const { rule, reply } = plan2.next();
    const url = req.url ?? "/";
    const record3 = {
      n,
      at,
      method: req.method ?? "",
      url,
      path: new URL(url, "http://sink").pathname,
      headers: maskHeaders(req.headers),
      body: "",
      bodyBytes: 0,
      fault: rule?.text ?? null,
      answered: { status: reply.status, headers: reply.headers, heldMs: reply.holdMs }
    };
    records.push(record3);
    let hungUp = false;
    const hangUp = new AbortController();
    res.once("close", () => {
      if (res.writableEnded) return;
      hungUp = true;
      hangUp.abort(new Error("the sender closed the connection"));
    });
    const held = reply.holdMs > 0 ? clock.sleep(reply.holdMs, AbortSignal.any([stopping.signal, hangUp.signal])).then(
      () => true,
      () => false
    ) : Promise.resolve(true);
    opts.onRecord?.(record3, "arrived");
    const handled = (async () => {
      try {
        const body = await readBody2(req, max);
        record3.body = body.text;
        record3.bodyBytes = body.bytes;
        if (body.truncated) record3.bodyTruncated = true;
        const answer2 = await held;
        if (!answer2 || hungUp || res.destroyed) {
          record3.closedEarly = true;
          return;
        }
        res.writeHead(reply.status, { "content-type": "text/plain", ...reply.headers });
        res.end(reply.body);
      } catch (err) {
        record3.closedEarly = true;
        res.destroy(err instanceof Error ? err : new Error(String(err)));
      } finally {
        persist(record3);
        opts.onRecord?.(record3, "done");
      }
    })();
    pending2.add(handled);
    void handled.then(() => pending2.delete(handled));
  });
  await new Promise((resolve17, reject) => {
    server.once(
      "error",
      (cause) => reject(new LaunchwrightError("qa.sink.listen", `The sink cannot listen on 127.0.0.1:${opts.port ?? 0}: ${cause.message}`, { cause, context: { port: opts.port ?? 0 } }))
    );
    server.listen(opts.port ?? 0, "127.0.0.1", resolve17);
  });
  const port2 = server.address().port;
  return {
    port: port2,
    url: `http://127.0.0.1:${port2}`,
    records,
    ...opts.file === void 0 ? {} : { file: opts.file },
    async close() {
      stopping.abort(new Error("the sink closed"));
      server.closeAllConnections();
      await new Promise((resolve17, reject) => server.close((err) => err ? reject(err) : resolve17()));
      await Promise.all(pending2);
      await writes;
      if (writeError !== void 0) {
        throw new LaunchwrightError("qa.sink.write", `The sink could not write ${opts.file}.`, { cause: writeError, context: { file: opts.file } });
      }
    }
  };
}
var import_promises20, import_node_http3, import_node_path44, MASK, SECRET_HEADER, ADDRESS_HEADER, MAX_BODY_BYTES;
var init_server = __esm({
  "src/sink/services/server.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises20 = require("fs/promises");
    import_node_http3 = require("http");
    import_node_path44 = require("path");
    init_kernel();
    init_faults();
    MASK = "[masked]";
    SECRET_HEADER = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-telegram-bot-api-secret-token|x-.+-token)$|secret|token|key|signature/i;
    ADDRESS_HEADER = /forwarded-for|real-ip|connecting-ip|client-ip|^forwarded$/i;
    MAX_BODY_BYTES = 1024 * 1024;
  }
});

// src/commands/qa-sink.mts
var qa_sink_exports = {};
__export(qa_sink_exports, {
  SINK_DIR: () => SINK_DIR,
  default: () => qa_sink_default
});
async function tunnels(config, driver) {
  const raw = config?.tunnel ?? (driver ? { default: driver } : void 0);
  if (raw === void 0) {
    throw new LaunchwrightError("qa.sink.tunnel", "The project config has no tunnel section. Add tunnel.default, or pass --tunnel <driver> or --tunnel none.");
  }
  const { tunnelConfig, TunnelManager } = await loadTunnel();
  const parsed = tunnelConfig.safeParse(driver ? { ...raw, default: driver } : raw);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `tunnel.${i.path.map(String).join(".")} ${i.message}`);
    throw new LaunchwrightError("qa.sink.tunnel", `Config section tunnel is invalid: ${keys.join("; ")}`, { context: { keys } });
  }
  return new TunnelManager(parsed.data, createContainer());
}
function stopped(signal) {
  if (signal) return signal.aborted ? Promise.resolve() : new Promise((resolve17) => signal.addEventListener("abort", () => resolve17(), { once: true }));
  return new Promise((resolve17) => {
    const done = () => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve17();
    };
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}
function integer(text2, name, min, max) {
  if (text2 === void 0) return void 0;
  const n = Number(text2);
  if (!/^\d+$/.test(text2) || n < min || n > max) throw new LaunchwrightError("qa.sink.usage", `--${name} must be an integer from ${min} to ${max}, not ${text2}.`);
  return n;
}
async function serve(values, opts) {
  const faults = parseFaults(values.fault ?? []);
  const port2 = integer(values.port, "port", 0, 65535);
  const seed = integer(values.seed, "seed", 0, 2 ** 32 - 1) ?? (0, import_node_crypto6.randomInt)(1, 2 ** 31);
  const manager = values.tunnel === "none" ? void 0 : await tunnels(opts.config, values.tunnel);
  const run10 = systemClock.date().toISOString().replace(/[:.]/g, "-");
  const file = (0, import_node_path45.join)(opts.cwd, SINK_DIR, `${run10}.jsonl`);
  const sink2 = await startSink({
    faults,
    file,
    seed,
    ...port2 === void 0 ? {} : { port: port2 },
    onRecord: (r, phase) => {
      if (phase !== "done") return;
      opts.err(`lw qa sink: ${r.n} ${r.method} ${r.path} -> ${r.answered.status}${r.fault ? ` (${r.fault})` : ""}${r.closedEarly ? ", the sender closed first" : ""}`);
    }
  });
  let tunnel;
  try {
    if (manager) tunnel = await manager.driver().open(sink2.port, { name: "lw-sink" });
    opts.out(tunnel?.url ?? sink2.url);
    opts.err(`lw qa sink: listening on ${sink2.url}, records to ${file}`);
    opts.err(`lw qa sink: faults ${faults.map((f) => f.text).join(" ") || "none"}, seed ${seed}; Ctrl-C stops it`);
    await stopped(opts.signal);
  } finally {
    try {
      await tunnel?.close();
    } finally {
      await sink2.close();
    }
  }
  opts.err(`lw qa sink: ${sink2.records.length} requests recorded in ${file}`);
  return 0;
}
var import_node_crypto6, import_node_path45, SINK_DIR, USAGE14, sink, qa_sink_default;
var init_qa_sink = __esm({
  "src/commands/qa-sink.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto6 = require("crypto");
    import_node_path45 = require("path");
    init_kernel();
    init_args();
    init_peers2();
    init_faults();
    init_server();
    SINK_DIR = ".lw/qa/sink";
    USAGE14 = [
      "usage: lw qa sink [--tunnel <driver|none>] [--fault <rule>]... [--port <n>] [--seed <n>]",
      "  rules: 503, 429, 410, 302:<url>, slow:<ms>; add x<count> (503x2) or @<ratio> (503@0.5)"
    ];
    sink = {
      name: "sink",
      summary: "Serve a recording HTTP sink with fault rules behind a tunnel",
      async run(args, opts) {
        let parsed;
        try {
          parsed = parseCommandArgs({ values: ["tunnel", "port", "seed"], repeated: ["fault"], switches: ["help"] }, args.map((a) => a === "-h" ? "--help" : a));
          const [extra] = parsed.positionals;
          if (extra !== void 0) throw new UsageError(`Unexpected argument '${extra}'.`);
        } catch (cause) {
          if (!(cause instanceof UsageError)) throw cause;
          opts.err(`lw qa sink: ${cause.message}`);
          for (const line of USAGE14) opts.err(line);
          return 2;
        }
        const values = { ...parsed.values, fault: parsed.lists.fault };
        if (parsed.switches.has("help")) {
          for (const line of USAGE14) opts.err(line);
          return 0;
        }
        try {
          return await serve(values, opts);
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa sink: ${cause.code}: ${cause.message}`);
          return 1;
        }
      }
    };
    qa_sink_default = sink;
  }
});

// src/services/comments.mts
function validateAnchor(anchor) {
  if (!isObject4(anchor)) return ["the anchor is not an object"];
  const kind = anchor.kind;
  if (typeof kind !== "string" || !ANCHOR_KINDS.includes(kind)) {
    return [`kind "${String(kind)}" is not one of ${ANCHOR_KINDS.join(", ")}`];
  }
  const out = [];
  const need = (field, ok, why) => {
    if (!ok) out.push(`${kind} anchor: ${field} ${why}`);
  };
  if (kind === "step") {
    need("row", isText2(anchor.row), "is missing");
    need("leg", isText2(anchor.leg), "is missing");
    need("attempt", Number.isInteger(anchor.attempt) && anchor.attempt > 0, "must be a positive integer");
    need("step", Number.isInteger(anchor.step) && anchor.step > 0, "must be a positive integer");
  } else if (kind === "text") {
    need("section", isText2(anchor.section), "is missing");
    need("quote", isText2(anchor.quote), "is missing");
  } else if (kind === "region") {
    need("screenshot", isText2(anchor.screenshot), "is missing");
    need("row", isText2(anchor.row), "is missing");
    for (const f of ["x", "y", "w", "h"]) need(f, isFraction(anchor[f]), "must be a fraction from 0 to 1");
  } else if (kind === "time") {
    need("video", isText2(anchor.video), "is missing");
    need("row", isText2(anchor.row), "is missing");
    need("start", typeof anchor.start === "number" && anchor.start >= 0, "must be a number of seconds");
  } else {
    need("name", isText2(anchor.name), "is missing");
  }
  return out;
}
function makeComment(input) {
  const problems = validateAnchor(input.anchor);
  if (problems.length > 0) {
    throw new LaunchwrightError("qa.comment.anchor", `The comment anchor is invalid: ${problems.join("; ")}`, { context: { problems } });
  }
  return { id: input.id ?? (0, import_node_crypto7.randomUUID)(), anchor: input.anchor, author: input.author, body: input.body, createdAt: input.createdAt, status: "open", replies: [] };
}
function addComment(list3, comment) {
  if (list3.some((c) => c.id === comment.id)) {
    throw new LaunchwrightError("qa.comment.duplicate", `A comment with id ${comment.id} already exists.`, { context: { id: comment.id } });
  }
  return [...list3, comment];
}
function replyToComment(list3, id, reply) {
  if (!list3.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to reply to.`, { context: { id } });
  return list3.map((c) => c.id === id ? { ...c, replies: [...c.replies, reply] } : c);
}
function setStatus(list3, id, status) {
  if (!list3.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to update.`, { context: { id } });
  return list3.map((c) => c.id === id ? { ...c, status } : c);
}
function commentsFile(dir, slug3) {
  if (!SLUG.test(slug3)) throw new LaunchwrightError("qa.comment.slug", `A report slug is "${slug3}", which is not a safe file name.`, { context: { slug: slug3 } });
  return (0, import_node_path46.join)(dir, `${slug3}.json`);
}
function fileCommentStore(dir) {
  return {
    async read(slug3) {
      const text2 = await readTextOrNull(commentsFile(dir, slug3));
      if (text2 === null) return [];
      let parsed;
      try {
        parsed = JSON.parse(text2);
      } catch (cause) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug3)} is not JSON.`, { cause, context: { slug: slug3 } });
      }
      if (!isObject4(parsed) || !Array.isArray(parsed.comments)) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug3)} has no comments array.`, { context: { slug: slug3 } });
      }
      return parsed.comments;
    },
    async write(slug3, comments2) {
      const file = commentsFile(dir, slug3);
      await (0, import_promises21.mkdir)(dir, { recursive: true });
      await (0, import_promises21.writeFile)(file, `${JSON.stringify({ slug: slug3, comments: comments2 }, null, 2)}
`);
    }
  };
}
var import_node_crypto7, import_promises21, import_node_path46, COMMENTS_DIR, ANCHOR_KINDS, SLUG, isObject4, isFraction, isText2;
var init_comments = __esm({
  "src/services/comments.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_crypto7 = require("crypto");
    import_promises21 = require("fs/promises");
    import_node_path46 = require("path");
    init_kernel();
    init_fs();
    COMMENTS_DIR = ".lw/qa/comments";
    ANCHOR_KINDS = ["step", "text", "region", "time", "flow"];
    SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
    isObject4 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    isFraction = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
    isText2 = (v) => typeof v === "string" && v.trim() !== "";
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

// src/services/comment-server.mts
function readBody3(req) {
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
async function applyOp(body, store, slug3, clock) {
  let op;
  try {
    op = JSON.parse(body || "{}");
  } catch (cause) {
    throw new LaunchwrightError("qa.comment.body", "The POST body is not JSON.", { cause });
  }
  if (typeof op !== "object" || op === null) throw new LaunchwrightError("qa.comment.body", "The POST body is not an object.");
  const req = op;
  const list3 = await store.read(slug3);
  const at = clock.date().toISOString();
  let next;
  if (req.op === "add") {
    const c = req.comment;
    next = addComment(list3, makeComment({ anchor: c.anchor, author: String(c.author ?? "reviewer"), body: String(c.body ?? ""), createdAt: at }));
  } else if (req.op === "reply") {
    const r = req.reply;
    next = replyToComment(list3, String(req.id), { author: String(r.author ?? "reviewer"), body: String(r.body ?? ""), createdAt: at });
  } else if (req.op === "resolve" || req.op === "reopen") {
    next = setStatus(list3, String(req.id), req.op === "resolve" ? "resolved" : "open");
  } else {
    throw new LaunchwrightError("qa.comment.op", `The op "${String(req.op)}" is not add, reply, resolve or reopen.`, { context: { op: req.op } });
  }
  await store.write(slug3, next);
  return next;
}
async function serveStatic(res, reportDir, pathname) {
  const target = (0, import_node_path47.resolve)(reportDir, `.${pathname}`);
  if (target !== reportDir && !target.startsWith(reportDir + import_node_path47.sep)) {
    sendText(res, 403, "forbidden");
    return;
  }
  let bytes;
  try {
    bytes = await (0, import_promises22.readFile)(target);
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
    if (req.method === "GET") return sendJson2(res, 200, { slug: opts.slug, comments: await opts.store.read(opts.slug) });
    if (req.method === "POST") return sendJson2(res, 200, { slug: opts.slug, comments: await applyOp(await readBody3(req), opts.store, opts.slug, clock) });
    return sendText(res, 405, "method not allowed");
  }
  if (pathname.startsWith(base)) {
    const name = pathname.slice(base.length);
    const page2 = opts.renderPages(await opts.store.read(opts.slug)).get(name);
    if (page2 !== void 0) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page2);
      return;
    }
  }
  await serveStatic(res, opts.reportDir, pathname);
}
async function startCommentServer(opts) {
  const host = opts.host ?? "127.0.0.1";
  const clock = opts.clock ?? systemClock;
  const reportDir = (0, import_node_path47.resolve)(opts.reportDir);
  const server = (0, import_node_http4.createServer)((req, res) => {
    void handle(req, res, { ...opts, reportDir }, clock).catch((cause) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const code = isCodedError(cause) ? cause.code : "qa.comment.server";
      sendJson2(res, 400, { error: code });
    });
  });
  await new Promise((ok, fail) => {
    server.once("error", (cause) => fail(new LaunchwrightError("qa.comment.listen", `The comment server cannot listen on ${host}:${opts.port ?? 0}: ${cause.message}`, { cause })));
    server.listen(opts.port ?? 0, host, ok);
  });
  const port2 = server.address().port;
  const url = `http://${host}:${port2}`;
  return {
    port: port2,
    url,
    indexUrl: `${url}/${opts.viewerDir}/index.html`,
    async close() {
      server.closeAllConnections();
      await new Promise((ok, fail) => server.close((err) => err ? fail(err) : ok()));
    }
  };
}
var import_node_http4, import_promises22, import_node_path47, MAX_BODY, sendJson2, sendText;
var init_comment_server = __esm({
  "src/services/comment-server.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_http4 = require("http");
    import_promises22 = require("fs/promises");
    import_node_path47 = require("path");
    init_kernel();
    init_comments();
    init_mime();
    MAX_BODY = 1024 * 1024;
    sendJson2 = (res, status, value) => {
      const body = JSON.stringify(value);
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
      res.end(body);
    };
    sendText = (res, status, text2) => {
      res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
      res.end(text2);
    };
  }
});

// src/services/comment-export.mts
function stepOfPath(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? Number(m[1]) : null;
}
function stepScreenshot(entries, row, leg, attempt, step) {
  const stepShot = entries.find((e) => e.kind === "step" && e.row === row && e.leg === leg && e.attempt === attempt && stepOfPath(e.path) === step);
  if (stepShot) return stepShot.path;
  return entries.find((e) => e.kind === "screenshot" && e.row === row && e.leg === leg)?.path;
}
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
function resolveComments(comments2, ctx) {
  return comments2.filter((c) => c.status === "open").map((c) => {
    const crop = ctx.crops?.get(c.id);
    return { id: c.id, kind: c.anchor.kind, ...resolveAnchor(c.anchor, ctx), note: oneLine(c.body), ...crop ? { crop } : {} };
  });
}
async function writeRegionCrops(comments2, ctx, opts) {
  const crops = /* @__PURE__ */ new Map();
  for (const c of comments2) {
    if (c.status !== "open" || c.anchor.kind !== "region" || !inLedger(ctx.entries, c.anchor.screenshot)) continue;
    const source = (0, import_node_path48.join)(opts.reportDir, c.anchor.screenshot);
    let bytes;
    try {
      bytes = await (0, import_promises23.readFile)(source);
    } catch (cause) {
      throw new LaunchwrightError("qa.comment.crop", `Cannot read the screenshot ${c.anchor.screenshot} of comment ${c.id}.`, { cause, context: { id: c.id } });
    }
    const crop = cropPng(bytes, c.anchor);
    const file = (0, import_node_path48.join)(opts.cropDir, `${fileNameOf(c.id)}.crop.png`);
    await (0, import_promises23.mkdir)(opts.cropDir, { recursive: true });
    await (0, import_promises23.writeFile)(file, crop.png);
    crops.set(c.id, { path: (0, import_node_path48.relative)(opts.root, file), width: crop.width, height: crop.height });
  }
  return crops;
}
function exportTaskList(comments2, ctx) {
  const resolved = resolveComments(comments2, ctx);
  if (resolved.length === 0) return "No open comments to act on.";
  const lines2 = [`${resolved.length} open comment${resolved.length === 1 ? "" : "s"} to act on:`, ""];
  for (const r of resolved) {
    const orphan = r.orphaned ? " (orphaned: the ledger no longer holds this file)" : "";
    const crop = r.crop ? ` Crop: ${r.crop.path} (${r.crop.width}x${r.crop.height} px).` : "";
    lines2.push(`- [${r.kind}] ${r.target}${orphan}: ${r.located}.${crop} Note: ${r.note}`);
  }
  return lines2.join("\n");
}
var import_promises23, import_node_path48, oneLine, shotOf, screenState, inLedger, pct, fileNameOf;
var init_comment_export = __esm({
  "src/services/comment-export.mts"() {
    "use strict";
    init_cjs_shims();
    import_promises23 = require("fs/promises");
    import_node_path48 = require("path");
    init_kernel();
    init_manifest2();
    init_png();
    oneLine = (text2) => text2.replace(/\s+/g, " ").trim();
    shotOf = (manifest, row) => manifest.shots.find((s) => s.id === row);
    screenState = (shot) => shot ? `${shot.screen} ${shot.state}` : "";
    inLedger = (entries, path) => entries.some((e) => e.path === path);
    pct = (v) => Math.round(v * 100);
    fileNameOf = (id) => id.replace(/[^A-Za-z0-9._-]/g, "_");
  }
});

// src/commands/qa-comments.mts
var qa_comments_exports = {};
__export(qa_comments_exports, {
  default: () => qa_comments_default
});
function legNames(opts) {
  return legDefinitions(qaConfigOf(opts.config)).map((l) => l.name);
}
function reportOf(arg, opts) {
  if (arg.endsWith(".md") || arg.includes("/")) {
    const md = (0, import_node_path49.isAbsolute)(arg) ? arg : (0, import_node_path49.resolve)(opts.cwd, arg);
    return { md, slug: (0, import_node_path49.basename)(md).replace(/\.md$/, "") };
  }
  const root = qaConfigOf(opts.config).reportDir;
  const reportDir = (0, import_node_path49.isAbsolute)(root) ? root : (0, import_node_path49.resolve)(opts.cwd, root);
  return { md: (0, import_node_path49.join)(reportDir, `${arg}.md`), slug: arg };
}
function port(option) {
  if (option === void 0) return void 0;
  const n = Number(option);
  if (typeof option !== "string" || !/^\d+$/.test(option) || n > 65535) {
    throw new LaunchwrightError("qa.comments.usage", `--port must be an integer from 0 (a free port) to 65535, not ${String(option)}.`);
  }
  return n;
}
async function serve2(arg, chosen, opts) {
  const { md, slug: slug3 } = reportOf(arg, opts);
  const { input, reportDir } = await loadViewerInput(md, { legs: legNames(opts) });
  const store = fileCommentStore((0, import_node_path49.join)(opts.cwd, COMMENTS_DIR));
  const viewerDir = `dist/${viewerDirName(slug3)}`;
  const { weights, gaugeColor } = qaConfigOf(opts.config).score;
  const renderPages = (comments2) => renderViewerBundle({ ...input, comments: comments2 }, { weights, gaugeColor }).pages;
  const server = await startCommentServer({ reportDir, viewerDir, slug: slug3, store, renderPages, clock: systemClock, ...chosen === void 0 ? {} : { port: chosen } });
  const stop = processSignal(opts.signal);
  try {
    opts.out(server.indexUrl);
    opts.err(`lw qa comments serve: ${slug3} on ${server.url}, store ${COMMENTS_DIR}/${slug3}.json; Ctrl-C stops it`);
    if (!stop.signal.aborted) await new Promise((resolve17) => stop.signal.addEventListener("abort", () => resolve17(), { once: true }));
  } finally {
    stop.dispose();
    await server.close();
  }
  return 0;
}
async function exportComments(arg, opts) {
  const { md, slug: slug3 } = reportOf(arg, opts);
  const { input, reportDir } = await loadViewerInput(md, { legs: legNames(opts) });
  const comments2 = await fileCommentStore((0, import_node_path49.join)(opts.cwd, COMMENTS_DIR)).read(slug3);
  const ctx = { manifest: input.manifest, entries: input.entries };
  const crops = await writeRegionCrops(comments2, ctx, { reportDir, cropDir: (0, import_node_path49.join)(opts.cwd, COMMENTS_DIR, slug3), root: opts.cwd });
  const list3 = exportTaskList(comments2, { ...ctx, crops });
  for (const line of list3.split("\n")) opts.out(line);
  return 0;
}
async function resolveComment(arg, id, reply, opts) {
  const { slug: slug3 } = reportOf(arg, opts);
  const store = fileCommentStore((0, import_node_path49.join)(opts.cwd, COMMENTS_DIR));
  let list3 = await store.read(slug3);
  if (reply !== void 0) list3 = replyToComment(list3, id, { author: RESOLVER, body: reply, createdAt: systemClock.date().toISOString() });
  list3 = setStatus(list3, id, "resolved");
  await store.write(slug3, list3);
  opts.out(`lw qa comments resolve: ${id} resolved${reply === void 0 ? "" : " with a reply"} in ${commentsFile(COMMENTS_DIR, slug3)}`);
  return 0;
}
var import_node_path49, USAGE15, RESOLVER, comments, qa_comments_default;
var init_qa_comments = __esm({
  "src/commands/qa-comments.mts"() {
    "use strict";
    init_cjs_shims();
    import_node_path49 = require("path");
    init_kernel();
    init_config2();
    init_legs();
    init_comment_server();
    init_comment_export();
    init_comments();
    init_viewer();
    init_context();
    USAGE15 = [
      "usage: lw qa comments <serve|export|resolve> <slug> [options]",
      "  serve <slug> [--port <n>]                 serve the viewer and the comment store on 127.0.0.1",
      "  export <slug>                             print the agent task list of the open comments, with region crops",
      "  resolve <slug> <id> [--reply <text>]      mark comment <id> resolved, after an optional reply"
    ];
    RESOLVER = "agent";
    comments = {
      name: "comments",
      summary: "Serve reviewer comments and export the agent task list of the open ones",
      async run(args, opts) {
        const [verb, ...rest] = args;
        const { words, options } = parseArgs2(rest, ["help"], ["port", "reply"]);
        if (verb === void 0 || verb === "--help" || verb === "-h" || options.help === true) {
          for (const line of USAGE15) opts.err(line);
          return verb === void 0 ? 2 : 0;
        }
        const [slug3, id, extra] = words;
        const wantsId = verb === "resolve";
        const reply = typeof options.reply === "string" ? options.reply : void 0;
        const known = verb === "serve" || verb === "export" || verb === "resolve";
        if (!known || slug3 === void 0 || (wantsId ? id === void 0 || extra !== void 0 : id !== void 0) || options.reply !== void 0 && (!wantsId || reply === void 0)) {
          for (const line of USAGE15) opts.err(line);
          return 2;
        }
        try {
          if (verb === "serve") return await serve2(slug3, port(options.port), opts);
          if (verb === "resolve") return await resolveComment(slug3, id, reply, opts);
          return await exportComments(slug3, opts);
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa comments ${verb}: ${cause.code}: ${cause.message}`);
          return 1;
        }
      }
    };
    qa_comments_default = comments;
  }
});

// src/commands/qa-consent.mts
var qa_consent_exports = {};
__export(qa_consent_exports, {
  default: () => qa_consent_default
});
async function recordsOf(store, prefix) {
  const records = await store.list();
  if (prefix === void 0) return records;
  if (!/^[0-9a-f]{1,64}$/.test(prefix)) throw new LaunchwrightError("qa.consent.usage", `"${prefix}" is not a manifest hash or a prefix of one.`);
  const found = records.filter((record3) => record3.hash.startsWith(prefix));
  if (found.length === 0) throw new LaunchwrightError("qa.consent.missing", `No consent record has the hash ${prefix}. lw qa consent show lists them.`);
  return found;
}
function oneHash(found, prefix) {
  if (found.length > 1) throw new LaunchwrightError("qa.consent.usage", `The prefix ${prefix} matches ${found.length} records. Give more characters of the hash.`);
  return found[0];
}
function show2(records, opts) {
  if (records.length === 0) {
    opts.out(`no consent record under ${CONSENT_DIR}`);
    return 0;
  }
  for (const record3 of records) {
    const via = new Map(record3.grants.map((g) => [g.id, g.via]));
    const items = record3.items ?? [];
    opts.out(`${record3.hash.slice(0, SHORT_HASH)}  "${record3.title ?? "untitled"}": ${items.length} item(s), ${record3.grants.length} grant(s)`);
    for (const item of items) {
      const given = via.get(item.id);
      opts.out(`${given ? `granted (${given})` : "not granted".padEnd(13)}${itemLine(item)}`);
    }
    for (const g of record3.grants) if (!items.some((item) => item.id === g.id)) opts.out(`granted (${g.via})  ${g.id}`);
  }
  return 0;
}
async function grantItem(store, records, id, opts) {
  const listing = records.filter((record3) => (record3.items ?? []).some((item) => item.id === id));
  if (listing.length === 0) {
    throw new LaunchwrightError(
      "qa.consent.unlisted",
      `No recorded manifest lists ${id}. Run the pass or the command first, so it prints its manifest, then grant an item that manifest lists.`,
      { context: { id } }
    );
  }
  for (const record3 of listing) {
    if (record3.grants.some((g) => g.id === id)) continue;
    await store.write(record3.hash, { ...record3, grants: [...record3.grants, { id, via: "item" }] });
  }
  opts.out(`granted ${id} in ${listing.length} consent record(s) under ${CONSENT_DIR}`);
  return 0;
}
async function run9(action, rest, opts) {
  const words = parseCommandArgs({}, rest).positionals;
  const store = consentStoreOf({ cwd: opts.cwd });
  if (action === "show" && words.length <= 1) return show2(await recordsOf(store, words[0]), opts);
  if (action === "reset" && words.length <= 1) {
    const prefix = words[0];
    const hash = prefix === void 0 ? void 0 : oneHash(await recordsOf(store, prefix), prefix).hash;
    const removed = await store.remove(hash);
    opts.out(`removed ${removed} consent record(s) from ${CONSENT_DIR}`);
    return 0;
  }
  if (action === "grant" && (words.length === 1 || words.length === 2)) {
    const [id, prefix] = words;
    return grantItem(store, await recordsOf(store, prefix), id, opts);
  }
  return null;
}
var USAGE16, SHORT_HASH, REFUSALS, consent, qa_consent_default;
var init_qa_consent = __esm({
  "src/commands/qa-consent.mts"() {
    "use strict";
    init_cjs_shims();
    init_kernel();
    init_args();
    init_consent_gate();
    init_contract();
    USAGE16 = [
      "usage: lw qa consent show [<hash>]",
      "       lw qa consent reset [<hash>]",
      "       lw qa consent grant <item-id> [<hash>]",
      "  show    print each consent record: its manifest items and which ones hold a grant",
      "  reset   remove every record, or the record of one manifest hash (a unique prefix is enough)",
      "  grant   grant one item that a recorded manifest lists, for example outward:throwaway-bot-create"
    ];
    SHORT_HASH = 12;
    REFUSALS = /* @__PURE__ */ new Set(["kernel.usage", "qa.consent.usage", "qa.consent.unlisted"]);
    consent = {
      name: "consent",
      summary: "Show, reset or grant the run contract consent records of .lw/qa/consent",
      async run(args, opts) {
        const [action, ...rest] = args;
        try {
          const code = await run9(action, rest, opts);
          if (code !== null) return code;
        } catch (cause) {
          if (!isCodedError(cause)) throw cause;
          opts.err(`lw qa consent ${action ?? ""}: ${cause.code}: ${cause.message}`);
          return cause instanceof UsageError || REFUSALS.has(cause.code) ? 2 : 1;
        }
        for (const line of USAGE16) opts.err(line);
        return 2;
      }
    };
    qa_consent_default = consent;
  }
});

// src/index.mts
var src_exports = {};
__export(src_exports, {
  ACT_KINDS: () => ACT_KINDS,
  ANCHOR_KINDS: () => ANCHOR_KINDS,
  BOTFATHER: () => BOTFATHER,
  BOT_STORE_DIR: () => BOT_STORE_DIR,
  COMMENTS_DIR: () => COMMENTS_DIR,
  CONSENT_DIR: () => CONSENT_DIR,
  DEFAULT_GAUGE_COLOR: () => DEFAULT_GAUGE_COLOR,
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
  SCORE_DIMENSIONS: () => SCORE_DIMENSIONS,
  SEVERITIES: () => SEVERITIES,
  SEVERITY_DEDUCTION: () => SEVERITY_DEDUCTION,
  SUBCOMMANDS: () => SUBCOMMANDS,
  addComment: () => addComment,
  botIdOf: () => botIdOf,
  commentsFile: () => commentsFile,
  computeManifest: () => computeManifest,
  computeScore: () => computeScore,
  configureBot: () => configureBot,
  createPlaywrightTarget: () => createPlaywrightTarget,
  createStatesCommand: () => createStatesCommand,
  createTargetRegistry: () => createTargetRegistry,
  credentialNeed: () => credentialNeed,
  destroyBot: () => destroyBot,
  diff: () => diff,
  exportTaskList: () => exportTaskList,
  extensionNames: () => extensionNames,
  extensionOf: () => extensionOf,
  extensionTargets: () => extensionTargets,
  fileBotStore: () => fileBotStore,
  fileCommentStore: () => fileCommentStore,
  fileConsentStore: () => fileConsentStore,
  findingProblems: () => findingProblems,
  grant: () => grant,
  isCodedError: () => isCodedError,
  isCssColor: () => isCssColor,
  issueMarkdown: () => issueMarkdown,
  listIssues: () => listIssues,
  loadExtensions: () => loadExtensions,
  makeComment: () => makeComment,
  manifestHash: () => manifestHash,
  mimeOfExtension: () => mimeOfExtension,
  missingCredentials: () => missingCredentials,
  newBot: () => newBot,
  parseBotToken: () => parseBotToken,
  parseFindings: () => parseFindings,
  pngSize: () => pngSize,
  qaCommand: () => qaCommand,
  qaConfig: () => qaConfig,
  qaConfigOf: () => qaConfigOf,
  qaProvider: () => qaProvider,
  readIssue: () => readIssue,
  recordDir: () => recordDir,
  recordGrants: () => recordGrants,
  recordId: () => recordId,
  renderScoreBreakdown: () => renderScoreBreakdown,
  renderScoreGauge: () => renderScoreGauge,
  replyToComment: () => replyToComment,
  resolveComments: () => resolveComments,
  scoreConfig: () => scoreConfig,
  scoreRows: () => scoreRows,
  setStatus: () => setStatus,
  startCommentServer: () => startCommentServer,
  tallyFindings: () => tallyFindings,
  validateAnchor: () => validateAnchor,
  withAppPaths: () => withAppPaths,
  writeIssue: () => writeIssue
});
module.exports = __toCommonJS(src_exports);
init_cjs_shims();

// src/commands/extensions.mts
init_cjs_shims();
var import_node_url = require("url");
init_kernel();
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
function extensionTargets(extensions, config, root, env) {
  return Object.assign({}, ...extensions.map((e) => e.targets?.(config, root, env) ?? {}));
}

// src/commands/qa.command.mts
init_cjs_shims();
init_config2();
var SUBCOMMANDS = [
  "changes",
  "session",
  "sweep",
  "report",
  "publish",
  "gc",
  "check",
  "world",
  "fixture",
  "worktree",
  "job",
  "states",
  "paths",
  "telegram",
  "sink",
  "comments",
  "consent"
];
var CORE = {
  changes: () => Promise.resolve().then(() => (init_qa_changes(), qa_changes_exports)),
  session: () => Promise.resolve().then(() => (init_qa_session(), qa_session_exports)),
  sweep: () => Promise.resolve().then(() => (init_qa_sweep(), qa_sweep_exports)),
  report: () => Promise.resolve().then(() => (init_qa_report(), qa_report_exports)),
  publish: () => Promise.resolve().then(() => (init_qa_publish(), qa_publish_exports)),
  gc: () => Promise.resolve().then(() => (init_qa_gc(), qa_gc_exports)),
  check: () => Promise.resolve().then(() => (init_qa_check(), qa_check_exports)),
  world: () => Promise.resolve().then(() => (init_qa_world(), qa_world_exports)),
  fixture: () => Promise.resolve().then(() => (init_qa_fixture(), qa_fixture_exports)),
  worktree: () => Promise.resolve().then(() => (init_qa_worktree(), qa_worktree_exports)),
  job: () => Promise.resolve().then(() => (init_qa_job(), qa_job_exports)),
  states: () => Promise.resolve().then(() => (init_qa_states(), qa_states_exports)),
  paths: () => Promise.resolve().then(() => (init_qa_paths(), qa_paths_exports)),
  telegram: () => Promise.resolve().then(() => (init_qa_telegram(), qa_telegram_exports)),
  sink: () => Promise.resolve().then(() => (init_qa_sink(), qa_sink_exports)),
  comments: () => Promise.resolve().then(() => (init_qa_comments(), qa_comments_exports)),
  consent: () => Promise.resolve().then(() => (init_qa_consent(), qa_consent_exports))
};
function isCore(sub) {
  return Object.hasOwn(CORE, sub);
}
async function load(sub) {
  return (await CORE[sub]()).default;
}
async function subcommandOf(sub, extensions) {
  if (isCore(sub)) return load(sub);
  const loader = extensions.find((e) => e.subcommands?.[sub])?.subcommands?.[sub];
  return loader ? loader() : void 0;
}
async function usage(opts, extensions) {
  opts.err("usage: lw qa <subcommand> [args]");
  for (const sub of SUBCOMMANDS) opts.err(`  ${sub.padEnd(10)} ${(await load(sub)).summary}`);
  for (const ext of extensions) {
    for (const [sub, loader] of Object.entries(ext.subcommands ?? {})) opts.err(`  ${sub.padEnd(10)} ${(await loader()).summary} (module ${ext.name})`);
  }
  return 2;
}
var DEFAULT_NAME = "lw qa";
function named(opts) {
  const name = opts.commandName ?? DEFAULT_NAME;
  if (name === DEFAULT_NAME) return opts;
  const rename4 = (write2) => (line) => write2(line.replace(/\blw qa\b/g, name));
  return { ...opts, out: rename4(opts.out), err: rename4(opts.err) };
}
var qaCommand = {
  name: "qa",
  summary: "QA passes with evidence, personas, state triggers, devices, fake Telegram, issue intake",
  async run(args, given) {
    const opts = named(given);
    const [first, ...rest] = args;
    const loaded = await loadExtensions(opts.cwd, opts.config);
    const extensions = [...(opts.extensions ?? []).filter((e) => !loaded.some((l) => l.name === e.name)), ...loaded];
    if (first === void 0 || first === "--help" || first === "-h") return usage(opts, extensions);
    const spec = await subcommandOf(first, extensions);
    if (spec === void 0) {
      opts.err(`lw qa: unknown subcommand ${first}. A subcommand of an extension module needs that module in the project config, for example qa-${first}.`);
      return usage(opts, extensions);
    }
    const added = extensions.some((e) => e.targets) ? extensionTargets(extensions, qaConfigOf(opts.config), opts.cwd, opts.processEnv) : {};
    return spec.run(rest, { ...opts, targets: { ...added, ...opts.targets } });
  }
};

// src/index.mts
init_qa_states();
init_config2();
init_contract2();
init_playwright();
init_errors();

// src/provider.mts
init_cjs_shims();
init_kernel();
init_config2();
init_targets();
init_tokens2();
init_clock2();
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

// src/index.mts
init_mime();
init_png();

// src/services/records.mts
init_cjs_shims();
var import_promises24 = require("fs/promises");
var import_node_path50 = require("path");
init_kernel();
init_fs();
init_mime();
init_types();
var ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
function recordId(...parts) {
  return parts.map((p) => String(p).replace(/^@/, "").replace(/[^A-Za-z0-9_.-]+/g, "-")).join("-");
}
function recordDir(root, id) {
  if (!ID.test(id) || id.includes("..")) throw new LaunchwrightError("qa.intake.id", `The intake id "${id}" has a character outside A-Z, a-z, 0-9, _, . and -.`, { context: { id } });
  return (0, import_node_path50.join)(root, INTAKE_DIR, id);
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
  const lines2 = [
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
    lines2.push("", "## Thread");
    for (const t of issue.thread) lines2.push("", `${t.at}, ${t.author}:`, "", quote(t.text));
  }
  if (issue.attachments.length > 0) {
    lines2.push("", "## Attachments", "");
    for (const a of issue.attachments) {
      const link = a.kind === "image" ? `![${a.path}](${a.path})` : `[${a.path}](${a.path})`;
      lines2.push(`- ${a.kind}, ${a.mime}, ${a.bytes} bytes: ${link}`);
    }
  }
  if (issue.skipped.length > 0) {
    lines2.push("", "## Skipped", "");
    for (const s of issue.skipped) lines2.push(`- ${s.reason}: ${s.from}`);
  }
  return `${lines2.join("\n")}
`;
}
async function writeIssue(root, draft) {
  const dir = recordDir(root, draft.id);
  await (0, import_promises24.rm)(dir, { recursive: true, force: true });
  await (0, import_promises24.mkdir)((0, import_node_path50.join)(dir, "assets"), { recursive: true });
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
    await (0, import_promises24.writeFile)((0, import_node_path50.join)(dir, path), m.data);
    issue.attachments.push({
      kind: m.kind,
      path,
      sha256: sha256(m.data),
      bytes: m.data.byteLength,
      mime: m.mime,
      from: m.from
    });
  }
  await (0, import_promises24.writeFile)((0, import_node_path50.join)(dir, "issue.json"), `${JSON.stringify(issue, null, 2)}
`);
  await (0, import_promises24.writeFile)((0, import_node_path50.join)(dir, "issue.md"), issueMarkdown(issue));
  return issue;
}
async function readIssue(root, id) {
  const file = (0, import_node_path50.join)(recordDir(root, id), "issue.json");
  let text2;
  try {
    text2 = await (0, import_promises24.readFile)(file, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.intake.missing", `No intake record ${id}. Run lw qa intake list.`, { cause, context: { id } });
  }
  return JSON.parse(text2);
}
async function listIssues(root) {
  const base = (0, import_node_path50.join)(root, INTAKE_DIR);
  let names;
  try {
    names = (await (0, import_promises24.readdir)(base, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.intake.read", `Cannot read ${INTAKE_DIR}.`, { cause });
  }
  const out = [];
  for (const name of names.sort()) {
    let text2;
    try {
      text2 = await (0, import_promises24.readFile)((0, import_node_path50.join)(base, name, "issue.json"), "utf8");
    } catch (cause) {
      if (cause.code === "ENOENT") continue;
      throw new LaunchwrightError("qa.intake.read", `Cannot read the intake record ${name}.`, { cause });
    }
    out.push(JSON.parse(text2));
  }
  return out;
}

// src/index.mts
init_contract();
init_botfather();
init_bot_store();
init_comments();
init_comment_export();
init_comment_server();
init_score();
init_score_config();
init_findings();
init_targets();
init_types();
init_video();
init_tokens2();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ACT_KINDS,
  ANCHOR_KINDS,
  BOTFATHER,
  BOT_STORE_DIR,
  COMMENTS_DIR,
  CONSENT_DIR,
  DEFAULT_GAUGE_COLOR,
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
  SCORE_DIMENSIONS,
  SEVERITIES,
  SEVERITY_DEDUCTION,
  SUBCOMMANDS,
  addComment,
  botIdOf,
  commentsFile,
  computeManifest,
  computeScore,
  configureBot,
  createPlaywrightTarget,
  createStatesCommand,
  createTargetRegistry,
  credentialNeed,
  destroyBot,
  diff,
  exportTaskList,
  extensionNames,
  extensionOf,
  extensionTargets,
  fileBotStore,
  fileCommentStore,
  fileConsentStore,
  findingProblems,
  grant,
  isCodedError,
  isCssColor,
  issueMarkdown,
  listIssues,
  loadExtensions,
  makeComment,
  manifestHash,
  mimeOfExtension,
  missingCredentials,
  newBot,
  parseBotToken,
  parseFindings,
  pngSize,
  qaCommand,
  qaConfig,
  qaConfigOf,
  qaProvider,
  readIssue,
  recordDir,
  recordGrants,
  recordId,
  renderScoreBreakdown,
  renderScoreGauge,
  replyToComment,
  resolveComments,
  scoreConfig,
  scoreRows,
  setStatus,
  startCommentServer,
  tallyFindings,
  validateAnchor,
  withAppPaths,
  writeIssue
});
//# sourceMappingURL=index.cjs.map