// `lw qa worktree [--keep-db] [--cleanup] [--set-menu [--bot <name>] [--menu-text <text>] [--surface <s>]]`
// (spec 2.5.4): run this worktree as the dev stack on a copy of the dev database.
import { homedir } from 'node:os';
import { loadDb, loadDev } from '../services/peers.mts';
import { guarded, parseArgs, processSignal } from '../world/services/context.mts';
import { setMenuButton } from '../world/services/menu.mts';
import { pgAdmin } from '../world/services/stack.mts';
import { cleanupWorktrees, runWorktree, type WorktreeDeps } from '../world/services/worktree.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const FLAGS = ['keep-db', 'cleanup', 'set-menu'];

/** The real effects: Postgres, the db migrations, `lw dev` of the dev module, the run registry and the Bot API. */
async function realDeps(opts: QaCommandOptions, sections: Record<string, unknown>, menu: { bot?: string; text: string }, signal: AbortSignal): Promise<WorktreeDeps> {
  const dev = await loadDev();
  const { createDb, migrate } = await loadDb();
  const env = opts.processEnv ?? process.env;
  const configDir = dev.defaultConfigDir(env, homedir());
  return {
    admin: pgAdmin,
    async migrate(url, dir) {
      const db = await createDb({ driver: 'pg', url });
      try {
        return (await migrate(db, dir)).applied;
      } finally {
        await db.close();
      }
    },
    runDev: (o) => dev.runDev({ root: o.root, commonDir: o.commonDir, configDir, env, out: opts.out, err: o.err, signal }, { replace: true }),
    liveRuns: () => new dev.RunRegistry(configDir).list(),
    currentRun: (root) => dev.readRun(dev.pidFile(root, 'local')),
    setMenu: (url) => setMenuButton({ telegram: sections.telegram, ...(menu.bot ? { bot: menu.bot } : {}), text: menu.text, url }),
    parseEnv: dev.parseEnvText,
  };
}

async function run(args: string[], opts: QaCommandOptions): Promise<number> {
  const { words, options } = parseArgs(args, FLAGS, ['bot', 'menu-text', 'surface']);
  if (words.length > 0) {
    opts.err('usage: lw qa worktree [--keep-db] [--cleanup] [--set-menu [--bot <name>] [--menu-text <text>] [--surface <s>]]');
    return 2;
  }
  const sections = opts.config ?? {};
  const stop = processSignal(opts.signal);
  try {
    const menu = { ...(typeof options.bot === 'string' ? { bot: options.bot } : {}), text: typeof options['menu-text'] === 'string' ? options['menu-text'] : 'Open' };
    const deps = await realDeps(opts, sections, menu, stop.signal);
    if (options.cleanup === true) {
      const dropped = await cleanupWorktrees({ root: opts.cwd, sections, out: opts.out, deps });
      opts.out(dropped.length > 0 ? `dropped ${dropped.length} copy(ies)` : 'no copy of a dead run');
      return 0;
    }
    return await runWorktree({
      root: opts.cwd,
      sections,
      keepDb: options['keep-db'] === true,
      ...(options['set-menu'] === true ? { setMenu: typeof options.surface === 'string' ? { surface: options.surface } : {} } : {}),
      out: opts.out,
      err: opts.err,
      deps,
    });
  } finally {
    stop.dispose();
  }
}

const worktree: QaSubcommand = {
  name: 'worktree',
  summary: 'run this worktree as the dev stack on a copy of the dev database, dropped on exit',
  run: (args, opts) => guarded('worktree', opts, () => run(args, opts)),
};

export default worktree;
