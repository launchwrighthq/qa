import {
  UsageError,
  parseCommandArgs
} from "./chunk-YDFQPHPI.js";
import {
  qaConfigOf
} from "./chunk-4B5GWDFB.js";
import {
  legDefinitions,
  validateManifest
} from "./chunk-H3DGWSMZ.js";
import "./chunk-SA2YN55L.js";
import {
  readTextOrNullSync
} from "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-sweep.mts
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

// src/services/sweep.mts
var DEFAULT_CAP = 2;
var SETTLE_TIMEOUT_MS = 2e4;
var MIN_FUZZY_SEGMENT = 3;
function invalid(message) {
  return new LaunchwrightError("qa.sweep.input", message);
}
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function readWorld(parsed) {
  const entries = Array.isArray(parsed) ? parsed : isObject(parsed) && Array.isArray(parsed.entries) ? parsed.entries : isObject(parsed) && Array.isArray(parsed.world) ? parsed.world : isObject(parsed) && isObject(parsed.stamp) && Array.isArray(parsed.stamp.entries) ? parsed.stamp.entries : null;
  if (entries === null) throw invalid("The world file is not `lw qa world list --json` output: no array, and none under entries, world or stamp.entries.");
  if (entries.length === 0) throw invalid("The world declares no state, so there is nothing to sweep.");
  entries.forEach((entry, i) => {
    const at = `world[${i}]`;
    if (!isObject(entry)) throw invalid(`${at} is not an entry`);
    if (entry.kind !== "persona" && entry.kind !== "fact") throw invalid(`${at} kind is not persona or fact`);
    for (const field of ["id", "summary", "feature"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") throw invalid(`${at} has no ${field}`);
    }
  });
  return entries;
}
function readDelivery(delivery) {
  if (!isObject(delivery) || !Array.isArray(delivery.unions)) throw invalid("The delivery file has no unions array.");
  const out = [];
  for (const union of delivery.unions) {
    if (!isObject(union)) continue;
    const anchor = typeof union.anchor === "string" ? union.anchor : typeof union.file === "string" ? union.file : "";
    for (const route of Array.isArray(union.routes) ? union.routes : []) {
      if (!isObject(route) || typeof route.route !== "string") continue;
      out.push({
        route: route.route,
        surface: route.surface,
        page: typeof route.page === "string" ? route.page : "",
        distance: typeof route.distance === "number" ? route.distance : Number.MAX_SAFE_INTEGER,
        reaches: typeof route.reaches === "number" ? route.reaches : Number.MAX_SAFE_INTEGER,
        anchor
      });
    }
  }
  return out;
}
function namesFor(entry) {
  const names = [entry.feature.toLowerCase()];
  const head = entry.id.includes(".") ? (entry.id.split(".")[0] ?? "").toLowerCase() : null;
  if (head && !names.includes(head)) names.push(head);
  return names;
}
function segmentsOf(path) {
  const cut = path.indexOf("/src/");
  const tail = cut === -1 ? path : path.slice(cut + "/src/".length);
  return tail.split("/").filter((seg) => seg !== "" && !seg.startsWith(":") && !seg.startsWith("{")).flatMap((seg) => seg.split(".")).map((seg) => seg.toLowerCase()).filter((seg) => seg !== "");
}
function nameRank(candidate, names) {
  const hits = (path) => segmentsOf(path).some((seg) => names.includes(seg));
  if (hits(candidate.route)) return 0;
  if (hits(candidate.page)) return 1;
  if (hits(candidate.anchor)) return 2;
  return null;
}
function handleKeyFor(name, handles) {
  const keys = Object.keys(handles);
  const want = name.toLowerCase();
  const exact = keys.filter((key) => key.toLowerCase() === want);
  if (exact.length === 1) return exact[0];
  if (want.length < MIN_FUZZY_SEGMENT) return null;
  const near = keys.filter((key) => key.toLowerCase().includes(want));
  return near.length === 1 ? near[0] : null;
}
function handleNames(entry) {
  if (entry.handles && Object.keys(entry.handles).length > 0) return { ...entry.handles };
  return Object.fromEntries((entry.handleKeys ?? []).map((key) => [key, null]));
}
function fillRoute(routePath, handles) {
  const out = [];
  for (const seg of routePath.split("/")) {
    if (!seg.startsWith(":")) {
      out.push(seg);
      continue;
    }
    const optional = seg.endsWith("?");
    const key = handleKeyFor(seg.slice(1, optional ? -1 : void 0), handles);
    if (key !== null) {
      const value = handles[key];
      out.push(value === null || value === void 0 ? `{${key}}` : encodeURIComponent(String(value)));
    } else if (!optional) return { route: null, missing: seg };
  }
  const route = out.join("/");
  return { route: route === "" ? "/" : route, missing: null };
}
function addressesFor(entry, addresses) {
  const names = namesFor(entry);
  const byRoute = /* @__PURE__ */ new Map();
  let dropped = null;
  let named = 0;
  for (const address of addresses) {
    const rank = nameRank(address, names);
    if (rank === null) continue;
    named += 1;
    const filled = fillRoute(address.route, handleNames(entry));
    if (filled.route === null) {
      if (dropped === null || rank < dropped.rank || rank === dropped.rank && address.distance < dropped.distance) {
        dropped = { segment: filled.missing, route: address.route, rank, distance: address.distance };
      }
      continue;
    }
    const held = byRoute.get(filled.route);
    if (held === void 0) {
      byRoute.set(filled.route, { route: filled.route, surfaces: /* @__PURE__ */ new Set([address.surface]), page: address.page, rank, distance: address.distance, reaches: address.reaches });
      continue;
    }
    held.surfaces.add(address.surface);
    if (rank < held.rank || rank === held.rank && address.distance < held.distance) {
      held.rank = rank;
      held.distance = address.distance;
      held.reaches = address.reaches;
      held.page = address.page;
    }
  }
  const rows = [...byRoute.values()].sort((a, b) => a.rank - b.rank || a.distance - b.distance || a.reaches - b.reaches || a.route.localeCompare(b.route));
  return { rows, dropped, named, names };
}
var slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function screenSlug(route) {
  const parts = route.split("?")[0]?.split("/").filter((seg) => seg !== "" && !seg.startsWith("{") && !seg.startsWith(":")).map(slug).filter((seg) => seg !== "");
  return !parts || parts.length === 0 ? "home" : parts.join("-");
}
function pageName(page) {
  const parts = page.split("/");
  const file = parts.pop() ?? "";
  const stem = file.split(".")[0] ?? "";
  return stem === "index" ? parts.pop() ?? "" : stem;
}
function planSweep(opts) {
  const cap = opts.cap ?? DEFAULT_CAP;
  if (!Number.isInteger(cap) || cap < 1) throw invalid(`--cap must be a whole number of addresses above 0, got ${cap}`);
  const entries = readWorld(opts.world);
  const addresses = readDelivery(opts.delivery);
  const spec = opts.spec ?? "qa.world";
  const browserLegs = opts.legs.filter((l) => l.target === "playwright");
  const shots = [];
  const owed = [];
  const covered = [];
  const taken = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    const { rows, dropped, named, names } = addressesFor(entry, addresses);
    const naming = names.map((n) => `"${n}"`).join(" or ");
    const legsOf = (surfaces) => browserLegs.filter((l) => surfaces.has(l.surface)).map((l) => l.name);
    const usable = rows.filter((r) => legsOf(r.surfaces).length > 0);
    if (usable.length === 0) {
      const noSeed = named > 0 && dropped !== null;
      owed.push({
        kind: entry.kind,
        id: entry.id,
        feature: entry.feature,
        reason: noSeed ? "no-seed" : "no-route",
        why: noSeed ? `every address that names ${naming} is dynamic and no handle fills ${dropped.segment}, so the world owes this state a seed` : `no route, page or component of the delivery map names ${naming} on a surface with a browser leg`
      });
      continue;
    }
    const chosen = usable.slice(0, cap);
    const ids = [];
    for (const address of chosen) {
      let id = `${screenSlug(address.route)}.${slug(entry.id)}`;
      while (taken.has(id)) id = `${id}-b`;
      taken.add(id);
      shots.push({
        id,
        screen: pageName(address.page) || screenSlug(address.route),
        state: entry.summary.trim(),
        ...opts.specRef ? { specRef: opts.specRef } : {},
        source: [`spec:${spec}#${entry.id}`],
        legs: legsOf(address.surfaces),
        route: address.route,
        fixture: entry.kind === "persona" ? { arm: [], persona: entry.id } : { arm: [], facts: [entry.id] },
        settle: { busy: true, timeout: SETTLE_TIMEOUT_MS },
        expect: `${address.route} as ${entry.id}: ${entry.summary.trim().replace(/\.$/, "")}. Judge whether the screen shows that state.`
      });
      ids.push(id);
    }
    const first = chosen[0];
    covered.push({
      kind: entry.kind,
      id: entry.id,
      feature: entry.feature,
      shots: ids,
      addresses: usable.length,
      // A state shot at a weaker address than its best one, because the best one needs a handle.
      ...dropped !== null && (dropped.rank < first.rank || dropped.rank === first.rank && dropped.distance < first.distance) ? { droppedDynamic: dropped.route, droppedSegment: dropped.segment } : {}
    });
  }
  if (covered.length + owed.length !== entries.length) {
    throw new LaunchwrightError("qa.sweep.count", `${covered.length} covered and ${owed.length} owed is not ${entries.length} declared.`);
  }
  return {
    title: opts.title ?? "QA sweep of the world registry",
    generated: opts.generated,
    spec,
    commits: [],
    shots,
    sweep: {
      cap,
      declared: entries.length,
      covered: covered.length,
      owed: owed.length,
      personas: entries.filter((e) => e.kind === "persona").length,
      facts: entries.filter((e) => e.kind === "fact").length,
      states: covered,
      owedStates: owed
    }
  };
}
function renderSweep(manifest) {
  const s = manifest.sweep;
  const out = [
    `world: ${s.declared} state(s) declared: ${s.personas} persona(s), ${s.facts} fact(s)`,
    `plan:  ${manifest.shots.length} row(s) over ${s.covered} state(s), at most ${s.cap} address(es) each`
  ];
  for (const state of s.states) {
    const lost = state.droppedDynamic ? `  (${state.droppedDynamic} needs a handle for ${state.droppedSegment})` : "";
    out.push(`  ${state.id.padEnd(28)} ${state.shots.join(" ")}${lost}`);
  }
  out.push(`owed:  ${s.owed} state(s)`);
  for (const row of s.owedStates) out.push(`  ${row.reason.padEnd(9)} ${row.id.padEnd(28)} ${row.feature.padEnd(12)} ${row.why}`);
  return out.join("\n");
}

// src/commands/qa-sweep.mts
var USAGE = [
  "usage: lw qa sweep plan --world <world.json> --delivery <delivery.json> [--out <plan.shots.json>]",
  `         [--cap <n>] [--spec <path>] [--title <text>] [--spec-ref <n.n>] [--strict]`,
  "  --world      lw qa world list --json, or lw qa world status --json for seeded handle values",
  "  --delivery   the route map of lw qa states scan",
  `  --cap        addresses per state, default ${DEFAULT_CAP}`,
  "  --strict     exit 1 when a state is owed"
];
var VALUE_FLAGS = ["world", "delivery", "out", "cap", "spec", "title", "spec-ref"];
function inputJson(cwd, path, what) {
  const at = resolve(cwd, path);
  const raw = readTextOrNullSync(at);
  if (raw === null) throw new LaunchwrightError("qa.sweep.input", `Cannot read the ${what} file ${at}.`);
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError("qa.sweep.input", `The ${what} file ${at} is not JSON.`, { cause });
  }
}
var sweep = {
  name: "sweep",
  summary: "Plan one row per world state and address from the world registry and the delivery map",
  async run(args, opts) {
    const [action, ...rest] = args;
    let parsed;
    try {
      parsed = parseCommandArgs({ values: VALUE_FLAGS, switches: ["strict"] }, rest);
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
      parsed = void 0;
    }
    const flags = parsed?.values ?? {};
    if (action !== "plan" || !parsed || parsed.positionals.length > 0 || flags.world === void 0 || flags.delivery === void 0) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const strict = parsed.switches.has("strict");
    const config = qaConfigOf(opts.config);
    const legs = legDefinitions(config);
    try {
      const cap = flags.cap !== void 0 ? Number(flags.cap) : DEFAULT_CAP;
      const manifest = planSweep({
        world: inputJson(opts.cwd, flags.world, "world"),
        delivery: inputJson(opts.cwd, flags.delivery, "delivery"),
        legs,
        cap,
        generated: systemClock.date().toISOString(),
        ...flags.spec !== void 0 ? { spec: flags.spec } : {},
        ...flags.title !== void 0 ? { title: flags.title } : {},
        ...flags["spec-ref"] !== void 0 ? { specRef: flags["spec-ref"] } : {}
      });
      const errors = validateManifest(manifest, { legs: legs.map((l) => l.name) });
      if (errors.length > 0) {
        opts.err("lw qa sweep: the plan is not a valid manifest");
        for (const e of errors) opts.err(`  ${e}`);
        return 1;
      }
      const json = `${JSON.stringify(manifest, null, 2)}
`;
      const out = flags.out;
      if (out) {
        const target = resolve(opts.cwd, out);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, json);
        opts.out(`${renderSweep(manifest)}
plan -> ${target}`);
      } else {
        opts.out(json.trimEnd());
        opts.err(renderSweep(manifest));
      }
      return strict && manifest.sweep.owed > 0 ? 1 : 0;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa sweep: ${cause.message}`);
      return 1;
    }
  }
};
var qa_sweep_default = sweep;
export {
  qa_sweep_default as default
};
//# sourceMappingURL=qa-sweep-ZH6YZMVA.js.map