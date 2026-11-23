// Mounted capture (spec 2.7, provenance `mounted`; spec 2.14 rule C2): the client dev route
// `/__states?c=<Component>&props=<json>` draws one component with the given props, and the target
// session photographs it. A mounted shot may claim the rendering of that state only.
//
// The harness page marks itself, its subject and its own failures with the attributes below. The
// client module draws them (`modules/client/README.md`, "State page"), and this file only reads
// them. The client module is an optional peer of qa, so the names are not imported.
import { posix } from 'node:path';
import type { QaSession } from '../../drivers/target/contract.mts';
import type { Settle } from '../../services/types.mts';
import { CaptureFailure, errorText, failureFields } from './capture.mts';
import type { EvidenceRecorder } from './capture.mts';
import { type Inventory, type InputSite, type MountHints, type PlannedCapture, type StateResult, statePath, type UnionEntry } from './inventory.mts';

/** The harness route, relative to the surface base (spec 2.7). */
export const STATES_HARNESS_PATH = '/__states';

/** The attribute on the harness root `<main id="lw-qa-states">`. A page without it is not the harness. */
export const HARNESS_ATTRIBUTE = 'data-qa-states';

/** The wrapper around the mounted component. Its child is the component's own root. */
export const SUBJECT_WRAPPER = '[data-qa-subject]';
export const SUBJECT_CHILD = '[data-qa-subject] > *';

/** The panel the harness draws for any mount failure. Its first paragraph is the reason. */
export const HARNESS_ERROR = '[data-qa-states-error]';

/** The settle a mount uses when the hints name none: the component's own root is on screen. */
export const DEFAULT_MOUNT_SETTLE: Settle = { selector: SUBJECT_CHILD, timeout: 10_000 };

/**
 * The address that mounts one component with one set of props, relative to the surface base.
 * The props are JSON in the `props` query value. `width` sets the frame width (`w`).
 */
export function mountUrl(options: { component: string; props?: Record<string, unknown>; width?: string | number | null }): string {
  const query = new URLSearchParams({ c: options.component, props: JSON.stringify(options.props ?? {}) });
  if (options.width !== null && options.width !== undefined) query.set('w', String(options.width));
  return `${STATES_HARNESS_PATH}?${query.toString()}`;
}

/** One planned capture resolved to a component, a field and props, or to the refusal that says why not. */
export interface ResolvedMount {
  capture: PlannedCapture;
  leg: string;
  component: string | null;
  field: string | null;
  props: Record<string, unknown>;
  width: string | null;
  settle: Settle;
  refusal: CaptureFailure | null;
}

const memberKey = (member: string | null): string => (member === null ? 'null' : member);

/** The input site to mount: the hinted component, else the first site that has a component. */
function siteFor(union: UnionEntry, hints: MountHints): InputSite | null {
  if (typeof hints.component === 'string') return union.inputs.find((s) => s.component === hints.component) ?? union.inputs[0] ?? null;
  return union.inputs.find((s) => s.component !== null) ?? union.inputs[0] ?? null;
}

/**
 * Resolves one capture for the harness. Every refusal is `unmountable` or `blocked`, and both are
 * failures: a state that nothing can mount is the finding. The field under test is written last,
 * so no hint can decide the state that the picture carries.
 */
export function resolveMount(inventory: Pick<Inventory, 'unions'>, capture: PlannedCapture, defaultLeg: string): ResolvedMount {
  const union = inventory.unions.find((u) => u.name === capture.union);
  const hints: MountHints = union?.mount ?? {};
  const base: ResolvedMount = {
    capture,
    leg: hints.leg ?? defaultLeg,
    component: null,
    field: null,
    props: {},
    width: hints.width ?? null,
    settle: hints.settle ?? DEFAULT_MOUNT_SETTLE,
    refusal: null,
  };
  const refuse = (refusal: CaptureFailure): ResolvedMount => ({ ...base, refusal });
  if (union === undefined) return refuse(new CaptureFailure('blocked', `the inventory has no union named ${capture.union}`));
  if (union.kind !== 'input' && union.kind !== 'both') {
    return refuse(new CaptureFailure('blocked', `${union.name} is "${union.kind}", and a mount reaches an input`));
  }
  const site = siteFor(union, hints);
  if (site === null) return refuse(new CaptureFailure('blocked', `${union.name} says it is an input and the scan found no field that holds it`));
  const component = hints.component ?? site.component;
  if (component === null) {
    const where = union.inputs.map((s) => `${s.interface}.${s.field} (${s.file})`).join(', ');
    return refuse(
      new CaptureFailure(
        'unmountable',
        `no component takes ${union.name}: it is a field of ${where}, and none of those is the props type of a component. ` +
          `Give the component that branches on it a prop of type ${union.name}`,
        { missingProp: `${site.interface}.${site.field} (no component takes this union)` },
      ),
    );
  }
  if (capture.member === null) {
    return refuse(
      new CaptureFailure('unmountable', `${union.name} asks for the rendering of an absent ${site.field}, and the harness always sets it. The null rendering belongs to the solver`, {
        missingProp: `${site.field} (cannot be made absent through the harness)`,
      }),
    );
  }
  const props: Record<string, unknown> = { ...hints.props, ...hints.members?.[memberKey(capture.member)], [site.field]: capture.member };
  return { ...base, component, field: site.field, props };
}

/** The expression that reads the harness state of the page: marker, failure panel and subject roots. */
export function harnessStateExpression(): string {
  return `(() => {
  const harness = document.querySelector(${JSON.stringify(`[${HARNESS_ATTRIBUTE}]`)}) !== null;
  const panel = document.querySelector(${JSON.stringify(HARNESS_ERROR)});
  const reason = panel === null ? null : panel.querySelector('p') || panel;
  const error = reason === null ? null : (reason.textContent || '').replace(/\\s+/g, ' ').trim();
  const roots = document.querySelectorAll(${JSON.stringify(SUBJECT_CHILD)}).length;
  return { harness, error, roots };
})()`;
}

interface HarnessState {
  harness: boolean;
  error: string | null;
  roots: number;
}

const condense = (reason: string): string => (reason.length <= 120 ? reason : `${reason.slice(0, 117)}...`);

async function harnessState(session: QaSession): Promise<HarnessState | null> {
  if (!session.evaluate) return null;
  return (await session.evaluate(harnessStateExpression())) as HarnessState;
}

/** What a reader sees beside the picture. */
function expectation(r: ResolvedMount): string {
  const extra = Object.keys(r.props).filter((key) => key !== r.field);
  return `${r.component} drawn with ${r.field}="${r.capture.member}"${extra.length === 0 ? '' : ` (plus ${extra.join(', ')})`}`;
}

/**
 * Mounts one capture and photographs it. A target without `evaluate` cannot prove the page is the
 * harness, so it is refused rather than trusted.
 */
export async function captureMounted(
  session: QaSession,
  r: ResolvedMount,
  ctx: { reportDir: string; slug: string; record: EvidenceRecorder; now: () => number },
): Promise<StateResult> {
  const started = ctx.now();
  const result: StateResult = {
    id: r.capture.id,
    union: r.capture.union,
    member: r.capture.member,
    ok: false,
    subject: null,
    context: null,
    provenance: 'mounted',
    // No feature function runs under a mount. Null is "not checked", never "it agreed".
    verified: null,
    error: null,
    ms: 0,
    ...(r.component === null ? {} : { component: r.component }),
  };
  try {
    if (r.refusal !== null) throw r.refusal;
    if (!session.evaluate) {
      throw new CaptureFailure('blocked', 'the target cannot evaluate in the page, so it cannot prove that the page is the state harness');
    }
    const url = mountUrl({ component: r.component as string, props: r.props, width: r.width });
    await session.navigate(url);
    try {
      await session.settle(r.settle);
    } catch (e) {
      const late = await harnessState(session);
      if (late?.error) throw new CaptureFailure('unmountable', `${r.component} did not mount: ${late.error}`, { missingProp: condense(late.error) }, e);
      if (late && !late.harness) throw new CaptureFailure('blocked', `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`, {}, e);
      throw e;
    }
    const state = await harnessState(session);
    if (!state?.harness) {
      throw new CaptureFailure('blocked', `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`);
    }
    if (state.error) throw new CaptureFailure('unmountable', `the harness refused ${url}: ${state.error}`, { missingProp: condense(state.error) });
    if (state.roots === 0) throw new CaptureFailure('crashed', `${r.component} mounted and drew no element`);
    const held = await session.currentRoute();
    if (!held.startsWith(STATES_HARNESS_PATH)) throw new CaptureFailure('blocked', `the page left the harness for ${held}`);
    const subject = statePath(ctx.slug, r.capture.id, 'subject');
    await session.screenshot(posix.join(ctx.reportDir, subject));
    await ctx.record({ file: posix.join(ctx.reportDir, subject), kind: 'screenshot', row: r.capture.id });
    result.subject = subject;
    result.expect = expectation(r);
    result.ok = true;
  } catch (e) {
    result.error = errorText(e);
    Object.assign(result, failureFields(e));
  }
  result.ms = ctx.now() - started;
  return result;
}
