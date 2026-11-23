import {
  applyGroups,
  createIntakeDriver,
  proposeGroups,
  qaIntakeConfig,
  readCursor,
  stageBatch,
  writeCursor,
  writeProposal
} from "./chunk-5WJYHB7Y.js";
import "./chunk-SYN6R5ZP.js";
import "./chunk-UF3OGAIM.js";
import "./chunk-CR6DWKU7.js";
import "./chunk-W4O3YTED.js";
import "./chunk-37DKYQMH.js";
import "./chunk-NWIOKD2S.js";
import "./chunk-N6G3DBRC.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfig
} from "./chunk-7OHVK72J.js";
import "./chunk-5KDQJ25J.js";
import "./chunk-SQO6FPZ2.js";
import "./chunk-NYZ72SDM.js";
import "./chunk-AA7FPMJ7.js";
import "./chunk-LBZC23FE.js";
import "./chunk-277Y4WQJ.js";
import {
  listIssues,
  recordDir,
  recordId,
  writeIssue
} from "./chunk-O5NSNELG.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-ZXEFVZDQ.js";
import "./chunk-3TLMTKDL.js";
import "./chunk-XZN5EDSR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-H3DGWSMZ.js";
import {
  INTAKE_DIR
} from "./chunk-SA2YN55L.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/intake/commands/qa-intake.mts
import { relative } from "path";
var USAGE = [
  "usage: lw qa intake github <issue-url>",
  "       lw qa intake telegram --chat <id> [--since <date|message-id>] [--until <date|message-id>] [--driver <d>] [--follow]",
  "       lw qa intake telegram --chat <id> --apply",
  "       lw qa intake list"
];
var TELEGRAM_DRIVERS = ["telegram-mtproto", "telegram-bot", "fake"];
function usage(opts, problem) {
  if (problem) opts.err(`lw qa intake: ${problem}`);
  for (const line of USAGE) opts.err(line);
  return 2;
}
function intakeConfig(opts) {
  const section = qaConfig.safeParse(opts.config?.qa ?? {});
  const parsed = section.success ? qaIntakeConfig.safeParse(section.data.intake) : section;
  if (!parsed.success) {
    const prefix = section.success ? "qa.intake" : "qa";
    const problems = parsed.error.issues.map((i) => `${[prefix, ...i.path].join(".")}: ${i.message}`).join("; ");
    throw new LaunchwrightError("qa.config", `Config section qa is not valid: ${problems}`);
  }
  return parsed.data;
}
function boundOf(flag, value) {
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  if (Number.isNaN(at)) throw new LaunchwrightError("qa.intake.window", `${flag} takes a date (2026-11-01 or an ISO time) or a message id, not "${value}".`);
  return new Date(at);
}
var TELEGRAM_VALUES = ["chat", "since", "until", "driver"];
function parseTelegram(args) {
  let parsed;
  try {
    parsed = parseCommandArgs({ values: TELEGRAM_VALUES, switches: ["follow", "apply"] }, args);
  } catch (cause) {
    if (cause instanceof UsageError) return cause.message;
    throw cause;
  }
  const [extra] = parsed.positionals;
  if (extra !== void 0) return `unknown argument ${extra}`;
  return { ...parsed.values, follow: parsed.switches.has("follow"), apply: parsed.switches.has("apply") };
}
async function github(args, opts, deps) {
  if (args.length !== 1) return usage(opts, "github takes one issue URL");
  const driver = await createIntakeDriver("github", intakeConfig(opts), deps);
  const batch = await driver.fetch(args[0]);
  const [body, ...comments] = batch.items;
  if (!body) throw new LaunchwrightError("qa.intake.github.gh", "gh issue view gave no issue body.");
  const m = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/.exec(batch.ref);
  const id = m ? recordId("github", m[1], m[2], m[3]) : recordId("github", batch.ref);
  const issue = await writeIssue(opts.cwd, {
    id,
    source: "github",
    ref: batch.ref,
    title: batch.title ?? id,
    reportedAt: body.at,
    reporter: body.author,
    text: body.text,
    thread: comments.map((c) => ({ at: c.at, author: c.author, text: c.text })),
    media: batch.items.flatMap((i) => i.media)
  });
  opts.out(`wrote ${issue.id}: ${issue.attachments.length} attachments, ${issue.skipped.length} skipped`);
  opts.out(`  ${relative(opts.cwd, recordDir(opts.cwd, issue.id))}/issue.md`);
  return 0;
}
function followSignal(opts) {
  if (opts.signal) return { signal: opts.signal, done: () => void 0 };
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  process.once("SIGINT", stop);
  return { signal: ctl.signal, done: () => process.off("SIGINT", stop) };
}
async function telegram(args, opts, deps) {
  const p = parseTelegram(args);
  if (typeof p === "string") return usage(opts, p);
  if (p.chat === void 0) return usage(opts, "telegram needs --chat <id>");
  const chat = p.chat;
  if (p.apply) {
    if (p.since !== void 0 || p.until !== void 0 || p.follow || p.driver !== void 0) return usage(opts, "--apply takes only --chat");
    const issues = await applyGroups(opts.cwd, chat);
    for (const issue of issues) opts.out(`wrote ${issue.id}: ${issue.attachments.length} attachments, ${issue.skipped.length} skipped`);
    opts.out(`${issues.length} records in ${INTAKE_DIR}`);
    return 0;
  }
  const intake = intakeConfig(opts);
  const name = p.driver ?? (TELEGRAM_DRIVERS.includes(intake.default) ? intake.default : "telegram-mtproto");
  if (!TELEGRAM_DRIVERS.includes(name)) return usage(opts, `--driver takes ${TELEGRAM_DRIVERS.join(", ")}`);
  const driver = await createIntakeDriver(name, intake, deps);
  if (p.follow && !driver.supports("follow")) return usage(opts, `the ${name} driver cannot --follow; use --driver telegram-bot`);
  const since = p.since === void 0 ? void 0 : boundOf("--since", p.since);
  const until = p.until === void 0 ? void 0 : boundOf("--until", p.until);
  const cursor = since === void 0 && driver.supports("cursor") ? await readCursor(opts.cwd, chat, name) : void 0;
  const follow = p.follow ? followSignal(opts) : void 0;
  if (follow) opts.out(`following chat ${chat}; stop with Ctrl-C`);
  let batch;
  try {
    batch = await driver.fetch(chat, {
      ...since !== void 0 ? { since } : {},
      ...until !== void 0 ? { until } : {},
      ...cursor !== void 0 ? { cursor } : {},
      ...follow ? { follow: true, signal: follow.signal } : {}
    });
  } finally {
    follow?.done();
  }
  const staged = await stageBatch(opts.cwd, chat, batch);
  if (batch.cursor !== void 0 && driver.supports("cursor")) {
    const next = cursor !== void 0 && Number(cursor) > Number(batch.cursor) ? cursor : batch.cursor;
    await writeCursor(opts.cwd, chat, name, next);
  }
  const groups = proposeGroups(chat, staged);
  const file = await writeProposal(opts.cwd, chat, groups);
  opts.out(`read ${batch.items.length} messages from chat ${chat} with ${name}; ${staged.length} staged`);
  opts.out(`proposed ${groups.length} groups: ${relative(opts.cwd, file)}`);
  opts.out(`review it, write groups.json beside it, then run: lw qa intake telegram --chat ${chat} --apply`);
  return 0;
}
async function list(args, opts) {
  if (args.length > 0) return usage(opts, "list takes no arguments");
  const issues = await listIssues(opts.cwd);
  if (issues.length === 0) {
    opts.out(`no intake records in ${INTAKE_DIR}`);
    return 0;
  }
  const width = Math.max(...issues.map((i) => i.id.length));
  for (const i of issues) opts.out(`${i.id.padEnd(width)}  ${i.source.padEnd(8)}  ${String(i.attachments.length).padStart(3)}  ${i.title}`);
  return 0;
}
function createIntakeCommand(deps = {}) {
  return {
    name: "intake",
    summary: "read a GitHub issue or a Telegram chat into local issue records",
    async run(args, opts) {
      const [sub, ...rest] = args;
      try {
        if (sub === "github") return await github(rest, opts, deps);
        if (sub === "telegram") return await telegram(rest, opts, deps);
        if (sub === "list") return await list(rest, opts);
      } catch (error) {
        if (!isCodedError(error)) throw error;
        opts.err(`lw qa intake: ${error.message} (${error.code})`);
        return 1;
      }
      return usage(opts, sub === void 0 || sub === "--help" || sub === "-h" ? void 0 : `unknown subcommand ${sub}`);
    }
  };
}
var qa_intake_default = createIntakeCommand();
export {
  createIntakeCommand,
  qa_intake_default as default
};
//# sourceMappingURL=qa-intake-BTWBEZ4L.js.map