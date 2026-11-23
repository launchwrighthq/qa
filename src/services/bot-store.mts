// The throwaway bot run store (spec 2.7): one JSON record per bot under `.lw/qa/bots`. The record
// holds the bot token so a run that dies leaves enough for the next destroy to clean up. The token
// is a secret: `.lw/` is out of git, and no reader prints the record. The folder stays local.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchwrightError } from '../kernel/index.mts';
import { readTextOrNull } from '../kernel/services/fs.mts';

/** The run store folder, relative to the project root. */
export const BOT_STORE_DIR = '.lw/qa/bots';

/** One throwaway bot record. `token` is a secret and never leaves this store. */
export interface BotRecord {
  botId: number;
  username: string;
  token: string;
  createdAt: string;
}

/** The run store, injected so a test uses a temp folder. */
export interface BotStore {
  read(botId: number): Promise<BotRecord | null>;
  write(record: BotRecord): Promise<void>;
  list(): Promise<BotRecord[]>;
  remove(botId: number): Promise<void>;
}

function fileFor(dir: string, botId: number): string {
  if (!Number.isInteger(botId) || botId <= 0) throw new LaunchwrightError('qa.bot.id', `A bot id is a positive integer, not "${botId}".`, { context: { botId } });
  return join(dir, `${botId}.json`);
}

function parse(dir: string, botId: number, text: string): BotRecord {
  try {
    return JSON.parse(text) as BotRecord;
  } catch (cause) {
    throw new LaunchwrightError('qa.bot.record', `The bot record ${fileFor(dir, botId)} is not JSON.`, { cause, context: { botId } });
  }
}

/** A run store that writes `<dir>/<botId>.json`. The record holds the token; nothing here logs it. */
export function fileBotStore(dir: string): BotStore {
  return {
    async read(botId) {
      const text = await readTextOrNull(fileFor(dir, botId));
      return text === null ? null : parse(dir, botId, text);
    },
    async write(record) {
      const file = fileFor(dir, record.botId);
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
    },
    async list() {
      let names: string[];
      try {
        names = (await readdir(dir)).filter((n) => /^\d+\.json$/.test(n));
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new LaunchwrightError('qa.bot.record', `Cannot read the bot run store ${dir}.`, { cause });
      }
      const out: BotRecord[] = [];
      for (const name of names.sort()) {
        const botId = Number.parseInt(name, 10);
        const text = await readTextOrNull(join(dir, name));
        if (text !== null) out.push(parse(dir, botId, text));
      }
      return out;
    },
    async remove(botId) {
      await rm(fileFor(dir, botId), { force: true });
    },
  };
}
