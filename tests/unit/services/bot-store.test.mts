import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { BOT_STORE_DIR, type BotRecord, fileBotStore } from '../../../src/services/bot-store.mts';

const record = (over: Partial<BotRecord> = {}): BotRecord => ({
  botId: 1110000222,
  username: 'qa_throwaway_000_bot',
  token: '1110000222:AA-this_is_a_fake_bot_token_000000000000',
  createdAt: '2026-11-21T00:00:00.000Z',
  ...over,
});

describe('fileBotStore', () => {
  it('writes a record and reads it back', async () => {
    const store = fileBotStore(join(await tmpDir(), BOT_STORE_DIR));
    await store.write(record());
    expect(await store.read(1110000222)).toEqual(record());
  });

  it('returns null for an unknown bot id', async () => {
    const store = fileBotStore(join(await tmpDir(), BOT_STORE_DIR));
    expect(await store.read(999000111)).toBeNull();
  });

  it('lists every record sorted by id', async () => {
    const store = fileBotStore(join(await tmpDir(), BOT_STORE_DIR));
    await store.write(record({ botId: 200000111, username: 'a_bot' }));
    await store.write(record({ botId: 100000222, username: 'b_bot' }));
    expect((await store.list()).map((r) => r.botId)).toEqual([100000222, 200000111]);
  });

  it('removes a record after cleanup', async () => {
    const store = fileBotStore(join(await tmpDir(), BOT_STORE_DIR));
    await store.write(record());
    await store.remove(1110000222);
    expect(await store.read(1110000222)).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it('rejects a bot id that is not a positive integer', async () => {
    const store = fileBotStore(join(await tmpDir(), BOT_STORE_DIR));
    await expect(store.read(0)).rejects.toMatchObject({ code: 'qa.bot.id' });
  });

  it('returns no records when the store folder is absent', async () => {
    const store = fileBotStore(join(await tmpDir(), BOT_STORE_DIR));
    expect(await store.list()).toEqual([]);
  });
});
