import {
  armFact,
  disarmFact
} from "./chunk-73B7DMII.js";
import {
  loadAppEntry,
  openWorld,
  worldContext
} from "./chunk-FM7TAGXC.js";
import {
  listWorld,
  registryHash
} from "./chunk-I4K4P4GZ.js";

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

export {
  fixtureArming
};
//# sourceMappingURL=chunk-6DECWNGP.js.map