// The score of a run report (spec 2.11): the rubric input that the plan, the row results, the ledger
// and the section 4 findings support, the result, and the breakdown the page shows beside the gauge.
import { plannedPairs } from './evidence.mts';
import { type FindingTally } from './findings.mts';
import { pairKey } from './ledger.mts';
import type { Manifest } from './manifest.mts';
import { computeScore, type ScoreDimension, type ScoreInput, type ScoreResult, type ScoreRow, scoreRows, type ScoreWeights } from './score.mts';
import type { LedgerEntry, RowResult } from './types.mts';

/** The run data the score reads. `findings` is the tally of section 4; without it, findings stay untested. */
export interface RunScoreData {
  manifest: Manifest;
  results: readonly RowResult[];
  entries: readonly LedgerEntry[];
  findings?: FindingTally;
}

interface RunFacts {
  pairs: number;
  covered: number;
  evidenced: number;
  ran: number;
  pageErrors: number;
}

function runFacts(input: RunScoreData): RunFacts {
  const pairs = plannedPairs(input.manifest);
  const latest = new Map<string, RowResult>();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const provenances = new Map<string, Set<string>>();
  const withFile = new Set<string>();
  for (const e of input.entries) {
    const key = pairKey(e.row, e.leg);
    const set = provenances.get(key) ?? new Set<string>();
    set.add(e.provenance);
    provenances.set(key, set);
    if (e.kind === 'screenshot' || e.kind === 'step' || e.kind === 'video') withFile.add(key);
  }
  const facts: RunFacts = { pairs: pairs.length, covered: 0, evidenced: 0, ran: 0, pageErrors: 0 };
  for (const { shot, leg } of pairs) {
    const key = pairKey(shot.id, leg);
    const provs = provenances.get(key);
    if (provs?.has('live') || provs?.has('mounted')) facts.covered += 1;
    const r = latest.get(key);
    if (r) facts.ran += 1;
    if (r?.status === 'passed' && withFile.has(key)) facts.evidenced += 1;
    if (r?.failures.includes('page-error')) facts.pageErrors += 1;
  }
  return facts;
}

function inputOf(facts: RunFacts, findings: FindingTally | undefined): ScoreInput {
  if (facts.pairs === 0) return {};
  const out: ScoreInput = { coverage: facts.covered / facts.pairs, evidence: facts.evidenced / facts.pairs };
  if (facts.ran > 0) out.consoleErrors = facts.pageErrors;
  if (facts.ran > 0 && findings) out.findings = findings.confirmed;
  return out;
}

/**
 * The score input the report's own data supports (spec 2.11). Coverage is the share of planned row
 * legs with a `live` or `mounted` ledger entry. Evidence is the share that passed with a real file.
 * The console band reads the page errors the results name. Findings count the CONFIRMED findings of
 * section 4 by severity, once a row ran. The ledger holds no accessibility finding and no timing
 * measure, so accessibility and performance stay untested and drop from the average.
 */
export function reportScoreInput(input: RunScoreData): ScoreInput {
  return inputOf(runFacts(input), input.findings);
}

/** A report's score, its input and the breakdown rows. */
export interface ReportScore {
  input: ScoreInput;
  result: ScoreResult;
  rows: ScoreRow[];
}

function findingsNote(findings: FindingTally | undefined, ran: number): string {
  if (!findings) return 'untested: the section 4 findings were not read';
  if (ran === 0) return 'untested: no row ran';
  const c = findings.confirmed;
  const total = c.critical + c.high + c.medium + c.low;
  const levels = (['critical', 'high', 'medium', 'low'] as const).filter((s) => c[s] > 0).map((s) => `${c[s]} ${s}`);
  const confirmed = total === 0 ? 'no CONFIRMED finding' : `${total} CONFIRMED (${levels.join(', ')})`;
  return findings.suspected > 0 ? `${confirmed}; ${findings.suspected} SUSPECTED, not scored` : confirmed;
}

/** The score of a run with its breakdown, or null for a plan with no row leg. */
export function reportScore(input: RunScoreData, weights: Partial<ScoreWeights> = {}): ReportScore | null {
  const facts = runFacts(input);
  const scoreInput = inputOf(facts, input.findings);
  if (Object.keys(scoreInput).length === 0) return null;
  const result = computeScore(scoreInput, weights);
  const notRun = 'untested: no row ran';
  const notes: Record<ScoreDimension, string> = {
    findings: findingsNote(input.findings, facts.ran),
    console: facts.ran === 0 ? notRun : `${facts.pageErrors} of ${facts.ran} row legs that ran had a page error`,
    coverage: `${facts.covered} of ${facts.pairs} row legs live or mounted`,
    evidence: `${facts.evidenced} of ${facts.pairs} row legs passed with a file`,
    accessibility: 'untested: the ledger holds no accessibility finding',
    performance: 'untested: the ledger holds no timing measure',
  };
  return { input: scoreInput, result, rows: scoreRows(result, weights, notes) };
}
