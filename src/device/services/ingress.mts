// Device ingress (spec 2.9). `direct` uses the tunnel URL as it is and takes off a proxy that an
// earlier run set. `host-proxy` starts the host proxy on the machine of the adb server, reverses
// its port to the device and sets the guest `http_proxy`. A WebView reads the proxy when its
// process starts, so `changed` tells the caller to restart the app it is about to open.
import { LaunchwrightError } from '../../kernel/index.mts';
import { shq } from '../../kernel/services/text.mts';
import type { Adb } from './adb.mts';
import { HOST_PROXY_SCRIPT } from './host-proxy.mts';
import { type DeviceDeps, orFail, out, poll } from './process.mts';
import { type Rig } from './rigs.mts';

/** The proxy port when the rig sets none. */
export const DEFAULT_PROXY_PORT = 8899;

export interface IngressResult {
  mode: 'direct' | 'host-proxy';
  /** The guest proxy setting changed in this run. */
  changed: boolean;
}

/** What the guest `http_proxy` holds while the host proxy is on. */
export function proxyAddress(port: number): string {
  return `127.0.0.1:${port}`;
}

/** The identity of a live host proxy, or null when none answers on the port. */
export function parseIdentity(text: string): { host: string; upstream: string; pid: number } | null {
  try {
    const id = JSON.parse(text.trim()) as { host?: unknown; upstream?: unknown; pid?: unknown };
    return typeof id.host === 'string' && typeof id.upstream === 'string' && typeof id.pid === 'number' ? { host: id.host, upstream: id.upstream, pid: id.pid } : null;
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}

async function identity(rig: Rig, port: number): Promise<{ host: string; upstream: string; pid: number } | null> {
  const res = await rig.exec(`curl -s -m 3 http://127.0.0.1:${port}/__ingress || true`, { timeoutMs: 15_000 });
  return parseIdentity(out(res));
}

/** Removes the guest proxy, but only when it is the one this module sets. */
export async function clearIngress(adb: Adb, port: number): Promise<boolean> {
  const held = (await adb.shell(['settings', 'get', 'global', 'http_proxy'])).trim();
  if (held !== proxyAddress(port)) return false;
  await adb.shell(['settings', 'put', 'global', 'http_proxy', ':0']);
  return true;
}

async function startProxy(rig: Rig, deps: DeviceDeps, port: number, host: string, upstream: string): Promise<void> {
  const script = `${rig.stateDir}/host-proxy.mjs`;
  const log = `${rig.stateDir}/host-proxy.log`;
  await rig.writeFile(script, HOST_PROXY_SCRIPT);
  const start = `NODE="$(command -v node)"; [ -n "$NODE" ] || { echo "node is not installed on this rig" >&2; exit 3; }; nohup "$NODE" ${shq(script)} ${port} ${shq(host)} ${shq(upstream)} > ${shq(log)} 2>&1 &`;
  orFail(await rig.exec(start), 'qa.device.ingress', `starting the host proxy on rig ${rig.name}`, { rig: rig.name });
  await poll(
    deps.clock,
    async () => {
      const id = await identity(rig, port);
      return id && id.host === host && id.upstream === upstream ? id : null;
    },
    { timeoutMs: 5000, everyMs: 250, code: 'qa.device.ingress', what: `The host proxy answering on rig ${rig.name} port ${port} (log: ${log})` },
  );
}

/** Applies the ingress mode of the rig for a leg whose surface is served at `baseUrl`. */
export async function ensureIngress(adb: Adb, rig: Rig, deps: DeviceDeps, baseUrl: string): Promise<IngressResult> {
  const port = rig.config.hostProxy?.port ?? DEFAULT_PROXY_PORT;
  if (rig.config.ingress === 'direct') return { mode: 'direct', changed: await clearIngress(adb, port) };
  const upstream = rig.config.hostProxy?.upstream;
  if (!upstream) {
    throw new LaunchwrightError(
      'qa.device.ingress.config',
      `Rig ${rig.name} has ingress host-proxy and no hostProxy.upstream. Set qa.device.rigs.${rig.name}.hostProxy.upstream to the address that serves the tunnel hostname.`,
      { context: { rig: rig.name } },
    );
  }
  const host = new URL(baseUrl).hostname;
  const live = await identity(rig, port);
  if (!live || live.host !== host || live.upstream !== upstream) {
    if (live) orFail(await rig.exec(`kill ${live.pid}`), 'qa.device.ingress', `stopping the stale host proxy (pid ${live.pid})`);
    await startProxy(rig, deps, port, host, upstream);
  }
  orFail(await adb.run(['reverse', `tcp:${port}`, `tcp:${port}`]), 'qa.device.ingress', `adb reverse tcp:${port}`);
  const held = (await adb.shell(['settings', 'get', 'global', 'http_proxy'])).trim();
  const changed = held !== proxyAddress(port);
  if (changed) await adb.shell(['settings', 'put', 'global', 'http_proxy', proxyAddress(port)]);
  return { mode: 'host-proxy', changed };
}
