// Update factories for tests. Each update gets the next update id.
import type { TgChat, TgUpdate, TgUser } from './protocol.mts';

let nextId = 1;

export const TEST_USER: TgUser = { id: 4242, is_bot: false, first_name: 'Ada', username: 'ada', language_code: 'en' };

function chatOf(user: TgUser, chat?: Partial<TgChat>): TgChat {
  return { id: chat?.id ?? user.id, type: chat?.type ?? 'private', ...chat } as TgChat;
}

interface Opts {
  from?: TgUser;
  chat?: Partial<TgChat>;
  updateId?: number;
}

function id(opts: Opts): number {
  return opts.updateId ?? nextId++;
}

export const makeUpdate = {
  message(text: string, opts: Opts = {}): TgUpdate {
    const from = opts.from ?? TEST_USER;
    return { update_id: id(opts), message: { message_id: nextId + 500, date: 1_700_000_000, chat: chatOf(from, opts.chat), from, text } };
  },

  command(name: string, args = '', opts: Opts = {}): TgUpdate {
    return makeUpdate.message(args ? `/${name} ${args}` : `/${name}`, opts);
  },

  callback(data: string, opts: Opts & { messageId?: number } = {}): TgUpdate {
    const from = opts.from ?? TEST_USER;
    return {
      update_id: id(opts),
      callback_query: {
        id: `cq${nextId}`,
        from,
        data,
        chat_instance: '1',
        message: { message_id: opts.messageId ?? 77, date: 1_700_000_000, chat: chatOf(from, opts.chat), text: 'menu' },
      },
    };
  },

  preCheckout(payload: string, stars: number, opts: Opts = {}): TgUpdate {
    return { update_id: id(opts), pre_checkout_query: { id: `pcq${nextId}`, from: opts.from ?? TEST_USER, currency: 'XTR', total_amount: stars, invoice_payload: payload } };
  },

  successfulPayment(payload: string, stars: number, chargeId: string, opts: Opts & { recurring?: { first: boolean; expiresAt: number } } = {}): TgUpdate {
    const from = opts.from ?? TEST_USER;
    return {
      update_id: id(opts),
      message: {
        message_id: nextId + 500,
        date: 1_700_000_000,
        chat: chatOf(from, opts.chat),
        from,
        successful_payment: {
          currency: 'XTR',
          total_amount: stars,
          invoice_payload: payload,
          telegram_payment_charge_id: chargeId,
          ...(opts.recurring ? { is_recurring: true, is_first_recurring: opts.recurring.first, subscription_expiration_date: opts.recurring.expiresAt } : {}),
        },
      },
    };
  },

  managedBot(owner: TgUser, bot: { id: number; username: string }, opts: Opts = {}): TgUpdate {
    return { update_id: id(opts), managed_bot: { user: owner, bot: { id: bot.id, is_bot: true, username: bot.username, first_name: bot.username } } };
  },
};
