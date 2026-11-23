// The shared shapes of the qa module: legs, acts, settle rules, ledger entries, row results and
// intake issues (spec 2.3, 2.4, 2.11, 2.15). Every part of the module reads them from here.

/** What a leg shows: the web client, the Mini App, or a bot chat (spec 2.3). */
export type Surface = 'web' | 'miniapp' | 'bot';

/** A leg: where a row runs (spec 2.3). Config `qa.legs.<name>` gives every field but `name`. */
export interface Leg {
  name: string;
  surface: Surface;
  /** A `qa.target` driver name: `playwright`, `android-adb`, `ios-webkit`, ... */
  target: string;
  /** A `qa.device.devices` name, for a device target. */
  device?: string;
  /** A Playwright device descriptor name, for example `Pixel 7`. */
  descriptor?: string;
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  userAgent?: string;
  browser?: 'chromium' | 'webkit' | 'firefox';
  /** The bot username a Telegram leg opens. */
  bot?: string;
}

export const ACT_KINDS = ['click', 'type', 'press', 'scroll', 'wait', 'back'] as const;
export type ActKind = (typeof ACT_KINDS)[number];

/** One step of a row. A `wait` needs a `why` (spec 2.4). */
export interface Act {
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
export interface Settle {
  selector?: string;
  artwork?: boolean;
  video?: boolean;
  busy?: boolean;
  timeout?: number;
}

/** How a state was reached (spec 2.5, 2.7). A `forged` state is an inferred seed or a direct row write, and never counts as a live pass. */
export type Provenance = 'live' | 'mounted' | 'intercepted' | 'forged';

/** What an evidence file holds (spec 2.11.1). */
export type EvidenceKind = 'screenshot' | 'step' | 'video' | 'trace' | 'log' | 'ui';

/** One file in `evidence.lock.json` (spec 2.11.3). Only the runner writes it. */
export interface LedgerEntry {
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
export const ROW_FAILURES = ['blank', 'not-booted', 'route-drift', 'blank-video', 'over-budget', 'page-error', 'expect', 'crashed'] as const;
export type RowFailure = (typeof ROW_FAILURES)[number];

/** The result of one row on one leg. `n/a` and `not-run` carry a reason (spec 2.11.1, 2.12.3). */
export interface RowResult {
  row: string;
  leg: string;
  status: 'passed' | 'failed' | 'n/a' | 'not-run';
  reason?: string;
  failures: RowFailure[];
  attempts: number;
  ms: number;
}

/** The computed report status (spec 2.12.2). */
export const REPORT_STATUSES = ['planned', 'passed', 'failed', 'partial'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** One issue record from intake (spec 2.15.1). Records stay in `.lw/qa/intake/<id>/`. */
export interface QaIssue {
  /** `github-<owner>-<repo>-<n>` or `tg-<chat>-<firstMessageId>`. */
  id: string;
  source: 'github' | 'telegram';
  ref: string;
  title: string;
  reportedAt: string;
  reporter: string;
  text: string;
  thread: { at: string; author: string; text: string }[];
  attachments: { kind: 'image' | 'video' | 'voice' | 'file'; path: string; sha256: string; bytes: number; mime: string; from: string }[];
  skipped: { from: string; reason: 'too-large' | 'unreachable' | 'unsupported' }[];
}

export type AttachmentKind = QaIssue['attachments'][number]['kind'];
export type SkipReason = QaIssue['skipped'][number]['reason'];

/** One file that an item carries or links. It holds the bytes, or the reason it has none. */
export interface RawMedia {
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
export const INTAKE_DIR = '.lw/qa/intake';

// --- Fork isolation (spec 2.4, R3) ---

/**
 * A row that needs an isolated single-instance state (spec 2.4). The runner forks the QA database
 * once per `fork` label, arms the group's facts on that fork, and drops the fork after the group.
 * Two rows with two labels get two forks, so each holds the only open giveaway at the same time.
 */
export interface Isolation {
  /** The fork label of the row. Omit it for a row that runs on the shared QA world. */
  fork?: string;
}
