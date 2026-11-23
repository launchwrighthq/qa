import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { parseKeyguard } from '../../../../src/device/services/adb.mts';
import { collectDoctor, formatDoctor, parseScrcpyVersion, versionAtLeast } from '../../../../src/device/services/doctor.mts';
import { createDeviceContext } from '../../../../src/device/services/rigs.mts';
import { androidRunner, deviceConfig, failed, FakeSite, fakeDeps, keyguardText, ok, rigAnswer, ScriptedRunner } from '../../../support/device.mts';

const site = () => new FakeSite('https://app.test/site');

describe('lw qa device doctor checks', () => {
  it('reads the scrcpy version and compares it with the pin', () => {
    expect(parseScrcpyVersion('scrcpy 3.1 <https://github.com/Genymobile/scrcpy>\n')).toEqual([3, 1]);
    expect(versionAtLeast([3, 1], [3, 1])).toBe(true);
    expect(versionAtLeast([1, 25], [3, 1])).toBe(false);
    expect(versionAtLeast([4], [3, 1])).toBe(true);
  });

  it('passes an attached phone with adb, scrcpy and ffmpeg present', async () => {
    const run = androidRunner(site(), {
      other: (call) => {
        if (call.cmd === 'scrcpy') return 'scrcpy 3.1 <https://github.com/Genymobile/scrcpy>\n';
        if (call.cmd === 'ffmpeg') return 'ffmpeg version 7.1 Copyright (c) 2000-2024\n';
        return undefined;
      },
    });
    const config = deviceConfig({ devices: { phone: { rig: 'local', kind: 'android', serial: 'FAKE0SERIAL01' } } });
    const checks = await collectDoctor(createDeviceContext(config, fakeDeps({ root: await tmpDir(), run })));
    expect(checks.map((c) => [c.name, c.ok])).toEqual([
      ['adb', true],
      ['scrcpy', true],
      ['ffmpeg', true],
      ['pairing', true],
      ['screen lock', true],
    ]);
    expect(formatDoctor(checks).at(-1)).toBe('verdict: ready');
  });

  it('fails a phone whose lock screen holds a credential and never enters one', async () => {
    const run = androidRunner(site(), {
      keyguard: keyguardText(true, true),
      other: (call) => (call.cmd === 'scrcpy' ? 'scrcpy 3.1\n' : call.cmd === 'ffmpeg' ? 'ffmpeg version 7.1\n' : undefined),
    });
    const config = deviceConfig({ devices: { phone: { rig: 'local', kind: 'android', serial: 'FAKE0SERIAL01' } } });
    const checks = await collectDoctor(createDeviceContext(config, fakeDeps({ root: await tmpDir(), run })));
    expect(checks.find((c) => c.name === 'screen lock')).toMatchObject({
      ok: false,
      detail: 'locked with a PIN, pattern or password',
      fix: 'A person unlocks phone by hand. lw never enters a credential.',
    });
    expect(run.find('input text')).toHaveLength(0);
  });

  it('reads a swipe lock and a credential lock from dumpsys window policy', () => {
    expect([keyguardText(false, false), keyguardText(true, false), keyguardText(true, true)].map(parseKeyguard)).toEqual(['open', 'swipe', 'credential']);
  });

  it('names the fix for each failing tool and an unauthorized phone', async () => {
    const run = androidRunner(site(), {
      other: (call) => {
        if (call.cmd === 'scrcpy') return 'scrcpy 1.25 <https://github.com/Genymobile/scrcpy>\n';
        if (call.cmd === 'ffmpeg') return failed(-1, 'ffmpeg: spawn ffmpeg ENOENT');
        return undefined;
      },
    });
    const config = deviceConfig({ devices: { phone: { rig: 'local', kind: 'android', serial: 'FAKE0SERIAL02', recorder: 'scrcpy' } } });
    const checks = await collectDoctor(createDeviceContext(config, fakeDeps({ root: await tmpDir(), run })));
    const by = Object.fromEntries(checks.map((c) => [c.name, c]));
    expect(by.scrcpy).toMatchObject({ ok: false, detail: 'version 1.25 is older than 3.1' });
    expect(by.scrcpy?.optional).toBeUndefined();
    expect(by.ffmpeg?.fix).toMatch(/Install ffmpeg/);
    expect(by.pairing?.fix).toMatch(/unlock it and accept the USB debugging prompt/);
    const text = formatDoctor(checks);
    expect(text.at(-1)).toBe('verdict: 3 check(s) fail');
    expect(text.filter((l) => l.startsWith('     fix: '))).toHaveLength(3);
  });

  it('reports an unreachable rig once and skips its devices', async () => {
    const state = { master: false };
    const run = new ScriptedRunner((call) => {
      if (call.cmd === 'ffmpeg') return 'ffmpeg version 7.1\n';
      return rigAnswer(call, state, { sshOk: false });
    });
    const config = deviceConfig({
      rigs: { lab: { transport: 'ssh', host: 'rig-host', webkitPorts: [9221, 9222] } },
      devices: { iphone: { rig: 'lab', kind: 'ios' } },
    });
    const checks = await collectDoctor(createDeviceContext(config, fakeDeps({ root: await tmpDir(), run })));
    expect(checks.find((c) => c.scope === 'rig lab')).toMatchObject({ ok: false, fix: expect.stringContaining('ssh-copy-id') });
    expect(checks.find((c) => c.scope === 'device iphone')).toMatchObject({ name: 'rig', ok: false });
  });

  it('names the console command when ios_webkit_debug_proxy is not running', async () => {
    const state = { master: false };
    const run = new ScriptedRunner((call) => {
      if (call.cmd === 'ffmpeg') return 'ffmpeg version 7.1\n';
      return rigAnswer(call, state, { shell: (cmd) => (cmd.startsWith('command -v ios_webkit_debug_proxy') ? ok('/opt/homebrew/bin/ios_webkit_debug_proxy\n---\n       0\n') : undefined) });
    });
    const config = deviceConfig({
      rigs: { lab: { transport: 'ssh', host: 'rig-host', webkitPorts: [9221, 9222] } },
      devices: { iphone: { rig: 'lab', kind: 'ios' } },
    });
    const checks = await collectDoctor(createDeviceContext(config, fakeDeps({ root: await tmpDir(), run })));
    expect(checks.find((c) => c.name === 'ios_webkit_debug_proxy')?.fix).toContain('sudo ios_webkit_debug_proxy -c null:9221,:9222-9299');
  });

  it('reports a simulator as not ready and names the missing input tool', async () => {
    const state = { master: false };
    const run = new ScriptedRunner((call) => {
      if (call.cmd === 'ffmpeg') return 'ffmpeg version 7.1\n';
      return rigAnswer(call, state, { shell: (cmd) => (cmd.includes("'simctl' 'list' 'devices'") ? '-- iOS 18.6 --\n    iPhone Fixture 16 (FACE0001-0000-4000-8000-0000000000A1) (Booted) \n' : undefined) });
    });
    const config = deviceConfig({ devices: { sim: { rig: 'local', kind: 'ios-simulator' } } });
    const checks = await collectDoctor(createDeviceContext(config, fakeDeps({ root: await tmpDir(), run })));
    expect(checks.find((c) => c.name === 'simctl')?.ok).toBe(true);
    expect(checks.find((c) => c.name === 'input tool')).toMatchObject({ ok: false, fix: expect.stringContaining('qa.device.devices.sim.inputTool') });
  });
});
