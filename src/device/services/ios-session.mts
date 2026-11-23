// QA sessions on iOS (spec 2.8): `ios-webkit` drives a page on a real iPhone through the WebKit
// inspector, with `location.href` as its only navigation and `Page.snapshotRect` as its screenshot.
// `ios-simulator` opens URLs with `simctl`, films and photographs the whole screen with `simctl io`,
// and reads the page through an inspector proxy on the simulator socket when one is configured.
import { LaunchwrightError } from '../../kernel/index.mts';
import type { Act, Settle } from '../../index.mts';
import type { Capture, OpenOptions, QaSession, SessionLogLine, VideoCapture } from '../drivers/target/contract.mts';
import { deviceKeys, iosDeviceKeys, type SimulatorDeviceKeys, simulatorDeviceKeys } from '../config.mts';
import { hrefExpression, relativeRoute, ROUTE_EXPRESSION, routeUrl } from './page-script.mts';
import { poll } from './process.mts';
import { type DeviceKind, deviceKind } from './device-kinds.mts';
import { type DeviceContext, type ResolvedDevice, resolveDevice, type Rig } from './rigs.mts';
import { capabilityError, closedError, consoleLogKind, pollSettle, writeBytes, writePng } from './session-base.mts';
import { bootedSimulator, openUrl, simScreenshot, startSimVideo, stopSimVideo } from './simctl.mts';
import { type WebkitSession as InspectorSession, parseDeviceList, pickPage, proxyJson, webkitConsole, webkitEvaluate, webkitSnapshot, withTarget } from './webkit.mts';

/** The default rig ports of `ios_webkit_debug_proxy`: the device list, then the first page port. */
export const DEFAULT_WEBKIT_PORTS: readonly [number, number] = [9221, 9222];

/** How long one inspector command may take. A locked phone never announces a target. */
const INSPECTOR_TIMEOUT_MS = 20_000;

/** How long `logs` listens after `Console.enable`, which replays what the page logged before. */
const CONSOLE_WINDOW_MS = 500;

/** The page of one phone or simulator, reached through an inspector proxy on a rig. */
export interface WebkitAccess {
  /** Runs `fn` in one inspector session on the page that `match` selects. */
  on<T>(timeoutMs: number, fn: (s: InspectorSession) => Promise<T>): Promise<T>;
  evaluate(expression: string): Promise<unknown>;
  snapshot(): Promise<Buffer>;
  logs(): Promise<SessionLogLine[]>;
  close(): Promise<void>;
}

/**
 * Forwards the proxy device list, picks the phone (by `udid`, else the only one), forwards its page
 * port, and opens one inspector session per call on the page that `match` selects.
 */
export async function webkitAccess(ctx: DeviceContext, rig: Rig, listPort: number, match: string | undefined, udid?: string): Promise<WebkitAccess> {
  const listLocal = await rig.forward(listPort);
  const phones = parseDeviceList(await proxyJson(ctx.deps, listLocal, 'device list'));
  const phone = udid ? phones.find((p) => p.id === udid) : phones.length === 1 ? phones[0] : undefined;
  if (!phone) {
    throw new LaunchwrightError(
      'qa.device.webkit.pairing',
      udid
        ? `The configured iPhone is not in the proxy device list on rig ${rig.name} (${phones.length} listed). Unlock it, trust the rig, and turn on Web Inspector in Settings > Safari > Advanced.`
        : `The proxy on rig ${rig.name} lists ${phones.length} devices. Set the udid of the device to pick one.`,
    );
  }
  const pageLocal = await rig.forward(phone.port);
  const on = async <T,>(timeoutMs: number, fn: (s: InspectorSession) => Promise<T>): Promise<T> => {
    const page = pickPage(await proxyJson(ctx.deps, pageLocal, 'page list'), match);
    return withTarget(ctx.deps, page, pageLocal, timeoutMs, fn);
  };
  return {
    on,
    evaluate: (expression) => on(INSPECTOR_TIMEOUT_MS, (s) => webkitEvaluate(s, expression)),
    snapshot: () => on(30_000, (s) => webkitSnapshot(s)),
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
    },
  };
}

/**
 * The inspector access of an `ios` device, or of an `ios-simulator` device with an inspector port.
 * `match` overrides the page match of the device config.
 */
export async function deviceAccess(ctx: DeviceContext, name: string, match?: string): Promise<WebkitAccess> {
  const { resolved, rig, kind } = iosDevice(ctx, name, 'ios');
  await rig.ensure();
  if (kind.simulator !== true) {
    const keys = deviceKeys(resolved.name, resolved.device, iosDeviceKeys);
    return webkitAccess(ctx, rig, rig.config.webkitPorts?.[0] ?? DEFAULT_WEBKIT_PORTS[0], match ?? keys.match, keys.udid);
  }
  const keys = deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys);
  if (!keys.inspectorPort) throw noInspector(rig.name, resolved.name);
  return webkitAccess(ctx, rig, keys.inspectorPort, match);
}

function noInspector(rig: string, device: string): LaunchwrightError {
  return new LaunchwrightError(
    'qa.device.simulator.inspector',
    `Simulator ${device} has no page access: start ios_webkit_debug_proxy on the simulator socket of rig ${rig} (-s unix:<webinspectord_sim socket>) and set qa.device.devices.${device}.inspectorPort.`,
  );
}

/**
 * A document load, then a wait until a new document is past `loading`. The inspector target of the
 * old document goes away, so a call that throws while the page changes counts as not yet.
 */
async function loadAndWait(ctx: DeviceContext, access: WebkitAccess, load: () => Promise<unknown>, route: string): Promise<void> {
  const before = await access.evaluate('performance.timeOrigin');
  await load();
  await poll(
    ctx.deps.clock,
    async () => {
      try {
        const [origin, state] = (await access.evaluate('[performance.timeOrigin, document.readyState]')) as [number, string];
        return origin !== before && state !== 'loading' ? true : null;
      } catch (err) {
        if (err instanceof LaunchwrightError && err.code.startsWith('qa.device.webkit')) return null;
        throw err;
      }
    },
    { timeoutMs: 30_000, everyMs: 300, code: 'qa.target.navigate', what: `The load of ${route}` },
  );
}

export class PhoneSession implements QaSession {
  private closed = false;

  constructor(
    private readonly ctx: DeviceContext,
    private readonly opts: OpenOptions,
    private readonly access: WebkitAccess,
    private readonly target: string,
  ) {}

  static async open(ctx: DeviceContext, opts: OpenOptions, target: string): Promise<PhoneSession> {
    const { resolved } = iosDevice(ctx, opts.leg.device, target, false);
    const keys = deviceKeys(resolved.name, resolved.device, iosDeviceKeys);
    const access = await deviceAccess(ctx, resolved.name, keys.match ?? new URL(opts.baseUrl).host);
    return new PhoneSession(ctx, opts, access, target);
  }

  private alive(call: string): void {
    if (this.closed) throw closedError(this.target, call);
  }

  async evaluate(expression: string): Promise<unknown> {
    this.alive('evaluate');
    return this.access.evaluate(expression);
  }

  async navigate(route: string): Promise<void> {
    this.alive('navigate');
    const { url } = routeUrl(this.opts.baseUrl, route);
    await loadAndWait(this.ctx, this.access, () => this.access.evaluate(hrefExpression(url)), route);
  }

  async act(_step: Act): Promise<void> {
    this.alive('act');
    throw capabilityError(this.target, 'input', 'run an act step (it navigates by location.href only)');
  }

  async settle(rule: Settle): Promise<void> {
    this.alive('settle');
    await pollSettle(this.ctx.deps.clock, rule, (e) => this.access.evaluate(e), this.target);
  }

  async currentRoute(): Promise<string> {
    this.alive('currentRoute');
    return relativeRoute(this.opts.baseUrl, String(await this.access.evaluate(ROUTE_EXPRESSION)));
  }

  async screenshot(path: string): Promise<Capture> {
    this.alive('screenshot');
    return writePng(path, await this.access.snapshot(), this.target);
  }

  async startVideo(_path: string): Promise<void> {
    this.alive('startVideo');
    throw capabilityError(this.target, 'video', 'record a video');
  }

  async stopVideo(): Promise<VideoCapture> {
    this.alive('stopVideo');
    throw capabilityError(this.target, 'video', 'record a video');
  }

  async trace(): Promise<string | null> {
    return null;
  }

  async dump(): Promise<string | null> {
    return null;
  }

  async logs(): Promise<SessionLogLine[]> {
    this.alive('logs');
    return this.access.logs();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.access.close();
  }
}

/**
 * A device whose kind has `access: 'webkit'`, with its rig and its kind. With `simulator`, the
 * `simulator` trait of the kind must match it.
 */
export function iosDevice(ctx: DeviceContext, deviceName: string | undefined, target: string, simulator?: boolean): { resolved: ResolvedDevice; rig: Rig; kind: DeviceKind } {
  const resolved = resolveDevice(ctx.config, deviceName);
  const kind = deviceKind(resolved.device.kind);
  if (kind.access !== 'webkit' || (simulator !== undefined && (kind.simulator === true) !== simulator)) {
    const drives = simulator === undefined ? 'an iOS device' : simulator ? 'an iOS simulator' : 'an iPhone';
    throw new LaunchwrightError('qa.device.kind', `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives ${drives}.`);
  }
  return { resolved, rig: ctx.rigs.get(resolved.rigName), kind };
}

/** The reason an `ios-simulator` device is not ready, or null. */
export function simulatorReadiness(name: string, keys: SimulatorDeviceKeys): string | null {
  if (keys.inputTool) return null;
  return `The ios-simulator target has no input tool: simctl opens URLs and films the screen, and cannot tap. No input tool is configured in qa.device.devices.${name}.inputTool, so rows with act steps are n/a on this device.`;
}

export class SimulatorSession implements QaSession {
  private closed = false;
  private video: { path: string; pid: number; remote: string; startedAt: number } | null = null;
  private shots = 0;

  constructor(
    private readonly ctx: DeviceContext,
    private readonly opts: OpenOptions,
    private readonly rig: Rig,
    private readonly udid: string,
    private readonly access: WebkitAccess | null,
    private readonly name: string,
    private readonly target: string,
  ) {}

  static async open(ctx: DeviceContext, opts: OpenOptions, target: string): Promise<SimulatorSession> {
    const { resolved, rig } = iosDevice(ctx, opts.leg.device, target, true);
    const keys = deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys);
    await rig.ensure();
    const sim = await bootedSimulator(rig, keys.udid);
    const access = keys.inspectorPort ? await deviceAccess(ctx, resolved.name, new URL(opts.baseUrl).host) : null;
    return new SimulatorSession(ctx, opts, rig, sim.udid, access, resolved.name, target);
  }

  private alive(call: string): void {
    if (this.closed) throw closedError(this.target, call);
  }

  /** The page access, or a refusal that names the config key. */
  private page(): WebkitAccess {
    if (this.access) return this.access;
    throw noInspector(this.rig.name, this.name);
  }

  private remote(ext: string): string {
    this.shots += 1;
    return `/tmp/lw-qa-${this.udid.slice(0, 8)}-${this.ctx.deps.clock.now()}-${this.shots}.${ext}`;
  }

  async evaluate(expression: string): Promise<unknown> {
    this.alive('evaluate');
    return this.page().evaluate(expression);
  }

  async navigate(route: string): Promise<void> {
    this.alive('navigate');
    const { url } = routeUrl(this.opts.baseUrl, route);
    if (!this.access) {
      await openUrl(this.rig, this.udid, url);
      return;
    }
    await loadAndWait(this.ctx, this.access, () => openUrl(this.rig, this.udid, url), route);
  }

  async act(_step: Act): Promise<void> {
    this.alive('act');
    throw capabilityError(this.target, 'input', 'run an act step (simctl has no input verb)');
  }

  async settle(rule: Settle): Promise<void> {
    this.alive('settle');
    const page = this.page();
    await pollSettle(this.ctx.deps.clock, rule, (e) => page.evaluate(e), this.target);
  }

  async currentRoute(): Promise<string> {
    this.alive('currentRoute');
    return relativeRoute(this.opts.baseUrl, String(await this.page().evaluate(ROUTE_EXPRESSION)));
  }

  async screenshot(path: string): Promise<Capture> {
    this.alive('screenshot');
    return writePng(path, await simScreenshot(this.rig, this.udid, this.remote('png')), this.target);
  }

  async startVideo(path: string): Promise<void> {
    this.alive('startVideo');
    if (this.video) throw new LaunchwrightError('qa.target.video', `The ${this.target} session already records ${this.video.path}.`);
    const remote = this.remote('mp4');
    const pid = await startSimVideo(this.rig, this.udid, remote);
    this.video = { path, pid, remote, startedAt: this.ctx.deps.clock.now() };
  }

  async stopVideo(): Promise<VideoCapture> {
    this.alive('stopVideo');
    const video = this.video;
    if (!video) throw new LaunchwrightError('qa.target.video', `The ${this.target} session records no video; call startVideo first.`);
    this.video = null;
    await writeBytes(video.path, await stopSimVideo(this.rig, video.pid, video.remote));
    return { path: video.path, durationMs: this.ctx.deps.clock.now() - video.startedAt };
  }

  async trace(): Promise<string | null> {
    return null;
  }

  async dump(): Promise<string | null> {
    return null;
  }

  async logs(): Promise<SessionLogLine[]> {
    this.alive('logs');
    return this.page().logs();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const video = this.video;
    this.video = null;
    if (video) await stopSimVideo(this.rig, video.pid, video.remote);
    await this.access?.close();
  }
}
