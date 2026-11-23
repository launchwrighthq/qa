// Driver kind `qa.intake` (spec 2.15.1): reads raw items from a bug report source. The intake
// submodule writes the items as issue records. A driver only reads: it posts nothing to the source.
import type { Driver } from '../../../kernel/index.mts';
import type { AttachmentKind, QaIssue, RawMedia, SkipReason } from '../../../index.mts';

export type { AttachmentKind, RawMedia, SkipReason };

export const QA_INTAKE_SPEC_VERSION = '1';

/**
 * Capabilities of an intake driver.
 * - `window`: `fetch` honours `since` and `until`.
 * - `cursor`: `fetch` returns a cursor, and a later `fetch` with it reads only newer items.
 * - `follow`: `fetch` with `follow` waits for new items until the signal aborts.
 */
export const QA_INTAKE_CAPABILITIES = ['window', 'cursor', 'follow'] as const;
export type QaIntakeCapability = (typeof QA_INTAKE_CAPABILITIES)[number];

/** A bound in a window: a date, or a message id. */
export type WindowBound = Date | number;

export interface IntakeWindow {
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
export interface RawItem {
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

export interface IntakeBatch {
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
export interface QaIntakeDriver extends Driver {
  readonly source: QaIssue['source'];
  /**
   * Reads the items of `ref` and downloads their media. A file over the size cap is `skipped:
   * too-large`; a file that does not download is `skipped: unreachable`. Rejects with a
   * LaunchwrightError whose code starts with `qa.intake.`.
   */
  fetch(ref: string, window?: IntakeWindow): Promise<IntakeBatch>;
}
