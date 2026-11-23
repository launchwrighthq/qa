import {
  FAKE_API_URL,
  FakeBotApi,
  botIdOfToken,
  chatPageHtml,
  readParams,
  serveFakeTelegram,
  signInitData,
  webhookSecret
} from "./chunk-WYFTYWQP.js";
import "./chunk-5AJ7M7K5.js";
import "./chunk-KK6DCU3O.js";

// src/telegram-fake/updates.mts
var nextId = 1;
var TEST_USER = { id: 4242, is_bot: false, first_name: "Ada", username: "ada", language_code: "en" };
function chatOf(user, chat) {
  return { id: chat?.id ?? user.id, type: chat?.type ?? "private", ...chat };
}
function id(opts) {
  return opts.updateId ?? nextId++;
}
var makeUpdate = {
  message(text, opts = {}) {
    const from = opts.from ?? TEST_USER;
    return { update_id: id(opts), message: { message_id: nextId + 500, date: 17e8, chat: chatOf(from, opts.chat), from, text } };
  },
  command(name, args = "", opts = {}) {
    return makeUpdate.message(args ? `/${name} ${args}` : `/${name}`, opts);
  },
  callback(data, opts = {}) {
    const from = opts.from ?? TEST_USER;
    return {
      update_id: id(opts),
      callback_query: {
        id: `cq${nextId}`,
        from,
        data,
        chat_instance: "1",
        message: { message_id: opts.messageId ?? 77, date: 17e8, chat: chatOf(from, opts.chat), text: "menu" }
      }
    };
  },
  preCheckout(payload, stars, opts = {}) {
    return { update_id: id(opts), pre_checkout_query: { id: `pcq${nextId}`, from: opts.from ?? TEST_USER, currency: "XTR", total_amount: stars, invoice_payload: payload } };
  },
  successfulPayment(payload, stars, chargeId, opts = {}) {
    const from = opts.from ?? TEST_USER;
    return {
      update_id: id(opts),
      message: {
        message_id: nextId + 500,
        date: 17e8,
        chat: chatOf(from, opts.chat),
        from,
        successful_payment: {
          currency: "XTR",
          total_amount: stars,
          invoice_payload: payload,
          telegram_payment_charge_id: chargeId,
          ...opts.recurring ? { is_recurring: true, is_first_recurring: opts.recurring.first, subscription_expiration_date: opts.recurring.expiresAt } : {}
        }
      }
    };
  },
  managedBot(owner, bot, opts = {}) {
    return { update_id: id(opts), managed_bot: { user: owner, bot: { id: bot.id, is_bot: true, username: bot.username, first_name: bot.username } } };
  }
};
export {
  FAKE_API_URL,
  FakeBotApi,
  TEST_USER,
  botIdOfToken,
  chatPageHtml,
  makeUpdate,
  readParams,
  serveFakeTelegram,
  signInitData,
  webhookSecret
};
//# sourceMappingURL=telegram-fake.js.map