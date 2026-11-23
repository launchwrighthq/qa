import {
  writeJson
} from "./chunk-KKXAXAWX.js";
import {
  factById,
  personaById,
  personaIds
} from "./chunk-I4K4P4GZ.js";
import {
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/world/services/fixture.mts
import { join } from "path";
var UNDO_FILE = ".lw/qa/fixture.json";
async function readUndo(root, database) {
  const text = await readTextOrNull(join(root, UNDO_FILE));
  if (text === null) return { database, armed: [] };
  let record;
  try {
    record = JSON.parse(text);
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
  return writeJson(join(root, UNDO_FILE), record);
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

export {
  UNDO_FILE,
  readUndo,
  armFact,
  disarmFact
};
//# sourceMappingURL=chunk-NV2B5UP5.js.map