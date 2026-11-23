import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { createAdb } from '../../../../src/device/services/adb.mts';
import { HOST_PROXY_SCRIPT } from '../../../../src/device/services/host-proxy.mts';
import { ensureIngress, parseIdentity } from '../../../../src/device/services/ingress.mts';
import { createRigPool, RIG_STATE_DIR } from '../../../../src/device/services/rigs.mts';
import { androidRunner, deviceConfig, FakeSite, fakeDeps } from '../../../support/device.mts';

const TUNNEL = 'https://dev-app.tunnel.test/app';
const proxyPort = 8899;
/** A documentation address (RFC 5737) as the upstream of the host proxy. */
const UPSTREAM = '192.0.2.10'; // publish-audit: allow
/** A private address (RFC 1918) as the HTTP proxy of a rig. */
const HTTP_PROXY = '10.0.0.1:3128'; // publish-audit: allow

/** `identity` answers `/__ingress` and gets the number of proxy starts so far. */
async function setup(ingress: 'direct' | 'host-proxy', opts: { httpProxy?: string; identity?: (starts: number) => string; hostProxy?: boolean } = {}) {
  const site = new FakeSite(TUNNEL);
  const config = deviceConfig({
    rigs: {
      lab: { transport: 'ssh', host: 'rig-host', adbPort: 5038, ingress, ...(opts.hostProxy === false ? {} : { hostProxy: { upstream: UPSTREAM } }) },
    },
    devices: { phone: { rig: 'lab', kind: 'android', serial: 'FAKE0SERIAL01' } },
  });
  const started: string[] = [];
  const run = androidRunner(site, {
    ...(opts.httpProxy ? { httpProxy: opts.httpProxy } : {}),
    shell: (cmd) => {
      if (cmd.startsWith(`curl -s -m 3 http://127.0.0.1:${proxyPort}/__ingress`)) return opts.identity?.(started.length) ?? '';
      if (cmd.includes('cat > ')) return '';
      if (cmd.startsWith('NODE=')) {
        started.push(cmd);
        return '';
      }
      if (cmd.startsWith('kill ')) return '';
      return undefined;
    },
  });
  const deps = fakeDeps({ root: await tmpDir(), run });
  const rig = createRigPool(config, deps).get('lab');
  return { rig, adb: createAdb(rig, 'FAKE0SERIAL01', deps, 'adb'), deps, run, started };
}

describe('device ingress', () => {
  it('uses the tunnel as it is and clears a proxy an earlier run set', async () => {
    const { rig, adb, deps, run } = await setup('direct', { httpProxy: `127.0.0.1:${proxyPort}` });
    expect(await ensureIngress(adb, rig, deps, TUNNEL)).toEqual({ mode: 'direct', changed: true });
    expect(run.proxy()).toBe(':0');
  });

  it('leaves a proxy setting alone that another tool set', async () => {
    const { rig, adb, deps, run } = await setup('direct', { httpProxy: HTTP_PROXY });
    expect(await ensureIngress(adb, rig, deps, TUNNEL)).toEqual({ mode: 'direct', changed: false });
    expect(run.proxy()).toBe(HTTP_PROXY);
  });

  it('starts the host proxy on the rig, reverses its port and sets the guest proxy', async () => {
    const identity = (starts: number) => (starts > 0 ? JSON.stringify({ host: 'dev-app.tunnel.test', upstream: UPSTREAM, port: proxyPort, pid: 4242 }) : '');
    const ctx = await setup('host-proxy', { identity });
    expect(await ensureIngress(ctx.adb, ctx.rig, ctx.deps, TUNNEL)).toEqual({ mode: 'host-proxy', changed: true });
    expect(ctx.started).toHaveLength(1);
    expect(ctx.started[0]).toContain(`'${RIG_STATE_DIR}/host-proxy.mjs' ${proxyPort} 'dev-app.tunnel.test' '${UPSTREAM}'`);
    const written = ctx.run.calls.find((c) => c.input !== undefined);
    expect(written?.input).toBe(HOST_PROXY_SCRIPT);
    expect(ctx.run.find(`reverse tcp:${proxyPort} tcp:${proxyPort}`)).toHaveLength(1);
    expect(ctx.run.proxy()).toBe(`127.0.0.1:${proxyPort}`);
  });

  it('keeps a live host proxy that serves the same hostname', async () => {
    const identity = () => JSON.stringify({ host: 'dev-app.tunnel.test', upstream: UPSTREAM, port: proxyPort, pid: 4242 });
    const ctx = await setup('host-proxy', { identity, httpProxy: `127.0.0.1:${proxyPort}` });
    expect(await ensureIngress(ctx.adb, ctx.rig, ctx.deps, TUNNEL)).toEqual({ mode: 'host-proxy', changed: false });
    expect(ctx.started).toHaveLength(0);
  });

  it('refuses host-proxy without an upstream and names the config key', async () => {
    const ctx = await setup('host-proxy', { hostProxy: false });
    await expect(ensureIngress(ctx.adb, ctx.rig, ctx.deps, TUNNEL)).rejects.toThrow(/qa.device.rigs.lab.hostProxy.upstream/);
  });

  it('reads a proxy identity and ignores an answer that is not JSON', () => {
    expect(parseIdentity('{"host":"h","upstream":"u","pid":7}')).toEqual({ host: 'h', upstream: 'u', pid: 7 });
    expect(parseIdentity('<html>')).toBeNull();
    expect(parseIdentity('')).toBeNull();
  });
});
