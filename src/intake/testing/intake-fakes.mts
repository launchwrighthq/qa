// Recorded fakes for the intake drivers: `gh` output and MTProto history. A test reads them from
// fixture files, so no test starts `gh` or reaches Telegram.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { GramJsClient, GramJsModule } from '../services/telegram-peers.mts';
import type { GhRunner } from '../services/gh.mts';

function readFixture<T>(file: string, tool: string): T {
  let raw: { format?: number; tool?: string };
  try {
    raw = JSON.parse(readFileSync(file, 'utf8')) as typeof raw;
  } catch (cause) {
    throw new LaunchwrightError('qa.testing.fixture', `Cannot read the recorded ${tool} file ${file}.`, { cause });
  }
  if (raw.format !== 1 || raw.tool !== tool) {
    throw new LaunchwrightError('qa.testing.fixture', `${file} is not a recorded ${tool} file of format 1.`, { context: { file } });
  }
  return raw as T;
}

/** One recorded `gh` call. A JSON `stdout` is printed as JSON. */
export interface RecordedGhCall {
  args: string[];
  code: number;
  stdout: string | object;
  stderr?: string;
}

/** A `gh` runner that answers from a recorded file, and the argument lists it received. */
export function recordedGh(file: string): GhRunner & { calls: string[][] } {
  const rec = readFixture<{ calls: RecordedGhCall[] }>(file, 'gh');
  const calls: string[][] = [];
  const run = async (args: string[]) => {
    calls.push([...args]);
    const hit = rec.calls.find((c) => isDeepStrictEqual(c.args, args));
    if (!hit) {
      throw new LaunchwrightError('qa.testing.gh', `No recorded gh call in ${file} matches gh ${args.join(' ')}.`, { context: { file, args } });
    }
    return { code: hit.code, stdout: typeof hit.stdout === 'string' ? hit.stdout : JSON.stringify(hit.stdout), stderr: hit.stderr ?? '' };
  };
  return Object.assign(run, { calls });
}

/** A GramJS message as the recorded file holds it. */
export interface RecordedGramMessage {
  className?: string;
  id: number;
  date: number;
  [key: string]: unknown;
}

interface GramFixture {
  chat: string;
  messages: RecordedGramMessage[];
  /** The media bytes by message id, base64. */
  files: Record<string, string>;
}

export interface RecordedGramJs {
  loader: () => Promise<GramJsModule>;
  /** Each client method that the fake received, with its peer or message id. */
  calls: string[];
}

/**
 * A GramJS module that answers `getMessages` and `downloadMedia` from a recorded file. It honours
 * `ids`, `minId`, `maxId`, `offsetDate`, `reverse` and `limit`. A peer other than the recorded
 * chat fails as GramJS fails for an unknown entity.
 */
export function recordedGramJs(file: string): RecordedGramJs {
  const rec = readFixture<GramFixture>(file, 'gramjs');
  const calls: string[] = [];
  const samePeer = (peer: unknown): boolean => String(peer) === rec.chat;
  class RecordedClient implements GramJsClient {
    session = { save: (): string => 'recorded-session' };
    async connect(): Promise<boolean> {
      calls.push('connect');
      return true;
    }
    async disconnect(): Promise<boolean> {
      calls.push('disconnect');
      return true;
    }
    async getMe(): Promise<unknown> {
      calls.push('getMe');
      return { id: 1 };
    }
    async sendMessage(peer: unknown): Promise<unknown> {
      calls.push(`sendMessage:${String(peer)}`);
      return { id: 1 };
    }
    async invoke(): Promise<unknown> {
      calls.push('invoke');
      return null;
    }
    async getMessages(peer: unknown, p: Record<string, unknown>): Promise<unknown[]> {
      calls.push(`getMessages:${String(peer)}:${JSON.stringify(p)}`);
      if (!samePeer(peer)) throw new Error(`Could not find the input entity for ${String(peer)}`);
      const all = [...rec.messages].sort((a, b) => a.id - b.id);
      if (Array.isArray(p.ids)) return (p.ids as number[]).map((id) => all.find((m) => m.id === id));
      const minId = Number(p.minId ?? 0);
      const maxId = Number(p.maxId ?? 0);
      const offsetDate = Number(p.offsetDate ?? 0);
      const limit = Number(p.limit ?? 100);
      let list = all.filter((m) => m.id > minId && (maxId === 0 || m.id < maxId) && (offsetDate === 0 || m.date >= offsetDate));
      if (p.reverse !== true) list = list.reverse();
      return list.slice(0, limit);
    }
    async downloadMedia(message: unknown): Promise<unknown> {
      const id = (message as { id: number }).id;
      calls.push(`downloadMedia:${id}`);
      const b64 = rec.files[String(id)];
      return b64 === undefined ? undefined : Buffer.from(b64, 'base64');
    }
  }
  class RecordedSession {
    constructor(readonly value: string) {}
  }
  const mod: GramJsModule = { TelegramClient: RecordedClient, StringSession: RecordedSession };
  return { loader: async () => mod, calls };
}
