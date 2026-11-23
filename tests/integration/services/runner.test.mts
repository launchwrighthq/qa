// The runner on a real Chromium against the loopback contract site: every evidence item of spec
// 2.11.1 for a browser row, measured by the real ffprobe and ffmpeg.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { systemClock } from '../../../src/kernel/index.mts';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { qaConfig } from '../../../src/config.mts';
import { createPlaywrightTarget } from '../../../src/drivers/target/playwright.mts';
import { readLedger, reportPaths } from '../../../src/services/ledger.mts';
import { pngSize } from '../../../src/services/png.mts';
import { runManifest } from '../../../src/services/runner.mts';
import { createTargetRegistry } from '../../../src/services/targets.mts';
import { systemVideoTools } from '../../../src/services/video.mts';
import { type ContractSite, serveContractSite } from '../../../src/testing/target-contract.mts';
import { headlessShell, useBrowserCache } from '../../support/chromium.mts';

const SLUG = '2026-11-12-site';
const config = qaConfig.parse({ legs: { web: { surface: 'web', target: 'playwright', viewport: { width: 640, height: 480 } } } });
let site: ContractSite;

beforeAll(async () => {
  site = await serveContractSite();
});
afterAll(async () => {
  await site.close();
});
beforeEach(() => useBrowserCache());

async function run(shots: unknown[]) {
  const dir = await tmpDir();
  const plan = join(dir, `${SLUG}.shots.json`);
  writeFileSync(plan, JSON.stringify({ title: 'site', generated: '2026-11-12T00:00:00Z', shots }));
  const summary = await runManifest(
    { manifestPath: plan },
    {
      config,
      targets: createTargetRegistry(config, { playwright: createPlaywrightTarget({ executablePath: headlessShell() }) }),
      clock: systemClock,
      baseUrls: { web: site.baseUrl },
      revision: { commit: 'c'.repeat(40), dirty: false },
      videoTools: systemVideoTools(),
      signals: { on: () => undefined, off: () => undefined },
      out: () => undefined,
      err: () => undefined,
    },
  );
  return { dir, summary, ledger: await readLedger(reportPaths(dir, SLUG).ledger) };
}

const base = { screen: 'home', state: 'default', source: ['commit:abcdef1'], legs: ['web'], fixture: { arm: [] }, expect: 'the page shows' };

describe('runManifest on the playwright target', () => {
  it('records the screenshot, the step screenshot, the video, the trace and the log of a row with act', async () => {
    const { dir, summary, ledger } = await run([
      { ...base, id: 'home.next', route: '/', settle: { selector: '#home' }, act: [{ kind: 'click', target: 'role=link[name="Next"]' }] },
    ]);
    expect(summary.results).toMatchObject([{ row: 'home.next', leg: 'web', status: 'passed', failures: [], attempts: 1 }]);
    expect(ledger?.entries.map((e) => e.kind).sort()).toEqual(['log', 'screenshot', 'step', 'trace', 'video']);
    const shot = readFileSync(join(dir, `assets/${SLUG}/web-home.next.png`));
    expect(pngSize(shot)).toEqual({ width: 640, height: 480 });
    expect(readFileSync(join(dir, `assets/${SLUG}/web-home.next.trace.zip`)).subarray(0, 2).toString()).toBe('PK');
  });

  it('fails a row on a page error it does not expect and keeps the error in the log', async () => {
    const { dir, summary } = await run([{ ...base, id: 'errors.page', route: '/errors', settle: { selector: '#done' } }]);
    expect(summary.results[0]).toMatchObject({ status: 'failed', failures: ['page-error'] });
    const kinds = readFileSync(join(dir, `assets/${SLUG}/web-errors.page.log.jsonl`), 'utf8')
      .trim()
      .split('\n')
      .map((l) => (JSON.parse(l) as { kind: string }).kind);
    expect([...new Set(kinds)].sort()).toEqual(['console-error', 'page-error', 'response-5xx']);
  });

  it('fails a redirected row as route-drift', async () => {
    const { summary } = await run([{ ...base, id: 'redirect.away', route: '/redirect', settle: { selector: '#next' } }]);
    expect(summary.results[0]).toMatchObject({ status: 'failed', failures: ['route-drift'] });
  });
});
