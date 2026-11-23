// The states submodule of @launchwrighthq/qa (spec 2.2, 2.7): the state scan, the solver, the
// delivery map, mounted and intercepted capture, and the C1 and C4 rules of `lw qa check`.
export {
  type DeliveryDescriptor,
  type DeliveryRoute,
  FAIL_REASONS,
  type FailReason,
  type IgnoredEntry,
  IGNORE_TAG,
  type InputSite,
  type Inventory,
  isStateUnionName,
  KINDS,
  kindFor,
  type Mechanism,
  mechanismFor,
  type MountHints,
  type OutputSite,
  type PlannedCapture,
  plannedCaptures,
  PROVENANCE,
  STATE_SUFFIXES,
  type StateResult,
  type UnionEntry,
  type UnionKind,
  validateInventory,
} from './services/inventory.mts';
export {
  ABSENT,
  anchorSubjects,
  candidatePlan,
  candidates,
  describeCandidate,
  type Field,
  fieldValues,
  MAX_CANDIDATES,
  NULL_STATE,
  type Shape,
  solve,
  unreachable,
  validateShape,
} from './services/solve.mts';
export { analyzeSources, isProductSource, readTree, type ScanProblem, type ScanResult, scanProject, type SourceText } from './services/scan.mts';
export { attachRoutes, buildRouteMap, normaliseTables, type RouteMap, type RouteTable, renderRouteSummary } from './services/delivery.mts';
export { readAliases, scanStates, STATES_FILE, type StatesScan } from './services/project.mts';
export { c1Findings, c4Findings, type StateFinding, stateFindings } from './services/check.mts';
export { buildPlan, type CaptureGroup, finishRun, groupsFor, issueFor, mergeDelivery, neitherUnions, parseInventory, parseResults, renderReport, type StatesPlan } from './services/loop.mts';
export { captureMounted, mountUrl, resolveMount, STATES_HARNESS_PATH } from './services/mount.mts';
export { CaptureFailure, captureGroup, type CaptureContext, type EvidenceRecorder, installSubstitution, locateSubjects } from './services/capture.mts';
