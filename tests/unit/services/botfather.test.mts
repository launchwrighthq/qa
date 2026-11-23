import { describe, expect, it } from 'vitest';
import {
  type BotFatherChat,
  botIdOf,
  configureBot,
  DELETE_CONFIRM,
  destroyBot,
  newBot,
  parseBotToken,
} from '../../../src/services/botfather.mts';

const TOKEN = '1110000222:AA-this_is_a_fake_bot_token_000000000000';

/** A fake BotFather chat that records the sends and answers from a scripted reply queue. */
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

describe('parseBotToken', () => {
  it('reads the token from a BotFather reply', () => {
    expect(parseBotToken(`Done! Use this token to access the HTTP API:\n${TOKEN}\nKeep it secure.`)).toBe(TOKEN);
  });

  it('throws qa.bot.token when no token matches', () => {
    expect(() => parseBotToken('Sorry, this username is already taken.')).toThrow(expect.objectContaining({ code: 'qa.bot.token' }));
  });
});

describe('botIdOf', () => {
  it('reads the numeric bot id before the colon', () => {
    expect(botIdOf(TOKEN)).toBe(1110000222);
  });
});

describe('newBot', () => {
  it('drives the newbot dialog and reads the token', async () => {
    const chat = scriptedChat(['Choose a name.', 'Choose a username.', `Congratulations. ${TOKEN}`]);
    const created = await newBot(chat, { name: 'QA Throwaway', username: 'qa_throwaway_000_bot' });
    expect(created).toEqual({ botId: 1110000222, username: 'qa_throwaway_000_bot', token: TOKEN });
    expect(chat.sent).toEqual(['/newbot', 'QA Throwaway', 'qa_throwaway_000_bot']);
  });

  it('refuses a username that does not end in bot', async () => {
    await expect(newBot(scriptedChat([]), { name: 'QA', username: 'qa_throwaway' })).rejects.toMatchObject({ code: 'qa.bot.username' });
  });

  it('throws qa.bot.refused when BotFather refuses with no wait', async () => {
    const chat = scriptedChat(['Too many attempts, please try again later.']);
    await expect(newBot(chat, { name: 'QA', username: 'qa_000_bot' })).rejects.toMatchObject({ code: 'qa.bot.refused' });
    expect(chat.sent).toEqual(['/newbot']);
  });

  it('throws qa.bot.limit with the wait in seconds when BotFather asks to wait', async () => {
    const chat = scriptedChat(['Too many attempts. Please try again in 2 minutes.']);
    await expect(newBot(chat, { name: 'QA', username: 'qa_000_bot' })).rejects.toMatchObject({ code: 'qa.bot.limit', context: { seconds: 120 } });
    expect(chat.sent).toEqual(['/newbot']);
  });
});

describe('configureBot', () => {
  it('sets the commands and enables the group privacy', async () => {
    const chat = scriptedChat([]);
    await configureBot(chat, { username: 'qa_throwaway_000_bot', commands: [{ command: 'start', description: 'Start' }], privacy: true });
    expect(chat.sent).toEqual(['/setcommands', '@qa_throwaway_000_bot', 'start - Start', '/setprivacy', '@qa_throwaway_000_bot', 'Enable']);
  });

  it('disables the group privacy when the option is false', async () => {
    const chat = scriptedChat([]);
    await configureBot(chat, { username: '@qa_throwaway_000_bot', privacy: false });
    expect(chat.sent).toEqual(['/setprivacy', '@qa_throwaway_000_bot', 'Disable']);
  });
});

describe('destroyBot', () => {
  it('revokes, deletes and confirms the bot dead with a 401', async () => {
    const chat = scriptedChat([]);
    const seen: string[] = [];
    const getMe = async (token: string): Promise<{ ok: boolean; status: number }> => {
      seen.push(token);
      return { ok: false, status: 401 };
    };
    const dead = await destroyBot(chat, getMe, { botId: 1110000222, username: 'qa_throwaway_000_bot', token: TOKEN });
    expect(dead).toEqual({ botId: 1110000222, username: 'qa_throwaway_000_bot', status: 401 });
    expect(chat.sent).toEqual(['/revoke', '@qa_throwaway_000_bot', '/deletebot', '@qa_throwaway_000_bot', DELETE_CONFIRM]);
    expect(seen).toEqual([TOKEN]);
  });

  it('throws qa.bot.alive when getMe still answers 200', async () => {
    const getMe = async (): Promise<{ ok: boolean; status: number }> => ({ ok: true, status: 200 });
    await expect(destroyBot(scriptedChat([]), getMe, { botId: 1110000222, username: 'qa_000_bot', token: TOKEN })).rejects.toMatchObject({ code: 'qa.bot.alive' });
  });
});
