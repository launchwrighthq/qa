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

// src/states/index.mts
var states_exports = {};
__export(states_exports, {
  ABSENT: () => ABSENT,
  CaptureFailure: () => CaptureFailure,
  DEFAULT_DELIVERY_FILE: () => DEFAULT_DELIVERY_FILE,
  DEFAULT_MOUNTS_FILE: () => DEFAULT_MOUNTS_FILE,
  FAIL_REASONS: () => FAIL_REASONS,
  IGNORE_TAG: () => IGNORE_TAG,
  KINDS: () => KINDS,
  MAX_CANDIDATES: () => MAX_CANDIDATES,
  NULL_STATE: () => NULL_STATE,
  PERSONA_LAUNCH_ROUTE: () => PERSONA_LAUNCH_ROUTE,
  PROVENANCE: () => PROVENANCE,
  STATES_FILE: () => STATES_FILE,
  STATES_HARNESS_PATH: () => STATES_HARNESS_PATH,
  STATE_SUFFIXES: () => STATE_SUFFIXES,
  analyzeSources: () => analyzeSources,
  anchorSubjects: () => anchorSubjects,
  attachRoutes: () => attachRoutes,
  buildPlan: () => buildPlan,
  buildRouteMap: () => buildRouteMap,
  c1Findings: () => c1Findings,
  c4Findings: () => c4Findings,
  candidatePlan: () => candidatePlan,
  candidates: () => candidates,
  captureGroup: () => captureGroup,
  captureMounted: () => captureMounted,
  describeCandidate: () => describeCandidate,
  failedResult: () => failedResult,
  fieldValues: () => fieldValues,
  finishRun: () => finishRun,
  groupsFor: () => groupsFor,
  installSubstitution: () => installSubstitution,
  isProductSource: () => isProductSource,
  isStateUnionName: () => isStateUnionName,
  issueFor: () => issueFor,
  kindFor: () => kindFor,
  locateSubjects: () => locateSubjects,
  mechanismFor: () => mechanismFor,
  mergeDelivery: () => mergeDelivery,
  mountUrl: () => mountUrl,
  neitherUnions: () => neitherUnions,
  normaliseTables: () => normaliseTables,
  onSession: () => onSession,
  parseInventory: () => parseInventory,
  parseResults: () => parseResults,
  plannedCaptures: () => plannedCaptures,
  readAliases: () => readAliases,
  readTree: () => readTree,
  renderReport: () => renderReport,
  renderRouteSummary: () => renderRouteSummary,
  resolveMount: () => resolveMount,
  scanProject: () => scanProject,
  scanStates: () => scanStates,
  sessionPool: () => sessionPool,
  solve: () => solve,
  stateFindings: () => stateFindings,
  unreachable: () => unreachable,
  validateInventory: () => validateInventory,
  validateShape: () => validateShape,
  withDescriptors: () => withDescriptors
});
module.exports = __toCommonJS(states_exports);

// src/states/services/inventory.mts
var STATE_SUFFIXES = ["State", "Mark", "Status", "Kind", "Phase", "Variant"];
function isStateUnionName(name) {
  return STATE_SUFFIXES.some((s) => name.endsWith(s) && name.length > s.length);
}
var KINDS = ["input", "output", "both", "neither"];
var IGNORE_TAG = "qa-states";
var PROVENANCE = ["live", "intercepted", "mounted", "forged"];
var FAIL_REASONS = [
  "unreachable",
  "identical",
  "state-mismatch",
  "unmountable",
  "no-mechanism",
  "blocked",
  "not-run",
  "crashed"
];
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
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

// src/states/services/solve.mts
var MAX_CANDIDATES = 500;
var FIELD_KINDS = ["boolean", "number", "string", "enum", "nullable", "opaque"];
var ABSENT = /* @__PURE__ */ Symbol.for("lw.qa.solve.absent");
var NULL_STATE = "null";
var DEFAULT_STRING = "qa";
var isPlainObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var same = (a, b) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
function canonical(obj) {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(obj).sort().map((k) => [k, obj[k]])
    )
  );
}
var show = (v) => v === ABSENT ? "(absent)" : typeof v === "string" ? JSON.stringify(v) : String(v);
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
    const list = fieldValues(field, options);
    if (list.length > 0) values.set(name, list);
  }
  const names = [...values.keys()];
  const valuesOf = (name) => values.get(name) ?? [];
  const plan = [];
  const seen = /* @__PURE__ */ new Set();
  const full = () => plan.length >= limit;
  const add = (candidate, base, baseIndex) => {
    const key = canonical(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    const { changes, text } = describeCandidate(candidate, base);
    plan.push({ candidate, base, baseIndex, changes, text });
  };
  for (const [i, base] of corpus.entries()) {
    if (full()) break;
    add({ ...base }, base, i);
  }
  for (const [i, base] of corpus.entries()) {
    for (const name of names) {
      for (const value of valuesOf(name)) {
        if (full()) return plan;
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
            if (full()) return plan;
            add(mutate(base, [[first, x], [second, y]]), base, i);
          }
        }
      }
    }
  }
  return plan;
}
function candidates(shape, corpus, options = {}) {
  return candidatePlan(shape, corpus, options).map((step) => step.candidate);
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
  const plan = candidatePlan(shape, corpus, { ...limit === void 0 ? {} : { limit }, ...pivots === void 0 ? {} : { pivots } });
  const wanted = members === null ? null : new Set(members);
  const covered = {};
  const order = [];
  let tried = 0;
  let hits = 0;
  for (const step of plan) {
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
    planned: plan.length,
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

// src/states/services/scan.mts
var import_node_fs4 = require("fs");
var import_node_path4 = require("path");
var import_typescript = __toESM(require("typescript"), 1);
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
var NO_TYPES = { fileOf: () => null, declOf: () => null };
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
var KEYWORD_KINDS = /* @__PURE__ */ new Map([
  [import_typescript.default.SyntaxKind.BooleanKeyword, "boolean"],
  [import_typescript.default.SyntaxKind.NumberKeyword, "number"],
  [import_typescript.default.SyntaxKind.StringKeyword, "string"]
]);
var MAX_TYPE_HOPS = 6;
var NEGATIVE = /* @__PURE__ */ new Set([import_typescript.default.SyntaxKind.MinusToken]);
function literalValue(node) {
  if (import_typescript.default.isStringLiteral(node)) return node.text;
  if (import_typescript.default.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === import_typescript.default.SyntaxKind.TrueKeyword) return true;
  if (node.kind === import_typescript.default.SyntaxKind.FalseKeyword) return false;
  if (import_typescript.default.isPrefixUnaryExpression(node) && NEGATIVE.has(node.operator) && import_typescript.default.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  return void 0;
}
function fieldFor(typeNode, resolve2, hops = 0) {
  if (!typeNode) return { kind: "opaque" };
  const keyword = KEYWORD_KINDS.get(typeNode.kind);
  if (keyword) return { kind: keyword };
  if (import_typescript.default.isUnionTypeNode(typeNode)) {
    const present = typeNode.types.filter((t) => !isNullish(t));
    const nullable = present.length !== typeNode.types.length;
    const inner = unionField(present, resolve2, hops);
    if (!inner) return { kind: "opaque" };
    return nullable ? { kind: "nullable", of: inner } : inner;
  }
  if (import_typescript.default.isTypeReferenceNode(typeNode) && hops < MAX_TYPE_HOPS) {
    const name = referencedName(typeNode);
    const aliased = name ? resolve2(name) : null;
    if (aliased) return fieldFor(aliased, resolve2, hops + 1);
  }
  return { kind: "opaque" };
}
function unionField(present, resolve2, hops) {
  if (present.length === 0) return null;
  if (present.length === 1) {
    const only = fieldFor(present[0], resolve2, hops);
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
var RELATIONAL = /* @__PURE__ */ new Set([
  import_typescript.default.SyntaxKind.LessThanToken,
  import_typescript.default.SyntaxKind.LessThanEqualsToken,
  import_typescript.default.SyntaxKind.GreaterThanToken,
  import_typescript.default.SyntaxKind.GreaterThanEqualsToken
]);
var EQUALITY = /* @__PURE__ */ new Set([
  import_typescript.default.SyntaxKind.EqualsEqualsEqualsToken,
  import_typescript.default.SyntaxKind.ExclamationEqualsEqualsToken,
  import_typescript.default.SyntaxKind.EqualsEqualsToken,
  import_typescript.default.SyntaxKind.ExclamationEqualsToken
]);
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
  const candidates2 = [];
  const inputs = [];
  const outputs = [];
  for (const { file, sf } of parsed) {
    for (const { name, of } of findTypeComposition(sf)) composedOf.set(name, [...composedOf.get(name) ?? [], ...of]);
    candidates2.push(...findComponentCandidates(sf, file));
    inputs.push(...findInputSites(sf, file, names));
    outputs.push(...findOutputSites(sf, file, names, resolver, problems));
  }
  candidates2.sort((a, b) => a.componentFile.localeCompare(b.componentFile) || a.component.localeCompare(b.component));
  const componentFor = (holder) => candidates2.find((c) => c.propsType === holder || partsOf(c.propsType, composedOf).has(holder)) ?? null;
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
  const absolute = (0, import_node_path4.join)(projectRoot2, dir);
  if (!(0, import_node_fs4.statSync)(absolute, { throwIfNoEntry: false })?.isDirectory()) {
    throw new LaunchwrightError("qa.states.root", `${dir} is not a folder under ${projectRoot2}. Check qa.clientRoots and qa.typeRoots.`, { context: { dir } });
  }
  const files = [];
  const visit = (at) => {
    for (const entry of (0, import_node_fs4.readdirSync)(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = (0, import_node_path4.join)(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") visit(child);
        continue;
      }
      const rel = (0, import_node_path4.relative)(projectRoot2, child).split(/[\\/]/).join("/");
      if (isProductSource(rel)) files.push({ file: rel, text: (0, import_node_fs4.readFileSync)(child, "utf8") });
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

// src/states/services/delivery.mts
var import_node_path5 = require("path");
var import_typescript2 = __toESM(require("typescript"), 1);
function normaliseTables(entries) {
  return entries.map((entry) => typeof entry === "string" ? { file: entry, surface: "web" } : entry);
}
var MAX_HOPS = 4;
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
var CANDIDATES = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx", "/index.mts"];
function resolveSpecifier(fromFile, specifier, files, aliases = {}) {
  let base = null;
  if (specifier.startsWith(".")) base = import_node_path5.posix.normalize(import_node_path5.posix.join(import_node_path5.posix.dirname(fromFile), specifier));
  else {
    for (const alias of Object.keys(aliases).sort((a, b) => b.length - a.length)) {
      const dir = aliases[alias];
      if (specifier === alias) base = dir;
      else if (specifier.startsWith(`${alias}/`)) base = import_node_path5.posix.normalize(`${dir}${specifier.slice(alias.length)}`);
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
  const named = /* @__PURE__ */ new Map();
  const star = [];
  for (const statement of sf.statements) {
    if (import_typescript2.default.isImportDeclaration(statement) && statement.importClause && import_typescript2.default.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause.name) named.set(clause.name.text, { specifier, name: "default" });
      if (clause.namedBindings && import_typescript2.default.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) named.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
    if (import_typescript2.default.isExportDeclaration(statement) && statement.moduleSpecifier && import_typescript2.default.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (!statement.exportClause) star.push(specifier);
      else if (import_typescript2.default.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) named.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
  }
  return { named, star };
}
function moduleScopes(parsed, resolve2) {
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
          const target = resolve2(file, link.specifier);
          const targetScope = target === null ? null : scopeOf(target);
          return targetScope ? { scope: targetScope, name: link.name } : null;
        }
        for (const specifier of links.star) {
          const target = resolve2(file, specifier);
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
  const push = (pathNode, component, pageName, prefix, at = scope) => {
    const raw = evaluatePath(pathNode, at, 0, env);
    if (raw === "*") return;
    const path = raw === null ? null : joinPath(prefix, raw);
    rows.push({ path, component, pageName, source: pathNode ? pathNode.getText(pathNode.getSourceFile()) : "<no path>", dynamic: path === null ? false : isDynamicPath(path) });
  };
  const visit = (node) => {
    if (import_typescript2.default.isCallExpression(node) && import_typescript2.default.isPropertyAccessExpression(node.expression) && node.expression.name.text === "page" && node.arguments.length >= 2) {
      const [pathNode, nameNode] = node.arguments;
      const pageName = nameNode && (import_typescript2.default.isStringLiteral(nameNode) || import_typescript2.default.isNoSubstitutionTemplateLiteral(nameNode)) ? nameNode.text : null;
      push(pathNode ?? null, null, pageName, groupPrefix(node, scope, env));
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
function componentPages(component, sf, resolve2, seen = /* @__PURE__ */ new Set(), depth = 0) {
  if (component === null || seen.has(component) || depth > MAX_HOPS) return [];
  seen.add(component);
  const imports = importedNames(sf);
  const specifier = imports.get(component);
  if (specifier !== void 0) {
    const file = resolve2(specifier);
    return file === null ? [] : [file];
  }
  const locals = localDeclarations(sf);
  const declaration = locals.get(component);
  if (!declaration) return [];
  const pages = [];
  for (const name of /* @__PURE__ */ new Set([...jsxTagsIn(declaration), ...localCalleesIn(declaration, locals)])) {
    if (name === component) continue;
    pages.push(...componentPages(name, sf, resolve2, seen, depth + 1));
  }
  return [...new Set(pages)];
}
var PAGE_SUFFIXES = [".page.tsx", ".page.ts", ".page.mts", ".page.jsx"];
function pageFileFor(pageName, pageRoots, files) {
  for (const root of pageRoots) {
    for (const suffix of PAGE_SUFFIXES) {
      const candidate = import_node_path5.posix.join(root, "pages", `${pageName}${suffix}`);
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
    const resolve2 = (specifier) => resolveSpecifier(table.file, specifier, files, aliases);
    const routes = routeRows(sf, scopeOf(table.file) ?? fileScope(sf), { wrappers: input.wrappers ?? {} }).map((row) => ({
      path: row.path,
      dynamic: row.dynamic,
      source: row.source,
      pages: row.pageName !== null ? [pageFileFor(row.pageName, input.pageRoots, files)].filter((f) => f !== null) : componentPages(row.component, sf, resolve2)
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
  const base = import_node_path5.posix.join(dir, options?.baseUrl ?? ".");
  const out = {};
  for (const [key, targets] of Object.entries(options?.paths ?? {})) {
    const [target] = targets;
    if (target === void 0) continue;
    const alias = key.replace(/\/\*$/, "");
    out[alias] = import_node_path5.posix.normalize(import_node_path5.posix.join(base, target.replace(/\/\*$/, "")));
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

// src/states/services/project.mts
var import_node_fs5 = require("fs");
var import_node_path6 = require("path");
var STATES_FILE = ".lw/qa/states.json";
var TSCONFIG_NAMES = ["tsconfig.json", "tsconfig.app.json"];
function readAliases(projectRoot2, clientRoots) {
  const aliases = {};
  for (const root of clientRoots) {
    for (const dir of [root, import_node_path6.posix.dirname(root)]) {
      for (const name of TSCONFIG_NAMES) {
        const path = (0, import_node_path6.join)(projectRoot2, dir, name);
        if (!(0, import_node_fs5.existsSync)(path)) continue;
        for (const [alias, target] of Object.entries(aliasesFromTsconfig((0, import_node_fs5.readFileSync)(path, "utf8"), dir))) aliases[alias] ??= target;
      }
    }
  }
  return aliases;
}
function scanStates(projectRoot2, config, generated) {
  const scanned = scanProject(projectRoot2, { clientRoots: config.clientRoots, typeRoots: config.typeRoots, generated });
  const tables = normaliseTables(config.routeTables);
  const known = new Set(scanned.sources.map((s) => s.file));
  const tableSources = tables.filter((t) => !known.has(t.file) && (0, import_node_fs5.existsSync)((0, import_node_path6.join)(projectRoot2, t.file))).map((t) => ({ file: t.file, text: (0, import_node_fs5.readFileSync)((0, import_node_path6.join)(projectRoot2, t.file), "utf8") }));
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

// src/states/services/loop.mts
var SENTENCES = {
  unreachable: "no candidate input produced this member",
  identical: "the DOM diff between two members is empty",
  "state-mismatch": "the feature's own function disagreed after injection",
  unmountable: "the harness could not mount the component",
  "no-mechanism": "the union is neither an input nor an output, so nothing can reach it",
  blocked: "the run could not build a capture group the runner would accept",
  "not-run": "the mechanism was not run",
  crashed: "the capture failed, and the runner reported only a sentence"
};
var UNREPORTED = "the runner exited without reporting this capture";
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
      const shot = row.ok ? [row.subject ? `![${cell(row.id)}](${row.subject})` : "shot, but no path reported", label].filter(Boolean).join(" ") : "not shot";
      const expect = row.ok ? cell(row.expect ?? "-") : cell(refusalFor(row));
      out.push(`| ${stateCell(union, row)} | ${shot} | ${expect || "-"} | ${verifiedCell(row)} |`);
    }
    out.push("");
  }
  const orphans = rows.filter((row) => row.extra && !unionOf(inventory, row.id));
  if (orphans.length > 0) {
    out.push("### Reported by the runner, and in no union of the inventory");
    out.push("");
    for (const row of orphans) out.push(`- \`${cell(row.id)}\` (${row.ok ? "ok" : "failed"})`);
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
  const { plan, attempts, malformed = [], notRun = {}, blocked = {} } = args;
  const rows = mergeRows(plan.captures, attempts, { notRun, blocked });
  const lines = [renderReport({ inventory: plan.inventory, rows, slug: plan.slug, narrowedBy: plan.narrowedBy, notRun })];
  for (const line of malformed) lines.push(`malformed result line, not read: ${line}`);
  const refusals = refusalLines(plan.inventory, rows);
  if (refusals.length > 0) {
    lines.push("", `REFUSED   ${refusals.length}, and each one is a failure:`);
    for (const line of refusals) lines.push(`  ${line}`);
  }
  const neither = renderNeither(plan.inventory);
  lines.push(...neither);
  const notRunCount = Object.keys(notRun).length;
  const failed = rows.filter((row) => !row.ok).length;
  const refused = neitherUnions(plan.inventory).length;
  lines.push("");
  if (failed === 0 && refused === 0 && notRunCount === 0) lines.push("every planned rendering was captured.");
  else lines.push(`${failed} rendering(s) uncovered, ${refused} union(s) refused, ${notRunCount} mechanism(s) not run.`);
  return { lines, code: failed > 0 || refused > 0 || notRunCount > 0 ? 1 : 0, rows };
}

// src/states/services/mount.mts
var import_node_path8 = require("path");

// src/states-host/names.mts
var QA_STATES_PATH = "/__states";
var QA_STATES_ATTRIBUTE = "data-qa-states";

// src/states/services/capture.mts
var import_node_path7 = require("path");

// src/services/overlays.mts
var CONTROL_SELECTOR = 'button, a, [role="button"], [role="link"], [role="tab"]';
var MAX_LABEL = 60;
var PAGE_HELPERS = `
  const SELECTOR = ${JSON.stringify(CONTROL_SELECTOR)};
  const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim().slice(0, ${MAX_LABEL});
  const shown = (el) => {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) return false;
    const style = getComputedStyle(el);
    return !(style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0');
  };
  const nameOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim();
  const roleOf = (el) => el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button');
  const inView = ([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
  const onScreen = (box) => box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
  const points = (box) => [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([fx, fy]) => [box.left + box.width * fx, box.top + box.height * fy]).filter(inView);
  const isModal = (el) => {
    if (el.getAttribute('aria-modal') === 'true') return true;
    if (el.tagName !== 'DIALOG' || !el.open) return false;
    try {
      return el.matches(':modal');
    } catch (err) {
      return false;
    }
  };
  const modalRoot = () => Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"]')).find((el) => isModal(el) && shown(el)) || null;
  const pressable = (el, modal) => {
    if (!shown(el) || el.closest('[inert], [aria-hidden="true"]')) return false;
    if (modal !== null && !modal.contains(el)) return false;
    const seen = points(el.getBoundingClientRect());
    if (seen.length === 0) return true;
    return seen.some(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && (el.contains(hit) || hit.contains(el));
    });
  };
  const findEntry = (entry) => {
    const modal = modalRoot();
    const pool = entry.selector !== undefined
      ? Array.from(document.querySelectorAll(entry.selector))
      : Array.from(document.querySelectorAll(SELECTOR)).filter((el) => roleOf(el) === entry.role && norm(nameOf(el)) === norm(entry.name));
    return pool.find((el) => pressable(el, modal)) || null;
  };
`;

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

// src/states/services/capture.mts
var MAX_TREE_NODES = 4e4;
var DEFAULT_MAX_SUBJECT_AREA_RATIO = 0.9;
var DEFAULT_DIFF_ROOT = "body";
var MAX_CORPUS = 60;
var MAX_BODIES = 10;
var DEFAULT_EVALUATE_BATCH = 100;
var CaptureFailure = class extends LaunchwrightError {
  reason;
  detail;
  constructor(reason, message, detail = {}, cause) {
    super(`qa.states.${reason}`, message, { ...cause === void 0 ? {} : { cause }, context: { reason, ...detail } });
    this.reason = reason;
    this.detail = detail;
  }
};
function failureFields(e) {
  if (e instanceof CaptureFailure) return { reason: e.reason, ...e.detail };
  return { reason: "crashed" };
}
function errorText(e) {
  return messageOf(e);
}
var isPlainObject3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
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
var STALE_HEADERS = /* @__PURE__ */ new Set(["content-length", "content-encoding", "transfer-encoding"]);
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
      collect(parsed, container);
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
  const out = [];
  const walk2 = (x, y, path) => {
    if (x.self !== y.self || x.children.length !== y.children.length) {
      out.push(path);
      return;
    }
    for (let i = 0; i < x.children.length; i += 1) walk2(x.children[i], y.children[i], [...path, i]);
  };
  walk2(a, b, []);
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
  return `/@fs${import_node_path7.posix.join(projectRoot2.split("\\").join("/"), relativePath)}`;
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
  const plan = candidatePlan(shape, corpus, options);
  const memo = /* @__PURE__ */ new Map();
  let batches = 0;
  for (let i = 0; i < plan.length; i += batchSize) {
    const slice = plan.slice(i, i + batchSize);
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
  return { result, evaluated: plan.length, batches, memoMisses };
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
  const report = await solveWithPage(page, projectRoot2, {
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
    covered: report.result.covered,
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
    const hit = report.result.covered[name];
    if (hit === void 0) {
      subjectFor.push(null);
      const why = report.result.sentence ?? `${group.union}: ${name} was not produced by any candidate`;
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
    report
  };
}
async function renderOnce(session, group, substitution, subjects) {
  if (subjects === null) substitution.record();
  else substitution.use(subjects);
  await session.navigate(openRoute(group.route) ?? group.route);
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
      await session.screenshot(import_node_path7.posix.join(ctx.reportDir, context));
      await subject.screenshot({ path: import_node_path7.posix.join(ctx.reportDir, subjectFile) });
      await ctx.record({ file: import_node_path7.posix.join(ctx.reportDir, context), kind: "screenshot", row: member.id });
      await ctx.record({ file: import_node_path7.posix.join(ctx.reportDir, subjectFile), kind: "screenshot", row: member.id });
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

// src/states/services/mount.mts
var STATES_HARNESS_PATH = QA_STATES_PATH;
var HARNESS_ATTRIBUTE = QA_STATES_ATTRIBUTE;
var SUBJECT_CHILD = "[data-qa-subject] > *";
var HARNESS_ERROR = "[data-qa-states-error]";
var DEFAULT_MOUNT_SETTLE = { selector: SUBJECT_CHILD, timeout: 1e4 };
function mountUrl(options) {
  const query = new URLSearchParams({ c: options.component, props: JSON.stringify(options.props ?? {}) });
  if (options.width !== null && options.width !== void 0) query.set("w", String(options.width));
  return `${STATES_HARNESS_PATH}?${query.toString()}`;
}
var memberKey = (member) => member === null ? "null" : member;
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
var condense = (reason) => reason.length <= 120 ? reason : `${reason.slice(0, 117)}...`;
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
    await session.screenshot(import_node_path8.posix.join(ctx.reportDir, subject));
    await ctx.record({ file: import_node_path8.posix.join(ctx.reportDir, subject), kind: "screenshot", row: r.capture.id });
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

// src/states/services/descriptors.mts
var import_node_fs6 = require("fs");
var import_node_path9 = require("path");

// src/services/manifest.mts
var import_promises2 = require("fs/promises");

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
var KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// src/states/services/descriptors.mts
var DEFAULT_DELIVERY_FILE = ".lw/qa/delivery.json";
var DEFAULT_MOUNTS_FILE = ".lw/qa/mounts.json";
var fixture = import_zod6.z.strictObject({ persona: import_zod6.z.string().regex(KEBAB, "must be a kebab-case persona id").optional() });
var deliverySchema = import_zod6.z.strictObject({
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
  fixture: fixture.optional()
});
var mountSchema = import_zod6.z.strictObject({
  component: import_zod6.z.string().min(1).optional(),
  leg: import_zod6.z.string().min(1).optional(),
  width: import_zod6.z.string().min(1).optional(),
  props: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.unknown()).optional(),
  members: import_zod6.z.record(import_zod6.z.string(), import_zod6.z.record(import_zod6.z.string(), import_zod6.z.unknown())).optional(),
  settle: import_zod6.z.strictObject({ selector: import_zod6.z.string().min(1).optional(), timeout: import_zod6.z.number().int().positive().optional() }).optional(),
  fixture: fixture.optional()
});
var KINDS2 = {
  delivery: { key: "qa.states.delivery", fallback: DEFAULT_DELIVERY_FILE, schema: deliverySchema },
  mounts: { key: "qa.states.mounts", fallback: DEFAULT_MOUNTS_FILE, schema: mountSchema }
};
function issueLines(error) {
  return error.issues.map((issue) => `  ${issue.path.map(String).join(".") || "(file)"}: ${issue.message}`);
}
function readDescriptors(kind, root, config, unions) {
  const { key, fallback, schema } = KINDS2[kind];
  const named = config.states[kind];
  const rel = named ?? fallback;
  const path = (0, import_node_path9.join)(root, rel);
  if (!(0, import_node_fs6.existsSync)(path)) {
    if (named === void 0) return { file: null, entries: {} };
    throw new LaunchwrightError("qa.states.descriptors", `${key} names ${rel}, and the file does not exist.`, { context: { key, file: rel } });
  }
  let parsed;
  try {
    parsed = JSON.parse((0, import_node_fs6.readFileSync)(path, "utf8"));
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

// src/states/services/sessions.mts
var PERSONA_LAUNCH_ROUTE = "/";
function sessionPool(target, base) {
  const held = /* @__PURE__ */ new Map();
  const notes = [];
  const label = (persona) => persona === null ? "no persona" : `persona ${persona}`;
  const dispose = async (session, persona) => {
    try {
      await session.close();
    } catch (err) {
      notes.push(`the lost session of ${label(persona)} did not close: ${messageOf(err).split("\n")[0]}`);
    }
  };
  const lost = (session) => session.isClosed?.() === true;
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
      const session = await target.open({ ...base, ...persona === null ? {} : { persona } });
      if (persona !== null && base.leg.surface === "miniapp") {
        try {
          await session.navigate(PERSONA_LAUNCH_ROUTE);
        } catch (err) {
          await dispose(session, persona);
          throw err;
        }
      }
      held.set(key, session);
      return session;
    },
    async close() {
      const all = [...held.entries()];
      held.clear();
      for (const [key, session] of all) {
        if (lost(session)) await dispose(session, key === "" ? null : key);
        else await session.close();
      }
    }
  };
}
function failedResult(capture, reason, error) {
  return { id: capture.id, union: capture.union, member: capture.member, ok: false, subject: null, context: null, provenance: null, verified: null, error, reason, ms: 0 };
}
var firstLine = (err) => messageOf(err).split("\n")[0] ?? "";
async function onSession(pool, persona, captures, work) {
  let session;
  try {
    session = await pool.get(persona);
  } catch (err) {
    const who = persona === null ? "the session" : `the session of persona ${persona}`;
    return captures.map((c) => failedResult(c, "blocked", `${who} did not open: ${firstLine(err)}`));
  }
  let results;
  try {
    results = await work(session);
  } catch (err) {
    if (!pool.lost(session)) throw err;
    results = captures.map((c) => failedResult(c, "crashed", firstLine(err)));
  }
  if (!pool.lost(session)) return results;
  return results.map((r) => r.ok ? r : { ...r, reason: "crashed", error: `the browser closed during this capture: ${r.error ?? "no reason given"}` });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ABSENT,
  CaptureFailure,
  DEFAULT_DELIVERY_FILE,
  DEFAULT_MOUNTS_FILE,
  FAIL_REASONS,
  IGNORE_TAG,
  KINDS,
  MAX_CANDIDATES,
  NULL_STATE,
  PERSONA_LAUNCH_ROUTE,
  PROVENANCE,
  STATES_FILE,
  STATES_HARNESS_PATH,
  STATE_SUFFIXES,
  analyzeSources,
  anchorSubjects,
  attachRoutes,
  buildPlan,
  buildRouteMap,
  c1Findings,
  c4Findings,
  candidatePlan,
  candidates,
  captureGroup,
  captureMounted,
  describeCandidate,
  failedResult,
  fieldValues,
  finishRun,
  groupsFor,
  installSubstitution,
  isProductSource,
  isStateUnionName,
  issueFor,
  kindFor,
  locateSubjects,
  mechanismFor,
  mergeDelivery,
  mountUrl,
  neitherUnions,
  normaliseTables,
  onSession,
  parseInventory,
  parseResults,
  plannedCaptures,
  readAliases,
  readTree,
  renderReport,
  renderRouteSummary,
  resolveMount,
  scanProject,
  scanStates,
  sessionPool,
  solve,
  stateFindings,
  unreachable,
  validateInventory,
  validateShape,
  withDescriptors
});
//# sourceMappingURL=states.cjs.map