import { describe, expect, it } from 'vitest';
import { qaConfig } from '../../../src/config.mts';
import { legDefinitions } from '../../../src/services/legs.mts';
import { validateManifest } from '../../../src/services/manifest.mts';
import { fillRoute, handleKeyFor, pageName, planSweep, readWorld, renderSweep, screenSlug } from '../../../src/services/sweep.mts';

const legs = legDefinitions(qaConfig.parse({}));

const delivery = {
  unions: [
    {
      anchor: 'apps/client/src/features/library/lib/shelf-state.mts',
      routes: [
        { surface: 'web', route: '/library', page: 'apps/client/src/pages/library/index.page.tsx', distance: 1, reaches: 4 },
        { surface: 'miniapp', route: '/library', page: 'apps/client/src/pages/library/index.page.tsx', distance: 1, reaches: 4 },
        { surface: 'web', route: '/library/:shelfId', page: 'apps/client/src/pages/shelf.page.tsx', distance: 0, reaches: 2 },
        { surface: 'web', route: '/home', page: 'apps/client/src/pages/home.page.tsx', distance: 3, reaches: 9 },
      ],
    },
    {
      anchor: 'apps/client/src/features/member/lib/member-status.mts',
      routes: [
        { surface: 'web', route: '/account', page: 'apps/client/src/pages/account.page.tsx', distance: 0, reaches: 3 },
        { surface: 'web', route: '/home', page: 'apps/client/src/pages/home.page.tsx', distance: 2, reaches: 9 },
        { surface: 'web', route: '/member/:tab?', page: 'apps/client/src/pages/member.page.tsx', distance: 1, reaches: 3 },
      ],
    },
  ],
};

const world = [
  { kind: 'persona', id: 'member-expiring', summary: 'A member whose plan ends in two days.', feature: 'member' },
  { kind: 'fact', id: 'library.empty-shelf', summary: 'One shelf with no items', feature: 'library', handleKeys: ['shelfId'] },
  { kind: 'fact', id: 'orders.refunded', summary: 'A refunded order', feature: 'orders', handleKeys: ['orderId'] },
];

describe('planSweep', () => {
  it('plans one row per state and address, up to the cap, with every browser leg of the surfaces', () => {
    const plan = planSweep({ world, delivery, legs, generated: '2026-11-12T00:00:00Z' });
    expect(plan.shots.map((s) => [s.id, s.route, s.legs])).toEqual([
      ['member.member-expiring', '/member', ['desktop', 'mobile-web']],
      ['account.member-expiring', '/account', ['desktop', 'mobile-web']],
      ['library.library-empty-shelf', '/library/{shelfId}', ['desktop', 'mobile-web']],
      ['library.library-empty-shelf-b', '/library', ['desktop', 'mobile-web', 'miniapp']],
    ]);
    expect(validateManifest(plan, { legs: legs.map((l) => l.name) })).toEqual([]);
  });

  it('fills a route parameter with the seeded handle value', () => {
    const seeded = world.map((e) => (e.id === 'library.empty-shelf' ? { ...e, handles: { shelfId: 'sh 42' } } : e));
    const plan = planSweep({ world: { stamp: { entries: seeded } }, delivery, legs, generated: '2026-11-12T00:00:00Z' });
    expect(plan.shots.find((s) => s.id.startsWith('library'))?.route).toBe('/library/sh%2042');
  });

  it('keeps every state: a state with no address is owed as no-route', () => {
    const plan = planSweep({ world, delivery, legs, generated: '2026-11-12T00:00:00Z' });
    expect(plan.sweep).toMatchObject({ declared: 3, covered: 2, owed: 1, personas: 1, facts: 2 });
    expect(plan.sweep.owedStates).toEqual([expect.objectContaining({ id: 'orders.refunded', reason: 'no-route' })]);
    expect(renderSweep(plan)).toContain('no-route  orders.refunded');
  });

  it('owes a state as no-seed when every address needs a handle that no key names', () => {
    const only = { unions: [{ anchor: 'x', routes: [{ surface: 'web', route: '/library/:shelfId', page: 'pages/shelf.page.tsx', distance: 0, reaches: 1 }] }] };
    const plan = planSweep({ world: [{ ...world[1], handleKeys: ['other'] }], delivery: only, legs, generated: '2026-11-12T00:00:00Z' });
    expect(plan.sweep.owedStates[0]).toMatchObject({ reason: 'no-seed' });
    expect(plan.sweep.owedStates[0]?.why).toContain(':shelfId');
  });

  it('gives a persona row a persona and a fact row its fact, a busy settle and a source', () => {
    const plan = planSweep({ world, delivery, legs, generated: '2026-11-12T00:00:00Z', spec: 'docs/specs/world.md', cap: 1 });
    expect(plan.shots.map((s) => [s.fixture, s.settle, s.source])).toEqual([
      [{ arm: [], persona: 'member-expiring' }, { busy: true, timeout: 20000 }, ['spec:docs/specs/world.md#member-expiring']],
      [{ arm: [], facts: ['library.empty-shelf'] }, { busy: true, timeout: 20000 }, ['spec:docs/specs/world.md#library.empty-shelf']],
    ]);
  });

  it('refuses an empty world and a cap below one', () => {
    expect(() => readWorld([])).toThrow(/declares no state/);
    expect(() => planSweep({ world, delivery, legs, generated: 'x', cap: 0 })).toThrow(/--cap/);
  });
});

describe('fillRoute', () => {
  it('drops an optional parameter that no handle names and refuses a required one', () => {
    expect(fillRoute('/member/:tab?', {})).toEqual({ route: '/member', missing: null });
    expect(fillRoute('/library/:shelfId', {})).toEqual({ route: null, missing: ':shelfId' });
    expect(fillRoute('/library/:shelf', { shelfId: null })).toEqual({ route: '/library/{shelfId}', missing: null });
  });

  it('matches a short parameter name only exactly', () => {
    expect(handleKeyFor('id', { orderId: 1 })).toBeNull();
    expect(handleKeyFor('id', { id: 1, orderId: 2 })).toBe('id');
    expect(handleKeyFor('order', { orderId: 1, userId: 2 })).toBe('orderId');
  });
});

describe('screenSlug and pageName', () => {
  it('name a screen without its parameters', () => {
    expect(screenSlug('/')).toBe('home');
    expect(screenSlug('/library/{shelfId}/items')).toBe('library-items');
    expect(pageName('apps/client/src/pages/library/index.page.tsx')).toBe('library');
    expect(pageName('apps/client/src/pages/shelf.page.tsx')).toBe('shelf');
  });
});
