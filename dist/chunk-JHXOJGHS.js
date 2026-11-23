import {
  sha256
} from "./chunk-6LHTNS5B.js";
import {
  systemClock
} from "./chunk-WUOHAWEI.js";
import {
  LaunchwrightError
} from "./chunk-L57WEOVE.js";

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION = "1";
var QA_TARGET_CAPABILITIES = ["input", "screenshot", "video", "webview", "native", "telegram"];

// src/services/png.mts
import { deflateSync, inflateSync } from "zlib";
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
  return Buffer.concat([Buffer.from(MAGIC), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
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

// src/drivers/target/fake.mts
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
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
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
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

// src/services/video.mts
import { execFile } from "child_process";
var MIN_VIDEO_S = 1;

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
function mimeOfExtension(name) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === void 0) return null;
  if (ext === "jpeg") return "image/jpeg";
  return Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] ?? null;
}

// src/services/types.mts
var ACT_KINDS = ["click", "type", "press", "scroll", "wait", "back"];
var ROW_FAILURES = ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error", "expect", "crashed"];
var REPORT_STATUSES = ["planned", "passed", "failed", "partial"];
var INTAKE_DIR = ".lw/qa/intake";

// src/services/records.mts
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
var ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
function recordId(...parts) {
  return parts.map((p) => String(p).replace(/^@/, "").replace(/[^A-Za-z0-9_.-]+/g, "-")).join("-");
}
function recordDir(root, id) {
  if (!ID.test(id) || id.includes("..")) throw new LaunchwrightError("qa.intake.id", `The intake id "${id}" has a character outside A-Z, a-z, 0-9, _, . and -.`, { context: { id } });
  return join(root, INTAKE_DIR, id);
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
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, "assets"), { recursive: true });
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
    await writeFile(join(dir, path), m.data);
    issue.attachments.push({
      kind: m.kind,
      path,
      sha256: sha256(m.data),
      bytes: m.data.byteLength,
      mime: m.mime,
      from: m.from
    });
  }
  await writeFile(join(dir, "issue.json"), `${JSON.stringify(issue, null, 2)}
`);
  await writeFile(join(dir, "issue.md"), issueMarkdown(issue));
  return issue;
}
async function readIssue(root, id) {
  const file = join(recordDir(root, id), "issue.json");
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.intake.missing", `No intake record ${id}. Run lw qa intake list.`, { cause, context: { id } });
  }
  return JSON.parse(text);
}
async function listIssues(root) {
  const base = join(root, INTAKE_DIR);
  let names;
  try {
    names = (await readdir(base, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.intake.read", `Cannot read ${INTAKE_DIR}.`, { cause });
  }
  const out = [];
  for (const name of names.sort()) {
    let text;
    try {
      text = await readFile(join(base, name, "issue.json"), "utf8");
    } catch (cause) {
      if (cause.code === "ENOENT") continue;
      throw new LaunchwrightError("qa.intake.read", `Cannot read the intake record ${name}.`, { cause });
    }
    out.push(JSON.parse(text));
  }
  return out;
}

// src/services/score.mts
var DEFAULT_SCORE_WEIGHTS = {
  findings: 0.35,
  console: 0.1,
  coverage: 0.15,
  evidence: 0.1,
  accessibility: 0.15,
  performance: 0.15
};
var SEVERITY_DEDUCTION = { critical: 25, high: 15, medium: 8, low: 3 };
var clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
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
var percentScore = (fraction) => Math.round(clamp(fraction, 0, 1) * 100);
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
var NEUTRAL_RING = "#64748b";
var NEUTRAL_TRACK = "#e2e8f0";
var attr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var content = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function renderScoreGauge(score, opts = {}) {
  const size = opts.size ?? 160;
  const value = clamp(Math.round(score), 0, 100);
  const ring = attr(opts.color ?? NEUTRAL_RING);
  const track = attr(opts.track ?? NEUTRAL_TRACK);
  const stroke = Math.max(2, Math.round(size * 0.09));
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value / 100 * circumference;
  const numberSize = Math.round(size * 0.3);
  const font = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const numberY = opts.label ? center - numberSize * 0.12 : center;
  const label = opts.label ? `<text x="${center}" y="${center + numberSize * 0.72}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${Math.round(size * 0.1)}" fill="${track}">${content(opts.label)}</text>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QA score ${value} of 100">`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${track}" stroke-width="${stroke}"/>`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${ring}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${filled.toFixed(3)} ${(circumference - filled).toFixed(3)}" transform="rotate(-90 ${center} ${center})"/>`,
    `<text x="${center}" y="${numberY}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${numberSize}" font-weight="700" fill="${ring}">${value}</text>`,
    label,
    "</svg>"
  ].join("");
}

// src/services/manifest.mts
import { readFile as readFile2 } from "fs/promises";

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

export {
  QA_TARGET_SPEC_VERSION,
  QA_TARGET_CAPABILITIES,
  pngSize,
  encodePng,
  FAKE_CLIP,
  createFakeTarget,
  MIN_VIDEO_S,
  extensionOf,
  mimeOfExtension,
  ACT_KINDS,
  ROW_FAILURES,
  REPORT_STATUSES,
  INTAKE_DIR,
  recordId,
  recordDir,
  issueMarkdown,
  writeIssue,
  readIssue,
  listIssues,
  validateManifest,
  expectText,
  evidencePath,
  DEFAULT_SCORE_WEIGHTS,
  SEVERITY_DEDUCTION,
  computeScore,
  renderScoreGauge
};
//# sourceMappingURL=chunk-JHXOJGHS.js.map