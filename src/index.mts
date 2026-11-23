// The public API of @launchwrighthq/qa.
export { EXTENSION_PREFIX, extensionNames, extensionTargets, loadExtensions, type QaExtension } from './commands/extensions.mts';
export { qaCommand, type QaCommandOptions, type QaSubcommand, SUBCOMMANDS } from './commands/qa.command.mts';
export { createStatesCommand } from './commands/qa-states.mts';
export { type LegConfig, qaConfig, type QaConfig, qaConfigOf, withAppPaths } from './config.mts';
export {
  type Capture,
  type OpenOptions,
  type OpenTargetRegistry,
  QA_TARGET_CAPABILITIES,
  QA_TARGET_SPEC_VERSION,
  type QaSession,
  type QaTarget,
  type QaTargetCapability,
  type QaTargetRegistry,
  type SessionLogLine,
  type TargetNeeds,
  type TargetReadiness,
  type VideoCapture,
} from './drivers/target/contract.mts';
export { createPlaywrightTarget, type PlaywrightTargetOptions } from './drivers/target/playwright.mts';
export { isCodedError } from './kernel/services/errors.mts';
export { qaProvider } from './provider.mts';
export { extensionOf, mimeOfExtension } from './services/mime.mts';
export { pngSize } from './services/png.mts';
export { type IssueDraft, issueMarkdown, listIssues, readIssue, recordDir, recordId, writeIssue } from './services/records.mts';
export {
  computeManifest,
  CONSENT_DIR,
  type ConsentGrant,
  type ConsentGroup,
  type ConsentManifest,
  type ConsentRecord,
  type ConsentStore,
  credentialNeed,
  type CredentialNeed,
  type DataNeed,
  diff,
  fileConsentStore,
  grant,
  type GrantChoices,
  type ManifestInput,
  type ManifestItem,
  manifestHash,
  missingCredentials,
  type OutwardNeed,
  recordGrants,
} from './services/contract.mts';
export {
  type BotCommand,
  BOTFATHER,
  type BotFatherChat,
  type BotGetMe,
  botIdOf,
  configureBot,
  type ConfigureBotOptions,
  type DeadBot,
  DELETE_CONFIRM,
  destroyBot,
  newBot,
  type NewBot,
  parseBotToken,
  type UserbotLease,
  type UserbotProvider,
} from './services/botfather.mts';
export { BOT_STORE_DIR, type BotRecord, type BotStore, fileBotStore } from './services/bot-store.mts';
export {
  addComment,
  ANCHOR_KINDS,
  type Comment,
  type CommentAnchor,
  type CommentReply,
  type CommentStore,
  COMMENTS_DIR,
  commentsFile,
  fileCommentStore,
  type FlowAnchor,
  makeComment,
  type NewComment,
  type RegionAnchor,
  replyToComment,
  setStatus,
  type StepAnchor,
  type TextAnchor,
  type TimeAnchor,
  validateAnchor,
} from './services/comments.mts';
export { type ExportContext, exportTaskList, type ResolvedComment, resolveComments } from './services/comment-export.mts';
export { type CommentServer, type CommentServerOptions, startCommentServer } from './services/comment-server.mts';
export {
  computeScore,
  DEFAULT_SCORE_WEIGHTS,
  type GaugeOptions,
  renderScoreGauge,
  type ScoreDimension,
  type ScoreInput,
  type ScoreResult,
  type ScoreWeights,
  SEVERITY_DEDUCTION,
  type SeverityCounts,
} from './services/score.mts';
export { createTargetRegistry } from './services/targets.mts';
export * from './services/types.mts';
export { MIN_VIDEO_S } from './services/video.mts';
export { QA_TARGETS } from './tokens.mts';
