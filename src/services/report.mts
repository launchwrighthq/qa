// The QA report (spec 2.12): `<reportDir>/<slug>.md`, where the slug is `YYYY-MM-DD-<name>`. The
// header lines and six sections, the computed status, the report check, the update that writes the
// generated parts, and the HTML render through the spec renderer (`renderBody` of `../render`).
//
// The plan is `<reportDir>/<slug>.shots.json` and the evidence is under `assets/<slug>/`, as
// `ledger.mts` lists. The check reads only these files and, for an issue pass, the intake records
// that section 4 links (spec 2.15.4).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { escapeHtml, LaunchwrightError } from '@launchwrighthq/kernel';
import { pathKind, readTextOrNull } from '@launchwrighthq/kernel/fs';
import {
  COVERAGE_END,
  COVERAGE_START,
  coverageLine,
  coverageSection,
  EVIDENCE_END,
  EVIDENCE_START,
  evidenceSection,
  legsLine,
  NOT_COVERED_LINE,
  plannedPairs,
  type WorldState,
} from './evidence.mts';
import { type Ledger, LEDGER_FILE, pairKey, readLedger, readResults, reportPaths, RESULTS_FILE, verifyLedger } from './ledger.mts';
import { type Manifest, validateManifest, type ValidateOptions } from './manifest.mts';
import { blankFailure, pngSize, type PngSize } from './png.mts';
import { computeScore, renderScoreGauge, type ScoreInput } from './score.mts';
import { inline, plain, renderBody, TEMPLATE_DIR } from '../render/index.mts';
import { INTAKE_DIR, type LedgerEntry, type QaIssue, REPORT_STATUSES, type ReportStatus, type RowResult } from './types.mts';

/** The six sections, by number (spec 2.12.1). The check matches the number, so a translated title passes. */
export const REPORT_SECTIONS = [
  { n: 1, title: 'What this run covered' },
  { n: 2, title: 'What the code claims' },
  { n: 3, title: 'What was seen' },
  { n: 4, title: 'Findings' },
  { n: 5, title: 'Not covered' },
  { n: 6, title: 'How to retest' },
] as const;

/** The header fields. One of `Range`, `Spec` or `Issues` names what the pass covers. */
export const HEADER_FIELDS = ['Date', 'Status', 'Range', 'Spec', 'Issues', 'Legs', 'Coverage'] as const;
type HeaderField = (typeof HEADER_FIELDS)[number];

const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_RE = /^(Date|Status|Range|Spec|Issues|Legs|Coverage):\s*(.*)$/;
const SECTION_RE = /^##\s+(\d+)\.?(?:\s|$)/;

/** The slug of a report path: the file name without `.md`. Fails with `qa.report.slug`. */
export function slugOf(mdPath: string): string {
  const slug = basename(mdPath).replace(/\.md$/, '');
  if (!mdPath.endsWith('.md') || !SLUG_RE.test(slug)) {
    throw new LaunchwrightError('qa.report.slug', `${mdPath}: a report is <reportDir>/YYYY-MM-DD-<name>.md, with a kebab-case name`, { context: { path: mdPath } });
  }
  return slug;
}

/** One problem of a report. `row` and `leg` name the evidence it concerns. */
export interface ReportProblem {
  code:
    | 'header'
    | 'section'
    | 'plan'
    | 'ledger'
    | 'missing-file'
    | 'hash'
    | 'unlisted-file'
    | 'block'
    | 'block-edited'
    | 'unembedded'
    | 'embedded-twice'
    | 'embed-unledgered'
    | 'embed-outside'
    | 'status'
    | 'no-evidence'
    | 'blank'
    | 'intake-link'
    | 'issue-statement'
    | 'issue-unknown'
    | 'issue-evidence';
  message: string;
  row?: string;
  leg?: string;
}

/**
 * The computed status (spec 2.12.2). A `passed` result without ledger evidence counts as not run.
 * A `forged` entry is an inferred seed or a direct row write (spec 2.5), not live evidence, so a row
 * reached only by a forged seed never counts as a live pass and leaves the report partial.
 */
export function computeStatus(input: { manifest: Manifest; results: readonly RowResult[]; entries: readonly LedgerEntry[] }): ReportStatus {
  if (input.results.length === 0) return 'planned';
  const latest = new Map<string, RowResult>();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.filter((e) => e.provenance !== 'forged').map((e) => pairKey(e.row, e.leg)));
  let failed = false;
  let incomplete = false;
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const key = pairKey(shot.id, leg);
    const r = latest.get(key);
    if (r?.status === 'failed') failed = true;
    else if (r?.status !== 'passed' || !withFiles.has(key)) incomplete = true;
  }
  if (failed) return 'failed';
  return incomplete ? 'partial' : 'passed';
}

interface Parsed {
  lines: string[];
  /** The index of the first `## ` line, or the line count. */
  bodyStart: number;
  title: string | null;
  fields: Map<HeaderField, { value: string; line: number }>;
  /** Section number to its line index. Repeated numbers keep every index. */
  sections: Map<number, number[]>;
}

function parse(text: string): Parsed {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => l.startsWith('## '));
  const bodyStart = first === -1 ? lines.length : first;
  const fields = new Map<HeaderField, { value: string; line: number }>();
  let title: string | null = null;
  for (let i = 0; i < bodyStart; i += 1) {
    const line = lines[i] as string;
    if (title === null && /^#\s/.test(line)) title = line.slice(1).trim();
    const m = FIELD_RE.exec(line);
    if (m && !fields.has(m[1] as HeaderField)) fields.set(m[1] as HeaderField, { value: (m[2] as string).trim(), line: i });
  }
  const sections = new Map<number, number[]>();
  let fence = false;
  lines.forEach((line, i) => {
    if (line.startsWith('```')) fence = !fence;
    if (fence) return;
    const m = SECTION_RE.exec(line);
    if (m) sections.set(Number(m[1]), [...(sections.get(Number(m[1])) ?? []), i]);
  });
  return { lines, bodyStart, title, fields, sections };
}

/** The line range `[from, to)` of a section's body, or null when the section is missing. */
function sectionRange(p: Parsed, n: number): [number, number] | null {
  const at = p.sections.get(n)?.[0];
  if (at === undefined) return null;
  let end = p.lines.length;
  for (let i = at + 1; i < p.lines.length; i += 1) {
    if (/^##\s/.test(p.lines[i] as string)) {
      end = i;
      break;
    }
  }
  return [at + 1, end];
}

/** The marker block inside a range: the marker line indices, or a problem text. */
function findBlock(p: Parsed, range: [number, number] | null, start: string, end: string): { from: number; to: number } | string {
  const starts: number[] = [];
  const ends: number[] = [];
  p.lines.forEach((l, i) => {
    if (l.trim() === start) starts.push(i);
    if (l.trim() === end) ends.push(i);
  });
  if (starts.length !== 1 || ends.length !== 1) return `the report needs one ${start} and one ${end}; it has ${starts.length} and ${ends.length}`;
  const from = starts[0] as number;
  const to = ends[0] as number;
  if (to <= from) return `${end} comes before ${start}`;
  if (!range || from < range[0] || to >= range[1]) return `the ${start} block is not inside its section`;
  return { from, to };
}

const blockText = (lines: string[], from: number, to: number): string => lines.slice(from + 1, to).join('\n').trim();

/** Every embed and asset link of a text, with code spans and fences left out. */
function references(lines: string[]): Array<{ url: string; image: boolean; line: number }> {
  const out: Array<{ url: string; image: boolean; line: number }> = [];
  let fence = false;
  lines.forEach((raw, i) => {
    if (raw.startsWith('```')) {
      fence = !fence;
      return;
    }
    if (fence) return;
    const line = raw.replace(/`[^`]*`/g, '');
    const rest = line.replace(/!\[[^\]]*\]\(([^)]*)\)/g, (_m, url: string) => {
      out.push({ url: url.trim(), image: true, line: i });
      return '';
    });
    for (const m of rest.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) {
      const url = (m[1] as string).trim();
      if (url.startsWith('assets/') || url.startsWith('./assets/') || url.startsWith('../') || url.includes(INTAKE_DIR)) out.push({ url, image: false, line: i });
    }
  });
  return out;
}

/** Gives every embed and link outside code spans and fences to `fn`. A text that `fn` returns replaces it. */
function rewriteLinks(lines: string[], fn: (link: { alt: string; url: string }) => string | null): string[] {
  let fence = false;
  return lines.map((raw) => {
    if (raw.startsWith('```')) {
      fence = !fence;
      return raw;
    }
    if (fence) return raw;
    return raw
      .split(/(`[^`]*`)/)
      .map((piece, i) => (i % 2 === 1 ? piece : piece.replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, (m, alt: string, url: string) => fn({ alt, url: url.trim() }) ?? m)))
      .join('');
  });
}

/** A report link that resolves to `<root>/.lw/qa/intake/<id>/assets/<file>` (spec 2.15.4). */
export interface IntakeTarget {
  id: string;
  /** Relative to the record folder, as `issue.json` lists it: `assets/<file>`. */
  file: string;
}

/**
 * The intake file that a relative link points at, or null for any other link. `fromDir` is the
 * folder of the file that holds the link: the report folder, or `dist/` for the rendered page.
 */
export function intakeTarget(fromDir: string, root: string, url: string): IntakeTarget | null {
  if (url === '' || isAbsolute(url) || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) return null;
  const rel = relative(resolve(root, INTAKE_DIR), resolve(fromDir, url)).split(sep).join('/');
  const m = /^([A-Za-z0-9._-]+)\/assets\/([^/]+)$/.exec(rel);
  if (!m || m[1] === '..' || m[2] === '..') return null;
  return { id: m[1] as string, file: `assets/${m[2] as string}` };
}

/** The plain text that replaces a link to reporter media in a published report and page. */
export const intakeStaysLocal = (id: string): string => `reporter media of issue ${id} stays local`;

/** The published copy of a report text: each link and embed of reporter media becomes plain text (spec 2.15.1, 2.15.4). */
export function withoutIntakeLinks(text: string, reportDir: string, root: string): string {
  return rewriteLinks(text.split('\n'), ({ url }) => {
    const target = intakeTarget(reportDir, root, url);
    return target ? intakeStaysLocal(target.id) : null;
  }).join('\n');
}

/** One section 4 line per issue of the `Issues:` header (spec 2.15.4). */
export const ISSUE_STATEMENT = /^- issue ([A-Za-z0-9._-]+): (REPRODUCED|NOT REPRODUCED)$/;
/** A line that starts like a statement, so a malformed one is named and not passed over. */
const STATEMENT_LIKE = /^- issue \S+:/;

/** The ids of the `Issues:` header line, split on commas and spaces. */
function headerIssues(p: Parsed): string[] {
  return (p.fields.get('Issues')?.value ?? '').split(/[\s,]+/).filter(Boolean);
}

/** Reads `<root>/.lw/qa/intake/<id>/issue.json`, or null when the record does not exist. */
async function readIntakeRecord(root: string, id: string): Promise<QaIssue | null> {
  const file = join(root, INTAKE_DIR, id, 'issue.json');
  const text = await readTextOrNull(file);
  if (text === null) return null;
  try {
    return JSON.parse(text) as QaIssue;
  } catch (cause) {
    throw new LaunchwrightError('qa.report.read', `The intake record ${INTAKE_DIR}/${id}/issue.json is not JSON`, { cause, context: { id } });
  }
}

/** The files under a folder, relative to it, posix separators. */
async function walk(dir: string): Promise<string[]> {
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new LaunchwrightError('qa.report.read', `Cannot list ${dir}`, { cause });
  }
  const out: string[] = [];
  for (const d of names) {
    if (d.isDirectory()) for (const f of await walk(join(dir, d.name))) out.push(`${d.name}/${f}`);
    else out.push(d.name);
  }
  return out.sort();
}

/** A report and the files beside it. */
export interface LoadedReport {
  mdPath: string;
  reportDir: string;
  slug: string;
  text: string;
  manifest: Manifest | null;
  manifestErrors: string[];
  results: RowResult[];
  ledger: Ledger | null;
}

/** Reads a report, its plan, its row results and its ledger. */
export async function loadReport(mdPath: string, opts: ValidateOptions = {}): Promise<LoadedReport> {
  const slug = slugOf(mdPath);
  const reportDir = dirname(mdPath);
  const paths = reportPaths(reportDir, slug);
  let text: string;
  try {
    text = await readFile(mdPath, 'utf8');
  } catch (cause) {
    throw new LaunchwrightError('qa.report.read', `Cannot read the report ${mdPath}`, { cause, context: { path: mdPath } });
  }
  let manifest: Manifest | null = null;
  let manifestErrors: string[] = [];
  let planRaw: string | null = null;
  try {
    planRaw = await readFile(paths.plan, 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw new LaunchwrightError('qa.report.read', `Cannot read the plan ${paths.plan}`, { cause });
    manifestErrors = [`the plan ${basename(paths.plan)} is missing`];
  }
  if (planRaw !== null) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(planRaw);
    } catch (cause) {
      manifestErrors = [`the plan ${basename(paths.plan)} is not JSON: ${(cause as Error).message}`];
    }
    if (manifestErrors.length === 0) {
      manifestErrors = validateManifest(parsed, opts);
      if (manifestErrors.length === 0) manifest = parsed as Manifest;
    }
  }
  return { mdPath, reportDir, slug, text, manifest, manifestErrors, results: await readResults(paths.results), ledger: await readLedger(paths.ledger) };
}

/** PNG sizes of the stills of a ledger, by report-relative path. A missing file has no size. */
async function stillSizes(reportDir: string, entries: readonly LedgerEntry[]): Promise<Map<string, PngSize | null>> {
  const out = new Map<string, PngSize | null>();
  for (const e of entries) {
    if (e.kind !== 'screenshot' && e.kind !== 'step') continue;
    let bytes: Buffer | null = null;
    try {
      bytes = await readFile(join(reportDir, e.path));
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw new LaunchwrightError('qa.report.read', `Cannot read ${e.path}`, { cause });
    }
    out.set(e.path, bytes ? pngSize(bytes) : null);
  }
  return out;
}

/** The generated section 3 of a loaded report, as a fresh render from its files. */
export async function renderEvidence(r: LoadedReport & { manifest: Manifest }): Promise<string> {
  const entries = r.ledger?.entries ?? [];
  const sizes = await stillSizes(r.reportDir, entries);
  return evidenceSection({ slug: r.slug, manifest: r.manifest, results: r.results, entries, sizeOf: (p) => sizes.get(p) ?? null });
}

export interface CheckOptions extends ValidateOptions {
  /** `qa.evidence.blankStdDev`. Default 2. */
  blankStdDev?: number;
  /** The project root. A section 4 link to reporter media resolves against it. Without it, every such link is outside `assets/<slug>/`. */
  root?: string;
}

/** The problems of one link to reporter media (spec 2.15.4). The link sits in section 4, for an issue of the header, to a file of the record. */
async function intakeLinkProblem(input: { root: string; target: IntakeTarget; url: string; line: number; inSection4: boolean; issues: readonly string[] }): Promise<string | null> {
  const { root, target, url, line } = input;
  const at = `line ${line + 1}: ${url}`;
  if (!input.inSection4) return `${at} links reporter media of issue ${target.id} outside section 4`;
  if (!input.issues.includes(target.id)) return `${at} links issue ${target.id}, which the Issues: header line does not list`;
  const record = await readIntakeRecord(root, target.id);
  if (!record) return `${at} links issue ${target.id}, which has no record in ${INTAKE_DIR}/`;
  if (!record.attachments.some((a) => a.path === target.file)) return `${at} is not an attachment of issue ${target.id} in its issue.json`;
  if (!('missing' !== await pathKind(join(root, INTAKE_DIR, target.id, target.file)))) return `${at} is missing from ${INTAKE_DIR}/${target.id}/`;
  return null;
}

/**
 * The section 4 statements of an issue pass (spec 2.15.4): one `- issue <id>: REPRODUCED` or
 * `- issue <id>: NOT REPRODUCED` line per id of the `Issues:` header, each with ledger evidence of
 * a row whose `source` holds `issue:<id>`. An issue of the plan (its `issues` or a row source) must
 * be on the `Issues:` line, so a report header cannot drop the statement.
 */
function issueStatementProblems(p: Parsed, manifest: Manifest, entries: readonly LedgerEntry[]): ReportProblem[] {
  const out: ReportProblem[] = [];
  const issues = headerIssues(p);
  const s4 = sectionRange(p, 4);
  const stated = new Map<string, number>();
  let fence = false;
  if (s4) for (let i = s4[0]; i < s4[1]; i += 1) {
    const line = (p.lines[i] as string).trim();
    if (line.startsWith('```')) fence = !fence;
    if (fence) continue;
    const m = ISSUE_STATEMENT.exec(line);
    if (!m) {
      if (STATEMENT_LIKE.test(line)) out.push({ code: 'issue-statement', message: `line ${i + 1}: "${line}" is not "- issue <id>: REPRODUCED" or "- issue <id>: NOT REPRODUCED"` });
      continue;
    }
    const id = m[1] as string;
    if (stated.has(id)) out.push({ code: 'issue-statement', message: `line ${i + 1}: issue ${id} has a second statement in section 4` });
    stated.set(id, i);
  }
  const withFiles = new Set(entries.map((e) => e.row));
  const planIssues = new Set([...(manifest.issues ?? []), ...manifest.shots.flatMap((s) => s.source.filter((x) => x.startsWith('issue:')).map((x) => x.slice(6)))]);
  for (const id of planIssues) {
    if (!issues.includes(id)) out.push({ code: 'issue-statement', message: `the plan names issue ${id}, and the header has no Issues: line that lists it` });
  }
  for (const id of issues) {
    if (!stated.has(id)) out.push({ code: 'issue-statement', message: `issue ${id} of the Issues: line has no section 4 line "- issue ${id}: REPRODUCED" or "- issue ${id}: NOT REPRODUCED"` });
  }
  for (const [id, line] of stated) {
    if (!issues.includes(id)) {
      out.push({ code: 'issue-unknown', message: `line ${line + 1}: issue ${id} is not on the Issues: header line` });
      continue;
    }
    const rows = manifest.shots.filter((s) => s.source.includes(`issue:${id}`)).map((s) => s.id);
    if (!rows.some((row) => withFiles.has(row))) {
      out.push({ code: 'issue-evidence', message: `line ${line + 1}: issue ${id} has a statement and no ledger evidence. No row with source issue:${id} has a file in the ledger${rows.length === 0 ? ', and the plan has no such row' : ''}.` });
    }
  }
  return out;
}

/** Every problem of a report (spec 2.12.3). An empty list means the report passes. */
export async function checkReport(mdPath: string, opts: CheckOptions = {}): Promise<ReportProblem[]> {
  const r = await loadReport(mdPath, opts);
  const p = parse(r.text);
  const problems: ReportProblem[] = [];
  const add = (code: ReportProblem['code'], message: string, where: { row?: string; leg?: string } = {}): void => {
    problems.push({ code, message, ...where });
  };

  if (p.title === null) add('header', 'the report has no "# " title line');
  for (const field of ['Date', 'Status', 'Legs', 'Coverage'] as const) if (!p.fields.has(field)) add('header', `the header line ${field}: is missing`);
  if (!p.fields.has('Range') && !p.fields.has('Spec') && !p.fields.has('Issues')) add('header', 'the header needs a Range:, Spec: or Issues: line');
  const order: number[] = [];
  for (const { n } of REPORT_SECTIONS) {
    const at = p.sections.get(n) ?? [];
    if (at.length === 0) add('section', `section ${n} is missing: "## ${n} ..."`);
    if (at.length > 1) add('section', `section ${n} appears ${at.length} times`);
    if (at.length > 0) order.push(at[0] as number);
  }
  if (order.some((v, i) => i > 0 && v < (order[i - 1] as number))) add('section', 'the sections are not in the order 1 to 6');

  for (const e of r.manifestErrors) add('plan', e);
  if (!r.manifest) return problems;
  const manifest = r.manifest;
  const entries = r.ledger?.entries ?? [];
  if (r.ledger && r.ledger.slug !== r.slug) add('ledger', `the ledger names slug ${r.ledger.slug}, not ${r.slug}`);

  const ledgerProblems = await verifyLedger(r.reportDir, entries);
  for (const lp of ledgerProblems) add(lp.code, lp.message, { row: lp.row, leg: lp.leg });
  const listed = new Set(entries.map((e) => e.path));
  const assetsRel = `assets/${r.slug}`;
  for (const file of await walk(join(r.reportDir, assetsRel))) {
    if (file === LEDGER_FILE || file === RESULTS_FILE) continue;
    if (!listed.has(`${assetsRel}/${file}`)) add('unlisted-file', `${assetsRel}/${file} is in the report folder and not in the ledger. Only the runner captures evidence.`);
  }

  const block = findBlock(p, sectionRange(p, 3), EVIDENCE_START, EVIDENCE_END);
  const inBlock = new Map<string, number>();
  if (typeof block === 'string') add('block', block);
  else {
    const fresh = await renderEvidence({ ...r, manifest });
    const current = blockText(p.lines, block.from, block.to);
    if (current !== fresh.trim()) {
      const a = current.split('\n');
      const b = fresh.trim().split('\n');
      let i = 0;
      while (i < a.length && a[i] === b[i]) i += 1;
      add('block-edited', `the generated section 3 differs from a fresh render of the ledger at report line ${block.from + 2 + i}. Run lw qa report update, never edit the block.`);
    }
    for (const ref of references(p.lines.slice(block.from + 1, block.to))) inBlock.set(ref.url, (inBlock.get(ref.url) ?? 0) + 1);
  }

  for (const e of entries) {
    const n = inBlock.get(e.path) ?? 0;
    if (typeof block !== 'string' && n === 0) add('unembedded', `${e.path} is in the ledger and not embedded in section 3`, { row: e.row, leg: e.leg });
    if (n > 1) add('embedded-twice', `${e.path} is embedded ${n} times in section 3`, { row: e.row, leg: e.leg });
  }
  const s4 = sectionRange(p, 4);
  const issues = headerIssues(p);
  for (const ref of references(p.lines)) {
    const target = opts.root === undefined ? null : intakeTarget(r.reportDir, opts.root, ref.url);
    if (target && opts.root !== undefined) {
      const inSection4 = s4 !== null && ref.line >= s4[0] && ref.line < s4[1];
      const problem = await intakeLinkProblem({ root: opts.root, target, url: ref.url, line: ref.line, inSection4, issues });
      if (problem) add('intake-link', problem);
    } else if (!ref.url.startsWith(`${assetsRel}/`) || ref.url.split('/').includes('..')) {
      add('embed-outside', `line ${ref.line + 1}: ${ref.url} is outside ${assetsRel}/`);
    } else if (!listed.has(ref.url)) {
      add('embed-unledgered', `line ${ref.line + 1}: ${ref.url} has no ledger entry`);
    }
  }

  const status = computeStatus({ manifest, results: r.results, entries });
  const written = p.fields.get('Status')?.value.split(/\s/)[0] ?? '';
  if (p.fields.has('Status') && written !== status) {
    add('status', `Status: ${written || '(empty)'} differs from the computed status ${status}${(REPORT_STATUSES as readonly string[]).includes(written) ? '' : `. Statuses: ${REPORT_STATUSES.join(', ')}`}`);
  }

  if (status !== 'planned') {
    problems.push(...issueStatementProblems(p, manifest, entries));
    const s5 = sectionRange(p, 5);
    const reasons = new Set<string>();
    if (s5) for (const line of p.lines.slice(s5[0], s5[1])) {
      const m = NOT_COVERED_LINE.exec(line.trim());
      if (m) reasons.add(pairKey(m[1] as string, m[2] as string));
    }
    const withFiles = new Set(entries.map((e) => pairKey(e.row, e.leg)));
    for (const { shot, leg } of plannedPairs(manifest)) {
      const key = pairKey(shot.id, leg);
      if (!withFiles.has(key) && !reasons.has(key)) {
        add('no-evidence', `row ${shot.id} on leg ${leg} has no ledger evidence and no section 5 line "- \`${shot.id}\` on \`${leg}\`: <reason>"`, { row: shot.id, leg });
      }
    }
    const latest = new Map<string, RowResult>();
    for (const res of r.results) latest.set(pairKey(res.row, res.leg), res);
    const broken = new Set(ledgerProblems.map((x) => x.path));
    for (const e of entries) {
      if ((e.kind !== 'screenshot' && e.kind !== 'step') || broken.has(e.path)) continue;
      if (latest.get(pairKey(e.row, e.leg))?.status !== 'passed') continue;
      let blank: string | null;
      try {
        blank = blankFailure(await readFile(join(r.reportDir, e.path)), opts.blankStdDev ?? 2);
      } catch (cause) {
        if (!(cause instanceof LaunchwrightError) || cause.code !== 'qa.png.unsupported') throw cause;
        add('blank', `${e.path} cannot be read as a PNG (${cause.message}), and its row passed (row ${e.row}, leg ${e.leg})`, { row: e.row, leg: e.leg });
        continue;
      }
      if (blank) add('blank', `${e.path} is blank and its row passed (row ${e.row}, leg ${e.leg})`, { row: e.row, leg: e.leg });
    }
  }
  return problems;
}

/** Replaces the text between two marker lines, or inserts the block at the end of a section. */
function putBlock(lines: string[], start: string, end: string, body: string, section: number): string[] {
  const p = parse(lines.join('\n'));
  const block = findBlock(p, sectionRange(p, section), start, end);
  if (typeof block !== 'string') return [...lines.slice(0, block.from + 1), ...body.split('\n'), ...lines.slice(block.to)];
  if (lines.some((l) => l.trim() === start || l.trim() === end)) {
    throw new LaunchwrightError('qa.report.block', `The report markers are broken: ${block}`);
  }
  const range = sectionRange(p, section);
  if (!range) throw new LaunchwrightError('qa.report.section', `The report has no section ${section}`);
  let at = range[1];
  while (at > range[0] && (lines[at - 1] as string).trim() === '') at -= 1;
  return [...lines.slice(0, at), '', start, ...body.split('\n'), end, '', ...lines.slice(range[1])];
}

function putField(lines: string[], field: HeaderField, value: string): string[] {
  const p = parse(lines.join('\n'));
  const at = p.fields.get(field)?.line;
  if (at !== undefined) return lines.map((l, i) => (i === at ? `${field}: ${value}` : l));
  const last = Math.max(...[...p.fields.values()].map((f) => f.line), lines.findIndex((l) => /^#\s/.test(l)));
  return [...lines.slice(0, last + 1), `${field}: ${value}`, ...lines.slice(last + 1)];
}

/**
 * Writes the generated parts of a report: section 3 between the evidence markers, the section 5
 * lines between the coverage markers, and the `Status:`, `Legs:` and `Coverage:` lines.
 */
export async function updateReport(mdPath: string, opts: ValidateOptions & { world?: readonly WorldState[] } = {}): Promise<ReportStatus> {
  const r = await loadReport(mdPath, opts);
  if (!r.manifest) {
    throw new LaunchwrightError('qa.report.plan', `The plan of ${mdPath} is invalid:\n  ${r.manifestErrors.join('\n  ')}`, { context: { errors: r.manifestErrors } });
  }
  const entries = r.ledger?.entries ?? [];
  const input = { manifest: r.manifest, results: r.results, entries, ...(opts.world ? { world: opts.world } : {}) };
  let lines = r.text.split('\n');
  lines = putBlock(lines, EVIDENCE_START, EVIDENCE_END, await renderEvidence({ ...r, manifest: r.manifest }), 3);
  lines = putBlock(lines, COVERAGE_START, COVERAGE_END, coverageSection(input), 5);
  const status = computeStatus(input);
  lines = putField(lines, 'Status', status);
  lines = putField(lines, 'Legs', legsLine(r.manifest, r.results));
  lines = putField(lines, 'Coverage', coverageLine(input));
  await writeFile(mdPath, lines.join('\n'));
  return status;
}

/** A new report with the header lines and the six sections, before any row runs. */
export function reportSkeleton(input: { title: string; date: string; source: { field: 'Range' | 'Spec' | 'Issues'; value: string } }): string {
  const out = [`# QA: ${input.title}`, '', `Date: ${input.date}`, 'Status: planned', `${input.source.field}: ${input.source.value}`, 'Legs: none ran', 'Coverage: 0 row legs', ''];
  for (const s of REPORT_SECTIONS) {
    out.push(`## ${s.n} ${s.title}`, '');
    if (s.n === 3) out.push(EVIDENCE_START, EVIDENCE_END, '');
    if (s.n === 5) out.push(COVERAGE_START, COVERAGE_END, '');
  }
  return out.join('\n');
}

// Score and render ----------------------------------------------------------------------------

/** The folder of the page template of the spec renderer. */
export const RENDERER_DIR = TEMPLATE_DIR;

/**
 * The score input the report's own data supports (spec 2.11). Coverage is the share of planned row
 * legs with a `live` or `mounted` ledger entry. Evidence is the share that passed with a real file.
 * The console band reads the page errors the results name. Findings, accessibility and performance
 * need a severity the report does not hold, so they stay untested and drop from the average.
 */
export function reportScoreInput(input: { manifest: Manifest; results: readonly RowResult[]; entries: readonly LedgerEntry[] }): ScoreInput {
  const pairs = plannedPairs(input.manifest);
  if (pairs.length === 0) return {};
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
  let covered = 0;
  let evidenced = 0;
  let ran = 0;
  let pageErrors = 0;
  for (const { shot, leg } of pairs) {
    const key = pairKey(shot.id, leg);
    const provs = provenances.get(key);
    if (provs?.has('live') || provs?.has('mounted')) covered += 1;
    const r = latest.get(key);
    if (r) ran += 1;
    if (r?.status === 'passed' && withFile.has(key)) evidenced += 1;
    if (r?.failures.includes('page-error')) pageErrors += 1;
  }
  const out: ScoreInput = { coverage: covered / pairs.length, evidence: evidenced / pairs.length };
  if (ran > 0) out.consoleErrors = pageErrors;
  return out;
}

/** The score gauge for the top of a run report's page, or '' for a report that has not run. */
function scoreBlock(loaded: LoadedReport): string {
  const entries = loaded.ledger?.entries ?? [];
  if (!loaded.manifest || (loaded.results.length === 0 && entries.length === 0)) return '';
  const input = reportScoreInput({ manifest: loaded.manifest, results: loaded.results, entries });
  if (Object.keys(input).length === 0) return '';
  const { score, confidence } = computeScore(input);
  const percent = Math.round(confidence * 100);
  const gauge = renderScoreGauge(score, { size: 132, label: `${percent}%` });
  return [
    '<div class="qa-score" style="display:flex;align-items:center;gap:1.1rem;margin:0 0 2.4rem;flex-wrap:wrap">',
    `<div style="flex:0 0 auto">${gauge}</div>`,
    `<p style="margin:0;max-width:34ch;color:var(--ink-soft)">QA score <strong style="color:var(--ink)">${score}</strong> of 100. The weighted score covers the dimensions this run tested. Confidence ${percent}% comes from the live coverage and the evidence.</p>`,
    '</div>',
    '',
  ].join('\n');
}

/**
 * Renders a report to `<reportDir>/dist/<slug>.html` with the spec renderer and the page template
 * in `rendererDir`. The page links the evidence as `../assets/<slug>/<file>`. `root` is the project
 * root, where the section 4 links to reporter media resolve. Returns the page path.
 */
export async function renderReport(mdPath: string, rendererDir: string, root: string): Promise<string> {
  const slug = slugOf(mdPath);
  const template = join(rendererDir, 'spec-template.html');
  let shell: string;
  try {
    shell = await readFile(template, 'utf8');
  } catch (cause) {
    throw new LaunchwrightError('qa.report.renderer', `The page template of the spec renderer is not at ${template}. Reinstall @launchwrighthq/qa.`, { cause, context: { template } });
  }
  const loaded = await loadReport(mdPath);
  const text = loaded.text;
  const p = parse(text);
  if (p.title === null) throw new LaunchwrightError('qa.report.header', `${mdPath}: the report has no "# " title line`);
  // The renderer draws only `assets/` images, and the page sits one folder below the report. So a
  // link or embed of reporter media becomes a link one folder up (spec 2.15.4).
  const reportDir = dirname(mdPath);
  const body = rewriteLinks(p.lines.slice(p.bodyStart), ({ alt, url }) => (intakeTarget(reportDir, root, url) === null ? null : `[${alt || 'reporter media'}](../${url})`));
  let rendered;
  try {
    rendered = renderBody({ lines: body, source: mdPath, bodyStart: p.bodyStart, assetPrefix: '../' });
  } catch (cause) {
    throw new LaunchwrightError('qa.report.render', `${mdPath}: ${(cause as Error).message}`, { cause });
  }
  const consumed = new Set([...p.fields.values()].map((f) => f.line));
  const standfirst = p.lines
    .slice(0, p.bodyStart)
    .filter((l, i) => !consumed.has(i) && !/^#\s/.test(l))
    .join('\n')
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  const field = (f: HeaderField): string | null => p.fields.get(f)?.value ?? null;
  const subject = field('Spec') ?? field('Issues');
  const range = field('Range');
  const values = new Map<string, string>([
    ['NAV', rendered.toc.map((e) => `<li><a href="#${e.anchor}"><span class="n">${e.eyebrow}</span>${escapeHtml(plain(e.title))}</a></li>`).join('')],
    ['BODY', scoreBlock(loaded) + rendered.body],
    ['TITLE', escapeHtml(p.title)],
    ['DATE', escapeHtml(field('Date') ?? slug.slice(0, 10))],
    ['STATUS', escapeHtml(field('Status') ?? '')],
    ['SUBJECT', subject === null ? '' : escapeHtml(subject)],
    ['RANGE', range === null ? '' : escapeHtml(range)],
    ['STANDFIRST', inline(standfirst, '../')],
    ['KIND', 'QA REPORT'],
    ['KIND_CLASS', 'kind-spec'],
    ['SOURCE', escapeHtml(relative(dirname(mdPath), mdPath))],
  ]);
  const chip = (v: string): string => (v === '' ? '' : `<li class="chip">${v}</li>`);
  // One pass, so a value that holds `{{X}}` text is never replaced again.
  const html = shell.replace(/<li class="chip">\{\{(STATUS|SUBJECT|RANGE)\}\}<\/li>|\{\{(\w+)\}\}/g, (_m, chipName: string | undefined, name: string | undefined) => {
    if (chipName) return chip(values.get(chipName) as string);
    const value = values.get(name as string);
    if (value === undefined) throw new LaunchwrightError('qa.report.template', `The renderer template has {{${name}}}, which the QA render does not fill`);
    return value;
  });
  const out = reportPaths(dirname(mdPath), slug).html;
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  return out;
}
