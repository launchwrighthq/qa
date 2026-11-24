import {
  reportSkeleton,
  updateReport
} from "./chunk-5VUYK3ZQ.js";
import "./chunk-JYL7CKWM.js";
import {
  writeIssue
} from "./chunk-KCJ7A64B.js";
import "./chunk-B7UB2WOJ.js";
import "./chunk-RFUDK5EX.js";
import {
  FAKE_CLIP,
  QA_TARGET_SPEC_VERSION,
  createFakeTarget
} from "./chunk-APRIQSSG.js";
import {
  encodePng,
  pngSize
} from "./chunk-OF544TQR.js";
import {
  appendLedger,
  appendResult,
  ledgerEntry,
  reportPaths
} from "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import {
  evidencePath
} from "./chunk-TQCRYULZ.js";
import {
  INTAKE_DIR
} from "./chunk-SA2YN55L.js";
import {
  moduleFixture
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

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
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}${CONTRACT_BASE}`,
    close: () => new Promise((resolve, reject) => {
      server.closeAllConnections();
      server.close((err) => err ? reject(err) : resolve());
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
import { mkdir, writeFile } from "fs/promises";
import { dirname, join as join4 } from "path";
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
  await mkdir(paths.assets, { recursive: true });
  await writeFile(paths.plan, `${JSON.stringify(manifest, null, 2)}
`);
  const entries = [];
  for (const row of rows) {
    for (const leg of row.legs) {
      const pair = opts.pairs?.[`${row.id}@${leg}`] ?? {};
      const status = pair.status ?? "passed";
      if (pair.files !== false && (status === "passed" || status === "failed")) {
        const rel = evidencePath(slug, leg, row.id, "screenshot");
        await mkdir(dirname(join4(reportDir, rel)), { recursive: true });
        await writeFile(join4(reportDir, rel), leg === "desktop" ? patternPng(64, 40) : patternPng(40, 64));
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
  await writeFile(paths.md, reportSkeleton({ title: "fixture", date: "2026-01-01", source: opts.header ?? { field: "Range", value: "abc1234..def5678" } }));
  await updateReport(paths.md);
  return { mdPath: paths.md, slug };
}
var FIXTURE_ISSUE = "tg-fixture-7";
async function writeIssueReportFixture(root, opts = {}) {
  const reportDir = join4(root, "docs/qa");
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