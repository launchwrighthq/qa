// The `telegram-mtproto` intake driver (spec 2.15.3): the chat history through the library's MTProto
// user client over GramJS (the optional npm peer `telegram`), with a session that the operator supplies. A method allowlist wraps the
// client: history, messages by id and media download. Any other method fails with
// `qa.intake.telegram.method`. The allowlist is an accident guard, not a sandbox (spec 3.5).
import { BaseDriver, LaunchwrightError, z } from '../../../kernel/index.mts';
import { kindOf, mimeOf } from '../../services/media.mts';
import { type GramJsClient, type GramJsModule, loadGramJs, UserClient } from '../../../telegram/mtproto.mts';
import { type IntakeBatch, type IntakeWindow, QA_INTAKE_SPEC_VERSION, type QaIntakeDriver, type RawItem, type RawMedia } from './contract.mts';

/** Config `qa.intake.drivers.telegram-mtproto`. The values come from the secrets store. */
export const telegramMtprotoConfig = z.object({
  apiId: z.coerce.number().int().positive(),
  apiHash: z.string().min(1),
  session: z.string().min(1),
  /** `socks5://[user:password@]host:port`: the exit the account always uses (`QA_TELEGRAM_PROXY`). */
  proxy: z.string().min(1).optional(),
});

/** The GramJS client methods that the guard lets through. */
export const GRAMJS_READ_METHODS: ReadonlySet<string> = new Set(['connect', 'disconnect', 'getMessages', 'downloadMedia']);
/** The `UserClient` methods that `ReadOnlyTelegram.call` lets through. */
export const READ_METHODS = ['history', 'messages', 'downloadMedia'] as const;
export type ReadMethod = (typeof READ_METHODS)[number];

/** Messages per history page. */
const PAGE = 100;

function methodError(method: string): LaunchwrightError {
  return new LaunchwrightError('qa.intake.telegram.method', `Telegram intake is read-only: the method ${method} is not on the allowlist (history, messages, download).`, {
    context: { method },
  });
}

/** Wraps a GramJS client: a method outside `GRAMJS_READ_METHODS` throws `qa.intake.telegram.method`. */
export function guardGramJsClient(raw: GramJsClient): GramJsClient {
  return new Proxy(raw, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      const name = String(prop);
      if (GRAMJS_READ_METHODS.has(name)) return (value as (...a: unknown[]) => unknown).bind(target);
      return () => {
        throw methodError(name);
      };
    },
  });
}

/** A GramJS module whose clients carry the guard of `guardGramJsClient`. */
export function readOnlyGramJs(mod: GramJsModule): GramJsModule {
  const Base = mod.TelegramClient;
  const Guarded = function (this: unknown, ...args: ConstructorParameters<typeof Base>) {
    return guardGramJsClient(new Base(...args));
  } as unknown as GramJsModule['TelegramClient'];
  return { TelegramClient: Guarded, StringSession: mod.StringSession };
}

/** The user client behind the method allowlist. */
export class ReadOnlyTelegram {
  constructor(private readonly client: UserClient) {}

  call(method: 'history', ...args: Parameters<UserClient['history']>): ReturnType<UserClient['history']>;
  call(method: 'messages', ...args: Parameters<UserClient['messages']>): ReturnType<UserClient['messages']>;
  call(method: 'downloadMedia', ...args: Parameters<UserClient['downloadMedia']>): ReturnType<UserClient['downloadMedia']>;
  call(method: string, ...args: unknown[]): Promise<unknown>;
  call(method: string, ...args: unknown[]): Promise<unknown> {
    if (!(READ_METHODS as readonly string[]).includes(method)) throw methodError(method);
    const fn = this.client[method as ReadMethod] as (...a: unknown[]) => Promise<unknown>;
    return fn.apply(this.client, args);
  }

  close(): Promise<void> {
    return this.client.close();
  }
}

export interface TelegramMtprotoOptions {
  /** The size cap of one file, in bytes. */
  maxBytes: number;
  /** Loads GramJS. Tests pass a recorded fake. */
  loader?: () => Promise<GramJsModule>;
}

/** The parts of a GramJS `Api.Message` that intake reads. */
interface GramMessage {
  className?: string;
  id: number;
  date: number;
  message?: string;
  action?: unknown;
  postAuthor?: string;
  senderId?: { toString(): string } | number | null;
  sender?: { firstName?: string; lastName?: string; username?: string; title?: string } | null;
  replyTo?: { replyToMsgId?: number } | null;
  media?: GramMedia | null;
}

interface GramMedia {
  className: string;
  photo?: unknown;
  document?: { mimeType?: string; size?: { toString(): string } | number; attributes?: { className: string; fileName?: string; voice?: boolean; roundMessage?: boolean }[] } | null;
}

function authorOf(m: GramMessage): string {
  if (m.postAuthor) return m.postAuthor;
  const s = m.sender;
  const name = [s?.firstName, s?.lastName].filter((p) => p !== undefined && p !== '').join(' ');
  if (name !== '') return name;
  if (s?.title) return s.title;
  if (s?.username) return `@${s.username}`;
  return m.senderId !== undefined && m.senderId !== null ? `user ${m.senderId.toString()}` : 'unknown';
}

function peerOf(chat: string): string | number {
  return /^-?\d+$/.test(chat) ? Number(chat) : chat;
}

/** A cursor or a window bound as a message id, or 0 for none. */
function idOf(bound: IntakeWindow['since'] | string | undefined): number {
  if (bound === undefined || bound instanceof Date) return 0;
  const n = Number(bound);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export class TelegramMtprotoIntakeDriver extends BaseDriver implements QaIntakeDriver {
  readonly source = 'telegram' as const;
  private readonly cfg: z.infer<typeof telegramMtprotoConfig>;

  constructor(
    cfg: Record<string, unknown>,
    private readonly opts: TelegramMtprotoOptions,
  ) {
    super('telegram-mtproto', QA_INTAKE_SPEC_VERSION, ['window', 'cursor']);
    const parsed = telegramMtprotoConfig.safeParse(cfg);
    if (!parsed.success) {
      const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].map((k) => `qa.intake.drivers.telegram-mtproto.${k}`);
      throw new LaunchwrightError('qa.intake.telegram.config', `Set ${keys.join(', ')} from the secrets store (QA_TELEGRAM_API_ID, QA_TELEGRAM_API_HASH, QA_TELEGRAM_SESSION).`, {
        context: { keys },
      });
    }
    this.cfg = parsed.data;
  }

  /** Connects the user client behind the allowlist. */
  async connect(): Promise<ReadOnlyTelegram> {
    let gram: GramJsModule;
    try {
      gram = readOnlyGramJs(await (this.opts.loader ?? loadGramJs)());
    } catch (cause) {
      throw new LaunchwrightError('qa.intake.telegram.peer', 'The telegram-mtproto intake driver reads the chat through GramJS. Add the npm package "telegram" (2.26 or later).', { cause });
    }
    try {
      const client = await UserClient.connect({ ...this.cfg, loader: async () => gram });
      return new ReadOnlyTelegram(client);
    } catch (cause) {
      throw new LaunchwrightError('qa.intake.telegram.connect', 'The Telegram user session cannot connect. Check QA_TELEGRAM_SESSION and the API id.', { cause });
    }
  }

  async fetch(ref: string, window: IntakeWindow = {}): Promise<IntakeBatch> {
    const chat = ref.trim();
    if (chat === '') throw new LaunchwrightError('qa.intake.telegram.chat', 'Telegram intake needs a chat id or a @username.');
    const peer = peerOf(chat);
    const tg = await this.connect();
    try {
      const sinceId = idOf(window.since) || (window.since === undefined ? idOf(window.cursor) : 0);
      const untilId = idOf(window.until);
      const sinceDate = window.since instanceof Date ? window.since : undefined;
      const untilDate = window.until instanceof Date ? window.until : undefined;
      const items: RawItem[] = [];
      let minId = sinceId;
      let last = idOf(window.cursor);
      for (let first = true; ; first = false) {
        let page: GramMessage[];
        try {
          page = (await tg.call('history', peer, {
            reverse: true,
            limit: PAGE,
            minId,
            ...(untilId > 0 ? { maxId: untilId } : {}),
            ...(first && sinceDate ? { offsetDate: Math.floor(sinceDate.getTime() / 1000) } : {}),
          })) as GramMessage[];
        } catch (cause) {
          if (cause instanceof LaunchwrightError) throw cause;
          throw new LaunchwrightError('qa.intake.telegram.read', `Cannot read the history of chat ${chat}. The session must be a member of the chat.`, { cause, context: { chat } });
        }
        for (const m of page) {
          minId = Math.max(minId, m.id);
          last = Math.max(last, m.id);
          if (m.action !== undefined || m.className === 'MessageService') continue;
          const at = new Date(m.date * 1000);
          if (sinceDate && at < sinceDate) continue;
          if (untilDate && at >= untilDate) continue;
          items.push(await this.item(tg, chat, m));
        }
        if (page.length < PAGE) break;
      }
      items.sort((a, b) => Number(a.id) - Number(b.id));
      return { source: 'telegram', ref: chat, items, ...(last > 0 ? { cursor: String(last) } : {}) };
    } finally {
      await tg.close();
    }
  }

  private async item(tg: ReadOnlyTelegram, chat: string, m: GramMessage): Promise<RawItem> {
    const media = m.media ? [await this.media(tg, chat, m, m.media)] : [];
    return {
      id: String(m.id),
      at: new Date(m.date * 1000).toISOString(),
      author: authorOf(m),
      text: m.message ?? '',
      ...(m.replyTo?.replyToMsgId !== undefined ? { replyTo: String(m.replyTo.replyToMsgId) } : {}),
      media: media.filter((x): x is RawMedia => x !== null),
    };
  }

  private async media(tg: ReadOnlyTelegram, chat: string, m: GramMessage, media: GramMedia): Promise<RawMedia | null> {
    const from = `tg:${chat}/${m.id}`;
    if (media.className === 'MessageMediaWebPage') return null;
    let declared: string;
    let name: string | undefined;
    let voice = false;
    if (media.className === 'MessageMediaPhoto') {
      declared = 'image/jpeg';
    } else if (media.className === 'MessageMediaDocument' && media.document) {
      const doc = media.document;
      declared = doc.mimeType ?? 'application/octet-stream';
      name = doc.attributes?.find((a) => a.className === 'DocumentAttributeFilename')?.fileName;
      voice = doc.attributes?.some((a) => a.className === 'DocumentAttributeAudio' && a.voice === true) ?? false;
      const size = doc.size === undefined ? 0 : Number(doc.size.toString());
      if (size > this.opts.maxBytes) return { from, kind: kindOf(declared, voice), mime: declared, ...(name ? { name } : {}), skipped: 'too-large' };
    } else {
      return { from, kind: 'file', mime: 'application/octet-stream', skipped: 'unsupported' };
    }
    let data: Uint8Array;
    try {
      data = await tg.call('downloadMedia', m);
    } catch (cause) {
      if (cause instanceof LaunchwrightError && cause.code === 'telegram.mtproto.download') {
        return { from, kind: kindOf(declared, voice), mime: declared, ...(name ? { name } : {}), skipped: 'unreachable' };
      }
      throw cause;
    }
    const mime = mimeOf(declared, data, name);
    if (data.byteLength > this.opts.maxBytes) return { from, kind: kindOf(mime, voice), mime, ...(name ? { name } : {}), skipped: 'too-large' };
    return { from, kind: kindOf(mime, voice), mime, ...(name ? { name } : {}), data };
  }
}
