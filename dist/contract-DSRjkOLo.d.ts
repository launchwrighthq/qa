/** The core of every driver. Optional abilities are named capabilities (spec 2.5). */
interface Driver {
    readonly name: string;
    /** The version of the driver kind's interface. A breaking change bumps it. */
    readonly specVersion: string;
    readonly capabilities: ReadonlySet<string>;
    supports(cap: string): boolean;
    /**
     * True for a deliberate per-replica cache: each replica may hold its own copy, and a stale copy
     * changes no answer. A deployed environment then accepts it even when its name is in
     * `kernel.localDrivers` (spec D3).
     */
    readonly allowsReplicaLocal?: boolean;
}
declare abstract class BaseDriver implements Driver {
    readonly name: string;
    readonly specVersion: string;
    readonly capabilities: ReadonlySet<string>;
    constructor(name: string, specVersion: string, capabilities: string[]);
    supports(cap: string): boolean;
}

/** What a leg shows: the web client, the Mini App, or a bot chat (spec 2.3). */
type Surface = 'web' | 'miniapp' | 'bot';
/** A leg: where a row runs (spec 2.3). Config `qa.legs.<name>` gives every field but `name`. */
interface Leg {
    name: string;
    surface: Surface;
    /** A `qa.target` driver name: `playwright`, `android-adb`, `ios-webkit`, ... */
    target: string;
    /** A `qa.device.devices` name, for a device target. */
    device?: string;
    /** A Playwright device descriptor name, for example `Pixel 7`. */
    descriptor?: string;
    viewport?: {
        width: number;
        height: number;
    };
    deviceScaleFactor?: number;
    userAgent?: string;
    browser?: 'chromium' | 'webkit' | 'firefox';
    /** The bot username a Telegram leg opens. */
    bot?: string;
}
declare const ACT_KINDS: readonly ["click", "type", "press", "scroll", "wait", "back"];
type ActKind = (typeof ACT_KINDS)[number];
/** One step of a row. A `wait` needs a `why` (spec 2.4). */
interface Act {
    kind: ActKind;
    /** A Playwright selector, `role=<role>[name="<name>"]` first (spec 2.14 rule C5). */
    target?: string;
    text?: string;
    key?: string;
    dx?: number;
    dy?: number;
    ms?: number;
    why?: string;
}
/** When a screen counts as painted. Exactly one of `selector`, `artwork`, `video`, `busy` (spec 2.4). */
interface Settle {
    selector?: string;
    artwork?: boolean;
    video?: boolean;
    busy?: boolean;
    timeout?: number;
}
/** How a state was reached (spec 2.5, 2.7). A `forged` state is an inferred seed or a direct row write, and never counts as a live pass. */
type Provenance = 'live' | 'mounted' | 'intercepted' | 'forged';
/** What an evidence file holds (spec 2.11.1). */
type EvidenceKind = 'screenshot' | 'step' | 'video' | 'trace' | 'log' | 'ui';
/** One file in `evidence.lock.json` (spec 2.11.3). Only the runner writes it. */
interface LedgerEntry {
    /** Relative to the report folder: `assets/<slug>/<file>`. */
    path: string;
    kind: EvidenceKind;
    sha256: string;
    bytes: number;
    /** ISO time from the kernel CLOCK. */
    capturedAt: string;
    commit: string;
    dirty: boolean;
    leg: string;
    target: string;
    device?: string;
    provenance: Provenance;
    row: string;
    attempt: number;
}
/** Why a row failed (spec 2.11.2). `expect` is an unmet expectation, `crashed` a runner fault. */
declare const ROW_FAILURES: readonly ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error", "expect", "crashed"];
type RowFailure = (typeof ROW_FAILURES)[number];
/** The result of one row on one leg. `n/a` and `not-run` carry a reason (spec 2.11.1, 2.12.3). */
interface RowResult {
    row: string;
    leg: string;
    status: 'passed' | 'failed' | 'n/a' | 'not-run';
    reason?: string;
    failures: RowFailure[];
    attempts: number;
    ms: number;
}
/** The computed report status (spec 2.12.2). */
declare const REPORT_STATUSES: readonly ["planned", "passed", "failed", "partial"];
type ReportStatus = (typeof REPORT_STATUSES)[number];
/** One issue record from intake (spec 2.15.1). Records stay in `.lw/qa/intake/<id>/`. */
interface QaIssue {
    /** `github-<owner>-<repo>-<n>` or `tg-<chat>-<firstMessageId>`. */
    id: string;
    source: 'github' | 'telegram';
    ref: string;
    title: string;
    reportedAt: string;
    reporter: string;
    text: string;
    thread: {
        at: string;
        author: string;
        text: string;
    }[];
    attachments: {
        kind: 'image' | 'video' | 'voice' | 'file';
        path: string;
        sha256: string;
        bytes: number;
        mime: string;
        from: string;
    }[];
    skipped: {
        from: string;
        reason: 'too-large' | 'unreachable' | 'unsupported';
    }[];
}
type AttachmentKind = QaIssue['attachments'][number]['kind'];
type SkipReason = QaIssue['skipped'][number]['reason'];
/** One file that an item carries or links. It holds the bytes, or the reason it has none. */
interface RawMedia {
    /** Where the file comes from: a URL without its query, or `tg:<chat>/<message id>`. Never a token. */
    from: string;
    kind: AttachmentKind;
    /** The media type, for example `image/png`. */
    mime: string;
    /** The file name at the source, when it has one. */
    name?: string;
    data?: Uint8Array;
    skipped?: SkipReason;
}
/** The folder of intake records, relative to the project root (spec 2.15.1). */
declare const INTAKE_DIR = ".lw/qa/intake";
/**
 * A row that needs an isolated single-instance state (spec 2.4). The runner forks the QA database
 * once per `fork` label, arms the group's facts on that fork, and drops the fork after the group.
 * Two rows with two labels get two forks, so each holds the only open giveaway at the same time.
 */
interface Isolation {
    /** The fork label of the row. Omit it for a row that runs on the shared QA world. */
    fork?: string;
}

/** The four groups of a run contract manifest (spec 2.6). */
type ConsentGroup = 'credentials' | 'devices' | 'outward' | 'data';
/** One need the pass asks consent for. The printed manifest shows the title, never a value. */
interface ManifestItem {
    /** Stable unique id within the manifest, `<group>:<name>`. */
    id: string;
    group: ConsentGroup;
    /** One short line the reviewer reads. */
    title: string;
    /** True when the item reaches outside and always needs an explicit grant (spec 2.6). */
    outward: boolean;
    /** A credentials item only: the environment key. Never the value. */
    key?: string;
    /** A credentials item only: whether the secret store holds a value. */
    present?: boolean;
    /** A credentials item that is set: a short sha256 of the value, 16 hex characters at most. */
    fingerprint?: string;
    /** The legs that need the item, sorted. A pass that drops them drops the need. */
    legs?: string[];
}
/** The requirements manifest a pass computes before any outward action (spec 2.6). */
interface ConsentManifest {
    title: string;
    /** The items, sorted by group then id, so the same needs give the same manifest. */
    items: ManifestItem[];
}
/** A credential the pass needs. The caller gives set/empty and a short hash, never the value. */
interface CredentialNeed {
    key: string;
    present: boolean;
    /** A short sha256 of the value, 1 to 16 hex characters. Absent when empty. */
    fingerprint?: string;
    /** The legs that need the credential. */
    legs?: string[];
}
/** The need of one credential: set or empty, and a short sha256 when set. The value stays here. */
declare function credentialNeed(envKey: string, value: string | undefined, legs?: readonly string[]): CredentialNeed;
/** An outward action the pass will take (spec 2.6). Each always needs an explicit grant. */
interface OutwardNeed {
    /** `throwaway-bot`, `test-account`, `third-party-request`, `invoice`. */
    id: string;
    title: string;
}
/** A data or isolation step the pass will run (spec 2.6). */
interface DataNeed {
    /** `world-reset`, `per-pass-fork`, `dev-db-copy`. */
    id: string;
    title: string;
}
/** The input of a manifest: the title, the legs and the needs the caller read from the rows and config. */
interface ManifestInput {
    /** The pass or report title, for the printed manifest. */
    title: string;
    /** The legs the pass runs. A device leg adds one device item. */
    legs: Leg[];
    credentials?: CredentialNeed[];
    outward?: OutwardNeed[];
    data?: DataNeed[];
}
/** One recorded grant: the item id and how the reviewer gave it. */
interface ConsentGrant {
    id: string;
    /** `item` for a per-item yes, `all` for an "allow all". */
    via: 'item' | 'all';
}
/** The persisted consent for one manifest, keyed by its hash. Holds no secret value. */
interface ConsentRecord {
    hash: string;
    grants: ConsentGrant[];
    /** The manifest title the reviewer saw. */
    title?: string;
    /** The items the reviewer saw. A grant covers only an item that a recorded manifest lists. */
    items?: ManifestItem[];
}
/** A per-item grant map, or the string `all`. */
type GrantChoices = 'all' | Record<string, boolean>;
/** The persistence of consent records, injected so a test uses an in-memory store (spec 2.6). */
interface ConsentStore {
    read(hash: string): Promise<ConsentRecord | null>;
    write(hash: string, record: ConsentRecord): Promise<void>;
    /** Every record, sorted by hash. */
    list(): Promise<ConsentRecord[]>;
    /** Removes the record of `hash`, or every record when `hash` is absent. Returns the count. */
    remove(hash?: string): Promise<number>;
}
/** The consent store folder, relative to the project root (spec 2.6). */
declare const CONSENT_DIR = ".lw/qa/consent";
/**
 * The requirements manifest of a pass (spec 2.6). The caller reads the needs from the resolved
 * rows, the legs and the config. The items are sorted by group then id, so the same needs give the
 * same manifest and the same hash.
 */
declare function computeManifest(input: ManifestInput): ConsentManifest;
/** The stable sha256 of a manifest. The same needs give the same hash across runs (spec 2.6). */
declare function manifestHash(manifest: ConsentManifest): string;
/**
 * The consent record for a manifest and the reviewer's choices. `all` grants every listed item,
 * outward actions included, because the reviewer chose it with those actions in front of them. A
 * per-item map grants an item only when its choice is `true`, so an outward action always needs an
 * explicit grant (spec 2.6).
 */
declare function grant(manifest: ConsentManifest, choices: GrantChoices): ConsentRecord;
/**
 * The items still to ask, given the prior records (spec 2.6). A grant is per item, so it covers the
 * item in any manifest: an unchanged manifest returns nothing and a grown manifest returns only its
 * new items. A null record, or none, asks every item.
 */
declare function diff(prior: ConsentRecord | readonly ConsentRecord[] | null, manifest: ConsentManifest): ManifestItem[];
/**
 * The record of a manifest after a decision (spec 2.6). It keeps the prior grants of the listed
 * items and adds `all` (every item) or the named ids. An id that the manifest does not list fails
 * with `qa.consent.unlisted`, so an outward action is granted only when the reviewer saw it.
 */
declare function recordGrants(manifest: ConsentManifest, prior: readonly ConsentRecord[], choice: 'all' | readonly string[]): ConsentRecord;
/** The credentials items with no value. A pass refuses to start while one stays in its manifest. */
declare function missingCredentials(manifest: ConsentManifest): ManifestItem[];
/**
 * A consent store that writes one JSON record per hash under `dir`, the project's `.lw/qa/consent`
 * folder. The record holds the grant and no secret value.
 */
declare function fileConsentStore(dir: string): ConsentStore;

declare const QA_TARGET_SPEC_VERSION = "1";
/**
 * Capabilities of a QA target.
 * - `input`: the target runs `act` steps (taps, typing, navigation by input).
 * - `screenshot`: the target captures a PNG of the screen or the page.
 * - `video`: the target records a video (`startVideo`, `stopVideo`).
 * - `webview`: the target reaches a web page and reads its console.
 * - `native`: the target reaches native app screens.
 * - `telegram`: the target runs the Telegram app checks.
 */
declare const QA_TARGET_CAPABILITIES: readonly ["input", "screenshot", "video", "webview", "native", "telegram"];
type QaTargetCapability = (typeof QA_TARGET_CAPABILITIES)[number];
/** A captured image. Width and height come from the PNG header. */
interface Capture {
    path: string;
    width: number;
    height: number;
}
/** A captured video. */
interface VideoCapture {
    path: string;
    durationMs: number;
}
/** One page error, console error or failed request of a session (spec 2.11.1). */
interface SessionLogLine {
    at: string;
    kind: 'page-error' | 'console-error' | 'request-failed' | 'response-5xx';
    text: string;
}
interface OpenOptions {
    leg: Leg;
    /** The origin of the surface, for example the QA API client URL or a tunnel URL. */
    baseUrl: string;
    /** The persona of the row, when it has one. */
    persona?: string;
    /** The folder that receives traces and videos the target writes itself. */
    outDir: string;
}
interface QaSession {
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
interface RoutedRequest {
    url(): string;
}
/** A real response that a route handler fetched. A Playwright `APIResponse` fits. */
interface RoutedResponse {
    status(): number;
    headers(): Record<string, string>;
    text(): Promise<string>;
}
/** One intercepted request. A Playwright `Route` fits. */
interface RoutedRoute {
    request(): RoutedRequest;
    fetch(): Promise<RoutedResponse>;
    fulfill(options: {
        status: number;
        headers: Record<string, string>;
        body: string;
    }): Promise<void>;
    continue(): Promise<void>;
}
/** An element of a routable page. A Playwright `Locator` fits. */
interface RoutableLocator {
    first(): RoutableLocator;
    boundingBox(): Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>;
    scrollIntoViewIfNeeded(): Promise<void>;
    screenshot(options: {
        path: string;
    }): Promise<unknown>;
}
/** The part of a browser page that intercepted capture uses. A Playwright `Page` fits. */
interface RoutablePage {
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
interface TargetNeeds {
    credentials?: CredentialNeed[];
    outward?: OutwardNeed[];
    data?: DataNeed[];
}
interface TargetReadiness {
    ready: boolean;
    /** Why the target is not ready, and the fix. */
    reason?: string;
}
/**
 * A `qa.target` driver. It is a kernel `Driver`, so `runContract` checks its `specVersion`.
 * A method that needs a capability the target lacks rejects with `qa.target.capability`:
 * `act` needs `input`, `screenshot` needs `screenshot`, `startVideo` and `stopVideo` need `video`.
 */
interface QaTarget extends Driver {
    readonly name: string;
    readonly capabilities: ReadonlySet<QaTargetCapability>;
    ready(leg: Leg): Promise<TargetReadiness>;
    open(opts: OpenOptions): Promise<QaSession>;
    /** The needs of a leg on this target, read from the config only. Absent when it needs nothing. */
    needs?(leg: Leg): TargetNeeds;
}
/** The registered targets, by driver name. `get` fails with `qa.target.unknown`. */
interface QaTargetRegistry {
    names(): string[];
    get(name: string): QaTarget;
}
/** The registry that `QA_TARGETS` binds. An extension module adds its targets at boot. */
interface OpenTargetRegistry extends QaTargetRegistry {
    /** Adds targets. A name that the registry holds fails with `qa.target.duplicate`. */
    add(targets: Record<string, QaTarget>): void;
}

export { type Driver as $, type Act as A, type SessionLogLine as B, type CredentialNeed as C, type DataNeed as D, type EvidenceKind as E, type SkipReason as F, type GrantChoices as G, type Surface as H, INTAKE_DIR as I, type TargetReadiness as J, computeManifest as K, type LedgerEntry as L, type ManifestInput as M, credentialNeed as N, type OpenTargetRegistry as O, type Provenance as P, type QaTarget as Q, REPORT_STATUSES as R, type Settle as S, type TargetNeeds as T, diff as U, type VideoCapture as V, fileConsentStore as W, grant as X, manifestHash as Y, missingCredentials as Z, recordGrants as _, type QaTargetRegistry as a, BaseDriver as a0, type RoutablePage as a1, ACT_KINDS as b, type ActKind as c, type AttachmentKind as d, CONSENT_DIR as e, type Capture as f, type ConsentGrant as g, type ConsentGroup as h, type ConsentManifest as i, type ConsentRecord as j, type ConsentStore as k, type Isolation as l, type Leg as m, type ManifestItem as n, type OpenOptions as o, type OutwardNeed as p, QA_TARGET_CAPABILITIES as q, QA_TARGET_SPEC_VERSION as r, type QaIssue as s, type QaSession as t, type QaTargetCapability as u, ROW_FAILURES as v, type RawMedia as w, type ReportStatus as x, type RowFailure as y, type RowResult as z };
