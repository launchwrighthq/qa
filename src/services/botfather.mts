// The throwaway Telegram bot lifecycle (spec 2.7). It drives BotFather through an authorized userbot
// the consumer supplies, reads the bot token from the reply, and deletes the bot after the run. The
// library ships only the userbot-provider interface and this lifecycle, so it names no account. The
// token is a secret: it never passes through a log line or a printed message here.
import { LaunchwrightError } from '../kernel/index.mts';

/** The @username of the BotFather account the lifecycle drives. */
export const BOTFATHER = 'BotFather';

/** The exact confirmation BotFather asks for before it deletes a bot. */
export const DELETE_CONFIRM = 'Yes, I am totally sure.';

/** An authorized userbot: an MTProto user session and an optional proxy, supplied by the consumer. */
export interface UserbotLease {
  apiId: number;
  apiHash: string;
  /** A GramJS string session of a signed-in account the user authorized for this run. */
  session: string;
  /** A SOCKS5 proxy as `socks5://[user:password@]host:port`. A secret when it holds a password. */
  proxy?: string;
}

/** The consumer's source of an authorized userbot. A consumer userbot module implements it. */
export interface UserbotProvider {
  /** Leases one userbot for a run. */
  lease(): Promise<UserbotLease>;
  /** Releases the lease after the run, when the provider needs it. */
  release?(lease: UserbotLease): Promise<void>;
}

/** The BotFather chat the lifecycle drives: one send, then its reply. A test scripts the replies. */
export interface BotFatherChat {
  send(text: string): Promise<void>;
  /** The next reply from BotFather after a send. */
  reply(): Promise<string>;
}

/** Checks a bot token against the Bot API getMe. Injected so a test fakes it and makes no call. */
export type BotGetMe = (token: string) => Promise<{ ok: boolean; status: number }>;

/** One command the bot registers through BotFather. */
export interface BotCommand {
  command: string;
  description: string;
}

/** The result of `/newbot`: the bot id, the username, and the token for the run store. */
export interface NewBot {
  botId: number;
  username: string;
  token: string;
}

/** What `configureBot` sets through BotFather. */
export interface ConfigureBotOptions {
  username: string;
  /** The commands to register. An empty list skips the command step. */
  commands?: BotCommand[];
  /** Group privacy mode. True keeps the bot from reading all group messages. Default true. */
  privacy?: boolean;
}

/** A deleted bot and the getMe status that confirmed it dead (401). */
export interface DeadBot {
  botId: number;
  username: string;
  status: number;
}

const BOT_TOKEN = /(\d{6,12}:[A-Za-z0-9_-]{30,})/;
/** A BotFather wait: "try again in 8 seconds", "retry after 30", "try again in 2 minutes". */
const WAIT = /(?:try again in|retry after)\s+(\d+)\s*(seconds?|minutes?|hours?)?/i;
/** A refusal or a limit with no wait in it. A reply that opens with "Sorry" refuses the step. */
const REFUSAL = /cannot create new bots|can't create new bots|too many (?:requests|attempts)|try again later|@SpamBot|^\s*sorry\b/im;
/** The help menu arrives where a prompt was due when BotFather dropped the dialog. */
const HELP_MENU = /I can help you create and manage Telegram bots/i;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600 };

/** Reads the bot token from a BotFather reply. Throws `qa.bot.token` when no token matches. */
export function parseBotToken(reply: string): string {
  const match = BOT_TOKEN.exec(reply);
  if (!match) {
    throw new LaunchwrightError('qa.bot.token', 'BotFather returned no bot token. The /newbot flow did not finish, or the wording changed.');
  }
  return match[1] as string;
}

/** The numeric bot id before the colon of a token. Throws `qa.bot.token` for a token with none. */
export function botIdOf(token: string): number {
  const id = Number.parseInt(token.slice(0, token.indexOf(':')), 10);
  if (!Number.isInteger(id) || id <= 0) throw new LaunchwrightError('qa.bot.token', 'The bot token has no numeric bot id before the colon.');
  return id;
}

/**
 * The error of a BotFather reply that stops the dialog, or null for a reply the flow can use. A
 * reply never holds a token when it refuses, so the message quotes it.
 */
export function refusalOf(reply: string): LaunchwrightError | null {
  if (BOT_TOKEN.test(reply)) return null;
  const text = reply.replace(/\s+/g, ' ').trim();
  const wait = WAIT.exec(reply);
  if (wait) {
    const seconds = Number(wait[1]) * (UNIT_SECONDS[(wait[2] ?? 's').charAt(0).toLowerCase()] ?? 1);
    return new LaunchwrightError('qa.bot.limit', `BotFather limits this account: wait ${seconds} seconds, then run the command again. BotFather said: "${text}"`, { context: { seconds } });
  }
  if (REFUSAL.test(reply)) return new LaunchwrightError('qa.bot.refused', `BotFather refused the step. BotFather said: "${text}"`);
  if (HELP_MENU.test(reply)) {
    return new LaunchwrightError('qa.bot.refused', `BotFather sent its help menu where a prompt was due, so it dropped the dialog. BotFather said: "${text.slice(0, 200)}"`);
  }
  return null;
}

/** Sends one line and reads the reply. Throws `qa.bot.refused` or `qa.bot.limit` so no further line goes out. */
async function exchange(chat: BotFatherChat, text: string): Promise<string> {
  await chat.send(text);
  const reply = await chat.reply();
  const refusal = refusalOf(reply);
  if (refusal) throw refusal;
  return reply;
}

function handleOf(username: string): string {
  return username.startsWith('@') ? username : `@${username}`;
}

/**
 * Drives the `/newbot` dialog: the command, the display name, then the username. It reads the token
 * from the last reply. The username must end in "bot", which BotFather requires.
 */
export async function newBot(chat: BotFatherChat, opts: { name: string; username: string }): Promise<NewBot> {
  if (!/bot$/i.test(opts.username)) {
    throw new LaunchwrightError('qa.bot.username', `A bot username must end in "bot", not "${opts.username}".`, { context: { username: opts.username } });
  }
  await exchange(chat, '/newbot');
  await exchange(chat, opts.name);
  const reply = await exchange(chat, opts.username);
  const token = parseBotToken(reply);
  return { botId: botIdOf(token), username: opts.username, token };
}

/** Sets the bot commands and the group privacy through BotFather, after `/newbot`. */
export async function configureBot(chat: BotFatherChat, opts: ConfigureBotOptions): Promise<void> {
  const handle = handleOf(opts.username);
  if (opts.commands && opts.commands.length > 0) {
    await exchange(chat, '/setcommands');
    await exchange(chat, handle);
    await exchange(chat, opts.commands.map((c) => `${c.command} - ${c.description}`).join('\n'));
  }
  await exchange(chat, '/setprivacy');
  await exchange(chat, handle);
  await exchange(chat, (opts.privacy ?? true) ? 'Enable' : 'Disable');
}

/**
 * Revokes the token and deletes the bot through BotFather, then confirms it dead with a getMe that
 * returns 401. Throws `qa.bot.alive` when getMe answers with any other status, so a leak surfaces.
 */
export async function destroyBot(chat: BotFatherChat, getMe: BotGetMe, record: { botId: number; username: string; token: string }): Promise<DeadBot> {
  const handle = handleOf(record.username);
  await exchange(chat, '/revoke');
  await exchange(chat, handle);
  await exchange(chat, '/deletebot');
  await exchange(chat, handle);
  await exchange(chat, DELETE_CONFIRM);
  const me = await getMe(record.token);
  if (me.status !== 401) {
    throw new LaunchwrightError('qa.bot.alive', `The throwaway bot ${record.botId} still answers getMe with ${me.status}, so it is not deleted. Run destroy again.`, { context: { botId: record.botId, status: me.status } });
  }
  return { botId: record.botId, username: record.username, status: me.status };
}
