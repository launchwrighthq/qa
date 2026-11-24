import {
  FAIL_REASONS,
  PROVENANCE,
  coverageFor,
  mechanismFor,
  plannedCaptures,
  solveSite,
  validateInventory
} from "./chunk-6HYCZCXT.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/states/services/loop.mts
var SENTENCES = {
  unreachable: "no candidate input produced this member",
  identical: "the DOM diff between two members is empty",
  "state-mismatch": "the feature's own function disagreed after injection",
  unmountable: "the harness could not mount the component",
  "no-mechanism": "the union is neither an input nor an output, so nothing can reach it",
  blocked: "the run could not build a capture group the runner would accept",
  "not-run": "the mechanism was not run",
  crashed: "the capture failed, and the runner reported only a sentence"
};
var UNREPORTED = "the runner exited without reporting this capture";
function reasonOf(row) {
  return FAIL_REASONS.includes(row?.reason) ? row?.reason : "crashed";
}
function parseInventory(text, source) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError("qa.states.inventory", `${source} is not JSON. Run "lw qa states scan" again.`, { cause, context: { source } });
  }
  const errors = validateInventory(parsed);
  if (errors.length > 0) {
    throw new LaunchwrightError("qa.states.inventory", `The inventory in ${source} is invalid, ${errors.length} problem(s):
${errors.map((e) => `  ${e}`).join("\n")}`, {
      context: { source, errors }
    });
  }
  return parsed;
}
function unionFiles(union) {
  const files = /* @__PURE__ */ new Set([union.file]);
  for (const site of union.inputs) {
    files.add(site.file);
    if (site.componentFile) files.add(site.componentFile);
  }
  for (const site of union.outputs) files.add(site.file);
  return [...files].filter(Boolean).sort();
}
function narrowInventory(inv, paths) {
  const files = new Set(paths.files ?? []);
  const dirs = (paths.dirs ?? []).filter(Boolean).map((d) => d.replace(/\/+$/, ""));
  const touches = (path) => files.has(path) || dirs.some((dir) => path.startsWith(`${dir}/`));
  const kept = [];
  const dropped = [];
  for (const union of inv.unions) {
    if (unionFiles(union).some(touches)) kept.push(union);
    else dropped.push(union.name);
  }
  return { inventory: { ...inv, unions: kept }, kept: kept.map((u) => u.name), dropped };
}
function neitherUnions(inv) {
  return inv.unions.filter((union) => union.kind === "neither");
}
function subjectLabel(union) {
  for (const site of union.inputs) if (site.component) return site.component;
  for (const site of union.outputs) if (site.fn) return site.fn;
  for (const site of union.inputs) if (site.interface) return site.interface;
  return union.file.split("/").pop() ?? union.name;
}
function issueFor(union) {
  const members = union.members.map((m) => `\`${m}\``).join(" ");
  const title = `qa states: \`${union.name}\` is neither an input nor an output`;
  const body = [
    `File: \`${union.file}:${union.line}\``,
    `Members (${union.members.length}): ${members}`,
    "",
    `\`${union.name}\` is an exported closed union, so the QA state run counts its ${union.members.length} members.`,
    "It can reach none of them. No field of a props type holds the type, so a mount cannot set it.",
    "No function returns it, so the solver has nothing to run. The state exists only inside a conditional.",
    "",
    "Declare it in one of two ways:",
    "",
    `- give the component that branches on it a prop of type \`${union.name}\`, which makes it an input; or`,
    `- move the conditional into an exported function that returns \`${union.name}\`, which makes it an output.`,
    "",
    "Or mark it `@qa-states ignore <reason>` when nothing can ever render it.",
    "",
    "Found by `lw qa states scan`."
  ].join("\n");
  return { title, body };
}
function refusalLines(inventory, rows) {
  const lines = [];
  for (const union of neitherUnions(inventory)) {
    lines.push(
      `${union.name} (${union.file}) is neither an input nor an output: nothing takes it and nothing returns it, so no mechanism can reach its ${union.members.length} member(s). The state exists only inside a conditional, and the fix is to declare it.`
    );
  }
  for (const row of rows) {
    if (row.ok) continue;
    const reason = reasonOf(row);
    if (reason === "no-mechanism") continue;
    lines.push(`${row.id}: ${refusalFor(row)}.`);
  }
  return lines;
}
function parseResults(text) {
  const attempts = [];
  const malformed = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformed.push(line.slice(0, 200));
      continue;
    }
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string") attempts.push(parsed);
    else malformed.push(line.slice(0, 200));
  }
  return { attempts, malformed };
}
function mergeRows(captures, attempts, options = {}) {
  const notRun = options.notRun ?? {};
  const blocked = options.blocked ?? {};
  const byId = /* @__PURE__ */ new Map();
  for (const attempt of attempts) byId.set(attempt.id, attempt);
  const rows = [];
  const claimed = /* @__PURE__ */ new Set();
  for (const capture of captures) {
    const attempt = byId.get(capture.id);
    if (attempt) {
      claimed.add(capture.id);
      rows.push({ ...capture, ...attempt, ok: attempt.ok === true, reported: true });
      continue;
    }
    const blockedWhy = blocked[capture.union];
    const notRunWhy = capture.mechanism === null ? void 0 : notRun[capture.mechanism];
    if (capture.mechanism === null) rows.push({ ...capture, ok: false, reported: false, reason: "no-mechanism" });
    else if (blockedWhy !== void 0) rows.push({ ...capture, ok: false, reported: false, reason: "blocked", why: blockedWhy });
    else if (notRunWhy !== void 0) rows.push({ ...capture, ok: false, reported: false, reason: "not-run", why: notRunWhy });
    else rows.push({ ...capture, ok: false, reported: false, reason: "crashed", error: UNREPORTED });
  }
  for (const attempt of attempts) {
    if (claimed.has(attempt.id)) continue;
    rows.push({ ...attempt, ok: attempt.ok === true, reported: true, extra: true });
  }
  return rows;
}
function cell(text) {
  return String(text ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}
function provenanceLabel(provenance) {
  if (provenance === "live") return null;
  if (provenance && PROVENANCE.includes(provenance)) return `(${provenance})`;
  return "(provenance not reported)";
}
function verifiedCell(row) {
  if (row.verified === true) return row.answered ? `yes (${cell(row.answered)})` : "yes";
  if (row.verified === false) return "no";
  return "not verified";
}
function stateCell(union, row) {
  if (row.member === null) return "`null` (the function returned nothing)";
  if (row.member !== void 0) return cell(row.member);
  const key = row.id.startsWith(`${union.name}.`) ? row.id.slice(union.name.length + 1) : row.id;
  return cell(key.replace(/#/g, ", ").replace(/-/g, " "));
}
function orderRows(union, rows) {
  const planned = rows.filter((row) => !row.extra);
  const extras = rows.filter((row) => row.extra);
  const taken = /* @__PURE__ */ new Set();
  const out = [];
  for (const row of planned) {
    out.push(row);
    if (row.member === null || row.member === void 0) continue;
    for (const extra of extras) {
      if (taken.has(extra) || !extra.id.startsWith(`${union.name}.${row.member}#`)) continue;
      taken.add(extra);
      out.push(extra);
    }
  }
  for (const extra of extras) if (!taken.has(extra)) out.push(extra);
  return out;
}
function refusalFor(row) {
  const reason = reasonOf(row);
  if (reason === "unreachable") return `no candidate produced it (tried ${(row.fieldsTried ?? []).join(", ") || "nothing"})`;
  if (reason === "identical") return `identical to ${row.sameAs ?? "another member"}: the DOM diff is empty`;
  if (reason === "state-mismatch") return `intended ${row.intended ?? row.member ?? "?"}, the function answered ${row.actual ?? "?"}`;
  if (reason === "unmountable") return `cannot mount ${row.component ?? "the component"}: ${row.missingProp ?? "missing prop not reported"}`;
  if (reason === "blocked" || reason === "not-run") return row.why ?? row.error ?? SENTENCES[reason];
  return row.error ?? SENTENCES[reason];
}
function unionOf(inventory, id) {
  let best = null;
  for (const union of inventory.unions) {
    if (!id.startsWith(`${union.name}.`)) continue;
    if (!best || union.name.length > best.name.length) best = union;
  }
  return best;
}
function renderReport(args) {
  const { inventory, rows, slug, narrowedBy = null, notRun = {} } = args;
  const out = [];
  const totals = { covered: 0, planned: 0 };
  out.push(`## State coverage${slug ? `: ${slug}` : ""}`);
  out.push("");
  if (narrowedBy) out.push(`Narrowed to ${narrowedBy}: ${inventory.unions.length} union(s) its files declare or consume.`);
  out.push(
    "A shot marked `(intercepted)` comes through a rewritten API response: the component is real and the data is synthetic. `(mounted)` is the harness drawing the component directly. A shot with no label comes from live data."
  );
  for (const [mechanism, why] of Object.entries(notRun)) {
    out.push("");
    out.push(`Mechanism \`${mechanism}\` did not run: ${why}. Every capture it owns is uncovered below.`);
  }
  out.push("");
  for (const union of inventory.unions) {
    const mine = rows.filter((row) => row.id.startsWith(`${union.name}.`));
    const { covered, planned } = coverageFor(union, mine);
    totals.covered += covered;
    totals.planned += planned;
    out.push(`### ${subjectLabel(union)}: ${union.name}, ${covered} of ${planned} renderings`);
    out.push("");
    out.push("| State | Shot | Expect | Verified |");
    out.push("|---|---|---|---|");
    for (const row of orderRows(union, mine)) {
      const label = provenanceLabel(row.provenance);
      const shot = row.ok ? [row.subject ? `![${cell(row.id)}](${row.subject})` : "shot, but no path reported", label].filter(Boolean).join(" ") : "not shot";
      const expect = row.ok ? cell(row.expect ?? "-") : cell(refusalFor(row));
      out.push(`| ${stateCell(union, row)} | ${shot} | ${expect || "-"} | ${verifiedCell(row)} |`);
    }
    out.push("");
  }
  const orphans = rows.filter((row) => row.extra && !unionOf(inventory, row.id));
  if (orphans.length > 0) {
    out.push("### Reported by the runner, and in no union of the inventory");
    out.push("");
    for (const row of orphans) out.push(`- \`${cell(row.id)}\` (${row.ok ? "ok" : "failed"})`);
    out.push("");
  }
  out.push(`${inventory.unions.length} union(s), ${totals.covered} of ${totals.planned} renderings.`);
  return out.join("\n");
}
function groupFor(union, captures, defaultLeg, surface) {
  const delivery = union.delivery ?? null;
  const missing = [];
  const derived = (union.routes ?? []).find((r) => !r.dynamic && (surface === void 0 || r.surface === surface))?.route ?? null;
  const route = typeof delivery?.route === "string" && delivery.route !== "" ? delivery.route : derived;
  if (!route) missing.push("route");
  const intercept = delivery?.intercept;
  if (typeof intercept?.url !== "string" || intercept.url === "") missing.push("intercept.url");
  if (typeof intercept?.container !== "string" || intercept.container === "") missing.push("intercept.container");
  const settle = delivery?.settle ?? null;
  if (!settle || !settle.selector && !settle.artwork && !settle.video && !settle.busy) missing.push("settle");
  const site = solveSite(union);
  const shape = site?.params[0]?.shape ?? null;
  if (!site) missing.push("verify");
  else if (!shape) missing.push("solve.shape");
  if (captures.length === 1 && delivery?.contrast === void 0) missing.push("contrast");
  if (missing.length > 0 || !delivery || !route || !intercept || !settle || !site || !shape) return { group: null, missing };
  const group = {
    id: union.name,
    union: union.name,
    leg: delivery.leg ?? defaultLeg,
    route,
    provenance: "intercepted",
    intercept: { url: intercept.url, container: intercept.container },
    settle,
    ...delivery.act ? { act: delivery.act } : {},
    verify: { module: site.file, export: site.fn, async: site.async, ...delivery.verifyArgs ? { args: delivery.verifyArgs } : {} },
    solve: {
      shape,
      pivots: { literals: site.pivots.literals, names: site.pivots.names },
      ...delivery.pivotModules ? { pivotModules: delivery.pivotModules } : {},
      ...typeof delivery.limit === "number" ? { limit: delivery.limit } : {},
      ...typeof delivery.batchSize === "number" ? { batchSize: delivery.batchSize } : {}
    },
    members: captures.map((capture) => ({ id: capture.id, member: capture.member, expect: capture.member })),
    ...delivery.contrast === void 0 ? {} : { contrast: delivery.contrast },
    ...delivery.diffRoot ? { diffRoot: delivery.diffRoot } : {},
    ...delivery.ignoreAttributes ? { ignoreAttributes: delivery.ignoreAttributes } : {},
    ...typeof delivery.maxSubjectAreaRatio === "number" ? { maxSubjectAreaRatio: delivery.maxSubjectAreaRatio } : {}
  };
  return { group, missing: null };
}
function groupsFor(inventory, captures, defaultLeg, surface) {
  const groups = [];
  const blocked = {};
  for (const union of inventory.unions) {
    const mine = captures.filter((capture) => capture.union === union.name && capture.mechanism === "solve");
    if (mine.length === 0) continue;
    const built = groupFor(union, mine, defaultLeg, surface);
    if (built.group) groups.push(built.group);
    else {
      blocked[union.name] = `no capture group could be built. Missing: ${built.missing.join(", ")}. A delivery descriptor beside the union in the inventory gives the intercept and the settle, and the route when the scan derives no static route. The shape and the pivots come from the scan`;
    }
  }
  return { groups, blocked };
}
function mergeDelivery(inventory, delivery) {
  return { ...inventory, unions: inventory.unions.map((union) => delivery[union.name] ? { ...union, delivery: delivery[union.name] } : union) };
}
function buildPlan(args) {
  const { inventory: scanned, narrow } = args;
  const inventory = narrow ? narrowInventory(scanned, narrow).inventory : scanned;
  return {
    generated: args.generated,
    slug: args.slug,
    source: args.source,
    scanned: scanned.unions.length,
    narrowedBy: narrow?.label ?? null,
    inventory,
    captures: plannedCaptures(inventory)
  };
}
function renderPlan(plan) {
  const out = [];
  const byMechanism = /* @__PURE__ */ new Map();
  for (const capture of plan.captures) {
    const key = capture.mechanism ?? "none";
    byMechanism.set(key, (byMechanism.get(key) ?? 0) + 1);
  }
  out.push(`inventory  ${plan.source}, ${plan.scanned} union(s)`);
  if (plan.narrowedBy) out.push(`narrowed   ${plan.inventory.unions.length} of ${plan.scanned} union(s) kept by ${plan.narrowedBy}`);
  const parts = ["mount", "solve", "none"].filter((key) => byMechanism.has(key)).map((key) => `${key} ${byMechanism.get(key)}`).join(", ");
  out.push(`captures   ${plan.captures.length}${parts ? ` (${parts})` : ""}`);
  out.push("");
  for (const union of plan.inventory.unions) {
    const mine = plan.captures.filter((capture) => capture.union === union.name);
    out.push(
      `  ${union.name.padEnd(24)} ${union.kind.padEnd(8)} ${String(mechanismFor(union.kind) ?? "none").padEnd(6)} ${String(mine.length).padStart(3)} capture(s)  ${union.file}`
    );
  }
  return out;
}
function renderNeither(inventory) {
  const neither = neitherUnions(inventory);
  if (neither.length === 0) return [];
  const out = ["", `REFUSED   ${neither.length} union(s) are neither an input nor an output (spec 2.14 rule C1). Each one earns an issue:`];
  for (const union of neither) {
    const issue = issueFor(union);
    out.push("", `-- issue ${"-".repeat(60)}`, issue.title, "", issue.body, "-".repeat(69));
  }
  return out;
}
function finishRun(args) {
  const { plan, attempts, malformed = [], notRun = {}, blocked = {} } = args;
  const rows = mergeRows(plan.captures, attempts, { notRun, blocked });
  const lines = [renderReport({ inventory: plan.inventory, rows, slug: plan.slug, narrowedBy: plan.narrowedBy, notRun })];
  for (const line of malformed) lines.push(`malformed result line, not read: ${line}`);
  const refusals = refusalLines(plan.inventory, rows);
  if (refusals.length > 0) {
    lines.push("", `REFUSED   ${refusals.length}, and each one is a failure:`);
    for (const line of refusals) lines.push(`  ${line}`);
  }
  const neither = renderNeither(plan.inventory);
  lines.push(...neither);
  const notRunCount = Object.keys(notRun).length;
  const failed = rows.filter((row) => !row.ok).length;
  const refused = neitherUnions(plan.inventory).length;
  lines.push("");
  if (failed === 0 && refused === 0 && notRunCount === 0) lines.push("every planned rendering was captured.");
  else lines.push(`${failed} rendering(s) uncovered, ${refused} union(s) refused, ${notRunCount} mechanism(s) not run.`);
  return { lines, code: failed > 0 || refused > 0 || notRunCount > 0 ? 1 : 0, rows };
}

export {
  parseInventory,
  neitherUnions,
  issueFor,
  parseResults,
  renderReport,
  groupsFor,
  mergeDelivery,
  buildPlan,
  renderPlan,
  renderNeither,
  finishRun
};
//# sourceMappingURL=chunk-IX3NBJY2.js.map