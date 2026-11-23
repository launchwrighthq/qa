import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { createPathsCommand } from '../../../src/commands/qa-paths.mts';
import { registryOf, ScriptedSession, scriptedTarget } from '../../support/states-fakes.mts';

async function project(files: Record<string, string>): Promise<string> {
  const root = await tmpDir();
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const FILES = {
  'apps/api/src/routes.mts': "export default routes((r) => r.group({ name: 'public' }, (g) => { g.page('/', 'home'); g.page('/invites', 'invites'); }));",
  'apps/client/src/pages/home.page.tsx': 'export default function Home() { return null; }',
  'apps/client/src/pages/invites.page.tsx': "import { inviteState } from '../invite';\nexport default function Invites() { return null; }",
  'apps/client/src/invite.ts': "export type InviteState = 'open' | 'closed';\nexport function inviteState(i: { closed: boolean }): InviteState { return i.closed ? 'closed' : 'open'; }",
};

const SITE = {
  '/': { controls: [{ label: 'Invites', role: 'link', to: '/invites' }] },
  '/invites': { controls: [] },
};

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: (cwd: string) => ({ cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config: {} }) };
}

describe('lw qa paths', () => {
  it('plan writes a plan per leg from the delivery scan and leaves out a default leg without targets', async () => {
    const root = await project(FILES);
    const { out, opts } = io();
    expect(await createPathsCommand({ clock: fakeClock() }).run(['plan'], opts(root))).toBe(0);
    expect(out).toEqual([`leg desktop: 1 target route(s) -> ${join(root, '.lw/qa/paths/paths/plan.desktop.json')}`]);
    const plan = JSON.parse(readFileSync(join(root, '.lw/qa/paths/paths/plan.desktop.json'), 'utf8'));
    expect(plan).toMatchObject({ leg: 'desktop', surface: 'web', root: '/', maxDepth: 3, maxEdges: 12 });
    expect(plan.targets.map((t: { route: string }) => t.route)).toEqual(['/invites']);
  });

  it('plan refuses a named leg whose surface has no route table', async () => {
    const root = await project(FILES);
    const { err, opts } = io();
    expect(await createPathsCommand({ clock: fakeClock() }).run(['plan', '--legs', 'miniapp'], opts(root))).toBe(1);
    expect(err[0]).toContain('qa.paths.no-targets');
  });

  it('crawl, record and report: a live recording in the ledger and every union reachable', async () => {
    const root = await project(FILES);
    const clock = fakeClock();
    const session = new ScriptedSession({ site: SITE, clock, clickMs: 1000 });
    const command = createPathsCommand({ clock, targets: registryOf({ playwright: scriptedTarget(session) }), revision: () => ({ commit: 'abc', dirty: false }) });

    const crawled = io();
    expect(await command.run(['crawl', '--base', 'http://127.0.0.1:5173'], crawled.opts(root))).toBe(0);
    expect(crawled.out).toContain('  / -> "Invites" -> /invites');

    const recorded = io();
    expect(await command.run(['record', '--base', 'http://127.0.0.1:5173'], recorded.opts(root))).toBe(0);
    const video = join(root, 'docs/qa/assets/paths/paths/desktop.root.invites.desktop.webm');
    expect(recorded.out).toEqual([`desktop desktop.root.invites: ${video}`]);
    expect(existsSync(video)).toBe(true);
    const ledger = JSON.parse(readFileSync(join(root, 'docs/qa/assets/paths/evidence.lock.json'), 'utf8'));
    expect(ledger.entries).toMatchObject([{ path: 'assets/paths/paths/desktop.root.invites.desktop.webm', kind: 'video', provenance: 'live', leg: 'desktop', row: 'desktop.root.invites' }]);

    const reported = io();
    expect(await command.run(['report'], reported.opts(root))).toBe(0);
    const text = reported.out.join('\n');
    expect(text).toContain('1 path(s), 1 of 1 target routes reached');
    expect(text).toContain('| InviteState | yes |');
    expect(text).toContain('provenance live');
  });

  it('crawl fails a route the delivery scan does not name', async () => {
    const root = await project(FILES);
    const session = new ScriptedSession({ site: { '/': { controls: [{ label: 'Elsewhere', role: 'link', to: '/elsewhere' }] } } });
    const { err, opts } = io();
    const code = await createPathsCommand({ clock: fakeClock(), targets: registryOf({ playwright: scriptedTarget(session) }), revision: () => ({ commit: 'c', dirty: false }) }).run(
      ['crawl', '--base', 'http://x'],
      opts(root),
    );
    expect(code).toBe(1);
    expect(err).toEqual(['leg desktop: route-drift, 1 route(s) the delivery scan does not name:', '  desktop.root.elsewhere -> /elsewhere']);
  });

  it('record marks a target without video n/a, and refuses before any crawl', async () => {
    const root = await project(FILES);
    const session = new ScriptedSession({ site: SITE });
    const command = createPathsCommand({ clock: fakeClock(), targets: registryOf({ playwright: scriptedTarget(session, { capabilities: ['input', 'screenshot'] }) }), revision: () => ({ commit: 'c', dirty: false }) });
    const none = io();
    expect(await command.run(['record', '--base', 'http://x'], none.opts(root))).toBe(1);
    expect(none.err[0]).toContain('qa.paths.no-paths');
    await command.run(['crawl', '--base', 'http://x'], io().opts(root));
    const na = io();
    expect(await command.run(['record', '--base', 'http://x'], na.opts(root))).toBe(0);
    expect(na.out).toEqual(['desktop desktop.root.invites: n/a (video): the target playwright cannot record video']);
  });
});
