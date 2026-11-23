import {
  hashFile,
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/ledger.mts
import { mkdir, rename, rm, stat, writeFile } from "fs/promises";
import { dirname, join } from "path";
var LEDGER_FILE = "evidence.lock.json";
var RESULTS_FILE = "results.jsonl";
var LEDGER_FORMAT = 1;
var assetsRel = (slug) => `assets/${slug}`;
function reportPaths(reportDir, slug) {
  return {
    md: join(reportDir, `${slug}.md`),
    plan: join(reportDir, `${slug}.shots.json`),
    assets: join(reportDir, assetsRel(slug)),
    ledger: join(reportDir, assetsRel(slug), LEDGER_FILE),
    results: join(reportDir, assetsRel(slug), RESULTS_FILE),
    html: join(reportDir, "dist", `${slug}.html`)
  };
}
async function fileDigest(path) {
  const sha256 = await hashFile(path);
  return { sha256, bytes: (await stat(path)).size };
}
async function ledgerEntry(reportDir, facts) {
  checkEntryPath(facts.path);
  const { sha256, bytes } = await fileDigest(join(reportDir, facts.path));
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
async function dropRowLeg(reportDir, slug, row, leg) {
  const path = reportPaths(reportDir, slug).ledger;
  const current = await readLedger(path);
  if (!current) return;
  const stale = current.entries.filter((e) => e.row === row && e.leg === leg);
  if (stale.length === 0) return;
  for (const e of stale) {
    checkEntryPath(e.path);
    if (!e.path.startsWith(`${assetsRel(slug)}/`)) {
      throw new LaunchwrightError("qa.ledger.path", `Ledger path ${e.path} is outside ${assetsRel(slug)}`, { context: { path: e.path } });
    }
  }
  for (const e of stale) await rm(join(reportDir, e.path), { force: true });
  await writeLedger(path, { ...current, entries: current.entries.filter((e) => !(e.row === row && e.leg === leg)) });
}
async function verifyLedger(reportDir, entries) {
  const out = [];
  for (const e of entries) {
    const file = join(reportDir, e.path);
    const where = `row ${e.row}, leg ${e.leg}`;
    try {
      await stat(file);
    } catch (cause) {
      if (cause.code !== "ENOENT") throw new LaunchwrightError("qa.ledger.read", `Cannot read ${file}`, { cause });
      out.push({ code: "missing-file", path: e.path, row: e.row, leg: e.leg, message: `${e.path} is in the ledger and missing on disk (${where})` });
      continue;
    }
    const actual = await fileDigest(file);
    if (actual.sha256 !== e.sha256 || actual.bytes !== e.bytes) {
      out.push({ code: "hash", path: e.path, row: e.row, leg: e.leg, message: `${e.path} does not match its ledger hash (${where})` });
    }
  }
  return out;
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

export {
  LEDGER_FILE,
  RESULTS_FILE,
  reportPaths,
  ledgerEntry,
  readLedger,
  appendLedger,
  dropRowLeg,
  verifyLedger,
  readResults,
  appendResult,
  pairKey
};
//# sourceMappingURL=chunk-3OHR7PBT.js.map