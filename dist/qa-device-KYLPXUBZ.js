import {
  DEFAULT_PROXY_PORT,
  DEVICE_STATE_DIR,
  NO_TIMEOUT,
  androidHandle,
  asyncScript,
  backGesture,
  bootEmulator,
  bootedSimulator,
  budget,
  budgetLine,
  capabilities,
  clearIngress,
  cloudDeviceKeys,
  collectDoctor,
  createBrowserstackClient,
  createDeviceContext,
  deviceAccess,
  deviceKeys,
  deviceKind,
  ensureIngress,
  findNode,
  forceStop,
  formatDoctor,
  forwardSocket,
  installTelegram,
  iosDevice,
  keyevent,
  listSnapshots,
  logLineOf,
  miniAppLink,
  openVisiblePage,
  parseNodes,
  processBelongsTo,
  qaConfigOf,
  readHeld,
  removeForward,
  resolveDevice,
  restoreAvd,
  screencap,
  simScreenshot,
  simulatorDeviceKeys,
  snapshotAvd,
  sockets,
  startScreenrecord,
  startSimVideo,
  stopEmulator,
  stopSimVideo,
  systemDeviceDeps,
  tap,
  uiDump,
  viewIntent,
  webkitConsole,
  webkitEvaluate,
  webkitSnapshot,
  wmSize,
  writeBytes,
  writeHeld
} from "./chunk-HTDFJ5EK.js";
import "./chunk-DP3BJCQL.js";
import "./chunk-PYBSJLYL.js";
import "./chunk-Y3DM4XPJ.js";
import "./chunk-W4O3YTED.js";
import "./chunk-53M6IOKX.js";
import "./chunk-7YME3OFL.js";
import "./chunk-N6G3DBRC.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import "./chunk-7U5DCOOY.js";
import "./chunk-I3IUHHIW.js";
import "./chunk-4M4L73SK.js";
import "./chunk-4HWKGNXL.js";
import "./chunk-JPCS27IP.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import "./chunk-I4K4P4GZ.js";
import {
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import "./chunk-RGX37KPN.js";
import "./chunk-W6MGERRV.js";
import "./chunk-ZRBKWAMJ.js";
import "./chunk-OSGSGOS2.js";
import "./chunk-B3YQ27NA.js";
import "./chunk-42WWWMVO.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-KCJ7A64B.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-RFUDK5EX.js";
import "./chunk-APRIQSSG.js";
import "./chunk-OF544TQR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-TQCRYULZ.js";
import "./chunk-SA2YN55L.js";
import "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/device/services/device-verbs.mts
import { readFile } from "fs/promises";
import { join, resolve } from "path";

// src/device/services/probes.mts
var VIDEO_PROBE = `(function () {
  function kind(v) {
    var s = v.currentSrc || v.getAttribute('src') || '';
    if (!s) return 'none';
    if (s.indexOf('blob:') === 0) return 'blob (MediaSource)';
    if (/\\.m3u8/.test(s)) return 'm3u8 (native HLS)';
    if (/\\.mp4/.test(s)) return 'mp4';
    return 'other';
  }
  function sample(v) {
    try {
      var c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      var g = c.getContext('2d');
      g.drawImage(v, 0, 0, 32, 32);
      var d = g.getImageData(0, 0, 32, 32).data, sum = 0, max = 0;
      for (var i = 0; i < d.length; i += 4) {
        var l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += l;
        if (l > max) max = l;
      }
      return { meanLuma: Math.round(sum / 1024), maxLuma: Math.round(max) };
    } catch (e) {
      return { error: String(e) };
    }
  }
  function label(el) {
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
  }
  var out = { href: location.href, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight, mse: typeof MediaSource, mms: typeof ManagedMediaSource, videos: [] };
  Array.prototype.slice.call(document.querySelectorAll('video')).forEach(function (v, i) {
    var r = v.getBoundingClientRect();
    var q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
    var rec = {
      i: i, kind: kind(v), readyState: v.readyState, networkState: v.networkState, paused: v.paused, muted: v.muted,
      t: +v.currentTime.toFixed(2), dur: +(v.duration || 0).toFixed(1), w: v.videoWidth, h: v.videoHeight,
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      quality: q ? { total: q.totalVideoFrames, dropped: q.droppedVideoFrames } : null
    };
    if (v.readyState >= 2) rec.luma = sample(v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    if (r.width > 0 && cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) {
      var hit = document.elementFromPoint(cx, cy);
      rec.atCentre = hit ? label(hit) : null;
    }
    out.videos.push(rec);
  });
  return out;
})()`;
var PROBES = { video: VIDEO_PROBE };

// src/device/services/device-verbs.mts
var VERBS = ["list", "doctor", "open", "eval", "logs", "mirror", "tap", "point", "back", "key", "shot", "record", "snapshot", "restore", "install", "down", "budget"];
async function expressionOf(rest, cwd) {
  const arg = rest.join(" ").trim();
  if (!arg) throw new LaunchwrightError("qa.device.usage", "Give an expression, or @path/to/file.js.");
  return arg.startsWith("@") ? readFile(resolve(cwd, arg.slice(1)), "utf8") : arg;
}
function str(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 1);
}
var DeviceVerbs = class {
  constructor(ctx, opts) {
    this.ctx = ctx;
    this.opts = opts;
  }
  ctx;
  opts;
  get config() {
    return this.ctx.config;
  }
  /** The device, its kind and the traits of its kind. The verbs read the traits, never the kind name. */
  kind(device) {
    const r = resolveDevice(this.config, device);
    return { name: r.name, kind: r.device.kind, traits: deviceKind(r.device.kind) };
  }
  android(device) {
    const { name, kind, traits } = this.kind(device);
    if (traits.access !== "adb") {
      throw new LaunchwrightError("qa.device.verb", `Device ${name} is ${kind}; this verb drives an Android device.`);
    }
    return androidHandle(this.ctx, name, traits.target);
  }
  emulator(device) {
    const h = this.android(device);
    if (!h.emulator) throw new LaunchwrightError("qa.device.verb", `Device ${h.resolved.name} is a phone; snapshot and restore work on an emulator.`);
    return h;
  }
  /** Boots the emulator of an emulator handle, and says whether it was up. A phone needs nothing. */
  async bootIfEmulator(h) {
    if (!h.emulator) return;
    this.out(`emulator ${await bootEmulator(h.rig, h.adb, h.emulator, this.ctx.deps) === "already" ? "already booted" : "booted"}`);
  }
  out(line) {
    this.opts.out(line);
  }
  file(given, name, ext) {
    return given ? resolve(this.opts.cwd, given) : join(this.ctx.deps.root, DEVICE_STATE_DIR, `${name}.${ext}`);
  }
  /** Attaches to the visible WebView page of an Android device and runs `fn` with its client. */
  async onAndroidPage(h, pkg, fn, onEvent) {
    await h.rig.ensure();
    const found = await sockets(h.adb, pkg);
    const sock = found.find((s) => s.process !== null && processBelongsTo(s.process, pkg)) ?? found.find((s) => s.kind === "webview") ?? found[0];
    if (!sock) throw new LaunchwrightError("qa.device.webview", `No debuggable WebView on ${h.adb.serial}. Open the page first with lw qa device open.`);
    const fwd = await forwardSocket(h.adb, sock.name);
    const local = await h.rig.forward(fwd.port);
    const page = await openVisiblePage(this.ctx.deps, local, onEvent);
    try {
      return await fn(page);
    } finally {
      page.client.close();
      if (!fwd.reused) {
        await h.rig.unforward(fwd.port);
        await removeForward(h.adb, fwd.port);
      }
    }
  }
  async run(verb, p) {
    switch (verb) {
      case "list":
        return this.list();
      case "doctor": {
        const checks = await collectDoctor(this.ctx, p.device);
        for (const line of formatDoctor(checks)) this.out(line);
        return checks.some((c) => !c.ok && !c.optional) ? 1 : 0;
      }
      case "open":
        return this.open(p);
      case "eval":
        return this.evaluate(p);
      case "logs":
        return this.logs(p);
      case "mirror":
        return this.mirror(p);
      case "tap": {
        const h = this.android(p.device);
        const needle = p.rest.join(" ");
        if (!needle) throw new LaunchwrightError("qa.device.usage", "Give the label to tap.");
        const xml = await uiDump(h.adb);
        if (!xml) throw new LaunchwrightError("qa.device.dump", `uiautomator dump on ${h.adb.serial} failed: the UI may be animating. Try again.`);
        const node = findNode(parseNodes(xml), needle);
        if (!node?.bounds) throw new LaunchwrightError("qa.device.tap", `No control on ${h.adb.serial} has a label with ${JSON.stringify(needle)}.`);
        const fx = typeof p.flags.x === "string" ? Number(p.flags.x) : 0.5;
        const x = node.bounds.x1 + (node.bounds.x2 - node.bounds.x1) * fx;
        const y = (node.bounds.y1 + node.bounds.y2) / 2;
        await tap(h.adb, x, y);
        this.out(`tapped ${JSON.stringify(node.text || node.desc)} at ${Math.round(x)},${Math.round(y)}`);
        return 0;
      }
      case "point": {
        const [x, y] = p.rest.map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new LaunchwrightError("qa.device.usage", "Give x and y.");
        if (this.kind(p.device).traits.access === "webdriver") {
          await this.cloud(
            p.device,
            (wd, id) => wd("POST", `/session/${id}/actions`, {
              actions: [
                {
                  type: "pointer",
                  id: "finger1",
                  parameters: { pointerType: "touch" },
                  actions: [{ type: "pointerMove", duration: 0, x, y, origin: "viewport" }, { type: "pointerDown", button: 0 }, { type: "pause", duration: 80 }, { type: "pointerUp", button: 0 }]
                }
              ]
            })
          );
        } else {
          await tap(this.android(p.device).adb, x, y);
        }
        this.out(`tapped ${x},${y}`);
        return 0;
      }
      case "back": {
        if (this.kind(p.device).traits.access === "webdriver") await this.cloud(p.device, (wd, id) => wd("POST", `/session/${id}/back`, {}));
        else {
          const h = this.android(p.device);
          await backGesture(h.adb, (await wmSize(h.adb)).height);
        }
        this.out("back gesture sent");
        return 0;
      }
      case "key": {
        const h = this.android(p.device);
        const code = p.rest[0] ?? "KEYCODE_BACK";
        await keyevent(h.adb, code);
        this.out(`keyevent ${code}`);
        return 0;
      }
      case "shot":
        return this.shot(p);
      case "record":
        return this.record(p);
      case "snapshot": {
        const h = this.emulator(p.device);
        const path = await snapshotAvd(h.rig, h.emulator.avd, p.rest[0] ?? "", this.ctx.deps.clock.now());
        this.out(`snapshot ${path}`);
        return 0;
      }
      case "restore": {
        const h = this.emulator(p.device);
        const from = await restoreAvd(h.rig, h.adb, h.emulator.avd, p.rest[0], p.flags.force === true);
        this.out(`restored AVD ${h.emulator.avd} from ${from}`);
        const left = await listSnapshots(h.rig, h.emulator.avd);
        this.out(`${left.length} snapshot(s) on rig ${h.rig.name}`);
        return 0;
      }
      case "install": {
        const h = this.android(p.device);
        await h.rig.ensure();
        await this.bootIfEmulator(h);
        const path = await installTelegram(h.adb, this.config.device.telegram, this.ctx.deps, p.flags.force === true);
        this.out(`installed ${this.config.device.telegram.package} from ${path} (sha256 matches the pin) on ${h.resolved.name}`);
        return 0;
      }
      case "down":
        return this.down(p);
      case "budget": {
        const cfg = this.config.device.browserstack;
        this.out(budgetLine(await budget(createBrowserstackClient(cfg, this.ctx.deps)), cfg));
        const held = await readHeld(this.ctx.deps.root);
        this.out(held ? `held session on ${held.device}, open ${Math.round((this.ctx.deps.clock.now() - held.startedAt) / 1e3)} s: run lw qa device down` : "no session held");
        return 0;
      }
    }
  }
  list() {
    const { rigs, devices } = this.config.device;
    for (const [name, rig] of Object.entries(rigs).sort()) {
      this.out(`rig    ${name.padEnd(16)} ${rig.transport}${rig.host ? ` ${rig.host}` : ""}${rig.transport === "ssh" ? `, ingress ${rig.ingress}` : ""}`);
    }
    for (const [name, d] of Object.entries(devices).sort()) this.out(`device ${name.padEnd(16)} ${d.kind.padEnd(17)} rig ${d.rig}`);
    if (Object.keys(devices).length === 0) this.out("no devices in qa.device.devices");
    return 0;
  }
  /** One call on the held BrowserStack session. */
  async cloud(device, fn) {
    this.kind(device);
    const held = await readHeld(this.ctx.deps.root);
    if (!held) throw new LaunchwrightError("qa.device.browserstack.session", "No BrowserStack session is held. Run lw qa device open --url <url> first.");
    const client = createBrowserstackClient(this.config.device.browserstack, this.ctx.deps);
    return fn((m, path, body) => client.wd(m, path, body), held.id);
  }
  async open(p) {
    const { name, kind, traits } = this.kind(p.device);
    const url = typeof p.flags.url === "string" ? p.flags.url : void 0;
    const bot = typeof p.flags.bot === "string" ? p.flags.bot : void 0;
    if (traits.access === "webdriver") {
      if (!url) throw new LaunchwrightError("qa.device.usage", "open on a cloud device needs --url.");
      const cfg = this.config.device.browserstack;
      const client = createBrowserstackClient(cfg, this.ctx.deps);
      this.out(budgetLine(await budget(client), cfg));
      const keys = deviceKeys(name, resolveDevice(this.config, name).device, cloudDeviceKeys);
      const created = await client.wd("POST", "/session", capabilities(kind, keys, cfg, `lw qa device ${name}`), 3e5);
      await writeHeld(this.ctx.deps.root, { id: created.sessionId, device: name, startedAt: this.ctx.deps.clock.now() });
      await client.wd("POST", `/session/${created.sessionId}/url`, { url });
      this.out(`BrowserStack session open on ${name} at ${url}. It spends minutes until lw qa device down.`);
      return 0;
    }
    if (traits.access === "webkit") {
      const access = await deviceAccess(this.ctx, name);
      await access.close();
      this.out(`${name}: the inspector proxy answers. Open the page on the device; lw qa device eval reaches it.`);
      return 0;
    }
    const h = this.android(name);
    if (!url && !bot) throw new LaunchwrightError("qa.device.usage", "open needs --bot <bot username> for a Mini App or --url <url> for the browser.");
    await h.rig.ensure();
    await this.bootIfEmulator(h);
    const pkg = bot ? this.config.device.telegram.package : h.browserPackage;
    if (url) {
      const ingress = await ensureIngress(h.adb, h.rig, this.ctx.deps, url);
      this.out(`ingress ${ingress.mode}${ingress.changed ? ", proxy setting changed" : ""}`);
      if (ingress.changed) await forceStop(h.adb, pkg);
    }
    await viewIntent(h.adb, bot ? miniAppLink(bot) : url, pkg);
    const title = await this.onAndroidPage(h, pkg, async (page) => `${page.target.title ?? ""} ${page.target.url ?? ""}`.trim());
    this.out(`attached: ${title}`);
    return 0;
  }
  async evaluate(p) {
    const probe = typeof p.flags.probe === "string" ? p.flags.probe : void 0;
    if (probe !== void 0 && !PROBES[probe]) throw new LaunchwrightError("qa.device.usage", `No probe ${probe}. Probes: ${Object.keys(PROBES).join(", ")}.`);
    const expr = probe ? PROBES[probe] : await expressionOf(p.rest, this.opts.cwd);
    const { name, traits } = this.kind(p.device);
    let value;
    if (traits.access === "webdriver") {
      const answer = await this.cloud(name, (wd, id) => wd("POST", `/session/${id}/execute/async`, { script: asyncScript(expr), args: [] }));
      if (!answer?.ok) throw new LaunchwrightError("qa.device.eval", `The page threw: ${answer?.error ?? "no answer"}`);
      value = answer.value;
    } else if (traits.access === "webkit") {
      value = await this.onIosPage(name, p, 3e4, (s) => webkitEvaluate(s, expr));
    } else {
      const h = this.android(name);
      const pkg = typeof p.flags.package === "string" ? p.flags.package : this.config.device.telegram.package;
      value = await this.onAndroidPage(h, pkg, (page) => page.client.evaluate(expr));
    }
    this.out(str(value));
    return 0;
  }
  /** Runs `fn` in one inspector session on the page of an iOS device. `--match` picks the page. */
  async onIosPage(name, p, timeoutMs, fn) {
    const access = await deviceAccess(this.ctx, name, typeof p.flags.match === "string" ? p.flags.match : void 0);
    try {
      return await access.on(timeoutMs, fn);
    } finally {
      await access.close();
    }
  }
  async logs(p) {
    const seconds = Number(p.rest[0] ?? 15);
    if (!(seconds > 0)) throw new LaunchwrightError("qa.device.usage", "logs takes a number of seconds.");
    const { name, traits } = this.kind(p.device);
    if (traits.access === "webdriver") throw new LaunchwrightError("qa.device.verb", "WebDriver on a cloud phone exposes no console. The BrowserStack dashboard keeps the session log.");
    this.out(`collecting for ${seconds} s`);
    if (traits.access === "webkit") {
      const lines2 = await this.onIosPage(name, p, seconds * 1e3 + 2e4, (s) => webkitConsole(this.ctx.deps, s, seconds * 1e3));
      for (const l of lines2) this.out(`${`${l.source}.${l.level}`.padEnd(22)} ${l.text}`);
      if (lines2.length === 0) this.out("nothing logged");
      return 0;
    }
    const h = this.android(name);
    const pkg = typeof p.flags.package === "string" ? p.flags.package : this.config.device.telegram.package;
    const lines = [];
    await this.onAndroidPage(
      h,
      pkg,
      async (page) => {
        for (const d of ["Runtime.enable", "Log.enable", "Network.enable"]) await page.client.send(d);
        await this.ctx.deps.clock.sleep(seconds * 1e3);
      },
      (ev) => {
        if (ev.method === "Runtime.consoleAPICalled") {
          const params = ev.params;
          lines.push(`${`console.${params.type}`.padEnd(22)} ${(params.args ?? []).map((a) => str(a.value ?? a.description)).join(" ").slice(0, 300)}`);
          return;
        }
        const line = logLineOf(ev, "");
        if (line) lines.push(`${line.kind.padEnd(22)} ${line.text}`);
      }
    );
    for (const l of lines) this.out(l);
    if (lines.length === 0) this.out("nothing logged");
    return 0;
  }
  async mirror(p) {
    const h = this.android(p.device);
    await h.rig.ensure();
    const args = ["-s", h.adb.serial, "--stay-awake", "--window-title", `${h.resolved.name} (${h.rig.name})`];
    const env = {};
    if (h.rig.remote) {
      const port = await this.ctx.deps.freePort();
      await h.rig.forward(port, port);
      args.push("--force-adb-forward", "-p", String(port));
      env.ANDROID_ADB_SERVER_PORT = String(await h.rig.adbPort());
    }
    this.ctx.deps.run.start(this.config.device.tools.scrcpy, args, { env, detached: true, timeoutMs: NO_TIMEOUT });
    this.out(`scrcpy started for ${h.resolved.name}; the window is on this machine`);
    return 0;
  }
  async shot(p) {
    const { name, traits } = this.kind(p.device);
    const path = this.file(p.rest[0], name, "png");
    let bytes;
    if (traits.access === "webdriver") bytes = Buffer.from(String(await this.cloud(name, (wd, id) => wd("GET", `/session/${id}/screenshot`))), "base64");
    else if (traits.access === "webkit" && traits.simulator === true) {
      const { resolved, rig } = iosDevice(this.ctx, name, traits.target, true);
      await rig.ensure();
      const sim = await bootedSimulator(rig, deviceKeys(name, resolved.device, simulatorDeviceKeys).udid);
      bytes = await simScreenshot(rig, sim.udid, `/tmp/lw-qa-shot-${this.ctx.deps.clock.now()}.png`);
    } else if (traits.access === "webkit") {
      bytes = await this.onIosPage(name, p, 3e4, (s) => webkitSnapshot(s));
    } else {
      const h = this.android(name);
      await h.rig.ensure();
      bytes = await screencap(h.adb);
    }
    await writeBytes(path, bytes);
    this.out(`${bytes.length} bytes -> ${path}`);
    return 0;
  }
  async record(p) {
    const seconds = Number(p.rest[0]);
    const cap = this.config.evidence.videoCapS;
    if (!(seconds > 0) || seconds > cap) throw new LaunchwrightError("qa.device.usage", `record takes 1 to ${cap} seconds (qa.evidence.videoCapS).`);
    const { name, kind, traits } = this.kind(p.device);
    const path = this.file(p.rest[1], name, "mp4");
    if (traits.access === "webkit" && traits.simulator === true) {
      const { resolved, rig } = iosDevice(this.ctx, name, traits.target, true);
      await rig.ensure();
      const sim = await bootedSimulator(rig, deviceKeys(name, resolved.device, simulatorDeviceKeys).udid);
      const remote = `/tmp/lw-qa-rec-${this.ctx.deps.clock.now()}.mp4`;
      const pid = await startSimVideo(rig, sim.udid, remote);
      await this.ctx.deps.clock.sleep(seconds * 1e3);
      await writeBytes(path, await stopSimVideo(rig, pid, remote));
    } else if (traits.access === "adb") {
      const h = this.android(name);
      await h.rig.ensure();
      const rec = await startScreenrecord(h.adb, this.ctx.deps, seconds + 1, name);
      await this.ctx.deps.clock.sleep(seconds * 1e3);
      await writeBytes(path, await rec.stop());
    } else {
      throw new LaunchwrightError("qa.device.verb", `Device ${name} is ${kind}: it has no recorder here. A BrowserStack session keeps its own video.`);
    }
    this.out(`${seconds} s -> ${path}`);
    return 0;
  }
  async down(p) {
    const names = p.device ? [p.device] : Object.keys(this.config.device.devices).sort();
    for (const name of names) {
      const { traits } = this.kind(name);
      if (traits.access === "webdriver") {
        const held = await readHeld(this.ctx.deps.root);
        if (held && held.device === name) {
          await createBrowserstackClient(this.config.device.browserstack, this.ctx.deps).wd("DELETE", `/session/${held.id}`);
          await writeHeld(this.ctx.deps.root, null);
          this.out(`${name}: BrowserStack session ended after ${Math.round((this.ctx.deps.clock.now() - held.startedAt) / 1e3)} s`);
        }
        continue;
      }
      if (traits.access !== "adb") continue;
      const h = this.android(name);
      await h.rig.ensure();
      const state = (await h.adb.run(["get-state"])).code === 0;
      if (!state) {
        this.out(`${name}: not attached`);
        continue;
      }
      const cleared = await clearIngress(h.adb, h.rig.config.hostProxy?.port ?? DEFAULT_PROXY_PORT);
      if (cleared) this.out(`${name}: ingress proxy setting cleared`);
      if (h.emulator) {
        await stopEmulator(h.rig, h.adb, this.ctx.deps);
        this.out(`${name}: emulator stopped cleanly`);
      }
    }
    if (!p.device) {
      await this.ctx.rigs.downAll();
      this.out("ssh masters closed");
    }
    return 0;
  }
};

// src/device/commands/qa-device.mts
var USAGE = `usage: lw qa device <verb> [--device <name>] [args]
  list                       rigs and devices from qa.device
  doctor                     ssh, adb, the SDK, ios_webkit_debug_proxy, scrcpy, ffmpeg and pairing, each with its fix
  open --bot <bot> | --url <url>   boot, apply the ingress, open the Mini App or the page, attach
  eval <js | @file>          evaluate in the visible page; --probe video reads every <video>
  logs [seconds]             page errors, console output and failed requests (default 15 s)
  mirror                     scrcpy the Android screen onto this machine
  tap <label> [--x 0..1]     tap a native control by its accessibility label
  point <x> <y>              tap a screen point
  back                       the system back gesture
  key <code>                 an Android keyevent
  shot [file]                a PNG of the screen
  record <seconds> [file]    a video of the screen
  snapshot [label]           copy the AVD folder on the rig (cp -c)
  restore [path] --force     put a snapshot back over the AVD
  install [--force]          the pinned Telegram APK
  down                       stop the emulator, clear the ingress, close the ssh master, end a BrowserStack session
  budget                     BrowserStack minutes used and the per-run budget`;
function parseDeviceArgs(args) {
  const parsed = parseCommandArgs({ values: ["device", "bot", "url", "x", "match", "package", "probe"], switches: ["force"] }, args);
  const flags = { ...parsed.values };
  for (const name of parsed.switches) flags[name] = true;
  return { device: parsed.values.device, flags, rest: parsed.positionals };
}
async function runDeviceCommand(args, opts, deps = systemDeviceDeps(opts.cwd, opts.processEnv)) {
  const [verb, ...rest] = args;
  if (!verb || verb === "--help" || verb === "-h" || !VERBS.includes(verb)) {
    if (verb && verb !== "--help" && verb !== "-h") opts.err(`lw qa device: unknown verb ${verb}`);
    opts.err(USAGE);
    return 2;
  }
  let parsed;
  let ctx;
  try {
    parsed = parseDeviceArgs(rest);
    ctx = createDeviceContext(qaConfigOf(opts.config), deps);
  } catch (err) {
    if (!isCodedError(err)) throw err;
    opts.err(`lw qa device ${verb}: ${err.message}`);
    return 2;
  }
  try {
    return await new DeviceVerbs(ctx, opts).run(verb, parsed);
  } catch (err) {
    if (!isCodedError(err)) throw err;
    opts.err(`lw qa device ${verb}: ${err.message} [${err.code}]`);
    return err.code === "qa.device.usage" ? 2 : 1;
  }
}
var qaDevice = {
  name: "device",
  summary: "Rigs and devices: list, doctor, open, eval, logs, mirror, tap, shot, record, snapshot, restore, install, down, budget",
  run: (args, opts) => runDeviceCommand(args, opts)
};
var qa_device_default = qaDevice;
export {
  qa_device_default as default,
  parseDeviceArgs,
  runDeviceCommand
};
//# sourceMappingURL=qa-device-KYLPXUBZ.js.map