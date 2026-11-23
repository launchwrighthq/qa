import { describe, expect, it } from 'vitest';
import { analyzeSources, isProductSource, type SourceText } from '../../../../src/states/services/scan.mts';

const GENERATED = '2026-01-01T00:00:00.000Z';

function scan(sources: SourceText[], extraTypes: SourceText[] = []) {
  return analyzeSources({ sources, extraTypes, roots: ['apps/client/src'], generated: GENERATED });
}

const tile: SourceText = {
  file: 'apps/client/src/ui/tile.tsx',
  text: `
export type TileState = 'open' | 'closed' | 'locked';
export interface TileProps { state: TileState; title?: string }
export const Tile = (props: TileProps) => <div>{props.state}</div>;
`,
};

const invite: SourceText = {
  file: 'apps/client/src/invites/invite.ts',
  text: `
import type { Invite } from '@shared/invite';
export type InviteMark = 'pending' | 'capped' | 'unpayable';
export function inviteMark(invite: Invite, bar: number): InviteMark | null {
  if (invite.acceptedAt === null) return 'pending';
  if (invite.visits >= bar) return 'capped';
  return invite.visits > 2 ? 'unpayable' : null;
}
const local = (x: Invite): InviteMark => 'pending';
export { local };
`,
};

const inviteType: SourceText = {
  file: 'packages/shared/src/invite.ts',
  text: `
export type Tier = 'free' | 'paid';
export interface Base { id: string }
export interface Invite extends Base { acceptedAt: string | null; visits: number; capped?: boolean; tier: Tier; meta: { a: 1 } }
`,
};

describe('state scan', () => {
  it('keeps product sources and drops tests, mocks and declarations', () => {
    expect(isProductSource('apps/client/src/a.tsx')).toBe(true);
    expect(isProductSource('apps/client/src/a.mts')).toBe(true);
    expect(isProductSource('apps/client/src/a.test.tsx')).toBe(false);
    expect(isProductSource('apps/client/src/__mocks__/a.ts')).toBe(false);
    expect(isProductSource('apps/client/src/a.d.ts')).toBe(false);
  });

  it('classifies an input union with its component, and an output union with shape and pivots', () => {
    const { inventory, problems } = scan([tile, invite], [inviteType]);
    expect(problems).toEqual([]);
    const tileUnion = inventory.unions.find((u) => u.name === 'TileState');
    expect(tileUnion).toMatchObject({ kind: 'input', members: ['open', 'closed', 'locked'], components: ['Tile'] });
    expect(tileUnion?.inputs[0]).toMatchObject({ interface: 'TileProps', field: 'state', component: 'Tile', componentFile: 'apps/client/src/ui/tile.tsx' });

    const mark = inventory.unions.find((u) => u.name === 'InviteMark');
    expect(mark?.kind).toBe('output');
    const [site, local] = mark?.outputs ?? [];
    expect(site).toMatchObject({ fn: 'inviteMark', exported: true, nullable: true, async: false, solvable: true });
    expect(site?.pivots).toEqual({ literals: [2], names: ['bar'] });
    expect(site?.params[0]).toMatchObject({ name: 'invite', type: 'Invite', typeFile: 'packages/shared/src/invite.ts' });
    expect(site?.params[0]?.shape).toEqual({
      type: 'Invite',
      fields: {
        id: { kind: 'string' },
        acceptedAt: { kind: 'nullable', of: { kind: 'string' } },
        visits: { kind: 'number' },
        capped: { kind: 'boolean', optional: true },
        tier: { kind: 'enum', values: ['free', 'paid'] },
        meta: { kind: 'opaque' },
      },
    });
    expect(site?.params[1]?.shape).toBeNull();
    // A function exported by `export { local }` is reachable from the page.
    expect(local).toMatchObject({ fn: 'local', exported: true, nullable: false });
  });

  it('classifies a union that nothing takes and nothing returns as neither', () => {
    const { inventory } = scan([{ file: 'apps/client/src/menu.tsx', text: "export type MenuPhase = 'idle' | 'busy';\nexport const x = 1;" }]);
    expect(inventory.unions).toMatchObject([{ name: 'MenuPhase', kind: 'neither', inputs: [], outputs: [] }]);
  });

  it('classifies both, and awaits a Promise return', () => {
    const { inventory } = scan([
      { file: 'apps/client/src/sync.tsx', text: "export type SyncStatus = 'on' | 'off';\nexport interface P { status: SyncStatus }\nexport async function read(): Promise<SyncStatus> { return 'on'; }" },
    ]);
    expect(inventory.unions[0]).toMatchObject({ kind: 'both' });
    expect(inventory.unions[0]?.outputs[0]).toMatchObject({ async: true, solvable: false });
  });

  it('moves an ignored union with a reason to ignored and keeps it out of the unions', () => {
    const { inventory, problems } = scan([{ file: 'apps/client/src/a.ts', text: "/** @qa-states ignore drawn by the host, never by the app */\nexport type HostKind = 'a' | 'b';" }]);
    expect(problems).toEqual([]);
    expect(inventory.unions).toEqual([]);
    expect(inventory.ignored).toEqual([{ name: 'HostKind', file: 'apps/client/src/a.ts', line: 2, members: ['a', 'b'], reason: 'drawn by the host, never by the app' }]);
  });

  it('reports an ignore tag without a reason, keeps the union counted, and reports a bad directive', () => {
    const { inventory, problems } = scan([
      { file: 'apps/client/src/a.ts', text: "/** @qa-states ignore */\nexport type HostKind = 'a' | 'b';\n/** @qa-states skip */\nexport type OtherKind = 'c' | 'd';" },
    ]);
    expect(problems.map((p) => [p.code, p.union])).toEqual([
      ['ignore-without-reason', 'HostKind'],
      ['ignore-directive', 'OtherKind'],
    ]);
    expect(inventory.unions.map((u) => [u.name, u.kind])).toEqual([
      ['HostKind', 'neither'],
      ['OtherKind', 'neither'],
    ]);
  });

  it('flattens a referenced union with no site into the union that references it', () => {
    const { inventory } = scan([
      {
        file: 'apps/client/src/connect.tsx',
        text: "export type LaunchPhase = 'idle' | 'opening';\nexport type ConnectState = LaunchPhase | 'connected';\nexport interface ConnectProps { state: ConnectState }\nexport const Connect = (p: ConnectProps) => null;",
      },
    ]);
    expect(inventory.unions.map((u) => u.name)).toEqual(['ConnectState']);
    expect(inventory.unions[0]?.members).toEqual(['idle', 'opening', 'connected']);
    expect(inventory.unions[0]?.flattens.map((f) => f.name)).toEqual(['LaunchPhase']);
  });

  it('finds the component of a field declared one intersection away', () => {
    const { inventory } = scan([
      {
        file: 'apps/client/src/badge.tsx',
        text: "export type BadgeMark = 'new' | 'hot';\ntype Rider = { mark: BadgeMark };\nexport type BadgeProps = { size: number } & Rider;\nexport const Badge: Component<BadgeProps> = (props) => null;",
      },
    ]);
    expect(inventory.unions[0]?.inputs[0]).toMatchObject({ interface: 'Rider', component: 'Badge' });
  });

  it('reports two unions of one name instead of guessing', () => {
    const { problems, inventory } = scan([
      { file: 'apps/client/src/a.ts', text: "export type RowKind = 'a' | 'b';" },
      { file: 'apps/client/src/b.ts', text: "export type RowKind = 'c' | 'd';" },
    ]);
    expect(problems.map((p) => p.code)).toEqual(['duplicate-union']);
    expect(inventory.unions.map((u) => u.file)).toEqual(['apps/client/src/a.ts']);
  });

  it('ignores a one-member alias, an unexported alias and a name without a suffix', () => {
    const { inventory } = scan([{ file: 'apps/client/src/a.ts', text: "export type OneState = 'a';\ntype HiddenState = 'a' | 'b';\nexport type Colour = 'red' | 'blue';" }]);
    expect(inventory.unions).toEqual([]);
  });
});
