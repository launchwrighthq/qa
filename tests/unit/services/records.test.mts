import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { listIssues, readIssue, recordDir, recordId, writeIssue } from '../../../src/services/records.mts';
import { INTAKE_DIR } from '../../../src/services/types.mts';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('issue records', () => {
  it('writes issue.json, issue.md and the assets with sha256, bytes and media type', async () => {
    const root = await tmpDir();
    const issue = await writeIssue(root, {
      id: 'github-acme-widget-1',
      source: 'github',
      ref: 'https://github.com/acme/widget/issues/1',
      title: 'Button does nothing',
      reportedAt: '2026-11-10T09:00:00.000Z',
      reporter: 'someone',
      text: 'It does nothing.',
      thread: [{ at: '2026-11-10T10:00:00.000Z', author: 'dev', text: 'Which page?' }],
      media: [
        { from: 'https://github.com/user-attachments/assets/a', kind: 'image', mime: 'image/png', data: png },
        { from: 'https://github.com/user-attachments/assets/b', kind: 'video', mime: 'video/mp4', skipped: 'too-large' },
      ],
    });
    expect(issue.attachments).toEqual([
      { kind: 'image', path: 'assets/01-image.png', sha256: createHash('sha256').update(png).digest('hex'), bytes: 7, mime: 'image/png', from: 'https://github.com/user-attachments/assets/a' },
    ]);
    expect(issue.skipped).toEqual([{ from: 'https://github.com/user-attachments/assets/b', reason: 'too-large' }]);
    const dir = join(root, INTAKE_DIR, 'github-acme-widget-1');
    expect(new Uint8Array(await readFile(join(dir, 'assets/01-image.png')))).toEqual(png);
    expect(JSON.parse(await readFile(join(dir, 'issue.json'), 'utf8'))).toEqual(issue);
    const md = await readFile(join(dir, 'issue.md'), 'utf8');
    expect(md).toContain('# Button does nothing');
    expect(md).toContain('![assets/01-image.png](assets/01-image.png)');
    expect(md).toContain('- too-large: https://github.com/user-attachments/assets/b');
    expect(await readIssue(root, issue.id)).toEqual(issue);
  });

  it('lists records by id and skips a folder without issue.json', async () => {
    const root = await tmpDir();
    const base = { source: 'telegram' as const, ref: 'r', title: 't', reportedAt: '2026-11-10T09:00:00.000Z', reporter: 'r', text: '', thread: [], media: [] };
    await writeIssue(root, { ...base, id: 'tg-2-5' });
    await writeIssue(root, { ...base, id: 'tg-1-9' });
    await mkdir(join(root, INTAKE_DIR, 'telegram', 'x'), { recursive: true });
    await writeFile(join(root, INTAKE_DIR, 'telegram', 'x.cursor'), '{}');
    expect((await listIssues(root)).map((i) => i.id)).toEqual(['tg-1-9', 'tg-2-5']);
    expect(await listIssues(join(root, 'none'))).toEqual([]);
  });

  it('builds ids from parts and refuses an id that leaves the intake folder', () => {
    expect(recordId('github', 'Acme', 'my.repo', 7)).toBe('github-Acme-my.repo-7');
    expect(recordId('tg', '@qa_chat', '12')).toBe('tg-qa_chat-12');
    expect(recordId('tg', '-1001', '12')).toBe('tg--1001-12');
    for (const id of ['../x', 'a/b', '', '.hidden', 'a..b']) {
      expect(() => recordDir('/r', id)).toThrow(expect.objectContaining({ code: 'qa.intake.id' }));
    }
  });

  it('fails qa.intake.missing for an unknown record', async () => {
    await expect(readIssue(await tmpDir(), 'tg-1-1')).rejects.toMatchObject({ code: 'qa.intake.missing' });
  });
});
