import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { recordedFetch } from '../../../support/recorded-fetch.mts';
import { describe, expect, it } from 'vitest';
import { parseDeviceArgs, runDeviceCommand } from '../../../../src/device/commands/qa-device.mts';
import type { DeviceDeps } from '../../../../src/device/services/process.mts';
import { DEVICE_STATE_DIR } from '../../../../src/device/services/rigs.mts';
import { pngSize } from '../../../../src/index.mts';
import { androidRunner, BS_KEY, BS_USER, cdpSockets, devtoolsFetch, FakeSite, fakeDeps, fixturePath } from '../../../support/device.mts';

const emulatorPort = 5554;
const qa = {
  device: {
    rigs: { local: { transport: 'local' }, lab: { transport: 'ssh', host: 'rig-host', adbPort: 5038 }, browserstack: { transport: 'cloud' } },
    devices: {
      phone: { rig: 'local', kind: 'android', serial: 'FAKE0SERIAL01' },
      avd: { rig: 'lab', kind: 'android-emulator', avd: 'fixture_avd', port: emulatorPort },
      'bs-iphone': { rig: 'browserstack', kind: 'ios-safari', model: 'iPhone 16', os: '18' },
    },
    browserstack: { username: BS_USER, accessKey: BS_KEY },
    telegram: { apkSha256: 'b'.repeat(64) },
  },
};

async function run(args: string[], deps: DeviceDeps): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runDeviceCommand(args, { cwd: deps.root, out: (l) => out.push(l), err: (l) => err.push(l), config: { qa } }, deps);
  return { code, out, err };
}

async function android(): Promise<{ deps: DeviceDeps; site: FakeSite; runner: ReturnType<typeof androidRunner> }> {
  const site = new FakeSite('https://app.test/site');
  const runner = androidRunner(site, {
    shell: (cmd) => (cmd.startsWith('ls -1dt') ? '.lw-qa/snapshots/fixture_avd-1\n' : undefined),
  });
  return { deps: fakeDeps({ root: await tmpDir(), run: runner, socket: cdpSockets(site), fetch: devtoolsFetch(site) }), site, runner };
}

describe('lw qa device', () => {
  it('exits 2 with the usage for an unknown verb', async () => {
    const { deps } = await android();
    const res = await run(['explode'], deps);
    expect(res.code).toBe(2);
    expect(res.err[0]).toBe('lw qa device: unknown verb explode');
    expect(res.err[1]).toMatch(/^usage: lw qa device <verb>/);
  });

  it('lists rigs and devices without a serial', async () => {
    const { deps } = await android();
    const res = await run(['list'], deps);
    expect(res.code).toBe(0);
    expect(res.out).toContain('rig    lab              ssh rig-host, ingress direct');
    expect(res.out).toContain('device phone            android           rig local');
    expect(res.out.join('\n')).not.toContain('FAKE0SERIAL01');
  });

  it('reads --device and other valued flags in any position', () => {
    expect(parseDeviceArgs(['@x.js', '--device', 'phone', '--force'])).toEqual({ device: 'phone', flags: { device: 'phone', force: true }, rest: ['@x.js'] });
    expect(() => parseDeviceArgs(['--device'])).toThrow(/--device <value>' argument missing/);
  });

  it('writes a screen PNG of the phone under the project .lw folder', async () => {
    const { deps } = await android();
    const res = await run(['shot', '--device', 'phone'], deps);
    expect(res.code).toBe(0);
    const png = await readFile(join(deps.root, DEVICE_STATE_DIR, 'phone.png'));
    expect(pngSize(png)).toEqual({ width: 36, height: 64 });
  });

  it('taps a native control by its accessibility label', async () => {
    const { deps, runner } = await android();
    const res = await run(['tap', 'Open', 'App', '--device', 'phone', '--x', '0.25'], deps);
    expect(res.out).toEqual(['tapped "Open App" at 291,1780']);
    expect(runner.find('shell input tap 291 1780')).toHaveLength(1);
  });

  it('evaluates in the visible WebView page and prints the value', async () => {
    const { deps } = await android();
    const res = await run(['eval', 'location.pathname + location.search', '--device', 'phone', '--package', 'com.android.chrome'], deps);
    expect(res).toMatchObject({ code: 0, out: ['/site/'] });
  });

  it('sends the named video probe and refuses an unknown probe', async () => {
    const { deps, site } = await android();
    const seen: string[] = [];
    const evaluate = site.evaluate.bind(site);
    site.evaluate = (expr: string) => {
      seen.push(expr);
      return expr.includes("querySelectorAll('video')") ? { videos: [] } : evaluate(expr);
    };
    expect(await run(['eval', '--probe', 'video', '--device', 'phone', '--package', 'com.android.chrome'], deps)).toMatchObject({ code: 0, out: ['{\n "videos": []\n}'] });
    expect(seen.some((e) => e.includes('getVideoPlaybackQuality'))).toBe(true);
    expect((await run(['eval', '--probe', 'audio', '--device', 'phone'], deps)).err[0]).toContain('No probe audio. Probes: video.');
  });

  it('refuses to install over an installed Telegram without force', async () => {
    const { deps } = await android();
    deps.fetch = (async () => new Response(Buffer.from('PK'), { status: 200 })) as unknown as typeof fetch;
    const res = await run(['install', '--device', 'phone'], deps);
    expect(res.code).toBe(1);
    expect(res.err[0]).toMatch(/sha256 .* not the pinned b{64}/);
  });

  it('boots an emulator before it installs Telegram on it', async () => {
    const { deps } = await android();
    deps.fetch = (async () => new Response(Buffer.from('PK'), { status: 200 })) as unknown as typeof fetch;
    const res = await run(['install', '--device', 'avd'], deps);
    expect(res.out[0]).toBe('emulator already booted');
  });

  it('refuses a restore without force and names the sign-in it would erase', async () => {
    const { deps } = await android();
    const res = await run(['restore', '--device', 'avd'], deps);
    expect(res.code).toBe(1);
    expect(res.err[0]).toMatch(/emulator-5554 is running|Telegram sign-in on it/);
  });

  it('stops the emulator, clears the ingress and closes the ssh masters on down', async () => {
    const { deps, runner } = await android();
    const res = await run(['down'], deps);
    expect(res.code).toBe(0);
    expect(res.out).toContain('avd: emulator stopped cleanly');
    expect(res.out.at(-1)).toBe('ssh masters closed');
    expect(runner.find('-O exit rig-host')).toHaveLength(1);
  });

  it('prints the BrowserStack minutes and the per-run budget', async () => {
    const deps = fakeDeps({ root: await tmpDir(), fetch: recordedFetch(fixturePath('http/browserstack/budget.json')) });
    const res = await run(['budget'], deps);
    expect(res.code).toBe(0);
    expect(res.out).toEqual(['Automate plan Free: 4.2 min used over 2 session(s), 5 min rounded up; 0 of 1 parallel running; per-run budget 5 min', 'no session held']);
    expect(res.out.join('\n')).not.toContain(BS_KEY);
  });

  it('refuses a native verb on a cloud device', async () => {
    const { deps } = await android();
    const res = await run(['key', 'KEYCODE_HOME', '--device', 'bs-iphone'], deps);
    expect(res.code).toBe(1);
    expect(res.err[0]).toContain('this verb drives an Android device');
  });
});
