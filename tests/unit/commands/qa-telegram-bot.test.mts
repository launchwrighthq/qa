import { join } from 'node:path';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { type BotDeps, runBot } from '../../../src/commands/qa-telegram-bot.mts';
import { BOT_STORE_DIR, fileBotStore } from '../../../src/services/bot-store.mts';
import type { BotFatherChat } from '../../../src/services/botfather.mts';
import type { QaCommandOptions } from '../../../src/commands/qa.command.mts';

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

describe('lw qa telegram bot create', () => {
  it('stores the token and never prints it', async () => {
    const root = await tmpDir();
    const out: string[] = [];
    const h = harness(root, [['Choose a name.', 'Choose a username.', `Congratulations. ${TOKEN}`]]);
    const code = await runBot(['create', '--name', 'QA Throwaway', '--username', 'qa_throwaway_000_bot'], opts(root, out), h.deps);
    expect(code).toBe(0);
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
    const code = await runBot(['destroy'], opts(root, out), h.deps);
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
