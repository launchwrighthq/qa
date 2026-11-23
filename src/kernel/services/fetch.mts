import { type Clock, systemClock } from './clock.mts';
import { LaunchwrightError } from './errors.mts';

/** The redirect statuses of RFC 9110 section 15.4. A provider call treats every 3xx as an error. */
export const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/**
 * True when the answer of a fetch with `redirect: 'manual'` is a redirect: a status of
 * `REDIRECT_STATUSES`, or the opaque answer (status 0) that a browser fetch gives instead.
 */
export function isRedirect(res: Response): boolean {
  return res.type === 'opaqueredirect' || REDIRECT_STATUSES.has(res.status);
}

/** The methods that change state on the server (RFC 9110 section 9.2.1). */
export const UNSAFE_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** The statuses that `providerRequest` maps to `<area>.unavailable`, besides every 5xx. */
const TRANSIENT: ReadonlySet<number> = new Set([408, 425, 429]);

/**
 * The origin and the path of `url`, for an error message or a log line. The user name, the
 * password, the query and the fragment can hold a token or a signature, so they never appear.
 */
export function safeUrl(url: string): string {
  if (!URL.canParse(url)) return '(not a URL)';
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}

/** `Retry-After` in milliseconds: delay seconds or an HTTP date. Undefined when absent or not valid. */
export function retryAfterMs(value: string | null, nowMs: number): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^[0-9]+$/.test(text)) return Number(text) * 1000;
  const at = Date.parse(text);
  return Number.isNaN(at) ? undefined : Math.max(0, at - nowMs);
}

/** The init that `providerRequest` gives a fetch. Tests pass a fetch that replays recorded HTTP. */
export interface ProviderFetchInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
  redirect: 'manual';
  signal?: AbortSignal;
}

export type ProviderFetch = (url: string, init: ProviderFetchInit) => Promise<Response>;

export interface ProviderCall {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  /** A body as sent. Give `body` or `json`, not both. */
  body?: string;
  /** A value to send as JSON, with `content-type: application/json`. */
  json?: unknown;
}

export interface ProviderRequestOptions {
  /** The error code prefix, for example `deploy.server` or `ops.cost`. Codes are `<area>.<suffix>`. */
  area: string;
  /** The provider or driver name that the message starts with. */
  supplier: string;
  req: ProviderCall;
  /** What the call asks for, for the message: `create server`. */
  what?: string;
  /** Statuses outside 2xx that return instead of throwing. */
  allow?: readonly number[];
  /** `json` (default) parses the body, null for an empty body. `text` returns the body as text. */
  expect?: 'json' | 'text';
  /** The `accept` header. Default `application/json`. */
  accept?: string;
  timeoutMs?: number;
  /** The clock of an HTTP date in `Retry-After`. Default `systemClock`. */
  clock?: Clock;
  /** The code suffix of a status. Default `statusSuffix`. */
  classify?: (status: number) => string;
}

export interface ProviderResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

/**
 * The default code suffix of a status outside 2xx: `redirect` (3xx), `auth` (401, 403), `billing`
 * (402), `not-found` (404), `refused` (409, 422), `unavailable` (408, 425, 429, 5xx), else `http`.
 */
export function statusSuffix(status: number): string {
  if (status >= 300 && status < 400) return 'redirect';
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'billing';
  if (status === 404) return 'not-found';
  if (status === 409 || status === 422) return 'refused';
  if (TRANSIENT.has(status) || status >= 500) return 'unavailable';
  return 'http';
}

/** The provider's own error text from a JSON error body, cut to 200 characters. */
function providerMessage(text: string): string | undefined {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (cause) {
    // A body that is not JSON has no provider message. The status alone names the failure.
    if (!(cause instanceof SyntaxError)) throw cause;
    return undefined;
  }
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as Record<string, unknown>;
  const err = b.error as Record<string, unknown> | string | undefined;
  const msg = typeof err === 'string' ? err : (err?.message ?? b.message ?? (Array.isArray(b.errors) ? JSON.stringify(b.errors) : undefined));
  return typeof msg === 'string' ? msg.slice(0, 200) : undefined;
}

function initOf(o: ProviderRequestOptions): ProviderFetchInit {
  const { req } = o;
  const json = req.json !== undefined;
  const body = json ? JSON.stringify(req.json) : req.body;
  return {
    method: req.method ?? 'GET',
    headers: { accept: o.accept ?? 'application/json', ...(json ? { 'content-type': 'application/json' } : {}), ...req.headers },
    ...(body !== undefined ? { body } : {}),
    redirect: 'manual',
    ...(o.timeoutMs !== undefined ? { signal: AbortSignal.timeout(o.timeoutMs) } : {}),
  };
}

function statusError(o: ProviderRequestOptions, res: Response, text: string, context: Record<string, unknown>): LaunchwrightError {
  const status = res.status;
  // A browser fetch gives a manual redirect as an opaque response with status 0.
  const suffix = res.type === 'opaqueredirect' ? 'redirect' : (o.classify ?? statusSuffix)(status);
  const detail = providerMessage(text);
  const wait = suffix === 'unavailable' ? retryAfterMs(res.headers.get('retry-after'), (o.clock ?? systemClock).now()) : undefined;
  const on = o.what ? ` on ${o.what}` : '';
  const shown = suffix === 'refused' && detail ? `: ${detail}` : '';
  return new LaunchwrightError(`${o.area}.${suffix}`, `${o.supplier}: ${context.host as string} answered ${status}${on}${shown}`, {
    context: { ...context, status, ...(detail ? { detail } : {}), ...(wait !== undefined ? { retryAfterMs: wait } : {}) },
  });
}

/**
 * Sends one request to a provider API. It never follows a redirect, so a credential in a header
 * never reaches another host. Errors are LaunchwrightError `<area>.<suffix>` (see `statusSuffix`),
 * `<area>.unavailable` for no answer and `<area>.read` for a body that is not JSON. A message and
 * the context hold the supplier, the host and the status, never the URL, a header or the body.
 */
export async function providerRequest(fetchFn: ProviderFetch, o: ProviderRequestOptions): Promise<ProviderResponse> {
  const host = URL.canParse(o.req.url) ? new URL(o.req.url).host : '(not a URL)';
  const context: Record<string, unknown> = { supplier: o.supplier, host, ...(o.what ? { what: o.what } : {}) };
  let res: Response;
  try {
    res = await fetchFn(o.req.url, initOf(o));
  } catch (cause) {
    throw new LaunchwrightError(`${o.area}.unavailable`, `${o.supplier}: request to ${host} failed${o.what ? ` on ${o.what}` : ''}`, { cause, context });
  }
  const text = await res.text();
  const passes = (res.status >= 200 && res.status < 300) || o.allow?.includes(res.status) === true;
  if (!passes) throw statusError(o, res, text, context);
  if (o.expect === 'text') return { status: res.status, headers: res.headers, body: text };
  if (text.trim() === '') return { status: res.status, headers: res.headers, body: null };
  try {
    return { status: res.status, headers: res.headers, body: JSON.parse(text) as unknown };
  } catch (cause) {
    throw new LaunchwrightError(`${o.area}.read`, `${o.supplier}: ${host} answered ${res.status} with a body that is not JSON`, { cause, context: { ...context, status: res.status } });
  }
}
