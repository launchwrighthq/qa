// The overlay step of the path crawl: a dialog or sheet that covers a page is cleared before the
// crawl reads the page's controls. A dismiss is no path step. The crawl logs each one apart.
//
// The page script below is shared by the control list, the press and the overlay probe, so all
// three agree about which control a person can see and press.
import { LaunchwrightError, messageOf } from '../kernel/index.mts';
import type { QaSession } from '../drivers/target/contract.mts';

/** The elements the crawl lists as controls. An element a person cannot see as a control is no step. */
export const CONTROL_SELECTOR = 'button, a, [role="button"], [role="link"], [role="tab"]';

/** A step carries the control's accessible name, cut to this length. */
export const MAX_LABEL = 60;

/** How long a dismiss waits for the overlay to leave, for example while a sheet slides out. */
export const DISMISS_WAIT_MS = 1_500;

/** How many overlays the step clears on one page, one after the other. */
export const DISMISS_ROUNDS = 3;

/** The key the built-in step presses when an overlay stays after the dismiss list. */
export const AUTO_DISMISS_KEY = 'Escape';

/** One entry of `qa.paths.dismiss`: a CSS selector, a control by role and name, or a key. */
export type DismissEntry = { selector: string } | { role: string; name: string } | { key: string };

/** The overlay rule of a crawl or a recording. */
export interface OverlayRule {
  dismiss: DismissEntry[];
  /** How long the step waits after a settle for an overlay or a dismiss-list control to show. */
  overlayWaitMs: number;
}

/** What the probe found over a page: a modal, a dialog, or a fixed layer that covers controls. */
export interface Overlay {
  kind: 'modal' | 'dialog' | 'layer';
  name: string;
}

/** One dismiss: the page, what pressed it, what covered the page before, and if the page is clear after. */
export interface Dismissal {
  route: string;
  by: 'list' | 'auto';
  press: string;
  overlay: string | null;
  cleared: boolean;
  error?: string;
}

/** The entries of `qa.paths.dismiss` in one shape. A string is a CSS selector. */
export function dismissEntries(raw: readonly (string | DismissEntry)[]): DismissEntry[] {
  return raw.map((entry) => (typeof entry === 'string' ? { selector: entry } : entry));
}

/** `selector .close`, `button "Not now"` or `key Escape`, for the crawl log. */
export function describeDismiss(entry: DismissEntry): string {
  if ('key' in entry) return `key ${entry.key}`;
  if ('selector' in entry) return `selector ${entry.selector}`;
  return `${entry.role} "${entry.name}"`;
}

const describeOverlay = (overlay: Overlay | null): string | null => (overlay === null ? null : `${overlay.kind} "${overlay.name}"`);

/**
 * The page functions. `pressable` is true when a person can press the element: it shows, it is not
 * inert or hidden from assistive technology, it sits inside the open modal when one is up, and on
 * screen at least one of five points of it is not under another element.
 */
export const PAGE_HELPERS = `
  const SELECTOR = ${JSON.stringify(CONTROL_SELECTOR)};
  const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim().slice(0, ${MAX_LABEL});
  const shown = (el) => {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) return false;
    const style = getComputedStyle(el);
    return !(style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0');
  };
  const nameOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim();
  const roleOf = (el) => el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button');
  const inView = ([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
  const onScreen = (box) => box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
  const points = (box) => [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([fx, fy]) => [box.left + box.width * fx, box.top + box.height * fy]).filter(inView);
  const isModal = (el) => {
    if (el.getAttribute('aria-modal') === 'true') return true;
    if (el.tagName !== 'DIALOG' || !el.open) return false;
    try {
      return el.matches(':modal');
    } catch (err) {
      return false;
    }
  };
  const modalRoot = () => Array.from(document.querySelectorAll('dialog[open], [aria-modal="true"]')).find((el) => isModal(el) && shown(el)) || null;
  const pressable = (el, modal) => {
    if (!shown(el) || el.closest('[inert], [aria-hidden="true"]')) return false;
    if (modal !== null && !modal.contains(el)) return false;
    const seen = points(el.getBoundingClientRect());
    if (seen.length === 0) return true;
    return seen.some(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && (el.contains(hit) || hit.contains(el));
    });
  };
  const findEntry = (entry) => {
    const modal = modalRoot();
    const pool = entry.selector !== undefined
      ? Array.from(document.querySelectorAll(entry.selector))
      : Array.from(document.querySelectorAll(SELECTOR)).filter((el) => roleOf(el) === entry.role && norm(nameOf(el)) === norm(entry.name));
    return pool.find((el) => pressable(el, modal)) || null;
  };
`;

/**
 * The probe: waits up to `waitMs` until an overlay shows (`present`, a dismiss-list control counts
 * too) or until no overlay shows (`absent`), and answers the overlay it sees then, or null.
 *
 * An overlay is an open dialog, an element with role `dialog` or `alertdialog`, an element with
 * `aria-modal`, or a fixed layer of at least 90 % of the viewport that lies over a control outside it.
 * The last test keeps a full-height app shell out: it holds its controls.
 */
export function overlayProbeExpression(waitMs: number, want: 'present' | 'absent', dismiss: readonly DismissEntry[]): string {
  const listed = dismiss.filter((entry) => !('key' in entry));
  return `(async () => {
  /* lw-qa overlay probe */
  ${PAGE_HELPERS}
  const label = (el) => {
    const by = el.getAttribute('aria-labelledby');
    const titled = by ? document.getElementById(by) : null;
    const heading = el.querySelector('h1, h2, h3, [role="heading"]');
    return norm(el.getAttribute('aria-label') || (titled && titled.innerText) || (heading && heading.innerText) || el.innerText || '');
  };
  const coversControls = (layer) => Array.from(document.querySelectorAll(SELECTOR)).some((el) => {
    if (layer.contains(el) || !shown(el)) return false;
    return points(el.getBoundingClientRect()).some(([x, y]) => layer.contains(document.elementFromPoint(x, y)));
  });
  const fixedLayer = () => {
    for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) {
      for (let el = document.elementFromPoint(innerWidth * fx, innerHeight * fy); el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (getComputedStyle(el).position !== 'fixed') continue;
        const box = el.getBoundingClientRect();
        if (box.width >= innerWidth * 0.9 && box.height >= innerHeight * 0.9 && coversControls(el)) return el;
      }
    }
    return null;
  };
  const detect = () => {
    for (const el of Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]'))) {
      if (!shown(el) || !onScreen(el.getBoundingClientRect()) || el.closest('[inert], [aria-hidden="true"]')) continue;
      return { kind: isModal(el) ? 'modal' : 'dialog', name: label(el) };
    }
    const layer = fixedLayer();
    return layer === null ? null : { kind: 'layer', name: label(layer) };
  };
  const listed = ${JSON.stringify(listed)};
  const want = ${JSON.stringify(want)};
  const until = Date.now() + ${Math.max(0, Math.round(waitMs))};
  for (;;) {
    const seen = detect();
    const done = want === 'present' ? seen !== null || listed.some((entry) => findEntry(entry) !== null) : seen === null;
    if (done || Date.now() >= until) return seen;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
})()`;
}

/** Presses the first pressable match of a selector or role entry. Answers whether one was found. */
export function pressDismissExpression(entry: { selector: string } | { role: string; name: string }): string {
  return `(() => {
  /* lw-qa dismiss press */
  ${PAGE_HELPERS}
  const target = findEntry(${JSON.stringify(entry)});
  if (target === null) return { found: false };
  target.click();
  return { found: true };
})()`;
}

/** Presses one entry. `absent` when it does not apply to the page now, else the press error or null. */
async function pressEntry(session: QaSession, evaluate: (e: string) => Promise<unknown>, entry: DismissEntry, overlay: Overlay | null): Promise<'absent' | string | null> {
  try {
    if ('key' in entry) {
      if (overlay === null) return 'absent';
      await session.act({ kind: 'press', key: entry.key });
      return null;
    }
    const pressed = (await evaluate(pressDismissExpression(entry))) as { found: boolean };
    return pressed.found ? null : 'absent';
  } catch (err) {
    if (session.isClosed?.() === true) throw err;
    return messageOf(err).split('\n')[0] ?? '';
  }
}

const sameOverlay = (a: Overlay | null, b: Overlay | null): boolean => a !== null && b !== null && a.kind === b.kind && a.name === b.name;

/**
 * Clears the overlays over the page at `route`. It presses each entry of the dismiss list that
 * applies, in order, and then `Escape` when an overlay stays. A press that moves the app to another
 * pathname is logged as failed, the page opens again and the step stops: that overlay is the page.
 * A closed browser goes up, so the crawl can restart the session.
 */
export async function clearOverlays(session: QaSession, rule: OverlayRule, route: string, log: (dismissal: Dismissal) => void): Promise<void> {
  if (!session.evaluate) {
    throw new LaunchwrightError('qa.paths.evaluate', 'The target cannot evaluate in the page, so the crawl cannot find an overlay. Use a browser or WebView target.');
  }
  const evaluate = session.evaluate.bind(session);
  const probe = async (waitMs: number, want: 'present' | 'absent'): Promise<Overlay | null> => (await evaluate(overlayProbeExpression(waitMs, want, rule.dismiss))) as Overlay | null;
  const auto: DismissEntry = { key: AUTO_DISMISS_KEY };
  let overlay = await probe(rule.overlayWaitMs, 'present');
  for (let round = 0; round < DISMISS_ROUNDS; round += 1) {
    if (round > 0) overlay = await probe(0, 'present');
    const before = overlay;
    let pressed = false;
    let pressedAuto = false;
    const press = async (entry: DismissEntry, by: Dismissal['by']): Promise<boolean> => {
      const error = await pressEntry(session, evaluate, entry, overlay);
      if (error === 'absent') return true;
      pressed = true;
      if ('key' in entry && entry.key === AUTO_DISMISS_KEY) pressedAuto = true;
      const after = error === null ? await probe(DISMISS_WAIT_MS, 'absent') : overlay;
      const landed = (await session.currentRoute()).replace(/[?#].*$/, '') || '/';
      const entryText = describeDismiss(entry);
      if (landed !== route) {
        log({ route, by, press: entryText, overlay: describeOverlay(overlay), cleared: false, error: `the press moved the app from ${route} to ${landed}, so the overlay belongs to the page` });
        await session.navigate(route);
        return false;
      }
      log({ route, by, press: entryText, overlay: describeOverlay(overlay), cleared: after === null, ...(error === null ? {} : { error }) });
      overlay = after;
      return true;
    };
    for (const entry of rule.dismiss) if (!(await press(entry, 'list'))) return;
    if (overlay !== null && !pressedAuto && !(await press(auto, 'auto'))) return;
    // Another round only when a press changed something: a second sheet can follow the first.
    if (!pressed || sameOverlay(before, overlay)) return;
  }
}
