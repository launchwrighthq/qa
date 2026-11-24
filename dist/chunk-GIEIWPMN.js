import {
  QA_TARGETS
} from "./chunk-IVS4OOQ5.js";
import {
  createTargetRegistry
} from "./chunk-N736V2LB.js";
import {
  ShiftClock
} from "./chunk-ZYIHPZ3V.js";
import {
  qaConfig,
  qaConfigOf
} from "./chunk-X6J22AIF.js";
import {
  CLOCK,
  CONFIG,
  provider,
  resolveImport
} from "./chunk-5AJ7M7K5.js";
import {
  BootError,
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/commands/extensions.mts
import { pathToFileURL } from "url";
var EXTENSION_PREFIX = "qa-";
function extensionNames(sections = {}) {
  return Object.keys(sections).filter((name) => name.startsWith(EXTENSION_PREFIX)).sort();
}
function isExtension(value) {
  return typeof value === "object" && value !== null && typeof value.name === "string";
}
async function loadExtensions(root, sections = {}) {
  const out = [];
  for (const name of extensionNames(sections)) {
    const specifier = `@launchwrighthq/${name}`;
    let ns;
    try {
      ns = await import(pathToFileURL(resolveImport(specifier, root)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.extension", `The config enables module ${name}, and ${specifier} does not load from ${root}. Install the package or remove section ${name}.`, {
        cause,
        context: { module: name }
      });
    }
    if (!isExtension(ns.qaExtension)) {
      throw new LaunchwrightError("qa.extension", `${specifier} exports no qaExtension, so lw qa cannot use module ${name}.`, { context: { module: name } });
    }
    out.push(ns.qaExtension);
  }
  return out;
}
function extensionTargets(extensions, config, root, env) {
  return Object.assign({}, ...extensions.map((e) => e.targets?.(config, root, env) ?? {}));
}

// src/commands/qa.command.mts
var SUBCOMMANDS = [
  "changes",
  "session",
  "sweep",
  "report",
  "publish",
  "gc",
  "check",
  "world",
  "fixture",
  "worktree",
  "job",
  "states",
  "paths",
  "telegram",
  "sink",
  "comments",
  "consent"
];
var CORE = {
  changes: () => import("./qa-changes-2SOFJ22Q.js"),
  session: () => import("./qa-session-AYOALJFC.js"),
  sweep: () => import("./qa-sweep-JYTPGIFD.js"),
  report: () => import("./qa-report-AC6I425Q.js"),
  publish: () => import("./qa-publish-OXJ3KYAR.js"),
  gc: () => import("./qa-gc-CFU2QZVN.js"),
  check: () => import("./qa-check-P2ZAUDBL.js"),
  world: () => import("./qa-world-SQAUEIC2.js"),
  fixture: () => import("./qa-fixture-IIE4P6R2.js"),
  worktree: () => import("./qa-worktree-3AXMS6JX.js"),
  job: () => import("./qa-job-U5DKM6YN.js"),
  states: () => import("./qa-states-2O5ROGKO.js"),
  paths: () => import("./qa-paths-SCQDS4K4.js"),
  telegram: () => import("./qa-telegram-VO4EN3TE.js"),
  sink: () => import("./qa-sink-S5US6FZR.js"),
  comments: () => import("./qa-comments-4PEEPL5M.js"),
  consent: () => import("./qa-consent-NCUOVSBD.js")
};
function isCore(sub) {
  return Object.hasOwn(CORE, sub);
}
async function load(sub) {
  return (await CORE[sub]()).default;
}
async function subcommandOf(sub, extensions) {
  if (isCore(sub)) return load(sub);
  const loader = extensions.find((e) => e.subcommands?.[sub])?.subcommands?.[sub];
  return loader ? loader() : void 0;
}
async function usage(opts, extensions) {
  opts.err("usage: lw qa <subcommand> [args]");
  for (const sub of SUBCOMMANDS) opts.err(`  ${sub.padEnd(10)} ${(await load(sub)).summary}`);
  for (const ext of extensions) {
    for (const [sub, loader] of Object.entries(ext.subcommands ?? {})) opts.err(`  ${sub.padEnd(10)} ${(await loader()).summary} (module ${ext.name})`);
  }
  return 2;
}
var DEFAULT_NAME = "lw qa";
function named(opts) {
  const name = opts.commandName ?? DEFAULT_NAME;
  if (name === DEFAULT_NAME) return opts;
  const rename = (write) => (line) => write(line.replace(/\blw qa\b/g, name));
  return { ...opts, out: rename(opts.out), err: rename(opts.err) };
}
var qaCommand = {
  name: "qa",
  summary: "QA passes with evidence, personas, state triggers, devices, fake Telegram, issue intake",
  async run(args, given) {
    const opts = named(given);
    const [first, ...rest] = args;
    const loaded = await loadExtensions(opts.cwd, opts.config);
    const extensions = [...(opts.extensions ?? []).filter((e) => !loaded.some((l) => l.name === e.name)), ...loaded];
    if (first === void 0 || first === "--help" || first === "-h") return usage(opts, extensions);
    const spec = await subcommandOf(first, extensions);
    if (spec === void 0) {
      opts.err(`lw qa: unknown subcommand ${first}. A subcommand of an extension module needs that module in the project config, for example qa-${first}.`);
      return usage(opts, extensions);
    }
    const added = extensions.some((e) => e.targets) ? extensionTargets(extensions, qaConfigOf(opts.config), opts.cwd, opts.processEnv) : {};
    return spec.run(rest, { ...opts, targets: { ...added, ...opts.targets } });
  }
};

// src/provider.mts
var qaProvider = provider({
  name: "qa",
  requires: ["kernel"],
  config: { section: "qa", schema: qaConfig },
  register(app) {
    const cfg = app.get(CONFIG).section("qa");
    if (cfg.routes && app.config.env === "production") {
      throw new BootError(
        "qa.routes.production",
        `Boot failed in module "qa": key "qa.routes" is on in the production environment. The /__qa routes sign any persona in; turn qa.routes off. Check ${app.config.envFile}.`,
        { context: { module: "qa", key: "qa.routes", envFile: app.config.envFile } }
      );
    }
    if (cfg.routes) app.instance(CLOCK, new ShiftClock(app.get(CLOCK)));
    app.singleton(QA_TARGETS, (c) => createTargetRegistry(c.get(CONFIG).section("qa")));
  }
});

export {
  EXTENSION_PREFIX,
  extensionNames,
  loadExtensions,
  extensionTargets,
  SUBCOMMANDS,
  qaCommand,
  qaProvider
};
//# sourceMappingURL=chunk-GIEIWPMN.js.map