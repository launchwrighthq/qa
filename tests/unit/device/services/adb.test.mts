import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import {
  chooseSocket,
  createAdb,
  devtoolsSockets,
  findNode,
  parseDevices,
  parseExistingForward,
  parseNodes,
  parseWmSize,
  processNameFromCmdline,
  screencap,
  screenrecordArgs,
  screenSize,
  sockets,
  startScreenrecord,
} from '../../../../src/device/services/adb.mts';
import { createRigPool } from '../../../../src/device/services/rigs.mts';
import { androidRunner, deviceBytes, deviceConfig, deviceText, failed, FakeSite, fakeDeps, ScriptedRunner } from '../../../support/device.mts';

describe('adb output parsers on recorded output', () => {
  it('keeps every adb device state, unauthorized and offline included', () => {
    expect(parseDevices(deviceText('adb-devices.txt'))).toEqual([
      { serial: 'FAKE0SERIAL01', state: 'device' },
      { serial: 'FAKE0SERIAL02', state: 'unauthorized' },
      { serial: 'emulator-5554', state: 'device' },
      { serial: 'emulator-5556', state: 'offline' },
    ]);
  });

  it('reads one devtools socket per name with the listener winning', () => {
    const found = devtoolsSockets(deviceText('proc-net-unix.txt'));
    expect(found.map((s) => s.name)).toEqual(['webview_devtools_remote_4821', 'webview_devtools_remote_5119', 'chrome_devtools_remote']);
    expect(found[0]).toMatchObject({ pid: 4821, kind: 'webview', listening: true });
    expect(found[2]).toMatchObject({ pid: null, kind: 'other' });
  });

  it('trims the carriage return that adb shell adds to a socket name', () => {
    const crlf = deviceText('proc-net-unix.txt').replaceAll('\n', '\r\n');
    expect(devtoolsSockets(crlf)[0]?.name).toBe('webview_devtools_remote_4821');
  });

  it('reads the process name from a NUL separated cmdline', () => {
    expect(processNameFromCmdline('org.telegram.messenger.web\0--type=x\0')).toBe('org.telegram.messenger.web');
  });

  it('ranks the package sockets before other WebViews', () => {
    const ranked = chooseSocket(
      [
        { name: 'chrome_devtools_remote', pid: null, kind: 'other', listening: true, process: null },
        { name: 'webview_devtools_remote_5119', pid: 5119, kind: 'webview', listening: true, process: 'com.example.other' },
        { name: 'webview_devtools_remote_4821', pid: 4821, kind: 'webview', listening: true, process: 'org.telegram.messenger.web:sandboxed' },
      ],
      'org.telegram.messenger.web',
    );
    expect(ranked.map((s) => s.pid)).toEqual([4821, 5119, null]);
  });

  it('reuses the port of an existing forward of the same socket', () => {
    const listing = 'FAKE0SERIAL01 tcp:41235 localabstract:webview_devtools_remote_4821\nFAKE0SERIAL01 tcp:41240 localabstract:chrome_devtools_remote\n';
    expect(parseExistingForward(listing, 'chrome_devtools_remote')).toBe(41240);
    expect(parseExistingForward(listing, 'webview_devtools_remote_9')).toBeNull();
  });

  it('reads controls and their bounds from a uiautomator dump', () => {
    const nodes = parseNodes(deviceText('uiautomator.xml'));
    expect(findNode(nodes, 'Open App')?.text).toBe('Open App');
    expect(findNode(nodes, 'Send & schedule')?.bounds).toEqual({ x1: 930, y1: 2250, x2: 1080, y2: 2400 });
    expect(screenSize(nodes)).toEqual({ width: 1080, height: 2400 });
  });

  it('reads the override size of wm size before the physical size', () => {
    expect(parseWmSize('Physical size: 1080x2400\nOverride size: 720x1600\n')).toEqual({ width: 720, height: 1600 });
    expect(parseWmSize('Physical size: 1080x2400\n')).toEqual({ width: 1080, height: 2400 });
  });

  it('caps one screenrecord clip at the 180 second recorder limit', () => {
    expect(screenrecordArgs(400, '/sdcard/x.mp4')).toEqual(['shell', 'screenrecord', '--time-limit', '180', '/sdcard/x.mp4']);
    expect(screenrecordArgs(170, '/sdcard/x.mp4', '540x1200')).toContain('540x1200');
  });
});

describe('adb against one device', () => {
  const config = deviceConfig({ devices: { phone: { rig: 'local', kind: 'android', serial: 'FAKE0SERIAL01' } } });

  it('names each socket with the process that published it', async () => {
    const site = new FakeSite('http://qa-site.test/site');
    const deps = fakeDeps({ root: await tmpDir(), run: androidRunner(site) });
    const adb = createAdb(createRigPool(config, deps).get('local'), 'FAKE0SERIAL01', deps, 'adb');
    const found = await sockets(adb, 'org.telegram.messenger.web');
    expect(found[0]).toMatchObject({ name: 'webview_devtools_remote_4821', process: 'org.telegram.messenger.web' });
  });

  it('refuses screencap bytes that are not a PNG', async () => {
    const deps = fakeDeps({ root: await tmpDir(), run: new ScriptedRunner(() => 'not a png') });
    const adb = createAdb(createRigPool(config, deps).get('local'), 'FAKE0SERIAL01', deps, 'adb');
    await expect(screencap(adb)).rejects.toMatchObject({ code: 'qa.device.screencap' });
  });

  it('stops screenrecord with SIGINT on the device and pulls an MP4', async () => {
    const site = new FakeSite('http://qa-site.test/site');
    const run = androidRunner(site);
    const deps = fakeDeps({ root: await tmpDir(), run });
    const adb = createAdb(createRigPool(config, deps).get('local'), 'FAKE0SERIAL01', deps, 'adb');
    const rec = await startScreenrecord(adb, deps, 30, 'leg-row.mp4');
    const bytes = await rec.stop();
    expect(bytes.equals(deviceBytes('clip.mp4'))).toBe(true);
    expect(run.find('pkill -INT -x screenrecord')).toHaveLength(1);
    expect(run.find('screenrecord --time-limit 30 /sdcard/lw-qa-leg-row.mp4')).toHaveLength(1);
  });

  it('refuses a pulled recording that is empty', async () => {
    const run = new ScriptedRunner((call) => (call.args.join(' ').includes('exec-out cat /sdcard') ? failed(1, 'No such file') : ''));
    const deps = fakeDeps({ root: await tmpDir(), run });
    const adb = createAdb(createRigPool(config, deps).get('local'), 'FAKE0SERIAL01', deps, 'adb');
    const rec = await startScreenrecord(adb, deps, 5, 'x');
    run.endAll();
    await expect(rec.stop()).rejects.toMatchObject({ code: 'qa.device.record' });
  });
});
