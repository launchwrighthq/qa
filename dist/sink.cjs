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

// src/sink/index.mts
var sink_exports = {};
__export(sink_exports, {
  ADDRESS_HEADER: () => ADDRESS_HEADER,
  FaultPlan: () => FaultPlan,
  MASK: () => MASK,
  MAX_BODY_BYTES: () => MAX_BODY_BYTES,
  OK_REPLY: () => OK_REPLY,
  RETRY_AFTER_S: () => RETRY_AFTER_S,
  SECRET_HEADER: () => SECRET_HEADER,
  maskHeaders: () => maskHeaders,
  parseFault: () => parseFault,
  parseFaults: () => parseFaults,
  replyOf: () => replyOf,
  seededSource: () => seededSource,
  startSink: () => startSink
});
module.exports = __toCommonJS(sink_exports);

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

// src/sink/services/faults.mts
var RETRY_AFTER_S = 30;
var OK_REPLY = { status: 200, headers: {}, body: "ok", holdMs: 0 };
var RULE = /^(?:(?<plain>503|429|410)|302:(?<url>.+?)|slow:(?<ms>\d{1,7}))(?:x(?<count>\d{1,9})|@(?<ratio>0(?:\.\d+)?|1(?:\.0+)?))?$/;
var GRAMMAR = "a rule is 503, 429, 410, 302:<url> or slow:<ms>, with an optional count (503x2) or ratio (503@0.5)";
function parseFault(text) {
  const m = RULE.exec(text.trim());
  const g = m?.groups;
  if (!g) throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}" is not valid: ${GRAMMAR}.`, { context: { rule: text } });
  const limit = {
    ...g.count !== void 0 ? { count: Number(g.count) } : {},
    ...g.ratio !== void 0 ? { ratio: Number(g.ratio) } : {}
  };
  if (limit.count === 0) throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}" has count 0, so it never fires.`, { context: { rule: text } });
  if (g.plain !== void 0) return { text, kind: g.plain, ...limit };
  if (g.ms !== void 0) return { text, kind: "slow", ms: Number(g.ms), ...limit };
  const url = g.url;
  let location;
  try {
    location = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}": ${url} is not an absolute URL.`, { cause, context: { rule: text } });
  }
  if (location.protocol !== "http:" && location.protocol !== "https:") {
    throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}": the 302 target must be an http or https URL.`, { context: { rule: text } });
  }
  return { text, kind: "302", location: url, ...limit };
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
var FaultPlan = class {
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

// src/sink/services/server.mts
var import_promises2 = require("fs/promises");
var import_node_http = require("http");
var import_node_path4 = require("path");
var MASK = "[masked]";
var SECRET_HEADER = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-telegram-bot-api-secret-token|x-.+-token)$|secret|token|key|signature/i;
var ADDRESS_HEADER = /forwarded-for|real-ip|connecting-ip|client-ip|^forwarded$/i;
var MAX_BODY_BYTES = 1024 * 1024;
function maskHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === void 0) continue;
    out[name] = SECRET_HEADER.test(name) || ADDRESS_HEADER.test(name) ? MASK : value;
  }
  return out;
}
function readBody(req, max) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (chunk) => {
      if (bytes < max) chunks.push(chunk.subarray(0, max - bytes));
      bytes += chunk.length;
    });
    req.on("end", () => resolve2({ text: Buffer.concat(chunks).toString("utf8"), bytes, truncated: bytes > max }));
    req.on("error", reject);
    req.on("close", () => {
      if (!req.complete) reject(new Error("the sender closed the request before its end"));
    });
  });
}
async function startSink(opts = {}) {
  const rules = (opts.faults ?? []).map((r) => typeof r === "string" ? parseFault(r) : r);
  const plan = new FaultPlan(rules, seededSource(opts.seed ?? 1));
  const clock = opts.clock ?? systemClock;
  const max = opts.maxBodyBytes ?? MAX_BODY_BYTES;
  const records = [];
  let writes = Promise.resolve();
  let writeError;
  const stopping = new AbortController();
  const pending = /* @__PURE__ */ new Set();
  if (opts.file !== void 0) await (0, import_promises2.mkdir)((0, import_node_path4.dirname)(opts.file), { recursive: true, mode: 448 });
  const persist = (record) => {
    const file = opts.file;
    if (file === void 0) return;
    writes = writes.then(
      () => (0, import_promises2.appendFile)(file, `${JSON.stringify(record)}
`, { mode: 384 }).catch((err) => {
        writeError ??= err;
      })
    );
  };
  const server = (0, import_node_http.createServer)((req, res) => {
    const at = clock.date().toISOString();
    const n = records.length + 1;
    const { rule, reply } = plan.next();
    const url = req.url ?? "/";
    const record = {
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
    records.push(record);
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
    opts.onRecord?.(record, "arrived");
    const handled = (async () => {
      try {
        const body = await readBody(req, max);
        record.body = body.text;
        record.bodyBytes = body.bytes;
        if (body.truncated) record.bodyTruncated = true;
        const answer = await held;
        if (!answer || hungUp || res.destroyed) {
          record.closedEarly = true;
          return;
        }
        res.writeHead(reply.status, { "content-type": "text/plain", ...reply.headers });
        res.end(reply.body);
      } catch (err) {
        record.closedEarly = true;
        res.destroy(err instanceof Error ? err : new Error(String(err)));
      } finally {
        persist(record);
        opts.onRecord?.(record, "done");
      }
    })();
    pending.add(handled);
    void handled.then(() => pending.delete(handled));
  });
  await new Promise((resolve2, reject) => {
    server.once(
      "error",
      (cause) => reject(new LaunchwrightError("qa.sink.listen", `The sink cannot listen on 127.0.0.1:${opts.port ?? 0}: ${cause.message}`, { cause, context: { port: opts.port ?? 0 } }))
    );
    server.listen(opts.port ?? 0, "127.0.0.1", resolve2);
  });
  const port = server.address().port;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    records,
    ...opts.file === void 0 ? {} : { file: opts.file },
    async close() {
      stopping.abort(new Error("the sink closed"));
      server.closeAllConnections();
      await new Promise((resolve2, reject) => server.close((err) => err ? reject(err) : resolve2()));
      await Promise.all(pending);
      await writes;
      if (writeError !== void 0) {
        throw new LaunchwrightError("qa.sink.write", `The sink could not write ${opts.file}.`, { cause: writeError, context: { file: opts.file } });
      }
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADDRESS_HEADER,
  FaultPlan,
  MASK,
  MAX_BODY_BYTES,
  OK_REPLY,
  RETRY_AFTER_S,
  SECRET_HEADER,
  maskHeaders,
  parseFault,
  parseFaults,
  replyOf,
  seededSource,
  startSink
});
//# sourceMappingURL=sink.cjs.map