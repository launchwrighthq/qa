// The solver: mechanism B of a state run (spec 2.7). A function returns a state union, so find an
// input that produces each member. This file does not reason about the function. It makes the
// candidate inputs, and the caller runs the app's own function on them through the `evaluate`
// callback: a browser leg evaluates in the page, and a unit test passes a local function.
//
// A shape descriptor reduces a parameter type to the values each field admits:
//
//     { type: 'Invite', fields: {
//         acceptedAt: { kind: 'nullable', of: { kind: 'string', sample: '2026-08-01T00:00:00Z' } },
//         capped: { kind: 'boolean' },
//         payable: { kind: 'boolean', optional: true },
//         visits: { kind: 'number', pivots: [5] } } }
//
// `optional: true` adds the absent variant: the key is deleted, because that is what the JSON of
// an older server holds. `pivots` are the constants the function compares against.
//
// The candidate order is cheapest and most likely first:
//   0. every corpus entry unchanged, because a real object is already in some state;
//   1. one field at a time, over the values the field admits;
//   2. two fields at a time, for a rendering that needs two facts at once.
// There is no phase 3. A state that needs three facts at once is reported unreachable, with the
// fields that were tried. The stream is finite (`MAX_CANDIDATES`), deduplicated by canonical JSON
// and deterministic: the same corpus and shape give the same stream.
import { LaunchwrightError } from '@launchwrighthq/kernel';

/** The cap on one candidate stream, over every phase. A ten-field shape stays under it. */
export const MAX_CANDIDATES = 500;

/** Every field kind a shape may declare. */
export const FIELD_KINDS = ['boolean', 'number', 'string', 'enum', 'nullable', 'opaque'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/**
 * The value that means "this optional field is not on the wire". It appears in a `fieldValues`
 * list and in a change record, and never in a candidate: the key is deleted instead.
 */
export const ABSENT: unique symbol = Symbol.for('lw.qa.solve.absent');

/** The key a null answer is covered under. `plannedCaptures` plans the capture `<Union>.null`. */
export const NULL_STATE = 'null';

/** The value a `string` field takes when the shape names no sample. */
export const DEFAULT_STRING = 'qa';

export interface Field {
  kind: FieldKind;
  /** The key may be missing entirely. */
  optional?: boolean;
  /** `number` only: constants the function compares against. */
  pivots?: number[];
  /** `string` only: a representative present value. */
  sample?: string;
  /** `enum` only. */
  values?: unknown[];
  /** `nullable` only. */
  of?: Field;
}

export interface Shape {
  /** The parameter type name. */
  type: string;
  fields: Record<string, Field>;
}

export type Candidate = Record<string, unknown>;

export interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

export interface PlanStep {
  candidate: Candidate;
  /** The corpus entry the candidate was made from. */
  base: Candidate;
  baseIndex: number;
  changes: Change[];
  /** `capped: false -> true`. */
  text: string;
}

/** The app's own function over one candidate. It answers a member name, or null. */
export type Evaluate = (candidate: Candidate) => unknown;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The same value, for the scalars a wire object holds. */
const same = (a: unknown, b: unknown): boolean => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

/** A candidate's identity: stable under key order, with an undefined key equal to no key. */
export function canonical(obj: Candidate): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, obj[k]]),
    ),
  );
}

const show = (v: unknown): string => (v === ABSENT ? '(absent)' : typeof v === 'string' ? JSON.stringify(v) : String(v));

/** Every problem of a shape, as sentences that name the field. */
export function validateShape(shape: unknown): string[] {
  const errors: string[] = [];
  if (!isPlainObject(shape)) return ['the shape is not an object'];
  if (typeof shape.type !== 'string' || shape.type === '') {
    errors.push('type: missing, and it names the parameter type this shape describes');
  }
  if (!isPlainObject(shape.fields)) {
    errors.push('fields: must be an object of field descriptors');
    return errors;
  }
  const fields = shape.fields;
  const names = Object.keys(fields);
  if (names.length === 0) errors.push('fields: empty, so nothing can be varied');
  for (const name of names) errors.push(...validateField(fields[name], name));
  if (names.length > 0 && names.every((n) => isPlainObject(fields[n]) && fields[n].kind === 'opaque')) {
    errors.push('fields: every field is opaque, so no candidate can differ from the corpus');
  }
  return errors;
}

function validateField(field: unknown, at: string, insideNullable = false): string[] {
  const errors: string[] = [];
  if (!isPlainObject(field)) return [`${at}: not a field descriptor`];
  if (!(FIELD_KINDS as readonly unknown[]).includes(field.kind)) {
    return [`${at}: kind "${String(field.kind)}" is not one of ${FIELD_KINDS.join(' ')}`];
  }
  if (field.optional !== undefined && typeof field.optional !== 'boolean') errors.push(`${at}: optional must be a boolean`);
  // `optional` deletes the key and `nullable` sets it to null. Inside a nullable the key belongs to
  // the outer field.
  if (insideNullable && field.optional === true) errors.push(`${at}: optional inside nullable says nothing new`);
  if (field.kind === 'enum' && (!Array.isArray(field.values) || field.values.length < 2)) {
    errors.push(`${at}: enum needs at least two values, or it is a constant`);
  }
  if (field.kind === 'number' && field.pivots !== undefined) {
    if (!Array.isArray(field.pivots) || field.pivots.some((p) => !Number.isFinite(p))) {
      errors.push(`${at}: pivots must be an array of finite numbers`);
    }
  }
  if (field.kind === 'string' && field.sample !== undefined && typeof field.sample !== 'string') {
    errors.push(`${at}: sample must be a string`);
  }
  if (field.kind === 'nullable') {
    if (!isPlainObject(field.of)) errors.push(`${at}: nullable needs an "of" descriptor`);
    else if (field.of.kind === 'nullable') errors.push(`${at}: nullable inside nullable adds a second null`);
    else errors.push(...validateField(field.of, `${at}.of`, true));
  }
  return errors;
}

/**
 * The ordered values one field admits, most likely first. An optional field ends with ABSENT.
 * `options.pivots` applies to every number field, because the solver cannot know which field a
 * comparison reads.
 */
export function fieldValues(field: Field, options: { pivots?: number[] } = {}): unknown[] {
  const values = baseValues(field, options);
  return field.optional === true ? [...values, ABSENT] : values;
}

function baseValues(field: Field, options: { pivots?: number[] }): unknown[] {
  switch (field.kind) {
    case 'boolean':
      return [true, false];
    case 'number':
      return numberValues(field, options);
    case 'string':
      return [typeof field.sample === 'string' ? field.sample : DEFAULT_STRING, ''];
    case 'enum':
      return [...(field.values ?? [])];
    case 'nullable':
      return field.of ? [null, ...baseValues(field.of, options)] : [null];
    case 'opaque':
      return [];
  }
}

/**
 * 0 and 1 are the truthiness split. Each pivot gives `p`, `p + 1` and `p - 1`: the value at the
 * bar first, because the state at the bar is the one a reader argues about.
 */
function numberValues(field: Field, options: { pivots?: number[] }): number[] {
  const pivots = [...(field.pivots ?? []), ...(options.pivots ?? [])];
  const out = [0, 1];
  for (const p of pivots) out.push(p, p + 1, p - 1);
  return [...new Set(out)];
}

function mutate(base: Candidate, edits: [string, unknown][]): Candidate {
  const next = { ...base };
  for (const [field, value] of edits) {
    if (value === ABSENT) delete next[field];
    else next[field] = value;
  }
  return next;
}

function solveError(message: string, context: Record<string, unknown> = {}): LaunchwrightError {
  return new LaunchwrightError('qa.states.solve', message, { context });
}

/**
 * The ordered, finite, deduplicated candidate stream. It throws on an empty corpus: an empty
 * stream reports every state unreachable when the truth is that nothing was captured.
 */
export function candidatePlan(shape: Shape, corpus: readonly Candidate[], options: { limit?: number; pivots?: number[] } = {}): PlanStep[] {
  const errors = validateShape(shape);
  if (errors.length > 0) throw solveError(`The shape is unusable: ${errors.join('; ')}`, { errors });
  if (!Array.isArray(corpus) || corpus.length === 0) {
    throw solveError('The corpus is empty. It holds real objects from the wire, and a search of none reports every state unreachable.');
  }
  for (const [i, entry] of corpus.entries()) {
    if (!isPlainObject(entry)) throw solveError(`corpus[${i}] is not an object`);
  }
  const limit = options.limit ?? MAX_CANDIDATES;
  if (!Number.isInteger(limit) || limit < 1) throw solveError(`limit must be a positive integer, not ${String(options.limit)}`);

  const values = new Map<string, unknown[]>();
  for (const [name, field] of Object.entries(shape.fields)) {
    const list = fieldValues(field, options);
    if (list.length > 0) values.set(name, list);
  }
  const names = [...values.keys()];
  const valuesOf = (name: string): unknown[] => values.get(name) ?? [];

  const plan: PlanStep[] = [];
  const seen = new Set<string>();
  const full = (): boolean => plan.length >= limit;
  const add = (candidate: Candidate, base: Candidate, baseIndex: number): void => {
    const key = canonical(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    const { changes, text } = describeCandidate(candidate, base);
    plan.push({ candidate, base, baseIndex, changes, text });
  };

  // Phase 0: the real objects.
  for (const [i, base] of corpus.entries()) {
    if (full()) break;
    add({ ...base }, base, i);
  }
  // Phase 1: one field at a time.
  for (const [i, base] of corpus.entries()) {
    for (const name of names) {
      for (const value of valuesOf(name)) {
        if (full()) return plan;
        add(mutate(base, [[name, value]]), base, i);
      }
    }
  }
  // Phase 2: two fields at a time.
  for (const [i, base] of corpus.entries()) {
    for (let a = 0; a < names.length; a += 1) {
      for (let b = a + 1; b < names.length; b += 1) {
        const first = names[a] as string;
        const second = names[b] as string;
        for (const x of valuesOf(first)) {
          for (const y of valuesOf(second)) {
            if (full()) return plan;
            add(mutate(base, [[first, x], [second, y]]), base, i);
          }
        }
      }
    }
  }
  return plan;
}

/** The candidate stream alone. */
export function candidates(shape: Shape, corpus: readonly Candidate[], options: { limit?: number; pivots?: number[] } = {}): Candidate[] {
  return candidatePlan(shape, corpus, options).map((step) => step.candidate);
}

/** What changed to make a candidate, so a report can say "capped: false -> true". */
export function describeCandidate(candidate: Candidate, corpusEntry: Candidate): { changes: Change[]; text: string } {
  const names = [...new Set([...Object.keys(corpusEntry), ...Object.keys(candidate)])];
  const changes: Change[] = [];
  for (const field of names) {
    const had = Object.hasOwn(corpusEntry, field) && corpusEntry[field] !== undefined;
    const has = Object.hasOwn(candidate, field) && candidate[field] !== undefined;
    if (!had && !has) continue;
    if (had && has && same(corpusEntry[field], candidate[field])) continue;
    changes.push({ field, from: had ? corpusEntry[field] : ABSENT, to: has ? candidate[field] : ABSENT });
  }
  const text =
    changes.length === 0 ? 'unchanged from the corpus entry' : changes.map((c) => `${c.field}: ${show(c.from)} -> ${show(c.to)}`).join(', ');
  return { changes, text };
}

/**
 * The sentence a report prints when no candidate produced a member, or null when every member was
 * covered. It names the fields that were varied, so a reader can tell a finding from a narrow search.
 */
export function unreachable(union: { name: string; members: string[]; covered?: string[] }, tried: { count: number; fields: string[] }): string | null {
  const covered = union.covered ?? [];
  const missing = union.members.filter((m) => !covered.includes(m));
  if (missing.length === 0) return null;
  const varied = tried.fields.length > 0 ? tried.fields.join(', ') : 'no field';
  const produced = covered.length > 0 ? covered.map((m) => show(m)).join(', ') : 'nothing';
  return (
    `${union.name}: ${missing.map((m) => show(m)).join(', ')} unreachable. ` +
    `${tried.count} candidate${tried.count === 1 ? '' : 's'} varied ${varied}, and produced ${produced}. ` +
    'A state the type admits and the data cannot produce is a finding, not a gap in the search.'
  );
}

export interface SolveResult {
  covered: Record<string, PlanStep & { state: string }>;
  order: string[];
  tried: number;
  planned: number;
  limit: number;
  missing: string[];
  extra: string[];
  sentence: string | null;
}

/** A state function's answer as a covered key. Anything but a string or null is the wrong function. */
export function normaliseState(raw: unknown): string {
  if (raw === null || raw === undefined) return NULL_STATE;
  if (typeof raw !== 'string') {
    throw solveError(`The state function answered ${typeof raw}. A state function returns a union member or null, so the wrong function was evaluated.`);
  }
  return raw;
}

/** Runs the stream through the app's own function until every member is covered. */
export async function solve(args: {
  shape: Shape;
  corpus: readonly Candidate[];
  evaluate: Evaluate;
  members?: string[] | null;
  union?: string;
  limit?: number;
  pivots?: number[];
}): Promise<SolveResult> {
  const { shape, corpus, evaluate, members = null, union, limit, pivots } = args;
  const plan = candidatePlan(shape, corpus, { ...(limit === undefined ? {} : { limit }), ...(pivots === undefined ? {} : { pivots }) });
  const wanted = members === null ? null : new Set(members);
  const covered: Record<string, PlanStep & { state: string }> = {};
  const order: string[] = [];
  let tried = 0;
  let hits = 0;
  for (const step of plan) {
    tried += 1;
    const state = normaliseState(await evaluate(step.candidate));
    if (!Object.hasOwn(covered, state)) {
      covered[state] = { ...step, state };
      order.push(state);
      if (wanted?.has(state)) hits += 1;
    }
    if (wanted !== null && hits === wanted.size) break;
  }
  const name = union ?? shape.type;
  const missing = wanted === null ? [] : [...wanted].filter((m) => !Object.hasOwn(covered, m));
  const extra = wanted === null ? [] : order.filter((s) => !wanted.has(s));
  return {
    covered,
    order,
    tried,
    planned: plan.length,
    limit: limit ?? MAX_CANDIDATES,
    missing,
    extra,
    sentence:
      missing.length === 0 || wanted === null
        ? null
        : unreachable({ name, members: [...wanted], covered: order }, { count: tried, fields: Object.keys(shape.fields) }),
  };
}

/** The base row with the candidate's values for `fields`. A field the candidate lacks is deleted. */
export function graft(base: Candidate, candidate: Candidate, fields: readonly string[]): Candidate {
  const next = { ...base };
  for (const field of fields) {
    if (Object.hasOwn(candidate, field) && candidate[field] !== undefined) next[field] = candidate[field];
    else delete next[field];
  }
  return next;
}

function sameField(a: Candidate, b: Candidate, field: string): boolean {
  const hasA = Object.hasOwn(a, field) && a[field] !== undefined;
  const hasB = Object.hasOwn(b, field) && b[field] !== undefined;
  if (!hasA && !hasB) return true;
  if (hasA !== hasB) return false;
  return same(a[field], b[field]);
}

/**
 * Builds every solved subject on one real row, so two renderings differ only in the field under
 * test. Phase 0 of the plan offers every corpus entry, and a corpus already holds several states,
 * so the first answers come from different rows. A diff of two different rows locates the page,
 * not the state.
 *
 * For each member: graft every field where the candidate differs from the base, then drop one
 * field at a time while the app's own function still answers the member. A member the graft
 * cannot produce keeps the solver's row, and a note says so.
 */
export async function anchorSubjects(args: {
  shape: Shape;
  base: Candidate;
  covered: Record<string, { candidate: Candidate }>;
  members: readonly string[];
  evaluate: Evaluate;
}): Promise<{ subjects: Record<string, Candidate>; fields: string[]; anchored: string[]; loose: string[]; notes: string[]; evaluations: number }> {
  const { shape, base, covered, members, evaluate } = args;
  const errors = validateShape(shape);
  if (errors.length > 0) throw solveError(`The shape is unusable: ${errors.join('; ')}`, { errors });
  const shapeFields = Object.keys(shape.fields);
  const subjects: Record<string, Candidate> = {};
  const fields: string[] = [];
  const anchored: string[] = [];
  const loose: string[] = [];
  const notes: string[] = [];
  let evaluations = 0;
  const answers = async (candidate: Candidate): Promise<string> => {
    evaluations += 1;
    return normaliseState(await evaluate(candidate));
  };

  for (const member of members) {
    const hit = covered[member];
    if (hit === undefined || !isPlainObject(hit.candidate)) continue;
    const candidate = hit.candidate;
    let keep = shapeFields.filter((f) => !sameField(base, candidate, f));
    if ((await answers(graft(base, candidate, keep))) !== member) {
      subjects[member] = { ...candidate };
      loose.push(member);
      notes.push(
        `${member} could not be anchored on the base row: grafting ${keep.length > 0 ? keep.join(', ') : 'no field'} ` +
          'onto it does not produce the state, so the state depends on a field the shape does not declare. ' +
          "This member keeps the solver's own row, and its picture differs from the others in more than the state.",
      );
      continue;
    }
    for (const field of [...keep]) {
      const without = keep.filter((f) => f !== field);
      if ((await answers(graft(base, candidate, without))) === member) keep = without;
    }
    subjects[member] = graft(base, candidate, keep);
    anchored.push(member);
    for (const f of keep) if (!fields.includes(f)) fields.push(f);
  }
  return { subjects, fields, anchored, loose, notes, evaluations };
}
