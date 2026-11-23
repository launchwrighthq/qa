import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { onTestFinished } from 'vitest';

/** One request that reached the target of a redirect trap. */
export interface TrappedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
}

export interface RedirectTrap {
  /** The loopback origin that answers every request with a 302 to `target`. */
  origin: string;
  /** The loopback origin of another host, where the redirect points. */
  target: string;
  /** The requests that reached `target`. A client that refuses the redirect leaves it empty. */
  reached: TrappedRequest[];
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/**
 * Two loopback servers for a test of the redirect rule (spec 2026-11-21-framework-audit-fixes
 * R3): `origin` answers 302 with `location` on `target`, and `target` records each request. Call
 * it inside a test. Both servers close when the test finishes.
 */
export async function redirectTrap(): Promise<RedirectTrap> {
  const reached: TrappedRequest[] = [];
  const target = await listen(
    createServer((req, res) => {
      reached.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers });
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    }),
  );
  const origin = await listen(
    createServer((req, res) => {
      req.resume();
      res.writeHead(302, { location: `${target}${req.url ?? '/'}` }).end();
    }),
  );
  return { origin, target, reached };
}
