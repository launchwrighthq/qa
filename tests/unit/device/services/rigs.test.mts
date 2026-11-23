import { join } from 'node:path';
import { LaunchwrightError } from '../../../../src/kernel/index.mts';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { deviceTargets } from '../../../../src/device/index.mts';
import { controlPath, createRigPool, masterArgs, REMOTE_PATH, resolveDevice, SSH_SOCKET_DIR } from '../../../../src/device/services/rigs.mts';
import { deviceConfig, fakeDeps, rigAnswer, ScriptedRunner } from '../../../support/device.mts';

const adbPort = 5038;
const config = deviceConfig({
  rigs: { lab: { transport: 'ssh', host: 'rig-host', adbPort }, local: { transport: 'local' }, cloud: { transport: 'cloud' } },
  devices: {
    phone: { rig: 'lab', kind: 'android', serial: 'FAKE0SERIAL01' },
    lost: { rig: 'nowhere', kind: 'android', serial: 'FAKE0SERIAL02' },
  },
});

describe('rigs and devices from config', () => {
  it('resolves a device with its rig from qa.device', () => {
    const d = resolveDevice(config, 'phone');
    expect(d.rigName).toBe('lab');
    expect(d.rig.host).toBe('rig-host');
  });

  it('names every configured device when the name is unknown', () => {
    expect(() => resolveDevice(config, 'tablet')).toThrow(/No device tablet in qa.device.devices. Devices: lost, phone/);
  });

  it('refuses a device whose rig is not configured', () => {
    expect(() => resolveDevice(config, 'lost')).toThrow(expect.objectContaining({ code: 'qa.device.rig.unknown' }));
  });

  it('asks for --device when several devices are configured', () => {
    expect(() => resolveDevice(config, undefined)).toThrow(/Name a device with --device/);
  });

  it('builds the ssh master arguments with BatchMode and ExitOnForwardFailure', () => {
    expect(masterArgs('/p/x.sock', 'rig-host')).toEqual(
      expect.arrayContaining(['-M', '-S', '/p/x.sock', '-f', '-N', 'BatchMode=yes', 'ExitOnForwardFailure=yes', 'rig-host']),
    );
  });

  it('puts one control socket per project and rig in the home folder', () => {
    const path = controlPath('/srv/app', 'lab', '/home/user');
    expect(path).toMatch(new RegExp(`^${join('/home/user', SSH_SOCKET_DIR)}/[0-9a-f]{16}\\.sock$`));
    expect(new Set([path, controlPath('/srv/other', 'lab', '/home/user'), controlPath('/srv/app', 'lab2', '/home/user')]).size).toBe(3);
  });

  it('keeps the control socket short for a deep worktree path', () => {
    const worktree = `/home/user/${'w'.repeat(120)}/.claude/worktrees/qa/playground`;
    expect(Buffer.byteLength(controlPath(worktree, 'lab', '/home/user')) + '.0123456789abcdef'.length).toBeLessThan(104);
  });

  it('refuses a control socket path that a unix socket cannot bind', () => {
    expect(() => controlPath('/srv/app', 'lab', `/${'x'.repeat(80)}`)).toThrow(expect.objectContaining({ code: 'qa.device.ssh.path' }));
  });
});

describe('one ssh master per rig', () => {
  it('opens one master and sends every command and forward through it', async () => {
    const state = { master: false };
    const run = new ScriptedRunner((call) => rigAnswer(call, state, { shell: () => 'ok\n' }));
    const root = await tmpDir();
    const pool = createRigPool(config, fakeDeps({ root, run }));
    const rig = pool.get('lab');
    expect(pool.get('lab')).toBe(rig);
    await rig.exec('uname');
    await rig.exec('true');
    const page = await rig.forward(9222);
    expect(await rig.forward(9222)).toBe(page);
    expect(await rig.adbServer()).toEqual(['-L', `tcp:127.0.0.1:${adbPort}`]);
    const ctl = controlPath(root, 'lab');
    expect(run.calls.filter((c) => c.args[0] === '-M')).toHaveLength(1);
    expect(run.find(`-S ${ctl} -O forward -L ${page}:127.0.0.1:9222 rig-host`)).toHaveLength(1);
    expect(run.find(`-S ${ctl} -O forward -L ${adbPort}:127.0.0.1:5037 rig-host`)).toHaveLength(1);
    const exec = run.find(`-S ${ctl} -o BatchMode=yes rig-host`);
    expect(exec).toHaveLength(2);
    expect(exec[0]?.args.at(-1)).toBe(`${REMOTE_PATH}; uname`);
  });

  it('names the fix when the rig asks for a password', async () => {
    const state = { master: false };
    const run = new ScriptedRunner((call) => rigAnswer(call, state, { sshOk: false }));
    const rig = createRigPool(config, fakeDeps({ root: await tmpDir(), run })).get('lab');
    const err = await rig.exec('true').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LaunchwrightError);
    expect((err as LaunchwrightError).code).toBe('qa.device.ssh');
    expect((err as Error).message).toMatch(/BatchMode=yes refuses a password.*ssh-copy-id/);
  });

  it('closes the master on down and opens a new one after it', async () => {
    const state = { master: false };
    const run = new ScriptedRunner((call) => rigAnswer(call, state, { shell: () => '' }));
    const pool = createRigPool(config, fakeDeps({ root: await tmpDir(), run }));
    await pool.get('lab').exec('true');
    await pool.downAll();
    expect(state.master).toBe(false);
    await pool.get('lab').exec('true');
    expect(run.calls.filter((c) => c.args[0] === '-M')).toHaveLength(2);
  });

  it('runs a local rig command with sh and keeps its ports', async () => {
    const run = new ScriptedRunner((call) => (call.cmd === 'sh' ? 'here\n' : undefined));
    const rig = createRigPool(config, fakeDeps({ root: await tmpDir(), run })).get('local');
    expect((await rig.exec('echo here')).stdout.toString()).toBe('here\n');
    expect(await rig.forward(9222)).toBe(9222);
    expect(await rig.adbServer()).toEqual([]);
  });

  it('refuses a shell on a cloud rig', async () => {
    const rig = createRigPool(config, fakeDeps({ root: await tmpDir() })).get('cloud');
    await expect(rig.exec('true')).rejects.toMatchObject({ code: 'qa.device.rig.cloud' });
  });
});

describe('the device targets of the registry', () => {
  it('gives the five device drivers at qa.target spec version 1', async () => {
    const targets = deviceTargets(config, fakeDeps({ root: await tmpDir() }));
    expect(Object.keys(targets).sort()).toEqual(['android-adb', 'android-emulator', 'browserstack', 'ios-simulator', 'ios-webkit']);
    for (const t of Object.values(targets)) expect(t.specVersion).toBe('1');
    expect(targets['ios-webkit']?.supports('video')).toBe(false);
    expect(targets['ios-webkit']?.supports('input')).toBe(false);
    expect(targets['ios-simulator']?.supports('input')).toBe(false);
    expect(targets['android-adb']?.supports('native')).toBe(true);
  });
});
