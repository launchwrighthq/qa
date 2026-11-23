import { join } from 'node:path';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { type BotDeps, envUserbotProvider, runBot } from '../../../src/commands/qa-telegram-bot.mts';
import { BOT_STORE_DIR, fileBotStore } from '../../../src/services/bot-store.mts';
import type { BotFatherChat } from '../../../src/services/botfather.mts';
import type { QaCommandOptions } from '../../../src/commands/qa.command.mts';
import { credentialNeed } from '../../../src/services/contract.mts';

const TOKEN = '1110000222:AA-this_is_a_fake_bot_token_000000000000';

function scriptedChat(replies: string[]): BotFatherChat & { sent: string[] } {
  const queue = [...replies];
  const sent: string[] = [];
  return {
    sent,
    async send(text) {
      sent.push(text);
    },
    async reply() {
      return queue.shift() ?? '';
    },
  };
}

interface Harness {
  deps: BotDeps;
  chats: (BotFatherChat & { sent: string[] })[];
  getMeTokens: string[];
}

/** A fake userbot: each openChat returns the next scripted chat; getMe answers the given status. */
function harness(root: string, scripts: string[][], status = 401): Harness {
  const queue = [...scripts];
  const chats: (BotFatherChat & { sent: string[] })[] = [];
  const getMeTokens: string[] = [];
  const deps: BotDeps = {
    async openChat() {
      const chat = scriptedChat(queue.shift() ?? []);
      chats.push(chat);
      return { chat, close: async () => undefined };
    },
    async getMe(token) {
      getMeTokens.push(token);
      return { ok: status === 200, status };
    },
    store: fileBotStore(join(root, BOT_STORE_DIR)),
    clock: fakeClock(),
  };
  return { deps, chats, getMeTokens };
}

function opts(root: string, out: string[], over: Partial<QaCommandOptions> = {}): QaCommandOptions {
  return { cwd: root, out: (l) => out.push(l), err: () => undefined, ...over };
}

const CREATE = ['create', '--name', 'QA Throwaway', '--username', 'qa_throwaway_000_bot'];

describe('lw qa telegram bot create', () => {
  it('stores the token and never prints it', async () => {
    const root = await tmpDir();
    const out: string[] = [];
    const h = harness(root, [['Choose a name.', 'Choose a username.', `Congratulations. ${TOKEN}`]]);
    const code = await runBot([...CREATE, '--allow-all'], opts(root, out), h.deps);
    expect(code).toBe(0);
    expect(out).toContain('run contract: allow all recorded 1 grant(s) under .lw/qa/consent');
    expect(out.join('\n')).toContain('created throwaway bot 1110000222 @qa_throwaway_000_bot');
    expect(out.join('\n')).not.toContain(TOKEN);
    expect((await h.deps.store.read(1110000222))?.token).toBe(TOKEN);
    expect(h.chats[0]?.sent).toContain('/newbot');
  });

  it('needs a name and a username', async () => {
    const root = await tmpDir();
    await expect(runBot(['create', '--name', 'QA'], opts(root, []), harness(root, [[]]).deps)).rejects.toMatchObject({ code: 'qa.bot.usage' });
  });
});

describe('lw qa telegram bot destroy', () => {
  it('revokes and deletes a leaked bot and confirms the 401', async () => {
    const root = await tmpDir();
    const out: string[] = [];
    const h = harness(root, [[]]);
    await h.deps.store.write({ botId: 1110000222, username: 'qa_throwaway_000_bot', token: TOKEN, createdAt: '2026-11-21T00:00:00.000Z' });
    const code = await runBot(['destroy', '--allow', 'outward:throwaway-bot-destroy'], opts(root, out), h.deps);
    expect(code).toBe(0);
    expect(out.join('\n')).toContain('destroyed throwaway bot 1110000222 @qa_throwaway_000_bot, getMe 401');
    expect(out.join('\n')).not.toContain(TOKEN);
    expect(h.chats[0]?.sent).toEqual(['/revoke', '@qa_throwaway_000_bot', '/deletebot', '@qa_throwaway_000_bot', 'Yes, I am totally sure.']);
    expect(h.getMeTokens).toEqual([TOKEN]);
    expect(await h.deps.store.read(1110000222)).toBeNull();
  });

  it('reports nothing to destroy for an empty store', async () => {
    const root = await tmpDir();
    const out: string[] = [];
    const code = await runBot(['destroy'], opts(root, out), harness(root, [[]]).deps);
    expect(code).toBe(0);
    expect(out.join('\n')).toContain('no throwaway bot to destroy');
  });
});

describe('lw qa telegram bot run contract (spec 2.6, R6)', () => {
  it('refuses create without a grant, lists the outward item and opens no chat', async () => {
    const root = await tmpDir();
    const out: string[] = [];
    const err: string[] = [];
    const h = harness(root, [['Choose a name.', 'Choose a username.', `Congratulations. ${TOKEN}`]]);
    expect(await runBot(CREATE, opts(root, out, { err: (l) => err.push(l) }), h.deps)).toBe(2);
    expect(out).toContain('run contract for "lw qa telegram bot create": 1 item(s) need consent');
    expect(out.some((l) => l.includes('outward:throwaway-bot-create') && l.includes('[outward]'))).toBe(true);
    expect(err.some((l) => l.includes('outward outward:throwaway-bot-create'))).toBe(true);
    expect(h.chats).toEqual([]);
    expect(await h.deps.store.list()).toEqual([]);
  });

  it('runs create with a per-item grant, and a second create asks nothing', async () => {
    const root = await tmpDir();
    const reply = ['Choose a name.', 'Choose a username.', `Congratulations. ${TOKEN}`];
    const h = harness(root, [reply, reply]);
    expect(await runBot([...CREATE, '--allow', 'outward:throwaway-bot-create'], opts(root, []), h.deps)).toBe(0);
    const out: string[] = [];
    expect(await runBot(CREATE, opts(root, out), h.deps)).toBe(0);
    expect(out).toContain('run contract: every item is granted; asking nothing');
    expect(h.chats).toHaveLength(2);
  });

  it('refuses an --allow id that the manifest does not list', async () => {
    const root = await tmpDir();
    const err: string[] = [];
    const h = harness(root, [[]]);
    expect(await runBot([...CREATE, '--allow', 'outward:throwaway-bot-destroy'], opts(root, [], { err: (l) => err.push(l) }), h.deps)).toBe(2);
    expect(err[0]).toContain('--allow outward:throwaway-bot-destroy names no item of this manifest');
    expect(h.chats).toEqual([]);
  });

  it('refuses destroy of a stored bot without a grant', async () => {
    const root = await tmpDir();
    const h = harness(root, [[]]);
    await h.deps.store.write({ botId: 1110000222, username: 'qa_throwaway_000_bot', token: TOKEN, createdAt: '2026-11-21T00:00:00.000Z' });
    expect(await runBot(['destroy'], opts(root, []), h.deps)).toBe(2);
    expect(h.chats).toEqual([]);
    expect(await h.deps.store.read(1110000222)).not.toBeNull();
  });

  it('refuses an empty userbot credential before any grant and prints no value', async () => {
    const root = await tmpDir();
    const out: string[] = [];
    const err: string[] = [];
    const session = ['sample', 'session', '01'].join('-');
    const h = harness(root, [[]]);
    h.deps.credentials = () => [credentialNeed('QA_TELEGRAM_API_ID', '1000'), credentialNeed('QA_TELEGRAM_SESSION', session), credentialNeed('QA_TELEGRAM_API_HASH', '')];
    expect(await runBot([...CREATE, '--allow-all'], opts(root, out, { err: (l) => err.push(l) }), h.deps)).toBe(2);
    expect(err).toContain('  QA_TELEGRAM_API_HASH');
    expect(out.some((l) => l.includes('QA_TELEGRAM_SESSION (set)'))).toBe(true);
    expect([...out, ...err].join('\n')).not.toContain(session);
    expect(h.chats).toEqual([]);
  });
});

describe('envUserbotProvider needs', () => {
  it('names the three userbot keys as set or empty, never with a value', () => {
    const session = ['sample', 'session', '02'].join('-');
    const needs = envUserbotProvider({ QA_TELEGRAM_API_ID: '1000', QA_TELEGRAM_SESSION: session }).needs?.() ?? [];
    expect(needs.map((n) => [n.key, n.present])).toEqual([
      ['QA_TELEGRAM_API_ID', true],
      ['QA_TELEGRAM_API_HASH', false],
      ['QA_TELEGRAM_SESSION', true],
    ]);
    expect(JSON.stringify(needs)).not.toContain(session);
  });
});

describe('runBot', () => {
  it('refuses the production environment', async () => {
    const root = await tmpDir();
    await expect(
      runBot(['create', '--name', 'QA', '--username', 'qa_000_bot'], opts(root, [], { env: 'production' }), harness(root, [[]]).deps),
    ).rejects.toMatchObject({ code: 'qa.bot.production' });
  });

  it('prints the usage for the help flag', async () => {
    const root = await tmpDir();
    const err: string[] = [];
    const code = await runBot(['--help'], opts(root, [], { err: (l) => err.push(l) }), harness(root, [[]]).deps);
    expect(code).toBe(0);
    expect(err.join('\n')).toContain('lw qa telegram bot <create|destroy>');
  });
});
