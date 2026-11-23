// The browser side of the dev state page `/__states?c=<Component>&props=<json>` (spec 2.3, 2.7,
// `mounted` provenance). It reads the address once, loads the named component and mounts it with
// the props through the mount function of the UI adapter. Each failure draws a panel that names
// it, never a blank page. Dev only (lw-qa-dev-only): the dev server plugin `qaStatesPage` loads
// this file by its path. It imports no UI library and no Node module.
import { LaunchwrightError, messageOf } from '../kernel/services/errors.mts';
import { QA_DEV_MARKER, QA_STATES_ATTRIBUTE, QA_STATES_ROOT_ID } from './names.mts';

/** One mount: the adapter renders `component` with `props` in `target`, inside `wrapper`. */
export interface StatesMountArgs<C> {
  name: string;
  component: C;
  props: Record<string, unknown>;
  target: HTMLElement;
  wrapper?: C;
  /** Draws the failure panel. The adapter calls it when the component throws while it renders. */
  fail: (reason: string) => void;
}

export interface StatesPageOptions<C> {
  /** Component name to a function that imports its module. */
  components: Record<string, () => Promise<Record<string, unknown>>>;
  /** The project providers with fakes. It gets the subject as its children. */
  wrapper?: C;
  mount: (args: StatesMountArgs<C>) => void;
  /** The address query. Default `location.search`. */
  search?: string;
}

export interface StatesRequest {
  name: string;
  props: Record<string, unknown>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads `c` and `props` from the address, or says why it cannot. */
export function readStatesRequest(search: string, names: readonly string[]): StatesRequest | string {
  const query = new URLSearchParams(search);
  const name = query.get('c');
  if (!name) return 'No component named. Add ?c=<Component>.';
  if (!names.includes(name)) return `No component named ${name} is mountable.`;
  const raw = query.get('props');
  let props: unknown = {};
  if (raw !== null && raw !== '') {
    try {
      props = JSON.parse(raw);
    } catch (err) {
      return `props is not JSON: ${messageOf(err)}`;
    }
  }
  if (!isPlainObject(props)) return 'props must be a JSON object, for example {"state":"locked"}.';
  return { name, props };
}

/** The failure panel. One shape for each failure, with the mountable names. */
function drawFailure(root: HTMLElement, reason: string, names: readonly string[]): void {
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.setAttribute('data-qa-states-error', QA_DEV_MARKER);
  const text = document.createElement('p');
  text.textContent = reason;
  const known = document.createElement('p');
  known.textContent = `Mountable: ${names.join(', ')}`;
  panel.append(text, known);
  root.replaceChildren(panel);
  root.setAttribute('aria-busy', 'false');
  console.error(`[launchwright] /__states: ${reason}`);
}

/**
 * Mounts the component that the address names. The subject element is
 * `<div data-qa-subject="<name>">`, the element a capture shoots. The page root keeps
 * `aria-busy="true"` until the mount call returns.
 */
export async function startStatesPage<C>(opts: StatesPageOptions<C>): Promise<void> {
  const selector = `#${QA_STATES_ROOT_ID}[${QA_STATES_ATTRIBUTE}="${QA_DEV_MARKER}"]`;
  const root = document.querySelector<HTMLElement>(selector);
  if (root === null) throw new LaunchwrightError('client.qa.states.root', `/__states: the page has no ${selector} element`);
  const names = Object.keys(opts.components).sort();
  const request = readStatesRequest(opts.search ?? window.location.search, names);
  if (typeof request === 'string') return drawFailure(root, request, names);
  const { name, props } = request;
  const load = opts.components[name];
  let mod: Record<string, unknown>;
  try {
    mod = load === undefined ? {} : await load();
  } catch (err) {
    return drawFailure(root, `${name} could not load: ${messageOf(err)}`, names);
  }
  const component = mod[name] ?? mod.default;
  if (typeof component !== 'function') return drawFailure(root, `The module of ${name} exports no component named ${name} and no default export.`, names);
  const target = document.createElement('div');
  target.setAttribute('data-qa-subject', name);
  root.replaceChildren(target);
  const fail = (reason: string): void => drawFailure(root, reason, names);
  try {
    opts.mount({ name, component: component as C, props, target, ...(opts.wrapper !== undefined ? { wrapper: opts.wrapper } : {}), fail });
  } catch (err) {
    return fail(`${name} threw while rendering: ${messageOf(err)}`);
  }
  root.setAttribute('aria-busy', 'false');
}
