import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { beforeAll, describe, expect, it } from 'vitest';
import { digest } from '../../../src/services/changes.mts';
import { commit, initRepo } from '../../support/git-repo.mts';

let repo: string;
const shas: string[] = [];

beforeAll(async () => {
  repo = await tmpDir();
  initRepo(repo);
  shas.push(
    commit(repo, { 'pnpm-workspace.yaml': 'packages:\n  - apps/*\n  - modules/*/ts\n', 'apps/web/package.json': '{}', 'modules/cart/module.toml': '', 'modules/cart/ts/package.json': '{}' }, 'chore: start', '2026-11-01T09:00:00Z'),
    commit(repo, { 'apps/web/src/pages/cart.page.tsx': 'x' }, 'feat(web): cart page', '2026-11-03T09:00:00Z'),
    commit(repo, { 'modules/cart/ts/src/http/cart.mts': 'x', 'docs/specs/2026-11-03-cart-design.md': '# Cart' }, 'feat(cart): endpoint', '2026-11-04T09:00:00Z'),
    commit(repo, { 'README.md': 'x' }, 'docs: readme', '2026-11-05T09:00:00Z'),
  );
});

describe('digest', () => {
  it('takes --since <date> as the first commit at or after it and groups commits by workspace package', () => {
    const d = digest(repo, { since: '2026-11-03', reportDir: 'docs/qa' });
    expect(d.commits.map((c) => [c.subject, c.areas])).toEqual([
      ['feat(web): cart page', ['apps/web']],
      ['feat(cart): endpoint', ['docs', 'modules/cart']],
      ['docs: readme', ['root']],
    ]);
    expect(d.areas).toEqual({ 'apps/web': 1, docs: 1, 'modules/cart': 1, root: 1 });
    expect(d.signals.added.pages).toEqual(['apps/web/src/pages/cart.page.tsx']);
    expect(d.signals.added.endpoints).toEqual(['modules/cart/ts/src/http/cart.mts']);
    expect(d.signals.documents).toEqual(['docs/specs/2026-11-03-cart-design.md']);
    expect(d.range.line).toBe(`2026-11-03 ${shas[1]?.slice(0, 7)} -> 2026-11-05 ${shas[3]?.slice(0, 7)}, 3 commits`);
  });

  it('takes --since <sha> with that commit included', () => {
    const d = digest(repo, { since: (shas[2] as string).slice(0, 10), reportDir: 'docs/qa' });
    expect(d.commits.map((c) => c.subject)).toEqual(['feat(cart): endpoint', 'docs: readme']);
  });

  it('continues after the sha of the Range line of the newest report', async () => {
    const reports = join(repo, 'docs/qa');
    mkdirSync(reports, { recursive: true });
    writeFileSync(join(reports, '2026-11-04-cart.md'), `# Cart\n\nRange: 2026-11-03 ${shas[1]?.slice(0, 7)} -> 2026-11-04 ${shas[2]?.slice(0, 7)}, 2 commits\n`);
    const d = digest(repo, { reportDir: 'docs/qa' });
    expect(d.commits.map((c) => c.subject)).toEqual(['docs: readme']);
    expect(d.range.basis).toContain('--last');
  });

  it('refuses to guess a range without a report, or with a report without a Range line', async () => {
    expect(() => digest(repo, { reportDir: 'docs/none' })).toThrow(expect.objectContaining({ code: 'qa.changes.range', message: expect.stringContaining('--since') }));
    const other = join(repo, 'docs/other');
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'r.md'), '# R\n\nDate: 2026-11-04\n');
    expect(() => digest(repo, { reportDir: 'docs/other' })).toThrow(/no "Range:" line/);
  });

  it('refuses a --since that is neither a date nor a commit', () => {
    expect(() => digest(repo, { since: 'yesterday', reportDir: 'docs/qa' })).toThrow(/neither a date/);
    expect(() => digest(repo, { since: 'abcdef1234', reportDir: 'docs/qa' })).toThrow(/not a commit/);
    expect(() => digest(repo, { since: '2026-12-01', reportDir: 'docs/qa' })).toThrow(/No commit at or after/);
  });
});
