import {
  armFact,
  disarmFact
} from "./chunk-J5LVC3SI.js";
import "./chunk-TXE76FC7.js";
import {
  guarded,
  parseArgs,
  withWorld,
  worldContext
} from "./chunk-L6Q4YNOC.js";
import "./chunk-ZJ35OYFC.js";
import "./chunk-CNY6SOD7.js";
import "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-7OHVK72J.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-5AJ7M7K5.js";
import "./chunk-KK6DCU3O.js";

// src/commands/qa-fixture.mts
var USAGE = [
  "usage: lw qa fixture arm <fact> [--persona <p>]  make a fact true on the QA database; the undo record is written first",
  "       lw qa fixture disarm                       replay every undo step in reverse order"
];
async function run(args, opts) {
  const { words, options } = parseArgs(args, [], ["persona"]);
  const [sub, fact] = words;
  if (sub === "arm" && fact !== void 0) {
    const ctx = await worldContext(opts);
    const persona = typeof options.persona === "string" ? options.persona : void 0;
    const armed = await withWorld(ctx, (world, registry) => armFact(world, registry, ctx.root, fact, persona === void 0 ? {} : { persona }));
    opts.out(`armed ${armed.fact}${armed.persona ? ` for ${armed.persona}` : ""} on ${ctx.overlay.database}: ${armed.steps.length} undo step(s). Disarm with lw qa fixture disarm.`);
    return 0;
  }
  if (sub === "disarm") {
    const ctx = await worldContext(opts);
    const done = await withWorld(ctx, (world, registry) => disarmFact(world, registry, ctx.root));
    opts.out(done.length > 0 ? `disarmed ${done.join(", ")}` : "nothing armed");
    return 0;
  }
  for (const line of USAGE) opts.err(line);
  return 2;
}
var fixture = {
  name: "fixture",
  summary: "arm a fact on the QA database for one row, and disarm it",
  run: (args, opts) => guarded("fixture", opts, () => run(args, opts))
};
var qa_fixture_default = fixture;
export {
  qa_fixture_default as default
};
//# sourceMappingURL=qa-fixture-UU535GXV.js.map