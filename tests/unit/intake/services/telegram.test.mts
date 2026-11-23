import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { FAKE_INTAKE_ITEMS, FakeIntakeDriver } from '../../../../src/intake/drivers/intake/fake.mts';
import {
  applyGroups,
  chatDir,
  cursorFile,
  proposeGroups,
  readCursor,
  readMessages,
  stageBatch,
  writeCursor,
  writeProposal,
} from '../../../../src/intake/services/telegram.mts';

const msg = (id: string, at: string, author: string, replyTo?: string) => ({ id, at, author, ...(replyTo ? { replyTo } : {}) });

describe('proposeGroups', () => {
  it('joins a reply chain and one author burst under 15 minutes', () => {
    expect(proposeGroups('c', FAKE_INTAKE_ITEMS).map((g) => g.messages)).toEqual([['101', '102', '103', '104'], ['105'], ['106']]);
  });

  it('keeps messages of one author exactly 15 minutes apart in two groups', () => {
    const groups = proposeGroups('c', [msg('1', '2026-11-01T10:00:00Z', 'a'), msg('2', '2026-11-01T10:14:59Z', 'a'), msg('3', '2026-11-01T10:29:59Z', 'a')]);
    expect(groups.map((g) => g.messages)).toEqual([['1', '2'], ['3']]);
  });

  it('does not join two authors without a reply, and joins a late reply to its chain', () => {
    const groups = proposeGroups('c', [msg('1', '2026-11-01T10:00:00Z', 'a'), msg('2', '2026-11-01T10:01:00Z', 'b'), msg('3', '2026-11-02T10:00:00Z', 'b', '1')]);
    expect(groups.map((g) => g.messages)).toEqual([['1', '3'], ['2']]);
  });

  it('titles a group by chat and first message, with no chat text', () => {
    const [g] = proposeGroups('-1001', FAKE_INTAKE_ITEMS);
    expect(g?.title).toBe('Telegram report -1001/101 (4 messages)');
  });
});

describe('staging, cursor and apply', () => {
  it('stages a batch, merges a second batch and keeps the media as files', async () => {
    const root = await tmpDir();
    const d = new FakeIntakeDriver({ maxBytes: 1024 });
    await stageBatch(root, '-1001', await d.fetch('-1001', { until: 104 }));
    const all = await stageBatch(root, '-1001', await d.fetch('-1001', { since: 102 }));
    expect(all.map((m) => m.id)).toEqual(['101', '102', '103', '104', '105', '106']);
    const first = all[0];
    expect(first?.media[0]).toMatchObject({ kind: 'image', file: 'media/101-1.png' });
    expect(all.find((m) => m.id === '105')?.media[0]).toMatchObject({ skipped: 'too-large' });
    expect(await readFile(join(chatDir(root, '-1001'), 'media/101-1.png'))).toHaveLength(64);
    expect(await readMessages(root, '-1001')).toEqual(all);
  });

  it('keeps one cursor per chat and driver in <chat>.cursor', async () => {
    const root = await tmpDir();
    expect(await readCursor(root, '-1001', 'telegram-mtproto')).toBeUndefined();
    await writeCursor(root, '-1001', 'telegram-mtproto', '208');
    await writeCursor(root, '-1001', 'telegram-bot', '7008');
    await writeCursor(root, '-1002', 'telegram-mtproto', '5');
    expect(cursorFile(root, '-1001')).toBe(join(root, '.lw/qa/intake/telegram/-1001.cursor'));
    expect(await readCursor(root, '-1001', 'telegram-mtproto')).toBe('208');
    expect(await readCursor(root, '-1001', 'telegram-bot')).toBe('7008');
    expect(await readCursor(root, '-1002', 'telegram-mtproto')).toBe('5');
  });

  it('writes one record per reviewed group', async () => {
    const root = await tmpDir();
    const staged = await stageBatch(root, '-1001', await new FakeIntakeDriver({ maxBytes: 1024 }).fetch('-1001'));
    await writeProposal(root, '-1001', proposeGroups('-1001', staged));
    await expect(applyGroups(root, '-1001')).rejects.toMatchObject({ code: 'qa.intake.telegram.groups' });
    const reviewed = { groups: [{ title: 'Checkout button', messages: [101, 102, 103, 104] }, { title: 'Empty avatar', messages: ['105', '106'] }] };
    await writeFile(join(chatDir(root, '-1001'), 'groups.json'), JSON.stringify(reviewed));
    const issues = await applyGroups(root, '-1001');
    expect(issues.map((i) => [i.id, i.title, i.thread.length, i.attachments.map((a) => a.kind), i.skipped.length])).toEqual([
      ['tg--1001-101', 'Checkout button', 3, ['image', 'video', 'voice'], 0],
      ['tg--1001-105', 'Empty avatar', 1, [], 1],
    ]);
    expect(issues[0]).toMatchObject({ source: 'telegram', ref: '-1001#101,102,103,104', reporter: 'Tester One', reportedAt: '2026-11-01T10:00:00.000Z' });
  });

  it('refuses groups.json with an unknown message or a bad shape', async () => {
    const root = await tmpDir();
    await stageBatch(root, '-1001', await new FakeIntakeDriver().fetch('-1001'));
    await writeFile(join(chatDir(root, '-1001'), 'groups.json'), JSON.stringify({ groups: [{ messages: ['101', '999'] }] }));
    await expect(applyGroups(root, '-1001')).rejects.toMatchObject({ code: 'qa.intake.telegram.groups', message: expect.stringContaining('999') });
    await writeFile(join(chatDir(root, '-1001'), 'groups.json'), JSON.stringify({ groups: [{ messages: [] }] }));
    await expect(applyGroups(root, '-1001')).rejects.toMatchObject({ code: 'qa.intake.telegram.groups' });
  });
});
