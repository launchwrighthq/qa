// Driver kind `qa.target` (QA spec 2.8). The `qa` module owns the contract and its suite; the
// device drivers of this folder implement it.
export {
  type Capture,
  type OpenOptions,
  QA_TARGET_CAPABILITIES,
  QA_TARGET_SPEC_VERSION,
  type QaSession,
  type QaTarget,
  type QaTargetCapability,
  type SessionLogLine,
  type TargetNeeds,
  type TargetReadiness,
  type VideoCapture,
} from '../../../index.mts';
