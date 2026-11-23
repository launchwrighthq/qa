// A throwaway git repository for integration tests. Commits carry fixed dates, so a range by date
// gives the same commits on every run.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LaunchwrightError } from '../../src/kernel/index.mts';

export function git(dir: string, args: string[], env: Record<string, string> = {}): string {
  const res = spawnSync('git', ['-c', 'user.name=QA Test', '-c', 'user.email=qa@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) throw new LaunchwrightError('qa.test.git', `git ${args.join(' ')} failed: ${res.stderr}`);
  return res.stdout.trim();
}

export function initRepo(dir: string): void {
  git(dir, ['init', '-q', '-b', 'main']);
}

/** Writes the files and commits them at `date` (ISO). Returns the full sha. */
export function commit(dir: string, files: Record<string, string>, message: string, date: string): string {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  git(dir, ['add', '--', ...Object.keys(files)]);
  git(dir, ['commit', '-q', '-m', message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  return git(dir, ['rev-parse', 'HEAD']);
}
