import {
  readStamp
} from "./chunk-TXE76FC7.js";
import {
  openWorld
} from "./chunk-L6Q4YNOC.js";
import {
  loadHttp
} from "./chunk-CNY6SOD7.js";
import {
  listWorld,
  registryHash
} from "./chunk-I4K4P4GZ.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/world/services/api.mts
var listenQaApp = async (handler, app, port) => {
  const { serveNode } = await loadHttp();
  const { server } = serveNode(handler, port, { hostname: "127.0.0.1", app, signals: false });
  if (!server.listening) await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${port}: ${cause.message}`, { cause })));
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve, reject) => {
      server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve());
      server.closeAllConnections?.();
    })
  };
};
async function serveWorld(ctx, o) {
  const stamp = await readStamp(ctx.root);
  if (stamp === null || stamp === "unreadable" || stamp.database !== ctx.overlay.database) {
    throw new LaunchwrightError("qa.world.unseeded", `${ctx.overlay.database} holds no seeded world. Run lw qa world reset.`);
  }
  if (stamp.hash !== registryHash(listWorld(o.registry))) o.out(`warning: ${ctx.overlay.database} was seeded from registry ${stamp.hash}; the world files changed since. Run lw qa world reset.`);
  const world = await openWorld(o.entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    const listening = await listenQaApp(o.entry.serve(world.app), world.app, o.port);
    o.out(`qa api on http://127.0.0.1:${listening.port} against ${ctx.overlay.database}, Bot API ${ctx.overlay.telegramUrl}`);
    o.onListen?.(listening.port);
    if (!o.signal.aborted) await new Promise((resolve) => o.signal.addEventListener("abort", () => resolve(), { once: true }));
    await listening.close();
  } finally {
    await world.close();
  }
}

export {
  listenQaApp,
  serveWorld
};
//# sourceMappingURL=chunk-OMN5Y4OA.js.map