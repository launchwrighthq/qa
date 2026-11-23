// A QA session on a BrowserStack cloud device (spec 2.8 `browserstack`), over W3C WebDriver. The
// page scripts are the ones the WebView targets run, sent through `execute/async`. BrowserStack
// films a whole session and serves the file only after the session ends, so one video clip is
// one session: `startVideo` starts a fresh session, `stopVideo` ends it, fetches the film, and
// opens the next session at the same URL. Every call checks the per-run minute budget first.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { Act, Settle } from '@launchwrighthq/qa';
import type { Capture, OpenOptions, QaSession, SessionLogLine, VideoCapture } from '../drivers/target/contract.mts';
import { cloudDeviceKeys, type CloudDeviceKeys, deviceKeys } from '../config.mts';
import { asyncScript, type BrowserstackClient, capabilities, checkBudget, createBrowserstackClient, writeHeld } from './browserstack.mts';
import { relativeRoute, ROUTE_EXPRESSION, routeUrl } from './page-script.mts';
import { poll } from './process.mts';
import { deviceKind } from './device-kinds.mts';
import { type DeviceContext, resolveDevice } from './rigs.mts';
import { capabilityError, closedError, consoleLogKind, pageAct, pollSettle, waitAct, writeBytes, writePng } from './session-base.mts';

/** True when the bytes open with an ISO media `ftyp` box, as every MP4 file does. */
function isMp4(bytes: Buffer): boolean {
  return bytes.subarray(4, 8).toString('latin1') === 'ftyp';
}

/** The minute budget of one target instance: the first session of the run starts the count. */
export interface RunBudget {
  startedAt: number | null;
}

export class CloudSession implements QaSession {
  private closed = false;
  private id = '';
  private used = false;
  private href = '';
  private video: { path: string; startedAt: number } | null = null;
  private readonly lines: SessionLogLine[] = [];

  private constructor(
    private readonly ctx: DeviceContext,
    private readonly opts: OpenOptions,
    private readonly client: BrowserstackClient,
    private readonly kind: string,
    private readonly keys: CloudDeviceKeys,
    private readonly device: string,
    private readonly budget: RunBudget,
    private readonly target: string,
  ) {}

  static async open(ctx: DeviceContext, opts: OpenOptions, budget: RunBudget, target: string): Promise<CloudSession> {
    const resolved = resolveDevice(ctx.config, opts.leg.device);
    if (deviceKind(resolved.device.kind).access !== 'webdriver') {
      throw new LaunchwrightError('qa.device.kind', `Device ${resolved.name} is ${resolved.device.kind}; the ${target} target drives a cloud phone over WebDriver.`);
    }
    const keys = deviceKeys(resolved.name, resolved.device, cloudDeviceKeys);
    const client = createBrowserstackClient(ctx.config.device.browserstack, ctx.deps);
    const session = new CloudSession(ctx, opts, client, resolved.device.kind, keys, resolved.name, budget, target);
    await session.begin();
    return session;
  }

  private async begin(): Promise<void> {
    const cfg = this.ctx.config.device.browserstack;
    this.budget.startedAt ??= this.ctx.deps.clock.now();
    checkBudget(this.budget.startedAt, this.ctx.deps.clock.now(), cfg);
    const created = (await this.client.wd('POST', '/session', capabilities(this.kind, this.keys, cfg, `${this.opts.leg.name} ${this.device}`), 300_000)) as { sessionId?: string };
    if (!created.sessionId) throw new LaunchwrightError('qa.device.browserstack.webdriver', 'POST /session answered no sessionId.');
    this.id = created.sessionId;
    this.used = false;
    await writeHeld(this.ctx.deps.root, { id: this.id, device: this.device, startedAt: this.ctx.deps.clock.now() });
    await this.client.wd('POST', `/session/${this.id}/timeouts`, { script: 30_000, pageLoad: 60_000 });
    if (this.href) await this.client.wd('POST', `/session/${this.id}/url`, { url: this.href });
  }

  /** Ends the live session. Its console lines are read first: they go with the session. */
  private async end(): Promise<string> {
    const id = this.id;
    try {
      await this.drainLogs();
    } finally {
      this.id = '';
      await this.client.wd('DELETE', `/session/${id}`);
      await writeHeld(this.ctx.deps.root, null);
    }
    return id;
  }

  /** One WebDriver call on the live session, after the budget check. A spent budget ends the session. */
  private async wd(method: string, path: string, body?: unknown): Promise<unknown> {
    if (this.closed) throw closedError(this.target, path);
    try {
      checkBudget(this.budget.startedAt ?? this.ctx.deps.clock.now(), this.ctx.deps.clock.now(), this.ctx.config.device.browserstack);
    } catch (err) {
      await this.close();
      throw err;
    }
    this.used = true;
    return this.client.wd(method, `/session/${this.id}${path}`, body);
  }

  async evaluate(expression: string): Promise<unknown> {
    const answer = (await this.wd('POST', '/execute/async', { script: asyncScript(expression), args: [] })) as { ok?: boolean; value?: unknown; error?: string };
    if (!answer?.ok) throw new LaunchwrightError('qa.device.eval', `The page threw on BrowserStack: ${String(answer?.error ?? 'no answer').slice(0, 500)}`);
    return answer.value;
  }

  async navigate(route: string): Promise<void> {
    const { url } = routeUrl(this.opts.baseUrl, route);
    await this.wd('POST', '/url', { url });
    this.href = String(await this.wd('GET', '/url'));
  }

  async act(step: Act): Promise<void> {
    if (this.closed) throw closedError(this.target, 'act');
    if (step.kind === 'wait') return waitAct(this.ctx.deps.clock, step);
    if (step.kind === 'back') {
      await this.wd('POST', '/back', {});
    } else {
      await pageAct(step, (e) => this.evaluate(e), this.target);
    }
    this.href = String(await this.wd('GET', '/url'));
  }

  async settle(rule: Settle): Promise<void> {
    await pollSettle(this.ctx.deps.clock, rule, (e) => this.evaluate(e), this.target);
  }

  async currentRoute(): Promise<string> {
    return relativeRoute(this.opts.baseUrl, String(await this.evaluate(ROUTE_EXPRESSION)));
  }

  async screenshot(path: string): Promise<Capture> {
    const b64 = String(await this.wd('GET', '/screenshot'));
    return writePng(path, Buffer.from(b64, 'base64'), this.target);
  }

  async startVideo(path: string): Promise<void> {
    if (this.closed) throw closedError(this.target, 'startVideo');
    if (this.video) throw new LaunchwrightError('qa.target.video', `The ${this.target} session already records ${this.video.path}.`);
    if (this.used) {
      await this.end();
      await this.begin();
    }
    this.video = { path, startedAt: this.ctx.deps.clock.now() };
  }

  async stopVideo(): Promise<VideoCapture> {
    if (this.closed) throw closedError(this.target, 'stopVideo');
    const video = this.video;
    if (!video) throw new LaunchwrightError('qa.target.video', `The ${this.target} session records no video; call startVideo first.`);
    this.video = null;
    const durationMs = this.ctx.deps.clock.now() - video.startedAt;
    const id = await this.end();
    await writeBytes(video.path, await this.film(id));
    await this.begin();
    return { path: video.path, durationMs };
  }

  /**
   * The film of an ended session. BrowserStack writes `video_url` some seconds after the end, and the
   * URL can answer an XML `NoSuchKey` error before the file is stored, so the poll waits for MP4 bytes.
   */
  private async film(id: string): Promise<Buffer> {
    const opts = { timeoutMs: 120_000, everyMs: 3000, code: 'qa.device.browserstack.video', what: `The video of BrowserStack session ${id}` };
    const url = await poll(
      this.ctx.deps.clock,
      async () => {
        const row = (await this.client.api(`/sessions/${id}.json`)) as { automation_session?: { video_url?: string | null } };
        return row.automation_session?.video_url || null;
      },
      opts,
    );
    return poll(
      this.ctx.deps.clock,
      async () => {
        const res = await this.ctx.deps.fetch(url, { signal: AbortSignal.timeout(120_000) });
        const bytes = Buffer.from(await res.arrayBuffer());
        return res.ok && isMp4(bytes) ? bytes : null;
      },
      { ...opts, what: `${opts.what} as an MP4 file` },
    );
  }

  async trace(): Promise<string | null> {
    return null;
  }

  async dump(): Promise<string | null> {
    return null;
  }

  /**
   * Chrome keeps the page console for `se/log` (type `browser`), which empties it on each read, so
   * the lines collect here. Safari over WebDriver exposes no console at all: the log is refused
   * rather than given empty, because an empty log reads as a page without errors.
   */
  async logs(): Promise<SessionLogLine[]> {
    if (this.closed) throw closedError(this.target, 'logs');
    if (deviceKind(this.kind).console !== true) throw capabilityError(this.target, 'webview', `read the page console of ${this.kind} (its WebDriver session has none)`);
    await this.drainLogs();
    return [...this.lines];
  }

  private async drainLogs(): Promise<void> {
    if (deviceKind(this.kind).console !== true || !this.id) return;
    const entries = (await this.client.wd('POST', `/session/${this.id}/se/log`, { type: 'browser' })) as { level: string; message: string; source?: string; timestamp?: number }[];
    for (const e of entries) {
      const kind = consoleLogKind({ source: e.source ?? '', level: e.level, text: e.message });
      if (kind) this.lines.push({ at: new Date(e.timestamp ?? this.ctx.deps.clock.now()).toISOString(), kind, text: e.message.slice(0, 500) });
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.video = null;
    if (this.id) await this.end();
  }
}
