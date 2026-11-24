import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/states/services/inventory.mts
var STATE_SUFFIXES = ["State", "Mark", "Status", "Kind", "Phase", "Variant"];
function isStateUnionName(name) {
  return STATE_SUFFIXES.some((s) => name.endsWith(s) && name.length > s.length);
}
var KINDS = ["input", "output", "both", "neither"];
var IGNORE_TAG = "qa-states";
var PROVENANCE = ["live", "intercepted", "mounted", "forged"];
var FAIL_REASONS = [
  "unreachable",
  "identical",
  "state-mismatch",
  "unmountable",
  "no-mechanism",
  "blocked",
  "not-run",
  "crashed"
];
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function kindFor(inputs, outputs) {
  const hasIn = inputs.length > 0;
  const hasOut = outputs.length > 0;
  if (hasIn && hasOut) return "both";
  if (hasIn) return "input";
  if (hasOut) return "output";
  return "neither";
}
function mechanismFor(kind) {
  if (kind === "input" || kind === "both") return "mount";
  if (kind === "output") return "solve";
  return null;
}
function validateInventory(inv) {
  const errors = [];
  if (!isPlainObject(inv)) return ["the inventory is not an object"];
  if (typeof inv.generated !== "string" || inv.generated === "") errors.push("generated: missing");
  if (!Array.isArray(inv.roots) || inv.roots.length === 0 || inv.roots.some((r) => typeof r !== "string")) {
    errors.push("roots: must list the client roots the scan read");
  }
  if (!Array.isArray(inv.unions)) {
    errors.push("unions: must be an array");
    return errors;
  }
  const unions = inv.unions;
  if (inv.ignored !== void 0) {
    if (!Array.isArray(inv.ignored)) {
      errors.push("ignored: must be an array");
    } else {
      for (const [i, g] of inv.ignored.entries()) {
        const at = isPlainObject(g) && typeof g.name === "string" ? `ignored[${i}] "${g.name}"` : `ignored[${i}]`;
        if (!isPlainObject(g)) {
          errors.push(`${at}: not an object`);
          continue;
        }
        if (typeof g.reason !== "string" || g.reason.trim() === "") errors.push(`${at}: needs a reason`);
        if (!Array.isArray(g.members) || g.members.length === 0) {
          errors.push(`${at}: must carry its members, so the report can count what is not covered`);
        }
        if (unions.some((u) => isPlainObject(u) && u.name === g.name)) {
          errors.push(`${at}: is also in unions, so its states would be counted twice`);
        }
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  for (const [i, u] of unions.entries()) {
    const at = isPlainObject(u) && typeof u.name === "string" ? `unions[${i}] "${u.name}"` : `unions[${i}]`;
    if (!isPlainObject(u)) {
      errors.push(`${at}: not an object`);
      continue;
    }
    if (typeof u.name !== "string" || u.name === "") errors.push(`${at}: name is missing`);
    else if (seen.has(u.name)) errors.push(`${at}: duplicate union name`);
    else seen.add(u.name);
    if (typeof u.file !== "string" || u.file === "") errors.push(`${at}: file is missing`);
    if (!Array.isArray(u.members) || u.members.length < 2) {
      errors.push(`${at}: members must list at least two, or it is not a state union`);
    } else if (new Set(u.members).size !== u.members.length) {
      errors.push(`${at}: members repeat`);
    }
    const kindOk = KINDS.includes(u.kind);
    if (!kindOk) errors.push(`${at}: kind "${String(u.kind)}" is not one of ${KINDS.join(" ")}`);
    for (const key of ["inputs", "outputs"]) {
      if (!Array.isArray(u[key])) errors.push(`${at}: ${key} must be an array`);
    }
    if (Array.isArray(u.inputs) && Array.isArray(u.outputs) && kindOk) {
      const expected = kindFor(u.inputs, u.outputs);
      if (expected !== u.kind) errors.push(`${at}: kind is "${String(u.kind)}" but its sites say "${expected}"`);
    }
    for (const [j, o] of (Array.isArray(u.outputs) ? u.outputs : []).entries()) {
      if (!isPlainObject(o)) {
        errors.push(`${at}: outputs[${j}] is not an object`);
        continue;
      }
      if (!Array.isArray(o.params)) errors.push(`${at}: outputs[${j}] (${String(o.fn)}) has no params list`);
      if (o.exported !== true && o.exported !== false) errors.push(`${at}: outputs[${j}] must say whether it is exported`);
    }
  }
  return errors;
}
function plannedCaptures(inv) {
  const out = [];
  for (const u of inv.unions) {
    const mechanism = mechanismFor(u.kind);
    for (const member of u.members) out.push({ id: `${u.name}.${member}`, union: u.name, member, kind: u.kind, mechanism });
    if (u.outputs.some((o) => o.nullable)) out.push({ id: `${u.name}.null`, union: u.name, member: null, kind: u.kind, mechanism });
  }
  return out;
}
function solveSite(union) {
  const exported = union.outputs.filter((site) => site.exported);
  return exported.find((site) => site.params[0]?.shape) ?? exported[0] ?? null;
}
function statesDir(slug) {
  return `assets/${slug}/states`;
}
function statePath(slug, captureId, which, ext = "png") {
  return `${statesDir(slug)}/${captureId}.${which}.${ext}`;
}
function coverageFor(union, results) {
  const mine = results.filter((r) => r.id.startsWith(`${union.name}.`));
  const covered = mine.filter((r) => r.ok);
  const missing = mine.filter((r) => !r.ok).map((r) => r.id.slice(union.name.length + 1));
  return { covered: covered.length, planned: mine.length, missing };
}
function inferSeeds(inventory, unreachable2) {
  const out = [];
  for (const union of inventory.unions) {
    if (!unreachable2.has(union.name)) continue;
    const fields = union.inputs.map((site) => ({ interface: site.interface, field: site.field, file: site.file }));
    const drivable = union.inputs.length > 0 || solveSite(union) !== null;
    out.push({
      union: union.name,
      file: union.file,
      members: [...union.members],
      fields,
      via: drivable ? "app-service" : "direct-write",
      provenance: "forged",
      reason: union.kind === "neither" ? "nothing takes it and nothing returns it" : union.why ?? "no route delivers it and no mount draws it"
    });
  }
  return out;
}

// src/states/services/solve.mts
var MAX_CANDIDATES = 500;
var FIELD_KINDS = ["boolean", "number", "string", "enum", "nullable", "opaque"];
var ABSENT = /* @__PURE__ */ Symbol.for("lw.qa.solve.absent");
var NULL_STATE = "null";
var DEFAULT_STRING = "qa";
var isPlainObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var same = (a, b) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
function canonical(obj) {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(obj).sort().map((k) => [k, obj[k]])
    )
  );
}
var show = (v) => v === ABSENT ? "(absent)" : typeof v === "string" ? JSON.stringify(v) : String(v);
function validateShape(shape) {
  const errors = [];
  if (!isPlainObject2(shape)) return ["the shape is not an object"];
  if (typeof shape.type !== "string" || shape.type === "") {
    errors.push("type: missing, and it names the parameter type this shape describes");
  }
  if (!isPlainObject2(shape.fields)) {
    errors.push("fields: must be an object of field descriptors");
    return errors;
  }
  const fields = shape.fields;
  const names = Object.keys(fields);
  if (names.length === 0) errors.push("fields: empty, so nothing can be varied");
  for (const name of names) errors.push(...validateField(fields[name], name));
  if (names.length > 0 && names.every((n) => isPlainObject2(fields[n]) && fields[n].kind === "opaque")) {
    errors.push("fields: every field is opaque, so no candidate can differ from the corpus");
  }
  return errors;
}
function validateField(field, at, insideNullable = false) {
  const errors = [];
  if (!isPlainObject2(field)) return [`${at}: not a field descriptor`];
  if (!FIELD_KINDS.includes(field.kind)) {
    return [`${at}: kind "${String(field.kind)}" is not one of ${FIELD_KINDS.join(" ")}`];
  }
  if (field.optional !== void 0 && typeof field.optional !== "boolean") errors.push(`${at}: optional must be a boolean`);
  if (insideNullable && field.optional === true) errors.push(`${at}: optional inside nullable says nothing new`);
  if (field.kind === "enum" && (!Array.isArray(field.values) || field.values.length < 2)) {
    errors.push(`${at}: enum needs at least two values, or it is a constant`);
  }
  if (field.kind === "number" && field.pivots !== void 0) {
    if (!Array.isArray(field.pivots) || field.pivots.some((p) => !Number.isFinite(p))) {
      errors.push(`${at}: pivots must be an array of finite numbers`);
    }
  }
  if (field.kind === "string" && field.sample !== void 0 && typeof field.sample !== "string") {
    errors.push(`${at}: sample must be a string`);
  }
  if (field.kind === "nullable") {
    if (!isPlainObject2(field.of)) errors.push(`${at}: nullable needs an "of" descriptor`);
    else if (field.of.kind === "nullable") errors.push(`${at}: nullable inside nullable adds a second null`);
    else errors.push(...validateField(field.of, `${at}.of`, true));
  }
  return errors;
}
function fieldValues(field, options = {}) {
  const values = baseValues(field, options);
  return field.optional === true ? [...values, ABSENT] : values;
}
function baseValues(field, options) {
  switch (field.kind) {
    case "boolean":
      return [true, false];
    case "number":
      return numberValues(field, options);
    case "string":
      return [typeof field.sample === "string" ? field.sample : DEFAULT_STRING, ""];
    case "enum":
      return [...field.values ?? []];
    case "nullable":
      return field.of ? [null, ...baseValues(field.of, options)] : [null];
    case "opaque":
      return [];
  }
}
function numberValues(field, options) {
  const pivots = [...field.pivots ?? [], ...options.pivots ?? []];
  const out = [0, 1];
  for (const p of pivots) out.push(p, p + 1, p - 1);
  return [...new Set(out)];
}
function mutate(base, edits) {
  const next = { ...base };
  for (const [field, value] of edits) {
    if (value === ABSENT) delete next[field];
    else next[field] = value;
  }
  return next;
}
function solveError(message, context = {}) {
  return new LaunchwrightError("qa.states.solve", message, { context });
}
function candidatePlan(shape, corpus, options = {}) {
  const errors = validateShape(shape);
  if (errors.length > 0) throw solveError(`The shape is unusable: ${errors.join("; ")}`, { errors });
  if (!Array.isArray(corpus) || corpus.length === 0) {
    throw solveError("The corpus is empty. It holds real objects from the wire, and a search of none reports every state unreachable.");
  }
  for (const [i, entry] of corpus.entries()) {
    if (!isPlainObject2(entry)) throw solveError(`corpus[${i}] is not an object`);
  }
  const limit = options.limit ?? MAX_CANDIDATES;
  if (!Number.isInteger(limit) || limit < 1) throw solveError(`limit must be a positive integer, not ${String(options.limit)}`);
  const values = /* @__PURE__ */ new Map();
  for (const [name, field] of Object.entries(shape.fields)) {
    const list = fieldValues(field, options);
    if (list.length > 0) values.set(name, list);
  }
  const names = [...values.keys()];
  const valuesOf = (name) => values.get(name) ?? [];
  const plan = [];
  const seen = /* @__PURE__ */ new Set();
  const full = () => plan.length >= limit;
  const add = (candidate, base, baseIndex) => {
    const key = canonical(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    const { changes, text } = describeCandidate(candidate, base);
    plan.push({ candidate, base, baseIndex, changes, text });
  };
  for (const [i, base] of corpus.entries()) {
    if (full()) break;
    add({ ...base }, base, i);
  }
  for (const [i, base] of corpus.entries()) {
    for (const name of names) {
      for (const value of valuesOf(name)) {
        if (full()) return plan;
        add(mutate(base, [[name, value]]), base, i);
      }
    }
  }
  for (const [i, base] of corpus.entries()) {
    for (let a = 0; a < names.length; a += 1) {
      for (let b = a + 1; b < names.length; b += 1) {
        const first = names[a];
        const second = names[b];
        for (const x of valuesOf(first)) {
          for (const y of valuesOf(second)) {
            if (full()) return plan;
            add(mutate(base, [[first, x], [second, y]]), base, i);
          }
        }
      }
    }
  }
  return plan;
}
function candidates(shape, corpus, options = {}) {
  return candidatePlan(shape, corpus, options).map((step) => step.candidate);
}
function describeCandidate(candidate, corpusEntry) {
  const names = [.../* @__PURE__ */ new Set([...Object.keys(corpusEntry), ...Object.keys(candidate)])];
  const changes = [];
  for (const field of names) {
    const had = Object.hasOwn(corpusEntry, field) && corpusEntry[field] !== void 0;
    const has = Object.hasOwn(candidate, field) && candidate[field] !== void 0;
    if (!had && !has) continue;
    if (had && has && same(corpusEntry[field], candidate[field])) continue;
    changes.push({ field, from: had ? corpusEntry[field] : ABSENT, to: has ? candidate[field] : ABSENT });
  }
  const text = changes.length === 0 ? "unchanged from the corpus entry" : changes.map((c) => `${c.field}: ${show(c.from)} -> ${show(c.to)}`).join(", ");
  return { changes, text };
}
function unreachable(union, tried) {
  const covered = union.covered ?? [];
  const missing = union.members.filter((m) => !covered.includes(m));
  if (missing.length === 0) return null;
  const varied = tried.fields.length > 0 ? tried.fields.join(", ") : "no field";
  const produced = covered.length > 0 ? covered.map((m) => show(m)).join(", ") : "nothing";
  return `${union.name}: ${missing.map((m) => show(m)).join(", ")} unreachable. ${tried.count} candidate${tried.count === 1 ? "" : "s"} varied ${varied}, and produced ${produced}. A state the type admits and the data cannot produce is a finding, not a gap in the search.`;
}
function normaliseState(raw) {
  if (raw === null || raw === void 0) return NULL_STATE;
  if (typeof raw !== "string") {
    throw solveError(`The state function answered ${typeof raw}. A state function returns a union member or null, so the wrong function was evaluated.`);
  }
  return raw;
}
async function solve(args) {
  const { shape, corpus, evaluate, members = null, union, limit, pivots } = args;
  const plan = candidatePlan(shape, corpus, { ...limit === void 0 ? {} : { limit }, ...pivots === void 0 ? {} : { pivots } });
  const wanted = members === null ? null : new Set(members);
  const covered = {};
  const order = [];
  let tried = 0;
  let hits = 0;
  for (const step of plan) {
    tried += 1;
    const state = normaliseState(await evaluate(step.candidate));
    if (!Object.hasOwn(covered, state)) {
      covered[state] = { ...step, state };
      order.push(state);
      if (wanted?.has(state)) hits += 1;
    }
    if (wanted !== null && hits === wanted.size) break;
  }
  const name = union ?? shape.type;
  const missing = wanted === null ? [] : [...wanted].filter((m) => !Object.hasOwn(covered, m));
  const extra = wanted === null ? [] : order.filter((s) => !wanted.has(s));
  return {
    covered,
    order,
    tried,
    planned: plan.length,
    limit: limit ?? MAX_CANDIDATES,
    missing,
    extra,
    sentence: missing.length === 0 || wanted === null ? null : unreachable({ name, members: [...wanted], covered: order }, { count: tried, fields: Object.keys(shape.fields) })
  };
}
function graft(base, candidate, fields) {
  const next = { ...base };
  for (const field of fields) {
    if (Object.hasOwn(candidate, field) && candidate[field] !== void 0) next[field] = candidate[field];
    else delete next[field];
  }
  return next;
}
function sameField(a, b, field) {
  const hasA = Object.hasOwn(a, field) && a[field] !== void 0;
  const hasB = Object.hasOwn(b, field) && b[field] !== void 0;
  if (!hasA && !hasB) return true;
  if (hasA !== hasB) return false;
  return same(a[field], b[field]);
}
async function anchorSubjects(args) {
  const { shape, base, covered, members, evaluate } = args;
  const errors = validateShape(shape);
  if (errors.length > 0) throw solveError(`The shape is unusable: ${errors.join("; ")}`, { errors });
  const shapeFields = Object.keys(shape.fields);
  const subjects = {};
  const fields = [];
  const anchored = [];
  const loose = [];
  const notes = [];
  let evaluations = 0;
  const answers = async (candidate) => {
    evaluations += 1;
    return normaliseState(await evaluate(candidate));
  };
  for (const member of members) {
    const hit = covered[member];
    if (hit === void 0 || !isPlainObject2(hit.candidate)) continue;
    const candidate = hit.candidate;
    let keep = shapeFields.filter((f) => !sameField(base, candidate, f));
    if (await answers(graft(base, candidate, keep)) !== member) {
      subjects[member] = { ...candidate };
      loose.push(member);
      notes.push(
        `${member} could not be anchored on the base row: grafting ${keep.length > 0 ? keep.join(", ") : "no field"} onto it does not produce the state, so the state depends on a field the shape does not declare. This member keeps the solver's own row, and its picture differs from the others in more than the state.`
      );
      continue;
    }
    for (const field of [...keep]) {
      const without = keep.filter((f) => f !== field);
      if (await answers(graft(base, candidate, without)) === member) keep = without;
    }
    subjects[member] = graft(base, candidate, keep);
    anchored.push(member);
    for (const f of keep) if (!fields.includes(f)) fields.push(f);
  }
  return { subjects, fields, anchored, loose, notes, evaluations };
}

export {
  STATE_SUFFIXES,
  isStateUnionName,
  KINDS,
  IGNORE_TAG,
  PROVENANCE,
  FAIL_REASONS,
  kindFor,
  mechanismFor,
  validateInventory,
  plannedCaptures,
  solveSite,
  statePath,
  coverageFor,
  inferSeeds,
  MAX_CANDIDATES,
  ABSENT,
  NULL_STATE,
  canonical,
  validateShape,
  fieldValues,
  candidatePlan,
  candidates,
  describeCandidate,
  unreachable,
  solve,
  anchorSubjects
};
//# sourceMappingURL=chunk-42WWWMVO.js.map