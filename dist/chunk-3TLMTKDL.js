import {
  encodePng
} from "./chunk-XZN5EDSR.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/drivers/target/contract.mts
var QA_TARGET_SPEC_VERSION = "1";
var QA_TARGET_CAPABILITIES = ["input", "screenshot", "video", "webview", "native", "telegram"];

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

export {
  QA_TARGET_SPEC_VERSION,
  QA_TARGET_CAPABILITIES,
  FAKE_CLIP,
  createFakeTarget
};
//# sourceMappingURL=chunk-3TLMTKDL.js.map