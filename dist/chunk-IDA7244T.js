import {
  TEMPLATE_DIR,
  inline,
  plain,
  renderBody
} from "./chunk-JYL7CKWM.js";
import {
  findingProblems,
  parseFindings,
  tallyFindings
} from "./chunk-RFUDK5EX.js";
import {
  COVERAGE_END,
  COVERAGE_START,
  EVIDENCE_END,
  EVIDENCE_START,
  NOT_COVERED_LINE,
  blankFailure,
  coverageLine,
  coverageSection,
  evidenceSection,
  legsLine,
  plannedPairs,
  pngSize
} from "./chunk-XZN5EDSR.js";
import {
  LEDGER_FILE,
  RESULTS_FILE,
  pairKey,
  readLedger,
  readResults,
  reportPaths,
  verifyLedger
} from "./chunk-3OHR7PBT.js";
import {
  validateManifest
} from "./chunk-H3DGWSMZ.js";
import {
  INTAKE_DIR,
  REPORT_STATUSES
} from "./chunk-SA2YN55L.js";
import {
  pathKind,
  readTextOrNull
} from "./chunk-GZ2IEQDP.js";
import {
  computeScore,
  renderScoreBreakdown,
  renderScoreGauge,
  scoreRows
} from "./chunk-2VQTE6KZ.js";
import {
  escapeHtml
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/services/report.mts
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "path";

// src/services/report-score.mts
function runFacts(input) {
  const pairs = plannedPairs(input.manifest);
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const provenances = /* @__PURE__ */ new Map();
  const withFile = /* @__PURE__ */ new Set();
  for (const e of input.entries) {
    const key = pairKey(e.row, e.leg);
    const set = provenances.get(key) ?? /* @__PURE__ */ new Set();
    set.add(e.provenance);
    provenances.set(key, set);
    if (e.kind === "screenshot" || e.kind === "step" || e.kind === "video") withFile.add(key);
  }
  const facts = { pairs: pairs.length, covered: 0, evidenced: 0, ran: 0, pageErrors: 0 };
  for (const { shot, leg } of pairs) {
    const key = pairKey(shot.id, leg);
    const provs = provenances.get(key);
    if (provs?.has("live") || provs?.has("mounted")) facts.covered += 1;
    const r = latest.get(key);
    if (r) facts.ran += 1;
    if (r?.status === "passed" && withFile.has(key)) facts.evidenced += 1;
    if (r?.failures.includes("page-error")) facts.pageErrors += 1;
  }
  return facts;
}
function inputOf(facts, findings) {
  if (facts.pairs === 0) return {};
  const out = { coverage: facts.covered / facts.pairs, evidence: facts.evidenced / facts.pairs };
  if (facts.ran > 0) out.consoleErrors = facts.pageErrors;
  if (facts.ran > 0 && findings) out.findings = findings.confirmed;
  return out;
}
function findingsNote(findings, ran) {
  if (!findings) return "untested: the section 4 findings were not read";
  if (ran === 0) return "untested: no row ran";
  const c = findings.confirmed;
  const total = c.critical + c.high + c.medium + c.low;
  const levels = ["critical", "high", "medium", "low"].filter((s) => c[s] > 0).map((s) => `${c[s]} ${s}`);
  const confirmed = total === 0 ? "no CONFIRMED finding" : `${total} CONFIRMED (${levels.join(", ")})`;
  return findings.suspected > 0 ? `${confirmed}; ${findings.suspected} SUSPECTED, not scored` : confirmed;
}
function reportScore(input, weights = {}) {
  const facts = runFacts(input);
  const scoreInput = inputOf(facts, input.findings);
  if (Object.keys(scoreInput).length === 0) return null;
  const result = computeScore(scoreInput, weights);
  const notRun = "untested: no row ran";
  const notes = {
    findings: findingsNote(input.findings, facts.ran),
    console: facts.ran === 0 ? notRun : `${facts.pageErrors} of ${facts.ran} row legs that ran had a page error`,
    coverage: `${facts.covered} of ${facts.pairs} row legs live or mounted`,
    evidence: `${facts.evidenced} of ${facts.pairs} row legs passed with a file`,
    accessibility: "untested: the ledger holds no accessibility finding",
    performance: "untested: the ledger holds no timing measure"
  };
  return { input: scoreInput, result, rows: scoreRows(result, weights, notes) };
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
var blockText = (lines, from, to) => lines.slice(from + 1, to).join("\n").trim();
function references(lines) {
  const out = [];
  let fence = false;
  lines.forEach((raw, i) => {
    if (raw.startsWith("```")) {
      fence = !fence;
      return;
    }
    if (fence) return;
    const line = raw.replace(/`[^`]*`/g, "");
    const rest = line.replace(/!\[[^\]]*\]\(([^)]*)\)/g, (_m, url) => {
      out.push({ url: url.trim(), image: true, line: i });
      return "";
    });
    for (const m of rest.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) {
      const url = m[1].trim();
      if (url.startsWith("assets/") || url.startsWith("./assets/") || url.startsWith("../") || url.includes(INTAKE_DIR)) out.push({ url, image: false, line: i });
    }
  });
  return out;
}
function rewriteLinks(lines, fn) {
  let fence = false;
  return lines.map((raw) => {
    if (raw.startsWith("```")) {
      fence = !fence;
      return raw;
    }
    if (fence) return raw;
    return raw.split(/(`[^`]*`)/).map((piece, i) => i % 2 === 1 ? piece : piece.replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, (m, alt, url) => fn({ alt, url: url.trim() }) ?? m)).join("");
  });
}
function intakeTarget(fromDir, root, url) {
  if (url === "" || isAbsolute(url) || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#")) return null;
  const rel = relative(resolve(root, INTAKE_DIR), resolve(fromDir, url)).split(sep).join("/");
  const m = /^([A-Za-z0-9._-]+)\/assets\/([^/]+)$/.exec(rel);
  if (!m || m[1] === ".." || m[2] === "..") return null;
  return { id: m[1], file: `assets/${m[2]}` };
}
var intakeStaysLocal = (id) => `reporter media of issue ${id} stays local`;
function withoutIntakeLinks(text, reportDir, root) {
  return rewriteLinks(text.split("\n"), ({ url }) => {
    const target = intakeTarget(reportDir, root, url);
    return target ? intakeStaysLocal(target.id) : null;
  }).join("\n");
}
var ISSUE_STATEMENT = /^- issue ([A-Za-z0-9._-]+): (REPRODUCED|NOT REPRODUCED)$/;
var STATEMENT_LIKE = /^- issue \S+:/;
function reportFindings(text) {
  const p = parse(text);
  const s4 = sectionRange(p, 4);
  return s4 ? parseFindings(p.lines, s4[0], s4[1]) : [];
}
function headerIssues(p) {
  return (p.fields.get("Issues")?.value ?? "").split(/[\s,]+/).filter(Boolean);
}
async function readIntakeRecord(root, id) {
  const file = join(root, INTAKE_DIR, id, "issue.json");
  const text = await readTextOrNull(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError("qa.report.read", `The intake record ${INTAKE_DIR}/${id}/issue.json is not JSON`, { cause, context: { id } });
  }
}
async function walk(dir) {
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.report.read", `Cannot list ${dir}`, { cause });
  }
  const out = [];
  for (const d of names) {
    if (d.isDirectory()) for (const f of await walk(join(dir, d.name))) out.push(`${d.name}/${f}`);
    else out.push(d.name);
  }
  return out.sort();
}
async function loadReport(mdPath, opts = {}) {
  const slug = slugOf(mdPath);
  const reportDir = dirname(mdPath);
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
      bytes = await readFile(join(reportDir, e.path));
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
async function intakeLinkProblem(input) {
  const { root, target, url, line } = input;
  const at = `line ${line + 1}: ${url}`;
  if (!input.inSection4) return `${at} links reporter media of issue ${target.id} outside section 4`;
  if (!input.issues.includes(target.id)) return `${at} links issue ${target.id}, which the Issues: header line does not list`;
  const record = await readIntakeRecord(root, target.id);
  if (!record) return `${at} links issue ${target.id}, which has no record in ${INTAKE_DIR}/`;
  if (!record.attachments.some((a) => a.path === target.file)) return `${at} is not an attachment of issue ${target.id} in its issue.json`;
  if (!("missing" !== await pathKind(join(root, INTAKE_DIR, target.id, target.file)))) return `${at} is missing from ${INTAKE_DIR}/${target.id}/`;
  return null;
}
function issueStatementProblems(p, manifest, entries) {
  const out = [];
  const issues = headerIssues(p);
  const s4 = sectionRange(p, 4);
  const stated = /* @__PURE__ */ new Map();
  let fence = false;
  if (s4) for (let i = s4[0]; i < s4[1]; i += 1) {
    const line = p.lines[i].trim();
    if (line.startsWith("```")) fence = !fence;
    if (fence) continue;
    const m = ISSUE_STATEMENT.exec(line);
    if (!m) {
      if (STATEMENT_LIKE.test(line)) out.push({ code: "issue-statement", message: `line ${i + 1}: "${line}" is not "- issue <id>: REPRODUCED" or "- issue <id>: NOT REPRODUCED"` });
      continue;
    }
    const id = m[1];
    if (stated.has(id)) out.push({ code: "issue-statement", message: `line ${i + 1}: issue ${id} has a second statement in section 4` });
    stated.set(id, i);
  }
  const withFiles = new Set(entries.map((e) => e.row));
  const planIssues = /* @__PURE__ */ new Set([...manifest.issues ?? [], ...manifest.shots.flatMap((s) => s.source.filter((x) => x.startsWith("issue:")).map((x) => x.slice(6)))]);
  for (const id of planIssues) {
    if (!issues.includes(id)) out.push({ code: "issue-statement", message: `the plan names issue ${id}, and the header has no Issues: line that lists it` });
  }
  for (const id of issues) {
    if (!stated.has(id)) out.push({ code: "issue-statement", message: `issue ${id} of the Issues: line has no section 4 line "- issue ${id}: REPRODUCED" or "- issue ${id}: NOT REPRODUCED"` });
  }
  for (const [id, line] of stated) {
    if (!issues.includes(id)) {
      out.push({ code: "issue-unknown", message: `line ${line + 1}: issue ${id} is not on the Issues: header line` });
      continue;
    }
    const rows = manifest.shots.filter((s) => s.source.includes(`issue:${id}`)).map((s) => s.id);
    if (!rows.some((row) => withFiles.has(row))) {
      out.push({ code: "issue-evidence", message: `line ${line + 1}: issue ${id} has a statement and no ledger evidence. No row with source issue:${id} has a file in the ledger${rows.length === 0 ? ", and the plan has no such row" : ""}.` });
    }
  }
  return out;
}
async function checkReport(mdPath, opts = {}) {
  const r = await loadReport(mdPath, opts);
  const p = parse(r.text);
  const problems = [];
  const add = (code, message, where = {}) => {
    problems.push({ code, message, ...where });
  };
  if (p.title === null) add("header", 'the report has no "# " title line');
  for (const field of ["Date", "Status", "Legs", "Coverage"]) if (!p.fields.has(field)) add("header", `the header line ${field}: is missing`);
  if (!p.fields.has("Range") && !p.fields.has("Spec") && !p.fields.has("Issues")) add("header", "the header needs a Range:, Spec: or Issues: line");
  const order = [];
  for (const { n } of REPORT_SECTIONS) {
    const at = p.sections.get(n) ?? [];
    if (at.length === 0) add("section", `section ${n} is missing: "## ${n} ..."`);
    if (at.length > 1) add("section", `section ${n} appears ${at.length} times`);
    if (at.length > 0) order.push(at[0]);
  }
  if (order.some((v, i) => i > 0 && v < order[i - 1])) add("section", "the sections are not in the order 1 to 6");
  for (const message of findingProblems(reportFindings(r.text))) add("finding-severity", message);
  for (const e of r.manifestErrors) add("plan", e);
  if (!r.manifest) return problems;
  const manifest = r.manifest;
  const entries = r.ledger?.entries ?? [];
  if (r.ledger && r.ledger.slug !== r.slug) add("ledger", `the ledger names slug ${r.ledger.slug}, not ${r.slug}`);
  const ledgerProblems = await verifyLedger(r.reportDir, entries);
  for (const lp of ledgerProblems) add(lp.code, lp.message, { row: lp.row, leg: lp.leg });
  const listed = new Set(entries.map((e) => e.path));
  const assetsRel = `assets/${r.slug}`;
  for (const file of await walk(join(r.reportDir, assetsRel))) {
    if (file === LEDGER_FILE || file === RESULTS_FILE) continue;
    if (!listed.has(`${assetsRel}/${file}`)) add("unlisted-file", `${assetsRel}/${file} is in the report folder and not in the ledger. Only the runner captures evidence.`);
  }
  const block = findBlock(p, sectionRange(p, 3), EVIDENCE_START, EVIDENCE_END);
  const inBlock = /* @__PURE__ */ new Map();
  if (typeof block === "string") add("block", block);
  else {
    const fresh = await renderEvidence({ ...r, manifest });
    const current = blockText(p.lines, block.from, block.to);
    if (current !== fresh.trim()) {
      const a = current.split("\n");
      const b = fresh.trim().split("\n");
      let i = 0;
      while (i < a.length && a[i] === b[i]) i += 1;
      add("block-edited", `the generated section 3 differs from a fresh render of the ledger at report line ${block.from + 2 + i}. Run lw qa report update, never edit the block.`);
    }
    for (const ref of references(p.lines.slice(block.from + 1, block.to))) inBlock.set(ref.url, (inBlock.get(ref.url) ?? 0) + 1);
  }
  for (const e of entries) {
    const n = inBlock.get(e.path) ?? 0;
    if (typeof block !== "string" && n === 0) add("unembedded", `${e.path} is in the ledger and not embedded in section 3`, { row: e.row, leg: e.leg });
    if (n > 1) add("embedded-twice", `${e.path} is embedded ${n} times in section 3`, { row: e.row, leg: e.leg });
  }
  const s4 = sectionRange(p, 4);
  const issues = headerIssues(p);
  for (const ref of references(p.lines)) {
    const target = opts.root === void 0 ? null : intakeTarget(r.reportDir, opts.root, ref.url);
    if (target && opts.root !== void 0) {
      const inSection4 = s4 !== null && ref.line >= s4[0] && ref.line < s4[1];
      const problem = await intakeLinkProblem({ root: opts.root, target, url: ref.url, line: ref.line, inSection4, issues });
      if (problem) add("intake-link", problem);
    } else if (!ref.url.startsWith(`${assetsRel}/`) || ref.url.split("/").includes("..")) {
      add("embed-outside", `line ${ref.line + 1}: ${ref.url} is outside ${assetsRel}/`);
    } else if (!listed.has(ref.url)) {
      add("embed-unledgered", `line ${ref.line + 1}: ${ref.url} has no ledger entry`);
    }
  }
  const status = computeStatus({ manifest, results: r.results, entries });
  const written = p.fields.get("Status")?.value.split(/\s/)[0] ?? "";
  if (p.fields.has("Status") && written !== status) {
    add("status", `Status: ${written || "(empty)"} differs from the computed status ${status}${REPORT_STATUSES.includes(written) ? "" : `. Statuses: ${REPORT_STATUSES.join(", ")}`}`);
  }
  if (status !== "planned") {
    problems.push(...issueStatementProblems(p, manifest, entries));
    const s5 = sectionRange(p, 5);
    const reasons = /* @__PURE__ */ new Set();
    if (s5) for (const line of p.lines.slice(s5[0], s5[1])) {
      const m = NOT_COVERED_LINE.exec(line.trim());
      if (m) reasons.add(pairKey(m[1], m[2]));
    }
    const withFiles = new Set(entries.map((e) => pairKey(e.row, e.leg)));
    for (const { shot, leg } of plannedPairs(manifest)) {
      const key = pairKey(shot.id, leg);
      if (!withFiles.has(key) && !reasons.has(key)) {
        add("no-evidence", `row ${shot.id} on leg ${leg} has no ledger evidence and no section 5 line "- \`${shot.id}\` on \`${leg}\`: <reason>"`, { row: shot.id, leg });
      }
    }
    const latest = /* @__PURE__ */ new Map();
    for (const res of r.results) latest.set(pairKey(res.row, res.leg), res);
    const broken = new Set(ledgerProblems.map((x) => x.path));
    for (const e of entries) {
      if (e.kind !== "screenshot" && e.kind !== "step" || broken.has(e.path)) continue;
      if (latest.get(pairKey(e.row, e.leg))?.status !== "passed") continue;
      let blank;
      try {
        blank = blankFailure(await readFile(join(r.reportDir, e.path)), opts.blankStdDev ?? 2);
      } catch (cause) {
        if (!isCodedError(cause) || cause.code !== "qa.png.unsupported") throw cause;
        add("blank", `${e.path} cannot be read as a PNG (${cause.message}), and its row passed (row ${e.row}, leg ${e.leg})`, { row: e.row, leg: e.leg });
        continue;
      }
      if (blank) add("blank", `${e.path} is blank and its row passed (row ${e.row}, leg ${e.leg})`, { row: e.row, leg: e.leg });
    }
  }
  return problems;
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
  await writeFile(mdPath, lines.join("\n"));
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
var RENDERER_DIR = TEMPLATE_DIR;
function loadedScore(loaded, weights = {}) {
  const entries = loaded.ledger?.entries ?? [];
  if (!loaded.manifest || loaded.results.length === 0 && entries.length === 0) return null;
  return reportScore({ manifest: loaded.manifest, results: loaded.results, entries, findings: tallyFindings(reportFindings(loaded.text)) }, weights);
}
async function scoreReport(mdPath, opts = {}) {
  return loadedScore(await loadReport(mdPath, opts), opts.score?.weights);
}
function scoreBlock(loaded, opts) {
  const s = loadedScore(loaded, opts.weights);
  if (!s) return "";
  const { score, confidence } = s.result;
  const percent = Math.round(confidence * 100);
  const gauge = renderScoreGauge(score, { size: 132, label: `${percent}%`, ...opts.gaugeColor ? { color: opts.gaugeColor } : {} });
  return [
    '<div class="qa-score" style="margin:0 0 2.4rem">',
    '<div style="display:flex;align-items:center;gap:1.1rem;flex-wrap:wrap">',
    `<div style="flex:0 0 auto">${gauge}</div>`,
    `<p style="margin:0;max-width:34ch;color:var(--ink-soft)">QA score <strong style="color:var(--ink)">${score}</strong> of 100. The weighted score averages the counted dimensions below. Confidence ${percent}% comes from the live coverage and the evidence.</p>`,
    "</div>",
    `<div style="overflow-x:auto">${renderScoreBreakdown(s.rows)}</div>`,
    "</div>",
    ""
  ].join("\n");
}
async function renderReport(mdPath, rendererDir, root, opts = {}) {
  const slug = slugOf(mdPath);
  const template = join(rendererDir, "spec-template.html");
  let shell;
  try {
    shell = await readFile(template, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.report.renderer", `The page template of the spec renderer is not at ${template}. Reinstall @launchwrighthq/qa.`, { cause, context: { template } });
  }
  const loaded = await loadReport(mdPath, opts);
  const text = loaded.text;
  const p = parse(text);
  if (p.title === null) throw new LaunchwrightError("qa.report.header", `${mdPath}: the report has no "# " title line`);
  const reportDir = dirname(mdPath);
  const body = rewriteLinks(p.lines.slice(p.bodyStart), ({ alt, url }) => intakeTarget(reportDir, root, url) === null ? null : `[${alt || "reporter media"}](../${url})`);
  let rendered;
  try {
    rendered = renderBody({ lines: body, source: mdPath, bodyStart: p.bodyStart, assetPrefix: "../" });
  } catch (cause) {
    throw new LaunchwrightError("qa.report.render", `${mdPath}: ${cause.message}`, { cause });
  }
  const consumed = new Set([...p.fields.values()].map((f) => f.line));
  const standfirst = p.lines.slice(0, p.bodyStart).filter((l, i) => !consumed.has(i) && !/^#\s/.test(l)).join("\n").split(/\n\s*\n/).map((para) => para.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
  const field = (f) => p.fields.get(f)?.value ?? null;
  const subject = field("Spec") ?? field("Issues");
  const range = field("Range");
  const values = /* @__PURE__ */ new Map([
    ["NAV", rendered.toc.map((e) => `<li><a href="#${e.anchor}"><span class="n">${e.eyebrow}</span>${escapeHtml(plain(e.title))}</a></li>`).join("")],
    ["BODY", scoreBlock(loaded, opts.score ?? {}) + rendered.body],
    ["TITLE", escapeHtml(p.title)],
    ["DATE", escapeHtml(field("Date") ?? slug.slice(0, 10))],
    ["STATUS", escapeHtml(field("Status") ?? "")],
    ["SUBJECT", subject === null ? "" : escapeHtml(subject)],
    ["RANGE", range === null ? "" : escapeHtml(range)],
    ["STANDFIRST", inline(standfirst, "../")],
    ["KIND", "QA REPORT"],
    ["KIND_CLASS", "kind-spec"],
    ["SOURCE", escapeHtml(relative(dirname(mdPath), mdPath))]
  ]);
  const chip = (v) => v === "" ? "" : `<li class="chip">${v}</li>`;
  const html = shell.replace(/<li class="chip">\{\{(STATUS|SUBJECT|RANGE)\}\}<\/li>|\{\{(\w+)\}\}/g, (_m, chipName, name) => {
    if (chipName) return chip(values.get(chipName));
    const value = values.get(name);
    if (value === void 0) throw new LaunchwrightError("qa.report.template", `The renderer template has {{${name}}}, which the QA render does not fill`);
    return value;
  });
  const out = reportPaths(dirname(mdPath), slug).html;
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  return out;
}

export {
  reportScore,
  computeStatus,
  intakeTarget,
  intakeStaysLocal,
  withoutIntakeLinks,
  reportFindings,
  loadReport,
  checkReport,
  updateReport,
  reportSkeleton,
  RENDERER_DIR,
  scoreReport,
  renderReport
};
//# sourceMappingURL=chunk-IDA7244T.js.map