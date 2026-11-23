// The `fake` qa.target driver (spec 2.8): a memory page with scripted routes, a fixed PNG and a
// fixed 2 s clip. Tests and the playground use it. It never starts a process.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Clock, LaunchwrightError, systemClock } from '@launchwrighthq/kernel';
import { encodePng } from '../../services/png.mts';
import type { Act, Leg, Settle } from '../../services/types.mts';
import {
  type Capture,
  type OpenOptions,
  QA_TARGET_SPEC_VERSION,
  type QaSession,
  type QaTarget,
  type QaTargetCapability,
  type SessionLogLine,
  type TargetReadiness,
  type VideoCapture,
} from './contract.mts';

/** One scripted page of the fake target. */
export interface FakeRoute {
  /** Selectors the page shows. `body` is always there. */
  selectors?: string[];
  /** The route the page lands on instead, as a server redirect does. */
  redirect?: string;
  /** Click targets that open another route. */
  links?: Record<string, string>;
  /** The page has a decoded image (settle `artwork`). */
  artwork?: boolean;
  /** The page has a playing video (settle `video`). */
  video?: boolean;
  /** The page keeps `aria-busy="true"` (settle `busy` fails). */
  busy?: boolean;
  /** Log lines the page writes when it opens. */
  logs?: Omit<SessionLogLine, 'at'>[];
  /** The screenshot is one flat colour, as a blank screen is. */
  blank?: boolean;
}

export interface FakeTargetOptions {
  /** The driver name. Default `fake`. */
  name?: string;
  /** Default `input`, `screenshot`, `video`, `webview`. */
  capabilities?: QaTargetCapability[];
  /** Pages by route. A route not listed is an empty page. */
  routes?: Record<string, FakeRoute>;
  /** What `ready` answers. Default ready. */
  readiness?: TargetReadiness;
  /** Writes a trace file in `trace()`. Default false: `trace()` gives null. */
  trace?: boolean;
  /** Writes an accessibility dump in `dump()`. Default false: `dump()` gives null. */
  dump?: boolean;
  clock?: Clock;
}

/** What the fake records about one session, for assertions. */
export interface FakeSessionLog {
  opts: OpenOptions;
  /** One line per call: `navigate /x`, `act click #go`, `screenshot <path>`, ... */
  calls: string[];
  closed: boolean;
}

/** The fake target, with the log of every session it opened. */
export interface FakeTarget extends QaTarget {
  readonly sessions: FakeSessionLog[];
}

/** Width and height of the fixed screenshot. */
export const FAKE_SHOT_SIZE = { width: 64, height: 40 } as const;
/** Duration of the fixed clip. */
export const FAKE_CLIP_MS = 2000;

const DEFAULT_CAPABILITIES: QaTargetCapability[] = ['input', 'screenshot', 'video', 'webview'];

/** An RGBA PNG: an 8 px checkerboard, or one flat grey when `flat` is true. */
export function fakePng(width: number, height: number, flat = false): Buffer {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dark = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const value = flat ? 128 : dark ? 32 : 224;
      rgba.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  return Buffer.from(encodePng(width, height, rgba));
}

/** A 2 s, 32x32, 4 fps VP8 test pattern clip (ffmpeg `testsrc`). */
const CLIP_BASE64 = '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';
export const FAKE_CLIP: Buffer = Buffer.from(CLIP_BASE64, 'base64');

function write(path: string, bytes: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

function capabilityError(target: string, capability: QaTargetCapability, what: string): LaunchwrightError {
  return new LaunchwrightError('qa.target.capability', `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability },
  });
}

class FakeSession implements QaSession {
  private route = '/';
  private readonly history: string[] = [];
  private readonly lines: SessionLogLine[] = [];
  private videoPath: string | null = null;
  private videoStart = 0;

  constructor(
    private readonly target: FakeTargetImpl,
    private readonly log: FakeSessionLog,
  ) {}

  private page(): FakeRoute {
    return this.target.routes[this.route] ?? {};
  }

  private alive(call: string): void {
    if (this.log.closed) throw new LaunchwrightError('qa.target.closed', `The fake session is closed; ${call} needs an open session.`);
    this.log.calls.push(call);
  }

  private go(route: string): void {
    const landed = this.target.routes[route]?.redirect ?? route;
    this.route = landed;
    for (const line of this.page().logs ?? []) this.lines.push({ at: this.target.clock.date().toISOString(), ...line });
  }

  private has(selector: string): boolean {
    return selector === 'body' || (this.page().selectors ?? []).includes(selector) || selector in (this.page().links ?? {});
  }

  async navigate(route: string): Promise<void> {
    this.alive(`navigate ${route}`);
    this.history.push(this.route);
    this.go(route);
  }

  async act(step: Act): Promise<void> {
    this.alive(`act ${step.kind}${step.target ? ` ${step.target}` : ''}`);
    if (!this.target.capabilities.has('input')) throw capabilityError(this.target.name, 'input', `run the act ${step.kind}`);
    if ((step.kind === 'click' || step.kind === 'type') && (!step.target || !this.has(step.target))) {
      throw new LaunchwrightError('qa.target.act', `The act ${step.kind} found no element for ${step.target ?? '(no target)'} on ${this.route}.`, {
        context: { act: step, route: this.route },
      });
    }
    if (step.kind === 'click' && step.target) {
      const next = this.page().links?.[step.target];
      if (next !== undefined) {
        this.history.push(this.route);
        this.go(next);
      }
    }
    if (step.kind === 'back') {
      const previous = this.history.pop();
      if (previous !== undefined) this.route = previous;
    }
  }

  async settle(rule: Settle): Promise<void> {
    this.alive('settle');
    const page = this.page();
    const missing: string[] = [];
    if (rule.selector !== undefined && !this.has(rule.selector)) missing.push(`selector ${rule.selector}`);
    if (rule.artwork && !page.artwork) missing.push('artwork');
    if (rule.video && !page.video) missing.push('a playing video');
    if (rule.busy && page.busy) missing.push('no aria-busy element');
    if (missing.length > 0) {
      throw new LaunchwrightError('qa.target.settle', `The fake page ${this.route} never showed ${missing.join(', ')}.`, {
        context: { route: this.route, rule },
      });
    }
  }

  async currentRoute(): Promise<string> {
    this.alive('currentRoute');
    return this.route;
  }

  async screenshot(path: string): Promise<Capture> {
    this.alive(`screenshot ${path}`);
    if (!this.target.capabilities.has('screenshot')) throw capabilityError(this.target.name, 'screenshot', 'take a screenshot');
    write(path, fakePng(FAKE_SHOT_SIZE.width, FAKE_SHOT_SIZE.height, this.page().blank === true));
    return { path, ...FAKE_SHOT_SIZE };
  }

  async startVideo(path: string): Promise<void> {
    this.alive(`startVideo ${path}`);
    if (!this.target.capabilities.has('video')) throw capabilityError(this.target.name, 'video', 'record a video');
    if (this.videoPath !== null) throw new LaunchwrightError('qa.target.video', `The fake session already records ${this.videoPath}.`);
    this.videoPath = path;
    this.videoStart = this.target.clock.now();
  }

  async stopVideo(): Promise<VideoCapture> {
    this.alive('stopVideo');
    if (!this.target.capabilities.has('video')) throw capabilityError(this.target.name, 'video', 'record a video');
    if (this.videoPath === null) throw new LaunchwrightError('qa.target.video', 'The fake session records no video; call startVideo first.');
    const path = this.videoPath;
    this.videoPath = null;
    write(path, FAKE_CLIP);
    return { path, durationMs: Math.max(FAKE_CLIP_MS, this.target.clock.now() - this.videoStart) };
  }

  async trace(path: string): Promise<string | null> {
    this.alive(`trace ${path}`);
    if (!this.target.writesTrace) return null;
    write(path, `fake trace of ${this.log.opts.leg.name}\n`);
    return path;
  }

  async dump(path: string): Promise<string | null> {
    this.alive(`dump ${path}`);
    if (!this.target.writesDump) return null;
    write(path, `<?xml version="1.0" encoding="UTF-8"?>\n<hierarchy route="${this.route}"/>\n`);
    return path;
  }

  async logs(): Promise<SessionLogLine[]> {
    this.alive('logs');
    return [...this.lines];
  }

  async close(): Promise<void> {
    if (this.log.closed) return;
    this.log.calls.push('close');
    this.log.closed = true;
  }
}

class FakeTargetImpl implements FakeTarget {
  readonly specVersion = QA_TARGET_SPEC_VERSION;
  readonly name: string;
  readonly capabilities: ReadonlySet<QaTargetCapability>;
  readonly sessions: FakeSessionLog[] = [];
  readonly routes: Record<string, FakeRoute>;
  readonly clock: Clock;
  readonly writesTrace: boolean;
  readonly writesDump: boolean;
  private readonly readiness: TargetReadiness;

  constructor(opts: FakeTargetOptions) {
    this.name = opts.name ?? 'fake';
    this.capabilities = new Set(opts.capabilities ?? DEFAULT_CAPABILITIES);
    this.routes = opts.routes ?? {};
    this.clock = opts.clock ?? systemClock;
    this.writesTrace = opts.trace ?? false;
    this.writesDump = opts.dump ?? false;
    this.readiness = opts.readiness ?? { ready: true };
  }

  supports(cap: string): boolean {
    return (this.capabilities as ReadonlySet<string>).has(cap);
  }

  async ready(_leg: Leg): Promise<TargetReadiness> {
    return this.readiness;
  }

  async open(opts: OpenOptions): Promise<QaSession> {
    if (!this.readiness.ready) {
      throw new LaunchwrightError('qa.target.not-ready', `The ${this.name} target is not ready: ${this.readiness.reason ?? 'no reason given'}.`);
    }
    const log: FakeSessionLog = { opts, calls: [], closed: false };
    this.sessions.push(log);
    return new FakeSession(this, log);
  }
}

/** The required fake `qa.target` driver. */
export function createFakeTarget(opts: FakeTargetOptions = {}): FakeTarget {
  return new FakeTargetImpl(opts);
}
