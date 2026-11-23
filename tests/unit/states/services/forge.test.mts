import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fakeClock, tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { createStatesCommand } from '../../../../src/commands/qa-states.mts';
import { readLedger } from '../../../../src/services/ledger.mts';
import type { Manifest, Shot } from '../../../../src/services/manifest.mts';
import { computeStatus } from '../../../../src/services/report.mts';
import type { RowResult } from '../../../../src/services/types.mts';
import { captureForged } from '../../../../src/states/services/forge.mts';
import type { SeedProposal } from '../../../../src/states/services/inventory.mts';
import { provenanceLabel } from '../../../../src/states/services/loop.mts';

const BASE_FILES = {
  'apps/api/src/routes.mts': "export default routes((r) => r.group({ name: 'public' }, (g) => { g.page('/', 'home'); g.page('/invites', 'invites'); }));",
  'apps/client/src/pages/home.page.tsx': 'export default function Home() { return null; }',
  'apps/client/src/pages/invites.page.tsx': "import { inviteState } from '../invite';\nexport default function Invites() { return null; }",
  'apps/client/src/invite.ts':
    "export interface Invite { closed: boolean; name: string }\nexport type InviteState = 'open' | 'closed';\nexport function inviteState(invite: Invite): InviteState { return invite.closed ? 'closed' : 'open'; }",
  'apps/client/src/tile.tsx': "export type TileState = 'on' | 'off';\nexport interface TileProps { state: TileState }\nexport const Tile = (p: TileProps) => null;",
  'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';",
};

async function project(files: Record<string, string>): Promise<string> {
  const root = await tmpDir();
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: (cwd: string) => ({ cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config: {} }) };
}

const MENU_SEED: SeedProposal = {
  union: 'MenuPhase',
  file: 'apps/client/src/menu.ts',
  members: ['idle', 'busy'],
  fields: [],
  via: 'direct-write',
  provenance: 'forged',
  reason: 'nothing takes it and nothing returns it',
};

describe('captureForged (spec 2.5, R4)', () => {
  it('writes a forged artifact and records it with provenance forged', async () => {
    const reportDir = await tmpDir();
    const clock = fakeClock();
    const recorded: { file: string; kind: string; row: string }[] = [];
    const result = await captureForged(MENU_SEED, 'idle', {
      reportDir,
      slug: 'forged1',
      record: async (entry) => {
        recorded.push(entry);
      },
      now: () => clock.now(),
    });
    expect(result).toMatchObject({ id: 'MenuPhase.idle', union: 'MenuPhase', member: 'idle', ok: true, provenance: 'forged', subject: null, verified: null });
    expect(recorded).toEqual([{ file: join(reportDir, 'assets/forged1/states/MenuPhase.idle.forged.json'), kind: 'log', row: 'MenuPhase.idle' }]);
    const artifact = JSON.parse(readFileSync(join(reportDir, 'assets/forged1/states/MenuPhase.idle.forged.json'), 'utf8'));
    expect(artifact).toMatchObject({ union: 'MenuPhase', member: 'idle', via: 'direct-write', provenance: 'forged' });
  });
});

describe('lw qa states infer --apply (spec 2.5, R4)', () => {
  it('records a forged ledger entry for a state no seed reaches', async () => {
    const root = await project(BASE_FILES);
    const command = createStatesCommand({ clock: fakeClock(), revision: () => ({ commit: 'abc123', dirty: false }) });
    const { out, err, opts } = io();
    expect(await command.run(['infer', '--apply', '--slug', 'forged1'], opts(root))).toBe(0);
    expect(err).toEqual([]);
    const ledger = await readLedger(join(root, 'docs/qa/assets/forged1/evidence.lock.json'));
    expect(ledger?.entries.map((e) => [e.row, e.provenance, e.kind, e.leg, e.commit])).toEqual([
      ['MenuPhase.busy', 'forged', 'log', 'desktop', 'abc123'],
      ['MenuPhase.idle', 'forged', 'log', 'desktop', 'abc123'],
    ]);
    expect(out[0]).toBe('applied 1 forged seed(s): 2 forged capture(s) -> docs/qa/assets/forged1/evidence.lock.json');
  });

  it('reads a forged run as not a live pass and marks the state forged', async () => {
    const root = await project(BASE_FILES);
    const command = createStatesCommand({ clock: fakeClock(), revision: () => ({ commit: 'abc123', dirty: false }) });
    const { opts } = io();
    expect(await command.run(['infer', '--apply', '--slug', 'forged1'], opts(root))).toBe(0);
    const ledger = await readLedger(join(root, 'docs/qa/assets/forged1/evidence.lock.json'));
    const entries = ledger?.entries ?? [];
    const manifest: Manifest = {
      title: 'forged',
      generated: '2026-01-01T00:00:00.000Z',
      spec: 'docs/specs/2026-11-21-launchwright-qa-library-design.md',
      shots: entries.map(
        (e): Shot => ({ id: e.row, screen: 'menu', state: e.row, source: ['spec:docs/specs/2026-11-21-launchwright-qa-library-design.md#R4'], legs: [e.leg], route: '/', fixture: { arm: [] }, settle: { busy: true }, expect: 'forged' }),
      ),
    };
    const passed = entries.map((e): RowResult => ({ row: e.row, leg: e.leg, status: 'passed', failures: [], attempts: 1, ms: 1 }));
    expect(computeStatus({ manifest, results: passed, entries })).toBe('partial');
    const live = entries.map((e) => ({ ...e, provenance: 'live' as const }));
    expect(computeStatus({ manifest, results: passed, entries: live })).toBe('passed');
    expect(provenanceLabel('forged')).toBe('(forged)');
  });
});
