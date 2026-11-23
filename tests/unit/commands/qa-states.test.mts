import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { createStatesCommand } from '../../../src/commands/qa-states.mts';
import { FakeRoutablePage, registryOf, ScriptedSession, scriptedTarget } from '../../support/states-fakes.mts';

async function project(files: Record<string, string>): Promise<string> {
  const root = await tmpDir();
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const BASE_FILES = {
  'apps/api/src/routes.mts': "export default routes((r) => r.group({ name: 'public' }, (g) => { g.page('/', 'home'); g.page('/invites', 'invites'); }));",
  'apps/client/src/pages/home.page.tsx': 'export default function Home() { return null; }',
  'apps/client/src/pages/invites.page.tsx': "import { inviteState } from '../invite';\nexport default function Invites() { return null; }",
  'apps/client/src/invite.ts':
    "export interface Invite { closed: boolean; name: string }\nexport type InviteState = 'open' | 'closed';\nexport function inviteState(invite: Invite): InviteState { return invite.closed ? 'closed' : 'open'; }",
  'apps/client/src/tile.tsx': "export type TileState = 'on' | 'off';\nexport interface TileProps { state: TileState }\nexport const Tile = (p: TileProps) => null;",
};

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: (cwd: string) => ({ cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config: {} }) };
}

describe('lw qa states', () => {
  it('prints the usage and exits 2 without a known action', async () => {
    const { err, opts } = io();
    expect(await createStatesCommand().run(['nope'], opts('/'))).toBe(2);
    expect(err[0]).toBe('usage: lw qa states <scan|plan|infer|forge|run|report> [options]');
  });

  it('scan writes the inventory with kinds, components and routes, and exits 0 when every union has a trigger', async () => {
    const root = await project(BASE_FILES);
    const { out, err, opts } = io();
    expect(await createStatesCommand({ clock: fakeClock() }).run(['scan'], opts(root))).toBe(0);
    expect(err).toEqual([]);
    expect(out[0]).toBe('2 unions, 4 states (1 input, 1 output), 0 ignored -> .lw/qa/states.json');
    const written = JSON.parse(readFileSync(join(root, '.lw/qa/states.json'), 'utf8'));
    expect(written.generated).toBe('2026-01-01T00:00:00.000Z');
    expect(written.unions.map((u: { name: string; kind: string }) => [u.name, u.kind])).toEqual([
      ['InviteState', 'output'],
      ['TileState', 'input'],
    ]);
    expect(written.unions[1].components).toEqual(['Tile']);
    expect(written.unions[0].routes.map((r: { route: string }) => r.route)).toEqual(['/invites']);
    expect(written.tables[0]).toMatchObject({ file: 'apps/api/src/routes.mts', found: true, rows: 2 });
  });

  it('scan fails a neither union, writes the inventory anyway, and prints its issue', async () => {
    const root = await project({ ...BASE_FILES, 'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';" });
    const { err, opts } = io();
    expect(await createStatesCommand({ clock: fakeClock() }).run(['scan'], opts(root))).toBe(1);
    expect(existsSync(join(root, '.lw/qa/states.json'))).toBe(true);
    expect(err[0]).toContain('C1 apps/client/src/menu.ts:1 MenuPhase is neither an input nor an output');
    expect(err.join('\n')).toContain('qa states: `MenuPhase` is neither an input nor an output');
  });

  it('plan prints the captures per mechanism and exits 1 on a neither union', async () => {
    const root = await project({ ...BASE_FILES, 'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';" });
    const { out, opts } = io();
    expect(await createStatesCommand({ clock: fakeClock() }).run(['plan'], opts(root))).toBe(1);
    expect(out).toContain('captures   6 (mount 2, solve 2, none 2)');
  });

  it('infer proposes a forged seed for a state no seed and no route reaches', async () => {
    const root = await project({ ...BASE_FILES, 'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';" });
    const { out, opts } = io();
    expect(await createStatesCommand({ clock: fakeClock() }).run(['infer', '--json'], opts(root))).toBe(0);
    expect(JSON.parse(out.join('\n'))).toEqual([
      { union: 'MenuPhase', file: 'apps/client/src/menu.ts', members: ['idle', 'busy'], fields: [], via: 'direct-write', provenance: 'forged', reason: 'nothing takes it and nothing returns it' },
    ]);
  });

  it('infer prints the direct-write fallback for a human reader', async () => {
    const root = await project({ ...BASE_FILES, 'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';" });
    const { out, opts } = io();
    expect(await createStatesCommand({ clock: fakeClock() }).run(['infer'], opts(root))).toBe(0);
    expect(out[0]).toBe('1 state(s) no seed and no route reaches. Each one earns a forged seed:');
    expect(out.join('\n')).toContain('MenuPhase (apps/client/src/menu.ts): members idle, busy.');
    expect(out.join('\n')).toContain('seed via direct-write, provenance forged');
  });

  it('infer reports nothing to propose when every state has a trigger', async () => {
    const root = await project(BASE_FILES);
    const { out, opts } = io();
    expect(await createStatesCommand({ clock: fakeClock() }).run(['infer'], opts(root))).toBe(0);
    expect(out[0]).toBe('no declared state needs a forged seed: every state has a seed or a route.');
  });

  it('run mounts the inputs, intercepts the outputs, writes the ledger, and report reads the run back', async () => {
    const root = await project({
      ...BASE_FILES,
      '.lw/qa/delivery.json': JSON.stringify({ InviteState: { route: '/invites', intercept: { url: '**/api/invites*', container: 'items' }, settle: { selector: 'li' } } }),
    });
    const page = new FakeRoutablePage(
      { url: '**/api/invites*', body: { items: [{ closed: false, name: 'Ada' }] } },
      (row) => (row.closed === true ? 'closed' : 'open'),
      root,
    );
    const session = new ScriptedSession({ page, site: { '/__states': { harness: { harness: true, error: null, roots: 1 } } } });
    const target = scriptedTarget(session);
    const command = createStatesCommand({ clock: fakeClock(), targets: registryOf({ playwright: target }), revision: () => ({ commit: 'abc123', dirty: false }) });
    const { out, err, opts } = io();
    const code = await command.run(['run', '--base', 'http://127.0.0.1:5173', '--slug', 'run1'], opts(root));
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(target.opened[0]).toMatchObject({ baseUrl: 'http://127.0.0.1:5173', leg: { name: 'desktop' } });
    expect(out.join('\n')).toContain('### Tile: TileState, 2 of 2 renderings');
    expect(out.join('\n')).toContain('### inviteState: InviteState, 2 of 2 renderings');
    expect(out.at(-1)).toBe('every planned rendering was captured.');
    const ledger = JSON.parse(readFileSync(join(root, 'docs/qa/assets/run1/evidence.lock.json'), 'utf8'));
    expect(ledger.entries.map((e: { path: string; provenance: string; leg: string; commit: string }) => [e.path, e.provenance, e.leg, e.commit])).toEqual([
      ['assets/run1/states/InviteState.closed.context.png', 'intercepted', 'desktop', 'abc123'],
      ['assets/run1/states/InviteState.closed.subject.png', 'intercepted', 'desktop', 'abc123'],
      ['assets/run1/states/InviteState.open.context.png', 'intercepted', 'desktop', 'abc123'],
      ['assets/run1/states/InviteState.open.subject.png', 'intercepted', 'desktop', 'abc123'],
      ['assets/run1/states/TileState.off.subject.png', 'mounted', 'desktop', 'abc123'],
      ['assets/run1/states/TileState.on.subject.png', 'mounted', 'desktop', 'abc123'],
    ]);
    expect(session.calls.at(-1)).toBe('close');

    const again = io();
    expect(await command.run(['report', '--slug', 'run1'], again.opts(root))).toBe(0);
    expect(again.out.join('\n')).toContain('2 union(s), 4 of 4 renderings.');
  });

  it('run reports the solve mechanism as not run without a routable page, and a blocked union without a descriptor', async () => {
    const root = await project(BASE_FILES);
    const session = new ScriptedSession({ site: { '/__states': { harness: { harness: true, error: null, roots: 1 } } } });
    const command = createStatesCommand({ clock: fakeClock(), targets: registryOf({ playwright: scriptedTarget(session) }), revision: () => ({ commit: 'c', dirty: true }) });
    const { out, opts } = io();
    expect(await command.run(['run', '--base', 'http://127.0.0.1:5173'], opts(root))).toBe(1);
    expect(out.join('\n')).toContain('InviteState.open: no capture group could be built. Missing: route, intercept.url, intercept.container, settle.');
  });

  it('run marks every capture not run when the target is not ready, and needs --base', async () => {
    const root = await project(BASE_FILES);
    const command = createStatesCommand({ clock: fakeClock(), targets: registryOf({ playwright: scriptedTarget(new ScriptedSession(), { ready: false }) }), revision: () => ({ commit: 'c', dirty: false }) });
    const { out, opts } = io();
    expect(await command.run(['run', '--base', 'http://x'], opts(root))).toBe(1);
    expect(out.join('\n')).toContain('Mechanism `mount` did not run: the target playwright of leg desktop is not ready: scripted as not ready.');
    const usage = io();
    expect(await command.run(['run'], usage.opts(root))).toBe(2);
    expect(usage.err[0]).toContain('run needs --base <url>');
  });

  it('report refuses a slug that never ran', async () => {
    const root = await project(BASE_FILES);
    const { err, opts } = io();
    expect(await createStatesCommand().run(['report', '--slug', 'none'], opts(root))).toBe(1);
    expect(err[0]).toContain('qa.states.no-run');
  });
});
