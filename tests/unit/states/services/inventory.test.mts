import { describe, expect, it } from 'vitest';
import {
  coverageFor,
  FAIL_REASONS,
  inferSeeds,
  isStateUnionName,
  kindFor,
  mechanismFor,
  plannedCaptures,
  statePath,
  type UnionEntry,
  validateInventory,
} from '../../../../src/states/services/inventory.mts';

function union(over: Partial<UnionEntry> = {}): UnionEntry {
  return { name: 'TileState', file: 'apps/client/src/tile.tsx', line: 1, members: ['open', 'closed'], kind: 'neither', flattens: [], inputs: [], outputs: [], ...over };
}

const output = { fn: 'tileState', file: 'apps/client/src/tile.ts', exported: true, nullable: true, async: false, solvable: false, pivots: { literals: [], names: [] }, params: [] };

describe('state inventory', () => {
  it('takes a union name only with a state suffix and more than the suffix', () => {
    expect(['TileState', 'BadgeMark', 'SyncStatus', 'RowKind', 'LaunchPhase', 'ButtonVariant'].every(isStateUnionName)).toBe(true);
    expect(isStateUnionName('State')).toBe(false);
    expect(isStateUnionName('TileProps')).toBe(false);
  });

  it('derives the kind from the sites and prefers a mount for both', () => {
    expect(kindFor([1], [1])).toBe('both');
    expect(kindFor([1], [])).toBe('input');
    expect(kindFor([], [1])).toBe('output');
    expect(kindFor([], [])).toBe('neither');
    expect(mechanismFor('both')).toBe('mount');
    expect(mechanismFor('output')).toBe('solve');
    expect(mechanismFor('neither')).toBeNull();
  });

  it('plans one capture per member, a null capture for a nullable output, and no mechanism for neither', () => {
    const captures = plannedCaptures({ unions: [union({ kind: 'output', outputs: [output] }), union({ name: 'LoneState' })] });
    expect(captures.map((c) => c.id)).toEqual(['TileState.open', 'TileState.closed', 'TileState.null', 'LoneState.open', 'LoneState.closed']);
    expect(captures.find((c) => c.id === 'TileState.null')?.member).toBeNull();
    expect(captures.filter((c) => c.union === 'LoneState').every((c) => c.mechanism === null)).toBe(true);
  });

  it('returns every inventory problem at once', () => {
    const errors = validateInventory({
      generated: '2026-01-01T00:00:00.000Z',
      roots: ['apps/client/src'],
      unions: [union({ members: ['only'] }), union({ kind: 'input' }), union()],
      ignored: [{ name: 'TileState', file: 'x', line: 1, members: [], reason: ' ' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'ignored[0] "TileState": needs a reason',
        expect.stringContaining('must carry its members'),
        expect.stringContaining('is also in unions'),
        expect.stringContaining('members must list at least two'),
        expect.stringContaining('kind is "input" but its sites say "neither"'),
        expect.stringContaining('duplicate union name'),
      ]),
    );
  });

  it('counts coverage per union and names the missing members', () => {
    expect(coverageFor({ name: 'TileState' }, [{ id: 'TileState.open', ok: true }, { id: 'TileState.closed', ok: false }, { id: 'Other.open', ok: true }])).toEqual({
      covered: 1,
      planned: 2,
      missing: ['closed'],
    });
  });

  it('files state artifacts under assets/<slug>/states and lists eight fail reasons', () => {
    expect(statePath('run-1', 'TileState.open', 'subject')).toBe('assets/run-1/states/TileState.open.subject.png');
    expect(FAIL_REASONS).toHaveLength(8);
  });

  it('prefers an app service and falls back to a direct write for an unreachable state', () => {
    const inventory = {
      unions: [
        union({ name: 'TileState', kind: 'input', why: 'no route table row reaches it', inputs: [{ interface: 'TileProps', field: 'state', optional: false, file: 'apps/client/src/tile.tsx', component: null, componentFile: null }] }),
        union({ name: 'MenuPhase', kind: 'neither' }),
        union({ name: 'SyncStatus', kind: 'input', inputs: [{ interface: 'SyncProps', field: 'status', optional: false, file: 'apps/client/src/sync.tsx', component: 'Sync', componentFile: 'apps/client/src/sync.tsx' }] }),
      ],
    };
    const proposals = inferSeeds(inventory, new Set(['TileState', 'MenuPhase']));
    expect(proposals.map((p) => [p.union, p.via, p.provenance])).toEqual([
      ['TileState', 'app-service', 'forged'],
      ['MenuPhase', 'direct-write', 'forged'],
    ]);
    expect(proposals[0]?.fields).toEqual([{ interface: 'TileProps', field: 'state', file: 'apps/client/src/tile.tsx' }]);
    expect(proposals[0]?.reason).toBe('no route table row reaches it');
    expect(proposals[1]?.reason).toBe('nothing takes it and nothing returns it');
  });
});
