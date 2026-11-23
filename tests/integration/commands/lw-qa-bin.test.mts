// The `lw-qa` launcher as a child process: a large output reaches a pipe in full, and a
// long-running command stops on SIGINT with exit code 0.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { commit, initRepo } from '../../support/git-repo.mts';

const BIN = fileURLToPath(new URL('../../../bin/lw-qa.mjs', import.meta.url));
/** Enough headings for a JSON answer of about 2.9 MB, far over the 64 KiB of a Linux pipe buffer. */
const SECTIONS = 20_000;

let repo: string;

interface Run {
  code: number | null;
  stdout: Buffer;
  stderr: string;
}

/** Runs the bin with piped stdio. `onStderr` sees each stderr chunk, so a test can signal the child. */
function runBin(args: string[], onStderr?: (text: string, child: ReturnType<typeof spawn>) => void): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString('utf8');
      onStderr?.(err, child);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(out), stderr: err }));
  });
}

beforeAll(async () => {
  repo = await tmpDir();
  initRepo(repo);
  const lines = ['# Big spec', '', 'Date: 2026-01-01', 'Status: approved', ''];
  for (let i = 0; i < SECTIONS; i++) lines.push(`## Section ${i} with a long heading that makes the answer large`);
  commit(repo, { 'docs/big-spec.md': `${lines.join('\n')}\n` }, 'docs: big spec', '2026-01-01T08:00:00Z');
});

describe('lw-qa bin', () => {
  it('writes a large answer to a pipe in full before it exits', async () => {
    const run = await runBin(['session', 'resolve', 'docs/big-spec.md']);
    expect(run.code).toBe(0);
    expect(run.stdout.length).toBeGreaterThan(1_000_000);
    const answer = JSON.parse(run.stdout.toString('utf8')) as { spec: { sections: unknown[] } };
    expect(answer.spec.sections).toHaveLength(SECTIONS);
  });

  it('stops a long-running command on SIGINT and exits 0', async () => {
    let sent = false;
    const run = await runBin(['sink', '--tunnel', 'none', '--port', '0'], (text, child) => {
      if (!sent && text.includes('Ctrl-C stops it')) {
        sent = true;
        child.kill('SIGINT');
      }
    });
    expect(sent).toBe(true);
    expect(run.code).toBe(0);
    expect(run.stderr).toContain('requests recorded in');
  });
});
