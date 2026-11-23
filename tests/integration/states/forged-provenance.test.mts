// The synthetic check "Forged provenance" of spec 3.3 (R4): a state with no seed reaches `forged`,
// the report marks it, and excludes it from a live pass. The project has no world file. `infer
// --apply` writes a draft seed per state; a reviewer accepts one as rows (direct-write) and one as
// a module that writes through the app services (app-service). The second `infer --apply` runs each
// seed on its own fork of the QA database, and Chromium photographs the state on its route.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createStatesCommand } from '../../../src/commands/qa-states.mts';
import { qaConfig } from '../../../src/config.mts';
import { readLedger, readResults, reportPaths } from '../../../src/services/ledger.mts';
import type { Manifest, Shot } from '../../../src/services/manifest.mts';
import { computeStatus } from '../../../src/services/report.mts';
import { createTargetRegistry } from '../../../src/services/targets.mts';
import { renderViewerBundle } from '../../../src/services/viewer.mts';
import { openWorld, type QaOverlay } from '../../../src/world/services/app.mts';
import { pgliteAdmin } from '../../../src/world/services/stack.mts';
import { useBrowserCache } from '../../support/chromium.mts';
import { fetchListen } from '../../support/fetch-listen.mts';
import { MENU, qaApp } from '../../support/giveaway-app.mts';
import { textTarget } from '../../support/page-text.mts';

const APP = resolve(import.meta.dirname, '../../support/giveaway-app.mts');
const SLUG = 'forged1';
const FILES: Record<string, string> = {
  'apps/api/src/routes.mts': "export default routes((r) => r.group({ name: 'public' }, (g) => { g.page('/', 'home'); }));",
  'apps/client/src/pages/home.page.tsx': 'export default function Home() { return null; }',
  'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';",
  'qa/forge/menu-idle.mts': `import { MENU } from ${JSON.stringify(APP)};\nexport default async function seed(ctx) {\n  await ctx.app.get(MENU).set(ctx.member);\n}\n`,
};
const SECTIONS = { db: { driver: 'pglite' as const }, qa: { database: 'app_qa', app: APP } };

let root: string;
let overlay: QaOverlay;
let texts: Map<string, string>;
const first = { code: -1, out: [] as string[], err: [] as string[] };
const second = { code: -1, out: [] as string[], err: [] as string[] };

beforeEach(() => useBrowserCache());

beforeAll(async () => {
  useBrowserCache();
  root = await tmpDir();
  for (const [file, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  overlay = { root, database: 'app_qa', telegramUrl: 'http://127.0.0.1:9102', registryHash: 'fixture' };
  await pgliteAdmin(root, () => true).create('app_qa');
  await (await openWorld(qaApp, SECTIONS, 'local', overlay)).close();

  const config = qaConfig.parse(SECTIONS.qa);
  const chromium = textTarget();
  texts = chromium.texts;
  const command = createStatesCommand({
    clock: fakeClock('2026-11-23T10:00:00Z'),
    revision: () => ({ commit: 'f'.repeat(40), dirty: false }),
    targets: createTargetRegistry(config, { playwright: chromium.target }),
    listen: fetchListen,
  });
  const run = async (into: typeof first): Promise<void> => {
    into.code = await command.run(['infer', '--apply', '--slug', SLUG], { cwd: root, config: SECTIONS, out: (l) => into.out.push(l), err: (l) => into.err.push(l) });
  };

  await run(first);
  // The reviewer accepts both drafts: busy as a direct row write, idle through the menu service.
  const draft = (state: string) => join(root, `.lw/qa/forge/${state}.seed.json`);
  const busy = JSON.parse(readFileSync(draft('MenuPhase.busy'), 'utf8'));
  writeFileSync(draft('MenuPhase.busy'), JSON.stringify({ ...busy, accepted: true, route: '/menu', settle: { selector: '#menu' }, rows: [{ table: 'menu', values: { id: 1, phase: 'busy' } }] }));
  const { rows: _rows, ...idle } = JSON.parse(readFileSync(draft('MenuPhase.idle'), 'utf8'));
  writeFileSync(draft('MenuPhase.idle'), JSON.stringify({ ...idle, accepted: true, via: 'app-service', module: 'qa/forge/menu-idle.mts', route: '/menu', settle: { selector: '#menu' } }));
  await run(second);
});

const shotOf = (state: string): string => join(root, `docs/qa/assets/${SLUG}/states/${state}.forged.png`);

describe('forged provenance (spec 3.3, R4)', () => {
  it('writes a draft seed for each state no seed reaches, and forges nothing before a reviewer accepts it', () => {
    expect(first.code).toBe(0);
    expect(first.out).toEqual([
      'draft     MenuPhase.idle: wrote .lw/qa/forge/MenuPhase.idle.seed.json. Review it, then set accepted to true.',
      'draft     MenuPhase.busy: wrote .lw/qa/forge/MenuPhase.busy.seed.json. Review it, then set accepted to true.',
      'forged nothing: 2 state(s) wait for a reviewer to accept their seed.',
    ]);
  });

  it('forges each accepted seed on a fork and photographs the state on its route', () => {
    expect(second.err).toEqual([]);
    expect(second.code).toBe(0);
    expect(texts.get(shotOf('MenuPhase.busy'))).toContain('menu phase busy');
    expect(texts.get(shotOf('MenuPhase.idle'))).toContain('menu phase idle');
  });

  it('records the files and the row results with provenance forged', async () => {
    const ledger = await readLedger(reportPaths(join(root, 'docs/qa'), SLUG).ledger);
    expect((ledger?.entries ?? []).map((e) => [e.row, e.kind, e.provenance, e.leg])).toEqual([
      ['MenuPhase.busy', 'log', 'forged', 'desktop'],
      ['MenuPhase.busy', 'screenshot', 'forged', 'desktop'],
      ['MenuPhase.idle', 'log', 'forged', 'desktop'],
      ['MenuPhase.idle', 'screenshot', 'forged', 'desktop'],
    ]);
    const results = await readResults(reportPaths(join(root, 'docs/qa'), SLUG).results);
    expect(results.map((r) => [r.row, r.status, r.reason])).toEqual([
      ['MenuPhase.idle', 'passed', 'forged via app-service: the render only, never a live pass'],
      ['MenuPhase.busy', 'passed', 'forged via direct-write: the render only, never a live pass'],
    ]);
  });

  it('marks the forged states in the report and never counts them as a live pass', async () => {
    const dir = join(root, 'docs/qa');
    const entries = (await readLedger(reportPaths(dir, SLUG).ledger))?.entries ?? [];
    const results = await readResults(reportPaths(dir, SLUG).results);
    const shots = ['MenuPhase.busy', 'MenuPhase.idle'].map(
      (id): Shot => ({ id, screen: 'menu', state: id, source: ['spec:docs/specs/qa.md#R4'], legs: ['desktop'], route: '/menu', fixture: { arm: [] }, settle: { selector: '#menu' }, expect: id }),
    );
    const manifest: Manifest = { title: 'forged', generated: '2026-11-23T00:00:00Z', shots };
    expect(computeStatus({ manifest, results, entries })).toBe('partial');
    expect(computeStatus({ manifest, results, entries: entries.map((e) => ({ ...e, provenance: 'live' as const })) })).toBe('passed');
    const pages = renderViewerBundle({ title: 'forged', date: '2026-11-23', status: 'partial', manifest, results, entries }).pages;
    expect([...pages.values()].join('\n')).toContain('Provenance: forged. A forged state never counts as a live pass.');
  });

  it('leaves the shared QA world untouched and drops each fork', async () => {
    const world = await openWorld(qaApp, SECTIONS, 'local', overlay);
    try {
      expect(await world.app.get(MENU).get()).toBeNull();
    } finally {
      await world.close();
    }
    expect(await pgliteAdmin(root, () => true).list('app_qa_fork_')).toEqual([]);
  });
});
