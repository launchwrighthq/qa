import {
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/bot-store.mts
import { mkdir, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
var BOT_STORE_DIR = ".lw/qa/bots";
function fileFor(dir, botId) {
  if (!Number.isInteger(botId) || botId <= 0) throw new LaunchwrightError("qa.bot.id", `A bot id is a positive integer, not "${botId}".`, { context: { botId } });
  return join(dir, `${botId}.json`);
}
function parse(dir, botId, text) {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError("qa.bot.record", `The bot record ${fileFor(dir, botId)} is not JSON.`, { cause, context: { botId } });
  }
}
function fileBotStore(dir) {
  return {
    async read(botId) {
      const text = await readTextOrNull(fileFor(dir, botId));
      return text === null ? null : parse(dir, botId, text);
    },
    async write(record) {
      const file = fileFor(dir, record.botId);
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify(record, null, 2)}
`);
    },
    async list() {
      let names;
      try {
        names = (await readdir(dir)).filter((n) => /^\d+\.json$/.test(n));
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.bot.record", `Cannot read the bot run store ${dir}.`, { cause });
      }
      const out = [];
      for (const name of names.sort()) {
        const botId = Number.parseInt(name, 10);
        const text = await readTextOrNull(join(dir, name));
        if (text !== null) out.push(parse(dir, botId, text));
      }
      return out;
    },
    async remove(botId) {
      await rm(fileFor(dir, botId), { force: true });
    }
  };
}

// src/services/botfather.mts
var BOTFATHER = "BotFather";
var DELETE_CONFIRM = "Yes, I am totally sure.";
var BOT_TOKEN = /(\d{6,12}:[A-Za-z0-9_-]{30,})/;
var WAIT = /(?:try again in|retry after)\s+(\d+)\s*(seconds?|minutes?|hours?)?/i;
var REFUSAL = /cannot create new bots|can't create new bots|too many (?:requests|attempts)|try again later|@SpamBot|^\s*sorry\b/im;
var HELP_MENU = /I can help you create and manage Telegram bots/i;
var UNIT_SECONDS = { s: 1, m: 60, h: 3600 };
function parseBotToken(reply) {
  const match = BOT_TOKEN.exec(reply);
  if (!match) {
    throw new LaunchwrightError("qa.bot.token", "BotFather returned no bot token. The /newbot flow did not finish, or the wording changed.");
  }
  return match[1];
}
function botIdOf(token) {
  const id = Number.parseInt(token.slice(0, token.indexOf(":")), 10);
  if (!Number.isInteger(id) || id <= 0) throw new LaunchwrightError("qa.bot.token", "The bot token has no numeric bot id before the colon.");
  return id;
}
function refusalOf(reply) {
  if (BOT_TOKEN.test(reply)) return null;
  const text = reply.replace(/\s+/g, " ").trim();
  const wait = WAIT.exec(reply);
  if (wait) {
    const seconds = Number(wait[1]) * (UNIT_SECONDS[(wait[2] ?? "s").charAt(0).toLowerCase()] ?? 1);
    return new LaunchwrightError("qa.bot.limit", `BotFather limits this account: wait ${seconds} seconds, then run the command again. BotFather said: "${text}"`, { context: { seconds } });
  }
  if (REFUSAL.test(reply)) return new LaunchwrightError("qa.bot.refused", `BotFather refused the step. BotFather said: "${text}"`);
  if (HELP_MENU.test(reply)) {
    return new LaunchwrightError("qa.bot.refused", `BotFather sent its help menu where a prompt was due, so it dropped the dialog. BotFather said: "${text.slice(0, 200)}"`);
  }
  return null;
}
async function exchange(chat, text) {
  await chat.send(text);
  const reply = await chat.reply();
  const refusal = refusalOf(reply);
  if (refusal) throw refusal;
  return reply;
}
function handleOf(username) {
  return username.startsWith("@") ? username : `@${username}`;
}
async function newBot(chat, opts) {
  if (!/bot$/i.test(opts.username)) {
    throw new LaunchwrightError("qa.bot.username", `A bot username must end in "bot", not "${opts.username}".`, { context: { username: opts.username } });
  }
  await exchange(chat, "/newbot");
  await exchange(chat, opts.name);
  const reply = await exchange(chat, opts.username);
  const token = parseBotToken(reply);
  return { botId: botIdOf(token), username: opts.username, token };
}
async function configureBot(chat, opts) {
  const handle = handleOf(opts.username);
  if (opts.commands && opts.commands.length > 0) {
    await exchange(chat, "/setcommands");
    await exchange(chat, handle);
    await exchange(chat, opts.commands.map((c) => `${c.command} - ${c.description}`).join("\n"));
  }
  await exchange(chat, "/setprivacy");
  await exchange(chat, handle);
  await exchange(chat, opts.privacy ?? true ? "Enable" : "Disable");
}
async function destroyBot(chat, getMe, record) {
  const handle = handleOf(record.username);
  await exchange(chat, "/revoke");
  await exchange(chat, handle);
  await exchange(chat, "/deletebot");
  await exchange(chat, handle);
  await exchange(chat, DELETE_CONFIRM);
  const me = await getMe(record.token);
  if (me.status !== 401) {
    throw new LaunchwrightError("qa.bot.alive", `The throwaway bot ${record.botId} still answers getMe with ${me.status}, so it is not deleted. Run destroy again.`, { context: { botId: record.botId, status: me.status } });
  }
  return { botId: record.botId, username: record.username, status: me.status };
}

export {
  BOT_STORE_DIR,
  fileBotStore,
  BOTFATHER,
  DELETE_CONFIRM,
  parseBotToken,
  botIdOf,
  newBot,
  configureBot,
  destroyBot
};
//# sourceMappingURL=chunk-W4O3YTED.js.map