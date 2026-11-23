import {
  listenQaApp
} from "./chunk-GJVA76MS.js";
import {
  armFact,
  forkUndoFile
} from "./chunk-ZMPWNSJU.js";
import {
  createFork,
  dropFork
} from "./chunk-K4LKBBDD.js";
import {
  openWorld
} from "./chunk-RCXD64CA.js";
import {
  loadDb
} from "./chunk-CNY6SOD7.js";

// src/world/services/fork-server.mts
import { rm } from "fs/promises";
import { join } from "path";
async function serveFork(o, database) {
  const world = await openWorld(o.entry, o.sections, o.env, { ...o.overlay, database });
  let listening = null;
  try {
    listening = await (o.listen ?? listenQaApp)(o.entry.serve(world.app), world.app, 0);
  } finally {
    if (listening === null) await world.close();
  }
  const server = listening;
  const undoFile = forkUndoFile(database);
  let closing = null;
  const close = async () => {
    try {
      await server.close();
    } finally {
      try {
        await world.close();
      } finally {
        await rm(join(o.root, undoFile), { force: true });
      }
    }
  };
  return {
    database,
    world,
    url: `http://127.0.0.1:${server.port}`,
    arming: {
      async arm(state, a) {
        await armFact(world, o.registry, o.root, state, { ...a.persona === void 0 ? {} : { persona: a.persona }, undoFile });
      },
      disarm: async () => void 0
    },
    close: () => closing ??= close()
  };
}
async function openFork(o, label) {
  const runner = worldForkRunner(o);
  const database = await runner.create(label);
  let instance = null;
  try {
    instance = await serveFork(o, database);
  } finally {
    if (instance === null) await runner.drop(database);
  }
  const served = instance;
  const db = async () => o.entry.db?.(served.world.app) ?? served.world.app.get((await loadDb()).DB);
  return {
    ...served,
    execute: async (sql) => (await db()).execute(sql),
    async release() {
      try {
        await served.close();
      } finally {
        await runner.drop(database);
      }
    }
  };
}
function worldForkRunner(o) {
  const fork = { root: o.root, sections: o.sections, database: o.overlay.database, out: o.out };
  return {
    create: (label) => createFork({ ...fork, label }),
    drop: (name) => dropFork({ ...fork, name }),
    serve: (database) => serveFork(o, database)
  };
}

export {
  serveFork,
  openFork,
  worldForkRunner
};
//# sourceMappingURL=chunk-EUYLWYDS.js.map