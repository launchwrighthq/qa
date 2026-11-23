import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/telegram/bot-api.mts
var TOKEN_SHAPE = /[0-9]{4,}:[A-Za-z0-9_-]{20,}/g;
function redactToken(text, token) {
  const stripped = token ? text.split(token).join("[redacted]") : text;
  return stripped.replace(TOKEN_SHAPE, "[redacted]");
}
function reasonOf(status, errorCode) {
  const code = errorCode ?? status;
  if (status === 0) return "network";
  if (code === 429) return "rate_limited";
  if (code >= 500) return "server";
  if (code === 401 || code === 404) return "unauthorized";
  if (code === 403) return "forbidden";
  if (code === 409) return "conflict";
  if (code === 400) return "bad_request";
  return "unknown";
}
var TelegramApiError = class extends LaunchwrightError {
  method;
  /** The HTTP status. 0 when no answer arrived. */
  status;
  /** Telegram's own description, with any token removed. */
  description;
  constructor(method, failure, cause) {
    const reason = reasonOf(failure.status, failure.error_code);
    const raw = failure.description ?? (failure.status === 0 ? "no answer from the Bot API" : `HTTP ${failure.status}`);
    super(`telegram.api.${reason}`, redactToken(`Bot API ${method} failed (${failure.error_code ?? failure.status}): ${raw}`), {
      cause,
      context: { method, status: failure.status, errorCode: failure.error_code, reason }
    });
    this.method = method;
    this.status = failure.status;
    this.description = redactToken(raw);
  }
};
function botIdOfToken(token) {
  const at = token.indexOf(":");
  const id = Number(token.slice(0, at));
  if (at <= 0 || !Number.isSafeInteger(id) || id <= 0 || token.length - at < 2) {
    throw new LaunchwrightError("telegram.token.invalid", "A bot token has the form <bot id>:<secret>.", { context: { key: "token" } });
  }
  return id;
}
var BotApi = class {
  botId;
  token;
  apiUrl;
  timeoutMs;
  fetchFn;
  constructor(opts) {
    this.botId = botIdOfToken(opts.token);
    this.token = opts.token;
    this.apiUrl = (opts.apiUrl ?? "https://api.telegram.org").replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 1e4;
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
  }
  /** Calls one Bot API method and returns its `result`. A failed call throws `TelegramApiError`. */
  async call(method, params = {}, opts = {}) {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? this.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    let response;
    try {
      response = await this.fetchFn(`${this.apiUrl}/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal
      });
    } catch (cause) {
      if (opts.signal?.aborted) throw new LaunchwrightError("telegram.api.aborted", `Bot API ${method} was aborted.`, { cause, context: { method } });
      throw new TelegramApiError(method, { status: 0 }, cause);
    }
    let answer;
    try {
      answer = await response.json();
    } catch (cause) {
      throw new TelegramApiError(method, { status: response.status, description: `the answer is not JSON (HTTP ${response.status})` }, cause);
    }
    if (answer.ok === true) return answer.result;
    throw new TelegramApiError(method, {
      status: response.status,
      ...answer.error_code !== void 0 ? { error_code: answer.error_code } : {},
      ...answer.description !== void 0 ? { description: answer.description } : {}
    });
  }
  getMe() {
    return this.call("getMe");
  }
  setChatMenuButton(menuButton, chatId) {
    return this.call("setChatMenuButton", { menu_button: menuButton, ...chatId !== void 0 ? { chat_id: chatId } : {} });
  }
};

export {
  TelegramApiError,
  BotApi
};
//# sourceMappingURL=chunk-RZYPGI2F.js.map