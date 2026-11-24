import { describe, expect, it } from 'vitest';
import type { Inventory, StateResult, UnionEntry } from '../../../../src/states/services/inventory.mts';
import { buildPlan, finishRun, groupFor, issueFor, mergeRows, narrowInventory, parseInventory, parseResults, reasonOf, renderReport, SENTENCES } from '../../../../src/states/services/loop.mts';
import { FAIL_REASONS, plannedCaptures } from '../../../../src/states/services/inventory.mts';

const GENERATED = '2026-01-01T00:00:00.000Z';

const tile: UnionEntry = {
  name: 'TileState',
  file: 'apps/client/src/tile.tsx',
  line: 1,
  members: ['open', 'closed'],
  kind: 'input',
  flattens: [],
  inputs: [{ interface: 'TileProps', field: 'state', optional: false, file: 'apps/client/src/tile.tsx', component: 'Tile', componentFile: 'apps/client/src/tile.tsx' }],
  outputs: [],
};
const mark: UnionEntry = {
  name: 'DotMark',
  file: 'apps/client/src/mark.ts',
  line: 3,
  members: ['on', 'off'],
  kind: 'output',
  flattens: [],
  inputs: [],
  outputs: [
    {
      fn: 'mark',
      file: 'apps/client/src/mark.ts',
      exported: true,
      nullable: false,
      async: false,
      solvable: true,
      pivots: { literals: [2], names: [] },
      params: [{ name: 'x', type: 'Dot', typeFile: null, shape: { type: 'Dot', fields: { on: { kind: 'boolean' } } } }],
    },
  ],
};
const menu: UnionEntry = { name: 'MenuPhase', file: 'apps/client/src/menu.ts', line: 1, members: ['idle', 'busy'], kind: 'neither', flattens: [], inputs: [], outputs: [] };

const inventory: Inventory = { generated: GENERATED, roots: ['apps/client/src'], unions: [tile, mark, menu], ignored: [] };

function ok(id: string, provenance: StateResult['provenance']): StateResult {
  return { id, union: id.split('.')[0] as string, member: id.split('.')[1] as string, ok: true, subject: `assets/s/states/${id}.subject.png`, context: null, provenance, verified: null, error: null, ms: 1 };
}

describe('state loop', () => {
  it('has a sentence for every fail reason and reads an unknown reason as crashed', () => {
    expect(Object.keys(SENTENCES).sort()).toEqual([...FAIL_REASONS].sort());
    expect(reasonOf({ reason: 'invented' })).toBe('crashed');
    expect(reasonOf({ reason: 'identical' })).toBe('identical');
  });

  it('parses an inventory and refuses one with problems', () => {
    expect(parseInventory(JSON.stringify(inventory), 'states.json').unions).toHaveLength(3);
    expect(() => parseInventory('{', 'states.json')).toThrow(expect.objectContaining({ code: 'qa.states.inventory' }));
    expect(() => parseInventory(JSON.stringify({ ...inventory, roots: [] }), 'states.json')).toThrow(/roots: must list/);
  });

  it('narrows by files and folders, dropping unions and never members', () => {
    const narrowed = narrowInventory(inventory, { dirs: ['apps/client/src/'], files: [] });
    expect(narrowed.kept).toEqual(['TileState', 'DotMark', 'MenuPhase']);
    expect(narrowInventory(inventory, { files: ['apps/client/src/mark.ts'] })).toMatchObject({ kept: ['DotMark'], dropped: ['TileState', 'MenuPhase'] });
  });

  it('builds a solve group from a delivery descriptor, and names what is missing without one', () => {
    const captures = plannedCaptures({ unions: [mark] }).filter((c) => c.union === 'DotMark');
    expect(groupFor(mark, captures, 'desktop')).toEqual({ group: null, missing: ['route', 'intercept.url', 'intercept.container', 'settle'] });
    const built = groupFor({ ...mark, delivery: { route: '/dots', intercept: { url: '**/api/dots*', container: 'items' }, settle: { selector: 'li' } } }, captures, 'desktop');
    expect(built.group).toMatchObject({
      union: 'DotMark',
      leg: 'desktop',
      provenance: 'intercepted',
      verify: { module: 'apps/client/src/mark.ts', export: 'mark' },
      solve: { pivots: { literals: [2], names: [] } },
      members: [
        { id: 'DotMark.on', member: 'on' },
        { id: 'DotMark.off', member: 'off' },
      ],
    });
    expect(groupFor(mark, captures.slice(0, 1), 'desktop').missing).toContain('contrast');
  });

  it('takes the nearest static derived route of the leg surface when the descriptor names none', () => {
    const captures = plannedCaptures({ unions: [mark] }).filter((c) => c.union === 'DotMark');
    const at = (surface: 'web' | 'miniapp', route: string, dynamic = false) => ({ surface, route, page: null, distance: 1, dynamic, reaches: 1 });
    const routes = [at('web', '/dots/:id', true), at('miniapp', '/m/dots'), at('web', '/dots')];
    const descriptor = { intercept: { url: '**/api/dots*', container: 'items' }, settle: { selector: 'li' } };
    expect(groupFor({ ...mark, routes, delivery: descriptor }, captures, 'desktop', 'web').group?.route).toBe('/dots');
    expect(groupFor({ ...mark, routes, delivery: descriptor }, captures, 'desktop', 'miniapp').group?.route).toBe('/m/dots');
    expect(groupFor({ ...mark, routes, delivery: { ...descriptor, route: '/given' } }, captures, 'desktop', 'web').group?.route).toBe('/given');
    expect(groupFor({ ...mark, routes: [routes[0]!] }, captures, 'desktop', 'web').missing).toContain('route');
  });

  it('turns silence into a failure and keeps an extra rendering', () => {
    const captures = plannedCaptures(inventory);
    const rows = mergeRows(captures, [ok('TileState.open', 'mounted'), ok('TileState.open#wide', 'mounted')], { blocked: { DotMark: 'no descriptor' } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('TileState.closed')).toMatchObject({ ok: false, reason: 'crashed', error: 'the runner exited without reporting this capture' });
    expect(byId.get('DotMark.on')).toMatchObject({ ok: false, reason: 'blocked', why: 'no descriptor' });
    expect(byId.get('MenuPhase.idle')).toMatchObject({ ok: false, reason: 'no-mechanism' });
    expect(byId.get('TileState.open#wide')).toMatchObject({ ok: true, extra: true });
  });

  it('writes the arithmetic in the heading and labels every shot that is not live', () => {
    const rows = mergeRows(plannedCaptures({ unions: [tile] }), [ok('TileState.open', 'mounted'), ok('TileState.closed', 'live')]);
    const report = renderReport({ inventory: { unions: [tile] }, rows, slug: 's' });
    expect(report).toContain('### Tile: TileState, 2 of 2 renderings');
    expect(report).toContain('| open | ![TileState.open](assets/s/states/TileState.open.subject.png) (mounted) |');
    expect(report).toContain('| closed | ![TileState.closed](assets/s/states/TileState.closed.subject.png) | - | not verified |');
  });

  it('fails a run with a neither union, an uncovered member or a mechanism that did not run', () => {
    const plan = buildPlan({ inventory, source: 'test', slug: 's', generated: GENERATED });
    const done = finishRun({ plan, attempts: [ok('TileState.open', 'mounted'), ok('TileState.closed', 'mounted')], notRun: { solve: 'no routable page' } });
    expect(done.code).toBe(1);
    const text = done.lines.join('\n');
    expect(text).toContain('Mechanism `solve` did not run: no routable page.');
    expect(text).toContain('MenuPhase (apps/client/src/menu.ts) is neither an input nor an output');
    expect(text).toContain('qa states: `MenuPhase` is neither an input nor an output');
    const clean = finishRun({ plan: buildPlan({ inventory: { ...inventory, unions: [tile] }, source: 'test', slug: 's', generated: GENERATED }), attempts: [ok('TileState.open', 'mounted'), ok('TileState.closed', 'mounted')] });
    expect(clean.code).toBe(0);
    expect(clean.lines.at(-1)).toBe('every planned rendering was captured.');
  });

  it('reports a malformed result line rather than skipping it', () => {
    expect(parseResults('{"id":"a.b","ok":true}\nnot json\n{"no":"id"}\n')).toEqual({ attempts: [{ id: 'a.b', ok: true }], malformed: ['not json', '{"no":"id"}'] });
  });

  it('writes an issue for a neither union that names both fixes', () => {
    const issue = issueFor(menu);
    expect(issue.title).toBe('qa states: `MenuPhase` is neither an input nor an output');
    expect(issue.body).toContain('which makes it an input');
    expect(issue.body).toContain('which makes it an output');
  });
});
