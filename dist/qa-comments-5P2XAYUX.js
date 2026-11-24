import {
  loadViewerInput,
  renderViewerBundle,
  viewerDirName
} from "./chunk-CHZAXL2Z.js";
import "./chunk-5VUYK3ZQ.js";
import "./chunk-JYL7CKWM.js";
import {
  COMMENTS_DIR,
  commentsFile,
  exportTaskList,
  fileCommentStore,
  replyToComment,
  setStatus,
  startCommentServer,
  writeRegionCrops
} from "./chunk-53M6IOKX.js";
import {
  parseArgs,
  processSignal
} from "./chunk-JPCS27IP.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-RGX37KPN.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-RFUDK5EX.js";
import "./chunk-OF544TQR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import {
  legDefinitions
} from "./chunk-TQCRYULZ.js";
import "./chunk-SA2YN55L.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-comments.mts
import { basename, isAbsolute, join, resolve } from "path";
var USAGE = [
  "usage: lw qa comments <serve|export|resolve> <slug> [options]",
  "  serve <slug> [--port <n>]                 serve the viewer and the comment store on 127.0.0.1",
  "  export <slug>                             print the agent task list of the open comments, with region crops",
  "  resolve <slug> <id> [--reply <text>]      mark comment <id> resolved, after an optional reply"
];
var RESOLVER = "agent";
function legNames(opts) {
  return legDefinitions(qaConfigOf(opts.config)).map((l) => l.name);
}
function reportOf(arg, opts) {
  if (arg.endsWith(".md") || arg.includes("/")) {
    const md = isAbsolute(arg) ? arg : resolve(opts.cwd, arg);
    return { md, slug: basename(md).replace(/\.md$/, "") };
  }
  const root = qaConfigOf(opts.config).reportDir;
  const reportDir = isAbsolute(root) ? root : resolve(opts.cwd, root);
  return { md: join(reportDir, `${arg}.md`), slug: arg };
}
function port(option) {
  if (option === void 0) return void 0;
  const n = Number(option);
  if (typeof option !== "string" || !/^\d+$/.test(option) || n > 65535) {
    throw new LaunchwrightError("qa.comments.usage", `--port must be an integer from 0 (a free port) to 65535, not ${String(option)}.`);
  }
  return n;
}
async function serve(arg, chosen, opts) {
  const { md, slug } = reportOf(arg, opts);
  const { input, reportDir } = await loadViewerInput(md, { legs: legNames(opts) });
  const store = fileCommentStore(join(opts.cwd, COMMENTS_DIR));
  const viewerDir = `dist/${viewerDirName(slug)}`;
  const { weights, gaugeColor } = qaConfigOf(opts.config).score;
  const renderPages = (comments2) => renderViewerBundle({ ...input, comments: comments2 }, { weights, gaugeColor }).pages;
  const server = await startCommentServer({ reportDir, viewerDir, slug, store, renderPages, clock: systemClock, ...chosen === void 0 ? {} : { port: chosen } });
  const stop = processSignal(opts.signal);
  try {
    opts.out(server.indexUrl);
    opts.err(`lw qa comments serve: ${slug} on ${server.url}, store ${COMMENTS_DIR}/${slug}.json; Ctrl-C stops it`);
    if (!stop.signal.aborted) await new Promise((resolve2) => stop.signal.addEventListener("abort", () => resolve2(), { once: true }));
  } finally {
    stop.dispose();
    await server.close();
  }
  return 0;
}
async function exportComments(arg, opts) {
  const { md, slug } = reportOf(arg, opts);
  const { input, reportDir } = await loadViewerInput(md, { legs: legNames(opts) });
  const comments2 = await fileCommentStore(join(opts.cwd, COMMENTS_DIR)).read(slug);
  const ctx = { manifest: input.manifest, entries: input.entries };
  const crops = await writeRegionCrops(comments2, ctx, { reportDir, cropDir: join(opts.cwd, COMMENTS_DIR, slug), root: opts.cwd });
  const list = exportTaskList(comments2, { ...ctx, crops });
  for (const line of list.split("\n")) opts.out(line);
  return 0;
}
async function resolveComment(arg, id, reply, opts) {
  const { slug } = reportOf(arg, opts);
  const store = fileCommentStore(join(opts.cwd, COMMENTS_DIR));
  let list = await store.read(slug);
  if (reply !== void 0) list = replyToComment(list, id, { author: RESOLVER, body: reply, createdAt: systemClock.date().toISOString() });
  list = setStatus(list, id, "resolved");
  await store.write(slug, list);
  opts.out(`lw qa comments resolve: ${id} resolved${reply === void 0 ? "" : " with a reply"} in ${commentsFile(COMMENTS_DIR, slug)}`);
  return 0;
}
var comments = {
  name: "comments",
  summary: "Serve reviewer comments and export the agent task list of the open ones",
  async run(args, opts) {
    const [verb, ...rest] = args;
    const { words, options } = parseArgs(rest, ["help"], ["port", "reply"]);
    if (verb === void 0 || verb === "--help" || verb === "-h" || options.help === true) {
      for (const line of USAGE) opts.err(line);
      return verb === void 0 ? 2 : 0;
    }
    const [slug, id, extra] = words;
    const wantsId = verb === "resolve";
    const reply = typeof options.reply === "string" ? options.reply : void 0;
    const known = verb === "serve" || verb === "export" || verb === "resolve";
    if (!known || slug === void 0 || (wantsId ? id === void 0 || extra !== void 0 : id !== void 0) || options.reply !== void 0 && (!wantsId || reply === void 0)) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    try {
      if (verb === "serve") return await serve(slug, port(options.port), opts);
      if (verb === "resolve") return await resolveComment(slug, id, reply, opts);
      return await exportComments(slug, opts);
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa comments ${verb}: ${cause.code}: ${cause.message}`);
      return 1;
    }
  }
};
var qa_comments_default = comments;
export {
  qa_comments_default as default
};
//# sourceMappingURL=qa-comments-5P2XAYUX.js.map