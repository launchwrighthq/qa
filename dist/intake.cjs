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

// src/kernel/services/actor.mts
var init_actor = __esm({
  "src/kernel/services/actor.mts"() {
    "use strict";
  }
});

// src/kernel/services/errors.mts
var LaunchwrightError, BootError;
var init_errors = __esm({
  "src/kernel/services/errors.mts"() {
    "use strict";
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
    BootError = class extends LaunchwrightError {
    };
  }
});

// src/kernel/services/apps.mts
var import_zod, APP_RUNTIMES, APP_NAME, processSchema, appSchema, appsSchema, contractSchema;
var init_apps = __esm({
  "src/kernel/services/apps.mts"() {
    "use strict";
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
  }
});

// src/kernel/services/apps-contract.mts
var init_apps_contract = __esm({
  "src/kernel/services/apps-contract.mts"() {
    "use strict";
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
    systemClock = {
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
  }
});

// src/kernel/config.mts
var import_zod2, PROCESS_ROLES, kernelConfig;
var init_config = __esm({
  "src/kernel/config.mts"() {
    "use strict";
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
    init_errors();
  }
});

// src/kernel/events.mts
var init_events = __esm({
  "src/kernel/events.mts"() {
    "use strict";
    init_errors();
  }
});

// src/kernel/services/health.mts
var init_health = __esm({
  "src/kernel/services/health.mts"() {
    "use strict";
    init_errors();
  }
});

// src/kernel/services/lifecycle.mts
var init_lifecycle = __esm({
  "src/kernel/services/lifecycle.mts"() {
    "use strict";
    init_errors();
  }
});

// src/kernel/services/key-words.mts
var SECRET_WORDS, SECRET_KEY_PATTERN;
var init_key_words = __esm({
  "src/kernel/services/key-words.mts"() {
    "use strict";
    init_errors();
    SECRET_WORDS = ["password", "secret", "token", "key", "authorization"];
    SECRET_KEY_PATTERN = new RegExp(`^(?:${SECRET_WORDS.join("|")})s?$`, "i");
  }
});

// src/kernel/services/logger.mts
var init_logger = __esm({
  "src/kernel/services/logger.mts"() {
    "use strict";
    init_clock();
    init_key_words();
  }
});

// src/kernel/services/order.mts
var init_order = __esm({
  "src/kernel/services/order.mts"() {
    "use strict";
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
    import_node_crypto = require("crypto");
    encoder = new TextEncoder();
  }
});

// src/kernel/services/env-grammar.mts
var init_env_grammar = __esm({
  "src/kernel/services/env-grammar.mts"() {
    "use strict";
    init_errors();
  }
});

// src/kernel/services/driver.mts
var BaseDriver;
var init_driver = __esm({
  "src/kernel/services/driver.mts"() {
    "use strict";
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
  }
});

// src/kernel/services/manager.mts
var init_manager = __esm({
  "src/kernel/services/manager.mts"() {
    "use strict";
    init_errors();
    init_tokens();
  }
});

// src/kernel/services/manifest.mts
var import_promises, import_node_path, import_smol_toml, import_zod4, manifestSchema;
var init_manifest = __esm({
  "src/kernel/services/manifest.mts"() {
    "use strict";
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
    init_errors();
  }
});

// src/kernel/services/module-fixture.mts
var import_node_fs;
var init_module_fixture = __esm({
  "src/kernel/services/module-fixture.mts"() {
    "use strict";
    import_node_fs = require("fs");
    init_errors();
  }
});

// src/kernel/services/resolve-import.mts
var import_node_fs2, import_node_path2;
var init_resolve_import = __esm({
  "src/kernel/services/resolve-import.mts"() {
    "use strict";
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
          await new Promise((resolve3) => signal.addEventListener("abort", () => resolve3(), { once: true }));
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
    import_node_url = require("url");
    init_kernel();
  }
});

// src/config.mts
var legConfig, qaConfig;
var init_config3 = __esm({
  "src/config.mts"() {
    "use strict";
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

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION;
var init_contract2 = __esm({
  "src/drivers/target/contract.mts"() {
    "use strict";
    QA_TARGET_SPEC_VERSION = "1";
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
  (0, import_node_fs4.mkdirSync)((0, import_node_path4.dirname)(path), { recursive: true });
  (0, import_node_fs4.writeFileSync)(path, bytes2);
}
function capabilityError(target, capability, what) {
  return new LaunchwrightError("qa.target.capability", `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability }
  });
}
function createFakeTarget(opts = {}) {
  return new FakeTargetImpl(opts);
}
var import_node_fs4, import_node_path4, FAKE_SHOT_SIZE, FAKE_CLIP_MS, DEFAULT_CAPABILITIES, CLIP_BASE64, FAKE_CLIP, FakeSession, FakeTargetImpl;
var init_fake2 = __esm({
  "src/drivers/target/fake.mts"() {
    "use strict";
    import_node_fs4 = require("fs");
    import_node_path4 = require("path");
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

// src/services/video.mts
var import_node_child_process, MIN_VIDEO_S;
var init_video = __esm({
  "src/services/video.mts"() {
    "use strict";
    import_node_child_process = require("child_process");
    init_kernel();
    MIN_VIDEO_S = 1;
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
var import_node_fs5, import_node_path5, PERSONA_SESSION_ROUTE, CAPABILITIES, MIN_CLIP_MS, importPlaywright, SETTLE_SCRIPTS, PlaywrightSession, PlaywrightTarget;
var init_playwright = __esm({
  "src/drivers/target/playwright.mts"() {
    "use strict";
    import_node_fs5 = require("fs");
    import_node_path5 = require("path");
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
    init_kernel();
    QA_TARGETS = token("qa.targets");
  }
});

// src/world/services/clock.mts
var ShiftClock;
var init_clock2 = __esm({
  "src/world/services/clock.mts"() {
    "use strict";
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
var import_node_crypto2, import_node_fs6, import_promises2, import_smol_toml2, MISSING;
var init_fs = __esm({
  "src/kernel/services/fs.mts"() {
    "use strict";
    import_node_crypto2 = require("crypto");
    import_node_fs6 = require("fs");
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
    INTAKE_DIR = ".lw/qa/intake";
  }
});

// src/services/records.mts
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
var import_promises3, import_node_path6, ID;
var init_records = __esm({
  "src/services/records.mts"() {
    "use strict";
    import_promises3 = require("fs/promises");
    import_node_path6 = require("path");
    init_kernel();
    init_fs();
    init_mime();
    init_types();
    ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
  }
});

// src/services/contract.mts
var import_promises4, import_node_path7;
var init_contract3 = __esm({
  "src/services/contract.mts"() {
    "use strict";
    import_promises4 = require("fs/promises");
    import_node_path7 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/botfather.mts
var init_botfather = __esm({
  "src/services/botfather.mts"() {
    "use strict";
    init_kernel();
  }
});

// src/services/bot-store.mts
var import_promises5, import_node_path8;
var init_bot_store = __esm({
  "src/services/bot-store.mts"() {
    "use strict";
    import_promises5 = require("fs/promises");
    import_node_path8 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/comments.mts
var import_node_crypto3, import_promises6, import_node_path9;
var init_comments = __esm({
  "src/services/comments.mts"() {
    "use strict";
    import_node_crypto3 = require("crypto");
    import_promises6 = require("fs/promises");
    import_node_path9 = require("path");
    init_kernel();
    init_fs();
  }
});

// src/services/legs.mts
var CHROME_MAJOR, DESKTOP_USER_AGENT, DEFAULT_LEGS;
var init_legs = __esm({
  "src/services/legs.mts"() {
    "use strict";
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
var import_promises7;
var init_manifest2 = __esm({
  "src/services/manifest.mts"() {
    "use strict";
    import_promises7 = require("fs/promises");
    init_kernel();
    init_legs();
    init_types();
  }
});

// src/services/comment-export.mts
var init_comment_export = __esm({
  "src/services/comment-export.mts"() {
    "use strict";
    init_manifest2();
  }
});

// src/services/comment-server.mts
var import_node_http, import_promises8, import_node_path10, MAX_BODY;
var init_comment_server = __esm({
  "src/services/comment-server.mts"() {
    "use strict";
    import_node_http = require("http");
    import_promises8 = require("fs/promises");
    import_node_path10 = require("path");
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
  }
});

// src/index.mts
var init_src = __esm({
  "src/index.mts"() {
    "use strict";
    init_extensions();
    init_config3();
    init_contract2();
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
    init_kernel();
    init_src();
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

// src/intake/services/gh.mts
function ghRunner(opts = {}) {
  const bin = opts.bin ?? "gh";
  const timeoutMs = opts.timeoutMs ?? GH_TIMEOUT_MS;
  return (args) => new Promise((resolve3, reject) => {
    const child = (0, import_node_child_process2.spawn)(bin, args, { stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs, killSignal: "SIGKILL" });
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
      resolve3({ code: code ?? 1, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") });
    });
  });
}
var import_node_child_process2, GH_TIMEOUT_MS, spawnGh;
var init_gh = __esm({
  "src/intake/services/gh.mts"() {
    "use strict";
    import_node_child_process2 = require("child_process");
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

// src/intake/services/telegram-peers.mts
async function loadTelegramPeer(spec, message) {
  const mod = await optionalPeer(spec, () => import(spec));
  if (mod === void 0) throw new LaunchwrightError("qa.intake.telegram.peer", message);
  return mod;
}
var loadBotApi, loadMtproto;
var init_telegram_peers = __esm({
  "src/intake/services/telegram-peers.mts"() {
    "use strict";
    init_kernel();
    loadBotApi = () => loadTelegramPeer(
      "@launchwrighthq/telegram/bot-api",
      "The telegram-bot intake driver calls the Bot API through module telegram. Install @launchwrighthq/telegram."
    );
    loadMtproto = () => loadTelegramPeer(
      "@launchwrighthq/telegram/mtproto",
      "The telegram-mtproto intake driver reads the chat through module telegram. Install @launchwrighthq/telegram."
    );
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
    init_kernel();
    init_media();
    init_telegram_peers();
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
        const { UserClient, loadGramJs } = await loadMtproto();
        const load = this.opts.loader ?? loadGramJs;
        try {
          const client = await UserClient.connect({ ...this.cfg, loader: async () => readOnlyGramJs(await load()) });
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
              if (cause instanceof LaunchwrightError) throw cause;
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
          if (cause instanceof LaunchwrightError && cause.code === "telegram.mtproto.download") {
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

// src/intake/drivers/intake/telegram-bot.mts
var telegram_bot_exports = {};
__export(telegram_bot_exports, {
  BOT_API_MAX_BYTES: () => BOT_API_MAX_BYTES,
  BOT_READ_METHODS: () => BOT_READ_METHODS,
  TelegramBotIntakeDriver: () => TelegramBotIntakeDriver,
  loadBotApi: () => loadBotApi,
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
    init_kernel();
    init_src();
    init_media();
    init_contract();
    init_telegram_peers();
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
        this.api = new opts.botApi.BotApi({ token: this.cfg.token, apiUrl: this.cfg.apiUrl, fetch: this.fetchFn });
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
          if (!(cause instanceof this.opts.botApi.TelegramApiError)) throw cause;
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
      const { loadBotApi: loadBotApi2, TelegramBotIntakeDriver: TelegramBotIntakeDriver2 } = await Promise.resolve().then(() => (init_telegram_bot(), telegram_bot_exports));
      return new TelegramBotIntakeDriver2(cfg, { maxBytes, botApi: await loadBotApi2(), ...deps.fetch ? { fetch: deps.fetch } : {} });
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
var init_registry = __esm({
  "src/intake/services/registry.mts"() {
    "use strict";
    init_kernel();
    INTAKE_DRIVERS = ["github", "telegram-mtproto", "telegram-bot", "fake"];
  }
});

// src/intake/services/telegram.mts
function chatName(chat) {
  return recordId(chat);
}
function chatDir(root, chat) {
  return (0, import_node_path11.join)(root, INTAKE_DIR, "telegram", chatName(chat));
}
function cursorFile(root, chat) {
  return (0, import_node_path11.join)(root, INTAKE_DIR, "telegram", `${chatName(chat)}.cursor`);
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
  await (0, import_promises9.mkdir)((0, import_node_path11.join)(root, INTAKE_DIR, "telegram"), { recursive: true });
  await (0, import_promises9.writeFile)(file, `${JSON.stringify(all, null, 2)}
`);
}
function readMessages(root, chat) {
  return jsonOr((0, import_node_path11.join)(chatDir(root, chat), "messages.json"), []);
}
async function stageBatch(root, chat, batch) {
  const dir = chatDir(root, chat);
  await (0, import_promises9.mkdir)((0, import_node_path11.join)(dir, "media"), { recursive: true });
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
      await (0, import_promises9.writeFile)((0, import_node_path11.join)(dir, file), data);
      media.push({ ...rest, file });
    }
    all.set(item.id, { ...item, media });
  }
  const messages = [...all.values()].sort(byId);
  await (0, import_promises9.writeFile)((0, import_node_path11.join)(dir, "messages.json"), `${JSON.stringify(messages, null, 2)}
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
  const join9 = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const lastOf = /* @__PURE__ */ new Map();
  for (const m of sorted) {
    if (m.replyTo !== void 0 && parent.has(m.replyTo)) join9(m.replyTo, m.id);
    const at = Date.parse(m.at);
    const prev = lastOf.get(m.author);
    if (prev && at - prev.at < JOIN_GAP_MS) join9(prev.id, m.id);
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
  const file = (0, import_node_path11.join)(chatDir(root, chat), "groups.proposed.json");
  await (0, import_promises9.mkdir)(chatDir(root, chat), { recursive: true });
  await (0, import_promises9.writeFile)(file, `${JSON.stringify({ chat, groups }, null, 2)}
`);
  return file;
}
async function readGroups(root, chat) {
  const file = (0, import_node_path11.join)(chatDir(root, chat), "groups.json");
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
    const list2 = g.messages.map((id) => messages.get(id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byId(a, b));
    const [first, ...rest] = list2;
    const media = [];
    for (const m of list2) {
      for (const s of m.media) {
        const { file, ...meta } = s;
        media.push(file === void 0 ? meta : { ...meta, data: new Uint8Array(await (0, import_promises9.readFile)((0, import_node_path11.join)(dir, file))) });
      }
    }
    out.push(
      await writeIssue(root, {
        id: recordId("tg", chat, first.id),
        source: "telegram",
        ref: `${chat}#${list2.map((m) => m.id).join(",")}`,
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
var import_promises9, import_node_path11, JOIN_GAP_MS, groupsFile, byId;
var init_telegram = __esm({
  "src/intake/services/telegram.mts"() {
    "use strict";
    import_promises9 = require("fs/promises");
    import_node_path11 = require("path");
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
  for (const line of USAGE) opts.err(line);
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
function boundOf(flag, value) {
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  if (Number.isNaN(at)) throw new LaunchwrightError("qa.intake.window", `${flag} takes a date (2026-11-01 or an ISO time) or a message id, not "${value}".`);
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
  opts.out(`  ${(0, import_node_path12.relative)(opts.cwd, recordDir(opts.cwd, issue.id))}/issue.md`);
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
  opts.out(`proposed ${groups.length} groups: ${(0, import_node_path12.relative)(opts.cwd, file)}`);
  opts.out(`review it, write groups.json beside it, then run: lw qa intake telegram --chat ${chat} --apply`);
  return 0;
}
async function list(args, opts) {
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
        if (sub === "list") return await list(rest, opts);
      } catch (error) {
        if (!(error instanceof LaunchwrightError)) throw error;
        opts.err(`lw qa intake: ${error.message} (${error.code})`);
        return 1;
      }
      return usage(opts, sub === void 0 || sub === "--help" || sub === "-h" ? void 0 : `unknown subcommand ${sub}`);
    }
  };
}
var import_node_path12, USAGE, TELEGRAM_DRIVERS, TELEGRAM_VALUES, qa_intake_default;
var init_qa_intake = __esm({
  "src/intake/commands/qa-intake.mts"() {
    "use strict";
    import_node_path12 = require("path");
    init_kernel();
    init_args();
    init_src();
    init_config2();
    init_registry();
    init_telegram();
    USAGE = [
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
init_config2();
init_contract();
init_fake();
init_links();
init_media();
init_src();

// src/intake/provider.mts
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
var qaExtension = {
  name: "qa-intake",
  subcommands: { intake: async () => (await Promise.resolve().then(() => (init_qa_intake(), qa_intake_exports))).default }
};

// src/intake/index.mts
init_registry();
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