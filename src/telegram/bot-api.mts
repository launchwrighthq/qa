// The Bot API client of the library: one `fetch` per call, no client library. It holds only what the
// telegram-bot intake driver, the throwaway-bot lifecycle and the worktree menu button use. The token
// is in the URL of every call, so no error holds the URL, and `redactToken` strips a token from text.
import { LaunchwrightError } from '../kernel/index.mts';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface BotApiOptions {
  /** The bot token, `<bot id>:<secret>`. */
  token: string;
  /** Default `https://api.telegram.org`. Tests point it at a fake Bot API. */
  apiUrl?: string;
  /** The longest wait for one answer. Default 10000. */
  timeoutMs?: number;
  fetch?: FetchFn;
}

export type Params = Record<string, unknown>;

/** The `Message` fields that the telegram-bot driver reads. Telegram adds fields freely, so it allows more keys. */
export interface TgMessage {
  message_id: number;
  date: number;
  chat: { id: number; title?: string; username?: string };
  from?: { first_name?: string; last_name?: string; username?: string };
  text?: string;
  caption?: string;
  [key: string]: unknown;
}

/** The answer of `getMe`. */
export interface TgBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  [key: string]: unknown;
}

/** A `web_app` menu button of `setChatMenuButton`. */
export interface WebAppMenuButton {
  type: 'web_app';
  text: string;
  web_app: { url: string };
}

/** The Bot API token shape: the numeric bot id, a colon, then at least 20 secret characters. */
const TOKEN_SHAPE = /[0-9]{4,}:[A-Za-z0-9_-]{20,}/g;

/** Removes the given token and any text in the token shape, so no message carries a token. */
export function redactToken(text: string, token?: string): string {
  const stripped = token ? text.split(token).join('[redacted]') : text;
  return stripped.replace(TOKEN_SHAPE, '[redacted]');
}

/** Why a call failed, from its HTTP status and Telegram's `error_code`. Status 0 means no answer arrived. */
function reasonOf(status: number, errorCode: number | undefined): string {
  const code = errorCode ?? status;
  if (status === 0) return 'network';
  if (code === 429) return 'rate_limited';
  if (code >= 500) return 'server';
  if (code === 401 || code === 404) return 'unauthorized';
  if (code === 403) return 'forbidden';
  if (code === 409) return 'conflict';
  if (code === 400) return 'bad_request';
  return 'unknown';
}

/** A Bot API call that did not come back `ok`. The code is `telegram.api.<reason>`. */
export class TelegramApiError extends LaunchwrightError {
  readonly method: string;
  /** The HTTP status. 0 when no answer arrived. */
  readonly status: number;
  /** Telegram's own description, with any token removed. */
  readonly description: string;

  constructor(method: string, failure: { status: number; error_code?: number; description?: string }, cause?: unknown) {
    const reason = reasonOf(failure.status, failure.error_code);
    const raw = failure.description ?? (failure.status === 0 ? 'no answer from the Bot API' : `HTTP ${failure.status}`);
    super(`telegram.api.${reason}`, redactToken(`Bot API ${method} failed (${failure.error_code ?? failure.status}): ${raw}`), {
      cause,
      context: { method, status: failure.status, errorCode: failure.error_code, reason },
    });
    this.method = method;
    this.status = failure.status;
    this.description = redactToken(raw);
  }
}

/** The numeric bot id: the part of the token before the colon. Throws `telegram.token.invalid`. */
export function botIdOfToken(token: string): number {
  const at = token.indexOf(':');
  const id = Number(token.slice(0, at));
  if (at <= 0 || !Number.isSafeInteger(id) || id <= 0 || token.length - at < 2) {
    throw new LaunchwrightError('telegram.token.invalid', 'A bot token has the form <bot id>:<secret>.', { context: { key: 'token' } });
  }
  return id;
}

export class BotApi {
  readonly botId: number;
  private readonly token: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchFn;

  constructor(opts: BotApiOptions) {
    this.botId = botIdOfToken(opts.token);
    this.token = opts.token;
    this.apiUrl = (opts.apiUrl ?? 'https://api.telegram.org').replace(/\/+$/, '');
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Calls one Bot API method and returns its `result`. A failed call throws `TelegramApiError`. */
  async call<T = unknown>(method: string, params: Params = {}, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? this.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    let response: Response;
    try {
      response = await this.fetchFn(`${this.apiUrl}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
        signal,
      });
    } catch (cause) {
      if (opts.signal?.aborted) throw new LaunchwrightError('telegram.api.aborted', `Bot API ${method} was aborted.`, { cause, context: { method } });
      throw new TelegramApiError(method, { status: 0 }, cause);
    }
    let answer: { ok?: boolean; result?: unknown; error_code?: number; description?: string };
    try {
      answer = (await response.json()) as typeof answer;
    } catch (cause) {
      throw new TelegramApiError(method, { status: response.status, description: `the answer is not JSON (HTTP ${response.status})` }, cause);
    }
    if (answer.ok === true) return answer.result as T;
    throw new TelegramApiError(method, {
      status: response.status,
      ...(answer.error_code !== undefined ? { error_code: answer.error_code } : {}),
      ...(answer.description !== undefined ? { description: answer.description } : {}),
    });
  }

  getMe(): Promise<TgBotInfo> {
    return this.call('getMe');
  }

  setChatMenuButton(menuButton: WebAppMenuButton, chatId?: number): Promise<true> {
    return this.call('setChatMenuButton', { menu_button: menuButton, ...(chatId !== undefined ? { chat_id: chatId } : {}) });
  }
}
