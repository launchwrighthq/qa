import {
  connectUserClient
} from "./chunk-WSA3PKHH.js";
import {
  BotApi,
  TelegramApiError
} from "./chunk-RZYPGI2F.js";
import {
  BOTFATHER,
  BOT_STORE_DIR,
  configureBot,
  destroyBot,
  fileBotStore,
  newBot
} from "./chunk-SKL7TLL4.js";
import {
  parseArgs
} from "./chunk-L6Q4YNOC.js";
import "./chunk-ZJ35OYFC.js";
import "./chunk-CNY6SOD7.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-7OHVK72J.js";
import "./chunk-GZ2IEQDP.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-telegram-bot.mts
import { join } from "path";
var USAGE = [
  "usage: lw qa telegram bot <create|destroy> [options]",
  "  create --name <name> --username <name>bot   create a throwaway bot through BotFather",
  "  destroy [--bot <id>]                         revoke and delete the bot(s), confirm each dead"
];
var DEFAULT_COMMANDS = [{ command: "start", description: "Start" }];
var REPLY_POLLS = 20;
var REPLY_WAIT_MS = 1e3;
function envUserbotProvider(env) {
  return {
    async lease() {
      const apiId = Number(env.QA_TELEGRAM_API_ID);
      const apiHash = env.QA_TELEGRAM_API_HASH ?? "";
      const session = env.QA_TELEGRAM_SESSION ?? "";
      if (!Number.isInteger(apiId) || apiId <= 0 || apiHash === "" || session === "") {
        throw new LaunchwrightError(
          "qa.bot.userbot",
          "The throwaway bot needs an authorized userbot for this run. Set QA_TELEGRAM_API_ID, QA_TELEGRAM_API_HASH and QA_TELEGRAM_SESSION."
        );
      }
      const proxy = env.QA_TELEGRAM_PROXY;
      return { apiId, apiHash, session, ...proxy ? { proxy } : {} };
    }
  };
}
async function connect(lease) {
  try {
    return await connectUserClient({ apiId: lease.apiId, apiHash: lease.apiHash, session: lease.session, ...lease.proxy ? { proxy: lease.proxy } : {} });
  } catch (cause) {
    if (isCodedError(cause) && cause.code === "telegram.mtproto.missing") {
      throw new LaunchwrightError("qa.bot.module", 'lw qa telegram bot needs GramJS. Add the npm package "telegram" (2.26 or later).', { cause });
    }
    throw cause;
  }
}
function userClientChat(client, clock) {
  let lastId = 0;
  return {
    async send(text) {
      if (lastId === 0) {
        const seen = await client.history(BOTFATHER, { limit: 5 });
        lastId = seen.reduce((max, m) => typeof m.id === "number" && m.id > max ? m.id : max, 0);
      }
      await client.sendMessage(BOTFATHER, text);
    },
    async reply() {
      for (let poll = 0; poll < REPLY_POLLS; poll += 1) {
        const history = await client.history(BOTFATHER, { limit: 5 });
        const next = history.filter((m) => !m.out && typeof m.id === "number" && m.id > lastId).sort((a, b) => a.id - b.id).at(-1);
        if (next) {
          lastId = next.id;
          return next.message ?? "";
        }
        await clock.sleep(REPLY_WAIT_MS);
      }
      throw new LaunchwrightError("qa.bot.reply", "BotFather did not reply in time.");
    }
  };
}
async function botApiGetMe(token) {
  try {
    await new BotApi({ token }).getMe();
    return { ok: true, status: 200 };
  } catch (cause) {
    if (cause instanceof TelegramApiError && cause.status !== 0) return { ok: false, status: cause.status };
    throw cause;
  }
}
async function realBotDeps(opts) {
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
        }
      };
    },
    getMe: botApiGetMe,
    store: fileBotStore(join(opts.cwd, BOT_STORE_DIR)),
    clock: systemClock
  };
}
async function create(args, opts, deps) {
  const { words, options } = parseArgs(args, [], ["name", "username"]);
  const name = typeof options.name === "string" ? options.name : void 0;
  const username = typeof options.username === "string" ? options.username : void 0;
  if (words.length > 0 || name === void 0 || username === void 0) {
    throw new LaunchwrightError("qa.bot.usage", "lw qa telegram bot create needs --name and --username.");
  }
  const { chat, close } = await deps.openChat();
  try {
    const created = await newBot(chat, { name, username });
    const record = { botId: created.botId, username: created.username, token: created.token, createdAt: deps.clock.date().toISOString() };
    await deps.store.write(record);
    await configureBot(chat, { username: created.username, commands: DEFAULT_COMMANDS, privacy: true });
    opts.out(`created throwaway bot ${created.botId} @${created.username}`);
    opts.out("token stored in .lw/qa/bots; remove it with lw qa telegram bot destroy");
    return 0;
  } finally {
    await close();
  }
}
async function pending(store, bot) {
  if (typeof bot === "string") {
    const record = await store.read(Number(bot));
    if (!record) throw new LaunchwrightError("qa.bot.missing", `No throwaway bot ${bot} in the run store.`, { context: { bot } });
    return [record];
  }
  return await store.list();
}
async function destroy(args, opts, deps) {
  const { words, options } = parseArgs(args, [], ["bot"]);
  if (words.length > 0) throw new LaunchwrightError("qa.bot.usage", "lw qa telegram bot destroy takes no positional argument.");
  const records = await pending(deps.store, options.bot);
  if (records.length === 0) {
    opts.out("no throwaway bot to destroy");
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
async function runBot(args, opts, deps) {
  const [verb, ...rest] = args;
  if (verb === void 0 || verb === "--help" || verb === "-h") {
    for (const line of USAGE) opts.err(line);
    return verb === void 0 ? 2 : 0;
  }
  const env = opts.env ?? "local";
  if (env === "production") {
    throw new LaunchwrightError("qa.bot.production", "lw qa telegram bot does not run in the production environment (spec 2.14 rule S3).");
  }
  if (verb === "create") return create(rest, opts, deps);
  if (verb === "destroy") return destroy(rest, opts, deps);
  opts.err(`lw qa telegram bot: unknown verb ${verb}`);
  for (const line of USAGE) opts.err(line);
  return 2;
}
async function runTelegramBot(args, opts) {
  return runBot(args, opts, await realBotDeps(opts));
}
export {
  envUserbotProvider,
  runBot,
  runTelegramBot
};
//# sourceMappingURL=qa-telegram-bot-NHJNTEVK.js.map