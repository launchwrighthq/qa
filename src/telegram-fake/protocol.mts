// The part of the Telegram Bot API that the fake server reads and writes (spec 2.3). The types and
// the three helpers are copies of the `telegram` module (engine/services/types.mts, api.mts,
// transport.mts and miniapp/services/init-data.mts), so the library needs no framework package.
// Each type holds the fields used here; Telegram adds fields freely, so every object allows more keys.
import { createHmac } from 'node:crypto';
import { LaunchwrightError } from '../kernel/services/errors.mts';
import { hmacHex } from '../kernel/services/hmac.mts';
import { initDataCheckString } from '../kernel/services/init-data.mts';

export type { FetchFn } from '../telegram/bot-api.mts';

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  [key: string]: unknown;
}

export type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

export interface TgChat {
  id: number;
  type: ChatType;
  title?: string;
  username?: string;
  [key: string]: unknown;
}

export interface TgMessageEntity {
  type: string;
  offset: number;
  length: number;
  [key: string]: unknown;
}

export interface TgSuccessfulPayment {
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

export interface TgMessage {
  message_id: number;
  date: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  entities?: TgMessageEntity[];
  successful_payment?: TgSuccessfulPayment;
  refunded_payment?: Record<string, unknown>;
  web_app_data?: { data: string; button_text: string };
  [key: string]: unknown;
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  inline_message_id?: string;
  chat_instance?: string;
  data?: string;
  [key: string]: unknown;
}

export interface TgPreCheckoutQuery {
  id: string;
  from: TgUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
  [key: string]: unknown;
}

/** Bot API 9.6 `ManagedBotUpdated`: the account that created or now owns `bot`. */
export interface TgManagedBotUpdated {
  user: TgUser;
  bot: TgUser;
  [key: string]: unknown;
}

export interface TgChatMemberUpdated {
  chat: TgChat;
  from: TgUser;
  date: number;
  old_chat_member: { status: string; user: TgUser };
  new_chat_member: { status: string; user: TgUser };
  [key: string]: unknown;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
  callback_query?: TgCallbackQuery;
  inline_query?: Record<string, unknown> & { id: string; from: TgUser; query: string };
  pre_checkout_query?: TgPreCheckoutQuery;
  my_chat_member?: TgChatMemberUpdated;
  chat_member?: TgChatMemberUpdated;
  managed_bot?: TgManagedBotUpdated;
  [key: string]: unknown;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  pay?: boolean;
  copy_text?: { text: string };
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  web_app?: { url: string };
}

/** The bot id of a token `<bot id>:<secret>`. Throws `telegram.token.invalid`. */
export function botIdOfToken(token: string): number {
  const at = token.indexOf(':');
  const id = Number(token.slice(0, at));
  if (at <= 0 || !Number.isSafeInteger(id) || id <= 0 || token.length - at < 2) {
    throw new LaunchwrightError('telegram.token.invalid', 'A bot token has the form <bot id>:<secret>.', { context: { key: 'token' } });
  }
  return id;
}

/**
 * The `secret_token` of a bot's webhook: hex HMAC-SHA256 of the bot id, keyed with the master
 * secret. No per-bot secret is stored, and a leaked secret of one bot opens no other bot.
 */
export function webhookSecret(master: string, botId: number): string {
  if (master.length < 32) throw new LaunchwrightError('telegram.webhook.secret', 'The webhook master secret must be at least 32 characters.', { context: { key: 'webhook.secret' } });
  return createHmac('sha256', master).update(String(botId)).digest('hex');
}

/** Signs Mini App `initData` fields as Telegram does (the HMAC form). Returns the `initData` string. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', hmacHex(secret, initDataCheckString(params)));
  return params.toString();
}
