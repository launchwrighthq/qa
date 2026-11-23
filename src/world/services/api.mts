// `lw qa world api` (spec 2.5.2): the project API on `qa.apiPort` of 127.0.0.1, against the QA
// database, with the fake Bot API, no bot token and the /__qa routes on.
import type { AddressInfo } from 'node:net';
import { type App, LaunchwrightError } from '../../kernel/index.mts';
import { loadHttp } from '../../services/peers.mts';
import { openWorld, type QaAppEntry, type QaHandler } from './app.mts';
import type { WorldContext } from './context.mts';
import { listWorld, registryHash } from './registry.mts';
import type { WorldRegistry } from './types.mts';
import { readStamp } from './world.mts';

/** A QA app that listens on 127.0.0.1. `close` stops the server and keeps the app booted. */
export interface Listening {
  port: number;
  close(): Promise<void>;
}

/** Serves a booted QA app on 127.0.0.1. Port 0 takes a free port. */
export type ListenQaApp = (handler: QaHandler, app: App, port: number) => Promise<Listening>;

/** The default `ListenQaApp`: `serveNode` of the http module. */
export const listenQaApp: ListenQaApp = async (handler, app, port) => {
  const { serveNode } = await loadHttp();
  const { server } = serveNode(handler as unknown as Parameters<typeof serveNode>[0], port, { hostname: '127.0.0.1', app, signals: false });
  if (!server.listening) await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', (cause) => reject(new LaunchwrightError('qa.world.listen', `Cannot listen on 127.0.0.1:${port}: ${cause.message}`, { cause })));
  });
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(new LaunchwrightError('qa.world.close', `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve()));
        server.closeAllConnections?.();
      }),
  };
};

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
  const world = await openWorld(o.entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    const listening = await listenQaApp(o.entry.serve(world.app), world.app, o.port);
    o.out(`qa api on http://127.0.0.1:${listening.port} against ${ctx.overlay.database}, Bot API ${ctx.overlay.telegramUrl}`);
    o.onListen?.(listening.port);
    if (!o.signal.aborted) await new Promise<void>((resolve) => o.signal.addEventListener('abort', () => resolve(), { once: true }));
    await listening.close();
  } finally {
    await world.close();
  }
}
