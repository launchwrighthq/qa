// Driver kind `qa.target`: where a leg runs (spec 2.8). `playwright` and `fake` live here; the
// device drivers (`android-adb`, `android-emulator`, `ios-webkit`, `ios-simulator`, `browserstack`)
// come with the `device` submodule.
import type { Driver } from '../../kernel/index.mts';
import type { CredentialNeed, DataNeed, OutwardNeed } from '../../services/contract.mts';
import type { Act, Leg, Settle } from '../../services/types.mts';

export const QA_TARGET_SPEC_VERSION = '1';

/**
 * Capabilities of a QA target.
 * - `input`: the target runs `act` steps (taps, typing, navigation by input).
 * - `screenshot`: the target captures a PNG of the screen or the page.
 * - `video`: the target records a video (`startVideo`, `stopVideo`).
 * - `webview`: the target reaches a web page and reads its console.
 * - `native`: the target reaches native app screens.
 * - `telegram`: the target runs the Telegram app checks.
 */
export const QA_TARGET_CAPABILITIES = ['input', 'screenshot', 'video', 'webview', 'native', 'telegram'] as const;
export type QaTargetCapability = (typeof QA_TARGET_CAPABILITIES)[number];

/** A captured image. Width and height come from the PNG header. */
export interface Capture {
  path: string;
  width: number;
  height: number;
}

/** A captured video. */
export interface VideoCapture {
  path: string;
  durationMs: number;
}

/** One page error, console error or failed request of a session (spec 2.11.1). */
export interface SessionLogLine {
  at: string;
  kind: 'page-error' | 'console-error' | 'request-failed' | 'response-5xx';
  text: string;
}

export interface OpenOptions {
  leg: Leg;
  /** The origin of the surface, for example the QA API client URL or a tunnel URL. */
  baseUrl: string;
  /** The persona of the row, when it has one. */
  persona?: string;
  /** The folder that receives traces and videos the target writes itself. */
  outDir: string;
}

export interface QaSession {
  navigate(route: string): Promise<void>;
  act(step: Act): Promise<void>;
  settle(rule: Settle): Promise<void>;
  /** The route the session shows now, relative to the surface base. */
  currentRoute(): Promise<string>;
  screenshot(path: string): Promise<Capture>;
  startVideo(path: string): Promise<void>;
  stopVideo(): Promise<VideoCapture>;
  /** Writes the trace when the target has one. Returns the path, or null. */
  trace(path: string): Promise<string | null>;
  /** An accessibility dump, when the target has one. Returns the path, or null. */
  dump(path: string): Promise<string | null>;
  logs(): Promise<SessionLogLine[]>;
  close(): Promise<void>;
  /**
   * Runs a script expression in the page and returns its JSON value. An async expression is
   * awaited. Browser and WebView targets only. The path crawl and the state harness checks use it.
   */
  evaluate?(expression: string): Promise<unknown>;
  /** The page behind a browser session, for response interception (spec 2.7, `intercepted`). */
  routable?(): RoutablePage;
}

/** A request that a route handler sees. A Playwright `Request` fits. */
export interface RoutedRequest {
  url(): string;
}

/** A real response that a route handler fetched. A Playwright `APIResponse` fits. */
export interface RoutedResponse {
  status(): number;
  headers(): Record<string, string>;
  text(): Promise<string>;
}

/** One intercepted request. A Playwright `Route` fits. */
export interface RoutedRoute {
  request(): RoutedRequest;
  fetch(): Promise<RoutedResponse>;
  fulfill(options: { status: number; headers: Record<string, string>; body: string }): Promise<void>;
  continue(): Promise<void>;
}

/** An element of a routable page. A Playwright `Locator` fits. */
export interface RoutableLocator {
  first(): RoutableLocator;
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
  scrollIntoViewIfNeeded(): Promise<void>;
  screenshot(options: { path: string }): Promise<unknown>;
}

/** The part of a browser page that intercepted capture uses. A Playwright `Page` fits. */
export interface RoutablePage {
  route(url: string, handler: (route: RoutedRoute) => Promise<void>): Promise<unknown>;
  unroute(url: string, handler: (route: RoutedRoute) => Promise<void>): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  locator(selector: string): RoutableLocator;
}

/**
 * What a leg on a target needs before the pass starts (spec 2.6). The run contract lists each need,
 * so a missing credential shows before the first row. A credential is a key and set or empty, never
 * a value.
 */
export interface TargetNeeds {
  credentials?: CredentialNeed[];
  outward?: OutwardNeed[];
  data?: DataNeed[];
}

export interface TargetReadiness {
  ready: boolean;
  /** Why the target is not ready, and the fix. */
  reason?: string;
}

/**
 * A `qa.target` driver. It is a kernel `Driver`, so `runContract` checks its `specVersion`.
 * A method that needs a capability the target lacks rejects with `qa.target.capability`:
 * `act` needs `input`, `screenshot` needs `screenshot`, `startVideo` and `stopVideo` need `video`.
 */
export interface QaTarget extends Driver {
  readonly name: string;
  readonly capabilities: ReadonlySet<QaTargetCapability>;
  ready(leg: Leg): Promise<TargetReadiness>;
  open(opts: OpenOptions): Promise<QaSession>;
  /** The needs of a leg on this target, read from the config only. Absent when it needs nothing. */
  needs?(leg: Leg): TargetNeeds;
}

/** The registered targets, by driver name. `get` fails with `qa.target.unknown`. */
export interface QaTargetRegistry {
  names(): string[];
  get(name: string): QaTarget;
}

/** The registry that `QA_TARGETS` binds. An extension module adds its targets at boot. */
export interface OpenTargetRegistry extends QaTargetRegistry {
  /** Adds targets. A name that the registry holds fails with `qa.target.duplicate`. */
  add(targets: Record<string, QaTarget>): void;
}
