import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { createFork, dropFork, forkName, isForkOf } from '../../../../src/world/services/fork.mts';
import { pgliteAdmin } from '../../../../src/world/services/stack.mts';

const quiet = { out: () => undefined };

/** A PGlite project whose QA database `app_qa` exists, ready to fork. */
async function qaProject(): Promise<{ root: string; sections: Record<string, unknown>; database: string }> {
  const root = await tmpDir();
  await pgliteAdmin(root, () => true).create('app_qa');
  return { root, sections: { db: { driver: 'pglite' } }, database: 'app_qa' };
}

describe('forkName', () => {
  it('names a fork from the QA database and the label', () => {
    expect(forkName('app_qa', 'giveaway-a')).toBe('app_qa_fork_giveaway_a');
    expect(isForkOf('app_qa', 'app_qa_fork_giveaway_a')).toBe(true);
    expect(isForkOf('app_qa', 'app_qa')).toBe(false);
  });
});

describe('createFork', () => {
  it('copies the QA database to a fork and drops it', async () => {
    const { root, sections, database } = await qaProject();
    const name = await createFork({ root, sections, database, label: 'giveaway-a', ...quiet });
    expect(name).toBe('app_qa_fork_giveaway_a');
    expect(await pgliteAdmin(root, () => true).exists(name)).toBe(true);
    await dropFork({ root, sections, database, name, ...quiet });
    expect(await pgliteAdmin(root, () => true).exists(name)).toBe(false);
  });

  it('runs two forks of one QA database at the same time', async () => {
    const { root, sections, database } = await qaProject();
    const first = await createFork({ root, sections, database, label: 'row-a', ...quiet });
    const second = await createFork({ root, sections, database, label: 'row-b', ...quiet });
    expect(first).not.toBe(second);
    const admin = pgliteAdmin(root, () => true);
    expect(await admin.exists(first)).toBe(true);
    expect(await admin.exists(second)).toBe(true);
    expect(await admin.list('app_qa_fork_')).toEqual(['app_qa_fork_row_a', 'app_qa_fork_row_b']);
  });
});

describe('dropFork', () => {
  it('refuses a database that is not a fork of the QA database', async () => {
    const { root, sections, database } = await qaProject();
    await expect(dropFork({ root, sections, database, name: 'app_qa', ...quiet })).rejects.toMatchObject({ code: 'qa.fork.name' });
  });
});
