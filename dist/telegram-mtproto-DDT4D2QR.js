import {
  UserClient,
  loadGramJs
} from "./chunk-WSA3PKHH.js";
import {
  kindOf,
  mimeOf
} from "./chunk-HVRFRQJC.js";
import {
  QA_INTAKE_SPEC_VERSION
} from "./chunk-K3F4HTKJ.js";
import "./chunk-DCJZUW5G.js";
import "./chunk-32IF5JNA.js";
import "./chunk-2QPEXFZW.js";
import "./chunk-W4O3YTED.js";
import "./chunk-37DKYQMH.js";
import "./chunk-C3CKDTFU.js";
import "./chunk-N6G3DBRC.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import "./chunk-6ULDPJIA.js";
import "./chunk-SECVQO4X.js";
import "./chunk-NL3NSCEL.js";
import "./chunk-3EVFW7CC.js";
import "./chunk-NRYDNIVU.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-4B5GWDFB.js";
import "./chunk-IX3NBJY2.js";
import "./chunk-P6OTXJJ2.js";
import "./chunk-D46OJBIP.js";
import "./chunk-DY4PZ7TQ.js";
import "./chunk-6HYCZCXT.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-O5NSNELG.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-RFUDK5EX.js";
import "./chunk-3TLMTKDL.js";
import "./chunk-XZN5EDSR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-H3DGWSMZ.js";
import "./chunk-SA2YN55L.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import {
  BaseDriver,
  z
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

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
          if (isCodedError(cause)) throw cause;
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
      if (isCodedError(cause) && cause.code === "telegram.mtproto.download") {
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
//# sourceMappingURL=telegram-mtproto-DDT4D2QR.js.map