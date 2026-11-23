import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import type { Manifest, Shot } from '../../../src/services/manifest.mts';
import type { LedgerEntry, RowResult } from '../../../src/services/types.mts';
import { makeComment } from '../../../src/services/comments.mts';
import { DEFAULT_GAUGE_COLOR } from '../../../src/services/score.mts';
import { buildViewer, renderViewerBundle, type ViewerInput } from '../../../src/services/viewer.mts';
import { writeReportFixture } from '../../../src/testing/report-fixture.mts';

const SLUG = '2026-01-01-sample';

function makeShot(overrides: Partial<Shot> & Pick<Shot, 'id' | 'screen' | 'state' | 'legs'>): Shot {
  return {
    source: ['commit:abc1234'],
    route: `/${overrides.screen}`,
    fixture: { arm: [] },
    settle: { busy: true },
    expect: `${overrides.screen} shows ${overrides.state}`,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<LedgerEntry> & Pick<LedgerEntry, 'path' | 'kind' | 'leg' | 'row'>): LedgerEntry {
  return {
    sha256: '0'.repeat(64),
    bytes: 100,
    capturedAt: '2026-01-01T00:00:00.000Z',
    commit: 'abc1234',
    dirty: false,
    target: 'playwright',
    provenance: 'live',
    attempt: 1,
    ...overrides,
  };
}

function makeResult(row: string, leg: string, over: Partial<RowResult> = {}): RowResult {
  return { row, leg, status: 'passed', failures: [], attempts: 1, ms: 10, ...over };
}

/** A run with one feature, a video on one leg, a device leg, and one row with no evidence. */
function sampleInput(): ViewerInput {
  const manifest: Manifest = {
    title: 'Sample run',
    generated: '2026-01-01T00:00:00.000Z',
    shots: [
      makeShot({ id: 'home.guest', screen: 'home', state: 'guest', legs: ['desktop', 'phone'] }),
      makeShot({ id: 'home.empty', screen: 'home', state: 'empty', legs: ['desktop'] }),
    ],
  };
  return {
    title: 'Sample run',
    date: '2026-01-01',
    status: 'partial',
    manifest,
    results: [makeResult('home.guest', 'desktop'), makeResult('home.guest', 'phone'), makeResult('home.empty', 'desktop', { status: 'failed', failures: ['blank'] })],
    entries: [
      makeEntry({ path: `assets/${SLUG}/desktop-home.guest.png`, kind: 'screenshot', leg: 'desktop', row: 'home.guest' }),
      makeEntry({ path: `assets/${SLUG}/desktop-home.guest.webm`, kind: 'video', leg: 'desktop', row: 'home.guest' }),
      makeEntry({ path: `assets/${SLUG}/phone-home.guest.png`, kind: 'screenshot', leg: 'phone', row: 'home.guest', target: 'android-adb', device: 'pixel' }),
    ],
  };
}

describe('renderViewerBundle (spec 2.8, R8)', () => {
  it('writes an index page and one page per feature', () => {
    const { pages } = renderViewerBundle(sampleInput());
    expect([...pages.keys()].sort()).toEqual(['feature-home.html', 'index.html']);
  });

  it('renders the score gauge on the index page', () => {
    const index = renderViewerBundle(sampleInput()).pages.get('index.html') as string;
    expect(index).toContain('<svg');
    expect(index).toContain('QA score');
  });

  it('draws the config colour and weights on the gauge and lists the breakdown beside it', () => {
    const input = { ...sampleInput(), findings: { confirmed: { critical: 1, high: 0, medium: 0, low: 0 }, suspected: 0 } };
    const index = renderViewerBundle(input, { gaugeColor: 'teal', weights: { findings: 1, console: 0, coverage: 0, evidence: 0 } }).pages.get('index.html') as string;
    expect(index).toContain('stroke="teal"');
    expect(index).toContain('aria-label="QA score 75 of 100"');
    expect(index).toContain('<tr data-dimension="findings" data-counted="true"><td>Findings</td><td>75</td><td>1</td><td>counted</td><td>1 CONFIRMED (1 critical)</td></tr>');
    expect(index).toContain('<tr data-dimension="accessibility" data-counted="false"><td>Accessibility</td><td>-</td><td>0.15</td><td>untested</td><td>untested: the ledger holds no accessibility finding</td></tr>');
    expect(index.indexOf('qa-gauge')).toBeLessThan(index.indexOf('qa-score-table'));
  });

  it('marks findings untested when the input carries no section 4 tally', () => {
    const index = renderViewerBundle(sampleInput()).pages.get('index.html') as string;
    expect(index).toContain('<tr data-dimension="findings" data-counted="false"><td>Findings</td><td>-</td><td>0.35</td><td>untested</td>');
    expect(index).toContain(`stroke="${DEFAULT_GAUGE_COLOR}"`);
  });

  it('renders a view switch control on a feature page', () => {
    const feature = renderViewerBundle(sampleInput()).pages.get('feature-home.html') as string;
    expect(feature).toContain('data-qa-view-switch');
    expect(feature).toContain('data-qa-leg-switch');
  });

  it('plays the recorded video inline with controls', () => {
    const feature = renderViewerBundle(sampleInput()).pages.get('feature-home.html') as string;
    expect(feature).toContain(`<video src="../../assets/${SLUG}/desktop-home.guest.webm"`);
    expect(feature).toContain('controls playsinline');
  });

  it('marks a row with no evidence as a labelled blank', () => {
    const feature = renderViewerBundle(sampleInput()).pages.get('feature-home.html') as string;
    expect(feature).toContain('qa-blank');
    expect(feature).toContain('home.empty on desktop has no evidence in the ledger');
  });

  it('renders a device frame for a leg that ran on a device', () => {
    const feature = renderViewerBundle(sampleInput()).pages.get('feature-home.html') as string;
    expect(feature).toContain('qa-device');
    expect(feature).toContain('Device frame');
  });

  it('marks a missing act-step screenshot as a labelled blank', () => {
    const input = sampleInput();
    input.manifest.shots[0] = makeShot({ id: 'home.guest', screen: 'home', state: 'guest', legs: ['desktop', 'phone'], act: [{ kind: 'click', target: 'the menu' }] });
    const feature = renderViewerBundle(input).pages.get('feature-home.html') as string;
    expect(feature).toContain('qa-blank');
    expect(feature).toContain('has no screenshot for step');
  });
});

describe('buildViewer (spec 2.8, R8)', () => {
  it('writes the bundle under the report dist folder', async () => {
    const root = await tmpDir();
    const { mdPath, slug } = await writeReportFixture(join(root, 'docs/qa'), { pairs: { 'home.guest@mobile-web': { files: false } } });
    const result = await buildViewer(mdPath);
    expect(result.dir).toContain(join('dist', `${slug}-viewer`));
    expect(result.pages).toHaveLength(2);
    const index = await readFile(result.index, 'utf8');
    expect(index).toContain('<svg');
    const feature = await readFile(join(result.dir, 'feature-home.html'), 'utf8');
    expect(feature).toContain('qa-blank');
  });

  it('scores the CONFIRMED findings of section 4 of the report', async () => {
    const root = await tmpDir();
    const { mdPath } = await writeReportFixture(join(root, 'docs/qa'));
    const text = await readFile(mdPath, 'utf8');
    await writeFile(mdPath, text.replace('## 4 Findings\n', '## 4 Findings\n\n- CONFIRMED [medium] The home page title is cut on a phone.\n'));
    const index = await readFile((await buildViewer(mdPath)).index, 'utf8');
    expect(index).toContain('<td>Findings</td><td>92</td>');
    expect(index).toContain('1 CONFIRMED (1 medium)');
  });
});

describe('renderViewerBundle comments (spec 2.9, R9)', () => {
  function withComment(): ViewerInput {
    const comment = makeComment({ id: 'c0', anchor: { kind: 'step', row: 'home.guest', leg: 'desktop', attempt: 1, step: 1 }, author: 'guest', body: 'the menu is off', createdAt: '2026-01-01T00:00:00.000Z' });
    return { ...sampleInput(), comments: [comment] };
  }

  it('renders a floating mark and a sidebar row for a comment', () => {
    const feature = renderViewerBundle(withComment()).pages.get('feature-home.html') as string;
    expect(feature).toContain('data-qa-mark');
    expect(feature).toContain('data-comment-id="c0"');
    expect(feature).toContain('data-qa-comments');
    expect(feature).toContain('the menu is off');
  });

  it('disables the add control on a file viewer', () => {
    const feature = renderViewerBundle(withComment()).pages.get('feature-home.html') as string;
    expect(feature).toContain('data-qa-add-open');
    expect(feature).toMatch(/data-qa-add-open[^>]*disabled/);
    expect(feature).toContain("location.protocol!=='file:'");
  });
});
