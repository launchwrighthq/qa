import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { capabilities } from '../../../../src/device/services/browserstack.mts';
import { deviceKind, registerDeviceKind } from '../../../../src/device/services/device-kinds.mts';
import { collectDoctor } from '../../../../src/device/services/doctor.mts';
import { createDeviceContext } from '../../../../src/device/services/rigs.mts';
import { androidRunner, deviceConfig, FakeSite, fakeDeps } from '../../../support/device.mts';

// Fixture kinds of a project: no framework file names them.
registerDeviceKind('android-tv', { access: 'adb', target: 'android-adb' });
registerDeviceKind('android-chrome-beta', { access: 'webdriver', target: 'browserstack', browser: 'chrome', console: true });

describe('registerDeviceKind', () => {
  it('runs the adb checks of the doctor on a kind that a project registers', async () => {
    const run = androidRunner(new FakeSite('https://app.test/site'), {
      other: (call) => {
        if (call.cmd === 'scrcpy') return 'scrcpy 3.1 <https://github.com/Genymobile/scrcpy>\n';
        if (call.cmd === 'ffmpeg') return 'ffmpeg version 7.1 Copyright (c) 2000-2024\n';
        return undefined;
      },
    });
    const config = deviceConfig({ devices: { tv: { rig: 'local', kind: 'android-tv', serial: 'FAKE0SERIAL01' } } });
    const checks = await collectDoctor(createDeviceContext(config, fakeDeps({ root: await tmpDir(), run })));
    expect(checks.map((c) => [c.name, c.ok])).toEqual([
      ['adb', true],
      ['scrcpy', true],
      ['ffmpeg', true],
      ['pairing', true],
      ['screen lock', true],
    ]);
  });

  it('asks WebDriver for the browser and the console that a registered cloud kind declares', () => {
    const config = deviceConfig({ rigs: { browserstack: { transport: 'cloud' } }, devices: { beta: { rig: 'browserstack', kind: 'android-chrome-beta', model: 'Google Pixel 9', os: '15.0' } } });
    const caps = capabilities('android-chrome-beta', { model: 'Google Pixel 9', os: '15.0' }, config.device.browserstack, 'row');
    expect(caps).toMatchObject({ capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:loggingPrefs': { browser: 'ALL' } } } });
  });

  it('refuses a kind that no one registered', () => {
    expect(() => deviceKind('android-watch')).toThrow(expect.objectContaining({ code: 'qa.device.kind' }));
    expect(() => deviceConfig({ devices: { watch: { rig: 'local', kind: 'android-watch' } } })).toThrow(/registerDeviceKind/);
  });
});
