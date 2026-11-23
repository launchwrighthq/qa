import {
  qaConfigOf
} from "./chunk-7OHVK72J.js";
import {
  MIN_VIDEO_S,
  pngSize
} from "./chunk-XZN5EDSR.js";
import {
  readJsonOrNull,
  sha256
} from "./chunk-GZ2IEQDP.js";
import {
  safeEqual,
  systemClock,
  z
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/device/services/device-kinds.mts
var kinds = /* @__PURE__ */ new Map();
function registerDeviceKind(name, kind) {
  kinds.set(name, Object.freeze({ ...kind }));
}
function deviceKindNames() {
  return [...kinds.keys()].sort();
}
function deviceKind(kind) {
  const found = kinds.get(kind);
  if (found === void 0) {
    throw new LaunchwrightError("qa.device.kind", `No device kind ${kind}. Kinds: ${deviceKindNames().join(", ")}. registerDeviceKind adds one.`, { context: { kind } });
  }
  return found;
}
registerDeviceKind("android", { access: "adb", target: "android-adb" });
registerDeviceKind("android-emulator", { access: "adb", target: "android-emulator", emulator: true });
registerDeviceKind("ios", { access: "webkit", target: "ios-webkit" });
registerDeviceKind("ios-simulator", { access: "webkit", target: "ios-simulator", simulator: true });
registerDeviceKind("ios-safari", { access: "webdriver", target: "browserstack", browser: "safari" });
registerDeviceKind("android-chrome", { access: "webdriver", target: "browserstack", browser: "chrome", console: true });

// src/device/config.mts
var hostProxyConfig = z.object({
  /** The address that serves the tunnel hostname, for example the tailnet address of the ingress. */
  upstream: z.string().min(1),
  /** The loopback port of the proxy on the rig, and of `adb reverse` on the device. */
  port: z.number().int().positive().default(8899)
});
var deviceToolsConfig = z.object({
  adb: z.string().min(1).default("adb"),
  ssh: z.string().min(1).default("ssh"),
  scrcpy: z.string().min(1).default("scrcpy"),
  /** The scrcpy version the doctor accepts as the minimum. Older builds fail on Android 15 and later. */
  scrcpyVersion: z.string().regex(/^\d+(\.\d+)*$/).default("3.1"),
  ffmpeg: z.string().min(1).default("ffmpeg")
});
var telegramDeviceConfig = z.object({
  /** The Android package of the Telegram build on the device. */
  package: z.string().min(1).default("org.telegram.messenger.web"),
  /** Where `lw qa device install` fetches the APK. */
  apkUrl: z.string().url().default("https://telegram.org/dl/android/apk"),
  /** The SHA-256 the fetched APK must have. `install` refuses an APK without a pin. */
  apkSha256: z.string().regex(/^[0-9a-f]{64}$/).optional()
});
var browserstackConfig = z.object({
  username: z.string().min(1).optional(),
  accessKey: z.string().min(1).optional(),
  hub: z.string().url().default("https://hub-cloud.browserstack.com/wd/hub"),
  api: z.string().url().default("https://api.browserstack.com/automate"),
  /** The minutes one run may spend. A session past it closes with `qa.device.browserstack.budget`. */
  budgetMinutes: z.number().positive().default(5),
  /** Seconds a session may sit idle before BrowserStack ends it. Its own ceiling is 300. */
  idleTimeoutS: z.number().int().min(1).max(300).default(120),
  project: z.string().min(1).default("launchwright-qa"),
  build: z.string().min(1).default("qa")
});
var rigConfig = z.object({
  transport: z.enum(["local", "ssh", "cloud"]),
  host: z.string().optional(),
  adbPort: z.number().int().positive().optional(),
  webkitPorts: z.array(z.number().int().positive()).optional(),
  ingress: z.enum(["direct", "host-proxy"]).default("direct"),
  /** The proxy target of `ingress: host-proxy`. */
  hostProxy: hostProxyConfig.optional()
});
var deviceConfig = z.object({
  rig: z.string().min(1),
  /** A kind of `registerDeviceKind`: the built-in ones, or one that the project adds. */
  kind: z.string().min(1).refine((kind) => deviceKindNames().includes(kind), "is no registered device kind; registerDeviceKind adds one")
}).passthrough();
var qaDeviceConfig = z.object({
  rigs: z.record(z.string(), rigConfig).prefault({ local: { transport: "local" } }),
  devices: z.record(z.string(), deviceConfig).default({}),
  tools: deviceToolsConfig.prefault({}),
  telegram: telegramDeviceConfig.prefault({}),
  browserstack: browserstackConfig.prefault({})
}).prefault({});
function issuesOf(error) {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
function withDevice(cfg) {
  const parsed = qaDeviceConfig.safeParse(cfg.device);
  if (parsed.success) return { ...cfg, device: parsed.data };
  const issues = issuesOf(parsed.error);
  throw new LaunchwrightError("qa.device.config", `qa.device is not valid: ${issues}.`, { cause: parsed.error });
}
function qaConfigOf2(sections = {}) {
  return withDevice(qaConfigOf(sections));
}
var recorder = z.enum(["screenrecord", "scrcpy"]).default("screenrecord");
var androidDeviceKeys = z.object({
  serial: z.string().min(1),
  recorder,
  /** The browser package for a `web` leg. */
  browserPackage: z.string().min(1).default("com.android.chrome")
});
var emulatorDeviceKeys = z.object({
  /** The AVD name. Letters, digits, `.`, `_` and `-`, as `avdmanager` allows. */
  avd: z.string().regex(/^[\w.-]+$/),
  /** The emulator console port. Even, 5554 to 5682. The serial is `emulator-<port>`. */
  port: z.number().int().min(5554).max(5682).refine((p) => p % 2 === 0, "the console port is even").default(5554),
  gpu: z.string().min(1).default("swiftshader_indirect"),
  recorder,
  browserPackage: z.string().min(1).default("com.android.chrome")
});
var iosDeviceKeys = z.object({
  /** Picks the phone out of the proxy device list. Never printed. */
  udid: z.string().min(1).optional(),
  /** A substring of the page URL or title. Default: the host of the leg base URL. */
  match: z.string().min(1).optional()
});
var simulatorDeviceKeys = z.object({
  /** The simulator UDID. Default: the booted simulator. */
  udid: z.string().min(1).optional(),
  /** The tool that taps on the simulator. `simctl` has no input verb, so the target is not ready without one. */
  inputTool: z.string().min(1).optional(),
  /**
   * The rig port of an `ios_webkit_debug_proxy` that serves the simulator (`-s unix:<webinspectord_sim socket>`).
   * Settle, the route and the logs read the page through it.
   */
  inspectorPort: z.number().int().positive().optional()
});
var cloudDeviceKeys = z.object({
  model: z.string().min(1),
  os: z.string().min(1)
});
function deviceKeys(name, device, schema) {
  const parsed = schema.safeParse(device);
  if (parsed.success) return parsed.data;
  const issues = issuesOf(parsed.error);
  throw new LaunchwrightError("qa.device.config", `qa.device.devices.${name} (kind ${device.kind}) is not valid: ${issues}.`, {
    cause: parsed.error,
    context: { device: name, kind: device.kind }
  });
}

// src/device/services/process.mts
import { spawn } from "child_process";
import { createServer } from "net";
var DEFAULT_RUN_TIMEOUT_MS = 12e4;
var NO_TIMEOUT = "none";
function out(res) {
  return res.stdout.toString("utf8");
}
function said(res) {
  return (res.stderr.trim() || out(res).trim()).slice(0, 600);
}
function orFail(res, code, what, context = {}) {
  if (res.code === 0) return out(res);
  throw new LaunchwrightError(code, `${what} failed (exit ${res.code}): ${said(res) || "no output"}`, { context: { ...context, exit: res.code } });
}
function collect(cmd, args, opts) {
  const child = spawn(cmd, args, {
    stdio: [opts.input === void 0 ? "ignore" : "pipe", "pipe", "pipe"],
    ...opts.env ? { env: { ...process.env, ...opts.env } } : {},
    ...opts.detached ? { detached: true } : {}
  });
  const chunks = [];
  let stderr = "";
  let timer;
  const done = new Promise((resolve) => {
    child.stdout?.on("data", (d) => chunks.push(d));
    child.stderr?.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout: Buffer.concat(chunks), stderr: `${cmd}: ${e.message}` });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? (signal ? 128 : -1), stdout: Buffer.concat(chunks), stderr });
    });
  });
  if (opts.input !== void 0) {
    child.stdin?.on("error", (e) => {
      if (e.code !== "EPIPE") stderr += `stdin: ${e.message}`;
    });
    child.stdin?.end(opts.input);
  }
  if (opts.timeoutMs !== NO_TIMEOUT) {
    timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs);
  }
  return {
    done,
    signal(sig) {
      child.kill(sig);
    }
  };
}
var nodeRunner = {
  run: (cmd, args, opts = {}) => collect(cmd, args, { ...opts, timeoutMs: opts.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS }).done,
  start: (cmd, args, opts) => collect(cmd, args, opts)
};
function freeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}
var globalSocket = (url, opts) => {
  const init = opts?.origin ? { headers: { origin: opts.origin } } : void 0;
  return new WebSocket(url, init);
};
function systemDeviceDeps(root) {
  return {
    root,
    run: nodeRunner,
    socket: globalSocket,
    fetch: (input, init) => fetch(input, init),
    clock: { now: () => systemClock.now(), sleep: (ms) => systemClock.sleep(ms) },
    freePort: freeLoopbackPort
  };
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function poll(clock, probe, opts) {
  const deadline = clock.now() + opts.timeoutMs;
  for (; ; ) {
    const value = await probe();
    if (value !== null) return value;
    if (clock.now() >= deadline) {
      throw new LaunchwrightError(opts.code, `${opts.what} did not happen within ${Math.round(opts.timeoutMs / 1e3)} s.`);
    }
    await clock.sleep(opts.everyMs);
  }
}

// src/device/services/rigs.mts
import { mkdir, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

// src/kernel/services/text.mts
function shq(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

// src/device/services/rigs.mts
var DEVICE_STATE_DIR = ".lw/qa/device";
var RIG_STATE_DIR = ".lw-qa";
var MAX_SOCKET_PATH = 104 - 1 - 17;
var SSH_SOCKET_DIR = ".lw-qa/ssh";
var REMOTE_PATH = 'export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/Library/Android/sdk/platform-tools:$HOME/Android/Sdk/platform-tools:$HOME/Library/Android/sdk/emulator:$HOME/Android/Sdk/emulator"';
var ADB_SERVER_PORT = 5037;
function resolveDevice(config, name) {
  const devices = config.device.devices;
  const names = Object.keys(devices).sort();
  if (!name) {
    if (names.length === 1) return resolveDevice(config, names[0]);
    throw new LaunchwrightError(
      "qa.device.unknown",
      `Name a device with --device. Devices in qa.device.devices: ${names.join(", ") || "none"}.`
    );
  }
  const device = devices[name];
  if (!device) {
    throw new LaunchwrightError("qa.device.unknown", `No device ${name} in qa.device.devices. Devices: ${names.join(", ") || "none"}.`, {
      context: { device: name }
    });
  }
  const rig = config.device.rigs[device.rig];
  if (!rig) {
    const rigs = Object.keys(config.device.rigs).sort().join(", ");
    throw new LaunchwrightError("qa.device.rig.unknown", `Device ${name} names rig ${device.rig}, which qa.device.rigs does not hold. Rigs: ${rigs}.`, {
      context: { device: name, rig: device.rig }
    });
  }
  return { name, device, rigName: device.rig, rig };
}
function controlPath(root, rig, home = homedir()) {
  const id = sha256(`${root}\0${rig}`).slice(0, 16);
  const path = join(home, SSH_SOCKET_DIR, `${id}.sock`);
  if (Buffer.byteLength(path) > MAX_SOCKET_PATH) {
    throw new LaunchwrightError(
      "qa.device.ssh.path",
      `The ssh control socket ${path} is longer than ${MAX_SOCKET_PATH} bytes, and ssh cannot bind it. Run with a shorter HOME.`,
      { context: { rig } }
    );
  }
  return path;
}
function masterArgs(ctl, host) {
  return [
    "-M",
    "-S",
    ctl,
    "-f",
    "-N",
    "-o",
    "BatchMode=yes",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ConnectTimeout=10",
    "-o",
    "ServerAliveInterval=30",
    host
  ];
}
function sshRig(name, config, deps, ssh) {
  const host = config.host;
  if (!host) {
    throw new LaunchwrightError("qa.device.rig.host", `Rig ${name} has transport ssh and no host. Set qa.device.rigs.${name}.host to its ssh alias.`, {
      context: { rig: name }
    });
  }
  const ctl = controlPath(deps.root, name);
  const forwards = /* @__PURE__ */ new Map();
  let opening = null;
  let adbLocal = null;
  async function open() {
    const check = await deps.run.run(ssh, ["-S", ctl, "-O", "check", host]);
    if (check.code === 0) return;
    await mkdir(dirname(ctl), { recursive: true, mode: 448 });
    const res = await deps.run.run(ssh, masterArgs(ctl, host), { timeoutMs: 3e4 });
    if (res.code !== 0) {
      throw new LaunchwrightError(
        "qa.device.ssh",
        `ssh to rig ${name} (${host}) failed: ${said(res) || `exit ${res.code}`}. The rig needs a login without a prompt: BatchMode=yes refuses a password. Run ssh ${host} once by hand to accept the host key, and add your key with ssh-copy-id.`,
        { context: { rig: name, exit: res.code } }
      );
    }
  }
  const rig = {
    name,
    config,
    remote: true,
    stateDir: RIG_STATE_DIR,
    ensure() {
      opening ??= open().catch((err) => {
        opening = null;
        throw err;
      });
      return opening;
    },
    async exec(command, opts) {
      await rig.ensure();
      return deps.run.run(ssh, ["-S", ctl, "-o", "BatchMode=yes", host, `${REMOTE_PATH}; ${command}`], { timeoutMs: 12e4, ...opts });
    },
    async forward(remotePort, localPort) {
      const held = forwards.get(remotePort);
      if (held !== void 0 && (localPort === void 0 || held === localPort)) return held;
      await rig.ensure();
      const local = localPort ?? await deps.freePort();
      const res = await deps.run.run(ssh, ["-S", ctl, "-O", "forward", "-L", `${local}:127.0.0.1:${remotePort}`, host]);
      orFail(res, "qa.device.ssh.forward", `ssh forward :${local} to ${name}:${remotePort}`, { rig: name });
      forwards.set(remotePort, local);
      return local;
    },
    async unforward(remotePort) {
      const local = forwards.get(remotePort);
      if (local === void 0) return;
      forwards.delete(remotePort);
      const res = await deps.run.run(ssh, ["-S", ctl, "-O", "cancel", "-L", `${local}:127.0.0.1:${remotePort}`, host]);
      orFail(res, "qa.device.ssh.forward", `ssh cancel of the forward :${local} to ${name}:${remotePort}`, { rig: name });
    },
    async adbPort() {
      if (adbLocal !== null) return adbLocal;
      if (config.adbPort) {
        await rig.ensure();
        const res = await deps.run.run(ssh, ["-S", ctl, "-O", "forward", "-L", `${config.adbPort}:127.0.0.1:${ADB_SERVER_PORT}`, host]);
        orFail(res, "qa.device.ssh.forward", `ssh forward of the adb server to :${config.adbPort}`, { rig: name });
        forwards.set(ADB_SERVER_PORT, config.adbPort);
        adbLocal = config.adbPort;
      } else {
        adbLocal = await rig.forward(ADB_SERVER_PORT);
      }
      return adbLocal;
    },
    async adbServer() {
      return ["-L", `tcp:127.0.0.1:${await rig.adbPort()}`];
    },
    async writeFile(path, content) {
      const res = await rig.exec(`mkdir -p "$(dirname ${shq(path)})" && cat > ${shq(path)}`, { input: content });
      orFail(res, "qa.device.rig.write", `writing ${path} on rig ${name}`, { rig: name });
    },
    async down() {
      opening = null;
      forwards.clear();
      adbLocal = null;
      const res = await deps.run.run(ssh, ["-S", ctl, "-O", "exit", host]);
      if (res.code !== 0 && !/No such file|Control socket connect/i.test(said(res))) {
        orFail(res, "qa.device.ssh", `closing the ssh master of rig ${name}`, { rig: name });
      }
    }
  };
  return rig;
}
function localRig(name, config, deps) {
  return {
    name,
    config,
    remote: false,
    stateDir: join(deps.root, DEVICE_STATE_DIR),
    ensure: async () => {
    },
    exec: (command, opts) => deps.run.run("sh", ["-c", command], { timeoutMs: 12e4, ...opts }),
    forward: async (remotePort) => remotePort,
    unforward: async () => {
    },
    adbServer: async () => [],
    adbPort: async () => ADB_SERVER_PORT,
    async writeFile(path, content) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    },
    down: async () => {
    }
  };
}
function cloudRig(name, config) {
  const refuse = () => {
    throw new LaunchwrightError("qa.device.rig.cloud", `Rig ${name} is a cloud rig: it has no shell and no ports. Its devices run on the browserstack target.`, {
      context: { rig: name }
    });
  };
  return {
    name,
    config,
    remote: true,
    stateDir: "",
    ensure: async () => {
    },
    exec: async () => refuse(),
    forward: async () => refuse(),
    unforward: async () => refuse(),
    adbServer: async () => refuse(),
    adbPort: async () => refuse(),
    writeFile: async () => refuse(),
    down: async () => {
    }
  };
}
function createDeviceContext(config, deps) {
  return { config, deps, rigs: createRigPool(config, deps) };
}
function createRigPool(config, deps) {
  const rigs = /* @__PURE__ */ new Map();
  return {
    get(name) {
      const held = rigs.get(name);
      if (held) return held;
      const cfg = config.device.rigs[name];
      if (!cfg) {
        throw new LaunchwrightError("qa.device.rig.unknown", `No rig ${name} in qa.device.rigs.`, { context: { rig: name } });
      }
      const rig = cfg.transport === "ssh" ? sshRig(name, cfg, deps, config.device.tools.ssh) : cfg.transport === "cloud" ? cloudRig(name, cfg) : localRig(name, cfg, deps);
      rigs.set(name, rig);
      return rig;
    },
    async downAll() {
      for (const rig of rigs.values()) await rig.down();
    }
  };
}

// src/device/services/adb.mts
function createAdb(rig, serial, deps, bin) {
  const argv = async (args) => [...await rig.adbServer(), "-s", serial, ...args];
  const adb = {
    serial,
    rig,
    async run(args, opts) {
      return deps.run.run(bin, await argv(args), { timeoutMs: opts?.timeoutMs ?? 6e4 });
    },
    async start(args, opts) {
      return deps.run.start(bin, await argv(args), opts);
    },
    async shell(args, code = "qa.device.adb") {
      return orFail(await adb.run(["shell", ...args]), code, `adb -s ${serial} shell ${args.join(" ")}`, { serial });
    }
  };
  return adb;
}
function parseDevices(stdout) {
  return stdout.split("\n").slice(1).map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 2 && p[0]).map(([serial, state]) => ({ serial, state }));
}
async function deviceState(rig, serial, deps, bin) {
  const res = await deps.run.run(bin, [...await rig.adbServer(), "devices"]);
  if (res.code !== 0) {
    throw new LaunchwrightError("qa.device.adb", `adb devices failed (exit ${res.code}): ${said(res)}`, { context: { rig: rig.name } });
  }
  return parseDevices(out(res)).find((d) => d.serial === serial)?.state ?? "absent";
}
function parseKeyguard(text) {
  const block = text.slice(text.indexOf("KeyguardServiceDelegate"));
  if (!/^\s*showing=true\b/m.test(block)) return "open";
  return /^\s*inputRestricted=true\b/m.test(block) ? "credential" : "swipe";
}
async function keyguard(adb) {
  return parseKeyguard(await adb.shell(["dumpsys", "window", "policy"]));
}
function decodeEntities(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function parseNodes(xml) {
  const nodes = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attrs = {};
    for (const a of (m[1] ?? "").matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = decodeEntities(a[2]);
    const b = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attrs.bounds ?? "");
    nodes.push({
      text: attrs.text ?? "",
      desc: attrs["content-desc"] ?? "",
      id: attrs["resource-id"] ?? "",
      cls: attrs.class ?? "",
      clickable: attrs.clickable === "true",
      bounds: b ? { x1: Number(b[1]), y1: Number(b[2]), x2: Number(b[3]), y2: Number(b[4]) } : null
    });
  }
  return nodes;
}
var labelOf = (n) => n.text || n.desc;
function findNode(nodes, needle) {
  return nodes.filter((n) => n.bounds && labelOf(n).includes(needle)).sort((a, b) => labelOf(a).length - labelOf(b).length)[0] ?? null;
}
function parseWmSize(stdout) {
  const over = /Override size:\s*(\d+)x(\d+)/.exec(stdout);
  const phys = /Physical size:\s*(\d+)x(\d+)/.exec(stdout);
  const m = over ?? phys;
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}
var DUMP_PATH = "/sdcard/window_dump.xml";
async function uiDump(adb) {
  const dumped = await adb.run(["shell", "uiautomator", "dump", DUMP_PATH]);
  if (!/dumped to/i.test(`${out(dumped)}${dumped.stderr}`)) return null;
  const read = await adb.run(["shell", "cat", DUMP_PATH]);
  const xml = out(read);
  return read.code === 0 && xml.includes("<hierarchy") ? xml : null;
}
var PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
async function screencap(adb) {
  const res = await adb.run(["exec-out", "screencap", "-p"]);
  if (res.code !== 0) throw new LaunchwrightError("qa.device.screencap", `screencap on ${adb.serial} failed: ${said(res)}`, { context: { serial: adb.serial } });
  if (!res.stdout.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new LaunchwrightError("qa.device.screencap", `screencap on ${adb.serial} returned ${res.stdout.length} bytes that are not a PNG.`, {
      context: { serial: adb.serial }
    });
  }
  return res.stdout;
}
async function tap(adb, x, y) {
  await adb.shell(["input", "tap", String(Math.round(x)), String(Math.round(y))]);
}
async function backGesture(adb, height) {
  const y = String(Math.round(height / 2));
  await adb.shell(["input", "swipe", "2", y, String(Math.round(height / 3)), y, "200"]);
}
async function keyevent(adb, key) {
  await adb.shell(["input", "keyevent", key]);
}
async function wmSize(adb) {
  const text = await adb.shell(["wm", "size"]);
  const size = parseWmSize(text);
  if (!size) throw new LaunchwrightError("qa.device.adb", `wm size on ${adb.serial} printed no size: ${text.trim().slice(0, 120)}`);
  return size;
}
var SCREENRECORD_MAX_S = 180;
var SCREENRECORD_GRACE_S = 30;
function screenrecordCapS(seconds) {
  return Math.min(Math.max(1, Math.round(seconds)), SCREENRECORD_MAX_S);
}
function screenrecordArgs(seconds, remote, size) {
  const capped = screenrecordCapS(seconds);
  return ["shell", "screenrecord", "--time-limit", String(capped), ...size ? ["--size", size] : [], remote];
}
async function startScreenrecord(adb, deps, seconds, label) {
  const remote = `/sdcard/lw-qa-${label.replace(/[^\w.-]/g, "_")}.mp4`;
  await adb.run(["shell", "rm", "-f", remote]);
  const proc = await adb.start(screenrecordArgs(seconds, remote), { timeoutMs: (screenrecordCapS(seconds) + SCREENRECORD_GRACE_S) * 1e3 });
  const startedAt = deps.clock.now();
  return {
    path: remote,
    startedAt,
    async stop() {
      await adb.run(["shell", "pkill", "-INT", "-x", "screenrecord"]);
      await proc.done;
      const pulled = await adb.run(["exec-out", "cat", remote], { timeoutMs: 12e4 });
      if (pulled.code !== 0 || pulled.stdout.length === 0) {
        throw new LaunchwrightError("qa.device.record", `pulling ${remote} from ${adb.serial} failed: ${said(pulled) || "empty file"}`);
      }
      if (pulled.stdout.subarray(4, 8).toString("latin1") !== "ftyp") {
        throw new LaunchwrightError("qa.device.record", `${remote} on ${adb.serial} is not an MP4 (${pulled.stdout.length} bytes).`);
      }
      await adb.run(["shell", "rm", "-f", remote]);
      return pulled.stdout;
    }
  };
}
function devtoolsSockets(text) {
  const byName = /* @__PURE__ */ new Map();
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8 || parts[0] === "Num" || !parts[0].endsWith(":")) continue;
    const raw = parts[7];
    if (!raw.startsWith("@")) continue;
    const name = raw.slice(1);
    if (!/_devtools_remote(_\d+)?$/.test(name)) continue;
    const pid = /_(\d+)$/.exec(name);
    const listening = parts[5] === "01";
    const seen = byName.get(name);
    if (seen) {
      seen.listening ||= listening;
      continue;
    }
    byName.set(name, { name, pid: pid ? Number(pid[1]) : null, kind: name.startsWith("webview_devtools_remote") ? "webview" : "other", listening });
  }
  return [...byName.values()];
}
function processNameFromCmdline(text) {
  return (text.split("\0")[0] ?? "").trim();
}
function processBelongsTo(name, pkg) {
  return name === pkg || name.startsWith(`${pkg}:`);
}
function isBrowserSocket(name, pkg) {
  return name === "chrome_devtools_remote" || name === `${pkg}_devtools_remote`;
}
function chooseSocket(sockets2, pkg) {
  const rank = (s) => s.process === pkg ? 0 : s.process && processBelongsTo(s.process, pkg) ? 1 : s.kind === "webview" ? 2 : 3;
  return [...sockets2].sort((a, b) => rank(a) - rank(b) || (a.pid ?? 0) - (b.pid ?? 0));
}
async function sockets(adb, pkg) {
  const found = devtoolsSockets(await adb.shell(["cat", "/proc/net/unix"]));
  const named = [];
  for (const s of found) {
    let proc = null;
    if (s.pid !== null) {
      const res = await adb.run(["exec-out", "cat", `/proc/${s.pid}/cmdline`]);
      proc = res.code === 0 ? processNameFromCmdline(out(res)) || null : null;
    }
    named.push({ ...s, process: proc });
  }
  return chooseSocket(named, pkg);
}
function parseExistingForward(listing, socketName) {
  const remote = `localabstract:${socketName}`;
  for (const line of listing.split("\n")) {
    const m = /\btcp:(\d+)\s+(\S+)\s*$/.exec(line.trim());
    if (m && m[2] === remote) return Number(m[1]);
  }
  return null;
}
async function forwardSocket(adb, socketName) {
  const list = await adb.run(["forward", "--list"]);
  const held = parseExistingForward(out(list), socketName);
  if (held !== null) return { port: held, reused: true };
  const res = await adb.run(["forward", "tcp:0", `localabstract:${socketName}`]);
  const text = orFail(res, "qa.device.forward", `adb forward of ${socketName}`).trim();
  if (!/^\d+$/.test(text)) {
    throw new LaunchwrightError("qa.device.forward", `adb forward of ${socketName} printed ${JSON.stringify(text)}, which names no port.`);
  }
  return { port: Number(text), reused: false };
}
async function removeForward(adb, port) {
  const res = await adb.run(["forward", "--remove", `tcp:${port}`]);
  orFail(res, "qa.device.forward", `adb forward --remove tcp:${port}`);
}

// src/device/services/android-session.mts
import { basename } from "path";

// src/device/services/page-script.mts
var ROLE_FORM = /^role=([a-zA-Z][a-zA-Z0-9-]*)(?:\[name=(?:"([^"]*)"|'([^']*)'|([^\]]*))\])?$/;
function parseSelector(selector) {
  const s = selector.trim();
  if (!s) throw new LaunchwrightError("qa.device.selector", "A selector is empty.");
  const m = ROLE_FORM.exec(s);
  if (m) return { kind: "role", role: m[1].toLowerCase(), name: m[2] ?? m[3] ?? m[4] ?? "" };
  return { kind: "css", css: s };
}
function resolveSnippet(p) {
  return p.kind === "css" ? `document.querySelector(${JSON.stringify(p.css)})` : `__byRole(${JSON.stringify(p.role)}, ${JSON.stringify(p.name)})`;
}
var IMPLICIT_ROLES = Object.freeze({
  article: "article",
  button: "button, input[type=button], input[type=submit], input[type=reset]",
  checkbox: "input[type=checkbox]",
  combobox: "select",
  dialog: "dialog",
  form: "form[aria-label], form[aria-labelledby]",
  heading: "h1, h2, h3, h4, h5, h6",
  img: 'img[alt]:not([alt=""])',
  link: "a[href]",
  list: "ul, ol",
  listitem: "li",
  main: "main",
  navigation: "nav",
  radio: "input[type=radio]",
  region: "section[aria-label], section[aria-labelledby]",
  table: "table",
  textbox: "input:not([type]), input[type=text], input[type=email], input[type=search], input[type=tel], input[type=url], textarea"
});
var HELPERS = `
  const __label = (el) => String(el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || '').replace(/\\s+/g, ' ').trim();
  const __roles = ${JSON.stringify(IMPLICIT_ROLES)};
  const __byRole = (role, name) => {
    const sel = '[role=' + role + ']' + (__roles[role] ? ', ' + __roles[role] : '');
    const hits = Array.prototype.slice.call(document.querySelectorAll(sel)).filter((el) => !name || __label(el).includes(name));
    hits.sort((a, b) => __label(a).length - __label(b).length);
    return hits[0] || null;
  };
  const __shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const __artwork = () => {
    if (Array.prototype.slice.call(document.images).some((i) => i.complete && i.naturalWidth > 0)) return true;
    return Array.prototype.slice.call(document.querySelectorAll('*')).some((el) => { const bg = getComputedStyle(el).backgroundImage; return bg !== 'none' && bg.includes('url('); });
  };
`;
var iife = (body) => `(() => {${HELPERS}${body}
})()`;
var VISIBILITY_EXPRESSION = "document.visibilityState";
var ROUTE_EXPRESSION = "location.pathname + location.search";
function pushRouteExpression(path) {
  if (!path.startsWith("/")) throw new LaunchwrightError("qa.device.route", `A route starts with /, not ${JSON.stringify(path)}.`);
  return iife(`
  const target = ${JSON.stringify(path)};
  history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  return location.pathname + location.search;`);
}
function hrefExpression(url) {
  return `(() => { location.href = ${JSON.stringify(url)}; return true; })()`;
}
function actExpression(step) {
  switch (step.kind) {
    case "click": {
      const sel = parseSelector(need(step.target, "click", "target"));
      return iife(`
  const el = ${resolveSnippet(sel)};
  if (!el) return { ok: false, error: 'no element for ' + ${JSON.stringify(step.target)} };
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const failed = [];
  const fire = (make) => { try { el.dispatchEvent(make()); } catch (e) { failed.push(String(e && e.message || e)); } };
  const mouse = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0 };
  const pointer = Object.assign({ pointerId: 1, pointerType: 'touch', isPrimary: true }, mouse);
  fire(() => new PointerEvent('pointerdown', pointer));
  fire(() => new MouseEvent('mousedown', mouse));
  fire(() => new PointerEvent('pointerup', pointer));
  fire(() => new MouseEvent('mouseup', mouse));
  fire(() => new MouseEvent('click', mouse));
  return { ok: true, label: __label(el).slice(0, 60), failed };`);
    }
    case "type": {
      const sel = parseSelector(need(step.target, "type", "target"));
      const text = need(step.text, "type", "text");
      return iife(`
  const el = ${resolveSnippet(sel)};
  if (!el) return { ok: false, error: 'no element for ' + ${JSON.stringify(step.target)} };
  el.focus();
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value');
  if (setter && setter.set) setter.set.call(el, ${JSON.stringify(text)}); else el.value = ${JSON.stringify(text)};
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: ${JSON.stringify(text)} }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };`);
    }
    case "press": {
      const key = need(step.key, "press", "key");
      return iife(`
  const target = document.activeElement || document.body;
  const init = { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new KeyboardEvent('keydown', init));
  target.dispatchEvent(new KeyboardEvent('keyup', init));
  if (${JSON.stringify(key)} === 'Enter' && target.form) target.form.requestSubmit();
  return { ok: true };`);
    }
    case "scroll": {
      const dx = step.dx ?? 0;
      const dy = step.dy ?? 0;
      return iife(`
  const all = [document.scrollingElement].concat(Array.prototype.slice.call(document.querySelectorAll('*')));
  const scrollable = all.filter((el) => el && (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4));
  scrollable.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
  const root = scrollable[0];
  if (!root) return { ok: false, error: 'nothing on this page scrolls' };
  root.scrollBy(${dx}, ${dy});
  return { ok: true };`);
    }
    default:
      throw new LaunchwrightError("qa.target.act", `Act ${step.kind} does not run in the page.`);
  }
}
function need(value, kind, field) {
  if (value === void 0 || value === "") throw new LaunchwrightError("qa.target.act", `Act ${kind} needs ${field}.`);
  return value;
}
function settleExpression(rule) {
  const checks = [];
  if (rule.selector) checks.push(`{ name: ${JSON.stringify(`selector ${rule.selector}`)}, ok: __shown(${resolveSnippet(parseSelector(rule.selector))}) }`);
  if (rule.artwork) checks.push(`{ name: 'artwork', ok: __artwork() }`);
  if (rule.video) checks.push(`{ name: 'video', ok: Array.prototype.slice.call(document.querySelectorAll('video')).some((v) => v.readyState >= 2) }`);
  if (rule.busy) checks.push(`{ name: 'busy', ok: document.readyState === 'complete' && !document.querySelector('[aria-busy="true"]') }`);
  if (checks.length !== 1) {
    throw new LaunchwrightError("qa.device.settle", `A settle rule names exactly one of selector, artwork, video, busy; this one names ${checks.length}.`);
  }
  return iife(`
  const checks = [${checks.join(", ")}];
  return { ok: checks.every((c) => c.ok), missing: checks.filter((c) => !c.ok).map((c) => c.name) };`);
}
function chooseVisiblePage(answers) {
  const census = answers.map((p) => `${p.url ?? p.id} (${p.visibility})`).join(", ") || "none";
  const visible = answers.filter((p) => p.visibility === "visible");
  if (visible.length === 1) return visible[0];
  if (visible.length === 0) {
    throw new LaunchwrightError("qa.device.page", `No page is visible: the app is closed or in the background. Pages: ${census}.`);
  }
  throw new LaunchwrightError("qa.device.page", `${visible.length} pages claim to be visible, and nothing can choose between them: ${census}.`);
}
function routeUrl(baseUrl, route) {
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/$/, "");
  const target = new URL(`${basePath}${route.startsWith("/") ? route : `/${route}`}`, base.origin);
  return { url: target.toString(), path: `${target.pathname}${target.search}`, origin: target.origin };
}
function relativeRoute(baseUrl, pageRoute) {
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");
  if (basePath && (pageRoute === basePath || pageRoute.startsWith(`${basePath}/`) || pageRoute.startsWith(`${basePath}?`))) {
    return pageRoute.slice(basePath.length) || "/";
  }
  return pageRoute;
}

// src/device/services/cdp.mts
async function devtoolsJson(deps, port, path) {
  const url = `http://127.0.0.1:${port}${path}`;
  let res;
  try {
    res = await deps.fetch(url, { signal: AbortSignal.timeout(5e3) });
  } catch (err) {
    throw new LaunchwrightError("qa.device.cdp", `GET ${url} did not answer: ${err.message}`, { cause: err });
  }
  const body = await res.text();
  if (!res.ok) throw new LaunchwrightError("qa.device.cdp", `GET ${url} answered ${res.status}: ${body.slice(0, 200)}`);
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new LaunchwrightError("qa.device.cdp", `GET ${url} answered ${body.length} bytes that are not JSON.`, { cause: err });
  }
}
function rewriteWsUrl(wsUrl, port) {
  const u = new URL(wsUrl);
  u.host = `127.0.0.1:${port}`;
  return u.toString();
}
function attachablePages(targets) {
  return (Array.isArray(targets) ? targets : []).filter(
    (t) => t?.type === "page" && typeof t.webSocketDebuggerUrl === "string" && t.webSocketDebuggerUrl !== ""
  );
}
function connectCdp(deps, wsUrl, onEvent) {
  const ready = deferred();
  const resolve = ready.resolve;
  const reject = ready.reject;
  const ws = deps.socket(wsUrl);
  const pending = /* @__PURE__ */ new Map();
  let nextId = 1;
  let closed = null;
  let opened = false;
  const failAll = (err) => {
    closed ??= err;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
  };
  const opening = setTimeout(() => {
    reject(new LaunchwrightError("qa.device.cdp", `The page socket did not open within 10 s: ${wsUrl}`));
    ws.close();
  }, 1e4);
  ws.onerror = () => {
    clearTimeout(opening);
    const err = new LaunchwrightError("qa.device.cdp", `The page socket failed: ${wsUrl}`);
    failAll(err);
    if (!opened) reject(err);
  };
  ws.onclose = (ev) => {
    clearTimeout(opening);
    failAll(new LaunchwrightError("qa.device.cdp", `The page socket closed (${ev.code ?? "?"} ${ev.reason || "no reason given"}).`));
  };
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch (err) {
      failAll(new LaunchwrightError("qa.device.cdp", "The page sent a frame that is not JSON.", { cause: err }));
      ws.close();
      return;
    }
    if (msg.id === void 0) {
      if (msg.method && onEvent) onEvent({ method: msg.method, ...msg.params ? { params: msg.params } : {} });
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.error) p.reject(new LaunchwrightError("qa.device.cdp", `CDP ${p.method} failed: ${msg.error.message ?? JSON.stringify(msg.error)}`));
    else p.resolve(msg.result ?? {});
  };
  const client = {
    send(method, params = {}, timeoutMs = 15e3) {
      if (closed) return Promise.reject(closed);
      const id = nextId++;
      const answer = deferred();
      const timer = setTimeout(() => {
        pending.delete(id);
        answer.reject(new LaunchwrightError("qa.device.cdp", `CDP ${method} did not answer within ${timeoutMs / 1e3} s.`));
      }, timeoutMs);
      pending.set(id, { resolve: answer.resolve, reject: answer.reject, timer, method });
      ws.send(JSON.stringify({ id, method, params }));
      return answer.promise;
    },
    async evaluate(expression) {
      const res = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      const thrown = res.exceptionDetails;
      if (thrown) {
        throw new LaunchwrightError("qa.device.eval", `The page threw: ${thrown.exception?.description ?? thrown.text ?? "unknown error"}`.slice(0, 600));
      }
      return res.result?.value;
    },
    close() {
      ws.onclose = null;
      failAll(new LaunchwrightError("qa.device.cdp", "The client closed."));
      ws.close();
    }
  };
  ws.onopen = () => {
    opened = true;
    clearTimeout(opening);
    resolve(client);
  };
  return ready.promise;
}
async function openVisiblePage(deps, port, onEvent) {
  const pages = attachablePages(await devtoolsJson(deps, port, "/json/list"));
  const answers = [];
  const open = /* @__PURE__ */ new Map();
  for (const target of pages) {
    let client = null;
    try {
      client = await connectCdp(deps, rewriteWsUrl(target.webSocketDebuggerUrl, port), onEvent);
      answers.push({ id: target.id, ...target.url ? { url: target.url } : {}, visibility: String(await client.evaluate(VISIBILITY_EXPRESSION)) });
      open.set(target.id, { target, client });
    } catch (err) {
      answers.push({ id: target.id, ...target.url ? { url: target.url } : {}, visibility: `unreachable: ${err.message}` });
      client?.close();
    }
  }
  let chosen;
  try {
    chosen = chooseVisiblePage(answers);
  } catch (err) {
    for (const o of open.values()) o.client.close();
    throw err;
  }
  for (const [id, o] of open) if (id !== chosen.id) o.client.close();
  return open.get(chosen.id);
}
function logLineOf(ev, at) {
  const p = ev.params ?? {};
  switch (ev.method) {
    case "Runtime.exceptionThrown":
      return { at, kind: "page-error", text: String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception").slice(0, 500) };
    case "Runtime.consoleAPICalled":
      if (p.type !== "error") return null;
      return { at, kind: "console-error", text: (p.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 500) };
    case "Log.entryAdded":
      return p.entry?.level === "error" ? { at, kind: "console-error", text: String(p.entry?.text ?? "").slice(0, 500) } : null;
    case "Network.loadingFailed":
      return p.canceled ? null : { at, kind: "request-failed", text: `${p.errorText ?? "failed"} ${p.type ?? ""}`.trim() };
    case "Network.responseReceived":
      return Number(p.response?.status) >= 500 ? { at, kind: "response-5xx", text: `${p.response.status} ${String(p.response.url).slice(0, 200)}` } : null;
    default:
      return null;
  }
}

// src/device/services/emulator.mts
function emulatorSerial(port) {
  return `emulator-${port}`;
}
function avdDir(avd) {
  return `"$HOME/.android/avd/${avd}.avd"`;
}
function snapshotRoot(rig) {
  return `${rig.stateDir}/snapshots`;
}
var SDK_ROOT_SCRIPT = 'for d in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do [ -n "$d" ] && [ -d "$d" ] && { echo "$d"; exit 0; }; done; exit 1';
async function sdkRoot(rig) {
  const res = await rig.exec(SDK_ROOT_SCRIPT);
  return res.code === 0 ? out(res).trim().split("\n")[0] || null : null;
}
async function avdExists(rig, avd) {
  return (await rig.exec(`test -d ${avdDir(avd)}`)).code === 0;
}
async function booted(adb) {
  const res = await adb.run(["shell", "getprop", "sys.boot_completed"], { timeoutMs: 15e3 });
  return res.code === 0 && out(res).trim() === "1";
}
function emulatorArgs(keys) {
  return ["-avd", keys.avd, "-port", String(keys.port), "-no-boot-anim", "-no-audio", "-no-snapshot", "-no-window", "-netdelay", "none", "-netspeed", "full", "-gpu", keys.gpu];
}
async function bootEmulator(rig, adb, keys, deps) {
  if (await booted(adb)) return "already";
  const sdk = await sdkRoot(rig);
  if (!sdk) throw new LaunchwrightError("qa.device.sdk", `Rig ${rig.name} has no Android SDK. Install the SDK command-line tools there, then the emulator package.`);
  if (!await avdExists(rig, keys.avd)) {
    throw new LaunchwrightError("qa.device.avd", `Rig ${rig.name} has no AVD ${keys.avd}. Create it with avdmanager on that rig.`, { context: { avd: keys.avd } });
  }
  const log = `${rig.stateDir}/${keys.avd}.log`;
  const start = `mkdir -p ${shq(rig.stateDir)} && nohup ${shq(`${sdk}/emulator/emulator`)} ${emulatorArgs(keys).map(shq).join(" ")} > ${shq(log)} 2>&1 & echo started`;
  orFail(await rig.exec(start), "qa.device.emulator", `starting AVD ${keys.avd} on rig ${rig.name}`);
  await poll(deps.clock, async () => await booted(adb) ? true : null, {
    timeoutMs: 42e4,
    everyMs: 2e3,
    code: "qa.device.emulator.boot",
    what: `The boot of AVD ${keys.avd} on rig ${rig.name} (log: ${log})`
  });
  return "booted";
}
async function stopEmulator(rig, adb, deps) {
  const kill = rig.remote ? await rig.exec(`adb -s ${shq(adb.serial)} emu kill`) : await adb.run(["emu", "kill"]);
  orFail(kill, "qa.device.emulator.stop", `adb emu kill of ${adb.serial} on rig ${rig.name}`, { rig: rig.name });
  await poll(deps.clock, async () => await booted(adb) ? null : true, {
    timeoutMs: 9e4,
    everyMs: 500,
    code: "qa.device.emulator.stop",
    what: `The clean shutdown of ${adb.serial}`
  });
}
function safeLabel(label) {
  return label.replace(/[^\w-]/g, "").slice(0, 40);
}
async function snapshotAvd(rig, avd, label, now) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const tag = label ? `${stamp}-${safeLabel(label)}` : stamp;
  const dest = `${snapshotRoot(rig)}/${avd}-${tag}`;
  const cmd = `mkdir -p ${shq(snapshotRoot(rig))} && (cp -Rc ${avdDir(avd)} ${shq(dest)} 2>/dev/null || cp -R ${avdDir(avd)} ${shq(dest)}) && test -f ${shq(`${dest}/userdata-qemu.img.qcow2`)}`;
  const res = await rig.exec(cmd, { timeoutMs: 6e5 });
  if (res.code !== 0) throw new LaunchwrightError("qa.device.snapshot", `Snapshot of AVD ${avd} on rig ${rig.name} failed or has no userdata: ${said(res)}`);
  return dest;
}
async function listSnapshots(rig, avd) {
  const res = await rig.exec(`ls -1dt ${shq(snapshotRoot(rig))}/${avd}-* 2>/dev/null || true`);
  return out(res).trim().split("\n").filter(Boolean);
}
async function restoreAvd(rig, adb, avd, from, force) {
  if (await booted(adb)) throw new LaunchwrightError("qa.device.restore", `The emulator ${adb.serial} is running. Stop it with lw qa device down first.`);
  if (!force) {
    throw new LaunchwrightError(
      "qa.device.telegram.signed-in",
      `Restore replaces AVD ${avd}, and the Telegram sign-in on it. Run it again with --force after the owner of that account agrees.`
    );
  }
  const snaps = await listSnapshots(rig, avd);
  const src = from ?? snaps[0];
  if (!src) throw new LaunchwrightError("qa.device.restore", `No snapshot of AVD ${avd} on rig ${rig.name}. Take one with lw qa device snapshot.`);
  if (!snaps.includes(src)) throw new LaunchwrightError("qa.device.restore", `${src} is not a snapshot of AVD ${avd}. Snapshots: ${snaps.join(", ") || "none"}.`);
  const cmd = `rm -rf ${avdDir(avd)} && (cp -Rc ${shq(src)} ${avdDir(avd)} 2>/dev/null || cp -R ${shq(src)} ${avdDir(avd)})`;
  orFail(await rig.exec(cmd, { timeoutMs: 6e5 }), "qa.device.restore", `restoring AVD ${avd} from ${src}`);
  return src;
}

// src/device/services/host-proxy.mts
var HOST_PROXY_SCRIPT = `import http from 'node:http';
import net from 'node:net';

const [, , portArg, HOST, UPSTREAM] = process.argv;
const PORT = Number(portArg);
if (!PORT || !HOST || !UPSTREAM) {
  console.error('usage: host-proxy.mjs <port> <hostname> <upstream>');
  process.exit(2);
}
const dialFor = (name) => (name === HOST ? UPSTREAM : name);

const server = http.createServer((req, res) => {
  if (req.url === '/__ingress') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ host: HOST, upstream: UPSTREAM, port: PORT, pid: process.pid }));
    return;
  }
  let target;
  try {
    target = new URL(req.url);
  } catch {
    res.writeHead(400).end('absolute URL required');
    return;
  }
  const up = http.request(
    { host: dialFor(target.hostname), port: target.port || 80, path: target.pathname + target.search, method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode || 502, answer.headers);
      answer.pipe(res);
    },
  );
  up.on('error', (err) => {
    console.error('upstream ' + target.hostname + ': ' + err.message);
    res.destroy();
  });
  req.pipe(up);
});

server.on('connect', (req, socket, head) => {
  const at = req.url.lastIndexOf(':');
  const name = at === -1 ? req.url : req.url.slice(0, at);
  const port = at === -1 ? 443 : Number(req.url.slice(at + 1)) || 443;
  const up = net.connect(port, dialFor(name), () => {
    socket.write('HTTP/1.1 200 Connection Established\\r\\n\\r\\n');
    if (head && head.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', (err) => {
    console.error('connect ' + name + ': ' + err.message);
    socket.destroy();
  });
  socket.on('error', () => up.destroy());
});

server.listen(PORT, '127.0.0.1', () => console.log('host-proxy 127.0.0.1:' + PORT + ' ' + HOST + ' -> ' + UPSTREAM));
`;

// src/device/services/ingress.mts
var DEFAULT_PROXY_PORT = 8899;
function proxyAddress(port) {
  return `127.0.0.1:${port}`;
}
function parseIdentity(text) {
  try {
    const id = JSON.parse(text.trim());
    return typeof id.host === "string" && typeof id.upstream === "string" && typeof id.pid === "number" ? { host: id.host, upstream: id.upstream, pid: id.pid } : null;
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}
async function identity(rig, port) {
  const res = await rig.exec(`curl -s -m 3 http://127.0.0.1:${port}/__ingress || true`, { timeoutMs: 15e3 });
  return parseIdentity(out(res));
}
async function clearIngress(adb, port) {
  const held = (await adb.shell(["settings", "get", "global", "http_proxy"])).trim();
  if (held !== proxyAddress(port)) return false;
  await adb.shell(["settings", "put", "global", "http_proxy", ":0"]);
  return true;
}
async function startProxy(rig, deps, port, host, upstream) {
  const script = `${rig.stateDir}/host-proxy.mjs`;
  const log = `${rig.stateDir}/host-proxy.log`;
  await rig.writeFile(script, HOST_PROXY_SCRIPT);
  const start = `NODE="$(command -v node)"; [ -n "$NODE" ] || { echo "node is not installed on this rig" >&2; exit 3; }; nohup "$NODE" ${shq(script)} ${port} ${shq(host)} ${shq(upstream)} > ${shq(log)} 2>&1 &`;
  orFail(await rig.exec(start), "qa.device.ingress", `starting the host proxy on rig ${rig.name}`, { rig: rig.name });
  await poll(
    deps.clock,
    async () => {
      const id = await identity(rig, port);
      return id && id.host === host && id.upstream === upstream ? id : null;
    },
    { timeoutMs: 5e3, everyMs: 250, code: "qa.device.ingress", what: `The host proxy answering on rig ${rig.name} port ${port} (log: ${log})` }
  );
}
async function ensureIngress(adb, rig, deps, baseUrl) {
  const port = rig.config.hostProxy?.port ?? DEFAULT_PROXY_PORT;
  if (rig.config.ingress === "direct") return { mode: "direct", changed: await clearIngress(adb, port) };
  const upstream = rig.config.hostProxy?.upstream;
  if (!upstream) {
    throw new LaunchwrightError(
      "qa.device.ingress.config",
      `Rig ${rig.name} has ingress host-proxy and no hostProxy.upstream. Set qa.device.rigs.${rig.name}.hostProxy.upstream to the address that serves the tunnel hostname.`,
      { context: { rig: rig.name } }
    );
  }
  const host = new URL(baseUrl).hostname;
  const live = await identity(rig, port);
  if (!live || live.host !== host || live.upstream !== upstream) {
    if (live) orFail(await rig.exec(`kill ${live.pid}`), "qa.device.ingress", `stopping the stale host proxy (pid ${live.pid})`);
    await startProxy(rig, deps, port, host, upstream);
  }
  orFail(await adb.run(["reverse", `tcp:${port}`, `tcp:${port}`]), "qa.device.ingress", `adb reverse tcp:${port}`);
  const held = (await adb.shell(["settings", "get", "global", "http_proxy"])).trim();
  const changed = held !== proxyAddress(port);
  if (changed) await adb.shell(["settings", "put", "global", "http_proxy", proxyAddress(port)]);
  return { mode: "host-proxy", changed };
}

// src/device/services/session-base.mts
import { mkdir as mkdir2, rename, writeFile as writeFile2 } from "fs/promises";
import { dirname as dirname2 } from "path";
var SETTLE_TIMEOUT_MS = 2e4;
var SETTLE_EVERY_MS = 250;
function capabilityError(target, capability, what) {
  return new LaunchwrightError("qa.target.capability", `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability }
  });
}
function closedError(target, call) {
  return new LaunchwrightError("qa.target.closed", `The ${target} session is closed; ${call} needs an open session.`);
}
async function pollSettle(clock, rule, evaluate, target) {
  const expression = settleExpression(rule);
  const timeout = rule.timeout ?? SETTLE_TIMEOUT_MS;
  const deadline = clock.now() + timeout;
  let missing = ["not evaluated"];
  for (; ; ) {
    try {
      const answer = await evaluate(expression);
      if (answer?.ok) return;
      missing = answer?.missing ?? ["no answer"];
    } catch (err) {
      if (!isCodedError(err)) throw err;
      missing = [`the check threw: ${err.message}`];
    }
    if (clock.now() >= deadline) {
      throw new LaunchwrightError("qa.target.settle", `The ${target} page never showed ${missing.join(", ")} within ${timeout} ms.`, {
        context: { rule, missing }
      });
    }
    await clock.sleep(SETTLE_EVERY_MS);
  }
}
async function pageAct(step, evaluate, target) {
  const answer = await evaluate(actExpression(step));
  if (answer && answer.ok === false) {
    throw new LaunchwrightError("qa.target.act", `The act ${step.kind} on the ${target} page failed: ${answer.error ?? "no reason given"}.`, {
      context: { kind: step.kind, target: step.target }
    });
  }
}
async function writePng(path, bytes, target) {
  const size = pngSize(bytes);
  if (size === null) throw new LaunchwrightError("qa.target.screenshot", `The ${target} target returned ${bytes.length} bytes that are not a PNG.`);
  await mkdir2(dirname2(path), { recursive: true });
  await writeFile2(path, bytes);
  return { path, ...size };
}
async function writeBytes(path, bytes) {
  await mkdir2(dirname2(path), { recursive: true });
  await writeFile2(path, bytes);
}
async function holdLastFrame(deps, ffmpeg, path, durationMs) {
  const seconds = (durationMs / 1e3).toFixed(3);
  const held = `${path}.held.mp4`;
  const args = ["-y", "-v", "error", "-i", path, "-vf", `tpad=stop_mode=clone:stop_duration=${seconds}`, "-t", seconds, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", held];
  orFail(await deps.run.run(ffmpeg, args, { timeoutMs: 12e4 }), "qa.device.record", `holding the last frame of ${path} with ${ffmpeg}`);
  await rename(held, path);
}
function consoleLogKind(line) {
  if (line.level !== "error" && line.level !== "SEVERE") return null;
  if (line.source === "javascript") return "page-error";
  if (line.source === "console-api") return "console-error";
  if (line.source === "network") return /status of 5\d\d\b/.test(line.text) ? "response-5xx" : "request-failed";
  return null;
}
async function waitAct(clock, step) {
  if (!step.why) throw new LaunchwrightError("qa.target.act", "A wait act needs a why: it names what the row waits for.");
  await clock.sleep(step.ms ?? 0);
}

// src/device/services/telegram.mts
import { mkdir as mkdir3, readFile, writeFile as writeFile3 } from "fs/promises";
import { dirname as dirname3, join as join2 } from "path";
function apkPath(root) {
  return join2(root, DEVICE_STATE_DIR, "telegram.apk");
}
function pinOf(cfg) {
  if (!cfg.apkSha256) {
    throw new LaunchwrightError(
      "qa.device.telegram.pin",
      "qa.device.telegram.apkSha256 is not set. Pin the APK you trust: fetch it once, check it, and set the key to its sha256sum."
    );
  }
  return cfg.apkSha256;
}
function checkPin(bytes, cfg) {
  const want = pinOf(cfg);
  const got = sha256(bytes);
  if (!safeEqual(got, want)) {
    throw new LaunchwrightError(
      "qa.device.telegram.pin",
      `The Telegram APK has sha256 ${got}, not the pinned ${want}. Telegram may have published a new build: check it, then move the pin in qa.device.telegram.apkSha256.`,
      { context: { got, want } }
    );
  }
}
async function fetchApk(cfg, deps) {
  const path = apkPath(deps.root);
  let bytes = null;
  try {
    bytes = await readFile(path);
  } catch (err) {
    if (err.code !== "ENOENT") throw new LaunchwrightError("qa.device.telegram.apk", `Cannot read ${path}.`, { cause: err });
  }
  if (bytes) {
    checkPin(bytes, cfg);
    return path;
  }
  pinOf(cfg);
  const res = await deps.fetch(cfg.apkUrl, { redirect: "follow", signal: AbortSignal.timeout(6e5) });
  if (!res.ok) throw new LaunchwrightError("qa.device.telegram.apk", `GET ${cfg.apkUrl} answered ${res.status}.`);
  const body = Buffer.from(await res.arrayBuffer());
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared && body.length !== declared) {
    throw new LaunchwrightError("qa.device.telegram.apk", `The APK download is truncated: ${body.length} of ${declared} bytes.`);
  }
  checkPin(body, cfg);
  await mkdir3(dirname3(path), { recursive: true });
  await writeFile3(path, body);
  return path;
}
async function installed(adb, pkg) {
  const res = await adb.run(["shell", "pm", "path", pkg]);
  return res.code === 0 && out(res).includes("package:");
}
async function installTelegram(adb, cfg, deps, force) {
  const path = await fetchApk(cfg, deps);
  if (!force && await installed(adb, cfg.package)) {
    throw new LaunchwrightError(
      "qa.device.telegram.signed-in",
      `${cfg.package} is installed on ${adb.serial} and may be signed in to a real account. Install over it only with --force, after its owner agrees.`,
      { context: { serial: adb.serial } }
    );
  }
  const res = await adb.run(["install", "-r", "-g", path], { timeoutMs: 3e5 });
  const text = `${out(res)}${res.stderr}`.trim();
  if (res.code !== 0 || !/\bSuccess\b/.test(text)) throw new LaunchwrightError("qa.device.telegram.install", `adb install on ${adb.serial} failed: ${text.slice(0, 400)}`);
  return path;
}
var DEFAULT_START_PARAM = "lw";
function miniAppLink(bot, startParam = DEFAULT_START_PARAM) {
  if (!/^[A-Za-z][\w]{3,31}$/.test(bot)) throw new LaunchwrightError("qa.device.telegram.bot", `${JSON.stringify(bot)} is not a Telegram bot username.`);
  return `tg://resolve?domain=${bot}&startapp=${encodeURIComponent(startParam || DEFAULT_START_PARAM)}`;
}
async function viewIntent(adb, uri, pkg) {
  const res = await adb.run(["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", `'${uri.replaceAll("'", "")}'`, ...pkg ? [pkg] : []]);
  orFail(res, "qa.device.intent", `am start ${uri.split("?")[0]}`);
  if (/Error:/i.test(out(res))) throw new LaunchwrightError("qa.device.intent", `am start ${uri.split("?")[0]} failed: ${out(res).trim().slice(0, 300)}`);
}
async function forceStop(adb, pkg) {
  await adb.shell(["am", "force-stop", pkg]);
}

// src/device/services/android-session.mts
var MIN_CLIP_MS = MIN_VIDEO_S * 1e3 + 500;
var SCRCPY_GRACE_S = 30;
function androidHandle(ctx, deviceName, target, emulatorOnly = false) {
  const resolved = resolveDevice(ctx.config, deviceName);
  const kind = deviceKind(resolved.device.kind);
  if (kind.access !== "adb" || emulatorOnly && kind.emulator !== true) {
    const drives = emulatorOnly ? "an Android emulator" : "an adb device";
    throw new LaunchwrightError("qa.device.kind", `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives ${drives}.`, {
      context: { device: resolved.name, target }
    });
  }
  const rig = ctx.rigs.get(resolved.rigName);
  const bin = ctx.config.device.tools.adb;
  if (kind.emulator === true) {
    const keys2 = deviceKeys(resolved.name, resolved.device, emulatorDeviceKeys);
    return { resolved, rig, adb: createAdb(rig, emulatorSerial(keys2.port), ctx.deps, bin), emulator: keys2, recorder: keys2.recorder, browserPackage: keys2.browserPackage };
  }
  const keys = deviceKeys(resolved.name, resolved.device, androidDeviceKeys);
  return { resolved, rig, adb: createAdb(rig, keys.serial, ctx.deps, bin), emulator: null, recorder: keys.recorder, browserPackage: keys.browserPackage };
}
function stateFix(state, serial, rig) {
  switch (state) {
    case "device":
      return "";
    case "unauthorized":
      return `${serial} on rig ${rig} is unauthorized: unlock it and accept the USB debugging prompt.`;
    case "offline":
      return `${serial} on rig ${rig} is offline: reconnect the cable, or restart the adb server on the rig.`;
    case "absent":
      return `${serial} is not attached to the adb server of rig ${rig}: plug it in with USB debugging on, or boot the emulator.`;
    default:
      return `${serial} on rig ${rig} is ${state}.`;
  }
}
async function attachSocket(ctx, h, pkg, surface) {
  try {
    return await poll(
      ctx.deps.clock,
      async () => {
        const found = await sockets(h.adb, pkg);
        const own = found.find((s) => s.process !== null && processBelongsTo(s.process, pkg));
        const browser = surface === "web" ? found.find((s) => isBrowserSocket(s.name, pkg)) : void 0;
        return (own ?? browser)?.name ?? null;
      },
      { timeoutMs: 3e4, everyMs: 1e3, code: "qa.device.webview", what: `A debuggable WebView of ${pkg} on ${h.adb.serial}` }
    );
  } catch (err) {
    if (!isCodedError(err) || err.code !== "qa.device.webview") throw err;
    if (surface === "web") {
      throw new LaunchwrightError(
        "qa.device.webview",
        `${err.message} A browser publishes its devtools socket only after its first-run screens. Finish them once on the device (lw qa device mirror --device ${h.resolved.name}).`,
        { cause: err }
      );
    }
    throw new LaunchwrightError(
      "qa.device.webview",
      `${err.message} A Telegram release build makes its Mini App WebView debuggable only after Enable WebView Debug: in Telegram Settings, press and hold the version number twice, then choose it.`,
      { cause: err }
    );
  }
}
var AndroidSession = class _AndroidSession {
  constructor(ctx, h, opts, target, page, rigPort, reused) {
    this.ctx = ctx;
    this.h = h;
    this.opts = opts;
    this.target = target;
    this.page = page;
    this.rigPort = rigPort;
    this.reused = reused;
  }
  ctx;
  h;
  opts;
  target;
  page;
  rigPort;
  reused;
  closed = false;
  lines = [];
  video = null;
  height = null;
  /** Boots an emulator when needed, applies the ingress, opens the app and attaches to its visible page. */
  static async open(ctx, h, opts, target) {
    const { leg } = opts;
    if (leg.surface === "bot") {
      throw new LaunchwrightError("qa.target.surface", `The ${target} target runs web and miniapp legs; leg ${leg.name} is a bot leg. Use the telegram-fake leg for a bot chat.`);
    }
    await h.rig.ensure();
    if (h.emulator) await bootEmulator(h.rig, h.adb, h.emulator, ctx.deps);
    const state = await deviceState(h.rig, h.adb.serial, ctx.deps, ctx.config.device.tools.adb);
    if (state !== "device") throw new LaunchwrightError("qa.target.not-ready", stateFix(state, h.adb.serial, h.rig.name));
    const ingress = await ensureIngress(h.adb, h.rig, ctx.deps, opts.baseUrl);
    let pkg;
    if (leg.surface === "miniapp") {
      pkg = ctx.config.device.telegram.package;
      if (!leg.bot) throw new LaunchwrightError("qa.target.leg", `Leg ${leg.name} opens a Mini App in Telegram and names no bot. Set qa.legs.${leg.name}.bot.`);
      if (!await installed(h.adb, pkg)) {
        throw new LaunchwrightError("qa.target.not-ready", `${pkg} is not installed on ${h.adb.serial}. Run lw qa device install --device ${h.resolved.name}, then sign in by hand.`);
      }
      if (ingress.changed) await forceStop(h.adb, pkg);
      await viewIntent(h.adb, miniAppLink(leg.bot), pkg);
    } else {
      pkg = h.browserPackage;
      if (ingress.changed) await forceStop(h.adb, pkg);
      await viewIntent(h.adb, routeUrl(opts.baseUrl, "/").url, pkg);
    }
    const socket = await attachSocket(ctx, h, pkg, leg.surface);
    const fwd = await forwardSocket(h.adb, socket);
    const local = await h.rig.forward(fwd.port);
    const holder = { session: null, early: [] };
    const onEvent = (ev) => {
      if (holder.session) holder.session.record(ev);
      else holder.early.push(ev);
    };
    const page = await openVisiblePage(ctx.deps, local, onEvent);
    const session = new _AndroidSession(ctx, h, opts, target, page, fwd.port, fwd.reused);
    holder.session = session;
    for (const ev of holder.early) session.record(ev);
    for (const domain of ["Runtime.enable", "Log.enable", "Network.enable"]) await page.client.send(domain);
    return session;
  }
  record(ev) {
    const line = logLineOf(ev, new Date(this.ctx.deps.clock.now()).toISOString());
    if (line) this.lines.push(line);
  }
  alive(call) {
    if (this.closed) throw closedError(this.target, call);
  }
  async evaluate(expression) {
    this.alive("evaluate");
    return this.page.client.evaluate(expression);
  }
  async navigate(route) {
    this.alive("navigate");
    const { url, path } = routeUrl(this.opts.baseUrl, route);
    if (this.opts.leg.surface === "miniapp") {
      await this.evaluate(pushRouteExpression(path));
      return;
    }
    await this.page.client.send("Page.navigate", { url });
    await poll(this.ctx.deps.clock, async () => await this.evaluate("document.readyState") === "loading" ? null : true, {
      timeoutMs: 15e3,
      everyMs: 200,
      code: "qa.target.navigate",
      what: `The load of ${route} on ${this.h.adb.serial}`
    });
  }
  async act(step) {
    this.alive("act");
    if (step.kind === "wait") return waitAct(this.ctx.deps.clock, step);
    if (step.kind === "back") {
      const before = await this.currentRoute();
      this.height ??= (await wmSize(this.h.adb)).height;
      await backGesture(this.h.adb, this.height);
      const deadline = this.ctx.deps.clock.now() + 3e3;
      while (this.ctx.deps.clock.now() < deadline && await this.currentRoute() === before) await this.ctx.deps.clock.sleep(200);
      return;
    }
    await pageAct(step, (e) => this.evaluate(e), this.target);
  }
  async settle(rule) {
    this.alive("settle");
    await pollSettle(this.ctx.deps.clock, rule, (e) => this.evaluate(e), this.target);
  }
  async currentRoute() {
    this.alive("currentRoute");
    return relativeRoute(this.opts.baseUrl, String(await this.evaluate(ROUTE_EXPRESSION)));
  }
  async screenshot(path) {
    this.alive("screenshot");
    const visibility = String(await this.evaluate(VISIBILITY_EXPRESSION));
    if (visibility !== "visible") {
      throw new LaunchwrightError("qa.target.screenshot", `The page this row drove is ${visibility} on ${this.h.adb.serial}: the screenshot would show another page.`);
    }
    return writePng(path, await screencap(this.h.adb), this.target);
  }
  async startVideo(path) {
    this.alive("startVideo");
    if (this.video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session already records ${this.video.path}.`);
    const capS = Math.min(this.ctx.config.evidence.videoCapS, SCREENRECORD_MAX_S);
    const startedAt = this.ctx.deps.clock.now();
    if (this.h.recorder === "screenrecord") {
      const rec = await startScreenrecord(this.h.adb, this.ctx.deps, capS, basename(path));
      this.video = { path, startedAt, stop: () => rec.stop() };
      return;
    }
    this.video = { path, startedAt, stop: await this.startScrcpy(path, capS) };
  }
  /** `scrcpy --record` on this machine. Over an ssh rig its video socket rides the master on one port number. */
  async startScrcpy(path, capS) {
    const port = await this.ctx.deps.freePort();
    const args = ["-s", this.h.adb.serial, "--no-playback", "--no-audio", "--no-window", `--record=${path}`, `--time-limit=${capS}`, "-p", String(port)];
    const env = {};
    if (this.h.rig.remote) {
      await this.h.rig.forward(port, port);
      args.push("--force-adb-forward");
      env.ANDROID_ADB_SERVER_PORT = String(await this.h.rig.adbPort());
    }
    const proc = this.ctx.deps.run.start(this.ctx.config.device.tools.scrcpy, args, { env, timeoutMs: (capS + SCRCPY_GRACE_S) * 1e3 });
    return async () => {
      proc.signal("SIGINT");
      const res = await proc.done;
      if (this.h.rig.remote) await this.h.rig.unforward(port);
      if (res.code !== 0 && res.code !== 128) throw new LaunchwrightError("qa.device.record", `scrcpy --record exited ${res.code}: ${res.stderr.trim().slice(0, 300)}`);
      return null;
    };
  }
  async stopVideo() {
    this.alive("stopVideo");
    const video = this.video;
    if (!video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session records no video; call startVideo first.`);
    this.video = null;
    const short = MIN_CLIP_MS - (this.ctx.deps.clock.now() - video.startedAt);
    if (short > 0) await this.ctx.deps.clock.sleep(short);
    const bytes = await video.stop();
    const durationMs = this.ctx.deps.clock.now() - video.startedAt;
    if (bytes) await writeBytes(video.path, bytes);
    await holdLastFrame(this.ctx.deps, this.ctx.config.device.tools.ffmpeg, video.path, durationMs);
    return { path: video.path, durationMs };
  }
  async trace() {
    this.alive("trace");
    return null;
  }
  async dump(path) {
    this.alive("dump");
    const xml = await poll(this.ctx.deps.clock, () => uiDump(this.h.adb), {
      timeoutMs: 8e3,
      everyMs: 800,
      code: "qa.device.dump",
      what: `A uiautomator dump of ${this.h.adb.serial}`
    });
    await writeBytes(path, Buffer.from(xml));
    return path;
  }
  async logs() {
    return [...this.lines];
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    const video = this.video;
    this.video = null;
    this.page.client.close();
    if (video) await video.stop();
    if (!this.reused) {
      await this.h.rig.unforward(this.rigPort);
      await removeForward(this.h.adb, this.rigPort);
    }
  }
};

// src/device/services/browserstack.mts
import { mkdir as mkdir4, rm, writeFile as writeFile4 } from "fs/promises";
import { dirname as dirname4, join as join3 } from "path";

// src/kernel/services/fetch.mts
var REDIRECT_STATUSES = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function isRedirect(res) {
  return res.type === "opaqueredirect" || REDIRECT_STATUSES.has(res.status);
}

// src/device/services/browserstack.mts
var WebDriverError = class extends LaunchwrightError {
  constructor(message, status, wdCode, cause) {
    super("qa.device.browserstack.webdriver", message, { ...cause === void 0 ? {} : { cause }, context: { status, wdCode } });
    this.status = status;
    this.wdCode = wdCode;
  }
  status;
  wdCode;
};
async function redirected(call, res) {
  await res.body?.cancel();
  return new LaunchwrightError("qa.device.browserstack.redirect", `${call} answered a redirect ${res.status}, which is not followed`, { context: { status: res.status } });
}
function createBrowserstackClient(cfg, deps) {
  if (!cfg.username || !cfg.accessKey) {
    throw new LaunchwrightError(
      "qa.device.browserstack.keys",
      "BrowserStack needs qa.device.browserstack.username and accessKey. Store BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in the secret store and map them into the qa config."
    );
  }
  const authorization = `Basic ${Buffer.from(`${cfg.username}:${cfg.accessKey}`).toString("base64")}`;
  return {
    async wd(method, path, body, timeoutMs = 9e4) {
      const res = await deps.fetch(`${cfg.hub}${path}`, {
        method,
        headers: { "content-type": "application/json", authorization },
        ...body === void 0 ? {} : { body: JSON.stringify(body) },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (isRedirect(res)) throw await redirected(`${method} ${path}`, res);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (err) {
        throw new WebDriverError(`${method} ${path} answered ${res.status} with no JSON: ${text.slice(0, 200)}`, res.status, "no json", err);
      }
      const error = json.value?.error;
      if (!res.ok || error) {
        throw new WebDriverError(`${method} ${path} answered ${res.status}: ${error ?? ""} ${String(json.value?.message ?? "").slice(0, 300)}`.trim(), res.status, error ?? "");
      }
      return json.value;
    },
    async api(path) {
      const res = await deps.fetch(`${cfg.api}${path}`, { headers: { authorization }, redirect: "manual", signal: AbortSignal.timeout(3e4) });
      if (isRedirect(res)) throw await redirected(`GET ${path}`, res);
      const text = await res.text();
      if (!res.ok) throw new LaunchwrightError("qa.device.browserstack.api", `GET ${path} answered ${res.status}: ${text.slice(0, 200)}`);
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new LaunchwrightError("qa.device.browserstack.api", `GET ${path} answered ${text.length} bytes that are not JSON.`, { cause: err });
      }
    }
  };
}
function capabilities(kind, keys, cfg, sessionName) {
  const traits = deviceKind(kind);
  return {
    capabilities: {
      alwaysMatch: {
        browserName: traits.browser ?? "safari",
        // A kind with `console` keeps the page console for `se/log` (chromedriver); Safari over WebDriver has none.
        ...traits.console === true ? { "goog:loggingPrefs": { browser: "ALL" } } : {},
        "bstack:options": {
          deviceName: keys.model,
          osVersion: keys.os,
          realMobile: "true",
          projectName: cfg.project,
          buildName: cfg.build,
          sessionName,
          idleTimeout: cfg.idleTimeoutS,
          debug: false,
          networkLogs: false
        }
      }
    }
  };
}
function asyncScript(expression) {
  const expr = expression.trim().replace(/;+\s*$/, "");
  return `var done = arguments[arguments.length - 1];
var fail = function (e) { done({ ok: false, error: String((e && e.stack) || e) }); };
try {
  Promise.resolve((function () { return (
${expr}
); })()).then(function (v) { done({ ok: true, value: v === undefined ? null : v }); }, fail);
} catch (e) { fail(e); }`;
}
function minuteSummary(sessions, plan) {
  const seconds = sessions.map((s) => Number(s.duration) || 0);
  return {
    plan: String(plan.automate_plan ?? "unknown"),
    sessions: seconds.length,
    minutes: Math.round(seconds.reduce((a, b) => a + b, 0) / 6) / 10,
    billedMinutes: seconds.reduce((a, s) => a + Math.ceil(s / 60), 0),
    running: Number(plan.parallel_sessions_running ?? 0),
    parallel: Number(plan.parallel_sessions_max_allowed ?? 0)
  };
}
function budgetLine(s, cfg) {
  return `Automate plan ${s.plan}: ${s.minutes} min used over ${s.sessions} session(s), ${s.billedMinutes} min rounded up; ${s.running} of ${s.parallel} parallel running; per-run budget ${cfg.budgetMinutes} min`;
}
async function allSessions(client) {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const builds = await client.api(`/builds.json?limit=100&offset=${offset}`);
    for (const { automation_build: b } of builds) {
      for (let so = 0; ; so += 100) {
        const page = await client.api(`/builds/${b.hashed_id}/sessions.json?limit=100&offset=${so}`);
        rows.push(...page.map((p) => p.automation_session));
        if (page.length < 100) break;
      }
    }
    if (builds.length < 100) return rows;
  }
}
async function budget(client) {
  const [plan, sessions] = await Promise.all([client.api("/plan.json"), allSessions(client)]);
  return minuteSummary(sessions, plan);
}
function heldSessionPath(root) {
  return join3(root, DEVICE_STATE_DIR, "browserstack-session.json");
}
async function readHeld(root) {
  return await readJsonOrNull(heldSessionPath(root));
}
async function writeHeld(root, held) {
  const path = heldSessionPath(root);
  if (held === null) {
    await rm(path, { force: true });
    return;
  }
  await mkdir4(dirname4(path), { recursive: true });
  await writeFile4(path, `${JSON.stringify(held, null, 1)}
`);
}
function checkBudget(startedAt, now, cfg) {
  const usedMin = (now - startedAt) / 6e4;
  if (usedMin > cfg.budgetMinutes) {
    throw new LaunchwrightError(
      "qa.device.browserstack.budget",
      `The BrowserStack session has run ${usedMin.toFixed(1)} min, past the per-run budget of ${cfg.budgetMinutes} min (qa.device.browserstack.budgetMinutes). It was closed.`,
      { context: { usedMin, budgetMinutes: cfg.budgetMinutes } }
    );
  }
}

// src/device/services/simctl.mts
var XCRUN = "/usr/bin/xcrun";
function parseSimList(stdout) {
  const devices = [];
  let runtime = "";
  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line) continue;
    const heading = /^--\s*(.+?)\s*--$/.exec(line);
    if (heading) {
      runtime = heading[1];
      continue;
    }
    const row = /^\s{2,}(.+?)\s+\(([0-9A-Fa-f-]{36})\)\s+\(([A-Za-z]+)\)(.*)$/.exec(line);
    if (!row) continue;
    devices.push({
      name: row[1],
      udid: row[2],
      runtime,
      state: row[3],
      booted: row[3] === "Booted",
      available: !/unavailable/i.test(row[4] ?? "")
    });
  }
  return devices;
}
function simctl(args) {
  return [XCRUN, "simctl", ...args].map(shq).join(" ");
}
async function listSimulators(rig) {
  return parseSimList(orFail(await rig.exec(simctl(["list", "devices"])), "qa.device.simctl", "simctl list devices"));
}
async function bootedSimulator(rig, udid) {
  const all = await listSimulators(rig);
  const booted2 = all.filter((d) => d.booted);
  const hit = udid ? booted2.find((d) => d.udid === udid) : booted2.length === 1 ? booted2[0] : void 0;
  if (hit) return hit;
  const why = udid ? "the configured simulator is not booted" : `${booted2.length} simulators are booted, and the device names no udid`;
  throw new LaunchwrightError(
    "qa.device.simctl.booted",
    `No simulator to drive on rig ${rig.name}: ${why}. Booting one is an operator step, because a simulator can hold a signed-in Telegram.`
  );
}
async function openUrl(rig, udid, url) {
  if (!/^https?:\/\//i.test(url)) throw new LaunchwrightError("qa.device.simctl", `simctl openurl takes an http(s) URL, not ${url.split(":")[0]}:.`);
  orFail(await rig.exec(simctl(["openurl", udid, url])), "qa.device.simctl", "simctl openurl");
}
async function simScreenshot(rig, udid, remotePath) {
  const text = orFail(await rig.exec(simctl(["io", udid, "screenshot", remotePath])), "qa.device.simctl", "simctl io screenshot");
  if (!/Wrote screenshot to/i.test(text)) throw new LaunchwrightError("qa.device.simctl", `simctl io screenshot said nothing about ${remotePath}.`);
  const read = await rig.exec(`cat ${shq(remotePath)} && rm -f ${shq(remotePath)}`, { timeoutMs: 6e4 });
  orFail(read, "qa.device.simctl", `reading ${remotePath}`);
  return read.stdout;
}
async function startSimVideo(rig, udid, remotePath) {
  const cmd = `rm -f ${shq(remotePath)}; nohup ${simctl(["io", udid, "recordVideo", "--codec=h264", "--force", remotePath])} >/dev/null 2>&1 & echo $!`;
  const pid = Number(orFail(await rig.exec(cmd), "qa.device.simctl", "simctl io recordVideo").trim().split("\n").pop());
  if (!Number.isInteger(pid) || pid <= 0) throw new LaunchwrightError("qa.device.simctl", "simctl io recordVideo printed no pid.");
  return pid;
}
async function stopSimVideo(rig, pid, remotePath) {
  const wait = `kill -INT ${pid}; i=0; while kill -0 ${pid} 2>/dev/null; do i=$((i+1)); [ $i -ge 50 ] && exit 3; sleep 0.2; done`;
  const stopped = await rig.exec(wait, { timeoutMs: 3e4 });
  if (stopped.code !== 0) throw new LaunchwrightError("qa.device.simctl", `The simulator recorder (pid ${pid}) did not stop within 10 s: ${said(stopped)}`);
  const read = await rig.exec(`cat ${shq(remotePath)} && rm -f ${shq(remotePath)}`, { timeoutMs: 12e4 });
  orFail(read, "qa.device.simctl", `reading ${remotePath}`);
  if (read.stdout.length === 0) throw new LaunchwrightError("qa.device.simctl", "The simulator recorder wrote an empty file.");
  return read.stdout;
}

// src/device/services/webkit.mts
function parseDeviceList(json) {
  if (!Array.isArray(json)) throw new LaunchwrightError("qa.device.webkit", `The proxy device list is not an array (got ${typeof json}).`);
  return json.map((row, i) => {
    const id = String(row?.deviceId ?? "").trim();
    if (!id) throw new LaunchwrightError("qa.device.webkit", `Device ${i} in the proxy list has no deviceId.`);
    const m = /:(\d+)$/.exec(String(row.url ?? "").trim());
    const port = m ? Number(m[1]) : 0;
    if (!(port > 0 && port < 65536)) throw new LaunchwrightError("qa.device.webkit", `Device ${i} in the proxy list has no page port in its url.`);
    return { id, name: String(row.deviceName ?? "").trim(), version: String(row.deviceOSVersion ?? "").trim(), port };
  });
}
function isDocument(page) {
  return Boolean(page.url) && page.title !== "JSContext";
}
function pickPage(list, match) {
  const pages = Array.isArray(list) ? list : [];
  const docs = pages.filter(isDocument);
  const seen = pages.length ? `${pages.length} page(s)` : "no pages";
  if (docs.length === 0) {
    throw new LaunchwrightError("qa.device.webkit.page", `No inspectable page (${seen}). Unlock the iPhone and open the page in Safari or the Mini App.`);
  }
  if (!match) return docs.find((p) => !String(p.url).startsWith("about:blank")) ?? docs[0];
  const needle = match.toLowerCase();
  const hit = docs.find((p) => `${p.url ?? ""} ${p.title ?? ""}`.toLowerCase().includes(needle));
  if (!hit) throw new LaunchwrightError("qa.device.webkit.page", `No page matches ${JSON.stringify(match)} (${seen}).`);
  return hit;
}
function localise(wsUrl, port) {
  const url = String(wsUrl ?? "");
  if (!/^wss?:\/\/[^/]+\//.test(url)) throw new LaunchwrightError("qa.device.webkit", "The page has no usable webSocketDebuggerUrl.");
  return url.replace(/^wss?:\/\/[^/]+/, `ws://127.0.0.1:${port}`);
}
function framed(targetId, id, method, params = {}) {
  return { id, method: "Target.sendMessageToTarget", params: { targetId, message: JSON.stringify({ id, method, params }) } };
}
function unframe(raw) {
  const frame = JSON.parse(String(raw));
  if (frame.method === "Target.targetCreated") return { kind: "target-created", targetId: String(frame.params?.targetInfo?.targetId ?? "") };
  if (frame.method === "Target.dispatchMessageFromTarget") {
    const m = frame.params?.message;
    return { kind: "from-target", message: typeof m === "string" ? JSON.parse(m) : m };
  }
  return frame.method ? { kind: "other", method: frame.method } : { kind: "other" };
}
function proxyCommand(listPort, pagePort) {
  return `sudo ios_webkit_debug_proxy -c null:${listPort},:${pagePort}-${pagePort + 77}`;
}
function withTarget(deps, page, port, timeoutMs, fn) {
  const url = localise(page.webSocketDebuggerUrl, port);
  const done = deferred();
  const resolve = done.resolve;
  const reject = done.reject;
  const ws = deps.socket(url, { origin: `http://127.0.0.1:${port}` });
  const pending = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  let targetId = null;
  let nextId = 0;
  let settled = false;
  const timer = setTimeout(() => {
    finish(
      new LaunchwrightError(
        "qa.device.webkit.timeout",
        targetId ? `The page did not answer within ${timeoutMs / 1e3} s.` : `The page announced no target within ${timeoutMs / 1e3} s. The iPhone is locked, or the page is gone.`
      )
    );
  }, timeoutMs);
  function finish(error, value) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    for (const slot of pending.values()) slot.reject(new LaunchwrightError("qa.device.webkit", `${slot.method} was in flight when the session ended.`));
    pending.clear();
    listeners.clear();
    ws.onclose = null;
    ws.close();
    if (error) reject(error);
    else resolve(value);
  }
  const session = {
    send(method, params = {}) {
      return new Promise((ok, no) => {
        if (settled || !targetId) {
          no(new LaunchwrightError("qa.device.webkit", `${method} was sent outside a live target.`));
          return;
        }
        nextId += 1;
        pending.set(nextId, { method, resolve: ok, reject: no });
        ws.send(JSON.stringify(framed(targetId, nextId, method, params)));
      });
    },
    on(handler) {
      listeners.add(handler);
    }
  };
  ws.onmessage = (ev) => {
    let frame;
    try {
      frame = unframe(ev.data);
    } catch (err) {
      finish(new LaunchwrightError("qa.device.webkit", "The inspector sent a frame that is not JSON.", { cause: err }));
      return;
    }
    if (frame.kind === "target-created") {
      if (targetId) return;
      targetId = frame.targetId;
      fn(session).then(
        (v) => finish(null, v),
        (e) => finish(e instanceof Error ? e : new LaunchwrightError("qa.device.webkit", String(e)))
      );
      return;
    }
    if (frame.kind === "from-target") {
      const inner = frame.message;
      const slot = inner.id === void 0 ? void 0 : pending.get(inner.id);
      if (!slot) {
        if (inner.method) for (const h of [...listeners]) h({ method: inner.method, ...inner.params ? { params: inner.params } : {} });
        return;
      }
      pending.delete(inner.id);
      if (inner.error) slot.reject(new LaunchwrightError("qa.device.webkit", `${slot.method} failed: ${JSON.stringify(inner.error)}`));
      else slot.resolve(inner.result ?? {});
      return;
    }
    if (frame.method === "Target.targetDestroyed") finish(new LaunchwrightError("qa.device.webkit", "The page closed its inspector target."));
  };
  ws.onerror = () => finish(new LaunchwrightError("qa.device.webkit", `The inspector socket failed (${url}).`));
  ws.onclose = () => finish(new LaunchwrightError("qa.device.webkit", "The inspector socket closed before the command finished."));
  return done.promise;
}
function refuseIfThrown(reply) {
  if (!reply.wasThrown && !reply.exceptionDetails) return;
  const remote = reply.result ?? {};
  throw new LaunchwrightError("qa.device.eval", `The page threw on the iPhone: ${String(remote.description ?? remote.value ?? "unknown error").slice(0, 500)}`);
}
function unwrap(reply) {
  refuseIfThrown(reply);
  const remote = reply.result ?? {};
  if (remote.type === "undefined") return void 0;
  return "value" in remote ? remote.value : remote;
}
async function webkitEvaluate(s, expression) {
  await s.send("Runtime.enable");
  const first = await s.send("Runtime.evaluate", { expression, returnByValue: false });
  refuseIfThrown(first);
  const remote = first.result ?? {};
  if (remote.className === "Promise" && remote.objectId) return unwrap(await s.send("Runtime.awaitPromise", { promiseObjectId: remote.objectId, returnByValue: true }));
  if (remote.objectId) {
    return unwrap(await s.send("Runtime.callFunctionOn", { objectId: remote.objectId, functionDeclaration: "function () { return this; }", returnByValue: true }));
  }
  return unwrap(first);
}
async function webkitSnapshot(s) {
  const size = await webkitEvaluate(s, "({ w: innerWidth, h: innerHeight })");
  const width = Math.round(size?.w ?? 0);
  const height = Math.round(size?.h ?? 0);
  if (!(width > 0 && height > 0)) throw new LaunchwrightError("qa.device.webkit", `The page reported a ${width}x${height} viewport, which cannot be captured.`);
  await s.send("Page.enable");
  const shot = await s.send("Page.snapshotRect", { x: 0, y: 0, width, height, coordinateSystem: "Viewport" });
  const dataURL = typeof shot.dataURL === "string" ? shot.dataURL : "";
  const at = dataURL.indexOf("base64,");
  if (at === -1) throw new LaunchwrightError("qa.device.webkit", "Page.snapshotRect answered no base64 dataURL.");
  return Buffer.from(dataURL.slice(at + "base64,".length), "base64");
}
async function webkitConsole(deps, s, ms) {
  const lines = [];
  s.on((ev) => {
    if (ev.method !== "Console.messageAdded") return;
    const m = ev.params?.message ?? {};
    lines.push({ source: m.source ?? "other", level: m.level ?? "log", text: String(m.text ?? "").slice(0, 500) });
  });
  await s.send("Console.enable");
  await deps.clock.sleep(ms);
  return lines;
}
async function proxyJson(deps, port, what) {
  const url = `http://127.0.0.1:${port}/json`;
  let res;
  try {
    res = await deps.fetch(url, { signal: AbortSignal.timeout(8e3) });
  } catch (err) {
    throw new LaunchwrightError("qa.device.webkit.proxy", `The ${what} on :${port} did not answer: ${err.message}. Is ios_webkit_debug_proxy running on the rig?`, { cause: err });
  }
  if (!res.ok) throw new LaunchwrightError("qa.device.webkit.proxy", `The ${what} on :${port} answered HTTP ${res.status}.`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new LaunchwrightError("qa.device.webkit.proxy", `The ${what} on :${port} did not answer JSON.`, { cause: err });
  }
}

// src/device/services/ios-session.mts
var DEFAULT_WEBKIT_PORTS = [9221, 9222];
var INSPECTOR_TIMEOUT_MS = 2e4;
var CONSOLE_WINDOW_MS = 500;
async function webkitAccess(ctx, rig, listPort, match, udid) {
  const listLocal = await rig.forward(listPort);
  const phones = parseDeviceList(await proxyJson(ctx.deps, listLocal, "device list"));
  const phone = udid ? phones.find((p) => p.id === udid) : phones.length === 1 ? phones[0] : void 0;
  if (!phone) {
    throw new LaunchwrightError(
      "qa.device.webkit.pairing",
      udid ? `The configured iPhone is not in the proxy device list on rig ${rig.name} (${phones.length} listed). Unlock it, trust the rig, and turn on Web Inspector in Settings > Safari > Advanced.` : `The proxy on rig ${rig.name} lists ${phones.length} devices. Set the udid of the device to pick one.`
    );
  }
  const pageLocal = await rig.forward(phone.port);
  const on = async (timeoutMs, fn) => {
    const page = pickPage(await proxyJson(ctx.deps, pageLocal, "page list"), match);
    return withTarget(ctx.deps, page, pageLocal, timeoutMs, fn);
  };
  return {
    on,
    evaluate: (expression) => on(INSPECTOR_TIMEOUT_MS, (s) => webkitEvaluate(s, expression)),
    snapshot: () => on(3e4, (s) => webkitSnapshot(s)),
    async logs() {
      const lines = await on(INSPECTOR_TIMEOUT_MS + CONSOLE_WINDOW_MS, (s) => webkitConsole(ctx.deps, s, CONSOLE_WINDOW_MS));
      const at = new Date(ctx.deps.clock.now()).toISOString();
      return lines.flatMap((l) => {
        const kind = consoleLogKind(l);
        return kind ? [{ at, kind, text: l.text }] : [];
      });
    },
    async close() {
      await rig.unforward(phone.port);
      await rig.unforward(listPort);
    }
  };
}
async function deviceAccess(ctx, name, match) {
  const { resolved, rig, kind } = iosDevice(ctx, name, "ios");
  await rig.ensure();
  if (kind.simulator !== true) {
    const keys2 = deviceKeys(resolved.name, resolved.device, iosDeviceKeys);
    return webkitAccess(ctx, rig, rig.config.webkitPorts?.[0] ?? DEFAULT_WEBKIT_PORTS[0], match ?? keys2.match, keys2.udid);
  }
  const keys = deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys);
  if (!keys.inspectorPort) throw noInspector(rig.name, resolved.name);
  return webkitAccess(ctx, rig, keys.inspectorPort, match);
}
function noInspector(rig, device) {
  return new LaunchwrightError(
    "qa.device.simulator.inspector",
    `Simulator ${device} has no page access: start ios_webkit_debug_proxy on the simulator socket of rig ${rig} (-s unix:<webinspectord_sim socket>) and set qa.device.devices.${device}.inspectorPort.`
  );
}
async function loadAndWait(ctx, access, load, route) {
  const before = await access.evaluate("performance.timeOrigin");
  await load();
  await poll(
    ctx.deps.clock,
    async () => {
      try {
        const [origin, state] = await access.evaluate("[performance.timeOrigin, document.readyState]");
        return origin !== before && state !== "loading" ? true : null;
      } catch (err) {
        if (isCodedError(err) && err.code.startsWith("qa.device.webkit")) return null;
        throw err;
      }
    },
    { timeoutMs: 3e4, everyMs: 300, code: "qa.target.navigate", what: `The load of ${route}` }
  );
}
var PhoneSession = class _PhoneSession {
  constructor(ctx, opts, access, target) {
    this.ctx = ctx;
    this.opts = opts;
    this.access = access;
    this.target = target;
  }
  ctx;
  opts;
  access;
  target;
  closed = false;
  static async open(ctx, opts, target) {
    const { resolved } = iosDevice(ctx, opts.leg.device, target, false);
    const keys = deviceKeys(resolved.name, resolved.device, iosDeviceKeys);
    const access = await deviceAccess(ctx, resolved.name, keys.match ?? new URL(opts.baseUrl).host);
    return new _PhoneSession(ctx, opts, access, target);
  }
  alive(call) {
    if (this.closed) throw closedError(this.target, call);
  }
  async evaluate(expression) {
    this.alive("evaluate");
    return this.access.evaluate(expression);
  }
  async navigate(route) {
    this.alive("navigate");
    const { url } = routeUrl(this.opts.baseUrl, route);
    await loadAndWait(this.ctx, this.access, () => this.access.evaluate(hrefExpression(url)), route);
  }
  async act(_step) {
    this.alive("act");
    throw capabilityError(this.target, "input", "run an act step (it navigates by location.href only)");
  }
  async settle(rule) {
    this.alive("settle");
    await pollSettle(this.ctx.deps.clock, rule, (e) => this.access.evaluate(e), this.target);
  }
  async currentRoute() {
    this.alive("currentRoute");
    return relativeRoute(this.opts.baseUrl, String(await this.access.evaluate(ROUTE_EXPRESSION)));
  }
  async screenshot(path) {
    this.alive("screenshot");
    return writePng(path, await this.access.snapshot(), this.target);
  }
  async startVideo(_path) {
    this.alive("startVideo");
    throw capabilityError(this.target, "video", "record a video");
  }
  async stopVideo() {
    this.alive("stopVideo");
    throw capabilityError(this.target, "video", "record a video");
  }
  async trace() {
    return null;
  }
  async dump() {
    return null;
  }
  async logs() {
    this.alive("logs");
    return this.access.logs();
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.access.close();
  }
};
function iosDevice(ctx, deviceName, target, simulator) {
  const resolved = resolveDevice(ctx.config, deviceName);
  const kind = deviceKind(resolved.device.kind);
  if (kind.access !== "webkit" || simulator !== void 0 && kind.simulator === true !== simulator) {
    const drives = simulator === void 0 ? "an iOS device" : simulator ? "an iOS simulator" : "an iPhone";
    throw new LaunchwrightError("qa.device.kind", `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives ${drives}.`);
  }
  return { resolved, rig: ctx.rigs.get(resolved.rigName), kind };
}
function simulatorReadiness(name, keys) {
  if (keys.inputTool) return null;
  return `The ios-simulator target has no input tool: simctl opens URLs and films the screen, and cannot tap. No input tool is configured in qa.device.devices.${name}.inputTool, so rows with act steps are n/a on this device.`;
}
var SimulatorSession = class _SimulatorSession {
  constructor(ctx, opts, rig, udid, access, name, target) {
    this.ctx = ctx;
    this.opts = opts;
    this.rig = rig;
    this.udid = udid;
    this.access = access;
    this.name = name;
    this.target = target;
  }
  ctx;
  opts;
  rig;
  udid;
  access;
  name;
  target;
  closed = false;
  video = null;
  shots = 0;
  static async open(ctx, opts, target) {
    const { resolved, rig } = iosDevice(ctx, opts.leg.device, target, true);
    const keys = deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys);
    await rig.ensure();
    const sim = await bootedSimulator(rig, keys.udid);
    const access = keys.inspectorPort ? await deviceAccess(ctx, resolved.name, new URL(opts.baseUrl).host) : null;
    return new _SimulatorSession(ctx, opts, rig, sim.udid, access, resolved.name, target);
  }
  alive(call) {
    if (this.closed) throw closedError(this.target, call);
  }
  /** The page access, or a refusal that names the config key. */
  page() {
    if (this.access) return this.access;
    throw noInspector(this.rig.name, this.name);
  }
  remote(ext) {
    this.shots += 1;
    return `/tmp/lw-qa-${this.udid.slice(0, 8)}-${this.ctx.deps.clock.now()}-${this.shots}.${ext}`;
  }
  async evaluate(expression) {
    this.alive("evaluate");
    return this.page().evaluate(expression);
  }
  async navigate(route) {
    this.alive("navigate");
    const { url } = routeUrl(this.opts.baseUrl, route);
    if (!this.access) {
      await openUrl(this.rig, this.udid, url);
      return;
    }
    await loadAndWait(this.ctx, this.access, () => openUrl(this.rig, this.udid, url), route);
  }
  async act(_step) {
    this.alive("act");
    throw capabilityError(this.target, "input", "run an act step (simctl has no input verb)");
  }
  async settle(rule) {
    this.alive("settle");
    const page = this.page();
    await pollSettle(this.ctx.deps.clock, rule, (e) => page.evaluate(e), this.target);
  }
  async currentRoute() {
    this.alive("currentRoute");
    return relativeRoute(this.opts.baseUrl, String(await this.page().evaluate(ROUTE_EXPRESSION)));
  }
  async screenshot(path) {
    this.alive("screenshot");
    return writePng(path, await simScreenshot(this.rig, this.udid, this.remote("png")), this.target);
  }
  async startVideo(path) {
    this.alive("startVideo");
    if (this.video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session already records ${this.video.path}.`);
    const remote = this.remote("mp4");
    const pid = await startSimVideo(this.rig, this.udid, remote);
    this.video = { path, pid, remote, startedAt: this.ctx.deps.clock.now() };
  }
  async stopVideo() {
    this.alive("stopVideo");
    const video = this.video;
    if (!video) throw new LaunchwrightError("qa.target.video", `The ${this.target} session records no video; call startVideo first.`);
    this.video = null;
    await writeBytes(video.path, await stopSimVideo(this.rig, video.pid, video.remote));
    return { path: video.path, durationMs: this.ctx.deps.clock.now() - video.startedAt };
  }
  async trace() {
    return null;
  }
  async dump() {
    return null;
  }
  async logs() {
    this.alive("logs");
    return this.page().logs();
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    const video = this.video;
    this.video = null;
    if (video) await stopSimVideo(this.rig, video.pid, video.remote);
    await this.access?.close();
  }
};

// src/device/services/doctor.mts
var pass = (scope, name, detail) => ({ scope, name, ok: true, detail });
var fail = (scope, name, detail, fix, optional = false) => ({ scope, name, ok: false, detail, fix, ...optional ? { optional } : {} });
function parseScrcpyVersion(text) {
  const m = /scrcpy\s+v?(\d+(?:\.\d+)*)/i.exec(text);
  return m ? m[1].split(".").map(Number) : null;
}
function versionAtLeast(have, want) {
  for (let i = 0; i < Math.max(have.length, want.length); i += 1) {
    const a = have[i] ?? 0;
    const b = want[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}
async function guard(scope, name, fn) {
  try {
    return await fn();
  } catch (err) {
    if (isCodedError(err)) return fail(scope, name, err.code, err.message);
    throw err;
  }
}
async function toolChecks(ctx, devices) {
  const tools = ctx.config.device.tools;
  const run = (bin, args) => ctx.deps.run.run(bin, args, { timeoutMs: 15e3 });
  const android = devices.filter((d) => deviceKind(d.device.kind).access === "adb");
  const checks = [];
  if (android.length > 0) {
    const adb = await run(tools.adb, ["version"]);
    checks.push(
      adb.code === 0 ? pass("tool", "adb", out(adb).split("\n")[0]?.trim() ?? "") : fail("tool", "adb", said(adb) || `exit ${adb.code}`, 'Install Android platform-tools (sdkmanager "platform-tools", or the distro adb), or set qa.device.tools.adb.')
    );
    const usesScrcpy = android.some((d) => d.device.recorder === "scrcpy");
    const sc = await run(tools.scrcpy, ["--version"]);
    const have = sc.code === 0 ? parseScrcpyVersion(out(sc)) : null;
    const want = tools.scrcpyVersion.split(".").map(Number);
    const fix = `Install scrcpy ${tools.scrcpyVersion} or newer (github.com/Genymobile/scrcpy/releases), or set qa.device.tools.scrcpy. Older builds fail on Android 15 and later.`;
    if (!have) checks.push(fail("tool", "scrcpy", said(sc) || "not installed", fix, !usesScrcpy));
    else if (!versionAtLeast(have, want)) checks.push(fail("tool", "scrcpy", `version ${have.join(".")} is older than ${tools.scrcpyVersion}`, fix, !usesScrcpy));
    else checks.push(pass("tool", "scrcpy", `version ${have.join(".")}`));
  }
  if (devices.length > 0) {
    const ff = await run(tools.ffmpeg, ["-version"]);
    checks.push(
      ff.code === 0 ? pass("tool", "ffmpeg", out(ff).split("\n")[0]?.trim() ?? "") : fail("tool", "ffmpeg", said(ff) || "not installed", "Install ffmpeg: the blank-video check of every device video needs it. Or set qa.device.tools.ffmpeg.")
    );
  }
  return checks;
}
async function rigChecks(ctx, devices) {
  const checks = [];
  for (const name of [...new Set(devices.map((d) => d.rigName))].sort()) {
    const rig = ctx.rigs.get(name);
    if (rig.config.transport !== "ssh") continue;
    checks.push(
      await guard(`rig ${name}`, "ssh", async () => {
        await rig.ensure();
        return pass(`rig ${name}`, "ssh", `master open to ${rig.config.host}, BatchMode=yes`);
      })
    );
  }
  return checks;
}
async function androidChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const checks = [];
  const h = androidHandle(ctx, d.name, deviceKind(d.device.kind).target);
  if (h.emulator) {
    const avd = h.emulator.avd;
    checks.push(
      await guard(scope, "sdk", async () => {
        const root = await sdkRoot(h.rig);
        return root ? pass(scope, "sdk", root) : fail(scope, "sdk", `no Android SDK on rig ${h.rig.name}`, `Install the Android SDK command-line tools on rig ${h.rig.name}, then run sdkmanager "emulator" "platform-tools" and the system image of AVD ${avd}.`);
      }),
      await guard(
        scope,
        "avd",
        async () => await avdExists(h.rig, avd) ? pass(scope, "avd", avd) : fail(scope, "avd", `no AVD ${avd} on rig ${h.rig.name}`, `Create AVD ${avd} with avdmanager on rig ${h.rig.name}.`)
      ),
      await guard(
        scope,
        "boot",
        async () => pass(scope, "boot", await booted(h.adb) ? `${h.adb.serial} booted` : `${h.adb.serial} not booted; lw qa device open boots it`)
      )
    );
    return checks;
  }
  checks.push(
    await guard(scope, "pairing", async () => {
      const state = await deviceState(h.rig, h.adb.serial, ctx.deps, ctx.config.device.tools.adb);
      return state === "device" ? pass(scope, "pairing", `${h.adb.serial} attached`) : fail(scope, "pairing", `adb state ${state}`, stateFix(state, h.adb.serial, h.rig.name));
    })
  );
  if (checks.at(-1)?.ok) {
    checks.push(
      await guard(scope, "screen lock", async () => {
        const lock = await keyguard(h.adb);
        if (lock === "open") return pass(scope, "screen lock", "unlocked");
        if (lock === "swipe") return fail(scope, "screen lock", "the lock screen shows", `Dismiss it: adb -s ${h.adb.serial} shell wm dismiss-keyguard on rig ${h.rig.name}.`);
        return fail(scope, "screen lock", "locked with a PIN, pattern or password", `A person unlocks ${d.name} by hand. lw never enters a credential.`);
      })
    );
  }
  return checks;
}
async function iosChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const rig = ctx.rigs.get(d.rigName);
  const [listPort, pagePort] = [rig.config.webkitPorts?.[0] ?? DEFAULT_WEBKIT_PORTS[0], rig.config.webkitPorts?.[1] ?? DEFAULT_WEBKIT_PORTS[1]];
  const proxy = await guard(scope, "ios_webkit_debug_proxy", async () => {
    const res = await rig.exec("command -v ios_webkit_debug_proxy || true; echo ---; pgrep -x ios_webkit_debug_proxy | wc -l");
    const [head = "", tail = ""] = out(res).split("---");
    const path = head.trim().split("\n")[0] ?? "";
    if (!path) return fail(scope, "ios_webkit_debug_proxy", `not installed on rig ${rig.name}`, `Run brew install ios-webkit-debug-proxy on rig ${rig.name}.`);
    if (!(Number(tail.trim()) > 0)) {
      return fail(scope, "ios_webkit_debug_proxy", `installed on rig ${rig.name} and not running`, `Start it at the console of rig ${rig.name}: ${proxyCommand(listPort, pagePort)}. It runs under sudo, so lw never starts it.`);
    }
    return pass(scope, "ios_webkit_debug_proxy", `running on rig ${rig.name}`);
  });
  const checks = [proxy];
  if (proxy.ok) {
    checks.push(
      await guard(scope, "pairing", async () => {
        const access = await deviceAccess(ctx, d.name);
        await access.close();
        return pass(scope, "pairing", "the iPhone is in the proxy device list");
      })
    );
  }
  return checks;
}
async function simulatorChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const rig = ctx.rigs.get(d.rigName);
  const keys = deviceKeys(d.name, d.device, simulatorDeviceKeys);
  const sims = await guard(scope, "simctl", async () => {
    const all = await listSimulators(rig);
    const up = all.filter((s) => s.booted && (!keys.udid || s.udid === keys.udid));
    return up.length > 0 ? pass(scope, "simctl", `${up.length} booted simulator(s)`) : fail(scope, "simctl", "no booted simulator", `Boot the simulator at the console of rig ${rig.name}. lw never boots one: it can hold a signed-in Telegram.`);
  });
  const reason = simulatorReadiness(d.name, keys);
  return [sims, reason ? fail(scope, "input tool", "no input tool is configured", reason) : pass(scope, "input tool", String(keys.inputTool))];
}
async function cloudChecks(ctx, d) {
  const scope = `device ${d.name}`;
  const cfg = ctx.config.device.browserstack;
  return [
    await guard(scope, "browserstack", async () => pass(scope, "browserstack", budgetLine(await budget(createBrowserstackClient(cfg, ctx.deps)), cfg)))
  ];
}
function checksOf(kind) {
  if (kind.access === "adb") return androidChecks;
  if (kind.access === "webkit") return kind.simulator === true ? simulatorChecks : iosChecks;
  return cloudChecks;
}
async function collectDoctor(ctx, deviceName) {
  const names = deviceName ? [deviceName] : Object.keys(ctx.config.device.devices).sort();
  const devices = names.map((n) => resolveDevice(ctx.config, n));
  const checks = [...await toolChecks(ctx, devices), ...await rigChecks(ctx, devices)];
  const rigDown = new Set(checks.filter((c) => c.scope.startsWith("rig ") && !c.ok).map((c) => c.scope.slice(4)));
  for (const d of devices) {
    if (rigDown.has(d.rigName)) {
      checks.push(fail(`device ${d.name}`, "rig", `rig ${d.rigName} is not reachable`, `Fix the ssh check of rig ${d.rigName} first.`));
      continue;
    }
    try {
      checks.push(...await checksOf(deviceKind(d.device.kind))(ctx, d));
    } catch (err) {
      if (!isCodedError(err)) throw err;
      checks.push(fail(`device ${d.name}`, "config", err.code, err.message));
    }
  }
  return checks;
}
function formatDoctor(checks) {
  const lines = [];
  for (const c of checks) {
    const mark = c.ok ? "ok  " : c.optional ? "warn" : "FAIL";
    lines.push(`${mark} ${c.scope.padEnd(18)} ${c.name.padEnd(24)} ${c.detail}`);
    if (!c.ok && c.fix) lines.push(`     fix: ${c.fix}`);
  }
  const blocking = checks.filter((c) => !c.ok && !c.optional).length;
  lines.push(blocking === 0 ? "verdict: ready" : `verdict: ${blocking} check(s) fail`);
  return lines;
}

export {
  registerDeviceKind,
  deviceKindNames,
  deviceKind,
  hostProxyConfig,
  deviceToolsConfig,
  telegramDeviceConfig,
  browserstackConfig,
  rigConfig,
  deviceConfig,
  qaDeviceConfig,
  withDevice,
  qaConfigOf2 as qaConfigOf,
  androidDeviceKeys,
  emulatorDeviceKeys,
  iosDeviceKeys,
  simulatorDeviceKeys,
  cloudDeviceKeys,
  deviceKeys,
  DEFAULT_RUN_TIMEOUT_MS,
  NO_TIMEOUT,
  systemDeviceDeps,
  poll,
  deviceState,
  parseNodes,
  findNode,
  uiDump,
  screencap,
  tap,
  backGesture,
  keyevent,
  wmSize,
  startScreenrecord,
  processBelongsTo,
  sockets,
  forwardSocket,
  removeForward,
  ROUTE_EXPRESSION,
  routeUrl,
  relativeRoute,
  openVisiblePage,
  logLineOf,
  DEVICE_STATE_DIR,
  resolveDevice,
  createDeviceContext,
  avdExists,
  bootEmulator,
  stopEmulator,
  snapshotAvd,
  listSnapshots,
  restoreAvd,
  DEFAULT_PROXY_PORT,
  clearIngress,
  ensureIngress,
  capabilityError,
  closedError,
  pollSettle,
  pageAct,
  writePng,
  writeBytes,
  consoleLogKind,
  waitAct,
  installTelegram,
  miniAppLink,
  viewIntent,
  forceStop,
  androidHandle,
  stateFix,
  AndroidSession,
  createBrowserstackClient,
  capabilities,
  asyncScript,
  budgetLine,
  budget,
  readHeld,
  writeHeld,
  checkBudget,
  bootedSimulator,
  simScreenshot,
  startSimVideo,
  stopSimVideo,
  webkitEvaluate,
  webkitSnapshot,
  webkitConsole,
  deviceAccess,
  PhoneSession,
  iosDevice,
  simulatorReadiness,
  SimulatorSession,
  collectDoctor,
  formatDoctor
};
//# sourceMappingURL=chunk-33RJBPBQ.js.map