import {
  parseFaults,
  startSink
} from "./chunk-M4H6D7OQ.js";
import {
  loadTunnel
} from "./chunk-I52564IV.js";
import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  createContainer,
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-sink.mts
import { randomInt } from "crypto";
import { join } from "path";
var SINK_DIR = ".lw/qa/sink";
var USAGE = [
  "usage: lw qa sink [--tunnel <driver|none>] [--fault <rule>]... [--port <n>] [--seed <n>]",
  "  rules: 503, 429, 410, 302:<url>, slow:<ms>; add x<count> (503x2) or @<ratio> (503@0.5)"
];
async function tunnels(config, driver) {
  const raw = config?.tunnel ?? (driver ? { default: driver } : void 0);
  if (raw === void 0) {
    throw new LaunchwrightError("qa.sink.tunnel", "The project config has no tunnel section. Add tunnel.default, or pass --tunnel <driver> or --tunnel none.");
  }
  const { tunnelConfig, TunnelManager } = await loadTunnel();
  const parsed = tunnelConfig.safeParse(driver ? { ...raw, default: driver } : raw);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `tunnel.${i.path.map(String).join(".")} ${i.message}`);
    throw new LaunchwrightError("qa.sink.tunnel", `Config section tunnel is invalid: ${keys.join("; ")}`, { context: { keys } });
  }
  return new TunnelManager(parsed.data, createContainer());
}
function stopped(signal) {
  if (signal) return signal.aborted ? Promise.resolve() : new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
  return new Promise((resolve) => {
    const done = () => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}
function integer(text, name, min, max) {
  if (text === void 0) return void 0;
  const n = Number(text);
  if (!/^\d+$/.test(text) || n < min || n > max) throw new LaunchwrightError("qa.sink.usage", `--${name} must be an integer from ${min} to ${max}, not ${text}.`);
  return n;
}
async function serve(values, opts) {
  const faults = parseFaults(values.fault ?? []);
  const port = integer(values.port, "port", 0, 65535);
  const seed = integer(values.seed, "seed", 0, 2 ** 32 - 1) ?? randomInt(1, 2 ** 31);
  const manager = values.tunnel === "none" ? void 0 : await tunnels(opts.config, values.tunnel);
  const run = systemClock.date().toISOString().replace(/[:.]/g, "-");
  const file = join(opts.cwd, SINK_DIR, `${run}.jsonl`);
  const sink2 = await startSink({
    faults,
    file,
    seed,
    ...port === void 0 ? {} : { port },
    onRecord: (r, phase) => {
      if (phase !== "done") return;
      opts.err(`lw qa sink: ${r.n} ${r.method} ${r.path} -> ${r.answered.status}${r.fault ? ` (${r.fault})` : ""}${r.closedEarly ? ", the sender closed first" : ""}`);
    }
  });
  let tunnel;
  try {
    if (manager) tunnel = await manager.driver().open(sink2.port, { name: "lw-sink" });
    opts.out(tunnel?.url ?? sink2.url);
    opts.err(`lw qa sink: listening on ${sink2.url}, records to ${file}`);
    opts.err(`lw qa sink: faults ${faults.map((f) => f.text).join(" ") || "none"}, seed ${seed}; Ctrl-C stops it`);
    await stopped(opts.signal);
  } finally {
    try {
      await tunnel?.close();
    } finally {
      await sink2.close();
    }
  }
  opts.err(`lw qa sink: ${sink2.records.length} requests recorded in ${file}`);
  return 0;
}
var sink = {
  name: "sink",
  summary: "Serve a recording HTTP sink with fault rules behind a tunnel",
  async run(args, opts) {
    let parsed;
    try {
      parsed = parseCommandArgs({ values: ["tunnel", "port", "seed"], repeated: ["fault"], switches: ["help"] }, args.map((a) => a === "-h" ? "--help" : a));
      const [extra] = parsed.positionals;
      if (extra !== void 0) throw new UsageError(`Unexpected argument '${extra}'.`);
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
      opts.err(`lw qa sink: ${cause.message}`);
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const values = { ...parsed.values, fault: parsed.lists.fault };
    if (parsed.switches.has("help")) {
      for (const line of USAGE) opts.err(line);
      return 0;
    }
    try {
      return await serve(values, opts);
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa sink: ${cause.code}: ${cause.message}`);
      return 1;
    }
  }
};
var qa_sink_default = sink;
export {
  SINK_DIR,
  qa_sink_default as default
};
//# sourceMappingURL=qa-sink-S5US6FZR.js.map