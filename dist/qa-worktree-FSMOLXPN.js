import {
  cleanupWorktrees,
  runWorktree,
  setMenuButton
} from "./chunk-JT5SSRAX.js";
import "./chunk-RZYPGI2F.js";
import {
  guarded,
  parseArgs,
  processSignal
} from "./chunk-L6Q4YNOC.js";
import {
  pgAdmin
} from "./chunk-ZJ35OYFC.js";
import {
  loadDb,
  loadDev
} from "./chunk-CNY6SOD7.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-7OHVK72J.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-5AJ7M7K5.js";
import "./chunk-KK6DCU3O.js";

// src/commands/qa-worktree.mts
import { homedir } from "os";
var FLAGS = ["keep-db", "cleanup", "set-menu"];
async function realDeps(opts, sections, menu, signal) {
  const dev = await loadDev();
  const { createDb, migrate } = await loadDb();
  const env = opts.processEnv ?? process.env;
  const configDir = dev.defaultConfigDir(env, homedir());
  return {
    admin: pgAdmin,
    async migrate(url, dir) {
      const db = await createDb({ driver: "pg", url });
      try {
        return (await migrate(db, dir)).applied;
      } finally {
        await db.close();
      }
    },
    runDev: (o) => dev.runDev({ root: o.root, commonDir: o.commonDir, configDir, env, out: opts.out, err: o.err, signal }, { replace: true }),
    liveRuns: () => new dev.RunRegistry(configDir).list(),
    currentRun: (root) => dev.readRun(dev.pidFile(root, "local")),
    setMenu: (url) => setMenuButton({ telegram: sections.telegram, ...menu.bot ? { bot: menu.bot } : {}, text: menu.text, url }),
    parseEnv: dev.parseEnvText
  };
}
async function run(args, opts) {
  const { words, options } = parseArgs(args, FLAGS, ["bot", "menu-text", "surface"]);
  if (words.length > 0) {
    opts.err("usage: lw qa worktree [--keep-db] [--cleanup] [--set-menu [--bot <name>] [--menu-text <text>] [--surface <s>]]");
    return 2;
  }
  const sections = opts.config ?? {};
  const stop = processSignal(opts.signal);
  try {
    const menu = { ...typeof options.bot === "string" ? { bot: options.bot } : {}, text: typeof options["menu-text"] === "string" ? options["menu-text"] : "Open" };
    const deps = await realDeps(opts, sections, menu, stop.signal);
    if (options.cleanup === true) {
      const dropped = await cleanupWorktrees({ root: opts.cwd, sections, out: opts.out, deps });
      opts.out(dropped.length > 0 ? `dropped ${dropped.length} copy(ies)` : "no copy of a dead run");
      return 0;
    }
    return await runWorktree({
      root: opts.cwd,
      sections,
      keepDb: options["keep-db"] === true,
      ...options["set-menu"] === true ? { setMenu: typeof options.surface === "string" ? { surface: options.surface } : {} } : {},
      out: opts.out,
      err: opts.err,
      deps
    });
  } finally {
    stop.dispose();
  }
}
var worktree = {
  name: "worktree",
  summary: "run this worktree as the dev stack on a copy of the dev database, dropped on exit",
  run: (args, opts) => guarded("worktree", opts, () => run(args, opts))
};
var qa_worktree_default = worktree;
export {
  qa_worktree_default as default
};
//# sourceMappingURL=qa-worktree-FSMOLXPN.js.map