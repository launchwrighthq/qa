// The minimal Telegram surface that the intake drivers touch, kept local so the library has no hard
// dependency on @launchwrighthq/telegram (spec 2.15.3). module telegram is an optional peer: the
// telegram-bot driver reads the Bot API (BotApi, TgMessage, TelegramApiError of the bot-api export),
// and the telegram-mtproto driver reads the chat through the MTProto user client (GramJsClient,
// GramJsModule, UserClient of the mtproto export). loadTelegramPeer imports a peer lazily with a
// variable specifier, so a bundle that drops a driver drops its peer too. The source of truth for
// each field is @launchwrighthq/telegram.
import { LaunchwrightError, optionalPeer } from '../../kernel/index.mts';
import type { FetchFn } from './media.mts';

/** Loads optional peer `spec`. Fails with `qa.intake.telegram.peer` when module telegram is not installed. */
async function loadTelegramPeer<T>(spec: string, message: string): Promise<T> {
  const mod = await optionalPeer<T>(spec, () => import(spec) as Promise<T>);
  if (mod === undefined) throw new LaunchwrightError('qa.intake.telegram.peer', message);
  return mod;
}

// bot-api surface (@launchwrighthq/telegram/bot-api).

/** The `TgMessage` fields that the telegram-bot driver reads. Telegram adds fields freely, so it allows more keys. */
export interface TgMessage {
  message_id: number;
  date: number;
  chat: { id: number; title?: string; username?: string };
  from?: { first_name?: string; last_name?: string; username?: string };
  text?: string;
  caption?: string;
  [key: string]: unknown;
}

/** The `BotApi` instance method that the telegram-bot driver calls. */
export interface BotApi {
  call<T>(method: string, params: Record<string, unknown>, opts?: { timeoutMs?: number; signal?: AbortSignal }): Promise<T>;
}

/** The `TelegramApiError` field that the telegram-bot driver reads after an `instanceof`. */
export interface TelegramApiError extends Error {
  description: string;
}

/** The parts of `@launchwrighthq/telegram/bot-api` that the telegram-bot driver uses. */
export interface BotApiModule {
  BotApi: new (options: { token: string; apiUrl?: string; fetch?: FetchFn }) => BotApi;
  TelegramApiError: new (...args: never[]) => TelegramApiError;
}

/** The Bot API client of module telegram, an optional peer. */
export const loadBotApi = (): Promise<BotApiModule> =>
  loadTelegramPeer<BotApiModule>(
    '@launchwrighthq/telegram/bot-api',
    'The telegram-bot intake driver calls the Bot API through module telegram. Install @launchwrighthq/telegram.',
  );

// mtproto surface (@launchwrighthq/telegram/mtproto).

/** The part of a GramJS client that the telegram-mtproto driver uses. Matches GramJsClient of module telegram. */
export interface GramJsClient {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  getMe(): Promise<unknown>;
  sendMessage(peer: unknown, params: { message: string }): Promise<unknown>;
  getMessages(peer: unknown, params: Record<string, unknown>): Promise<unknown[]>;
  downloadMedia(message: unknown, params?: Record<string, unknown>): Promise<unknown>;
  invoke(request: unknown): Promise<unknown>;
  session: { save(): unknown };
}

/** The part of the GramJS package that the telegram-mtproto driver uses. */
export interface GramJsModule {
  TelegramClient: new (session: unknown, apiId: number, apiHash: string, opts: Record<string, unknown>) => GramJsClient;
  StringSession: new (session: string) => unknown;
}

/** The GramJS `getMessages` window that `UserClient.history` passes on. */
export interface HistoryOptions {
  limit?: number;
  minId?: number;
  maxId?: number;
  offsetDate?: number;
  reverse?: boolean;
}

/** The connect options of `UserClient.connect`: the driver config plus a GramJS loader. */
export interface UserClientConnectOptions {
  apiId: number;
  apiHash: string;
  session: string;
  proxy?: string;
  connectionRetries?: number;
  loader?: () => Promise<GramJsModule>;
}

/** The `UserClient` instance methods that the telegram-mtproto driver calls behind the allowlist. */
export interface UserClient {
  history(peer: string | number, opts?: HistoryOptions): Promise<unknown[]>;
  messages(peer: string | number, ids: number[]): Promise<unknown[]>;
  downloadMedia(message: unknown): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** The parts of `@launchwrighthq/telegram/mtproto` that the telegram-mtproto driver uses. */
export interface MtprotoModule {
  UserClient: { connect(opts: UserClientConnectOptions): Promise<UserClient> };
  loadGramJs: () => Promise<GramJsModule>;
}

/** The MTProto user client of module telegram, an optional peer. */
export const loadMtproto = (): Promise<MtprotoModule> =>
  loadTelegramPeer<MtprotoModule>(
    '@launchwrighthq/telegram/mtproto',
    'The telegram-mtproto intake driver reads the chat through module telegram. Install @launchwrighthq/telegram.',
  );
