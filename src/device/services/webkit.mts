// The WebKit inspector of a real iPhone, through `ios_webkit_debug_proxy` on a rig (spec 2.8
// `ios-webkit`). iOS 12.2 and later route a page through the Target domain: a command travels in
// `Target.sendMessageToTarget` and its reply comes back in `Target.dispatchMessageFromTarget`.
// The proxy serves two things: the device list on one port and the pages of each device on another.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { type DeviceDeps, deferred } from './process.mts';

/** One phone in the proxy device list. The id and the name are never printed. */
export interface WebkitDevice {
  id: string;
  name: string;
  version: string;
  /** The page port of this phone on the rig. */
  port: number;
}

/** One page of a phone. */
export interface WebkitPage {
  url?: string;
  title?: string;
  webSocketDebuggerUrl?: string;
}

/** The device list JSON to one row per phone. A row it cannot read fails, naming only its index. */
export function parseDeviceList(json: unknown): WebkitDevice[] {
  if (!Array.isArray(json)) throw new LaunchwrightError('qa.device.webkit', `The proxy device list is not an array (got ${typeof json}).`);
  return json.map((row: Record<string, unknown>, i) => {
    const id = String(row?.deviceId ?? '').trim();
    if (!id) throw new LaunchwrightError('qa.device.webkit', `Device ${i} in the proxy list has no deviceId.`);
    const m = /:(\d+)$/.exec(String(row.url ?? '').trim());
    const port = m ? Number(m[1]) : 0;
    if (!(port > 0 && port < 65_536)) throw new LaunchwrightError('qa.device.webkit', `Device ${i} in the proxy list has no page port in its url.`);
    return { id, name: String(row.deviceName ?? '').trim(), version: String(row.deviceOSVersion ?? '').trim(), port };
  });
}

/** A page with a URL that is not a bare JavaScript context. */
export function isDocument(page: WebkitPage): boolean {
  return Boolean(page.url) && page.title !== 'JSContext';
}

/**
 * The page to drive. `match` is a case-insensitive part of `url + title`. With no match, a page
 * that is not `about:blank` comes first: a WebView is blank for its first moments.
 */
export function pickPage(list: unknown, match?: string): WebkitPage {
  const pages = Array.isArray(list) ? (list as WebkitPage[]) : [];
  const docs = pages.filter(isDocument);
  const seen = pages.length ? `${pages.length} page(s)` : 'no pages';
  if (docs.length === 0) {
    throw new LaunchwrightError('qa.device.webkit.page', `No inspectable page (${seen}). Unlock the iPhone and open the page in Safari or the Mini App.`);
  }
  if (!match) return docs.find((p) => !String(p.url).startsWith('about:blank')) ?? (docs[0] as WebkitPage);
  const needle = match.toLowerCase();
  const hit = docs.find((p) => `${p.url ?? ''} ${p.title ?? ''}`.toLowerCase().includes(needle));
  if (!hit) throw new LaunchwrightError('qa.device.webkit.page', `No page matches ${JSON.stringify(match)} (${seen}).`);
  return hit;
}

/** The page socket URL of the phone, pointed at our forward. */
export function localise(wsUrl: string | undefined, port: number): string {
  const url = String(wsUrl ?? '');
  if (!/^wss?:\/\/[^/]+\//.test(url)) throw new LaunchwrightError('qa.device.webkit', 'The page has no usable webSocketDebuggerUrl.');
  return url.replace(/^wss?:\/\/[^/]+/, `ws://127.0.0.1:${port}`);
}

/** One command wrapped for the Target domain. The inner message is a string. */
export function framed(targetId: string, id: number, method: string, params: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, method: 'Target.sendMessageToTarget', params: { targetId, message: JSON.stringify({ id, method, params }) } };
}

export type Frame =
  | { kind: 'target-created'; targetId: string }
  | { kind: 'from-target'; message: { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: unknown } }
  | { kind: 'other'; method?: string };

/** One socket frame, tagged. A frame that is not JSON throws. */
export function unframe(raw: unknown): Frame {
  const frame = JSON.parse(String(raw)) as { method?: string; params?: { targetInfo?: { targetId?: string }; message?: unknown } };
  if (frame.method === 'Target.targetCreated') return { kind: 'target-created', targetId: String(frame.params?.targetInfo?.targetId ?? '') };
  if (frame.method === 'Target.dispatchMessageFromTarget') {
    const m = frame.params?.message;
    return { kind: 'from-target', message: typeof m === 'string' ? JSON.parse(m) : (m as Frame & object) };
  }
  return frame.method ? { kind: 'other', method: frame.method } : { kind: 'other' };
}

/** The console command that starts the proxy for the configured ports. */
export function proxyCommand(listPort: number, pagePort: number): string {
  return `sudo ios_webkit_debug_proxy -c null:${listPort},:${pagePort}-${pagePort + 77}`;
}

export interface WebkitSession {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  on(handler: (ev: { method?: string; params?: Record<string, unknown> }) => void): void;
}

/**
 * One inspector session on one page: open the socket, wait for the target, run `fn`, close on
 * every path. A locked phone still lists pages and never announces a target, which the timeout names.
 */
export function withTarget<T>(deps: DeviceDeps, page: WebkitPage, port: number, timeoutMs: number, fn: (s: WebkitSession) => Promise<T>): Promise<T> {
  const url = localise(page.webSocketDebuggerUrl, port);
  const done = deferred<T>();
  const resolve = done.resolve;
  const reject = done.reject;
  const ws = deps.socket(url, { origin: `http://127.0.0.1:${port}` });
  const pending = new Map<number, { method: string; resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  const listeners = new Set<(ev: { method?: string; params?: Record<string, unknown> }) => void>();
  let targetId: string | null = null;
  let nextId = 0;
  let settled = false;

  const timer = setTimeout(() => {
    finish(
      new LaunchwrightError(
        'qa.device.webkit.timeout',
        targetId ? `The page did not answer within ${timeoutMs / 1000} s.` : `The page announced no target within ${timeoutMs / 1000} s. The iPhone is locked, or the page is gone.`,
      ),
    );
  }, timeoutMs);

  function finish(error: Error | null, value?: T): void {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    for (const slot of pending.values()) slot.reject(new LaunchwrightError('qa.device.webkit', `${slot.method} was in flight when the session ended.`));
    pending.clear();
    listeners.clear();
    ws.onclose = null;
    ws.close();
    if (error) reject(error);
    else resolve(value as T);
  }

  const session: WebkitSession = {
    send(method, params = {}) {
      return new Promise((ok, no) => {
        if (settled || !targetId) {
          no(new LaunchwrightError('qa.device.webkit', `${method} was sent outside a live target.`));
          return;
        }
        nextId += 1;
        pending.set(nextId, { method, resolve: ok, reject: no });
        ws.send(JSON.stringify(framed(targetId, nextId, method, params)));
      });
    },
    on(handler) {
      listeners.add(handler);
    },
  };

  ws.onmessage = (ev) => {
    let frame: Frame;
    try {
      frame = unframe(ev.data);
    } catch (err) {
      finish(new LaunchwrightError('qa.device.webkit', 'The inspector sent a frame that is not JSON.', { cause: err }));
      return;
    }
    if (frame.kind === 'target-created') {
      if (targetId) return;
      targetId = frame.targetId;
      fn(session).then(
        (v) => finish(null, v),
        (e: unknown) => finish(e instanceof Error ? e : new LaunchwrightError('qa.device.webkit', String(e))),
      );
      return;
    }
    if (frame.kind === 'from-target') {
      const inner = frame.message;
      const slot = inner.id === undefined ? undefined : pending.get(inner.id);
      if (!slot) {
        if (inner.method) for (const h of [...listeners]) h({ method: inner.method, ...(inner.params ? { params: inner.params } : {}) });
        return;
      }
      pending.delete(inner.id as number);
      if (inner.error) slot.reject(new LaunchwrightError('qa.device.webkit', `${slot.method} failed: ${JSON.stringify(inner.error)}`));
      else slot.resolve(inner.result ?? {});
      return;
    }
    if (frame.method === 'Target.targetDestroyed') finish(new LaunchwrightError('qa.device.webkit', 'The page closed its inspector target.'));
  };
  ws.onerror = () => finish(new LaunchwrightError('qa.device.webkit', `The inspector socket failed (${url}).`));
  ws.onclose = () => finish(new LaunchwrightError('qa.device.webkit', 'The inspector socket closed before the command finished.'));
  return done.promise;
}

function refuseIfThrown(reply: Record<string, unknown>): void {
  if (!reply.wasThrown && !reply.exceptionDetails) return;
  const remote = (reply.result ?? {}) as { description?: string; value?: unknown };
  throw new LaunchwrightError('qa.device.eval', `The page threw on the iPhone: ${String(remote.description ?? remote.value ?? 'unknown error').slice(0, 500)}`);
}

function unwrap(reply: Record<string, unknown>): unknown {
  refuseIfThrown(reply);
  const remote = (reply.result ?? {}) as { type?: string; value?: unknown };
  if (remote.type === 'undefined') return undefined;
  return 'value' in remote ? remote.value : remote;
}

/**
 * Evaluates an expression and answers its value. WebKit accepts `awaitPromise` and ignores it, so a
 * promise is awaited with `Runtime.awaitPromise` and an object is fetched by value in a second call.
 */
export async function webkitEvaluate(s: WebkitSession, expression: string): Promise<unknown> {
  await s.send('Runtime.enable');
  const first = await s.send('Runtime.evaluate', { expression, returnByValue: false });
  refuseIfThrown(first);
  const remote = (first.result ?? {}) as { className?: string; objectId?: string };
  if (remote.className === 'Promise' && remote.objectId) return unwrap(await s.send('Runtime.awaitPromise', { promiseObjectId: remote.objectId, returnByValue: true }));
  if (remote.objectId) {
    return unwrap(await s.send('Runtime.callFunctionOn', { objectId: remote.objectId, functionDeclaration: 'function () { return this; }', returnByValue: true }));
  }
  return unwrap(first);
}

/** A PNG of the page viewport at the phone's pixel scale, through `Page.snapshotRect`. */
export async function webkitSnapshot(s: WebkitSession): Promise<Buffer> {
  const size = (await webkitEvaluate(s, '({ w: innerWidth, h: innerHeight })')) as { w?: number; h?: number } | undefined;
  const width = Math.round(size?.w ?? 0);
  const height = Math.round(size?.h ?? 0);
  if (!(width > 0 && height > 0)) throw new LaunchwrightError('qa.device.webkit', `The page reported a ${width}x${height} viewport, which cannot be captured.`);
  await s.send('Page.enable');
  const shot = await s.send('Page.snapshotRect', { x: 0, y: 0, width, height, coordinateSystem: 'Viewport' });
  const dataURL = typeof shot.dataURL === 'string' ? shot.dataURL : '';
  const at = dataURL.indexOf('base64,');
  if (at === -1) throw new LaunchwrightError('qa.device.webkit', 'Page.snapshotRect answered no base64 dataURL.');
  return Buffer.from(dataURL.slice(at + 'base64,'.length), 'base64');
}

/** One console message of the page. `Console.enable` replays what the page logged before it. */
export interface WebkitConsoleLine {
  /** `javascript` for an uncaught error, `console-api` for `console.*`, `network` for a failed load. */
  source: string;
  level: string;
  text: string;
}

/** Collects console messages for `ms`, the replayed ones included. */
export async function webkitConsole(deps: DeviceDeps, s: WebkitSession, ms: number): Promise<WebkitConsoleLine[]> {
  const lines: WebkitConsoleLine[] = [];
  s.on((ev) => {
    if (ev.method !== 'Console.messageAdded') return;
    const m = (ev.params?.message ?? {}) as { source?: string; level?: string; text?: string };
    lines.push({ source: m.source ?? 'other', level: m.level ?? 'log', text: String(m.text ?? '').slice(0, 500) });
  });
  await s.send('Console.enable');
  await deps.clock.sleep(ms);
  return lines;
}

/** Fetches one JSON endpoint of the proxy through a forward. */
export async function proxyJson(deps: DeviceDeps, port: number, what: string): Promise<unknown> {
  const url = `http://127.0.0.1:${port}/json`;
  let res: Response;
  try {
    res = await deps.fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new LaunchwrightError('qa.device.webkit.proxy', `The ${what} on :${port} did not answer: ${(err as Error).message}. Is ios_webkit_debug_proxy running on the rig?`, { cause: err });
  }
  if (!res.ok) throw new LaunchwrightError('qa.device.webkit.proxy', `The ${what} on :${port} answered HTTP ${res.status}.`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new LaunchwrightError('qa.device.webkit.proxy', `The ${what} on :${port} did not answer JSON.`, { cause: err });
  }
}
