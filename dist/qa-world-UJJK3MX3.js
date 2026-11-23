import {
  createFork,
  dropFork
} from "./chunk-2TMG2NYS.js";
import {
  readStamp,
  resetWorld,
  worldStatus
} from "./chunk-KKXAXAWX.js";
import {
  guarded,
  loadAppEntry,
  openWorld,
  parseArgs,
  processSignal,
  worldContext
} from "./chunk-TMW7THTE.js";
import {
  loadHttp
} from "./chunk-CNY6SOD7.js";
import {
  listWorld,
  registryHash,
  registryProblem
} from "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-4B5GWDFB.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/world/services/api.mts
async function serveWorld(ctx, o) {
  const stamp = await readStamp(ctx.root);
  if (stamp === null || stamp === "unreadable" || stamp.database !== ctx.overlay.database) {
    throw new LaunchwrightError("qa.world.unseeded", `${ctx.overlay.database} holds no seeded world. Run lw qa world reset.`);
  }
  if (stamp.hash !== registryHash(listWorld(o.registry))) o.out(`warning: ${ctx.overlay.database} was seeded from registry ${stamp.hash}; the world files changed since. Run lw qa world reset.`);
  const { serveNode } = await loadHttp();
  const world2 = await openWorld(o.entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    const handler = o.entry.serve(world2.app);
    const { server } = serveNode(handler, o.port, { hostname: "127.0.0.1", app: world2.app, signals: false });
    if (!server.listening) await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${o.port}: ${cause.message}`, { cause })));
    });
    const port = server.address().port;
    o.out(`qa api on http://127.0.0.1:${port} against ${ctx.overlay.database}, Bot API ${ctx.overlay.telegramUrl}`);
    o.onListen?.(port);
    if (!o.signal.aborted) await new Promise((resolve) => o.signal.addEventListener("abort", () => resolve(), { once: true }));
    await new Promise((resolve, reject) => {
      server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve());
      server.closeAllConnections?.();
    });
  } finally {
    await world2.close();
  }
}

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
      const status = await worldStatus({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, registry: ctx.registry });
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
        await dropFork({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, name, out: opts.out });
        return 0;
      }
      const label = words[1];
      if (label === void 0) {
        opts.err("usage: lw qa world fork <label>");
        return 2;
      }
      opts.out(await createFork({ root: ctx.root, sections: ctx.sections, database: ctx.overlay.database, label, out: opts.out }));
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
//# sourceMappingURL=qa-world-UJJK3MX3.js.map