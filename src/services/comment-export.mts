// Agent comment resolution (spec 2.10, R10). `resolveComments` reads the comment store and the
// report, and resolves each open comment to the target it points at: a text quote and section, a
// step with its screenshot, a region with its screenshot and nearest step, a video time with the
// step then active, or a named flow. `exportTaskList` renders the result as an agent task list, one
// line per open comment. A resolved comment leaves the list.
import { type Manifest, type Shot } from './manifest.mts';
import type { Comment } from './comments.mts';
import type { LedgerEntry } from './types.mts';

/** What the resolver reads: the plan and the ledger of the report the comments sit on. */
export interface ExportContext {
  manifest: Manifest;
  entries: readonly LedgerEntry[];
}

/** One open comment resolved to its target (spec 2.10). */
export interface ResolvedComment {
  id: string;
  kind: Comment['anchor']['kind'];
  /** The file, screen or step the note points at. */
  target: string;
  /** The quoted or located target within it. */
  located: string;
  /** True when the anchor points at a screenshot or video the ledger no longer holds. */
  orphaned: boolean;
  /** The reviewer note, on one line. */
  note: string;
}

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();
const shotOf = (manifest: Manifest, row: string): Shot | undefined => manifest.shots.find((s) => s.id === row);
const screenState = (shot: Shot | undefined): string => (shot ? `${shot.screen} ${shot.state}` : '');
const inLedger = (entries: readonly LedgerEntry[], path: string): boolean => entries.some((e) => e.path === path);

/** The act step a step-screenshot path names: `...<id>.<step>.png`. */
function stepOfPath(path: string): number | null {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? Number(m[1]) : null;
}

/** The screenshot of a step on a row and leg, or the settle screenshot of the row and leg. */
function stepScreenshot(entries: readonly LedgerEntry[], row: string, leg: string, attempt: number, step: number): string | undefined {
  const stepShot = entries.find((e) => e.kind === 'step' && e.row === row && e.leg === leg && e.attempt === attempt && stepOfPath(e.path) === step);
  if (stepShot) return stepShot.path;
  return entries.find((e) => e.kind === 'screenshot' && e.row === row && e.leg === leg)?.path;
}

/** The round of a fraction to a percent, for a region rectangle. */
const pct = (v: number): number => Math.round(v * 100);

function resolveAnchor(anchor: Comment['anchor'], ctx: ExportContext): Pick<ResolvedComment, 'target' | 'located' | 'orphaned'> {
  if (anchor.kind === 'text') {
    const shot = shotOf(ctx.manifest, anchor.section);
    const where = shot ? `section ${anchor.section} (${screenState(shot)})` : `section ${anchor.section}`;
    return { target: where, located: `the words "${oneLine(anchor.quote)}"`, orphaned: false };
  }
  if (anchor.kind === 'step') {
    const shot = shotOf(ctx.manifest, anchor.row);
    const file = stepScreenshot(ctx.entries, anchor.row, anchor.leg, anchor.attempt, anchor.step);
    return { target: file ?? `${anchor.row} on ${anchor.leg}`, located: `step ${anchor.step} of ${screenState(shot) || anchor.row} on ${anchor.leg}`, orphaned: false };
  }
  if (anchor.kind === 'region') {
    const shot = shotOf(ctx.manifest, anchor.row);
    const near = stepOfPath(anchor.screenshot);
    const rect = `rectangle ${pct(anchor.x)}%,${pct(anchor.y)}% ${pct(anchor.w)}x${pct(anchor.h)}%`;
    const step = near === null ? 'the settle screenshot' : `step ${near}`;
    return { target: anchor.screenshot, located: `${rect} of ${screenState(shot) || anchor.row}, nearest ${step}`, orphaned: !inLedger(ctx.entries, anchor.screenshot) };
  }
  if (anchor.kind === 'time') {
    const shot = shotOf(ctx.manifest, anchor.row);
    const span = anchor.end === undefined ? `t=${anchor.start}s` : `t=${anchor.start}s to ${anchor.end}s`;
    const active = anchor.step === undefined ? '' : `, step ${anchor.step} then active`;
    return { target: anchor.video, located: `${span} of ${screenState(shot) || anchor.row}${active}`, orphaned: !inLedger(ctx.entries, anchor.video) };
  }
  const shot = shotOf(ctx.manifest, anchor.name);
  return { target: shot ? `${screenState(shot)} (${anchor.name})` : `flow ${anchor.name}`, located: `flow ${anchor.name}`, orphaned: false };
}

/** Every open comment resolved to its target (spec 2.10). A resolved comment is left out. */
export function resolveComments(comments: readonly Comment[], ctx: ExportContext): ResolvedComment[] {
  return comments
    .filter((c) => c.status === 'open')
    .map((c) => ({ id: c.id, kind: c.anchor.kind, ...resolveAnchor(c.anchor, ctx), note: oneLine(c.body) }));
}

/**
 * The agent task list of a report's open comments (spec 2.10): one line per open comment naming the
 * target, the located target and the note. The header states the count, so a build agent reads the
 * list and acts on the review.
 */
export function exportTaskList(comments: readonly Comment[], ctx: ExportContext): string {
  const resolved = resolveComments(comments, ctx);
  if (resolved.length === 0) return 'No open comments to act on.';
  const lines = [`${resolved.length} open comment${resolved.length === 1 ? '' : 's'} to act on:`, ''];
  for (const r of resolved) {
    const orphan = r.orphaned ? ' (orphaned: the ledger no longer holds this file)' : '';
    lines.push(`- [${r.kind}] ${r.target}${orphan}: ${r.located}. Note: ${r.note}`);
  }
  return lines.join('\n');
}
