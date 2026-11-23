// The path contract (spec 2.7): which taps reach a route, and what a recording of them may claim.
//
// The crawl owns the edges of the app graph, never the nodes. The delivery scan already answers
// "which route renders this union", and this file reads that answer: `targetsFrom` takes its
// targets from the route map, and no route literal appears below. Two answers to one question is
// the failure this split prevents.
//
// The crawl is bounded and deterministic: the bounds are constants here, not flags, so two runs of
// one tree give the same paths.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { QaSession } from '../drivers/target/contract.mts';
import { type Inventory, PROVENANCE } from '../states/services/inventory.mts';
import type { Provenance, Settle, Surface } from './types.mts';

/** How deep the crawl goes: home, a section, a thing in it. */
export const MAX_DEPTH = 3;

/** How many controls the crawl follows from one screen, after sorting. */
export const MAX_EDGES_PER_NODE = 12;

/** The elements the crawl lists as controls. An element a person cannot see as a control is no step. */
export const CONTROL_SELECTOR = 'button, a, [role="button"], [role="link"], [role="tab"]';

/** A step carries the control's accessible name, cut to this length. */
export const MAX_LABEL = 60;

/**
 * Why a path run fails. A state that no path reaches is reported, not failed, because a deep link
 * may reach it.
 */
export const FAIL_REASONS = ['no-serial', 'over-budget', 'route-drift', 'state-mismatch', 'unlabelled-video', 'crashed'] as const;
export type PathFailReason = (typeof FAIL_REASONS)[number];

export { PROVENANCE };

/**
 * The two kinds of video.
 *
 * - `path`: real taps on real data. It may claim that a person can get here, and it is `live`.
 * - `state`: mounted or intercepted. It may claim how a state behaves over time, never that a
 *   person can reach it or that the data was real.
 */
export const VIDEO_KINDS = ['path', 'state'] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

/** A control's accessible name, cut to a step label. */
export function cleanLabel(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL);
}

/**
 * The controls the crawl follows when a screen has more than the bound. The pick strides across
 * the whole sorted list: the first N by name would sample the letter A, not the screen.
 */
export function chooseEdges<T>(controls: readonly T[] | null | undefined, max = MAX_EDGES_PER_NODE): T[] {
  const all = controls ?? [];
  if (all.length <= max) return [...all];
  const stride = all.length / max;
  const picked: T[] = [];
  for (let i = 0; i < max; i += 1) picked.push(all[Math.floor(i * stride)] as T);
  return picked;
}

/** A route pattern as a matcher. `/items/:id` matches `/items/7`, and `:tab?` is optional. */
export function routeMatcher(pattern: string): RegExp {
  const [head = '', ...rest] = String(pattern).split('/');
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // An optional param takes its slash with it, so `/list/:tab?` also matches `/list`.
  const tail = rest
    .map((segment) => {
      if (!segment.startsWith(':')) return `/${escape(segment)}`;
      return segment.endsWith('?') ? '(?:/[^/]*)?' : '/[^/]+';
    })
    .join('');
  return new RegExp(`^${escape(head)}${tail}/?$`);
}

/** True when a concrete pathname satisfies a route pattern. The query and the hash are ignored. */
export function routeMatches(pattern: string, pathname: string): boolean {
  return routeMatcher(pattern).test(String(pathname).replace(/[?#].*$/, ''));
}

/** A crawl target: one route of the route map, with the unions it renders. */
export interface Target {
  surface: Surface;
  route: string;
  page: string | null;
  dynamic: boolean;
  unions: string[];
}

/**
 * The crawl targets: every distinct route the delivery scan named, per surface, with the unions
 * each one renders. A route that is not in the map is no target.
 */
export function targetsFrom(delivery: { unions?: readonly { union?: string; name?: string; routes?: readonly { surface: Surface; route: string; page?: string | null; dynamic?: boolean }[] }[] } | null | undefined): Target[] {
  const byKey = new Map<string, Target>();
  for (const union of delivery?.unions ?? []) {
    const name = union.union ?? union.name ?? '';
    for (const row of union.routes ?? []) {
      const key = `${row.surface} ${row.route}`;
      const seen = byKey.get(key);
      if (seen) {
        if (!seen.unions.includes(name)) seen.unions.push(name);
        continue;
      }
      byKey.set(key, { surface: row.surface, route: row.route, page: row.page ?? null, dynamic: Boolean(row.dynamic), unions: [name] });
    }
  }
  return [...byKey.values()].sort((a, b) => a.surface.localeCompare(b.surface) || a.route.localeCompare(b.route));
}

/** One step of a path: the control pressed, and where the app went. */
export interface PathStep {
  label: string;
  role: string;
  route?: string;
  atMs?: number;
}

/** A discovered path. */
export interface CrawlPath {
  id: string;
  leg: string;
  from: string;
  /** The target route the last step resolved to, or the landed pathname when none matched. */
  route: string;
  landed: string;
  /** False when the route matches no delivery target: that is route drift. */
  resolved: boolean;
  steps: PathStep[];
  readable: string;
  depth: number;
}

/**
 * A path id: the leg, the start and the labels pressed. Labels, not indices, so a new control at
 * the top of a screen does not rename every path below it.
 */
export function pathId(path: { leg: string; from: string; steps?: readonly { label: string }[] }): string {
  const slug = (s: string): string =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'root';
  const tail = (path.steps ?? []).map((s) => slug(s.label)).join('.');
  return [path.leg, slug(path.from), tail].filter(Boolean).join('.');
}

/** `/ -> "Settings" -> /settings`: routes as written, labels quoted. */
export function formatPath(path: { from: string; route?: string; steps?: readonly PathStep[] }): string {
  const steps = (path.steps ?? []).map((s) => `"${s.label}"`);
  const ends = path.route ?? path.steps?.at(-1)?.route ?? path.from;
  return [path.from, ...steps, ends].join(' -> ');
}

/**
 * The crawl's ends crossed with the delivery targets. A union is reachable when some path ends on a
 * route that renders it. A union that no path reaches is reported, not failed.
 */
export function crossReach(targets: readonly Target[], paths: readonly { surface: Surface; route?: string; id: string }[]): {
  routes: (Target & { reached: boolean; by: string[] })[];
  unions: { union: string; reachable: boolean }[];
  unreachable: string[];
} {
  const rows = targets.map((target) => {
    const reached = paths.filter((p) => p.surface === target.surface && p.route !== undefined && routeMatches(target.route, p.route));
    return { ...target, reached: reached.length > 0, by: reached.map((e) => e.id) };
  });
  const unionState = new Map<string, boolean>();
  for (const row of rows) for (const union of row.unions) unionState.set(union, (unionState.get(union) ?? false) || row.reached);
  return {
    routes: rows,
    unions: [...unionState.entries()].map(([union, reachable]) => ({ union, reachable })).sort((a, b) => a.union.localeCompare(b.union)),
    unreachable: [...unionState.entries()]
      .filter(([, reachable]) => !reachable)
      .map(([union]) => union)
      .sort(),
  };
}

/**
 * A route the crawl reached that the delivery scan never named. It fails the run: the two halves
 * disagree about which routes exist.
 */
export function routeDrift(targets: readonly Target[], paths: readonly { id: string; surface: Surface; route?: string }[]): { id: string; route: string }[] {
  return paths
    .filter((p) => p.route !== undefined && !targets.some((t) => t.surface === p.surface && routeMatches(t.route, p.route as string)))
    .map((p) => ({ id: p.id, route: p.route as string }));
}

/** A checked video record, or the reason it is refused. */
export type VideoRecordResult =
  | { ok: true; kind: VideoKind; file: string; provenance: Provenance; device: string; seconds: number; marks: string[]; steps: PathStep[] }
  | { ok: false; reason: PathFailReason; error: string };

/**
 * A video record, and the label is not optional. A moving picture of synthetic data persuades
 * more than a still, so it needs the label more. A path video is live; a state video is never live;
 * every video names its device.
 */
export function videoRecord(args: { kind: string; file: string; provenance: string; device?: string | null; seconds: number; marks?: string[]; steps?: PathStep[] }): VideoRecordResult {
  const { kind, file, provenance, device, seconds, marks = [], steps = [] } = args;
  if (!(VIDEO_KINDS as readonly string[]).includes(kind)) return { ok: false, reason: 'crashed', error: `unknown video kind ${kind}` };
  if (!(PROVENANCE as readonly string[]).includes(provenance)) {
    return { ok: false, reason: 'unlabelled-video', error: `provenance must be one of ${PROVENANCE.join(', ')}` };
  }
  if (kind === 'path' && provenance !== 'live') return { ok: false, reason: 'unlabelled-video', error: 'a path video is live by construction: real taps, real data' };
  if (kind === 'state' && provenance === 'live') return { ok: false, reason: 'unlabelled-video', error: 'a state video is mounted or intercepted, never live' };
  if (!device) return { ok: false, reason: 'no-serial', error: 'a video names the device it was taken on' };
  return { ok: true, kind: kind as VideoKind, file, provenance: provenance as Provenance, device, seconds, marks, steps };
}

/**
 * The expression that lists every visible control with its accessible name: `aria-label`, then the
 * text, then `title`. The click expression derives the name the same way, so a device presses the
 * control the browser pressed.
 */
export function controlsExpression(): string {
  return `(() => {
  const out = [];
  for (const el of Array.from(document.querySelectorAll(${JSON.stringify(CONTROL_SELECTOR)}))) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim();
    if (name === '') continue;
    out.push({ label: name, role: el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button') });
  }
  return out;
})()`;
}

/** The expression that presses a control by its role and accessible name. It reports, never throws. */
export function clickByNameExpression(label: string, role: string): string {
  return `(() => {
  const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim().slice(0, ${MAX_LABEL});
  const want = norm(${JSON.stringify(String(label))});
  const wantRole = ${JSON.stringify(String(role))};
  const before = window.location.pathname;
  for (const el of Array.from(document.querySelectorAll(${JSON.stringify(CONTROL_SELECTOR)}))) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    const r = el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button');
    if (r !== wantRole) continue;
    const name = norm(el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '');
    if (name !== want) continue;
    el.click();
    return { ok: true, before };
  }
  return { ok: false, error: 'no ' + wantRole + ' called ' + JSON.stringify(want) + ' on ' + before };
})()`;
}

/** The deduplicated, cleaned and sorted controls of a raw control list. */
export function normaliseControls(raw: readonly { label: unknown; role: unknown }[]): { label: string; role: string }[] {
  const seen = new Set<string>();
  const controls: { label: string; role: string }[] = [];
  for (const c of raw) {
    const label = cleanLabel(c.label);
    const role = String(c.role ?? 'button');
    if (label === '' || seen.has(`${role} ${label}`)) continue;
    seen.add(`${role} ${label}`);
    controls.push({ label, role });
  }
  return controls.sort((a, b) => a.label.localeCompare(b.label) || a.role.localeCompare(b.role));
}

/** The folder of a run's path recordings, relative to the report folder. */
export function pathsDir(slug: string): string {
  return `assets/${slug}/paths`;
}

/** One recording, relative to the report folder. The leg is in the name. */
export function videoPath(slug: string, id: string, leg: string, ext: string): string {
  return `${pathsDir(slug)}/${id}.${leg}.${ext}`;
}

/**
 * Every state video an inventory owes for the named unions. A union whose component the harness
 * cannot mount is skipped with a reason, never dropped.
 *
 * @param mountable the component names the harness draws, or null to trust every named component
 */
export function stateCaptures(inventory: Pick<Inventory, 'unions'>, mountable: readonly string[] | null, only: readonly string[] = []): {
  rows: { id: string; union: string; member: string; component: string; field: string }[];
  skipped: { union: string; why: string }[];
} {
  const wanted = new Set(only);
  const rows: { id: string; union: string; member: string; component: string; field: string }[] = [];
  const skipped: { union: string; why: string }[] = [];
  for (const union of inventory.unions) {
    if (wanted.size > 0 && !wanted.has(union.name)) continue;
    const site = union.inputs.find((s) => s.component !== null) ?? union.inputs[0];
    if (!site) {
      skipped.push({ union: union.name, why: 'no input site: nothing takes this state as a prop' });
      continue;
    }
    if (site.component === null || (mountable !== null && !mountable.includes(site.component))) {
      skipped.push({ union: union.name, why: `the harness cannot mount ${site.component ?? 'an unnamed component'}` });
      continue;
    }
    for (const member of union.members) rows.push({ id: `${union.name}.${member}`, union: union.name, member, component: site.component, field: site.field });
  }
  return { rows, skipped };
}

/** `0:14`, for a mark beside a step. */
export function stamp(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Did the recorder outlive the path? A path that runs past the recording fails and names the step
 * it was on: a video of the first two thirds of a journey looks complete.
 */
export function budgetCheck(args: { steps: readonly { label: string; atMs?: number }[]; seconds: number }): { ok: true } | { ok: false; reason: 'over-budget'; error: string } {
  const limitMs = args.seconds * 1000;
  const over = args.steps.find((s) => (s.atMs ?? 0) > limitMs);
  if (!over) return { ok: true };
  return { ok: false, reason: 'over-budget', error: `the recorder stopped at ${stamp(limitMs)} and the path was still on "${over.label}" at ${stamp(over.atMs ?? 0)}` };
}

/** A crawl plan for one leg. */
export interface CrawlPlan {
  slug: string;
  leg: string;
  surface: Surface;
  root: string;
  maxDepth: number;
  maxEdges: number;
  targets: Target[];
  /** The settle after each click. A click that has not changed the pathname by then did not navigate. */
  settle: Settle;
}

/** The settle after a click: no element is busy, bounded at four seconds. */
export const CLICK_SETTLE: Settle = { busy: true, timeout: 4_000 };

/** Builds the crawl plan of one leg from the delivery targets of its surface. */
export function buildCrawlPlan(args: { slug: string; leg: string; surface: Surface; targets: readonly Target[]; root?: string }): CrawlPlan {
  return {
    slug: args.slug,
    leg: args.leg,
    surface: args.surface,
    root: args.root ?? '/',
    maxDepth: MAX_DEPTH,
    maxEdges: MAX_EDGES_PER_NODE,
    targets: args.targets.filter((t) => t.surface === args.surface),
    settle: CLICK_SETTLE,
  };
}

const pathnameOf = (route: string): string => route.replace(/[?#].*$/, '') || '/';

function resolveRoute(landed: string, targets: readonly Target[]): string | null {
  return targets.find((t) => routeMatches(t.route, landed))?.route ?? null;
}

function requireEvaluate(session: QaSession): (expression: string) => Promise<unknown> {
  if (!session.evaluate) {
    throw new LaunchwrightError('qa.paths.evaluate', 'The target cannot evaluate in the page, so the crawl cannot list or press controls. Use a browser or WebView target.');
  }
  return session.evaluate.bind(session);
}

/** Presses one control and reports where the app went. A navigation is a pathname change only. */
async function followEdge(session: QaSession, control: { label: string; role: string }, before: string, settle: Settle): Promise<{ moved: boolean; landed: string; error?: string }> {
  const evaluate = requireEvaluate(session);
  const pressed = (await evaluate(clickByNameExpression(control.label, control.role))) as { ok: boolean; error?: string };
  if (!pressed.ok) return { moved: false, landed: before, ...(pressed.error === undefined ? {} : { error: pressed.error }) };
  await session.settle(settle);
  const landed = pathnameOf(await session.currentRoute());
  return { moved: landed !== before, landed };
}

/**
 * Discovers paths breadth first, so a two-tap path is found before a three-tap path to the same
 * screen. Each edge starts from a fresh navigation to its parent, because going back lands where
 * the previous edge left the navigation stack, and two runs would then disagree.
 */
export async function crawl(session: QaSession, plan: CrawlPlan): Promise<{ paths: CrawlPath[]; visited: string[] }> {
  const evaluate = requireEvaluate(session);
  const found: CrawlPath[] = [];
  const visited = new Set<string>([plan.root]);
  let frontier: { route: string; steps: PathStep[] }[] = [{ route: plan.root, steps: [] }];
  for (let depth = 0; depth < plan.maxDepth && frontier.length > 0; depth += 1) {
    const next: { route: string; steps: PathStep[] }[] = [];
    for (const node of frontier) {
      await session.navigate(node.route);
      const controls = chooseEdges(normaliseControls((await evaluate(controlsExpression())) as { label: unknown; role: unknown }[]), plan.maxEdges);
      for (const control of controls) {
        await session.navigate(node.route);
        const from = pathnameOf(await session.currentRoute());
        const { moved, landed } = await followEdge(session, control, from, plan.settle);
        if (!moved) continue;
        const resolved = resolveRoute(landed, plan.targets);
        const route = resolved ?? landed;
        if (visited.has(route)) continue;
        visited.add(route);
        const steps: PathStep[] = [...node.steps, { label: control.label, role: control.role, route }];
        const path = { leg: plan.leg, from: plan.root, steps, route };
        found.push({ id: pathId(path), leg: plan.leg, from: plan.root, route, landed, resolved: resolved !== null, steps, readable: formatPath(path), depth: depth + 1 });
        next.push({ route, steps });
      }
    }
    frontier = next;
  }
  return { paths: found, visited: [...visited] };
}

/** The result of one path recording. */
export type PathRecording = VideoRecordResult | { ok: false; reason: PathFailReason; error: string; file?: string; steps?: PathStep[] };

/**
 * Replays a discovered path with the recorder on. The recording is a replay of a path already
 * proved to walk, so it holds none of the crawl's dead ends.
 *
 * @param capS the video cap in seconds (`qa.evidence.videoCapS`)
 * @param now milliseconds, from the kernel clock
 */
export async function recordPath(
  session: QaSession,
  args: { root: string; path: Pick<CrawlPath, 'id' | 'steps'>; file: string; device: string | null; capS: number; settle?: Settle; now: () => number },
): Promise<PathRecording> {
  const settle = args.settle ?? CLICK_SETTLE;
  const steps: PathStep[] = [];
  await session.navigate(args.root);
  let current = pathnameOf(await session.currentRoute());
  await session.startVideo(args.file);
  const startedAt = args.now();
  let driveError: string | null = null;
  let file = args.file;
  try {
    for (const step of args.path.steps) {
      const { moved, landed, error } = await followEdge(session, step, current, settle);
      steps.push({ label: step.label, role: step.role, route: landed, atMs: args.now() - startedAt });
      if (!moved) {
        driveError = error ?? `"${step.label}" no longer navigates`;
        break;
      }
      current = landed;
    }
  } finally {
    // The video is kept even when a step failed: it shows where the path stopped.
    file = (await session.stopVideo()).path;
  }
  const budget = budgetCheck({ steps, seconds: args.capS });
  if (!budget.ok) return { ...budget, file, steps };
  if (driveError !== null) return { ok: false, reason: 'state-mismatch', error: driveError, file, steps };
  const seconds = (args.now() - startedAt) / 1000;
  return videoRecord({ kind: 'path', file, provenance: 'live', device: args.device, seconds, steps, marks: steps.map((s) => `${stamp(s.atMs ?? 0)}  ${s.label}`) });
}
