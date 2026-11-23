// The QA 0-100 score and its circular gauge (spec 2.11). `computeScore` is a pure function of the
// per-dimension inputs: it scores each dimension 0-100, takes the weighted average over the
// dimensions that were tested, and reports a confidence from coverage and evidence. `renderScoreGauge`
// returns a self-contained inline SVG with no external dependency. Neither reads IO.

/** The dimensions of the rubric (spec 2.11). The key of a dimension in the weights and the result. */
export type ScoreDimension = 'findings' | 'console' | 'coverage' | 'evidence' | 'accessibility' | 'performance';

/** Findings counted by severity. A missing level counts as zero. */
export interface SeverityCounts {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

/** The per-dimension inputs. A dimension left out is not tested and drops from the average. */
export interface ScoreInput {
  /** Correctness findings by severity. */
  findings?: SeverityCounts;
  /** The count of console and page errors the run saw. */
  consoleErrors?: number;
  /** The share of declared states shot at live or mounted, as a fraction 0..1. */
  coverage?: number;
  /** The share of planned steps with real evidence and no blank, as a fraction 0..1. */
  evidence?: number;
  /** Accessibility findings by severity. */
  accessibility?: SeverityCounts;
  /** Performance findings by severity. */
  performance?: SeverityCounts;
}

/** A weight per dimension. The default is tunable through the `weights` argument of `computeScore`. */
export type ScoreWeights = Record<ScoreDimension, number>;

/** The default weights (spec 2.11). They start from gstack's split and a consumer overrides them. */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  findings: 0.35,
  console: 0.1,
  coverage: 0.15,
  evidence: 0.1,
  accessibility: 0.15,
  performance: 0.15,
};

/** The deduction per finding of a start-at-100 dimension (spec 2.11). */
export const SEVERITY_DEDUCTION = { critical: 25, high: 15, medium: 8, low: 3 } as const;

/** The result of `computeScore`. */
export interface ScoreResult {
  /** The weighted 0..100 integer over the tested dimensions. */
  score: number;
  /** Each tested dimension with its 0..100 score. An untested dimension is absent. */
  dimensions: Partial<Record<ScoreDimension, number>>;
  /** 0..1, the lower of the tested coverage and evidence fractions. Zero when neither is tested. */
  confidence: number;
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

/** A start-at-100 dimension: deduct per finding by severity, floored at 0. */
function deductScore(counts: SeverityCounts): number {
  const lost =
    (counts.critical ?? 0) * SEVERITY_DEDUCTION.critical +
    (counts.high ?? 0) * SEVERITY_DEDUCTION.high +
    (counts.medium ?? 0) * SEVERITY_DEDUCTION.medium +
    (counts.low ?? 0) * SEVERITY_DEDUCTION.low;
  return Math.max(0, 100 - lost);
}

/** The console and page error band (spec 2.11): 0 errors 100, 1 to 3 70, 4 to 10 40, 11 or more 10. */
function consoleScore(errors: number): number {
  if (errors <= 0) return 100;
  if (errors <= 3) return 70;
  if (errors <= 10) return 40;
  return 10;
}

/** A coverage or evidence fraction 0..1 as a 0..100 integer percent. */
const percentScore = (fraction: number): number => Math.round(clamp(fraction, 0, 1) * 100);

/**
 * The 0-100 score (spec 2.11). Each dimension scores 0..100, and the result is the weighted average
 * over the dimensions the input tested: `Σ (score × weight) / Σ tested weights`, 0.5 rounded up.
 * `weights` overrides any of the default weights.
 */
export function computeScore(input: ScoreInput, weights: Partial<ScoreWeights> = {}): ScoreResult {
  const w: ScoreWeights = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
  const dimensions: Partial<Record<ScoreDimension, number>> = {};
  if (input.findings) dimensions.findings = deductScore(input.findings);
  if (input.consoleErrors !== undefined) dimensions.console = consoleScore(input.consoleErrors);
  if (input.coverage !== undefined) dimensions.coverage = percentScore(input.coverage);
  if (input.evidence !== undefined) dimensions.evidence = percentScore(input.evidence);
  if (input.accessibility) dimensions.accessibility = deductScore(input.accessibility);
  if (input.performance) dimensions.performance = deductScore(input.performance);

  let weighted = 0;
  let total = 0;
  for (const dim of Object.keys(dimensions) as ScoreDimension[]) {
    const value = dimensions[dim];
    if (value === undefined) continue;
    weighted += value * w[dim];
    total += w[dim];
  }
  const score = total > 0 ? Math.round(weighted / total) : 0;

  const confidenceParts: number[] = [];
  if (input.coverage !== undefined) confidenceParts.push(clamp(input.coverage, 0, 1));
  if (input.evidence !== undefined) confidenceParts.push(clamp(input.evidence, 0, 1));
  const confidence = confidenceParts.length > 0 ? Math.min(...confidenceParts) : 0;

  return { score, dimensions, confidence };
}

/** Options for `renderScoreGauge`. The ring colour is a configuration value, not a fixed purple (spec 2.11). */
export interface GaugeOptions {
  /** The ring colour. Default: a neutral accent the consumer overrides. */
  color?: string;
  /** The track colour behind the ring. */
  track?: string;
  /** The square SVG size in pixels. Default 160. */
  size?: number;
  /** A short label under the number, for example a confidence word. */
  label?: string;
}

/** A neutral accent, not purple: gstack's design rules flag a purple gradient as a slop pattern. */
const NEUTRAL_RING = '#64748b';
const NEUTRAL_TRACK = '#e2e8f0';

const attr = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const content = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A circular gauge for the score, as a self-contained inline SVG string. The arc length is the score
 * over 100, the number sits in the centre, and the ring uses `opts.color` with a neutral default.
 */
export function renderScoreGauge(score: number, opts: GaugeOptions = {}): string {
  const size = opts.size ?? 160;
  const value = clamp(Math.round(score), 0, 100);
  const ring = attr(opts.color ?? NEUTRAL_RING);
  const track = attr(opts.track ?? NEUTRAL_TRACK);
  const stroke = Math.max(2, Math.round(size * 0.09));
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (value / 100) * circumference;
  const numberSize = Math.round(size * 0.3);
  const font = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const numberY = opts.label ? center - numberSize * 0.12 : center;
  const label = opts.label
    ? `<text x="${center}" y="${center + numberSize * 0.72}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${Math.round(size * 0.1)}" fill="${track}">${content(opts.label)}</text>`
    : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QA score ${value} of 100">`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${track}" stroke-width="${stroke}"/>`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${ring}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${filled.toFixed(3)} ${(circumference - filled).toFixed(3)}" transform="rotate(-90 ${center} ${center})"/>`,
    `<text x="${center}" y="${numberY}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${numberSize}" font-weight="700" fill="${ring}">${value}</text>`,
    label,
    '</svg>',
  ].join('');
}
