import "./chunk-PYKQB25D.js";
import {
  FAKE_CLIP,
  INTAKE_DIR,
  QA_TARGET_SPEC_VERSION,
  createFakeTarget,
  encodePng,
  evidencePath,
  expectText,
  pngSize,
  validateManifest,
  writeIssue
} from "./chunk-JHXOJGHS.js";
import {
  hashFile,
  readTextOrNull
} from "./chunk-6LHTNS5B.js";
import {
  moduleFixture
} from "./chunk-WUOHAWEI.js";
import {
  LaunchwrightError
} from "./chunk-L57WEOVE.js";

// src/testing/target-contract.mts
import { readFileSync as readFileSync2 } from "fs";
import { createServer as createServer2 } from "http";
import { join as join2 } from "path";

// src/kernel/testing/contract.mts
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
function readCasesFile(file, kind, specVersion) {
  const invalid = (reason) => new LaunchwrightError("kernel.contract.invalid", `The cases file ${file.pathname} ${reason}.`, { context: { file: file.pathname, kind } });
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(fileURLToPath(file), "utf8"));
  } catch (err) {
    throw new LaunchwrightError("kernel.contract.invalid", `Cannot read the cases file ${file.pathname}.`, {
      cause: err,
      context: { file: file.pathname, kind }
    });
  }
  if (parsed.kind !== kind) throw invalid(`has kind "${parsed.kind}", the suite has kind "${kind}"`);
  if (parsed.specVersion !== specVersion) throw invalid(`has specVersion "${parsed.specVersion}", the suite has specVersion "${specVersion}"`);
  if (!Array.isArray(parsed.cases)) throw invalid("has no cases array");
  const names = parsed.cases.map((c) => c.name);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate !== void 0) throw invalid(`lists the case "${duplicate}" twice`);
  return parsed;
}
function defineContract(kind, specVersion, cases, opts = {}) {
  if (!opts.casesFile) return { kind, specVersion, cases };
  const file = readCasesFile(opts.casesFile, kind, specVersion);
  const inFile = new Set(file.cases.map((c) => c.name));
  for (const c of cases) {
    if (!inFile.has(c.name)) {
      throw new LaunchwrightError(
        "kernel.contract.case",
        `The ${kind} contract has the case "${c.name}", which the cases file ${opts.casesFile.pathname} lacks. Add it to the file.`,
        { context: { kind, case: c.name, file: opts.casesFile.pathname } }
      );
    }
  }
  const byName = new Map(cases.map((c) => [c.name, c]));
  const merged = file.cases.map((fc) => {
    const code = byName.get(fc.name);
    if (code) return code;
    return {
      name: fc.name,
      async run(driver) {
        if (!opts.data || fc.input === void 0 || fc.expect === void 0) {
          throw new LaunchwrightError(
            "kernel.contract.missing",
            `The ${kind} case "${fc.name}" has no code and no data. Add code to the suite, or add input and expect to the cases file and pass data.`,
            { context: { kind, case: fc.name, file: opts.casesFile?.pathname } }
          );
        }
        const actual = await opts.data(driver, fc.input);
        if (typeof fc.expect === "object" && fc.expect !== null && !Array.isArray(fc.expect)) {
          expect(actual).toMatchObject(fc.expect);
        } else {
          expect(actual).toEqual(fc.expect);
        }
      }
    };
  });
  return { kind, specVersion, cases: merged };
}

// src/kernel/testing/fake-clock.mts
import { setImmediate as realImmediate } from "timers";

// src/kernel/testing/redirect-trap.mts
import { createServer } from "http";
import { onTestFinished } from "vitest";

// src/kernel/testing/tmp-dir.mts
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { expect as expect2, onTestFinished as onTestFinished2 } from "vitest";

// src/testing/target-contract.mts
import { expect as expect3 } from "vitest";
function targetHarness(target, opts) {
  return {
    name: target.name,
    specVersion: target.specVersion,
    capabilities: target.capabilities,
    supports: (cap) => target.supports(cap),
    target,
    leg: opts.leg ?? { name: "contract", surface: "web", target: target.name, viewport: { width: 640, height: 480 } },
    baseUrl: opts.baseUrl,
    outDir: opts.outDir
  };
}
var CONTRACT_BASE = "/site";
var page = (body) => `<!doctype html><html><head><meta charset="utf-8"><title>contract</title></head><body>${body}</body></html>`;
var DOT_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
var SITE = {
  "/": page(
    `<main id="home"><h1>Home</h1><a href="{base}/next">Next</a><input id="name" aria-label="Name"><img alt="dot" src="${DOT_PNG}" width="8" height="8"><div style="height:3000px"></div></main>`
  ),
  "/next": page('<main id="next"><h1>Next</h1></main>'),
  "/busy": page(
    `<main id="busy" aria-busy="true"><h1>Busy</h1></main><script>requestAnimationFrame(() => document.getElementById('busy').setAttribute('aria-busy', 'false'))</script>`
  ),
  "/video": page('<video id="clip" src="{base}/clip.webm" autoplay muted loop playsinline width="32" height="32"></video>'),
  "/errors": page(
    `<main id="errors"><h1>Errors</h1></main><script>console.error('contract console error');fetch('{base}/fail').then(() => { const d = document.createElement('p'); d.id = 'done'; d.textContent = 'done'; document.body.append(d); });throw new Error('contract page error');</script>`
  )
};
function contractFakeRoutes() {
  return {
    "/": { selectors: ["#home", "#name", 'role=link[name="Next"]'], links: { 'role=link[name="Next"]': "/next" }, artwork: true },
    "/next": { selectors: ["#next"] },
    "/busy": { selectors: ["#busy"] },
    "/video": { selectors: ["#clip"], video: true },
    "/errors": {
      selectors: ["#errors", "#done"],
      logs: [
        { kind: "console-error", text: "contract console error" },
        { kind: "response-5xx", text: `500 GET ${CONTRACT_BASE}/fail` },
        { kind: "page-error", text: "contract page error" }
      ]
    },
    "/redirect": { redirect: "/next" }
  };
}
async function serveContractSite() {
  const server = createServer2((req, res) => {
    const path = new URL(req.url ?? "/", "http://site.test").pathname;
    const route = path === CONTRACT_BASE ? "/" : path.startsWith(`${CONTRACT_BASE}/`) ? path.slice(CONTRACT_BASE.length) : null;
    if (route === "/redirect") {
      res.writeHead(302, { location: `${CONTRACT_BASE}/next` }).end();
      return;
    }
    if (route === "/fail") {
      res.writeHead(500, { "content-type": "text/plain" }).end("fail");
      return;
    }
    if (route === "/clip.webm") {
      res.writeHead(200, { "content-type": "video/webm", "content-length": FAKE_CLIP.length }).end(FAKE_CLIP);
      return;
    }
    const html = route === null ? void 0 : SITE[route];
    if (html === void 0) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html.replaceAll("{base}", CONTRACT_BASE));
  });
  await new Promise((resolve2, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve2());
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}${CONTRACT_BASE}`,
    close: () => new Promise((resolve2, reject) => {
      server.closeAllConnections();
      server.close((err) => err ? reject(err) : resolve2());
    })
  };
}
async function using(h, fn) {
  const dir = await h.outDir();
  const session = await h.target.open({ leg: h.leg, baseUrl: h.baseUrl, outDir: dir });
  try {
    await fn(session, dir);
  } finally {
    await session.close();
  }
}
async function codeOf(p) {
  const err = await p.then(
    () => void 0,
    (e) => e
  );
  expect3(err).toBeInstanceOf(LaunchwrightError);
  return err.code;
}
function has(h, cap) {
  return h.target.capabilities.has(cap);
}
var CASES_FILE = moduleFixture(import.meta.url, "contract/target.cases.json");
var targetContract = defineContract(
  "qa.target",
  QA_TARGET_SPEC_VERSION,
  [
    {
      name: "navigate shows the route relative to the surface base",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/next");
          expect3(await s.currentRoute()).toBe("/next");
          await s.navigate("/");
          expect3(await s.currentRoute()).toBe("/");
        });
      }
    },
    {
      name: "a redirect shows in currentRoute",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/redirect");
          expect3(await s.currentRoute()).toBe("/next");
        });
      }
    },
    {
      name: "click on a role selector opens the linked route",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/");
          if (!has(h, "input")) {
            expect3(await codeOf(s.act({ kind: "click", target: 'role=link[name="Next"]' }))).toBe("qa.target.capability");
            return;
          }
          await s.act({ kind: "click", target: 'role=link[name="Next"]' });
          await s.settle({ selector: "#next", timeout: 5e3 });
          expect3(await s.currentRoute()).toBe("/next");
        });
      }
    },
    {
      name: "type, press, scroll, wait and back run in order",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/next");
          await s.navigate("/");
          if (!has(h, "input")) {
            expect3(await codeOf(s.act({ kind: "type", target: "#name", text: "hello" }))).toBe("qa.target.capability");
            return;
          }
          await s.act({ kind: "type", target: "#name", text: "hello" });
          await s.act({ kind: "press", target: "#name", key: "Tab" });
          await s.act({ kind: "scroll", dy: 400 });
          await s.act({ kind: "wait", ms: 0, why: "the contract checks that wait runs" });
          await s.act({ kind: "back" });
          expect3(await s.currentRoute()).toBe("/next");
        });
      }
    },
    {
      name: "an act on a missing element fails with qa.target.act",
      async run(h) {
        if (!has(h, "input")) return;
        await using(h, async (s) => {
          await s.navigate("/next");
          expect3(await codeOf(s.act({ kind: "click", target: "#nothing-here" }))).toBe("qa.target.act");
        });
      }
    },
    {
      name: "settle waits for a selector, artwork, a playing video and no busy element",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/");
          await s.settle({ selector: "#home", timeout: 5e3 });
          await s.settle({ artwork: true, timeout: 5e3 });
          await s.navigate("/busy");
          await s.settle({ busy: true, timeout: 5e3 });
          await s.navigate("/video");
          await s.settle({ video: true, timeout: 1e4 });
        });
      }
    },
    {
      name: "settle on a missing selector fails with qa.target.settle",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/next");
          expect3(await codeOf(s.settle({ selector: "#never", timeout: 300 }))).toBe("qa.target.settle");
        });
      }
    },
    {
      name: "screenshot writes a PNG whose header gives the capture size",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          const path = join2(dir, "leg-row.png");
          if (!has(h, "screenshot")) {
            expect3(await codeOf(s.screenshot(path))).toBe("qa.target.capability");
            return;
          }
          const shot = await s.screenshot(path);
          expect3(shot.path).toBe(path);
          const size = pngSize(readFileSync2(path));
          expect3(size).not.toBeNull();
          expect3(size).toEqual({ width: shot.width, height: shot.height });
        });
      }
    },
    {
      name: "startVideo and stopVideo write a clip with a duration",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          const path = join2(dir, "leg-row.webm");
          if (!has(h, "video")) {
            expect3(await codeOf(s.startVideo(path))).toBe("qa.target.capability");
            return;
          }
          await s.startVideo(path);
          await s.navigate("/next");
          await s.settle({ selector: "#next", timeout: 5e3 });
          const clip = await s.stopVideo();
          expect3(clip.path).toBe(path);
          expect3(clip.durationMs).toBeGreaterThan(0);
          expect3(readFileSync2(path).length).toBeGreaterThan(0);
        });
      }
    },
    {
      name: "logs hold page errors, console errors and 5xx responses",
      async run(h) {
        await using(h, async (s) => {
          await s.navigate("/errors");
          await s.settle({ selector: "#done", timeout: 5e3 });
          const logs = await s.logs();
          const kinds = new Set(logs.map((l) => l.kind));
          expect3(kinds).toEqual(/* @__PURE__ */ new Set(["page-error", "console-error", "response-5xx"]));
          for (const line of logs) expect3(Number.isNaN(Date.parse(line.at))).toBe(false);
          expect3(logs.find((l) => l.kind === "page-error")?.text).toContain("contract page error");
        });
      }
    },
    {
      name: "a missing capability rejects with qa.target.capability",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          if (!has(h, "input")) expect3(await codeOf(s.act({ kind: "back" }))).toBe("qa.target.capability");
          if (!has(h, "screenshot")) expect3(await codeOf(s.screenshot(join2(dir, "x.png")))).toBe("qa.target.capability");
          if (!has(h, "video")) {
            expect3(await codeOf(s.startVideo(join2(dir, "x.webm")))).toBe("qa.target.capability");
            expect3(await codeOf(s.stopVideo())).toBe("qa.target.capability");
          }
          for (const cap of ["input", "screenshot", "video"]) expect3(h.supports(cap)).toBe(has(h, cap));
        });
      }
    },
    {
      name: "trace and dump give a written path or null",
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate("/");
          for (const [call, path] of [
            [s.trace.bind(s), join2(dir, "leg-row.trace.zip")],
            [s.dump.bind(s), join2(dir, "leg-row.ui.xml")]
          ]) {
            const written = await call(path);
            if (written === null) continue;
            expect3(written).toBe(path);
            expect3(readFileSync2(path).length).toBeGreaterThan(0);
          }
        });
      }
    },
    {
      name: "ready answers a boolean and a reason when not ready",
      async run(h) {
        const r = await h.target.ready(h.leg);
        expect3(typeof r.ready).toBe("boolean");
        if (!r.ready) expect3(r.reason ?? "").not.toBe("");
      }
    },
    {
      name: "close ends the session and a second close does nothing",
      async run(h) {
        const session = await h.target.open({ leg: h.leg, baseUrl: h.baseUrl, outDir: await h.outDir() });
        await session.navigate("/");
        await session.close();
        await session.close();
      }
    }
  ],
  { casesFile: CASES_FILE }
);

// src/testing/chromium.mts
import { existsSync, readdirSync } from "fs";
import { userInfo } from "os";
import { join as join3 } from "path";
var BROWSERS_PATH = join3(userInfo().homedir, ".cache", "ms-playwright");
function headlessShell() {
  const dirs = existsSync(BROWSERS_PATH) ? readdirSync(BROWSERS_PATH).filter((d) => d.startsWith("chromium_headless_shell-")) : [];
  const found = dirs.map((d) => ({ build: Number(d.split("-")[1]), path: join3(BROWSERS_PATH, d, "chrome-headless-shell-linux64", "chrome-headless-shell") })).filter((d) => existsSync(d.path)).sort((a, b) => b.build - a.build)[0];
  if (!found) {
    throw new LaunchwrightError("qa.test.chromium", `No chrome-headless-shell under ${BROWSERS_PATH}. Run: npx playwright install chromium`);
  }
  return found.path;
}

// src/testing/report-fixture.mts
import { mkdir as mkdir3, writeFile as writeFile3 } from "fs/promises";
import { dirname as dirname3, join as join6 } from "path";

// src/services/ledger.mts
import { mkdir, rename, rm as rm2, stat, writeFile } from "fs/promises";
import { dirname, join as join4 } from "path";
var LEDGER_FILE = "evidence.lock.json";
var RESULTS_FILE = "results.jsonl";
var LEDGER_FORMAT = 1;
var assetsRel = (slug) => `assets/${slug}`;
function reportPaths(reportDir, slug) {
  return {
    md: join4(reportDir, `${slug}.md`),
    plan: join4(reportDir, `${slug}.shots.json`),
    assets: join4(reportDir, assetsRel(slug)),
    ledger: join4(reportDir, assetsRel(slug), LEDGER_FILE),
    results: join4(reportDir, assetsRel(slug), RESULTS_FILE),
    html: join4(reportDir, "dist", `${slug}.html`)
  };
}
async function fileDigest(path) {
  const sha256 = await hashFile(path);
  return { sha256, bytes: (await stat(path)).size };
}
async function ledgerEntry(reportDir, facts) {
  checkEntryPath(facts.path);
  const { sha256, bytes } = await fileDigest(join4(reportDir, facts.path));
  return { ...facts, sha256, bytes };
}
function checkEntryPath(path) {
  if (!/^assets\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-][A-Za-z0-9._/-]*$/.test(path) || path.split("/").includes("..")) {
    throw new LaunchwrightError("qa.ledger.path", `Ledger path ${path} is not assets/<slug>/<file>`, { context: { path } });
  }
}
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function entryProblem(e) {
  if (!isObject(e)) return "not an object";
  for (const key of ["path", "kind", "sha256", "capturedAt", "commit", "leg", "target", "provenance", "row"]) {
    if (typeof e[key] !== "string" || e[key] === "") return `${key} is missing`;
  }
  if (!/^[0-9a-f]{64}$/.test(e.sha256)) return "sha256 is not 64 hex characters";
  if (typeof e.bytes !== "number" || typeof e.attempt !== "number" || typeof e.dirty !== "boolean") return "bytes, attempt or dirty has the wrong type";
  return null;
}
async function readLedger(path) {
  const raw = await readTextOrNull(path);
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError("qa.ledger.invalid", `The ledger ${path} is not JSON`, { cause, context: { path } });
  }
  if (!isObject(parsed) || parsed.format !== LEDGER_FORMAT || typeof parsed.slug !== "string" || !Array.isArray(parsed.entries)) {
    throw new LaunchwrightError("qa.ledger.invalid", `The ledger ${path} is not format ${LEDGER_FORMAT} with slug and entries`, { context: { path } });
  }
  parsed.entries.forEach((e, i) => {
    const problem = entryProblem(e);
    if (problem) throw new LaunchwrightError("qa.ledger.invalid", `The ledger ${path} entry ${i}: ${problem}`, { context: { path, entry: i } });
  });
  return parsed;
}
async function writeLedger(path, ledger) {
  const paths = /* @__PURE__ */ new Set();
  for (const e of ledger.entries) {
    checkEntryPath(e.path);
    if (paths.has(e.path)) throw new LaunchwrightError("qa.ledger.duplicate", `The ledger lists ${e.path} twice`, { context: { path: e.path } });
    paths.add(e.path);
  }
  const sorted = { ...ledger, entries: [...ledger.entries].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(sorted, null, 2)}
`);
  await rename(tmp, path);
  return sorted;
}
async function appendLedger(reportDir, slug, entries) {
  const path = reportPaths(reportDir, slug).ledger;
  const current = await readLedger(path) ?? { format: LEDGER_FORMAT, slug, entries: [] };
  const byPath = new Map(current.entries.map((e) => [e.path, e]));
  for (const e of entries) byPath.set(e.path, e);
  return writeLedger(path, { format: LEDGER_FORMAT, slug, entries: [...byPath.values()] });
}
async function readResults(path) {
  const raw = await readTextOrNull(path);
  if (raw === null) return [];
  const out = [];
  raw.split("\n").forEach((line, i) => {
    if (line.trim() === "") return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (cause) {
      throw new LaunchwrightError("qa.results.invalid", `${path}:${i + 1} is not JSON`, { cause, context: { path, line: i + 1 } });
    }
    if (!isObject(parsed) || typeof parsed.row !== "string" || typeof parsed.leg !== "string" || typeof parsed.status !== "string" || !Array.isArray(parsed.failures)) {
      throw new LaunchwrightError("qa.results.invalid", `${path}:${i + 1} is not a row result`, { context: { path, line: i + 1 } });
    }
    out.push(parsed);
  });
  return out;
}
async function appendResult(path, result) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(result)}
`, { flag: "a" });
}
var pairKey = (row, leg) => `${row}\0${leg}`;

// src/services/report.mts
import { mkdir as mkdir2, readdir, readFile, writeFile as writeFile2 } from "fs/promises";
import { basename, dirname as dirname2, isAbsolute, join as join5, relative, resolve, sep } from "path";

// src/services/evidence.mts
var EVIDENCE_START = "<!-- qa:evidence:start -->";
var EVIDENCE_END = "<!-- qa:evidence:end -->";
var COVERAGE_START = "<!-- qa:coverage:start -->";
var COVERAGE_END = "<!-- qa:coverage:end -->";
var KIND_ORDER = { screenshot: 0, step: 1, video: 2, trace: 3, log: 4, ui: 5 };
var STILL = /* @__PURE__ */ new Set(["screenshot", "step"]);
var LINKED = { trace: "trace", log: "log", ui: "UI dump" };
var PER_ROW = 2;
function naturalCompare(a, b) {
  const pa = a.split(/(\d+)/);
  const pb = b.split(/(\d+)/);
  for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    if (i % 2 === 1) return Number(x) - Number(y) || (x < y ? -1 : 1);
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}
function compareEntries(a, b) {
  return a.attempt - b.attempt || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || naturalCompare(a.path, b.path);
}
function cell(text) {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[/g, "&#91;").replace(/\]/g, "&#93;").trim();
}
var altText = (text) => cell(text).replace(/[[\]]/g, "");
function provenanceLabel(provenance) {
  return provenance === "live" ? "" : ` (${provenance})`;
}
function stepOf(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? m[1] : null;
}
function caption(e, showAttempt, extra = "") {
  const device = e.device ? ` (${e.device})` : "";
  const step = e.kind === "step" ? `, step ${stepOf(e.path) ?? "?"}` : "";
  const video = e.kind === "video" ? ", video" : "";
  const attempt = showAttempt ? `, attempt ${e.attempt}` : "";
  return cell(`${e.leg} on ${e.target}${device}${step}${video}${attempt}${extra}${provenanceLabel(e.provenance)}`);
}
function embed(e, shot) {
  const what = shot ? `${shot.screen} ${shot.state}` : e.row;
  const step = e.kind === "step" ? ` step ${stepOf(e.path) ?? "?"}` : "";
  return `![${altText(`${e.leg} ${what}${step}${e.kind === "video" ? " video" : ""}`)}](${e.path})`;
}
function resultText(r) {
  if (!r) return "no result";
  const attempts = `${r.attempts} attempt${r.attempts === 1 ? "" : "s"}`;
  const reason = r.reason ? `: ${cell(r.reason)}` : "";
  if (r.status === "passed") return `passed, ${attempts}`;
  if (r.status === "failed") return `failed (${r.failures.join(", ") || "no failure named"}), ${attempts}${reason}`;
  return `${r.status === "n/a" ? "n/a" : "not run"}${reason}`;
}
function rowFiles(entries, shot, sizeOf, multiAttempt) {
  const out = [];
  const portraits = [];
  const links = [];
  for (const e of entries) {
    const showAttempt = multiAttempt.has(pairKey(e.row, e.leg));
    if (STILL.has(e.kind)) {
      const size = sizeOf(e.path);
      if (size && size.width <= size.height) {
        portraits.push(e);
        continue;
      }
      out.push(caption(e, showAttempt, size ? "" : ", shape unknown"), "", embed(e, shot), "");
    } else if (e.kind === "video") {
      out.push(caption(e, showAttempt), "", embed(e, shot), "");
    } else {
      links.push(e);
    }
  }
  for (let i = 0; i < portraits.length; i += PER_ROW) {
    const group = portraits.slice(i, i + PER_ROW);
    const heads = [];
    const cells = [];
    for (let j = 0; j < PER_ROW; j += 1) {
      const e = group[j];
      heads.push(e ? caption(e, multiAttempt.has(pairKey(e.row, e.leg))) : "");
      cells.push(e ? embed(e, shot) : "");
    }
    out.push(`| ${heads.join(" | ")} |`, `|${"---|".repeat(PER_ROW)}`, `| ${cells.join(" | ")} |`, "");
  }
  if (links.length > 0) {
    const items = links.map((e) => {
      const attempt = multiAttempt.has(pairKey(e.row, e.leg)) ? ` attempt ${e.attempt}` : "";
      return `[${altText(`${e.leg} ${LINKED[e.kind] ?? e.kind}${attempt}`)}](${e.path})`;
    });
    out.push(`Files: ${items.join(", ")}.`, "");
  }
  return out;
}
function plannedPairs(manifest) {
  return manifest.shots.flatMap((shot) => shot.legs.map((leg) => ({ shot, leg })));
}
function evidenceSection(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const multiAttempt = /* @__PURE__ */ new Set();
  for (const e of input.entries) if (e.attempt > 1) multiAttempt.add(pairKey(e.row, e.leg));
  for (const r of latest.values()) if (r.attempts > 1) multiAttempt.add(pairKey(r.row, r.leg));
  const out = [
    "The runner writes this part from the ledger. `lw qa report check` renders it again and refuses an edit.",
    "A label in parentheses names a provenance other than live.",
    ""
  ];
  const counts = { passed: 0, failed: 0, na: 0, notRun: 0, none: 0 };
  const planned = /* @__PURE__ */ new Set();
  for (const shot of input.manifest.shots) {
    out.push(`### ${cell(shot.screen)}, ${cell(shot.state)}`, "");
    out.push(`Row \`${shot.id}\`. Route \`${cell(shot.route).replace(/`/g, "%60")}\`. Expect: ${cell(expectText(shot))}`, "");
    for (const leg of shot.legs) {
      planned.add(pairKey(shot.id, leg));
      const r = latest.get(pairKey(shot.id, leg));
      if (!r) counts.none += 1;
      else if (r.status === "passed") counts.passed += 1;
      else if (r.status === "failed") counts.failed += 1;
      else if (r.status === "n/a") counts.na += 1;
      else counts.notRun += 1;
      out.push(`- \`${leg}\`: ${resultText(r)}`);
    }
    out.push("");
    const files = input.entries.filter((e) => e.row === shot.id && shot.legs.includes(e.leg)).sort((a, b) => shot.legs.indexOf(a.leg) - shot.legs.indexOf(b.leg) || compareEntries(a, b));
    out.push(...rowFiles(files, shot, input.sizeOf, multiAttempt));
  }
  const outside = input.entries.filter((e) => !planned.has(pairKey(e.row, e.leg))).sort((a, b) => naturalCompare(a.row, b.row) || naturalCompare(a.leg, b.leg) || compareEntries(a, b));
  if (outside.length > 0) {
    out.push("### Files outside the plan", "", "These ledger files belong to no planned row and leg.", "");
    out.push(...rowFiles(outside, null, input.sizeOf, multiAttempt));
  }
  const pairs = counts.passed + counts.failed + counts.na + counts.notRun + counts.none;
  out.push(
    `Totals: ${input.manifest.shots.length} rows, ${pairs} row legs, ${counts.passed} passed, ${counts.failed} failed, ${counts.na} n/a, ${counts.notRun} not run, ${counts.none} with no result.`
  );
  return out.join("\n");
}
function coverageSection(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const out = [];
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const r = latest.get(pairKey(shot.id, leg));
    if (r && r.status !== "passed") out.push(`- \`${shot.id}\` on \`${leg}\`: ${resultText(r)}`);
  }
  const world = input.world ?? [];
  if (world.length > 0) {
    const covered = coveredStates(input);
    const open = world.filter((w) => !covered.has(w.id));
    if (out.length > 0) out.push("");
    out.push(`${world.length - open.length} of ${world.length} world states have a passed row with evidence.`);
    if (open.length > 0) {
      out.push("", "| State | Feature | Why it has no evidence |", "|---|---|---|");
      for (const w of open) {
        const named = input.manifest.shots.some((s) => s.fixture.persona === w.id || (s.fixture.facts ?? []).includes(w.id));
        out.push(`| \`${w.id}\` | ${cell(w.feature ?? "")} | ${named ? "a row names it and no leg passed" : "no row names it"} |`);
      }
    }
  }
  if (out.length === 0) out.push("Every planned row and leg ran and passed.");
  return out.join("\n");
}
function coveredStates(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const out = /* @__PURE__ */ new Set();
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const key = pairKey(shot.id, leg);
    if (latest.get(key)?.status !== "passed" || !withFiles.has(key)) continue;
    if (shot.fixture.persona) out.add(shot.fixture.persona);
    for (const f of shot.fixture.facts ?? []) out.add(f);
  }
  return out;
}
function legsLine(manifest, results) {
  const legs = [];
  for (const shot of manifest.shots) for (const leg of shot.legs) if (!legs.includes(leg)) legs.push(leg);
  const latest = /* @__PURE__ */ new Map();
  for (const r of results) latest.set(pairKey(r.row, r.leg), r);
  const ran = [];
  const not = [];
  for (const leg of legs) {
    const rs = manifest.shots.filter((s) => s.legs.includes(leg)).map((s) => latest.get(pairKey(s.id, leg)));
    if (rs.some((r) => r?.status === "passed" || r?.status === "failed")) ran.push(leg);
    else {
      const reason = rs.find((r) => r?.reason)?.reason;
      not.push(`${leg} (${reason ? cell(reason) : rs.every((r) => !r) ? "no result" : "not run"})`);
    }
  }
  return [ran.length > 0 ? ran.join(", ") : "none ran", not.length > 0 ? `not run: ${not.join(", ")}` : ""].filter(Boolean).join("; ");
}
function coverageLine(input) {
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.map((e) => pairKey(e.row, e.leg)));
  const pairs = plannedPairs(input.manifest);
  const passed = pairs.filter(({ shot, leg }) => latest.get(pairKey(shot.id, leg))?.status === "passed" && withFiles.has(pairKey(shot.id, leg))).length;
  const base = `${passed} of ${pairs.length} row legs passed with evidence`;
  const world = input.world ?? [];
  if (world.length === 0) return base;
  const covered = coveredStates(input);
  return `${base}, ${world.filter((w) => covered.has(w.id)).length} of ${world.length} world states`;
}

// src/services/report.mts
var REPORT_SECTIONS = [
  { n: 1, title: "What this run covered" },
  { n: 2, title: "What the code claims" },
  { n: 3, title: "What was seen" },
  { n: 4, title: "Findings" },
  { n: 5, title: "Not covered" },
  { n: 6, title: "How to retest" }
];
var SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FIELD_RE = /^(Date|Status|Range|Spec|Issues|Legs|Coverage):\s*(.*)$/;
var SECTION_RE = /^##\s+(\d+)\.?(?:\s|$)/;
function slugOf(mdPath) {
  const slug = basename(mdPath).replace(/\.md$/, "");
  if (!mdPath.endsWith(".md") || !SLUG_RE.test(slug)) {
    throw new LaunchwrightError("qa.report.slug", `${mdPath}: a report is <reportDir>/YYYY-MM-DD-<name>.md, with a kebab-case name`, { context: { path: mdPath } });
  }
  return slug;
}
function computeStatus(input) {
  if (input.results.length === 0) return "planned";
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const withFiles = new Set(input.entries.filter((e) => e.provenance !== "forged").map((e) => pairKey(e.row, e.leg)));
  let failed = false;
  let incomplete = false;
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const key = pairKey(shot.id, leg);
    const r = latest.get(key);
    if (r?.status === "failed") failed = true;
    else if (r?.status !== "passed" || !withFiles.has(key)) incomplete = true;
  }
  if (failed) return "failed";
  return incomplete ? "partial" : "passed";
}
function parse(text) {
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.startsWith("## "));
  const bodyStart = first === -1 ? lines.length : first;
  const fields = /* @__PURE__ */ new Map();
  let title = null;
  for (let i = 0; i < bodyStart; i += 1) {
    const line = lines[i];
    if (title === null && /^#\s/.test(line)) title = line.slice(1).trim();
    const m = FIELD_RE.exec(line);
    if (m && !fields.has(m[1])) fields.set(m[1], { value: m[2].trim(), line: i });
  }
  const sections = /* @__PURE__ */ new Map();
  let fence = false;
  lines.forEach((line, i) => {
    if (line.startsWith("```")) fence = !fence;
    if (fence) return;
    const m = SECTION_RE.exec(line);
    if (m) sections.set(Number(m[1]), [...sections.get(Number(m[1])) ?? [], i]);
  });
  return { lines, bodyStart, title, fields, sections };
}
function sectionRange(p, n) {
  const at = p.sections.get(n)?.[0];
  if (at === void 0) return null;
  let end = p.lines.length;
  for (let i = at + 1; i < p.lines.length; i += 1) {
    if (/^##\s/.test(p.lines[i])) {
      end = i;
      break;
    }
  }
  return [at + 1, end];
}
function findBlock(p, range, start, end) {
  const starts = [];
  const ends = [];
  p.lines.forEach((l, i) => {
    if (l.trim() === start) starts.push(i);
    if (l.trim() === end) ends.push(i);
  });
  if (starts.length !== 1 || ends.length !== 1) return `the report needs one ${start} and one ${end}; it has ${starts.length} and ${ends.length}`;
  const from = starts[0];
  const to = ends[0];
  if (to <= from) return `${end} comes before ${start}`;
  if (!range || from < range[0] || to >= range[1]) return `the ${start} block is not inside its section`;
  return { from, to };
}
async function loadReport(mdPath, opts = {}) {
  const slug = slugOf(mdPath);
  const reportDir = dirname2(mdPath);
  const paths = reportPaths(reportDir, slug);
  let text;
  try {
    text = await readFile(mdPath, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.report.read", `Cannot read the report ${mdPath}`, { cause, context: { path: mdPath } });
  }
  let manifest = null;
  let manifestErrors = [];
  let planRaw = null;
  try {
    planRaw = await readFile(paths.plan, "utf8");
  } catch (cause) {
    if (cause.code !== "ENOENT") throw new LaunchwrightError("qa.report.read", `Cannot read the plan ${paths.plan}`, { cause });
    manifestErrors = [`the plan ${basename(paths.plan)} is missing`];
  }
  if (planRaw !== null) {
    let parsed = null;
    try {
      parsed = JSON.parse(planRaw);
    } catch (cause) {
      manifestErrors = [`the plan ${basename(paths.plan)} is not JSON: ${cause.message}`];
    }
    if (manifestErrors.length === 0) {
      manifestErrors = validateManifest(parsed, opts);
      if (manifestErrors.length === 0) manifest = parsed;
    }
  }
  return { mdPath, reportDir, slug, text, manifest, manifestErrors, results: await readResults(paths.results), ledger: await readLedger(paths.ledger) };
}
async function stillSizes(reportDir, entries) {
  const out = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (e.kind !== "screenshot" && e.kind !== "step") continue;
    let bytes = null;
    try {
      bytes = await readFile(join5(reportDir, e.path));
    } catch (cause) {
      if (cause.code !== "ENOENT") throw new LaunchwrightError("qa.report.read", `Cannot read ${e.path}`, { cause });
    }
    out.set(e.path, bytes ? pngSize(bytes) : null);
  }
  return out;
}
async function renderEvidence(r) {
  const entries = r.ledger?.entries ?? [];
  const sizes = await stillSizes(r.reportDir, entries);
  return evidenceSection({ slug: r.slug, manifest: r.manifest, results: r.results, entries, sizeOf: (p) => sizes.get(p) ?? null });
}
function putBlock(lines, start, end, body, section) {
  const p = parse(lines.join("\n"));
  const block = findBlock(p, sectionRange(p, section), start, end);
  if (typeof block !== "string") return [...lines.slice(0, block.from + 1), ...body.split("\n"), ...lines.slice(block.to)];
  if (lines.some((l) => l.trim() === start || l.trim() === end)) {
    throw new LaunchwrightError("qa.report.block", `The report markers are broken: ${block}`);
  }
  const range = sectionRange(p, section);
  if (!range) throw new LaunchwrightError("qa.report.section", `The report has no section ${section}`);
  let at = range[1];
  while (at > range[0] && lines[at - 1].trim() === "") at -= 1;
  return [...lines.slice(0, at), "", start, ...body.split("\n"), end, "", ...lines.slice(range[1])];
}
function putField(lines, field, value) {
  const p = parse(lines.join("\n"));
  const at = p.fields.get(field)?.line;
  if (at !== void 0) return lines.map((l, i) => i === at ? `${field}: ${value}` : l);
  const last = Math.max(...[...p.fields.values()].map((f) => f.line), lines.findIndex((l) => /^#\s/.test(l)));
  return [...lines.slice(0, last + 1), `${field}: ${value}`, ...lines.slice(last + 1)];
}
async function updateReport(mdPath, opts = {}) {
  const r = await loadReport(mdPath, opts);
  if (!r.manifest) {
    throw new LaunchwrightError("qa.report.plan", `The plan of ${mdPath} is invalid:
  ${r.manifestErrors.join("\n  ")}`, { context: { errors: r.manifestErrors } });
  }
  const entries = r.ledger?.entries ?? [];
  const input = { manifest: r.manifest, results: r.results, entries, ...opts.world ? { world: opts.world } : {} };
  let lines = r.text.split("\n");
  lines = putBlock(lines, EVIDENCE_START, EVIDENCE_END, await renderEvidence({ ...r, manifest: r.manifest }), 3);
  lines = putBlock(lines, COVERAGE_START, COVERAGE_END, coverageSection(input), 5);
  const status = computeStatus(input);
  lines = putField(lines, "Status", status);
  lines = putField(lines, "Legs", legsLine(r.manifest, r.results));
  lines = putField(lines, "Coverage", coverageLine(input));
  await writeFile2(mdPath, lines.join("\n"));
  return status;
}
function reportSkeleton(input) {
  const out = [`# QA: ${input.title}`, "", `Date: ${input.date}`, "Status: planned", `${input.source.field}: ${input.source.value}`, "Legs: none ran", "Coverage: 0 row legs", ""];
  for (const s of REPORT_SECTIONS) {
    out.push(`## ${s.n} ${s.title}`, "");
    if (s.n === 3) out.push(EVIDENCE_START, EVIDENCE_END, "");
    if (s.n === 5) out.push(COVERAGE_START, COVERAGE_END, "");
  }
  return out.join("\n");
}

// src/testing/report-fixture.mts
function patternPng(width, height) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = (x * 7 + y * 13) % 256;
      rgba[i + 1] = x * 3 % 256;
      rgba[i + 2] = y * 5 % 256;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(width, height, rgba);
}
function uniformPng(width, height, gray = 0) {
  const rgba = new Uint8Array(width * height * 4).fill(gray);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return encodePng(width, height, rgba);
}
async function writeReportFixture(reportDir, opts = {}) {
  const slug = opts.slug ?? "2026-01-01-fixture";
  const rows = opts.rows ?? [{ id: "home.guest", legs: ["desktop", "mobile-web"] }];
  const paths = reportPaths(reportDir, slug);
  const manifest = {
    title: "fixture",
    generated: "2026-01-01T00:00:00.000Z",
    range: "abc1234..def5678",
    shots: rows.map((r) => {
      const [screen, state] = r.id.split(".");
      return { id: r.id, screen, state, source: r.source ?? ["commit:abc1234"], legs: r.legs, route: `/${screen}`, fixture: { arm: [] }, settle: { busy: true }, expect: `${screen} shows ${state}` };
    })
  };
  await mkdir3(paths.assets, { recursive: true });
  await writeFile3(paths.plan, `${JSON.stringify(manifest, null, 2)}
`);
  const entries = [];
  for (const row of rows) {
    for (const leg of row.legs) {
      const pair = opts.pairs?.[`${row.id}@${leg}`] ?? {};
      const status = pair.status ?? "passed";
      if (pair.files !== false && (status === "passed" || status === "failed")) {
        const rel = evidencePath(slug, leg, row.id, "screenshot");
        await mkdir3(dirname3(join6(reportDir, rel)), { recursive: true });
        await writeFile3(join6(reportDir, rel), leg === "desktop" ? patternPng(64, 40) : patternPng(40, 64));
        entries.push(
          await ledgerEntry(reportDir, {
            path: rel,
            kind: "screenshot",
            capturedAt: "2026-01-01T00:00:00.000Z",
            commit: "abc1234",
            dirty: false,
            leg,
            target: "playwright",
            provenance: "live",
            row: row.id,
            attempt: 1
          })
        );
      }
      await appendResult(paths.results, {
        row: row.id,
        leg,
        status,
        failures: pair.failures ?? [],
        attempts: status === "passed" || status === "failed" ? 1 : 0,
        ms: 10,
        ...pair.reason !== void 0 ? { reason: pair.reason } : {}
      });
    }
  }
  await appendLedger(reportDir, slug, entries);
  await writeFile3(paths.md, reportSkeleton({ title: "fixture", date: "2026-01-01", source: opts.header ?? { field: "Range", value: "abc1234..def5678" } }));
  await updateReport(paths.md);
  return { mdPath: paths.md, slug };
}
var FIXTURE_ISSUE = "tg-fixture-7";
async function writeIssueReportFixture(root, opts = {}) {
  const reportDir = join6(root, "docs/qa");
  const issue = await writeIssue(root, {
    id: FIXTURE_ISSUE,
    source: "telegram",
    ref: "chat 7, message 1",
    title: "The bot stays silent",
    reportedAt: "2026-01-01T00:00:00.000Z",
    reporter: "fixture reporter",
    text: "I send /start and nothing comes back.",
    thread: [],
    media: [{ from: "tg:7/1", kind: "image", mime: "image/png", name: "chat.png", data: patternPng(40, 64) }]
  });
  const { mdPath, slug } = await writeReportFixture(reportDir, {
    rows: [
      { id: "home.guest", legs: ["desktop"] },
      { id: "bot.silent", legs: ["desktop"], source: [`issue:${FIXTURE_ISSUE}`] }
    ],
    header: { field: "Issues", value: FIXTURE_ISSUE },
    ...opts
  });
  const image = issue.attachments[0]?.path;
  return { mdPath, slug, reportDir, issue: FIXTURE_ISSUE, link: `../../${INTAKE_DIR}/${FIXTURE_ISSUE}/${image}` };
}
export {
  BROWSERS_PATH,
  CONTRACT_BASE,
  FIXTURE_ISSUE,
  contractFakeRoutes,
  createFakeTarget,
  headlessShell,
  patternPng,
  serveContractSite,
  targetContract,
  targetHarness,
  uniformPng,
  writeIssueReportFixture,
  writeReportFixture
};
//# sourceMappingURL=testing.js.map