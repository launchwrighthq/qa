import {
  LaunchwrightError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/kernel/services/apps.mts
import { z } from "zod";
var APP_RUNTIMES = ["node", "python", "web"];
var APP_NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
var processSchema = z.strictObject({
  command: z.string().trim().min(1),
  /** Ask the dev port registry for a port. */
  port: z.boolean().optional(),
  /** The queue lanes this process consumes (spec 2.6). */
  lanes: z.array(z.string().min(1)).optional(),
  /** The number of copies of the process. `lw dev` starts each as `<app>.<process>-<i>`. Default 1. */
  count: z.number().int().min(1).optional(),
  /** The part of the app's modules that this process starts. Default: every module of the app. */
  modules: z.array(z.string().min(1)).optional()
});
var appSchema = z.strictObject({
  runtime: z.enum(APP_RUNTIMES),
  path: z.string().min(1).optional(),
  modules: z.array(z.string().min(1)).optional(),
  processes: z.record(z.string().regex(APP_NAME, "must be letters, digits and -"), processSchema).optional(),
  /** A `web` app: the `node` app that serves its files. */
  servedBy: z.string().min(1).optional()
});
var appsSchema = z.record(z.string().regex(APP_NAME, "must be letters, digits and -"), appSchema);
var contractSchema = z.looseObject({ python: z.array(z.string().min(1)).optional(), ts: z.array(z.string().min(1)).optional() });
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
    return new Promise((resolve2, reject) => {
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
        resolve2();
      }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
};

// src/kernel/services/container.mts
var resolving = [];
function hasDispose(v) {
  return typeof v === "object" && v !== null && typeof v.dispose === "function";
}
var KernelContainer = class _KernelContainer {
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
function createContainer() {
  return new KernelContainer();
}

// src/kernel/services/driver.mts
var BaseDriver = class {
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

// src/kernel/config.mts
import { z as z2 } from "zod";
var PROCESS_ROLES = ["all", "web", "worker"];
var kernelConfig = z2.object({
  lifecycle: z2.object({
    lameDuckMs: z2.number().int().nonnegative().default(5e3),
    drainMs: z2.number().int().positive().default(2e4)
  }).prefault({}),
  role: z2.enum(PROCESS_ROLES).default("all"),
  remoteDb: z2.boolean().default(false),
  deployedEnvs: z2.array(z2.string().min(1)).default([]),
  localDrivers: z2.array(z2.string().min(1)).default(["fake", "log", "memory"]),
  allowLocalDrivers: z2.array(z2.string().regex(/^[a-z0-9_.-]+\.[a-z0-9_-]+$/, "must be <kind>.<driver>")).default([]),
  sync: z2.object({ timeoutSeconds: z2.number().positive().optional() }).prefault({})
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
import { z as z3 } from "zod";
var DEV_RELEASE = "dev";
var RELEASE_ID = /^[1-9][0-9]{0,8}-[0-9a-f]{7}$/;
var SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
var stampConfig = z3.strictObject({
  version: z3.string().regex(SEMVER, "must be semver MAJOR.MINOR.PATCH[-pre] with no build metadata"),
  release: z3.string().refine((r) => r === DEV_RELEASE || RELEASE_ID.test(r), `must be ${DEV_RELEASE} or <build>-<sha7>`),
  commit: z3.string().regex(/^[0-9a-f]{40}$/, "must be 40 lower-case hex digits").nullable(),
  builtAt: z3.iso.datetime({ offset: true, error: "must be an ISO date and time" })
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
import { createHmac, timingSafeEqual } from "crypto";
var encoder = new TextEncoder();
function safeEqual(a, b) {
  const x = typeof a === "string" ? encoder.encode(a) : a;
  const y = typeof b === "string" ? encoder.encode(b) : b;
  if (x.byteLength !== y.byteLength) return false;
  return timingSafeEqual(x, y);
}
function hmac(key, data) {
  const h = createHmac("sha256", key);
  for (const part of typeof data === "string" || data instanceof Uint8Array ? [data] : data) h.update(part);
  return h.digest();
}
function hmacHex(key, data) {
  return hmac(key, data).toString("hex");
}

// src/kernel/services/html.mts
var ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

// src/kernel/services/manifest.mts
import { readFile } from "fs/promises";
import { join } from "path";
import { parse } from "smol-toml";
import { z as z4 } from "zod";
var manifestSchema = z4.object({
  name: z4.string().min(1),
  summary: z4.string(),
  requires: z4.array(z4.string()).default([]),
  languages: z4.array(z4.enum(["ts", "py"])).min(1),
  submodules: z4.record(z4.string(), z4.object({ default: z4.boolean().optional(), requires: z4.array(z4.string()).optional() })).default({}),
  contributes: z4.record(z4.string(), z4.unknown()).default({})
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
import { existsSync } from "fs";
function moduleFixture(from, relative) {
  let dir = new URL(".", from);
  let pkg;
  for (; ; ) {
    const candidate = new URL(`fixtures/${relative}`, dir);
    if (existsSync(candidate)) return candidate;
    const parent = new URL("..", dir);
    if (pkg !== void 0 || parent.href === dir.href) break;
    if (existsSync(new URL("package.json", dir))) pkg = dir;
    dir = parent;
  }
  if (pkg === void 0) {
    throw new LaunchwrightError("kernel.fixture.package", `No package.json is above ${String(from)}, so its fixtures/ folder is unknown.`, {
      context: { file: String(from) }
    });
  }
  return new URL(`fixtures/${relative}`, pkg);
}

// src/kernel/services/resolve-import.mts
import { existsSync as existsSync2, readFileSync, realpathSync, statSync } from "fs";
import { dirname, join as join2 } from "path";
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
  for (let dir = root; ; dir = dirname(dir)) {
    const candidate = join2(dir, "node_modules", name);
    if (existsSync2(join2(candidate, "package.json"))) return candidate;
    if (dirname(dir) === dir) return void 0;
  }
}
function fileAt(base) {
  for (const path of [base, `${base}.js`, join2(base, "index.js")]) if (statSync(path, { throwIfNoEntry: false })?.isFile()) return path;
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
    manifest = JSON.parse(readFileSync(join2(dir, "package.json"), "utf8"));
  } catch (cause) {
    throw fail(`${join2(dir, "package.json")} is not valid JSON`, cause);
  }
  let target;
  if (manifest.exports === void 0) {
    target = fileAt(join2(dir, subpath === "." ? typeof manifest.main === "string" ? manifest.main : "index.js" : subpath));
  } else {
    const map = manifest.exports;
    const bySubpath = map !== null && typeof map === "object" && !Array.isArray(map) && Object.keys(map).some((k) => k.startsWith("."));
    const entry = bySubpath ? map[subpath] : subpath === "." ? map : void 0;
    const path = exportTarget(entry);
    if (path === void 0) throw fail(`package ${name} exports no ${subpath} for import`);
    const file = join2(dir, path);
    target = statSync(file, { throwIfNoEntry: false })?.isFile() ? file : void 0;
  }
  if (target === void 0) throw fail(`${subpath} of package ${name} names a file that does not exist`);
  return realpathSync(target);
}

// src/kernel/services/project.mts
import { z as z5 } from "zod";

// src/kernel/services/stamp-source.mts
import { existsSync as existsSync3, readFileSync as readFileSync2, statSync as statSync2 } from "fs";
import { dirname as dirname2, join as join3, resolve } from "path";

// src/kernel/services/project.mts
var NAME = /^[a-z][a-z0-9-]*$/;
var ENV_NAME = /^[a-z][a-z0-9_-]*$/;
var moduleOptions = z5.record(z5.string(), z5.unknown());
var STAMP_REFUSED = "is not allowed: the build sets the stamp from LW_VERSION, LW_RELEASE, LW_COMMIT and LW_BUILT_AT";
var projectConfigSchema = z5.object({
  /** The project name: lower case letters, digits and `-`. */
  name: z5.string().regex(NAME, "must be lower case letters, digits and -").optional(),
  /** The modules of the project, with the options of each one. */
  modules: z5.record(z5.string().regex(NAME, "must be a module name"), moduleOptions).default({}),
  /** The driver of each kind per environment, for example `{ local: { cache: 'memory' } }`. */
  drivers: z5.record(z5.string(), z5.record(z5.string(), z5.string())).default({}),
  /** Partial module sections per environment, merged over the sections before the `drivers` picks (round 6d N100). */
  environments: z5.record(z5.string().regex(ENV_NAME, "must be an environment name: [a-z][a-z0-9_-]*"), z5.record(z5.string(), moduleOptions)).optional(),
  /** The table map: `{ <module>: { <key>: <table name> } }` (spec 2.10). */
  tables: z5.record(z5.string(), z5.record(z5.string(), z5.string())).default({}),
  /** The theme package or theme name. */
  theme: z5.string().min(1).optional(),
  locales: z5.object({ default: z5.string().min(1), supported: z5.array(z5.string().min(1)).min(1) }).refine((l) => l.supported.includes(l.default), { message: "default must be one of supported", path: ["default"] }).optional(),
  /** The `dev` module's section: surfaces, services, tunnels. The `dev` module validates it. */
  dev: z5.record(z5.string(), z5.unknown()).optional(),
  /** The apps of the project (first-consumer spec 2.2). Absent: `DEFAULT_APPS`. `resolveApps` fills the defaults. */
  apps: appsSchema.optional(),
  /** The folders of the generated `tables.py` (`python`) and TS client (`ts`). */
  contract: contractSchema.optional(),
  /** The harness module's section: `disable` lists hook, rule or skill ids to leave out. */
  harness: z5.looseObject({ disable: z5.array(z5.string()).default([]) }).optional(),
  /** Refused: the project loader fills section `stamp` (versioning spec 2.4). */
  stamp: z5.never({ error: STAMP_REFUSED }).optional()
}).loose().superRefine((config, ctx) => {
  if ("stamp" in config.modules) ctx.addIssue({ code: "custom", path: ["modules", "stamp"], message: STAMP_REFUSED });
});

// src/kernel/index.mts
import { z as z6 } from "zod";

export {
  sectionApps,
  appDir,
  appPath,
  systemClock,
  createContainer,
  provider,
  token,
  CONFIG,
  CLOCK,
  safeEqual,
  hmacHex,
  BaseDriver,
  escapeHtml,
  optionalPeer,
  moduleFixture,
  resolveImport,
  z6 as z
};
//# sourceMappingURL=chunk-5AJ7M7K5.js.map