import {
  digest,
  renderChanges,
  repoRoot
} from "./chunk-62VIRJ2H.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-7OHVK72J.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-changes.mts
var USAGE = [
  "usage: lw qa changes [--since <date|sha> | --last] [--json]",
  '  --since 2026-08-21 | "2026-08-21 14:00" | <sha>   the first commit of the range',
  "  --last    continue after the Range: line of the newest report (the default)",
  "  --json    the whole digest as JSON"
];
var changes = {
  name: "changes",
  summary: "Group the commits of a range by area and list the signals of user-visible change",
  async run(args, opts) {
    let parsed;
    try {
      parsed = parseCommandArgs({ values: ["since"], switches: ["json", "last"] }, args);
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
      parsed = void 0;
    }
    if (!parsed || parsed.positionals.length > 0) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const since = parsed.switches.has("last") ? void 0 : parsed.values.since;
    const json = parsed.switches.has("json");
    const config = qaConfigOf(opts.config);
    try {
      const result = digest(repoRoot(opts.cwd), { ...since !== void 0 ? { since } : {}, reportDir: config.reportDir, clock: systemClock });
      opts.out(json ? JSON.stringify(result, null, 2) : renderChanges(result));
      return 0;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa changes: ${cause.message}`);
      return 1;
    }
  }
};
var qa_changes_default = changes;
export {
  qa_changes_default as default
};
//# sourceMappingURL=qa-changes-6U75XPZB.js.map