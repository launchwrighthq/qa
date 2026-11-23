// Where a project loader gets the stamp: the four LW_* build variables, else the checkout.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { systemClock } from './clock.mts';
import { LaunchwrightError } from './errors.mts';
import { DEV_RELEASE, NO_VERSION, parseVersion, type Stamp, stampConfig } from './stamp.mts';

/** The build variable of each stamp field. CI sets them once per run (versioning spec 2.11). */
export const STAMP_VARS = { version: 'LW_VERSION', release: 'LW_RELEASE', commit: 'LW_COMMIT', builtAt: 'LW_BUILT_AT' } as const;

/** The file at a project root that holds the product version. */
export const VERSION_FILE = 'VERSION';

/**
 * The version in `<root>/VERSION`. Throws LaunchwrightError('release.version.file') with
 * `context.problem` `missing`, `lines` or `semver`.
 */
export function readVersionFile(root: string): string {
  const file = join(root, VERSION_FILE);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (cause) {
    const missing = (cause as NodeJS.ErrnoException).code === 'ENOENT';
    throw new LaunchwrightError('release.version.file', missing ? `${file} is missing` : `cannot read ${file}`, {
      cause,
      context: { file, problem: missing ? 'missing' : 'read' },
    });
  }
  return parseVersion(text, file);
}

const SHA = /^[0-9a-f]{40}$/;

/**
 * The HEAD commit of the checkout that holds `root`, or null when no `.git` is found or HEAD names
 * no loose or packed ref (a branch with no commit). It reads the files of `.git`, a worktree
 * included, and starts no git process.
 */
export function checkoutCommit(root: string): string | null {
  const gitDir = findGitDir(root);
  if (gitDir === null) return null;
  const commonFile = join(gitDir, 'commondir');
  const common = existsSync(commonFile) ? resolve(gitDir, readFileSync(commonFile, 'utf8').trim()) : gitDir;
  const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
  const ref = /^ref: (.+)$/.exec(head)?.[1];
  if (ref === undefined) return SHA.test(head) ? head : null;
  for (const dir of [gitDir, common]) {
    const file = join(dir, ref);
    if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  }
  const packed = join(common, 'packed-refs');
  if (!existsSync(packed)) return null;
  const line = readFileSync(packed, 'utf8')
    .split('\n')
    .find((l) => l.endsWith(` ${ref}`));
  return line === undefined ? null : line.slice(0, line.indexOf(' '));
}

/** The git folder of the nearest `.git` from `start` upward: a folder, or the `gitdir:` of a worktree file. */
function findGitDir(start: string): string | null {
  for (let dir = start; ; dir = dirname(dir)) {
    const dotGit = join(dir, '.git');
    if (existsSync(dotGit)) {
      if (statSync(dotGit).isDirectory()) return dotGit;
      const target = /^gitdir: (.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1];
      if (target === undefined) throw new LaunchwrightError('kernel.stamp.commit', `${dotGit} names no gitdir`, { context: { file: dotGit } });
      return resolve(dir, target.trim());
    }
    if (dirname(dir) === dir) return null;
  }
}

/** The nearest folder from `start` upward that holds `launchwright.config.ts`, else `start`. */
export function projectRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'launchwright.config.ts'))) return dir;
    if (dirname(dir) === dir) return start;
  }
}

export interface StampSource {
  /** The project root of the fallback: `VERSION` and the git checkout. */
  root: string;
  /** The process environment that holds the build variables. */
  vars: Record<string, string | undefined>;
  /** The build time of the fallback. */
  now?: Date;
}

/** The value of a build variable, or undefined when it is unset or empty. */
function buildVar(vars: StampSource['vars'], name: string): string | undefined {
  const value = vars[name];
  return value === undefined || value === '' ? undefined : value;
}

/**
 * The stamp of a project. Each field comes from its build variable (`STAMP_VARS`). An unset field
 * falls back: `VERSION` at the root (`0.0.0` when the file is missing), release `dev`, the commit
 * of the checkout, and the load time. Throws LaunchwrightError('kernel.stamp.invalid') that names
 * the variable, or 'release.version.file' for a bad `VERSION`.
 */
export function projectStamp(source: StampSource): Stamp {
  const fromVar = Object.fromEntries(Object.entries(STAMP_VARS).map(([field, name]) => [field, buildVar(source.vars, name)])) as Record<keyof Stamp, string | undefined>;
  const raw: Stamp = {
    version: fromVar.version ?? fallbackVersion(source.root),
    release: fromVar.release ?? DEV_RELEASE,
    commit: fromVar.commit ?? checkoutCommit(source.root),
    builtAt: fromVar.builtAt ?? (source.now ?? systemClock.date()).toISOString(),
  };
  const result = stampConfig.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = String(issue?.path[0] ?? 'version') as keyof Stamp;
  const where = fromVar[field] === undefined ? `stamp.${field}` : STAMP_VARS[field];
  throw new LaunchwrightError('kernel.stamp.invalid', `${where} ${issue?.message ?? 'is invalid'}`, {
    cause: result.error,
    context: { field, variable: STAMP_VARS[field] },
  });
}

function fallbackVersion(root: string): string {
  try {
    return readVersionFile(root);
  } catch (err) {
    if (err instanceof LaunchwrightError && err.context.problem === 'missing') return NO_VERSION;
    throw err;
  }
}
