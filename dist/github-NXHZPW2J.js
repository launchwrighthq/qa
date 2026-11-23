import {
  isGithubMediaHost,
  mediaLinks,
  takesGithubToken
} from "./chunk-CIX36DE4.js";
import {
  download,
  kindOf,
  sourceOf
} from "./chunk-HVRFRQJC.js";
import {
  QA_INTAKE_SPEC_VERSION
} from "./chunk-K3F4HTKJ.js";
import "./chunk-3NHPBT7P.js";
import "./chunk-GUHFATHG.js";
import "./chunk-CWVGWAJ5.js";
import "./chunk-SKL7TLL4.js";
import "./chunk-37DKYQMH.js";
import "./chunk-SYG32WE6.js";
import "./chunk-N3XSGPAN.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-7OHVK72J.js";
import "./chunk-5KDQJ25J.js";
import "./chunk-SQO6FPZ2.js";
import "./chunk-NYZ72SDM.js";
import "./chunk-AA7FPMJ7.js";
import "./chunk-LBZC23FE.js";
import "./chunk-277Y4WQJ.js";
import "./chunk-O5NSNELG.js";
import {
  mimeOfExtension
} from "./chunk-B7UB2WOJ.js";
import "./chunk-ZXEFVZDQ.js";
import "./chunk-K3P52YYY.js";
import "./chunk-XZN5EDSR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-H3DGWSMZ.js";
import "./chunk-SA2YN55L.js";
import "./chunk-GZ2IEQDP.js";
import {
  BaseDriver
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/intake/services/gh.mts
import { spawn } from "child_process";
var GH_TIMEOUT_MS = 6e4;
function ghRunner(opts = {}) {
  const bin = opts.bin ?? "gh";
  const timeoutMs = opts.timeoutMs ?? GH_TIMEOUT_MS;
  return (args) => new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs, killSignal: "SIGKILL" });
    const out = [];
    const err = [];
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => err.push(b));
    child.on("error", (cause) => {
      reject(new LaunchwrightError("qa.intake.github.gh", "Cannot start gh. Install the GitHub CLI and run gh auth login.", { cause }));
    });
    child.on("close", (code, signal) => {
      if (code === null && signal === "SIGKILL") {
        const command = args.slice(0, 2).join(" ");
        reject(new LaunchwrightError("qa.intake.github.timeout", `gh ${command} ran past ${timeoutMs} ms and was stopped.`, { context: { command, timeoutMs } }));
        return;
      }
      resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") });
    });
  });
}
var spawnGh = ghRunner();

// src/intake/drivers/intake/github.mts
var ISSUE_FIELDS = "number,title,body,author,labels,comments,createdAt,url,state";
function parseIssueUrl(ref) {
  const url = URL.canParse(ref) ? new URL(ref) : null;
  const m = url?.hostname === "github.com" ? /^\/([\w.-]+)\/([\w.-]+)\/(issues|pull|pulls)\/(\d+)\/?$/.exec(url.pathname) : null;
  if (!m) {
    throw new LaunchwrightError("qa.intake.github.ref", "The ref is not a GitHub issue URL: https://github.com/<owner>/<repo>/issues/<n>.", { context: { ref } });
  }
  if (m[3] !== "issues") {
    throw new LaunchwrightError("qa.intake.github.not-issue", "The URL is a pull request. lw qa intake github reads issues only.", { context: { ref } });
  }
  return { owner: m[1], repo: m[2], number: Number(m[4]) };
}
function viewFailure(stderr, ref) {
  const reason = stderr.trim().split("\n")[0]?.slice(0, 300) ?? "";
  if (/pull request/i.test(reason)) {
    return new LaunchwrightError("qa.intake.github.not-issue", "The number is a pull request. lw qa intake github reads issues only.", { context: { ref } });
  }
  if (/gh auth login|authentication|not logged/i.test(reason)) {
    return new LaunchwrightError("qa.intake.github.auth", "gh has no login. Run gh auth login.", { context: { ref, reason } });
  }
  if (/could not resolve|not found|HTTP 40[134]|not accessible|permission/i.test(reason)) {
    return new LaunchwrightError("qa.intake.github.access", "The gh login cannot read this issue or its repository.", { context: { ref, reason } });
  }
  return new LaunchwrightError("qa.intake.github.gh", "gh issue view failed.", { context: { ref, reason } });
}
var GithubIntakeDriver = class extends BaseDriver {
  constructor(opts) {
    super("github", QA_INTAKE_SPEC_VERSION, []);
    this.opts = opts;
    this.gh = opts.gh ?? spawnGh;
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
  }
  opts;
  source = "github";
  gh;
  fetchFn;
  async fetch(ref) {
    parseIssueUrl(ref);
    const view = await this.gh(["issue", "view", ref, "--json", ISSUE_FIELDS]);
    if (view.code !== 0) throw viewFailure(view.stderr, ref);
    let issue;
    try {
      issue = JSON.parse(view.stdout);
    } catch (cause) {
      throw new LaunchwrightError("qa.intake.github.gh", "gh issue view did not print JSON.", { cause, context: { ref } });
    }
    if (issue.url.includes("/pull/")) {
      throw new LaunchwrightError("qa.intake.github.not-issue", "The number is a pull request. lw qa intake github reads issues only.", { context: { ref } });
    }
    const posts = [
      { id: "body", author: issue.author, text: issue.body ?? "", at: issue.createdAt },
      ...(issue.comments ?? []).map((c, i) => ({ id: c.id ?? `comment-${i + 1}`, author: c.author, text: c.body ?? "", at: c.createdAt }))
    ];
    const needsToken = posts.some((p) => mediaLinks(p.text).length > 0);
    const token = needsToken ? await this.token() : null;
    const items = [];
    for (const p of posts) {
      const media = [];
      for (const link of mediaLinks(p.text)) media.push(await this.media(link, token));
      items.push({ id: p.id, at: new Date(p.at).toISOString(), author: p.author?.login ?? "ghost", text: p.text, media });
    }
    return { source: "github", ref: issue.url, title: issue.title, items };
  }
  /** The token of the `gh` login, read from the child's stdout. */
  async token() {
    const res = await this.gh(["auth", "token"]);
    const token = res.stdout.trim();
    if (res.code !== 0 || token === "") {
      throw new LaunchwrightError("qa.intake.github.auth", "gh auth token gave no token. Run gh auth login.");
    }
    return token;
  }
  async media(link, token) {
    const name = new URL(link).pathname.split("/").pop() ?? "";
    const got = await download(link, {
      fetch: this.fetchFn,
      maxBytes: this.opts.maxBytes,
      name,
      allow: isGithubMediaHost,
      headersFor: (url) => token !== null && takesGithubToken(url) ? { authorization: `Bearer ${token}` } : {}
    });
    const from = sourceOf(link);
    if ("skipped" in got) {
      const mime = mimeOfExtension(name) ?? "application/octet-stream";
      return { from, kind: kindOf(mime), mime, ...name ? { name } : {}, skipped: got.skipped };
    }
    return { from, kind: kindOf(got.mime), mime: got.mime, ...name ? { name } : {}, data: got.data };
  }
};
export {
  GithubIntakeDriver,
  ISSUE_FIELDS,
  parseIssueUrl
};
//# sourceMappingURL=github-NXHZPW2J.js.map