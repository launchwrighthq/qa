import {
  sha256
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError,
  messageOf
} from "./chunk-KK6DCU3O.js";

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
import { readdir, readFile } from "fs/promises";
import { basename, dirname, join, relative, sep } from "path";
import { pathToFileURL } from "url";
var WORLD_SUFFIX = ".world.mts";
var FEATURE_SUFFIX = ".feature.mts";
var SKIP = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "coverage"]);
async function walk(root, dir, suffix, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === "ENOENT") return;
    throw new LaunchwrightError("qa.world.walk", `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(root, path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(relative(root, path).split(sep).join("/"));
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
      mod = await import(pathToFileURL(join(root, file)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.world.file", `Cannot load world file ${file}: ${messageOf(cause)}`, { cause, context: { file } });
    }
    if (!isWorld(mod.default)) {
      throw new LaunchwrightError("qa.world.file", `${file} needs a default export defineWorld({ personas, facts }).`, { context: { file } });
    }
    out.push({ feature: basename(file, WORLD_SUFFIX), file, world: mod.default });
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
function rawSqlFindings(file, text) {
  const out = [];
  text.split("\n").forEach((line, i) => {
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
  for (const file of await worldFiles(root)) out.push(...rawSqlFindings(file, await readFile(join(root, file), "utf8")));
  return out;
}
async function featuresWithoutWorld(root) {
  const worlds = new Set(await worldFiles(root));
  return (await filesWithSuffix(root, FEATURE_SUFFIX)).filter((f) => {
    const world = join(dirname(f), `${basename(f, FEATURE_SUFFIX)}${WORLD_SUFFIX}`).split(sep).join("/");
    return !worlds.has(world);
  });
}

export {
  qaTelegramId,
  QA_PROVIDER,
  qaAccountId,
  personaIds,
  idProblem,
  defineWorld,
  buildRegistry,
  registryProblem,
  assertRegistry,
  listWorld,
  registryHash,
  personaById,
  factById,
  WORLD_SUFFIX,
  FEATURE_SUFFIX,
  worldFiles,
  loadWorlds,
  loadRegistry,
  rawSqlFindings,
  worldLintFindings,
  featuresWithoutWorld
};
//# sourceMappingURL=chunk-I4K4P4GZ.js.map