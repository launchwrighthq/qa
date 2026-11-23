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
} from "./chunk-72EQBTN5.js";
import {
  FAKE_INTAKE_ITEMS,
  FakeIntakeDriver
} from "./chunk-FI33MU4L.js";
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
  QA_INTAKE_CAPABILITIES,
  QA_INTAKE_SPEC_VERSION
} from "./chunk-K3F4HTKJ.js";
import "./chunk-4VC7YQ7I.js";
import "./chunk-HHUS2XJO.js";
import "./chunk-CWVGWAJ5.js";
import "./chunk-SKL7TLL4.js";
import "./chunk-37DKYQMH.js";
import "./chunk-SYG32WE6.js";
import "./chunk-N3XSGPAN.js";
import "./chunk-62VIRJ2H.js";
import "./chunk-ZYIHPZ3V.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-4B5GWDFB.js";
import "./chunk-5KDQJ25J.js";
import "./chunk-SQO6FPZ2.js";
import "./chunk-NYZ72SDM.js";
import "./chunk-AA7FPMJ7.js";
import "./chunk-LBZC23FE.js";
import "./chunk-277Y4WQJ.js";
import {
  issueMarkdown,
  listIssues,
  readIssue,
  recordDir,
  recordId,
  writeIssue
} from "./chunk-O5NSNELG.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-RFUDK5EX.js";
import "./chunk-K3P52YYY.js";
import "./chunk-XZN5EDSR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-H3DGWSMZ.js";
import "./chunk-SA2YN55L.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
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
  subcommands: { intake: async () => (await import("./qa-intake-7HTZG3C3.js")).default }
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