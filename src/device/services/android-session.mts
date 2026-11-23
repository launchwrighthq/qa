// A QA session on an Android device (spec 2.8 `android-adb`, `android-emulator`). The page side
// runs through raw CDP in the WebView that the operator sees; the native side (back gesture,
// screenshot, recording, accessibility dump) runs through adb. A Mini App moves by `pushState`,
// because a document load drops the launch data that Telegram puts in the URL.
import { basename } from 'node:path';
import { LaunchwrightError } from '../../kernel/index.mts';
import { type Act, MIN_VIDEO_S, type Settle } from '../../index.mts';
import type { Capture, OpenOptions, QaSession, SessionLogLine, VideoCapture } from '../drivers/target/contract.mts';
import {
  type Adb,
  backGesture,
  createAdb,
  deviceState,
  forwardSocket,
  isBrowserSocket,
  processBelongsTo,
  type Recording,
  removeForward,
  screencap,
  SCREENRECORD_MAX_S,
  sockets,
  startScreenrecord,
  uiDump,
  wmSize,
} from './adb.mts';
import { type CdpEvent, logLineOf, openVisiblePage, type VisiblePage } from './cdp.mts';
import { androidDeviceKeys, deviceKeys, type EmulatorDeviceKeys, emulatorDeviceKeys } from '../config.mts';
import { deviceKind } from './device-kinds.mts';
import { bootEmulator, emulatorSerial } from './emulator.mts';
import { ensureIngress } from './ingress.mts';
import { pushRouteExpression, relativeRoute, ROUTE_EXPRESSION, routeUrl, VISIBILITY_EXPRESSION } from './page-script.mts';
import { poll } from './process.mts';
import { type DeviceContext, type ResolvedDevice, resolveDevice, type Rig } from './rigs.mts';
import { closedError, holdLastFrame, pageAct, pollSettle, waitAct, writeBytes, writePng } from './session-base.mts';
import { forceStop, installed, miniAppLink, viewIntent } from './telegram.mts';

/** The least length of a clip: the blank-video minimum and a margin for the recorder start. */
export const MIN_CLIP_MS = MIN_VIDEO_S * 1000 + 500;
/** The seconds that `scrcpy --record` may run past its `--time-limit`: the stop and the file close. */
const SCRCPY_GRACE_S = 30;

/** An Android device resolved from a leg or a command. */
export interface AndroidHandle {
  resolved: ResolvedDevice;
  rig: Rig;
  adb: Adb;
  /** The AVD keys of an emulator, null for a phone. */
  emulator: EmulatorDeviceKeys | null;
  recorder: 'screenrecord' | 'scrcpy';
  browserPackage: string;
}

/**
 * The adb handle of a device whose kind has `access: 'adb'`. With `emulatorOnly`, the kind must
 * also be an emulator. A target that drives any adb device drives a booted emulator too.
 */
export function androidHandle(ctx: DeviceContext, deviceName: string | undefined, target: string, emulatorOnly = false): AndroidHandle {
  const resolved = resolveDevice(ctx.config, deviceName);
  const kind = deviceKind(resolved.device.kind);
  if (kind.access !== 'adb' || (emulatorOnly && kind.emulator !== true)) {
    const drives = emulatorOnly ? 'an Android emulator' : 'an adb device';
    throw new LaunchwrightError('qa.device.kind', `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives ${drives}.`, {
      context: { device: resolved.name, target },
    });
  }
  const rig = ctx.rigs.get(resolved.rigName);
  const bin = ctx.config.device.tools.adb;
  if (kind.emulator === true) {
    const keys = deviceKeys(resolved.name, resolved.device, emulatorDeviceKeys);
    return { resolved, rig, adb: createAdb(rig, emulatorSerial(keys.port), ctx.deps, bin), emulator: keys, recorder: keys.recorder, browserPackage: keys.browserPackage };
  }
  const keys = deviceKeys(resolved.name, resolved.device, androidDeviceKeys);
  return { resolved, rig, adb: createAdb(rig, keys.serial, ctx.deps, bin), emulator: null, recorder: keys.recorder, browserPackage: keys.browserPackage };
}

/** Why an adb state is not ready, with the fix. */
export function stateFix(state: string, serial: string, rig: string): string {
  switch (state) {
    case 'device':
      return '';
    case 'unauthorized':
      return `${serial} on rig ${rig} is unauthorized: unlock it and accept the USB debugging prompt.`;
    case 'offline':
      return `${serial} on rig ${rig} is offline: reconnect the cable, or restart the adb server on the rig.`;
    case 'absent':
      return `${serial} is not attached to the adb server of rig ${rig}: plug it in with USB debugging on, or boot the emulator.`;
    default:
      return `${serial} on rig ${rig} is ${state}.`;
  }
}

/** The package whose page the session drives, and the devtools socket that belongs to it. */
async function attachSocket(ctx: DeviceContext, h: AndroidHandle, pkg: string, surface: string): Promise<string> {
  try {
    return await poll(
      ctx.deps.clock,
      async () => {
        const found = await sockets(h.adb, pkg);
        const own = found.find((s) => s.process !== null && processBelongsTo(s.process, pkg));
        const browser = surface === 'web' ? found.find((s) => isBrowserSocket(s.name, pkg)) : undefined;
        return (own ?? browser)?.name ?? null;
      },
      { timeoutMs: 30_000, everyMs: 1000, code: 'qa.device.webview', what: `A debuggable WebView of ${pkg} on ${h.adb.serial}` },
    );
  } catch (err) {
    if (!(err instanceof LaunchwrightError) || err.code !== 'qa.device.webview') throw err;
    if (surface === 'web') {
      throw new LaunchwrightError(
        'qa.device.webview',
        `${err.message} A browser publishes its devtools socket only after its first-run screens. Finish them once on the device (lw qa device mirror --device ${h.resolved.name}).`,
        { cause: err },
      );
    }
    throw new LaunchwrightError(
      'qa.device.webview',
      `${err.message} A Telegram release build makes its Mini App WebView debuggable only after Enable WebView Debug: in Telegram Settings, press and hold the version number twice, then choose it.`,
      { cause: err },
    );
  }
}

export class AndroidSession implements QaSession {
  private closed = false;
  private readonly lines: SessionLogLine[] = [];
  private video: { path: string; startedAt: number; stop: () => Promise<Buffer | null> } | null = null;
  private height: number | null = null;

  private constructor(
    private readonly ctx: DeviceContext,
    private readonly h: AndroidHandle,
    private readonly opts: OpenOptions,
    private readonly target: string,
    private page: VisiblePage,
    private readonly rigPort: number,
    private readonly reused: boolean,
  ) {}

  /** Boots an emulator when needed, applies the ingress, opens the app and attaches to its visible page. */
  static async open(ctx: DeviceContext, h: AndroidHandle, opts: OpenOptions, target: string): Promise<AndroidSession> {
    const { leg } = opts;
    if (leg.surface === 'bot') {
      throw new LaunchwrightError('qa.target.surface', `The ${target} target runs web and miniapp legs; leg ${leg.name} is a bot leg. Use the telegram-fake leg for a bot chat.`);
    }
    await h.rig.ensure();
    if (h.emulator) await bootEmulator(h.rig, h.adb, h.emulator, ctx.deps);
    const state = await deviceState(h.rig, h.adb.serial, ctx.deps, ctx.config.device.tools.adb);
    if (state !== 'device') throw new LaunchwrightError('qa.target.not-ready', stateFix(state, h.adb.serial, h.rig.name));
    const ingress = await ensureIngress(h.adb, h.rig, ctx.deps, opts.baseUrl);
    let pkg: string;
    if (leg.surface === 'miniapp') {
      pkg = ctx.config.device.telegram.package;
      if (!leg.bot) throw new LaunchwrightError('qa.target.leg', `Leg ${leg.name} opens a Mini App in Telegram and names no bot. Set qa.legs.${leg.name}.bot.`);
      if (!(await installed(h.adb, pkg))) {
        throw new LaunchwrightError('qa.target.not-ready', `${pkg} is not installed on ${h.adb.serial}. Run lw qa device install --device ${h.resolved.name}, then sign in by hand.`);
      }
      if (ingress.changed) await forceStop(h.adb, pkg);
      await viewIntent(h.adb, miniAppLink(leg.bot), pkg);
    } else {
      pkg = h.browserPackage;
      if (ingress.changed) await forceStop(h.adb, pkg);
      await viewIntent(h.adb, routeUrl(opts.baseUrl, '/').url, pkg);
    }
    const socket = await attachSocket(ctx, h, pkg, leg.surface);
    const fwd = await forwardSocket(h.adb, socket);
    const local = await h.rig.forward(fwd.port);
    const holder: { session: AndroidSession | null; early: CdpEvent[] } = { session: null, early: [] };
    const onEvent = (ev: CdpEvent): void => {
      if (holder.session) holder.session.record(ev);
      else holder.early.push(ev);
    };
    const page = await openVisiblePage(ctx.deps, local, onEvent);
    const session = new AndroidSession(ctx, h, opts, target, page, fwd.port, fwd.reused);
    holder.session = session;
    for (const ev of holder.early) session.record(ev);
    for (const domain of ['Runtime.enable', 'Log.enable', 'Network.enable']) await page.client.send(domain);
    return session;
  }

  private record(ev: CdpEvent): void {
    const line = logLineOf(ev, new Date(this.ctx.deps.clock.now()).toISOString());
    if (line) this.lines.push(line);
  }

  private alive(call: string): void {
    if (this.closed) throw closedError(this.target, call);
  }

  async evaluate(expression: string): Promise<unknown> {
    this.alive('evaluate');
    return this.page.client.evaluate(expression);
  }

  async navigate(route: string): Promise<void> {
    this.alive('navigate');
    const { url, path } = routeUrl(this.opts.baseUrl, route);
    if (this.opts.leg.surface === 'miniapp') {
      await this.evaluate(pushRouteExpression(path));
      return;
    }
    await this.page.client.send('Page.navigate', { url });
    await poll(this.ctx.deps.clock, async () => ((await this.evaluate('document.readyState')) === 'loading' ? null : true), {
      timeoutMs: 15_000,
      everyMs: 200,
      code: 'qa.target.navigate',
      what: `The load of ${route} on ${this.h.adb.serial}`,
    });
  }

  async act(step: Act): Promise<void> {
    this.alive('act');
    if (step.kind === 'wait') return waitAct(this.ctx.deps.clock, step);
    if (step.kind === 'back') {
      const before = await this.currentRoute();
      this.height ??= (await wmSize(this.h.adb)).height;
      await backGesture(this.h.adb, this.height);
      // The gesture moves the page asynchronously. A back on the first page leaves the route as it was.
      const deadline = this.ctx.deps.clock.now() + 3000;
      while (this.ctx.deps.clock.now() < deadline && (await this.currentRoute()) === before) await this.ctx.deps.clock.sleep(200);
      return;
    }
    await pageAct(step, (e) => this.evaluate(e), this.target);
  }

  async settle(rule: Settle): Promise<void> {
    this.alive('settle');
    await pollSettle(this.ctx.deps.clock, rule, (e) => this.evaluate(e), this.target);
  }

  async currentRoute(): Promise<string> {
    this.alive('currentRoute');
    return relativeRoute(this.opts.baseUrl, String(await this.evaluate(ROUTE_EXPRESSION)));
  }

  async screenshot(path: string): Promise<Capture> {
    this.alive('screenshot');
    // screencap shows the screen, the CDP client answers for a document: the two agree only while the page is visible.
    const visibility = String(await this.evaluate(VISIBILITY_EXPRESSION));
    if (visibility !== 'visible') {
      throw new LaunchwrightError('qa.target.screenshot', `The page this row drove is ${visibility} on ${this.h.adb.serial}: the screenshot would show another page.`);
    }
    return writePng(path, await screencap(this.h.adb), this.target);
  }

  async startVideo(path: string): Promise<void> {
    this.alive('startVideo');
    if (this.video) throw new LaunchwrightError('qa.target.video', `The ${this.target} session already records ${this.video.path}.`);
    const capS = Math.min(this.ctx.config.evidence.videoCapS, SCREENRECORD_MAX_S);
    const startedAt = this.ctx.deps.clock.now();
    if (this.h.recorder === 'screenrecord') {
      const rec: Recording = await startScreenrecord(this.h.adb, this.ctx.deps, capS, basename(path));
      this.video = { path, startedAt, stop: () => rec.stop() };
      return;
    }
    this.video = { path, startedAt, stop: await this.startScrcpy(path, capS) };
  }

  /** `scrcpy --record` on this machine. Over an ssh rig its video socket rides the master on one port number. */
  private async startScrcpy(path: string, capS: number): Promise<() => Promise<Buffer | null>> {
    const port = await this.ctx.deps.freePort();
    const args = ['-s', this.h.adb.serial, '--no-playback', '--no-audio', '--no-window', `--record=${path}`, `--time-limit=${capS}`, '-p', String(port)];
    const env: Record<string, string> = {};
    if (this.h.rig.remote) {
      await this.h.rig.forward(port, port);
      args.push('--force-adb-forward');
      env.ANDROID_ADB_SERVER_PORT = String(await this.h.rig.adbPort());
    }
    // `--time-limit` ends the recording; the timeout catches a scrcpy that hangs after it.
    const proc = this.ctx.deps.run.start(this.ctx.config.device.tools.scrcpy, args, { env, timeoutMs: (capS + SCRCPY_GRACE_S) * 1000 });
    return async () => {
      proc.signal('SIGINT');
      const res = await proc.done;
      if (this.h.rig.remote) await this.h.rig.unforward(port);
      if (res.code !== 0 && res.code !== 128) throw new LaunchwrightError('qa.device.record', `scrcpy --record exited ${res.code}: ${res.stderr.trim().slice(0, 300)}`);
      return null;
    };
  }

  async stopVideo(): Promise<VideoCapture> {
    this.alive('stopVideo');
    const video = this.video;
    if (!video) throw new LaunchwrightError('qa.target.video', `The ${this.target} session records no video; call startVideo first.`);
    this.video = null;
    // A still row can settle in under a second. The recorder keeps the settled screen until the
    // clip is long enough for the blank-video rule (spec 2.11.2).
    const short = MIN_CLIP_MS - (this.ctx.deps.clock.now() - video.startedAt);
    if (short > 0) await this.ctx.deps.clock.sleep(short);
    const bytes = await video.stop();
    const durationMs = this.ctx.deps.clock.now() - video.startedAt;
    if (bytes) await writeBytes(video.path, bytes);
    await holdLastFrame(this.ctx.deps, this.ctx.config.device.tools.ffmpeg, video.path, durationMs);
    return { path: video.path, durationMs };
  }

  async trace(): Promise<string | null> {
    this.alive('trace');
    return null;
  }

  async dump(path: string): Promise<string | null> {
    this.alive('dump');
    const xml = await poll(this.ctx.deps.clock, () => uiDump(this.h.adb), {
      timeoutMs: 8000,
      everyMs: 800,
      code: 'qa.device.dump',
      what: `A uiautomator dump of ${this.h.adb.serial}`,
    });
    await writeBytes(path, Buffer.from(xml));
    return path;
  }

  async logs(): Promise<SessionLogLine[]> {
    return [...this.lines];
  }

  async close(): Promise<void> {
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
}
