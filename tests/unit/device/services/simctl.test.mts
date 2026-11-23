import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { createRigPool } from '../../../../src/device/services/rigs.mts';
import { bootedSimulator, openUrl, parseSimList } from '../../../../src/device/services/simctl.mts';
import { deviceConfig, deviceText, FakeSite, fakeDeps, rigAnswer, ScriptedRunner, simctlShell } from '../../../support/device.mts';

describe('xcrun simctl on a rig', () => {
  it('reads simulators by udid with the runtime, the state and availability', () => {
    const sims = parseSimList(deviceText('simctl-list.txt'));
    expect(sims).toHaveLength(3);
    expect(sims[0]).toMatchObject({ name: 'iPhone Fixture 16', runtime: 'iOS 18.6', booted: true, available: true });
    expect(sims[2]).toMatchObject({ state: 'Shutdown', available: false });
  });

  it('finds the one booted simulator when the device names no udid', async () => {
    const state = { master: false };
    const run = new ScriptedRunner((call) => rigAnswer(call, state, { shell: simctlShell(new FakeSite('https://app.test/site')) }));
    const rig = createRigPool(deviceConfig({}), fakeDeps({ root: await tmpDir(), run })).get('local');
    expect((await bootedSimulator(rig)).udid).toBe('FACE0001-0000-4000-8000-0000000000A1');
    await expect(bootedSimulator(rig, 'FACE0002-0000-4000-8000-0000000000A2')).rejects.toThrow(/Booting one is an operator step/);
  });

  it('refuses a tg link because the simulator may hold a signed-in Telegram', async () => {
    const run = new ScriptedRunner(() => '');
    const rig = createRigPool(deviceConfig({}), fakeDeps({ root: await tmpDir(), run })).get('local');
    await expect(openUrl(rig, 'booted', 'tg://resolve?domain=fixture_bot')).rejects.toThrow(/takes an http\(s\) URL, not tg:/);
    expect(run.calls).toHaveLength(0);
  });
});
