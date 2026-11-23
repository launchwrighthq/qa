import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunRecord } from '../../../../src/services/peers.mts';
import { parseEnvText } from '../../../support/env-text.mts';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import type { DbAdmin } from '../../../../src/world/services/stack.mts';
import { cleanupWorktrees, runWorktree, setEnvLine, type WorktreeDeps } from '../../../../src/world/services/worktree.mts';

const DEV_URL = 'postgres://lw:pw@127.0.0.1:5432/app_dev';
/** The env file of the dev stack: a file name, not a host. */
const ENV = '.env.local'; // publish-audit: allow

/** A main checkout `shop` with a linked worktree `.claude/worktrees/feat-x`. */
async function checkouts(opts: { mainEnv?: string } = {}): Promise<{ main: string; wt: string }> {
  const base = await tmpDir();
  const main = join(base, 'shop');
  const wt = join(main, '.claude/worktrees/feat-x');
  await mkdir(join(main, '.git/worktrees/feat-x'), { recursive: true });
  await writeFile(join(main, '.git/worktrees/feat-x/commondir'), '../..\n');
  await mkdir(wt, { recursive: true });
  await writeFile(join(wt, '.git'), `gitdir: ${join(main, '.git/worktrees/feat-x')}\n`);
  await writeFile(join(main, ENV), opts.mainEnv ?? `APP_NAME=shop\nDATABASE_URL=${DEV_URL}\n`);
  return { main, wt };
}

interface Calls {
  admin: string[];
  migrated: string[];
  menu: string[];
  envDuringRun: string;
}

function fakeDeps(o: { databases?: string[]; live?: RunRecord[]; tunnel?: string; root?: string } = {}): { deps: WorktreeDeps; calls: Calls } {
  const calls: Calls = { admin: [], migrated: [], menu: [], envDuringRun: '' };
  const databases = new Set(o.databases ?? ['app_dev']);
  let menuSet: () => void = () => undefined;
  const menuDone = new Promise<void>((resolve) => (menuSet = resolve));
  const deps: WorktreeDeps = {
    async admin(url, allowed): Promise<DbAdmin> {
      calls.admin.push(`open ${new URL(url).hostname}`);
      return {
        exists: async (name) => databases.has(name),
        async create(name, template) {
          if (!allowed(name)) throw new Error(`guard ${name}`);
          calls.admin.push(`create ${name} from ${template}`);
          databases.add(name);
        },
        async drop(name) {
          if (!allowed(name)) throw new Error(`guard ${name}`);
          calls.admin.push(`drop ${name}`);
          databases.delete(name);
        },
        list: async (prefix) => [...databases].filter((n) => n.startsWith(prefix)).sort(),
        close: async () => void calls.admin.push('close'),
      };
    },
    async migrate(url) {
      calls.migrated.push(new URL(url).pathname);
      return ['0001_init.sql'];
    },
    async runDev(run) {
      calls.envDuringRun = await readFile(join(run.root, ENV), 'utf8');
      run.err('web on port 5173 at https://tunnel.test');
      if (o.tunnel) await menuDone;
      return 0;
    },
    liveRuns: async () => o.live ?? [],
    currentRun: async () => (o.tunnel ? ({ surfaces: [{ name: 'web', url: o.tunnel }] } as unknown as RunRecord) : null),
    async setMenu(url) {
      calls.menu.push(url);
      menuSet();
    },
    parseEnv: parseEnvText,
  };
  return { deps, calls };
}

const quiet = { out: () => undefined, err: () => undefined };

describe('lw qa worktree', () => {
  it('copies the dev database, runs on the copy, then restores the env file and drops the copy', async () => {
    const { wt } = await checkouts();
    await writeFile(join(wt, ENV), `DATABASE_URL=${DEV_URL}\nAPP_NAME=shop\n`);
    const { deps, calls } = fakeDeps();
    expect(await runWorktree({ root: wt, sections: {}, deps, ...quiet })).toBe(0);
    expect(calls.admin).toEqual(['open 127.0.0.1', 'create shop_wt_feat_x from app_dev', 'drop shop_wt_feat_x', 'close']);
    expect(calls.migrated).toEqual(['/shop_wt_feat_x']);
    expect(parseEnvText(calls.envDuringRun).DATABASE_URL).toBe('postgres://lw:pw@127.0.0.1:5432/shop_wt_feat_x');
    expect(await readFile(join(wt, ENV), 'utf8')).toBe(`DATABASE_URL=${DEV_URL}\nAPP_NAME=shop\n`);
  });

  it('copies the env file of the main checkout when the worktree has none, and keeps the copy with keepDb', async () => {
    const { wt } = await checkouts();
    const { deps, calls } = fakeDeps();
    await runWorktree({ root: wt, sections: { dev: { project: 'shop' } }, keepDb: true, deps, ...quiet });
    expect(calls.admin).toEqual(['open 127.0.0.1', 'create shop_wt_feat_x from app_dev', 'close']);
    expect(parseEnvText(await readFile(join(wt, ENV), 'utf8')).DATABASE_URL).toBe(DEV_URL);
  });

  it('sets the menu button of the dev bot to the tunnel URL of the run', async () => {
    const { wt } = await checkouts();
    const { deps, calls } = fakeDeps({ tunnel: 'https://tunnel.test' });
    await runWorktree({ root: wt, sections: {}, setMenu: {}, deps, ...quiet });
    expect(calls.menu).toEqual(['https://tunnel.test']);
  });

  it('refuses the main checkout', async () => {
    const { main } = await checkouts();
    await expect(runWorktree({ root: main, sections: {}, deps: fakeDeps().deps, ...quiet })).rejects.toMatchObject({ code: 'qa.worktree.main' });
  });

  it('refuses a database host that is not this machine', async () => {
    const { wt } = await checkouts({ mainEnv: 'DATABASE_URL=postgres://lw:pw@db.example.com:5432/app_dev\n' });
    const { deps, calls } = fakeDeps();
    await expect(runWorktree({ root: wt, sections: {}, deps, ...quiet })).rejects.toMatchObject({ code: 'qa.worktree.host' });
    expect(calls.admin).toEqual([]);
  });

  it('refuses a PGlite project', async () => {
    const { wt } = await checkouts();
    await expect(runWorktree({ root: wt, sections: { db: { driver: 'pglite' } }, deps: fakeDeps().deps, ...quiet })).rejects.toMatchObject({ code: 'qa.worktree.driver' });
  });

  it('drops only the copies whose worktree has no live run on cleanup', async () => {
    const { main, wt } = await checkouts();
    const live = { checkout: main } as unknown as RunRecord;
    const { deps } = fakeDeps({ databases: ['app_dev', 'shop_wt_feat_x', 'shop_wt_gone', 'shop_wt_shop'], live: [live] });
    expect(await cleanupWorktrees({ root: wt, sections: {}, deps, out: () => undefined })).toEqual(['shop_wt_feat_x', 'shop_wt_gone']);
  });
});

describe('setEnvLine', () => {
  it('replaces the last line of the key and appends a missing key', () => {
    expect(setEnvLine('A=1\nB=2\nA=3\n', 'A', 'x')).toBe('A=1\nB=2\nA=x\n');
    expect(setEnvLine('B=2', 'A', 'x')).toBe('B=2\nA=x\n');
  });
});
