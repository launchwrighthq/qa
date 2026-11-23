import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { beforeAll, describe, expect, it } from 'vitest';
import { qaConfig } from '../../../src/config.mts';
import { legDefinitions } from '../../../src/services/legs.mts';
import { resolveSpec } from '../../../src/services/resolve.mts';
import { commit, initRepo } from '../../support/git-repo.mts';

let repo: string;
let early: string;
let page: string;
const legs = legDefinitions(qaConfig.parse({}));

const SPEC = [
  '# Cart design',
  '',
  'Date: 2026-11-02',
  'Status: in-progress, first part in EARLY',
  '',
  '## 1. Scope',
  '',
  'The page `apps/client/src/pages/cart.page.tsx` and the folder `apps/client/src/features/cart` change.',
  'A file `apps/client/src/gone.tsx` never existed.',
].join('\n');

beforeAll(async () => {
  repo = await tmpDir();
  initRepo(repo);
  early = commit(repo, { 'apps/client/src/features/cart/model.mts': 'x', 'apps/client/src/pages/cart.page.tsx': 'x' }, 'feat: cart start', '2026-10-30T09:00:00Z');
  page = commit(repo, { 'apps/client/src/pages/cart.page.tsx': 'y' }, 'feat: cart page totals', '2026-11-03T09:00:00Z');
  commit(repo, { 'apps/api/src/other.mts': 'x' }, 'fix: Cart design follow-up', '2026-11-04T09:00:00Z');
  commit(repo, { 'docs/specs/2026-11-02-cart-design.md': SPEC.replace('EARLY', early.slice(0, 7)) }, 'docs: spec', '2026-11-04T10:00:00Z');
});

describe('resolveSpec', () => {
  it('collects the commits from the Status line, commit messages and the named files, with the evidence', () => {
    const r = resolveSpec({
      repo,
      cwd: repo,
      specPath: 'docs/specs/2026-11-02-cart-design.md',
      reportDir: 'docs/qa',
      clientRoots: ['apps/client/src'],
      legs,
      clock: fakeClock('2026-11-12T08:00:00Z'),
    });
    expect(r.spec).toMatchObject({ path: 'docs/specs/2026-11-02-cart-design.md', slug: '2026-11-12-cart', title: 'Cart design', status: 'in-progress', dateUsed: '2026-11-02' });
    expect(r.paths).toEqual({
      files: ['apps/client/src/pages/cart.page.tsx'],
      dirs: ['apps/client/src/features/cart'],
      unknown: ['apps/client/src/gone.tsx'],
    });
    const bySubject = Object.fromEntries(r.commits.list.map((c) => [c.subject, c.sources]));
    expect(bySubject['feat: cart start']).toEqual(['status']);
    expect(bySubject['feat: cart page totals']).toEqual(['paths']);
    expect(bySubject['fix: Cart design follow-up']).toEqual(['grep']);
    expect(r.commits.list.find((c) => c.sha === page)?.via).toEqual(['apps/client/src/pages/cart.page.tsx']);
    expect(r.legs.suggested).toEqual(['desktop', 'mobile-web', 'miniapp']);
    expect(r.report).toEqual({ path: 'docs/qa/2026-11-12-cart.md', manifest: 'docs/qa/2026-11-12-cart.shots.json', assets: 'docs/qa/assets/2026-11-12-cart/' });
  });

  it('refuses a spec that does not exist', () => {
    expect(() =>
      resolveSpec({ repo, cwd: repo, specPath: 'docs/specs/none.md', reportDir: 'docs/qa', clientRoots: [], legs, clock: fakeClock() }),
    ).toThrow(expect.objectContaining({ code: 'qa.session.resolve' }));
  });
});
