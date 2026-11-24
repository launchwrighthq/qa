// Fakes for the states and paths tests: a scripted target session that answers the in-page
// expressions of `capture.mts`, `mount.mts` and `paths.mts`, and a routable page with a fake
// API server. No browser and no network.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Clock } from '../../src/kernel/index.mts';
import {
  type Capture,
  type OpenOptions,
  QA_TARGET_SPEC_VERSION,
  type QaSession,
  type QaTarget,
  type QaTargetCapability,
  type QaTargetRegistry,
  type RoutableLocator,
  type RoutablePage,
  type RoutedRoute,
  type VideoCapture,
} from '../../src/drivers/target/contract.mts';
import type { Act, Leg, Settle } from '../../src/services/types.mts';
import type { TreeNode } from '../../src/states/services/capture.mts';

/** One page of the scripted site: its controls, and where each one goes. */
export interface ScriptedPage {
  controls?: { label: string; role: string; to?: string }[];
  /** What the harness state expression answers on this page. */
  harness?: { harness: boolean; error: string | null; roots: number };
}

function writeFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** Reads a JSON string literal that follows `prefix` in an expression. */
function literalAfter(expression: string, prefix: string, terminator = ';\n'): unknown {
  const at = expression.indexOf(prefix);
  if (at === -1) throw new Error(`fake: the expression has no ${prefix}`);
  const rest = expression.slice(at + prefix.length);
  return JSON.parse(rest.slice(0, rest.indexOf(terminator)));
}

export interface ScriptedSessionOptions {
  site?: Record<string, ScriptedPage>;
  page?: FakeRoutablePage;
  clock?: Clock;
  /** Milliseconds the clock moves per click, so a recording has a duration. */
  clickMs?: number;
  evaluate?: boolean;
  /** A screenshot whose path holds this text throws, and the session reports itself closed after it. */
  crashOn?: string;
  /** Routes whose navigation never ends: the crawl bound has to cut the step. */
  hangOn?: string[];
  /** Routes whose navigation fails at once. */
  failOn?: string[];
}

/** A target session over a scripted site. `calls` records every call for assertions. */
export class ScriptedSession implements QaSession {
  route = '/';
  pending: string | null = null;
  calls: string[] = [];
  videoFile: string | null = null;
  dead = false;
  readonly evaluate?: (expression: string) => Promise<unknown>;

  constructor(private readonly opts: ScriptedSessionOptions = {}) {
    if (opts.evaluate !== false) this.evaluate = (expression) => this.answer(expression);
  }

  routable(): RoutablePage {
    if (!this.opts.page) throw new Error('fake: no routable page');
    return this.opts.page;
  }

  private pageOf(route: string): ScriptedPage {
    return this.opts.site?.[route.replace(/\?.*$/, '')] ?? {};
  }

  isClosed(): boolean {
    return this.dead;
  }

  async navigate(route: string): Promise<void> {
    this.calls.push(`navigate ${route}`);
    if (this.opts.hangOn?.includes(route)) return new Promise<void>(() => undefined);
    if (this.opts.failOn?.includes(route)) throw Object.assign(new Error(`could not open ${route}`), { code: 'qa.target.navigate' });
    this.route = route;
    this.pending = null;
    await this.opts.page?.load();
  }

  async act(step: Act): Promise<void> {
    this.calls.push(`act ${step.kind}`);
  }

  async settle(rule: Settle): Promise<void> {
    this.calls.push(`settle ${JSON.stringify(rule)}`);
    if (this.pending !== null) {
      this.route = this.pending;
      this.pending = null;
    }
  }

  async currentRoute(): Promise<string> {
    return this.route;
  }

  async screenshot(path: string): Promise<Capture> {
    this.calls.push(`screenshot ${path}`);
    if (this.opts.crashOn !== undefined && path.includes(this.opts.crashOn)) {
      this.dead = true;
      throw new Error('Target crashed');
    }
    writeFile(path, `png ${this.route}`);
    return { path, width: 10, height: 10 };
  }

  async startVideo(path: string): Promise<void> {
    this.calls.push(`startVideo ${path}`);
    this.videoFile = path;
  }

  async stopVideo(): Promise<VideoCapture> {
    const path = this.videoFile ?? 'none';
    writeFile(path, 'webm');
    this.calls.push(`stopVideo ${path}`);
    return { path, durationMs: 2000 };
  }

  async trace(): Promise<string | null> {
    return null;
  }

  async dump(): Promise<string | null> {
    return null;
  }

  async logs() {
    return [];
  }

  async close(): Promise<void> {
    this.calls.push('close');
  }

  private async answer(expression: string): Promise<unknown> {
    // A scripted site has no overlay: the probe sees none, and no dismiss control is on a page.
    if (expression.includes('/* lw-qa overlay probe */')) return null;
    if (expression.includes('/* lw-qa dismiss press */')) return { found: false };
    if (expression.includes('el.click()')) {
      const want = String(literalAfter(expression, 'const want = norm(', ');\n'));
      const role = String(literalAfter(expression, 'const wantRole = '));
      const control = (this.pageOf(this.route).controls ?? []).find((c) => c.label === want && c.role === role);
      if (!control) return { ok: false, error: `no ${role} called ${JSON.stringify(want)} on ${this.route}` };
      if (control.to) this.pending = control.to;
      if (this.opts.clock && 'advance' in this.opts.clock) await (this.opts.clock as { advance(ms: number): Promise<void> }).advance(this.opts.clickMs ?? 1000);
      return { ok: true, before: this.route };
    }
    if (expression.includes('out.push({ label: name')) {
      return (this.pageOf(this.route).controls ?? []).map((c) => ({ label: c.label, role: c.role }));
    }
    if (expression.includes('data-qa-states')) {
      return this.pageOf(this.route).harness ?? { harness: false, error: null, roots: 0 };
    }
    if (this.opts.page) return this.opts.page.evaluate(expression);
    throw new Error(`fake: no answer for the expression ${expression.slice(0, 80)}`);
  }
}

/** A target that opens one scripted session, or a new one from the factory at each open. */
export function scriptedTarget(
  session: ScriptedSession | (() => ScriptedSession),
  options: { name?: string; capabilities?: QaTargetCapability[]; ready?: boolean } = {},
): QaTarget & { opened: OpenOptions[] } {
  const opened: OpenOptions[] = [];
  const capabilities = new Set<QaTargetCapability>(options.capabilities ?? ['input', 'screenshot', 'video', 'webview']);
  return {
    name: options.name ?? 'playwright',
    specVersion: QA_TARGET_SPEC_VERSION,
    capabilities,
    supports: (cap: string) => capabilities.has(cap as QaTargetCapability),
    opened,
    async ready(_leg: Leg) {
      return options.ready === false ? { ready: false, reason: 'scripted as not ready' } : { ready: true };
    },
    async open(opts: OpenOptions) {
      opened.push(opts);
      return typeof session === 'function' ? session() : session;
    },
  };
}

/** A registry of the given targets. */
export function registryOf(targets: Record<string, QaTarget>): QaTargetRegistry {
  return {
    names: () => Object.keys(targets).sort(),
    get(name) {
      const target = targets[name];
      if (!target) throw new Error(`fake: no target ${name}`);
      return target;
    },
  };
}

/**
 * A page with a fake API server. The server answers `body` for the intercepted URL. The page draws
 * one list item per row of `body.items`, and the text of an item is `stateOf(row)`.
 */
export class FakeRoutablePage implements RoutablePage {
  handlers: { url: string; handler: (route: RoutedRoute) => Promise<void> }[] = [];
  rendered: { items: Record<string, unknown>[] } = { items: [] };
  fulfilled: string[] = [];

  constructor(
    private readonly server: { url: string; body: { items: Record<string, unknown>[]; total?: number } },
    private readonly stateOf: (row: Record<string, unknown>) => string | null,
    private readonly projectRoot: string,
  ) {}

  async route(url: string, handler: (route: RoutedRoute) => Promise<void>): Promise<void> {
    this.handlers.push({ url, handler });
  }

  async unroute(url: string, handler: (route: RoutedRoute) => Promise<void>): Promise<void> {
    this.handlers = this.handlers.filter((h) => h.url !== url || h.handler !== handler);
  }

  /** One page load: the app fetches the API, through the route handlers when any match. */
  async load(): Promise<void> {
    let body = JSON.stringify(this.server.body);
    for (const { handler } of this.handlers.filter((h) => h.url === this.server.url)) {
      let fulfilled: string | null = null;
      const route: RoutedRoute = {
        request: () => ({ url: () => `http://app.test${this.server.url}` }),
        fetch: async () => ({ status: () => 200, headers: () => ({ 'content-type': 'application/json', 'content-length': '9' }), text: async () => body }),
        fulfill: async (o) => {
          fulfilled = o.body;
        },
        continue: async () => {},
      };
      await handler(route);
      if (fulfilled !== null) body = fulfilled;
    }
    this.fulfilled.push(body);
    this.rendered = JSON.parse(body) as { items: Record<string, unknown>[] };
  }

  /** The tree the page draws: a header, then one `li` per item with its state as text. */
  tree(): TreeNode {
    const node = (tag: string, text: string, children: TreeNode[] = []): TreeNode => ({ tag, self: JSON.stringify([tag, [], text]), children });
    const items = this.rendered.items.map((row) => node('LI', `${this.stateOf(row) ?? 'none'}`));
    return node('BODY', '', [node('H1', 'Invites'), node('UL', '', items)]);
  }

  async evaluate(expression: string): Promise<unknown> {
    if (expression.includes('exceeds')) return this.tree();
    if (expression.includes('const items = ')) {
      const href = String(literalAfter(expression, 'const href = '));
      if (!href.startsWith(`/@fs${this.projectRoot}`)) throw new Error(`fake: unexpected module ${href}`);
      const items = literalAfter(expression, 'const items = ') as Record<string, unknown>[];
      return items.map((item) => ({ state: this.stateOf(item), error: null }));
    }
    if (expression.includes('Function.prototype.toString')) return ['invite'];
    if (expression.includes('Number.isFinite(found)')) return { value: null };
    throw new Error(`fake page: no answer for ${expression.slice(0, 80)}`);
  }

  locator(selector: string): RoutableLocator {
    const self: RoutableLocator = {
      first: () => self,
      boundingBox: async () => (selector === 'body' ? { x: 0, y: 0, width: 1000, height: 1000 } : { x: 0, y: 0, width: 100, height: 20 }),
      scrollIntoViewIfNeeded: async () => {},
      screenshot: async ({ path }) => {
        writeFile(path, `png ${selector}`);
        return Buffer.from('png');
      },
    };
    return self;
  }
}
