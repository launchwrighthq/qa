import { readFile } from 'node:fs/promises';
import { redirectTrap } from '../../../../src/kernel/testing/index.mts';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { recordedFetch } from '../../../support/recorded-fetch.mts';
import { afterEach, describe, expect, it } from 'vitest';
import { createBrowserstackTarget } from '../../../../src/device/drivers/target/browserstack.mts';
import type { QaSession } from '../../../../src/device/drivers/target/contract.mts';
import {
  asyncScript,
  budget,
  budgetLine,
  capabilities,
  checkBudget,
  createBrowserstackClient,
  readHeld,
} from '../../../../src/device/services/browserstack.mts';
import { createDeviceContext } from '../../../../src/device/services/rigs.mts';
import { BS_KEY, BS_USER, deviceConfig, FakeSite, fakeDeps, fixturePath, steppingClock, webDriverFetch } from '../../../support/device.mts';

const devices = {
  'bs-iphone': { rig: 'browserstack', kind: 'ios-safari', model: 'iPhone 16', os: '18' },
  'bs-pixel': { rig: 'browserstack', kind: 'android-chrome', model: 'Google Pixel 9', os: '15.0' },
};
const config = (extra: Record<string, unknown> = {}) =>
  deviceConfig({ rigs: { browserstack: { transport: 'cloud' } }, devices, browserstack: { username: BS_USER, accessKey: BS_KEY, ...extra } });
const leg = (device: string) => ({ name: 'safari-ios', surface: 'web' as const, target: 'browserstack', device });
const sessions: QaSession[] = [];

afterEach(async () => {
  for (const s of sessions.splice(0)) await s.close();
});

describe('BrowserStack minutes and keys', () => {
  it('sums the minutes of every recorded session', async () => {
    const cfg = config().device.browserstack;
    const client = createBrowserstackClient(cfg, fakeDeps({ root: await tmpDir(), fetch: recordedFetch(fixturePath('http/browserstack/budget.json')) }));
    const s = await budget(client);
    expect(s).toEqual({ plan: 'Free', sessions: 2, minutes: 4.2, billedMinutes: 5, running: 0, parallel: 1 });
    expect(budgetLine(s, cfg)).toBe('Automate plan Free: 4.2 min used over 2 session(s), 5 min rounded up; 0 of 1 parallel running; per-run budget 5 min');
  });

  it('refuses a client without keys and names the secret store keys', () => {
    const cfg = deviceConfig({}).device.browserstack;
    expect(() => createBrowserstackClient(cfg, fakeDeps({ root: '/x' }))).toThrow(/BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY/);
  });

  it('sends the keys only in the Authorization header', async () => {
    const site = new FakeSite('https://app.test/site');
    const fetch = webDriverFetch(site);
    const target = createBrowserstackTarget(createDeviceContext(config(), fakeDeps({ root: await tmpDir(), fetch })));
    const s = await target.open({ leg: leg('bs-iphone'), baseUrl: 'https://app.test/site', outDir: await tmpDir() });
    await s.navigate('/next');
    await s.close();
    for (const call of fetch.calls) {
      expect(call.auth).toBe(`Basic ${Buffer.from(`${BS_USER}:${BS_KEY}`).toString('base64')}`);
      expect(call.body).not.toContain(BS_KEY);
      expect(call.path).not.toContain(BS_KEY);
    }
  });

  it('refuses a redirect and sends the keys to no other host', async () => {
    const trap = await redirectTrap();
    const client = createBrowserstackClient(config({ api: trap.origin }).device.browserstack, fakeDeps({ root: await tmpDir(), fetch: (input, init) => fetch(input, init) }));
    await expect(client.api('/plan.json')).rejects.toMatchObject({ code: 'qa.device.browserstack.redirect', context: { status: 302 } });
    expect(trap.reached).toEqual([]);
  });

  it('asks for the device by model and os without the keys in the body', () => {
    const caps = capabilities('ios-safari', { model: 'iPhone 16', os: '18' }, config().device.browserstack, 'row');
    expect(JSON.stringify(caps)).not.toContain(BS_KEY);
    expect(caps).toMatchObject({ capabilities: { alwaysMatch: { browserName: 'safari', 'bstack:options': { deviceName: 'iPhone 16', osVersion: '18', realMobile: 'true', idleTimeout: 120 } } } });
  });

  it('splices the expression into the async script and awaits a promise', () => {
    expect(asyncScript('location.href;')).toContain('return (\nlocation.href\n);');
  });

  it('declares both keys for the run contract as set or empty, never with a value (spec 2.6)', async () => {
    const root = await tmpDir();
    const set = createBrowserstackTarget(createDeviceContext(config(), fakeDeps({ root }))).needs?.(leg('bs-iphone'));
    expect(set?.credentials?.map((c) => [c.key, c.present, c.legs])).toEqual([
      ['BROWSERSTACK_USERNAME', true, ['safari-ios']],
      ['BROWSERSTACK_ACCESS_KEY', true, ['safari-ios']],
    ]);
    expect(JSON.stringify(set)).not.toContain(BS_KEY);
    const empty = createBrowserstackTarget(createDeviceContext(deviceConfig({ devices }), fakeDeps({ root }))).needs?.(leg('bs-iphone'));
    expect(empty?.credentials?.map((c) => c.present)).toEqual([false, false]);
  });
});

describe('the per-run minute budget', () => {
  it('fails once a run passes its budget minutes', () => {
    const cfg = config({ budgetMinutes: 5 }).device.browserstack;
    expect(() => checkBudget(0, 4 * 60_000, cfg)).not.toThrow();
    expect(() => checkBudget(0, 6 * 60_000, cfg)).toThrow(expect.objectContaining({ code: 'qa.device.browserstack.budget' }));
  });

  it('closes the session when a call comes after the budget', async () => {
    const site = new FakeSite('https://app.test/site');
    const fetch = webDriverFetch(site);
    const clock = steppingClock();
    const root = await tmpDir();
    const target = createBrowserstackTarget(createDeviceContext(config({ budgetMinutes: 1 }), fakeDeps({ root, fetch, clock })));
    const s = await target.open({ leg: leg('bs-iphone'), baseUrl: 'https://app.test/site', outDir: await tmpDir() });
    expect(await readHeld(root)).toMatchObject({ device: 'bs-iphone' });
    await clock.sleep(2 * 60_000);
    await expect(s.navigate('/next')).rejects.toMatchObject({ code: 'qa.device.browserstack.budget' });
    expect(fetch.calls.at(-1)).toMatchObject({ method: 'DELETE' });
    expect(await readHeld(root)).toBeNull();
    expect((await target.ready(leg('bs-iphone'))).ready).toBe(false);
  });
});

describe('the console of a cloud phone', () => {
  it('refuses the log of iOS Safari rather than giving an empty one', async () => {
    const site = new FakeSite('https://app.test/site');
    const target = createBrowserstackTarget(createDeviceContext(config(), fakeDeps({ root: await tmpDir(), fetch: webDriverFetch(site) })));
    const s = await target.open({ leg: leg('bs-iphone'), baseUrl: 'https://app.test/site', outDir: await tmpDir() });
    sessions.push(s);
    await expect(s.logs()).rejects.toMatchObject({ code: 'qa.target.capability' });
  });

  it('keeps the Chrome console of a session that a video clip ended', async () => {
    const site = new FakeSite('https://app.test/site');
    const target = createBrowserstackTarget(createDeviceContext(config(), fakeDeps({ root: await tmpDir(), fetch: webDriverFetch(site) })));
    const dir = await tmpDir();
    const s = await target.open({ leg: leg('bs-pixel'), baseUrl: 'https://app.test/site', outDir: dir });
    sessions.push(s);
    await s.startVideo(`${dir}/row.mp4`);
    await s.navigate('/errors');
    await s.stopVideo();
    expect(new Set((await s.logs()).map((l) => l.kind))).toEqual(new Set(['page-error', 'console-error', 'response-5xx']));
  });

  it('waits for the stored film when the video URL first answers NoSuchKey', async () => {
    const site = new FakeSite('https://app.test/site');
    const target = createBrowserstackTarget(createDeviceContext(config(), fakeDeps({ root: await tmpDir(), fetch: webDriverFetch(site, { videoMisses: 2 }) })));
    const dir = await tmpDir();
    const s = await target.open({ leg: leg('bs-pixel'), baseUrl: 'https://app.test/site', outDir: dir });
    sessions.push(s);
    await s.startVideo(`${dir}/row.mp4`);
    await s.stopVideo();
    expect(await readFile(`${dir}/row.mp4`)).toEqual(await readFile(fixturePath('device/clip.mp4')));
  });
});
