// The `android-emulator` qa.target driver (spec 2.8): an AVD on a rig. `open` boots it without a
// quick-boot snapshot when it is down; then it runs as `android-adb`. `lw qa device snapshot` and
// `restore` copy the AVD folder with `cp -c` on the rig.
import type { DeviceContext } from '../../services/rigs.mts';
import { AndroidTarget } from './android-adb.mts';
import type { QaTarget } from './contract.mts';

export function createAndroidEmulatorTarget(ctx: DeviceContext): QaTarget {
  return new AndroidTarget('android-emulator', ctx, true);
}
