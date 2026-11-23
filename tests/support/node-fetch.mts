// A fetch over node:http with no keep-alive agent. The global fetch keeps an undici timer for about
// one second after a call, and the teardown guard charges that timer to the test.
import { request } from 'node:http';

export const nodeFetch = (input: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Response> =>
  new Promise<Response>((resolve, reject) => {
    const req = request(input, { method: init.method ?? 'GET', headers: init.headers ?? {}, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) headers.append(name, v);
        }
        resolve(new Response(Buffer.concat(chunks).toString('utf8'), { status: res.statusCode ?? 500, headers }));
      });
    });
    req.on('error', reject);
    req.end(init.body);
  });
