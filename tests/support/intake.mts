// Fixtures of the intake tests: recorded gh output, recorded downloads, recorded MTProto history
// and a fake Bot API with the recorded updates.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FAKE_API_URL, FakeBotApi } from '../../src/telegram-fake/index.mts';
import { recordedFetch } from './recorded-fetch.mts';
import type { FetchFn } from '../../src/intake/services/media.mts';

const fixture = (rel: string): string => fileURLToPath(new URL(`../../fixtures/${rel}`, import.meta.url));

export const GH_FILE = fixture('intake/gh/issue-media.json');
export const GRAMJS_FILE = fixture('intake/mtproto/chat-history.json');
export const BOT_FILE = fixture('intake/telegram-bot/updates.json');
export const GITHUB_HTTP = fixture('http/github/issue-media.json');

export const ISSUE_URL = 'https://github.com/acme-test/widget/issues/42';
export const GH_TOKEN = 'gho_fixture_token_for_tests';
export const CHAT = '-1001234567890';
/** A session string that must never leave the config. */
export const SESSION = '1BVtsOFixtureSessionStringThatMustStayInConfig0000000000==';

/** Every reporter text of the fixtures: none may reach a log line or a file outside `.lw/`. */
export const FIXTURE_TEXTS = [
  'The fixture body: the checkout button does nothing after a tap.',
  'The fixture comment: a long recording.',
  'The fixture reply: see',
  'Recorded chat: the checkout button does nothing on my phone.',
  'Recorded chat: here is a recording of the tap.',
  'Recorded chat: which phone model is it?',
  'Recorded chat: the profile page shows an empty avatar.',
  'Bot chat: the checkout button does nothing on my phone.',
  'Bot chat: which phone model is it?',
];

/** Every reporter name of the fixtures. */
export const FIXTURE_NAMES = ['fixture-reporter', 'fixture-dev', 'Tester One', 'tester_two', 'Developer'];

export interface SeenRequest {
  url: string;
  authorization: string | null;
}

/** The recorded GitHub downloads, and the URL and authorization header of each request. */
export function githubFetch(): { fetch: FetchFn & { remaining(): number }; seen: SeenRequest[] } {
  const rec = recordedFetch(GITHUB_HTTP);
  const seen: SeenRequest[] = [];
  const fetch = Object.assign(
    async (input: string, init?: RequestInit): Promise<Response> => {
      seen.push({ url: input, authorization: new Headers(init?.headers).get('authorization') });
      return rec(input, init);
    },
    { remaining: () => rec.remaining() },
  );
  return { fetch, seen };
}

interface BotFixture {
  token: string;
  chat: string;
  updates: Parameters<FakeBotApi['queueUpdates']>[1];
  files: Record<string, { path: string; base64: string }>;
}

export interface BotHarness {
  api: FakeBotApi;
  fetch: FetchFn;
  token: string;
  apiUrl: string;
  /** The file paths that the file server sent. */
  downloads: string[];
}

/** A FakeBotApi with the recorded updates, `getFile` answers and a file server. */
export function botHarness(): BotHarness {
  const fx = JSON.parse(readFileSync(BOT_FILE, 'utf8')) as BotFixture;
  const api = new FakeBotApi();
  const botId = Number(fx.token.split(':')[0]);
  api.queueUpdates(botId, fx.updates);
  api.on('getFile', (p: { file_id: string }) => {
    const f = fx.files[p.file_id];
    return { file_id: p.file_id, file_unique_id: p.file_id, ...(f ? { file_path: f.path, file_size: Buffer.from(f.base64, 'base64').byteLength } : {}) };
  });
  api.fail('getFile', { error_code: 400, description: 'Bad Request: invalid file_id' }, { times: 1000, match: (p) => p.file_id === 'gone-1' });
  const byPath = new Map(Object.values(fx.files).map((f) => [f.path, f.base64]));
  const downloads: string[] = [];
  const fetch: FetchFn = async (input, init) => {
    const file = /^\/file\/bot[^/]+\/(.+)$/.exec(new URL(input).pathname)?.[1];
    if (file === undefined) return api.fetch(input, init);
    downloads.push(file);
    const b64 = byPath.get(file);
    return b64 === undefined ? new Response('Not Found', { status: 404 }) : new Response(Buffer.from(b64, 'base64'), { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  };
  return { api, fetch, token: fx.token, apiUrl: FAKE_API_URL, downloads };
}
