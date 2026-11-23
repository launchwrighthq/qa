// The device `qa.target` drivers of qa-device (QA spec 2.8). The provider and the qa extension add
// them to the target registry of the core.
import type { QaConfig } from '../config.mts';
import type { QaTarget } from '../drivers/target/contract.mts';
import { createAndroidAdbTarget } from '../drivers/target/android-adb.mts';
import { createAndroidEmulatorTarget } from '../drivers/target/android-emulator.mts';
import { createBrowserstackTarget } from '../drivers/target/browserstack.mts';
import { createIosSimulatorTarget } from '../drivers/target/ios-simulator.mts';
import { createIosWebkitTarget } from '../drivers/target/ios-webkit.mts';
import { type DeviceDeps, systemDeviceDeps } from './process.mts';
import { createDeviceContext } from './rigs.mts';

/**
 * The device targets by driver name. They share one rig pool, so each ssh rig has one master.
 * `deps` defaults to real processes, sockets and fetch in the project at `root` (default: cwd).
 */
export function deviceTargets(config: QaConfig, deps: DeviceDeps = systemDeviceDeps(process.cwd())): Record<string, QaTarget> {
  const ctx = createDeviceContext(config, deps);
  return {
    'android-adb': createAndroidAdbTarget(ctx),
    'android-emulator': createAndroidEmulatorTarget(ctx),
    'ios-webkit': createIosWebkitTarget(ctx),
    'ios-simulator': createIosSimulatorTarget(ctx),
    browserstack: createBrowserstackTarget(ctx),
  };
}
