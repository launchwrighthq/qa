import {
  openWorld
} from "./chunk-L6Q4YNOC.js";
import {
  assertQaTarget,
  checkIdentifier,
  databaseName,
  dbAdmin,
  qaDbSection
} from "./chunk-ZJ35OYFC.js";
import {
  loadAuth,
  loadDb
} from "./chunk-CNY6SOD7.js";
import {
  QA_PROVIDER,
  assertRegistry,
  listWorld,
  personaIds,
  registryHash
} from "./chunk-I4K4P4GZ.js";
import {
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/world/services/fork.mts
var FORK_MARK = "_fork_";
function forkName(database, label) {
  checkIdentifier(database);
  return `${database}${FORK_MARK}${databaseName(label)}`.slice(0, 63);
}
function seededName(database) {
  checkIdentifier(database);
  return `${database}${FORK_MARK}_seeded`.slice(0, 63);
}
function isForkOf(database, name) {
  return name.startsWith(`${database}${FORK_MARK}`);
}
async function createFork(o) {
  const db = qaDbSection(o.sections.db ?? {}, o.database, o.root);
  assertQaTarget(db, o.database, o.root);
  const name = forkName(o.database, o.label);
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n));
  try {
    const seeded = seededName(o.database);
    const template = await admin.exists(seeded) ? seeded : o.database;
    o.out(`forking ${template} to ${name}`);
    await admin.create(name, template);
  } finally {
    await admin.close();
  }
  return name;
}
async function dropFork(o) {
  if (!isForkOf(o.database, o.name)) {
    throw new LaunchwrightError("qa.fork.name", `${o.name} is not a fork of ${o.database}, so lw qa will not drop it.`, { context: { database: o.name } });
  }
  const db = qaDbSection(o.sections.db ?? {}, o.database, o.root);
  assertQaTarget(db, o.database, o.root);
  const admin = await dbAdmin(db, o.root, (n) => isForkOf(o.database, n));
  try {
    await admin.drop(o.name);
    o.out(`dropped ${o.name}`);
  } finally {
    await admin.close();
  }
}
async function snapshotSeeded(o, action) {
  const seeded = seededName(o.database);
  const admin = o.admin ?? await dbAdmin(o.db, o.root, (n) => n === seeded);
  try {
    await admin.drop(seeded);
    if (action === "replace") await admin.create(seeded, o.database);
  } finally {
    if (!o.admin) await admin.close();
  }
}

// src/world/services/world.mts
import { mkdir, rename, rm, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
var STAMP_FILE = ".lw/qa/world.json";
function isStamp(value) {
  const s = value;
  return typeof s === "object" && s !== null && typeof s.database === "string" && typeof s.hash === "string" && typeof s.seededAt === "string" && Array.isArray(s.entries);
}
async function readStamp(root) {
  const text = await readTextOrNull(join(root, STAMP_FILE));
  if (text === null) return null;
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    if (cause instanceof SyntaxError) return "unreadable";
    throw cause;
  }
  return isStamp(value) ? value : "unreadable";
}
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
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
    const dir = resolve(o.root, typeof db.migrations === "string" ? db.migrations : "packages/db/migrations");
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
    const dir = join(o.root, "packages/db/seeds");
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
  const snapshot = { root: o.root, db, database: o.overlay.database };
  await snapshotSeeded(snapshot, "drop");
  await recreate(o, db);
  const world = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, registryHash: hash });
  let entries;
  try {
    entries = await seedWorld(world, o.registry, o);
  } finally {
    await world.close();
  }
  await snapshotSeeded(snapshot, "replace");
  o.out(`snapshot ${seededName(o.overlay.database)}: each fork copies it`);
  const stamp = { database: o.overlay.database, hash, seededAt: o.clock.date().toISOString(), entries };
  await writeJson(join(o.root, STAMP_FILE), stamp);
  o.out(`seeded ${entries.length} entries, registry ${stamp.hash}`);
  return stamp;
}
async function rmStamp(root) {
  await rm(join(root, STAMP_FILE), { force: true });
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

export {
  forkName,
  seededName,
  createFork,
  dropFork,
  STAMP_FILE,
  readStamp,
  writeJson,
  baseSeedNames,
  seedWorld,
  resetWorld,
  worldStatus
};
//# sourceMappingURL=chunk-TXE76FC7.js.map