// Media helpers of intake: the attachment kind of a media type, a media type from the first bytes,
// and a download with a size cap.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { mimeOfExtension } from '@launchwrighthq/qa';
import type { AttachmentKind, SkipReason } from '../drivers/intake/contract.mts';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** The attachment kind of a media type. `voice` comes only from a source that marks a voice note. */
export function kindOf(mime: string, voice = false): AttachmentKind {
  if (voice) return 'voice';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

function ascii(data: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...data.subarray(from, to));
}

/** The media type that the first bytes show, or null. */
export function sniffMime(data: Uint8Array): string | null {
  if (data.length >= 8 && data[0] === 0x89 && ascii(data, 1, 4) === 'PNG') return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (ascii(data, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(data, 4, 8) === 'ftyp') return ascii(data, 8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
  if (data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return 'video/webm';
  if (ascii(data, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(data, 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

/** The media type of a download: the header, unless it is generic and the bytes say more. */
export function mimeOf(header: string | null, data: Uint8Array, name?: string): string {
  const declared = (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (declared !== '' && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream') return declared;
  return sniffMime(data) ?? (name ? mimeOfExtension(name) : null) ?? 'application/octet-stream';
}

/** A URL without its query and fragment: a signed URL keeps its signature out of a record. */
export function sourceOf(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}

export type Download = { data: Uint8Array; mime: string } | { skipped: SkipReason };

export interface DownloadOptions {
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

/** Reads a body, and stops when it passes `maxBytes`. Returns null then. */
async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/**
 * Downloads one URL with a size cap. It follows redirects itself, so each hop gets only its own
 * headers. A failed request, an error status or an HTML page is `unreachable`; a body over the
 * cap is `too-large`. A bad URL throws `qa.intake.url`.
 */
export async function download(url: string, opts: DownloadOptions): Promise<Download> {
  let at: URL;
  try {
    at = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError('qa.intake.url', 'An intake media link is not a URL.', { cause });
  }
  const max = opts.maxRedirects ?? 5;
  for (let hop = 0; hop <= max; hop++) {
    if (at.protocol !== 'https:' && at.protocol !== 'http:') return { skipped: 'unsupported' };
    if (opts.allow && !opts.allow(at)) return { skipped: 'unsupported' };
    let res: Response;
    try {
      res = await opts.fetch(at.href, { method: 'GET', redirect: 'manual', headers: opts.headersFor?.(at) ?? {} });
    } catch (cause) {
      // fetch rejects with a TypeError when the network fails. Any other error is a fault.
      if (cause instanceof TypeError) return { skipped: 'unreachable' };
      throw cause;
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel();
      if (!location) return { skipped: 'unreachable' };
      at = new URL(location, at);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      return { skipped: 'unreachable' };
    }
    const length = Number(res.headers.get('content-length') ?? Number.NaN);
    if (Number.isFinite(length) && length > opts.maxBytes) {
      await res.body?.cancel();
      return { skipped: 'too-large' };
    }
    const data = await readCapped(res, opts.maxBytes);
    if (data === null) return { skipped: 'too-large' };
    const mime = mimeOf(res.headers.get('content-type'), data, opts.name ?? at.pathname);
    if (mime === 'text/html') return { skipped: 'unreachable' };
    return { data, mime };
  }
  return { skipped: 'unreachable' };
}
