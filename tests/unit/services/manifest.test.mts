import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import {
  evidencePath,
  expectedPageErrors,
  expectText,
  legsFor,
  loadManifest,
  routeFor,
  type Shot,
  shotPath,
  validateManifest,
} from '../../../src/services/manifest.mts';

const shot = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'store.empty',
  screen: 'store',
  state: 'empty',
  specRef: '2.4',
  source: ['spec:docs/specs/x.md#R5'],
  legs: ['desktop', 'miniapp'],
  route: '/store',
  fixture: { arm: [], persona: 'member-expiring', facts: ['catalog.empty-shelf'] },
  settle: { selector: '[data-state=empty]' },
  expect: 'the empty shelf message',
  ...over,
});
const manifest = (shots: unknown[]) => ({ title: 'x', generated: '2026-01-01T00:00:00Z', shots });

describe('validateManifest (spec 2.4, R5)', () => {
  it('passes a valid manifest', () => {
    expect(validateManifest(manifest([shot()]))).toEqual([]);
  });

  it('returns every error at once', () => {
    const errors = validateManifest(
      manifest([
        shot({ source: undefined }),
        shot({ id: 'Bad Id', settle: {} }),
        shot({ id: 'a.b', act: [{ kind: 'wait', ms: 500 }], fixture: { arm: [], account: 'x' } }),
      ]),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'shots[0] "store.empty": source is missing',
        expect.stringContaining('shots[1] "Bad Id": id must be'),
        expect.stringContaining('shots[1] "Bad Id": settle needs exactly one'),
        expect.stringContaining('shots[2] "a.b": act[0]: a wait needs a why'),
        expect.stringContaining('shots[2] "a.b": fixture.account is refused'),
      ]),
    );
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it('requires source with at least one spec:, commit: or issue: entry', () => {
    expect(validateManifest(manifest([shot({ source: [] })]))[0]).toContain('source must hold at least one');
    expect(validateManifest(manifest([shot({ source: ['jira:12'] })]))[0]).toContain('source "jira:12"');
    expect(validateManifest(manifest([shot({ source: ['commit:abc1234', 'issue:github-o-r-12'] })]))).toEqual([]);
  });

  it('accepts settle.busy as the one settle rule and refuses two rules', () => {
    expect(validateManifest(manifest([shot({ settle: { busy: true, timeout: 5000 } })]))).toEqual([]);
    expect(validateManifest(manifest([shot({ settle: { busy: true, selector: 'main' } })]))[0]).toContain('it has selector, busy');
  });

  it('accepts expect.pageErrors and refuses a bad shape', () => {
    expect(validateManifest(manifest([shot({ expect: { text: 'x', pageErrors: ['ResizeObserver loop'] } })]))).toEqual([]);
    expect(validateManifest(manifest([shot({ expect: { text: 'x', pageErrors: [1] } })]))[0]).toContain('expect.pageErrors');
  });

  it('refuses a route that carries a surface base, and a leg that does not exist', () => {
    const errors = validateManifest(manifest([shot({ route: '/app/store', legs: ['desktop', 'tv'] })]), { bases: ['/app'] });
    expect(errors).toEqual([
      expect.stringContaining('"tv" is not a leg'),
      expect.stringContaining('route is relative to the surface base, so drop /app'),
    ]);
  });

  it('checks the fields of each act kind', () => {
    const errors = validateManifest(
      manifest([shot({ act: [{ kind: 'click' }, { kind: 'type', target: 'input' }, { kind: 'hover', target: 'a' }, { kind: 'wait', ms: 200, why: 'the fade-in' }] })]),
    );
    expect(errors).toEqual([
      expect.stringContaining('act[0]: a click needs a target'),
      expect.stringContaining('act[1]: a type needs text'),
      expect.stringContaining('act[2]: kind "hover" is not one of'),
    ]);
  });
});

describe('loadManifest', () => {
  it('fails with qa.manifest.invalid and every problem', async () => {
    const dir = await tmpDir();
    const file = join(dir, 'x.shots.json');
    await writeFile(file, JSON.stringify(manifest([shot({ source: [] }), shot({ id: 'store.empty' })])));
    await expect(loadManifest(file)).rejects.toMatchObject({ code: 'qa.manifest.invalid', context: { errors: expect.arrayContaining([expect.stringContaining('duplicate id')]) } });
  });
});

describe('routes and paths', () => {
  const row = shot() as unknown as Shot;

  it('adds the surface base, and ?qa= on the miniapp surface only', () => {
    expect(routeFor(row, { surface: 'web' })).toBe('/store');
    expect(routeFor(row, { surface: 'miniapp', base: '/app' })).toBe('/app/store?qa=member-expiring');
    expect(routeFor({ ...row, route: '/store?tab=2' }, { surface: 'miniapp' })).toBe('/store?tab=2&qa=member-expiring');
  });

  it('names evidence files under assets/<slug>/', () => {
    expect(shotPath('2026-01-01-x', row, 'desktop')).toBe('assets/2026-01-01-x/desktop-store.empty.png');
    expect(evidencePath('s', 'miniapp', 'a.b', 'step', { step: 2, attempt: 3 })).toBe('assets/s/miniapp-a.b.a3.2.png');
    expect(evidencePath('s', 'telegram-android', 'a.b', 'video', { videoExt: 'mp4' })).toBe('assets/s/telegram-android-a.b.mp4');
    expect(evidencePath('s', 'desktop', 'a.b', 'trace')).toBe('assets/s/desktop-a.b.trace.zip');
  });

  it('reads the claim and the expected page errors of either expect form', () => {
    expect(expectText(row)).toBe('the empty shelf message');
    expect(expectedPageErrors({ expect: { text: 't', pageErrors: ['x'] } })).toEqual(['x']);
    expect(legsFor(row, ['miniapp', 'safari-ios'])).toEqual(['miniapp']);
  });
});
