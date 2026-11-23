// The telegram-bot driver: getUpdates and getFile only, the 20 MB cap and follow mode (R26, A3).
import { describe, expect, it } from 'vitest';
import { BOT_API_MAX_BYTES, TelegramBotIntakeDriver } from '../../../../../src/intake/drivers/intake/telegram-bot.mts';
import { botHarness, CHAT } from '../../../../support/intake.mts';

const MAX = 200 * 1024 * 1024;

function driver(maxBytes = MAX) {
  const h = botHarness();
  return { d: new TelegramBotIntakeDriver({ token: h.token, apiUrl: h.apiUrl, pollTimeoutS: 5 }, { maxBytes, fetch: h.fetch }), h };
}

describe('telegram-bot intake driver', () => {
  it('records the updates of the chat with their files', async () => {
    const { d, h } = driver();
    const b = await d.fetch(CHAT);
    expect(b.items.map((i) => [i.id, i.author, i.replyTo ?? '', i.media.map((m) => m.skipped ?? `${m.kind}:${m.mime}`).join(',')])).toEqual([
      ['301', 'Tester One', '', 'image:image/png'],
      ['302', 'Tester One', '', 'video:video/mp4'],
      ['303', 'Developer', '301', ''],
      ['304', 'Tester One', '303', 'voice:audio/ogg'],
      ['305', '@tester_two', '', 'too-large'],
      ['306', '@tester_two', '', 'unreachable'],
    ]);
    expect(b.cursor).toBe('7008');
    expect(h.downloads).toEqual(['photos/file_1.jpg', 'videos/file_2.mp4', 'voice/file_3.oga']);
    for (const m of b.items.flatMap((i) => i.media)) expect(m.from).not.toContain(h.token);
  });

  it('marks a file over 20 MB too-large without getFile, also under a larger maxFileMb', async () => {
    const { d, h } = driver(1024 * 1024 * 1024);
    const b = await d.fetch(CHAT);
    expect(b.items.find((i) => i.id === '305')?.media[0]).toMatchObject({ skipped: 'too-large', name: 'screen-recording.mov', kind: 'video' });
    expect(h.api.callsOf('getFile').map((p) => p.file_id)).not.toContain('big-1');
    expect(BOT_API_MAX_BYTES).toBe(20 * 1024 * 1024);
  });

  it('applies a maxFileMb under 20 MB', async () => {
    const { d } = driver(40);
    const b = await d.fetch(CHAT);
    expect(b.items.find((i) => i.id === '301')?.media[0]).toMatchObject({ skipped: 'too-large' });
    expect(b.items.find((i) => i.id === '304')?.media[0]).toMatchObject({ kind: 'voice', mime: 'audio/ogg' });
  });

  it('calls only getUpdates and getFile', async () => {
    const { d, h } = driver();
    await d.fetch(CHAT);
    expect(new Set(h.api.calls.map((c) => c.method))).toEqual(new Set(['getUpdates', 'getFile']));
    for (const method of ['sendMessage', 'deleteMessage', 'setMessageReaction', 'getMe']) {
      expect(() => d.call(method, {})).toThrow(expect.objectContaining({ code: 'qa.intake.telegram.method' }));
    }
  });

  it('follows the chat until the signal aborts, then returns what arrived', async () => {
    const { d, h } = driver();
    const ctl = new AbortController();
    let polls = 0;
    h.api.on('getUpdates', (p: { offset?: number }) => {
      polls += 1;
      if (polls === 1) return [{ update_id: 9001, message: { message_id: 401, date: 1793700000, chat: { id: Number(CHAT), type: 'supergroup' }, from: { id: 1, is_bot: false, first_name: 'Late' }, text: 'Bot chat: a later report.' } }];
      expect(p.offset).toBe(9002);
      ctl.abort();
      return [];
    });
    const b = await d.fetch(CHAT, { follow: true, signal: ctl.signal });
    expect(b.items.map((i) => i.id)).toEqual(['401']);
    expect(b.cursor).toBe('9002');
    expect(h.api.callsOf('getUpdates').every((p) => p.timeout === 5)).toBe(true);
  });

  it('refuses follow without a signal and a config without a token', async () => {
    const { d } = driver();
    await expect(d.fetch(CHAT, { follow: true })).rejects.toMatchObject({ code: 'qa.intake.follow' });
    expect(() => new TelegramBotIntakeDriver({}, { maxBytes: MAX })).toThrow(expect.objectContaining({ code: 'qa.intake.telegram.config', message: expect.stringContaining('qa.intake.drivers.telegram-bot.token') }));
  });
});
