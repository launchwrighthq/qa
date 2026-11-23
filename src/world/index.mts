// The world submodule of @launchwrighthq/qa (spec 2.5, 2.6): personas and facts, the QA database,
// fixtures, worktree runs and jobs on demand. A `<feature>.world.mts` imports `defineWorld` here.
export {
  importFromProject,
  loadAppEntry,
  openWorld,
  type QaAppEntry,
  qaDatabase,
  type QaFakeBot,
  qaFakeBots,
  qaFakeToken,
  type QaHandler,
  type QaOverlay,
  qaSections,
  QA_TELEGRAM_PORT,
  type QaWorld,
} from './services/app.mts';
export { type FixtureArming, fixtureArming, type FixtureArmingOptions } from './services/arming.mts';
export { type CheckoutFacts, devProjectName, readCheckout } from './services/checkout.mts';
export { parseShift, ShiftClock } from './services/clock.mts';
export { featuresWithoutWorld, loadRegistry, loadWorlds, rawSqlFindings, WORLD_SUFFIX, type WorldFinding, worldFiles, worldLintFindings } from './services/discover.mts';
export { type ArmedFact, armFact, disarmFact, readUndo, UNDO_FILE, type UndoRecord } from './services/fixture.mts';
export { idProblem, personaIds, qaAccountId, QA_PROVIDER, qaTelegramId } from './services/ids.mts';
export { importProjectJobs, JOBS_DIR, type JobRegistry, listJobs, runJob, type RunJobOptions } from './services/jobs.mts';
export { setMenuButton, type MenuOptions } from './services/menu.mts';
export { assertRegistry, buildRegistry, defineWorld, factById, listWorld, type LoadedWorld, personaById, registryHash, registryProblem } from './services/registry.mts';
export {
  assertQaTarget,
  databaseName,
  dbAdmin,
  type DbAdmin,
  type DbSection,
  isLoopbackHost,
  pgAdmin,
  pgliteAdmin,
  qaDbSection,
  qaTargetProblem,
  urlWithDatabase,
} from './services/stack.mts';
export type { ArmCtx, Fact, FactHandles, FeatureWorld, Owned, Persona, PersonaHandles, PersonaIds, WorldCtx, WorldEntry, WorldRegistry } from './services/types.mts';
export { baseSeedNames, readStamp, resetWorld, type ResetOptions, seedWorld, STAMP_FILE, type WorldStamp, type WorldStatus, worldStatus } from './services/world.mts';
export { cleanupWorktrees, copyName, copyPrefix, planWorktree, runWorktree, setEnvLine, type WorktreeDeps, type WorktreeOptions, type WorktreePlan } from './services/worktree.mts';
