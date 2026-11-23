import { CONFIG, provider } from '../kernel/index.mts';
import { QA_TARGETS, type QaConfig } from '../index.mts';
import { withDevice } from './config.mts';
import { deviceTargets } from './services/targets.mts';

/**
 * Adds the device targets to `QA_TARGETS` of the `qa` module at boot. Boot fails with the cause
 * `qa.device.config` when key `qa.device` of config section `qa` is not valid.
 */
export const qaDeviceProvider = provider({
  name: 'qa-device',
  requires: ['kernel', 'qa'],
  register: () => undefined,
  boot(app) {
    const config = withDevice(app.get(CONFIG).section<QaConfig>('qa'));
    app.get(QA_TARGETS).add(deviceTargets(config));
  },
});
