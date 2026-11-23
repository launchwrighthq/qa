import {
  QA_INTAKE_SPEC_VERSION
} from "./chunk-HJKDKTIX.js";
import {
  BaseDriver,
  LaunchwrightError
} from "./chunk-2ITTLG7O.js";

// src/intake/drivers/intake/fake.mts
var bytes = (head, size) => {
  const out = new Uint8Array(size);
  out.set(Array.from(head, (c) => c.charCodeAt(0) & 255));
  return out;
};
var FAKE_INTAKE_ITEMS = [
  {
    id: "101",
    at: "2026-11-01T10:00:00.000Z",
    author: "Tester One",
    text: "The checkout button does nothing on my phone.",
    media: [{ from: "tg:fake/101", kind: "image", mime: "image/png", name: "screen.png", data: bytes("\x89PNG\r\n\n", 64) }]
  },
  {
    id: "102",
    at: "2026-11-01T10:05:00.000Z",
    author: "Tester One",
    text: "Here is a recording of the tap.",
    media: [{ from: "tg:fake/102", kind: "video", mime: "video/mp4", name: "tap.mp4", data: bytes("\0\0\0ftypmp42", 96) }]
  },
  { id: "103", at: "2026-11-01T10:30:00.000Z", author: "Developer", text: "Which phone model is it?", replyTo: "101", media: [] },
  {
    id: "104",
    at: "2026-11-01T10:40:00.000Z",
    author: "Tester One",
    text: "A mid-range Android phone, the newest system version.",
    replyTo: "103",
    media: [{ from: "tg:fake/104", kind: "voice", mime: "audio/ogg", data: bytes("OggS", 32) }]
  },
  {
    id: "105",
    at: "2026-11-02T08:00:00.000Z",
    author: "Tester Two",
    text: "The profile page shows an empty avatar after an upload.",
    media: [{ from: "tg:fake/105", kind: "file", mime: "application/zip", name: "logs.zip", data: bytes("PK", 4096) }]
  },
  { id: "106", at: "2026-11-02T08:20:00.000Z", author: "Tester Two", text: "It happens on the desktop site too.", media: [] }
];
function after(item, bound) {
  return typeof bound === "number" ? Number(item.id) > bound : Date.parse(item.at) >= bound.getTime();
}
function before(item, bound) {
  return typeof bound === "number" ? Number(item.id) < bound : Date.parse(item.at) < bound.getTime();
}
var FakeIntakeDriver = class extends BaseDriver {
  constructor(opts = {}) {
    super("fake", QA_INTAKE_SPEC_VERSION, ["window", "cursor", "follow"]);
    this.opts = opts;
    this.source = opts.source ?? "telegram";
  }
  opts;
  source;
  /** Every ref that `fetch` read. */
  refs = [];
  async fetch(ref, window = {}) {
    if (ref.trim() === "") throw new LaunchwrightError("qa.intake.ref", "The fake intake driver needs a ref.");
    this.refs.push(ref);
    if (window.follow && !window.signal) {
      throw new LaunchwrightError("qa.intake.follow", "A follow fetch needs an AbortSignal to stop it.");
    }
    const since = window.since ?? (window.cursor !== void 0 ? Number(window.cursor) : void 0);
    const pool = [...this.opts.items ?? FAKE_INTAKE_ITEMS, ...window.follow ? this.opts.arriving ?? [] : []];
    const items = pool.filter((i) => (since === void 0 || after(i, since)) && (window.until === void 0 || before(i, window.until))).map((i) => this.capped(i));
    if (window.follow && window.signal && !window.signal.aborted) {
      const signal = window.signal;
      await new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    }
    const last = items.at(-1)?.id ?? window.cursor;
    return {
      source: this.source,
      ref,
      ...this.opts.title !== void 0 ? { title: this.opts.title } : {},
      items,
      ...last !== void 0 ? { cursor: last } : {}
    };
  }
  capped(item) {
    const max = this.opts.maxBytes ?? Number.POSITIVE_INFINITY;
    const media = item.media.map((m) => {
      if (m.data === void 0 || m.data.byteLength <= max) return { ...m };
      return { from: m.from, kind: m.kind, mime: m.mime, ...m.name !== void 0 ? { name: m.name } : {}, skipped: "too-large" };
    });
    return { ...item, media };
  }
};

export {
  FAKE_INTAKE_ITEMS,
  FakeIntakeDriver
};
//# sourceMappingURL=chunk-F7VPLHGY.js.map