// The qa extension of qa-device: the device targets and `lw qa device`. The `lw qa` command loads
// it from the project folder when the project config has section `qa-device`.
import type { QaExtension } from '@launchwrighthq/qa';
import { withDevice } from '../config.mts';
import { systemDeviceDeps } from './process.mts';
import { deviceTargets } from './targets.mts';

export const qaExtension: QaExtension = {
  name: 'qa-device',
  subcommands: { device: async () => (await import('../commands/qa-device.mts')).default },
  targets: (config, root) => deviceTargets(withDevice(config), systemDeviceDeps(root)),
};
