// The telegram-mtproto driver: the read-only allowlist, the window and the config errors (R25, A3).
import { type GramJsModule, UserClient } from '../../../../../src/telegram/mtproto.mts';
import { describe, expect, it } from 'vitest';
import { ReadOnlyTelegram, readOnlyGramJs, TelegramMtprotoIntakeDriver } from '../../../../../src/intake/drivers/intake/telegram-mtproto.mts';
import { recordedGramJs } from '../../../../../src/intake/testing/index.mts';
import { CHAT, GRAMJS_FILE, SESSION } from '../../../../support/intake.mts';

const CFG = { apiId: '12345', apiHash: 'fixture-api-hash', session: SESSION };
const MAX = 200 * 1024 * 1024;

function driver() {
  const rec = recordedGramJs(GRAMJS_FILE);
  return { d: new TelegramMtprotoIntakeDriver(CFG, { maxBytes: MAX, loader: rec.loader }), rec };
}

describe('telegram-mtproto intake driver', () => {
  it('reads the history oldest first with authors, replies and media kinds', async () => {
    const { d, rec } = driver();
    const b = await d.fetch(CHAT);
    expect(b.items.map((i) => [i.id, i.author, i.replyTo ?? '', i.media.map((m) => m.skipped ?? m.kind).join(',')])).toEqual([
      ['201', 'Tester One', '', 'image'],
      ['202', 'Tester One', '', 'video'],
      ['204', 'Developer', '201', ''],
      ['205', 'Tester One', '204', 'voice'],
      ['206', '@tester_two', '', 'too-large'],
      ['207', '@tester_two', '', ''],
      ['208', '@tester_two', '', 'unsupported'],
    ]);
    expect(b.items[0]?.media[0]).toMatchObject({ from: `tg:${CHAT}/201`, mime: 'image/jpeg' });
    expect(b.items[1]?.media[0]).toMatchObject({ mime: 'video/mp4', name: 'tap.mp4' });
    expect(b.items[3]?.media[0]).toMatchObject({ kind: 'voice', mime: 'audio/ogg' });
    expect(b.cursor).toBe('208');
    expect(rec.calls.filter((c) => c.startsWith('downloadMedia'))).toEqual(['downloadMedia:201', 'downloadMedia:202', 'downloadMedia:205']);
  });

  it('calls only connect, history, download and disconnect on the client', async () => {
    const { d, rec } = driver();
    await d.fetch(CHAT);
    await d.fetch(CHAT, { since: 204, until: 207 });
    for (const call of rec.calls) expect(call).toMatch(/^(connect|disconnect|getMessages:|downloadMedia:)/);
    expect(rec.calls).toContain(`getMessages:${CHAT}:{"reverse":true,"limit":100,"minId":204,"maxId":207}`);
  });

  it('reads from the cursor, and a since bound wins over it', async () => {
    const { d } = driver();
    expect((await d.fetch(CHAT, { cursor: '205' })).items.map((i) => i.id)).toEqual(['206', '207', '208']);
    expect((await d.fetch(CHAT, { cursor: '205', since: 204 })).items.map((i) => i.id)).toEqual(['205', '206', '207', '208']);
    expect((await d.fetch(CHAT, { since: new Date('2026-11-02T00:00:00Z') })).items.map((i) => i.id)).toEqual(['206', '207', '208']);
    expect((await d.fetch(CHAT, { until: new Date('2026-11-01T10:30:00Z') })).items.map((i) => i.id)).toEqual(['201', '202']);
  });

  it('fails a send method of the GramJS client with qa.intake.telegram.method', async () => {
    const rec = recordedGramJs(GRAMJS_FILE);
    const client = await UserClient.connect({ apiId: 1, apiHash: 'h', session: SESSION, loader: async () => readOnlyGramJs(await rec.loader()) });
    expect(() => client.sendMessage(CHAT, 'hello')).toThrow(expect.objectContaining({ code: 'qa.intake.telegram.method' }));
    expect(() => client.raw.invoke({ className: 'messages.SendMessage' })).toThrow(expect.objectContaining({ code: 'qa.intake.telegram.method' }));
    expect(rec.calls.some((c) => c.startsWith('sendMessage') || c === 'invoke')).toBe(false);
    expect(await client.history(Number(CHAT), { limit: 1, reverse: true })).toHaveLength(1);
  });

  it('fails a method outside the allowlist of ReadOnlyTelegram with qa.intake.telegram.method', async () => {
    const rec = recordedGramJs(GRAMJS_FILE);
    const tg = await new TelegramMtprotoIntakeDriver(CFG, { maxBytes: MAX, loader: rec.loader }).connect();
    expect(tg).toBeInstanceOf(ReadOnlyTelegram);
    for (const method of ['sendMessage', 'me', 'session', 'deleteMessages', 'raw']) {
      expect(() => tg.call(method, CHAT, 'x')).toThrow(expect.objectContaining({ code: 'qa.intake.telegram.method' }));
    }
    expect(await tg.call('messages', Number(CHAT), [201, 999])).toHaveLength(1);
    expect(rec.calls.filter((c) => !c.startsWith('getMessages:'))).toEqual(['connect']);
  });

  it('names the missing config keys and never the session', () => {
    let error: unknown;
    try {
      new TelegramMtprotoIntakeDriver({ apiId: 'x', session: SESSION }, { maxBytes: MAX });
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({ code: 'qa.intake.telegram.config' });
    const text = `${(error as Error).message} ${JSON.stringify((error as { context?: unknown }).context)}`;
    expect(text).toContain('qa.intake.drivers.telegram-mtproto.apiId');
    expect(text).toContain('qa.intake.drivers.telegram-mtproto.apiHash');
    expect(text).not.toContain(SESSION);
  });

  it('fails a GramJS load error with qa.intake.telegram.peer', async () => {
    const d = new TelegramMtprotoIntakeDriver(CFG, {
      maxBytes: MAX,
      loader: async () => {
        throw new Error('Cannot find package telegram');
      },
    });
    await expect(d.fetch(CHAT)).rejects.toMatchObject({ code: 'qa.intake.telegram.peer' });
  });

  it('fails a chat the session cannot read with qa.intake.telegram.read', async () => {
    await expect(driver().d.fetch('@unknown_chat')).rejects.toMatchObject({ code: 'qa.intake.telegram.read' });
  });

  it('fails a connect error with qa.intake.telegram.connect and keeps the session out of the message', async () => {
    const offline: GramJsModule = {
      StringSession: class {},
      TelegramClient: class {
        connect(): Promise<unknown> {
          return Promise.reject(new Error('no network'));
        }
      } as unknown as GramJsModule['TelegramClient'],
    };
    const d = new TelegramMtprotoIntakeDriver(CFG, { maxBytes: MAX, loader: async () => offline });
    const err: unknown = await d.fetch(CHAT).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toMatchObject({ code: 'qa.intake.telegram.connect' });
    expect((err as Error).message).not.toContain(SESSION);
  });
});
