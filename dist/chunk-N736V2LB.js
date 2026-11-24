import {
  isLoopbackHost
} from "./chunk-YKX37RJG.js";
import {
  STATES_HARNESS_PATH
} from "./chunk-FA2UE7YP.js";
import {
  QA_TARGET_SPEC_VERSION,
  createFakeTarget
} from "./chunk-APRIQSSG.js";
import {
  MIN_VIDEO_S,
  attemptFailures,
  measureVideo,
  pngSize
} from "./chunk-OF544TQR.js";
import {
  appendLedger,
  appendResult,
  dropRowLeg,
  ledgerEntry,
  reportPaths
} from "./chunk-3OHR7PBT.js";
import {
  evidencePath,
  expectedPageErrors,
  legDefinitions,
  loadManifest
} from "./chunk-TQCRYULZ.js";
import {
  systemClock
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/services/runner.mts
import { mkdirSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import { basename, dirname, join } from "path";
function routeProvenance(route) {
  const path = route.split(/[?#]/)[0] ?? "";
  return path === STATES_HARNESS_PATH || path.startsWith(`${STATES_HARNESS_PATH}/`) ? "mounted" : "live";
}
var FORK_CONCURRENCY = 2;
function forkView(baseUrls, apiPort, forkUrl, label) {
  const view = { baseUrls: {}, blocked: {} };
  for (const [surface, url] of Object.entries(baseUrls)) {
    const parsed = new URL(url);
    if (isLoopbackHost(parsed.hostname) && Number(parsed.port) === apiPort) {
      view.baseUrls[surface] = `${forkUrl}${parsed.pathname.replace(/\/+$/, "")}`;
    } else {
      view.blocked[surface] = `the ${surface} base URL ${url} is not the QA API on port ${apiPort}, so its client reads the shared QA database and cannot show fork ${label}. Serve the ${surface} surface from the QA app (qa.baseUrls.${surface} = http://127.0.0.1:${apiPort}), or run the row without a fork`;
    }
  }
  return view;
}
var BROWSER_TARGETS = /* @__PURE__ */ new Set(["playwright", "fake"]);
function planSlug(manifestPath) {
  const name = basename(manifestPath);
  if (!name.endsWith(".shots.json")) {
    throw new LaunchwrightError("qa.session.plan", `${manifestPath}: a plan is <reportDir>/<slug>.shots.json`, { context: { path: manifestPath } });
  }
  return name.slice(0, -".shots.json".length);
}
var UNFILLED = /\{([A-Za-z0-9_]+)\}/;
var PAGE_TEXT = 'document.body ? document.body.innerText : ""';
function narrow(manifest, legNames, opts) {
  for (const leg of opts.legs ?? []) {
    if (!legNames.has(leg)) throw new LaunchwrightError("qa.session.legs", `--legs ${leg} is not a leg. Legs: ${[...legNames].join(" ")}`, { context: { leg } });
  }
  const ids = new Set(manifest.shots.map((s) => s.id));
  for (const id of opts.only ?? []) {
    if (!ids.has(id)) throw new LaunchwrightError("qa.session.only", `--only ${id} is not a row of ${opts.manifestPath}`, { context: { id } });
  }
  const plan = manifest.shots.filter((s) => !opts.only || opts.only.includes(s.id)).map((shot) => ({ shot, legs: opts.legs ? shot.legs.filter((l) => opts.legs?.includes(l)) : [...shot.legs] })).filter((p) => p.legs.length > 0);
  if (plan.length === 0) throw new LaunchwrightError("qa.session.empty", "--legs and --only leave no row on any leg", {});
  return plan;
}
function forkLabel(shot) {
  const label = shot.fork;
  return typeof label === "string" && label.trim() !== "" ? label : void 0;
}
function once(fn) {
  let running = null;
  return () => {
    running ??= fn();
    return running;
  };
}
var Run = class {
  constructor(deps, manifestPath) {
    this.deps = deps;
    this.reportDir = dirname(manifestPath);
    this.slug = planSlug(manifestPath);
    this.paths = reportPaths(this.reportDir, this.slug);
  }
  deps;
  reportDir;
  slug;
  paths;
  ready = /* @__PURE__ */ new Map();
  /** The ledger and `results.jsonl` writes, one at a time: fork groups run rows at the same time. */
  writes = Promise.resolve();
  get slugName() {
    return this.slug;
  }
  serial(fn) {
    const next = this.writes.then(fn, fn);
    this.writes = next.then(
      () => void 0,
      () => void 0
    );
    return next;
  }
  /** Appends one row result to `results.jsonl`. */
  record(result) {
    return this.serial(() => appendResult(this.paths.results, result));
  }
  /** The leg as a result before any session: `n/a` or `not-run` with the reason, or null to run it. */
  async gate(shot, leg, target, needs, view) {
    if (!target) return { status: "n/a", reason: "no target" };
    const missing = needs.filter((cap) => !target.capabilities.has(cap));
    if (missing.length > 0) return { status: "n/a", reason: `the ${target.name} target has no ${missing.join(", ")} capability` };
    const unfilled = UNFILLED.exec(shot.route);
    if (unfilled) return { status: "not-run", reason: `the route ${shot.route} has an unfilled handle {${unfilled[1]}}. Run lw qa world reset, then plan the sweep again` };
    const blocked = view.blocked[leg.surface];
    if (blocked !== void 0) return { status: "not-run", reason: blocked };
    if (view.baseUrls[leg.surface] === void 0) {
      return { status: "not-run", reason: `no base URL for the ${leg.surface} surface. Pass --base ${leg.surface}=<url> or set qa.baseUrls.${leg.surface}` };
    }
    let readiness = this.ready.get(leg.name);
    if (!readiness) {
      readiness = await target.ready(leg);
      this.ready.set(leg.name, readiness);
    }
    if (!readiness.ready) return { status: "not-run", reason: `the ${target.name} target is not ready: ${readiness.reason ?? "no reason given"}` };
    return null;
  }
  async row(shot, leg, target, view) {
    const started = this.deps.clock.now();
    const needs = ["screenshot", ...shot.act && shot.act.length > 0 ? ["input"] : []];
    const gated = await this.gate(shot, leg, target, needs, view);
    if (gated || !target) return { row: shot.id, leg: leg.name, failures: [], attempts: 0, ms: 0, status: gated?.status ?? "n/a", reason: gated?.reason ?? "no target" };
    const device = !BROWSER_TARGETS.has(target.name);
    const wantsVideo = device || shot.video === true || (shot.act?.length ?? 0) > 0;
    const video = wantsVideo && target.capabilities.has("video");
    const limit = device ? this.deps.config.evidence.attempts : 1;
    let last = { failures: [], notes: [], entries: [] };
    let attempts = 0;
    await this.serial(() => dropRowLeg(this.reportDir, this.slug, shot.id, leg.name));
    const baseUrl = view.baseUrls[leg.surface];
    while (attempts < limit) {
      attempts += 1;
      last = await this.attempt(shot, leg, target, { attempt: attempts, video, device, baseUrl });
      const entries = last.entries;
      await this.serial(() => appendLedger(this.reportDir, this.slug, entries));
      if (last.failures.length === 0) break;
    }
    const notes = [...last.notes];
    if (wantsVideo && !video) notes.unshift(`video n/a: the ${target.name} target has no video capability`);
    return {
      row: shot.id,
      leg: leg.name,
      status: last.failures.length === 0 ? "passed" : "failed",
      ...notes.length > 0 ? { reason: notes.join("; ") } : {},
      failures: last.failures,
      attempts,
      ms: this.deps.clock.now() - started
    };
  }
  rel(leg, row, kind, opts) {
    return evidencePath(this.slug, leg, row, kind, opts);
  }
  async attempt(shot, leg, target, opts) {
    const { attempt } = opts;
    const files = [];
    const pngs = [];
    const notes = [];
    const failures = /* @__PURE__ */ new Set();
    const now = () => this.deps.clock.date().toISOString();
    const abs = (rel) => join(this.reportDir, rel);
    const videoExt = opts.device ? "mp4" : "webm";
    let session = null;
    let recording = false;
    let videoPath = null;
    let pageText = null;
    let landed = null;
    let logs = [];
    try {
      session = await target.open({
        leg,
        baseUrl: opts.baseUrl,
        outDir: this.paths.assets,
        ...shot.fixture.persona ? { persona: shot.fixture.persona } : {}
      });
      if (opts.video) {
        const rel = this.rel(leg.name, shot.id, "video", { attempt, videoExt });
        await session.startVideo(abs(rel));
        recording = true;
        videoPath = rel;
      }
      await session.navigate(shot.route);
      await session.settle(shot.settle);
      if (session.evaluate) pageText = String(await session.evaluate(PAGE_TEXT));
      landed = await session.currentRoute();
      const shotRel = this.rel(leg.name, shot.id, "screenshot", { attempt });
      await session.screenshot(abs(shotRel));
      files.push({ rel: shotRel, kind: "screenshot", at: now() });
      pngs.push(shotRel);
      for (const [i, step] of (shot.act ?? []).entries()) {
        await session.act(step);
        const stepRel = this.rel(leg.name, shot.id, "step", { attempt, step: i + 1 });
        await session.screenshot(abs(stepRel));
        files.push({ rel: stepRel, kind: "step", at: now() });
        pngs.push(stepRel);
      }
    } catch (err) {
      const code = isCodedError(err) ? err.code : "";
      failures.add(code === "qa.target.settle" || code === "qa.target.act" ? "expect" : "crashed");
      notes.push(failureText(err));
    }
    if (session) {
      try {
        if (recording && videoPath) {
          recording = false;
          await session.stopVideo();
          files.push({ rel: videoPath, kind: "video", at: now() });
        }
        const read = await session.logs().then(
          (lines) => ({ lines }),
          (err) => {
            if (isCodedError(err) && err.code === "qa.target.capability") return { na: failureText(err) };
            throw err;
          }
        );
        if ("na" in read) notes.push(`log n/a: ${read.na}`);
        else {
          logs = read.lines;
          const logRel = this.rel(leg.name, shot.id, "log", { attempt });
          mkdirSync(dirname(abs(logRel)), { recursive: true });
          writeFileSync(abs(logRel), logs.map((l) => JSON.stringify(l)).join("\n") + (logs.length > 0 ? "\n" : ""));
          files.push({ rel: logRel, kind: "log", at: now() });
        }
        const traceRel = this.rel(leg.name, shot.id, "trace", { attempt });
        if (await session.trace(abs(traceRel)) !== null) files.push({ rel: traceRel, kind: "trace", at: now() });
        const uiRel = this.rel(leg.name, shot.id, "ui", { attempt });
        if (await session.dump(abs(uiRel)) !== null) files.push({ rel: uiRel, kind: "ui", at: now() });
      } catch (err) {
        failures.add("crashed");
        notes.push(`collecting the evidence failed: ${failureText(err)}`);
      } finally {
        await session.close();
      }
    }
    const screenshots = await Promise.all(pngs.map((rel) => readFile(abs(rel))));
    const videos = [];
    if (videoPath && files.some((f) => f.rel === videoPath)) {
      try {
        videos.push(await this.measure(abs(videoPath)));
      } catch (err) {
        failures.add("blank-video");
        notes.push(`the video cannot be measured: ${failureText(err)}`);
      }
    }
    const checked = attemptFailures(
      {
        screenshots,
        ...pageText !== null ? { page: { text: pageText, bootFailureSentences: this.deps.bootFailureSentences ?? [] } } : {},
        ...landed !== null ? { route: { requested: shot.route, landedPath: landed } } : {},
        logs,
        expectedPageErrors: expectedPageErrors(shot),
        videos
      },
      this.deps.config.evidence
    );
    for (const f of checked) failures.add(f);
    if (failures.has("route-drift") && landed !== null) notes.push(`the session left ${shot.route} for ${landed}`);
    const entries = await Promise.all(
      files.map(
        (f) => ledgerEntry(this.reportDir, {
          path: f.rel,
          kind: f.kind,
          capturedAt: f.at,
          commit: this.deps.revision.commit,
          dirty: this.deps.revision.dirty,
          leg: leg.name,
          target: target.name,
          ...leg.device ? { device: leg.device } : {},
          provenance: routeProvenance(shot.route),
          row: shot.id,
          attempt
        })
      )
    );
    const order = ["blank", "not-booted", "route-drift", "blank-video", "over-budget", "page-error", "expect", "crashed"];
    return { failures: order.filter((f) => failures.has(f)), notes, entries };
  }
  measure(path) {
    if (this.deps.measure) return this.deps.measure(path);
    if (!this.deps.videoTools) throw new LaunchwrightError("qa.session.video", "The runner has no video tools to measure a video.");
    return measureVideo(path, this.deps.videoTools);
  }
};
function failureText(err) {
  if (isCodedError(err)) return `${err.code}: ${err.message}`;
  return messageOf(err);
}
function armList(plan) {
  const seen = /* @__PURE__ */ new Map();
  for (const { shot } of plan) {
    for (const state of shot.fixture.arm) {
      const persona = shot.fixture.persona;
      seen.set(`${state}\0${persona ?? ""}`, { state, ...persona ? { persona } : {} });
    }
  }
  return [...seen.values()];
}
function forkGroups(plan) {
  const shared = [];
  const groups = /* @__PURE__ */ new Map();
  for (const item of plan) {
    const label = forkLabel(item.shot);
    if (label === void 0) shared.push(item);
    else {
      const group = groups.get(label);
      if (group) group.push(item);
      else groups.set(label, [item]);
    }
  }
  return { shared, groups };
}
async function pool(items, limit, fn) {
  const errors = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      try {
        await fn(item);
      } catch (err) {
        errors.push(err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return errors;
}
function oneError(errors) {
  if (errors.length === 1) return errors[0];
  return new LaunchwrightError("qa.session.fork", `${errors.length} fork groups failed: ${errors.map(failureText).join("; ")}`, { cause: new AggregateError(errors) });
}
async function runManifest(opts, deps) {
  const legs = new Map(legDefinitions(deps.config).map((l) => [l.name, l]));
  const manifest = await loadManifest(opts.manifestPath, { legs: legs.keys() });
  const plan = narrow(manifest, new Set(legs.keys()), opts);
  const run = new Run(deps, opts.manifestPath);
  const registered = new Set(deps.targets.names());
  const { shared, groups } = forkGroups(plan);
  const sharedView = { baseUrls: deps.baseUrls, blocked: {} };
  const warnings = [];
  const results = [];
  const active = /* @__PURE__ */ new Set();
  const runActive = async () => {
    const list = [...active];
    active.clear();
    const failed2 = (await Promise.allSettled(list.map((t) => t()))).flatMap((r) => r.status === "rejected" ? [r.reason] : []);
    if (failed2.length > 0) throw oneError(failed2);
  };
  const withTeardown = async (teardown, body) => {
    active.add(teardown);
    try {
      await body();
    } finally {
      active.delete(teardown);
      await teardown();
    }
  };
  const signals = deps.signals ?? process;
  const exit = deps.exit ?? ((code) => process.exit(code));
  const onSignal = (code) => () => {
    deps.err("interrupted: disarming the fixtures and dropping the forks before exit");
    runActive().then(
      () => exit(code),
      (err) => {
        deps.err(`disarm failed: ${failureText(err)}. Run lw qa fixture disarm and lw qa world fork drop before anyone uses the QA database.`);
        exit(code);
      }
    );
  };
  const onInt = onSignal(130);
  const onTerm = onSignal(143);
  signals.on("SIGINT", onInt);
  signals.on("SIGTERM", onTerm);
  const armGroup = async (group, arming, label) => {
    const toArm = armList(group);
    if (toArm.length > 0 && !arming) warnings.push(`no fixture was armed (${toArm.map((a) => a.state).join(", ")}): the world submodule gives no fixture arming`);
    for (const item of arming ? toArm : []) {
      deps.out(`arm       ${item.state}${item.persona ? ` for ${item.persona}` : ""}${label ? ` in fork ${label}` : ""}`);
      try {
        await arming?.arm(item.state, item.persona ? { persona: item.persona } : {});
      } catch (err) {
        warnings.push(`${item.state} was not armed${label ? ` in fork ${label}` : ""}: ${failureText(err)}`);
      }
    }
  };
  const report = async (shot, leg, result) => {
    await run.record(result);
    results.push(result);
    deps.out(`${result.status.padEnd(8)}  ${leg.name.padEnd(16)} ${shot.id}${result.failures.length > 0 ? ` (${result.failures.join(", ")})` : ""}${result.reason ? `: ${result.reason}` : ""}`);
  };
  const runRows = async (group, view) => {
    for (const { shot, legs: legNames } of group) {
      for (const name of legNames) {
        const leg = legs.get(name);
        const target = registered.has(leg.target) ? deps.targets.get(leg.target) : null;
        await report(shot, leg, await run.row(shot, leg, target, view));
      }
    }
  };
  const notRunGroup = async (group, reason) => {
    warnings.push(reason);
    for (const { shot, legs: legNames } of group) {
      for (const name of legNames) await report(shot, legs.get(name), { row: shot.id, leg: name, status: "not-run", reason, failures: [], attempts: 0, ms: 0 });
    }
  };
  const sharedPhase = async (group, label) => {
    const arming = deps.fixtures;
    const teardown = once(async () => {
      if (!arming) return;
      deps.out("disarm    the fixtures of this run");
      await arming.disarm();
    });
    await withTeardown(teardown, async () => {
      await armGroup(group, arming, label);
      await runRows(group, sharedView);
    });
  };
  let creating = Promise.resolve();
  const createInTurn = (forker, label) => {
    const next = creating.then(
      () => forker.create(label),
      () => forker.create(label)
    );
    creating = next.catch(() => void 0);
    return next;
  };
  const forkPhase = async (forker, label, group) => {
    let database;
    try {
      database = await createInTurn(forker, label);
    } catch (err) {
      await notRunGroup(group, `fork ${label} was not created: ${failureText(err)}`);
      return;
    }
    deps.out(`fork      ${label} -> ${database}`);
    let server = null;
    const teardown = once(async () => {
      try {
        if (server) await server.close();
      } finally {
        await forker.drop(database);
      }
    });
    await withTeardown(teardown, async () => {
      try {
        server = await forker.serve(database);
      } catch (err) {
        await notRunGroup(group, `the QA app did not start on fork ${label}: ${failureText(err)}`);
        return;
      }
      deps.out(`serve     fork ${label} on ${server.url}`);
      await armGroup(group, server.arming, label);
      await runRows(group, forkView(deps.baseUrls, deps.config.apiPort, server.url, label));
    });
  };
  try {
    await sharedPhase(shared, null);
    const forker = deps.fork;
    if (!forker) {
      for (const [label, group] of groups) {
        warnings.push(`the fork group "${label}" is not isolated: no fork runner was given, so it ran on the shared QA world`);
        await sharedPhase(group, label);
      }
    } else {
      const errors = await pool([...groups], deps.forkConcurrency ?? FORK_CONCURRENCY, ([label, group]) => forkPhase(forker, label, group));
      if (errors.length > 0) throw oneError(errors);
    }
  } finally {
    try {
      await runActive();
    } finally {
      signals.off("SIGINT", onInt);
      signals.off("SIGTERM", onTerm);
    }
  }
  for (const w of warnings) deps.err(`fixture caveat: ${w}`);
  const failed = results.filter((r) => r.status === "failed").length;
  const ran = results.filter((r) => r.status === "passed" || r.status === "failed").length;
  const notRun = results.filter((r) => r.status === "not-run").length;
  if (ran === 0 && notRun > 0) deps.err(`no row and leg pair ran: ${notRun} not run. The run proves nothing, so it exits 1.`);
  return { slug: run.slugName, results, warnings, exitCode: failed > 0 || ran === 0 && notRun > 0 ? 1 : 0 };
}

// src/drivers/target/playwright.mts
import { mkdirSync as mkdirSync2 } from "fs";
import { dirname as dirname2 } from "path";
var PERSONA_SESSION_ROUTE = "/__qa/session";
var CAPABILITIES = ["input", "screenshot", "video", "webview"];
var MIN_CLIP_MS = MIN_VIDEO_S * 1e3 + 500;
var importPlaywright = () => import("@playwright/test");
async function loadPlaywright() {
  try {
    return await importPlaywright();
  } catch (err) {
    throw new LaunchwrightError("qa.target.playwright", "The playwright target needs @playwright/test. Run: pnpm add -D @playwright/test", { cause: err });
  }
}
function browserOf(pw, leg, descriptor) {
  const name = leg.browser ?? descriptor?.defaultBrowserType ?? "chromium";
  return pw[name];
}
function contextOptions(pw, leg) {
  let base = {};
  if (leg.descriptor !== void 0) {
    const found = pw.devices[leg.descriptor];
    if (!found) {
      throw new LaunchwrightError("qa.target.descriptor", `Leg ${leg.name} names the device descriptor "${leg.descriptor}", which Playwright does not know.`, {
        context: { leg: leg.name, descriptor: leg.descriptor }
      });
    }
    base = { ...found };
  }
  return {
    ...base,
    ...leg.viewport ? { viewport: leg.viewport } : {},
    ...leg.deviceScaleFactor !== void 0 ? { deviceScaleFactor: leg.deviceScaleFactor } : {},
    ...leg.userAgent !== void 0 ? { userAgent: leg.userAgent } : {}
  };
}
function basePath(baseUrl) {
  return new URL(baseUrl).pathname.replace(/\/+$/, "");
}
function routeUrl(baseUrl, route, persona) {
  const base = new URL(baseUrl);
  const url = new URL(`${base.origin}${basePath(baseUrl)}${route.startsWith("/") ? route : `/${route}`}`);
  if (persona !== void 0) url.searchParams.set("qa", persona);
  return url.href;
}
function relativeRoute(baseUrl, pageUrl) {
  const base = basePath(baseUrl);
  let path = new URL(pageUrl).pathname;
  if (base !== "" && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length);
  path = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return path === "" ? "/" : path;
}
var SETTLE_SCRIPTS = {
  artwork: () => {
    const images = [...document.images];
    if (images.length > 0) return images.every((i) => i.complete && i.naturalWidth > 0);
    return [...document.querySelectorAll("body *")].some((el) => getComputedStyle(el).backgroundImage.includes("url("));
  },
  video: () => [...document.querySelectorAll("video")].some((v) => v.readyState >= 2 && v.videoWidth > 0 && !v.paused),
  busy: () => document.querySelector('[aria-busy="true"]') === null
};
var PlaywrightSession = class {
  constructor(target, opts, browser, context, page) {
    this.target = target;
    this.opts = opts;
    this.browser = browser;
    this.context = context;
    this.page = page;
    const at = () => target.clock.date().toISOString();
    page.on("crash", () => {
      this.broken = true;
    });
    browser.on("disconnected", () => {
      this.broken = true;
    });
    page.on("pageerror", (err) => this.lines.push({ at: at(), kind: "page-error", text: err.message }));
    page.on("console", (msg) => {
      if (msg.type() === "error") this.lines.push({ at: at(), kind: "console-error", text: msg.text() });
    });
    page.on(
      "requestfailed",
      (req) => this.lines.push({ at: at(), kind: "request-failed", text: `${req.method()} ${req.url()}: ${req.failure()?.errorText ?? "failed"}` })
    );
    page.on("response", (res) => {
      if (res.status() >= 500) this.lines.push({ at: at(), kind: "response-5xx", text: `${res.status()} ${res.request().method()} ${res.url()}` });
    });
  }
  target;
  opts;
  browser;
  context;
  page;
  lines = [];
  tracing = true;
  videoPath = null;
  videoStart = 0;
  shut = false;
  /** Set when the page crashed or the browser disconnected: the session cannot run another step. */
  broken = false;
  /**
   * `?qa=<persona>` launches a persona on the miniapp surface (spec 2.6). On the bot surface the
   * row's route opens the persona's chat on `/__tg`.
   */
  queryPersona() {
    return this.opts.leg.surface === "miniapp" ? this.opts.persona : void 0;
  }
  fail(code, message, err, context = {}) {
    return new LaunchwrightError(code, message, { cause: err, context: { leg: this.opts.leg.name, ...context } });
  }
  async navigate(route) {
    const url = routeUrl(this.opts.baseUrl, route, this.queryPersona());
    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: this.target.navigateTimeoutMs });
    } catch (err) {
      throw this.fail("qa.target.navigate", `Leg ${this.opts.leg.name} could not open ${route}.`, err, { route });
    }
    await this.loadGrace();
  }
  /** Waits a bounded time for `load`. A page that never fires it is no failure: the settle rule decides. */
  async loadGrace() {
    try {
      await this.page.waitForLoadState("load", { timeout: this.target.loadGraceMs });
    } catch (err) {
      if (err.name !== "TimeoutError") throw this.fail("qa.target.navigate", `Leg ${this.opts.leg.name} lost the page while it loaded.`, err);
    }
  }
  isClosed() {
    return this.shut || this.broken || this.page.isClosed() || !this.browser.isConnected();
  }
  async act(step) {
    const timeout = this.target.actTimeoutMs;
    const what = `${step.kind}${step.target ? ` ${step.target}` : ""}`;
    try {
      switch (step.kind) {
        case "click":
          await this.page.locator(required(step.target, "click")).first().click({ timeout });
          return;
        case "type":
          await this.page.locator(required(step.target, "type")).first().fill(step.text ?? "", { timeout });
          return;
        case "press": {
          const key = required(step.key ?? step.text, "press");
          if (step.target) await this.page.locator(step.target).first().press(key, { timeout });
          else await this.page.keyboard.press(key);
          return;
        }
        case "scroll":
          await this.scroll(step.dx ?? 0, step.dy ?? 0);
          return;
        case "wait":
          await this.target.clock.sleep(step.ms ?? 0);
          return;
        case "back":
          await this.page.goBack({ waitUntil: "domcontentloaded", timeout: this.target.navigateTimeoutMs });
          return;
      }
    } catch (err) {
      if (isCodedError(err) && err.code === "qa.target.act") throw err;
      throw this.fail("qa.target.act", `Leg ${this.opts.leg.name} could not run the act ${what}.`, err, { act: step });
    }
  }
  /** Scrolls the app's own scroll root `[data-page-scroll]`, else the document, and checks that it moved. */
  async scroll(dx, dy) {
    const moved = await this.page.evaluate(
      ([x, y]) => {
        const root = document.querySelector("[data-page-scroll]");
        const el = root ?? document.scrollingElement ?? document.documentElement;
        const before = [el.scrollLeft, el.scrollTop];
        el.scrollBy(x, y);
        return { marked: root !== null, moved: el.scrollLeft !== before[0] || el.scrollTop !== before[1] };
      },
      [dx, dy]
    );
    if (!moved.marked && !moved.moved) {
      throw new LaunchwrightError("qa.target.act", `The act scroll ${dx},${dy} found no [data-page-scroll] root and the document did not move.`, {
        context: { leg: this.opts.leg.name }
      });
    }
  }
  async settle(rule) {
    const timeout = rule.timeout ?? this.target.settleTimeoutMs;
    try {
      if (rule.selector !== void 0) await this.page.locator(rule.selector).first().waitFor({ state: "visible", timeout });
      if (rule.artwork) await this.page.waitForFunction(SETTLE_SCRIPTS.artwork, void 0, { timeout });
      if (rule.video) await this.page.waitForFunction(SETTLE_SCRIPTS.video, void 0, { timeout });
      if (rule.busy) await this.page.waitForFunction(SETTLE_SCRIPTS.busy, void 0, { timeout });
    } catch (err) {
      throw this.fail("qa.target.settle", `Leg ${this.opts.leg.name} did not settle in ${timeout} ms on ${JSON.stringify(rule)}.`, err, { rule });
    }
  }
  async currentRoute() {
    return relativeRoute(this.opts.baseUrl, this.page.url());
  }
  async screenshot(path) {
    mkdirSync2(dirname2(path), { recursive: true });
    const png = await this.page.screenshot({ path, animations: "disabled", fullPage: false });
    const size = pngSize(png);
    if (size === null) throw new LaunchwrightError("qa.target.screenshot", `Leg ${this.opts.leg.name} wrote a screenshot that is not a PNG: ${path}.`);
    return { path, ...size };
  }
  async startVideo(path) {
    if (this.videoPath !== null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} already records ${this.videoPath}.`);
    mkdirSync2(dirname2(path), { recursive: true });
    const size = this.page.viewportSize() ?? void 0;
    await this.page.screencast.start({ path, ...size ? { size } : {} });
    this.videoPath = path;
    this.videoStart = this.target.clock.now();
  }
  async stopVideo() {
    if (this.videoPath === null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} records no video; call startVideo first.`);
    const path = this.videoPath;
    this.videoPath = null;
    const held = this.target.clock.now() - this.videoStart;
    if (held < MIN_CLIP_MS) await this.target.clock.sleep(MIN_CLIP_MS - held);
    await this.page.screencast.stop();
    return { path, durationMs: this.target.clock.now() - this.videoStart };
  }
  async trace(path) {
    if (!this.tracing) return null;
    this.tracing = false;
    mkdirSync2(dirname2(path), { recursive: true });
    await this.context.tracing.stop({ path });
    return path;
  }
  /** The browser target has no accessibility dump file; Android rows carry one (spec 2.11.1). */
  async dump(_path) {
    return null;
  }
  async logs() {
    return [...this.lines];
  }
  async evaluate(expression) {
    return this.page.evaluate(expression);
  }
  routable() {
    return this.page;
  }
  async close() {
    if (this.shut) return;
    this.shut = true;
    try {
      if (this.videoPath !== null) await this.page.screencast.stop();
      if (this.tracing) await this.context.tracing.stop();
      await this.context.close();
    } finally {
      await this.browser.close();
    }
  }
};
function required(value, kind) {
  if (value === void 0 || value === "") {
    throw new LaunchwrightError("qa.target.act", `The act ${kind} needs a ${kind === "press" ? "key" : "target"}.`, { context: { kind } });
  }
  return value;
}
var PlaywrightTarget = class {
  name = "playwright";
  specVersion = QA_TARGET_SPEC_VERSION;
  capabilities = new Set(CAPABILITIES);
  clock;
  actTimeoutMs;
  settleTimeoutMs;
  navigateTimeoutMs;
  loadGraceMs;
  executablePath;
  constructor(opts) {
    this.clock = opts.clock ?? systemClock;
    this.actTimeoutMs = opts.actTimeoutMs ?? 15e3;
    this.settleTimeoutMs = opts.settleTimeoutMs ?? 2e4;
    this.navigateTimeoutMs = opts.navigateTimeoutMs ?? 15e3;
    this.loadGraceMs = opts.loadGraceMs ?? 2e3;
    this.executablePath = opts.executablePath;
  }
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async launch(pw, leg) {
    const { defaultBrowserType, ...options } = contextOptions(pw, leg);
    const type = browserOf(pw, leg, { defaultBrowserType });
    const browser = await type.launch({ headless: true, ...this.executablePath ? { executablePath: this.executablePath } : {} });
    return { browser, options };
  }
  /** Ready when the leg's browser launches. The reason names the install command. */
  async ready(leg) {
    let pw;
    try {
      pw = await loadPlaywright();
    } catch (err) {
      return { ready: false, reason: err.message };
    }
    try {
      const { browser } = await this.launch(pw, leg);
      await browser.close();
      return { ready: true };
    } catch (err) {
      const first = (err.message ?? String(err)).split("\n")[0];
      return { ready: false, reason: `${first}. Run: npx playwright install ${leg.browser ?? "chromium"}` };
    }
  }
  async open(opts) {
    const pw = await loadPlaywright();
    const { browser, options } = await this.launch(pw, opts.leg).catch((err) => {
      throw new LaunchwrightError("qa.target.launch", `Leg ${opts.leg.name} could not launch ${opts.leg.browser ?? "chromium"}.`, { cause: err });
    });
    try {
      const context = await browser.newContext(options);
      await context.tracing.start({ screenshots: true, snapshots: true });
      if (opts.persona !== void 0 && opts.leg.surface === "web") await signIn(context, opts);
      const page = await context.newPage();
      return new PlaywrightSession(this, opts, browser, context, page);
    } catch (err) {
      await browser.close();
      throw err;
    }
  }
};
async function signIn(context, opts) {
  const url = new URL(PERSONA_SESSION_ROUTE, opts.baseUrl).href;
  const res = await context.request.post(url, { data: { persona: opts.persona } });
  if (!res.ok()) {
    throw new LaunchwrightError("qa.target.persona", `POST ${PERSONA_SESSION_ROUTE} for persona ${opts.persona} answered ${res.status()}.`, {
      context: { leg: opts.leg.name, persona: opts.persona, status: res.status() }
    });
  }
}
function createPlaywrightTarget(opts = {}) {
  return new PlaywrightTarget(opts);
}

// src/services/targets.mts
function createTargetRegistry(_config, extra = {}, clock = systemClock) {
  const targets = {
    playwright: createPlaywrightTarget({ clock }),
    fake: createFakeTarget({ clock }),
    ...extra
  };
  return {
    names: () => Object.keys(targets).sort(),
    get(name) {
      const target = targets[name];
      if (!target) {
        throw new LaunchwrightError("qa.target.unknown", `No qa.target driver is named ${name}. Targets: ${Object.keys(targets).sort().join(", ") || "none"}.`, {
          context: { target: name }
        });
      }
      return target;
    },
    add(more) {
      for (const [name, target] of Object.entries(more)) {
        if (targets[name]) throw new LaunchwrightError("qa.target.duplicate", `A qa.target driver named ${name} is already registered.`, { context: { target: name } });
        targets[name] = target;
      }
    }
  };
}

export {
  forkView,
  BROWSER_TARGETS,
  forkLabel,
  runManifest,
  createPlaywrightTarget,
  createTargetRegistry
};
//# sourceMappingURL=chunk-N736V2LB.js.map