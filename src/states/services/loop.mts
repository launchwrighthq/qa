// The state loop (spec 2.7): plan, merge results, report and refuse. It owns no discovery and no
// rendering. The inventory comes from the scan, the expansion from `plannedCaptures`, and the
// pictures from the mounted and intercepted runners. The report counts against the unions the
// client declares, so "4 of 4" is a sentence it can write.
//
// A result line that carries no `reason` is `crashed`, never a code guessed from its text. A
// planned capture with no result line fails as `crashed`: a missing picture is never silent.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { Provenance } from '../../services/types.mts';
import {
  coverageFor,
  type DeliveryDescriptor,
  FAIL_REASONS,
  type FailReason,
  type Inventory,
  type Mechanism,
  mechanismFor,
  type PlannedCapture,
  plannedCaptures,
  PROVENANCE,
  solveSite,
  type StateResult,
  type UnionEntry,
  validateInventory,
} from './inventory.mts';
import type { Shape } from './solve.mts';

/** What each reason says, when the row carries no sentence of its own. */
export const SENTENCES: Record<FailReason, string> = {
  unreachable: 'no candidate input produced this member',
  identical: 'the DOM diff between two members is empty',
  'state-mismatch': "the feature's own function disagreed after injection",
  unmountable: 'the harness could not mount the component',
  'no-mechanism': 'the union is neither an input nor an output, so nothing can reach it',
  blocked: 'the run could not build a capture group the runner would accept',
  'not-run': 'the mechanism was not run',
  crashed: 'the capture failed, and the runner reported only a sentence',
};

const UNREPORTED = 'the runner exited without reporting this capture';

/** The reason of a row. An unknown one is `crashed`, never a guess. */
export function reasonOf(row: { reason?: unknown } | null | undefined): FailReason {
  return (FAIL_REASONS as readonly unknown[]).includes(row?.reason) ? (row?.reason as FailReason) : 'crashed';
}

/** An inventory from text, validated, or an error that names every problem. */
export function parseInventory(text: string, source: string): Inventory {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError('qa.states.inventory', `${source} is not JSON. Run "lw qa states scan" again.`, { cause, context: { source } });
  }
  const errors = validateInventory(parsed);
  if (errors.length > 0) {
    throw new LaunchwrightError('qa.states.inventory', `The inventory in ${source} is invalid, ${errors.length} problem(s):\n${errors.map((e) => `  ${e}`).join('\n')}`, {
      context: { source, errors },
    });
  }
  return parsed as Inventory;
}

/** Every file a union is declared in or reached from. A narrowed run matches against these. */
export function unionFiles(union: UnionEntry): string[] {
  const files = new Set([union.file]);
  for (const site of union.inputs) {
    files.add(site.file);
    if (site.componentFile) files.add(site.componentFile);
  }
  for (const site of union.outputs) files.add(site.file);
  return [...files].filter(Boolean).sort();
}

/**
 * The inventory narrowed to the unions that the given files or folders declare or consume. A
 * narrowed run drops unions, never members: the denominator stays the union.
 */
export function narrowInventory(inv: Inventory, paths: { files?: string[]; dirs?: string[] }): { inventory: Inventory; kept: string[]; dropped: string[] } {
  const files = new Set(paths.files ?? []);
  const dirs = (paths.dirs ?? []).filter(Boolean).map((d) => d.replace(/\/+$/, ''));
  const touches = (path: string): boolean => files.has(path) || dirs.some((dir) => path.startsWith(`${dir}/`));
  const kept: UnionEntry[] = [];
  const dropped: string[] = [];
  for (const union of inv.unions) {
    if (unionFiles(union).some(touches)) kept.push(union);
    else dropped.push(union.name);
  }
  return { inventory: { ...inv, unions: kept }, kept: kept.map((u) => u.name), dropped };
}

/** The unions that nothing takes and nothing returns. Each fails the run (spec 2.14 rule C1). */
export function neitherUnions(inv: Pick<Inventory, 'unions'>): UnionEntry[] {
  return inv.unions.filter((union) => union.kind === 'neither');
}

/** What a report calls the thing that draws a union: a component, else the function, else the type. */
export function subjectLabel(union: UnionEntry): string {
  for (const site of union.inputs) if (site.component) return site.component;
  for (const site of union.outputs) if (site.fn) return site.fn;
  for (const site of union.inputs) if (site.interface) return site.interface;
  return union.file.split('/').pop() ?? union.name;
}

/** The issue a `neither` union earns, ready to file by hand. Nothing here opens a connection. */
export function issueFor(union: UnionEntry): { title: string; body: string } {
  const members = union.members.map((m) => `\`${m}\``).join(' ');
  const title = `qa states: \`${union.name}\` is neither an input nor an output`;
  const body = [
    `File: \`${union.file}:${union.line}\``,
    `Members (${union.members.length}): ${members}`,
    '',
    `\`${union.name}\` is an exported closed union, so the QA state run counts its ${union.members.length} members.`,
    'It can reach none of them. No field of a props type holds the type, so a mount cannot set it.',
    'No function returns it, so the solver has nothing to run. The state exists only inside a conditional.',
    '',
    'Declare it in one of two ways:',
    '',
    `- give the component that branches on it a prop of type \`${union.name}\`, which makes it an input; or`,
    `- move the conditional into an exported function that returns \`${union.name}\`, which makes it an output.`,
    '',
    'Or mark it `@qa-states ignore <reason>` when nothing can ever render it.',
    '',
    'Found by `lw qa states scan`.',
  ].join('\n');
  return { title, body };
}

/** Every refusal of a run, as sentences, `neither` unions first. */
export function refusalLines(inventory: Pick<Inventory, 'unions'>, rows: readonly MergedRow[]): string[] {
  const lines: string[] = [];
  for (const union of neitherUnions(inventory)) {
    lines.push(
      `${union.name} (${union.file}) is neither an input nor an output: nothing takes it and nothing returns it, so no ` +
        `mechanism can reach its ${union.members.length} member(s). The state exists only inside a conditional, and the fix is to declare it.`,
    );
  }
  for (const row of rows) {
    if (row.ok) continue;
    const reason = reasonOf(row);
    if (reason === 'no-mechanism') continue;
    lines.push(`${row.id}: ${refusalFor(row)}.`);
  }
  return lines;
}

/** The runner's JSONL. A line that does not parse is reported, never skipped. */
export function parseResults(text: string): { attempts: StateResult[]; malformed: string[] } {
  const attempts: StateResult[] = [];
  const malformed: string[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformed.push(line.slice(0, 200));
      continue;
    }
    if (parsed && typeof parsed === 'object' && typeof (parsed as { id?: unknown }).id === 'string') attempts.push(parsed as StateResult);
    else malformed.push(line.slice(0, 200));
  }
  return { attempts, malformed };
}

/** A planned capture joined to its result line, or to the reason it has none. */
export type MergedRow = Partial<StateResult> &
  Partial<PlannedCapture> & { id: string; ok: boolean; reported: boolean; extra?: boolean; why?: string; error?: string | null };

/**
 * The planned captures joined to what the runner said. A capture nobody reported is a failure. An
 * attempt the plan did not ask for is kept: it is a second rendering of one member.
 */
export function mergeRows(
  captures: readonly PlannedCapture[],
  attempts: readonly StateResult[],
  options: { notRun?: Partial<Record<Mechanism, string>>; blocked?: Record<string, string> } = {},
): MergedRow[] {
  const notRun = options.notRun ?? {};
  const blocked = options.blocked ?? {};
  const byId = new Map<string, StateResult>();
  for (const attempt of attempts) byId.set(attempt.id, attempt);
  const rows: MergedRow[] = [];
  const claimed = new Set<string>();
  for (const capture of captures) {
    const attempt = byId.get(capture.id);
    if (attempt) {
      claimed.add(capture.id);
      rows.push({ ...capture, ...attempt, ok: attempt.ok === true, reported: true });
      continue;
    }
    const blockedWhy = blocked[capture.union];
    const notRunWhy = capture.mechanism === null ? undefined : notRun[capture.mechanism];
    if (capture.mechanism === null) rows.push({ ...capture, ok: false, reported: false, reason: 'no-mechanism' });
    else if (blockedWhy !== undefined) rows.push({ ...capture, ok: false, reported: false, reason: 'blocked', why: blockedWhy });
    else if (notRunWhy !== undefined) rows.push({ ...capture, ok: false, reported: false, reason: 'not-run', why: notRunWhy });
    else rows.push({ ...capture, ok: false, reported: false, reason: 'crashed', error: UNREPORTED });
  }
  for (const attempt of attempts) {
    if (claimed.has(attempt.id)) continue;
    rows.push({ ...attempt, ok: attempt.ok === true, reported: true, extra: true });
  }
  return rows;
}

/** A Markdown cell: a pipe inside one eats the rest of the row. */
function cell(text: unknown): string {
  return String(text ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

/** The label of a shot. `live` has none, so the absence of a label means the data was real. */
export function provenanceLabel(provenance: Provenance | null | undefined): string | null {
  if (provenance === 'live') return null;
  if (provenance && PROVENANCE.includes(provenance)) return `(${provenance})`;
  return '(provenance not reported)';
}

function verifiedCell(row: MergedRow): string {
  if (row.verified === true) return row.answered ? `yes (${cell(row.answered)})` : 'yes';
  if (row.verified === false) return 'no';
  return 'not verified';
}

function stateCell(union: UnionEntry, row: MergedRow): string {
  if (row.member === null) return '`null` (the function returned nothing)';
  if (row.member !== undefined) return cell(row.member);
  const key = row.id.startsWith(`${union.name}.`) ? row.id.slice(union.name.length + 1) : row.id;
  return cell(key.replace(/#/g, ', ').replace(/-/g, ' '));
}

/** A union's rows, each extra rendering under the member it refines. */
function orderRows(union: UnionEntry, rows: readonly MergedRow[]): MergedRow[] {
  const planned = rows.filter((row) => !row.extra);
  const extras = rows.filter((row) => row.extra);
  const taken = new Set<MergedRow>();
  const out: MergedRow[] = [];
  for (const row of planned) {
    out.push(row);
    if (row.member === null || row.member === undefined) continue;
    for (const extra of extras) {
      if (taken.has(extra) || !extra.id.startsWith(`${union.name}.${row.member}#`)) continue;
      taken.add(extra);
      out.push(extra);
    }
  }
  for (const extra of extras) if (!taken.has(extra)) out.push(extra);
  return out;
}

/** One failed row's reason, as the sentence of its `Expect` cell. */
export function refusalFor(row: MergedRow): string {
  const reason = reasonOf(row);
  if (reason === 'unreachable') return `no candidate produced it (tried ${(row.fieldsTried ?? []).join(', ') || 'nothing'})`;
  if (reason === 'identical') return `identical to ${row.sameAs ?? 'another member'}: the DOM diff is empty`;
  if (reason === 'state-mismatch') return `intended ${row.intended ?? row.member ?? '?'}, the function answered ${row.actual ?? '?'}`;
  if (reason === 'unmountable') return `cannot mount ${row.component ?? 'the component'}: ${row.missingProp ?? 'missing prop not reported'}`;
  if (reason === 'blocked' || reason === 'not-run') return row.why ?? row.error ?? SENTENCES[reason];
  return row.error ?? SENTENCES[reason];
}

function unionOf(inventory: Pick<Inventory, 'unions'>, id: string): UnionEntry | null {
  let best: UnionEntry | null = null;
  for (const union of inventory.unions) {
    if (!id.startsWith(`${union.name}.`)) continue;
    if (!best || union.name.length > best.name.length) best = union;
  }
  return best;
}

/**
 * The state coverage section: a matrix per union, and the heading carries the arithmetic. It
 * counts renderings, not members, so a union may report more rows than members.
 */
export function renderReport(args: {
  inventory: Pick<Inventory, 'unions'>;
  rows: readonly MergedRow[];
  slug?: string;
  narrowedBy?: string | null;
  notRun?: Partial<Record<Mechanism, string>>;
}): string {
  const { inventory, rows, slug, narrowedBy = null, notRun = {} } = args;
  const out: string[] = [];
  const totals = { covered: 0, planned: 0 };
  out.push(`## State coverage${slug ? `: ${slug}` : ''}`);
  out.push('');
  if (narrowedBy) out.push(`Narrowed to ${narrowedBy}: ${inventory.unions.length} union(s) its files declare or consume.`);
  out.push(
    'A shot marked `(intercepted)` comes through a rewritten API response: the component is real and the data is synthetic. ' +
      '`(mounted)` is the harness drawing the component directly. A shot with no label comes from live data.',
  );
  for (const [mechanism, why] of Object.entries(notRun)) {
    out.push('');
    out.push(`Mechanism \`${mechanism}\` did not run: ${why}. Every capture it owns is uncovered below.`);
  }
  out.push('');
  for (const union of inventory.unions) {
    const mine = rows.filter((row) => row.id.startsWith(`${union.name}.`));
    const { covered, planned } = coverageFor(union, mine);
    totals.covered += covered;
    totals.planned += planned;
    out.push(`### ${subjectLabel(union)}: ${union.name}, ${covered} of ${planned} renderings`);
    out.push('');
    out.push('| State | Shot | Expect | Verified |');
    out.push('|---|---|---|---|');
    for (const row of orderRows(union, mine)) {
      const label = provenanceLabel(row.provenance);
      const shot = row.ok ? [row.subject ? `![${cell(row.id)}](${row.subject})` : 'shot, but no path reported', label].filter(Boolean).join(' ') : 'not shot';
      const expect = row.ok ? cell(row.expect ?? '-') : cell(refusalFor(row));
      out.push(`| ${stateCell(union, row)} | ${shot} | ${expect || '-'} | ${verifiedCell(row)} |`);
    }
    out.push('');
  }
  const orphans = rows.filter((row) => row.extra && !unionOf(inventory, row.id));
  if (orphans.length > 0) {
    out.push('### Reported by the runner, and in no union of the inventory');
    out.push('');
    for (const row of orphans) out.push(`- \`${cell(row.id)}\` (${row.ok ? 'ok' : 'failed'})`);
    out.push('');
  }
  out.push(`${inventory.unions.length} union(s), ${totals.covered} of ${totals.planned} renderings.`);
  return out.join('\n');
}

/** A capture group for the intercepted runner: one union, one route, one response. */
export interface CaptureGroup {
  id: string;
  union: string;
  leg: string;
  route: string;
  provenance: 'intercepted';
  intercept: { url: string; container: string };
  settle: DeliveryDescriptor['settle'];
  act?: unknown[];
  verify: { module: string; export: string; async?: boolean; args?: unknown[] };
  solve?: { shape: Shape; pivots?: { literals: number[]; names: string[] }; pivotModules?: string[]; limit?: number; batchSize?: number };
  members: { id: string; member: string | null; expect?: string | null; subject?: unknown }[];
  contrast?: unknown;
  diffRoot?: string;
  ignoreAttributes?: string[];
  maxSubjectAreaRatio?: number;
}

/**
 * One union's capture group, or the list of what is missing. The route, the response and the settle
 * come from `union.delivery`, because no scan can know them. The shape and the pivots come from
 * the scan, and the subjects are solved in the page.
 *
 * @param defaultLeg the leg a descriptor without `leg` runs on
 */
export function groupFor(union: UnionEntry, captures: readonly Pick<PlannedCapture, 'id' | 'member'>[], defaultLeg: string): { group: CaptureGroup; missing: null } | { group: null; missing: string[] } {
  const delivery = union.delivery ?? null;
  const missing: string[] = [];
  const route = typeof delivery?.route === 'string' && delivery.route !== '' ? delivery.route : null;
  if (!route) missing.push('route');
  const intercept = delivery?.intercept;
  if (typeof intercept?.url !== 'string' || intercept.url === '') missing.push('intercept.url');
  if (typeof intercept?.container !== 'string' || intercept.container === '') missing.push('intercept.container');
  const settle = delivery?.settle ?? null;
  if (!settle || (!settle.selector && !settle.artwork && !settle.video && !settle.busy)) missing.push('settle');
  const site = solveSite(union);
  const shape = site?.params[0]?.shape ?? null;
  if (!site) missing.push('verify');
  else if (!shape) missing.push('solve.shape');
  // A one-member group cannot be located by rotation, so it needs a contrast subject.
  if (captures.length === 1 && delivery?.contrast === undefined) missing.push('contrast');
  if (missing.length > 0 || !delivery || !route || !intercept || !settle || !site || !shape) return { group: null, missing };

  const group: CaptureGroup = {
    id: union.name,
    union: union.name,
    leg: delivery.leg ?? defaultLeg,
    route,
    provenance: 'intercepted',
    intercept: { url: intercept.url, container: intercept.container },
    settle,
    ...(delivery.act ? { act: delivery.act } : {}),
    verify: { module: site.file, export: site.fn, async: site.async, ...(delivery.verifyArgs ? { args: delivery.verifyArgs } : {}) },
    solve: {
      shape,
      pivots: { literals: site.pivots.literals, names: site.pivots.names },
      ...(delivery.pivotModules ? { pivotModules: delivery.pivotModules } : {}),
      ...(typeof delivery.limit === 'number' ? { limit: delivery.limit } : {}),
      ...(typeof delivery.batchSize === 'number' ? { batchSize: delivery.batchSize } : {}),
    },
    members: captures.map((capture) => ({ id: capture.id, member: capture.member, expect: capture.member })),
    ...(delivery.contrast === undefined ? {} : { contrast: delivery.contrast }),
    ...(delivery.diffRoot ? { diffRoot: delivery.diffRoot } : {}),
    ...(delivery.ignoreAttributes ? { ignoreAttributes: delivery.ignoreAttributes } : {}),
    ...(typeof delivery.maxSubjectAreaRatio === 'number' ? { maxSubjectAreaRatio: delivery.maxSubjectAreaRatio } : {}),
  };
  return { group, missing: null };
}

/** Every group the intercepted runner can take, and every union it cannot take, with the reason. */
export function groupsFor(inventory: Pick<Inventory, 'unions'>, captures: readonly PlannedCapture[], defaultLeg: string): { groups: CaptureGroup[]; blocked: Record<string, string> } {
  const groups: CaptureGroup[] = [];
  const blocked: Record<string, string> = {};
  for (const union of inventory.unions) {
    const mine = captures.filter((capture) => capture.union === union.name && capture.mechanism === 'solve');
    if (mine.length === 0) continue;
    const built = groupFor(union, mine, defaultLeg);
    if (built.group) groups.push(built.group);
    else {
      blocked[union.name] =
        `no capture group could be built. Missing: ${built.missing.join(', ')}. A delivery descriptor beside the union in ` +
        'the inventory gives the route, the intercept and the settle. The shape and the pivots come from the scan';
    }
  }
  return { groups, blocked };
}

/** The inventory with delivery descriptors attached by union name. */
export function mergeDelivery(inventory: Inventory, delivery: Record<string, DeliveryDescriptor>): Inventory {
  return { ...inventory, unions: inventory.unions.map((union) => (delivery[union.name] ? { ...union, delivery: delivery[union.name] } : union)) };
}

/** A state run plan: the inventory and every capture, before anything renders. */
export interface StatesPlan {
  generated: string;
  slug: string;
  source: string;
  scanned: number;
  narrowedBy: string | null;
  inventory: Inventory;
  captures: PlannedCapture[];
}

/** Builds the plan of a run from an inventory, narrowed when files or folders are given. */
export function buildPlan(args: { inventory: Inventory; source: string; slug: string; generated: string; narrow?: { files?: string[]; dirs?: string[]; label: string } }): StatesPlan {
  const { inventory: scanned, narrow } = args;
  const inventory = narrow ? narrowInventory(scanned, narrow).inventory : scanned;
  return {
    generated: args.generated,
    slug: args.slug,
    source: args.source,
    scanned: scanned.unions.length,
    narrowedBy: narrow?.label ?? null,
    inventory,
    captures: plannedCaptures(inventory),
  };
}

/** The plan as lines a person reads. */
export function renderPlan(plan: StatesPlan): string[] {
  const out: string[] = [];
  const byMechanism = new Map<string, number>();
  for (const capture of plan.captures) {
    const key = capture.mechanism ?? 'none';
    byMechanism.set(key, (byMechanism.get(key) ?? 0) + 1);
  }
  out.push(`inventory  ${plan.source}, ${plan.scanned} union(s)`);
  if (plan.narrowedBy) out.push(`narrowed   ${plan.inventory.unions.length} of ${plan.scanned} union(s) kept by ${plan.narrowedBy}`);
  const parts = ['mount', 'solve', 'none']
    .filter((key) => byMechanism.has(key))
    .map((key) => `${key} ${byMechanism.get(key)}`)
    .join(', ');
  out.push(`captures   ${plan.captures.length}${parts ? ` (${parts})` : ''}`);
  out.push('');
  for (const union of plan.inventory.unions) {
    const mine = plan.captures.filter((capture) => capture.union === union.name);
    out.push(
      `  ${union.name.padEnd(24)} ${union.kind.padEnd(8)} ${String(mechanismFor(union.kind) ?? 'none').padEnd(6)} ${String(mine.length).padStart(3)} capture(s)  ${union.file}`,
    );
  }
  return out;
}

/** The `neither` refusal, with the issue each union earns. Empty when there is none. */
export function renderNeither(inventory: Pick<Inventory, 'unions'>): string[] {
  const neither = neitherUnions(inventory);
  if (neither.length === 0) return [];
  const out = ['', `REFUSED   ${neither.length} union(s) are neither an input nor an output (spec 2.14 rule C1). Each one earns an issue:`];
  for (const union of neither) {
    const issue = issueFor(union);
    out.push('', `-- issue ${'-'.repeat(60)}`, issue.title, '', issue.body, '-'.repeat(69));
  }
  return out;
}

/**
 * The full report of a run and its exit code: the matrix, the refusals and the `neither` issues.
 * A mechanism that did not run counts against the exit code: coverage it did not measure is
 * coverage the report cannot claim.
 */
export function finishRun(args: {
  plan: StatesPlan;
  attempts: readonly StateResult[];
  malformed?: readonly string[];
  notRun?: Partial<Record<Mechanism, string>>;
  blocked?: Record<string, string>;
}): { lines: string[]; code: number; rows: MergedRow[] } {
  const { plan, attempts, malformed = [], notRun = {}, blocked = {} } = args;
  const rows = mergeRows(plan.captures, attempts, { notRun, blocked });
  const lines = [renderReport({ inventory: plan.inventory, rows, slug: plan.slug, narrowedBy: plan.narrowedBy, notRun })];
  for (const line of malformed) lines.push(`malformed result line, not read: ${line}`);
  const refusals = refusalLines(plan.inventory, rows);
  if (refusals.length > 0) {
    lines.push('', `REFUSED   ${refusals.length}, and each one is a failure:`);
    for (const line of refusals) lines.push(`  ${line}`);
  }
  const neither = renderNeither(plan.inventory);
  lines.push(...neither);
  const notRunCount = Object.keys(notRun).length;
  const failed = rows.filter((row) => !row.ok).length;
  const refused = neitherUnions(plan.inventory).length;
  lines.push('');
  if (failed === 0 && refused === 0 && notRunCount === 0) lines.push('every planned rendering was captured.');
  else lines.push(`${failed} rendering(s) uncovered, ${refused} union(s) refused, ${notRunCount} mechanism(s) not run.`);
  return { lines, code: failed > 0 || refused > 0 || notRunCount > 0 ? 1 : 0, rows };
}
