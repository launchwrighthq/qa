import {
  PROVENANCE,
  anchorSubjects,
  candidatePlan,
  canonical,
  solve,
  statePath
} from "./chunk-42WWWMVO.js";
import {
  QA_STATES_ATTRIBUTE,
  QA_STATES_PATH
} from "./chunk-277Y4WQJ.js";
import {
  LaunchwrightError,
  isCodedError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/services/paths.mts
var MAX_DEPTH = 3;
var MAX_EDGES_PER_NODE = 12;
var CONTROL_SELECTOR = 'button, a, [role="button"], [role="link"], [role="tab"]';
var MAX_LABEL = 60;
var VIDEO_KINDS = ["path", "state"];
function cleanLabel(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
}
function chooseEdges(controls, max = MAX_EDGES_PER_NODE) {
  const all = controls ?? [];
  if (all.length <= max) return [...all];
  const stride = all.length / max;
  const picked = [];
  for (let i = 0; i < max; i += 1) picked.push(all[Math.floor(i * stride)]);
  return picked;
}
function routeMatcher(pattern) {
  const [head = "", ...rest] = String(pattern).split("/");
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = rest.map((segment) => {
    if (!segment.startsWith(":")) return `/${escape(segment)}`;
    return segment.endsWith("?") ? "(?:/[^/]*)?" : "/[^/]+";
  }).join("");
  return new RegExp(`^${escape(head)}${tail}/?$`);
}
function routeMatches(pattern, pathname) {
  return routeMatcher(pattern).test(String(pathname).replace(/[?#].*$/, ""));
}
function isRoutePattern(route) {
  return String(route).split("/").some((segment) => segment.startsWith(":"));
}
function specificity(pattern) {
  const segments = pattern.split("/").filter((s) => s !== "");
  const optional = segments.filter((s) => s.startsWith(":") && s.endsWith("?")).length;
  const required = segments.filter((s) => s.startsWith(":") && !s.endsWith("?")).length;
  return [segments.length - optional - required, required, -optional];
}
function bestRoute(routes, pathname) {
  let best = null;
  let rank = null;
  for (const route of routes) {
    if (!routeMatches(route, pathname)) continue;
    const own = specificity(route);
    const wins = rank === null || own[0] > rank[0] || own[0] === rank[0] && (own[1] > rank[1] || own[1] === rank[1] && own[2] > rank[2]);
    if (wins) {
      best = route;
      rank = own;
    }
  }
  return best;
}
function openRoute(pattern) {
  const kept = [];
  for (const segment of pattern.split("/")) {
    if (segment.startsWith(":") && segment.endsWith("?")) continue;
    if (segment.startsWith(":")) return null;
    kept.push(segment);
  }
  const route = kept.join("/");
  return route === "" ? "/" : route;
}
function reachedTarget(targets, surface, route) {
  const mine = targets.filter((t) => t.surface === surface).map((t) => t.route);
  if (mine.includes(route)) return route;
  return isRoutePattern(route) ? null : bestRoute(mine, route);
}
function targetsFrom(delivery) {
  const byKey = /* @__PURE__ */ new Map();
  for (const union of delivery?.unions ?? []) {
    const name = union.union ?? union.name ?? "";
    for (const row of union.routes ?? []) {
      const key = `${row.surface} ${row.route}`;
      const seen = byKey.get(key);
      if (seen) {
        if (!seen.unions.includes(name)) seen.unions.push(name);
        continue;
      }
      byKey.set(key, { surface: row.surface, route: row.route, page: row.page ?? null, dynamic: Boolean(row.dynamic), unions: [name] });
    }
  }
  return [...byKey.values()].sort((a, b) => a.surface.localeCompare(b.surface) || a.route.localeCompare(b.route));
}
function pathId(path) {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "root";
  const tail = (path.steps ?? []).map((s) => slug(s.label)).join(".");
  return [path.leg, slug(path.from), tail].filter(Boolean).join(".");
}
function formatPath(path) {
  const steps = (path.steps ?? []).map((s) => `"${s.label}"`);
  const ends = path.route ?? path.steps?.at(-1)?.route ?? path.from;
  return [path.from, ...steps, ends].join(" -> ");
}
function crossReach(targets, paths) {
  const rows = targets.map((target) => {
    const reached = paths.filter((p) => p.surface === target.surface && p.route !== void 0 && reachedTarget(targets, p.surface, p.route) === target.route);
    return { ...target, reached: reached.length > 0, by: reached.map((e) => e.id) };
  });
  const unionState = /* @__PURE__ */ new Map();
  for (const row of rows) for (const union of row.unions) unionState.set(union, (unionState.get(union) ?? false) || row.reached);
  return {
    routes: rows,
    unions: [...unionState.entries()].map(([union, reachable]) => ({ union, reachable })).sort((a, b) => a.union.localeCompare(b.union)),
    unreachable: [...unionState.entries()].filter(([, reachable]) => !reachable).map(([union]) => union).sort()
  };
}
function routeDrift(targets, paths) {
  return paths.filter((p) => p.route !== void 0 && reachedTarget(targets, p.surface, p.route) === null).map((p) => ({ id: p.id, route: p.route }));
}
function videoRecord(args) {
  const { kind, file, provenance, device, seconds, marks = [], steps = [] } = args;
  if (!VIDEO_KINDS.includes(kind)) return { ok: false, reason: "crashed", error: `unknown video kind ${kind}` };
  if (!PROVENANCE.includes(provenance)) {
    return { ok: false, reason: "unlabelled-video", error: `provenance must be one of ${PROVENANCE.join(", ")}` };
  }
  if (kind === "path" && provenance !== "live") return { ok: false, reason: "unlabelled-video", error: "a path video is live by construction: real taps, real data" };
  if (kind === "state" && provenance === "live") return { ok: false, reason: "unlabelled-video", error: "a state video is mounted or intercepted, never live" };
  if (!device) return { ok: false, reason: "no-serial", error: "a video names the device it was taken on" };
  return { ok: true, kind, file, provenance, device, seconds, marks, steps };
}
function controlsExpression() {
  return `(() => {
  const out = [];
  for (const el of Array.from(document.querySelectorAll(${JSON.stringify(CONTROL_SELECTOR)}))) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim();
    if (name === '') continue;
    out.push({ label: name, role: el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button') });
  }
  return out;
})()`;
}
function clickByNameExpression(label, role) {
  return `(() => {
  const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim().slice(0, ${MAX_LABEL});
  const want = norm(${JSON.stringify(String(label))});
  const wantRole = ${JSON.stringify(String(role))};
  const before = window.location.pathname;
  for (const el of Array.from(document.querySelectorAll(${JSON.stringify(CONTROL_SELECTOR)}))) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    const r = el.getAttribute('role') || (el.tagName === 'A' ? 'link' : 'button');
    if (r !== wantRole) continue;
    const name = norm(el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '');
    if (name !== want) continue;
    el.click();
    return { ok: true, before };
  }
  return { ok: false, error: 'no ' + wantRole + ' called ' + JSON.stringify(want) + ' on ' + before };
})()`;
}
function normaliseControls(raw) {
  const seen = /* @__PURE__ */ new Set();
  const controls = [];
  for (const c of raw) {
    const label = cleanLabel(c.label);
    const role = String(c.role ?? "button");
    if (label === "" || seen.has(`${role} ${label}`)) continue;
    seen.add(`${role} ${label}`);
    controls.push({ label, role });
  }
  return controls.sort((a, b) => a.label.localeCompare(b.label) || a.role.localeCompare(b.role));
}
function pathsDir(slug) {
  return `assets/${slug}/paths`;
}
function videoPath(slug, id, leg, ext) {
  return `${pathsDir(slug)}/${id}.${leg}.${ext}`;
}
function stamp(ms) {
  const total = Math.max(0, Math.round(ms / 1e3));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function budgetCheck(args) {
  const limitMs = args.seconds * 1e3;
  const over = args.steps.find((s) => (s.atMs ?? 0) > limitMs);
  if (!over) return { ok: true };
  return { ok: false, reason: "over-budget", error: `the recorder stopped at ${stamp(limitMs)} and the path was still on "${over.label}" at ${stamp(over.atMs ?? 0)}` };
}
var CLICK_SETTLE = { busy: true, timeout: 4e3 };
var STEP_TIMEOUT_MS = 3e4;
function buildCrawlPlan(args) {
  return {
    slug: args.slug,
    leg: args.leg,
    surface: args.surface,
    root: args.root ?? "/",
    maxDepth: MAX_DEPTH,
    maxEdges: MAX_EDGES_PER_NODE,
    targets: args.targets.filter((t) => t.surface === args.surface),
    settle: args.settle ?? CLICK_SETTLE,
    stepTimeoutMs: args.stepTimeoutMs ?? STEP_TIMEOUT_MS
  };
}
var pathnameOf = (route) => route.replace(/[?#].*$/, "") || "/";
function resolveRoute(landed, targets) {
  return bestRoute(
    targets.map((t) => t.route),
    landed
  );
}
function targetResults(plan, paths, error) {
  const cross = crossReach(
    plan.targets,
    paths.map((p) => ({ id: p.id, route: p.route, surface: plan.surface }))
  );
  return cross.routes.map((row) => ({
    route: row.route,
    unions: row.unions,
    reached: row.reached,
    by: row.by,
    ...error !== void 0 && !row.reached ? { error } : {}
  }));
}
var StepTimeout = class extends LaunchwrightError {
};
var firstLine = (err) => (err instanceof Error ? err.message : String(err)).split("\n")[0] ?? "";
async function withinStep(ms, what, work, late) {
  let timer;
  const bound = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeout("qa.paths.step-timeout", `${what} took longer than ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, bound]);
  } catch (err) {
    if (err instanceof StepTimeout) work.then(void 0, late);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
function requireEvaluate(session) {
  if (!session.evaluate) {
    throw new LaunchwrightError("qa.paths.evaluate", "The target cannot evaluate in the page, so the crawl cannot list or press controls. Use a browser or WebView target.");
  }
  return session.evaluate.bind(session);
}
async function settleSoft(session, rule) {
  try {
    await session.settle(rule);
    return null;
  } catch (err) {
    if (isCodedError(err) && err.code === "qa.target.settle") return firstLine(err);
    throw err;
  }
}
async function followEdge(session, control, before, settle) {
  const evaluate = requireEvaluate(session);
  const pressed = await evaluate(clickByNameExpression(control.label, control.role));
  if (!pressed.ok) return { moved: false, landed: before, settled: null, ...pressed.error === void 0 ? {} : { error: pressed.error } };
  const settled = await settleSoft(session, settle);
  const landed = pathnameOf(await session.currentRoute());
  return { moved: landed !== before, landed, settled };
}
async function crawl(session, plan) {
  const evaluate = requireEvaluate(session);
  const found = [];
  const failures = [];
  const rootTarget = resolveRoute(plan.root, plan.targets);
  const visited = /* @__PURE__ */ new Set([plan.root, ...rootTarget === null ? [] : [rootTarget]]);
  const halt = { why: null };
  const attempt = async (route, label, kind, work) => {
    const where = label === void 0 ? `open ${route}` : `press "${label}" on ${route}`;
    const at = { route, ...label === void 0 ? {} : { label } };
    try {
      return await withinStep(plan.stepTimeoutMs, where, work(), (late) => failures.push({ ...at, kind: "timeout", error: `after the bound: ${firstLine(late)}` }));
    } catch (err) {
      const closed = session.isClosed?.() === true;
      failures.push({ ...at, kind: closed ? "closed" : err instanceof StepTimeout ? "timeout" : kind, error: firstLine(err) });
      if (closed) halt.why = `the browser closed during ${where}: ${firstLine(err)}`;
      return null;
    }
  };
  const openPage = async (route) => {
    await session.navigate(route);
    const settled = await settleSoft(session, plan.settle);
    if (settled !== null) failures.push({ route, kind: "settle", error: settled });
    return pathnameOf(await session.currentRoute());
  };
  let frontier = [{ open: plan.root, steps: [] }];
  for (let depth = 0; depth < plan.maxDepth && frontier.length > 0 && halt.why === null; depth += 1) {
    const next = [];
    for (const node of frontier) {
      if (halt.why !== null) break;
      const controls = await attempt(node.open, void 0, "navigate", async () => {
        await openPage(node.open);
        return chooseEdges(normaliseControls(await evaluate(controlsExpression())), plan.maxEdges);
      });
      if (controls === null && depth === 0) halt.why ??= `${plan.root} did not open: ${failures.at(-1)?.error ?? "no reason given"}`;
      for (const control of controls ?? []) {
        if (halt.why !== null) break;
        const edge = await attempt(node.open, control.label, "press", async () => {
          const from = await openPage(node.open);
          return { from, ...await followEdge(session, control, from, plan.settle) };
        });
        if (edge === null) continue;
        if (edge.settled !== null) failures.push({ route: edge.from, label: control.label, kind: "settle", error: edge.settled });
        if (!edge.moved) continue;
        const resolved = resolveRoute(edge.landed, plan.targets);
        const route = resolved ?? edge.landed;
        if (visited.has(route)) continue;
        visited.add(route);
        const steps = [...node.steps, { label: control.label, role: control.role, route }];
        const path = { leg: plan.leg, from: plan.root, steps, route };
        found.push({ id: pathId(path), leg: plan.leg, from: plan.root, route, landed: edge.landed, resolved: resolved !== null, steps, readable: formatPath(path), depth: depth + 1 });
        next.push({ open: edge.landed, steps });
      }
    }
    frontier = next;
  }
  return { paths: found, visited: [...visited], failures, targets: targetResults(plan, found, halt.why ?? void 0) };
}
async function recordPath(session, args) {
  const settle = args.settle ?? CLICK_SETTLE;
  const steps = [];
  await session.navigate(args.root);
  let current = pathnameOf(await session.currentRoute());
  await session.startVideo(args.file);
  const startedAt = args.now();
  let driveError = null;
  let file = args.file;
  try {
    for (const step of args.path.steps) {
      const { moved, landed, error } = await followEdge(session, step, current, settle);
      steps.push({ label: step.label, role: step.role, route: landed, atMs: args.now() - startedAt });
      if (!moved) {
        driveError = error ?? `"${step.label}" no longer navigates`;
        break;
      }
      current = landed;
    }
  } finally {
    file = (await session.stopVideo()).path;
  }
  const budget = budgetCheck({ steps, seconds: args.capS });
  if (!budget.ok) return { ...budget, file, steps };
  if (driveError !== null) return { ok: false, reason: "state-mismatch", error: driveError, file, steps };
  const seconds = (args.now() - startedAt) / 1e3;
  return videoRecord({ kind: "path", file, provenance: "live", device: args.device, seconds, steps, marks: steps.map((s) => `${stamp(s.atMs ?? 0)}  ${s.label}`) });
}

// src/states/services/capture.mts
import { posix } from "path";
var MAX_TREE_NODES = 4e4;
var DEFAULT_MAX_SUBJECT_AREA_RATIO = 0.9;
var DEFAULT_DIFF_ROOT = "body";
var MAX_CORPUS = 60;
var MAX_BODIES = 10;
var DEFAULT_EVALUATE_BATCH = 100;
var CaptureFailure = class extends LaunchwrightError {
  reason;
  detail;
  constructor(reason, message, detail = {}, cause) {
    super(`qa.states.${reason}`, message, { ...cause === void 0 ? {} : { cause }, context: { reason, ...detail } });
    this.reason = reason;
    this.detail = detail;
  }
};
function failureFields(e) {
  if (e instanceof CaptureFailure) return { reason: e.reason, ...e.detail };
  return { reason: "crashed" };
}
function errorText(e) {
  return messageOf(e);
}
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function getAtPath(root, path) {
  let node = root;
  for (const key of path.split(".")) {
    if (Array.isArray(node)) {
      const index = Number(key);
      if (!Number.isInteger(index)) return void 0;
      node = node[index];
      continue;
    }
    if (!isPlainObject(node)) return void 0;
    node = node[key];
  }
  return node;
}
function setAtPath(root, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  if (last === void 0) return false;
  let node = root;
  for (const key of keys) {
    if (Array.isArray(node)) node = node[Number(key)];
    else if (isPlainObject(node)) node = node[key];
    else return false;
  }
  if (Array.isArray(node)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= node.length) return false;
    node[index] = value;
    return true;
  }
  if (!isPlainObject(node) || !(last in node)) return false;
  node[last] = value;
  return true;
}
var STALE_HEADERS = /* @__PURE__ */ new Set(["content-length", "content-encoding", "transfer-encoding"]);
function freshHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !STALE_HEADERS.has(name.toLowerCase())));
}
async function installSubstitution(page, spec) {
  const state = {
    subjects: null,
    hits: 0,
    errors: [],
    corpus: [],
    bodies: []
  };
  const collect = (parsed, container) => {
    if (state.bodies.length < MAX_BODIES) state.bodies.push(parsed);
    for (const row of container) {
      if (state.corpus.length >= MAX_CORPUS) break;
      if (isPlainObject(row)) state.corpus.push(row);
    }
  };
  const handler = async (route) => {
    try {
      const response = await route.fetch();
      const text = await response.text();
      const status = response.status();
      const headers = freshHeaders(response.headers());
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        state.errors.push(`${spec.url}: the response is not JSON, so no subject can be put into it`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      const container = getAtPath(parsed, spec.container);
      if (!Array.isArray(container)) {
        const what = container === void 0 ? "not in the response" : "not an array";
        state.errors.push(`${spec.url}: "${spec.container}" is ${what}, so the descriptor assumes a shape the server does not send`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      collect(parsed, container);
      if (state.subjects === null) {
        state.hits += 1;
        await route.fulfill({ status, headers, body: text });
        return;
      }
      if (!setAtPath(parsed, spec.container, [...state.subjects])) {
        state.errors.push(`${spec.url}: "${spec.container}" could not be written back`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      state.hits += 1;
      await route.fulfill({ status, headers, body: JSON.stringify(parsed) });
    } catch (e) {
      state.errors.push(`${spec.url}: ${errorText(e)}`);
      await route.continue();
    }
  };
  await page.route(spec.url, handler);
  return {
    get hits() {
      return state.hits;
    },
    get errors() {
      return state.errors;
    },
    get corpus() {
      return state.corpus;
    },
    get bodies() {
      return state.bodies;
    },
    record() {
      state.subjects = null;
      state.hits = 0;
      state.errors = [];
    },
    use(subjects) {
      state.subjects = subjects;
      state.hits = 0;
      state.errors = [];
    },
    assertApplied() {
      if (state.errors.length > 0) throw new CaptureFailure("blocked", `the interception failed: ${state.errors.join("; ")}`);
      if (state.hits === 0) {
        throw new CaptureFailure(
          "blocked",
          `the interception never fired: no request matched ${spec.url} during this rendering, so the page shows what the server really answered. A screenshot here would carry a state that nothing delivered`
        );
      }
    },
    async dispose() {
      await page.unroute(spec.url, handler);
    }
  };
}
function rotate(subjects) {
  if (subjects.length < 2) return [...subjects];
  return [...subjects.slice(1), subjects[0]];
}
function snapshotExpression(root, ignoreAttributes = [], maxNodes = MAX_TREE_NODES) {
  return `(() => {
  const rootSelector = ${JSON.stringify(root)};
  const skip = new Set(${JSON.stringify([...ignoreAttributes])});
  const cap = ${JSON.stringify(maxNodes)};
  const start = document.querySelector(rootSelector);
  if (start === null) throw new Error('qa states: no element matches the diff root ' + rootSelector);
  let seen = 0;
  const walk = (el) => {
    seen += 1;
    if (seen > cap) throw new Error('qa states: the tree under ' + rootSelector + ' exceeds ' + cap + ' nodes');
    const attrs = [];
    for (const a of Array.from(el.attributes)) if (!skip.has(a.name)) attrs.push(a.name + '=' + a.value);
    attrs.sort();
    let own = '';
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += ' ' + (n.textContent || '');
    const text = own.replace(/\\s+/g, ' ').trim();
    return { tag: el.tagName, self: JSON.stringify([el.tagName, attrs, text]), children: Array.from(el.children).map(walk) };
  };
  return walk(start);
})()`;
}
async function snapshotTree(page, options = {}) {
  return await page.evaluate(snapshotExpression(options.root ?? DEFAULT_DIFF_ROOT, options.ignoreAttributes ?? [], options.maxNodes ?? MAX_TREE_NODES));
}
function diffNodes(a, b) {
  const out = [];
  const walk = (x, y, path) => {
    if (x.self !== y.self || x.children.length !== y.children.length) {
      out.push(path);
      return;
    }
    for (let i = 0; i < x.children.length; i += 1) walk(x.children[i], y.children[i], [...path, i]);
  };
  walk(a, b, []);
  return out;
}
function commonAncestor(paths) {
  const [first] = paths;
  if (first === void 0) return [];
  let depth = first.length;
  for (const p of paths.slice(1)) {
    let i = 0;
    while (i < depth && i < p.length && p[i] === first[i]) i += 1;
    depth = i;
  }
  return first.slice(0, depth);
}
function nodeAt(tree, path) {
  let node = tree;
  for (const i of path) {
    const next = node.children[i];
    if (next === void 0) return null;
    node = next;
  }
  return node;
}
function subtreeDigest(node) {
  return `${node.self}(${node.children.map(subtreeDigest).join(",")})`;
}
function pathSelector(root, path) {
  return [root, ...path.map((i) => `*:nth-child(${i + 1})`)].join(" > ");
}
function diffClusters(tree, diffs) {
  const byPrefix = /* @__PURE__ */ new Map();
  for (const d of diffs) {
    for (let k = 0; k < d.length; k += 1) {
      const key = d.slice(0, k).join(",");
      let entry = byPrefix.get(key);
      if (entry === void 0) {
        entry = { prefix: d.slice(0, k), children: /* @__PURE__ */ new Set(), diffs: 0 };
        byPrefix.set(key, entry);
      }
      entry.children.add(d[k]);
      entry.diffs += 1;
    }
  }
  const out = [];
  for (const entry of byPrefix.values()) {
    const children = [...entry.children].sort((x, y) => x - y);
    const tags = children.map((i) => nodeAt(tree, [...entry.prefix, i])?.tag ?? null);
    const firstTag = tags[0] ?? null;
    const tag = firstTag !== null && tags.every((t) => t === firstTag) ? firstTag : null;
    out.push({ prefix: entry.prefix, children, diffs: entry.diffs, tag });
  }
  out.sort((x, y) => y.prefix.length - x.prefix.length || y.diffs - x.diffs);
  return out;
}
function locateSubjects(a, b, count) {
  const diffs = diffNodes(a, b);
  if (diffs.length === 0) {
    throw new CaptureFailure("identical", "the two renderings are identical: no element differs. Either these states render the same, which is the finding, or the subjects never reached the page");
  }
  if (diffs.some((d) => d.length === 0)) {
    throw new CaptureFailure("crashed", "the diff root itself differs between the two renderings, so the subject was not isolated");
  }
  const clusters = diffClusters(a, diffs).filter((c) => c.tag !== null);
  const exact = clusters.filter((c) => c.children.length === count);
  const [best, second] = exact;
  if (best && second && best.prefix.length === second.prefix.length && best.diffs === second.diffs) {
    throw new CaptureFailure(
      "crashed",
      `two elements each hold ${count} differing children of one tag (${pathSelector("root", best.prefix)} and ${pathSelector("root", second.prefix)}), so which one draws the subjects is a guess. The renderings differ in more than the state`
    );
  }
  if (!best) throw noContainer(a, clusters, diffs, count);
  return { ancestor: best.prefix, paths: best.children.map((slot) => [...best.prefix, slot]) };
}
function noContainer(tree, clusters, diffs, count) {
  const best = [...clusters].sort((x, y) => y.children.length - x.children.length || y.prefix.length - x.prefix.length)[0];
  const span = pathSelector("root", commonAncestor(diffs));
  if (best === void 0) {
    return new CaptureFailure(
      "identical",
      `the ${diffs.length} difference(s) sit under ${span} and no element holds ${count} differing children of one tag, so the ${count} subjects are not told apart. Something other than the subjects changed between the renderings`
    );
  }
  const container = nodeAt(tree, best.prefix);
  const collapsed = [];
  if (best.children.length < count && container !== null && container.children.length === count) {
    for (let slot = 0; slot < count; slot += 1) if (!best.children.includes(slot)) collapsed.push(`${slot} and ${(slot + 1) % count}`);
  }
  return new CaptureFailure(
    "identical",
    `${pathSelector("root", best.prefix)} holds ${best.children.length} differing <${best.tag}> child(ren) for ${count} subjects (${diffs.length} difference(s), spanning ${span}). ` + (collapsed.length > 0 ? `Subjects ${collapsed.join(", and ")} render an identical element, which is the finding` : "Either two consecutive members render identically, which is the finding, or something other than the subjects changed")
  );
}
function identicalRenderings(nodes) {
  const digests = nodes.map(subtreeDigest);
  const pairs = [];
  for (let i = 0; i < digests.length; i += 1) for (let j = i + 1; j < digests.length; j += 1) if (digests[i] === digests[j]) pairs.push([i, j]);
  return pairs;
}
async function assertSubjectIsolated(subject, root, maxRatio) {
  const [box, rootBox] = await Promise.all([subject.boundingBox(), root.boundingBox()]);
  if (box === null || box.width === 0 || box.height === 0) {
    throw new CaptureFailure("crashed", "the located subject has no box on screen, so there is nothing to photograph");
  }
  if (rootBox === null || rootBox.width === 0 || rootBox.height === 0) return;
  const ratio = box.width * box.height / (rootBox.width * rootBox.height);
  if (ratio > maxRatio) {
    throw new CaptureFailure(
      "crashed",
      `the located subject covers ${(ratio * 100).toFixed(0)}% of the diff root, over the ${(maxRatio * 100).toFixed(0)}% bound: the diff is the whole page`
    );
  }
}
function moduleUrl(projectRoot, relativePath) {
  return `/@fs${posix.join(projectRoot.split("\\").join("/"), relativePath)}`;
}
function evaluateBatchExpression(moduleHref, exportName, items, extra = []) {
  return `(async () => {
  const href = ${JSON.stringify(moduleHref)};
  const name = ${JSON.stringify(exportName)};
  const mod = await import(/* @vite-ignore */ href);
  const fn = mod[name];
  if (typeof fn !== 'function') throw new Error('qa states: ' + href + ' exports no function named ' + name);
  const items = ${JSON.stringify(items)};
  const extra = ${JSON.stringify(extra)};
  const out = [];
  for (const item of items) {
    try {
      const answer = await fn(item, ...extra);
      out.push({ state: answer === null || answer === undefined ? null : String(answer), error: null });
    } catch (e) {
      out.push({ state: null, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
})()`;
}
async function evaluateBatch(page, projectRoot, spec, batch) {
  const answers = await page.evaluate(evaluateBatchExpression(moduleUrl(projectRoot, spec.module), spec.export, batch, spec.args ?? []));
  if (!Array.isArray(answers) || answers.length !== batch.length) {
    throw new CaptureFailure("crashed", `${spec.export}: the page answered ${Array.isArray(answers) ? answers.length : typeof answers} result(s) for ${batch.length} candidate(s)`);
  }
  return answers;
}
async function verifyInPage(page, projectRoot, spec, subject) {
  const [answer] = await evaluateBatch(page, projectRoot, spec, [subject]);
  if (!answer || answer.error !== null) throw new CaptureFailure("crashed", `${spec.export} threw on the injected subject: ${answer?.error ?? "no answer"}`);
  return answer.state ?? "null";
}
async function solveWithPage(page, projectRoot, args) {
  const { verify, shape, members = null, union, limit, pivots } = args;
  const corpus = [...args.corpus];
  const batchSize = args.batchSize ?? DEFAULT_EVALUATE_BATCH;
  const options = { ...limit === void 0 ? {} : { limit }, ...pivots === void 0 ? {} : { pivots } };
  const plan = candidatePlan(shape, corpus, options);
  const memo = /* @__PURE__ */ new Map();
  let batches = 0;
  for (let i = 0; i < plan.length; i += batchSize) {
    const slice = plan.slice(i, i + batchSize);
    const answers = await evaluateBatch(page, projectRoot, verify, slice.map((step) => step.candidate));
    batches += 1;
    for (const [j, answer] of answers.entries()) {
      const step = slice[j];
      if (!step) continue;
      if (answer.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on a candidate its type admits (${step.text}): ${answer.error}`);
      memo.set(canonical(step.candidate), answer.state);
    }
  }
  let memoMisses = 0;
  const result = await solve({
    shape,
    corpus,
    members,
    ...union === void 0 ? {} : { union },
    ...options,
    evaluate: async (candidate) => {
      const key = canonical(candidate);
      if (memo.has(key)) return memo.get(key) ?? null;
      memoMisses += 1;
      const [answer] = await evaluateBatch(page, projectRoot, verify, [candidate]);
      if (!answer || answer.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on a candidate: ${answer?.error ?? "no answer"}`);
      memo.set(key, answer.state);
      return answer.state;
    }
  });
  return { result, evaluated: plan.length, batches, memoMisses };
}
function parameterNamesExpression(moduleHref, exportName) {
  return `(async () => {
  const mod = await import(/* @vite-ignore */ ${JSON.stringify(moduleHref)});
  const fn = mod[${JSON.stringify(exportName)}];
  if (typeof fn !== 'function') return [];
  const src = Function.prototype.toString.call(fn);
  const open = src.indexOf('(');
  if (open < 0) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') { depth -= 1; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) return [];
  return src.slice(open + 1, close).split(',').map((p) => p.trim()).map((p) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p) ? p : ''));
})()`;
}
function exportedNumberExpression(moduleHref, name) {
  return `(async () => {
  let mod;
  try { mod = await import(/* @vite-ignore */ ${JSON.stringify(moduleHref)}); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  const found = mod[${JSON.stringify(name)}];
  return { value: typeof found === 'number' && Number.isFinite(found) ? found : null };
})()`;
}
function numbersUnderKey(body, key) {
  const found = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isPlainObject(node)) return;
    for (const [k, v] of Object.entries(node)) {
      if (k === key && typeof v === "number" && Number.isFinite(v) && !found.includes(v)) found.push(v);
      visit(v);
    }
  };
  visit(body);
  return found;
}
async function resolvePivots(page, projectRoot, hints, options = {}) {
  const resolved = {};
  const unresolved = {};
  const declaredArgs = options.verify?.args ?? [];
  const modules = [.../* @__PURE__ */ new Set([...options.verify ? [options.verify.module] : [], ...options.modules ?? []])];
  const bodies = options.bodies ?? [];
  const params = options.verify !== void 0 && hints.names.length > 0 ? await page.evaluate(parameterNamesExpression(moduleUrl(projectRoot, options.verify.module), options.verify.export)) : [];
  for (const name of hints.names) {
    const at = params.indexOf(name);
    const fromArg = at > 0 ? declaredArgs[at - 1] : void 0;
    if (typeof fromArg === "number" && Number.isFinite(fromArg)) {
      resolved[name] = fromArg;
      continue;
    }
    let fromModule = null;
    const importErrors = [];
    for (const rel of modules) {
      const answer = await page.evaluate(exportedNumberExpression(moduleUrl(projectRoot, rel), name));
      if (answer.error !== void 0) importErrors.push(`${rel}: ${answer.error}`);
      if (typeof answer.value === "number") {
        fromModule = answer.value;
        break;
      }
    }
    if (fromModule !== null) {
      resolved[name] = fromModule;
      continue;
    }
    const seen = [];
    for (const body of bodies) for (const n of numbersUnderKey(body, name)) if (!seen.includes(n)) seen.push(n);
    if (seen.length === 1) {
      resolved[name] = seen[0];
      continue;
    }
    unresolved[name] = seen.length > 1 ? `"${name}" is ${seen.join(", ")} in the captured responses, and choosing one would be a guess` : `"${name}" is no argument of ${options.verify?.export ?? "(no function)"}(${params.join(", ")}), no exported number of ${modules.join(" or ") || "(no module)"}, and under no key of that name in ${bodies.length} captured response(s)` + (importErrors.length > 0 ? `. Import failures: ${importErrors.join("; ")}` : "");
  }
  const pivots = [.../* @__PURE__ */ new Set([...hints.literals, ...Object.values(resolved)])].filter(Number.isFinite);
  return { pivots, resolved, unresolved };
}
async function solveGroupSubjects(page, projectRoot, group, corpus, bodies) {
  if (group.solve === void 0) throw new CaptureFailure("blocked", `${group.id}: the group has no solve block`);
  const { verify } = group;
  const pivots = await resolvePivots(page, projectRoot, group.solve.pivots ?? { literals: [], names: [] }, {
    verify,
    ...group.solve.pivotModules ? { modules: group.solve.pivotModules } : {},
    bodies
  });
  const members = group.members.map((m) => m.member ?? "null");
  const report = await solveWithPage(page, projectRoot, {
    verify,
    shape: group.solve.shape,
    corpus,
    members,
    union: group.union,
    ...group.solve.limit === void 0 ? {} : { limit: group.solve.limit },
    pivots: pivots.pivots,
    ...group.solve.batchSize === void 0 ? {} : { batchSize: group.solve.batchSize }
  });
  const base = corpus[0];
  if (base === void 0) throw new CaptureFailure("unreachable", `${group.union}: the corpus is empty`, { fieldsTried: Object.keys(group.solve.shape.fields) });
  const anchor = await anchorSubjects({
    shape: group.solve.shape,
    base,
    covered: report.result.covered,
    members,
    evaluate: async (candidate) => {
      const [answer] = await evaluateBatch(page, projectRoot, verify, [candidate]);
      if (!answer || answer.error !== null) throw new CaptureFailure("crashed", `${verify.export} threw on an anchored candidate: ${answer?.error ?? "no answer"}`);
      return answer.state;
    }
  });
  const unresolvedNames = Object.values(pivots.unresolved);
  const subjectFor = [];
  const unreachable = /* @__PURE__ */ new Map();
  for (const [i, name] of members.entries()) {
    const hit = report.result.covered[name];
    if (hit === void 0) {
      subjectFor.push(null);
      const why = report.result.sentence ?? `${group.union}: ${name} was not produced by any candidate`;
      unreachable.set(i, unresolvedNames.length > 0 ? `${why} Unresolved pivot: ${unresolvedNames.join("; ")}` : why);
      continue;
    }
    subjectFor.push(anchor.subjects[name] ?? hit.candidate);
  }
  return {
    subjectFor,
    unreachable,
    fieldsTried: Object.keys(group.solve.shape.fields),
    fieldsUnderTest: anchor.fields,
    anchor: { fields: anchor.fields, loose: anchor.loose, notes: anchor.notes, evaluations: anchor.evaluations },
    pivots,
    report
  };
}
async function renderOnce(session, group, substitution, subjects) {
  if (subjects === null) substitution.record();
  else substitution.use(subjects);
  await session.navigate(openRoute(group.route) ?? group.route);
  for (const step of group.act ?? []) await session.act(step);
  await session.settle(group.settle);
  const held = await session.currentRoute();
  if (!routeMatches(group.route, held)) {
    throw new CaptureFailure("blocked", `the page left ${group.route} for ${held}, so a picture would be of another screen`);
  }
  substitution.assertApplied();
}
async function prepare(session, page, group, ctx) {
  const diffRoot = group.diffRoot ?? DEFAULT_DIFF_ROOT;
  const snapshotOptions = { root: diffRoot, ignoreAttributes: group.ignoreAttributes ?? [] };
  const notes = [];
  const substitution = await installSubstitution(page, group.intercept);
  try {
    let subjectFor;
    let unreachable = /* @__PURE__ */ new Map();
    let fieldsTried = [];
    if (group.solve === void 0) {
      subjectFor = group.members.map((m) => isPlainObject(m.subject) ? m.subject : null);
    } else {
      await renderOnce(session, group, substitution, null);
      const solved = await solveGroupSubjects(page, ctx.projectRoot, group, substitution.corpus, substitution.bodies);
      subjectFor = solved.subjectFor;
      unreachable = solved.unreachable;
      fieldsTried = solved.fieldsTried;
      notes.push(
        `corpus ${substitution.corpus.length} real ${group.solve.shape.type} row(s); ${solved.report.evaluated} candidates in ${solved.report.batches} evaluate(s), ${solved.report.memoMisses} memo miss(es); pivots ${JSON.stringify(solved.pivots.pivots)}`
      );
      for (const why of Object.values(solved.pivots.unresolved)) notes.push(`unresolved pivot: ${why}`);
      notes.push(...solved.anchor.notes);
    }
    const slots = [];
    const subjects = [];
    for (const [i, subject] of subjectFor.entries()) {
      if (subject === null) continue;
      slots.push(i);
      subjects.push(subject);
    }
    if (subjects.length === 0) {
      throw new CaptureFailure("unreachable", `no member of ${group.union} has a subject to render: ${[...unreachable.values()].join("; ")}`, { fieldsTried });
    }
    if (subjects.length === 1 && group.contrast === void 0) {
      throw new CaptureFailure("blocked", `only one member of ${group.union} has a subject, and the group has no contrast, so there is no second rendering to diff against`);
    }
    const contrast = subjects.length === 1 ? [group.contrast] : rotate(subjects);
    await renderOnce(session, group, substitution, contrast);
    const before = await snapshotTree(page, snapshotOptions);
    await renderOnce(session, group, substitution, subjects);
    const tree = await snapshotTree(page, snapshotOptions);
    const { paths } = locateSubjects(tree, before, subjects.length);
    return { tree, paths, diffRoot, slots, subjectFor, unreachable, fieldsTried, notes };
  } finally {
    await substitution.dispose();
  }
}
function blankResult(group, index) {
  const member = group.members[index];
  return {
    id: member?.id ?? `${group.union}.${index}`,
    union: group.union,
    member: member?.member ?? null,
    ok: false,
    subject: null,
    context: null,
    provenance: "intercepted",
    verified: null,
    answered: null,
    error: null,
    ms: 0
  };
}
async function captureGroup(session, page, group, ctx) {
  const started = ctx.now();
  let prepared;
  try {
    prepared = await prepare(session, page, group, ctx);
  } catch (e) {
    const fields = failureFields(e);
    const ms = ctx.now() - started;
    return { results: group.members.map((_, i) => ({ ...blankResult(group, i), error: errorText(e), ...fields, ms })), notes: [] };
  }
  const { tree, paths, diffRoot, slots, subjectFor, unreachable, fieldsTried, notes } = prepared;
  const nodes = paths.map((p) => nodeAt(tree, p)).filter((n) => n !== null);
  const twins = /* @__PURE__ */ new Map();
  if (nodes.length === paths.length) {
    for (const [a, b] of identicalRenderings(nodes)) {
      const first = group.members[slots[a]];
      const second = group.members[slots[b]];
      if (!first || !second) continue;
      const why = `${first.id} and ${second.id} render an identical subtree`;
      twins.set(slots[a], { why, sameAs: second.id });
      twins.set(slots[b], { why, sameAs: first.id });
    }
  }
  const root = page.locator(diffRoot).first();
  const maxRatio = group.maxSubjectAreaRatio ?? DEFAULT_MAX_SUBJECT_AREA_RATIO;
  const results = [];
  for (const [i, member] of group.members.entries()) {
    const at = ctx.now();
    const result = blankResult(group, i);
    try {
      const missing = unreachable.get(i);
      if (missing !== void 0) throw new CaptureFailure("unreachable", missing, { fieldsTried });
      const twin = twins.get(i);
      if (twin !== void 0) throw new CaptureFailure("identical", twin.why, { sameAs: twin.sameAs });
      const slot = slots.indexOf(i);
      const path = paths[slot];
      if (slot < 0 || path === void 0) throw new CaptureFailure("blocked", "this member was never rendered, so there is nothing to photograph");
      const answered = await verifyInPage(page, ctx.projectRoot, group.verify, subjectFor[i]);
      const expected = member.expect === void 0 ? member.member ?? "null" : member.expect ?? "null";
      result.answered = answered;
      result.verified = answered === expected;
      if (!result.verified) {
        throw new CaptureFailure(
          "state-mismatch",
          `${group.verify.export} answered "${answered}" for this subject, and the plan asked for "${expected}"`,
          { intended: expected, actual: answered }
        );
      }
      const subject = page.locator(pathSelector(diffRoot, path)).first();
      await assertSubjectIsolated(subject, root, maxRatio);
      await subject.scrollIntoViewIfNeeded();
      const context = statePath(ctx.slug, member.id, "context");
      const subjectFile = statePath(ctx.slug, member.id, "subject");
      await session.screenshot(posix.join(ctx.reportDir, context));
      await subject.screenshot({ path: posix.join(ctx.reportDir, subjectFile) });
      await ctx.record({ file: posix.join(ctx.reportDir, context), kind: "screenshot", row: member.id });
      await ctx.record({ file: posix.join(ctx.reportDir, subjectFile), kind: "screenshot", row: member.id });
      result.subject = subjectFile;
      result.context = context;
      result.expect = `${group.verify.export} answers ${expected}`;
      result.ok = true;
    } catch (e) {
      result.error = errorText(e);
      Object.assign(result, failureFields(e));
    }
    result.ms = ctx.now() - at;
    results.push(result);
  }
  return { results, notes };
}

// src/states/services/mount.mts
import { posix as posix2 } from "path";
var STATES_HARNESS_PATH = QA_STATES_PATH;
var HARNESS_ATTRIBUTE = QA_STATES_ATTRIBUTE;
var SUBJECT_CHILD = "[data-qa-subject] > *";
var HARNESS_ERROR = "[data-qa-states-error]";
var DEFAULT_MOUNT_SETTLE = { selector: SUBJECT_CHILD, timeout: 1e4 };
function mountUrl(options) {
  const query = new URLSearchParams({ c: options.component, props: JSON.stringify(options.props ?? {}) });
  if (options.width !== null && options.width !== void 0) query.set("w", String(options.width));
  return `${STATES_HARNESS_PATH}?${query.toString()}`;
}
var memberKey = (member) => member === null ? "null" : member;
function siteFor(union, hints) {
  if (typeof hints.component === "string") return union.inputs.find((s) => s.component === hints.component) ?? union.inputs[0] ?? null;
  return union.inputs.find((s) => s.component !== null) ?? union.inputs[0] ?? null;
}
function resolveMount(inventory, capture, defaultLeg) {
  const union = inventory.unions.find((u) => u.name === capture.union);
  const hints = union?.mount ?? {};
  const base = {
    capture,
    leg: hints.leg ?? defaultLeg,
    component: null,
    field: null,
    props: {},
    width: hints.width ?? null,
    settle: hints.settle ?? DEFAULT_MOUNT_SETTLE,
    persona: hints.fixture?.persona ?? null,
    refusal: null
  };
  const refuse = (refusal) => ({ ...base, refusal });
  if (union === void 0) return refuse(new CaptureFailure("blocked", `the inventory has no union named ${capture.union}`));
  if (union.kind !== "input" && union.kind !== "both") {
    return refuse(new CaptureFailure("blocked", `${union.name} is "${union.kind}", and a mount reaches an input`));
  }
  const site = siteFor(union, hints);
  if (site === null) return refuse(new CaptureFailure("blocked", `${union.name} says it is an input and the scan found no field that holds it`));
  const component = hints.component ?? site.component;
  if (component === null) {
    const where = union.inputs.map((s) => `${s.interface}.${s.field} (${s.file})`).join(", ");
    return refuse(
      new CaptureFailure(
        "unmountable",
        `no component takes ${union.name}: it is a field of ${where}, and none of those is the props type of a component. Give the component that branches on it a prop of type ${union.name}`,
        { missingProp: `${site.interface}.${site.field} (no component takes this union)` }
      )
    );
  }
  if (capture.member === null) {
    return refuse(
      new CaptureFailure("unmountable", `${union.name} asks for the rendering of an absent ${site.field}, and the harness always sets it. The null rendering belongs to the solver`, {
        missingProp: `${site.field} (cannot be made absent through the harness)`
      })
    );
  }
  const props = { ...hints.props, ...hints.members?.[memberKey(capture.member)], [site.field]: capture.member };
  return { ...base, component, field: site.field, props };
}
function harnessStateExpression() {
  return `(() => {
  const harness = document.querySelector(${JSON.stringify(`[${HARNESS_ATTRIBUTE}]`)}) !== null;
  const panel = document.querySelector(${JSON.stringify(HARNESS_ERROR)});
  const reason = panel === null ? null : panel.querySelector('p') || panel;
  const error = reason === null ? null : (reason.textContent || '').replace(/\\s+/g, ' ').trim();
  const roots = document.querySelectorAll(${JSON.stringify(SUBJECT_CHILD)}).length;
  return { harness, error, roots };
})()`;
}
var condense = (reason) => reason.length <= 120 ? reason : `${reason.slice(0, 117)}...`;
async function harnessState(session) {
  if (!session.evaluate) return null;
  return await session.evaluate(harnessStateExpression());
}
function expectation(r) {
  const extra = Object.keys(r.props).filter((key) => key !== r.field);
  return `${r.component} drawn with ${r.field}="${r.capture.member}"${extra.length === 0 ? "" : ` (plus ${extra.join(", ")})`}`;
}
async function captureMounted(session, r, ctx) {
  const started = ctx.now();
  const result = {
    id: r.capture.id,
    union: r.capture.union,
    member: r.capture.member,
    ok: false,
    subject: null,
    context: null,
    provenance: "mounted",
    // No feature function runs under a mount. Null is "not checked", never "it agreed".
    verified: null,
    error: null,
    ms: 0,
    ...r.component === null ? {} : { component: r.component }
  };
  try {
    if (r.refusal !== null) throw r.refusal;
    if (!session.evaluate) {
      throw new CaptureFailure("blocked", "the target cannot evaluate in the page, so it cannot prove that the page is the state harness");
    }
    const url = mountUrl({ component: r.component, props: r.props, width: r.width });
    await session.navigate(url);
    try {
      await session.settle(r.settle);
    } catch (e) {
      const late = await harnessState(session);
      if (late?.error) throw new CaptureFailure("unmountable", `${r.component} did not mount: ${late.error}`, { missingProp: condense(late.error) }, e);
      if (late && !late.harness) throw new CaptureFailure("blocked", `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`, {}, e);
      throw e;
    }
    const state = await harnessState(session);
    if (!state?.harness) {
      throw new CaptureFailure("blocked", `${url} drew no state harness: no element carries ${HARNESS_ATTRIBUTE}. The harness is on the client dev server only`);
    }
    if (state.error) throw new CaptureFailure("unmountable", `the harness refused ${url}: ${state.error}`, { missingProp: condense(state.error) });
    if (state.roots === 0) throw new CaptureFailure("crashed", `${r.component} mounted and drew no element`);
    const held = await session.currentRoute();
    if (!held.startsWith(STATES_HARNESS_PATH)) throw new CaptureFailure("blocked", `the page left the harness for ${held}`);
    const subject = statePath(ctx.slug, r.capture.id, "subject");
    await session.screenshot(posix2.join(ctx.reportDir, subject));
    await ctx.record({ file: posix2.join(ctx.reportDir, subject), kind: "screenshot", row: r.capture.id });
    result.subject = subject;
    result.expect = expectation(r);
    result.ok = true;
  } catch (e) {
    result.error = errorText(e);
    Object.assign(result, failureFields(e));
  }
  result.ms = ctx.now() - started;
  return result;
}

export {
  MAX_DEPTH,
  MAX_EDGES_PER_NODE,
  targetsFrom,
  crossReach,
  routeDrift,
  videoPath,
  stamp,
  buildCrawlPlan,
  targetResults,
  crawl,
  recordPath,
  CaptureFailure,
  installSubstitution,
  locateSubjects,
  captureGroup,
  STATES_HARNESS_PATH,
  mountUrl,
  resolveMount,
  captureMounted
};
//# sourceMappingURL=chunk-B3YQ27NA.js.map