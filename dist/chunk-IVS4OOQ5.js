import {
  BROWSER_TARGETS,
  createTargetRegistry
} from "./chunk-N736V2LB.js";
import {
  git
} from "./chunk-62VIRJ2H.js";
import {
  appendLedger,
  ledgerEntry
} from "./chunk-3OHR7PBT.js";
import {
  legDefinitions
} from "./chunk-TQCRYULZ.js";
import {
  CLOCK,
  systemClock,
  token
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/tokens.mts
var QA_TARGETS = token("qa.targets");

// src/states/services/run.mts
import { relative } from "path";
function gitRevision(cwd) {
  const commit = git(cwd, ["rev-parse", "HEAD"], { allowFail: true })?.trim() || "none";
  const status = git(cwd, ["status", "--porcelain"], { allowFail: true });
  return { commit, dirty: (status ?? "").trim() !== "" };
}
function runClock(app, overrides = {}) {
  return overrides.clock ?? (app ? app.get(CLOCK) : systemClock);
}
function runDeps(config, app, overrides = {}, extra = {}) {
  const clock = runClock(app, overrides);
  return {
    clock,
    targets: overrides.targets ?? (app ? app.get(QA_TARGETS) : createTargetRegistry(config, extra, clock)),
    revision: overrides.revision ?? gitRevision
  };
}
function legByName(config, name) {
  const legs = legDefinitions(config);
  const leg = legs.find((l) => l.name === name);
  if (!leg) {
    throw new LaunchwrightError("qa.legs.unknown", `No leg is named ${name}. Legs: ${legs.map((l) => l.name).join(", ")}.`, { context: { leg: name } });
  }
  return leg;
}
function deviceOf(leg) {
  if (BROWSER_TARGETS.has(leg.target)) return `browser ${leg.browser ?? "chromium"}`;
  return leg.device ?? null;
}
function ledgerRecorder(args) {
  const entries = [];
  const device = args.leg.device;
  return {
    async record({ file, kind, row }) {
      entries.push(
        await ledgerEntry(args.reportDir, {
          path: relative(args.reportDir, file).split("\\").join("/"),
          kind,
          capturedAt: args.clock.date().toISOString(),
          commit: args.revision.commit,
          dirty: args.revision.dirty,
          leg: args.leg.name,
          target: args.leg.target,
          ...device === void 0 ? {} : { device },
          provenance: args.provenance,
          row,
          attempt: 1
        })
      );
    },
    async flush() {
      const batch = entries.splice(0);
      if (batch.length > 0) await appendLedger(args.reportDir, args.slug, batch);
      return batch.length;
    }
  };
}

export {
  QA_TARGETS,
  runClock,
  runDeps,
  legByName,
  deviceOf,
  ledgerRecorder
};
//# sourceMappingURL=chunk-IVS4OOQ5.js.map