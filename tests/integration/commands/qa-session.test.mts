import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { beforeAll, describe, expect, it } from 'vitest';
import type { QaCommandOptions } from '../../../src/commands/qa.command.mts';
import session from '../../../src/commands/qa-session.mts';
import { computeManifest, manifestHash } from '../../../src/services/contract.mts';
import { readLedger, readResults } from '../../../src/services/ledger.mts';
import type { Leg } from '../../../src/services/types.mts';
import { commit, initRepo } from '../../support/git-repo.mts';

let repo: string;
let head: string;
const config = { qa: { legs: { web: { surface: 'web', target: 'fake' } }, baseUrls: { web: 'http://web.test' } } };

const plan = {
  title: 'Home',
  generated: '2026-11-12T00:00:00Z',
  shots: [
    { id: 'home.default', screen: 'home', state: 'default', source: ['commit:abcdef1'], legs: ['web'], route: '/', fixture: { arm: [] }, settle: { selector: 'body' }, expect: 'the page shows' },
  ],
};

function cli(over: Partial<QaCommandOptions> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: { cwd: repo, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config, ...over } };
}

beforeAll(async () => {
  repo = await tmpDir();
  initRepo(repo);
  head = commit(repo, { 'docs/qa/2026-11-12-home.shots.json': JSON.stringify(plan) }, 'docs: plan', '2026-11-12T08:00:00Z');
  // An untracked file makes the checkout dirty before any run, whatever the test order.
  writeFileSync(join(repo, 'notes.txt'), 'local');
});

describe('lw qa session', () => {
  it('check prints the rows and legs of a valid plan', async () => {
    const c = cli();
    expect(await session.run(['check', 'docs/qa/2026-11-12-home.shots.json'], c.opts)).toBe(0);
    expect(c.out).toEqual(['ok  docs/qa/2026-11-12-home.shots.json: 1 row(s), legs web']);
  });

  it('check lists every problem of an invalid plan and exits 1', async () => {
    writeFileSync(join(repo, 'bad.shots.json'), JSON.stringify({ title: 'x', generated: 'x', shots: [{ id: 'Bad' }] }));
    const c = cli();
    expect(await session.run(['check', 'bad.shots.json'], c.opts)).toBe(1);
    expect(c.err.length).toBeGreaterThan(3);
  });

  it('run records the evidence with the commit of the checkout and exits 0', async () => {
    const c = cli();
    expect(await session.run(['run', 'docs/qa/2026-11-12-home.shots.json'], c.opts)).toBe(0);
    const assets = join(repo, 'docs/qa/assets/2026-11-12-home');
    const ledger = await readLedger(join(assets, 'evidence.lock.json'));
    expect(ledger?.entries.map((e) => [e.path, e.commit, e.dirty])).toEqual([
      ['assets/2026-11-12-home/web-home.default.log.jsonl', head, true],
      ['assets/2026-11-12-home/web-home.default.png', head, true],
    ]);
    expect((await readResults(join(assets, 'results.jsonl'))).at(-1)).toMatchObject({ row: 'home.default', leg: 'web', status: 'passed' });
    expect(c.out.at(-1)).toContain('1 passed, 0 failed');
  });

  it('run with --base overrides the configured surface origin', async () => {
    const c = cli({ config: { qa: { legs: config.qa.legs } } });
    // Every pair is not-run, so the run proves nothing and exits 1.
    expect(await session.run(['run', 'docs/qa/2026-11-12-home.shots.json', '--base', 'miniapp=http://mini.test'], c.opts)).toBe(1);
    expect(c.out.some((l) => l.includes('no base URL for the web surface'))).toBe(true);
    expect(c.err).toContain('no row and leg pair ran: 1 not run. The run proves nothing, so it exits 1.');
    const ok = cli({ config: { qa: { legs: config.qa.legs } } });
    expect(await session.run(['run', 'docs/qa/2026-11-12-home.shots.json', '--base', 'http://web.test', '--legs', 'web'], ok.opts)).toBe(0);
    expect(ok.out.at(-1)).toContain('1 passed');
  });

  it('resolve --issue prints one row seed per issue', async () => {
    const dir = join(repo, '.lw/qa/intake/github-o-r-7');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'issue.json'),
      JSON.stringify({ id: 'github-o-r-7', source: 'github', ref: 'https://github.test/o/r/issues/7', title: 'Blank page', reportedAt: '2026-11-11T00:00:00Z', reporter: 'r', text: 'Blank on desktop Chrome', thread: [], attachments: [], skipped: [] }),
    );
    const c = cli();
    expect(await session.run(['resolve', '--issue', 'github-o-r-7'], c.opts)).toBe(0);
    const out = JSON.parse(c.out.join('\n')) as { issues: Array<{ source: string; legs: Array<{ leg: string }> }> };
    expect(out.issues).toMatchObject([{ source: 'issue:github-o-r-7', legs: [{ leg: 'desktop', words: ['desktop', 'chrome'] }] }]);
  });

  it('refuses an unknown flag of resolve with kernel.usage and exit 2', async () => {
    const c = cli();
    expect(await session.run(['resolve', '--issues', 'github-o-r-7'], c.opts)).toBe(2);
    expect(c.err[0]).toContain('kernel.usage');
    expect(c.out).toEqual([]);
  });

  it('prints the usage and exits 2 for an unknown action', async () => {
    const c = cli();
    expect(await session.run(['replay'], c.opts)).toBe(2);
    expect(c.err[0]).toContain('usage: lw qa session resolve');
    expect(readFileSync(join(repo, 'docs/qa/2026-11-12-home.shots.json'), 'utf8')).toContain('home.default');
  });
});

const deviceConfig = { qa: { legs: { 'telegram-android': { surface: 'miniapp', target: 'android-adb' } }, baseUrls: {} } };
const androidLeg: Leg = { name: 'telegram-android', surface: 'miniapp', target: 'android-adb' };

/** Writes a plan whose one row runs on the device leg, so the manifest carries a rig item. */
function devicePlan(name: string, title: string): string {
  const path = `docs/qa/${name}.shots.json`;
  writeFileSync(
    join(repo, path),
    JSON.stringify({
      title,
      generated: '2026-11-21T00:00:00Z',
      shots: [{ id: 'home.device', screen: 'home', state: 'device', source: ['commit:abcdef1'], legs: ['telegram-android'], route: '/', fixture: { arm: [] }, settle: { selector: 'body' }, expect: 'the device page shows' }],
    }),
  );
  return path;
}

describe('lw qa session run contract (spec 2.6, R5)', () => {
  it('prints the manifest and records a grant on allow all', async () => {
    const path = devicePlan('contract-grant', 'Device grant');
    const c = cli({ config: deviceConfig });
    expect(await session.run(['run', path, '--allow-all'], c.opts)).toBe(0);
    expect(c.out).toContain('run contract for "Device grant": 1 item(s) need consent');
    expect(c.out.some((l) => l.includes('An Android device over adb'))).toBe(true);
    expect(c.out.some((l) => l.includes('allow all recorded 1 grant(s)'))).toBe(true);
    const hash = manifestHash(computeManifest({ title: 'Device grant', legs: [androidLeg] }));
    expect(existsSync(join(repo, '.lw/qa/consent', `${hash}.json`))).toBe(true);
  });

  it('asks nothing on a rerun with the same manifest', async () => {
    const path = devicePlan('contract-rerun', 'Device rerun');
    const first = cli({ config: deviceConfig });
    expect(await session.run(['run', path, '--allow-all'], first.opts)).toBe(0);
    const again = cli({ config: deviceConfig });
    expect(await session.run(['run', path], again.opts)).toBe(0);
    expect(again.out).toContain('run contract: every item is granted; asking nothing');
    expect(again.err.every((l) => !l.includes('need a grant'))).toBe(true);
  });

  it('refuses a new need without allow all and exits 2', async () => {
    const path = devicePlan('contract-refuse', 'Device refuse');
    const c = cli({ config: deviceConfig });
    expect(await session.run(['run', path], c.opts)).toBe(2);
    expect(c.err.some((l) => l.includes('need a grant'))).toBe(true);
    expect(c.err.some((l) => l.includes('An Android device over adb'))).toBe(true);
  });
});
