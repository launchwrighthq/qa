import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LaunchwrightError } from '../../../src/kernel/index.mts';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { type QaConfig, qaConfig } from '../../../src/config.mts';
import type { QaTarget } from '../../../src/drivers/target/contract.mts';
import { createFakeTarget, type FakeRoute, type FakeTarget } from '../../../src/drivers/target/fake.mts';
import { assetsRel, readLedger, readResults, reportPaths } from '../../../src/services/ledger.mts';
import type { Shot } from '../../../src/services/manifest.mts';
import { type FixtureArming, type ForkRunner, planSlug, type RunnerDeps, runManifest, type SignalSource } from '../../../src/services/runner.mts';
import { createTargetRegistry } from '../../../src/services/targets.mts';
import { createFork, dropFork } from '../../../src/world/services/fork.mts';
import { pgliteAdmin } from '../../../src/world/services/stack.mts';

const SLUG = '2026-11-12-runner';

const config: QaConfig = qaConfig.parse({
  legs: {
    web: { surface: 'web', target: 'fake' },
    still: { surface: 'web', target: 'fake-still' },
    phone: { surface: 'miniapp', target: 'fake-device', device: 'pixel' },
    nowhere: { surface: 'web', target: 'missing-driver' },
  },
});

function shot(over: Partial<Shot> = {}): Shot {
  return {
    id: 'home.default',
    screen: 'home',
    state: 'default',
    source: ['spec:docs/specs/x.md#R1'],
    legs: ['web'],
    route: '/',
    fixture: { arm: [] },
    settle: { selector: '#home' },
    expect: 'the home page shows',
    ...over,
  };
}

const ROUTES: Record<string, FakeRoute> = {
  '/': { selectors: ['#home', '#go'], links: { '#go': '/next' } },
  '/next': { selectors: ['#next'] },
  '/blank': { selectors: ['#home'], blank: true },
  '/moved': { selectors: ['#home'], redirect: '/next' },
  '/errors': { selectors: ['#home'], logs: [{ kind: 'page-error', text: 'TypeError: x is undefined' }] },
  '/__states': { selectors: ['#home'] },
};

interface Setup {
  dir: string;
  plan: string;
  deps: RunnerDeps;
  lines: string[];
  targets: { fake: FakeTarget; 'fake-still': FakeTarget; 'fake-device': FakeTarget };
}

async function setup(shots: Shot[], over: Partial<RunnerDeps> = {}, extraTargets: Record<string, QaTarget> = {}): Promise<Setup> {
  const dir = await tmpDir();
  const plan = join(dir, `${SLUG}.shots.json`);
  writeFileSync(plan, JSON.stringify({ title: 'runner', generated: '2026-11-12T00:00:00Z', shots }));
  const clock = fakeClock('2026-11-12T10:00:00Z');
  const targets = {
    fake: createFakeTarget({ routes: ROUTES, clock, trace: true }),
    'fake-still': createFakeTarget({ name: 'fake-still', capabilities: ['screenshot'], routes: ROUTES, clock }),
    'fake-device': createFakeTarget({ name: 'fake-device', routes: ROUTES, clock, dump: true }),
  };
  const lines: string[] = [];
  const deps: RunnerDeps = {
    config,
    targets: createTargetRegistry(config, { ...targets, ...extraTargets }, clock),
    clock,
    baseUrls: { web: 'http://web.test', miniapp: 'http://mini.test/mini' },
    revision: { commit: 'a'.repeat(40), dirty: false },
    measure: async () => ({ durationS: 2, blackS: 0 }),
    signals: { on: () => undefined, off: () => undefined },
    out: (l) => lines.push(l),
    err: (l) => lines.push(l),
    ...over,
  };
  return { dir, plan, deps, lines, targets };
}

describe('runManifest', () => {
  it('records a screenshot, a log and a trace for a browser row and writes the ledger', async () => {
    const s = await setup([shot()]);
    const summary = await runManifest({ manifestPath: s.plan }, s.deps);
    expect(summary.exitCode).toBe(0);
    expect(summary.results).toMatchObject([{ row: 'home.default', leg: 'web', status: 'passed', failures: [], attempts: 1 }]);
    const ledger = await readLedger(reportPaths(s.dir, SLUG).ledger);
    expect(ledger?.entries.map((e) => [e.path, e.kind])).toEqual([
      [`assets/${SLUG}/web-home.default.log.jsonl`, 'log'],
      [`assets/${SLUG}/web-home.default.png`, 'screenshot'],
      [`assets/${SLUG}/web-home.default.trace.zip`, 'trace'],
    ]);
    for (const e of ledger?.entries ?? []) {
      expect(e).toMatchObject({ commit: 'a'.repeat(40), dirty: false, leg: 'web', target: 'fake', provenance: 'live', row: 'home.default', attempt: 1 });
      expect(e.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.capturedAt).toBe('2026-11-12T10:00:00.000Z');
    }
    expect(await readResults(reportPaths(s.dir, SLUG).results)).toEqual(summary.results);
  });

  it('records a step screenshot after each act and a video for a row with act', async () => {
    const s = await setup([shot({ act: [{ kind: 'click', target: '#go' }] })]);
    const summary = await runManifest({ manifestPath: s.plan }, s.deps);
    expect(summary.results[0]?.status).toBe('passed');
    const kinds = (await readLedger(reportPaths(s.dir, SLUG).ledger))?.entries.map((e) => `${e.kind} ${e.path.split('/').pop()}`);
    expect(kinds).toEqual([
      'step web-home.default.1.png',
      'log web-home.default.log.jsonl',
      'screenshot web-home.default.png',
      'trace web-home.default.trace.zip',
      'video web-home.default.webm',
    ]);
    expect(s.targets.fake.sessions[0]?.calls.slice(0, 5)).toEqual([
      `startVideo ${join(s.dir, `assets/${SLUG}/web-home.default.webm`)}`,
      'navigate /',
      'settle',
      'currentRoute',
      `screenshot ${join(s.dir, `assets/${SLUG}/web-home.default.png`)}`,
    ]);
  });

  it('labels the files of a row on the state page as mounted', async () => {
    const s = await setup([shot({ route: '/__states?c=NotesSummary&props=%7B%22state%22%3A%22one%22%7D' }), shot({ id: 'home.live' })]);
    await runManifest({ manifestPath: s.plan }, s.deps);
    const byRow = new Map((await readLedger(reportPaths(s.dir, SLUG).ledger))?.entries.map((e) => [e.row, e.provenance]));
    expect(Object.fromEntries(byRow)).toEqual({ 'home.default': 'mounted', 'home.live': 'live' });
  });

  it('fails a blank screenshot as blank', async () => {
    const s = await setup([shot({ route: '/blank' })]);
    const summary = await runManifest({ manifestPath: s.plan }, s.deps);
    expect(summary.results[0]).toMatchObject({ status: 'failed', failures: ['blank'] });
    expect(summary.exitCode).toBe(1);
  });

  it('fails a redirect away from the planned route as route-drift', async () => {
    const s = await setup([shot({ route: '/moved', settle: { selector: 'body' } })]);
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'failed', failures: ['route-drift'] });
    expect(result?.reason).toContain('left /moved for /next');
  });

  it('fails an unexpected page error and passes an expected one', async () => {
    const s = await setup([
      shot({ id: 'errors.unexpected', route: '/errors' }),
      shot({ id: 'errors.expected', route: '/errors', expect: { text: 'the error is known', pageErrors: ['x is undefined'] } }),
    ]);
    const results = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(results.map((r) => [r.row, r.status, r.failures])).toEqual([
      ['errors.unexpected', 'failed', ['page-error']],
      ['errors.expected', 'passed', []],
    ]);
    const log = readFileSync(join(s.dir, `assets/${SLUG}/web-errors.unexpected.log.jsonl`), 'utf8');
    expect(JSON.parse(log.trim())).toMatchObject({ kind: 'page-error', text: 'TypeError: x is undefined' });
  });

  it('fails a row whose settle never holds as expect and still writes its log', async () => {
    const s = await setup([shot({ settle: { selector: '#never' } })]);
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'failed', failures: ['expect'] });
    expect(result?.reason).toContain('qa.target.settle');
    const paths = (await readLedger(reportPaths(s.dir, SLUG).ledger))?.entries.map((e) => e.kind);
    expect(paths).toEqual(['log', 'trace']);
  });

  it('fails a blank video as blank-video', async () => {
    const s = await setup([shot({ video: true })], { measure: async () => ({ durationS: 0.4, blackS: 0 }) });
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'failed', failures: ['blank-video'] });
  });

  it('gives n/a with the capability name to a leg whose target lacks it', async () => {
    const s = await setup([shot({ legs: ['still'], act: [{ kind: 'click', target: '#go' }] })]);
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'n/a', reason: 'the fake-still target has no input capability', attempts: 0 });
  });

  it('passes a row with act on a target without video and names the video as n/a', async () => {
    const noVideo = createFakeTarget({ name: 'fake', capabilities: ['input', 'screenshot'], routes: ROUTES });
    const s = await setup([shot({ act: [{ kind: 'click', target: '#go' }] })], {}, { fake: noVideo });
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'passed', reason: 'video n/a: the fake target has no video capability' });
  });

  it('passes a row whose target cannot read the console and names the log as n/a', async () => {
    const base = createFakeTarget({ routes: ROUTES });
    const noConsole: QaTarget = {
      name: 'fake',
      specVersion: base.specVersion,
      capabilities: base.capabilities,
      supports: (cap) => base.supports(cap),
      ready: (leg) => base.ready(leg),
      open: async (o) => {
        const session = await base.open(o);
        session.logs = async () => {
          throw new LaunchwrightError('qa.target.capability', 'the fake target cannot read the page console');
        };
        return session;
      },
    };
    const s = await setup([shot()], {}, { fake: noConsole });
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'passed' });
    expect(result?.reason).toContain('log n/a: qa.target.capability: the fake target cannot read the page console');
  });

  it('gives n/a with "no target" to a leg whose driver is not registered', async () => {
    const s = await setup([shot({ legs: ['nowhere'] })]);
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'n/a', reason: 'no target' });
  });

  it('does not run a leg whose surface has no base URL, or a route with an unfilled handle', async () => {
    const s = await setup([shot({ legs: ['web'] }), shot({ id: 'item.held', route: '/items/{itemId}' })], { baseUrls: { miniapp: 'http://mini.test' } });
    const results = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(results.map((r) => r.status)).toEqual(['not-run', 'not-run']);
    expect(results[0]?.reason).toContain('no base URL for the web surface');
    expect(results[1]?.reason).toContain('unfilled handle {itemId}');
  });

  it('gives a device leg up to three attempts and records each one', async () => {
    const s = await setup([shot({ legs: ['phone'], route: '/blank' })]);
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'failed', attempts: 3, failures: ['blank'] });
    const entries = (await readLedger(reportPaths(s.dir, SLUG).ledger))?.entries ?? [];
    expect([...new Set(entries.map((e) => e.attempt))].sort()).toEqual([1, 2, 3]);
    expect(entries.filter((e) => e.kind === 'video').map((e) => e.path.split('/').pop())).toEqual([
      'phone-home.default.a2.mp4',
      'phone-home.default.a3.mp4',
      'phone-home.default.mp4',
    ]);
    expect(entries.filter((e) => e.kind === 'ui')).toHaveLength(3);
    expect(entries.every((e) => e.device === 'pixel' && e.target === 'fake-device')).toBe(true);
  });

  it('drops the files of an earlier run of the row and leg before a rerun', async () => {
    const s = await setup([shot({ legs: ['phone'], route: '/blank' })]);
    await runManifest({ manifestPath: s.plan }, s.deps);
    writeFileSync(s.plan, JSON.stringify({ title: 'runner', generated: '2026-11-12T00:00:00Z', shots: [shot({ legs: ['phone'] })] }));
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'passed', attempts: 1 });
    const entries = (await readLedger(reportPaths(s.dir, SLUG).ledger))?.entries ?? [];
    expect([...new Set(entries.map((e) => e.attempt))]).toEqual([1]);
    expect(existsSync(join(s.dir, assetsRel(SLUG), 'phone-home.default.a2.mp4'))).toBe(false);
  });

  it('stops the attempts of a device leg at the first clean one', async () => {
    const s = await setup([shot({ legs: ['phone'] })]);
    const [result] = (await runManifest({ manifestPath: s.plan }, s.deps)).results;
    expect(result).toMatchObject({ status: 'passed', attempts: 1 });
    expect(s.targets['fake-device'].sessions[0]?.opts.baseUrl).toBe('http://mini.test/mini');
  });

  it('opens each session with the persona of the row', async () => {
    const s = await setup([shot({ fixture: { arm: [], persona: 'member' } })]);
    await runManifest({ manifestPath: s.plan }, s.deps);
    expect(s.targets.fake.sessions[0]?.opts.persona).toBe('member');
  });

  it('arms the fixtures once before the rows and disarms them after, also when a row crashes', async () => {
    const calls: string[] = [];
    const fixtures: FixtureArming = {
      arm: async (state, o) => {
        calls.push(`arm ${state} ${o.persona ?? '-'}`);
      },
      disarm: async () => {
        calls.push('disarm');
      },
    };
    const base = createFakeTarget({ routes: ROUTES });
    const broken: QaTarget = {
      name: 'fake',
      specVersion: base.specVersion,
      capabilities: base.capabilities,
      supports: (cap) => base.supports(cap),
      ready: (leg) => base.ready(leg),
      open: async () => {
        calls.push('open');
        throw new LaunchwrightError('qa.target.launch', 'the browser did not start');
      },
    };
    const s = await setup(
      [shot({ fixture: { arm: ['expiring'], persona: 'member' } }), shot({ id: 'home.other', fixture: { arm: ['expiring'], persona: 'member' } })],
      { fixtures },
      { fake: broken },
    );
    const summary = await runManifest({ manifestPath: s.plan }, s.deps);
    expect(calls).toEqual(['arm expiring member', 'open', 'open', 'disarm']);
    expect(summary.results.map((r) => r.failures)).toEqual([['crashed'], ['crashed']]);
    expect(summary.results[0]?.reason).toContain('qa.target.launch');
  });

  it('disarms and exits 130 on SIGINT, and removes its signal handlers after the run', async () => {
    const handlers = new Map<string, () => void>();
    const signals: SignalSource = {
      on: (sig, fn) => handlers.set(sig, fn),
      off: (sig) => handlers.delete(sig),
    };
    const calls: string[] = [];
    let interrupted: Promise<void> = Promise.resolve();
    const exits: number[] = [];
    const fixtures: FixtureArming = {
      arm: async () => {
        // The run receives SIGINT while it arms.
        interrupted = new Promise<void>((resolve) => {
          calls.push('arm');
          handlers.get('SIGINT')?.();
          resolve();
        });
        await interrupted;
      },
      disarm: async () => {
        calls.push('disarm');
      },
    };
    const s = await setup([shot({ fixture: { arm: ['expiring'] } })], { fixtures, signals, exit: (code) => exits.push(code) });
    await runManifest({ manifestPath: s.plan }, s.deps);
    expect(calls).toEqual(['arm', 'disarm']);
    expect(exits).toEqual([130]);
    expect(handlers.size).toBe(0);
  });

  it('warns when rows arm states and no fixture arming is given', async () => {
    const s = await setup([shot({ fixture: { arm: ['expiring'] } })]);
    const summary = await runManifest({ manifestPath: s.plan }, s.deps);
    expect(summary.warnings).toEqual(['no fixture was armed (expiring): the world submodule gives no fixture arming']);
  });

  it('refuses --legs and --only values that the plan does not have', async () => {
    const s = await setup([shot()]);
    await expect(runManifest({ manifestPath: s.plan, legs: ['tablet'] }, s.deps)).rejects.toMatchObject({ code: 'qa.session.legs' });
    await expect(runManifest({ manifestPath: s.plan, only: ['home.none'] }, s.deps)).rejects.toMatchObject({ code: 'qa.session.only' });
    await expect(runManifest({ manifestPath: s.plan, legs: ['still'] }, s.deps)).rejects.toMatchObject({ code: 'qa.session.empty' });
  });

  it('reads the slug from the plan file name and refuses another name', () => {
    expect(planSlug('/r/docs/qa/2026-11-12-x.shots.json')).toBe('2026-11-12-x');
    expect(() => planSlug('/r/docs/qa/plan.json')).toThrow(/shots\.json/);
  });
});

describe('runManifest fork isolation (spec 2.4, R3)', () => {
  const SECTIONS = { db: { driver: 'pglite' } };
  /** The QA API of the default `qa.apiPort`. A surface on it moves to the fork server. */
  const QA_API = 'http://127.0.0.1:9101';

  /** A fixture arming that holds one open giveaway per database: a second open on one database throws. */
  function singleInstanceArming(opened: Map<string, string[]>, armedLog: string[], gate?: () => Promise<void>): (database: string) => FixtureArming {
    return (database) => ({
      arm: async (state) => {
        const open = opened.get(database) ?? [];
        if (open.includes(state)) throw new LaunchwrightError('qa.world.single-instance', `${state} is already open on ${database}`);
        open.push(state);
        opened.set(database, open);
        armedLog.push(`${database}:${state}`);
        await gate?.();
      },
      disarm: async () => {
        opened.delete(database);
      },
    });
  }

  interface ForkLog {
    created: string[];
    served: string[];
    closed: string[];
  }

  /** A fork runner on the PGlite QA database `app_qa` under `root`. Each fork server gets its own port. */
  function pgliteFork(root: string, arming: (database: string) => FixtureArming, log: ForkLog = { created: [], served: [], closed: [] }): ForkRunner {
    return {
      create: async (label) => {
        const name = await createFork({ root, sections: SECTIONS, database: 'app_qa', label, out: () => undefined });
        log.created.push(name);
        return name;
      },
      drop: (name) => dropFork({ root, sections: SECTIONS, database: 'app_qa', name, out: () => undefined }),
      serve: async (database) => {
        log.served.push(database);
        return { url: `http://127.0.0.1:${20000 + log.served.length}`, arming: arming(database), close: async () => void log.closed.push(database) };
      },
    };
  }

  /** Resolves once `n` callers wait on it, so two fork groups prove they run at the same time. */
  function barrier(n: number): () => Promise<void> {
    let waiting = 0;
    let open!: () => void;
    const all = new Promise<void>((resolve) => (open = resolve));
    return async () => {
      waiting += 1;
      if (waiting >= n) open();
      await Promise.race([all, new Promise<void>((_, reject) => setTimeout(() => reject(new Error('the other fork group never armed')), 5000))]);
    };
  }

  /** A row that runs in the fork of `label` and arms the single-instance `giveaway-open` state. */
  function row(id: string, fork: string, over: Partial<Shot> = {}): Shot {
    return { ...shot({ id, fixture: { arm: ['giveaway-open'] }, ...over }), fork } as Shot;
  }

  it('serves each fork group on its own fork server, two at a time, and drops each fork', async () => {
    const s = await setup([row('giveaway.a', 'row-a'), row('giveaway.b', 'row-b')], { baseUrls: { web: `${QA_API}/app` } });
    await pgliteAdmin(s.dir, () => true).create('app_qa');
    const armedLog: string[] = [];
    const log: ForkLog = { created: [], served: [], closed: [] };
    const fork = pgliteFork(s.dir, singleInstanceArming(new Map(), armedLog, barrier(2)), log);
    const summary = await runManifest({ manifestPath: s.plan }, { ...s.deps, fork });
    expect(summary.warnings).toEqual([]);
    expect(summary.results.map((r) => r.status)).toEqual(['passed', 'passed']);
    expect(summary.exitCode).toBe(0);
    expect(armedLog.sort()).toEqual(['app_qa_fork_row_a:giveaway-open', 'app_qa_fork_row_b:giveaway-open']);
    expect(log.closed.sort()).toEqual(['app_qa_fork_row_a', 'app_qa_fork_row_b']);
    const opened = s.targets.fake.sessions.map((x) => x.opts.baseUrl).sort();
    expect(opened).toEqual(['http://127.0.0.1:20001/app', 'http://127.0.0.1:20002/app']);
    expect(await pgliteAdmin(s.dir, () => true).list('app_qa_fork_')).toEqual([]);
    expect(await pgliteAdmin(s.dir, () => true).exists('app_qa')).toBe(true);
  });

  it('runs fork groups one after another with forkConcurrency 1', async () => {
    const s = await setup([row('giveaway.a', 'row-a'), row('giveaway.b', 'row-b')], { baseUrls: { web: QA_API }, forkConcurrency: 1 });
    await pgliteAdmin(s.dir, () => true).create('app_qa');
    const order: string[] = [];
    const fork = pgliteFork(s.dir, singleInstanceArming(new Map(), order));
    const tracked: ForkRunner = { ...fork, drop: async (name) => void (order.push(`drop ${name}`), await fork.drop(name)) };
    const summary = await runManifest({ manifestPath: s.plan }, { ...s.deps, fork: tracked });
    expect(summary.results.map((r) => r.status)).toEqual(['passed', 'passed']);
    expect(order).toEqual(['app_qa_fork_row_a:giveaway-open', 'drop app_qa_fork_row_a', 'app_qa_fork_row_b:giveaway-open', 'drop app_qa_fork_row_b']);
  });

  it('runs no row of a fork group on a surface that does not reach the QA API, and says why', async () => {
    const s = await setup([row('giveaway.phone', 'row-a', { legs: ['web', 'phone'] })], { baseUrls: { web: QA_API, miniapp: 'http://127.0.0.1:5173/mini' } });
    await pgliteAdmin(s.dir, () => true).create('app_qa');
    const fork = pgliteFork(s.dir, singleInstanceArming(new Map(), []));
    const summary = await runManifest({ manifestPath: s.plan }, { ...s.deps, fork });
    expect(summary.results.map((r) => [r.leg, r.status])).toEqual([
      ['web', 'passed'],
      ['phone', 'not-run'],
    ]);
    expect(summary.results[1]?.reason).toBe(
      'the miniapp base URL http://127.0.0.1:5173/mini is not the QA API on port 9101, so its client reads the shared QA database and cannot show fork row-a. ' +
        'Serve the miniapp surface from the QA app (qa.baseUrls.miniapp = http://127.0.0.1:9101), or run the row without a fork',
    );
    expect(s.targets['fake-device'].sessions).toEqual([]);
  });

  it('marks the rows of a fork whose QA app did not start not-run, and drops the fork', async () => {
    const s = await setup([row('giveaway.a', 'row-a')], { baseUrls: { web: QA_API } });
    await pgliteAdmin(s.dir, () => true).create('app_qa');
    const fork = pgliteFork(s.dir, singleInstanceArming(new Map(), []));
    const broken: ForkRunner = { ...fork, serve: async () => Promise.reject(new LaunchwrightError('qa.world.boot', 'the app did not boot')) };
    const summary = await runManifest({ manifestPath: s.plan }, { ...s.deps, fork: broken });
    expect(summary.results).toMatchObject([{ status: 'not-run', reason: 'the QA app did not start on fork row-a: qa.world.boot: the app did not boot' }]);
    expect(summary.exitCode).toBe(1);
    expect(await pgliteAdmin(s.dir, () => true).list('app_qa_fork_')).toEqual([]);
  });

  it('drops the fork after a group whose row fails', async () => {
    const s = await setup([row('giveaway.blank', 'row-a', { route: '/blank' })], { baseUrls: { web: QA_API } });
    await pgliteAdmin(s.dir, () => true).create('app_qa');
    const fork = pgliteFork(s.dir, singleInstanceArming(new Map(), []));
    const summary = await runManifest({ manifestPath: s.plan }, { ...s.deps, fork });
    expect(summary.results[0]).toMatchObject({ status: 'failed', failures: ['blank'] });
    expect(await pgliteAdmin(s.dir, () => true).list('app_qa_fork_')).toEqual([]);
  });

  it('runs two rows of one fork label in a single shared fork', async () => {
    const s = await setup([row('giveaway.a', 'row-one'), row('giveaway.b', 'row-one')], { baseUrls: { web: QA_API } });
    await pgliteAdmin(s.dir, () => true).create('app_qa');
    const armedLog: string[] = [];
    const log: ForkLog = { created: [], served: [], closed: [] };
    const fork = pgliteFork(s.dir, singleInstanceArming(new Map(), armedLog), log);
    const summary = await runManifest({ manifestPath: s.plan }, { ...s.deps, fork });
    expect(summary.results.map((r) => r.status)).toEqual(['passed', 'passed']);
    expect(log.created).toEqual(['app_qa_fork_row_one']);
    expect(armedLog).toEqual(['app_qa_fork_row_one:giveaway-open']);
    expect(await pgliteAdmin(s.dir, () => true).list('app_qa_fork_')).toEqual([]);
  });
});
