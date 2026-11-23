// `lw qa world api` (spec 2.5.2): the project API on `qa.apiPort` of 127.0.0.1, against the QA
// database, with the fake Bot API, no bot token and the /__qa routes on.
import type { AddressInfo } from 'node:net';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { loadHttp } from '../../services/peers.mts';
import { openWorld, type QaAppEntry } from './app.mts';
import type { WorldContext } from './context.mts';
import { listWorld, registryHash } from './registry.mts';
import type { WorldRegistry } from './types.mts';
import { readStamp } from './world.mts';

export interface ServeOptions {
  entry: QaAppEntry;
  registry: WorldRegistry;
  port: number;
  signal: AbortSignal;
  out: (line: string) => void;
  /** Called with the bound port once the server listens. */
  onListen?: (port: number) => void;
}

/** Serves the QA app until `signal` aborts. Refuses a QA database that no reset seeded. */
export async function serveWorld(ctx: WorldContext, o: ServeOptions): Promise<void> {
  const stamp = await readStamp(ctx.root);
  if (stamp === null || stamp === 'unreadable' || stamp.database !== ctx.overlay.database) {
    throw new LaunchwrightError('qa.world.unseeded', `${ctx.overlay.database} holds no seeded world. Run lw qa world reset.`);
  }
  if (stamp.hash !== registryHash(listWorld(o.registry))) o.out(`warning: ${ctx.overlay.database} was seeded from registry ${stamp.hash}; the world files changed since. Run lw qa world reset.`);
  const { serveNode } = await loadHttp();
  const world = await openWorld(o.entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    const handler = o.entry.serve(world.app);
    const { server } = serveNode(handler as unknown as Parameters<typeof serveNode>[0], o.port, { hostname: '127.0.0.1', app: world.app, signals: false });
    if (!server.listening) await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', (cause) => reject(new LaunchwrightError('qa.world.listen', `Cannot listen on 127.0.0.1:${o.port}: ${cause.message}`, { cause })));
    });
    const port = (server.address() as AddressInfo).port;
    o.out(`qa api on http://127.0.0.1:${port} against ${ctx.overlay.database}, Bot API ${ctx.overlay.telegramUrl}`);
    o.onListen?.(port);
    if (!o.signal.aborted) await new Promise<void>((resolve) => o.signal.addEventListener('abort', () => resolve(), { once: true }));
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(new LaunchwrightError('qa.world.close', `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve()));
      (server as { closeAllConnections?: () => void }).closeAllConnections?.();
    });
  } finally {
    await world.close();
  }
}
