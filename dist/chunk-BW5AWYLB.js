import {
  BotApi
} from "./chunk-RZYPGI2F.js";
import {
  databaseName,
  databaseOfUrl,
  devProjectName,
  hostOfUrl,
  readCheckout,
  remoteHostProblem,
  urlWithDatabase
} from "./chunk-TMW7THTE.js";
import {
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/world/services/menu.mts
async function setMenuButton(o) {
  const section = o.telegram ?? {};
  const bots = Object.entries(section.bots ?? {});
  const picked = o.bot === void 0 ? bots.length === 1 ? bots[0] : void 0 : bots.find(([name2]) => name2 === o.bot);
  if (picked === void 0) {
    const names = bots.map(([name2]) => name2).join(", ") || "none";
    throw new LaunchwrightError("qa.menu.bot", o.bot === void 0 ? `Name the dev bot with --bot. Bots: ${names}.` : `No bot ${o.bot} in config telegram.bots. Bots: ${names}.`);
  }
  const [name, bot] = picked;
  if (bot.token === void 0) throw new LaunchwrightError("qa.menu.bot", `Bot ${name} has no token in config, so lw qa cannot set its menu button.`);
  const api = new BotApi({ token: bot.token, ...section.apiUrl ? { apiUrl: section.apiUrl } : {}, ...o.fetch ? { fetch: o.fetch } : {} });
  await api.setChatMenuButton({ type: "web_app", text: o.text, web_app: { url: o.url } });
}

// src/world/services/worktree.mts
import { copyFile, rename, writeFile } from "fs/promises";
import { basename, join } from "path";
var DEFAULT_LOCAL_ENV_FILE = [".env", "local"].join(".");
function envFileName(sections) {
  const dev = sections.dev;
  const name = dev?.envFiles?.local;
  return typeof name === "string" ? name : DEFAULT_LOCAL_ENV_FILE;
}
function copyPrefix(sections, checkout) {
  return `${databaseName(devProjectName(sections, checkout))}_wt_`;
}
function copyName(prefix, toplevel) {
  return `${prefix}${databaseName(basename(toplevel))}`.slice(0, 63);
}
async function planWorktree(o) {
  const checkout = await readCheckout(o.root);
  if (!checkout.linked) {
    throw new LaunchwrightError("qa.worktree.main", "This is the main checkout. Run lw qa worktree from a linked worktree: git worktree add .claude/worktrees/<name>.", {
      context: { root: o.root }
    });
  }
  const db = o.sections.db ?? {};
  if ((db.driver ?? "pg") === "pglite") {
    throw new LaunchwrightError("qa.worktree.driver", "The project uses PGlite. lw qa worktree copies a Postgres database; a PGlite project gives each worktree its own data folder.");
  }
  const name = envFileName(o.sections);
  const envFile = join(o.root, name);
  const mainEnvFile = join(checkout.mainRoot, name);
  if (await readTextOrNull(envFile) === null) {
    if (await readTextOrNull(mainEnvFile) === null) throw new LaunchwrightError("qa.worktree.env", `No ${name} in this worktree and none in the main checkout to copy.`);
    await copyFile(mainEnvFile, envFile);
    o.out(`copied ${name} from the main checkout`);
  }
  const values = o.deps.parseEnv(await readTextOrNull(envFile) ?? "");
  const baseUrl = values.DATABASE_URL || (typeof db.url === "string" ? db.url : "");
  if (baseUrl === "") throw new LaunchwrightError("qa.worktree.url", `DATABASE_URL is not set in ${name}, and config db.url is not set.`);
  const remote = remoteHostProblem(baseUrl);
  if (remote) throw new LaunchwrightError("qa.worktree.host", `Refusing: ${remote}.`, { context: { host: hostOfUrl(baseUrl) } });
  const mainValues = o.deps.parseEnv(await readTextOrNull(mainEnvFile) ?? "");
  const source = databaseOfUrl(mainValues.DATABASE_URL || baseUrl);
  const prefix = copyPrefix(o.sections, checkout);
  const copy = copyName(prefix, checkout.toplevel);
  if (source === copy || source.startsWith(prefix)) {
    throw new LaunchwrightError("qa.worktree.source", `The source database ${source} is a worktree copy. Point DATABASE_URL of the main checkout at the dev database.`);
  }
  return { checkout, envFile, mainEnvFile, baseUrl, source, copy, prefix };
}
function setEnvLine(text, key, value) {
  const lines = text.split("\n");
  const at = lines.findLastIndex((l) => l.replace(/^\s*(export\s+)?/, "").startsWith(`${key}=`));
  if (at === -1) return `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${key}=${value}
`;
  lines[at] = `${key}=${value}`;
  return lines.join("\n");
}
async function writePrivate(path, text) {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, text, { mode: 384 });
  await rename(tmp, path);
}
function menuWatcher(o) {
  let done = false;
  let busy = false;
  return (line) => {
    o.err(line);
    if (done || busy || o.setMenu === void 0) return;
    busy = true;
    void (async () => {
      const run = await o.deps.currentRun(o.root);
      const surface = run?.surfaces.find((s) => s.url !== void 0 && (o.setMenu?.surface === void 0 || s.name === o.setMenu.surface));
      if (surface?.url) {
        done = true;
        await o.deps.setMenu(surface.url);
        o.out(`menu button of the dev bot: ${surface.url}`);
      }
    })().catch((cause) => {
      done = true;
      o.err(`cannot set the menu button: ${messageOf(cause)}`);
    }).finally(() => {
      busy = false;
    });
  };
}
async function runWorktree(o) {
  const plan = await planWorktree(o);
  const allowed = (name) => name.startsWith(plan.prefix);
  const admin = await o.deps.admin(plan.baseUrl, allowed);
  const copyUrl = urlWithDatabase(plan.baseUrl, plan.copy);
  const original = await readTextOrNull(plan.envFile) ?? "";
  let code = 1;
  try {
    o.out(`worktree ${plan.checkout.toplevel}`);
    if (await admin.exists(plan.copy)) o.out(`reusing ${plan.copy}`);
    else {
      o.out(`copying ${plan.source} to ${plan.copy}`);
      await admin.create(plan.copy, plan.source);
    }
    await writePrivate(plan.envFile, setEnvLine(original, "DATABASE_URL", copyUrl));
    o.out(`DATABASE_URL names ${plan.copy}`);
    const dir = join(o.root, typeof o.sections.db?.migrations === "string" ? o.sections.db.migrations : "packages/db/migrations");
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
async function cleanupWorktrees(o) {
  const plan = await planWorktree(o);
  const live = /* @__PURE__ */ new Set();
  for (const run of await o.deps.liveRuns()) live.add(copyName(plan.prefix, (await readCheckout(run.checkout)).toplevel));
  const admin = await o.deps.admin(plan.baseUrl, (name) => name.startsWith(plan.prefix));
  const dropped = [];
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

export {
  setMenuButton,
  copyPrefix,
  copyName,
  planWorktree,
  setEnvLine,
  runWorktree,
  cleanupWorktrees
};
//# sourceMappingURL=chunk-BW5AWYLB.js.map