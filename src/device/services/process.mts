// The seams of the device submodule: the process runner, the WebSocket, fetch, the clock and the
// free-port probe. Every driver and command takes them as one `DeviceDeps` value, so a test gives
// recorded answers and never starts a tool, opens a socket off loopback or sleeps.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { LaunchwrightError, systemClock } from '@launchwrighthq/kernel';

/** The outcome of one process. A non-zero exit is data, not an exception. */
export interface ProcessResult {
  code: number;
  /** Bytes, because `screencap` and `cat` of a video return binary output. */
  stdout: Buffer;
  stderr: string;
}

/** The milliseconds that `run` gives a process when the caller names no `timeoutMs`. */
export const DEFAULT_RUN_TIMEOUT_MS = 120_000;
/** The `timeoutMs` of a started process that runs until its owner signals it, such as a mirror window. */
export const NO_TIMEOUT = 'none';

export interface RunOptions {
  /** Written to stdin, then stdin closes. */
  input?: string | Buffer;
  /** SIGKILL after this many milliseconds. `run` uses `DEFAULT_RUN_TIMEOUT_MS` without it. */
  timeoutMs?: number;
  /** Added to the environment of the child. */
  env?: Record<string, string>;
}

/** The options of `start`. Each call states its limit: milliseconds, or `NO_TIMEOUT` with the reason at the call. */
export interface StartOptions extends Omit<RunOptions, 'timeoutMs'> {
  timeoutMs: number | typeof NO_TIMEOUT;
  detached?: boolean;
}

/** A process that runs until it exits or gets a signal. */
export interface RunningProcess {
  readonly done: Promise<ProcessResult>;
  signal(sig: NodeJS.Signals): void;
}

export interface ProcessRunner {
  run(cmd: string, args: string[], opts?: RunOptions): Promise<ProcessResult>;
  start(cmd: string, args: string[], opts: StartOptions): RunningProcess;
}

/** The part of a WebSocket that the CDP and WebKit clients use. Node 22's global WebSocket has it. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
}

export type SocketFactory = (url: string, opts?: { origin?: string }) => SocketLike;

/** The clock of the device submodule. A test clock moves `now` forward in `sleep` and never waits. */
export interface DeviceClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface DeviceDeps {
  /** The project root. State and the APK cache live under `<root>/.lw/qa/device/`. */
  root: string;
  run: ProcessRunner;
  socket: SocketFactory;
  fetch: typeof fetch;
  clock: DeviceClock;
  /** A loopback TCP port that nothing listens on. */
  freePort(): Promise<number>;
}

/** The text of stdout. */
export function out(res: ProcessResult): string {
  return res.stdout.toString('utf8');
}

/** stderr, else stdout, trimmed: the stream that carried the message. */
export function said(res: ProcessResult): string {
  return (res.stderr.trim() || out(res).trim()).slice(0, 600);
}

/** Fails with `code` when the process did not exit 0. Returns stdout as text. */
export function orFail(res: ProcessResult, code: string, what: string, context: Record<string, unknown> = {}): string {
  if (res.code === 0) return out(res);
  throw new LaunchwrightError(code, `${what} failed (exit ${res.code}): ${said(res) || 'no output'}`, { context: { ...context, exit: res.code } });
}

function collect(cmd: string, args: string[], opts: StartOptions): RunningProcess {
  const child = spawn(cmd, args, {
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    ...(opts.env ? { env: { ...process.env, ...opts.env } } : {}),
    ...(opts.detached ? { detached: true } : {}),
  });
  const chunks: Buffer[] = [];
  let stderr = '';
  let timer: NodeJS.Timeout | undefined;
  const done = new Promise<ProcessResult>((resolve) => {
    child.stdout?.on('data', (d: Buffer) => chunks.push(d));
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout: Buffer.concat(chunks), stderr: `${cmd}: ${e.message}` });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? (signal ? 128 : -1), stdout: Buffer.concat(chunks), stderr });
    });
  });
  if (opts.input !== undefined) {
    child.stdin?.on('error', (e: NodeJS.ErrnoException) => {
      // A child that exits before it reads stdin closes the pipe. Its exit code carries the failure.
      if (e.code !== 'EPIPE') stderr += `stdin: ${e.message}`;
    });
    child.stdin?.end(opts.input);
  }
  if (opts.timeoutMs !== NO_TIMEOUT) {
    timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs);
  }
  return {
    done,
    signal(sig) {
      child.kill(sig);
    },
  };
}

/** The runner that starts real processes. */
export const nodeRunner: ProcessRunner = {
  run: (cmd, args, opts = {}) => collect(cmd, args, { ...opts, timeoutMs: opts.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS }).done,
  start: (cmd, args, opts) => collect(cmd, args, opts),
};

/** A loopback port that is free now. */
export function freeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/** Node 22's global WebSocket. The `origin` header goes through undici's init object. */
export const globalSocket: SocketFactory = (url, opts) => {
  const init = opts?.origin ? ({ headers: { origin: opts.origin } } as unknown as string[]) : undefined;
  return new WebSocket(url, init) as unknown as SocketLike;
};

/** The deps of a real run in the project at `root`. */
export function systemDeviceDeps(root: string): DeviceDeps {
  return {
    root,
    run: nodeRunner,
    socket: globalSocket,
    fetch: (input, init) => fetch(input, init),
    clock: { now: () => systemClock.now(), sleep: (ms) => systemClock.sleep(ms) },
    freePort: freeLoopbackPort,
  };
}

/** A promise with its settle functions outside it, for socket clients that answer from event handlers. */
export function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: Error) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
}

/** Polls `probe` every `everyMs` until it gives a value, or fails with `code` after `timeoutMs`. */
export async function poll<T>(
  clock: DeviceClock,
  probe: () => Promise<T | null>,
  opts: { timeoutMs: number; everyMs: number; code: string; what: string },
): Promise<T> {
  const deadline = clock.now() + opts.timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== null) return value;
    if (clock.now() >= deadline) {
      throw new LaunchwrightError(opts.code, `${opts.what} did not happen within ${Math.round(opts.timeoutMs / 1000)} s.`);
    }
    await clock.sleep(opts.everyMs);
  }
}
