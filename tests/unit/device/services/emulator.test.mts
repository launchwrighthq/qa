import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { emulatorDeviceKeys } from '../../../../src/device/config.mts';
import { createAdb } from '../../../../src/device/services/adb.mts';
import { bootEmulator, emulatorArgs, restoreAvd, snapshotAvd, stopEmulator } from '../../../../src/device/services/emulator.mts';
import { createRigPool } from '../../../../src/device/services/rigs.mts';
import { deviceConfig, failed, fakeDeps, ok, rigAnswer, ScriptedRunner, steppingClock } from '../../../support/device.mts';

const consolePort = 5554;
const keys = emulatorDeviceKeys.parse({ avd: 'fixture_avd', port: consolePort });
const config = deviceConfig({ rigs: { lab: { transport: 'ssh', host: 'rig-host', adbPort: 5038 } } });

/** A rig where the emulator boots after `bootAfter` polls. */
async function setup(opts: { booted?: boolean; bootAfter?: number; snapshots?: string[] } = {}) {
  const state = { master: false };
  let polls = 0;
  let up = opts.booted ?? false;
  let started = false;
  const run = new ScriptedRunner((call) => {
    if (call.cmd === 'adb') {
      const line = call.args.slice(4).join(' ');
      if (line === 'shell getprop sys.boot_completed') {
        polls += 1;
        if (started && polls > (opts.bootAfter ?? 1)) up = true;
        return up ? ok('1\n') : failed(1, 'error: device offline');
      }
      // adb emu dials the console on the machine of the adb client, where no emulator listens.
      if (line === 'emu kill') return failed(1, `error: could not connect to TCP port ${consolePort}: Connection refused`);
      return undefined;
    }
    return rigAnswer(call, state, {
      shell: (cmd) => {
        if (cmd.startsWith('for d in')) return '/Users/qa/Library/Android/sdk\n'; // a fake macOS path. publish-audit: allow
        if (cmd.startsWith('test -d "$HOME/.android/avd/fixture_avd.avd"')) return ok();
        if (cmd.includes('/emulator/emulator')) {
          started = true;
          return 'started\n';
        }
        if (cmd.startsWith('mkdir -p') && cmd.includes('cp -Rc')) return ok();
        if (cmd.startsWith('ls -1dt')) return `${(opts.snapshots ?? []).join('\n')}\n`;
        if (cmd.startsWith('rm -rf')) return ok();
        if (cmd === `adb -s 'emulator-${consolePort}' emu kill`) {
          up = false;
          return 'OK: killing emulator, bye bye\n';
        }
        return undefined;
      },
    });
  });
  const clock = steppingClock();
  const deps = fakeDeps({ root: await tmpDir(), run, clock });
  const rig = createRigPool(config, deps).get('lab');
  return { rig, adb: createAdb(rig, `emulator-${consolePort}`, deps, 'adb'), deps, run, clock };
}

describe('an Android emulator on a rig', () => {
  it('boots without loading or saving a quick-boot snapshot', () => {
    expect(emulatorArgs(keys)).toEqual(expect.arrayContaining(['-avd', 'fixture_avd', '-no-snapshot', '-no-window', '-no-boot-anim']));
    expect(emulatorArgs(keys)).not.toContain('-snapshot');
  });

  it('starts the AVD on the rig and waits for boot_completed', async () => {
    const ctx = await setup({ bootAfter: 3 });
    expect(await bootEmulator(ctx.rig, ctx.adb, keys, ctx.deps)).toBe('booted');
    const start = ctx.run.find('/emulator/emulator');
    expect(start[0]?.args.at(-1)).toContain(`'/Users/qa/Library/Android/sdk/emulator/emulator' '-avd' 'fixture_avd' '-port' '${consolePort}'`); // a fake macOS path. publish-audit: allow
    expect(ctx.clock.slept).toBeGreaterThan(0);
  });

  it('does nothing when the emulator already answers boot_completed', async () => {
    const ctx = await setup({ booted: true });
    expect(await bootEmulator(ctx.rig, ctx.adb, keys, ctx.deps)).toBe('already');
    expect(ctx.run.find('/emulator/emulator')).toHaveLength(0);
  });

  it('stops with adb emu kill on the rig, where the console listens, and waits for the flush', async () => {
    const ctx = await setup({ booted: true });
    await stopEmulator(ctx.rig, ctx.adb, ctx.deps);
    expect(ctx.run.calls.filter((c) => c.args.join(' ').includes('emu kill')).map((c) => c.cmd)).toEqual(['ssh']);
  });

  it('copies the AVD folder with cp -c into a dated snapshot', async () => {
    const ctx = await setup();
    const path = await snapshotAvd(ctx.rig, 'fixture_avd', 'signed in!', Date.parse('2026-11-12T10:00:00Z'));
    expect(path).toBe('.lw-qa/snapshots/fixture_avd-2026-11-12T10-00-00-signedin');
    expect(ctx.run.find('cp -Rc "$HOME/.android/avd/fixture_avd.avd"')).toHaveLength(1);
  });

  it('refuses a restore while the emulator runs', async () => {
    const ctx = await setup({ booted: true, snapshots: ['.lw-qa/snapshots/fixture_avd-1'] });
    await expect(restoreAvd(ctx.rig, ctx.adb, 'fixture_avd', undefined, true)).rejects.toThrow(/is running/);
  });

  it('refuses a restore over a possible Telegram sign-in without force', async () => {
    const ctx = await setup({ snapshots: ['.lw-qa/snapshots/fixture_avd-1'] });
    await expect(restoreAvd(ctx.rig, ctx.adb, 'fixture_avd', undefined, false)).rejects.toMatchObject({ code: 'qa.device.telegram.signed-in' });
    expect(ctx.run.find('rm -rf')).toHaveLength(0);
  });

  it('restores the newest snapshot with force', async () => {
    const ctx = await setup({ snapshots: ['.lw-qa/snapshots/fixture_avd-2', '.lw-qa/snapshots/fixture_avd-1'] });
    expect(await restoreAvd(ctx.rig, ctx.adb, 'fixture_avd', undefined, true)).toBe('.lw-qa/snapshots/fixture_avd-2');
    await expect(restoreAvd(ctx.rig, ctx.adb, 'fixture_avd', '/etc', true)).rejects.toThrow(/is not a snapshot of AVD fixture_avd/);
  });
});
