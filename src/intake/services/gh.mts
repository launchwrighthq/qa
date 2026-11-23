// Runs the GitHub CLI. The github intake driver takes a runner, so a test gives recorded output.
import { spawn } from 'node:child_process';
import { LaunchwrightError } from '@launchwrighthq/kernel';

export interface GhResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs `gh <args>` and returns its exit code and output. */
export type GhRunner = (args: string[]) => Promise<GhResult>;

/** The milliseconds that one `gh` call may take: one API page, or one issue with its comments. */
export const GH_TIMEOUT_MS = 60_000;

/**
 * A runner that starts `bin` (the real `gh` by default). A missing binary throws
 * `qa.intake.github.gh`. A call past `timeoutMs` is killed and throws `qa.intake.github.timeout`.
 */
export function ghRunner(opts: { bin?: string; timeoutMs?: number } = {}): GhRunner {
  const bin = opts.bin ?? 'gh';
  const timeoutMs = opts.timeoutMs ?? GH_TIMEOUT_MS;
  return (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs, killSignal: 'SIGKILL' });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      child.stdout.on('data', (b: Buffer) => out.push(b));
      child.stderr.on('data', (b: Buffer) => err.push(b));
      child.on('error', (cause) => {
        reject(new LaunchwrightError('qa.intake.github.gh', 'Cannot start gh. Install the GitHub CLI and run gh auth login.', { cause }));
      });
      child.on('close', (code, signal) => {
        if (code === null && signal === 'SIGKILL') {
          const command = args.slice(0, 2).join(' ');
          reject(new LaunchwrightError('qa.intake.github.timeout', `gh ${command} ran past ${timeoutMs} ms and was stopped.`, { context: { command, timeoutMs } }));
          return;
        }
        resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') });
      });
    });
}

/** The runner that starts the real `gh`. */
export const spawnGh: GhRunner = ghRunner();
