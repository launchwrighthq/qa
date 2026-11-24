// A `ListenQaApp` on node:http, for a project without the http module: it serves a fetch handler on
// 127.0.0.1, and its close ends every open connection.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { LaunchwrightError, messageOf } from '../../kernel/index.mts';
import type { QaHandler } from './app.mts';

async function bodyOf(req: IncomingMessage): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

function requestOf(req: IncomingMessage, body: Uint8Array<ArrayBuffer> | undefined): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) for (const one of value) headers.append(name, one);
  }
  return new Request(`http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`, { method: req.method ?? 'GET', headers, ...(body ? { body } : {}) });
}

async function answer(handler: QaHandler, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const response = await handler.fetch(requestOf(req, await bodyOf(req)));
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of response.headers) if (name !== 'set-cookie') headers[name] = value;
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Serves `handler` on 127.0.0.1:`port` (0 for a free port). A handler throw answers 500 with its message. */
export async function nodeListen(handler: QaHandler, port: number): Promise<{ port: number; close(): Promise<void> }> {
  const server = createServer((req, res) => {
    answer(handler, req, res).catch((err: unknown) => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`QA app error: ${messageOf(err)}`);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', (cause) => reject(new LaunchwrightError('qa.world.listen', `Cannot listen on 127.0.0.1:${port}: ${cause.message}`, { cause })));
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(new LaunchwrightError('qa.world.close', `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve()));
        server.closeAllConnections();
      }),
  };
}
