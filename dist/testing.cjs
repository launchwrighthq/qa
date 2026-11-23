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

// src/testing/index.mts
var testing_exports = {};
__export(testing_exports, {
  BROWSERS_PATH: () => BROWSERS_PATH,
  CONTRACT_BASE: () => CONTRACT_BASE,
  FIXTURE_ISSUE: () => FIXTURE_ISSUE,
  contractFakeRoutes: () => contractFakeRoutes,
  createFakeTarget: () => createFakeTarget,
  headlessShell: () => headlessShell,
  patternPng: () => patternPng,
  serveContractSite: () => serveContractSite,
  targetContract: () => targetContract,
  targetHarness: () => targetHarness,
  uniformPng: () => uniformPng,
  writeIssueReportFixture: () => writeIssueReportFixture,
  writeReportFixture: () => writeReportFixture
});
module.exports = __toCommonJS(testing_exports);

// node_modules/.pnpm/tsup@8.5.1_postcss@8.5.33_tsx@4.23.15_typescript@6.0.3/node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/testing/target-contract.mts
var import_node_fs6 = require("fs");
var import_node_http2 = require("http");
var import_node_path6 = require("path");

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
function moduleFixture(from, relative2) {
  let pkg = new URL(".", from);
  while (!(0, import_node_fs.existsSync)(new URL("package.json", pkg))) {
    const parent = new URL("..", pkg);
    if (parent.href === pkg.href) {
      throw new LaunchwrightError("kernel.fixture.package", `No package.json is above ${String(from)}, so its fixtures/ folder is unknown.`, {
        context: { file: String(from) }
      });
    }
    pkg = parent;
  }
  const published = new URL(`fixtures/${relative2}`, pkg);
  const repo = new URL(`../fixtures/${relative2}`, pkg);
  return (0, import_node_fs.existsSync)(published) || !(0, import_node_fs.existsSync)(repo) ? published : repo;
}

// src/kernel/services/resolve-import.mts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");

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

// src/kernel/testing/contract.mts
var import_node_fs4 = require("fs");
var import_node_url = require("url");
var import_vitest = require("vitest");
function readCasesFile(file, kind, specVersion) {
  const invalid = (reason) => new LaunchwrightError("kernel.contract.invalid", `The cases file ${file.pathname} ${reason}.`, { context: { file: file.pathname, kind } });
  let parsed;
  try {
    parsed = JSON.parse((0, import_node_fs4.readFileSync)((0, import_node_url.fileURLToPath)(file), "utf8"));
  } catch (err) {
    throw new LaunchwrightError("kernel.contract.invalid", `Cannot read the cases file ${file.pathname}.`, {
      cause: err,
      context: { file: file.pathname, kind }
    });
  }
  if (parsed.kind !== kind) throw invalid(`has kind "${parsed.kind}", the suite has kind "${kind}"`);
  if (parsed.specVersion !== specVersion) throw invalid(`has specVersion "${parsed.specVersion}", the suite has specVersion "${specVersion}"`);
  if (!Array.isArray(parsed.cases)) throw invalid("has no cases array");
  const names = parsed.cases.map((c) => c.name);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate !== void 0) throw invalid(`lists the case "${duplicate}" twice`);
  return parsed;
}
function defineContract(kind, specVersion, cases, opts = {}) {
  if (!opts.casesFile) return { kind, specVersion, cases };
  const file = readCasesFile(opts.casesFile, kind, specVersion);
  const inFile = new Set(file.cases.map((c) => c.name));
  for (const c of cases) {
    if (!inFile.has(c.name)) {
      throw new LaunchwrightError(
        "kernel.contract.case",
        `The ${kind} contract has the case "${c.name}", which the cases file ${opts.casesFile.pathname} lacks. Add it to the file.`,
        { context: { kind, case: c.name, file: opts.casesFile.pathname } }
      );
    }
  }
  const byName = new Map(cases.map((c) => [c.name, c]));
  const merged = file.cases.map((fc) => {
    const code = byName.get(fc.name);
    if (code) return code;
    return {
      name: fc.name,
      async run(driver) {
        if (!opts.data || fc.input === void 0 || fc.expect === void 0) {
          throw new LaunchwrightError(
            "kernel.contract.missing",
            `The ${kind} case "${fc.name}" has no code and no data. Add code to the suite, or add input and expect to the cases file and pass data.`,
            { context: { kind, case: fc.name, file: opts.casesFile?.pathname } }
          );
        }
        const actual = await opts.data(driver, fc.input);
        if (typeof fc.expect === "object" && fc.expect !== null && !Array.isArray(fc.expect)) {
          (0, import_vitest.expect)(actual).toMatchObject(fc.expect);
        } else {
          (0, import_vitest.expect)(actual).toEqual(fc.expect);
        }
      }
    };
  });
  return { kind, specVersion, cases: merged };
}

// src/kernel/testing/fake-clock.mts
var import_node_timers = require("timers");

// src/kernel/testing/redirect-trap.mts
var import_node_http = require("http");
var import_vitest2 = require("vitest");

// src/kernel/testing/tmp-dir.mts
var import_promises2 = require("fs/promises");
var import_node_os = require("os");
var import_node_path4 = require("path");
var import_vitest3 = require("vitest");

// src/testing/target-contract.mts
var import_vitest4 = require("vitest");

// src/drivers/target/fake.mts
var import_node_fs5 = require("fs");
var import_node_path5 = require("path");

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

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION = "1";

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
  (0, import_node_fs5.mkdirSync)((0, import_node_path5.dirname)(path), { recursive: true });
  (0, import_node_fs5.writeFileSync)(path, bytes);
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

// src/testing/target-contract.mts
function targetHarness(target, opts) {
  return {
    name: target.name,
    specVersion: target.specVersion,
    capabilities: target.capabilities,
    supports: (cap) => target.supports(cap),
    target,
    leg: opts.leg ?? { name: "contract", surface: "web", target: target.name, viewport: { width: 640, height: 480 } },
    baseUrl: opts.baseUrl,
    outDir: opts.outDir
  };
}
var CONTRACT_BASE = "/site";
var page = (body) => `<!doctype html><html><head><meta charset="utf-8"><title>contract</title></head><body>${body}</body></html>`;
var DOT_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
var SITE = {
  "/": page(
    `<main id="home"><h1>Home</h1><a href="{base}/next">Next</a><input id="name" aria-label="Name"><img alt="dot" src="${DOT_PNG}" width="8" height="8"><div style="height:3000px"></div></main>`
  ),
  "/next": page('<main id="next"><h1>Next</h1></main>'),
  "/busy": page(
    `<main id="busy" aria-busy="true"><h1>Busy</h1></main><script>requestAnimationFrame(() => document.getElementById('busy').setAttribute('aria-busy', 'false'))</script>`
  ),
  "/video": page('<video id="clip" src="{base}/clip.webm" autoplay muted loop playsinline width="32" height="32"></video>'),
  "/errors": page(
    `<main id="errors"><h1>Errors</h1></main><script>console.error('contract console error');fetch('{base}/fail').then(() => { const d = document.createElement('p'); d.id = 'done'; d.textContent = 'done'; document.body.append(d); });throw new Error('contract page error');</script>`
  )
};
function contractFakeRoutes() {
  return {
    "/": { selectors: ["#home", "#name", 'role=link[name="Next"]'], links: { 'role=link[name="Next"]': "/next" }, artwork: true },
    "/next": { selectors: ["#next"] },
    "/busy": { selectors: ["#busy"] },
    "/video": { selectors: ["#clip"], video: true },
    "/errors": {
      selectors: ["#errors", "#done"],
      logs: [
        { kind: "console-error", text: "contract console error" },
        { kind: "response-5xx", text: `500 GET ${CONTRACT_BASE}/fail` },
        { kind: "page-error", text: "contract page error" }
      ]
    },
    "/redirect": { redirect: "/next" }
  };
}
async function serveContractSite() {
  const server = (0, import_node_http2.createServer)((req, res) => {
    const path = new URL(req.url ?? "/", "http://site.test").pathname;
    const route = path === CONTRACT_BASE ? "/" : path.startsWith(`${CONTRACT_BASE}/`) ? path.slice(CONTRACT_BASE.length) : null;
    if (route === "/redirect") {
      res.writeHead(302, { location: `${CONTRACT_BASE}/next` }).end();
      return;
    }
    if (route === "/fail") {
      res.writeHead(500, { "content-type": "text/plain" }).end("fail");
      return;
    }
    if (route === "/clip.webm") {
      res.writeHead(200, { "content-type": "video/webm", "content-length": FAKE_CLIP.length }).end(FAKE_CLIP);
      return;
    }
    const html = route === null ? void 0 : SITE[route];
    if (html === void 0) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html.replaceAll("{base}", CONTRACT_BASE));
  });
  await new Promise((resolve3, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve3());
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}${CONTRACT_BASE}`,
    close: () => new Promise((resolve3, reject) => {
      server.closeAllConnections();
      server.close((err) => err ? reject(err) : resolve3());
    })
  };
}
async function using(h, fn) {
  const dir = await h.outDir();
  const session = await h.target.open({ leg: h.leg, baseUrl: h.baseUrl, outDir: dir });
  try {
    await fn(session, dir);
  } finally {
    await session.close();
  }
}
async function codeOf(p) {
  const err = await p.then(
    () => void 0,
    (e) => e
  );
  (0, import_vitest4.expect)(err).toBeInstanceOf(LaunchwrightError);
  return err.code;
}
function has(h, cap) {
  return h.target.capabilities.has(cap);
}
var CASES_FILE = moduleFixture(importMetaUrl, "contract/target.cases.json");
var targetContract = defineContract(
  "qa.target",
  QA_TARGET_SPEC_VERSION,
  [
    {
      name: "navigate shows the route relative to the surface base",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/next");
          (0, import_vitest4.expect)(await s.currentRoute()).toBe("/next");
          await s.navigate("/");
          (0, import_vitest4.expect)(await s.currentRoute()).toBe("/");
        });
      }
    },
    {
      name: "a redirect shows in currentRoute",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/redirect");
          (0, import_vitest4.expect)(await s.currentRoute()).toBe("/next");
        });
      }
    },
    {
      name: "click on a role selector opens the linked route",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/");
          if (!has(h, "input")) {
            (0, import_vitest4.expect)(await codeOf(s.act({ kind: "click", target: 'role=link[name="Next"]' }))).toBe("qa.target.capability");
            return;
          }
          await s.act({ kind: "click", target: 'role=link[name="Next"]' });
          await s.settle({ selector: "#next", timeout: 5e3 });
          (0, import_vitest4.expect)(await s.currentRoute()).toBe("/next");
        });
      }
    },
    {
      name: "type, press, scroll, wait and back run in order",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/next");
          await s.navigate("/");
          if (!has(h, "input")) {
            (0, import_vitest4.expect)(await codeOf(s.act({ kind: "type", target: "#name", text: "hello" }))).toBe("qa.target.capability");
            return;
          }
          await s.act({ kind: "type", target: "#name", text: "hello" });
          await s.act({ kind: "press", target: "#name", key: "Tab" });
          await s.act({ kind: "scroll", dy: 400 });
          await s.act({ kind: "wait", ms: 0, why: "the contract checks that wait runs" });
          await s.act({ kind: "back" });
          (0, import_vitest4.expect)(await s.currentRoute()).toBe("/next");
        });
      }
    },
    {
      name: "an act on a missing element fails with qa.target.act",
      async run(h) {
        if (!has(h, "input")) return;
        await using(h, async (s) => {
          await s.navigate("/next");
          (0, import_vitest4.expect)(await codeOf(s.act({ kind: "click", target: "#nothing-here" }))).toBe("qa.target.act");
        });
      }
    },
    {
      name: "settle waits for a selector, artwork, a playing video and no busy element",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/");
          await s.settle({ selector: "#home", timeout: 5e3 });
          await s.settle({ artwork: true, timeout: 5e3 });
          await s.navigate("/busy");
          await s.settle({ busy: true, timeout: 5e3 });
          await s.navigate("/video");
          await s.settle({ video: true, timeout: 1e4 });
        });
      }
    },
    {
      name: "settle on a missing selector fails with qa.target.settle",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/next");
          (0, import_vitest4.expect)(await codeOf(s.settle({ selector: "#never", timeout: 300 }))).toBe("qa.target.settle");
        });
      }
    },
    {
      name: "screenshot writes a PNG whose header gives the capture size",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          const path = (0, import_node_path6.join)(dir, "leg-row.png");
          if (!has(h, "screenshot")) {
            (0, import_vitest4.expect)(await codeOf(s.screenshot(path))).toBe("qa.target.capability");
            return;
          }
          const shot = await s.screenshot(path);
          (0, import_vitest4.expect)(shot.path).toBe(path);
          const size = pngSize((0, import_node_fs6.readFileSync)(path));
          (0, import_vitest4.expect)(size).not.toBeNull();
          (0, import_vitest4.expect)(size).toEqual({ width: shot.width, height: shot.height });
        });
      }
    },
    {
      name: "startVideo and stopVideo write a clip with a duration",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          const path = (0, import_node_path6.join)(dir, "leg-row.webm");
          if (!has(h, "video")) {
            (0, import_vitest4.expect)(await codeOf(s.startVideo(path))).toBe("qa.target.capability");
            return;
          }
          await s.startVideo(path);
          await s.navigate("/next");
          await s.settle({ selector: "#next", timeout: 5e3 });
          const clip = await s.stopVideo();
          (0, import_vitest4.expect)(clip.path).toBe(path);
          (0, import_vitest4.expect)(clip.durationMs).toBeGreaterThan(0);
          (0, import_vitest4.expect)((0, import_node_fs6.readFileSync)(path).length).toBeGreaterThan(0);
        });
      }
    },
    {
      name: "logs hold page errors, console errors and 5xx responses",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/errors");
          await s.settle({ selector: "#done", timeout: 5e3 });
          const logs = await s.logs();
          const kinds = new Set(logs.map((l) => l.kind));
          (0, import_vitest4.expect)(kinds).toEqual(/* @__PURE__ */ new Set(["page-error", "console-error", "response-5xx"]));
          for (const line of logs) (0, import_vitest4.expect)(Number.isNaN(Date.parse(line.at))).toBe(false);
          (0, import_vitest4.expect)(logs.find((l) => l.kind === "page-error")?.text).toContain("contract page error");
        });
      }
    },
    {
      name: "a missing capability rejects with qa.target.capability",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          if (!has(h, "input")) (0, import_vitest4.expect)(await codeOf(s.act({ kind: "back" }))).toBe("qa.target.capability");
          if (!has(h, "screenshot")) (0, import_vitest4.expect)(await codeOf(s.screenshot((0, import_node_path6.join)(dir, "x.png")))).toBe("qa.target.capability");
          if (!has(h, "video")) {
            (0, import_vitest4.expect)(await codeOf(s.startVideo((0, import_node_path6.join)(dir, "x.webm")))).toBe("qa.target.capability");
            (0, import_vitest4.expect)(await codeOf(s.stopVideo())).toBe("qa.target.capability");
          }
          for (const cap of ["input", "screenshot", "video"]) (0, import_vitest4.expect)(h.supports(cap)).toBe(has(h, cap));
        });
      }
    },
    {
      name: "trace and dump give a written path or null",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          for (const [call, path] of [
            [s.trace.bind(s), (0, import_node_path6.join)(dir, "leg-row.trace.zip")],
            [s.dump.bind(s), (0, import_node_path6.join)(dir, "leg-row.ui.xml")]
          ]) {
            const written = await call(path);
            if (written === null) continue;
            (0, import_vitest4.expect)(written).toBe(path);
            (0, import_vitest4.expect)((0, import_node_fs6.readFileSync)(path).length).toBeGreaterThan(0);
          }
        });
      }
    },
    {
      name: "ready answers a boolean and a reason when not ready",
      async run(h) {
        const r = await h.target.ready(h.leg);
        (0, import_vitest4.expect)(typeof r.ready).toBe("boolean");
        if (!r.ready) (0, import_vitest4.expect)(r.reason ?? "").not.toBe("");
      }
    },
    {
      name: "close ends the session and a second close does nothing",
      async run(h) {
        const session = await h.target.open({ leg: h.leg, baseUrl: h.baseUrl, outDir: await h.outDir() });
        await session.navigate("/");
        await session.close();
        await session.close();
      }
    }
  ],
  { casesFile: CASES_FILE }
);

// src/testing/chromium.mts
var import_node_fs7 = require("fs");
var import_node_os2 = require("os");
var import_node_path7 = require("path");
var BROWSERS_PATH = (0, import_node_path7.join)((0, import_node_os2.userInfo)().homedir, ".cache", "ms-playwright");
function headlessShell() {
  const dirs = (0, import_node_fs7.existsSync)(BROWSERS_PATH) ? (0, import_node_fs7.readdirSync)(BROWSERS_PATH).filter((d) => d.startsWith("chromium_headless_shell-")) : [];
  const found = dirs.map((d) => ({ build: Number(d.split("-")[1]), path: (0, import_node_path7.join)(BROWSERS_PATH, d, "chrome-headless-shell-linux64", "chrome-headless-shell") })).filter((d) => (0, import_node_fs7.existsSync)(d.path)).sort((a, b) => b.build - a.build)[0];
  if (!found) {
    throw new LaunchwrightError("qa.test.chromium", `No chrome-headless-shell under ${BROWSERS_PATH}. Run: npx playwright install chromium`);
  }
  return found.path;
}

// src/testing/report-fixture.mts
var import_promises8 = require("fs/promises");
var import_node_path12 = require("path");

// src/services/ledger.mts
var import_promises4 = require("fs/promises");
var import_node_path8 = require("path");

// src/kernel/services/fs.mts
var import_node_crypto2 = require("crypto");
var import_node_fs8 = require("fs");
var import_promises3 = require("fs/promises");
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
    return await (0, import_promises3.readFile)(path, "utf8");
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
    for await (const chunk2 of (0, import_node_fs8.createReadStream)(path)) hash.update(chunk2);
  } catch (cause) {
    throw readError(path, cause);
  }
  return hash.digest("hex");
}

// src/services/types.mts
var ACT_KINDS = ["click", "type", "press", "scroll", "wait", "back"];
var INTAKE_DIR = ".lw/qa/intake";

// src/services/ledger.mts
var LEDGER_FILE = "evidence.lock.json";
var RESULTS_FILE = "results.jsonl";
var LEDGER_FORMAT = 1;
var assetsRel = (slug) => `assets/${slug}`;
function reportPaths(reportDir, slug) {
  return {
    md: (0, import_node_path8.join)(reportDir, `${slug}.md`),
    plan: (0, import_node_path8.join)(reportDir, `${slug}.shots.json`),
    assets: (0, import_node_path8.join)(reportDir, assetsRel(slug)),
    ledger: (0, import_node_path8.join)(reportDir, assetsRel(slug), LEDGER_FILE),
    results: (0, import_node_path8.join)(reportDir, assetsRel(slug), RESULTS_FILE),
    html: (0, import_node_path8.join)(reportDir, "dist", `${slug}.html`)
  };
}
async function fileDigest(path) {
  const sha2562 = await hashFile(path);
  return { sha256: sha2562, bytes: (await (0, import_promises4.stat)(path)).size };
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
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
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
  await (0, import_promises4.mkdir)((0, import_node_path8.dirname)(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await (0, import_promises4.writeFile)(tmp, `${JSON.stringify(sorted, null, 2)}
`);
  await (0, import_promises4.rename)(tmp, path);
  return sorted;
}
async function appendLedger(reportDir, slug, entries) {
  const path = reportPaths(reportDir, slug).ledger;
  const current = await readLedger(path) ?? { format: LEDGER_FORMAT, slug, entries: [] };
  const byPath = new Map(current.entries.map((e) => [e.path, e]));
  for (const e of entries) byPath.set(e.path, e);
  return writeLedger(path, { format: LEDGER_FORMAT, slug, entries: [...byPath.values()] });
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
    if (!isObject(parsed) || typeof parsed.row !== "string" || typeof parsed.leg !== "string" || typeof parsed.status !== "string" || !Array.isArray(parsed.failures)) {
      throw new LaunchwrightError("qa.results.invalid", `${path}:${i + 1} is not a row result`, { context: { path, line: i + 1 } });
    }
    out.push(parsed);
  });
  return out;
}
async function appendResult(path, result) {
  await (0, import_promises4.mkdir)((0, import_node_path8.dirname)(path), { recursive: true });
  await (0, import_promises4.writeFile)(path, `${JSON.stringify(result)}
`, { flag: "a" });
}
var pairKey = (row, leg) => `${row}\0${leg}`;

// src/services/manifest.mts
var import_promises5 = require("fs/promises");

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

// src/services/manifest.mts
var SHOT_FIELDS = ["id", "screen", "state", "source", "legs", "route", "fixture", "settle", "expect"];
var ACT_FIELDS = /* @__PURE__ */ new Set(["kind", "target", "text", "key", "dx", "dy", "ms", "why"]);
var SETTLE_RULES = ["selector", "artwork", "video", "busy"];
var SOURCE_RE = /^(?:spec:[^\s#]+#[A-Za-z0-9._-]+|commit:[0-9a-f]{7,40}|issue:[A-Za-z0-9._-]+)$/;
var KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FACT_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isText = (v) => typeof v === "string" && v.trim() !== "";
function checkAct(at, step, errors) {
  if (!isObject2(step)) {
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
function checkFixture(at, fixture, errors) {
  if (!isObject2(fixture)) {
    errors.push(`${at}: fixture must be an object with arm`);
    return;
  }
  const { account, arm, persona, facts } = fixture;
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
  if (!isObject2(settle)) {
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
function checkExpect(at, expect4, errors) {
  if (isText(expect4)) return;
  if (!isObject2(expect4)) {
    errors.push(`${at}: expect must be a claim, or an object with text and pageErrors`);
    return;
  }
  if (!isText(expect4.text)) errors.push(`${at}: expect.text is missing`);
  if (expect4.pageErrors !== void 0 && (!Array.isArray(expect4.pageErrors) || !expect4.pageErrors.every(isText))) {
    errors.push(`${at}: expect.pageErrors must be an array of page error texts`);
  }
}
function checkShot(shot, i, seen, legs, bases, errors) {
  const at = isObject2(shot) && typeof shot.id === "string" ? `shots[${i}] "${shot.id}"` : `shots[${i}]`;
  if (!isObject2(shot)) {
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
  if (!isObject2(m)) return ["the manifest is not an object"];
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
function expectText(shot) {
  return typeof shot.expect === "string" ? shot.expect : shot.expect.text;
}
var SUFFIX = {
  trace: "trace.zip",
  log: "log.jsonl",
  ui: "ui.xml"
};
function evidencePath(slug, leg, rowId, kind, opts = {}) {
  const attempt = opts.attempt !== void 0 && opts.attempt > 1 ? `.a${opts.attempt}` : "";
  let suffix;
  if (kind === "screenshot") suffix = "png";
  else if (kind === "step") {
    if (opts.step === void 0) throw new LaunchwrightError("qa.evidence.step", `A step screenshot of ${rowId} on ${leg} needs a step number`);
    suffix = `${opts.step}.png`;
  } else if (kind === "video") suffix = opts.videoExt ?? "webm";
  else suffix = SUFFIX[kind];
  return `assets/${slug}/${leg}-${rowId}${attempt}.${suffix}`;
}

// src/services/report.mts
var import_promises6 = require("fs/promises");
var import_node_path10 = require("path");

// src/services/video.mts
var import_node_child_process = require("child_process");

// src/services/evidence.mts
var EVIDENCE_START = "<!-- qa:evidence:start -->";
var EVIDENCE_END = "<!-- qa:evidence:end -->";
var COVERAGE_START = "<!-- qa:coverage:start -->";
var COVERAGE_END = "<!-- qa:coverage:end -->";
var KIND_ORDER = { screenshot: 0, step: 1, video: 2, trace: 3, log: 4, ui: 5 };
var STILL = /* @__PURE__ */ new Set(["screenshot", "step"]);
var LINKED = { trace: "trace", log: "log", ui: "UI dump" };
var PER_ROW = 2;
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
function cell(text) {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[/g, "&#91;").replace(/\]/g, "&#93;").trim();
}
var altText = (text) => cell(text).replace(/[[\]]/g, "");
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
      const size = sizeOf(e.path);
      if (size && size.width <= size.height) {
        portraits.push(e);
        continue;
      }
      out.push(caption(e, showAttempt, size ? "" : ", shape unknown"), "", embed(e, shot), "");
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
  const world = input.world ?? [];
  if (world.length > 0) {
    const covered = coveredStates(input);
    const open = world.filter((w) => !covered.has(w.id));
    if (out.length > 0) out.push("");
    out.push(`${world.length - open.length} of ${world.length} world states have a passed row with evidence.`);
    if (open.length > 0) {
      out.push("", "| State | Feature | Why it has no evidence |", "|---|---|---|");
      for (const w of open) {
        const named = input.manifest.shots.some((s) => s.fixture.persona === w.id || (s.fixture.facts ?? []).includes(w.id));
        out.push(`| \`${w.id}\` | ${cell(w.feature ?? "")} | ${named ? "a row names it and no leg passed" : "no row names it"} |`);
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
  const world = input.world ?? [];
  if (world.length === 0) return base;
  const covered = coveredStates(input);
  return `${base}, ${world.filter((w) => covered.has(w.id)).length} of ${world.length} world states`;
}

// src/render/services/spec-render.mts
var import_node_fs9 = require("fs");
var import_node_path9 = require("path");
var import_node_url2 = require("url");
var TEMPLATE_SEARCH_DEPTH = 5;
var TEMPLATE_DIR = templateDir();
function templateDir() {
  let dir = (0, import_node_path9.dirname)((0, import_node_url2.fileURLToPath)(importMetaUrl));
  let packageRoot = null;
  for (let up = 0; up <= TEMPLATE_SEARCH_DEPTH; up += 1) {
    const candidate = (0, import_node_path9.join)(dir, "assets", "renderer");
    if ((0, import_node_fs9.existsSync)((0, import_node_path9.join)(candidate, "spec-template.html"))) return candidate;
    if (packageRoot === null && (0, import_node_fs9.existsSync)((0, import_node_path9.join)(dir, "package.json"))) packageRoot = dir;
    dir = (0, import_node_path9.dirname)(dir);
  }
  return (0, import_node_path9.join)(packageRoot ?? (0, import_node_path9.dirname)((0, import_node_url2.fileURLToPath)(importMetaUrl)), "assets", "renderer");
}
var TEMPLATE = (0, import_node_path9.join)(TEMPLATE_DIR, "spec-template.html");

// src/services/report.mts
var REPORT_SECTIONS = [
  { n: 1, title: "What this run covered" },
  { n: 2, title: "What the code claims" },
  { n: 3, title: "What was seen" },
  { n: 4, title: "Findings" },
  { n: 5, title: "Not covered" },
  { n: 6, title: "How to retest" }
];
var SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FIELD_RE = /^(Date|Status|Range|Spec|Issues|Legs|Coverage):\s*(.*)$/;
var SECTION_RE = /^##\s+(\d+)\.?(?:\s|$)/;
function slugOf(mdPath) {
  const slug = (0, import_node_path10.basename)(mdPath).replace(/\.md$/, "");
  if (!mdPath.endsWith(".md") || !SLUG_RE.test(slug)) {
    throw new LaunchwrightError("qa.report.slug", `${mdPath}: a report is <reportDir>/YYYY-MM-DD-<name>.md, with a kebab-case name`, { context: { path: mdPath } });
  }
  return slug;
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
function parse2(text) {
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.startsWith("## "));
  const bodyStart = first === -1 ? lines.length : first;
  const fields = /* @__PURE__ */ new Map();
  let title = null;
  for (let i = 0; i < bodyStart; i += 1) {
    const line = lines[i];
    if (title === null && /^#\s/.test(line)) title = line.slice(1).trim();
    const m = FIELD_RE.exec(line);
    if (m && !fields.has(m[1])) fields.set(m[1], { value: m[2].trim(), line: i });
  }
  const sections = /* @__PURE__ */ new Map();
  let fence = false;
  lines.forEach((line, i) => {
    if (line.startsWith("```")) fence = !fence;
    if (fence) return;
    const m = SECTION_RE.exec(line);
    if (m) sections.set(Number(m[1]), [...sections.get(Number(m[1])) ?? [], i]);
  });
  return { lines, bodyStart, title, fields, sections };
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
async function loadReport(mdPath, opts = {}) {
  const slug = slugOf(mdPath);
  const reportDir = (0, import_node_path10.dirname)(mdPath);
  const paths = reportPaths(reportDir, slug);
  let text;
  try {
    text = await (0, import_promises6.readFile)(mdPath, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.report.read", `Cannot read the report ${mdPath}`, { cause, context: { path: mdPath } });
  }
  let manifest = null;
  let manifestErrors = [];
  let planRaw = null;
  try {
    planRaw = await (0, import_promises6.readFile)(paths.plan, "utf8");
  } catch (cause) {
    if (cause.code !== "ENOENT") throw new LaunchwrightError("qa.report.read", `Cannot read the plan ${paths.plan}`, { cause });
    manifestErrors = [`the plan ${(0, import_node_path10.basename)(paths.plan)} is missing`];
  }
  if (planRaw !== null) {
    let parsed = null;
    try {
      parsed = JSON.parse(planRaw);
    } catch (cause) {
      manifestErrors = [`the plan ${(0, import_node_path10.basename)(paths.plan)} is not JSON: ${cause.message}`];
    }
    if (manifestErrors.length === 0) {
      manifestErrors = validateManifest(parsed, opts);
      if (manifestErrors.length === 0) manifest = parsed;
    }
  }
  return { mdPath, reportDir, slug, text, manifest, manifestErrors, results: await readResults(paths.results), ledger: await readLedger(paths.ledger) };
}
async function stillSizes(reportDir, entries) {
  const out = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (e.kind !== "screenshot" && e.kind !== "step") continue;
    let bytes = null;
    try {
      bytes = await (0, import_promises6.readFile)((0, import_node_path10.join)(reportDir, e.path));
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
function putBlock(lines, start, end, body, section) {
  const p = parse2(lines.join("\n"));
  const block = findBlock(p, sectionRange(p, section), start, end);
  if (typeof block !== "string") return [...lines.slice(0, block.from + 1), ...body.split("\n"), ...lines.slice(block.to)];
  if (lines.some((l) => l.trim() === start || l.trim() === end)) {
    throw new LaunchwrightError("qa.report.block", `The report markers are broken: ${block}`);
  }
  const range = sectionRange(p, section);
  if (!range) throw new LaunchwrightError("qa.report.section", `The report has no section ${section}`);
  let at = range[1];
  while (at > range[0] && lines[at - 1].trim() === "") at -= 1;
  return [...lines.slice(0, at), "", start, ...body.split("\n"), end, "", ...lines.slice(range[1])];
}
function putField(lines, field, value) {
  const p = parse2(lines.join("\n"));
  const at = p.fields.get(field)?.line;
  if (at !== void 0) return lines.map((l, i) => i === at ? `${field}: ${value}` : l);
  const last = Math.max(...[...p.fields.values()].map((f) => f.line), lines.findIndex((l) => /^#\s/.test(l)));
  return [...lines.slice(0, last + 1), `${field}: ${value}`, ...lines.slice(last + 1)];
}
async function updateReport(mdPath, opts = {}) {
  const r = await loadReport(mdPath, opts);
  if (!r.manifest) {
    throw new LaunchwrightError("qa.report.plan", `The plan of ${mdPath} is invalid:
  ${r.manifestErrors.join("\n  ")}`, { context: { errors: r.manifestErrors } });
  }
  const entries = r.ledger?.entries ?? [];
  const input = { manifest: r.manifest, results: r.results, entries, ...opts.world ? { world: opts.world } : {} };
  let lines = r.text.split("\n");
  lines = putBlock(lines, EVIDENCE_START, EVIDENCE_END, await renderEvidence({ ...r, manifest: r.manifest }), 3);
  lines = putBlock(lines, COVERAGE_START, COVERAGE_END, coverageSection(input), 5);
  const status = computeStatus(input);
  lines = putField(lines, "Status", status);
  lines = putField(lines, "Legs", legsLine(r.manifest, r.results));
  lines = putField(lines, "Coverage", coverageLine(input));
  await (0, import_promises6.writeFile)(mdPath, lines.join("\n"));
  return status;
}
function reportSkeleton(input) {
  const out = [`# QA: ${input.title}`, "", `Date: ${input.date}`, "Status: planned", `${input.source.field}: ${input.source.value}`, "Legs: none ran", "Coverage: 0 row legs", ""];
  for (const s of REPORT_SECTIONS) {
    out.push(`## ${s.n} ${s.title}`, "");
    if (s.n === 3) out.push(EVIDENCE_START, EVIDENCE_END, "");
    if (s.n === 5) out.push(COVERAGE_START, COVERAGE_END, "");
  }
  return out.join("\n");
}

// src/services/records.mts
var import_promises7 = require("fs/promises");
var import_node_path11 = require("path");

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

// src/services/records.mts
var ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
function recordDir(root, id) {
  if (!ID.test(id) || id.includes("..")) throw new LaunchwrightError("qa.intake.id", `The intake id "${id}" has a character outside A-Z, a-z, 0-9, _, . and -.`, { context: { id } });
  return (0, import_node_path11.join)(root, INTAKE_DIR, id);
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
  await (0, import_promises7.rm)(dir, { recursive: true, force: true });
  await (0, import_promises7.mkdir)((0, import_node_path11.join)(dir, "assets"), { recursive: true });
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
    await (0, import_promises7.writeFile)((0, import_node_path11.join)(dir, path), m.data);
    issue.attachments.push({
      kind: m.kind,
      path,
      sha256: sha256(m.data),
      bytes: m.data.byteLength,
      mime: m.mime,
      from: m.from
    });
  }
  await (0, import_promises7.writeFile)((0, import_node_path11.join)(dir, "issue.json"), `${JSON.stringify(issue, null, 2)}
`);
  await (0, import_promises7.writeFile)((0, import_node_path11.join)(dir, "issue.md"), issueMarkdown(issue));
  return issue;
}

// src/testing/report-fixture.mts
function patternPng(width, height) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = (x * 7 + y * 13) % 256;
      rgba[i + 1] = x * 3 % 256;
      rgba[i + 2] = y * 5 % 256;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(width, height, rgba);
}
function uniformPng(width, height, gray = 0) {
  const rgba = new Uint8Array(width * height * 4).fill(gray);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return encodePng(width, height, rgba);
}
async function writeReportFixture(reportDir, opts = {}) {
  const slug = opts.slug ?? "2026-01-01-fixture";
  const rows = opts.rows ?? [{ id: "home.guest", legs: ["desktop", "mobile-web"] }];
  const paths = reportPaths(reportDir, slug);
  const manifest = {
    title: "fixture",
    generated: "2026-01-01T00:00:00.000Z",
    range: "abc1234..def5678",
    shots: rows.map((r) => {
      const [screen, state] = r.id.split(".");
      return { id: r.id, screen, state, source: r.source ?? ["commit:abc1234"], legs: r.legs, route: `/${screen}`, fixture: { arm: [] }, settle: { busy: true }, expect: `${screen} shows ${state}` };
    })
  };
  await (0, import_promises8.mkdir)(paths.assets, { recursive: true });
  await (0, import_promises8.writeFile)(paths.plan, `${JSON.stringify(manifest, null, 2)}
`);
  const entries = [];
  for (const row of rows) {
    for (const leg of row.legs) {
      const pair = opts.pairs?.[`${row.id}@${leg}`] ?? {};
      const status = pair.status ?? "passed";
      if (pair.files !== false && (status === "passed" || status === "failed")) {
        const rel = evidencePath(slug, leg, row.id, "screenshot");
        await (0, import_promises8.mkdir)((0, import_node_path12.dirname)((0, import_node_path12.join)(reportDir, rel)), { recursive: true });
        await (0, import_promises8.writeFile)((0, import_node_path12.join)(reportDir, rel), leg === "desktop" ? patternPng(64, 40) : patternPng(40, 64));
        entries.push(
          await ledgerEntry(reportDir, {
            path: rel,
            kind: "screenshot",
            capturedAt: "2026-01-01T00:00:00.000Z",
            commit: "abc1234",
            dirty: false,
            leg,
            target: "playwright",
            provenance: "live",
            row: row.id,
            attempt: 1
          })
        );
      }
      await appendResult(paths.results, {
        row: row.id,
        leg,
        status,
        failures: pair.failures ?? [],
        attempts: status === "passed" || status === "failed" ? 1 : 0,
        ms: 10,
        ...pair.reason !== void 0 ? { reason: pair.reason } : {}
      });
    }
  }
  await appendLedger(reportDir, slug, entries);
  await (0, import_promises8.writeFile)(paths.md, reportSkeleton({ title: "fixture", date: "2026-01-01", source: opts.header ?? { field: "Range", value: "abc1234..def5678" } }));
  await updateReport(paths.md);
  return { mdPath: paths.md, slug };
}
var FIXTURE_ISSUE = "tg-fixture-7";
async function writeIssueReportFixture(root, opts = {}) {
  const reportDir = (0, import_node_path12.join)(root, "docs/qa");
  const issue = await writeIssue(root, {
    id: FIXTURE_ISSUE,
    source: "telegram",
    ref: "chat 7, message 1",
    title: "The bot stays silent",
    reportedAt: "2026-01-01T00:00:00.000Z",
    reporter: "fixture reporter",
    text: "I send /start and nothing comes back.",
    thread: [],
    media: [{ from: "tg:7/1", kind: "image", mime: "image/png", name: "chat.png", data: patternPng(40, 64) }]
  });
  const { mdPath, slug } = await writeReportFixture(reportDir, {
    rows: [
      { id: "home.guest", legs: ["desktop"] },
      { id: "bot.silent", legs: ["desktop"], source: [`issue:${FIXTURE_ISSUE}`] }
    ],
    header: { field: "Issues", value: FIXTURE_ISSUE },
    ...opts
  });
  const image = issue.attachments[0]?.path;
  return { mdPath, slug, reportDir, issue: FIXTURE_ISSUE, link: `../../${INTAKE_DIR}/${FIXTURE_ISSUE}/${image}` };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BROWSERS_PATH,
  CONTRACT_BASE,
  FIXTURE_ISSUE,
  contractFakeRoutes,
  createFakeTarget,
  headlessShell,
  patternPng,
  serveContractSite,
  targetContract,
  targetHarness,
  uniformPng,
  writeIssueReportFixture,
  writeReportFixture
});
//# sourceMappingURL=testing.cjs.map