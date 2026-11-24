import {
  importProjectJobs,
  listJobs,
  runJob
} from "./chunk-L7ICYOID.js";
import {
  guarded,
  importFromProject,
  loadAppEntry,
  parseArgs,
  withWorld,
  worldContext
} from "./chunk-JPCS27IP.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-RGX37KPN.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import {
  appPath
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-job.mts
var USAGE = [
  "usage: lw qa job [list]                                      list the registered jobs",
  "       lw qa job run <kind> [--payload <json>] [--tenant <id>] run one job once on the QA app"
];
function payloadOf(text) {
  if (typeof text !== "string") return void 0;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError("qa.job.payload", "--payload is not JSON.", { cause });
  }
}
async function run(args, opts) {
  const { words, options } = parseArgs(args, [], ["payload", "tenant"]);
  const [sub = "list", kind] = words;
  if (sub !== "list" && !(sub === "run" && kind !== void 0)) {
    for (const line of USAGE) opts.err(line);
    return 2;
  }
  const ctx = await worldContext(opts);
  await loadAppEntry(ctx.root, ctx.qa);
  await importProjectJobs(ctx.root, `${appPath(opts.config ?? {}, "node", "apps/api")}/src/jobs`);
  const queue = await importFromProject(ctx.root, "@launchwrighthq/queue");
  if (sub === "list") {
    const kinds = listJobs(queue);
    for (const k of kinds) opts.out(k);
    if (kinds.length === 0) opts.out("no registered job");
    return 0;
  }
  const payload = payloadOf(options.payload);
  const tenantId = typeof options.tenant === "string" ? options.tenant : void 0;
  await withWorld(ctx, (world) => runJob(world, queue, { kind, payload, ...tenantId ? { tenantId } : {}, clock: ctx.clock }));
  opts.out(`ran ${kind} once on ${ctx.overlay.database}`);
  return 0;
}
var job = {
  name: "job",
  summary: "list the registered jobs, or run one once on the QA app",
  run: (args, opts) => guarded("job", opts, () => run(args, opts))
};
var qa_job_default = job;
export {
  qa_job_default as default
};
//# sourceMappingURL=qa-job-TXZQIB5P.js.map