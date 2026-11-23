import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/kernel/services/args.mts
import { parseArgs } from "util";
var UsageError = class extends LaunchwrightError {
  constructor(message, opts) {
    super("kernel.usage", message, opts);
  }
};
function optionsOf(spec) {
  const options = {};
  for (const name of spec.values ?? []) options[name] = { type: "string" };
  for (const name of spec.switches ?? []) options[name] = { type: "boolean" };
  for (const name of spec.repeated ?? []) options[name] = { type: "string", multiple: true };
  return options;
}
function asUsage(cause) {
  const code = cause?.code;
  if (typeof code !== "string" || !code.startsWith("ERR_PARSE_ARGS_")) return cause;
  return new UsageError(String(cause.message), { cause, context: { code } });
}
var NEGATIVE = /^-\d+(\.\d+)?$/;
var NEGATIVE_MARK = "\0";
function markNegatives(argv, valueFlags) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i];
    if (word === "--") return [...out, ...argv.slice(i)];
    const next = argv[i + 1];
    if (word.startsWith("--") && valueFlags.has(word.slice(2)) && next !== void 0) {
      out.push(...NEGATIVE.test(next) ? [`${word}=${next}`] : [word, next]);
      i++;
    } else out.push(NEGATIVE.test(word) ? NEGATIVE_MARK + word : word);
  }
  return out;
}
function unmark(word) {
  return word.startsWith(NEGATIVE_MARK) ? word.slice(NEGATIVE_MARK.length) : word;
}
function parseCommandArgs(spec, argv) {
  const valueFlags = /* @__PURE__ */ new Set([...spec.values ?? [], ...spec.repeated ?? []]);
  let parsed;
  try {
    parsed = parseArgs({ args: markNegatives(argv, valueFlags), options: optionsOf(spec), strict: true, allowPositionals: true });
  } catch (cause) {
    throw asUsage(cause);
  }
  const found = parsed.values;
  const values = {};
  for (const name of spec.values ?? []) {
    const value = found[name];
    if (typeof value === "string") values[name] = value;
  }
  const switches = new Set((spec.switches ?? []).filter((name) => found[name] === true));
  const lists = {};
  for (const name of spec.repeated ?? []) {
    const value = found[name];
    lists[name] = Array.isArray(value) ? value : [];
  }
  return { positionals: parsed.positionals.map(unmark), values, switches, lists };
}

export {
  UsageError,
  parseCommandArgs
};
//# sourceMappingURL=chunk-YDFQPHPI.js.map