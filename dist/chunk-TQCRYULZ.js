import {
  ACT_KINDS
} from "./chunk-SA2YN55L.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

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

// src/services/manifest.mts
import { readFile } from "fs/promises";
var SHOT_FIELDS = ["id", "screen", "state", "source", "legs", "route", "fixture", "settle", "expect"];
var ACT_FIELDS = /* @__PURE__ */ new Set(["kind", "target", "text", "key", "dx", "dy", "ms", "why"]);
var SETTLE_RULES = ["selector", "artwork", "video", "busy"];
var SOURCE_RE = /^(?:spec:[^\s#]+#[A-Za-z0-9._-]+|commit:[0-9a-f]{7,40}|issue:[A-Za-z0-9._-]+)$/;
var KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FACT_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isText = (v) => typeof v === "string" && v.trim() !== "";
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
function checkFixture(at, fixture, errors) {
  if (!isObject(fixture)) {
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
    raw = await readFile(path, "utf8");
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

export {
  legDefinitions,
  KEBAB,
  validateManifest,
  loadManifest,
  expectText,
  expectedPageErrors,
  evidencePath
};
//# sourceMappingURL=chunk-TQCRYULZ.js.map