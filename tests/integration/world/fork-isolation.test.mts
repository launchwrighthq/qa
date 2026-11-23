// The synthetic check "Fork isolation" of spec 3.3 (R3): two rows each take the only open giveaway
// in their own fork, and both shots are correct. The QA world is the fixture app on PGlite; the
// shared QA API serves the base world; each fork group gets the QA app on its fork, and Chromium
// photographs every row.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { systemClock } from '../../../src/kernel/index.mts';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { qaConfig } from '../../../src/config.mts';
import { readLedger, reportPaths } from '../../../src/services/ledger.mts';
import { type ForkRunner, runManifest, type RunSummary } from '../../../src/services/runner.mts';
import { createTargetRegistry } from '../../../src/services/targets.mts';
import { type Listening } from '../../../src/world/services/api.mts';
import { openWorld, type QaOverlay, type QaWorld } from '../../../src/world/services/app.mts';
import { snapshotSeeded } from '../../../src/world/services/fork.mts';
import { worldForkRunner } from '../../../src/world/services/fork-server.mts';
import { pgliteAdmin, qaDbSection } from '../../../src/world/services/stack.mts';
import { useBrowserCache } from '../../support/chromium.mts';
import { fetchListen } from '../../support/fetch-listen.mts';
import { GIVEAWAYS, qaApp, registry } from '../../support/giveaway-app.mts';
import { textTarget } from '../../support/page-text.mts';

const SLUG = '2026-11-23-fork';
const SECTIONS = { db: { driver: 'pglite' as const } };
const settle = { selector: '#giveaway' };
const base = { screen: 'giveaway', source: ['spec:docs/specs/qa.md#R3'], legs: ['web'], route: '/giveaway', settle };

let root: string;
let overlay: QaOverlay;
let shared: QaWorld;
let api: Listening;
let summary: RunSummary;
let texts: Map<string, string>;
let mostForks = 0;

beforeEach(() => useBrowserCache());

beforeAll(async () => {
  useBrowserCache();
  root = await tmpDir();
  overlay = { root, database: 'app_qa', telegramUrl: 'http://127.0.0.1:9102', registryHash: 'fixture' };
  await pgliteAdmin(root, () => true).create('app_qa');
  const seeding = await openWorld(qaApp, SECTIONS, 'local', overlay);
  try {
    for (const fact of registry.facts) await fact.seed(seeding);
  } finally {
    await seeding.close();
  }
  await snapshotSeeded({ root, db: qaDbSection(SECTIONS.db, 'app_qa', root), database: 'app_qa' }, 'replace');

  // The shared QA API, as `lw qa world api` serves it, on the base world.
  shared = await openWorld(qaApp, SECTIONS, 'local', overlay);
  api = await fetchListen(qaApp.serve(shared.app), shared.app, 0);

  const config = qaConfig.parse({
    apiPort: api.port,
    baseUrls: { web: `http://127.0.0.1:${api.port}` },
    legs: { web: { surface: 'web', target: 'playwright', viewport: { width: 640, height: 360 } } },
  });
  const plan = join(root, `${SLUG}.shots.json`);
  const shots = [
    { ...base, id: 'giveaway.shared', state: 'open', fixture: { arm: [] }, expect: 'the giveaway is open on the shared world' },
    { ...base, id: 'giveaway.alice', state: 'taken', fixture: { persona: 'alice', arm: ['giveaway-taken'] }, fork: 'alice', expect: 'alice took the giveaway' },
    { ...base, id: 'giveaway.bob', state: 'taken', fixture: { persona: 'bob', arm: ['giveaway-taken'] }, fork: 'bob', expect: 'bob took the giveaway' },
  ];
  writeFileSync(plan, JSON.stringify({ title: 'fork isolation', generated: '2026-11-23T00:00:00Z', shots }));

  const forks = worldForkRunner({ root, sections: SECTIONS, env: 'local', overlay, entry: qaApp, registry, out: () => undefined, listen: fetchListen });
  // Each fork group waits after its arm until the other one armed too, so the check sees two QA
  // apps on two forks, each holding the only giveaway, at the same time. A runner that ran the
  // groups one after another would never pass the barrier.
  let live = 0;
  let armed = 0;
  let bothArmed!: () => void;
  const both = new Promise<void>((resolve) => (bothArmed = resolve));
  const counted: ForkRunner = {
    ...forks,
    create: async (label) => {
      const name = await forks.create(label);
      live += 1;
      return name;
    },
    drop: async (name) => {
      await forks.drop(name);
      live -= 1;
    },
    serve: async (database) => {
      const server = await forks.serve(database);
      return {
        ...server,
        arming: {
          async arm(state, o) {
            await server.arming.arm(state, o);
            armed += 1;
            if (armed === 2) bothArmed();
            await Promise.race([both, new Promise((_, reject) => setTimeout(() => reject(new Error('the other fork group never armed')), 20_000))]);
            mostForks = Math.max(mostForks, live);
          },
          disarm: () => server.arming.disarm(),
        },
      };
    },
  };
  const chromium = textTarget();
  texts = chromium.texts;
  summary = await runManifest(
    { manifestPath: plan },
    {
      config,
      targets: createTargetRegistry(config, { playwright: chromium.target }),
      clock: systemClock,
      baseUrls: config.baseUrls,
      revision: { commit: 'c'.repeat(40), dirty: false },
      fork: counted,
      signals: { on: () => undefined, off: () => undefined },
      out: () => undefined,
      err: () => undefined,
    },
  );
});

afterAll(async () => {
  await api?.close();
  await shared?.close();
});

const textOf = (row: string): string => texts.get(join(root, `assets/${SLUG}/web-${row}.png`)) ?? '';

describe('fork isolation (spec 3.3, R3)', () => {
  it('passes every row with no caveat', () => {
    expect(summary.warnings).toEqual([]);
    expect(summary.results.map((r) => [r.row, r.status]).sort()).toEqual([
      ['giveaway.alice', 'passed'],
      ['giveaway.bob', 'passed'],
      ['giveaway.shared', 'passed'],
    ]);
    expect(summary.exitCode).toBe(0);
  });

  it('shows each persona holding the only giveaway in its own fork', () => {
    expect(textOf('giveaway.alice')).toContain('taken by alice');
    expect(textOf('giveaway.alice')).toContain('signed in as alice');
    expect(textOf('giveaway.bob')).toContain('taken by bob');
    expect(textOf('giveaway.bob')).toContain('signed in as bob');
  });

  it('holds the two forks at the same time', () => {
    expect(mostForks).toBe(2);
  });

  it('leaves the shared QA world untouched', async () => {
    expect(textOf('giveaway.shared')).toContain('open');
    expect(await shared.app.get(GIVEAWAYS).current()).toEqual({ id: 'g1', title: 'Spring draw', takenBy: null });
  });

  it('drops each fork and its undo record after the pass, and keeps the seeded snapshot', async () => {
    expect(await pgliteAdmin(root, () => true).list('app_qa_fork_')).toEqual(['app_qa_fork__seeded']);
    expect(existsSync(join(root, '.lw/qa/fork/app_qa_fork_alice.fixture.json'))).toBe(false);
  });

  it('records a live screenshot for each row', async () => {
    const ledger = await readLedger(reportPaths(root, SLUG).ledger);
    const shots = (ledger?.entries ?? []).filter((e) => e.kind === 'screenshot');
    expect(shots.map((e) => [e.row, e.provenance]).sort()).toEqual([
      ['giveaway.alice', 'live'],
      ['giveaway.bob', 'live'],
      ['giveaway.shared', 'live'],
    ]);
  });
});
