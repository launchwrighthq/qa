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
} from "./chunk-HVRFRQJC.js";
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
} from "./chunk-GBRH7JBN.js";
import {
  FAKE_INTAKE_ITEMS,
  FakeIntakeDriver
} from "./chunk-FI33MU4L.js";
import {
  QA_INTAKE_CAPABILITIES,
  QA_INTAKE_SPEC_VERSION
} from "./chunk-K3F4HTKJ.js";
import "./chunk-DP3BJCQL.js";
import "./chunk-PYBSJLYL.js";
import "./chunk-Y3DM4XPJ.js";
import "./chunk-W4O3YTED.js";
import "./chunk-53M6IOKX.js";
import "./chunk-7YME3OFL.js";
import "./chunk-N6G3DBRC.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import "./chunk-7U5DCOOY.js";
import "./chunk-I3IUHHIW.js";
import "./chunk-4M4L73SK.js";
import "./chunk-4HWKGNXL.js";
import "./chunk-JPCS27IP.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-RGX37KPN.js";
import "./chunk-W6MGERRV.js";
import "./chunk-ZRBKWAMJ.js";
import "./chunk-OSGSGOS2.js";
import "./chunk-B3YQ27NA.js";
import "./chunk-42WWWMVO.js";
import "./chunk-277Y4WQJ.js";
import {
  issueMarkdown,
  listIssues,
  readIssue,
  recordDir,
  recordId,
  writeIssue
} from "./chunk-KCJ7A64B.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-RFUDK5EX.js";
import "./chunk-APRIQSSG.js";
import "./chunk-OF544TQR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-TQCRYULZ.js";
import "./chunk-SA2YN55L.js";
import {
  CONFIG,
  provider
} from "./chunk-5AJ7M7K5.js";
import {
  BootError
} from "./chunk-KK6DCU3O.js";

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
  subcommands: { intake: async () => (await import("./qa-intake-RDXH63OT.js")).default }
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