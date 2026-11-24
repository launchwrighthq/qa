import {
  BotApi,
  TelegramApiError
} from "./chunk-RZYPGI2F.js";
import {
  download,
  kindOf
} from "./chunk-HVRFRQJC.js";
import {
  QA_INTAKE_SPEC_VERSION
} from "./chunk-K3F4HTKJ.js";
import "./chunk-DP3BJCQL.js";
import "./chunk-PYBSJLYL.js";
import "./chunk-Y3DM4XPJ.js";
import "./chunk-W4O3YTED.js";
import "./chunk-53M6IOKX.js";
import "./chunk-7YME3OFL.js";
import "./chunk-N6G3DBRC.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import "./chunk-7U5DCOOY.js";
import "./chunk-I3IUHHIW.js";
import "./chunk-4M4L73SK.js";
import "./chunk-4HWKGNXL.js";
import "./chunk-JPCS27IP.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-RGX37KPN.js";
import "./chunk-W6MGERRV.js";
import "./chunk-ZRBKWAMJ.js";
import "./chunk-OSGSGOS2.js";
import "./chunk-B3YQ27NA.js";
import "./chunk-42WWWMVO.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-KCJ7A64B.js";
import {
  mimeOfExtension
} from "./chunk-B7UB2WOJ.js";
import "./chunk-RFUDK5EX.js";
import "./chunk-APRIQSSG.js";
import "./chunk-OF544TQR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-TQCRYULZ.js";
import "./chunk-SA2YN55L.js";
import {
  BaseDriver,
  z
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/intake/drivers/intake/telegram-bot.mts
var BOT_API_MAX_BYTES = 20 * 1024 * 1024;
var BOT_READ_METHODS = /* @__PURE__ */ new Set(["getUpdates", "getFile"]);
var telegramBotConfig = z.object({
  /** The QA bot token. Privacy mode must be off, so the bot sees every message. */
  token: z.string().min(1),
  apiUrl: z.string().url().default("https://api.telegram.org"),
  /** The long poll of a `--follow` read, in seconds. */
  pollTimeoutS: z.number().int().positive().default(30)
});
function messageOfUpdate(u) {
  return u.message ?? u.edited_message ?? u.channel_post ?? u.edited_channel_post;
}
function authorOf(m) {
  const f = m.from;
  const name = [f?.first_name, f?.last_name].filter((p) => p !== void 0 && p !== "").join(" ");
  if (name !== "") return name;
  if (f?.username) return `@${f.username}`;
  const chat = m.sender_chat?.title ?? m.chat.title;
  return typeof chat === "string" && chat !== "" ? chat : "unknown";
}
function inChat(m, chat) {
  return String(m.chat.id) === chat || m.chat.username !== void 0 && `@${String(m.chat.username)}` === chat;
}
function inWindow(m, w) {
  const at = m.date * 1e3;
  if (w.since !== void 0 && (w.since instanceof Date ? at < w.since.getTime() : m.message_id <= w.since)) return false;
  if (w.until !== void 0 && (w.until instanceof Date ? at >= w.until.getTime() : m.message_id >= w.until)) return false;
  return true;
}
function filesOf(m) {
  const out = [];
  const photo = m.photo;
  const largest = photo?.at(-1);
  if (largest) out.push({ file: largest, mime: "image/jpeg", voice: false });
  for (const key of ["video", "animation", "video_note", "audio", "document"]) {
    const f = m[key];
    if (f) out.push({ file: f, mime: f.mime_type ?? (key === "video_note" ? "video/mp4" : mimeOfExtension(f.file_name ?? "") ?? "application/octet-stream"), voice: false });
  }
  const voice = m.voice;
  if (voice) out.push({ file: voice, mime: voice.mime_type ?? "audio/ogg", voice: true });
  return out;
}
var TelegramBotIntakeDriver = class extends BaseDriver {
  constructor(cfg, opts) {
    super("telegram-bot", QA_INTAKE_SPEC_VERSION, ["window", "cursor", "follow"]);
    this.opts = opts;
    const parsed = telegramBotConfig.safeParse(cfg);
    if (!parsed.success) {
      const keys = [...new Set(parsed.error.issues.map((i) => `qa.intake.drivers.telegram-bot.${String(i.path[0])}`))];
      throw new LaunchwrightError("qa.intake.telegram.config", `Set ${keys.join(", ")}.`, { context: { keys } });
    }
    this.cfg = parsed.data;
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
    this.api = new BotApi({ token: this.cfg.token, apiUrl: this.cfg.apiUrl, fetch: this.fetchFn });
  }
  opts;
  source = "telegram";
  cfg;
  api;
  fetchFn;
  /** Calls one Bot API method. A method outside `BOT_READ_METHODS` throws `qa.intake.telegram.method`. */
  call(method, params, signal) {
    if (!BOT_READ_METHODS.has(method)) {
      throw new LaunchwrightError("qa.intake.telegram.method", `Telegram intake is read-only: the Bot API method ${method} is not on the allowlist (getUpdates, getFile).`, {
        context: { method }
      });
    }
    const timeoutMs = (this.cfg.pollTimeoutS + 10) * 1e3;
    return this.api.call(method, params, { timeoutMs, ...signal ? { signal } : {} });
  }
  async fetch(ref, window = {}) {
    const chat = ref.trim();
    if (chat === "") throw new LaunchwrightError("qa.intake.telegram.chat", "Telegram intake needs a chat id or a @username.");
    if (window.follow && !window.signal) throw new LaunchwrightError("qa.intake.follow", "A follow read needs an AbortSignal to stop it.");
    let offset = window.cursor !== void 0 ? Number(window.cursor) : void 0;
    const messages = /* @__PURE__ */ new Map();
    for (; ; ) {
      if (window.signal?.aborted) break;
      let updates;
      try {
        updates = await this.call(
          "getUpdates",
          { ...offset !== void 0 ? { offset } : {}, timeout: window.follow ? this.cfg.pollTimeoutS : 0, allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"] },
          window.signal
        );
      } catch (cause) {
        if (window.signal?.aborted) break;
        throw new LaunchwrightError("qa.intake.telegram.bot", "The QA bot cannot read its updates.", { cause });
      }
      for (const u of updates) {
        offset = Math.max(offset ?? 0, u.update_id + 1);
        const m = messageOfUpdate(u);
        if (m && inChat(m, chat) && inWindow(m, window)) messages.set(m.message_id, m);
      }
      if (updates.length === 0 && !window.follow) break;
    }
    const items = [];
    for (const m of [...messages.values()].sort((a, b) => a.message_id - b.message_id)) items.push(await this.item(chat, m));
    return { source: "telegram", ref: chat, items, ...offset !== void 0 ? { cursor: String(offset) } : {} };
  }
  async item(chat, m) {
    const media = [];
    const files = filesOf(m);
    for (const [i, f] of files.entries()) media.push(await this.media(`tg:${chat}/${m.message_id}${files.length > 1 ? `#${i + 1}` : ""}`, f.file, f.mime, f.voice));
    const reply = m.reply_to_message?.message_id;
    return {
      id: String(m.message_id),
      at: new Date(m.date * 1e3).toISOString(),
      author: authorOf(m),
      text: m.text ?? m.caption ?? "",
      ...reply !== void 0 ? { replyTo: String(reply) } : {},
      media
    };
  }
  async media(from, file, mime, voice) {
    const name = file.file_name;
    const base = { from, kind: kindOf(mime, voice), mime, ...name ? { name } : {} };
    const max = Math.min(this.opts.maxBytes, BOT_API_MAX_BYTES);
    if ((file.file_size ?? 0) > max) return { ...base, skipped: "too-large" };
    let path;
    try {
      path = (await this.call("getFile", { file_id: file.file_id })).file_path;
    } catch (cause) {
      if (!(cause instanceof TelegramApiError)) throw cause;
      return { ...base, skipped: /too big/i.test(cause.description) ? "too-large" : "unreachable" };
    }
    if (path === void 0) return { ...base, skipped: "unreachable" };
    const url = `${this.cfg.apiUrl.replace(/\/+$/, "")}/file/bot${this.cfg.token}/${path}`;
    const got = await download(url, { fetch: this.fetchFn, maxBytes: max, ...name ? { name } : {} });
    if ("skipped" in got) return { ...base, skipped: got.skipped };
    const type = got.mime === "application/octet-stream" ? mime : got.mime;
    return { ...base, kind: kindOf(type, voice), mime: type, data: got.data };
  }
};
export {
  BOT_API_MAX_BYTES,
  BOT_READ_METHODS,
  TelegramBotIntakeDriver,
  telegramBotConfig
};
//# sourceMappingURL=telegram-bot-VHX3MFV6.js.map