// The public API of @launchwrighthq/qa-intake (QA spec 2.15): the `qa.intake` drivers and
// `lw qa intake`. The issue records are of `qa`; this package passes them on.
export { type IntakeConfig, qaIntakeConfig } from './config.mts';
export {
  type AttachmentKind,
  type IntakeBatch,
  type IntakeWindow,
  QA_INTAKE_CAPABILITIES,
  QA_INTAKE_SPEC_VERSION,
  type QaIntakeCapability,
  type QaIntakeDriver,
  type RawItem,
  type RawMedia,
  type SkipReason,
  type WindowBound,
} from './drivers/intake/contract.mts';
export { FAKE_INTAKE_ITEMS, FakeIntakeDriver, type FakeIntakeOptions } from './drivers/intake/fake.mts';
export type { GhResult, GhRunner } from './services/gh.mts';
export { isGithubMediaHost, isGithubUpload, mediaLinks, takesGithubToken } from './services/links.mts';
export { download, type FetchFn, kindOf, mimeOf, sniffMime } from './services/media.mts';
export { type IssueDraft, issueMarkdown, listIssues, readIssue, recordDir, recordId, writeIssue } from '../index.mts';
export { qaIntakeProvider } from './provider.mts';
export { qaExtension } from './services/extension.mts';
export { createIntakeDriver, INTAKE_DRIVERS, type IntakeDeps, type IntakeDriverName, maxBytesOf } from './services/registry.mts';
export {
  applyGroups,
  chatDir,
  cursorFile,
  type Group,
  JOIN_GAP_MS,
  proposeGroups,
  readCursor,
  readGroups,
  readMessages,
  stageBatch,
  type StoredMedia,
  type StoredMessage,
  writeCursor,
  writeProposal,
} from './services/telegram.mts';
