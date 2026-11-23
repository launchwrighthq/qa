import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import gc from '../../../src/commands/qa-gc.mts';
import { writeReportFixture } from '../../../src/testing/report-fixture.mts';

describe('lw qa gc', () => {
  it('keeps the evidence of the newest reports in qa.reportDir', async () => {
    const root = await tmpDir();
    for (const slug of ['2026-01-01-old', '2026-02-01-new']) await writeReportFixture(join(root, 'reports'), { slug });
    const out: string[] = [];
    const code = await gc.run(['--keep', '1'], { cwd: root, out: (l) => out.push(l), err: () => undefined, config: { qa: { reportDir: 'reports' } } });
    expect(code).toBe(0);
    expect(out[0]).toMatch(/^deleted the evidence of 2026-01-01-old \(\d+ bytes\)$/);
    expect(await readdir(join(root, 'reports/assets'))).toEqual(['2026-02-01-new']);
  });

  it('exits 2 without --keep <n>', async () => {
    const err: string[] = [];
    expect(await gc.run(['--keep'], { cwd: await tmpDir(), out: () => undefined, err: (l) => err.push(l) })).toBe(2);
    expect(err[0]).toContain('usage: lw qa gc --keep <n>');
  });
});
