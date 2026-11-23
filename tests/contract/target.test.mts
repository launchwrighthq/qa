// Every `qa.target` driver that runs without a process passes the contract here. The playwright
// driver runs the same suite in tests/integration/drivers/target/playwright.test.mts, since it
// starts a browser.
import { runContract } from '../../src/kernel/testing/index.mts';
import { tmpDir } from '../../src/kernel/testing/index.mts';
import { createFakeTarget } from '../../src/drivers/target/fake.mts';
import { CONTRACT_BASE, contractFakeRoutes, targetContract, targetHarness } from '../../src/testing/target-contract.mts';

const BASE_URL = `http://site.test${CONTRACT_BASE}`;

runContract(targetContract, () => targetHarness(createFakeTarget({ routes: contractFakeRoutes(), trace: true, dump: true }), { baseUrl: BASE_URL, outDir: tmpDir }));

runContract(targetContract, () =>
  targetHarness(createFakeTarget({ name: 'fake-still', capabilities: ['screenshot'], routes: contractFakeRoutes() }), {
    baseUrl: BASE_URL,
    outDir: tmpDir,
  }),
);
