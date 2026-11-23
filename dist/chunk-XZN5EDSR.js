import {
  pairKey
} from "./chunk-3OHR7PBT.js";
import {
  expectText
} from "./chunk-H3DGWSMZ.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/png.mts
import { deflateSync, inflateSync } from "zlib";
var MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];
function pngSize(bytes) {
  if (bytes.length < 24) return null;
  for (let i = 0; i < MAGIC.length; i += 1) if (bytes[i] !== MAGIC[i]) return null;
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}
var CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
function bad(message, cause) {
  return new LaunchwrightError("qa.png.unsupported", `PNG decode: ${message}`, cause === void 0 ? {} : { cause });
}
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
function decodePngRgba(bytes) {
  const size = pngSize(bytes);
  if (!size) throw bad("not a PNG");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let depth = 0;
  let colorType = -1;
  let palette = null;
  const idat = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      depth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw bad("interlaced images are not supported");
    } else if (type === "PLTE") palette = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const channels = CHANNELS[colorType];
  if (channels === void 0) throw bad(`color type ${colorType}`);
  if (!(depth === 8 || depth === 16 && colorType !== 3)) throw bad(`bit depth ${depth} with color type ${colorType}`);
  if (colorType === 3 && !palette) throw bad("a palette image without PLTE");
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch (cause) {
    throw bad("the image data does not inflate", cause);
  }
  const bpp = channels * depth / 8;
  const stride = size.width * bpp;
  if (raw.length < (stride + 1) * size.height) throw bad("the image data is shorter than the header says");
  const rgba = new Uint8Array(size.width * size.height * 4);
  let prev = new Uint8Array(stride);
  let line = new Uint8Array(stride);
  for (let y = 0; y < size.height; y += 1) {
    const offset = y * (stride + 1);
    const filter = raw[offset];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[offset + 1 + x];
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let out;
      if (filter === 0) out = value;
      else if (filter === 1) out = value + a;
      else if (filter === 2) out = value + b;
      else if (filter === 3) out = value + (a + b >> 1);
      else if (filter === 4) out = value + paeth(a, b, c);
      else throw bad(`filter type ${filter} on row ${y}`);
      line[x] = out & 255;
    }
    const sample = (px, ch) => depth === 8 ? line[px * bpp + ch] : line[px * bpp + ch * 2];
    for (let px = 0; px < size.width; px += 1) {
      const o = (y * size.width + px) * 4;
      if (colorType === 3) {
        const i = line[px] * 3;
        rgba[o] = palette[i] ?? 0;
        rgba[o + 1] = palette[i + 1] ?? 0;
        rgba[o + 2] = palette[i + 2] ?? 0;
        rgba[o + 3] = 255;
      } else if (colorType === 0 || colorType === 4) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = sample(px, 0);
        rgba[o + 3] = colorType === 4 ? sample(px, 1) : 255;
      } else {
        rgba[o] = sample(px, 0);
        rgba[o + 1] = sample(px, 1);
        rgba[o + 2] = sample(px, 2);
        rgba[o + 3] = colorType === 6 ? sample(px, 3) : 255;
      }
    }
    [prev, line] = [line, prev];
  }
  return { ...size, rgba };
}
function decodePngLuma(bytes) {
  const { width, height, rgba } = decodePngRgba(bytes);
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i += 1) {
    luma[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return { width, height, luma };
}
function pixelBox(size, rect) {
  const clamp = (v, max) => Math.min(max, Math.max(0, v));
  const left = clamp(Math.round(rect.x * size.width), size.width - 1);
  const top = clamp(Math.round(rect.y * size.height), size.height - 1);
  const right = clamp(Math.round((rect.x + rect.w) * size.width), size.width);
  const bottom = clamp(Math.round((rect.y + rect.h) * size.height), size.height);
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
function cropPng(bytes, rect) {
  const image = decodePngRgba(bytes);
  const box = pixelBox(image, rect);
  const out = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    const from = ((box.top + y) * image.width + box.left) * 4;
    out.set(image.rgba.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return { png: encodePng(box.width, box.height, out), width: box.width, height: box.height };
}
function lumaStdDev(bytes) {
  const { luma } = decodePngLuma(bytes);
  let mean = 0;
  let m2 = 0;
  for (let i = 0; i < luma.length; i += 1) {
    const v = luma[i];
    const delta = v - mean;
    mean += delta / (i + 1);
    m2 += delta * (v - mean);
  }
  return Math.sqrt(m2 / luma.length);
}
function blankFailure(bytes, blankStdDev) {
  return lumaStdDev(bytes) < blankStdDev ? "blank" : null;
}
function encodePng(width, height, rgba) {
  if (rgba.length !== width * height * 4) {
    throw new LaunchwrightError("qa.png.size", `encodePng: ${rgba.length} bytes is not ${width}x${height} RGBA`);
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from(MAGIC), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 4294967295;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// src/services/video.mts
import { execFile } from "child_process";
var BLACKDETECT_FILTER = "blackdetect=d=0.1:pix_th=0.10";
var VIDEO_TOOL_TIMEOUT_MS = 3e5;
function runFile(bin, timeoutMs) {
  return (args) => new Promise((resolve, reject) => {
    execFile(bin, [...args], { maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
      if (error?.killed && error.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        reject(new LaunchwrightError("qa.video.timeout", `${bin} ran past ${timeoutMs} ms and was stopped.`, { cause: error, context: { bin, timeoutMs } }));
        return;
      }
      if (error && typeof error.code !== "number") {
        reject(new LaunchwrightError("qa.video.tool", `Cannot run ${bin}. Install ffmpeg, or check the doctor.`, { cause: error, context: { bin } }));
        return;
      }
      resolve({ code: typeof error?.code === "number" ? error.code : 0, stdout, stderr });
    });
  });
}
function systemVideoTools(bins = {}) {
  const timeoutMs = bins.timeoutMs ?? VIDEO_TOOL_TIMEOUT_MS;
  return { ffprobe: runFile(bins.ffprobe ?? "ffprobe", timeoutMs), ffmpeg: runFile(bins.ffmpeg ?? "ffmpeg", timeoutMs) };
}
function probeArgs(path) {
  return ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path];
}
function blackdetectArgs(path) {
  return ["-hide_banner", "-nostdin", "-i", path, "-vf", BLACKDETECT_FILTER, "-an", "-f", "null", "-"];
}
function parseProbeDuration(stdout) {
  const value = Number.parseFloat(stdout.trim());
  return Number.isFinite(value) && value >= 0 ? value : null;
}
var hms = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s);
function parseBlackdetect(stderr) {
  let blackS = 0;
  for (const m of stderr.matchAll(/black_duration:\s*([\d.]+)/g)) blackS += Number(m[1]);
  const header = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
  let durationS = header ? hms(header[1], header[2], header[3]) : null;
  if (durationS === null) {
    const times = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
    const last = times.at(-1);
    if (last) durationS = hms(last[1], last[2], last[3]);
  }
  return { blackS, durationS };
}
async function measureVideo(path, tools) {
  const probe = await tools.ffprobe(probeArgs(path));
  const decoded = await tools.ffmpeg(blackdetectArgs(path));
  if (decoded.code !== 0) {
    throw new LaunchwrightError("qa.video.measure", `ffmpeg cannot decode ${path} (exit ${decoded.code})`, {
      context: { path, stderr: decoded.stderr.slice(-2e3) }
    });
  }
  const black = parseBlackdetect(decoded.stderr);
  const durationS = (probe.code === 0 ? parseProbeDuration(probe.stdout) : null) ?? black.durationS;
  if (durationS === null) {
    throw new LaunchwrightError("qa.video.measure", `Neither ffprobe nor ffmpeg gives a duration for ${path}`, { context: { path } });
  }
  return { durationS, blackS: black.blackS };
}
var MIN_VIDEO_S = 1;
function videoFailures(m, evidence) {
  const out = [];
  if (m.durationS < MIN_VIDEO_S || m.blackS / m.durationS > evidence.blackRatio) out.push("blank-video");
  if (m.durationS > evidence.videoCapS) out.push("over-budget");
  return out;
}

// src/services/evidence.mts
var EVIDENCE_START = "<!-- qa:evidence:start -->";
var EVIDENCE_END = "<!-- qa:evidence:end -->";
var COVERAGE_START = "<!-- qa:coverage:start -->";
var COVERAGE_END = "<!-- qa:coverage:end -->";
function isBootFailure(text, sentences) {
  const body = text.trim();
  if (body === "") return true;
  return sentences.some((s) => s.trim() !== "" && (body === s.trim() || body.startsWith(s.trim())));
}
var trimSlash = (p) => p.length > 1 ? p.replace(/\/+$/, "") : p;
function routeHeld(requested, landedPath, base = "", locale) {
  const want = trimSlash(requested.split("?")[0] ?? "") || "/";
  let got = trimSlash(landedPath.split("?")[0] ?? "") || "/";
  if (base !== "" && (got === base || got.startsWith(`${base}/`))) got = trimSlash(got.slice(base.length)) || "/";
  if (got === want) return true;
  if (!locale) return false;
  return (trimSlash(got.replace(locale, "")) || "/") === want;
}
function unexpectedPageErrors(lines, expected) {
  return lines.filter((l) => l.kind === "page-error" && !expected.some((e) => l.text.includes(e)));
}
function attemptFailures(facts, evidence) {
  const out = /* @__PURE__ */ new Set();
  for (const png of facts.screenshots ?? []) if (blankFailure(png, evidence.blankStdDev)) out.add("blank");
  if (facts.page && isBootFailure(facts.page.text, facts.page.bootFailureSentences)) out.add("not-booted");
  if (facts.route && !routeHeld(facts.route.requested, facts.route.landedPath, facts.route.base, facts.route.locale)) out.add("route-drift");
  for (const v of facts.videos ?? []) for (const f of videoFailures(v, evidence)) out.add(f);
  if (unexpectedPageErrors(facts.logs ?? [], facts.expectedPageErrors ?? []).length > 0) out.add("page-error");
  const order = ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error"];
  return order.filter((f) => out.has(f));
}
var KIND_ORDER = { screenshot: 0, step: 1, video: 2, trace: 3, log: 4, ui: 5 };
var STILL = /* @__PURE__ */ new Set(["screenshot", "step"]);
var LINKED = { trace: "trace", log: "log", ui: "UI dump" };
var PER_ROW = 2;
function naturalCompare(a, b) {
  const pa = a.split(/(\d+)/);
  const pb = b.split(/(\d+)/);
  for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    if (i % 2 === 1) return Number(x) - Number(y) || (x < y ? -1 : 1);
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}
function compareEntries(a, b) {
  return a.attempt - b.attempt || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || naturalCompare(a.path, b.path);
}
function cell(text) {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[/g, "&#91;").replace(/\]/g, "&#93;").trim();
}
var altText = (text) => cell(text).replace(/[[\]]/g, "");
function provenanceLabel(provenance) {
  return provenance === "live" ? "" : ` (${provenance})`;
}
function stepOf(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? m[1] : null;
}
function caption(e, showAttempt, extra = "") {
  const device = e.device ? ` (${e.device})` : "";
  const step = e.kind === "step" ? `, step ${stepOf(e.path) ?? "?"}` : "";
  const video = e.kind === "video" ? ", video" : "";
  const attempt = showAttempt ? `, attempt ${e.attempt}` : "";
  return cell(`${e.leg} on ${e.target}${device}${step}${video}${attempt}${extra}${provenanceLabel(e.provenance)}`);
}
function embed(e, shot) {
  const what = shot ? `${shot.screen} ${shot.state}` : e.row;
  const step = e.kind === "step" ? ` step ${stepOf(e.path) ?? "?"}` : "";
  return `![${altText(`${e.leg} ${what}${step}${e.kind === "video" ? " video" : ""}`)}](${e.path})`;
}
function resultText(r) {
  if (!r) return "no result";
  const attempts = `${r.attempts} attempt${r.attempts === 1 ? "" : "s"}`;
  const reason = r.reason ? `: ${cell(r.reason)}` : "";
  if (r.status === "passed") return `passed, ${attempts}`;
  if (r.status === "failed") return `failed (${r.failures.join(", ") || "no failure named"}), ${attempts}${reason}`;
  return `${r.status === "n/a" ? "n/a" : "not run"}${reason}`;
}
function rowFiles(entries, shot, sizeOf, multiAttempt) {
  const out = [];
  const portraits = [];
  const links = [];
  for (const e of entries) {
    const showAttempt = multiAttempt.has(pairKey(e.row, e.leg));
    if (STILL.has(e.kind)) {
      const size = sizeOf(e.path);
      if (size && size.width <= size.height) {
        portraits.push(e);
        continue;
      }
      out.push(caption(e, showAttempt, size ? "" : ", shape unknown"), "", embed(e, shot), "");
    } else if (e.kind === "video") {
      out.push(caption(e, showAttempt), "", embed(e, shot), "");
    } else {
      links.push(e);
    }
  }
  for (let i = 0; i < portraits.length; i += PER_ROW) {
    const group = portraits.slice(i, i + PER_ROW);
    const heads = [];
    const cells = [];
    for (let j = 0; j < PER_ROW; j += 1) {
      const e = group[j];
      heads.push(e ? caption(e, multiAttempt.has(pairKey(e.row, e.leg))) : "");
      cells.push(e ? embed(e, shot) : "");
    }
    out.push(`| ${heads.join(" | ")} |`, `|${"---|".repeat(PER_ROW)}`, `| ${cells.join(" | ")} |`, "");
  }
  if (links.length > 0) {
    const items = links.map((e) => {
      const attempt = multiAttempt.has(pairKey(e.row, e.leg)) ? ` attempt ${e.attempt}` : "";
      return `[${altText(`${e.leg} ${LINKED[e.kind] ?? e.kind}${attempt}`)}](${e.path})`;
    });
    out.push(`Files: ${items.join(", ")}.`, "");
  }
  return out;
}
function plannedPairs(manifest) {
  return manifest.shots.flatMap((shot) => shot.legs.map((leg) => ({ shot, leg })));
}
function evidenceSection(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const multiAttempt = /* @__PURE__ */ new Set();
  for (const e of input.entries) if (e.attempt > 1) multiAttempt.add(pairKey(e.row, e.leg));
  for (const r of latest.values()) if (r.attempts > 1) multiAttempt.add(pairKey(r.row, r.leg));
  const out = [
    "The runner writes this part from the ledger. `lw qa report check` renders it again and refuses an edit.",
    "A label in parentheses names a provenance other than live.",
    ""
  ];
  const counts = { passed: 0, failed: 0, na: 0, notRun: 0, none: 0 };
  const planned = /* @__PURE__ */ new Set();
  for (const shot of input.manifest.shots) {
    out.push(`### ${cell(shot.screen)}, ${cell(shot.state)}`, "");
    out.push(`Row \`${shot.id}\`. Route \`${cell(shot.route).replace(/`/g, "%60")}\`. Expect: ${cell(expectText(shot))}`, "");
    for (const leg of shot.legs) {
      planned.add(pairKey(shot.id, leg));
      const r = latest.get(pairKey(shot.id, leg));
      if (!r) counts.none += 1;
      else if (r.status === "passed") counts.passed += 1;
      else if (r.status === "failed") counts.failed += 1;
      else if (r.status === "n/a") counts.na += 1;
      else counts.notRun += 1;
      out.push(`- \`${leg}\`: ${resultText(r)}`);
    }
    out.push("");
    const files = input.entries.filter((e) => e.row === shot.id && shot.legs.includes(e.leg)).sort((a, b) => shot.legs.indexOf(a.leg) - shot.legs.indexOf(b.leg) || compareEntries(a, b));
    out.push(...rowFiles(files, shot, input.sizeOf, multiAttempt));
  }
  const outside = input.entries.filter((e) => !planned.has(pairKey(e.row, e.leg))).sort((a, b) => naturalCompare(a.row, b.row) || naturalCompare(a.leg, b.leg) || compareEntries(a, b));
  if (outside.length > 0) {
    out.push("### Files outside the plan", "", "These ledger files belong to no planned row and leg.", "");
    out.push(...rowFiles(outside, null, input.sizeOf, multiAttempt));
  }
  const pairs = counts.passed + counts.failed + counts.na + counts.notRun + counts.none;
  out.push(
    `Totals: ${input.manifest.shots.length} rows, ${pairs} row legs, ${counts.passed} passed, ${counts.failed} failed, ${counts.na} n/a, ${counts.notRun} not run, ${counts.none} with no result.`
  );
  return out.join("\n");
}
var NOT_COVERED_LINE = /^- `([a-z0-9-]+\.[a-z0-9-]+)` on `([a-z0-9-]+)`: (.*\S.*)$/;
function coverageSection(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const out = [];
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const r = latest.get(pairKey(shot.id, leg));
    if (r && r.status !== "passed") out.push(`- \`${shot.id}\` on \`${leg}\`: ${resultText(r)}`);
  }
  const world = input.world ?? [];
  if (world.length > 0) {
    const covered = coveredStates(input);
    const open = world.filter((w) => !covered.has(w.id));
    if (out.length > 0) out.push("");
    out.push(`${world.length - open.length} of ${world.length} world states have a passed row with evidence.`);
    if (open.length > 0) {
      out.push("", "| State | Feature | Why it has no evidence |", "|---|---|---|");
      for (const w of open) {
        const named = input.manifest.shots.some((s) => s.fixture.persona === w.id || (s.fixture.facts ?? []).includes(w.id));
        out.push(`| \`${w.id}\` | ${cell(w.feature ?? "")} | ${named ? "a row names it and no leg passed" : "no row names it"} |`);
      }
    }
  }
  if (out.length === 0) out.push("Every planned row and leg ran and passed.");
  return out.join("\n");
}
function coveredStates(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const out = /* @__PURE__ */ new Set();
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const key = pairKey(shot.id, leg);
    if (latest.get(key)?.status !== "passed" || !withFiles.has(key)) continue;
    if (shot.fixture.persona) out.add(shot.fixture.persona);
    for (const f of shot.fixture.facts ?? []) out.add(f);
  }
  return out;
}
function legsLine(manifest, results) {
  const legs = [];
  for (const shot of manifest.shots) for (const leg of shot.legs) if (!legs.includes(leg)) legs.push(leg);
  const latest = /* @__PURE__ */ new Map();
  for (const r of results) latest.set(pairKey(r.row, r.leg), r);
  const ran = [];
  const not = [];
  for (const leg of legs) {
    const rs = manifest.shots.filter((s) => s.legs.includes(leg)).map((s) => latest.get(pairKey(s.id, leg)));
    if (rs.some((r) => r?.status === "passed" || r?.status === "failed")) ran.push(leg);
    else {
      const reason = rs.find((r) => r?.reason)?.reason;
      not.push(`${leg} (${reason ? cell(reason) : rs.every((r) => !r) ? "no result" : "not run"})`);
    }
  }
  return [ran.length > 0 ? ran.join(", ") : "none ran", not.length > 0 ? `not run: ${not.join(", ")}` : ""].filter(Boolean).join("; ");
}
function coverageLine(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const pairs = plannedPairs(input.manifest);
  const passed = pairs.filter(({ shot, leg }) => latest.get(pairKey(shot.id, leg))?.status === "passed" && withFiles.has(pairKey(shot.id, leg))).length;
  const base = `${passed} of ${pairs.length} row legs passed with evidence`;
  const world = input.world ?? [];
  if (world.length === 0) return base;
  const covered = coveredStates(input);
  return `${base}, ${world.filter((w) => covered.has(w.id)).length} of ${world.length} world states`;
}

export {
  pngSize,
  cropPng,
  blankFailure,
  encodePng,
  systemVideoTools,
  measureVideo,
  MIN_VIDEO_S,
  EVIDENCE_START,
  EVIDENCE_END,
  COVERAGE_START,
  COVERAGE_END,
  attemptFailures,
  resultText,
  plannedPairs,
  evidenceSection,
  NOT_COVERED_LINE,
  coverageSection,
  legsLine,
  coverageLine
};
//# sourceMappingURL=chunk-XZN5EDSR.js.map