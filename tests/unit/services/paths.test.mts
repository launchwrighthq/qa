import { join } from 'node:path';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import {
  budgetCheck,
  buildCrawlPlan,
  chooseEdges,
  cleanLabel,
  clickByNameExpression,
  CONTROL_SELECTOR,
  crawl,
  crossReach,
  FAIL_REASONS,
  formatPath,
  MAX_DEPTH,
  MAX_EDGES_PER_NODE,
  normaliseControls,
  pathId,
  recordPath,
  routeDrift,
  routeMatches,
  stamp,
  stateCaptures,
  targetsFrom,
  VIDEO_KINDS,
  videoPath,
  videoRecord,
} from '../../../src/services/paths.mts';
import type { UnionEntry } from '../../../src/states/services/inventory.mts';
import { ScriptedSession } from '../../support/states-fakes.mts';

const delivery = {
  unions: [
    { union: 'InviteMark', routes: [{ surface: 'web' as const, route: '/invites', page: 'p/invites.page.tsx' }, { surface: 'web' as const, route: '/items/:id', dynamic: true }] },
    { union: 'TileState', routes: [{ surface: 'web' as const, route: '/invites' }, { surface: 'miniapp' as const, route: '/' }] },
  ],
};

const site = {
  '/': { controls: [{ label: 'Invites', role: 'link', to: '/invites' }, { label: 'Help', role: 'button' }, { label: 'Sign out', role: 'button', to: '/bye' }] },
  '/invites': { controls: [{ label: 'Open item', role: 'link', to: '/items/7' }, { label: 'Home', role: 'link', to: '/' }] },
  '/items/7': { controls: [] },
};

describe('path contract', () => {
  it('keeps the source bounds and vocabularies', () => {
    expect(MAX_DEPTH).toBe(3);
    expect(MAX_EDGES_PER_NODE).toBe(12);
    expect(CONTROL_SELECTOR).toBe('button, a, [role="button"], [role="link"], [role="tab"]');
    expect(FAIL_REASONS).toEqual(['no-serial', 'over-budget', 'route-drift', 'state-mismatch', 'unlabelled-video', 'crashed']);
    expect(VIDEO_KINDS).toEqual(['path', 'state']);
  });

  it('strides across a long control list instead of taking its head', () => {
    const controls = Array.from({ length: 24 }, (_, i) => i);
    expect(chooseEdges(controls, 12)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    expect(chooseEdges([1, 2], 12)).toEqual([1, 2]);
    expect(cleanLabel('  Open\n  the   item  ')).toBe('Open the item');
    expect(normaliseControls([{ label: 'B', role: 'button' }, { label: ' A ', role: 'link' }, { label: 'B', role: 'button' }, { label: '', role: 'button' }])).toEqual([
      { label: 'A', role: 'link' },
      { label: 'B', role: 'button' },
    ]);
  });

  it('matches a route pattern with a param and an optional param', () => {
    expect(routeMatches('/items/:id', '/items/7')).toBe(true);
    expect(routeMatches('/items/:id', '/items')).toBe(false);
    expect(routeMatches('/list/:tab?', '/list')).toBe(true);
    expect(routeMatches('/list/:tab?', '/list/new?x=1')).toBe(true);
  });

  it('takes the targets from the delivery map, deduplicated per surface and sorted', () => {
    expect(targetsFrom(delivery)).toEqual([
      { surface: 'miniapp', route: '/', page: null, dynamic: false, unions: ['TileState'] },
      { surface: 'web', route: '/invites', page: 'p/invites.page.tsx', dynamic: false, unions: ['InviteMark', 'TileState'] },
      { surface: 'web', route: '/items/:id', page: null, dynamic: true, unions: ['InviteMark'] },
    ]);
  });

  it('names a path by its labels and reads it as routes and quoted labels', () => {
    const path = { leg: 'desktop', from: '/', steps: [{ label: 'Invites', role: 'link', route: '/invites' }] };
    expect(pathId(path)).toBe('desktop.root.invites');
    expect(formatPath({ ...path, route: '/invites' })).toBe('/ -> "Invites" -> /invites');
  });

  it('crosses paths with targets, reports unreached unions and fails drift', () => {
    const targets = targetsFrom(delivery);
    const cross = crossReach(targets, [{ surface: 'web', route: '/items/9', id: 'p1' }]);
    expect(cross.unions).toEqual([
      { union: 'InviteMark', reachable: true },
      { union: 'TileState', reachable: false },
    ]);
    expect(cross.unreachable).toEqual(['TileState']);
    expect(routeDrift(targets, [{ id: 'p2', surface: 'web', route: '/bye' }, { id: 'p3', surface: 'web', route: '/invites' }])).toEqual([{ id: 'p2', route: '/bye' }]);
  });

  it('keeps a path video live, a state video never live, and every video on a device', () => {
    expect(videoRecord({ kind: 'path', file: 'a.webm', provenance: 'live', device: 'browser chromium', seconds: 3 })).toMatchObject({ ok: true });
    expect(videoRecord({ kind: 'path', file: 'a.webm', provenance: 'mounted', device: 'x', seconds: 3 })).toMatchObject({ ok: false, reason: 'unlabelled-video' });
    expect(videoRecord({ kind: 'state', file: 'a.webm', provenance: 'live', device: 'x', seconds: 3 })).toMatchObject({ ok: false, reason: 'unlabelled-video' });
    expect(videoRecord({ kind: 'state', file: 'a.webm', provenance: 'mounted', device: 'x', seconds: 3 })).toMatchObject({ ok: true });
    expect(videoRecord({ kind: 'state', file: 'a.webm', provenance: 'other', device: 'x', seconds: 3 })).toMatchObject({ ok: false, reason: 'unlabelled-video' });
    expect(videoRecord({ kind: 'path', file: 'a.webm', provenance: 'live', device: null, seconds: 3 })).toMatchObject({ ok: false, reason: 'no-serial' });
    expect(videoRecord({ kind: 'reel', file: 'a.webm', provenance: 'live', device: 'x', seconds: 3 })).toMatchObject({ ok: false, reason: 'crashed' });
  });

  it('fails a path that runs past the recorder and names the step', () => {
    expect(budgetCheck({ steps: [{ label: 'a', atMs: 1000 }], seconds: 2 })).toEqual({ ok: true });
    expect(budgetCheck({ steps: [{ label: 'a', atMs: 1000 }, { label: 'Pay', atMs: 172_000 }], seconds: 170 })).toEqual({
      ok: false,
      reason: 'over-budget',
      error: 'the recorder stopped at 2:50 and the path was still on "Pay" at 2:52',
    });
    expect(stamp(14_000)).toBe('0:14');
  });

  it('lists the state videos a union owes and skips one the harness cannot mount, with a reason', () => {
    const tile = { name: 'TileState', file: 'f', line: 1, members: ['a', 'b'], kind: 'input', flattens: [], outputs: [], inputs: [{ interface: 'P', field: 'state', optional: false, file: 'f', component: 'Tile', componentFile: 'f' }] } as UnionEntry;
    const mark = { ...tile, name: 'DotMark', inputs: [] } as UnionEntry;
    expect(stateCaptures({ unions: [tile, mark] }, ['Other'])).toEqual({
      rows: [],
      skipped: [
        { union: 'TileState', why: 'the harness cannot mount Tile' },
        { union: 'DotMark', why: 'no input site: nothing takes this state as a prop' },
      ],
    });
    expect(stateCaptures({ unions: [tile] }, null, ['TileState']).rows.map((r) => r.id)).toEqual(['TileState.a', 'TileState.b']);
  });

  it('builds a click expression that names the label and the role', () => {
    const expression = clickByNameExpression('Open "it"', 'link');
    expect(expression).toContain('const want = norm("Open \\"it\\"");');
    expect(expression).toContain('const wantRole = "link";');
  });

  it('crawls breadth first from a fresh navigation per edge and keeps the first path to each route', async () => {
    const session = new ScriptedSession({ site });
    const plan = buildCrawlPlan({ slug: 's', leg: 'desktop', surface: 'web', targets: targetsFrom(delivery) });
    const { paths, visited } = await crawl(session, plan);
    expect(paths.map((p) => [p.readable, p.route, p.resolved, p.depth])).toEqual([
      ['/ -> "Invites" -> /invites', '/invites', true, 1],
      ['/ -> "Sign out" -> /bye', '/bye', false, 1],
      ['/ -> "Invites" -> "Open item" -> /items/:id', '/items/:id', true, 2],
    ]);
    expect(visited).toEqual(['/', '/invites', '/bye', '/items/:id']);
    expect(session.calls.filter((c) => c === 'navigate /')).toHaveLength(4);
  });

  it('refuses to crawl on a target that cannot evaluate', async () => {
    const plan = buildCrawlPlan({ slug: 's', leg: 'desktop', surface: 'web', targets: [] });
    await expect(crawl(new ScriptedSession({ evaluate: false }), plan)).rejects.toMatchObject({ code: 'qa.paths.evaluate' });
  });

  it('records a crawled path live, with a mark per step', async () => {
    const clock = fakeClock();
    const dir = await tmpDir();
    const session = new ScriptedSession({ site, clock, clickMs: 1500 });
    const file = join(dir, videoPath('s', 'desktop.root.invites', 'desktop', 'webm'));
    const recorded = await recordPath(session, {
      root: '/',
      path: { id: 'desktop.root.invites', steps: [{ label: 'Invites', role: 'link' }, { label: 'Open item', role: 'link' }] },
      file,
      device: 'browser chromium',
      capS: 170,
      now: () => clock.now(),
    });
    expect(recorded).toMatchObject({ ok: true, kind: 'path', provenance: 'live', device: 'browser chromium', file, seconds: 3, marks: ['0:02  Invites', '0:03  Open item'] });
    expect(session.calls.at(-1)).toBe(`stopVideo ${file}`);
  });

  it('keeps the video of a path that no longer walks, and fails it as state-mismatch', async () => {
    const dir = await tmpDir();
    const session = new ScriptedSession({ site });
    const recorded = await recordPath(session, {
      root: '/',
      path: { id: 'x', steps: [{ label: 'Gone', role: 'link' }] },
      file: join(dir, 'x.webm'),
      device: 'browser chromium',
      capS: 170,
      now: () => 0,
    });
    expect(recorded).toMatchObject({ ok: false, reason: 'state-mismatch', file: join(dir, 'x.webm') });
    expect(session.calls).toContain(`stopVideo ${join(dir, 'x.webm')}`);
  });

  it('fails a recording past the video cap as over-budget', async () => {
    const clock = fakeClock();
    const session = new ScriptedSession({ site, clock, clickMs: 5000 });
    const recorded = await recordPath(session, { root: '/', path: { id: 'x', steps: [{ label: 'Invites', role: 'link' }] }, file: join(await tmpDir(), 'x.webm'), device: 'd', capS: 2, now: () => clock.now() });
    expect(recorded).toMatchObject({ ok: false, reason: 'over-budget' });
  });
});
