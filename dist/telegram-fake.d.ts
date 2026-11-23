import { F as FetchFn } from './peers-D6wBRa1W.js';
import { C as Clock } from './clock-BUdCJ9bN.js';

/** The HTML of `/__tg`. */
declare function chatPageHtml(): string;

interface TgUser {
    id: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    [key: string]: unknown;
}
type ChatType = 'private' | 'group' | 'supergroup' | 'channel';
interface TgChat {
    id: number;
    type: ChatType;
    title?: string;
    username?: string;
    [key: string]: unknown;
}
interface TgMessageEntity {
    type: string;
    offset: number;
    length: number;
    [key: string]: unknown;
}
interface TgSuccessfulPayment {
    currency: string;
    total_amount: number;
    invoice_payload: string;
    telegram_payment_charge_id: string;
    provider_payment_charge_id?: string;
    subscription_expiration_date?: number;
    is_recurring?: boolean;
    is_first_recurring?: boolean;
    [key: string]: unknown;
}
interface TgMessage {
    message_id: number;
    date: number;
    chat: TgChat;
    from?: TgUser;
    text?: string;
    caption?: string;
    entities?: TgMessageEntity[];
    successful_payment?: TgSuccessfulPayment;
    refunded_payment?: Record<string, unknown>;
    web_app_data?: {
        data: string;
        button_text: string;
    };
    [key: string]: unknown;
}
interface TgCallbackQuery {
    id: string;
    from: TgUser;
    message?: TgMessage;
    inline_message_id?: string;
    chat_instance?: string;
    data?: string;
    [key: string]: unknown;
}
interface TgPreCheckoutQuery {
    id: string;
    from: TgUser;
    currency: string;
    total_amount: number;
    invoice_payload: string;
    [key: string]: unknown;
}
/** Bot API 9.6 `ManagedBotUpdated`: the account that created or now owns `bot`. */
interface TgManagedBotUpdated {
    user: TgUser;
    bot: TgUser;
    [key: string]: unknown;
}
interface TgChatMemberUpdated {
    chat: TgChat;
    from: TgUser;
    date: number;
    old_chat_member: {
        status: string;
        user: TgUser;
    };
    new_chat_member: {
        status: string;
        user: TgUser;
    };
    [key: string]: unknown;
}
interface TgUpdate {
    update_id: number;
    message?: TgMessage;
    edited_message?: TgMessage;
    channel_post?: TgMessage;
    edited_channel_post?: TgMessage;
    callback_query?: TgCallbackQuery;
    inline_query?: Record<string, unknown> & {
        id: string;
        from: TgUser;
        query: string;
    };
    pre_checkout_query?: TgPreCheckoutQuery;
    my_chat_member?: TgChatMemberUpdated;
    chat_member?: TgChatMemberUpdated;
    managed_bot?: TgManagedBotUpdated;
    [key: string]: unknown;
}
interface InlineKeyboardButton {
    text: string;
    callback_data?: string;
    url?: string;
    web_app?: {
        url: string;
    };
    switch_inline_query?: string;
    switch_inline_query_current_chat?: string;
    pay?: boolean;
    copy_text?: {
        text: string;
    };
}
interface KeyboardButton {
    text: string;
    request_contact?: boolean;
    request_location?: boolean;
    web_app?: {
        url: string;
    };
}
/** The bot id of a token `<bot id>:<secret>`. Throws `telegram.token.invalid`. */
declare function botIdOfToken(token: string): number;
/**
 * The `secret_token` of a bot's webhook: hex HMAC-SHA256 of the bot id, keyed with the master
 * secret. No per-bot secret is stored, and a leaked secret of one bot opens no other bot.
 */
declare function webhookSecret(master: string, botId: number): string;
/** Signs Mini App `initData` fields as Telegram does (the HMAC form). Returns the `initData` string. */
declare function signInitData(fields: Record<string, string>, botToken: string): string;

declare const FAKE_API_URL = "https://bot-api.test";
interface RecordedCall {
    botId: number;
    method: string;
    params: Record<string, unknown>;
    /** The fake clock time of the call, when the test gave a clock. */
    at?: number;
}
interface ScriptedFailure {
    error_code: number;
    description?: string;
    parameters?: {
        retry_after?: number;
        migrate_to_chat_id?: number;
    };
}
/**
 * A failed `fetch`. `network` has no error code (a bare `fetch failed`). `not_connected` has the
 * code of a connection that never opened (`ECONNREFUSED`). `reset` has `ECONNRESET`: the
 * connection opened, so Telegram may have taken the call.
 */
type NetworkFailure = 'network' | 'not_connected' | 'reset';
/** The parameters of one Bot API request body: JSON or multipart. A file becomes its description. */
declare function readParams(init: RequestInit | undefined): Promise<Record<string, unknown>>;
/** The webhook that a bot set with `setWebhook`. */
interface FakeWebhook {
    url: string;
    secretToken?: string;
}
/** A Bot API `File`: what `getFile` answers. */
interface FakeFile {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string;
}
declare class FakeBotApi {
    readonly apiUrl: string;
    readonly calls: RecordedCall[];
    private readonly answers;
    private readonly failures;
    private readonly updates;
    private readonly webhooks;
    private readonly profiles;
    private readonly queueListeners;
    private readonly files;
    private messageId;
    /** The time source of `RecordedCall.at`. */
    now: (() => number) | undefined;
    constructor(apiUrl?: string);
    /** Sets the result of a method: a value, or a function of the parameters. */
    on(method: string, answer: (params: Record<string, any>, call: RecordedCall) => unknown): this;
    on(method: string, answer: unknown): this;
    /** The next `times` calls of `method` (that `match`) fail with `failure`. */
    fail(method: string, failure: ScriptedFailure | NetworkFailure, opts?: {
        times?: number;
        match?: (params: Record<string, unknown>) => boolean;
    }): this;
    /** Queues updates for `getUpdates` of a bot. */
    queueUpdates(botId: number, updates: TgUpdate[]): this;
    /** True when `getUpdates` of the bot with this offset has an update to return. */
    hasUpdates(botId: number, offset?: number): boolean;
    /** Calls `listener` with the bot id after each `queueUpdates`. Returns the function that removes it. */
    onQueue(listener: (botId: number) => void): () => void;
    /** The names that `getMe` answers for a bot. */
    describeBot(botId: number, profile: {
        username: string;
        firstName: string;
    }): this;
    /** The webhook of a bot after `setWebhook`, or undefined after `deleteWebhook`. */
    webhookOf(botId: number): FakeWebhook | undefined;
    /** A file that `getFile` answers for its `file_id`. */
    registerFile(file: FakeFile): this;
    /** The next message id. The bot messages and the messages of a fake user share one sequence. */
    nextMessageId(): number;
    callsOf(method: string): Array<Record<string, unknown>>;
    reset(): void;
    private message;
    private defaultAnswer;
    /** The `fetch` to pass as `BotApiOptions.fetch`. */
    readonly fetch: FetchFn;
}

interface FakeTelegramBot {
    username: string;
    /** `<bot id>:<secret>`. The server never logs it and never puts it in the chat page. */
    token: string;
}
interface FakeTelegramPersona {
    /** The persona name of the QA world, for example `owner`. */
    id: string;
    telegramId: number;
    firstName: string;
}
interface FakeTelegramOptions {
    /** Default 0: a free port. */
    port?: number;
    /** Default `127.0.0.1`. Only a loopback host is allowed. */
    host?: string;
    bots: FakeTelegramBot[];
    personas: FakeTelegramPersona[];
    /**
     * The app's webhook. `{botId}` in `url` becomes the bot id. `secret` is the master secret of
     * `telegram.webhook.secret`: each bot gets the header that the engine derives from it. A bot that
     * calls `setWebhook` gets its own URL and `secret_token` instead. Without a webhook, the server
     * keeps the updates for `getUpdates`.
     */
    webhook?: {
        url: string;
        secret: string;
    } | undefined;
    /** The kernel environment. The server refuses to start in `production`. */
    env: string;
    /** The clock of `auth_date`, message dates and the long poll. Default the system clock. */
    clock?: Clock;
}
interface FakeTelegram {
    /** The origin of the server, for example `http://127.0.0.1:43123`. Set `telegram.apiUrl` to it. */
    url: string;
    /** The shared state: every Bot API call, scripted answers and failures. */
    api: FakeBotApi;
    close(): Promise<void>;
}
/**
 * Starts the fake Telegram server on loopback (QA spec 2.10). Throws `telegram.fake.production` in
 * the production environment and `telegram.fake.host` for a host that is not loopback.
 */
declare function serveFakeTelegram(opts: FakeTelegramOptions): Promise<FakeTelegram>;

declare const TEST_USER: TgUser;
interface Opts {
    from?: TgUser;
    chat?: Partial<TgChat>;
    updateId?: number;
}
declare const makeUpdate: {
    message(text: string, opts?: Opts): TgUpdate;
    command(name: string, args?: string, opts?: Opts): TgUpdate;
    callback(data: string, opts?: Opts & {
        messageId?: number;
    }): TgUpdate;
    preCheckout(payload: string, stars: number, opts?: Opts): TgUpdate;
    successfulPayment(payload: string, stars: number, chargeId: string, opts?: Opts & {
        recurring?: {
            first: boolean;
            expiresAt: number;
        };
    }): TgUpdate;
    managedBot(owner: TgUser, bot: {
        id: number;
        username: string;
    }, opts?: Opts): TgUpdate;
};

export { type ChatType, FAKE_API_URL, FakeBotApi, type FakeFile, type FakeTelegram, type FakeTelegramBot, type FakeTelegramOptions, type FakeTelegramPersona, type FakeWebhook, FetchFn, type InlineKeyboardButton, type KeyboardButton, type NetworkFailure, type RecordedCall, type ScriptedFailure, TEST_USER, type TgCallbackQuery, type TgChat, type TgChatMemberUpdated, type TgManagedBotUpdated, type TgMessage, type TgMessageEntity, type TgPreCheckoutQuery, type TgSuccessfulPayment, type TgUpdate, type TgUser, botIdOfToken, chatPageHtml, makeUpdate, readParams, serveFakeTelegram, signInitData, webhookSecret };
