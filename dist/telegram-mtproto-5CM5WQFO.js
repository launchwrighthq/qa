import {
  kindOf,
  mimeOf
} from "./chunk-LAFOB6RX.js";
import {
  QA_INTAKE_SPEC_VERSION
} from "./chunk-K3F4HTKJ.js";
import "./chunk-RZJZNFR2.js";
import "./chunk-APXO3KTC.js";
import "./chunk-7DHZXG6M.js";
import "./chunk-6LHTNS5B.js";
import {
  BaseDriver,
  z
} from "./chunk-WUOHAWEI.js";
import {
  LaunchwrightError
} from "./chunk-L57WEOVE.js";

// src/telegram/mtproto.mts
async function loadGramJs(importer = (name) => import(name)) {
  const main = "telegram";
  const sessions = "telegram/sessions";
  try {
    const lib = await importer(main);
    const sess = await importer(sessions);
    return { TelegramClient: lib.TelegramClient, StringSession: sess.StringSession };
  } catch (cause) {
    throw new LaunchwrightError("telegram.mtproto.missing", 'The MTProto user client needs GramJS: add the npm package "telegram" (2.26 or later) to the project.', { cause });
  }
}
function socksProxy(url) {
  let u;
  try {
    u = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("telegram.mtproto.proxy", "The proxy is not a URL. Write socks5://[user:password@]host:port.", { cause });
  }
  const port = Number(u.port);
  if (u.protocol !== "socks5:" || u.hostname === "" || !Number.isInteger(port) || port <= 0) {
    throw new LaunchwrightError("telegram.mtproto.proxy", "The proxy must be socks5://[user:password@]host:port.");
  }
  return {
    ip: u.hostname,
    port,
    socksType: 5,
    ...u.username ? { username: decodeURIComponent(u.username) } : {},
    ...u.password ? { password: decodeURIComponent(u.password) } : {}
  };
}
var UserClient = class _UserClient {
  constructor(raw) {
    this.raw = raw;
  }
  raw;
  /** Connects with a saved session. Sign-in (phone code, 2FA) is a step outside this wrapper. */
  static async connect(opts) {
    if (!Number.isInteger(opts.apiId) || opts.apiId <= 0 || opts.apiHash === "") {
      throw new LaunchwrightError("telegram.mtproto.config", "The user client needs apiId and apiHash from my.telegram.org.", { context: { key: "apiId" } });
    }
    const proxy = opts.proxy === void 0 ? void 0 : socksProxy(opts.proxy);
    const gram = await (opts.loader ?? loadGramJs)();
    const client = new gram.TelegramClient(new gram.StringSession(opts.session), opts.apiId, opts.apiHash, {
      connectionRetries: opts.connectionRetries ?? 5,
      ...proxy ? { proxy } : {}
    });
    try {
      await client.connect();
    } catch (cause) {
      throw new LaunchwrightError("telegram.mtproto.connect", "The MTProto user client cannot connect.", { cause });
    }
    return new _UserClient(client);
  }
  sendMessage(peer, text) {
    return this.raw.sendMessage(peer, { message: text });
  }
  /** Reads messages of a chat. `reverse: true` gives the oldest first, from `minId` or `offsetDate` on. */
  async history(peer, opts = {}) {
    return [...await this.raw.getMessages(peer, { ...opts })];
  }
  /** Reads the messages with these ids. A missing message is absent from the result. */
  async messages(peer, ids) {
    const found = await this.raw.getMessages(peer, { ids });
    return [...found].filter((m) => m !== void 0 && m !== null);
  }
  /** Downloads the media of a message into memory. Throws `telegram.mtproto.download`. */
  async downloadMedia(message) {
    let data;
    try {
      data = await this.raw.downloadMedia(message, {});
    } catch (cause) {
      throw new LaunchwrightError("telegram.mtproto.download", "The MTProto user client cannot download the media of a message.", { cause });
    }
    if (!(data instanceof Uint8Array)) {
      throw new LaunchwrightError("telegram.mtproto.download", "The message has no media to download.", { context: { result: typeof data } });
    }
    return data;
  }
  async close() {
    await this.raw.disconnect();
  }
};

// src/intake/drivers/intake/telegram-mtproto.mts
var telegramMtprotoConfig = z.object({
  apiId: z.coerce.number().int().positive(),
  apiHash: z.string().min(1),
  session: z.string().min(1),
  /** `socks5://[user:password@]host:port`: the exit the account always uses (`QA_TELEGRAM_PROXY`). */
  proxy: z.string().min(1).optional()
});
var GRAMJS_READ_METHODS = /* @__PURE__ */ new Set(["connect", "disconnect", "getMessages", "downloadMedia"]);
var READ_METHODS = ["history", "messages", "downloadMedia"];
var PAGE = 100;
function methodError(method) {
  return new LaunchwrightError("qa.intake.telegram.method", `Telegram intake is read-only: the method ${method} is not on the allowlist (history, messages, download).`, {
    context: { method }
  });
}
function guardGramJsClient(raw) {
  return new Proxy(raw, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      const name = String(prop);
      if (GRAMJS_READ_METHODS.has(name)) return value.bind(target);
      return () => {
        throw methodError(name);
      };
    }
  });
}
function readOnlyGramJs(mod) {
  const Base = mod.TelegramClient;
  const Guarded = function(...args) {
    return guardGramJsClient(new Base(...args));
  };
  return { TelegramClient: Guarded, StringSession: mod.StringSession };
}
var ReadOnlyTelegram = class {
  constructor(client) {
    this.client = client;
  }
  client;
  call(method, ...args) {
    if (!READ_METHODS.includes(method)) throw methodError(method);
    const fn = this.client[method];
    return fn.apply(this.client, args);
  }
  close() {
    return this.client.close();
  }
};
function authorOf(m) {
  if (m.postAuthor) return m.postAuthor;
  const s = m.sender;
  const name = [s?.firstName, s?.lastName].filter((p) => p !== void 0 && p !== "").join(" ");
  if (name !== "") return name;
  if (s?.title) return s.title;
  if (s?.username) return `@${s.username}`;
  return m.senderId !== void 0 && m.senderId !== null ? `user ${m.senderId.toString()}` : "unknown";
}
function peerOf(chat) {
  return /^-?\d+$/.test(chat) ? Number(chat) : chat;
}
function idOf(bound) {
  if (bound === void 0 || bound instanceof Date) return 0;
  const n = Number(bound);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
var TelegramMtprotoIntakeDriver = class extends BaseDriver {
  constructor(cfg, opts) {
    super("telegram-mtproto", QA_INTAKE_SPEC_VERSION, ["window", "cursor"]);
    this.opts = opts;
    const parsed = telegramMtprotoConfig.safeParse(cfg);
    if (!parsed.success) {
      const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].map((k) => `qa.intake.drivers.telegram-mtproto.${k}`);
      throw new LaunchwrightError("qa.intake.telegram.config", `Set ${keys.join(", ")} from the secrets store (QA_TELEGRAM_API_ID, QA_TELEGRAM_API_HASH, QA_TELEGRAM_SESSION).`, {
        context: { keys }
      });
    }
    this.cfg = parsed.data;
  }
  opts;
  source = "telegram";
  cfg;
  /** Connects the user client behind the allowlist. */
  async connect() {
    let gram;
    try {
      gram = readOnlyGramJs(await (this.opts.loader ?? loadGramJs)());
    } catch (cause) {
      throw new LaunchwrightError("qa.intake.telegram.peer", 'The telegram-mtproto intake driver reads the chat through GramJS. Add the npm package "telegram" (2.26 or later).', { cause });
    }
    try {
      const client = await UserClient.connect({ ...this.cfg, loader: async () => gram });
      return new ReadOnlyTelegram(client);
    } catch (cause) {
      throw new LaunchwrightError("qa.intake.telegram.connect", "The Telegram user session cannot connect. Check QA_TELEGRAM_SESSION and the API id.", { cause });
    }
  }
  async fetch(ref, window = {}) {
    const chat = ref.trim();
    if (chat === "") throw new LaunchwrightError("qa.intake.telegram.chat", "Telegram intake needs a chat id or a @username.");
    const peer = peerOf(chat);
    const tg = await this.connect();
    try {
      const sinceId = idOf(window.since) || (window.since === void 0 ? idOf(window.cursor) : 0);
      const untilId = idOf(window.until);
      const sinceDate = window.since instanceof Date ? window.since : void 0;
      const untilDate = window.until instanceof Date ? window.until : void 0;
      const items = [];
      let minId = sinceId;
      let last = idOf(window.cursor);
      for (let first = true; ; first = false) {
        let page;
        try {
          page = await tg.call("history", peer, {
            reverse: true,
            limit: PAGE,
            minId,
            ...untilId > 0 ? { maxId: untilId } : {},
            ...first && sinceDate ? { offsetDate: Math.floor(sinceDate.getTime() / 1e3) } : {}
          });
        } catch (cause) {
          if (cause instanceof LaunchwrightError) throw cause;
          throw new LaunchwrightError("qa.intake.telegram.read", `Cannot read the history of chat ${chat}. The session must be a member of the chat.`, { cause, context: { chat } });
        }
        for (const m of page) {
          minId = Math.max(minId, m.id);
          last = Math.max(last, m.id);
          if (m.action !== void 0 || m.className === "MessageService") continue;
          const at = new Date(m.date * 1e3);
          if (sinceDate && at < sinceDate) continue;
          if (untilDate && at >= untilDate) continue;
          items.push(await this.item(tg, chat, m));
        }
        if (page.length < PAGE) break;
      }
      items.sort((a, b) => Number(a.id) - Number(b.id));
      return { source: "telegram", ref: chat, items, ...last > 0 ? { cursor: String(last) } : {} };
    } finally {
      await tg.close();
    }
  }
  async item(tg, chat, m) {
    const media = m.media ? [await this.media(tg, chat, m, m.media)] : [];
    return {
      id: String(m.id),
      at: new Date(m.date * 1e3).toISOString(),
      author: authorOf(m),
      text: m.message ?? "",
      ...m.replyTo?.replyToMsgId !== void 0 ? { replyTo: String(m.replyTo.replyToMsgId) } : {},
      media: media.filter((x) => x !== null)
    };
  }
  async media(tg, chat, m, media) {
    const from = `tg:${chat}/${m.id}`;
    if (media.className === "MessageMediaWebPage") return null;
    let declared;
    let name;
    let voice = false;
    if (media.className === "MessageMediaPhoto") {
      declared = "image/jpeg";
    } else if (media.className === "MessageMediaDocument" && media.document) {
      const doc = media.document;
      declared = doc.mimeType ?? "application/octet-stream";
      name = doc.attributes?.find((a) => a.className === "DocumentAttributeFilename")?.fileName;
      voice = doc.attributes?.some((a) => a.className === "DocumentAttributeAudio" && a.voice === true) ?? false;
      const size = doc.size === void 0 ? 0 : Number(doc.size.toString());
      if (size > this.opts.maxBytes) return { from, kind: kindOf(declared, voice), mime: declared, ...name ? { name } : {}, skipped: "too-large" };
    } else {
      return { from, kind: "file", mime: "application/octet-stream", skipped: "unsupported" };
    }
    let data;
    try {
      data = await tg.call("downloadMedia", m);
    } catch (cause) {
      if (cause instanceof LaunchwrightError && cause.code === "telegram.mtproto.download") {
        return { from, kind: kindOf(declared, voice), mime: declared, ...name ? { name } : {}, skipped: "unreachable" };
      }
      throw cause;
    }
    const mime = mimeOf(declared, data, name);
    if (data.byteLength > this.opts.maxBytes) return { from, kind: kindOf(mime, voice), mime, ...name ? { name } : {}, skipped: "too-large" };
    return { from, kind: kindOf(mime, voice), mime, ...name ? { name } : {}, data };
  }
};
export {
  GRAMJS_READ_METHODS,
  READ_METHODS,
  ReadOnlyTelegram,
  TelegramMtprotoIntakeDriver,
  guardGramJsClient,
  readOnlyGramJs,
  telegramMtprotoConfig
};
//# sourceMappingURL=telegram-mtproto-5CM5WQFO.js.map