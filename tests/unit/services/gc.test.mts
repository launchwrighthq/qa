import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { gcReports } from '../../../src/services/gc.mts';
import { reportPaths } from '../../../src/services/ledger.mts';

async function report(dir: string, slug: string): Promise<void> {
  const p = reportPaths(dir, slug);
  await mkdir(p.assets, { recursive: true });
  await mkdir(join(dir, 'dist'), { recursive: true });
  await writeFile(p.md, '# r\n');
  await writeFile(p.plan, '{}');
  await writeFile(join(p.assets, 'desktop-a.b.png'), 'png bytes');
  await writeFile(p.html, '<html>');
}

describe('gcReports (spec 2.12.3)', () => {
  it('deletes the evidence and page of older reports and keeps every report file', async () => {
    const dir = await tmpDir();
    for (const slug of ['2026-01-01-a', '2026-02-01-b', '2026-03-01-c']) await report(dir, slug);
    await mkdir(join(dir, 'assets/2026-04-01-running'), { recursive: true });
    const result = await gcReports(dir, 1);
    expect(result.kept).toEqual(['2026-03-01-c']);
    expect(result.deleted.map((d) => d.slug)).toEqual(['2026-02-01-b', '2026-01-01-a']);
    expect(result.deleted[0]?.bytes).toBe('png bytes'.length + '<html>'.length);
    expect((await readdir(join(dir, 'assets'))).sort()).toEqual(['2026-03-01-c', '2026-04-01-running']);
    expect((await readdir(dir)).filter((f) => f.endsWith('.md')).sort()).toEqual(['2026-01-01-a.md', '2026-02-01-b.md', '2026-03-01-c.md']);
    expect(await readdir(join(dir, 'dist'))).toEqual(['2026-03-01-c.html']);
  });

  it('returns an empty result for a missing report folder, and refuses a bad keep', async () => {
    expect(await gcReports(join(await tmpDir(), 'none'), 2)).toEqual({ kept: [], deleted: [] });
    await expect(gcReports(await tmpDir(), -1)).rejects.toMatchObject({ code: 'qa.gc.keep' });
  });
});
