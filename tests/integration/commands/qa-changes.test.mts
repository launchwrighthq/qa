import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { beforeAll, describe, expect, it } from 'vitest';
import changes from '../../../src/commands/qa-changes.mts';
import { commit, initRepo } from '../../support/git-repo.mts';

let repo: string;

beforeAll(async () => {
  repo = await tmpDir();
  initRepo(repo);
  commit(repo, { 'pnpm-workspace.yaml': 'packages:\n  - apps/*\n', 'apps/web/package.json': '{}' }, 'chore: start', '2026-11-01T09:00:00Z');
  commit(repo, { 'apps/web/src/a.mts': 'x' }, 'feat(web): a', '2026-11-02T09:00:00Z');
});

function cli() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: { cwd: repo, out: (l: string) => out.push(l), err: (l: string) => err.push(l) } };
}

describe('lw qa changes', () => {
  it('prints the digest as JSON with --json', async () => {
    const c = cli();
    expect(await changes.run(['--since', '2026-11-02', '--json'], c.opts)).toBe(0);
    expect(JSON.parse(c.out.join('\n'))).toMatchObject({ areas: { 'apps/web': 1 }, range: { commits: 1 } });
  });

  it('exits 1 and names the flags when there is no report to continue from', async () => {
    const c = cli();
    expect(await changes.run([], c.opts)).toBe(1);
    expect(c.err[0]).toContain('No report under docs/qa/');
  });

  it('prints the usage and exits 2 for an unknown flag', async () => {
    const c = cli();
    expect(await changes.run(['--until', 'x'], c.opts)).toBe(2);
  });
});
