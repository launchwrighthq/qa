import { readFile, stat } from 'node:fs/promises';
import { request } from 'node:http';
import { join } from 'node:path';
import { fakeClock, tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { MASK, maskHeaders, type SinkRecord, startSink } from '../../../../src/sink/index.mts';

/** A documentation address (RFC 5737) as the client of a forwarded request. */
const CLIENT_IP = '203.0.113.9'; // publish-audit: allow

async function lines(file: string): Promise<SinkRecord[]> {
  return (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as SinkRecord);
}

interface Answer {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** One request with no connection pool, so no keep-alive timer stays after the test. A body makes it a POST. */
function send(url: string, headers: Record<string, string> = {}, body?: string): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request(url, { agent: false, method: body === undefined ? 'GET' : 'POST', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * Counts the requests of the sink. `reached('arrived', n)` resolves when n requests have arrived,
 * `reached('done', n)` when n records are final. It uses no timer.
 */
function phasesOf(): { onRecord: (r: SinkRecord, phase: 'arrived' | 'done') => void; reached(phase: 'arrived' | 'done', n: number): Promise<void> } {
  const count = { arrived: 0, done: 0 };
  const wake = new Set<() => void>();
  return {
    onRecord: (_r, phase) => {
      count[phase] += 1;
      for (const f of [...wake]) f();
    },
    async reached(phase, n) {
      while (count[phase] < n) {
        await new Promise<void>((resolve) => {
          const f = (): void => {
            wake.delete(f);
            resolve();
          };
          wake.add(f);
        });
      }
    },
  };
}

describe('maskHeaders', () => {
  it('masks credentials, cookies, tokens, keys, signatures, secrets and sender addresses', () => {
    const masked = maskHeaders({
      authorization: 'Bearer abc',
      'proxy-authorization': 'Basic abc',
      cookie: 'sid=1',
      'x-telegram-bot-api-secret-token': 'tg-secret',
      'x-hub-token': 't1',
      'x-api-key': 'k1',
      'x-signature-256': 'sha256=1',
      'x-webhook-secret': 's1',
      'idempotency-token': 'i1',
      'x-forwarded-for': CLIENT_IP,
      'cf-connecting-ip': CLIENT_IP,
      'content-type': 'application/json',
      'user-agent': 'sender/1.0',
      host: 'sink.test',
    });
    expect(masked).toEqual({
      authorization: MASK,
      'proxy-authorization': MASK,
      cookie: MASK,
      'x-telegram-bot-api-secret-token': MASK,
      'x-hub-token': MASK,
      'x-api-key': MASK,
      'x-signature-256': MASK,
      'x-webhook-secret': MASK,
      'idempotency-token': MASK,
      'x-forwarded-for': MASK,
      'cf-connecting-ip': MASK,
      'content-type': 'application/json',
      'user-agent': 'sender/1.0',
      host: 'sink.test',
    });
  });
});

describe('startSink', () => {
  it('listens on loopback, answers by the rules, and writes one masked JSON line per request', async () => {
    const dir = await tmpDir();
    const file = join(dir, '.lw', 'qa', 'sink', 'run.jsonl');
    const clock = fakeClock('2026-11-12T10:00:00Z');
    const sink = await startSink({ faults: ['503x1', '429x1', '410x1', '302:https://example.test/moved'], file, clock });
    try {
      expect(sink.url).toBe(`http://127.0.0.1:${sink.port}`);
      const headers = { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'tg-secret-value', authorization: 'Bearer live-token' };
      const answers = [];
      for (const path of ['/a', '/b?x=1', '/c', '/d', '/e']) {
        const res = await send(`${sink.url}${path}`, headers, JSON.stringify({ event: path }));
        answers.push([res.status, res.headers['retry-after'] ?? res.headers.location ?? null, res.body]);
      }
      expect(answers).toEqual([
        [503, null, 'busy'],
        [429, '30', 'slow down'],
        [410, null, 'gone'],
        [302, 'https://example.test/moved', ''],
        [302, 'https://example.test/moved', ''],
      ]);
    } finally {
      await sink.close();
    }
    const written = await lines(file);
    expect(written).toEqual(sink.records);
    expect(written.map((r) => [r.n, r.method, r.path, r.url, r.fault, r.answered.status])).toEqual([
      [1, 'POST', '/a', '/a', '503x1', 503],
      [2, 'POST', '/b', '/b?x=1', '429x1', 429],
      [3, 'POST', '/c', '/c', '410x1', 410],
      [4, 'POST', '/d', '/d', '302:https://example.test/moved', 302],
      [5, 'POST', '/e', '/e', '302:https://example.test/moved', 302],
    ]);
    expect(written[0]).toMatchObject({ at: '2026-11-12T10:00:00.000Z', body: '{"event":"/a"}', bodyBytes: 14 });
    expect(written[0]?.headers['x-telegram-bot-api-secret-token']).toBe(MASK);
    expect(written[0]?.headers.authorization).toBe(MASK);
    const text = await readFile(file, 'utf8');
    expect(text).not.toContain('tg-secret-value');
    expect(text).not.toContain('live-token');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('holds a slow answer on the clock, and records a sender that hangs up first', async () => {
    const clock = fakeClock();
    const seen = phasesOf();
    const sink = await startSink({ faults: ['slow:5000x2'], clock, onRecord: seen.onRecord });
    try {
      const first = send(`${sink.url}/slow`);
      await seen.reached('arrived', 1);
      await clock.advance(4999);
      expect(sink.records[0]?.answered.heldMs).toBe(5000);
      await clock.advance(1);
      expect(await first).toMatchObject({ status: 200, body: 'ok' });
      expect(sink.records[0]?.answered).toEqual({ status: 200, headers: {}, heldMs: 5000 });

      // The second sender hangs up during the hold: the hold ends at once and the record says so.
      const req = request(`${sink.url}/gone`, { agent: false }, () => undefined);
      const closed = new Promise<void>((resolve) => req.on('close', () => resolve()));
      req.on('error', (e) => expect((e as NodeJS.ErrnoException).code).toBe('ECONNRESET'));
      req.end();
      await seen.reached('arrived', 2);
      req.destroy();
      await closed;
      await seen.reached('done', 2);
    } finally {
      await sink.close();
    }
    expect(sink.records[1]).toMatchObject({ path: '/gone', fault: 'slow:5000x2', closedEarly: true });
  });

  it('cuts a body longer than maxBodyBytes and keeps its size', async () => {
    const sink = await startSink({ maxBodyBytes: 4 });
    try {
      await send(sink.url, {}, 'abcdefgh');
    } finally {
      await sink.close();
    }
    expect(sink.records[0]).toMatchObject({ body: 'abcd', bodyBytes: 8, bodyTruncated: true, fault: null });
  });

  it('refuses a taken port with qa.sink.listen and a bad rule with qa.sink.fault', async () => {
    const first = await startSink();
    try {
      await expect(startSink({ port: first.port })).rejects.toMatchObject({ code: 'qa.sink.listen' });
      await expect(startSink({ faults: ['504'] })).rejects.toMatchObject({ code: 'qa.sink.fault' });
    } finally {
      await first.close();
    }
  });
});
