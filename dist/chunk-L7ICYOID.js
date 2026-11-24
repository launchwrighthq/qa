import {
  loadDb
} from "./chunk-I52564IV.js";
import {
  appPath
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/world/services/jobs.mts
import { readdir } from "fs/promises";
import { join } from "path";
import { pathToFileURL } from "url";
function jobsDirOf(sections = {}) {
  return `${appPath(sections, "node", "apps/api")}/src/jobs`;
}
var JOBS_DIR = jobsDirOf();
async function importProjectJobs(root, jobsDir = JOBS_DIR) {
  const dir = join(root, jobsDir);
  let names;
  try {
    names = await readdir(dir);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.job.read", `Cannot read ${dir}.`, { cause });
  }
  const files = names.filter((n) => n.endsWith(".job.mts")).sort();
  for (const file of files) await import(pathToFileURL(join(dir, file)).href);
  return files;
}
function listJobs(registry) {
  return registry.registeredJobs().map((j) => j.kind).sort();
}
async function runJob(world, registry, o) {
  const def = registry.jobOf(o.kind);
  if (def === void 0) {
    throw new LaunchwrightError("qa.job.unknown", `No registered job has kind ${o.kind}. Jobs: ${listJobs(registry).join(", ") || "none"}.`, { context: { kind: o.kind } });
  }
  const payload = registry.parsePayload(def, o.payload ?? {});
  const scope = world.app.createScope();
  if (o.tenantId !== void 0) {
    const { TENANT_SCOPE, tenantScope } = await loadDb();
    scope.instance(TENANT_SCOPE, tenantScope(o.tenantId));
  }
  const ctx = registry.standaloneContext({
    id: `qa-${o.kind}-${o.clock.now()}`,
    kind: o.kind,
    attempts: 1,
    maxAttempts: 1,
    tenantId: o.tenantId ?? null,
    container: scope,
    log: world.app.log
  });
  try {
    await def.handle(payload, ctx);
  } finally {
    await scope.dispose();
  }
}

export {
  JOBS_DIR,
  importProjectJobs,
  listJobs,
  runJob
};
//# sourceMappingURL=chunk-L7ICYOID.js.map