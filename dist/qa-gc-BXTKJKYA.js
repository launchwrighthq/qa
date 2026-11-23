import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-7OHVK72J.js";
import {
  reportPaths
} from "./chunk-3OHR7PBT.js";
import "./chunk-SA2YN55L.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-gc.mts
import { resolve } from "path";

// src/services/gc.mts
import { readdir, rm, stat } from "fs/promises";
import { join } from "path";
var REPORT_RE = /^(\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
async function size(path) {
  let s;
  try {
    s = await stat(path);
  } catch (cause) {
    if (cause.code === "ENOENT") return 0;
    throw new LaunchwrightError("qa.gc.read", `Cannot read ${path}`, { cause });
  }
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const name of await readdir(path)) total += await size(join(path, name));
  return total;
}
async function gcReports(reportDir, keep) {
  if (!Number.isInteger(keep) || keep < 0) throw new LaunchwrightError("qa.gc.keep", `--keep must be a whole number of reports, not ${keep}`);
  let names;
  try {
    names = await readdir(reportDir);
  } catch (cause) {
    if (cause.code === "ENOENT") return { kept: [], deleted: [] };
    throw new LaunchwrightError("qa.gc.read", `Cannot list ${reportDir}`, { cause });
  }
  const slugs = names.map((n) => REPORT_RE.exec(n)?.[1]).filter((s) => s !== void 0).sort().reverse();
  const result = { kept: slugs.slice(0, keep), deleted: [] };
  for (const slug of slugs.slice(keep)) {
    const paths = reportPaths(reportDir, slug);
    const bytes = await size(paths.assets) + await size(paths.html);
    await rm(paths.assets, { recursive: true, force: true });
    await rm(paths.html, { force: true });
    if (bytes > 0) result.deleted.push({ slug, bytes });
  }
  return result;
}

// src/commands/qa-gc.mts
var gc = {
  name: "gc",
  summary: "Delete the evidence of older reports and keep the report files",
  async run(args, opts) {
    let given;
    try {
      const parsed = parseCommandArgs({ values: ["keep"] }, args);
      if (parsed.positionals.length === 0) given = parsed.values.keep;
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
    }
    const keep = given !== void 0 && /^\d+$/.test(given) ? Number(given) : null;
    if (keep === null) {
      opts.err("usage: lw qa gc --keep <n>   keep the evidence of the n newest reports");
      return 2;
    }
    const config = qaConfigOf(opts.config);
    try {
      const result = await gcReports(resolve(opts.cwd, config.reportDir), keep);
      for (const d of result.deleted) opts.out(`deleted the evidence of ${d.slug} (${d.bytes} bytes)`);
      opts.out(`lw qa gc: kept the evidence of ${result.kept.length} reports, deleted ${result.deleted.length}`);
      return 0;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa gc: ${cause.code}: ${cause.message}`);
      return 1;
    }
  }
};
var qa_gc_default = gc;
export {
  qa_gc_default as default
};
//# sourceMappingURL=qa-gc-BXTKJKYA.js.map