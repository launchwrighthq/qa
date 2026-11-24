// The shot manifest: the rows a QA pass plans before any browser opens (spec 2.4). The plan of a
// report is `<reportDir>/<slug>.shots.json`, and it holds one `Manifest`.
import { readFile } from 'node:fs/promises';
import { LaunchwrightError } from '../kernel/index.mts';
import { DEFAULT_LEGS } from './legs.mts';
import { type Act, ACT_KINDS, type EvidenceKind, type Settle, type Surface } from './types.mts';

/** What a row needs on the QA world before it runs. */
export interface Fixture {
  /** States to arm on the QA database, then disarm after the run. Empty when nothing is armed. */
  arm: string[];
  /** A persona id from the world registry. */
  persona?: string;
  /** Fact ids from the world registry. */
  facts?: string[];
}

/** What a row expects. A plain string is the claim with no expected page error. */
export interface ShotExpect {
  text: string;
  /** Page errors this row expects, matched as substrings. Any other page error fails the row. */
  pageErrors?: string[];
}

/** One row of the manifest (spec 2.4). */
export interface Shot {
  /** `<screen>.<state-slug>`, lower case and hyphenated. */
  id: string;
  screen: string;
  state: string;
  /** The spec section this row checks, digits and dots. */
  specRef?: string;
  /** `spec:<path>#<id>`, `commit:<sha>` or `issue:<intake-id>`. At least one. */
  source: string[];
  /** Leg names. */
  legs: string[];
  /** Relative to the surface base: `/store`, never `<base>/store`. */
  route: string;
  fixture: Fixture;
  act?: Act[];
  /** Record a video for this row even when it has no `act`. */
  video?: boolean;
  settle: Settle;
  expect: string | ShotExpect;
}

/** A manifest: the plan of one report. */
export interface Manifest {
  title: string;
  /** ISO time of the plan. */
  generated: string;
  /** The spec path, for a spec pass. */
  spec?: string;
  /** The commit range, for a range pass. */
  range?: string;
  /** Intake issue ids, for an issue pass. */
  issues?: string[];
  commits?: string[];
  shots: Shot[];
}

export interface ValidateOptions {
  /** The leg names a row may name. Default: the six default legs. */
  legs?: Iterable<string>;
  /** Surface base paths, for example `/app`. A route that starts with one is refused. */
  bases?: string[];
}

const SHOT_FIELDS = ['id', 'screen', 'state', 'source', 'legs', 'route', 'fixture', 'settle', 'expect'] as const;
const ACT_FIELDS = new Set(['kind', 'target', 'text', 'key', 'dx', 'dy', 'ms', 'why']);
const SETTLE_RULES = ['selector', 'artwork', 'video', 'busy'] as const;
const SOURCE_RE = /^(?:spec:[^\s#]+#[A-Za-z0-9._-]+|commit:[0-9a-f]{7,40}|issue:[A-Za-z0-9._-]+)$/;
/** A persona id or a state name: kebab case. */
export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FACT_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function checkAct(at: string, step: unknown, errors: string[]): void {
  if (!isObject(step)) {
    errors.push(`${at}: not an object`);
    return;
  }
  for (const key of Object.keys(step)) if (!ACT_FIELDS.has(key)) errors.push(`${at}: "${key}" is not an act field`);
  const kind = step.kind;
  if (typeof kind !== 'string' || !(ACT_KINDS as readonly string[]).includes(kind)) {
    errors.push(`${at}: kind "${String(kind)}" is not one of ${ACT_KINDS.join(' ')}. The list is closed so every target can run it.`);
    return;
  }
  if ((kind === 'click' || kind === 'type') && !isText(step.target)) errors.push(`${at}: a ${kind} needs a target selector`);
  if (kind === 'type' && typeof step.text !== 'string') errors.push(`${at}: a type needs text`);
  if (kind === 'press' && !isText(step.key)) errors.push(`${at}: a press needs a key`);
  if (kind === 'scroll' && typeof step.dx !== 'number' && typeof step.dy !== 'number') errors.push(`${at}: a scroll needs dx or dy`);
  if (kind === 'wait') {
    if (typeof step.ms !== 'number' || step.ms <= 0) errors.push(`${at}: a wait needs ms above 0`);
    // A bare sleep hides a race. The author names what the wait is for.
    if (!isText(step.why)) errors.push(`${at}: a wait needs a why that names what it waits for`);
  }
}

function checkFixture(at: string, fixture: unknown, errors: string[]): void {
  if (!isObject(fixture)) {
    errors.push(`${at}: fixture must be an object with arm`);
    return;
  }
  const { account, arm, persona, facts } = fixture;
  if (account !== undefined) errors.push(`${at}: fixture.account is refused. Use fixture.persona, a persona id from the world registry.`);
  if (persona !== undefined && (typeof persona !== 'string' || !KEBAB.test(persona))) {
    errors.push(`${at}: fixture.persona must be a kebab-case persona id`);
  }
  if (facts !== undefined) {
    if (!Array.isArray(facts)) errors.push(`${at}: fixture.facts must be an array of fact ids`);
    else for (const fact of facts) if (typeof fact !== 'string' || !FACT_ID.test(fact)) errors.push(`${at}: fixture.facts holds "${String(fact)}", which is not a fact id`);
  }
  if (!Array.isArray(arm)) errors.push(`${at}: fixture.arm must be an array, empty when nothing is armed`);
  else for (const state of arm) if (typeof state !== 'string' || !KEBAB.test(state)) errors.push(`${at}: fixture.arm holds "${String(state)}", which is not a state name`);
}

function checkSettle(at: string, settle: unknown, errors: string[]): void {
  if (!isObject(settle)) {
    errors.push(`${at}: settle must be an object`);
    return;
  }
  const rules = SETTLE_RULES.filter((rule) => (rule === 'selector' ? isText(settle.selector) : settle[rule] === true));
  // A row that settles on nothing photographs the network going quiet, not a painted screen.
  if (rules.length !== 1) {
    errors.push(`${at}: settle needs exactly one of ${SETTLE_RULES.join(', ')}; it has ${rules.length === 0 ? 'none' : rules.join(', ')}`);
  }
  if (settle.timeout !== undefined && (typeof settle.timeout !== 'number' || settle.timeout <= 0)) {
    errors.push(`${at}: settle.timeout must be a number of milliseconds above 0`);
  }
}

function checkExpect(at: string, expect: unknown, errors: string[]): void {
  if (isText(expect)) return;
  if (!isObject(expect)) {
    errors.push(`${at}: expect must be a claim, or an object with text and pageErrors`);
    return;
  }
  if (!isText(expect.text)) errors.push(`${at}: expect.text is missing`);
  if (expect.pageErrors !== undefined && (!Array.isArray(expect.pageErrors) || !expect.pageErrors.every(isText))) {
    errors.push(`${at}: expect.pageErrors must be an array of page error texts`);
  }
}

function checkShot(shot: unknown, i: number, seen: Set<string>, legs: Set<string>, bases: string[], errors: string[]): void {
  const at = isObject(shot) && typeof shot.id === 'string' ? `shots[${i}] "${shot.id}"` : `shots[${i}]`;
  if (!isObject(shot)) {
    errors.push(`${at}: not an object`);
    return;
  }
  for (const field of SHOT_FIELDS) if (shot[field] === undefined) errors.push(`${at}: ${field} is missing`);
  if (typeof shot.id === 'string') {
    if (seen.has(shot.id)) errors.push(`${at}: duplicate id`);
    seen.add(shot.id);
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(shot.id)) errors.push(`${at}: id must be <screen>.<state-slug>, lower case and hyphenated`);
  }
  for (const field of ['screen', 'state'] as const) {
    if (shot[field] !== undefined && !isText(shot[field])) errors.push(`${at}: ${field} must be a text`);
  }
  if (shot.specRef !== undefined && (typeof shot.specRef !== 'string' || !/^\d+(\.\d+)*$/.test(shot.specRef))) {
    errors.push(`${at}: specRef is digits and dots, the spec section this row checks`);
  }
  if (shot.source !== undefined) {
    if (!Array.isArray(shot.source) || shot.source.length === 0) {
      errors.push(`${at}: source must hold at least one of spec:<path>#<id>, commit:<sha>, issue:<intake-id>`);
    } else {
      for (const s of shot.source) if (typeof s !== 'string' || !SOURCE_RE.test(s)) errors.push(`${at}: source "${String(s)}" is not spec:<path>#<id>, commit:<sha> or issue:<intake-id>`);
    }
  }
  if (Array.isArray(shot.legs)) {
    if (shot.legs.length === 0) errors.push(`${at}: legs is empty, so the row runs nowhere`);
    for (const leg of shot.legs) if (typeof leg !== 'string' || !legs.has(leg)) errors.push(`${at}: "${String(leg)}" is not a leg. Legs: ${[...legs].join(' ')}`);
    if (new Set(shot.legs).size !== shot.legs.length) errors.push(`${at}: legs names one leg twice`);
  } else if (shot.legs !== undefined) {
    errors.push(`${at}: legs must be an array`);
  }
  if (shot.route !== undefined) {
    if (typeof shot.route !== 'string' || !shot.route.startsWith('/')) errors.push(`${at}: route must start with /`);
    else {
      // A route copied from a device address carries the surface base, and the leg adds it again.
      const base = bases.find((b) => b !== '' && (shot.route === b || (shot.route as string).startsWith(`${b}/`)));
      if (base !== undefined) errors.push(`${at}: route is relative to the surface base, so drop ${base}. Each leg adds its own base.`);
    }
  }
  if (shot.video !== undefined && typeof shot.video !== 'boolean') errors.push(`${at}: video must be true, false or absent`);
  if (shot.fixture !== undefined) checkFixture(at, shot.fixture, errors);
  if (shot.settle !== undefined) checkSettle(at, shot.settle, errors);
  if (shot.expect !== undefined) checkExpect(at, shot.expect, errors);
  if (shot.act !== undefined) {
    if (!Array.isArray(shot.act)) errors.push(`${at}: act must be an array`);
    else shot.act.forEach((step, j) => checkAct(`${at}: act[${j}]`, step, errors));
  }
}

/**
 * Every problem of a manifest, each naming its row. It returns all problems at once, so one run
 * fixes a whole plan.
 */
export function validateManifest(m: unknown, opts: ValidateOptions = {}): string[] {
  const errors: string[] = [];
  if (!isObject(m)) return ['the manifest is not an object'];
  for (const field of ['title', 'generated'] as const) if (!isText(m[field])) errors.push(`${field}: missing`);
  for (const field of ['spec', 'range'] as const) if (m[field] !== undefined && !isText(m[field])) errors.push(`${field}: must be a text`);
  for (const field of ['issues', 'commits'] as const) {
    if (m[field] !== undefined && (!Array.isArray(m[field]) || !(m[field] as unknown[]).every(isText))) errors.push(`${field}: must be an array of texts`);
  }
  if (!Array.isArray(m.shots) || m.shots.length === 0) {
    errors.push('shots: must be a non-empty array');
    return errors;
  }
  const legs = new Set(opts.legs ?? Object.keys(DEFAULT_LEGS));
  const seen = new Set<string>();
  m.shots.forEach((shot, i) => checkShot(shot, i, seen, legs, opts.bases ?? [], errors));
  return errors;
}

/** Reads and validates a manifest. Fails with `qa.manifest.invalid` and every problem. */
export async function loadManifest(path: string, opts: ValidateOptions = {}): Promise<Manifest> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    throw new LaunchwrightError('qa.manifest.read', `Cannot read the manifest ${path}`, { cause, context: { path } });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError('qa.manifest.json', `The manifest ${path} is not JSON`, { cause, context: { path } });
  }
  const errors = validateManifest(parsed, opts);
  if (errors.length > 0) {
    throw new LaunchwrightError('qa.manifest.invalid', `The manifest ${path} is invalid:\n  ${errors.join('\n  ')}`, {
      context: { path, errors },
    });
  }
  return parsed as Manifest;
}

/** The claim of a row. */
export function expectText(shot: Pick<Shot, 'expect'>): string {
  return typeof shot.expect === 'string' ? shot.expect : shot.expect.text;
}

/** The page errors a row expects. */
export function expectedPageErrors(shot: Pick<Shot, 'expect'>): string[] {
  return typeof shot.expect === 'string' ? [] : (shot.expect.pageErrors ?? []);
}

/**
 * The path a leg loads for a row: the surface base, then the route. On the `miniapp` surface a row
 * with a persona adds `?qa=<persona>`, which the fake Telegram launch reads and strips (spec 2.6).
 */
export function routeFor(shot: Pick<Shot, 'route' | 'fixture'>, surface: { surface: Surface; base?: string }): string {
  const path = `${surface.base ?? ''}${shot.route}`;
  const persona = shot.fixture.persona;
  if (surface.surface !== 'miniapp' || !persona) return path;
  return `${path}${path.includes('?') ? '&' : '?'}qa=${encodeURIComponent(persona)}`;
}

const SUFFIX: Record<Exclude<EvidenceKind, 'screenshot' | 'step' | 'video'>, string> = {
  trace: 'trace.zip',
  log: 'log.jsonl',
  ui: 'ui.xml',
};

export interface EvidencePathOptions {
  /** The act step number, for a `step` screenshot. */
  step?: number;
  /** The attempt number. Attempt 1 has no attempt part in the name. */
  attempt?: number;
  /** The video extension: `webm` from a browser, `mp4` from a device. Default `webm`. */
  videoExt?: 'webm' | 'mp4';
}

/**
 * The path of one evidence file, relative to the report folder (spec 2.11.1):
 * `assets/<slug>/<leg>-<id>[.a<attempt>][.<step>].<suffix>`. Each report has its own folder, so two
 * reports never share a file.
 */
export function evidencePath(slug: string, leg: string, rowId: string, kind: EvidenceKind, opts: EvidencePathOptions = {}): string {
  const attempt = opts.attempt !== undefined && opts.attempt > 1 ? `.a${opts.attempt}` : '';
  let suffix: string;
  if (kind === 'screenshot') suffix = 'png';
  else if (kind === 'step') {
    if (opts.step === undefined) throw new LaunchwrightError('qa.evidence.step', `A step screenshot of ${rowId} on ${leg} needs a step number`);
    suffix = `${opts.step}.png`;
  } else if (kind === 'video') suffix = opts.videoExt ?? 'webm';
  else suffix = SUFFIX[kind];
  return `assets/${slug}/${leg}-${rowId}${attempt}.${suffix}`;
}

/** The screenshot after settle of a row on a leg, relative to the report folder. */
export function shotPath(slug: string, shot: Pick<Shot, 'id'>, leg: string): string {
  return evidencePath(slug, leg, shot.id, 'screenshot');
}

/** The legs a row runs, given the legs the caller asks for (`null` for every leg). */
export function legsFor(shot: Pick<Shot, 'legs'>, only: readonly string[] | null = null): string[] {
  return only === null ? [...shot.legs] : shot.legs.filter((leg) => only.includes(leg));
}
