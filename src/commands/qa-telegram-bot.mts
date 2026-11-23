// `lw qa telegram bot create|destroy` (spec 2.7): the throwaway Telegram bot lifecycle. `create`
// drives BotFather through an authorized userbot the consumer supplies, reads the token, and stores
// it in the local run store. `destroy` revokes and deletes the bot, confirmed dead by a getMe 401.
// The token lives only in `.lw/qa/bots`; no line here prints, logs or commits it.
import { join } from 'node:path';
import { type Clock, LaunchwrightError, systemClock } from '../kernel/index.mts';
import { BOT_STORE_DIR, type BotRecord, type BotStore, fileBotStore } from '../services/bot-store.mts';
import {
  BOTFATHER,
  type BotFatherChat,
  type BotGetMe,
  configureBot,
  destroyBot,
  newBot,
  type UserbotLease,
  type UserbotProvider,
} from '../services/botfather.mts';
import { BotApi, TelegramApiError } from '../telegram/bot-api.mts';
import { connectUserClient, type UserClient } from '../telegram/mtproto.mts';
import { parseArgs } from '../world/services/context.mts';
import type { QaCommandOptions } from './qa.command.mts';

const USAGE = [
  'usage: lw qa telegram bot <create|destroy> [options]',
  '  create --name <name> --username <name>bot   create a throwaway bot through BotFather',
  '  destroy [--bot <id>]                         revoke and delete the bot(s), confirm each dead',
];

/** The commands the throwaway bot registers. One entry keeps the bot usable without a menu. */
const DEFAULT_COMMANDS = [{ command: 'start', description: 'Start' }];

/** How many times the live adapter polls for a BotFather reply, and the wait between polls. */
const REPLY_POLLS = 20;
const REPLY_WAIT_MS = 1_000;

/** The injection seam. A test passes a scripted chat, a fake getMe and a temp store. */
export interface BotDeps {
  openChat(): Promise<{ chat: BotFatherChat; close(): Promise<void> }>;
  getMe: BotGetMe;
  store: BotStore;
  clock: Clock;
}

interface GramMessage {
  id: number;
  message?: string;
  out?: boolean;
}

/** Reads the userbot lease from the injected process environment. The consumer supplies the account. */
export function envUserbotProvider(env: Record<string, string | undefined>): UserbotProvider {
  return {
    async lease(): Promise<UserbotLease> {
      const apiId = Number(env.QA_TELEGRAM_API_ID);
      const apiHash = env.QA_TELEGRAM_API_HASH ?? '';
      const session = env.QA_TELEGRAM_SESSION ?? '';
      if (!Number.isInteger(apiId) || apiId <= 0 || apiHash === '' || session === '') {
        throw new LaunchwrightError(
          'qa.bot.userbot',
          'The throwaway bot needs an authorized userbot for this run. Set QA_TELEGRAM_API_ID, QA_TELEGRAM_API_HASH and QA_TELEGRAM_SESSION.',
        );
      }
      const proxy = env.QA_TELEGRAM_PROXY;
      return { apiId, apiHash, session, ...(proxy ? { proxy } : {}) };
    },
  };
}

/** Connects the user client. A missing GramJS fails `qa.bot.module`, so the fix names the package. */
async function connect(lease: UserbotLease): Promise<UserClient> {
  try {
    return await connectUserClient({ apiId: lease.apiId, apiHash: lease.apiHash, session: lease.session, ...(lease.proxy ? { proxy: lease.proxy } : {}) });
  } catch (cause) {
    if (cause instanceof LaunchwrightError && cause.code === 'telegram.mtproto.missing') {
      throw new LaunchwrightError('qa.bot.module', 'lw qa telegram bot needs GramJS. Add the npm package "telegram" (2.26 or later).', { cause });
    }
    throw cause;
  }
}

/** Adapts the MTProto user client to a BotFather chat. It polls history for the next reply. */
function userClientChat(client: UserClient, clock: Clock): BotFatherChat {
  let lastId = 0;
  return {
    async send(text) {
      if (lastId === 0) {
        const seen = (await client.history(BOTFATHER, { limit: 5 })) as GramMessage[];
        lastId = seen.reduce((max, m) => (typeof m.id === 'number' && m.id > max ? m.id : max), 0);
      }
      await client.sendMessage(BOTFATHER, text);
    },
    async reply() {
      for (let poll = 0; poll < REPLY_POLLS; poll += 1) {
        const history = (await client.history(BOTFATHER, { limit: 5 })) as GramMessage[];
        const next = history
          .filter((m) => !m.out && typeof m.id === 'number' && m.id > lastId)
          .sort((a, b) => a.id - b.id)
          .at(-1);
        if (next) {
          lastId = next.id;
          return next.message ?? '';
        }
        await clock.sleep(REPLY_WAIT_MS);
      }
      throw new LaunchwrightError('qa.bot.reply', 'BotFather did not reply in time.');
    },
  };
}

/** Calls the Bot API getMe for a token. A refused token gives its HTTP status; no line holds the token. */
async function botApiGetMe(token: string): Promise<{ ok: boolean; status: number }> {
  try {
    await new BotApi({ token }).getMe();
    return { ok: true, status: 200 };
  } catch (cause) {
    if (cause instanceof TelegramApiError && cause.status !== 0) return { ok: false, status: cause.status };
    throw cause;
  }
}

async function realBotDeps(opts: QaCommandOptions): Promise<BotDeps> {
  const env = opts.processEnv ?? process.env;
  const provider = envUserbotProvider(env);
  return {
    async openChat() {
      const lease = await provider.lease();
      const client = await connect(lease);
      return {
        chat: userClientChat(client, systemClock),
        async close() {
          try {
            await client.close();
          } finally {
            if (provider.release) await provider.release(lease);
          }
        },
      };
    },
    getMe: botApiGetMe,
    store: fileBotStore(join(opts.cwd, BOT_STORE_DIR)),
    clock: systemClock,
  };
}

async function create(args: string[], opts: QaCommandOptions, deps: BotDeps): Promise<number> {
  const { words, options } = parseArgs(args, [], ['name', 'username']);
  const name = typeof options.name === 'string' ? options.name : undefined;
  const username = typeof options.username === 'string' ? options.username : undefined;
  if (words.length > 0 || name === undefined || username === undefined) {
    throw new LaunchwrightError('qa.bot.usage', 'lw qa telegram bot create needs --name and --username.');
  }
  const { chat, close } = await deps.openChat();
  try {
    const created = await newBot(chat, { name, username });
    // Store the record before any further step, so a crash still leaves a destroyable bot.
    const record: BotRecord = { botId: created.botId, username: created.username, token: created.token, createdAt: deps.clock.date().toISOString() };
    await deps.store.write(record);
    await configureBot(chat, { username: created.username, commands: DEFAULT_COMMANDS, privacy: true });
    opts.out(`created throwaway bot ${created.botId} @${created.username}`);
    opts.out('token stored in .lw/qa/bots; remove it with lw qa telegram bot destroy');
    return 0;
  } finally {
    await close();
  }
}

async function pending(store: BotStore, bot: string | true | undefined): Promise<BotRecord[]> {
  if (typeof bot === 'string') {
    const record = await store.read(Number(bot));
    if (!record) throw new LaunchwrightError('qa.bot.missing', `No throwaway bot ${bot} in the run store.`, { context: { bot } });
    return [record];
  }
  return await store.list();
}

async function destroy(args: string[], opts: QaCommandOptions, deps: BotDeps): Promise<number> {
  const { words, options } = parseArgs(args, [], ['bot']);
  if (words.length > 0) throw new LaunchwrightError('qa.bot.usage', 'lw qa telegram bot destroy takes no positional argument.');
  const records = await pending(deps.store, options.bot);
  if (records.length === 0) {
    opts.out('no throwaway bot to destroy');
    return 0;
  }
  const { chat, close } = await deps.openChat();
  try {
    for (const record of records) {
      const dead = await destroyBot(chat, deps.getMe, record);
      await deps.store.remove(dead.botId);
      opts.out(`destroyed throwaway bot ${dead.botId} @${dead.username}, getMe ${dead.status}`);
    }
    return 0;
  } finally {
    await close();
  }
}

/** Runs the bot lifecycle with injected dependencies. The default export composes the real ones. */
export async function runBot(args: string[], opts: QaCommandOptions, deps: BotDeps): Promise<number> {
  const [verb, ...rest] = args;
  if (verb === undefined || verb === '--help' || verb === '-h') {
    for (const line of USAGE) opts.err(line);
    return verb === undefined ? 2 : 0;
  }
  const env = opts.env ?? 'local';
  if (env === 'production') {
    throw new LaunchwrightError('qa.bot.production', 'lw qa telegram bot does not run in the production environment (spec 2.14 rule S3).');
  }
  if (verb === 'create') return create(rest, opts, deps);
  if (verb === 'destroy') return destroy(rest, opts, deps);
  opts.err(`lw qa telegram bot: unknown verb ${verb}`);
  for (const line of USAGE) opts.err(line);
  return 2;
}

/** The entry `lw qa telegram bot` routes to, with the real userbot, Bot API and run store. */
export async function runTelegramBot(args: string[], opts: QaCommandOptions): Promise<number> {
  return runBot(args, opts, await realBotDeps(opts));
}
