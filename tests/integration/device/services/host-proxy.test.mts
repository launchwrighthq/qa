// The host proxy script runs under node on loopback and dials one hostname at the upstream address.
import { type ChildProcess, spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createServer, request, type Server } from 'node:http';
import { connect, createServer as createTcpServer } from 'node:net';
import { join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { afterEach, describe, expect, it } from 'vitest';
import { HOST_PROXY_SCRIPT } from '../../../../src/device/services/host-proxy.mts';

const HOST = 'dev-app.tunnel.test';
let proxy: ChildProcess | null = null;
let upstream: Server | null = null;

afterEach(async () => {
  proxy?.kill('SIGTERM');
  proxy = null;
  await new Promise<void>((resolve) => (upstream ? upstream.close(() => resolve()) : resolve()));
  upstream = null;
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createTcpServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(typeof addr === 'object' && addr ? addr.port : 0));
    });
  });
}

/** An upstream HTTP server on loopback that answers with the Host header it got. */
async function startUpstream(): Promise<number> {
  upstream = createServer((req, res) => res.end(`upstream saw ${req.headers.host} ${req.url}`));
  await new Promise<void>((resolve) => upstream?.listen(0, '127.0.0.1', () => resolve()));
  const addr = upstream.address();
  return typeof addr === 'object' && addr ? addr.port : 0;
}

/** Starts the script and resolves when it prints its listening line. */
async function startProxy(port: number): Promise<void> {
  const file = join(await tmpDir(), 'host-proxy.mjs');
  await writeFile(file, HOST_PROXY_SCRIPT);
  proxy = spawn(process.execPath, [file, String(port), HOST, '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    proxy?.stdout?.once('data', () => resolve());
    proxy?.once('exit', (code) => reject(new Error(`host-proxy exited ${code}`)));
  });
}

function get(port: number, path: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers }, (res) => {
      let body = '';
      res.on('data', (d: Buffer) => (body += d.toString()));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('the host proxy of ingress host-proxy', () => {
  it('answers its identity with the hostname, the upstream and its pid', async () => {
    const port = await freePort();
    await startProxy(port);
    expect(JSON.parse(await get(port, '/__ingress'))).toEqual({ host: HOST, upstream: '127.0.0.1', port, pid: proxy?.pid });
  });

  it('sends a plain HTTP request for the hostname to the upstream address', async () => {
    const up = await startUpstream();
    const port = await freePort();
    await startProxy(port);
    expect(await get(port, `http://${HOST}:${up}/hello?x=1`, { host: `${HOST}:${up}` })).toBe(`upstream saw ${HOST}:${up} /hello?x=1`);
  });

  it('tunnels a CONNECT for the hostname to the upstream address', async () => {
    const up = await startUpstream();
    const port = await freePort();
    await startProxy(port);
    const answer = await new Promise<string>((resolve, reject) => {
      const sock = connect(port, '127.0.0.1', () => sock.write(`CONNECT ${HOST}:${up} HTTP/1.1\r\nHost: ${HOST}:${up}\r\n\r\n`));
      let text = '';
      let sent = false;
      sock.on('data', (d: Buffer) => {
        text += d.toString();
        if (!sent && text.includes('200 Connection Established\r\n\r\n')) {
          sent = true;
          sock.write(`GET /via-tunnel HTTP/1.1\r\nHost: ${HOST}\r\nConnection: close\r\n\r\n`);
        }
      });
      sock.on('end', () => resolve(text));
      sock.on('error', reject);
    });
    expect(answer).toContain('HTTP/1.1 200 Connection Established');
    expect(answer).toContain(`upstream saw ${HOST} /via-tunnel`);
  });
});
