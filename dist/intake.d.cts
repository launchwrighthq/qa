import { z } from 'zod';
import { n as RawMedia, D as Driver, i as QaIssue, B as BaseDriver, s as SkipReason, d as AttachmentKind } from './contract-braBVxB_.cjs';
export { I as IssueDraft, i as issueMarkdown, l as listIssues, r as readIssue, a as recordDir, b as recordId, w as writeIssue } from './records-CuXSKcyI.cjs';
import { P as Provider, Q as QaExtension } from './extensions-DusoVIa8.cjs';
import './app-KXgbRXYO.cjs';
import './config-B-lxHEnb.cjs';

/** Key `qa.intake` of config section `qa`. */
declare const qaIntakeConfig: z.ZodPrefault<z.ZodObject<{
    default: z.ZodDefault<z.ZodString>;
    maxFileMb: z.ZodDefault<z.ZodNumber>;
    drivers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>>;
type IntakeConfig = z.infer<typeof qaIntakeConfig>;

declare const QA_INTAKE_SPEC_VERSION = "1";
/**
 * Capabilities of an intake driver.
 * - `window`: `fetch` honours `since` and `until`.
 * - `cursor`: `fetch` returns a cursor, and a later `fetch` with it reads only newer items.
 * - `follow`: `fetch` with `follow` waits for new items until the signal aborts.
 */
declare const QA_INTAKE_CAPABILITIES: readonly ["window", "cursor", "follow"];
type QaIntakeCapability = (typeof QA_INTAKE_CAPABILITIES)[number];
/** A bound in a window: a date, or a message id. */
type WindowBound = Date | number;
interface IntakeWindow {
    /** Only items after this date, or with a greater message id. */
    since?: WindowBound;
    /** Only items before this date, or with a smaller message id. */
    until?: WindowBound;
    /** The cursor of an earlier `fetch` of the same driver and ref. `since` wins over it. */
    cursor?: string;
    /** Wait for new items until `signal` aborts. Needs the `follow` capability. */
    follow?: boolean;
    /** Stops a following fetch. The fetch then resolves with the items it has. */
    signal?: AbortSignal;
}
/** One message, issue body or comment. */
interface RawItem {
    /** The id at the source: a message id, `body`, or a comment id. */
    id: string;
    /** ISO time. */
    at: string;
    /** The author as the source shows it. Stays local. */
    author: string;
    text: string;
    /** The id of the item that this one answers (a Telegram reply). */
    replyTo?: string;
    media: RawMedia[];
}
interface IntakeBatch {
    source: QaIssue['source'];
    /** The normalized ref: the issue URL or the chat id. */
    ref: string;
    /** The issue title, for a source that has one. */
    title?: string;
    /** Items in time order. */
    items: RawItem[];
    /** Give it back in `IntakeWindow.cursor` to read only newer items. Needs the `cursor` capability. */
    cursor?: string;
}
/** Reads one ref: an issue URL or a chat id (spec 2.15). */
interface QaIntakeDriver extends Driver {
    readonly source: QaIssue['source'];
    /**
     * Reads the items of `ref` and downloads their media. A file over the size cap is `skipped:
     * too-large`; a file that does not download is `skipped: unreachable`. Rejects with a
     * LaunchwrightError whose code starts with `qa.intake.`.
     */
    fetch(ref: string, window?: IntakeWindow): Promise<IntakeBatch>;
}

interface FakeIntakeOptions {
    source?: 'github' | 'telegram';
    /** The history. Default: `FAKE_INTAKE_ITEMS`. Ids are message numbers. */
    items?: RawItem[];
    /** Items that arrive while a `follow` fetch waits. */
    arriving?: RawItem[];
    title?: string;
    /** The size cap of one file, in bytes. Default: no cap. */
    maxBytes?: number;
}
/** Six chat messages: two reply chains, one author burst, an image, a video, a voice note and a large file. */
declare const FAKE_INTAKE_ITEMS: RawItem[];
declare class FakeIntakeDriver extends BaseDriver implements QaIntakeDriver {
    private readonly opts;
    readonly source: 'github' | 'telegram';
    /** Every ref that `fetch` read. */
    readonly refs: string[];
    constructor(opts?: FakeIntakeOptions);
    fetch(ref: string, window?: IntakeWindow): Promise<IntakeBatch>;
    private capped;
}

interface GhResult {
    code: number;
    stdout: string;
    stderr: string;
}
/** Runs `gh <args>` and returns its exit code and output. */
type GhRunner = (args: string[]) => Promise<GhResult>;

/** True when the URL is a GitHub upload: `github.com/user-attachments/...` or a user-images host. */
declare function isGithubUpload(url: URL): boolean;
/**
 * True when the token of the `gh` login may go to this URL: a GitHub upload over https. Issue text
 * is not trusted, so the token goes to no other GitHub URL.
 */
declare function takesGithubToken(url: URL): boolean;
/**
 * True when intake may download from this URL: https to a GitHub upload, a `githubusercontent.com`
 * host or the asset store an upload redirects to. Any other link in issue text is skipped, so a
 * reporter cannot point the operator's machine at a local or private address.
 */
declare function isGithubMediaHost(url: URL): boolean;
/**
 * The media links of a Markdown text, in order and without repeats: every GitHub upload link,
 * every Markdown image, every `<img>` and `<video>` source, and every bare link to an image or
 * video file.
 */
declare function mediaLinks(markdown: string): string[];

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
/** The attachment kind of a media type. `voice` comes only from a source that marks a voice note. */
declare function kindOf(mime: string, voice?: boolean): AttachmentKind;
/** The media type that the first bytes show, or null. */
declare function sniffMime(data: Uint8Array): string | null;
/** The media type of a download: the header, unless it is generic and the bytes say more. */
declare function mimeOf(header: string | null, data: Uint8Array, name?: string): string;
type Download = {
    data: Uint8Array;
    mime: string;
} | {
    skipped: SkipReason;
};
interface DownloadOptions {
    fetch: FetchFn;
    maxBytes: number;
    /** Headers for a URL. A redirect to another host asks again, so a token stays on its host. */
    headersFor?: (url: URL) => Record<string, string>;
    name?: string;
    /** At most this many redirects. Default 5. */
    maxRedirects?: number;
    /** The URLs that may be fetched, checked at every hop. A refused URL is `unsupported`. Default: any. */
    allow?: (url: URL) => boolean;
}
/**
 * Downloads one URL with a size cap. It follows redirects itself, so each hop gets only its own
 * headers. A failed request, an error status or an HTML page is `unreachable`; a body over the
 * cap is `too-large`. A bad URL throws `qa.intake.url`.
 */
declare function download(url: string, opts: DownloadOptions): Promise<Download>;

/**
 * Checks key `qa.intake` of config section `qa` at boot. A bad key fails with
 * `qa.intake.config`, which names each issue. The drivers load on first use in `lw qa intake`.
 */
declare const qaIntakeProvider: Provider;

declare const qaExtension: QaExtension;

/** The part of a GramJS client that this wrapper uses. */
interface GramJsClient {
    connect(): Promise<unknown>;
    disconnect(): Promise<unknown>;
    getMe(): Promise<unknown>;
    sendMessage(peer: unknown, params: {
        message: string;
    }): Promise<unknown>;
    /** GramJS `getMessages`: history with `limit`, `minId`, `maxId`, `offsetDate`, `reverse`, or `ids`. */
    getMessages(peer: unknown, params: Record<string, unknown>): Promise<unknown[]>;
    /** GramJS `downloadMedia`: the bytes of the media of a message. */
    downloadMedia(message: unknown, params?: Record<string, unknown>): Promise<unknown>;
    invoke(request: unknown): Promise<unknown>;
    session: {
        save(): unknown;
    };
}
/** The part of the GramJS package that this wrapper uses. */
interface GramJsModule {
    TelegramClient: new (session: unknown, apiId: number, apiHash: string, opts: Record<string, unknown>) => GramJsClient;
    StringSession: new (session: string) => unknown;
}

declare const INTAKE_DRIVERS: readonly ["github", "telegram-mtproto", "telegram-bot", "fake"];
type IntakeDriverName = (typeof INTAKE_DRIVERS)[number];
/** What a driver may get instead of the real thing. Tests pass recorded runners and fetches. */
interface IntakeDeps {
    gh?: GhRunner;
    fetch?: FetchFn;
    loadGramJs?: () => Promise<GramJsModule>;
    /** Ready drivers by name. They win over config. */
    drivers?: Partial<Record<string, QaIntakeDriver>>;
}
/** `qa.intake.maxFileMb` in bytes. */
declare function maxBytesOf(intake: IntakeConfig): number;
/** The driver `name`, built from `qa.intake.drivers.<name>`. An unknown name fails `qa.intake.driver`. */
declare function createIntakeDriver(name: string, intake: IntakeConfig, deps?: IntakeDeps): Promise<QaIntakeDriver>;

/** Messages of one author less than this far apart join one group. */
declare const JOIN_GAP_MS: number;
/** A staged media: the media without its bytes, and the file that holds them. */
type StoredMedia = Omit<RawMedia, 'data'> & {
    file?: string;
};
type StoredMessage = Omit<RawItem, 'media'> & {
    media: StoredMedia[];
};
interface Group {
    title: string;
    /** Message ids, the first message first. */
    messages: string[];
}
/** The staging folder of one chat. */
declare function chatDir(root: string, chat: string): string;
/** The cursor file of one chat: `.lw/qa/intake/telegram/<chat>.cursor`. */
declare function cursorFile(root: string, chat: string): string;
/** The cursor of a driver for a chat, or undefined. */
declare function readCursor(root: string, chat: string, driver: string): Promise<string | undefined>;
declare function writeCursor(root: string, chat: string, driver: string, cursor: string): Promise<void>;
/** The staged messages of a chat, oldest first. */
declare function readMessages(root: string, chat: string): Promise<StoredMessage[]>;
/** Adds the items of a batch to the staged messages of the chat. A message read again replaces the old copy. */
declare function stageBatch(root: string, chat: string, batch: IntakeBatch): Promise<StoredMessage[]>;
/**
 * Proposes one group per reply chain, and joins messages of one author less than 15 minutes
 * apart. The title names the chat and the first message, so no chat text reaches a listing.
 */
declare function proposeGroups(chat: string, messages: Pick<StoredMessage, 'id' | 'at' | 'author' | 'replyTo'>[]): Group[];
/** Writes `groups.proposed.json` and returns its path. */
declare function writeProposal(root: string, chat: string, groups: Group[]): Promise<string>;
/** Reads `groups.json`, which the agent writes after the review. */
declare function readGroups(root: string, chat: string): Promise<Group[]>;
/** Writes one issue record per group of `groups.json`. An unknown message id fails `qa.intake.telegram.groups`. */
declare function applyGroups(root: string, chat: string): Promise<QaIssue[]>;

export { AttachmentKind, FAKE_INTAKE_ITEMS, FakeIntakeDriver, type FakeIntakeOptions, type FetchFn, type GhResult, type GhRunner, type Group, INTAKE_DRIVERS, type IntakeBatch, type IntakeConfig, type IntakeDeps, type IntakeDriverName, type IntakeWindow, JOIN_GAP_MS, QA_INTAKE_CAPABILITIES, QA_INTAKE_SPEC_VERSION, type QaIntakeCapability, type QaIntakeDriver, type RawItem, RawMedia, SkipReason, type StoredMedia, type StoredMessage, type WindowBound, applyGroups, chatDir, createIntakeDriver, cursorFile, download, isGithubMediaHost, isGithubUpload, kindOf, maxBytesOf, mediaLinks, mimeOf, proposeGroups, qaExtension, qaIntakeConfig, qaIntakeProvider, readCursor, readGroups, readMessages, sniffMime, stageBatch, takesGithubToken, writeCursor, writeProposal };
