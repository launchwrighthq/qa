// The git modes of the publish scan (scripts/scan.mjs, spec 2.12 and risk 3.5) against a throwaway
// repository: the tree, the commits since the last tag, and the pre-push hook input.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { git, initRepo } from '../../support/git-repo.mts';

const SCAN = fileURLToPath(new URL('../../../scripts/scan.mjs', import.meta.url));
const NOREPLY = `1+qa${'@'}users.noreply.github.com`;
const PRIVATE = `alice${'@'}corp.io`;
/** A credential-shaped value, built at run time so this file holds none. */
const TOKEN = `ghp_${'Kx7Qm2Rv9Tz4Wn8Bd3Fh6Jl1Ps5Uy0Ce'}${'Ag'}`;

let repo: string;
let clean: string;
let planted: string;

const as = (email: string) => ({ GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_EMAIL: email });

function commitFile(path: string, text: string, message: string, email: string): string {
  writeFileSync(join(repo, path), text);
  git(repo, ['add', '--', path]);
  git(repo, ['commit', '-q', '-m', message], as(email));
  return git(repo, ['rev-parse', 'HEAD']);
}

function scan(args: string[], input = '') {
  const r = spawnSync(process.execPath, [SCAN, ...args], { cwd: repo, encoding: 'utf8', input });
  return { code: r.status, out: r.stdout + r.stderr };
}

beforeAll(async () => {
  repo = await tmpDir();
  initRepo(repo);
  commitFile('README.md', '# app\n', 'chore: start', NOREPLY);
  git(repo, ['tag', '-a', 'v0.1.0', '-m', 'v0.1.0'], as(NOREPLY));
  clean = commitFile('a.txt', 'served on 127.0.0.1\n', 'feat: a', NOREPLY);
  planted = commitFile('b.txt', `const token = "${TOKEN}";\n`, 'feat: b', NOREPLY);
  commitFile('b.txt', 'gone\n', 'fix: drop b', PRIVATE);
});

describe('publish scan, git modes', () => {
  it('passes a clean range and a clean tree', () => {
    expect(scan(['--since-tag', clean])).toMatchObject({ code: 0 });
    expect(scan(['--tree', 'HEAD'])).toMatchObject({ code: 0 });
  });

  it('refuses a credential that a later commit removed, and a private identity, with the value redacted', () => {
    const { code, out } = scan(['--since-tag', 'HEAD']);
    expect(code).toBe(1);
    expect(out).toContain(`${planted.slice(0, 7)}:b.txt:1 api-key [redacted, ${TOKEN.length} chars]`);
    expect(out).toMatch(/commit [0-9a-f]{7} author:1 identity/);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(PRIVATE);
  });

  it('refuses a pre-push of a ref whose new commits hold a hit', () => {
    const line = `refs/heads/main ${git(repo, ['rev-parse', 'HEAD'])} refs/heads/main ${clean}\n`;
    expect(scan(['--pre-push', 'origin'], line).code).toBe(1);
    const cleanLine = `refs/heads/main ${clean} refs/heads/main ${git(repo, ['rev-parse', 'v0.1.0^{commit}'])}\n`;
    expect(scan(['--pre-push', 'origin'], cleanLine)).toMatchObject({ code: 0 });
  });
});
