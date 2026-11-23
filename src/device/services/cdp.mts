// A raw Chrome DevTools Protocol client for an Android WebView (spec 2.8). An Android WebView
// leaves `webSocketDebuggerUrl` out of `/json/version`, so Playwright's `connectOverCDP` cannot
// attach. `/json/list` has one per page, and this client speaks CDP to that page socket directly.
// Telegram keeps a pool of WebViews; `openVisiblePage` asks each for `document.visibilityState`.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { SessionLogLine } from '../drivers/target/contract.mts';
import { chooseVisiblePage, VISIBILITY_EXPRESSION } from './page-script.mts';
import { type DeviceDeps, deferred } from './process.mts';

export interface CdpEvent {
  method: string;
  params?: Record<string, unknown>;
}

export interface CdpClient {
  send(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, unknown>>;
  /** `Runtime.evaluate` with the value returned. A page exception fails with `qa.device.eval`. */
  evaluate(expression: string): Promise<unknown>;
  close(): void;
}

/** One `/json/list` row. */
export interface DevtoolsTarget {
  id: string;
  type: string;
  url?: string;
  title?: string;
  webSocketDebuggerUrl?: string;
}

/** One devtools HTTP call, as JSON. */
export async function devtoolsJson(deps: DeviceDeps, port: number, path: string): Promise<unknown> {
  const url = `http://127.0.0.1:${port}${path}`;
  let res: Response;
  try {
    res = await deps.fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    throw new LaunchwrightError('qa.device.cdp', `GET ${url} did not answer: ${(err as Error).message}`, { cause: err });
  }
  const body = await res.text();
  if (!res.ok) throw new LaunchwrightError('qa.device.cdp', `GET ${url} answered ${res.status}: ${body.slice(0, 200)}`);
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new LaunchwrightError('qa.device.cdp', `GET ${url} answered ${body.length} bytes that are not JSON.`, { cause: err });
  }
}

/** The page socket URL pointed at our forward. The handler names its own port; the path names the page. */
export function rewriteWsUrl(wsUrl: string, port: number): string {
  const u = new URL(wsUrl);
  u.host = `127.0.0.1:${port}`;
  return u.toString();
}

/** Pages a client can attach to: `type: page` with a socket URL. A page without one has a client already. */
export function attachablePages(targets: unknown): DevtoolsTarget[] {
  return (Array.isArray(targets) ? (targets as DevtoolsTarget[]) : []).filter(
    (t) => t?.type === 'page' && typeof t.webSocketDebuggerUrl === 'string' && t.webSocketDebuggerUrl !== '',
  );
}

/** Opens a page socket. `onEvent` gets each event: console output and page errors arrive only that way. */
export function connectCdp(deps: DeviceDeps, wsUrl: string, onEvent?: (ev: CdpEvent) => void): Promise<CdpClient> {
  const ready = deferred<CdpClient>();
  const resolve = ready.resolve;
  const reject = ready.reject;
  const ws = deps.socket(wsUrl);
  const pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; method: string }>();
  let nextId = 1;
  let closed: Error | null = null;
  let opened = false;

  const failAll = (err: Error): void => {
    closed ??= err;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
  };

  const opening = setTimeout(() => {
    reject(new LaunchwrightError('qa.device.cdp', `The page socket did not open within 10 s: ${wsUrl}`));
    ws.close();
  }, 10_000);

  ws.onerror = () => {
    clearTimeout(opening);
    const err = new LaunchwrightError('qa.device.cdp', `The page socket failed: ${wsUrl}`);
    failAll(err);
    if (!opened) reject(err);
  };
  ws.onclose = (ev) => {
    clearTimeout(opening);
    failAll(new LaunchwrightError('qa.device.cdp', `The page socket closed (${ev.code ?? '?'} ${ev.reason || 'no reason given'}).`));
  };
  ws.onmessage = (ev) => {
    let msg: { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message?: string } };
    try {
      msg = JSON.parse(String(ev.data));
    } catch (err) {
      failAll(new LaunchwrightError('qa.device.cdp', 'The page sent a frame that is not JSON.', { cause: err }));
      ws.close();
      return;
    }
    if (msg.id === undefined) {
      if (msg.method && onEvent) onEvent({ method: msg.method, ...(msg.params ? { params: msg.params } : {}) });
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.error) p.reject(new LaunchwrightError('qa.device.cdp', `CDP ${p.method} failed: ${msg.error.message ?? JSON.stringify(msg.error)}`));
    else p.resolve(msg.result ?? {});
  };

  const client: CdpClient = {
    send(method, params = {}, timeoutMs = 15_000) {
      if (closed) return Promise.reject(closed);
      const id = nextId++;
      const answer = deferred<Record<string, unknown>>();
      const timer = setTimeout(() => {
        pending.delete(id);
        answer.reject(new LaunchwrightError('qa.device.cdp', `CDP ${method} did not answer within ${timeoutMs / 1000} s.`));
      }, timeoutMs);
      pending.set(id, { resolve: answer.resolve, reject: answer.reject, timer, method });
      ws.send(JSON.stringify({ id, method, params }));
      return answer.promise;
    },
    async evaluate(expression) {
      const res = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      const thrown = res.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
      if (thrown) {
        throw new LaunchwrightError('qa.device.eval', `The page threw: ${thrown.exception?.description ?? thrown.text ?? 'unknown error'}`.slice(0, 600));
      }
      return (res.result as { value?: unknown } | undefined)?.value;
    },
    close() {
      ws.onclose = null;
      failAll(new LaunchwrightError('qa.device.cdp', 'The client closed.'));
      ws.close();
    },
  };

  ws.onopen = () => {
    opened = true;
    clearTimeout(opening);
    resolve(client);
  };
  return ready.promise;
}

/** The page the operator sees, with its client open. The other pages' clients are closed at once. */
export interface VisiblePage {
  target: DevtoolsTarget;
  client: CdpClient;
}

/**
 * Asks every attachable page for `document.visibilityState` and keeps the one `visible` page.
 * Devtools allows one client per page, so the losers close before this returns.
 */
export async function openVisiblePage(deps: DeviceDeps, port: number, onEvent?: (ev: CdpEvent) => void): Promise<VisiblePage> {
  const pages = attachablePages(await devtoolsJson(deps, port, '/json/list'));
  const answers: { id: string; url?: string; visibility: string }[] = [];
  const open = new Map<string, { target: DevtoolsTarget; client: CdpClient }>();
  for (const target of pages) {
    let client: CdpClient | null = null;
    try {
      client = await connectCdp(deps, rewriteWsUrl(target.webSocketDebuggerUrl as string, port), onEvent);
      answers.push({ id: target.id, ...(target.url ? { url: target.url } : {}), visibility: String(await client.evaluate(VISIBILITY_EXPRESSION)) });
      open.set(target.id, { target, client });
    } catch (err) {
      // A page that does not answer is not the page on screen. The reason stays in the census.
      answers.push({ id: target.id, ...(target.url ? { url: target.url } : {}), visibility: `unreachable: ${(err as Error).message}` });
      client?.close();
    }
  }
  let chosen: { id: string };
  try {
    chosen = chooseVisiblePage(answers);
  } catch (err) {
    for (const o of open.values()) o.client.close();
    throw err;
  }
  for (const [id, o] of open) if (id !== chosen.id) o.client.close();
  return open.get(chosen.id) as VisiblePage;
}

/** Maps a CDP event to a session log line (spec 2.11.1), or null for an event the log does not keep. */
export function logLineOf(ev: CdpEvent, at: string): SessionLogLine | null {
  const p = (ev.params ?? {}) as Record<string, any>;
  switch (ev.method) {
    case 'Runtime.exceptionThrown':
      return { at, kind: 'page-error', text: String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? 'exception').slice(0, 500) };
    case 'Runtime.consoleAPICalled':
      if (p.type !== 'error') return null;
      return { at, kind: 'console-error', text: (p.args ?? []).map((a: any) => a.value ?? a.description ?? a.type).join(' ').slice(0, 500) };
    case 'Log.entryAdded':
      return p.entry?.level === 'error' ? { at, kind: 'console-error', text: String(p.entry?.text ?? '').slice(0, 500) } : null;
    case 'Network.loadingFailed':
      return p.canceled ? null : { at, kind: 'request-failed', text: `${p.errorText ?? 'failed'} ${p.type ?? ''}`.trim() };
    case 'Network.responseReceived':
      return Number(p.response?.status) >= 500 ? { at, kind: 'response-5xx', text: `${p.response.status} ${String(p.response.url).slice(0, 200)}` } : null;
    default:
      return null;
  }
}
