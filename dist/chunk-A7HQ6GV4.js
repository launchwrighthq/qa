import {
  mimeOfExtension
} from "./chunk-YAQ4D7JV.js";
import {
  LaunchwrightError
} from "./chunk-2ITTLG7O.js";

// src/intake/services/media.mts
function kindOf(mime, voice = false) {
  if (voice) return "voice";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
function ascii(data, from, to) {
  return String.fromCharCode(...data.subarray(from, to));
}
function sniffMime(data) {
  if (data.length >= 8 && data[0] === 137 && ascii(data, 1, 4) === "PNG") return "image/png";
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (ascii(data, 0, 4) === "GIF8") return "image/gif";
  if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 12) === "WEBP") return "image/webp";
  if (ascii(data, 4, 8) === "ftyp") return ascii(data, 8, 10) === "qt" ? "video/quicktime" : "video/mp4";
  if (data.length >= 4 && data[0] === 26 && data[1] === 69 && data[2] === 223 && data[3] === 163) return "video/webm";
  if (ascii(data, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(data, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}
function mimeOf(header, data, name) {
  const declared = (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared !== "" && declared !== "application/octet-stream" && declared !== "binary/octet-stream") return declared;
  return sniffMime(data) ?? (name ? mimeOfExtension(name) : null) ?? "application/octet-stream";
}
function sourceOf(url) {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}
async function readCapped(res, maxBytes) {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (; ; ) {
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
async function download(url, opts) {
  let at;
  try {
    at = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("qa.intake.url", "An intake media link is not a URL.", { cause });
  }
  const max = opts.maxRedirects ?? 5;
  for (let hop = 0; hop <= max; hop++) {
    if (at.protocol !== "https:" && at.protocol !== "http:") return { skipped: "unsupported" };
    if (opts.allow && !opts.allow(at)) return { skipped: "unsupported" };
    let res;
    try {
      res = await opts.fetch(at.href, { method: "GET", redirect: "manual", headers: opts.headersFor?.(at) ?? {} });
    } catch (cause) {
      if (cause instanceof TypeError) return { skipped: "unreachable" };
      throw cause;
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) return { skipped: "unreachable" };
      at = new URL(location, at);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      return { skipped: "unreachable" };
    }
    const length = Number(res.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(length) && length > opts.maxBytes) {
      await res.body?.cancel();
      return { skipped: "too-large" };
    }
    const data = await readCapped(res, opts.maxBytes);
    if (data === null) return { skipped: "too-large" };
    const mime = mimeOf(res.headers.get("content-type"), data, opts.name ?? at.pathname);
    if (mime === "text/html") return { skipped: "unreachable" };
    return { data, mime };
  }
  return { skipped: "unreachable" };
}

export {
  kindOf,
  sniffMime,
  mimeOf,
  sourceOf,
  download
};
//# sourceMappingURL=chunk-A7HQ6GV4.js.map