// The `fake` intake driver: fixture messages for tests (spec 2.15.3). It reads no network.
import { BaseDriver, LaunchwrightError } from '@launchwrighthq/kernel';
import { type IntakeBatch, type IntakeWindow, QA_INTAKE_SPEC_VERSION, type QaIntakeDriver, type RawItem, type WindowBound } from './contract.mts';

export interface FakeIntakeOptions {
  source?: 'github' | 'telegram';
  /** The history. Default: `FAKE_INTAKE_ITEMS`. Ids are message numbers. */
  items?: RawItem[];
  /** Items that arrive while a `follow` fetch waits. */
  arriving?: RawItem[];
  title?: string;
  /** The size cap of one file, in bytes. Default: no cap. */
  maxBytes?: number;
}

const bytes = (head: string, size: number): Uint8Array => {
  const out = new Uint8Array(size);
  out.set(Array.from(head, (c) => c.charCodeAt(0) & 0xff));
  return out;
};

/** Six chat messages: two reply chains, one author burst, an image, a video, a voice note and a large file. */
export const FAKE_INTAKE_ITEMS: RawItem[] = [
  {
    id: '101',
    at: '2026-11-01T10:00:00.000Z',
    author: 'Tester One',
    text: 'The checkout button does nothing on my phone.',
    media: [{ from: 'tg:fake/101', kind: 'image', mime: 'image/png', name: 'screen.png', data: bytes('\x89PNG\r\n\x1a\n', 64) }],
  },
  {
    id: '102',
    at: '2026-11-01T10:05:00.000Z',
    author: 'Tester One',
    text: 'Here is a recording of the tap.',
    media: [{ from: 'tg:fake/102', kind: 'video', mime: 'video/mp4', name: 'tap.mp4', data: bytes('\0\0\0\x18ftypmp42', 96) }],
  },
  { id: '103', at: '2026-11-01T10:30:00.000Z', author: 'Developer', text: 'Which phone model is it?', replyTo: '101', media: [] },
  {
    id: '104',
    at: '2026-11-01T10:40:00.000Z',
    author: 'Tester One',
    text: 'A mid-range Android phone, the newest system version.',
    replyTo: '103',
    media: [{ from: 'tg:fake/104', kind: 'voice', mime: 'audio/ogg', data: bytes('OggS', 32) }],
  },
  {
    id: '105',
    at: '2026-11-02T08:00:00.000Z',
    author: 'Tester Two',
    text: 'The profile page shows an empty avatar after an upload.',
    media: [{ from: 'tg:fake/105', kind: 'file', mime: 'application/zip', name: 'logs.zip', data: bytes('PK', 4096) }],
  },
  { id: '106', at: '2026-11-02T08:20:00.000Z', author: 'Tester Two', text: 'It happens on the desktop site too.', media: [] },
];

function after(item: RawItem, bound: WindowBound): boolean {
  return typeof bound === 'number' ? Number(item.id) > bound : Date.parse(item.at) >= bound.getTime();
}

function before(item: RawItem, bound: WindowBound): boolean {
  return typeof bound === 'number' ? Number(item.id) < bound : Date.parse(item.at) < bound.getTime();
}

export class FakeIntakeDriver extends BaseDriver implements QaIntakeDriver {
  readonly source: 'github' | 'telegram';
  /** Every ref that `fetch` read. */
  readonly refs: string[] = [];

  constructor(private readonly opts: FakeIntakeOptions = {}) {
    super('fake', QA_INTAKE_SPEC_VERSION, ['window', 'cursor', 'follow']);
    this.source = opts.source ?? 'telegram';
  }

  async fetch(ref: string, window: IntakeWindow = {}): Promise<IntakeBatch> {
    if (ref.trim() === '') throw new LaunchwrightError('qa.intake.ref', 'The fake intake driver needs a ref.');
    this.refs.push(ref);
    if (window.follow && !window.signal) {
      throw new LaunchwrightError('qa.intake.follow', 'A follow fetch needs an AbortSignal to stop it.');
    }
    const since = window.since ?? (window.cursor !== undefined ? Number(window.cursor) : undefined);
    const pool = [...(this.opts.items ?? FAKE_INTAKE_ITEMS), ...(window.follow ? (this.opts.arriving ?? []) : [])];
    const items = pool
      .filter((i) => (since === undefined || after(i, since)) && (window.until === undefined || before(i, window.until)))
      .map((i) => this.capped(i));
    if (window.follow && window.signal && !window.signal.aborted) {
      const signal = window.signal;
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
    }
    const last = items.at(-1)?.id ?? window.cursor;
    return {
      source: this.source,
      ref,
      ...(this.opts.title !== undefined ? { title: this.opts.title } : {}),
      items,
      ...(last !== undefined ? { cursor: last } : {}),
    };
  }

  private capped(item: RawItem): RawItem {
    const max = this.opts.maxBytes ?? Number.POSITIVE_INFINITY;
    const media = item.media.map((m) => {
      if (m.data === undefined || m.data.byteLength <= max) return { ...m };
      return { from: m.from, kind: m.kind, mime: m.mime, ...(m.name !== undefined ? { name: m.name } : {}), skipped: 'too-large' as const };
    });
    return { ...item, media };
  }
}
