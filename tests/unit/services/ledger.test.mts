import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import {
  appendLedger,
  appendResult,
  dropRowLeg,
  latestResults,
  ledgerEntry,
  pairKey,
  readLedger,
  readResults,
  reportPaths,
  verifyLedger,
} from '../../../src/services/ledger.mts';

const FACTS = {
  path: 'assets/2026-01-01-x/desktop-a.b.png',
  kind: 'screenshot' as const,
  capturedAt: '2026-01-01T00:00:00.000Z',
  commit: 'abc1234',
  dirty: true,
  leg: 'desktop',
  target: 'playwright',
  device: 'local',
  provenance: 'mounted' as const,
  row: 'a.b',
  attempt: 2,
};

async function setup() {
  const dir = await tmpDir();
  await mkdir(join(dir, 'assets/2026-01-01-x'), { recursive: true });
  await writeFile(join(dir, FACTS.path), 'image bytes');
  return dir;
}

describe('ledger (spec 2.11.3, R17)', () => {
  it('holds hash, size, time, commit, leg, target, device, provenance, row and attempt per file', async () => {
    const dir = await setup();
    const entry = await ledgerEntry(dir, FACTS);
    expect(entry).toEqual({ ...FACTS, sha256: createHash('sha256').update('image bytes').digest('hex'), bytes: 11 });
    await appendLedger(dir, '2026-01-01-x', [entry]);
    const ledger = await readLedger(reportPaths(dir, '2026-01-01-x').ledger);
    expect(ledger).toEqual({ format: 1, slug: '2026-01-01-x', entries: [entry] });
  });

  it('replaces an entry with the same path and sorts by path', async () => {
    const dir = await setup();
    await writeFile(join(dir, 'assets/2026-01-01-x/a.png'), 'a');
    const one = await ledgerEntry(dir, FACTS);
    const two = await ledgerEntry(dir, { ...FACTS, path: 'assets/2026-01-01-x/a.png' });
    await appendLedger(dir, '2026-01-01-x', [one, two]);
    const next = await appendLedger(dir, '2026-01-01-x', [{ ...one, attempt: 3 }]);
    expect(next.entries.map((e) => e.path)).toEqual(['assets/2026-01-01-x/a.png', 'assets/2026-01-01-x/desktop-a.b.png']);
    const stored = JSON.parse(await readFile(reportPaths(dir, '2026-01-01-x').ledger, 'utf8')) as { entries: Array<{ path: string; attempt: number }> };
    expect(stored.entries.map((e) => e.path)).toEqual(['assets/2026-01-01-x/a.png', 'assets/2026-01-01-x/desktop-a.b.png']);
    expect(stored.entries[1]?.attempt).toBe(3);
  });

  it('refuses a path outside assets/<slug>/', async () => {
    const dir = await setup();
    await expect(ledgerEntry(dir, { ...FACTS, path: '../x.png' })).rejects.toMatchObject({ code: 'qa.ledger.path' });
  });

  it('refuses to delete an edited ledger path outside the slug folder', async () => {
    const dir = await setup();
    const entry = await ledgerEntry(dir, FACTS);
    await writeFile(join(dir, 'keep.txt'), 'keep');
    await writeFile(
      reportPaths(dir, '2026-01-01-x').ledger,
      JSON.stringify({ format: 1, slug: '2026-01-01-x', entries: [{ ...entry, path: 'assets/2026-01-01-x/../../keep.txt' }] }),
    );
    await expect(dropRowLeg(dir, '2026-01-01-x', FACTS.row, FACTS.leg)).rejects.toMatchObject({ code: 'qa.ledger.path' });
    expect(await readFile(join(dir, 'keep.txt'), 'utf8')).toBe('keep');
  });

  it('verifies every hash and names the row and leg of a missing or changed file', async () => {
    const dir = await setup();
    await writeFile(join(dir, 'assets/2026-01-01-x/b.png'), 'b');
    const a = await ledgerEntry(dir, FACTS);
    const b = await ledgerEntry(dir, { ...FACTS, path: 'assets/2026-01-01-x/b.png', row: 'c.d', leg: 'miniapp' });
    expect(await verifyLedger(dir, [a, b])).toEqual([]);
    await writeFile(join(dir, FACTS.path), 'image bytez');
    await rm(join(dir, 'assets/2026-01-01-x/b.png'));
    expect(await verifyLedger(dir, [a, b])).toEqual([
      expect.objectContaining({ code: 'hash', row: 'a.b', leg: 'desktop' }),
      expect.objectContaining({ code: 'missing-file', row: 'c.d', leg: 'miniapp', message: expect.stringContaining('row c.d, leg miniapp') }),
    ]);
  });

  it('fails with qa.ledger.invalid on a bad entry', async () => {
    const dir = await setup();
    const path = reportPaths(dir, '2026-01-01-x').ledger;
    await writeFile(path, JSON.stringify({ format: 1, slug: 'x', entries: [{ path: 'p' }] }));
    await expect(readLedger(path)).rejects.toMatchObject({ code: 'qa.ledger.invalid' });
    expect(await readLedger(join(dir, 'none.json'))).toBeNull();
  });

  it('keeps row results as JSON lines, and the last line of a row and leg wins', async () => {
    const dir = await setup();
    const path = reportPaths(dir, '2026-01-01-x').results;
    await appendResult(path, { row: 'a.b', leg: 'desktop', status: 'failed', failures: ['blank'], attempts: 1, ms: 5 });
    await appendResult(path, { row: 'a.b', leg: 'desktop', status: 'passed', failures: [], attempts: 2, ms: 9 });
    const results = await readResults(path);
    expect(results).toHaveLength(2);
    expect(latestResults(results).get(pairKey('a.b', 'desktop'))?.status).toBe('passed');
    await writeFile(path, '{"row":1}\n');
    await expect(readResults(path)).rejects.toMatchObject({ code: 'qa.results.invalid' });
  });
});
