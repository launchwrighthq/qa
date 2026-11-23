// The device `qa.target` drivers pass the target contract suite (spec 2.8, R12) against recorded
// transports: adb output, uiautomator XML, CDP frames, WebKit inspector frames, simctl output and
// W3C WebDriver answers. No device, rig, ssh or BrowserStack is reached. The fake of `qa` runs
// here too, as the fake of this driver folder.
import { runContract } from '../../../src/kernel/testing/index.mts';
import { CONTRACT_BASE, contractFakeRoutes, targetContract, targetHarness } from '../../../src/testing/index.mts';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { createAndroidAdbTarget } from '../../../src/device/drivers/target/android-adb.mts';
import { createAndroidEmulatorTarget } from '../../../src/device/drivers/target/android-emulator.mts';
import { createBrowserstackTarget } from '../../../src/device/drivers/target/browserstack.mts';
import { createIosSimulatorTarget } from '../../../src/device/drivers/target/ios-simulator.mts';
import { createIosWebkitTarget } from '../../../src/device/drivers/target/ios-webkit.mts';
import type { QaTarget } from '../../../src/device/drivers/target/contract.mts';
import { createFakeTarget } from '../../../src/device/drivers/target/fake.mts';
import { createDeviceContext } from '../../../src/device/services/rigs.mts';
import {
  androidRunner,
  BS_KEY,
  BS_USER,
  cdpSockets,
  deviceConfig,
  devtoolsFetch,
  FakeSite,
  fakeDeps,
  rigAnswer,
  ScriptedRunner,
  simctlShell,
  webDriverFetch,
  webkitSockets,
} from '../../support/device.mts';

const BASE_URL = `http://qa-site.test${CONTRACT_BASE}`;

const viewport = { width: 390, height: 844 };
const consolePort = 5554;

async function harness(target: QaTarget, device: string) {
  return targetHarness(target, { baseUrl: BASE_URL, outDir: tmpDir, leg: { name: 'contract', surface: 'web', target: target.name, device, viewport } });
}

runContract(targetContract, () => targetHarness(createFakeTarget({ routes: contractFakeRoutes() }), { baseUrl: BASE_URL, outDir: tmpDir }));

runContract(targetContract, async () => {
  const site = new FakeSite(BASE_URL);
  const config = deviceConfig({ devices: { phone: { rig: 'local', kind: 'android', serial: 'FAKE0SERIAL01' } } });
  const deps = fakeDeps({ root: await tmpDir(), run: androidRunner(site), socket: cdpSockets(site), fetch: devtoolsFetch(site) });
  return harness(createAndroidAdbTarget(createDeviceContext(config, deps)), 'phone');
});

runContract(targetContract, async () => {
  const site = new FakeSite(BASE_URL);
  const config = deviceConfig({
    rigs: { lab: { transport: 'ssh', host: 'rig-host', adbPort: 5038 } },
    devices: { avd: { rig: 'lab', kind: 'android-emulator', avd: 'fixture_avd', port: consolePort } },
  });
  const deps = fakeDeps({ root: await tmpDir(), run: androidRunner(site), socket: cdpSockets(site), fetch: devtoolsFetch(site) });
  return harness(createAndroidEmulatorTarget(createDeviceContext(config, deps)), 'avd');
});

runContract(targetContract, async () => {
  const site = new FakeSite(BASE_URL);
  const state = { master: false };
  const config = deviceConfig({
    rigs: { lab: { transport: 'ssh', host: 'rig-host', webkitPorts: [9221, 9222] } },
    devices: { iphone: { rig: 'lab', kind: 'ios', udid: 'FAKE-UDID-0001' } },
  });
  // The ssh master forwards the rig list port 9221 to :41001 and the page port 9222 to :41002.
  const fetch = devtoolsFetch(site, { lists: { 41001: 9222 }, pages: [41002] });
  const deps = fakeDeps({ root: await tmpDir(), run: new ScriptedRunner((call) => rigAnswer(call, state, {})), socket: webkitSockets(site), fetch });
  return harness(createIosWebkitTarget(createDeviceContext(config, deps)), 'iphone');
});

runContract(targetContract, async () => {
  const site = new FakeSite(BASE_URL);
  const state = { master: false };
  const config = deviceConfig({
    devices: { sim: { rig: 'local', kind: 'ios-simulator', udid: 'FACE0001-0000-4000-8000-0000000000A1', inspectorPort: 9321 } },
  });
  const run = new ScriptedRunner((call) => rigAnswer(call, state, { shell: simctlShell(site) }));
  const deps = fakeDeps({ root: await tmpDir(), run, socket: webkitSockets(site), fetch: devtoolsFetch(site, { lists: { 9321: 9222 } }) });
  return harness(createIosSimulatorTarget(createDeviceContext(config, deps)), 'sim');
});

// Chrome on a cloud Android phone: its console comes through chromedriver `se/log`. Safari on a
// cloud iPhone has no console over WebDriver, so its `logs` refuses; the unit tests cover that case.
runContract(targetContract, async () => {
  const site = new FakeSite(BASE_URL);
  const config = deviceConfig({
    rigs: { local: { transport: 'local' }, browserstack: { transport: 'cloud' } },
    devices: { 'bs-pixel': { rig: 'browserstack', kind: 'android-chrome', model: 'Google Pixel 9', os: '15.0' } },
    browserstack: { username: BS_USER, accessKey: BS_KEY },
  });
  const deps = fakeDeps({ root: await tmpDir(), fetch: webDriverFetch(site) });
  return harness(createBrowserstackTarget(createDeviceContext(config, deps)), 'bs-pixel');
});
