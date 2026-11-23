import "./chunk-56BIZAV7.js";
import {
  ShiftClock,
  parseShift,
  qaConfig,
  withAppPaths
} from "./chunk-IOYCNVPS.js";
import {
  pathKind,
  readTextOrNull,
  sha256
} from "./chunk-7LPVXBKF.js";
import {
  LaunchwrightError,
  appPath,
  messageOf,
  optionalPeer,
  resolveImport,
  systemClock
} from "./chunk-2ITTLG7O.js";

// src/world/services/app.mts
import { createHash } from "crypto";
import { isAbsolute as isAbsolute2, resolve as resolve3 } from "path";
import { pathToFileURL } from "url";

// src/services/peers.mts
async function loadPeer(spec, module) {
  const mod = await optionalPeer(spec, () => import(spec));
  if (!mod) throw new LaunchwrightError(`qa.${module}.module`, `This lw qa command needs the ${module} module. Run lw add ${module}.`);
  return mod;
}
var loadDb = () => loadPeer("@launchwrighthq/db", "db");
var loadAuth = () => loadPeer("@launchwrighthq/auth", "auth");
var loadTelegram = () => loadPeer("@launchwrighthq/telegram", "telegram");

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

// src/world/services/discover.mts
import { readdir as readdir2, readFile as readFile2 } from "fs/promises";
import { basename as basename3, dirname as dirname2, join as join2, relative as relative2, sep } from "path";
import { pathToFileURL as pathToFileURL2 } from "url";

// src/world/services/ids.mts
var QA_TELEGRAM_ID_BASE = 9e8;
var QA_TELEGRAM_ID_SPAN = 1e6;
function qaTelegramId(persona) {
  if (persona.length === 0) throw new LaunchwrightError("client.qa.persona", "qaTelegramId needs a persona id");
  let hash = 2166136261;
  for (let i = 0; i < persona.length; i += 1) {
    hash ^= persona.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return QA_TELEGRAM_ID_BASE + hash % QA_TELEGRAM_ID_SPAN;
}
var QA_PROVIDER = "qa";
function qaAccountId(persona) {
  return `${QA_PROVIDER}:${persona}`;
}
function personaIds(persona) {
  return { persona, accountId: qaAccountId(persona), telegramId: qaTelegramId(persona) };
}
function idProblem(id) {
  if (id.length === 0) return "an id is empty";
  if (id.length > 64) return `${id} has more than 64 characters`;
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id) ? null : `${id} is not a kebab case or dotted id, and it must survive a URL`;
}

// src/world/services/registry.mts
function defineWorld(world) {
  return world;
}
function buildRegistry(worlds) {
  const own = (w, items) => (items ?? []).map((item) => ({ ...item, feature: w.feature, file: w.file }));
  return {
    personas: worlds.flatMap((w) => own(w, w.world.personas)),
    facts: worlds.flatMap((w) => own(w, w.world.facts))
  };
}
function registryProblem(registry) {
  if (registry.personas.length === 0) return "no world file declares a persona, so there is no user to be";
  if (registry.facts.length === 0) return "no world file declares a fact, so there is no state to address";
  const seen = /* @__PURE__ */ new Map();
  for (const entry of [...registry.personas, ...registry.facts]) {
    if (typeof entry.id !== "string") return `an entry of ${entry.file} has no id`;
    const bad = idProblem(entry.id);
    if (bad) return `${bad} (${entry.file})`;
    const other = seen.get(entry.id);
    if (other !== void 0) return `duplicate id ${entry.id} in ${other} and ${entry.file}`;
    seen.set(entry.id, entry.file);
    if (typeof entry.summary !== "string" || entry.summary.trim() === "") return `${entry.id} has no summary, so its report row is blank`;
    if (typeof entry.seed !== "function") return `${entry.id} has no seed function`;
  }
  for (const fact of registry.facts) {
    if (!Array.isArray(fact.handleKeys)) return `${fact.id} declares no handleKeys; write [] when it has none`;
    for (const key of fact.handleKeys) {
      if (typeof key !== "string" || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) return `${fact.id} declares handle key "${String(key)}", which cannot name a route parameter`;
    }
    if (fact.arm === void 0 !== (fact.undo === void 0)) return `${fact.id} declares only one of arm and undo; an armed fact needs both`;
  }
  const ids = /* @__PURE__ */ new Map();
  for (const persona of registry.personas) {
    const tid = qaTelegramId(persona.id);
    const clash = ids.get(tid);
    if (clash !== void 0) return `${persona.id} and ${clash} both map to Telegram id ${tid}`;
    ids.set(tid, persona.id);
  }
  return null;
}
function assertRegistry(registry) {
  const problem = registryProblem(registry);
  if (problem) throw new LaunchwrightError("qa.world.registry", `The QA world cannot be seeded: ${problem}.`, { context: { problem } });
}
function listWorld(registry) {
  return [
    ...registry.personas.map((p) => ({ kind: "persona", id: p.id, summary: p.summary, feature: p.feature })),
    ...registry.facts.map((f) => ({ kind: "fact", id: f.id, summary: f.summary, feature: f.feature, handleKeys: [...f.handleKeys] }))
  ];
}
function registryHash(entries) {
  const lines = entries.map((e) => `${e.kind}	${e.id}	${e.feature}	${e.summary}`).sort();
  return sha256(lines.join("\n")).slice(0, 12);
}
function personaById(registry, id) {
  const found = registry.personas.find((p) => p.id === id);
  if (!found) throw new LaunchwrightError("qa.world.persona", `No world file declares persona ${id}. Run lw qa world list.`, { context: { persona: id } });
  return found;
}
function factById(registry, id) {
  const found = registry.facts.find((f) => f.id === id);
  if (!found) throw new LaunchwrightError("qa.world.fact", `No world file declares fact ${id}. Run lw qa world list.`, { context: { fact: id } });
  return found;
}

// src/world/services/discover.mts
var WORLD_SUFFIX = ".world.mts";
var FEATURE_SUFFIX = ".feature.mts";
var SKIP = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "coverage"]);
async function walk(root, dir, suffix, out) {
  let entries;
  try {
    entries = await readdir2(dir, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === "ENOENT") return;
    throw new LaunchwrightError("qa.world.walk", `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const path = join2(dir, entry.name);
    if (entry.isDirectory()) await walk(root, path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(relative2(root, path).split(sep).join("/"));
  }
}
async function filesWithSuffix(root, suffix) {
  const out = [];
  await walk(root, root, suffix, out);
  return out.sort();
}
function worldFiles(root) {
  return filesWithSuffix(root, WORLD_SUFFIX);
}
function isWorld(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const w = value;
  return (w.personas === void 0 || Array.isArray(w.personas)) && (w.facts === void 0 || Array.isArray(w.facts));
}
async function loadWorlds(root) {
  const out = [];
  for (const file of await worldFiles(root)) {
    let mod;
    try {
      mod = await import(pathToFileURL2(join2(root, file)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.world.file", `Cannot load world file ${file}: ${messageOf(cause)}`, { cause, context: { file } });
    }
    if (!isWorld(mod.default)) {
      throw new LaunchwrightError("qa.world.file", `${file} needs a default export defineWorld({ personas, facts }).`, { context: { file } });
    }
    out.push({ feature: basename3(file, WORLD_SUFFIX), file, world: mod.default });
  }
  return out;
}
async function loadRegistry(root) {
  return buildRegistry(await loadWorlds(root));
}
var RAW_SQL = [
  { pattern: /\bsql\s*`/, what: "a sql template" },
  { pattern: /\bsql\.(raw|join|identifier)\s*\(/, what: "a sql helper" },
  { pattern: /\.execute\s*[<(]/, what: "an execute() call" },
  { pattern: /import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/, what: "an import of sql from drizzle-orm" }
];
function rawSqlFindings(file, text2) {
  const out = [];
  text2.split("\n").forEach((line, i) => {
    for (const { pattern, what } of RAW_SQL) {
      if (pattern.test(line)) {
        out.push({ file, line: i + 1, rule: "world.raw-sql", message: `${what}: a seed calls the services of ctx.app, never raw SQL` });
        break;
      }
    }
  });
  return out;
}
async function worldLintFindings(root) {
  const out = [];
  for (const file of await worldFiles(root)) out.push(...rawSqlFindings(file, await readFile2(join2(root, file), "utf8")));
  return out;
}
async function featuresWithoutWorld(root) {
  const worlds = new Set(await worldFiles(root));
  return (await filesWithSuffix(root, FEATURE_SUFFIX)).filter((f) => {
    const world = join2(dirname2(f), `${basename3(f, FEATURE_SUFFIX)}${WORLD_SUFFIX}`).split(sep).join("/");
    return !worlds.has(world);
  });
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

// src/world/services/fixture.mts
import { join as join4 } from "path";

// src/world/services/world.mts
import { mkdir as mkdir2, rename, rm as rm2, writeFile } from "fs/promises";
import { dirname as dirname3, join as join3, resolve as resolve4 } from "path";
var STAMP_FILE = ".lw/qa/world.json";
function isStamp(value) {
  const s = value;
  return typeof s === "object" && s !== null && typeof s.database === "string" && typeof s.hash === "string" && typeof s.seededAt === "string" && Array.isArray(s.entries);
}
async function readStamp(root) {
  const text2 = await readTextOrNull(join3(root, STAMP_FILE));
  if (text2 === null) return null;
  let value;
  try {
    value = JSON.parse(text2);
  } catch (cause) {
    if (cause instanceof SyntaxError) return "unreadable";
    throw cause;
  }
  return isStamp(value) ? value : "unreadable";
}
async function writeJson(path, value) {
  await mkdir2(dirname3(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
  await rename(tmp, path);
}
var DB_SEED = /^lw\s+db\s+seed(?:\s+(.*))?$/;
function baseSeedNames(command) {
  if (command === void 0 || command.trim() === "") return null;
  const match = DB_SEED.exec(command.trim());
  if (!match) {
    throw new LaunchwrightError(
      "qa.world.seed",
      `Config qa.seed is "${command}". It must be lw db seed [name...]: the world runs those seeds in process on the QA database, so they never reach another database.`
    );
  }
  return (match[1] ?? "").split(/\s+/).filter(Boolean);
}
async function recreate(o, db) {
  const database = o.overlay.database;
  const admin = o.admin ?? await dbAdmin(db, o.root, (name) => name === database);
  try {
    await admin.drop(database);
    await admin.create(database);
  } finally {
    await admin.close();
  }
  const { createDb, migrate } = await loadDb();
  const conn = await createDb({
    driver: db.driver ?? "pg",
    url: db.url,
    dataDir: db.dataDir,
    ...typeof db.schema === "string" ? { schema: db.schema } : {},
    ...db.tables !== void 0 ? { tables: db.tables } : {}
  });
  try {
    const dir = resolve4(o.root, typeof db.migrations === "string" ? db.migrations : "packages/db/migrations");
    const { applied } = await migrate(conn, dir);
    o.out(`migrated ${database}: ${applied.length} migration(s)`);
  } finally {
    await conn.close();
  }
}
async function linkPersona(world, userId, persona, telegramId) {
  const auth = await loadAuth();
  if (!world.app.has(auth.USERS)) {
    throw new LaunchwrightError("qa.world.auth", "The QA app has no auth module, so no persona can sign in. Add the auth module to the project.");
  }
  const users = world.app.get(auth.USERS);
  await users.link(world.tenantId, userId, { provider: QA_PROVIDER, subject: persona });
  await users.link(world.tenantId, userId, { provider: "telegram", subject: String(telegramId) });
}
async function seedWorld(world, registry, o) {
  const names = baseSeedNames(o.seed);
  if (names !== null) {
    const { DB, runSeeds, seedNames } = await loadDb();
    const dir = join3(o.root, "packages/db/seeds");
    const ran = await runSeeds(world.app.get(DB), dir, names.length > 0 ? names : await seedNames(dir), o.out);
    o.out(`base seed: ${ran.join(", ") || "none"}`);
  }
  const seeded = [];
  for (const fact of registry.facts) {
    try {
      const handles = await fact.seed(world);
      const missing = fact.handleKeys.filter((key) => !(key in handles));
      if (missing.length > 0) {
        throw new LaunchwrightError("qa.world.handles", `It declares handleKeys ${fact.handleKeys.join(", ")}, and its seed returned ${Object.keys(handles).join(", ") || "nothing"}.`);
      }
      seeded.push({ kind: "fact", id: fact.id, summary: fact.summary, feature: fact.feature, handleKeys: [...fact.handleKeys], handles });
    } catch (cause) {
      throw new LaunchwrightError("qa.world.seed", `Fact ${fact.id} (${fact.file}) could not be seeded: ${messageOf(cause)}`, { cause, context: { fact: fact.id } });
    }
  }
  for (const persona of registry.personas) {
    const ids = personaIds(persona.id);
    try {
      const handles = await persona.seed(world, ids);
      if (typeof handles?.userId !== "string" || handles.userId === "") throw new LaunchwrightError("qa.world.handles", "Its seed returned no userId.");
      await linkPersona(world, handles.userId, persona.id, ids.telegramId);
      seeded.push({ kind: "persona", id: persona.id, summary: persona.summary, feature: persona.feature, handles: { ...handles, telegramId: ids.telegramId } });
    } catch (cause) {
      throw new LaunchwrightError("qa.world.seed", `Persona ${persona.id} (${persona.file}) could not be seeded: ${messageOf(cause)}`, {
        cause,
        context: { persona: persona.id }
      });
    }
  }
  return seeded;
}
async function resetWorld(o) {
  assertRegistry(o.registry);
  const hash = registryHash(listWorld(o.registry));
  const db = qaDbSection(o.sections.db ?? {}, o.overlay.database, o.root);
  o.out(`resetting ${o.overlay.database}`);
  await rmStamp(o.root);
  await recreate(o, db);
  const world = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, registryHash: hash });
  let entries;
  try {
    entries = await seedWorld(world, o.registry, o);
  } finally {
    await world.close();
  }
  const stamp = { database: o.overlay.database, hash, seededAt: o.clock.date().toISOString(), entries };
  await writeJson(join3(o.root, STAMP_FILE), stamp);
  o.out(`seeded ${entries.length} entries, registry ${stamp.hash}`);
  return stamp;
}
async function rmStamp(root) {
  await rm2(join3(root, STAMP_FILE), { force: true });
}
async function worldStatus(o) {
  const db = qaDbSection(o.sections.db ?? {}, o.database, o.root);
  const admin = o.admin ?? await dbAdmin(db, o.root, (name) => name === o.database);
  let exists;
  try {
    exists = await admin.exists(o.database);
  } finally {
    await admin.close();
  }
  const live = registryHash(listWorld(o.registry));
  const read = await readStamp(o.root);
  const stamp = read === "unreadable" || read === null || read.database !== o.database ? null : read;
  const state = !exists ? "missing" : stamp === null ? "unseeded" : stamp.hash === live ? "current" : "stale";
  return { database: o.database, exists, state, registryHash: live, stamp };
}

// src/world/services/fixture.mts
var UNDO_FILE = ".lw/qa/fixture.json";
async function readUndo(root, database) {
  const text2 = await readTextOrNull(join4(root, UNDO_FILE));
  if (text2 === null) return { database, armed: [] };
  let record;
  try {
    record = JSON.parse(text2);
  } catch (cause) {
    throw new LaunchwrightError("qa.fixture.read", `${UNDO_FILE} is not JSON. Restore it from the run log, or delete it after lw qa world reset.`, { cause });
  }
  if (record.armed.length > 0 && record.database !== database) {
    throw new LaunchwrightError("qa.fixture.database", `${UNDO_FILE} holds facts armed on ${record.database}, not on ${database}. Disarm them on that database first.`, {
      context: { database: record.database }
    });
  }
  return { database, armed: record.armed };
}
function writeUndo(root, record) {
  return writeJson(join4(root, UNDO_FILE), record);
}
async function armFact(world, registry, root, factId, opts = {}) {
  const fact = factById(registry, factId);
  if (fact.arm === void 0) {
    throw new LaunchwrightError("qa.fixture.no-arm", `Fact ${fact.id} (${fact.file}) has no arm(). Seed it with lw qa world reset, or give it arm() and undo().`, {
      context: { fact: fact.id }
    });
  }
  const persona = opts.persona === void 0 ? void 0 : personaIds(personaById(registry, opts.persona).id);
  const record = await readUndo(root, world.database);
  if (record.armed.some((a) => a.fact === fact.id)) {
    throw new LaunchwrightError("qa.fixture.armed", `Fact ${fact.id} is armed already. Run lw qa fixture disarm first.`, { context: { fact: fact.id } });
  }
  const entry = { fact: fact.id, ...persona ? { persona: persona.persona } : {}, steps: [] };
  record.armed.push(entry);
  await writeUndo(root, record);
  await fact.arm({
    app: world.app,
    tenantId: world.tenantId,
    ...persona ? { persona } : {},
    async record(step) {
      entry.steps.push(step);
      await writeUndo(root, record);
    }
  });
  return entry;
}
async function disarmFact(world, registry, root) {
  const record = await readUndo(root, world.database);
  const done = [];
  while (record.armed.length > 0) {
    const entry = record.armed[record.armed.length - 1];
    const fact = factById(registry, entry.fact);
    if (fact.undo === void 0) throw new LaunchwrightError("qa.fixture.no-undo", `Fact ${fact.id} has no undo(), so its steps cannot be replayed.`, { context: { fact: fact.id } });
    while (entry.steps.length > 0) {
      await fact.undo(world, entry.steps[entry.steps.length - 1]);
      entry.steps.pop();
      await writeUndo(root, record);
    }
    record.armed.pop();
    await writeUndo(root, record);
    done.push(entry.fact);
  }
  return done;
}

// src/world/services/arming.mts
async function fixtureArming(opts) {
  const ctx = await worldContext(opts);
  const entry = opts.entry ?? await loadAppEntry(ctx.root, ctx.qa);
  const registry = opts.registry ?? ctx.registry;
  const database = opts.database ?? ctx.overlay.database;
  const overlay = { ...ctx.overlay, database, registryHash: registryHash(listWorld(registry)) };
  const world = await openWorld(entry, ctx.sections, ctx.env, overlay);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await world.close();
  };
  return {
    async arm(state, o) {
      await armFact(world, registry, ctx.root, state, o.persona === void 0 ? {} : { persona: o.persona });
    },
    async disarm() {
      try {
        await disarmFact(world, registry, ctx.root);
      } finally {
        await close();
      }
    }
  };
}

// src/world/services/jobs.mts
import { readdir as readdir3 } from "fs/promises";
import { join as join5 } from "path";
import { pathToFileURL as pathToFileURL3 } from "url";
function jobsDirOf(sections = {}) {
  return `${appPath(sections, "node", "apps/api")}/src/jobs`;
}
var JOBS_DIR = jobsDirOf();
async function importProjectJobs(root, jobsDir = JOBS_DIR) {
  const dir = join5(root, jobsDir);
  let names;
  try {
    names = await readdir3(dir);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.job.read", `Cannot read ${dir}.`, { cause });
  }
  const files = names.filter((n) => n.endsWith(".job.mts")).sort();
  for (const file of files) await import(pathToFileURL3(join5(dir, file)).href);
  return files;
}
function listJobs(registry) {
  return registry.registeredJobs().map((j) => j.kind).sort();
}
async function runJob(world, registry, o) {
  const def = registry.jobOf(o.kind);
  if (def === void 0) {
    throw new LaunchwrightError("qa.job.unknown", `No registered job has kind ${o.kind}. Jobs: ${listJobs(registry).join(", ") || "none"}.`, { context: { kind: o.kind } });
  }
  const payload = registry.parsePayload(def, o.payload ?? {});
  const scope = world.app.createScope();
  if (o.tenantId !== void 0) {
    const { TENANT_SCOPE, tenantScope } = await loadDb();
    scope.instance(TENANT_SCOPE, tenantScope(o.tenantId));
  }
  const ctx = registry.standaloneContext({
    id: `qa-${o.kind}-${o.clock.now()}`,
    kind: o.kind,
    attempts: 1,
    maxAttempts: 1,
    tenantId: o.tenantId ?? null,
    container: scope,
    log: world.app.log
  });
  try {
    await def.handle(payload, ctx);
  } finally {
    await scope.dispose();
  }
}

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
  const { BotApi } = await loadTelegram();
  const api = new BotApi({ token: bot.token, ...section.apiUrl ? { apiUrl: section.apiUrl } : {}, ...o.fetch ? { fetch: o.fetch } : {} });
  await api.setChatMenuButton({ type: "web_app", text: o.text, web_app: { url: o.url } });
}

// src/world/services/worktree.mts
import { copyFile, rename as rename2, writeFile as writeFile2 } from "fs/promises";
import { basename as basename4, join as join6 } from "path";
function envFileName(sections) {
  const dev = sections.dev;
  const name = dev?.envFiles?.local;
  return typeof name === "string" ? name : ".env.local";
}
function copyPrefix(sections, checkout) {
  return `${databaseName(devProjectName(sections, checkout))}_wt_`;
}
function copyName(prefix, toplevel) {
  return `${prefix}${databaseName(basename4(toplevel))}`.slice(0, 63);
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
  const envFile = join6(o.root, name);
  const mainEnvFile = join6(checkout.mainRoot, name);
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
function setEnvLine(text2, key, value) {
  const lines = text2.split("\n");
  const at = lines.findLastIndex((l) => l.replace(/^\s*(export\s+)?/, "").startsWith(`${key}=`));
  if (at === -1) return `${text2}${text2 === "" || text2.endsWith("\n") ? "" : "\n"}${key}=${value}
`;
  lines[at] = `${key}=${value}`;
  return lines.join("\n");
}
async function writePrivate(path, text2) {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile2(tmp, text2, { mode: 384 });
  await rename2(tmp, path);
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
    const dir = join6(o.root, typeof o.sections.db?.migrations === "string" ? o.sections.db.migrations : "packages/db/migrations");
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
  JOBS_DIR,
  QA_PROVIDER,
  QA_TELEGRAM_PORT,
  STAMP_FILE,
  ShiftClock,
  UNDO_FILE,
  WORLD_SUFFIX,
  armFact,
  assertQaTarget,
  assertRegistry,
  baseSeedNames,
  buildRegistry,
  cleanupWorktrees,
  copyName,
  copyPrefix,
  databaseName,
  dbAdmin,
  defineWorld,
  devProjectName,
  disarmFact,
  factById,
  featuresWithoutWorld,
  fixtureArming,
  idProblem,
  importFromProject,
  importProjectJobs,
  isLoopbackHost,
  listJobs,
  listWorld,
  loadAppEntry,
  loadRegistry,
  loadWorlds,
  openWorld,
  parseShift,
  personaById,
  personaIds,
  pgAdmin,
  pgliteAdmin,
  planWorktree,
  qaAccountId,
  qaDatabase,
  qaDbSection,
  qaFakeBots,
  qaFakeToken,
  qaSections,
  qaTargetProblem,
  qaTelegramId,
  rawSqlFindings,
  readCheckout,
  readStamp,
  readUndo,
  registryHash,
  registryProblem,
  resetWorld,
  runJob,
  runWorktree,
  seedWorld,
  setEnvLine,
  setMenuButton,
  urlWithDatabase,
  worldFiles,
  worldLintFindings,
  worldStatus
};
//# sourceMappingURL=world.js.map