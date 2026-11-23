import { describe, expect, it } from 'vitest';
import { guarded } from '../../../../src/world/services/context.mts';

/** The LaunchwrightError and UsageError of another kernel copy, as a framework app throws them. */
class ForeignError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function run(body: () => Promise<number>) {
  const err: string[] = [];
  return { err, done: guarded('world reset', { err: (l) => err.push(l) }, body) };
}

describe('guarded', () => {
  it('prints a coded error of another kernel copy as one line and exits 1', async () => {
    const r = run(async () => {
      throw new ForeignError('db.migrate', 'The migration 0002 failed.');
    });
    expect(await r.done).toBe(1);
    expect(r.err).toEqual(['lw qa world reset: The migration 0002 failed. (db.migrate)']);
  });

  it('exits 2 for the usage code of any kernel copy', async () => {
    const r = run(async () => {
      throw new ForeignError('kernel.usage', 'Unknown option --x.');
    });
    expect(await r.done).toBe(2);
  });

  it('throws an error without a dotted code on', async () => {
    const crash = Object.assign(new Error('no file'), { code: 'ENOENT' });
    await expect(
      run(async () => {
        throw crash;
      }).done,
    ).rejects.toBe(crash);
  });
});
