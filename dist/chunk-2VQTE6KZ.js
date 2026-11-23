// src/services/score.mts
var DEFAULT_SCORE_WEIGHTS = {
  findings: 0.35,
  console: 0.1,
  coverage: 0.15,
  evidence: 0.1,
  accessibility: 0.15,
  performance: 0.15
};
var SEVERITY_DEDUCTION = { critical: 25, high: 15, medium: 8, low: 3 };
var clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
function deductScore(counts) {
  const lost = (counts.critical ?? 0) * SEVERITY_DEDUCTION.critical + (counts.high ?? 0) * SEVERITY_DEDUCTION.high + (counts.medium ?? 0) * SEVERITY_DEDUCTION.medium + (counts.low ?? 0) * SEVERITY_DEDUCTION.low;
  return Math.max(0, 100 - lost);
}
function consoleScore(errors) {
  if (errors <= 0) return 100;
  if (errors <= 3) return 70;
  if (errors <= 10) return 40;
  return 10;
}
var percentScore = (fraction) => Math.round(clamp(fraction, 0, 1) * 100);
function computeScore(input, weights = {}) {
  const w = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
  const dimensions = {};
  if (input.findings) dimensions.findings = deductScore(input.findings);
  if (input.consoleErrors !== void 0) dimensions.console = consoleScore(input.consoleErrors);
  if (input.coverage !== void 0) dimensions.coverage = percentScore(input.coverage);
  if (input.evidence !== void 0) dimensions.evidence = percentScore(input.evidence);
  if (input.accessibility) dimensions.accessibility = deductScore(input.accessibility);
  if (input.performance) dimensions.performance = deductScore(input.performance);
  let weighted = 0;
  let total = 0;
  for (const dim of Object.keys(dimensions)) {
    const value = dimensions[dim];
    if (value === void 0) continue;
    weighted += value * w[dim];
    total += w[dim];
  }
  const score = total > 0 ? Math.round(weighted / total) : 0;
  const confidenceParts = [];
  if (input.coverage !== void 0) confidenceParts.push(clamp(input.coverage, 0, 1));
  if (input.evidence !== void 0) confidenceParts.push(clamp(input.evidence, 0, 1));
  const confidence = confidenceParts.length > 0 ? Math.min(...confidenceParts) : 0;
  return { score, dimensions, confidence };
}
var DEFAULT_GAUGE_COLOR = "#7c3aed";
var NEUTRAL_TRACK = "#e2e8f0";
var LABEL_INK = "#64748b";
var attr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var content = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function renderScoreGauge(score, opts = {}) {
  const size = opts.size ?? 160;
  const value = clamp(Math.round(score), 0, 100);
  const ring = attr(opts.color ?? DEFAULT_GAUGE_COLOR);
  const track = attr(opts.track ?? NEUTRAL_TRACK);
  const stroke = Math.max(2, Math.round(size * 0.09));
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value / 100 * circumference;
  const numberSize = Math.round(size * 0.3);
  const font = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const numberY = opts.label ? center - numberSize * 0.12 : center;
  const label = opts.label ? `<text x="${center}" y="${center + numberSize * 0.72}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${Math.round(size * 0.1)}" fill="${LABEL_INK}">${content(opts.label)}</text>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QA score ${value} of 100">`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${track}" stroke-width="${stroke}"/>`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${ring}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${filled.toFixed(3)} ${(circumference - filled).toFixed(3)}" transform="rotate(-90 ${center} ${center})"/>`,
    `<text x="${center}" y="${numberY}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${numberSize}" font-weight="700" fill="${ring}">${value}</text>`,
    label,
    "</svg>"
  ].join("");
}
var SCORE_DIMENSIONS = [
  { dimension: "findings", label: "Findings" },
  { dimension: "console", label: "Console and page errors" },
  { dimension: "coverage", label: "Coverage" },
  { dimension: "evidence", label: "Evidence" },
  { dimension: "accessibility", label: "Accessibility" },
  { dimension: "performance", label: "Performance" }
];
function scoreRows(result, weights = {}, notes = {}) {
  const w = { ...DEFAULT_SCORE_WEIGHTS, ...weights };
  return SCORE_DIMENSIONS.map(({ dimension, label }) => {
    const score = result.dimensions[dimension] ?? null;
    return { dimension, label, score, weight: w[dimension], counted: score !== null, note: notes[dimension] ?? (score === null ? "untested" : "") };
  });
}
function renderScoreBreakdown(rows) {
  const body = rows.map((r) => {
    const state = r.counted ? "counted" : "untested";
    return `<tr data-dimension="${r.dimension}" data-counted="${r.counted}"><td>${content(r.label)}</td><td>${r.score ?? "-"}</td><td>${r.weight}</td><td>${state}</td><td>${content(r.note)}</td></tr>`;
  }).join("");
  return `<table class="qa-score-table"><thead><tr><th>Dimension</th><th>Score</th><th>Weight</th><th>Counted</th><th>From</th></tr></thead><tbody>${body}</tbody></table>`;
}

export {
  DEFAULT_SCORE_WEIGHTS,
  SEVERITY_DEDUCTION,
  computeScore,
  DEFAULT_GAUGE_COLOR,
  renderScoreGauge,
  SCORE_DIMENSIONS,
  scoreRows,
  renderScoreBreakdown
};
//# sourceMappingURL=chunk-2VQTE6KZ.js.map