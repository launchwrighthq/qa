import {
  mimeOfExtension
} from "./chunk-B7UB2WOJ.js";
import {
  cropPng
} from "./chunk-XZN5EDSR.js";
import {
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/services/comments.mts
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
var COMMENTS_DIR = ".lw/qa/comments";
var ANCHOR_KINDS = ["step", "text", "region", "time", "flow"];
var SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isFraction = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
var isText = (v) => typeof v === "string" && v.trim() !== "";
function validateAnchor(anchor) {
  if (!isObject(anchor)) return ["the anchor is not an object"];
  const kind = anchor.kind;
  if (typeof kind !== "string" || !ANCHOR_KINDS.includes(kind)) {
    return [`kind "${String(kind)}" is not one of ${ANCHOR_KINDS.join(", ")}`];
  }
  const out = [];
  const need = (field, ok, why) => {
    if (!ok) out.push(`${kind} anchor: ${field} ${why}`);
  };
  if (kind === "step") {
    need("row", isText(anchor.row), "is missing");
    need("leg", isText(anchor.leg), "is missing");
    need("attempt", Number.isInteger(anchor.attempt) && anchor.attempt > 0, "must be a positive integer");
    need("step", Number.isInteger(anchor.step) && anchor.step > 0, "must be a positive integer");
  } else if (kind === "text") {
    need("section", isText(anchor.section), "is missing");
    need("quote", isText(anchor.quote), "is missing");
  } else if (kind === "region") {
    need("screenshot", isText(anchor.screenshot), "is missing");
    need("row", isText(anchor.row), "is missing");
    for (const f of ["x", "y", "w", "h"]) need(f, isFraction(anchor[f]), "must be a fraction from 0 to 1");
  } else if (kind === "time") {
    need("video", isText(anchor.video), "is missing");
    need("row", isText(anchor.row), "is missing");
    need("start", typeof anchor.start === "number" && anchor.start >= 0, "must be a number of seconds");
  } else {
    need("name", isText(anchor.name), "is missing");
  }
  return out;
}
function makeComment(input) {
  const problems = validateAnchor(input.anchor);
  if (problems.length > 0) {
    throw new LaunchwrightError("qa.comment.anchor", `The comment anchor is invalid: ${problems.join("; ")}`, { context: { problems } });
  }
  return { id: input.id ?? randomUUID(), anchor: input.anchor, author: input.author, body: input.body, createdAt: input.createdAt, status: "open", replies: [] };
}
function addComment(list, comment) {
  if (list.some((c) => c.id === comment.id)) {
    throw new LaunchwrightError("qa.comment.duplicate", `A comment with id ${comment.id} already exists.`, { context: { id: comment.id } });
  }
  return [...list, comment];
}
function replyToComment(list, id, reply) {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to reply to.`, { context: { id } });
  return list.map((c) => c.id === id ? { ...c, replies: [...c.replies, reply] } : c);
}
function setStatus(list, id, status) {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to update.`, { context: { id } });
  return list.map((c) => c.id === id ? { ...c, status } : c);
}
function commentsFile(dir, slug) {
  if (!SLUG.test(slug)) throw new LaunchwrightError("qa.comment.slug", `A report slug is "${slug}", which is not a safe file name.`, { context: { slug } });
  return join(dir, `${slug}.json`);
}
function fileCommentStore(dir) {
  return {
    async read(slug) {
      const text = await readTextOrNull(commentsFile(dir, slug));
      if (text === null) return [];
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug)} is not JSON.`, { cause, context: { slug } });
      }
      if (!isObject(parsed) || !Array.isArray(parsed.comments)) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug)} has no comments array.`, { context: { slug } });
      }
      return parsed.comments;
    },
    async write(slug, comments) {
      const file = commentsFile(dir, slug);
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify({ slug, comments }, null, 2)}
`);
    }
  };
}

// src/services/comment-server.mts
import { createServer } from "http";
import { readFile } from "fs/promises";
import { resolve, sep } from "path";
var MAX_BODY = 1024 * 1024;
var sendJson = (res, status, value) => {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
};
var sendText = (res, status, text) => {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
};
function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes <= MAX_BODY) chunks.push(c);
    });
    req.on("end", () => bytes > MAX_BODY ? fail(new LaunchwrightError("qa.comment.body", "The request body is over 1 MiB.")) : ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
}
async function applyOp(body, store, slug, clock) {
  let op;
  try {
    op = JSON.parse(body || "{}");
  } catch (cause) {
    throw new LaunchwrightError("qa.comment.body", "The POST body is not JSON.", { cause });
  }
  if (typeof op !== "object" || op === null) throw new LaunchwrightError("qa.comment.body", "The POST body is not an object.");
  const req = op;
  const list = await store.read(slug);
  const at = clock.date().toISOString();
  let next;
  if (req.op === "add") {
    const c = req.comment;
    next = addComment(list, makeComment({ anchor: c.anchor, author: String(c.author ?? "reviewer"), body: String(c.body ?? ""), createdAt: at }));
  } else if (req.op === "reply") {
    const r = req.reply;
    next = replyToComment(list, String(req.id), { author: String(r.author ?? "reviewer"), body: String(r.body ?? ""), createdAt: at });
  } else if (req.op === "resolve" || req.op === "reopen") {
    next = setStatus(list, String(req.id), req.op === "resolve" ? "resolved" : "open");
  } else {
    throw new LaunchwrightError("qa.comment.op", `The op "${String(req.op)}" is not add, reply, resolve or reopen.`, { context: { op: req.op } });
  }
  await store.write(slug, next);
  return next;
}
async function serveStatic(res, reportDir, pathname) {
  const target = resolve(reportDir, `.${pathname}`);
  if (target !== reportDir && !target.startsWith(reportDir + sep)) {
    sendText(res, 403, "forbidden");
    return;
  }
  let bytes;
  try {
    bytes = await readFile(target);
  } catch {
    sendText(res, 404, "not found");
    return;
  }
  const mime = mimeOfExtension(target) ?? "application/octet-stream";
  res.writeHead(200, { "content-type": mime, "content-length": bytes.length });
  res.end(bytes);
}
async function handle(req, res, opts, clock) {
  const base = `/${opts.viewerDir}/`;
  const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (pathname === "/" || pathname === base) {
    res.writeHead(302, { location: `${base}index.html` });
    res.end();
    return;
  }
  if (pathname === `${base}comments`) {
    if (req.method === "GET") return sendJson(res, 200, { slug: opts.slug, comments: await opts.store.read(opts.slug) });
    if (req.method === "POST") return sendJson(res, 200, { slug: opts.slug, comments: await applyOp(await readBody(req), opts.store, opts.slug, clock) });
    return sendText(res, 405, "method not allowed");
  }
  if (pathname.startsWith(base)) {
    const name = pathname.slice(base.length);
    const page = opts.renderPages(await opts.store.read(opts.slug)).get(name);
    if (page !== void 0) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
  }
  await serveStatic(res, opts.reportDir, pathname);
}
async function startCommentServer(opts) {
  const host = opts.host ?? "127.0.0.1";
  const clock = opts.clock ?? systemClock;
  const reportDir = resolve(opts.reportDir);
  const server = createServer((req, res) => {
    void handle(req, res, { ...opts, reportDir }, clock).catch((cause) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const code = isCodedError(cause) ? cause.code : "qa.comment.server";
      sendJson(res, 400, { error: code });
    });
  });
  await new Promise((ok, fail) => {
    server.once("error", (cause) => fail(new LaunchwrightError("qa.comment.listen", `The comment server cannot listen on ${host}:${opts.port ?? 0}: ${cause.message}`, { cause })));
    server.listen(opts.port ?? 0, host, ok);
  });
  const port = server.address().port;
  const url = `http://${host}:${port}`;
  return {
    port,
    url,
    indexUrl: `${url}/${opts.viewerDir}/index.html`,
    async close() {
      server.closeAllConnections();
      await new Promise((ok, fail) => server.close((err) => err ? fail(err) : ok()));
    }
  };
}

// src/services/comment-export.mts
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import { join as join2, relative } from "path";
var oneLine = (text) => text.replace(/\s+/g, " ").trim();
var shotOf = (manifest, row) => manifest.shots.find((s) => s.id === row);
var screenState = (shot) => shot ? `${shot.screen} ${shot.state}` : "";
var inLedger = (entries, path) => entries.some((e) => e.path === path);
function stepOfPath(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? Number(m[1]) : null;
}
function stepScreenshot(entries, row, leg, attempt, step) {
  const stepShot = entries.find((e) => e.kind === "step" && e.row === row && e.leg === leg && e.attempt === attempt && stepOfPath(e.path) === step);
  if (stepShot) return stepShot.path;
  return entries.find((e) => e.kind === "screenshot" && e.row === row && e.leg === leg)?.path;
}
var pct = (v) => Math.round(v * 100);
function resolveAnchor(anchor, ctx) {
  if (anchor.kind === "text") {
    const shot2 = shotOf(ctx.manifest, anchor.section);
    const where = shot2 ? `section ${anchor.section} (${screenState(shot2)})` : `section ${anchor.section}`;
    return { target: where, located: `the words "${oneLine(anchor.quote)}"`, orphaned: false };
  }
  if (anchor.kind === "step") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const file = stepScreenshot(ctx.entries, anchor.row, anchor.leg, anchor.attempt, anchor.step);
    return { target: file ?? `${anchor.row} on ${anchor.leg}`, located: `step ${anchor.step} of ${screenState(shot2) || anchor.row} on ${anchor.leg}`, orphaned: false };
  }
  if (anchor.kind === "region") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const near = stepOfPath(anchor.screenshot);
    const rect = `rectangle ${pct(anchor.x)}%,${pct(anchor.y)}% ${pct(anchor.w)}x${pct(anchor.h)}%`;
    const step = near === null ? "the settle screenshot" : `step ${near}`;
    return { target: anchor.screenshot, located: `${rect} of ${screenState(shot2) || anchor.row}, nearest ${step}`, orphaned: !inLedger(ctx.entries, anchor.screenshot) };
  }
  if (anchor.kind === "time") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const span = anchor.end === void 0 ? `t=${anchor.start}s` : `t=${anchor.start}s to ${anchor.end}s`;
    const active = anchor.step === void 0 ? "" : `, step ${anchor.step} then active`;
    return { target: anchor.video, located: `${span} of ${screenState(shot2) || anchor.row}${active}`, orphaned: !inLedger(ctx.entries, anchor.video) };
  }
  const shot = shotOf(ctx.manifest, anchor.name);
  return { target: shot ? `${screenState(shot)} (${anchor.name})` : `flow ${anchor.name}`, located: `flow ${anchor.name}`, orphaned: false };
}
function resolveComments(comments, ctx) {
  return comments.filter((c) => c.status === "open").map((c) => {
    const crop = ctx.crops?.get(c.id);
    return { id: c.id, kind: c.anchor.kind, ...resolveAnchor(c.anchor, ctx), note: oneLine(c.body), ...crop ? { crop } : {} };
  });
}
var fileNameOf = (id) => id.replace(/[^A-Za-z0-9._-]/g, "_");
async function writeRegionCrops(comments, ctx, opts) {
  const crops = /* @__PURE__ */ new Map();
  for (const c of comments) {
    if (c.status !== "open" || c.anchor.kind !== "region" || !inLedger(ctx.entries, c.anchor.screenshot)) continue;
    const source = join2(opts.reportDir, c.anchor.screenshot);
    let bytes;
    try {
      bytes = await readFile2(source);
    } catch (cause) {
      throw new LaunchwrightError("qa.comment.crop", `Cannot read the screenshot ${c.anchor.screenshot} of comment ${c.id}.`, { cause, context: { id: c.id } });
    }
    const crop = cropPng(bytes, c.anchor);
    const file = join2(opts.cropDir, `${fileNameOf(c.id)}.crop.png`);
    await mkdir2(opts.cropDir, { recursive: true });
    await writeFile2(file, crop.png);
    crops.set(c.id, { path: relative(opts.root, file), width: crop.width, height: crop.height });
  }
  return crops;
}
function exportTaskList(comments, ctx) {
  const resolved = resolveComments(comments, ctx);
  if (resolved.length === 0) return "No open comments to act on.";
  const lines = [`${resolved.length} open comment${resolved.length === 1 ? "" : "s"} to act on:`, ""];
  for (const r of resolved) {
    const orphan = r.orphaned ? " (orphaned: the ledger no longer holds this file)" : "";
    const crop = r.crop ? ` Crop: ${r.crop.path} (${r.crop.width}x${r.crop.height} px).` : "";
    lines.push(`- [${r.kind}] ${r.target}${orphan}: ${r.located}.${crop} Note: ${r.note}`);
  }
  return lines.join("\n");
}

export {
  COMMENTS_DIR,
  ANCHOR_KINDS,
  validateAnchor,
  makeComment,
  addComment,
  replyToComment,
  setStatus,
  commentsFile,
  fileCommentStore,
  startCommentServer,
  resolveComments,
  writeRegionCrops,
  exportTaskList
};
//# sourceMappingURL=chunk-37DKYQMH.js.map