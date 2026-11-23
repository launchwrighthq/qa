// Recorded peers of the device tests. No test starts adb, ssh, xcrun or scrcpy, opens a socket off
// loopback, or sleeps. The process runner answers each command from a script, and the CDP, WebKit
// inspector and WebDriver peers answer from the recorded frames in `fixtures/device/`.
// One page model, the contract site of `contractFakeRoutes()`, stands behind all three protocols.
import { copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LaunchwrightError } from '../../src/kernel/index.mts';
import { qaConfig } from '../../src/index.mts';
import { type QaConfig, withDevice } from '../../src/device/config.mts';
import type { DeviceClock, DeviceDeps, ProcessResult, ProcessRunner, RunningProcess, SocketFactory, SocketLike } from '../../src/device/services/process.mts';
import { REMOTE_PATH } from '../../src/device/services/rigs.mts';
import { CONTRACT_BASE, contractFakeRoutes, type FakeRoute } from '../../src/testing/index.mts';

export const fixturePath = (rel: string): string => fileURLToPath(new URL(`../../fixtures/${rel}`, import.meta.url));
export const deviceText = (rel: string): string => readFileSync(fixturePath(`device/${rel}`), 'utf8');
export const deviceBytes = (rel: string): Buffer => readFileSync(fixturePath(`device/${rel}`));
export const deviceJson = <T,>(rel: string, vars: Record<string, string> = {}): T => {
  let text = deviceText(rel);
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return JSON.parse(text) as T;
};

/** A clock whose `sleep` moves `now` and returns at once. Each read moves it 1 ms, as work takes time. */
export function steppingClock(start = Date.parse('2026-11-12T10:00:00.000Z')): DeviceClock & { slept: number } {
  let now = start;
  const clock = {
    slept: 0,
    now: () => (now += 1),
    async sleep(ms: number) {
      now += ms;
      clock.slept += ms;
    },
  };
  return clock;
}

export const ok = (stdout: string | Buffer = '', stderr = ''): ProcessResult => ({ code: 0, stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout), stderr });
export const failed = (code: number, stderr: string): ProcessResult => ({ code, stdout: Buffer.alloc(0), stderr });

export interface Call {
  cmd: string;
  args: string[];
  input?: string;
  env?: Record<string, string>;
}

export type Handler = (call: Call) => ProcessResult | string | Buffer | undefined;

/** A runner that answers from `handle` and keeps every call. An unscripted command fails the test. */
export class ScriptedRunner implements ProcessRunner {
  readonly calls: Call[] = [];
  readonly signals: { call: Call; signal: string }[] = [];

  constructor(private readonly handle: Handler) {}

  private answer(call: Call): ProcessResult {
    this.calls.push(call);
    const res = this.handle(call);
    if (res === undefined) throw new LaunchwrightError('test.unscripted', `The test runner has no answer for: ${call.cmd} ${call.args.join(' ')}`);
    return typeof res === 'string' || Buffer.isBuffer(res) ? ok(res) : res;
  }

  async run(cmd: string, args: string[], opts?: { input?: string | Buffer; env?: Record<string, string> }): Promise<ProcessResult> {
    return this.answer({ cmd, args, ...(opts?.input !== undefined ? { input: String(opts.input) } : {}), ...(opts?.env ? { env: opts.env } : {}) });
  }

  start(cmd: string, args: string[], opts?: { env?: Record<string, string> }): RunningProcess {
    const call: Call = { cmd, args, ...(opts?.env ? { env: opts.env } : {}) };
    const first = this.answer(call);
    let finish: (r: ProcessResult) => void = () => {};
    const done = new Promise<ProcessResult>((resolve) => {
      finish = resolve;
    });
    const stop = (signal: string): void => {
      this.signals.push({ call, signal });
      finish(first);
    };
    this.running.push(() => stop('external'));
    return { done, signal: stop };
  }

  /** Ends every started process, as a device-side `pkill` does. */
  readonly running: (() => void)[] = [];
  endAll(): void {
    for (const end of this.running.splice(0)) end();
  }

  /** The calls whose joined arguments contain `text`. */
  find(text: string): Call[] {
    return this.calls.filter((c) => `${c.cmd} ${c.args.join(' ')}`.includes(text));
  }
}

/** The adb arguments after the server (`-L`) and serial (`-s`) options. */
export function adbArgs(call: Call): { server: string | null; serial: string | null; rest: string[] } {
  const a = [...call.args];
  let server: string | null = null;
  let serial: string | null = null;
  if (a[0] === '-L') {
    server = a[1] ?? null;
    a.splice(0, 2);
  }
  if (a[0] === '-s') {
    serial = a[1] ?? null;
    a.splice(0, 2);
  }
  return { server, serial, rest: a };
}

// The page model ---------------------------------------------------------------------------

/** The contract site, as the device peers see it. */
export class FakeSite {
  route = '/';
  loads = 1;
  readonly origin: string;
  private readonly history: string[] = ['/'];
  /** Log kinds of the last load that no peer delivered yet. */
  pending: string[] = [];

  constructor(
    readonly baseUrl: string,
    private readonly routes: Record<string, FakeRoute> = contractFakeRoutes(),
  ) {
    this.origin = new URL(baseUrl).origin;
  }

  page(): FakeRoute {
    return this.routes[this.route] ?? {};
  }

  path(): string {
    return `${CONTRACT_BASE}${this.route === '/' ? '/' : this.route}`;
  }

  href(): string {
    return `${this.origin}${this.path()}`;
  }

  private rel(pathname: string): string {
    if (pathname === CONTRACT_BASE || pathname === `${CONTRACT_BASE}/`) return '/';
    return pathname.startsWith(`${CONTRACT_BASE}/`) ? pathname.slice(CONTRACT_BASE.length) : pathname;
  }

  /** A document load: the redirect applies, the page logs fire. */
  load(url: string): void {
    let route = this.rel(new URL(url, this.origin).pathname);
    const redirect = this.routes[route]?.redirect;
    if (redirect) route = redirect;
    this.route = route;
    this.history.push(route);
    this.loads += 1;
    this.pending = (this.page().logs ?? []).map((l) => l.kind);
  }

  back(): void {
    if (this.history.length > 1) this.history.pop();
    this.route = this.history.at(-1) ?? '/';
    this.loads += 1;
  }

  has(selector: string): boolean {
    return selector === 'body' || (this.page().selectors ?? []).includes(selector);
  }

  /** Answers the page scripts of `device/services/page-script.mts`. */
  evaluate(expr: string): unknown {
    const json = (re: RegExp): string => {
      const m = re.exec(expr);
      if (!m) throw new LaunchwrightError('test.site', `The fake site cannot read ${expr.slice(0, 80)}`);
      return JSON.parse(m[1] as string) as string;
    };
    switch (expr) {
      case 'document.visibilityState':
        return 'visible';
      case 'location.origin':
        return this.origin;
      case 'location.pathname + location.search':
        return this.path();
      case 'location.href':
        return this.href();
      case 'document.readyState':
        return 'complete';
      case 'performance.timeOrigin':
        return this.loads;
      case '[performance.timeOrigin, document.readyState]':
        return [this.loads, 'complete'];
      case '({ w: innerWidth, h: innerHeight })':
        return { w: 390, h: 844 };
      default:
        break;
    }
    if (expr.includes('const checks = [')) {
      const names = [...expr.matchAll(/name: ("(?:[^"\\]|\\.)*"|'[a-z]+')/g)].map((m) => (m[1]?.startsWith('"') ? JSON.parse(m[1]) : m[1]?.slice(1, -1)) as string);
      const page = this.page();
      const missing = names.filter((n) => {
        if (n.startsWith('selector ')) return !this.has(n.slice('selector '.length));
        if (n === 'artwork') return !page.artwork;
        if (n === 'video') return !page.video;
        if (n === 'busy') return Boolean(page.busy);
        return true;
      });
      return { ok: missing.length === 0, missing };
    }
    if (expr.includes('history.pushState(')) {
      const target = json(/const target = ("(?:[^"\\]|\\.)*")/);
      this.route = this.rel(new URL(target, this.origin).pathname);
      this.history.push(this.route);
      return target;
    }
    if (expr.includes('location.href = ')) {
      this.load(json(/location\.href = ("(?:[^"\\]|\\.)*")/));
      return true;
    }
    if (expr.includes("new MouseEvent('click'")) {
      const sel = json(/'no element for ' \+ ("(?:[^"\\]|\\.)*")/);
      if (!this.has(sel)) return { ok: false, error: `no element for ${sel}` };
      const link = this.page().links?.[sel];
      if (link) this.load(`${CONTRACT_BASE}${link}`);
      return { ok: true, failed: [] };
    }
    if (expr.includes("new InputEvent('input'")) {
      const sel = json(/'no element for ' \+ ("(?:[^"\\]|\\.)*")/);
      return this.has(sel) ? { ok: true } : { ok: false, error: `no element for ${sel}` };
    }
    if (expr.includes("new KeyboardEvent('keydown'") || expr.includes('root.scrollBy(')) return { ok: true };
    throw new LaunchwrightError('test.site', `The fake site cannot evaluate: ${expr.slice(0, 120)}`);
  }
}

// Sockets ----------------------------------------------------------------------------------

function socket(onSend: (data: string, sock: SocketLike & { reply(frame: unknown): void }) => void, first?: unknown): SocketLike & { reply(frame: unknown): void; closed: boolean } {
  const sock = {
    closed: false,
    onopen: null as SocketLike['onopen'],
    onmessage: null as SocketLike['onmessage'],
    onerror: null as SocketLike['onerror'],
    onclose: null as SocketLike['onclose'],
    reply(frame: unknown) {
      queueMicrotask(() => {
        if (!sock.closed) sock.onmessage?.({ data: JSON.stringify(frame) });
      });
    },
    send(data: string) {
      if (sock.closed) throw new LaunchwrightError('test.socket', 'send on a closed fake socket');
      onSend(data, sock);
    },
    close() {
      sock.closed = true;
    },
  };
  queueMicrotask(() => {
    sock.onopen?.({});
    if (first !== undefined) sock.reply(first);
  });
  return sock;
}

/** The CDP peer of an Android WebView pool: page `visibleId` is the site, the others are hidden pages. */
export function cdpSockets(site: FakeSite, visibleId = 'C3'): SocketFactory & { urls: string[] } {
  const events = deviceJson<Record<string, { method: string; params: unknown }>>('cdp-error-events.json', { origin: site.origin });
  const urls: string[] = [];
  const factory: SocketFactory = (url: string) => {
    urls.push(url);
    const id = url.split('/').pop();
    let enabled = false;
    return socket((data, sock) => {
      const msg = JSON.parse(data) as { id: number; method: string; params?: { expression?: string; url?: string } };
      let result: unknown;
      try {
        switch (msg.method) {
          case 'Runtime.evaluate': {
            const expr = msg.params?.expression ?? '';
            const value = id === visibleId ? site.evaluate(expr) : expr === 'document.visibilityState' ? 'hidden' : null;
            result = { result: value === undefined ? { type: 'undefined' } : { type: typeof value, value } };
            break;
          }
          case 'Page.navigate':
            site.load(msg.params?.url ?? '/');
            result = { frameId: '8E1C', loaderId: `L${site.loads}` };
            break;
          case 'Runtime.enable':
            enabled = true;
            result = {};
            break;
          case 'Log.enable':
          case 'Network.enable':
            result = {};
            break;
          default:
            sock.reply({ id: msg.id, error: { code: -32601, message: `'${msg.method}' wasn't found` } });
            return;
        }
      } catch (err) {
        sock.reply({ id: msg.id, error: { code: -32000, message: (err as Error).message } });
        return;
      }
      sock.reply({ id: msg.id, result });
      if (enabled && id === visibleId) for (const kind of site.pending.splice(0)) if (events[kind]) sock.reply(events[kind]);
    });
  };
  return Object.assign(factory, { urls });
}

/** The WebKit inspector peer of `ios_webkit_debug_proxy`, Target-domain framing included. */
export function webkitSockets(site: FakeSite): SocketFactory & { origins: (string | undefined)[] } {
  const frames = deviceJson<{ targetCreated: unknown; consoleMessages: Record<string, unknown> }>('webkit-frames.json', { origin: site.origin, url: site.href() });
  const png = deviceBytes('screen.png').toString('base64');
  const origins: (string | undefined)[] = [];
  const factory: SocketFactory = (_url: string, opts?: { origin?: string }) => {
    origins.push(opts?.origin);
    const objects = new Map<string, unknown>();
    const out = (sock: { reply(f: unknown): void }, inner: unknown) =>
      sock.reply({ method: 'Target.dispatchMessageFromTarget', params: { targetId: 'page-1', message: JSON.stringify(inner) } });
    return socket((data, sock) => {
      const outer = JSON.parse(data) as { method: string; params: { targetId: string; message: string } };
      if (outer.method !== 'Target.sendMessageToTarget') throw new LaunchwrightError('test.webkit', `unframed ${outer.method}`);
      const inner = JSON.parse(outer.params.message) as { id: number; method: string; params: Record<string, unknown> };
      const p = inner.params ?? {};
      switch (inner.method) {
        case 'Runtime.evaluate': {
          let value: unknown;
          try {
            value = site.evaluate(String(p.expression));
          } catch (err) {
            out(sock, { id: inner.id, result: { result: { type: 'object', description: (err as Error).message }, wasThrown: true } });
            return;
          }
          if (value !== null && typeof value === 'object') {
            const objectId = `{"injectedScriptId":1,"id":${objects.size + 1}}`;
            objects.set(objectId, value);
            out(sock, { id: inner.id, result: { result: { type: 'object', objectId, className: Array.isArray(value) ? 'Array' : 'Object' }, wasThrown: false } });
          } else {
            out(sock, { id: inner.id, result: { result: value === undefined ? { type: 'undefined' } : { type: typeof value, value }, wasThrown: false } });
          }
          return;
        }
        case 'Runtime.callFunctionOn':
          out(sock, { id: inner.id, result: { result: { type: 'object', value: objects.get(String(p.objectId)) }, wasThrown: false } });
          return;
        case 'Page.snapshotRect':
          out(sock, { id: inner.id, result: { dataURL: `data:image/png;base64,${png}` } });
          return;
        case 'Console.enable':
          out(sock, { id: inner.id, result: {} });
          for (const kind of (site.page().logs ?? []).map((l) => l.kind)) {
            const message = frames.consoleMessages[kind];
            if (message) out(sock, { method: 'Console.messageAdded', params: { message } });
          }
          return;
        case 'Runtime.enable':
        case 'Page.enable':
          out(sock, { id: inner.id, result: {} });
          return;
        default:
          out(sock, { id: inner.id, error: { code: -32601, message: `'${inner.method}' was not found` } });
      }
    }, frames.targetCreated);
  };
  return Object.assign(factory, { origins });
}

// HTTP -------------------------------------------------------------------------------------

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * The devtools and proxy HTTP endpoints: `/json/list` of a WebView pool on any port, and the
 * WebKit device list on a list port and the page list on a page port.
 */
export function devtoolsFetch(site: FakeSite, ports: { lists?: Record<number, number>; pages?: number[] } = {}): typeof fetch & { urls: string[] } {
  const urls: string[] = [];
  /** Local list port to the rig page port that the device list names. */
  const lists = ports.lists ?? { 9221: 9222 };
  /** Local page ports. On a local rig they are the rig page ports. */
  const pages = ports.pages ?? Object.values(lists);
  const answer = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    urls.push(url.toString());
    if (url.hostname !== '127.0.0.1') throw new LaunchwrightError('test.fetch', `not loopback: ${url}`);
    if (url.pathname === '/json/list') return json(deviceJson('cdp-json-list.json', { origin: site.origin }));
    const port = Number(url.port);
    if (url.pathname === '/json' && lists[port] !== undefined) {
      const rows = deviceJson<{ url: string }[]>('webkit-device-list.json');
      return json(rows.map((r) => ({ ...r, url: `127.0.0.1:${lists[port]}` })));
    }
    if (url.pathname === '/json' && pages.includes(port)) return json(deviceJson('webkit-pages.json', { url: site.href() }));
    return new Response('not found', { status: 404 });
  }) as typeof fetch & { urls: string[] };
  answer.urls = urls;
  return answer;
}

export const HUB = 'https://hub-cloud.browserstack.com/wd/hub';
export const API = 'https://api.browserstack.com/automate';

/** The XML that the BrowserStack video URL answers, with HTTP 200, before the file is stored. */
const VIDEO_NOT_STORED = '<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>';

/**
 * The BrowserStack hub and REST API, answering WebDriver calls on the page model. `videoMisses`
 * video downloads answer `NoSuchKey` before the clip.
 */
export function webDriverFetch(
  site: FakeSite,
  opts: { videoMisses?: number } = {},
): typeof fetch & { calls: { method: string; path: string; auth: string | null; body: string }[] } {
  const calls: { method: string; path: string; auth: string | null; body: string }[] = [];
  const png = deviceBytes('screen.png').toString('base64');
  let n = 0;
  let videoMisses = opts.videoMisses ?? 0;
  const answer = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : '';
    if (url.startsWith('https://bs-video.test/')) {
      if (videoMisses > 0) {
        videoMisses -= 1;
        return new Response(VIDEO_NOT_STORED, { status: 200, headers: { 'content-type': 'application/xml' } });
      }
      return new Response(new Uint8Array(deviceBytes('clip.mp4')), { status: 200 });
    }
    if (url.startsWith(API)) {
      const path = url.slice(API.length);
      calls.push({ method, path, auth: headers.get('authorization'), body });
      const m = /^\/sessions\/([\w-]+)\.json$/.exec(path);
      if (m) return json({ automation_session: { hashed_id: m[1], video_url: `https://bs-video.test/${m[1]}.mp4` } });
      return json({ message: 'not recorded' }, 404);
    }
    const path = url.slice(HUB.length);
    calls.push({ method, path, auth: headers.get('authorization'), body });
    const p = body ? (JSON.parse(body) as Record<string, unknown>) : {};
    if (method === 'POST' && path === '/session') {
      n += 1;
      site.load(`${CONTRACT_BASE}/`);
      return json(deviceJson('webdriver-new-session.json', { id: `fixturesession${n}` }));
    }
    const rest = path.replace(/^\/session\/[\w-]+/, '');
    if (method === 'DELETE' && rest === '') return json({ value: null });
    if (rest === '/timeouts') return json({ value: null });
    if (rest === '/url' && method === 'POST') {
      site.load(String(p.url));
      return json({ value: null });
    }
    if (rest === '/url') return json({ value: site.href() });
    if (rest === '/back') {
      site.back();
      return json({ value: null });
    }
    if (rest === '/screenshot') return json({ value: png });
    if (rest === '/se/log') {
      const entries = deviceJson<Record<string, unknown>>('chromedriver-browser-log.json', { origin: site.origin });
      return json({ value: site.pending.splice(0).flatMap((kind) => (entries[kind] ? [entries[kind]] : [])) });
    }
    if (rest === '/execute/async') {
      const script = String(p.script);
      const expr = script.slice(script.indexOf('return (\n') + 'return (\n'.length, script.lastIndexOf('\n); })()'));
      try {
        return json({ value: { ok: true, value: site.evaluate(expr) ?? null } });
      } catch (err) {
        return json({ value: { ok: false, error: (err as Error).message } });
      }
    }
    return json({ value: { error: 'unknown command', message: `${method} ${path} is not recorded` } }, 404);
  }) as typeof fetch & { calls: { method: string; path: string; auth: string | null; body: string }[] };
  answer.calls = calls;
  return answer;
}

// Process scripts --------------------------------------------------------------------------

export interface RigScript {
  /** Answers a shell command on the rig, after the ssh master or `sh -c`. */
  shell?: (cmd: string) => ProcessResult | string | Buffer | undefined;
  /** False: `ssh -M` fails as a host that wants a password does. */
  sshOk?: boolean;
}

/** The answer of one rig command: `ssh` with the master, or `sh -c` on a local rig. */
export function rigAnswer(call: Call, state: { master: boolean }, script: RigScript): ProcessResult | string | Buffer | undefined {
  if (call.cmd === 'sh' && call.args[0] === '-c') return script.shell?.(call.args[1] as string);
  if (call.cmd !== 'ssh') return undefined;
  const a = call.args;
  const o = a.indexOf('-O');
  if (o !== -1) {
    const op = a[o + 1];
    if (op === 'check') return state.master ? ok('Master running (pid=4242)\n') : failed(255, 'Control socket connect(/x.sock): No such file or directory');
    if (op === 'exit') {
      state.master = false;
      return ok('', 'Exit request sent.');
    }
    return ok();
  }
  if (a[0] === '-M') {
    if (script.sshOk === false) return failed(255, 'rig-host: Permission denied (publickey,password).');
    state.master = true;
    return ok();
  }
  const remote = a[a.length - 1] as string;
  if (!remote.startsWith(`${REMOTE_PATH}; `)) throw new LaunchwrightError('test.rig', `A rig command without the PATH prefix: ${remote}`);
  return script.shell?.(remote.slice(REMOTE_PATH.length + 2));
}

export interface AndroidScript extends RigScript {
  /** False: `pm path` finds no Telegram. */
  installed?: boolean;
  /** False: `sys.boot_completed` does not answer. */
  booted?: boolean;
  /** The guest `http_proxy` setting at the start. */
  httpProxy?: string;
  /** Answers a local tool that is not adb and not the rig: scrcpy, ffmpeg. */
  other?: Handler;
  /** `/proc/net/unix` of the device. Default: the recorded table with a Telegram WebView socket. */
  netUnix?: string;
  /** `dumpsys window policy` of the device. Default: no lock screen shows. */
  keyguard?: string;
}

/** The keyguard block of `dumpsys window policy` on a Pixel 9a, as recorded. */
export function keyguardText(showing: boolean, inputRestricted: boolean): string {
  return ['    KeyguardServiceDelegate', `      showing=${showing}`, `      inputRestricted=${inputRestricted}`, '      occluded=false', '      trusted=false', ''].join('\n');
}

/** ffmpeg that copies its input (after `-i`) to its output (the last argument). */
export function fakeFfmpeg(call: Call): ProcessResult {
  const input = call.args[call.args.indexOf('-i') + 1] as string;
  copyFileSync(input, call.args.at(-1) as string);
  return ok();
}

/** adb, the ssh master and the rig shell of an Android device that shows `site` in its browser. */
export function androidRunner(site: FakeSite, script: AndroidScript = {}): ScriptedRunner & { proxy(): string } {
  const state = { master: false };
  let proxy = script.httpProxy ?? 'null';
  let up = script.booted !== false;
  // The rig side: the AVD folder test, and adb emu kill, which runs on the rig where the console listens.
  const rigShell = (cmd: string): ProcessResult | undefined => {
    if (cmd.includes('test -d "$HOME/.android/avd/')) return ok();
    if (/^adb -s '[^']+' emu kill$/.test(cmd)) {
      up = false;
      return ok('OK: killing emulator, bye bye\n');
    }
    return undefined;
  };
  const runner: ScriptedRunner = new ScriptedRunner((call) => {
    if (call.cmd === 'ffmpeg' && !script.other) return fakeFfmpeg(call);
    if (call.cmd !== 'adb') return script.other?.(call) ?? rigAnswer(call, state, { ...script, shell: (cmd) => script.shell?.(cmd) ?? rigShell(cmd) });
    const { rest } = adbArgs(call);
    const line = rest.join(' ');
    if (line === 'devices') return deviceText('adb-devices.txt');
    if (line === 'version') return 'Android Debug Bridge version 1.0.41\nVersion 35.0.2-12147458\n';
    if (line === 'shell settings get global http_proxy') return `${proxy}\n`;
    if (line.startsWith('shell settings put global http_proxy ')) {
      proxy = rest.at(-1) as string;
      return ok();
    }
    if (line.startsWith('shell pm path ')) return script.installed === false ? failed(1, '') : 'package:/data/app/~~fixture==/base.apk\n';
    if (line.startsWith('shell am start')) {
      const uri = (rest[rest.indexOf('-d') + 1] ?? '').replace(/^'|'$/g, '');
      if (uri.startsWith('http')) site.load(uri);
      return 'Starting: Intent { act=android.intent.action.VIEW }\nStatus: ok\nLaunchState: COLD\n';
    }
    if (line.startsWith('shell am force-stop')) return ok();
    if (line === 'shell cat /proc/net/unix') return script.netUnix ?? deviceText('proc-net-unix.txt');
    if (line === 'exec-out cat /proc/4821/cmdline') return 'org.telegram.messenger.web\0';
    if (line === 'exec-out cat /proc/5119/cmdline') return 'com.example.other\0';
    if (line === 'forward --list') return '';
    if (line.startsWith('forward tcp:0 localabstract:')) return '41235\n';
    if (line.startsWith('forward --remove') || line.startsWith('reverse ')) return ok();
    if (line === 'exec-out screencap -p') return deviceBytes('screen.png');
    if (line.startsWith('shell rm -f /sdcard/') || line.startsWith('shell screenrecord ')) return ok();
    if (line === 'shell pkill -INT -x screenrecord') {
      runner.endAll();
      return ok();
    }
    if (line.startsWith('exec-out cat /sdcard/lw-qa-')) return deviceBytes('clip.mp4');
    if (line === 'shell uiautomator dump /sdcard/window_dump.xml') return 'UI hierchary dumped to: /sdcard/window_dump.xml\n';
    if (line === 'shell cat /sdcard/window_dump.xml') return deviceText('uiautomator.xml');
    if (line === 'shell wm size') return 'Physical size: 1080x2400\n';
    if (line.startsWith('shell input swipe 2 ')) {
      site.back();
      return ok();
    }
    if (line.startsWith('shell input ')) return ok();
    if (line === 'shell getprop sys.boot_completed') return up ? '1\n' : failed(1, 'error: device offline');
    if (line === 'get-state') return 'device\n';
    if (line === 'shell dumpsys window policy') return script.keyguard ?? keyguardText(false, false);
    if (line === 'emu kill') {
      up = false;
      return ok('OK: killing emulator, bye bye\n');
    }
    return undefined;
  });
  return Object.assign(runner, { proxy: () => proxy });
}

/** `xcrun simctl` on a rig that shows `site` in the simulator's Safari. */
export function simctlShell(site: FakeSite): (cmd: string) => ProcessResult | string | Buffer | undefined {
  return (cmd) => {
    if (cmd.includes("'simctl' 'list' 'devices'")) return deviceText('simctl-list.txt');
    if (cmd.includes("'simctl' 'openurl'")) {
      const url = /'(https?:[^']+)'$/.exec(cmd)?.[1];
      if (url) site.load(url);
      return ok();
    }
    const shot = /'screenshot' '([^']+)'$/.exec(cmd);
    if (shot) return `Detected file type 'PNG' from extension\nWrote screenshot to: ${shot[1]}\n`;
    if (cmd.includes("'recordVideo'")) return '4242\n';
    if (cmd.startsWith('kill -INT 4242')) return ok();
    if (/^cat '[^']+\.png'/.test(cmd)) return deviceBytes('screen.png');
    if (/^cat '[^']+\.mp4'/.test(cmd)) return deviceBytes('clip.mp4');
    return undefined;
  };
}

// Deps and config --------------------------------------------------------------------------

export function fakeDeps(parts: Partial<DeviceDeps> & { root: string }): DeviceDeps {
  let port = 41000;
  return {
    run: new ScriptedRunner(() => undefined),
    socket: () => {
      throw new LaunchwrightError('test.socket', 'no socket in this test');
    },
    fetch: (async () => {
      throw new LaunchwrightError('test.fetch', 'no fetch in this test');
    }) as typeof fetch,
    clock: steppingClock(),
    freePort: async () => {
      port += 1;
      return port;
    },
    ...parts,
  };
}

/** A `qa` config with the given `qa.device` section. */
export function deviceConfig(device: Record<string, unknown>, rest: Record<string, unknown> = {}): QaConfig {
  return withDevice(qaConfig.parse({ ...rest, device }));
}

/** A 32 character fixture key: never a real one. */
export const BS_KEY = 'fixtureAccessKey0000000000000000';
export const BS_USER = 'fixtureuser1';
