// The fake Telegram of @launchwrighthq/qa (spec 2.3): the fake Bot API, the loopback server with
// the `/__tg` chat page for the `telegram-fake` leg, update factories, and the Bot API surface
// they use.
export { chatPageHtml } from './chat-page.mts';
export {
  FAKE_API_URL,
  FakeBotApi,
  type FakeFile,
  type FakeWebhook,
  type NetworkFailure,
  readParams,
  type RecordedCall,
  type ScriptedFailure,
} from './fake-bot-api.mts';
export { type FakeTelegram, type FakeTelegramBot, type FakeTelegramOptions, type FakeTelegramPersona, serveFakeTelegram } from './fake-server.mts';
export {
  botIdOfToken,
  type ChatType,
  type FetchFn,
  type InlineKeyboardButton,
  type KeyboardButton,
  signInitData,
  type TgCallbackQuery,
  type TgChat,
  type TgChatMemberUpdated,
  type TgManagedBotUpdated,
  type TgMessage,
  type TgMessageEntity,
  type TgPreCheckoutQuery,
  type TgSuccessfulPayment,
  type TgUpdate,
  type TgUser,
  webhookSecret,
} from './protocol.mts';
export { makeUpdate, TEST_USER } from './updates.mts';
