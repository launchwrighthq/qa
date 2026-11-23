import { describe, expect, it } from 'vitest';
import { computeScore, renderScoreGauge } from '../../../src/services/score.mts';

describe('computeScore (spec 2.11, R11)', () => {
  it('scores findings and console errors to the expected number', () => {
    // findings 100 - 25 (critical) - 3 (low) = 72; console 2 errors = 70 band.
    // weighted (72 * 0.35 + 70 * 0.1) / (0.35 + 0.1) = 32.2 / 0.45 = 71.56, rounded to 72.
    const result = computeScore({ findings: { critical: 1, low: 1 }, consoleErrors: 2 });
    expect(result.dimensions).toEqual({ findings: 72, console: 70 });
    expect(result.score).toBe(72);
  });

  it('averages only the dimensions that were tested', () => {
    // Only findings and coverage are tested, so the denominator is 3 + 1, not every weight.
    // findings 100, coverage round(0.5 * 100) = 50; (100 * 3 + 50 * 1) / 4 = 87.5, rounded up to 88.
    const result = computeScore({ findings: {}, coverage: 0.5 }, { findings: 3, coverage: 1 });
    expect(Object.keys(result.dimensions).sort()).toEqual(['coverage', 'findings']);
    expect(result.dimensions).toEqual({ findings: 100, coverage: 50 });
    expect(result.score).toBe(88);
  });

  it('caps confidence at the lower of coverage and evidence', () => {
    expect(computeScore({ coverage: 0.4, evidence: 0.9 }).confidence).toBe(0.4);
    expect(computeScore({ findings: {} }).confidence).toBe(0);
  });
});

describe('renderScoreGauge (spec 2.11, R11)', () => {
  it('renders the score text and a circle in the gauge', () => {
    const svg = renderScoreGauge(72);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<circle');
    expect(svg).toContain('>72</text>');
  });

  it('uses a neutral ring by default and honours an override colour', () => {
    expect(renderScoreGauge(50)).not.toContain('purple');
    expect(renderScoreGauge(50, { color: '#10b981' })).toContain('#10b981');
  });
});
