// Test helpers of @launchwrighthq/qa: fakes and contract suites.
export {
  CONTRACT_BASE,
  type ContractSite,
  contractFakeRoutes,
  type HarnessOptions,
  serveContractSite,
  type TargetHarness,
  targetContract,
  targetHarness,
} from './target-contract.mts';
export { BROWSERS_PATH, headlessShell } from './chromium.mts';
export { FIXTURE_ISSUE, type FixturePair, patternPng, type ReportFixtureOptions, uniformPng, writeIssueReportFixture, writeReportFixture } from './report-fixture.mts';
export { createFakeTarget, type FakeRoute, type FakeSessionLog, type FakeTarget, type FakeTargetOptions } from '../drivers/target/fake.mts';
