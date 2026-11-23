// The expressions a device target evaluates inside a page (spec 2.4). Android CDP, the WebKit
// inspector and WebDriver all run the same text, so a row means one thing on every device leg.
// Each expression is one IIFE that returns a JSON value. Pure: nothing here talks to a device.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { Act, Settle } from '@launchwrighthq/qa';

/** A selector: CSS, or a role with an accessible name (spec 2.14 rule C5). */
export type ParsedSelector = { kind: 'css'; css: string } | { kind: 'role'; role: string; name: string };

const ROLE_FORM = /^role=([a-zA-Z][a-zA-Z0-9-]*)(?:\[name=(?:"([^"]*)"|'([^']*)'|([^\]]*))\])?$/;

/** `role=button[name="Save"]` or CSS. */
export function parseSelector(selector: string): ParsedSelector {
  const s = selector.trim();
  if (!s) throw new LaunchwrightError('qa.device.selector', 'A selector is empty.');
  const m = ROLE_FORM.exec(s);
  if (m) return { kind: 'role', role: (m[1] as string).toLowerCase(), name: m[2] ?? m[3] ?? m[4] ?? '' };
  return { kind: 'css', css: s };
}

function resolveSnippet(p: ParsedSelector): string {
  return p.kind === 'css' ? `document.querySelector(${JSON.stringify(p.css)})` : `__byRole(${JSON.stringify(p.role)}, ${JSON.stringify(p.name)})`;
}

/**
 * The elements that have a role without a `role` attribute, so a `role=` selector finds on a device
 * what Playwright finds in a browser. A role outside this map matches its `role` attribute only.
 */
export const IMPLICIT_ROLES: Readonly<Record<string, string>> = Object.freeze({
  article: 'article',
  button: 'button, input[type=button], input[type=submit], input[type=reset]',
  checkbox: 'input[type=checkbox]',
  combobox: 'select',
  dialog: 'dialog',
  form: 'form[aria-label], form[aria-labelledby]',
  heading: 'h1, h2, h3, h4, h5, h6',
  img: 'img[alt]:not([alt=""])',
  link: 'a[href]',
  list: 'ul, ol',
  listitem: 'li',
  main: 'main',
  navigation: 'nav',
  radio: 'input[type=radio]',
  region: 'section[aria-label], section[aria-labelledby]',
  table: 'table',
  textbox: 'input:not([type]), input[type=text], input[type=email], input[type=search], input[type=tel], input[type=url], textarea',
});

/** Helpers every expression carries. Nothing is assumed to be on the page. */
const HELPERS = `
  const __label = (el) => String(el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || '').replace(/\\s+/g, ' ').trim();
  const __roles = ${JSON.stringify(IMPLICIT_ROLES)};
  const __byRole = (role, name) => {
    const sel = '[role=' + role + ']' + (__roles[role] ? ', ' + __roles[role] : '');
    const hits = Array.prototype.slice.call(document.querySelectorAll(sel)).filter((el) => !name || __label(el).includes(name));
    hits.sort((a, b) => __label(a).length - __label(b).length);
    return hits[0] || null;
  };
  const __shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const __artwork = () => {
    if (Array.prototype.slice.call(document.images).some((i) => i.complete && i.naturalWidth > 0)) return true;
    return Array.prototype.slice.call(document.querySelectorAll('*')).some((el) => { const bg = getComputedStyle(el).backgroundImage; return bg !== 'none' && bg.includes('url('); });
  };
`;

const iife = (body: string): string => `(() => {${HELPERS}${body}\n})()`;

/** What each page is asked to find the one the operator sees. */
export const VISIBILITY_EXPRESSION = 'document.visibilityState';

/** The route the page shows: path and query. */
export const ROUTE_EXPRESSION = 'location.pathname + location.search';

/**
 * A route change inside the single-page app: push the URL and fire `popstate`, which the router
 * listens to. A document load would end the CDP session with the page.
 */
export function pushRouteExpression(path: string): string {
  if (!path.startsWith('/')) throw new LaunchwrightError('qa.device.route', `A route starts with /, not ${JSON.stringify(path)}.`);
  return iife(`
  const target = ${JSON.stringify(path)};
  history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  return location.pathname + location.search;`);
}

/** A document load. The only navigation the WebKit target has (spec 2.8). */
export function hrefExpression(url: string): string {
  return `(() => { location.href = ${JSON.stringify(url)}; return true; })()`;
}

/** The page script of one act step. `wait` and `back` do not run in the page. */
export function actExpression(step: Act): string {
  switch (step.kind) {
    case 'click': {
      const sel = parseSelector(need(step.target, 'click', 'target'));
      return iife(`
  const el = ${resolveSnippet(sel)};
  if (!el) return { ok: false, error: 'no element for ' + ${JSON.stringify(step.target)} };
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const failed = [];
  const fire = (make) => { try { el.dispatchEvent(make()); } catch (e) { failed.push(String(e && e.message || e)); } };
  const mouse = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0 };
  const pointer = Object.assign({ pointerId: 1, pointerType: 'touch', isPrimary: true }, mouse);
  fire(() => new PointerEvent('pointerdown', pointer));
  fire(() => new MouseEvent('mousedown', mouse));
  fire(() => new PointerEvent('pointerup', pointer));
  fire(() => new MouseEvent('mouseup', mouse));
  fire(() => new MouseEvent('click', mouse));
  return { ok: true, label: __label(el).slice(0, 60), failed };`);
    }
    case 'type': {
      const sel = parseSelector(need(step.target, 'type', 'target'));
      const text = need(step.text, 'type', 'text');
      return iife(`
  const el = ${resolveSnippet(sel)};
  if (!el) return { ok: false, error: 'no element for ' + ${JSON.stringify(step.target)} };
  el.focus();
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value');
  if (setter && setter.set) setter.set.call(el, ${JSON.stringify(text)}); else el.value = ${JSON.stringify(text)};
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: ${JSON.stringify(text)} }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };`);
    }
    case 'press': {
      const key = need(step.key, 'press', 'key');
      return iife(`
  const target = document.activeElement || document.body;
  const init = { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new KeyboardEvent('keydown', init));
  target.dispatchEvent(new KeyboardEvent('keyup', init));
  if (${JSON.stringify(key)} === 'Enter' && target.form) target.form.requestSubmit();
  return { ok: true };`);
    }
    case 'scroll': {
      const dx = step.dx ?? 0;
      const dy = step.dy ?? 0;
      return iife(`
  const all = [document.scrollingElement].concat(Array.prototype.slice.call(document.querySelectorAll('*')));
  const scrollable = all.filter((el) => el && (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4));
  scrollable.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
  const root = scrollable[0];
  if (!root) return { ok: false, error: 'nothing on this page scrolls' };
  root.scrollBy(${dx}, ${dy});
  return { ok: true };`);
    }
    default:
      throw new LaunchwrightError('qa.target.act', `Act ${step.kind} does not run in the page.`);
  }
}

function need(value: string | undefined, kind: string, field: string): string {
  if (value === undefined || value === '') throw new LaunchwrightError('qa.target.act', `Act ${kind} needs ${field}.`);
  return value;
}

/**
 * The settle check (spec 2.4): exactly one of `selector`, `artwork`, `video`, `busy`. The result
 * names the unmet condition, so a timeout says which one never held.
 */
export function settleExpression(rule: Settle): string {
  const checks: string[] = [];
  if (rule.selector) checks.push(`{ name: ${JSON.stringify(`selector ${rule.selector}`)}, ok: __shown(${resolveSnippet(parseSelector(rule.selector))}) }`);
  if (rule.artwork) checks.push(`{ name: 'artwork', ok: __artwork() }`);
  if (rule.video) checks.push(`{ name: 'video', ok: Array.prototype.slice.call(document.querySelectorAll('video')).some((v) => v.readyState >= 2) }`);
  if (rule.busy) checks.push(`{ name: 'busy', ok: document.readyState === 'complete' && !document.querySelector('[aria-busy="true"]') }`);
  if (checks.length !== 1) {
    throw new LaunchwrightError('qa.device.settle', `A settle rule names exactly one of selector, artwork, video, busy; this one names ${checks.length}.`);
  }
  return iife(`
  const checks = [${checks.join(', ')}];
  return { ok: checks.every((c) => c.ok), missing: checks.filter((c) => !c.ok).map((c) => c.name) };`);
}

/** The answer of a settle or act expression. */
export interface PageAnswer {
  ok?: boolean;
  error?: string;
  missing?: string[];
}

/** The page among the answers that is `visible`. None or two is a refusal, never a guess. */
export function chooseVisiblePage<T extends { id: string; url?: string; visibility: string }>(answers: T[]): T {
  const census = answers.map((p) => `${p.url ?? p.id} (${p.visibility})`).join(', ') || 'none';
  const visible = answers.filter((p) => p.visibility === 'visible');
  if (visible.length === 1) return visible[0] as T;
  if (visible.length === 0) {
    throw new LaunchwrightError('qa.device.page', `No page is visible: the app is closed or in the background. Pages: ${census}.`);
  }
  throw new LaunchwrightError('qa.device.page', `${visible.length} pages claim to be visible, and nothing can choose between them: ${census}.`);
}

/** A route of the leg as a full URL and as a same-origin path. */
export function routeUrl(baseUrl: string, route: string): { url: string; path: string; origin: string } {
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/$/, '');
  const target = new URL(`${basePath}${route.startsWith('/') ? route : `/${route}`}`, base.origin);
  return { url: target.toString(), path: `${target.pathname}${target.search}`, origin: target.origin };
}

/** The page route relative to the base path of the leg. */
export function relativeRoute(baseUrl: string, pageRoute: string): string {
  const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');
  if (basePath && (pageRoute === basePath || pageRoute.startsWith(`${basePath}/`) || pageRoute.startsWith(`${basePath}?`))) {
    return pageRoute.slice(basePath.length) || '/';
  }
  return pageRoute;
}
