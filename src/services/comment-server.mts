// The loopback server of `lw qa comments serve` (spec 2.9, R9). It binds 127.0.0.1 and serves the
// viewer bundle plus a GET and POST comment store, so the served viewer reads and writes comments
// through it. A page is rendered fresh on each request with the current comments, so a reload after
// a write shows the change. A plain `file://` viewer has no server, so its add control stays off.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { type Clock, LaunchwrightError, systemClock } from '../kernel/index.mts';
import { addComment, type Comment, type CommentStore, makeComment, replyToComment, setStatus } from './comments.mts';
import { mimeOfExtension } from './mime.mts';

/** The request body bytes the comment API reads. A larger body is refused. */
const MAX_BODY = 1024 * 1024;

/** A running comment server. `close()` stops it. */
export interface CommentServer {
  port: number;
  /** `http://127.0.0.1:<port>`. */
  url: string;
  /** The index page URL of the served viewer. */
  indexUrl: string;
  close(): Promise<void>;
}

export interface CommentServerOptions {
  /** The report folder, the root of the on-disk assets. */
  reportDir: string;
  /** The viewer bundle folder, relative to `reportDir`, posix, for example `dist/<slug>-viewer`. */
  viewerDir: string;
  slug: string;
  store: CommentStore;
  /** Renders the bundle pages for a set of comments. The server calls it fresh on each page request. */
  renderPages: (comments: readonly Comment[]) => Map<string, string>;
  /** The port on 127.0.0.1. Default 0: a free port. */
  port?: number;
  host?: string;
  /** The clock of `createdAt`. Default `systemClock`. */
  clock?: Clock;
}

const sendJson = (res: ServerResponse, status: number, value: unknown): void => {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
};

const sendText = (res: ServerResponse, status: number, text: string): void => {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on('data', (c: Buffer) => {
      bytes += c.length;
      if (bytes <= MAX_BODY) chunks.push(c);
    });
    req.on('end', () => (bytes > MAX_BODY ? fail(new LaunchwrightError('qa.comment.body', 'The request body is over 1 MiB.')) : ok(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', fail);
  });
}

/** Applies one POST operation to the comments of a slug and returns the new list. */
async function applyOp(body: string, store: CommentStore, slug: string, clock: Clock): Promise<Comment[]> {
  let op: unknown;
  try {
    op = JSON.parse(body || '{}');
  } catch (cause) {
    throw new LaunchwrightError('qa.comment.body', 'The POST body is not JSON.', { cause });
  }
  if (typeof op !== 'object' || op === null) throw new LaunchwrightError('qa.comment.body', 'The POST body is not an object.');
  const req = op as Record<string, unknown>;
  const list = await store.read(slug);
  const at = clock.date().toISOString();
  let next: Comment[];
  if (req.op === 'add') {
    const c = req.comment as { anchor: Comment['anchor']; author?: string; body?: string };
    next = addComment(list, makeComment({ anchor: c.anchor, author: String(c.author ?? 'reviewer'), body: String(c.body ?? ''), createdAt: at }));
  } else if (req.op === 'reply') {
    const r = req.reply as { author?: string; body?: string };
    next = replyToComment(list, String(req.id), { author: String(r.author ?? 'reviewer'), body: String(r.body ?? ''), createdAt: at });
  } else if (req.op === 'resolve' || req.op === 'reopen') {
    next = setStatus(list, String(req.id), req.op === 'resolve' ? 'resolved' : 'open');
  } else {
    throw new LaunchwrightError('qa.comment.op', `The op "${String(req.op)}" is not add, reply, resolve or reopen.`, { context: { op: req.op } });
  }
  await store.write(slug, next);
  return next;
}

/** Serves one on-disk file under `reportDir`. Refuses a path that escapes the folder. */
async function serveStatic(res: ServerResponse, reportDir: string, pathname: string): Promise<void> {
  const target = resolve(reportDir, `.${pathname}`);
  if (target !== reportDir && !target.startsWith(reportDir + sep)) {
    sendText(res, 403, 'forbidden');
    return;
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(target);
  } catch {
    sendText(res, 404, 'not found');
    return;
  }
  const mime = mimeOfExtension(target) ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': mime, 'content-length': bytes.length });
  res.end(bytes);
}

async function handle(req: IncomingMessage, res: ServerResponse, opts: CommentServerOptions, clock: Clock): Promise<void> {
  const base = `/${opts.viewerDir}/`;
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (pathname === '/' || pathname === base) {
    res.writeHead(302, { location: `${base}index.html` });
    res.end();
    return;
  }
  if (pathname === `${base}comments`) {
    if (req.method === 'GET') return sendJson(res, 200, { slug: opts.slug, comments: await opts.store.read(opts.slug) });
    if (req.method === 'POST') return sendJson(res, 200, { slug: opts.slug, comments: await applyOp(await readBody(req), opts.store, opts.slug, clock) });
    return sendText(res, 405, 'method not allowed');
  }
  if (pathname.startsWith(base)) {
    const name = pathname.slice(base.length);
    const page = opts.renderPages(await opts.store.read(opts.slug)).get(name);
    if (page !== undefined) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
      return;
    }
  }
  await serveStatic(res, opts.reportDir, pathname);
}

/** Starts the comment server on 127.0.0.1. Rejects with `qa.comment.listen` when the port is taken. */
export async function startCommentServer(opts: CommentServerOptions): Promise<CommentServer> {
  const host = opts.host ?? '127.0.0.1';
  const clock = opts.clock ?? systemClock;
  const reportDir = resolve(opts.reportDir);
  const server: Server = createServer((req, res) => {
    void handle(req, res, { ...opts, reportDir }, clock).catch((cause: unknown) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const code = cause instanceof LaunchwrightError ? cause.code : 'qa.comment.server';
      sendJson(res, 400, { error: code });
    });
  });
  await new Promise<void>((ok, fail) => {
    server.once('error', (cause) => fail(new LaunchwrightError('qa.comment.listen', `The comment server cannot listen on ${host}:${opts.port ?? 0}: ${cause.message}`, { cause })));
    server.listen(opts.port ?? 0, host, ok);
  });
  const port = (server.address() as AddressInfo).port;
  const url = `http://${host}:${port}`;
  return {
    port,
    url,
    indexUrl: `${url}/${opts.viewerDir}/index.html`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((ok, fail) => server.close((err) => (err ? fail(err) : ok())));
    },
  };
}
