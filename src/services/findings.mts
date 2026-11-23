// The findings of section 4 of a report (spec 2.11, 2.12.1). A finding starts its line with
// `CONFIRMED` or `SUSPECTED`, then a severity tag and the claim:
//
//   - CONFIRMED [high] The checkout button stays disabled after a valid card.
//   ### SUSPECTED [low] The empty cart copy is cut on a narrow phone.
//
// The line may be a list item, a level 3 to 6 heading or a plain line, and the status word may be
// bold. Only a CONFIRMED finding deducts from the score: a SUSPECTED one is read from the code and
// not reproduced, so the run has no evidence for it.
import type { SeverityCounts } from './score.mts';

/** The severity tags of a finding, from the rubric of spec 2.11. */
export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One finding line of section 4. */
export interface Finding {
  /** The 0-based line index in the report. */
  line: number;
  status: 'CONFIRMED' | 'SUSPECTED';
  /** The tag in lower case, or null when the line has none. */
  tag: string | null;
  /** The tag when it is a known severity, else null. */
  severity: Severity | null;
  claim: string;
}

const FINDING_RE = /^(?:[-*+]\s+|#{3,6}\s+)?\**(CONFIRMED|SUSPECTED)\b\**:?\s*(.*)$/;
const TAG_RE = /^\[([^\]]*)\]\s*(.*)$/;

const isSeverity = (tag: string): tag is Severity => (SEVERITIES as readonly string[]).includes(tag);

/** The finding lines of `lines[from, to)`, with fenced code left out. */
export function parseFindings(lines: readonly string[], from = 0, to = lines.length): Finding[] {
  const out: Finding[] = [];
  let fence = false;
  for (let i = from; i < to; i += 1) {
    const line = (lines[i] as string).trim();
    if (line.startsWith('```')) fence = !fence;
    if (fence) continue;
    const m = FINDING_RE.exec(line);
    if (!m) continue;
    const rest = (m[2] as string).trim();
    const t = TAG_RE.exec(rest);
    const tag = t ? (t[1] as string).trim().toLowerCase() : null;
    out.push({ line: i, status: m[1] as Finding['status'], tag, severity: tag !== null && isSeverity(tag) ? tag : null, claim: t ? (t[2] as string).trim() : rest });
  }
  return out;
}

/** What the score reads: the CONFIRMED findings by severity, and the SUSPECTED count it leaves out. */
export interface FindingTally {
  confirmed: Required<SeverityCounts>;
  suspected: number;
}

export function tallyFindings(findings: readonly Finding[]): FindingTally {
  const confirmed = { critical: 0, high: 0, medium: 0, low: 0 };
  let suspected = 0;
  for (const f of findings) {
    if (f.status === 'SUSPECTED') suspected += 1;
    else if (f.severity) confirmed[f.severity] += 1;
  }
  return { confirmed, suspected };
}

/** The problem text of each finding line with no tag on a CONFIRMED finding, or an unknown tag. */
export function findingProblems(findings: readonly Finding[]): string[] {
  const out: string[] = [];
  const form = `"CONFIRMED [${SEVERITIES.join('|')}] <claim>"`;
  for (const f of findings) {
    const at = `line ${f.line + 1}`;
    if (f.tag !== null && f.severity === null) out.push(`${at}: the ${f.status} finding has the tag [${f.tag}], which is not a severity. Write ${form}.`);
    else if (f.status === 'CONFIRMED' && f.tag === null) out.push(`${at}: the CONFIRMED finding "${f.claim}" has no severity tag. Write ${form}.`);
  }
  return out;
}
