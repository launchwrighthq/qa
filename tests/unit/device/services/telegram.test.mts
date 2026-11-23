import { readFile } from 'node:fs/promises';
import { sha256 } from '../../../../src/kernel/services/fs.mts';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { telegramDeviceConfig } from '../../../../src/device/config.mts';
import { createAdb } from '../../../../src/device/services/adb.mts';
import { createRigPool } from '../../../../src/device/services/rigs.mts';
import { apkPath, fetchApk, installTelegram, miniAppLink } from '../../../../src/device/services/telegram.mts';
import { androidRunner, deviceConfig, FakeSite, fakeDeps } from '../../../support/device.mts';

/** Recorded APK bytes: the zip magic and a body. Not a real APK. */
const APK = Buffer.concat([Buffer.from('PK\u0003\u0004', 'latin1'), Buffer.alloc(64, 1)]);
const PIN = sha256(APK);
const apkFetch = (body: Buffer, length = body.length) =>
  (async () => new Response(new Uint8Array(body), { status: 200, headers: { 'content-length': String(length) } })) as unknown as typeof fetch;

describe('the Telegram APK with a pinned SHA-256', () => {
  it('fetches the APK and keeps it when it matches the pin', async () => {
    const deps = fakeDeps({ root: await tmpDir(), fetch: apkFetch(APK) });
    const path = await fetchApk(telegramDeviceConfig.parse({ apkSha256: PIN }), deps);
    expect(path).toBe(apkPath(deps.root));
    expect((await readFile(path)).equals(APK)).toBe(true);
  });

  it('refuses a download that differs from the pin and writes nothing', async () => {
    const deps = fakeDeps({ root: await tmpDir(), fetch: apkFetch(APK) });
    await expect(fetchApk(telegramDeviceConfig.parse({ apkSha256: 'a'.repeat(64) }), deps)).rejects.toThrow(/not the pinned a{64}/);
    await expect(readFile(apkPath(deps.root))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses a truncated download', async () => {
    const deps = fakeDeps({ root: await tmpDir(), fetch: apkFetch(APK, APK.length + 10) });
    await expect(fetchApk(telegramDeviceConfig.parse({ apkSha256: PIN }), deps)).rejects.toThrow(/truncated/);
  });

  it('refuses to fetch without a pin and names the config key', async () => {
    const deps = fakeDeps({ root: await tmpDir() });
    await expect(fetchApk(telegramDeviceConfig.parse({}), deps)).rejects.toThrow(/qa.device.telegram.apkSha256 is not set/);
  });

  it('refuses to install over an installed Telegram without force', async () => {
    const run = androidRunner(new FakeSite('https://app.test/site'));
    const deps = fakeDeps({ root: await tmpDir(), run, fetch: apkFetch(APK) });
    const rig = createRigPool(deviceConfig({}), deps).get('local');
    const adb = createAdb(rig, 'FAKE0SERIAL01', deps, 'adb');
    await expect(installTelegram(adb, telegramDeviceConfig.parse({ apkSha256: PIN }), deps, false)).rejects.toMatchObject({ code: 'qa.device.telegram.signed-in' });
    expect(run.find(' install ')).toHaveLength(0);
  });

  it('builds the main Mini App link of a bot with a start value, which Telegram for Android needs', () => {
    expect(miniAppLink('fixture_qa_bot')).toBe('tg://resolve?domain=fixture_qa_bot&startapp=lw');
    expect(miniAppLink('fixture_qa_bot', '')).toBe('tg://resolve?domain=fixture_qa_bot&startapp=lw');
    expect(miniAppLink('fixture_qa_bot', 'row 1')).toBe('tg://resolve?domain=fixture_qa_bot&startapp=row%201');
    expect(() => miniAppLink('x; rm')).toThrow(/is not a Telegram bot username/);
  });
});
