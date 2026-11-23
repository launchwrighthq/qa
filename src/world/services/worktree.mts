// `lw qa worktree [--keep-db] [--cleanup] [--set-menu]` (spec 2.5.4), ported from
// `qa-test-worktree.sh`. It runs the branch of a linked worktree as the dev stack on a copy of the
// database that the main checkout uses, so the writes of a test go away with the run.
// Refusals: the main checkout, a database host that is not this machine, a PGlite project, and
// any create or drop of a name outside `<dev.project>_wt_`.
import { copyFile, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { LaunchwrightError, messageOf } from '@launchwrighthq/kernel';
import { readTextOrNull } from '@launchwrighthq/kernel/fs';
import type { RunRecord } from '../../services/peers.mts';
import { type CheckoutFacts, devProjectName, readCheckout } from './checkout.mts';
import { databaseName, databaseOfUrl, type DbAdmin, hostOfUrl, remoteHostProblem, urlWithDatabase } from './stack.mts';

/** The outside effects of a worktree run. Tests replace each one. */
export interface WorktreeDeps {
  /** The admin of the Postgres server of `url`, limited to the names that `allowed` accepts. */
  admin(url: string, allowed: (name: string) => boolean): Promise<DbAdmin>;
  /** Applies the migrations of `dir` to the database of `url`. Gives the applied names. */
  migrate(url: string, dir: string): Promise<string[]>;
  /** `lw dev --replace` in the foreground. Gives its exit code. */
  runDev(o: { root: string; commonDir: string; err: (line: string) => void }): Promise<number>;
  /** The live runs of the machine-wide run registry. */
  liveRuns(): Promise<RunRecord[]>;
  /** The run record of this checkout, from its pid file. */
  currentRun(root: string): Promise<RunRecord | null>;
  /** Sets the menu button of the dev bot to a Mini App URL. */
  setMenu(url: string): Promise<void>;
  /** Parses the `KEY=value` lines of an env file. */
  parseEnv(text: string): Record<string, string>;
}

export interface WorktreeOptions {
  root: string;
  sections: Record<string, unknown>;
  keepDb?: boolean;
  /** Set the menu button of the dev bot to the tunnel URL of this surface, or of the first surface with one. */
  setMenu?: { surface?: string };
  out: (line: string) => void;
  err: (line: string) => void;
  deps: WorktreeDeps;
}

/** The facts of a worktree run, before it changes anything. */
export interface WorktreePlan {
  checkout: CheckoutFacts;
  envFile: string;
  mainEnvFile: string;
  /** The URL that names the server, from the env file of the worktree or config `db.url`. */
  baseUrl: string;
  source: string;
  copy: string;
  prefix: string;
}

function envFileName(sections: Record<string, unknown>): string {
  const dev = sections.dev as { envFiles?: { local?: unknown } } | undefined;
  return typeof dev?.envFiles?.local === 'string' ? dev.envFiles.local : '.env.local'; // config key and file name, not hosts. publish-audit: allow
}

/** The copy prefix of a project: `<dev.project>_wt_`. */
export function copyPrefix(sections: Record<string, unknown>, checkout: CheckoutFacts): string {
  return `${databaseName(devProjectName(sections, checkout))}_wt_`;
}

/** The copy of a checkout: the prefix and the folder name of its top level, 63 characters at most. */
export function copyName(prefix: string, toplevel: string): string {
  return `${prefix}${databaseName(basename(toplevel))}`.slice(0, 63);
}

/** Checks the checkout and the database, and names the source and the copy. Changes nothing but a missing env file. */
export async function planWorktree(o: Pick<WorktreeOptions, 'root' | 'sections' | 'out' | 'deps'>): Promise<WorktreePlan> {
  const checkout = await readCheckout(o.root);
  if (!checkout.linked) {
    throw new LaunchwrightError('qa.worktree.main', 'This is the main checkout. Run lw qa worktree from a linked worktree: git worktree add .claude/worktrees/<name>.', {
      context: { root: o.root },
    });
  }
  const db = (o.sections.db ?? {}) as { driver?: string; url?: unknown };
  if ((db.driver ?? 'pg') === 'pglite') {
    throw new LaunchwrightError('qa.worktree.driver', 'The project uses PGlite. lw qa worktree copies a Postgres database; a PGlite project gives each worktree its own data folder.');
  }
  const name = envFileName(o.sections);
  const envFile = join(o.root, name);
  const mainEnvFile = join(checkout.mainRoot, name);
  if ((await readTextOrNull(envFile)) === null) {
    if ((await readTextOrNull(mainEnvFile)) === null) throw new LaunchwrightError('qa.worktree.env', `No ${name} in this worktree and none in the main checkout to copy.`);
    await copyFile(mainEnvFile, envFile);
    o.out(`copied ${name} from the main checkout`);
  }
  const values = o.deps.parseEnv((await readTextOrNull(envFile)) ?? '');
  const baseUrl = values.DATABASE_URL || (typeof db.url === 'string' ? db.url : '');
  if (baseUrl === '') throw new LaunchwrightError('qa.worktree.url', `DATABASE_URL is not set in ${name}, and config db.url is not set.`);
  const remote = remoteHostProblem(baseUrl);
  if (remote) throw new LaunchwrightError('qa.worktree.host', `Refusing: ${remote}.`, { context: { host: hostOfUrl(baseUrl) } });
  const mainValues = o.deps.parseEnv((await readTextOrNull(mainEnvFile)) ?? '');
  const source = databaseOfUrl(mainValues.DATABASE_URL || baseUrl);
  const prefix = copyPrefix(o.sections, checkout);
  const copy = copyName(prefix, checkout.toplevel);
  if (source === copy || source.startsWith(prefix)) {
    throw new LaunchwrightError('qa.worktree.source', `The source database ${source} is a worktree copy. Point DATABASE_URL of the main checkout at the dev database.`);
  }
  return { checkout, envFile, mainEnvFile, baseUrl, source, copy, prefix };
}

/** Sets `KEY=value` in env file text: replaces the last line of the key, or appends one. */
export function setEnvLine(text: string, key: string, value: string): string {
  const lines = text.split('\n');
  const at = lines.findLastIndex((l) => l.replace(/^\s*(export\s+)?/, '').startsWith(`${key}=`));
  if (at === -1) return `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
  lines[at] = `${key}=${value}`;
  return lines.join('\n');
}

async function writePrivate(path: string, text: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, text, { mode: 0o600 });
  await rename(tmp, path);
}

/** Watches the run for the tunnel URL and sets the menu button once. */
function menuWatcher(o: WorktreeOptions): (line: string) => void {
  let done = false;
  let busy = false;
  return (line) => {
    o.err(line);
    if (done || busy || o.setMenu === undefined) return;
    busy = true;
    void (async () => {
      const run = await o.deps.currentRun(o.root);
      const surface = run?.surfaces.find((s) => s.url !== undefined && (o.setMenu?.surface === undefined || s.name === o.setMenu.surface));
      if (surface?.url) {
        done = true;
        await o.deps.setMenu(surface.url);
        o.out(`menu button of the dev bot: ${surface.url}`);
      }
    })()
      .catch((cause: unknown) => {
        done = true;
        o.err(`cannot set the menu button: ${messageOf(cause)}`);
      })
      .finally(() => {
        busy = false;
      });
  };
}

/**
 * Copies the dev database, migrates the copy, points the env file of the worktree at it, runs
 * `lw dev --replace` in the foreground, and on exit restores the env file and drops the copy
 * (unless `keepDb`). Gives the exit code of the run.
 */
export async function runWorktree(o: WorktreeOptions): Promise<number> {
  const plan = await planWorktree(o);
  const allowed = (name: string): boolean => name.startsWith(plan.prefix);
  const admin = await o.deps.admin(plan.baseUrl, allowed);
  const copyUrl = urlWithDatabase(plan.baseUrl, plan.copy);
  const original = (await readTextOrNull(plan.envFile)) ?? '';
  let code = 1;
  try {
    o.out(`worktree ${plan.checkout.toplevel}`);
    if (await admin.exists(plan.copy)) o.out(`reusing ${plan.copy}`);
    else {
      o.out(`copying ${plan.source} to ${plan.copy}`);
      await admin.create(plan.copy, plan.source);
    }
    await writePrivate(plan.envFile, setEnvLine(original, 'DATABASE_URL', copyUrl));
    o.out(`DATABASE_URL names ${plan.copy}`);
    const dir = join(o.root, typeof (o.sections.db as { migrations?: unknown } | undefined)?.migrations === 'string' ? (o.sections.db as { migrations: string }).migrations : 'packages/db/migrations');
    const applied = await o.deps.migrate(copyUrl, dir);
    o.out(`migrated ${plan.copy}: ${applied.length} migration(s)`);
    code = await o.deps.runDev({ root: o.root, commonDir: plan.checkout.commonDir, err: menuWatcher(o) });
  } finally {
    await writePrivate(plan.envFile, original);
    try {
      if (o.keepDb) o.out(`keeping ${plan.copy} (--keep-db)`);
      else {
        await admin.drop(plan.copy);
        o.out(`dropped ${plan.copy}`);
      }
    } finally {
      await admin.close();
    }
  }
  return code;
}

/** `--cleanup`: drops each copy of this project whose worktree has no live `lw dev` run. Gives the dropped names. */
export async function cleanupWorktrees(o: Pick<WorktreeOptions, 'root' | 'sections' | 'out' | 'deps'>): Promise<string[]> {
  const plan = await planWorktree(o);
  const live = new Set<string>();
  for (const run of await o.deps.liveRuns()) live.add(copyName(plan.prefix, (await readCheckout(run.checkout)).toplevel));
  const admin = await o.deps.admin(plan.baseUrl, (name) => name.startsWith(plan.prefix));
  const dropped: string[] = [];
  try {
    for (const name of await admin.list(plan.prefix)) {
      if (live.has(name)) {
        o.out(`keeping ${name}: its run is live`);
        continue;
      }
      await admin.drop(name);
      dropped.push(name);
      o.out(`dropped ${name}`);
    }
  } finally {
    await admin.close();
  }
  return dropped;
}
