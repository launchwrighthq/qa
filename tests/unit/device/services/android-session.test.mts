import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { afterEach, describe, expect, it } from 'vitest';
import { deviceTargets } from '../../../../src/device/index.mts';
import { MIN_CLIP_MS } from '../../../../src/device/services/android-session.mts';
import type { QaSession } from '../../../../src/device/drivers/target/contract.mts';
import type { Leg } from '../../../../src/index.mts';
import { type AndroidScript, androidRunner, cdpSockets, deviceConfig, devtoolsFetch, FakeSite, fakeDeps } from '../../../support/device.mts';

const BASE = 'https://dev-app.tunnel.test/site';
const sessions: QaSession[] = [];

afterEach(async () => {
  for (const s of sessions.splice(0)) await s.close();
});

const miniapp: Leg = { name: 'telegram-android', surface: 'miniapp', target: 'android-adb', device: 'phone', bot: 'fixture_qa_bot' };

async function setup(script: AndroidScript = {}, serial = 'FAKE0SERIAL01') {
  const site = new FakeSite(BASE);
  const run = androidRunner(site, script);
  const config = deviceConfig({ devices: { phone: { rig: 'local', kind: 'android', serial } } });
  const targets = deviceTargets(config, fakeDeps({ root: await tmpDir(), run, socket: cdpSockets(site), fetch: devtoolsFetch(site) }));
  return { site, run, target: targets['android-adb'], sim: targets['ios-simulator'] };
}

describe('an Android session in real Telegram', () => {
  it('opens the main Mini App of the leg bot and moves by pushState', async () => {
    const { site, run, target } = await setup();
    const s = await target!.open({ leg: miniapp, baseUrl: BASE, outDir: await tmpDir() });
    sessions.push(s);
    expect(run.find("-d 'tg://resolve?domain=fixture_qa_bot&startapp=lw' org.telegram.messenger.web")).toHaveLength(1);
    const loads = site.loads;
    await s.navigate('/next');
    expect(await s.currentRoute()).toBe('/next');
    expect(site.loads).toBe(loads);
  });

  it('names the WebView debug switch when Telegram publishes no devtools socket', async () => {
    const { target } = await setup({ netUnix: 'Num       RefCount Protocol Flags    Type St Inode Path\n' });
    await expect(target!.open({ leg: miniapp, baseUrl: BASE, outDir: await tmpDir() })).rejects.toMatchObject({
      code: 'qa.device.webview',
      message: expect.stringContaining('press and hold the version number twice'),
    });
  });

  it('never attaches a web leg to the Stetho socket of another app', async () => {
    const netUnix = [
      'Num       RefCount Protocol Flags    Type St Inode Path',
      '0000000000000000: 00000002 00000000 00010000 0001 01 15371 @stetho_com.google.android.apps.messaging_devtools_remote',
      '',
    ].join('\n');
    const { target } = await setup({ netUnix });
    await expect(target!.open({ leg: { ...miniapp, surface: 'web' }, baseUrl: BASE, outDir: await tmpDir() })).rejects.toMatchObject({
      code: 'qa.device.webview',
      message: expect.stringContaining('first-run screens'),
    });
  });

  it('refuses a Mini App leg when Telegram is not installed', async () => {
    const { target } = await setup({ installed: false });
    await expect(target!.open({ leg: miniapp, baseUrl: BASE, outDir: await tmpDir() })).rejects.toMatchObject({
      code: 'qa.target.not-ready',
      message: expect.stringContaining('lw qa device install --device phone'),
    });
  });

  it('refuses a screenshot when the driven page is no longer the one on screen', async () => {
    const { site, target } = await setup();
    const s = await target!.open({ leg: { ...miniapp, surface: 'web' }, baseUrl: BASE, outDir: await tmpDir() });
    sessions.push(s);
    const evaluate = site.evaluate.bind(site);
    site.evaluate = (expr: string) => (expr === 'document.visibilityState' ? 'hidden' : evaluate(expr));
    await expect(s.screenshot(`${await tmpDir()}/x.png`)).rejects.toThrow(/is hidden on FAKE0SERIAL01: the screenshot would show another page/);
  });

  it('holds the last frame of a clip until the wall-clock end of the recording', async () => {
    const { run, target } = await setup();
    const s = await target!.open({ leg: { ...miniapp, surface: 'web' }, baseUrl: BASE, outDir: await tmpDir() });
    sessions.push(s);
    const path = `${await tmpDir()}/leg-row.mp4`;
    await s.startVideo(path);
    await s.act({ kind: 'wait', ms: 2000, why: 'the row holds a still page' });
    const clip = await s.stopVideo();
    const ffmpeg = run.calls.filter((c) => c.cmd === 'ffmpeg');
    const seconds = (clip.durationMs / 1000).toFixed(3);
    expect(clip.durationMs).toBeGreaterThanOrEqual(2000);
    expect(ffmpeg.map((c) => [c.args[c.args.indexOf('-vf') + 1], c.args[c.args.indexOf('-t') + 1]])).toEqual([[`tpad=stop_mode=clone:stop_duration=${seconds}`, seconds]]);
  });

  it('keeps recording a row that settles at once until the clip reaches the minimum', async () => {
    const { target } = await setup();
    const s = await target!.open({ leg: { ...miniapp, surface: 'web' }, baseUrl: BASE, outDir: await tmpDir() });
    sessions.push(s);
    await s.startVideo(`${await tmpDir()}/leg-row.mp4`);
    const clip = await s.stopVideo();
    expect(clip.durationMs).toBeGreaterThanOrEqual(MIN_CLIP_MS);
  });

  it('writes the uiautomator dump of the screen', async () => {
    const { target } = await setup();
    const s = await target!.open({ leg: { ...miniapp, surface: 'web' }, baseUrl: BASE, outDir: await tmpDir() });
    sessions.push(s);
    const path = `${await tmpDir()}/leg-row.ui.xml`;
    expect(await s.dump(path)).toBe(path);
  });
});

describe('device target readiness', () => {
  it('names the fix of an unauthorized phone', async () => {
    const { target } = await setup({}, 'FAKE0SERIAL02');
    expect(await target!.ready(miniapp)).toEqual({ ready: false, reason: expect.stringContaining('accept the USB debugging prompt') });
  });

  it('names the missing device key of a leg', async () => {
    const { target } = await setup();
    expect((await target!.ready({ ...miniapp, device: undefined })).reason).toBe('Leg telegram-android names no device. Set qa.legs.telegram-android.device to a qa.device.devices name.');
  });

  it('keeps the simulator not ready until an input tool is configured', async () => {
    const site = new FakeSite(BASE);
    const config = deviceConfig({ devices: { sim: { rig: 'local', kind: 'ios-simulator' }, simtap: { rig: 'local', kind: 'ios-simulator', inputTool: 'fixture-tapper' } } });
    const targets = deviceTargets(config, fakeDeps({ root: await tmpDir(), run: androidRunner(site) }));
    const leg: Leg = { name: 'safari-sim', surface: 'web', target: 'ios-simulator', device: 'sim' };
    expect(await targets['ios-simulator']!.ready(leg)).toEqual({ ready: false, reason: expect.stringContaining('qa.device.devices.sim.inputTool') });
    expect(await targets['ios-simulator']!.ready({ ...leg, device: 'simtap' })).toEqual({ ready: true });
  });
});
