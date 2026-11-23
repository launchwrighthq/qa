import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fakeClock, tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { createStatesCommand } from '../../../../src/commands/qa-states.mts';
import { acceptedSeed, draftSeed, readSeed, rowStatements, seedFile } from '../../../../src/states/services/forge-seed.mts';
import type { SeedProposal } from '../../../../src/states/services/inventory.mts';

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

const command = () => createStatesCommand({ clock: fakeClock(), revision: () => ({ commit: 'abc123', dirty: false }) });

describe('forge seeds (spec 2.5, R4)', () => {
  it('drafts a seed that cannot run until a reviewer accepts it', () => {
    const draft = draftSeed(MENU_SEED, 'busy');
    expect(draft).toMatchObject({ state: 'MenuPhase.busy', accepted: false, via: 'direct-write', route: null, rows: [] });
    expect(acceptedSeed(draft)).toBe('it is a draft: a reviewer sets accepted to true');
    expect(acceptedSeed({ ...draft, accepted: true })).toBe('it names no route');
    expect(acceptedSeed({ ...draft, accepted: true, route: '/menu' })).toBe('via direct-write needs rows');
    expect(acceptedSeed({ ...draft, accepted: true, route: '/menu', via: 'app-service' })).toBe('via app-service needs a module');
    expect(acceptedSeed({ ...draft, accepted: true, route: '/menu', rows: [{ table: 'menu', values: { id: 1 } }] })).toMatchObject({ state: 'MenuPhase.busy' });
  });

  it('builds one insert per row with quoted names and literals', () => {
    const rows = [{ table: 'app.menu', values: { id: 1, phase: "it's busy", tenant_id: '{tenantId}', on: true, note: null } }];
    expect(rowStatements(rows, 't1')).toEqual([`insert into "app"."menu" ("id", "phase", "tenant_id", "on", "note") values (1, 'it''s busy', 't1', true, null)`]);
  });

  it('refuses a seed file whose table is not a plain name', async () => {
    const root = await tmpDir();
    const path = join(root, 'seed.json');
    writeFileSync(path, JSON.stringify({ ...draftSeed(MENU_SEED, 'busy'), rows: [{ table: 'menu; drop table x', values: { id: 1 } }] }));
    expect(() => readSeed(path)).toThrow(/rows\.0\.table/);
  });

  it('refuses a state id that is not <union>.<member>', () => {
    expect(seedFile('MenuPhase.busy')).toBe('.lw/qa/forge/MenuPhase.busy.seed.json');
    expect(() => seedFile('../x')).toThrow(/not a state id/);
  });
});

describe('lw qa states infer --apply (spec 2.5, R4)', () => {
  it('writes a draft seed for each state no seed reaches, and forges none of them', async () => {
    const root = await project(BASE_FILES);
    const { out, err, opts } = io();
    expect(await command().run(['infer', '--apply', '--slug', 'forged1'], opts(root))).toBe(0);
    expect(err).toEqual([]);
    expect(out).toEqual([
      'draft     MenuPhase.idle: wrote .lw/qa/forge/MenuPhase.idle.seed.json. Review it, then set accepted to true.',
      'draft     MenuPhase.busy: wrote .lw/qa/forge/MenuPhase.busy.seed.json. Review it, then set accepted to true.',
      'forged nothing: 2 state(s) wait for a reviewer to accept their seed.',
    ]);
    expect(readSeed(join(root, seedFile('MenuPhase.busy')))).toMatchObject({ accepted: false, via: 'direct-write', reason: 'nothing takes it and nothing returns it' });
    expect(existsSync(join(root, 'docs/qa/assets/forged1/evidence.lock.json'))).toBe(false);
  });

  it('keeps a draft the reviewer edited and reports it as waiting', async () => {
    const root = await project(BASE_FILES);
    const { opts } = io();
    await command().run(['infer', '--apply'], opts(root));
    const path = join(root, seedFile('MenuPhase.idle'));
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), route: '/menu' }));
    const again = io();
    expect(await command().run(['infer', '--apply'], again.opts(root))).toBe(0);
    expect(again.out).toEqual([
      'waiting   MenuPhase.idle: it is a draft: a reviewer sets accepted to true (.lw/qa/forge/MenuPhase.idle.seed.json)',
      'waiting   MenuPhase.busy: it is a draft: a reviewer sets accepted to true (.lw/qa/forge/MenuPhase.busy.seed.json)',
      'forged nothing: 2 state(s) wait for a reviewer to accept their seed.',
    ]);
    expect(readSeed(path).route).toBe('/menu');
  });
});

describe('lw qa states forge (spec 2.5, R4)', () => {
  it('refuses a draft seed and forges nothing', async () => {
    const root = await project(BASE_FILES);
    await command().run(['infer', '--apply'], io().opts(root));
    const { err, opts } = io();
    expect(await command().run(['forge', 'MenuPhase.busy'], opts(root))).toBe(1);
    expect(err).toEqual(['MenuPhase.busy is not forged: it is a draft: a reviewer sets accepted to true (.lw/qa/forge/MenuPhase.busy.seed.json)']);
  });

  it('names the missing seed file and the command that writes its draft', async () => {
    const root = await project(BASE_FILES);
    const { err, opts } = io();
    expect(await command().run(['forge', 'MenuPhase.busy'], opts(root))).toBe(1);
    expect(err).toEqual(['lw qa states forge: qa.forge.seed: .lw/qa/forge/MenuPhase.busy.seed.json does not exist. Run lw qa states infer --apply to write its draft.']);
  });
});
