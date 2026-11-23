#!/usr/bin/env node
// The release of the public library (spec 2.13, risk 3.5): `pnpm release <patch|minor|major|X.Y.Z>
// [--push] [--dry-run]`. Every check runs before the release commit and the tag, the publish scan
// included, so a release with a hit never gets a tag. A real run stops at the first failed check.
// A dry run runs every check, names each failure, and prints what a real run would do.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { report, scanCommits, scanCurrentIdentity, scanTree, sinceTagRange } from './scan.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BRANCH = 'main';
const REMOTE = 'origin';
const INSTALL_TAG = /github:launchwrighthq\/qa#v\d+\.\d+\.\d+/g;
const USAGE = 'usage: pnpm release <patch|minor|major|X.Y.Z> [--push] [--dry-run]';

class ReleaseError extends Error {}

function run(command, args, { inherit = false } = {}) {
  const r = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 1 << 30 });
  if (r.error) throw new ReleaseError(`${command} ${args.join(' ')} did not start: ${r.error.message}`);
  if (r.status !== 0) throw new ReleaseError(`${command} ${args.join(' ')} exited ${r.status}${inherit ? '' : `: ${(r.stderr || r.stdout).trim()}`}`);
  return inherit ? '' : r.stdout.trim();
}

const git = (...args) => run('git', args);

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));
  for (const flag of flags) if (flag !== '--push' && flag !== '--dry-run') throw new ReleaseError(`unknown option ${flag}. ${USAGE}`);
  if (positional.length !== 1) throw new ReleaseError(USAGE);
  return { bump: positional[0], push: flags.has('--push'), dryRun: flags.has('--dry-run') };
}

const parseVersion = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new ReleaseError(`${v} is not a version of the form X.Y.Z`);
  return m.slice(1).map(Number);
};

function nextVersion(current, bump) {
  const [major, minor, patch] = parseVersion(current);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  const next = parseVersion(bump);
  const order = next.findIndex((n, i) => n !== [major, minor, patch][i]);
  if (order < 0 || next[order] < [major, minor, patch][order]) throw new ReleaseError(`version ${bump} is not after the current version ${current}`);
  return bump;
}

function scanCheck(result) {
  const out = [];
  const code = report(result, (line) => out.push(line));
  console.log(out.map((l) => `    ${l}`).join('\n'));
  if (code !== 0) throw new ReleaseError(`the publish scan refused ${result.findings.length} hits (listed above)`);
}

/** The checks, in order. Each throws a ReleaseError with the reason. */
function checks(tag) {
  return [
    ['on branch main', () => {
      const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
      if (branch !== BRANCH) throw new ReleaseError(`HEAD is on ${branch}, a release runs on ${BRANCH}`);
    }],
    ['clean tree', () => {
      const status = git('status', '--porcelain');
      if (status) throw new ReleaseError(`the tree has changes:\n${status}`);
    }],
    [`tag ${tag} is new`, () => {
      if (spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: ROOT }).status === 0) throw new ReleaseError(`tag ${tag} exists`);
    }],
    ['README names the install tag', () => {
      if (!readFileSync(join(ROOT, 'README.md'), 'utf8').match(INSTALL_TAG)) throw new ReleaseError('README.md holds no github:launchwrighthq/qa#vX.Y.Z install tag');
    }],
    ['identity of the release commit and tag', () => scanCheck(scanCurrentIdentity())],
    ['publish scan of the tree of HEAD', () => scanCheck(scanTree('HEAD'))],
    [`publish scan of the commits since the last tag (${sinceTagRange('HEAD').join(' ')})`, () => scanCheck(scanCommits(sinceTagRange('HEAD')))],
    ['pnpm typecheck', () => run('pnpm', ['typecheck'], { inherit: true })],
    ['pnpm test', () => run('pnpm', ['test'], { inherit: true })],
    ['pnpm compile', () => run('pnpm', ['compile'], { inherit: true })],
    ['dist is committed and current', () => {
      if (!git('ls-files', 'dist')) throw new ReleaseError('dist/ is not committed');
      const diff = git('status', '--porcelain', '--', 'dist');
      if (diff) throw new ReleaseError(`pnpm compile changed dist/, so the committed build is stale. Commit the new build first:\n${diff}`);
    }],
  ];
}

function runChecks(list, dryRun) {
  const failures = [];
  for (const [name, check] of list) {
    console.log(`release: check ${name}`);
    try {
      check();
      console.log(`release: ok    ${name}`);
    } catch (error) {
      if (!(error instanceof ReleaseError)) throw error;
      console.log(`release: FAIL  ${name}: ${error.message}`);
      failures.push(`${name}: ${error.message}`);
      if (!dryRun) break;
    }
  }
  return failures;
}

function bumpFiles(version) {
  const pkgPath = join(ROOT, 'package.json');
  const pkg = readFileSync(pkgPath, 'utf8');
  const bumped = pkg.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${version}$2`);
  if (bumped === pkg) throw new ReleaseError('package.json holds no "version" line to change');
  writeFileSync(pkgPath, bumped);
  const readmePath = join(ROOT, 'README.md');
  writeFileSync(readmePath, readFileSync(readmePath, 'utf8').replace(INSTALL_TAG, `github:launchwrighthq/qa#v${version}`));
}

function main(argv) {
  const { bump, push, dryRun } = parseArgs(argv);
  const current = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const version = nextVersion(current, bump);
  const tag = `v${version}`;
  console.log(`release: ${current} -> ${version}${dryRun ? ' (dry run)' : ''}`);
  const failures = runChecks(checks(tag), dryRun);
  if (failures.length) {
    console.log(`release: refused, no commit and no tag. ${failures.length} failed checks:`);
    for (const f of failures) console.log(`  - ${f.split('\n')[0]}`);
    return 1;
  }
  const plan = [
    `set package.json version ${current} -> ${version}`,
    `set the README install tag to v${version}`,
    `commit package.json and README.md as "chore(release): ${tag}"`,
    `scan the release commit, then create the annotated tag ${tag} ("Launchwright QA ${tag}")`,
    push ? `push ${BRANCH} and ${tag} to ${REMOTE} in one atomic push` : `push nothing (pass --push to push ${BRANCH} and ${tag})`,
  ];
  if (dryRun) {
    console.log('release: every check passed. A real run would:');
    for (const step of plan) console.log(`  - ${step}`);
    return 0;
  }
  bumpFiles(version);
  git('add', '--', 'package.json', 'README.md');
  git('commit', '-q', '-m', `chore(release): ${tag}`);
  const head = git('rev-parse', '--short', 'HEAD');
  const failed = runChecks([['publish scan of the release commit', () => scanCheck(scanCommits(['HEAD^..HEAD']))]], false);
  if (failed.length) {
    console.log(`release: refused before the tag. Undo the release commit ${head} with: git reset --hard HEAD^`);
    return 1;
  }
  git('tag', '-a', tag, '-m', `Launchwright QA ${tag}`);
  console.log(`release: committed ${head} and tagged ${tag}`);
  if (!push) {
    console.log(`release: not pushed. Push with: git push --atomic ${REMOTE} ${BRANCH} ${tag}`);
    return 0;
  }
  run('git', ['push', '--atomic', REMOTE, BRANCH, tag], { inherit: true });
  console.log(`release: pushed ${BRANCH} and ${tag} to ${REMOTE}`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`release: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = error instanceof ReleaseError ? 1 : 2;
}
