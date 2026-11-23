import {
  AndroidSession,
  DEFAULT_RUN_TIMEOUT_MS,
  NO_TIMEOUT,
  PhoneSession,
  ROUTE_EXPRESSION,
  SimulatorSession,
  androidDeviceKeys,
  androidHandle,
  asyncScript,
  avdExists,
  browserstackConfig,
  capabilities,
  capabilityError,
  checkBudget,
  closedError,
  cloudDeviceKeys,
  collectDoctor,
  consoleLogKind,
  createBrowserstackClient,
  createDeviceContext,
  deviceAccess,
  deviceConfig,
  deviceKeys,
  deviceKind,
  deviceKindNames,
  deviceState,
  deviceToolsConfig,
  emulatorDeviceKeys,
  formatDoctor,
  hostProxyConfig,
  iosDevice,
  iosDeviceKeys,
  pageAct,
  poll,
  pollSettle,
  qaConfigOf,
  qaDeviceConfig,
  registerDeviceKind,
  relativeRoute,
  resolveDevice,
  rigConfig,
  routeUrl,
  simulatorDeviceKeys,
  simulatorReadiness,
  stateFix,
  systemDeviceDeps,
  telegramDeviceConfig,
  waitAct,
  withDevice,
  writeBytes,
  writeHeld,
  writePng
} from "./chunk-33RJBPBQ.js";
import "./chunk-O3J34U3W.js";
import "./chunk-GGUEIQQB.js";
import {
  QA_TARGETS
} from "./chunk-6UL6IQTR.js";
import "./chunk-SKL7TLL4.js";
import "./chunk-37DKYQMH.js";
import "./chunk-SYG32WE6.js";
import "./chunk-44UCVQJF.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import "./chunk-NDATEPNB.js";
import "./chunk-OMN5Y4OA.js";
import "./chunk-J5LVC3SI.js";
import "./chunk-TXE76FC7.js";
import "./chunk-L6Q4YNOC.js";
import "./chunk-ZJ35OYFC.js";
import "./chunk-CNY6SOD7.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-7OHVK72J.js";
import "./chunk-5KDQJ25J.js";
import "./chunk-SQO6FPZ2.js";
import "./chunk-NYZ72SDM.js";
import "./chunk-AA7FPMJ7.js";
import "./chunk-LBZC23FE.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-O5NSNELG.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-ZXEFVZDQ.js";
import {
  QA_TARGET_SPEC_VERSION
} from "./chunk-K3P52YYY.js";
import "./chunk-XZN5EDSR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-H3DGWSMZ.js";
import "./chunk-SA2YN55L.js";
import "./chunk-GZ2IEQDP.js";
import {
  CONFIG,
  provider
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

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
function createAndroidEmulatorTarget(ctx) {
  return new AndroidTarget("android-emulator", ctx, true);
}

// src/device/services/cloud-session.mts
function isMp4(bytes) {
  return bytes.subarray(4, 8).toString("latin1") === "ftyp";
}
var CloudSession = class _CloudSession {
  constructor(ctx, opts, client, kind, keys, device, budget, target) {
    this.ctx = ctx;
    this.opts = opts;
    this.client = client;
    this.kind = kind;
    this.keys = keys;
    this.device = device;
    this.budget = budget;
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
  static async open(ctx, opts, budget, target) {
    const resolved = resolveDevice(ctx.config, opts.leg.device);
    if (deviceKind(resolved.device.kind).access !== "webdriver") {
      throw new LaunchwrightError("qa.device.kind", `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives a cloud phone over WebDriver.`);
    }
    const keys = deviceKeys(resolved.name, resolved.device, cloudDeviceKeys);
    const client = createBrowserstackClient(ctx.config.device.browserstack, ctx.deps);
    const session = new _CloudSession(ctx, opts, client, resolved.device.kind, keys, resolved.name, budget, target);
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
    const { url } = routeUrl(this.opts.baseUrl, route);
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
    return relativeRoute(this.opts.baseUrl, String(await this.evaluate(ROUTE_EXPRESSION)));
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
    if (deviceKind(this.kind).console !== true) throw capabilityError(this.target, "webview", `read the page console of ${this.kind} (its WebDriver session has none)`);
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
};
function createBrowserstackTarget(ctx) {
  return new BrowserstackTarget(ctx);
}

// src/device/drivers/target/ios-simulator.mts
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

// src/device/services/extension.mts
var qaExtension = {
  name: "qa-device",
  subcommands: { device: async () => (await import("./qa-device-FQ64RBCM.js")).default },
  targets: (config, root) => deviceTargets(withDevice(config), systemDeviceDeps(root))
};
export {
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
};
//# sourceMappingURL=device.js.map