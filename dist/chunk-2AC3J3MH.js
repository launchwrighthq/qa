import {
  assertQaTarget,
  checkIdentifier,
  databaseName,
  dbAdmin,
  qaDbSection
} from "./chunk-FM7TAGXC.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/world/services/fork.mts
var FORK_MARK = "_fork_";
function forkName(database, label) {
  checkIdentifier(database);
  return `${database}${FORK_MARK}${databaseName(label)}`.slice(0, 63);
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
    o.out(`forking ${o.database} to ${name}`);
    await admin.create(name, o.database);
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

export {
  createFork,
  dropFork
};
//# sourceMappingURL=chunk-2AC3J3MH.js.map