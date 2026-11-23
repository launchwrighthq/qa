// The `playwright` qa.target driver (spec 2.8): Chromium, WebKit or Firefox on this machine.
// One session is one browser, one context and one page. The leg gives the context: device
// descriptor, viewport, device scale factor and user agent. `@playwright/test` is an optional
// peer, so the driver imports it only when a session opens.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Clock, LaunchwrightError, systemClock } from '@launchwrighthq/kernel';
import type { Browser, BrowserContext, BrowserContextOptions, BrowserType, Page } from '@playwright/test';
import { pngSize } from '../../services/png.mts';
import type { Act, Leg, Settle } from '../../services/types.mts';
import { MIN_VIDEO_S } from '../../services/video.mts';
import {
  type Capture,
  type OpenOptions,
  QA_TARGET_SPEC_VERSION,
  type QaSession,
  type QaTarget,
  type QaTargetCapability,
  type RoutablePage,
  type SessionLogLine,
  type TargetReadiness,
  type VideoCapture,
} from './contract.mts';

export interface PlaywrightTargetOptions {
  clock?: Clock;
  /** A browser binary to launch instead of the one that `playwright install` put in place. */
  executablePath?: string;
  /** How long one act step may take. Default 15 s. */
  actTimeoutMs?: number;
  /** The settle budget when a rule names none. Default 20 s. */
  settleTimeoutMs?: number;
}

/** The persona sign-in route of the web surface (spec 2.6). The world submodule mounts it. */
export const PERSONA_SESSION_ROUTE = '/__qa/session';

const CAPABILITIES: QaTargetCapability[] = ['input', 'screenshot', 'video', 'webview'];

/** The shortest clip the driver writes: the evidence minimum and a margin for the encoder. */
const MIN_CLIP_MS = MIN_VIDEO_S * 1000 + 500;

/** The part of `@playwright/test` the driver uses. */
type Playwright = Pick<typeof import('@playwright/test'), 'chromium' | 'webkit' | 'firefox' | 'devices'>;
const importPlaywright = (): Promise<Playwright> => import('@playwright/test');

async function loadPlaywright(): Promise<Playwright> {
  try {
    return await importPlaywright();
  } catch (err) {
    throw new LaunchwrightError('qa.target.playwright', 'The playwright target needs @playwright/test. Run: pnpm add -D @playwright/test', { cause: err });
  }
}

function browserOf(pw: Playwright, leg: Leg, descriptor: { defaultBrowserType?: string } | undefined): BrowserType {
  const name = leg.browser ?? (descriptor?.defaultBrowserType as Leg['browser']) ?? 'chromium';
  return pw[name];
}

/** The context options of a leg: the descriptor first, then the leg's own fields. */
export function contextOptions(pw: Pick<Playwright, 'devices'>, leg: Leg): BrowserContextOptions & { defaultBrowserType?: string } {
  let base: BrowserContextOptions & { defaultBrowserType?: string } = {};
  if (leg.descriptor !== undefined) {
    const found = pw.devices[leg.descriptor];
    if (!found) {
      throw new LaunchwrightError('qa.target.descriptor', `Leg ${leg.name} names the device descriptor "${leg.descriptor}", which Playwright does not know.`, {
        context: { leg: leg.name, descriptor: leg.descriptor },
      });
    }
    base = { ...found };
  }
  return {
    ...base,
    ...(leg.viewport ? { viewport: leg.viewport } : {}),
    ...(leg.deviceScaleFactor !== undefined ? { deviceScaleFactor: leg.deviceScaleFactor } : {}),
    ...(leg.userAgent !== undefined ? { userAgent: leg.userAgent } : {}),
  };
}

/** The base path of a surface URL, without a trailing slash: `http://h/mini/` gives `/mini`. */
function basePath(baseUrl: string): string {
  return new URL(baseUrl).pathname.replace(/\/+$/, '');
}

/** A route as the page URL under the surface base, with `?qa=<persona>` for a launch by query. */
export function routeUrl(baseUrl: string, route: string, persona?: string): string {
  const base = new URL(baseUrl);
  const url = new URL(`${base.origin}${basePath(baseUrl)}${route.startsWith('/') ? route : `/${route}`}`);
  if (persona !== undefined) url.searchParams.set('qa', persona);
  return url.href;
}

/** The pathname of a page URL relative to the surface base. */
export function relativeRoute(baseUrl: string, pageUrl: string): string {
  const base = basePath(baseUrl);
  let path = new URL(pageUrl).pathname;
  if (base !== '' && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length);
  path = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return path === '' ? '/' : path;
}

/** A settle predicate, run in the page. */
const SETTLE_SCRIPTS = {
  artwork: () => {
    const images = [...document.images];
    if (images.length > 0) return images.every((i) => i.complete && i.naturalWidth > 0);
    return [...document.querySelectorAll<HTMLElement>('body *')].some((el) => getComputedStyle(el).backgroundImage.includes('url('));
  },
  video: () => [...document.querySelectorAll('video')].some((v) => v.readyState >= 2 && v.videoWidth > 0 && !v.paused),
  busy: () => document.querySelector('[aria-busy="true"]') === null,
};

class PlaywrightSession implements QaSession {
  private readonly lines: SessionLogLine[] = [];
  private tracing = true;
  private videoPath: string | null = null;
  private videoStart = 0;
  private closed = false;

  constructor(
    private readonly target: PlaywrightTarget,
    private readonly opts: OpenOptions,
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {
    const at = (): string => target.clock.date().toISOString();
    page.on('pageerror', (err) => this.lines.push({ at: at(), kind: 'page-error', text: err.message }));
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.lines.push({ at: at(), kind: 'console-error', text: msg.text() });
    });
    page.on('requestfailed', (req) =>
      this.lines.push({ at: at(), kind: 'request-failed', text: `${req.method()} ${req.url()}: ${req.failure()?.errorText ?? 'failed'}` }),
    );
    page.on('response', (res) => {
      if (res.status() >= 500) this.lines.push({ at: at(), kind: 'response-5xx', text: `${res.status()} ${res.request().method()} ${res.url()}` });
    });
  }

  /**
   * `?qa=<persona>` launches a persona on the miniapp surface (spec 2.6). On the bot surface the
   * row's route opens the persona's chat on `/__tg`.
   */
  private queryPersona(): string | undefined {
    return this.opts.leg.surface === 'miniapp' ? this.opts.persona : undefined;
  }

  private fail(code: string, message: string, err: unknown, context: Record<string, unknown> = {}): LaunchwrightError {
    return new LaunchwrightError(code, message, { cause: err, context: { leg: this.opts.leg.name, ...context } });
  }

  async navigate(route: string): Promise<void> {
    const url = routeUrl(this.opts.baseUrl, route, this.queryPersona());
    try {
      await this.page.goto(url, { waitUntil: 'load' });
    } catch (err) {
      throw this.fail('qa.target.navigate', `Leg ${this.opts.leg.name} could not open ${route}.`, err, { route });
    }
  }

  async act(step: Act): Promise<void> {
    const timeout = this.target.actTimeoutMs;
    const what = `${step.kind}${step.target ? ` ${step.target}` : ''}`;
    try {
      switch (step.kind) {
        case 'click':
          await this.page.locator(required(step.target, 'click')).first().click({ timeout });
          return;
        case 'type':
          await this.page.locator(required(step.target, 'type')).first().fill(step.text ?? '', { timeout });
          return;
        case 'press': {
          const key = required(step.key ?? step.text, 'press');
          if (step.target) await this.page.locator(step.target).first().press(key, { timeout });
          else await this.page.keyboard.press(key);
          return;
        }
        case 'scroll':
          await this.scroll(step.dx ?? 0, step.dy ?? 0);
          return;
        case 'wait':
          await this.target.clock.sleep(step.ms ?? 0);
          return;
        case 'back':
          await this.page.goBack({ waitUntil: 'load' });
          return;
      }
    } catch (err) {
      if (err instanceof LaunchwrightError && err.code === 'qa.target.act') throw err;
      throw this.fail('qa.target.act', `Leg ${this.opts.leg.name} could not run the act ${what}.`, err, { act: step });
    }
  }

  /** Scrolls the app's own scroll root `[data-page-scroll]`, else the document, and checks that it moved. */
  private async scroll(dx: number, dy: number): Promise<void> {
    const moved = await this.page.evaluate(
      ([x, y]) => {
        const root = document.querySelector('[data-page-scroll]');
        const el = root ?? document.scrollingElement ?? document.documentElement;
        const before = [el.scrollLeft, el.scrollTop];
        el.scrollBy(x, y);
        return { marked: root !== null, moved: el.scrollLeft !== before[0] || el.scrollTop !== before[1] };
      },
      [dx, dy] as const,
    );
    if (!moved.marked && !moved.moved) {
      throw new LaunchwrightError('qa.target.act', `The act scroll ${dx},${dy} found no [data-page-scroll] root and the document did not move.`, {
        context: { leg: this.opts.leg.name },
      });
    }
  }

  async settle(rule: Settle): Promise<void> {
    const timeout = rule.timeout ?? this.target.settleTimeoutMs;
    try {
      if (rule.selector !== undefined) await this.page.locator(rule.selector).first().waitFor({ state: 'visible', timeout });
      if (rule.artwork) await this.page.waitForFunction(SETTLE_SCRIPTS.artwork, undefined, { timeout });
      if (rule.video) await this.page.waitForFunction(SETTLE_SCRIPTS.video, undefined, { timeout });
      if (rule.busy) await this.page.waitForFunction(SETTLE_SCRIPTS.busy, undefined, { timeout });
    } catch (err) {
      throw this.fail('qa.target.settle', `Leg ${this.opts.leg.name} did not settle in ${timeout} ms on ${JSON.stringify(rule)}.`, err, { rule });
    }
  }

  async currentRoute(): Promise<string> {
    return relativeRoute(this.opts.baseUrl, this.page.url());
  }

  async screenshot(path: string): Promise<Capture> {
    mkdirSync(dirname(path), { recursive: true });
    const png = await this.page.screenshot({ path, animations: 'disabled', fullPage: false });
    const size = pngSize(png);
    if (size === null) throw new LaunchwrightError('qa.target.screenshot', `Leg ${this.opts.leg.name} wrote a screenshot that is not a PNG: ${path}.`);
    return { path, ...size };
  }

  async startVideo(path: string): Promise<void> {
    if (this.videoPath !== null) throw new LaunchwrightError('qa.target.video', `Leg ${this.opts.leg.name} already records ${this.videoPath}.`);
    mkdirSync(dirname(path), { recursive: true });
    const size = this.page.viewportSize() ?? undefined;
    await this.page.screencast.start({ path, ...(size ? { size } : {}) });
    this.videoPath = path;
    this.videoStart = this.target.clock.now();
  }

  async stopVideo(): Promise<VideoCapture> {
    if (this.videoPath === null) throw new LaunchwrightError('qa.target.video', `Leg ${this.opts.leg.name} records no video; call startVideo first.`);
    const path = this.videoPath;
    this.videoPath = null;
    // A clip under 1 s fails the evidence check as blank-video. A fast row holds its last frame.
    const held = this.target.clock.now() - this.videoStart;
    if (held < MIN_CLIP_MS) await this.target.clock.sleep(MIN_CLIP_MS - held);
    await this.page.screencast.stop();
    return { path, durationMs: this.target.clock.now() - this.videoStart };
  }

  async trace(path: string): Promise<string | null> {
    if (!this.tracing) return null;
    this.tracing = false;
    mkdirSync(dirname(path), { recursive: true });
    await this.context.tracing.stop({ path });
    return path;
  }

  /** The browser target has no accessibility dump file; Android rows carry one (spec 2.11.1). */
  async dump(_path: string): Promise<string | null> {
    return null;
  }

  async logs(): Promise<SessionLogLine[]> {
    return [...this.lines];
  }

  async evaluate(expression: string): Promise<unknown> {
    return this.page.evaluate(expression);
  }

  routable(): RoutablePage {
    return this.page;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.videoPath !== null) await this.page.screencast.stop();
      if (this.tracing) await this.context.tracing.stop();
      await this.context.close();
    } finally {
      await this.browser.close();
    }
  }
}

function required(value: string | undefined, kind: string): string {
  if (value === undefined || value === '') {
    throw new LaunchwrightError('qa.target.act', `The act ${kind} needs a ${kind === 'press' ? 'key' : 'target'}.`, { context: { kind } });
  }
  return value;
}

class PlaywrightTarget implements QaTarget {
  readonly name = 'playwright';
  readonly specVersion = QA_TARGET_SPEC_VERSION;
  readonly capabilities: ReadonlySet<QaTargetCapability> = new Set(CAPABILITIES);
  readonly clock: Clock;
  readonly actTimeoutMs: number;
  readonly settleTimeoutMs: number;
  private readonly executablePath: string | undefined;

  constructor(opts: PlaywrightTargetOptions) {
    this.clock = opts.clock ?? systemClock;
    this.actTimeoutMs = opts.actTimeoutMs ?? 15_000;
    this.settleTimeoutMs = opts.settleTimeoutMs ?? 20_000;
    this.executablePath = opts.executablePath;
  }

  supports(cap: string): boolean {
    return (this.capabilities as ReadonlySet<string>).has(cap);
  }

  private async launch(pw: Playwright, leg: Leg): Promise<{ browser: Browser; options: BrowserContextOptions }> {
    const { defaultBrowserType, ...options } = contextOptions(pw, leg);
    const type = browserOf(pw, leg, { defaultBrowserType });
    const browser = await type.launch({ headless: true, ...(this.executablePath ? { executablePath: this.executablePath } : {}) });
    return { browser, options };
  }

  /** Ready when the leg's browser launches. The reason names the install command. */
  async ready(leg: Leg): Promise<TargetReadiness> {
    let pw: Playwright;
    try {
      pw = await loadPlaywright();
    } catch (err) {
      return { ready: false, reason: (err as Error).message };
    }
    try {
      const { browser } = await this.launch(pw, leg);
      await browser.close();
      return { ready: true };
    } catch (err) {
      const first = ((err as Error).message ?? String(err)).split('\n')[0];
      return { ready: false, reason: `${first}. Run: npx playwright install ${leg.browser ?? 'chromium'}` };
    }
  }

  async open(opts: OpenOptions): Promise<QaSession> {
    const pw = await loadPlaywright();
    const { browser, options } = await this.launch(pw, opts.leg).catch((err: unknown) => {
      throw new LaunchwrightError('qa.target.launch', `Leg ${opts.leg.name} could not launch ${opts.leg.browser ?? 'chromium'}.`, { cause: err });
    });
    try {
      const context = await browser.newContext(options);
      await context.tracing.start({ screenshots: true, snapshots: true });
      if (opts.persona !== undefined && opts.leg.surface === 'web') await signIn(context, opts);
      const page = await context.newPage();
      return new PlaywrightSession(this, opts, browser, context, page);
    } catch (err) {
      await browser.close();
      throw err;
    }
  }
}

/** Signs a persona in on the web surface: `POST /__qa/session {persona}` sets the session cookie (spec 2.6). */
async function signIn(context: BrowserContext, opts: OpenOptions): Promise<void> {
  const url = new URL(PERSONA_SESSION_ROUTE, opts.baseUrl).href;
  const res = await context.request.post(url, { data: { persona: opts.persona } });
  if (!res.ok()) {
    throw new LaunchwrightError('qa.target.persona', `POST ${PERSONA_SESSION_ROUTE} for persona ${opts.persona} answered ${res.status()}.`, {
      context: { leg: opts.leg.name, persona: opts.persona, status: res.status() },
    });
  }
}

/** The `playwright` `qa.target` driver. */
export function createPlaywrightTarget(opts: PlaywrightTargetOptions = {}): QaTarget {
  return new PlaywrightTarget(opts);
}
