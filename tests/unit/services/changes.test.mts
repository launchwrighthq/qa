import { describe, expect, it } from 'vitest';
import { areaOf, areasFor, gitInstant, parseRangeLine, renderChanges, workspaceAreas, workspaceGlobs } from '../../../src/services/changes.mts';

describe('parseRangeLine', () => {
  it('reads the first sha after the arrow', () => {
    expect(parseRangeLine('# R\n\nRange: 2026-08-21 abc1234 -> 2026-08-28 def5678, 41 commits\n')).toBe('def5678');
  });

  it('gives null without a Range line or without an arrow', () => {
    expect(parseRangeLine('Date: 2026-08-28\n')).toBeNull();
    expect(parseRangeLine('Range: abc1234\n')).toBeNull();
  });
});

describe('gitInstant', () => {
  it('writes every time field so the range does not move with the hour', () => {
    expect(gitInstant('2026-02-01')).toBe('2026-02-01T00:00:00');
    expect(gitInstant('2026-02-01 14:00')).toBe('2026-02-01T14:00:00');
  });
});

describe('workspace areas', () => {
  const yaml = ['packages:', '  - cli', "  - 'modules/*/ts'", '  - apps/*', '  - "!apps/legacy"', '', 'allowBuilds:', '  esbuild: true'].join('\n');
  const tracked = [
    'cli/package.json',
    'modules/qa/module.toml',
    'modules/qa/ts/package.json',
    'apps/web/package.json',
    'apps/legacy/package.json',
    'docs/specs/a.md',
    'README.md',
  ];

  it('reads the packages list of pnpm-workspace.yaml', () => {
    expect(workspaceGlobs(yaml)).toEqual(['cli', 'modules/*/ts', 'apps/*', '!apps/legacy']);
  });

  it('gives each package folder, a module ts folder as its module folder, without excluded packages', () => {
    expect(workspaceAreas(workspaceGlobs(yaml), tracked)).toEqual(['modules/qa', 'apps/web', 'cli']);
  });

  it('puts a path outside every package under its first folder, and a root file under root', () => {
    const areas = workspaceAreas(workspaceGlobs(yaml), tracked);
    expect(areaOf('modules/qa/ts/src/a.mts', areas)).toBe('modules/qa');
    expect(areaOf('apps/legacy/x.ts', areas)).toBe('apps');
    expect(areaOf('README.md', areas)).toBe('root');
    expect(areasFor(['docs/specs/a.md', 'cli/x.mts', 'cli/y.mts'], areas)).toEqual(['cli', 'docs']);
  });
});

describe('renderChanges', () => {
  it('prints the range, the areas and the signals and no file list', () => {
    const text = renderChanges({
      range: { base: 'b'.repeat(40), basis: '--since 2026-11-01 (the first commit at or after it)', head: 'abc1234', start: null, end: null, commits: 1, line: '2026-11-01 abc1234 -> 2026-11-01 abc1234, 1 commits' },
      areas: { 'apps/web': 1 },
      commits: [{ sha: 'a'.repeat(40), short: 'abc1234', date: '2026-11-01', author: 'A', subject: 'feat(web): cart', areas: ['apps/web'] }],
      signals: { added: { pages: ['apps/web/src/pages/cart.page.tsx'], features: [] }, documents: [] },
    });
    expect(text).toContain('range   2026-11-01 abc1234 -> 2026-11-01 abc1234, 1 commits');
    expect(text).toContain('  apps/web (1)\n    abc1234  2026-11-01  feat(web): cart');
    expect(text).toContain('new pages      apps/web/src/pages/cart.page.tsx');
    expect(text).toContain('new features   none');
  });
});
