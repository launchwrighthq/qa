// `lw qa sweep plan`: crosses the world registry with the delivery map and gives a manifest that
// `lw qa session run` runs. Pure data in, pure data out.
//
// The bound:
// 1. States are never crossed with each other. One row is one state at one address.
// 2. At most `cap` addresses per state (default 2). The second address is the cross-check.
// 3. One row holds every browser leg whose surface serves its route. A device leg is never
//    planned: a row names it on purpose.
//
// A route belongs to a state when a name of the state (its feature, and the head of a dotted
// fact id) is a path segment of the route (rank 0), of its page (rank 1) or of the union anchor
// that reaches it (rank 2). Ties go to the nearer page (`distance`), then the narrower page
// (`reaches`), then the route, so the plan is stable.
//
// A dynamic segment `:name` takes the value of a seeded handle whose key names it. A world with
// no seed gives `{key}`, and the runner refuses to open such a route until `lw qa world reset`
// seeds it. A state with no address is `no-route`; a state whose addresses all need a handle that
// no key names is `no-seed`. Both stay in the plan as owed states.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { Manifest, Shot } from './manifest.mts';
import type { Leg, Surface } from './types.mts';

/** How many addresses one state may be shot at. */
export const DEFAULT_CAP = 2;
/** The settle budget of a sweep row. */
export const SETTLE_TIMEOUT_MS = 20_000;
/** A segment shorter than this needs an exact handle key. */
const MIN_FUZZY_SEGMENT = 3;

/** One world entry: what `lw qa world list --json` or the stamp of `lw qa world status --json` holds. */
export interface SweepWorldEntry {
  kind: 'persona' | 'fact';
  id: string;
  summary: string;
  feature: string;
  handleKeys?: readonly string[];
  handles?: Readonly<Record<string, string | number | null>>;
}

/** One address of the delivery map, with the anchor of the union that reaches it. */
export interface SweepAddress {
  route: string;
  surface: Surface;
  page: string;
  distance: number;
  reaches: number;
  anchor: string;
}

function invalid(message: string): LaunchwrightError {
  return new LaunchwrightError('qa.sweep.input', message);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The world entries of a world file: an array, or one under `entries`, `world` or `stamp.entries`. */
export function readWorld(parsed: unknown): SweepWorldEntry[] {
  const entries = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.entries)
      ? parsed.entries
      : isObject(parsed) && Array.isArray(parsed.world)
        ? parsed.world
        : isObject(parsed) && isObject(parsed.stamp) && Array.isArray(parsed.stamp.entries)
          ? parsed.stamp.entries
          : null;
  if (entries === null) throw invalid('The world file is not `lw qa world list --json` output: no array, and none under entries, world or stamp.entries.');
  // A registry of zero states makes every coverage read "0 of 0".
  if (entries.length === 0) throw invalid('The world declares no state, so there is nothing to sweep.');
  entries.forEach((entry: unknown, i: number) => {
    const at = `world[${i}]`;
    if (!isObject(entry)) throw invalid(`${at} is not an entry`);
    if (entry.kind !== 'persona' && entry.kind !== 'fact') throw invalid(`${at} kind is not persona or fact`);
    for (const field of ['id', 'summary', 'feature'] as const) {
      if (typeof entry[field] !== 'string' || (entry[field] as string).trim() === '') throw invalid(`${at} has no ${field}`);
    }
  });
  return entries as SweepWorldEntry[];
}

/** Every address of a delivery map (`lw qa states scan` route map or inventory). */
export function readDelivery(delivery: unknown): SweepAddress[] {
  if (!isObject(delivery) || !Array.isArray(delivery.unions)) throw invalid('The delivery file has no unions array.');
  const out: SweepAddress[] = [];
  for (const union of delivery.unions as unknown[]) {
    if (!isObject(union)) continue;
    const anchor = typeof union.anchor === 'string' ? union.anchor : typeof union.file === 'string' ? union.file : '';
    for (const route of Array.isArray(union.routes) ? (union.routes as unknown[]) : []) {
      if (!isObject(route) || typeof route.route !== 'string') continue;
      out.push({
        route: route.route,
        surface: route.surface as Surface,
        page: typeof route.page === 'string' ? route.page : '',
        distance: typeof route.distance === 'number' ? route.distance : Number.MAX_SAFE_INTEGER,
        reaches: typeof route.reaches === 'number' ? route.reaches : Number.MAX_SAFE_INTEGER,
        anchor,
      });
    }
  }
  return out;
}

/** The names a state answers to: its feature, and the head of a dotted id. */
export function namesFor(entry: Pick<SweepWorldEntry, 'feature' | 'id'>): string[] {
  const names = [entry.feature.toLowerCase()];
  const head = entry.id.includes('.') ? (entry.id.split('.')[0] ?? '').toLowerCase() : null;
  if (head && !names.includes(head)) names.push(head);
  return names;
}

/** The comparable segments of a path. A source path is cut after `src/`; a parameter gives nothing. */
export function segmentsOf(path: string): string[] {
  const cut = path.indexOf('/src/');
  const tail = cut === -1 ? path : path.slice(cut + '/src/'.length);
  return tail
    .split('/')
    .filter((seg) => seg !== '' && !seg.startsWith(':') && !seg.startsWith('{'))
    .flatMap((seg) => seg.split('.'))
    .map((seg) => seg.toLowerCase())
    .filter((seg) => seg !== '');
}

/** How directly an address names the state: 0 route, 1 page, 2 anchor, or null. */
export function nameRank(candidate: Pick<SweepAddress, 'route' | 'page' | 'anchor'>, names: string[]): number | null {
  const hits = (path: string): boolean => segmentsOf(path).some((seg) => names.includes(seg));
  if (hits(candidate.route)) return 0;
  if (hits(candidate.page)) return 1;
  if (hits(candidate.anchor)) return 2;
  return null;
}

/** The handle key that names a route parameter: exact first, else one key that holds it (3 characters or more). */
export function handleKeyFor(name: string, handles: Readonly<Record<string, unknown>>): string | null {
  const keys = Object.keys(handles);
  const want = name.toLowerCase();
  const exact = keys.filter((key) => key.toLowerCase() === want);
  if (exact.length === 1) return exact[0] as string;
  if (want.length < MIN_FUZZY_SEGMENT) return null;
  const near = keys.filter((key) => key.toLowerCase().includes(want));
  return near.length === 1 ? (near[0] as string) : null;
}

/** The handles a state can fill a parameter with: the seeded values, else the declared keys with no value. */
export function handleNames(entry: Pick<SweepWorldEntry, 'handles' | 'handleKeys'>): Record<string, string | number | null> {
  if (entry.handles && Object.keys(entry.handles).length > 0) return { ...entry.handles };
  return Object.fromEntries((entry.handleKeys ?? []).map((key) => [key, null]));
}

/**
 * The address a row can open. A parameter takes the seeded value of its handle, else `{key}`. An
 * optional parameter that no handle names is dropped; a required one makes the route unusable,
 * and its name is returned.
 */
export function fillRoute(routePath: string, handles: Readonly<Record<string, string | number | null>>): { route: string | null; missing: string | null } {
  const out: string[] = [];
  for (const seg of routePath.split('/')) {
    if (!seg.startsWith(':')) {
      out.push(seg);
      continue;
    }
    const optional = seg.endsWith('?');
    const key = handleKeyFor(seg.slice(1, optional ? -1 : undefined), handles);
    if (key !== null) {
      const value = handles[key];
      out.push(value === null || value === undefined ? `{${key}}` : encodeURIComponent(String(value)));
    } else if (!optional) return { route: null, missing: seg };
  }
  const route = out.join('/');
  return { route: route === '' ? '/' : route, missing: null };
}

interface Candidate {
  route: string;
  surfaces: Set<Surface>;
  page: string;
  rank: number;
  distance: number;
  reaches: number;
}

/** The addresses of one state, best first, one per route. */
export function addressesFor(entry: SweepWorldEntry, addresses: SweepAddress[]) {
  const names = namesFor(entry);
  const byRoute = new Map<string, Candidate>();
  let dropped: { segment: string; route: string; rank: number; distance: number } | null = null;
  let named = 0;
  for (const address of addresses) {
    const rank = nameRank(address, names);
    if (rank === null) continue;
    named += 1;
    const filled = fillRoute(address.route, handleNames(entry));
    if (filled.route === null) {
      if (dropped === null || rank < dropped.rank || (rank === dropped.rank && address.distance < dropped.distance)) {
        dropped = { segment: filled.missing as string, route: address.route, rank, distance: address.distance };
      }
      continue;
    }
    const held = byRoute.get(filled.route);
    if (held === undefined) {
      byRoute.set(filled.route, { route: filled.route, surfaces: new Set([address.surface]), page: address.page, rank, distance: address.distance, reaches: address.reaches });
      continue;
    }
    held.surfaces.add(address.surface);
    if (rank < held.rank || (rank === held.rank && address.distance < held.distance)) {
      held.rank = rank;
      held.distance = address.distance;
      held.reaches = address.reaches;
      held.page = address.page;
    }
  }
  const rows = [...byRoute.values()].sort((a, b) => a.rank - b.rank || a.distance - b.distance || a.reaches - b.reaches || a.route.localeCompare(b.route));
  return { rows, dropped, named, names };
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The `<screen>` half of a row id: the route without its parameters. */
export function screenSlug(route: string): string {
  const parts = route
    .split('?')[0]
    ?.split('/')
    .filter((seg) => seg !== '' && !seg.startsWith('{') && !seg.startsWith(':'))
    .map(slug)
    .filter((seg) => seg !== '');
  return !parts || parts.length === 0 ? 'home' : parts.join('-');
}

/** The page folder or file stem: `pages/library/index.page.tsx` gives `library`, `pages/store.page.tsx` gives `store`. */
export function pageName(page: string): string {
  const parts = page.split('/');
  const file = parts.pop() ?? '';
  const stem = file.split('.')[0] ?? '';
  return stem === 'index' ? (parts.pop() ?? '') : stem;
}

export interface SweepOptions {
  world: unknown;
  delivery: unknown;
  /** The legs of the config. Only browser legs (`playwright` target) are planned. */
  legs: readonly Leg[];
  cap?: number;
  /** The `spec:<spec>#<state id>` source of each row. Default `qa.world`. */
  spec?: string;
  title?: string;
  specRef?: string;
  /** ISO time of the plan. */
  generated: string;
}

export interface OwedState {
  kind: 'persona' | 'fact';
  id: string;
  feature: string;
  reason: 'no-route' | 'no-seed';
  why: string;
}

export interface SweepManifest extends Manifest {
  sweep: {
    cap: number;
    declared: number;
    covered: number;
    owed: number;
    personas: number;
    facts: number;
    states: Array<{ kind: string; id: string; feature: string; shots: string[]; addresses: number; droppedDynamic?: string; droppedSegment?: string }>;
    owedStates: OwedState[];
  };
}

/** The plan: a manifest that the runner accepts, with the denominator of the coverage line. */
export function planSweep(opts: SweepOptions): SweepManifest {
  const cap = opts.cap ?? DEFAULT_CAP;
  if (!Number.isInteger(cap) || cap < 1) throw invalid(`--cap must be a whole number of addresses above 0, got ${cap}`);
  const entries = readWorld(opts.world);
  const addresses = readDelivery(opts.delivery);
  const spec = opts.spec ?? 'qa.world';
  const browserLegs = opts.legs.filter((l) => l.target === 'playwright');
  const shots: Shot[] = [];
  const owed: OwedState[] = [];
  const covered: SweepManifest['sweep']['states'] = [];
  const taken = new Set<string>();

  for (const entry of entries) {
    const { rows, dropped, named, names } = addressesFor(entry, addresses);
    const naming = names.map((n) => `"${n}"`).join(' or ');
    const legsOf = (surfaces: Set<Surface>): string[] => browserLegs.filter((l) => surfaces.has(l.surface)).map((l) => l.name);
    const usable = rows.filter((r) => legsOf(r.surfaces).length > 0);
    if (usable.length === 0) {
      const noSeed = named > 0 && dropped !== null;
      owed.push({
        kind: entry.kind,
        id: entry.id,
        feature: entry.feature,
        reason: noSeed ? 'no-seed' : 'no-route',
        why: noSeed
          ? `every address that names ${naming} is dynamic and no handle fills ${dropped.segment}, so the world owes this state a seed`
          : `no route, page or component of the delivery map names ${naming} on a surface with a browser leg`,
      });
      continue;
    }
    const chosen = usable.slice(0, cap);
    const ids: string[] = [];
    for (const address of chosen) {
      let id = `${screenSlug(address.route)}.${slug(entry.id)}`;
      // A row id names its files, so a collision would file one row's picture under another.
      while (taken.has(id)) id = `${id}-b`;
      taken.add(id);
      shots.push({
        id,
        screen: pageName(address.page) || screenSlug(address.route),
        state: entry.summary.trim(),
        ...(opts.specRef ? { specRef: opts.specRef } : {}),
        source: [`spec:${spec}#${entry.id}`],
        legs: legsOf(address.surfaces),
        route: address.route,
        fixture: entry.kind === 'persona' ? { arm: [], persona: entry.id } : { arm: [], facts: [entry.id] },
        settle: { busy: true, timeout: SETTLE_TIMEOUT_MS },
        expect: `${address.route} as ${entry.id}: ${entry.summary.trim().replace(/\.$/, '')}. Judge whether the screen shows that state.`,
      });
      ids.push(id);
    }
    const first = chosen[0] as Candidate;
    covered.push({
      kind: entry.kind,
      id: entry.id,
      feature: entry.feature,
      shots: ids,
      addresses: usable.length,
      // A state shot at a weaker address than its best one, because the best one needs a handle.
      ...(dropped !== null && (dropped.rank < first.rank || (dropped.rank === first.rank && dropped.distance < first.distance))
        ? { droppedDynamic: dropped.route, droppedSegment: dropped.segment }
        : {}),
    });
  }
  if (covered.length + owed.length !== entries.length) {
    throw new LaunchwrightError('qa.sweep.count', `${covered.length} covered and ${owed.length} owed is not ${entries.length} declared.`);
  }
  return {
    title: opts.title ?? 'QA sweep of the world registry',
    generated: opts.generated,
    spec,
    commits: [],
    shots,
    sweep: {
      cap,
      declared: entries.length,
      covered: covered.length,
      owed: owed.length,
      personas: entries.filter((e) => e.kind === 'persona').length,
      facts: entries.filter((e) => e.kind === 'fact').length,
      states: covered,
      owedStates: owed,
    },
  };
}

/** The summary a person reads. */
export function renderSweep(manifest: SweepManifest): string {
  const s = manifest.sweep;
  const out = [
    `world: ${s.declared} state(s) declared: ${s.personas} persona(s), ${s.facts} fact(s)`,
    `plan:  ${manifest.shots.length} row(s) over ${s.covered} state(s), at most ${s.cap} address(es) each`,
  ];
  for (const state of s.states) {
    const lost = state.droppedDynamic ? `  (${state.droppedDynamic} needs a handle for ${state.droppedSegment})` : '';
    out.push(`  ${state.id.padEnd(28)} ${state.shots.join(' ')}${lost}`);
  }
  out.push(`owed:  ${s.owed} state(s)`);
  for (const row of s.owedStates) out.push(`  ${row.reason.padEnd(9)} ${row.id.padEnd(28)} ${row.feature.padEnd(12)} ${row.why}`);
  return out.join('\n');
}
