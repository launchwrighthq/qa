import {
  serveWorld
} from "./chunk-I3IUHHIW.js";
import {
  createFork,
  dropFork,
  resetWorld,
  worldStatus
} from "./chunk-4HWKGNXL.js";
import {
  guarded,
  loadAppEntry,
  parseArgs,
  processSignal,
  worldConnect,
  worldContext
} from "./chunk-JPCS27IP.js";
import "./chunk-YKX37RJG.js";
import "./chunk-I52564IV.js";
import {
  listWorld,
  registryHash,
  registryProblem
} from "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-RGX37KPN.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-5AJ7M7K5.js";
import "./chunk-KK6DCU3O.js";

// src/commands/qa-world.mts
var USAGE = [
  "usage: lw qa world reset          drop, create and migrate the QA database, then run every seed",
  "       lw qa world status [--json] whether the QA database exists and was seeded from these world files",
  "       lw qa world api             serve the QA app on qa.apiPort until Ctrl-C",
  "       lw qa world list [--json]   the personas and facts of the world files",
  "       lw qa world fork <label>    copy the QA database to a per-pass fork and print its name",
  "       lw qa world fork drop <name> drop a per-pass fork of the QA database"
];
async function run(args, opts) {
  const { words, options } = parseArgs(args, ["json", "reset", "status", "api", "list"]);
  const sub = words[0] ?? ["reset", "status", "api", "list"].find((f) => options[f] === true);
  const json = options.json === true;
  const ctx = await worldContext(opts);
  switch (sub) {
    case "list": {
      const registry = ctx.registry;
      const entries = listWorld(registry);
      const problem = registryProblem(registry);
      if (json) opts.out(JSON.stringify({ hash: registryHash(entries), problem, entries }, null, 2));
      else {
        for (const e of entries) opts.out(`${e.kind.padEnd(8)} ${e.id.padEnd(32)} ${e.feature.padEnd(16)} ${e.summary}`);
        opts.out(`${entries.length} entries, registry ${registryHash(entries)}${problem ? `; not seedable: ${problem}` : ""}`);
      }
      return problem ? 1 : 0;
    }
    case "reset": {
      const registry = ctx.registry;
      const entry = await loadAppEntry(ctx.root, ctx.qa);
      await resetWorld({
        root: ctx.root,
        sections: ctx.sections,
        env: ctx.env,
        entry,
        registry,
        overlay: ctx.overlay,
        ...ctx.qa.seed !== void 0 ? { seed: ctx.qa.seed } : {},
        clock: ctx.clock,
        out: opts.out
      });
      return 0;
    }
    case "status": {
      const status = await worldStatus({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, registry: ctx.registry, connect: worldConnect(ctx) });
      if (json) opts.out(JSON.stringify(status, null, 2));
      else {
        opts.out(`database ${status.database}: ${status.exists ? "exists" : "missing"}`);
        opts.out(`world    ${status.state}${status.stamp ? ` (seeded ${status.stamp.seededAt} from registry ${status.stamp.hash})` : ""}`);
        opts.out(`registry ${status.registryHash}`);
        if (status.state !== "current") opts.out("Run lw qa world reset.");
      }
      return status.state === "current" ? 0 : 1;
    }
    case "api": {
      const registry = ctx.registry;
      const entry = await loadAppEntry(ctx.root, ctx.qa);
      const stop = processSignal(opts.signal);
      try {
        await serveWorld(ctx, { entry, registry, port: ctx.qa.apiPort, signal: stop.signal, out: opts.out });
      } finally {
        stop.dispose();
      }
      return 0;
    }
    case "fork": {
      if (words[1] === "drop") {
        const name = words[2];
        if (name === void 0) {
          opts.err("usage: lw qa world fork drop <name>");
          return 2;
        }
        await dropFork({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, name, out: opts.out, connect: worldConnect(ctx) });
        return 0;
      }
      const label = words[1];
      if (label === void 0) {
        opts.err("usage: lw qa world fork <label>");
        return 2;
      }
      opts.out(await createFork({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, label, out: opts.out, connect: worldConnect(ctx) }));
      return 0;
    }
    default:
      for (const line of USAGE) opts.err(line);
      return 2;
  }
}
var world = {
  name: "world",
  summary: "the QA world: reset, status, api, fork and list of the personas and facts",
  run: (args, opts) => guarded("world", opts, () => run(args, opts))
};
var qa_world_default = world;
export {
  qa_world_default as default
};
//# sourceMappingURL=qa-world-HGBXHTTP.js.map