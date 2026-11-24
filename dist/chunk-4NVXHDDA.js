import {
  readStamp
} from "./chunk-BPOUYCDS.js";
import {
  openWorld
} from "./chunk-XCKU4A2P.js";
import {
  optionalHttp
} from "./chunk-I52564IV.js";
import {
  listWorld,
  registryHash
} from "./chunk-I4K4P4GZ.js";
import {
  LaunchwrightError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/world/services/node-listen.mts
import { createServer } from "http";
async function bodyOf(req) {
  if (req.method === "GET" || req.method === "HEAD") return void 0;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return new Uint8Array(Buffer.concat(chunks));
}
function requestOf(req, body) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) for (const one of value) headers.append(name, one);
  }
  return new Request(`http://${req.headers.host ?? "127.0.0.1"}${req.url ?? "/"}`, { method: req.method ?? "GET", headers, ...body ? { body } : {} });
}
async function answer(handler, req, res) {
  const response = await handler.fetch(requestOf(req, await bodyOf(req)));
  const headers = {};
  for (const [name, value] of response.headers) if (name !== "set-cookie") headers[name] = value;
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}
async function nodeListen(handler, port) {
  const server = createServer((req, res) => {
    answer(handler, req, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`QA app error: ${messageOf(err)}`);
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", (cause) => reject(new LaunchwrightError("qa.world.listen", `Cannot listen on 127.0.0.1:${port}: ${cause.message}`, { cause })));
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve, reject) => {
      server.close((err) => err ? reject(new LaunchwrightError("qa.world.close", `Cannot close the QA API server: ${err.message}`, { cause: err })) : resolve());
      server.closeAllConnections();
    })
  };
}

// src/world/services/api.mts
var listenQaApp = async (handler, app, port) => {
  const http = await optionalHttp();
  if (http === void 0) return nodeListen(handler, port);
  const { serveNode } = http;
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
//# sourceMappingURL=chunk-4NVXHDDA.js.map