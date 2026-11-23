// The verbs of `lw qa device` (QA spec 2.9): drive one configured device by hand, outside a QA
// run. Each verb reports through `out`. Captures here are for diagnosis: report evidence comes
// only from `lw qa session` (spec 2.11.5).
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { cloudDeviceKeys, deviceKeys, type QaConfig, simulatorDeviceKeys } from '../config.mts';
import { backGesture, findNode, forwardSocket, keyevent, parseNodes, processBelongsTo, removeForward, screencap, sockets, startScreenrecord, tap, uiDump, wmSize } from './adb.mts';
import { type AndroidHandle, androidHandle } from './android-session.mts';
import {
  asyncScript,
  budget,
  budgetLine,
  capabilities,
  createBrowserstackClient,
  readHeld,
  writeHeld,
} from './browserstack.mts';
import { type CdpEvent, logLineOf, openVisiblePage } from './cdp.mts';
import { type DeviceKind, deviceKind } from './device-kinds.mts';
import { collectDoctor, formatDoctor } from './doctor.mts';
import { bootEmulator, listSnapshots, restoreAvd, snapshotAvd, stopEmulator } from './emulator.mts';
import { clearIngress, DEFAULT_PROXY_PORT, ensureIngress } from './ingress.mts';
import { deviceAccess, iosDevice } from './ios-session.mts';
import { PROBES } from './probes.mts';
import { NO_TIMEOUT } from './process.mts';
import { type DeviceContext, DEVICE_STATE_DIR, resolveDevice } from './rigs.mts';
import { bootedSimulator, simScreenshot, startSimVideo, stopSimVideo } from './simctl.mts';
import { forceStop, installTelegram, miniAppLink, viewIntent } from './telegram.mts';
import { type WebkitSession as InspectorSession, webkitConsole, webkitEvaluate, webkitSnapshot } from './webkit.mts';
import { writeBytes } from './session-base.mts';

export const VERBS = ['list', 'doctor', 'open', 'eval', 'logs', 'mirror', 'tap', 'point', 'back', 'key', 'shot', 'record', 'snapshot', 'restore', 'install', 'down', 'budget'] as const;
export type Verb = (typeof VERBS)[number];

/** The parsed arguments of one verb. */
export interface VerbArgs {
  device: string | undefined;
  flags: Record<string, string | true>;
  rest: string[];
}

/** Where the verbs resolve a file name and write their output, one line at a time. */
export interface DeviceVerbsIo {
  cwd: string;
  out: (line: string) => void;
}

/** Reads `@file` or returns the expression as it is. */
async function expressionOf(rest: string[], cwd: string): Promise<string> {
  const arg = rest.join(' ').trim();
  if (!arg) throw new LaunchwrightError('qa.device.usage', 'Give an expression, or @path/to/file.js.');
  return arg.startsWith('@') ? readFile(resolve(cwd, arg.slice(1)), 'utf8') : arg;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 1);
}

export class DeviceVerbs {
  constructor(
    private readonly ctx: DeviceContext,
    private readonly opts: DeviceVerbsIo,
  ) {}

  private get config(): QaConfig {
    return this.ctx.config;
  }

  /** The device, its kind and the traits of its kind. The verbs read the traits, never the kind name. */
  private kind(device: string | undefined): { name: string; kind: string; traits: DeviceKind } {
    const r = resolveDevice(this.config, device);
    return { name: r.name, kind: r.device.kind, traits: deviceKind(r.device.kind) };
  }

  private android(device: string | undefined): AndroidHandle {
    const { name, kind, traits } = this.kind(device);
    if (traits.access !== 'adb') {
      throw new LaunchwrightError('qa.device.verb', `Device ${name} is ${kind}; this verb drives an Android device.`);
    }
    return androidHandle(this.ctx, name, traits.target);
  }

  private emulator(device: string | undefined): AndroidHandle & { emulator: NonNullable<AndroidHandle['emulator']> } {
    const h = this.android(device);
    if (!h.emulator) throw new LaunchwrightError('qa.device.verb', `Device ${h.resolved.name} is a phone; snapshot and restore work on an emulator.`);
    return h as AndroidHandle & { emulator: NonNullable<AndroidHandle['emulator']> };
  }

  /** Boots the emulator of an emulator handle, and says whether it was up. A phone needs nothing. */
  private async bootIfEmulator(h: AndroidHandle): Promise<void> {
    if (!h.emulator) return;
    this.out(`emulator ${(await bootEmulator(h.rig, h.adb, h.emulator, this.ctx.deps)) === 'already' ? 'already booted' : 'booted'}`);
  }

  private out(line: string): void {
    this.opts.out(line);
  }

  private file(given: string | undefined, name: string, ext: string): string {
    return given ? resolve(this.opts.cwd, given) : join(this.ctx.deps.root, DEVICE_STATE_DIR, `${name}.${ext}`);
  }

  /** Attaches to the visible WebView page of an Android device and runs `fn` with its client. */
  private async onAndroidPage<T>(h: AndroidHandle, pkg: string, fn: (page: Awaited<ReturnType<typeof openVisiblePage>>) => Promise<T>, onEvent?: (ev: CdpEvent) => void): Promise<T> {
    await h.rig.ensure();
    const found = await sockets(h.adb, pkg);
    const sock = found.find((s) => s.process !== null && processBelongsTo(s.process, pkg)) ?? found.find((s) => s.kind === 'webview') ?? found[0];
    if (!sock) throw new LaunchwrightError('qa.device.webview', `No debuggable WebView on ${h.adb.serial}. Open the page first with lw qa device open.`);
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

  async run(verb: Verb, p: VerbArgs): Promise<number> {
    switch (verb) {
      case 'list':
        return this.list();
      case 'doctor': {
        const checks = await collectDoctor(this.ctx, p.device);
        for (const line of formatDoctor(checks)) this.out(line);
        return checks.some((c) => !c.ok && !c.optional) ? 1 : 0;
      }
      case 'open':
        return this.open(p);
      case 'eval':
        return this.evaluate(p);
      case 'logs':
        return this.logs(p);
      case 'mirror':
        return this.mirror(p);
      case 'tap': {
        const h = this.android(p.device);
        const needle = p.rest.join(' ');
        if (!needle) throw new LaunchwrightError('qa.device.usage', 'Give the label to tap.');
        const xml = await uiDump(h.adb);
        if (!xml) throw new LaunchwrightError('qa.device.dump', `uiautomator dump on ${h.adb.serial} failed: the UI may be animating. Try again.`);
        const node = findNode(parseNodes(xml), needle);
        if (!node?.bounds) throw new LaunchwrightError('qa.device.tap', `No control on ${h.adb.serial} has a label with ${JSON.stringify(needle)}.`);
        const fx = typeof p.flags.x === 'string' ? Number(p.flags.x) : 0.5;
        const x = node.bounds.x1 + (node.bounds.x2 - node.bounds.x1) * fx;
        const y = (node.bounds.y1 + node.bounds.y2) / 2;
        await tap(h.adb, x, y);
        this.out(`tapped ${JSON.stringify(node.text || node.desc)} at ${Math.round(x)},${Math.round(y)}`);
        return 0;
      }
      case 'point': {
        const [x, y] = p.rest.map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new LaunchwrightError('qa.device.usage', 'Give x and y.');
        if (this.kind(p.device).traits.access === 'webdriver') {
          await this.cloud(p.device, (wd, id) =>
            wd('POST', `/session/${id}/actions`, {
              actions: [
                {
                  type: 'pointer',
                  id: 'finger1',
                  parameters: { pointerType: 'touch' },
                  actions: [{ type: 'pointerMove', duration: 0, x, y, origin: 'viewport' }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 }, { type: 'pointerUp', button: 0 }],
                },
              ],
            }),
          );
        } else {
          await tap(this.android(p.device).adb, x as number, y as number);
        }
        this.out(`tapped ${x},${y}`);
        return 0;
      }
      case 'back': {
        if (this.kind(p.device).traits.access === 'webdriver') await this.cloud(p.device, (wd, id) => wd('POST', `/session/${id}/back`, {}));
        else {
          const h = this.android(p.device);
          await backGesture(h.adb, (await wmSize(h.adb)).height);
        }
        this.out('back gesture sent');
        return 0;
      }
      case 'key': {
        const h = this.android(p.device);
        const code = p.rest[0] ?? 'KEYCODE_BACK';
        await keyevent(h.adb, code);
        this.out(`keyevent ${code}`);
        return 0;
      }
      case 'shot':
        return this.shot(p);
      case 'record':
        return this.record(p);
      case 'snapshot': {
        const h = this.emulator(p.device);
        const path = await snapshotAvd(h.rig, h.emulator.avd, p.rest[0] ?? '', this.ctx.deps.clock.now());
        this.out(`snapshot ${path}`);
        return 0;
      }
      case 'restore': {
        const h = this.emulator(p.device);
        const from = await restoreAvd(h.rig, h.adb, h.emulator.avd, p.rest[0], p.flags.force === true);
        this.out(`restored AVD ${h.emulator.avd} from ${from}`);
        const left = await listSnapshots(h.rig, h.emulator.avd);
        this.out(`${left.length} snapshot(s) on rig ${h.rig.name}`);
        return 0;
      }
      case 'install': {
        const h = this.android(p.device);
        await h.rig.ensure();
        await this.bootIfEmulator(h);
        const path = await installTelegram(h.adb, this.config.device.telegram, this.ctx.deps, p.flags.force === true);
        this.out(`installed ${this.config.device.telegram.package} from ${path} (sha256 matches the pin) on ${h.resolved.name}`);
        return 0;
      }
      case 'down':
        return this.down(p);
      case 'budget': {
        const cfg = this.config.device.browserstack;
        this.out(budgetLine(await budget(createBrowserstackClient(cfg, this.ctx.deps)), cfg));
        const held = await readHeld(this.ctx.deps.root);
        this.out(held ? `held session on ${held.device}, open ${Math.round((this.ctx.deps.clock.now() - held.startedAt) / 1000)} s: run lw qa device down` : 'no session held');
        return 0;
      }
    }
  }

  private list(): number {
    const { rigs, devices } = this.config.device;
    for (const [name, rig] of Object.entries(rigs).sort()) {
      this.out(`rig    ${name.padEnd(16)} ${rig.transport}${rig.host ? ` ${rig.host}` : ''}${rig.transport === 'ssh' ? `, ingress ${rig.ingress}` : ''}`);
    }
    for (const [name, d] of Object.entries(devices).sort()) this.out(`device ${name.padEnd(16)} ${d.kind.padEnd(17)} rig ${d.rig}`);
    if (Object.keys(devices).length === 0) this.out('no devices in qa.device.devices');
    return 0;
  }

  /** One call on the held BrowserStack session. */
  private async cloud(device: string | undefined, fn: (wd: (m: string, path: string, body?: unknown) => Promise<unknown>, id: string) => Promise<unknown>): Promise<unknown> {
    this.kind(device);
    const held = await readHeld(this.ctx.deps.root);
    if (!held) throw new LaunchwrightError('qa.device.browserstack.session', 'No BrowserStack session is held. Run lw qa device open --url <url> first.');
    const client = createBrowserstackClient(this.config.device.browserstack, this.ctx.deps);
    return fn((m, path, body) => client.wd(m, path, body), held.id);
  }

  private async open(p: VerbArgs): Promise<number> {
    const { name, kind, traits } = this.kind(p.device);
    const url = typeof p.flags.url === 'string' ? p.flags.url : undefined;
    const bot = typeof p.flags.bot === 'string' ? p.flags.bot : undefined;
    if (traits.access === 'webdriver') {
      if (!url) throw new LaunchwrightError('qa.device.usage', 'open on a cloud device needs --url.');
      const cfg = this.config.device.browserstack;
      const client = createBrowserstackClient(cfg, this.ctx.deps);
      this.out(budgetLine(await budget(client), cfg));
      const keys = deviceKeys(name, resolveDevice(this.config, name).device, cloudDeviceKeys);
      const created = (await client.wd('POST', '/session', capabilities(kind, keys, cfg, `lw qa device ${name}`), 300_000)) as { sessionId: string };
      await writeHeld(this.ctx.deps.root, { id: created.sessionId, device: name, startedAt: this.ctx.deps.clock.now() });
      await client.wd('POST', `/session/${created.sessionId}/url`, { url });
      this.out(`BrowserStack session open on ${name} at ${url}. It spends minutes until lw qa device down.`);
      return 0;
    }
    if (traits.access === 'webkit') {
      const access = await deviceAccess(this.ctx, name);
      await access.close();
      this.out(`${name}: the inspector proxy answers. Open the page on the device; lw qa device eval reaches it.`);
      return 0;
    }
    const h = this.android(name);
    if (!url && !bot) throw new LaunchwrightError('qa.device.usage', 'open needs --bot <bot username> for a Mini App or --url <url> for the browser.');
    await h.rig.ensure();
    await this.bootIfEmulator(h);
    const pkg = bot ? this.config.device.telegram.package : h.browserPackage;
    if (url) {
      const ingress = await ensureIngress(h.adb, h.rig, this.ctx.deps, url);
      this.out(`ingress ${ingress.mode}${ingress.changed ? ', proxy setting changed' : ''}`);
      if (ingress.changed) await forceStop(h.adb, pkg);
    }
    await viewIntent(h.adb, bot ? miniAppLink(bot) : (url as string), pkg);
    const title = await this.onAndroidPage(h, pkg, async (page) => `${page.target.title ?? ''} ${page.target.url ?? ''}`.trim());
    this.out(`attached: ${title}`);
    return 0;
  }

  private async evaluate(p: VerbArgs): Promise<number> {
    const probe = typeof p.flags.probe === 'string' ? p.flags.probe : undefined;
    if (probe !== undefined && !PROBES[probe]) throw new LaunchwrightError('qa.device.usage', `No probe ${probe}. Probes: ${Object.keys(PROBES).join(', ')}.`);
    const expr = probe ? (PROBES[probe] as string) : await expressionOf(p.rest, this.opts.cwd);
    const { name, traits } = this.kind(p.device);
    let value: unknown;
    if (traits.access === 'webdriver') {
      const answer = (await this.cloud(name, (wd, id) => wd('POST', `/session/${id}/execute/async`, { script: asyncScript(expr), args: [] }))) as { ok?: boolean; value?: unknown; error?: string };
      if (!answer?.ok) throw new LaunchwrightError('qa.device.eval', `The page threw: ${answer?.error ?? 'no answer'}`);
      value = answer.value;
    } else if (traits.access === 'webkit') {
      value = await this.onIosPage(name, p, 30_000, (s) => webkitEvaluate(s, expr));
    } else {
      const h = this.android(name);
      const pkg = typeof p.flags.package === 'string' ? p.flags.package : this.config.device.telegram.package;
      value = await this.onAndroidPage(h, pkg, (page) => page.client.evaluate(expr));
    }
    this.out(str(value));
    return 0;
  }

  /** Runs `fn` in one inspector session on the page of an iOS device. `--match` picks the page. */
  private async onIosPage<T>(name: string, p: VerbArgs, timeoutMs: number, fn: (s: InspectorSession) => Promise<T>): Promise<T> {
    const access = await deviceAccess(this.ctx, name, typeof p.flags.match === 'string' ? p.flags.match : undefined);
    try {
      return await access.on(timeoutMs, fn);
    } finally {
      await access.close();
    }
  }

  private async logs(p: VerbArgs): Promise<number> {
    const seconds = Number(p.rest[0] ?? 15);
    if (!(seconds > 0)) throw new LaunchwrightError('qa.device.usage', 'logs takes a number of seconds.');
    const { name, traits } = this.kind(p.device);
    if (traits.access === 'webdriver') throw new LaunchwrightError('qa.device.verb', 'WebDriver on a cloud phone exposes no console. The BrowserStack dashboard keeps the session log.');
    this.out(`collecting for ${seconds} s`);
    if (traits.access === 'webkit') {
      const lines = await this.onIosPage(name, p, seconds * 1000 + 20_000, (s) => webkitConsole(this.ctx.deps, s, seconds * 1000));
      for (const l of lines) this.out(`${`${l.source}.${l.level}`.padEnd(22)} ${l.text}`);
      if (lines.length === 0) this.out('nothing logged');
      return 0;
    }
    const h = this.android(name);
    const pkg = typeof p.flags.package === 'string' ? p.flags.package : this.config.device.telegram.package;
    const lines: string[] = [];
    await this.onAndroidPage(
      h,
      pkg,
      async (page) => {
        for (const d of ['Runtime.enable', 'Log.enable', 'Network.enable']) await page.client.send(d);
        await this.ctx.deps.clock.sleep(seconds * 1000);
      },
      (ev) => {
        if (ev.method === 'Runtime.consoleAPICalled') {
          const params = ev.params as { type?: string; args?: { value?: unknown; description?: string }[] };
          lines.push(`${`console.${params.type}`.padEnd(22)} ${(params.args ?? []).map((a) => str(a.value ?? a.description)).join(' ').slice(0, 300)}`);
          return;
        }
        const line = logLineOf(ev, '');
        if (line) lines.push(`${line.kind.padEnd(22)} ${line.text}`);
      },
    );
    for (const l of lines) this.out(l);
    if (lines.length === 0) this.out('nothing logged');
    return 0;
  }

  private async mirror(p: VerbArgs): Promise<number> {
    const h = this.android(p.device);
    await h.rig.ensure();
    const args = ['-s', h.adb.serial, '--stay-awake', '--window-title', `${h.resolved.name} (${h.rig.name})`];
    const env: Record<string, string> = {};
    if (h.rig.remote) {
      const port = await this.ctx.deps.freePort();
      await h.rig.forward(port, port);
      args.push('--force-adb-forward', '-p', String(port));
      env.ANDROID_ADB_SERVER_PORT = String(await h.rig.adbPort());
    }
    // No timeout: the mirror window stays open until the user closes it.
    this.ctx.deps.run.start(this.config.device.tools.scrcpy, args, { env, detached: true, timeoutMs: NO_TIMEOUT });
    this.out(`scrcpy started for ${h.resolved.name}; the window is on this machine`);
    return 0;
  }

  private async shot(p: VerbArgs): Promise<number> {
    const { name, traits } = this.kind(p.device);
    const path = this.file(p.rest[0], name, 'png');
    let bytes: Buffer;
    if (traits.access === 'webdriver') bytes = Buffer.from(String(await this.cloud(name, (wd, id) => wd('GET', `/session/${id}/screenshot`))), 'base64');
    else if (traits.access === 'webkit' && traits.simulator === true) {
      const { resolved, rig } = iosDevice(this.ctx, name, traits.target, true);
      await rig.ensure();
      const sim = await bootedSimulator(rig, deviceKeys(name, resolved.device, simulatorDeviceKeys).udid);
      bytes = await simScreenshot(rig, sim.udid, `/tmp/lw-qa-shot-${this.ctx.deps.clock.now()}.png`);
    } else if (traits.access === 'webkit') {
      bytes = await this.onIosPage(name, p, 30_000, (s) => webkitSnapshot(s));
    } else {
      const h = this.android(name);
      await h.rig.ensure();
      bytes = await screencap(h.adb);
    }
    await writeBytes(path, bytes);
    this.out(`${bytes.length} bytes -> ${path}`);
    return 0;
  }

  private async record(p: VerbArgs): Promise<number> {
    const seconds = Number(p.rest[0]);
    const cap = this.config.evidence.videoCapS;
    if (!(seconds > 0) || seconds > cap) throw new LaunchwrightError('qa.device.usage', `record takes 1 to ${cap} seconds (qa.evidence.videoCapS).`);
    const { name, kind, traits } = this.kind(p.device);
    const path = this.file(p.rest[1], name, 'mp4');
    if (traits.access === 'webkit' && traits.simulator === true) {
      const { resolved, rig } = iosDevice(this.ctx, name, traits.target, true);
      await rig.ensure();
      const sim = await bootedSimulator(rig, deviceKeys(name, resolved.device, simulatorDeviceKeys).udid);
      const remote = `/tmp/lw-qa-rec-${this.ctx.deps.clock.now()}.mp4`;
      const pid = await startSimVideo(rig, sim.udid, remote);
      await this.ctx.deps.clock.sleep(seconds * 1000);
      await writeBytes(path, await stopSimVideo(rig, pid, remote));
    } else if (traits.access === 'adb') {
      const h = this.android(name);
      await h.rig.ensure();
      const rec = await startScreenrecord(h.adb, this.ctx.deps, seconds + 1, name);
      await this.ctx.deps.clock.sleep(seconds * 1000);
      await writeBytes(path, await rec.stop());
    } else {
      throw new LaunchwrightError('qa.device.verb', `Device ${name} is ${kind}: it has no recorder here. A BrowserStack session keeps its own video.`);
    }
    this.out(`${seconds} s -> ${path}`);
    return 0;
  }

  private async down(p: VerbArgs): Promise<number> {
    const names = p.device ? [p.device] : Object.keys(this.config.device.devices).sort();
    for (const name of names) {
      const { traits } = this.kind(name);
      if (traits.access === 'webdriver') {
        const held = await readHeld(this.ctx.deps.root);
        if (held && held.device === name) {
          await createBrowserstackClient(this.config.device.browserstack, this.ctx.deps).wd('DELETE', `/session/${held.id}`);
          await writeHeld(this.ctx.deps.root, null);
          this.out(`${name}: BrowserStack session ended after ${Math.round((this.ctx.deps.clock.now() - held.startedAt) / 1000)} s`);
        }
        continue;
      }
      if (traits.access !== 'adb') continue;
      const h = this.android(name);
      await h.rig.ensure();
      const state = (await h.adb.run(['get-state'])).code === 0;
      if (!state) {
        this.out(`${name}: not attached`);
        continue;
      }
      // The guest keeps its proxy setting across a boot, and the proxy behind it does not survive the rig.
      const cleared = await clearIngress(h.adb, h.rig.config.hostProxy?.port ?? DEFAULT_PROXY_PORT);
      if (cleared) this.out(`${name}: ingress proxy setting cleared`);
      if (h.emulator) {
        await stopEmulator(h.rig, h.adb, this.ctx.deps);
        this.out(`${name}: emulator stopped cleanly`);
      }
    }
    if (!p.device) {
      await this.ctx.rigs.downAll();
      this.out('ssh masters closed');
    }
    return 0;
  }
}
