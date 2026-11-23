// A `ListenQaApp` on node:http for the tests. The library tests have no http module, whose
// `serveNode` the default listen uses, so a fetch handler is served here with the same contract:
// 127.0.0.1, the given port (0 for a free one), and a close that ends every connection.
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ListenQaApp } from '../../src/world/services/api.mts';

async function body(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export const fetchListen: ListenQaApp = async (handler, _app, port) => {
  const server = createServer((req, res) => {
    void (async () => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value);
      const data = await body(req);
      const init: RequestInit = { method: req.method ?? 'GET', headers, ...(data ? { body: new Uint8Array(data) } : {}) };
      const response = await handler.fetch(new Request(`http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`, init));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    })().catch((err: unknown) => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(err));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      }),
  };
};
