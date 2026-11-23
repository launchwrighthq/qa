import { a as QaSubcommand, P as Provider } from './extensions-J0JM1qlT.js';
export { E as EXTENSION_PREFIX, b as QaCommandOptions, Q as QaExtension, S as SUBCOMMANDS, e as extensionNames, c as extensionTargets, l as loadExtensions, q as qaCommand } from './extensions-J0JM1qlT.js';
import { C as Clock } from './clock-BUdCJ9bN.js';
import { a as QaTargetRegistry, Q as QaTarget, L as Leg, A as Act, S as Settle, b as LedgerEntry, O as OpenTargetRegistry } from './contract-xgrBaS32.js';
export { c as ACT_KINDS, d as ActKind, e as AttachmentKind, C as Capture, E as EvidenceKind, I as INTAKE_DIR, f as Isolation, g as OpenOptions, P as Provenance, h as QA_TARGET_CAPABILITIES, i as QA_TARGET_SPEC_VERSION, j as QaIssue, k as QaSession, l as QaTargetCapability, R as REPORT_STATUSES, m as ROW_FAILURES, n as RawMedia, o as ReportStatus, p as RowFailure, q as RowResult, r as SessionLogLine, s as SkipReason, t as Surface, T as TargetReadiness, V as VideoCapture } from './contract-xgrBaS32.js';
import { Q as QaConfig } from './config-B-lxHEnb.js';
export { L as LegConfig, q as qaConfig, a as qaConfigOf, w as withAppPaths } from './config-B-lxHEnb.js';
export { i as isCodedError } from './errors-DgRPaUlC.js';
export { I as IssueDraft, i as issueMarkdown, l as listIssues, r as readIssue, a as recordDir, b as recordId, w as writeIssue } from './records-CKl-a2_W.js';
import { T as Token } from './app-KXgbRXYO.js';
import 'zod';

/** The dependencies of a run. A test passes fakes; the command builds the defaults. */
interface RunDeps {
    targets: QaTargetRegistry;
    clock: Clock;
    /** The commit and the dirty flag of the checkout, for each ledger entry. */
    revision: (cwd: string) => {
        commit: string;
        dirty: boolean;
    };
}

/** Builds the subcommand. A test passes fake targets, a fake clock and a fixed revision. */
declare function createStatesCommand(overrides?: Partial<RunDeps>): QaSubcommand;

interface PlaywrightTargetOptions {
    clock?: Clock;
    /** A browser binary to launch instead of the one that `playwright install` put in place. */
    executablePath?: string;
    /** How long one act step may take. Default 15 s. */
    actTimeoutMs?: number;
    /** The settle budget when a rule names none. Default 20 s. */
    settleTimeoutMs?: number;
}
/** The `playwright` `qa.target` driver. */
declare function createPlaywrightTarget(opts?: PlaywrightTargetOptions): QaTarget;

/**
 * Binds QA_TARGETS. With config `qa.routes` on, it wraps CLOCK in the shift clock of
 * `POST /__qa/clock`, and boot fails with `qa.routes.production` in the production environment
 * (spec 2.6, rule S3). Mount the routes with `qaRoutes(app)`.
 */
declare const qaProvider: Provider;

/** The extension of a media type, without the dot. `bin` for an unknown type. */
declare function extensionOf(mime: string): string;
/** The media type of an extension, or null. */
declare function mimeOfExtension(name: string): string | null;

interface PngSize {
    width: number;
    height: number;
}
/** The pixel size from the IHDR chunk, or null when the bytes are not a PNG header. */
declare function pngSize(bytes: Uint8Array): PngSize | null;

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
}
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
}
/** A per-item grant map, or the string `all`. */
type GrantChoices = 'all' | Record<string, boolean>;
/** The persistence of consent records, injected so a test uses an in-memory store (spec 2.6). */
interface ConsentStore {
    read(hash: string): Promise<ConsentRecord | null>;
    write(hash: string, record: ConsentRecord): Promise<void>;
}
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
 * The items still to ask, given a prior record (spec 2.6). An item a prior grant covers drops out,
 * so an unchanged manifest returns nothing and a grown manifest returns only its new items. A null
 * record, or none, asks every item.
 */
declare function diff(prior: ConsentRecord | null, manifest: ConsentManifest): ManifestItem[];
/**
 * A consent store that writes one JSON record per hash under `dir`, the project's `.lw/qa/consent`
 * folder. The record holds the grant and no secret value.
 */
declare function fileConsentStore(dir: string): ConsentStore;

/** The @username of the BotFather account the lifecycle drives. */
declare const BOTFATHER = "BotFather";
/** The exact confirmation BotFather asks for before it deletes a bot. */
declare const DELETE_CONFIRM = "Yes, I am totally sure.";
/** An authorized userbot: an MTProto user session and an optional proxy, supplied by the consumer. */
interface UserbotLease {
    apiId: number;
    apiHash: string;
    /** A GramJS string session of a signed-in account the user authorized for this run. */
    session: string;
    /** A SOCKS5 proxy as `socks5://[user:password@]host:port`. A secret when it holds a password. */
    proxy?: string;
}
/** The consumer's source of an authorized userbot. A consumer userbot module implements it. */
interface UserbotProvider {
    /** Leases one userbot for a run. */
    lease(): Promise<UserbotLease>;
    /** Releases the lease after the run, when the provider needs it. */
    release?(lease: UserbotLease): Promise<void>;
}
/** The BotFather chat the lifecycle drives: one send, then its reply. A test scripts the replies. */
interface BotFatherChat {
    send(text: string): Promise<void>;
    /** The next reply from BotFather after a send. */
    reply(): Promise<string>;
}
/** Checks a bot token against the Bot API getMe. Injected so a test fakes it and makes no call. */
type BotGetMe = (token: string) => Promise<{
    ok: boolean;
    status: number;
}>;
/** One command the bot registers through BotFather. */
interface BotCommand {
    command: string;
    description: string;
}
/** The result of `/newbot`: the bot id, the username, and the token for the run store. */
interface NewBot {
    botId: number;
    username: string;
    token: string;
}
/** What `configureBot` sets through BotFather. */
interface ConfigureBotOptions {
    username: string;
    /** The commands to register. An empty list skips the command step. */
    commands?: BotCommand[];
    /** Group privacy mode. True keeps the bot from reading all group messages. Default true. */
    privacy?: boolean;
}
/** A deleted bot and the getMe status that confirmed it dead (401). */
interface DeadBot {
    botId: number;
    username: string;
    status: number;
}
/** Reads the bot token from a BotFather reply. Throws `qa.bot.token` when no token matches. */
declare function parseBotToken(reply: string): string;
/** The numeric bot id before the colon of a token. Throws `qa.bot.token` for a token with none. */
declare function botIdOf(token: string): number;
/**
 * Drives the `/newbot` dialog: the command, the display name, then the username. It reads the token
 * from the last reply. The username must end in "bot", which BotFather requires.
 */
declare function newBot(chat: BotFatherChat, opts: {
    name: string;
    username: string;
}): Promise<NewBot>;
/** Sets the bot commands and the group privacy through BotFather, after `/newbot`. */
declare function configureBot(chat: BotFatherChat, opts: ConfigureBotOptions): Promise<void>;
/**
 * Revokes the token and deletes the bot through BotFather, then confirms it dead with a getMe that
 * returns 401. Throws `qa.bot.alive` when getMe answers with any other status, so a leak surfaces.
 */
declare function destroyBot(chat: BotFatherChat, getMe: BotGetMe, record: {
    botId: number;
    username: string;
    token: string;
}): Promise<DeadBot>;

/** The run store folder, relative to the project root. */
declare const BOT_STORE_DIR = ".lw/qa/bots";
/** One throwaway bot record. `token` is a secret and never leaves this store. */
interface BotRecord {
    botId: number;
    username: string;
    token: string;
    createdAt: string;
}
/** The run store, injected so a test uses a temp folder. */
interface BotStore {
    read(botId: number): Promise<BotRecord | null>;
    write(record: BotRecord): Promise<void>;
    list(): Promise<BotRecord[]>;
    remove(botId: number): Promise<void>;
}
/** A run store that writes `<dir>/<botId>.json`. The record holds the token; nothing here logs it. */
declare function fileBotStore(dir: string): BotStore;

/** The store folder, relative to the project root. `.lw/` is out of git. */
declare const COMMENTS_DIR = ".lw/qa/comments";
/** The anchor kinds a comment may carry (spec 2.9). */
declare const ANCHOR_KINDS: readonly ["step", "text", "region", "time", "flow"];
/** A comment on a row, a leg, an attempt and an act step index (spec 2.9). */
interface StepAnchor {
    kind: 'step';
    row: string;
    leg: string;
    attempt: number;
    step: number;
}
/** A comment on a word or phrase range in a report section (spec 2.9). */
interface TextAnchor {
    kind: 'text';
    section: string;
    quote: string;
    /** Character offsets of the range in the section, when the viewer knows them. */
    start?: number;
    end?: number;
}
/** A comment on a normalized rectangle of a screenshot (spec 2.9). Each of `x`, `y`, `w`, `h` is 0..1. */
interface RegionAnchor {
    kind: 'region';
    /** The report-relative screenshot path, `assets/<slug>/<file>`. */
    screenshot: string;
    row: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
/** A comment on a timestamp range of a video, in seconds (spec 2.9). */
interface TimeAnchor {
    kind: 'time';
    /** The report-relative video path, `assets/<slug>/<file>`. */
    video: string;
    row: string;
    start: number;
    end?: number;
    /** The act step active at that time, when the viewer knows it. */
    step?: number;
}
/** A comment on a named row or path (spec 2.9). */
interface FlowAnchor {
    kind: 'flow';
    name: string;
}
type CommentAnchor = StepAnchor | TextAnchor | RegionAnchor | TimeAnchor | FlowAnchor;
/** One reply under a comment. */
interface CommentReply {
    author: string;
    body: string;
    createdAt: string;
}
/** One reviewer comment (spec 2.9). `status` stays `open` until an agent or reviewer resolves it. */
interface Comment {
    id: string;
    anchor: CommentAnchor;
    author: string;
    body: string;
    createdAt: string;
    status: 'open' | 'resolved';
    replies: CommentReply[];
}
/** Every problem of an anchor, each a short line. An empty list means the anchor is valid. */
declare function validateAnchor(anchor: unknown): string[];
/** The fields a caller gives to create a comment. The server supplies `createdAt` from its clock. */
interface NewComment {
    anchor: CommentAnchor;
    author: string;
    body: string;
    createdAt: string;
    /** A test passes a stable id; otherwise a random uuid. */
    id?: string;
}
/** A full comment from the fields of `NewComment`. Throws `qa.comment.anchor` for a bad anchor. */
declare function makeComment(input: NewComment): Comment;
/** `list` with `comment` appended. Throws `qa.comment.duplicate` when its id is already present. */
declare function addComment(list: readonly Comment[], comment: Comment): Comment[];
/** `list` with `reply` added under comment `id`. Throws `qa.comment.missing` when no such comment. */
declare function replyToComment(list: readonly Comment[], id: string, reply: CommentReply): Comment[];
/** `list` with the status of comment `id` set. Throws `qa.comment.missing` when no such comment. */
declare function setStatus(list: readonly Comment[], id: string, status: Comment['status']): Comment[];
/** The persistence of the comments of one slug, injected so a test uses a temp folder. */
interface CommentStore {
    read(slug: string): Promise<Comment[]>;
    write(slug: string, comments: readonly Comment[]): Promise<void>;
}
/** The store file of a slug, `<dir>/<slug>.json`. Throws `qa.comment.slug` for an unsafe slug. */
declare function commentsFile(dir: string, slug: string): string;
/** A comment store that writes one JSON file per slug under `dir`. The file holds `{ slug, comments }`. */
declare function fileCommentStore(dir: string): CommentStore;

/** What a row needs on the QA world before it runs. */
interface Fixture {
    /** States to arm on the QA database, then disarm after the run. Empty when nothing is armed. */
    arm: string[];
    /** A persona id from the world registry. */
    persona?: string;
    /** Fact ids from the world registry. */
    facts?: string[];
}
/** What a row expects. A plain string is the claim with no expected page error. */
interface ShotExpect {
    text: string;
    /** Page errors this row expects, matched as substrings. Any other page error fails the row. */
    pageErrors?: string[];
}
/** One row of the manifest (spec 2.4). */
interface Shot {
    /** `<screen>.<state-slug>`, lower case and hyphenated. */
    id: string;
    screen: string;
    state: string;
    /** The spec section this row checks, digits and dots. */
    specRef?: string;
    /** `spec:<path>#<id>`, `commit:<sha>` or `issue:<intake-id>`. At least one. */
    source: string[];
    /** Leg names. */
    legs: string[];
    /** Relative to the surface base: `/store`, never `<base>/store`. */
    route: string;
    fixture: Fixture;
    act?: Act[];
    /** Record a video for this row even when it has no `act`. */
    video?: boolean;
    settle: Settle;
    expect: string | ShotExpect;
}
/** A manifest: the plan of one report. */
interface Manifest {
    title: string;
    /** ISO time of the plan. */
    generated: string;
    /** The spec path, for a spec pass. */
    spec?: string;
    /** The commit range, for a range pass. */
    range?: string;
    /** Intake issue ids, for an issue pass. */
    issues?: string[];
    commits?: string[];
    shots: Shot[];
}

/** What the resolver reads: the plan and the ledger of the report the comments sit on. */
interface ExportContext {
    manifest: Manifest;
    entries: readonly LedgerEntry[];
    /** The crop of each region comment by comment id, from `writeRegionCrops`. */
    crops?: ReadonlyMap<string, RegionCrop>;
}
/** The crop file of one region comment: its path for the task list and its pixel size. */
interface RegionCrop {
    path: string;
    width: number;
    height: number;
}
/** One open comment resolved to its target (spec 2.10). */
interface ResolvedComment {
    id: string;
    kind: Comment['anchor']['kind'];
    /** The file, screen or step the note points at. */
    target: string;
    /** The quoted or located target within it. */
    located: string;
    /** True when the anchor points at a screenshot or video the ledger no longer holds. */
    orphaned: boolean;
    /** The reviewer note, on one line. */
    note: string;
    /** The crop of a region comment, when `ctx.crops` holds one. */
    crop?: RegionCrop;
}
/** Every open comment resolved to its target (spec 2.10). A resolved comment is left out. */
declare function resolveComments(comments: readonly Comment[], ctx: ExportContext): ResolvedComment[];
/**
 * The agent task list of a report's open comments (spec 2.10): one line per open comment naming the
 * target, the located target and the note. The header states the count, so a build agent reads the
 * list and acts on the review.
 */
declare function exportTaskList(comments: readonly Comment[], ctx: ExportContext): string;

/** A running comment server. `close()` stops it. */
interface CommentServer {
    port: number;
    /** `http://127.0.0.1:<port>`. */
    url: string;
    /** The index page URL of the served viewer. */
    indexUrl: string;
    close(): Promise<void>;
}
interface CommentServerOptions {
    /** The report folder, the root of the on-disk assets. */
    reportDir: string;
    /** The viewer bundle folder, relative to `reportDir`, posix, for example `dist/<slug>-viewer`. */
    viewerDir: string;
    slug: string;
    store: CommentStore;
    /** Renders the bundle pages for a set of comments. The server calls it fresh on each page request. */
    renderPages: (comments: readonly Comment[]) => Map<string, string>;
    /** The port on 127.0.0.1. Default 0: a free port. */
    port?: number;
    host?: string;
    /** The clock of `createdAt`. Default `systemClock`. */
    clock?: Clock;
}
/** Starts the comment server on 127.0.0.1. Rejects with `qa.comment.listen` when the port is taken. */
declare function startCommentServer(opts: CommentServerOptions): Promise<CommentServer>;

/** The dimensions of the rubric (spec 2.11). The key of a dimension in the weights and the result. */
type ScoreDimension = 'findings' | 'console' | 'coverage' | 'evidence' | 'accessibility' | 'performance';
/** Findings counted by severity. A missing level counts as zero. */
interface SeverityCounts {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
}
/** The per-dimension inputs. A dimension left out is not tested and drops from the average. */
interface ScoreInput {
    /** Correctness findings by severity. */
    findings?: SeverityCounts;
    /** The count of console and page errors the run saw. */
    consoleErrors?: number;
    /** The share of declared states shot at live or mounted, as a fraction 0..1. */
    coverage?: number;
    /** The share of planned steps with real evidence and no blank, as a fraction 0..1. */
    evidence?: number;
    /** Accessibility findings by severity. */
    accessibility?: SeverityCounts;
    /** Performance findings by severity. */
    performance?: SeverityCounts;
}
/** A weight per dimension. The default is tunable through the `weights` argument of `computeScore`. */
type ScoreWeights = Record<ScoreDimension, number>;
/** The default weights (spec 2.11). They start from gstack's split and a consumer overrides them. */
declare const DEFAULT_SCORE_WEIGHTS: ScoreWeights;
/** The deduction per finding of a start-at-100 dimension (spec 2.11). */
declare const SEVERITY_DEDUCTION: {
    readonly critical: 25;
    readonly high: 15;
    readonly medium: 8;
    readonly low: 3;
};
/** The result of `computeScore`. */
interface ScoreResult {
    /** The weighted 0..100 integer over the tested dimensions. */
    score: number;
    /** Each tested dimension with its 0..100 score. An untested dimension is absent. */
    dimensions: Partial<Record<ScoreDimension, number>>;
    /** 0..1, the lower of the tested coverage and evidence fractions. Zero when neither is tested. */
    confidence: number;
}
/**
 * The 0-100 score (spec 2.11). Each dimension scores 0..100, and the result is the weighted average
 * over the dimensions the input tested: `Σ (score × weight) / Σ tested weights`, 0.5 rounded up.
 * `weights` overrides any of the default weights.
 */
declare function computeScore(input: ScoreInput, weights?: Partial<ScoreWeights>): ScoreResult;
/** Options for `renderScoreGauge`. The ring colour is a configuration value, not a fixed purple (spec 2.11). */
interface GaugeOptions {
    /** The ring colour. Default: a neutral accent the consumer overrides. */
    color?: string;
    /** The track colour behind the ring. */
    track?: string;
    /** The square SVG size in pixels. Default 160. */
    size?: number;
    /** A short label under the number, for example a confidence word. */
    label?: string;
}
/**
 * A circular gauge for the score, as a self-contained inline SVG string. The arc length is the score
 * over 100, the number sits in the centre, and the ring uses `opts.color` with a neutral default.
 */
declare function renderScoreGauge(score: number, opts?: GaugeOptions): string;

/**
 * Every registered target. `extra` adds targets or replaces a built-in one, for example a fake
 * with scripted routes. The registry key is the name a leg's `target` field uses. The built-in
 * targets read no key of `_config`; the parameter stays for the callers of the earlier signature.
 */
declare function createTargetRegistry(_config: QaConfig, extra?: Record<string, QaTarget>, clock?: Clock): OpenTargetRegistry;

/** The shortest video that counts as evidence, in seconds (spec 2.11.2). */
declare const MIN_VIDEO_S = 1;

/** The registered `qa.target` drivers: `app.get(QA_TARGETS).get('playwright')`. Extension modules add theirs at boot. */
declare const QA_TARGETS: Token<OpenTargetRegistry>;

export { ANCHOR_KINDS, Act, BOTFATHER, BOT_STORE_DIR, type BotCommand, type BotFatherChat, type BotGetMe, type BotRecord, type BotStore, COMMENTS_DIR, type Comment, type CommentAnchor, type CommentReply, type CommentServer, type CommentServerOptions, type CommentStore, type ConfigureBotOptions, type ConsentGrant, type ConsentGroup, type ConsentManifest, type ConsentRecord, type ConsentStore, type CredentialNeed, DEFAULT_SCORE_WEIGHTS, DELETE_CONFIRM, type DataNeed, type DeadBot, type ExportContext, type FlowAnchor, type GaugeOptions, type GrantChoices, LedgerEntry, Leg, MIN_VIDEO_S, type ManifestInput, type ManifestItem, type NewBot, type NewComment, OpenTargetRegistry, type OutwardNeed, type PlaywrightTargetOptions, QA_TARGETS, QaConfig, QaSubcommand, QaTarget, QaTargetRegistry, type RegionAnchor, type ResolvedComment, SEVERITY_DEDUCTION, type ScoreDimension, type ScoreInput, type ScoreResult, type ScoreWeights, Settle, type SeverityCounts, type StepAnchor, type TextAnchor, type TimeAnchor, type UserbotLease, type UserbotProvider, addComment, botIdOf, commentsFile, computeManifest, computeScore, configureBot, createPlaywrightTarget, createStatesCommand, createTargetRegistry, destroyBot, diff, exportTaskList, extensionOf, fileBotStore, fileCommentStore, fileConsentStore, grant, makeComment, manifestHash, mimeOfExtension, newBot, parseBotToken, pngSize, qaProvider, renderScoreGauge, replyToComment, resolveComments, setStatus, startCommentServer, validateAnchor };
