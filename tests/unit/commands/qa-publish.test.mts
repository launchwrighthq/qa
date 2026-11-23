import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import publish, { publishManifest } from '../../../src/commands/qa-publish.mts';

function cli(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  // The gate runs before the command reads the app, so an empty app object is enough for a refusal.
  return { out, err, opts: { cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config: { qa: { publish: { storage: 'QA Reports' } } }, app: {} } };
}

describe('lw qa publish run contract (spec 2.6, R6)', () => {
  it('lists one outward item per storage disk', () => {
    expect(publishManifest('QA Reports').items).toEqual([
      { id: 'outward:storage-publish-qa-reports', group: 'outward', title: 'Copy QA reports and their evidence to the storage disk QA Reports', outward: true },
    ]);
  });

  it('refuses without a grant, prints the manifest and exits 2', async () => {
    const c = cli(await tmpDir());
    expect(await publish.run(['2026-11-23-smoke'], c.opts)).toBe(2);
    expect(c.out[0]).toBe('run contract for "lw qa publish": 1 item(s) need consent');
    expect(c.err.some((l) => l.includes('outward outward:storage-publish-qa-reports'))).toBe(true);
  });

  it('refuses an --allow id for another disk', async () => {
    const c = cli(await tmpDir());
    expect(await publish.run(['2026-11-23-smoke', '--allow', 'outward:storage-publish-other'], c.opts)).toBe(2);
    expect(c.err[0]).toContain('names no item of this manifest');
  });
});
