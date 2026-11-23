// The `telegram-bot` intake driver (spec 2.15.3): the updates that a QA bot receives in a chat.
// It calls only `getUpdates` and `getFile`. The Bot API downloads files up to 20 MB; a larger
// file is `skipped: too-large`. The bot has no history from before it joined. The calls go through
// `BotApi` of `@launchwrighthq/telegram/bot-api`, an optional peer that `loadBotApi` loads.
import { BaseDriver, LaunchwrightError, z } from '@launchwrighthq/kernel';
import { mimeOfExtension } from '@launchwrighthq/qa';
import { download, type FetchFn, kindOf } from '../../services/media.mts';
import type { BotApi, BotApiModule, TgMessage } from '../../services/telegram-peers.mts';
import { type IntakeBatch, type IntakeWindow, QA_INTAKE_SPEC_VERSION, type QaIntakeDriver, type RawItem, type RawMedia } from './contract.mts';

/** The largest file that the Bot API downloads. */
export const BOT_API_MAX_BYTES = 20 * 1024 * 1024;

/** The Bot API methods that the driver may call. */
export const BOT_READ_METHODS: ReadonlySet<string> = new Set(['getUpdates', 'getFile']);

/** Config `qa.intake.drivers.telegram-bot`. */
export const telegramBotConfig = z.object({
  /** The QA bot token. Privacy mode must be off, so the bot sees every message. */
  token: z.string().min(1),
  apiUrl: z.string().url().default('https://api.telegram.org'),
  /** The long poll of a `--follow` read, in seconds. */
  pollTimeoutS: z.number().int().positive().default(30),
});

// `loadBotApi` loads the Bot API client of module telegram, an optional peer. registry imports it
// from this file, which dynamic-imports the peer only when the telegram-bot driver is selected.
export { loadBotApi } from '../../services/telegram-peers.mts';

export interface TelegramBotOptions {
  /** The size cap of one file, in bytes. The driver also applies the 20 MB Bot API cap. */
  maxBytes: number;
  /** The Bot API client module: `loadBotApi()`. */
  botApi: BotApiModule;
  fetch?: FetchFn;
}

/** The update fields that the driver reads from `getUpdates`. */
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
}

interface FileRef {
  file_id: string;
  file_size?: number;
  mime_type?: string;
  file_name?: string;
}

function messageOfUpdate(u: TgUpdate): TgMessage | undefined {
  return u.message ?? u.edited_message ?? u.channel_post ?? u.edited_channel_post;
}

function authorOf(m: TgMessage): string {
  const f = m.from;
  const name = [f?.first_name, f?.last_name].filter((p) => p !== undefined && p !== '').join(' ');
  if (name !== '') return name;
  if (f?.username) return `@${f.username}`;
  const chat = (m.sender_chat as { title?: string } | undefined)?.title ?? m.chat.title;
  return typeof chat === 'string' && chat !== '' ? chat : 'unknown';
}

function inChat(m: TgMessage, chat: string): boolean {
  return String(m.chat.id) === chat || (m.chat.username !== undefined && `@${String(m.chat.username)}` === chat);
}

function inWindow(m: TgMessage, w: IntakeWindow): boolean {
  const at = m.date * 1000;
  if (w.since !== undefined && (w.since instanceof Date ? at < w.since.getTime() : m.message_id <= w.since)) return false;
  if (w.until !== undefined && (w.until instanceof Date ? at >= w.until.getTime() : m.message_id >= w.until)) return false;
  return true;
}

/** The files of a message, with their kind. A photo gives its largest size. */
function filesOf(m: TgMessage): { file: FileRef; mime: string; voice: boolean }[] {
  const out: { file: FileRef; mime: string; voice: boolean }[] = [];
  const photo = m.photo as FileRef[] | undefined;
  const largest = photo?.at(-1);
  if (largest) out.push({ file: largest, mime: 'image/jpeg', voice: false });
  for (const key of ['video', 'animation', 'video_note', 'audio', 'document'] as const) {
    const f = m[key] as FileRef | undefined;
    if (f) out.push({ file: f, mime: f.mime_type ?? (key === 'video_note' ? 'video/mp4' : (mimeOfExtension(f.file_name ?? '') ?? 'application/octet-stream')), voice: false });
  }
  const voice = m.voice as FileRef | undefined;
  if (voice) out.push({ file: voice, mime: voice.mime_type ?? 'audio/ogg', voice: true });
  return out;
}

export class TelegramBotIntakeDriver extends BaseDriver implements QaIntakeDriver {
  readonly source = 'telegram' as const;
  private readonly cfg: z.infer<typeof telegramBotConfig>;
  private readonly api: BotApi;
  private readonly fetchFn: FetchFn;

  constructor(
    cfg: Record<string, unknown>,
    private readonly opts: TelegramBotOptions,
  ) {
    super('telegram-bot', QA_INTAKE_SPEC_VERSION, ['window', 'cursor', 'follow']);
    const parsed = telegramBotConfig.safeParse(cfg);
    if (!parsed.success) {
      const keys = [...new Set(parsed.error.issues.map((i) => `qa.intake.drivers.telegram-bot.${String(i.path[0])}`))];
      throw new LaunchwrightError('qa.intake.telegram.config', `Set ${keys.join(', ')}.`, { context: { keys } });
    }
    this.cfg = parsed.data;
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
    this.api = new opts.botApi.BotApi({ token: this.cfg.token, apiUrl: this.cfg.apiUrl, fetch: this.fetchFn });
  }

  /** Calls one Bot API method. A method outside `BOT_READ_METHODS` throws `qa.intake.telegram.method`. */
  call<T>(method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    if (!BOT_READ_METHODS.has(method)) {
      throw new LaunchwrightError('qa.intake.telegram.method', `Telegram intake is read-only: the Bot API method ${method} is not on the allowlist (getUpdates, getFile).`, {
        context: { method },
      });
    }
    const timeoutMs = (this.cfg.pollTimeoutS + 10) * 1000;
    return this.api.call<T>(method, params, { timeoutMs, ...(signal ? { signal } : {}) });
  }

  async fetch(ref: string, window: IntakeWindow = {}): Promise<IntakeBatch> {
    const chat = ref.trim();
    if (chat === '') throw new LaunchwrightError('qa.intake.telegram.chat', 'Telegram intake needs a chat id or a @username.');
    if (window.follow && !window.signal) throw new LaunchwrightError('qa.intake.follow', 'A follow read needs an AbortSignal to stop it.');
    let offset = window.cursor !== undefined ? Number(window.cursor) : undefined;
    const messages = new Map<number, TgMessage>();
    for (;;) {
      if (window.signal?.aborted) break;
      let updates: TgUpdate[];
      try {
        updates = await this.call<TgUpdate[]>(
          'getUpdates',
          { ...(offset !== undefined ? { offset } : {}), timeout: window.follow ? this.cfg.pollTimeoutS : 0, allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post'] },
          window.signal,
        );
      } catch (cause) {
        if (window.signal?.aborted) break;
        throw new LaunchwrightError('qa.intake.telegram.bot', 'The QA bot cannot read its updates.', { cause });
      }
      for (const u of updates) {
        offset = Math.max(offset ?? 0, u.update_id + 1);
        const m = messageOfUpdate(u);
        if (m && inChat(m, chat) && inWindow(m, window)) messages.set(m.message_id, m);
      }
      if (updates.length === 0 && !window.follow) break;
    }
    const items: RawItem[] = [];
    for (const m of [...messages.values()].sort((a, b) => a.message_id - b.message_id)) items.push(await this.item(chat, m));
    return { source: 'telegram', ref: chat, items, ...(offset !== undefined ? { cursor: String(offset) } : {}) };
  }

  private async item(chat: string, m: TgMessage): Promise<RawItem> {
    const media: RawMedia[] = [];
    const files = filesOf(m);
    for (const [i, f] of files.entries()) media.push(await this.media(`tg:${chat}/${m.message_id}${files.length > 1 ? `#${i + 1}` : ''}`, f.file, f.mime, f.voice));
    const reply = (m.reply_to_message as TgMessage | undefined)?.message_id;
    return {
      id: String(m.message_id),
      at: new Date(m.date * 1000).toISOString(),
      author: authorOf(m),
      text: m.text ?? m.caption ?? '',
      ...(reply !== undefined ? { replyTo: String(reply) } : {}),
      media,
    };
  }

  private async media(from: string, file: FileRef, mime: string, voice: boolean): Promise<RawMedia> {
    const name = file.file_name;
    const base = { from, kind: kindOf(mime, voice), mime, ...(name ? { name } : {}) };
    const max = Math.min(this.opts.maxBytes, BOT_API_MAX_BYTES);
    if ((file.file_size ?? 0) > max) return { ...base, skipped: 'too-large' };
    let path: string | undefined;
    try {
      path = (await this.call<{ file_path?: string }>('getFile', { file_id: file.file_id })).file_path;
    } catch (cause) {
      if (!(cause instanceof this.opts.botApi.TelegramApiError)) throw cause;
      return { ...base, skipped: /too big/i.test(cause.description) ? 'too-large' : 'unreachable' };
    }
    if (path === undefined) return { ...base, skipped: 'unreachable' };
    const url = `${this.cfg.apiUrl.replace(/\/+$/, '')}/file/bot${this.cfg.token}/${path}`;
    const got = await download(url, { fetch: this.fetchFn, maxBytes: max, ...(name ? { name } : {}) });
    if ('skipped' in got) return { ...base, skipped: got.skipped };
    // The file server answers application/octet-stream; the message then knows the type better.
    const type = got.mime === 'application/octet-stream' ? mime : got.mime;
    return { ...base, kind: kindOf(type, voice), mime: type, data: got.data };
  }
}
