// The recording HTTP sink of `lw qa sink` (spec 2.17). It listens on loopback only, answers each
// request by the fault rules, and appends one JSON line per request to a local file. Header values
// whose names match the secrets list are masked; the body stays as it came, and stays local.
import { appendFile, mkdir } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import { type Clock, LaunchwrightError, systemClock } from '../../kernel/index.mts';
import { type FaultRule, FaultPlan, parseFault, seededSource } from './faults.mts';

/** The text that replaces a masked header value. */
export const MASK = '[masked]';

/**
 * Header names whose values are secrets: credentials, cookies, every `x-*-token`, the Telegram
 * webhook secret, and any name that holds `secret`, `token`, `key` or `signature`.
 */
export const SECRET_HEADER = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-telegram-bot-api-secret-token|x-.+-token)$|secret|token|key|signature/i;

/** Header names that a tunnel adds with the address of the sender. Their values are masked too. */
export const ADDRESS_HEADER = /forwarded-for|real-ip|connecting-ip|client-ip|^forwarded$/i;

/** The body bytes that a record keeps. A longer body is cut and the record says so. */
export const MAX_BODY_BYTES = 1024 * 1024;

/** The headers of a request, with each secret or address value replaced by `[masked]`. */
export function maskHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[name] = SECRET_HEADER.test(name) || ADDRESS_HEADER.test(name) ? MASK : value;
  }
  return out;
}

/** One request as the sink records it: one line of the JSON Lines file. */
export interface SinkRecord {
  /** The number of the request in this run, from 1. */
  n: number;
  /** The time the request arrived, ISO 8601. */
  at: string;
  method: string;
  url: string;
  path: string;
  headers: Record<string, string | string[]>;
  body: string;
  bodyBytes: number;
  bodyTruncated?: true;
  /** The rule that answered, as written, or null for the plain 200. */
  fault: string | null;
  answered: { status: number; headers: Record<string, string>; heldMs: number };
  /** True when the sender closed the connection before the sink answered. */
  closedEarly?: true;
}

export interface SinkOptions {
  /** The fault rules, parsed or as text. */
  faults?: ReadonlyArray<FaultRule | string>;
  /** The JSON Lines file. Without it the sink keeps the records in memory only. */
  file?: string;
  /** The port on 127.0.0.1. Default 0: a free port. */
  port?: number;
  /** The seed of the random source of ratio rules. Default 1. */
  seed?: number;
  /** The clock of the timestamps and of the `slow` hold. Default `systemClock`. */
  clock?: Clock;
  /** The body bytes that a record keeps. Default 1 MiB. */
  maxBodyBytes?: number;
  /** Called when a request arrives (`'arrived'`) and when its record is final (`'done'`). */
  onRecord?: (record: SinkRecord, phase: 'arrived' | 'done') => void;
}

/** A running sink. `close()` stops it and waits for the last record line. */
export interface Sink {
  port: number;
  /** `http://127.0.0.1:<port>`. */
  url: string;
  records: SinkRecord[];
  file?: string;
  close(): Promise<void>;
}

function readBody(req: IncomingMessage, max: number): Promise<{ text: string; bytes: number; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on('data', (chunk: Buffer) => {
      if (bytes < max) chunks.push(chunk.subarray(0, max - bytes));
      bytes += chunk.length;
    });
    req.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8'), bytes, truncated: bytes > max }));
    req.on('error', reject);
    req.on('close', () => {
      if (!req.complete) reject(new Error('the sender closed the request before its end'));
    });
  });
}

/**
 * Starts the sink on 127.0.0.1. Rejects with `qa.sink.listen` when the port is taken, and with
 * `qa.sink.fault` for a bad rule. A failed write of the record file closes nothing: `close()` then
 * rejects with `qa.sink.write`.
 */
export async function startSink(opts: SinkOptions = {}): Promise<Sink> {
  const rules = (opts.faults ?? []).map((r) => (typeof r === 'string' ? parseFault(r) : r));
  const plan = new FaultPlan(rules, seededSource(opts.seed ?? 1));
  const clock = opts.clock ?? systemClock;
  const max = opts.maxBodyBytes ?? MAX_BODY_BYTES;
  const records: SinkRecord[] = [];
  let writes: Promise<void> = Promise.resolve();
  let writeError: unknown;
  /** Aborts the hold of each `slow` answer when the sink closes. */
  const stopping = new AbortController();
  const pending = new Set<Promise<void>>();
  if (opts.file !== undefined) await mkdir(dirname(opts.file), { recursive: true, mode: 0o700 });

  const persist = (record: SinkRecord): void => {
    const file = opts.file;
    if (file === undefined) return;
    writes = writes.then(() =>
      appendFile(file, `${JSON.stringify(record)}\n`, { mode: 0o600 }).catch((err: unknown) => {
        writeError ??= err;
      }),
    );
  };

  const server: Server = createServer((req, res) => {
    const at = clock.date().toISOString();
    const n = records.length + 1;
    const { rule, reply } = plan.next();
    const url = req.url ?? '/';
    const record: SinkRecord = {
      n,
      at,
      method: req.method ?? '',
      url,
      path: new URL(url, 'http://sink').pathname,
      headers: maskHeaders(req.headers),
      body: '',
      bodyBytes: 0,
      fault: rule?.text ?? null,
      answered: { status: reply.status, headers: reply.headers, heldMs: reply.holdMs },
    };
    records.push(record);
    // A request is destroyed after its end by itself, so only a closed response means the sender hung up.
    let hungUp = false;
    const hangUp = new AbortController();
    res.once('close', () => {
      if (res.writableEnded) return;
      hungUp = true;
      hangUp.abort(new Error('the sender closed the connection'));
    });
    // The hold of a `slow` answer starts when the request arrives. It ends early (false) when the
    // sender hangs up or the sink closes.
    const held =
      reply.holdMs > 0
        ? clock.sleep(reply.holdMs, AbortSignal.any([stopping.signal, hangUp.signal])).then(
            () => true,
            () => false,
          )
        : Promise.resolve(true);
    opts.onRecord?.(record, 'arrived');
    const handled = (async () => {
      try {
        const body = await readBody(req, max);
        record.body = body.text;
        record.bodyBytes = body.bytes;
        if (body.truncated) record.bodyTruncated = true;
        const answer = await held;
        if (!answer || hungUp || res.destroyed) {
          record.closedEarly = true;
          return;
        }
        res.writeHead(reply.status, { 'content-type': 'text/plain', ...reply.headers });
        res.end(reply.body);
      } catch (err) {
        record.closedEarly = true;
        res.destroy(err instanceof Error ? err : new Error(String(err)));
      } finally {
        persist(record);
        opts.onRecord?.(record, 'done');
      }
    })();
    pending.add(handled);
    void handled.then(() => pending.delete(handled));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (cause) =>
      reject(new LaunchwrightError('qa.sink.listen', `The sink cannot listen on 127.0.0.1:${opts.port ?? 0}: ${cause.message}`, { cause, context: { port: opts.port ?? 0 } })),
    );
    server.listen(opts.port ?? 0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    records,
    ...(opts.file === undefined ? {} : { file: opts.file }),
    async close() {
      stopping.abort(new Error('the sink closed'));
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      await Promise.all(pending);
      await writes;
      if (writeError !== undefined) {
        throw new LaunchwrightError('qa.sink.write', `The sink could not write ${opts.file}.`, { cause: writeError, context: { file: opts.file } });
      }
    },
  };
}
