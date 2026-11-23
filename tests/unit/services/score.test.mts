import { describe, expect, it } from 'vitest';
import { findingProblems, parseFindings, tallyFindings } from '../../../src/services/findings.mts';
import { computeScore, DEFAULT_GAUGE_COLOR, renderScoreBreakdown, renderScoreGauge, scoreRows } from '../../../src/services/score.mts';
import { isCssColor, scoreConfig } from '../../../src/services/score-config.mts';

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

  it('uses a purple ring by default and honours an override colour', () => {
    expect(renderScoreGauge(50)).toContain(`stroke="${DEFAULT_GAUGE_COLOR}"`);
    expect(DEFAULT_GAUGE_COLOR).toBe('#7c3aed');
    expect(renderScoreGauge(50, { color: '#10b981' })).toContain('#10b981');
  });
});

describe('scoreRows and renderScoreBreakdown (spec 2.11)', () => {
  it('lists every dimension with its score, its weight and whether it counted', () => {
    const result = computeScore({ findings: { high: 1 }, coverage: 0.5 }, { coverage: 0.4 });
    const rows = scoreRows(result, { coverage: 0.4 }, { accessibility: 'untested: no data' });
    expect(rows.map((r) => [r.dimension, r.score, r.weight, r.counted])).toEqual([
      ['findings', 85, 0.35, true],
      ['console', null, 0.1, false],
      ['coverage', 50, 0.4, true],
      ['evidence', null, 0.1, false],
      ['accessibility', null, 0.15, false],
      ['performance', null, 0.15, false],
    ]);
    const html = renderScoreBreakdown(rows);
    expect(html).toContain('<tr data-dimension="accessibility" data-counted="false"><td>Accessibility</td><td>-</td><td>0.15</td><td>untested</td><td>untested: no data</td></tr>');
    expect(html).toContain('<tr data-dimension="coverage" data-counted="true"><td>Coverage</td><td>50</td><td>0.4</td><td>counted</td>');
  });
});

describe('parseFindings and tallyFindings (spec 2.11)', () => {
  const section = [
    '- CONFIRMED [critical] The checkout button stays disabled.',
    '### **CONFIRMED** [High] The card form drops the last digit.',
    'CONFIRMED [low] The footer link has the wrong label.',
    '- SUSPECTED [medium] The refund page reads a stale price.',
    '- SUSPECTED The empty cart copy is cut.',
    '- CONFIRMED: the badge is missing.',
    '- CONFIRMED [urgent] The menu overlaps.',
    '```',
    '- CONFIRMED [critical] inside a fence',
    '```',
    'Each CONFIRMED finding below has a row.',
    '- issue tg-1: REPRODUCED',
  ];

  it('reads the status, the severity tag and the claim of each finding line', () => {
    const findings = parseFindings(section);
    expect(findings.map((f) => [f.line, f.status, f.tag, f.severity, f.claim])).toEqual([
      [0, 'CONFIRMED', 'critical', 'critical', 'The checkout button stays disabled.'],
      [1, 'CONFIRMED', 'high', 'high', 'The card form drops the last digit.'],
      [2, 'CONFIRMED', 'low', 'low', 'The footer link has the wrong label.'],
      [3, 'SUSPECTED', 'medium', 'medium', 'The refund page reads a stale price.'],
      [4, 'SUSPECTED', null, null, 'The empty cart copy is cut.'],
      [5, 'CONFIRMED', null, null, 'the badge is missing.'],
      [6, 'CONFIRMED', 'urgent', null, 'The menu overlaps.'],
    ]);
  });

  it('counts only CONFIRMED findings with a severity and keeps the SUSPECTED count apart', () => {
    expect(tallyFindings(parseFindings(section))).toEqual({ confirmed: { critical: 1, high: 1, medium: 0, low: 1 }, suspected: 2 });
  });

  it('names a CONFIRMED finding with no tag and any unknown tag', () => {
    const problems = findingProblems(parseFindings(section));
    expect(problems).toEqual([
      'line 6: the CONFIRMED finding "the badge is missing." has no severity tag. Write "CONFIRMED [critical|high|medium|low] <claim>".',
      'line 7: the CONFIRMED finding has the tag [urgent], which is not a severity. Write "CONFIRMED [critical|high|medium|low] <claim>".',
    ]);
  });
});

describe('scoreConfig (spec 2.11, 3.2)', () => {
  it('defaults to the purple gauge and no weight override', () => {
    expect(scoreConfig.parse({})).toEqual({ weights: {}, gaugeColor: DEFAULT_GAUGE_COLOR });
  });

  it('accepts CSS colours and refuses anything else', () => {
    for (const c of ['#7c3aed', '#abc', '#7c3aedcc', 'rgb(124 58 237)', 'hsl(262, 83%, 58%)', 'oklch(0.55 0.25 290 / 80%)', 'RebeccaPurple', 'currentColor']) expect(isCssColor(c)).toBe(true);
    for (const c of ['purpel', '#12345', 'url(x)', 'red;fill:blue', '"><script>', 'rgb(1,2,3);x']) expect(isCssColor(c)).toBe(false);
    expect(() => scoreConfig.parse({ gaugeColor: 'purpel' })).toThrow(/CSS colour/);
  });

  it('refuses a negative weight and an unknown dimension', () => {
    expect(scoreConfig.parse({ weights: { findings: 0.5, performance: 0 } }).weights).toEqual({ findings: 0.5, performance: 0 });
    expect(() => scoreConfig.parse({ weights: { findings: -1 } })).toThrow();
    expect(() => scoreConfig.parse({ weights: { speed: 1 } })).toThrow();
  });
});
