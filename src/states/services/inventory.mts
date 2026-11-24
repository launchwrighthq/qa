// The state inventory: every state union the client declares, and how each one is reached
// (spec 2.7). It is the denominator of a state run. A closed union has a member count, and a list of
// screens that a person remembered has none.
import type { Provenance, Surface } from '../../services/types.mts';
import type { Shape } from './solve.mts';

/** The name suffixes of a state union. A suffix list, so a new suffix is a decision made here. */
export const STATE_SUFFIXES = ['State', 'Mark', 'Status', 'Kind', 'Phase', 'Variant'] as const;

/** True when a type name looks like a state union: it ends in a suffix and has more than the suffix. */
export function isStateUnionName(name: string): boolean {
  return STATE_SUFFIXES.some((s) => name.endsWith(s) && name.length > s.length);
}

/**
 * How a union is reached.
 *
 * - `input`: a field of a props or options type holds it, so a component takes it.
 * - `output`: a function returns it, so it comes from that function's parameter.
 * - `both`: both, and either mechanism reaches it.
 * - `neither`: nothing takes it and nothing returns it. It fails the run (spec 2.14 rule C1).
 */
export const KINDS = ['input', 'output', 'both', 'neither'] as const;
export type UnionKind = (typeof KINDS)[number];

/** The JSDoc tag that opts a union out: `@qa-states ignore <reason>`. The reason is required. */
export const IGNORE_TAG = 'qa-states';

/** How a capture was produced. A report labels every shot that is not `live`. */
export const PROVENANCE: readonly Provenance[] = ['live', 'intercepted', 'mounted', 'forged'];

/**
 * Why a capture failed. The report switches on the code, and a person reads `error`.
 *
 * - `unreachable`: no candidate produced the member. `fieldsTried` names what was varied.
 * - `identical`: two members render the same element. `sameAs` names the twin.
 * - `state-mismatch`: the feature's own function disagreed. `intended` and `actual` say how.
 * - `unmountable`: the harness could not mount the component. `missingProp` says why.
 * - `no-mechanism`: a `neither` union. Nothing can reach it.
 * - `blocked`: a prerequisite is missing, for example a delivery descriptor.
 * - `not-run`: the mechanism did not run. It counts against the exit code.
 * - `crashed`: any other failure. `error` holds all that is known.
 */
export const FAIL_REASONS = [
  'unreachable',
  'identical',
  'state-mismatch',
  'unmountable',
  'no-mechanism',
  'blocked',
  'not-run',
  'crashed',
] as const;
export type FailReason = (typeof FAIL_REASONS)[number];

/** A field that holds the union: the input half. */
export interface InputSite {
  interface: string;
  field: string;
  optional: boolean;
  /** Project-relative. */
  file: string;
  /** The component whose props type holds the field, or null when no component names it. */
  component: string | null;
  componentFile: string | null;
}

/** One parameter of an output function, with the shape the solver searches over. */
export interface ParamSite {
  name: string;
  type: string;
  typeFile: string | null;
  shape: Shape | null;
}

/** The constants a function compares against. Names are resolved by the runner in the page. */
export interface Pivots {
  literals: number[];
  names: string[];
}

/** A function that returns the union: the output half. */
export interface OutputSite {
  fn: string;
  file: string;
  /** An unexported function cannot be evaluated from a page. */
  exported: boolean;
  /** `T | null`: the null answer is a rendering of its own. */
  nullable: boolean;
  /** `Promise<T>`: the evaluator awaits it. */
  async: boolean;
  /** True when a parameter has a shape, so the solver can steer the function. */
  solvable: boolean;
  pivots: Pivots;
  params: ParamSite[];
}

/** A union that another union absorbed, because it has no site of its own. */
export interface FlattenedUnion {
  name: string;
  file: string;
  line: number;
  members: string[];
}

/** One route that delivers a union, from the delivery scan (spec 2.14 rule C4). */
export interface DeliveryRoute {
  surface: Surface;
  route: string;
  /** The page module the route draws. */
  page: string | null;
  /** Import hops from the page to the union's anchor file. */
  distance: number;
  /** The route has a `:param`, so a crawl cannot open it without a value. */
  dynamic: boolean;
  /** How many files the page reaches. A smaller number is a more specific route. */
  reaches: number;
}

/**
 * What a mechanism B capture group needs that no scan can know: the response that carries the
 * subjects and the settle rule, and the route when the scan derives none. It sits beside a union in the inventory file.
 */
export interface DeliveryDescriptor {
  /** Default: the nearest derived route without a `:param` on the surface of the leg. */
  route?: string;
  leg?: string;
  intercept: { url: string; container: string };
  settle: { selector?: string; artwork?: boolean; video?: boolean; busy?: boolean; timeout?: number };
  act?: unknown[];
  verifyArgs?: unknown[];
  pivotModules?: string[];
  limit?: number;
  batchSize?: number;
  contrast?: unknown;
  diffRoot?: string;
  ignoreAttributes?: string[];
  maxSubjectAreaRatio?: number;
}

/** What a mounted capture may say beyond the scan (spec 2.14 rule C2). */
export interface MountHints {
  component?: string;
  leg?: string;
  width?: string;
  props?: Record<string, unknown>;
  members?: Record<string, Record<string, unknown>>;
  settle?: { selector?: string; timeout?: number };
}

export interface UnionEntry {
  name: string;
  file: string;
  line: number;
  members: string[];
  kind: UnionKind;
  flattens: FlattenedUnion[];
  inputs: InputSite[];
  outputs: OutputSite[];
  /** The components that render the union. Written into `.lw/qa/states.json`. */
  components?: string[];
  /** The routes that deliver the union. Written into `.lw/qa/states.json`. */
  routes?: DeliveryRoute[];
  /** Why `routes` is empty, when it is. */
  why?: string;
  delivery?: DeliveryDescriptor;
  mount?: MountHints;
}

/** A union a person opted out of, with the reason. Reported, never dropped. */
export interface IgnoredEntry {
  name: string;
  file: string;
  line: number;
  members: string[];
  reason: string;
}

export interface Inventory {
  generated: string;
  /** The client roots the scan read, project-relative. */
  roots: string[];
  unions: UnionEntry[];
  ignored: IgnoredEntry[];
}

/** One planned capture: one per member, plus `null` for a nullable output. */
export interface PlannedCapture {
  id: string;
  union: string;
  member: string | null;
  kind: UnionKind;
  mechanism: Mechanism | null;
}

export type Mechanism = 'mount' | 'solve';

/** One line of a state run's results file, appended per capture. */
export interface StateResult {
  id: string;
  union: string;
  member: string | null;
  ok: boolean;
  /** Report-relative path of the subject image, or null when no file was written. */
  subject: string | null;
  context: string | null;
  provenance: Provenance | null;
  /** Did the feature's own function agree. Null when no function was declared. */
  verified: boolean | null;
  answered?: string | null;
  error: string | null;
  reason?: FailReason;
  fieldsTried?: string[];
  sameAs?: string | null;
  intended?: string | null;
  actual?: string | null;
  missingProp?: string | null;
  component?: string;
  expect?: string;
  ms: number;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The kind that the sites imply. It is the only way a kind is set. */
export function kindFor(inputs: readonly unknown[], outputs: readonly unknown[]): UnionKind {
  const hasIn = inputs.length > 0;
  const hasOut = outputs.length > 0;
  if (hasIn && hasOut) return 'both';
  if (hasIn) return 'input';
  if (hasOut) return 'output';
  return 'neither';
}

/** The mechanism for a kind. `both` prefers mounting, because a mount cannot miss its member. */
export function mechanismFor(kind: UnionKind): Mechanism | null {
  if (kind === 'input' || kind === 'both') return 'mount';
  if (kind === 'output') return 'solve';
  return null;
}

/**
 * Every problem of an inventory, as sentences that name the union. It returns all of them at once,
 * because a scanner that drifted is wrong about a whole shape of thing.
 */
export function validateInventory(inv: unknown): string[] {
  const errors: string[] = [];
  if (!isPlainObject(inv)) return ['the inventory is not an object'];
  if (typeof inv.generated !== 'string' || inv.generated === '') errors.push('generated: missing');
  if (!Array.isArray(inv.roots) || inv.roots.length === 0 || inv.roots.some((r) => typeof r !== 'string')) {
    errors.push('roots: must list the client roots the scan read');
  }
  if (!Array.isArray(inv.unions)) {
    errors.push('unions: must be an array');
    return errors;
  }
  const unions = inv.unions as unknown[];
  if (inv.ignored !== undefined) {
    if (!Array.isArray(inv.ignored)) {
      errors.push('ignored: must be an array');
    } else {
      for (const [i, g] of (inv.ignored as unknown[]).entries()) {
        const at = isPlainObject(g) && typeof g.name === 'string' ? `ignored[${i}] "${g.name}"` : `ignored[${i}]`;
        if (!isPlainObject(g)) {
          errors.push(`${at}: not an object`);
          continue;
        }
        if (typeof g.reason !== 'string' || g.reason.trim() === '') errors.push(`${at}: needs a reason`);
        if (!Array.isArray(g.members) || g.members.length === 0) {
          errors.push(`${at}: must carry its members, so the report can count what is not covered`);
        }
        if (unions.some((u) => isPlainObject(u) && u.name === g.name)) {
          errors.push(`${at}: is also in unions, so its states would be counted twice`);
        }
      }
    }
  }
  const seen = new Set<string>();
  for (const [i, u] of unions.entries()) {
    const at = isPlainObject(u) && typeof u.name === 'string' ? `unions[${i}] "${u.name}"` : `unions[${i}]`;
    if (!isPlainObject(u)) {
      errors.push(`${at}: not an object`);
      continue;
    }
    if (typeof u.name !== 'string' || u.name === '') errors.push(`${at}: name is missing`);
    else if (seen.has(u.name)) errors.push(`${at}: duplicate union name`);
    else seen.add(u.name);
    if (typeof u.file !== 'string' || u.file === '') errors.push(`${at}: file is missing`);
    if (!Array.isArray(u.members) || u.members.length < 2) {
      errors.push(`${at}: members must list at least two, or it is not a state union`);
    } else if (new Set(u.members).size !== u.members.length) {
      errors.push(`${at}: members repeat`);
    }
    const kindOk = (KINDS as readonly unknown[]).includes(u.kind);
    if (!kindOk) errors.push(`${at}: kind "${String(u.kind)}" is not one of ${KINDS.join(' ')}`);
    for (const key of ['inputs', 'outputs'] as const) {
      if (!Array.isArray(u[key])) errors.push(`${at}: ${key} must be an array`);
    }
    if (Array.isArray(u.inputs) && Array.isArray(u.outputs) && kindOk) {
      const expected = kindFor(u.inputs, u.outputs);
      if (expected !== u.kind) errors.push(`${at}: kind is "${String(u.kind)}" but its sites say "${expected}"`);
    }
    for (const [j, o] of (Array.isArray(u.outputs) ? (u.outputs as unknown[]) : []).entries()) {
      if (!isPlainObject(o)) {
        errors.push(`${at}: outputs[${j}] is not an object`);
        continue;
      }
      if (!Array.isArray(o.params)) errors.push(`${at}: outputs[${j}] (${String(o.fn)}) has no params list`);
      if (o.exported !== true && o.exported !== false) errors.push(`${at}: outputs[${j}] must say whether it is exported`);
    }
  }
  return errors;
}

/**
 * Every capture an inventory demands: one per member per union, plus one for `null` where a
 * function may return it. A `neither` union still yields captures, so the run fails and names them.
 */
export function plannedCaptures(inv: Pick<Inventory, 'unions'>): PlannedCapture[] {
  const out: PlannedCapture[] = [];
  for (const u of inv.unions) {
    const mechanism = mechanismFor(u.kind);
    for (const member of u.members) out.push({ id: `${u.name}.${member}`, union: u.name, member, kind: u.kind, mechanism });
    if (u.outputs.some((o) => o.nullable)) out.push({ id: `${u.name}.null`, union: u.name, member: null, kind: u.kind, mechanism });
  }
  return out;
}

/**
 * The output site a solve group is built around: exported, and with a shape for its subject
 * parameter when one exists. An unexported function cannot be imported in the page.
 */
export function solveSite(union: Pick<UnionEntry, 'outputs'>): OutputSite | null {
  const exported = union.outputs.filter((site) => site.exported);
  return exported.find((site) => site.params[0]?.shape) ?? exported[0] ?? null;
}

/** The folder of every state artifact of a run, relative to the report folder. */
export function statesDir(slug: string): string {
  return `assets/${slug}/states`;
}

/**
 * Where one state artifact lands, relative to the report folder. `which` is `subject` or `context`
 * for a still, and the leg name for a state video.
 */
export function statePath(slug: string, captureId: string, which: string, ext = 'png'): string {
  return `${statesDir(slug)}/${captureId}.${which}.${ext}`;
}

/** The coverage line of one union: `covered of planned`, and the members that are missing. */
export function coverageFor(
  union: Pick<UnionEntry, 'name'>,
  results: readonly { id: string; ok: boolean }[],
): { covered: number; planned: number; missing: string[] } {
  const mine = results.filter((r) => r.id.startsWith(`${union.name}.`));
  const covered = mine.filter((r) => r.ok);
  const missing = mine.filter((r) => !r.ok).map((r) => r.id.slice(union.name.length + 1));
  return { covered: covered.length, planned: mine.length, missing };
}

/** A proposed seed for a state that no seed and no route reaches (spec 2.5, the forged-state fallback). */
export interface SeedProposal {
  union: string;
  /** Project-relative, where the union is declared. */
  file: string;
  /** The members the seed must reach. */
  members: string[];
  /** The fields that carry the union, from its input sites. Empty when nothing takes it. */
  fields: { interface: string; field: string; file: string }[];
  /** `app-service` when a site can drive the state, `direct-write` as the last resort. */
  via: 'app-service' | 'direct-write';
  /** The provenance a state the library seeds records. A forged state never counts as a live pass. */
  provenance: 'forged';
  /** Why the state has no seed and no route. */
  reason: string;
}

/**
 * A seed proposal for each union in `unreachable`, from the scan. The library prefers the app
 * services, so a union with an input site or an exported output function seeds `via` `app-service`.
 * A union that nothing takes and nothing returns seeds `via` `direct-write`, the last resort. Either
 * way the state records provenance `forged`, because the library inferred the seed, not a world file.
 */
export function inferSeeds(inventory: Pick<Inventory, 'unions'>, unreachable: ReadonlySet<string>): SeedProposal[] {
  const out: SeedProposal[] = [];
  for (const union of inventory.unions) {
    if (!unreachable.has(union.name)) continue;
    const fields = union.inputs.map((site) => ({ interface: site.interface, field: site.field, file: site.file }));
    const drivable = union.inputs.length > 0 || solveSite(union) !== null;
    out.push({
      union: union.name,
      file: union.file,
      members: [...union.members],
      fields,
      via: drivable ? 'app-service' : 'direct-write',
      provenance: 'forged',
      reason: union.kind === 'neither' ? 'nothing takes it and nothing returns it' : union.why ?? 'no route delivers it and no mount draws it',
    });
  }
  return out;
}
