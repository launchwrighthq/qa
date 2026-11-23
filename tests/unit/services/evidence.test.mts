import { describe, expect, it } from 'vitest';
import {
  attemptFailures,
  coverageLine,
  coverageSection,
  evidenceSection,
  isBootFailure,
  legsLine,
  NOT_COVERED_LINE,
  routeHeld,
  unexpectedPageErrors,
} from '../../../src/services/evidence.mts';
import type { Manifest } from '../../../src/services/manifest.mts';
import type { LedgerEntry, RowResult } from '../../../src/services/types.mts';
import { patternPng, uniformPng } from '../../../src/testing/report-fixture.mts';

const SLUG = '2026-01-01-x';
const manifest: Manifest = {
  title: 'x',
  generated: '2026-01-01T00:00:00Z',
  shots: [
    {
      id: 'store.empty',
      screen: 'store',
      state: 'empty',
      source: ['commit:abc1234'],
      legs: ['desktop', 'mobile-web', 'miniapp', 'telegram-fake', 'telegram-android'],
      route: '/store',
      fixture: { arm: [], persona: 'member' },
      settle: { busy: true },
      expect: 'the empty shelf',
    },
  ],
};

const entry = (leg: string, file: string, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  path: `assets/${SLUG}/${leg}-store.empty${file}`,
  kind: 'screenshot',
  sha256: '0'.repeat(64),
  bytes: 1,
  capturedAt: '2026-01-01T00:00:00Z',
  commit: 'abc1234',
  dirty: false,
  leg,
  target: 'playwright',
  provenance: 'live',
  row: 'store.empty',
  attempt: 1,
  ...over,
});

const entries: LedgerEntry[] = [
  entry('desktop', '.png'),
  entry('desktop', '.webm', { kind: 'video' }),
  entry('desktop', '.trace.zip', { kind: 'trace' }),
  entry('mobile-web', '.png'),
  entry('miniapp', '.png', { provenance: 'mounted' }),
  entry('telegram-fake', '.png'),
  entry('telegram-android', '.png', { target: 'android-adb', device: 'pixel', attempt: 1 }),
  entry('telegram-android', '.a2.png', { target: 'android-adb', device: 'pixel', attempt: 2 }),
];

const results: RowResult[] = [
  { row: 'store.empty', leg: 'desktop', status: 'passed', failures: [], attempts: 1, ms: 1 },
  { row: 'store.empty', leg: 'mobile-web', status: 'passed', failures: [], attempts: 1, ms: 1 },
  { row: 'store.empty', leg: 'miniapp', status: 'passed', failures: [], attempts: 1, ms: 1 },
  { row: 'store.empty', leg: 'telegram-fake', status: 'passed', failures: [], attempts: 1, ms: 1 },
  { row: 'store.empty', leg: 'telegram-android', status: 'passed', failures: [], attempts: 2, ms: 1 },
];

/** Desktop shots are landscape, every other leg is portrait. */
const sizeOf = (path: string) => (path.includes('/desktop-') ? { width: 1440, height: 900 } : { width: 412, height: 915 });

describe('evidenceSection layout (spec 2.12.1)', () => {
  const text = evidenceSection({ slug: SLUG, manifest, results, entries, sizeOf });
  const lines = text.split('\n');

  it('embeds every ledger file exactly once, images and videos as ![alt](assets/<slug>/...)', () => {
    expect(entries.map((e) => [e.path, text.split(`](${e.path})`).length - 1])).toEqual(entries.map((e) => [e.path, 1]));
    expect(text).toContain(`![desktop store empty](assets/${SLUG}/desktop-store.empty.png)`);
    expect(text).toContain(`[desktop trace](assets/${SLUG}/desktop-store.empty.trace.zip)`);
    expect(text).not.toMatch(/`assets\//);
  });

  it('puts a landscape shot and a video each alone on a line', () => {
    for (const file of ['desktop-store.empty.png', 'desktop-store.empty.webm']) {
      const line = lines.find((l) => l.includes(file)) as string;
      expect(line).toMatch(/^!\[[^\]]*\]\([^)]*\)$/);
      expect(lines[lines.indexOf(line) - 1]).toBe('');
      expect(lines[lines.indexOf(line) + 1]).toBe('');
    }
  });

  it('puts portrait shots two per table row and never a landscape shot in a table', () => {
    const cells = lines.filter((l) => l.startsWith('| !['));
    expect(cells).toHaveLength(3);
    for (const row of cells) expect(row.match(/!\[/g)?.length).toBeLessThanOrEqual(2);
    expect(cells.join('\n')).not.toContain('desktop-');
    expect(cells[0]).toContain('mobile-web-store.empty.png');
    expect(cells[0]).toContain('miniapp-store.empty.png');
  });

  it('labels a provenance other than live, and shows the attempt count', () => {
    expect(text).toContain('miniapp on playwright (mounted)');
    expect(text).not.toContain('(live)');
    expect(text).toContain('- `telegram-android`: passed, 2 attempts');
    expect(text).toContain('telegram-android on android-adb (pixel), attempt 2');
  });

  it('is the same text on a second render', () => {
    expect(evidenceSection({ slug: SLUG, manifest, results, entries, sizeOf })).toBe(text);
  });
});

describe('coverage, Legs: and Coverage: lines', () => {
  const partial: RowResult[] = [
    ...results.slice(0, 4),
    { row: 'store.empty', leg: 'telegram-android', status: 'n/a', reason: 'no target', failures: [], attempts: 0, ms: 0 },
  ];

  it('writes a section 5 line for a leg that did not run, in the form the check reads', () => {
    const text = coverageSection({ manifest, results: partial, entries });
    expect(text).toBe('- `store.empty` on `telegram-android`: n/a: no target');
    expect(NOT_COVERED_LINE.test(text)).toBe(true);
  });

  it('counts world states that a passed row covers', () => {
    const text = coverageSection({ manifest, results, entries, world: [{ id: 'member' }, { id: 'guest', feature: 'auth' }] });
    expect(text).toContain('1 of 2 world states');
    expect(text).toContain('| `guest` | auth | no row names it |');
  });

  it('states the legs that ran and the legs that did not', () => {
    expect(legsLine(manifest, partial)).toBe('desktop, mobile-web, miniapp, telegram-fake; not run: telegram-android (no target)');
    expect(coverageLine({ manifest, results: partial, entries })).toBe('4 of 5 row legs passed with evidence');
  });
});

describe('row checks (spec 2.11.2, R16)', () => {
  const EVIDENCE = { blankStdDev: 2, videoCapS: 170, blackRatio: 0.95 };

  it('finds the boot-failure screen', () => {
    expect(isBootFailure('', [])).toBe(true);
    expect(isBootFailure('Open this from the app to sign in. Help', ['Open this from the app to sign in.'])).toBe(true);
    expect(isBootFailure('Store', ['Open this from the app to sign in.'])).toBe(false);
  });

  it('holds a route through the base and an optional locale segment', () => {
    expect(routeHeld('/store', '/app/store/', '/app')).toBe(true);
    expect(routeHeld('/store', '/en/store', '', /^\/[a-z]{2}(?=\/|$)/)).toBe(true);
    expect(routeHeld('/store', '/login')).toBe(false);
  });

  it('keeps only the page errors a row does not expect', () => {
    const logs = [
      { at: 't', kind: 'page-error' as const, text: 'ResizeObserver loop limit exceeded' },
      { at: 't', kind: 'page-error' as const, text: 'TypeError: x is undefined' },
      { at: 't', kind: 'console-error' as const, text: 'TypeError: y' },
    ];
    expect(unexpectedPageErrors(logs, ['ResizeObserver loop']).map((l) => l.text)).toEqual(['TypeError: x is undefined']);
  });

  it('names every failure of an attempt once', () => {
    const failures = attemptFailures(
      {
        screenshots: [uniformPng(8, 8), patternPng(8, 8), uniformPng(8, 8, 200)],
        page: { text: '', bootFailureSentences: [] },
        route: { requested: '/store', landedPath: '/login' },
        logs: [{ at: 't', kind: 'page-error', text: 'boom' }],
        videos: [{ durationS: 0.5, blackS: 0 }, { durationS: 200, blackS: 0 }],
      },
      EVIDENCE,
    );
    expect(failures).toEqual(['blank', 'not-booted', 'route-drift', 'blank-video', 'over-budget', 'page-error']);
    expect(attemptFailures({ screenshots: [patternPng(8, 8)], route: { requested: '/a', landedPath: '/a' } }, EVIDENCE)).toEqual([]);
  });
});

describe('evidenceSection escapes manifest text', () => {
  it('turns link, image and HTML syntax in an expect into plain text', () => {
    const shot = { ...manifest.shots[0]!, expect: 'see [x](javascript:alert(1)) and <img src=x onerror=alert(1)>' };
    const text = evidenceSection({ slug: SLUG, manifest: { ...manifest, shots: [shot] }, results, entries, sizeOf });
    expect(text).not.toContain('](javascript:');
    expect(text).not.toContain('<img');
    expect(text).toContain('&#91;x&#93;(javascript:alert(1)) and &lt;img src=x onerror=alert(1)&gt;');
  });
});
