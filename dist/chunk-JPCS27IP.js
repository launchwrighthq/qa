import {
  databaseName,
  qaDbSection
} from "./chunk-YKX37RJG.js";
import {
  optionalDb
} from "./chunk-I52564IV.js";
import {
  listWorld,
  loadRegistry,
  registryHash
} from "./chunk-I4K4P4GZ.js";
import {
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfig,
  withAppPaths
} from "./chunk-RGX37KPN.js";
import {
  pathKind
} from "./chunk-GZ2IEQDP.js";
import {
  resolveImport,
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/world/services/checkout.mts
import { readFile } from "fs/promises";
import { basename, dirname, join, relative, resolve } from "path";
async function text(path) {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch (cause) {
    throw new LaunchwrightError("qa.checkout.read", `Cannot read ${path}. The git worktree is broken; run git worktree repair.`, { cause });
  }
}
async function readCheckout(root) {
  const start = resolve(root);
  for (let dir = start; ; dir = dirname(dir)) {
    const kind = await pathKind(join(dir, ".git"));
    if (kind === "dir") return { root: start, toplevel: dir, commonDir: join(dir, ".git"), linked: false, mainRoot: start };
    if (kind === "file") {
      const line = await text(join(dir, ".git"));
      const match = /^gitdir:\s*(.+)$/.exec(line);
      if (!match) throw new LaunchwrightError("qa.checkout.read", `${join(dir, ".git")} does not name a git dir.`);
      const gitDir = resolve(dir, match[1]);
      const commonDir = resolve(gitDir, await text(join(gitDir, "commondir")));
      const mainTop = basename(commonDir) === ".git" ? dirname(commonDir) : commonDir;
      return { root: start, toplevel: dir, commonDir, linked: true, mainRoot: join(mainTop, relative(dir, start)) };
    }
    if (dirname(dir) === dir) return { root: start, toplevel: start, commonDir: start, linked: false, mainRoot: start };
  }
}
function devProjectName(sections, checkout) {
  const dev = sections.dev;
  if (typeof dev?.project === "string" && dev.project !== "") return dev.project;
  return basename(basename(checkout.commonDir) === ".git" ? dirname(checkout.commonDir) : checkout.root);
}

// src/world/services/app.mts
import { createHash } from "crypto";
import { isAbsolute, resolve as resolve2 } from "path";
import { pathToFileURL } from "url";
function entryConnect(entry) {
  const connect = entry.connect;
  return connect === void 0 ? void 0 : (url) => connect.call(entry, url);
}
function qaDatabase(sections, checkout) {
  const qa = sections.qa;
  if (typeof qa?.database === "string" && qa.database !== "") return qa.database;
  return databaseName(`${devProjectName(sections, checkout)}_qa`);
}
function botId(token) {
  const match = typeof token === "string" ? /^([1-9][0-9]{0,15}):/.exec(token) : null;
  return match ? Number(match[1]) : void 0;
}
var QA_TELEGRAM_PORT = 9102;
function qaFakeToken(id, registryHash2) {
  return `${id}:${createHash("sha256").update(`lw-qa-fake-bot:${id}:${registryHash2}`).digest("base64url").slice(0, 32)}`;
}
function qaFakeBots(sections, registryHash2) {
  const telegram = sections.telegram;
  const out = [];
  for (const [name, bot] of Object.entries(telegram?.bots ?? {})) {
    const id = typeof bot.id === "number" ? bot.id : botId(bot.token);
    if (id === void 0) continue;
    out.push({ username: typeof bot.username === "string" ? bot.username : name, token: qaFakeToken(id, registryHash2) });
  }
  return out;
}
function qaSections(sections, o) {
  const out = { ...sections };
  out.db = qaDbSection(sections.db ?? {}, o.database, o.root);
  const telegram = sections.telegram;
  if (telegram !== void 0) {
    const bots = {};
    for (const [name, bot] of Object.entries(telegram.bots ?? {})) {
      const { token, ...rest } = bot;
      const id = typeof rest.id === "number" ? rest.id : botId(token);
      bots[name] = id === void 0 ? rest : { ...rest, token: qaFakeToken(id, o.registryHash) };
    }
    out.telegram = { ...telegram, apiUrl: o.telegramUrl, bots };
  }
  out.qa = { ...sections.qa ?? {}, routes: true };
  return out;
}
async function importFromProject(root, specifier) {
  let url;
  try {
    url = pathToFileURL(resolveImport(specifier, root)).href;
  } catch (cause) {
    throw new LaunchwrightError("qa.world.import", `The project at ${root} cannot resolve ${specifier}. Install it in the project.`, { cause, context: { specifier } });
  }
  return await import(url);
}
function isEntry(value) {
  const v = value;
  return typeof v === "object" && v !== null && typeof v.create === "function" && typeof v.serve === "function";
}
async function loadAppEntry(root, qa) {
  const file = isAbsolute(qa.app) ? qa.app : resolve2(root, qa.app);
  let mod;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (cause) {
    throw new LaunchwrightError("qa.world.app", `Cannot load ${file} (config qa.app): ${messageOf(cause)}`, { cause, context: { file } });
  }
  if (!isEntry(mod.qaApp)) {
    throw new LaunchwrightError("qa.world.app", `${file} (config qa.app) must export qaApp = { create(sections, env), serve(app) }.`, { context: { file } });
  }
  return mod.qaApp;
}
async function openWorld(entry, sections, env, overlay) {
  const qa = qaSections(sections, overlay);
  const tenantId = await entryTenant(entry);
  const app = await entry.create(qa, env);
  try {
    await app.boot();
  } catch (cause) {
    try {
      await app.shutdown();
    } catch (shutdown) {
      throw new LaunchwrightError("qa.world.boot", "The QA app did not boot, and its shutdown failed too.", { cause: new AggregateError([cause, shutdown]) });
    }
    throw cause;
  }
  return { app, tenantId, database: overlay.database, sections: qa, close: () => app.shutdown() };
}
async function entryTenant(entry) {
  if (entry.tenantId !== void 0) return entry.tenantId;
  const db = await optionalDb();
  if (db) return db.DEFAULT_TENANT_ID;
  throw new LaunchwrightError("qa.world.tenant", "qaApp sets no tenantId, and the db module that has a default tenant is not installed. Set qaApp.tenantId.");
}

// src/world/services/context.mts
async function worldContext(opts, clock = systemClock) {
  const sections = opts.config ?? {};
  const parsed = qaConfig.safeParse(sections.qa ?? {});
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `qa.${i.path.map(String).join(".")} ${i.message}`);
    throw new LaunchwrightError("qa.config.invalid", `Config section qa is invalid: ${keys.join("; ")}`, { context: { keys } });
  }
  const checkout = await readCheckout(opts.cwd);
  const database = qaDatabase(sections, checkout);
  const registry = await loadRegistry(opts.cwd);
  return {
    root: opts.cwd,
    sections,
    env: opts.env ?? "local",
    qa: withAppPaths(parsed.data, sections),
    checkout,
    overlay: { root: opts.cwd, database, telegramUrl: parsed.data.telegramUrl, registryHash: registryHash(listWorld(registry)) },
    registry,
    clock
  };
}
function worldConnect(ctx) {
  return async (url) => {
    const db = await optionalDb();
    if (db) return db.createDb({ driver: "pg", url });
    const connect = entryConnect(await loadAppEntry(ctx.root, ctx.qa));
    if (connect === void 0) {
      throw new LaunchwrightError("qa.world.connect", `The db module is not installed, and qaApp of ${ctx.qa.app} has no connect(url). Add qaApp.connect, or install the db module.`, {
        context: { app: ctx.qa.app }
      });
    }
    return connect(url);
  };
}
async function withWorld(ctx, fn) {
  const entry = await loadAppEntry(ctx.root, ctx.qa);
  const world = await openWorld(entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    return await fn(world, ctx.registry);
  } finally {
    await world.close();
  }
}
var USAGE_CODE = "kernel.usage";
function parseArgs(args, flags, values = []) {
  const parsed = parseCommandArgs({ switches: flags, values }, args);
  const options = {};
  for (const [name, value] of Object.entries(parsed.values)) if (value !== void 0) options[name] = value;
  for (const name of parsed.switches) options[name] = true;
  return { words: parsed.positionals, options };
}
async function guarded(command, opts, body) {
  try {
    return await body();
  } catch (cause) {
    if (!isCodedError(cause)) throw cause;
    opts.err(`lw qa ${command}: ${cause.message} (${cause.code})`);
    return cause.code === USAGE_CODE ? 2 : 1;
  }
}
function processSignal(given) {
  if (given) return { signal: given, dispose: () => void 0 };
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return {
    signal: controller.signal,
    dispose() {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
  };
}

export {
  readCheckout,
  devProjectName,
  entryConnect,
  qaDatabase,
  QA_TELEGRAM_PORT,
  qaFakeToken,
  qaFakeBots,
  qaSections,
  importFromProject,
  loadAppEntry,
  openWorld,
  worldContext,
  worldConnect,
  withWorld,
  parseArgs,
  guarded,
  processSignal
};
//# sourceMappingURL=chunk-JPCS27IP.js.map