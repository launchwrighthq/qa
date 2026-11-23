// Evidence: the row checks of spec 2.11.2 as pure functions for the runner, and the generated
// parts of a report (spec 2.12.1): section 3 between the evidence markers, the section 5 lines,
// and the `Legs:` and `Coverage:` header lines. Section 3 is a pure function of the plan, the row
// results, the ledger and the PNG headers, so the report check can render it again and compare.
import type { QaConfig } from '../config.mts';
import type { SessionLogLine } from '../drivers/target/contract.mts';
import { pairKey } from './ledger.mts';
import { expectText, type Manifest, type Shot } from './manifest.mts';
import { blankFailure, type PngSize } from './png.mts';
import type { EvidenceKind, LedgerEntry, RowFailure, RowResult } from './types.mts';
import { type VideoMeasure, videoFailures } from './video.mts';

export const EVIDENCE_START = '<!-- qa:evidence:start -->';
export const EVIDENCE_END = '<!-- qa:evidence:end -->';
export const COVERAGE_START = '<!-- qa:coverage:start -->';
export const COVERAGE_END = '<!-- qa:coverage:end -->';

// Row checks (spec 2.11.2) -----------------------------------------------------------------

/**
 * True when the page text is the boot-failure screen: empty, or one of the sentences the client
 * shows when it cannot start a session. The project gives the sentences.
 */
export function isBootFailure(text: string, sentences: readonly string[]): boolean {
  const body = text.trim();
  if (body === '') return true;
  return sentences.some((s) => s.trim() !== '' && (body === s.trim() || body.startsWith(s.trim())));
}

const trimSlash = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/**
 * True when the landed path is the requested route. The surface base and, when `locale` is
 * given, one leading locale segment are removed from the landed path first. A query is ignored.
 */
export function routeHeld(requested: string, landedPath: string, base = '', locale?: RegExp): boolean {
  const want = trimSlash(requested.split('?')[0] ?? '') || '/';
  let got = trimSlash(landedPath.split('?')[0] ?? '') || '/';
  if (base !== '' && (got === base || got.startsWith(`${base}/`))) got = trimSlash(got.slice(base.length)) || '/';
  if (got === want) return true;
  if (!locale) return false;
  return (trimSlash(got.replace(locale, '')) || '/') === want;
}

/** The page errors of a session that the row does not expect. Expected texts match as substrings. */
export function unexpectedPageErrors(lines: readonly SessionLogLine[], expected: readonly string[]): SessionLogLine[] {
  return lines.filter((l) => l.kind === 'page-error' && !expected.some((e) => l.text.includes(e)));
}

/** What the runner measured for one attempt of a row on a leg. Each field is optional. */
export interface AttemptFacts {
  /** The PNG bytes of every screenshot of the attempt. */
  screenshots?: Uint8Array[];
  /** The visible text of the page after settle, with the project's boot-failure sentences. */
  page?: { text: string; bootFailureSentences: readonly string[] };
  /** The planned route and the path the session shows after settle. */
  route?: { requested: string; landedPath: string; base?: string; locale?: RegExp };
  logs?: readonly SessionLogLine[];
  expectedPageErrors?: readonly string[];
  videos?: readonly VideoMeasure[];
}

/** Every failure of one attempt (spec 2.11.2), each name once, in the order of `ROW_FAILURES`. */
export function attemptFailures(facts: AttemptFacts, evidence: Pick<QaConfig['evidence'], 'blankStdDev' | 'videoCapS' | 'blackRatio'>): RowFailure[] {
  const out = new Set<RowFailure>();
  for (const png of facts.screenshots ?? []) if (blankFailure(png, evidence.blankStdDev)) out.add('blank');
  if (facts.page && isBootFailure(facts.page.text, facts.page.bootFailureSentences)) out.add('not-booted');
  if (facts.route && !routeHeld(facts.route.requested, facts.route.landedPath, facts.route.base, facts.route.locale)) out.add('route-drift');
  for (const v of facts.videos ?? []) for (const f of videoFailures(v, evidence)) out.add(f);
  if (unexpectedPageErrors(facts.logs ?? [], facts.expectedPageErrors ?? []).length > 0) out.add('page-error');
  const order: RowFailure[] = ['blank', 'not-booted', 'route-drift', 'blank-video', 'over-budget', 'page-error'];
  return order.filter((f) => out.has(f));
}

// Section 3 ----------------------------------------------------------------------------------

/** The input of the generated parts. `sizeOf` reads a PNG header by report-relative path. */
export interface EvidenceInput {
  slug: string;
  manifest: Manifest;
  results: readonly RowResult[];
  entries: readonly LedgerEntry[];
  sizeOf: (path: string) => PngSize | null;
}

const KIND_ORDER: Record<EvidenceKind, number> = { screenshot: 0, step: 1, video: 2, trace: 3, log: 4, ui: 5 };
const STILL = new Set<EvidenceKind>(['screenshot', 'step']);
const LINKED: Record<string, string> = { trace: 'trace', log: 'log', ui: 'UI dump' };
/** Portrait shots per table row. */
const PER_ROW = 2;

/** Natural order: `x.2.png` before `x.10.png`. Code-point compare on the other parts. */
function naturalCompare(a: string, b: string): number {
  const pa = a.split(/(\d+)/);
  const pb = b.split(/(\d+)/);
  for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
    const x = pa[i] as string;
    const y = pb[i] as string;
    if (x === y) continue;
    if (i % 2 === 1) return Number(x) - Number(y) || (x < y ? -1 : 1);
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

function compareEntries(a: LedgerEntry, b: LedgerEntry): number {
  return a.attempt - b.attempt || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || naturalCompare(a.path, b.path);
}

/**
 * Text for a table cell or a caption: no pipe that splits a cell, no newline that ends a table,
 * and no link, image or HTML syntax, because manifest and issue text is not trusted markup.
 */
function cell(text: string): string {
  return text
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .trim();
}

/** Text for image alt text: no bracket that ends it. */
const altText = (text: string): string => cell(text).replace(/[[\]]/g, '');

/** The label of a provenance other than `live`. A live shot has no label. */
export function provenanceLabel(provenance: string): string {
  return provenance === 'live' ? '' : ` (${provenance})`;
}

function stepOf(path: string): string | null {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? (m[1] as string) : null;
}

function caption(e: LedgerEntry, showAttempt: boolean, extra = ''): string {
  const device = e.device ? ` (${e.device})` : '';
  const step = e.kind === 'step' ? `, step ${stepOf(e.path) ?? '?'}` : '';
  const video = e.kind === 'video' ? ', video' : '';
  const attempt = showAttempt ? `, attempt ${e.attempt}` : '';
  return cell(`${e.leg} on ${e.target}${device}${step}${video}${attempt}${extra}${provenanceLabel(e.provenance)}`);
}

function embed(e: LedgerEntry, shot: Pick<Shot, 'screen' | 'state'> | null): string {
  const what = shot ? `${shot.screen} ${shot.state}` : e.row;
  const step = e.kind === 'step' ? ` step ${stepOf(e.path) ?? '?'}` : '';
  return `![${altText(`${e.leg} ${what}${step}${e.kind === 'video' ? ' video' : ''}`)}](${e.path})`;
}

/** The text of a row result for one leg. */
export function resultText(r: RowResult | undefined): string {
  if (!r) return 'no result';
  const attempts = `${r.attempts} attempt${r.attempts === 1 ? '' : 's'}`;
  const reason = r.reason ? `: ${cell(r.reason)}` : '';
  if (r.status === 'passed') return `passed, ${attempts}`;
  if (r.status === 'failed') return `failed (${r.failures.join(', ') || 'no failure named'}), ${attempts}${reason}`;
  return `${r.status === 'n/a' ? 'n/a' : 'not run'}${reason}`;
}

/** The embeds of the files of one row: wide items alone on a line, portraits two per table row. */
function rowFiles(entries: LedgerEntry[], shot: Shot | null, sizeOf: EvidenceInput['sizeOf'], multiAttempt: Set<string>): string[] {
  const out: string[] = [];
  const portraits: LedgerEntry[] = [];
  const links: LedgerEntry[] = [];
  for (const e of entries) {
    const showAttempt = multiAttempt.has(pairKey(e.row, e.leg));
    if (STILL.has(e.kind)) {
      const size = sizeOf(e.path);
      // A square or tall shot reads at full size in a table cell and is upscaled on the wide track.
      if (size && size.width <= size.height) {
        portraits.push(e);
        continue;
      }
      out.push(caption(e, showAttempt, size ? '' : ', shape unknown'), '', embed(e, shot), '');
    } else if (e.kind === 'video') {
      out.push(caption(e, showAttempt), '', embed(e, shot), '');
    } else {
      links.push(e);
    }
  }
  for (let i = 0; i < portraits.length; i += PER_ROW) {
    const group = portraits.slice(i, i + PER_ROW);
    const heads: string[] = [];
    const cells: string[] = [];
    for (let j = 0; j < PER_ROW; j += 1) {
      const e = group[j];
      heads.push(e ? caption(e, multiAttempt.has(pairKey(e.row, e.leg))) : '');
      cells.push(e ? embed(e, shot) : '');
    }
    out.push(`| ${heads.join(' | ')} |`, `|${'---|'.repeat(PER_ROW)}`, `| ${cells.join(' | ')} |`, '');
  }
  if (links.length > 0) {
    const items = links.map((e) => {
      const attempt = multiAttempt.has(pairKey(e.row, e.leg)) ? ` attempt ${e.attempt}` : '';
      return `[${altText(`${e.leg} ${LINKED[e.kind] ?? e.kind}${attempt}`)}](${e.path})`;
    });
    out.push(`Files: ${items.join(', ')}.`, '');
  }
  return out;
}

/** The planned row and leg pairs of a manifest, in plan order. */
export function plannedPairs(manifest: Manifest): Array<{ shot: Shot; leg: string }> {
  return manifest.shots.flatMap((shot) => shot.legs.map((leg) => ({ shot, leg })));
}

/**
 * Section 3: the text between the evidence markers. Each ledger file appears once: a still or a
 * video as `![alt](assets/<slug>/<file>)`, a trace, log or UI dump as a link.
 */
export function evidenceSection(input: EvidenceInput): string {
  const latest = new Map<string, RowResult>();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const multiAttempt = new Set<string>();
  for (const e of input.entries) if (e.attempt > 1) multiAttempt.add(pairKey(e.row, e.leg));
  for (const r of latest.values()) if (r.attempts > 1) multiAttempt.add(pairKey(r.row, r.leg));

  const out: string[] = [
    'The runner writes this part from the ledger. `lw qa report check` renders it again and refuses an edit.',
    'A label in parentheses names a provenance other than live.',
    '',
  ];
  const counts = { passed: 0, failed: 0, na: 0, notRun: 0, none: 0 };
  const planned = new Set<string>();
  for (const shot of input.manifest.shots) {
    out.push(`### ${cell(shot.screen)}, ${cell(shot.state)}`, '');
    out.push(`Row \`${shot.id}\`. Route \`${cell(shot.route).replace(/`/g, '%60')}\`. Expect: ${cell(expectText(shot))}`, '');
    for (const leg of shot.legs) {
      planned.add(pairKey(shot.id, leg));
      const r = latest.get(pairKey(shot.id, leg));
      if (!r) counts.none += 1;
      else if (r.status === 'passed') counts.passed += 1;
      else if (r.status === 'failed') counts.failed += 1;
      else if (r.status === 'n/a') counts.na += 1;
      else counts.notRun += 1;
      out.push(`- \`${leg}\`: ${resultText(r)}`);
    }
    out.push('');
    const files = input.entries
      .filter((e) => e.row === shot.id && shot.legs.includes(e.leg))
      .sort((a, b) => shot.legs.indexOf(a.leg) - shot.legs.indexOf(b.leg) || compareEntries(a, b));
    out.push(...rowFiles(files, shot, input.sizeOf, multiAttempt));
  }
  const outside = input.entries.filter((e) => !planned.has(pairKey(e.row, e.leg))).sort((a, b) => naturalCompare(a.row, b.row) || naturalCompare(a.leg, b.leg) || compareEntries(a, b));
  if (outside.length > 0) {
    out.push('### Files outside the plan', '', 'These ledger files belong to no planned row and leg.', '');
    out.push(...rowFiles(outside, null, input.sizeOf, multiAttempt));
  }
  const pairs = counts.passed + counts.failed + counts.na + counts.notRun + counts.none;
  out.push(
    `Totals: ${input.manifest.shots.length} rows, ${pairs} row legs, ${counts.passed} passed, ${counts.failed} failed, ` +
      `${counts.na} n/a, ${counts.notRun} not run, ${counts.none} with no result.`,
  );
  return out.join('\n');
}

// Section 5, `Legs:`, `Coverage:` ------------------------------------------------------------

/** One section 5 line: `` - `<row>` on `<leg>`: <reason> ``. The report check reads this form. */
export const NOT_COVERED_LINE = /^- `([a-z0-9-]+\.[a-z0-9-]+)` on `([a-z0-9-]+)`: (.*\S.*)$/;

/** A world state: a persona or fact id with the feature that owns it. */
export interface WorldState {
  id: string;
  feature?: string;
}

/**
 * The generated section 5 lines: every planned row and leg that is n/a, not run or failed, and
 * every world state that no row with evidence covers. A pair with no result gets no line: the
 * author writes its reason, or the report check fails.
 */
export function coverageSection(input: Omit<EvidenceInput, 'sizeOf' | 'slug'> & { world?: readonly WorldState[] }): string {
  const latest = new Map<string, RowResult>();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const out: string[] = [];
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const r = latest.get(pairKey(shot.id, leg));
    if (r && r.status !== 'passed') out.push(`- \`${shot.id}\` on \`${leg}\`: ${resultText(r)}`);
  }
  const world = input.world ?? [];
  if (world.length > 0) {
    const covered = coveredStates(input);
    const open = world.filter((w) => !covered.has(w.id));
    if (out.length > 0) out.push('');
    out.push(`${world.length - open.length} of ${world.length} world states have a passed row with evidence.`);
    if (open.length > 0) {
      out.push('', '| State | Feature | Why it has no evidence |', '|---|---|---|');
      for (const w of open) {
        const named = input.manifest.shots.some((s) => s.fixture.persona === w.id || (s.fixture.facts ?? []).includes(w.id));
        out.push(`| \`${w.id}\` | ${cell(w.feature ?? '')} | ${named ? 'a row names it and no leg passed' : 'no row names it'} |`);
      }
    }
  }
  if (out.length === 0) out.push('Every planned row and leg ran and passed.');
  return out.join('\n');
}

function coveredStates(input: Omit<EvidenceInput, 'sizeOf' | 'slug'>): Set<string> {
  const latest = new Map<string, RowResult>();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const out = new Set<string>();
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const key = pairKey(shot.id, leg);
    if (latest.get(key)?.status !== 'passed' || !withFiles.has(key)) continue;
    if (shot.fixture.persona) out.add(shot.fixture.persona);
    for (const f of shot.fixture.facts ?? []) out.add(f);
  }
  return out;
}

/** The `Legs:` header value: the legs that ran, then each leg that did not run with its reason. */
export function legsLine(manifest: Manifest, results: readonly RowResult[]): string {
  const legs: string[] = [];
  for (const shot of manifest.shots) for (const leg of shot.legs) if (!legs.includes(leg)) legs.push(leg);
  const latest = new Map<string, RowResult>();
  for (const r of results) latest.set(pairKey(r.row, r.leg), r);
  const ran: string[] = [];
  const not: string[] = [];
  for (const leg of legs) {
    const rs = manifest.shots.filter((s) => s.legs.includes(leg)).map((s) => latest.get(pairKey(s.id, leg)));
    if (rs.some((r) => r?.status === 'passed' || r?.status === 'failed')) ran.push(leg);
    else {
      const reason = rs.find((r) => r?.reason)?.reason;
      not.push(`${leg} (${reason ? cell(reason) : rs.every((r) => !r) ? 'no result' : 'not run'})`);
    }
  }
  return [ran.length > 0 ? ran.join(', ') : 'none ran', not.length > 0 ? `not run: ${not.join(', ')}` : ''].filter(Boolean).join('; ');
}

/** The `Coverage:` header value. */
export function coverageLine(input: Omit<EvidenceInput, 'sizeOf' | 'slug'> & { world?: readonly WorldState[] }): string {
  const latest = new Map<string, RowResult>();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const pairs = plannedPairs(input.manifest);
  const passed = pairs.filter(({ shot, leg }) => latest.get(pairKey(shot.id, leg))?.status === 'passed' && withFiles.has(pairKey(shot.id, leg))).length;
  const base = `${passed} of ${pairs.length} row legs passed with evidence`;
  const world = input.world ?? [];
  if (world.length === 0) return base;
  const covered = coveredStates(input);
  return `${base}, ${world.filter((w) => covered.has(w.id)).length} of ${world.length} world states`;
}
