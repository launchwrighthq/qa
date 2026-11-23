import {
  INTAKE_DRIVERS,
  JOIN_GAP_MS,
  applyGroups,
  chatDir,
  createIntakeDriver,
  cursorFile,
  maxBytesOf,
  proposeGroups,
  qaIntakeConfig,
  readCursor,
  readGroups,
  readMessages,
  stageBatch,
  writeCursor,
  writeProposal
} from "./chunk-LRNSZYEL.js";
import {
  FAKE_INTAKE_ITEMS,
  FakeIntakeDriver
} from "./chunk-MT6KMLQO.js";
import {
  isGithubMediaHost,
  isGithubUpload,
  mediaLinks,
  takesGithubToken
} from "./chunk-CIX36DE4.js";
import {
  download,
  kindOf,
  mimeOf,
  sniffMime
} from "./chunk-S5PDLVTW.js";
import {
  QA_INTAKE_CAPABILITIES,
  QA_INTAKE_SPEC_VERSION
} from "./chunk-K3F4HTKJ.js";
import "./chunk-3MN5K3QL.js";
import "./chunk-APXO3KTC.js";
import {
  issueMarkdown,
  listIssues,
  readIssue,
  recordDir,
  recordId,
  writeIssue
} from "./chunk-JHXOJGHS.js";
import "./chunk-6LHTNS5B.js";
import {
  CONFIG,
  provider
} from "./chunk-WUOHAWEI.js";
import {
  BootError
} from "./chunk-L57WEOVE.js";

// src/intake/provider.mts
var qaIntakeProvider = provider({
  name: "qa-intake",
  requires: ["kernel", "qa"],
  register(app) {
    const parsed = qaIntakeConfig.safeParse(app.get(CONFIG).section("qa").intake);
    if (parsed.success) return;
    const issues = parsed.error.issues.map((i) => `${["qa.intake", ...i.path].join(".")}: ${i.message}`).join("; ");
    throw new BootError("qa.intake.config", `Boot failed in module "qa-intake": ${issues}. Check ${app.config.envFile}.`, {
      cause: parsed.error,
      context: { module: "qa-intake", key: "qa.intake", envFile: app.config.envFile }
    });
  }
});

// src/intake/services/extension.mts
var qaExtension = {
  name: "qa-intake",
  subcommands: { intake: async () => (await import("./qa-intake-WVCB23HG.js")).default }
};
export {
  FAKE_INTAKE_ITEMS,
  FakeIntakeDriver,
  INTAKE_DRIVERS,
  JOIN_GAP_MS,
  QA_INTAKE_CAPABILITIES,
  QA_INTAKE_SPEC_VERSION,
  applyGroups,
  chatDir,
  createIntakeDriver,
  cursorFile,
  download,
  isGithubMediaHost,
  isGithubUpload,
  issueMarkdown,
  kindOf,
  listIssues,
  maxBytesOf,
  mediaLinks,
  mimeOf,
  proposeGroups,
  qaExtension,
  qaIntakeConfig,
  qaIntakeProvider,
  readCursor,
  readGroups,
  readIssue,
  readMessages,
  recordDir,
  recordId,
  sniffMime,
  stageBatch,
  takesGithubToken,
  writeCursor,
  writeIssue,
  writeProposal
};
//# sourceMappingURL=intake.js.map