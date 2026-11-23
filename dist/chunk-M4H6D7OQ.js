import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/sink/services/faults.mts
var RETRY_AFTER_S = 30;
var OK_REPLY = { status: 200, headers: {}, body: "ok", holdMs: 0 };
var RULE = /^(?:(?<plain>503|429|410)|302:(?<url>.+?)|slow:(?<ms>\d{1,7}))(?:x(?<count>\d{1,9})|@(?<ratio>0(?:\.\d+)?|1(?:\.0+)?))?$/;
var GRAMMAR = "a rule is 503, 429, 410, 302:<url> or slow:<ms>, with an optional count (503x2) or ratio (503@0.5)";
function parseFault(text) {
  const m = RULE.exec(text.trim());
  const g = m?.groups;
  if (!g) throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}" is not valid: ${GRAMMAR}.`, { context: { rule: text } });
  const limit = {
    ...g.count !== void 0 ? { count: Number(g.count) } : {},
    ...g.ratio !== void 0 ? { ratio: Number(g.ratio) } : {}
  };
  if (limit.count === 0) throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}" has count 0, so it never fires.`, { context: { rule: text } });
  if (g.plain !== void 0) return { text, kind: g.plain, ...limit };
  if (g.ms !== void 0) return { text, kind: "slow", ms: Number(g.ms), ...limit };
  const url = g.url;
  let location;
  try {
    location = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}": ${url} is not an absolute URL.`, { cause, context: { rule: text } });
  }
  if (location.protocol !== "http:" && location.protocol !== "https:") {
    throw new LaunchwrightError("qa.sink.fault", `Fault rule "${text}": the 302 target must be an http or https URL.`, { context: { rule: text } });
  }
  return { text, kind: "302", location: url, ...limit };
}
function parseFaults(texts) {
  return texts.map(parseFault);
}
function replyOf(rule) {
  switch (rule.kind) {
    case "503":
      return { status: 503, headers: {}, body: "busy", holdMs: 0 };
    case "429":
      return { status: 429, headers: { "retry-after": String(RETRY_AFTER_S) }, body: "slow down", holdMs: 0 };
    case "410":
      return { status: 410, headers: {}, body: "gone", holdMs: 0 };
    case "302":
      return { status: 302, headers: { location: rule.location }, body: "", holdMs: 0 };
    case "slow":
      return { ...OK_REPLY, holdMs: rule.ms };
  }
}
function seededSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var FaultPlan = class {
  constructor(rules, random) {
    this.rules = rules;
    this.random = random;
    this.used = rules.map(() => 0);
  }
  rules;
  random;
  used;
  next() {
    for (const [i, rule] of this.rules.entries()) {
      if (!this.fires(rule, i)) continue;
      return { rule, reply: replyOf(rule) };
    }
    return { rule: null, reply: OK_REPLY };
  }
  fires(rule, i) {
    if (rule.count !== void 0) {
      if (this.used[i] >= rule.count) return false;
      this.used[i] = this.used[i] + 1;
      return true;
    }
    if (rule.ratio !== void 0) return this.random() < rule.ratio;
    return true;
  }
};

// src/sink/services/server.mts
import { appendFile, mkdir } from "fs/promises";
import { createServer } from "http";
import { dirname } from "path";
var MASK = "[masked]";
var SECRET_HEADER = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-telegram-bot-api-secret-token|x-.+-token)$|secret|token|key|signature/i;
var ADDRESS_HEADER = /forwarded-for|real-ip|connecting-ip|client-ip|^forwarded$/i;
var MAX_BODY_BYTES = 1024 * 1024;
function maskHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === void 0) continue;
    out[name] = SECRET_HEADER.test(name) || ADDRESS_HEADER.test(name) ? MASK : value;
  }
  return out;
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (chunk) => {
      if (bytes < max) chunks.push(chunk.subarray(0, max - bytes));
      bytes += chunk.length;
    });
    req.on("end", () => resolve({ text: Buffer.concat(chunks).toString("utf8"), bytes, truncated: bytes > max }));
    req.on("error", reject);
    req.on("close", () => {
      if (!req.complete) reject(new Error("the sender closed the request before its end"));
    });
  });
}
async function startSink(opts = {}) {
  const rules = (opts.faults ?? []).map((r) => typeof r === "string" ? parseFault(r) : r);
  const plan = new FaultPlan(rules, seededSource(opts.seed ?? 1));
  const clock = opts.clock ?? systemClock;
  const max = opts.maxBodyBytes ?? MAX_BODY_BYTES;
  const records = [];
  let writes = Promise.resolve();
  let writeError;
  const stopping = new AbortController();
  const pending = /* @__PURE__ */ new Set();
  if (opts.file !== void 0) await mkdir(dirname(opts.file), { recursive: true, mode: 448 });
  const persist = (record) => {
    const file = opts.file;
    if (file === void 0) return;
    writes = writes.then(
      () => appendFile(file, `${JSON.stringify(record)}
`, { mode: 384 }).catch((err) => {
        writeError ??= err;
      })
    );
  };
  const server = createServer((req, res) => {
    const at = clock.date().toISOString();
    const n = records.length + 1;
    const { rule, reply } = plan.next();
    const url = req.url ?? "/";
    const record = {
      n,
      at,
      method: req.method ?? "",
      url,
      path: new URL(url, "http://sink").pathname,
      headers: maskHeaders(req.headers),
      body: "",
      bodyBytes: 0,
      fault: rule?.text ?? null,
      answered: { status: reply.status, headers: reply.headers, heldMs: reply.holdMs }
    };
    records.push(record);
    let hungUp = false;
    const hangUp = new AbortController();
    res.once("close", () => {
      if (res.writableEnded) return;
      hungUp = true;
      hangUp.abort(new Error("the sender closed the connection"));
    });
    const held = reply.holdMs > 0 ? clock.sleep(reply.holdMs, AbortSignal.any([stopping.signal, hangUp.signal])).then(
      () => true,
      () => false
    ) : Promise.resolve(true);
    opts.onRecord?.(record, "arrived");
    const handled = (async () => {
      try {
        const body = await readBody(req, max);
        record.body = body.text;
        record.bodyBytes = body.bytes;
        if (body.truncated) record.bodyTruncated = true;
        const answer = await held;
        if (!answer || hungUp || res.destroyed) {
          record.closedEarly = true;
          return;
        }
        res.writeHead(reply.status, { "content-type": "text/plain", ...reply.headers });
        res.end(reply.body);
      } catch (err) {
        record.closedEarly = true;
        res.destroy(err instanceof Error ? err : new Error(String(err)));
      } finally {
        persist(record);
        opts.onRecord?.(record, "done");
      }
    })();
    pending.add(handled);
    void handled.then(() => pending.delete(handled));
  });
  await new Promise((resolve, reject) => {
    server.once(
      "error",
      (cause) => reject(new LaunchwrightError("qa.sink.listen", `The sink cannot listen on 127.0.0.1:${opts.port ?? 0}: ${cause.message}`, { cause, context: { port: opts.port ?? 0 } }))
    );
    server.listen(opts.port ?? 0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    records,
    ...opts.file === void 0 ? {} : { file: opts.file },
    async close() {
      stopping.abort(new Error("the sink closed"));
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
      await Promise.all(pending);
      await writes;
      if (writeError !== void 0) {
        throw new LaunchwrightError("qa.sink.write", `The sink could not write ${opts.file}.`, { cause: writeError, context: { file: opts.file } });
      }
    }
  };
}

export {
  RETRY_AFTER_S,
  OK_REPLY,
  parseFault,
  parseFaults,
  replyOf,
  seededSource,
  FaultPlan,
  MASK,
  SECRET_HEADER,
  ADDRESS_HEADER,
  MAX_BODY_BYTES,
  maskHeaders,
  startSink
};
//# sourceMappingURL=chunk-M4H6D7OQ.js.map