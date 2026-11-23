import {
  loadDb
} from "./chunk-CNY6SOD7.js";
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
} from "./chunk-4B5GWDFB.js";
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

// src/world/services/stack.mts
import { cp, mkdir, readdir, rm } from "fs/promises";
import { basename as basename2, isAbsolute, resolve as resolve2 } from "path";
var LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"];
var MAINTENANCE_DATABASE = "postgres";
var PGLITE_DIR = ".lw/qa/pglite";
function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.includes(host.replace(/^\[|\]$/g, ""));
}
function databaseName(text2) {
  const name = text2.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "").replace(/_+$/, "");
  return (name === "" ? "app" : name).slice(0, 63);
}
function checkIdentifier(name) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    throw new LaunchwrightError("qa.stack.name", `"${name}" is not a plain database name (lower case letters, digits and _, a letter first).`, { context: { database: name } });
  }
  return name;
}
function pgliteDir(root, name) {
  return resolve2(root, PGLITE_DIR, checkIdentifier(name));
}
function parsePgUrl(url) {
  if (!URL.canParse(url)) return "the database URL cannot be parsed";
  const parsed = new URL(url);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return `${parsed.protocol.replace(":", "")} is not a postgres URL`;
  return parsed;
}
function databaseOfUrl(url) {
  const parsed = parsePgUrl(url);
  if (typeof parsed === "string") throw new LaunchwrightError("qa.stack.url", `Refusing: ${parsed}.`);
  return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
}
function hostOfUrl(url) {
  const parsed = parsePgUrl(url);
  return typeof parsed === "string" ? "an unreadable host" : parsed.host;
}
function urlWithDatabase(url, name) {
  const parsed = parsePgUrl(url);
  if (typeof parsed === "string") throw new LaunchwrightError("qa.stack.url", `Refusing: ${parsed}.`);
  parsed.pathname = `/${checkIdentifier(name)}`;
  return parsed.toString();
}
function remoteHostProblem(url) {
  const parsed = parsePgUrl(url);
  if (typeof parsed === "string") return parsed;
  const host = parsed.hostname;
  return isLoopbackHost(host) ? null : `host ${host} is not this machine, and lw qa writes and drops databases on this machine only`;
}
function qaTargetProblem(db, database, root) {
  if ((db.driver ?? "pg") === "pglite") {
    if (typeof db.dataDir !== "string" || db.dataDir === "") return "the PGlite database has no data folder, so it is the in-memory database of the process";
    const dir = isAbsolute(db.dataDir) ? db.dataDir : resolve2(root, db.dataDir);
    return dir === pgliteDir(root, database) ? null : `the PGlite folder ${dir} is not ${pgliteDir(root, database)}`;
  }
  if (typeof db.url !== "string" || db.url === "") return "no database URL at all";
  const remote = remoteHostProblem(db.url);
  if (remote) return remote;
  const name = databaseOfUrl(db.url);
  return name === database ? null : `database ${name || "(none named)"} is not ${database}, and lw qa may only touch ${database}`;
}
function assertQaTarget(db, database, root) {
  const problem = qaTargetProblem(db, database, root);
  if (problem) throw new LaunchwrightError("qa.stack.target", `Refusing: ${problem}.`, { context: { database } });
}
function qaDbSection(db, database, root) {
  checkIdentifier(database);
  if ((db.driver ?? "pg") === "pglite") return { ...db, driver: "pglite", dataDir: pgliteDir(root, database) };
  if (typeof db.url !== "string" || db.url === "") {
    throw new LaunchwrightError("qa.stack.url", "Config db.url is not set, so the QA world has no server. Set DATABASE_URL in the env file of the run.");
  }
  const out = { ...db, url: urlWithDatabase(db.url, database) };
  assertQaTarget(out, database, root);
  return out;
}
function guard(allowed, name, what) {
  checkIdentifier(name);
  if (!allowed(name)) throw new LaunchwrightError("qa.stack.guard", `Refusing to ${what} database ${name}: lw qa may not touch it.`, { context: { database: name } });
  return name;
}
function quoted(name) {
  return `"${checkIdentifier(name)}"`;
}
async function pgAdmin(url, allowed) {
  const remote = remoteHostProblem(url);
  if (remote) throw new LaunchwrightError("qa.stack.host", `Refusing: ${remote}.`, { context: { host: hostOfUrl(url) } });
  const { createDb } = await loadDb();
  const db = await createDb({ driver: "pg", url: urlWithDatabase(url, MAINTENANCE_DATABASE) });
  const names = async () => {
    const result = await db.execute("select datname from pg_database where not datistemplate");
    return result.rows.map((r) => r.datname);
  };
  return {
    exists: async (name) => (await names()).includes(checkIdentifier(name)),
    async create(name, template) {
      guard(allowed, name, "create");
      try {
        await db.execute(`create database ${quoted(name)}${template === void 0 ? "" : ` template ${quoted(template)}`}`);
      } catch (cause) {
        const message = messageOf(cause);
        if (template !== void 0 && /being accessed by other users/.test(message)) {
          throw new LaunchwrightError("qa.stack.copy", `Cannot copy ${template}: other sessions use it. Stop the run that holds it (lw stop in its checkout), then try again.`, {
            cause,
            context: { database: name, template }
          });
        }
        throw new LaunchwrightError("qa.stack.create", `Cannot create database ${name}: ${message}`, { cause, context: { database: name } });
      }
    },
    async drop(name) {
      guard(allowed, name, "drop");
      await db.execute(
        `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${checkIdentifier(name)}' and usename = current_user and pid <> pg_backend_pid()`
      );
      await db.execute(`drop database if exists ${quoted(name)}`);
    },
    list: async (prefix) => (await names()).filter((n) => n.startsWith(prefix)).sort(),
    close: () => db.close()
  };
}
function pgliteAdmin(root, allowed) {
  const dir = resolve2(root, PGLITE_DIR);
  return {
    async exists(name) {
      return await pathKind(pgliteDir(root, name)) === "dir";
    },
    async create(name, template) {
      guard(allowed, name, "create");
      if (template === void 0) await mkdir(pgliteDir(root, name), { recursive: true });
      else await cp(pgliteDir(root, template), pgliteDir(root, name), { recursive: true, errorOnExist: true, force: false });
    },
    async drop(name) {
      guard(allowed, name, "drop");
      await rm(pgliteDir(root, name), { recursive: true, force: true });
    },
    async list(prefix) {
      let names;
      try {
        names = await readdir(dir);
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.stack.read", `Cannot read ${dir}.`, { cause });
      }
      return names.filter((n) => n.startsWith(prefix)).sort();
    },
    close: async () => void 0
  };
}
function dbAdmin(db, root, allowed) {
  if ((db.driver ?? "pg") === "pglite") return Promise.resolve(pgliteAdmin(root, allowed));
  if (typeof db.url !== "string" || db.url === "") throw new LaunchwrightError("qa.stack.url", "Config db.url is not set, so lw qa has no database server.");
  return pgAdmin(db.url, allowed);
}

// src/world/services/app.mts
import { createHash } from "crypto";
import { isAbsolute as isAbsolute2, resolve as resolve3 } from "path";
import { pathToFileURL } from "url";
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
  const file = isAbsolute2(qa.app) ? qa.app : resolve3(root, qa.app);
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
  const { DEFAULT_TENANT_ID } = await loadDb();
  return { app, tenantId: DEFAULT_TENANT_ID, database: overlay.database, sections: qa, close: () => app.shutdown() };
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
  isLoopbackHost,
  databaseName,
  checkIdentifier,
  databaseOfUrl,
  hostOfUrl,
  urlWithDatabase,
  remoteHostProblem,
  qaTargetProblem,
  assertQaTarget,
  qaDbSection,
  pgAdmin,
  pgliteAdmin,
  dbAdmin,
  qaDatabase,
  QA_TELEGRAM_PORT,
  qaFakeToken,
  qaFakeBots,
  qaSections,
  importFromProject,
  loadAppEntry,
  openWorld,
  worldContext,
  withWorld,
  parseArgs,
  guarded,
  processSignal
};
//# sourceMappingURL=chunk-TMW7THTE.js.map