import { readdir, readFile } from 'node:fs/promises';
import { request } from 'node:http';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import sinkCommand, { SINK_DIR } from '../../../src/commands/qa-sink.mts';
import type { QaCommandOptions } from '../../../src/commands/qa.command.mts';
import type { SinkRecord } from '../../../src/sink/index.mts';

/** The options of one run. `line(lines, pick)` resolves with the first line that `pick` reads; it uses no timer. */
function options(cwd: string, extra: Partial<QaCommandOptions> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const listeners = new Set<() => void>();
  const push = (lines: string[]) => (l: string) => {
    lines.push(l);
    for (const f of listeners) f();
  };
  const controller = new AbortController();
  const opts: QaCommandOptions = { cwd, out: push(out), err: push(err), signal: controller.signal, ...extra };
  const line = <T,>(lines: string[], pick: (l: string) => T | undefined): Promise<T> =>
    new Promise((resolve) => {
      const look = (): void => {
        for (const l of lines) {
          const v = pick(l);
          if (v === undefined) continue;
          listeners.delete(look);
          resolve(v);
          return;
        }
      };
      listeners.add(look);
      look();
    });
  return { opts, out, err, controller, line };
}

/** One request with no connection pool, so no keep-alive timer stays after the test. A body makes it a POST. */
function send(url: string, headers: Record<string, string> = {}, body?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { agent: false, method: body === undefined ? 'GET' : 'POST', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

describe('lw qa sink', () => {
  // The same run behind `--tunnel fake` needs the framework tunnel module, so that case stays a framework adapter test.
  it('opens the sink, prints its URL, applies the faults and records each request', async () => {
    const cwd = await tmpDir();
    const { opts, out, err, controller, line } = options(cwd);
    const running = sinkCommand.run(['--tunnel', 'none', '--fault', '503x2', '--fault', '410@0', '--seed', '42'], opts);
    const local = await line(err, (l) => /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(l)?.[1]);
    expect(out).toEqual([local]);
    expect(err).toContain('lw qa sink: faults 503x2 410@0, seed 42; Ctrl-C stops it');

    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await send(`${local}/hook`, { 'x-telegram-bot-api-secret-token': 'tg-secret-value' }, `{"n":${i}}`)).status);
    }
    expect(statuses).toEqual([503, 503, 200]);
    expect(err.filter((l) => / -> /.test(l))).toEqual([
      'lw qa sink: 1 POST /hook -> 503 (503x2)',
      'lw qa sink: 2 POST /hook -> 503 (503x2)',
      'lw qa sink: 3 POST /hook -> 200',
    ]);

    controller.abort();
    expect(await running).toBe(0);
    expect(err.at(-1)).toMatch(/^lw qa sink: 3 requests recorded in .+\.jsonl$/);
    const [name] = await readdir(join(cwd, SINK_DIR));
    const text = await readFile(join(cwd, SINK_DIR, name as string), 'utf8');
    const records = text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as SinkRecord);
    expect(records.map((r) => [r.path, r.body, r.fault, r.answered.status])).toEqual([
      ['/hook', '{"n":0}', '503x2', 503],
      ['/hook', '{"n":1}', '503x2', 503],
      ['/hook', '{"n":2}', null, 200],
    ]);
    expect(text).not.toContain('tg-secret-value');
  });

  it('serves without a tunnel with --tunnel none and prints the loopback URL', async () => {
    const cwd = await tmpDir();
    const { opts, out, controller, line } = options(cwd);
    const running = sinkCommand.run(['--tunnel', 'none'], opts);
    const url = await line(out, (l) => (l.startsWith('http://127.0.0.1:') ? l : undefined));
    expect(await send(url)).toEqual({ status: 200, body: 'ok' });
    controller.abort();
    expect(await running).toBe(0);
  });

  it('fails with qa.sink.tunnel without a tunnel section or --tunnel, and with qa.sink.fault for a bad rule', async () => {
    const cwd = await tmpDir();
    const a = options(cwd);
    expect(await sinkCommand.run([], a.opts)).toBe(1);
    expect(a.err.at(-1)).toMatch(/^lw qa sink: qa\.sink\.tunnel: /);
    const b = options(cwd);
    expect(await sinkCommand.run(['--tunnel', 'fake', '--fault', '302:not-a-url'], b.opts)).toBe(1);
    expect(b.err.at(-1)).toMatch(/^lw qa sink: qa\.sink\.fault: /);
    const c = options(cwd);
    expect(await sinkCommand.run(['--bogus'], c.opts)).toBe(2);
    expect(c.err).toContain('usage: lw qa sink [--tunnel <driver|none>] [--fault <rule>]... [--port <n>] [--seed <n>]');
  });
});
