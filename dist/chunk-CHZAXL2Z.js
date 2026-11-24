import {
  computeStatus,
  loadReport,
  reportFindings,
  reportScore
} from "./chunk-5VUYK3ZQ.js";
import {
  tallyFindings
} from "./chunk-RFUDK5EX.js";
import {
  plannedPairs,
  resultText
} from "./chunk-OF544TQR.js";
import {
  pairKey
} from "./chunk-3OHR7PBT.js";
import {
  renderScoreBreakdown,
  renderScoreGauge
} from "./chunk-2VQTE6KZ.js";
import {
  expectText
} from "./chunk-TQCRYULZ.js";
import {
  escapeHtml
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/viewer.mts
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
var MEDIA_PREFIX = "../../";
var viewerDirName = (slug) => `${slug}-viewer`;
var esc = (text) => escapeHtml(text);
var mediaSrc = (path) => esc(MEDIA_PREFIX + path);
var stateAnchor = (rowId) => `state-${rowId.replace(/\./g, "-")}`;
function stepOf(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? Number(m[1]) : null;
}
function actLabel(act) {
  const parts = [act.kind];
  if (act.target) parts.push(act.target);
  else if (act.key) parts.push(act.key);
  else if (act.text) parts.push(`"${act.text}"`);
  else if (act.why) parts.push(act.why);
  return parts.join(" ");
}
function isDeviceLeg(entries) {
  return entries.some((e) => e.device !== void 0 || /^(android|ios)/i.test(e.target));
}
function blank(label) {
  return `<div class="qa-blank" role="note"><span class="qa-blank-mark">no evidence</span> ${esc(label)}</div>`;
}
function lastAttempt(pairEntries) {
  const maxAttempt = pairEntries.reduce((n, e) => Math.max(n, e.attempt), 0);
  return pairEntries.filter((e) => e.attempt === maxAttempt);
}
function entriesByPair(entries) {
  const byPair = /* @__PURE__ */ new Map();
  for (const e of entries) {
    const key = pairKey(e.row, e.leg);
    const list = byPair.get(key);
    if (list) list.push(e);
    else byPair.set(key, [e]);
  }
  return byPair;
}
function legViews(shot, leg, pairEntries) {
  const current = lastAttempt(pairEntries);
  const screenshot = current.find((e) => e.kind === "screenshot");
  const videos = current.filter((e) => e.kind === "video");
  const stepEntries = current.filter((e) => e.kind === "step");
  const links = current.filter((e) => e.kind === "trace" || e.kind === "log" || e.kind === "ui");
  const views = [];
  if (screenshot) {
    views.push({ id: "screen", label: "Screen", body: `<img src="${mediaSrc(screenshot.path)}" alt="${esc(`${leg} ${shot.screen} ${shot.state}`)}" loading="lazy">` });
  }
  const acts = shot.act ?? [];
  const usedSteps = /* @__PURE__ */ new Set();
  acts.forEach((act, i) => {
    const stepNum = i + 1;
    usedSteps.add(stepNum);
    const entry = stepEntries.find((e) => stepOf(e.path) === stepNum);
    const label = `Step ${stepNum}: ${actLabel(act)}`;
    const body = entry ? `<img src="${mediaSrc(entry.path)}" alt="${esc(`${leg} step ${stepNum}`)}" loading="lazy">` : blank(`${shot.id} on ${leg} has no screenshot for step ${stepNum} in the ledger`);
    views.push({ id: `step-${stepNum}`, label, body });
  });
  for (const e of stepEntries) {
    const n = stepOf(e.path);
    if (n !== null && !usedSteps.has(n)) {
      views.push({ id: `step-${n}`, label: `Step ${n}`, body: `<img src="${mediaSrc(e.path)}" alt="${esc(`${leg} step ${n}`)}" loading="lazy">` });
    }
  }
  videos.forEach((v, i) => {
    const label = videos.length > 1 ? `Video ${i + 1}` : "Video";
    const video = `<video src="${mediaSrc(v.path)}" data-qa-video data-row="${esc(shot.id)}" data-leg="${esc(leg)}" data-path="${esc(v.path)}" controls playsinline preload="metadata">${esc(`${leg} ${shot.state} video`)}</video>`;
    const timebar = `<div class="qa-timebar"><button type="button" class="qa-time-add" data-qa-time disabled>Comment at this time</button></div>`;
    views.push({ id: videos.length > 1 ? `video-${i + 1}` : "video", label, body: `${video}${timebar}` });
  });
  if (isDeviceLeg(current) && screenshot) {
    views.push({ id: "device", label: "Device frame", body: `<div class="qa-device"><img src="${mediaSrc(screenshot.path)}" alt="${esc(`${leg} device frame`)}" loading="lazy"></div>` });
  }
  return { views, links };
}
function linkLine(links) {
  if (links.length === 0) return "";
  const names = { trace: "trace", log: "log", ui: "UI dump" };
  const items = links.map((e) => `<a href="${mediaSrc(e.path)}">${esc(names[e.kind] ?? e.kind)}</a>`);
  return `<p class="qa-files">Files: ${items.join(", ")}.</p>`;
}
function rowViewer(shot, byPair) {
  const legTabs = [];
  const legPanels = [];
  shot.legs.forEach((leg, legIndex) => {
    const activeLeg = legIndex === 0;
    legTabs.push(`<button type="button" data-leg="${esc(leg)}" aria-selected="${activeLeg}">${esc(leg)}</button>`);
    const { views, links } = legViews(shot, leg, byPair.get(pairKey(shot.id, leg)) ?? []);
    if (views.length === 0) {
      legPanels.push(`<div class="qa-legpanel" data-leg="${esc(leg)}"${activeLeg ? "" : " hidden"}>${blank(`${shot.id} on ${leg} has no evidence in the ledger`)}${linkLine(links)}</div>`);
      return;
    }
    const viewTabs = views.map((v, i) => `<button type="button" data-view="${esc(v.id)}" aria-selected="${i === 0}">${esc(v.label)}</button>`).join("");
    const stage = views.map((v, i) => `<div class="qa-view" data-view="${esc(v.id)}"${i === 0 ? "" : " hidden"}>${v.body}</div>`).join("");
    legPanels.push(
      `<div class="qa-legpanel" data-leg="${esc(leg)}"${activeLeg ? "" : " hidden"}><div class="qa-view-switch" data-qa-view-switch role="tablist" aria-label="view">${viewTabs}</div><div class="qa-stage">${stage}</div>${linkLine(links)}</div>`
    );
  });
  const legSwitch = shot.legs.length > 1 ? `<div class="qa-leg-switch" data-qa-leg-switch role="tablist" aria-label="leg">${legTabs.join("")}</div>` : "";
  return `<div class="qa-viewer" data-qa-viewer>${legSwitch}<div class="qa-legpanels">${legPanels.join("")}</div></div>`;
}
function stateGallery(shot, byPair) {
  const cells = shot.legs.map((leg) => {
    const still = lastAttempt(byPair.get(pairKey(shot.id, leg)) ?? []).find((e) => e.kind === "screenshot" || e.kind === "step");
    const media = still ? `<img src="${mediaSrc(still.path)}" alt="${esc(`${leg} ${shot.screen} ${shot.state}`)}" loading="lazy">` : blank(`no still for ${leg} in the ledger`);
    return `<figure class="qa-cell"><figcaption>${esc(leg)}</figcaption>${media}</figure>`;
  });
  return `<div class="qa-gallery">${cells.join("")}</div>`;
}
function provenanceNote(shot, entries) {
  const provs = new Set(entries.filter((e) => shot.legs.includes(e.leg) && e.row === shot.id).map((e) => e.provenance));
  provs.delete("live");
  if (provs.size === 0) return "";
  const forged = provs.has("forged") ? " A forged state never counts as a live pass." : "";
  return `<p class="qa-prov">Provenance: ${esc([...provs].join(", "))}.${forged}</p>`;
}
function anchorLabel(a) {
  if (a.kind === "step") return `step ${a.step} on ${a.row} / ${a.leg}`;
  if (a.kind === "text") return `text in ${a.section}`;
  if (a.kind === "region") return `region of ${a.screenshot}`;
  if (a.kind === "time") return `time ${a.start}s on ${a.row}`;
  return `flow ${a.name}`;
}
function marksShot(a, shotId) {
  if (a.kind === "step" || a.kind === "region" || a.kind === "time") return a.row === shotId;
  if (a.kind === "text") return a.section === shotId;
  return a.name === shotId;
}
function commentMark(c, n) {
  const coords = c.anchor.kind === "region" ? ` data-x="${c.anchor.x}" data-y="${c.anchor.y}" data-w="${c.anchor.w}" data-h="${c.anchor.h}"` : "";
  return `<button type="button" class="qa-mark qa-mark-${c.anchor.kind}" data-qa-mark data-comment-id="${esc(c.id)}" data-status="${c.status}" title="${esc(anchorLabel(c.anchor))}"${coords}>${n}</button>`;
}
function marksStrip(comments, numberOf, loose = false) {
  if (comments.length === 0) return "";
  const marks = comments.map((c) => commentMark(c, numberOf.get(c.id) ?? 0)).join("");
  return `<div class="qa-marks${loose ? " qa-marks-loose" : ""}" data-qa-marks>${marks}</div>`;
}
function commentCard(c, n) {
  const replies = c.replies.map((r) => `<li><strong>${esc(r.author)}</strong>: ${esc(r.body)}</li>`).join("");
  const resolveOp = c.status === "resolved" ? "reopen" : "resolve";
  const resolveLabel = c.status === "resolved" ? "Reopen" : "Resolve";
  return [
    `<article class="qa-comment" data-comment-id="${esc(c.id)}" data-status="${c.status}">`,
    `<header class="qa-comment-head"><span class="qa-mark-n">${n}</span><span class="qa-comment-author">${esc(c.author)}</span><span class="qa-comment-status">${esc(c.status)}</span></header>`,
    `<p class="qa-comment-anchor" title="${esc(anchorLabel(c.anchor))}">${esc(anchorLabel(c.anchor))}</p>`,
    `<p class="qa-comment-body">${esc(c.body)}</p>`,
    replies ? `<ul class="qa-replies">${replies}</ul>` : "",
    '<div class="qa-comment-actions" data-qa-actions hidden>',
    '<form class="qa-reply" data-qa-reply><input type="text" name="author" placeholder="you"><input type="text" name="body" placeholder="reply"><button type="submit" disabled>Reply</button></form>',
    `<button type="button" class="qa-resolve" data-qa-resolve data-op="${resolveOp}" disabled>${resolveLabel}</button>`,
    "</div>",
    "</article>"
  ].filter(Boolean).join("");
}
function commentSidebar(comments, numberOf, page2) {
  const cards = comments.map((c) => commentCard(c, numberOf.get(c.id) ?? 0)).join("");
  const empty = comments.length === 0 ? '<p class="qa-comment-empty">No comments yet.</p>' : "";
  return [
    `<aside class="qa-comments" data-qa-comments data-page="${esc(page2)}" aria-label="reviewer comments">`,
    '<div class="qa-comments-head"><h2>Comments</h2>',
    '<button type="button" class="qa-add-open" data-qa-add-open disabled hidden>Add a note</button></div>',
    '<form class="qa-add" data-qa-add hidden><p class="qa-add-target" data-qa-add-target>Flow note</p>',
    '<input type="text" name="author" placeholder="you"><textarea name="body" placeholder="note" rows="3"></textarea>',
    '<input type="hidden" name="anchor"><div class="qa-add-row"><button type="submit" disabled>Save note</button><button type="button" data-qa-add-cancel>Cancel</button></div></form>',
    empty,
    `<div class="qa-comment-list">${cards}</div>`,
    "</aside>"
  ].join("");
}
function commentsData(comments) {
  const json = JSON.stringify(comments).replace(/</g, "\\u003c");
  return `<script type="application/json" data-qa-comments-data>${json}</script>`;
}
function renderState(shot, latest, byPair, entries, marks = "") {
  const legLines = shot.legs.map((leg) => `<li><code>${esc(leg)}</code>: ${esc(resultText(latest.get(pairKey(shot.id, leg))))}</li>`).join("");
  const specRef = shot.specRef ? `<span>Spec <code>${esc(shot.specRef)}</code></span>` : "";
  return [
    `<section class="qa-state" id="${stateAnchor(shot.id)}" data-row="${esc(shot.id)}" data-qa-section="${esc(shot.id)}">`,
    `<h3>${esc(shot.screen)} <span class="qa-state-name">${esc(shot.state)}</span></h3>`,
    marks,
    '<div class="qa-meta">',
    `<span>Row <code>${esc(shot.id)}</code></span>`,
    `<span>Route <code>${esc(shot.route)}</code></span>`,
    specRef,
    "</div>",
    `<p class="qa-expect">Expect: ${esc(expectText(shot))}</p>`,
    provenanceNote(shot, entries),
    `<ul class="qa-legresults">${legLines}</ul>`,
    stateGallery(shot, byPair),
    rowViewer(shot, byPair),
    "</section>"
  ].filter(Boolean).join("\n");
}
var chipClass = (status) => `qa-chip qa-chip-${status}`;
function page(input) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc(input.title)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    `<header class="qa-top"><div class="qa-top-in">${input.crumb}<div class="qa-wordmark">QA viewer</div></div></header>`,
    '<div class="qa-layout">',
    `<main class="qa-main"><h1>${esc(input.heading)}</h1>${input.body}</main>`,
    input.sidebar ?? "",
    "</div>",
    input.data ?? "",
    `<script>${SCRIPT}</script>`,
    "</body>",
    "</html>"
  ].join("\n");
}
function scoreBlock(input, opts) {
  const s = reportScore(input, opts.weights);
  if (!s) {
    return '<div class="qa-score"><p>No rows have run yet, so the score has no dimension to average.</p></div>';
  }
  const { score, confidence } = s.result;
  const percent = Math.round(confidence * 100);
  const gauge = renderScoreGauge(score, { size: 148, label: `${percent}%`, ...opts.gaugeColor ? { color: opts.gaugeColor } : {} });
  return [
    '<div class="qa-score">',
    `<div class="qa-gauge">${gauge}</div>`,
    '<div class="qa-score-text">',
    `<p>QA score <strong>${score}</strong> of 100. The weighted score averages the counted dimensions. Confidence ${percent}% comes from the live coverage and the evidence. A low coverage or evidence caps the confidence, so a thin run does not read as a clean pass.</p>`,
    `<div class="qa-score-scroll">${renderScoreBreakdown(s.rows)}</div>`,
    "</div>",
    "</div>"
  ].join("");
}
function findingsBlock(input, latest, featureOf) {
  const rows = [];
  let na = 0;
  let notRun = 0;
  let noResult = 0;
  for (const { shot, leg } of plannedPairs(input.manifest)) {
    const r = latest.get(pairKey(shot.id, leg));
    if (!r) noResult += 1;
    else if (r.status === "failed") {
      const feature = featureOf.get(shot.id.split(".")[0] ?? shot.id);
      const href = feature ? `${esc(feature.file)}#${stateAnchor(shot.id)}` : "";
      const where = href ? `<a href="${href}"><code>${esc(shot.id)}</code></a>` : `<code>${esc(shot.id)}</code>`;
      rows.push(`<tr><td>${where}</td><td><code>${esc(leg)}</code></td><td>${esc(r.failures.join(", ") || "no failure named")}</td><td>${esc(r.reason ?? "")}</td></tr>`);
    } else if (r.status === "n/a") na += 1;
    else if (r.status === "not-run") notRun += 1;
  }
  const parts = ['<section class="qa-findings"><h2>Open findings</h2>'];
  if (rows.length === 0) parts.push("<p>No planned row and leg failed.</p>");
  else parts.push(`<table><thead><tr><th>Row</th><th>Leg</th><th>Failures</th><th>Reason</th></tr></thead><tbody>${rows.join("")}</tbody></table>`);
  const gaps = [];
  if (na > 0) gaps.push(`${na} n/a`);
  if (notRun > 0) gaps.push(`${notRun} not run`);
  if (noResult > 0) gaps.push(`${noResult} with no result`);
  if (gaps.length > 0) parts.push(`<p class="qa-gaps">Not covered: ${gaps.join(", ")}.</p>`);
  parts.push("</section>");
  return parts.join("");
}
var INDEX_VIDEOS_PER_FEATURE = 3;
function firstOnLegs(shot, byPair, kind) {
  for (const leg of shot.legs) {
    const hit = lastAttempt(byPair.get(pairKey(shot.id, leg)) ?? []).find((e) => e.kind === kind);
    if (hit) return hit;
  }
  return void 0;
}
var wantsVideo = (shot) => shot.video === true || (shot.act?.length ?? 0) > 0;
function featureMedia(feature, byPair) {
  let key;
  for (const shot of feature.shots) {
    const entry = firstOnLegs(shot, byPair, "screenshot");
    if (entry) {
      key = { shot, entry };
      break;
    }
  }
  const thumb = key ? `<a class="qa-thumb" href="${esc(feature.file)}#${stateAnchor(key.shot.id)}"><img src="${mediaSrc(key.entry.path)}" alt="${esc(`${key.entry.leg} ${key.shot.screen} ${key.shot.state}`)}" loading="lazy"></a>` : blank(`${feature.name} has no settled screenshot in the ledger`);
  const clips = [];
  for (const shot of feature.shots) {
    const video = firstOnLegs(shot, byPair, "video");
    const caption = `<figcaption><a href="${esc(feature.file)}#${stateAnchor(shot.id)}"><code>${esc(shot.id)}</code></a>${video ? ` on <code>${esc(video.leg)}</code>` : ""}</figcaption>`;
    if (video) {
      clips.push(`<figure class="qa-clip">${caption}<video src="${mediaSrc(video.path)}" controls playsinline preload="metadata">${esc(`${video.leg} ${shot.state} video`)}</video></figure>`);
    } else if (wantsVideo(shot)) {
      clips.push(`<figure class="qa-clip">${caption}${blank(`${shot.id} asks for a video and the ledger has none`)}</figure>`);
    }
  }
  const shown = clips.slice(0, INDEX_VIDEOS_PER_FEATURE);
  const more = clips.length - shown.length;
  const moreLink = more > 0 ? `<p class="qa-more"><a href="${esc(feature.file)}">${more} more on the feature page</a></p>` : "";
  const clipBlock = shown.length > 0 ? `<div class="qa-clips">${shown.join("")}</div>${moreLink}` : "";
  return [
    `<article class="qa-media-feature" data-feature="${esc(feature.token)}">`,
    `<h3><a href="${esc(feature.file)}">${esc(feature.name)}</a></h3>`,
    thumb,
    clipBlock,
    "</article>"
  ].join("");
}
function mediaBlock(features, entries) {
  const byPair = entriesByPair(entries);
  return `<section class="qa-media"><h2>Media</h2><div class="qa-media-grid">${features.map((f) => featureMedia(f, byPair)).join("")}</div></section>`;
}
function featureCards(features, latest) {
  const cards = features.map((f) => {
    let passed = 0;
    let failed = 0;
    let legs = 0;
    for (const shot of f.shots) for (const leg of shot.legs) {
      legs += 1;
      const r = latest.get(pairKey(shot.id, leg));
      if (r?.status === "passed") passed += 1;
      if (r?.status === "failed") failed += 1;
    }
    const tone = failed > 0 ? "fail" : passed === legs && legs > 0 ? "pass" : "partial";
    return [
      `<a class="qa-card" href="${esc(f.file)}">`,
      `<span class="qa-card-name">${esc(f.name)}</span>`,
      `<span class="qa-card-meta">${f.shots.length} state${f.shots.length === 1 ? "" : "s"}, ${legs} row leg${legs === 1 ? "" : "s"}</span>`,
      `<span class="qa-dot qa-dot-${tone}"></span>`,
      "</a>"
    ].join("");
  });
  return `<section class="qa-features"><h2>Features</h2><div class="qa-cardgrid">${cards.join("")}</div></section>`;
}
var INDEX_PAGE = "overview";
function renderIndex(input, features, latest, opts, comments, numberOf) {
  const featureOf = new Map(features.map((f) => [f.token, f]));
  const totals = { rows: input.manifest.shots.length, legs: plannedPairs(input.manifest).length };
  const loose = comments.filter((c) => c.anchor.kind === "flow" && c.anchor.name === INDEX_PAGE || c.anchor.kind === "text" && c.anchor.section === INDEX_PAGE);
  const body = [
    `<p class="qa-sub"><span class="${chipClass(input.status)}">${esc(input.status)}</span> ${esc(input.date)}, ${totals.rows} row${totals.rows === 1 ? "" : "s"}, ${totals.legs} row leg${totals.legs === 1 ? "" : "s"}.</p>`,
    marksStrip(loose, numberOf, true),
    scoreBlock(input, opts),
    findingsBlock(input, latest, featureOf),
    mediaBlock(features, input.entries),
    featureCards(features, latest)
  ].join("\n");
  return page({ title: `QA: ${input.title}`, heading: input.title, crumb: '<span class="qa-crumb">Overview</span>', body, sidebar: commentSidebar(comments, numberOf, INDEX_PAGE), data: commentsData(comments) });
}
function renderFeature(input, feature, latest, comments, numberOf) {
  const byPair = entriesByPair(input.entries);
  const markFor = (shotId) => marksStrip(comments.filter((c) => marksShot(c.anchor, shotId)), numberOf);
  const states = feature.shots.map((shot) => renderState(shot, latest, byPair, input.entries, markFor(shot.id))).join("\n");
  const screenId = feature.token;
  const loose = comments.filter((c) => c.anchor.kind === "flow" && c.anchor.name === screenId || c.anchor.kind === "text" && c.anchor.section === screenId);
  const body = `<p class="qa-sub"><a href="index.html">Overview</a></p>${marksStrip(loose, numberOf, true)}${states}`;
  return page({ title: `QA: ${feature.name}`, heading: feature.name, crumb: '<a class="qa-crumb" href="index.html">Overview</a>', body, sidebar: commentSidebar(comments, numberOf, feature.token), data: commentsData(comments) });
}
function featuresOf(manifest) {
  const features = [];
  const byToken = /* @__PURE__ */ new Map();
  for (const shot of manifest.shots) {
    const token = shot.id.split(".")[0] ?? shot.id;
    let feature = byToken.get(token);
    if (!feature) {
      feature = { token, name: shot.screen, file: `feature-${token}.html`, shots: [] };
      byToken.set(token, feature);
      features.push(feature);
    }
    feature.shots.push(shot);
  }
  return features;
}
function renderViewerBundle(input, opts = {}) {
  const features = featuresOf(input.manifest);
  const latest = /* @__PURE__ */ new Map();
  for (const r of input.results) latest.set(pairKey(r.row, r.leg), r);
  const comments = input.comments ?? opts.comments ?? [];
  const numberOf = new Map(comments.map((c, i) => [c.id, i + 1]));
  const pages = /* @__PURE__ */ new Map();
  pages.set("index.html", renderIndex(input, features, latest, opts, comments, numberOf));
  for (const feature of features) pages.set(feature.file, renderFeature(input, feature, latest, comments, numberOf));
  return { pages };
}
function titleOf(text) {
  for (const line of text.split("\n")) {
    if (/^#\s/.test(line)) return line.replace(/^#\s+/, "").replace(/^QA:\s*/, "").trim();
    if (/^##\s/.test(line)) break;
  }
  return null;
}
async function loadViewerInput(mdPath, opts = {}) {
  const loaded = await loadReport(mdPath, opts);
  if (!loaded.manifest) {
    throw new LaunchwrightError("qa.viewer.plan", `The plan of ${mdPath} is invalid:
  ${loaded.manifestErrors.join("\n  ")}`, { context: { errors: loaded.manifestErrors } });
  }
  const manifest = loaded.manifest;
  const entries = loaded.ledger?.entries ?? [];
  const status = computeStatus({ manifest, results: loaded.results, entries });
  const input = {
    title: titleOf(loaded.text) ?? manifest.title,
    date: manifest.generated.slice(0, 10) || loaded.slug.slice(0, 10),
    status,
    manifest,
    results: loaded.results,
    entries,
    findings: tallyFindings(reportFindings(loaded.text))
  };
  return { input, slug: loaded.slug, reportDir: loaded.reportDir };
}
async function buildViewer(mdPath, opts = {}) {
  const { input, slug, reportDir } = await loadViewerInput(mdPath, { ...opts.legs ? { legs: opts.legs } : {}, ...opts.bases ? { bases: opts.bases } : {} });
  const bundle = renderViewerBundle(input, opts);
  const dir = join(reportDir, "dist", viewerDirName(slug));
  await mkdir(dir, { recursive: true });
  const written = [];
  const index = join(dir, "index.html");
  await writeFile(index, bundle.pages.get("index.html"));
  written.push(index);
  for (const [name, html] of bundle.pages) {
    if (name === "index.html") continue;
    const file = join(dir, name);
    await writeFile(file, html);
    written.push(file);
  }
  return { dir, index, pages: written };
}
var STYLE = `
:root{color-scheme:light;--ground:#f4f7f6;--surface:#fff;--sunk:#edf2f1;--ink:#0f1a19;--ink-soft:#546360;--rule:#d9e2e0;--accent:#15605a;--accent-soft:#e2efec;--pass:#15605a;--fail:#8c2b2b;--fail-soft:#f8e9e7;--partial:#9a5b08;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--ground:#0d1413;--surface:#141e1d;--sunk:#101917;--ink:#dbe4e2;--ink-soft:#94a6a3;--rule:#243231;--accent:#63c0b3;--accent-soft:#16302d;--pass:#63c0b3;--fail:#e08a8a;--fail-soft:#311e1e;--partial:#dca648}}
:root[data-theme="dark"]{color-scheme:dark;--ground:#0d1413;--surface:#141e1d;--sunk:#101917;--ink:#dbe4e2;--ink-soft:#94a6a3;--rule:#243231;--accent:#63c0b3;--accent-soft:#16302d;--pass:#63c0b3;--fail:#e08a8a;--fail-soft:#311e1e;--partial:#dca648}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6}
img{max-width:100%}
code{font-family:var(--mono);font-size:.86em;background:var(--sunk);padding:.08em .35em;border-radius:4px}
a{color:var(--accent)}
.qa-top{position:sticky;top:0;z-index:5;background:var(--surface);border-bottom:1px solid var(--rule);padding:env(safe-area-inset-top,0) 0 0}
.qa-top-in{max-width:70rem;margin:0 auto;padding:.7rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.qa-crumb{color:var(--ink-soft);text-decoration:none;font-weight:600}
.qa-wordmark{font-family:var(--mono);font-size:.82rem;color:var(--ink-soft)}
.qa-main{max-width:70rem;margin:0 auto;padding:1.4rem 1rem 4rem}
h1{font-size:1.7rem;margin:.6rem 0 .2rem}
h2{font-size:1.2rem;margin:2rem 0 .8rem}
h3{font-size:1.1rem;margin:0 0 .5rem}
.qa-sub{color:var(--ink-soft);margin:.2rem 0 1.4rem}
.qa-chip{display:inline-block;font-size:.76rem;font-weight:700;padding:.1rem .5rem;border-radius:999px;text-transform:uppercase;letter-spacing:.03em;background:var(--accent-soft);color:var(--accent)}
.qa-chip-failed{background:var(--fail-soft);color:var(--fail)}
.qa-chip-partial,.qa-chip-planned{background:var(--sunk);color:var(--ink-soft)}
.qa-score{display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap;background:var(--surface);border:1px solid var(--rule);border-radius:14px;padding:1.2rem;margin:0 0 1rem}
.qa-score p{margin:0;max-width:46ch;color:var(--ink-soft)}
.qa-score strong{color:var(--ink);font-size:1.15em}
.qa-gauge{flex:0 0 auto}
.qa-score-text{flex:1 1 22rem;min-width:0}
.qa-score-scroll{overflow-x:auto;margin-top:.8rem}
.qa-score-table{width:100%;border-collapse:collapse;font-size:.86rem}
.qa-score-table th,.qa-score-table td{text-align:left;padding:.3rem .5rem;border-bottom:1px solid var(--rule)}
.qa-score-table th{color:var(--ink-soft);font-weight:600}
.qa-score-table tr[data-counted="false"] td{color:var(--ink-soft)}
.qa-findings table{width:100%;border-collapse:collapse;font-size:.92rem}
.qa-findings th,.qa-findings td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--rule);vertical-align:top}
.qa-findings th{color:var(--ink-soft);font-weight:600}
.qa-gaps,.qa-prov,.qa-files,.qa-expect{color:var(--ink-soft);font-size:.92rem}
.qa-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:.8rem}
.qa-media-feature{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:.8rem;display:flex;flex-direction:column;gap:.6rem;min-width:0}
.qa-media-feature h3{margin:0;font-size:1rem}
.qa-thumb{display:block;background:var(--sunk);border:1px solid var(--rule);border-radius:8px;padding:.4rem}
.qa-thumb img{display:block;margin:0 auto;max-height:18rem;width:auto;border-radius:6px}
.qa-clips{display:flex;flex-direction:column;gap:.6rem}
.qa-clip{margin:0;display:flex;flex-direction:column;gap:.3rem}
.qa-clip figcaption{font-size:.82rem;color:var(--ink-soft)}
.qa-clip video{display:block;max-width:100%;max-height:18rem;border-radius:6px;background:var(--sunk)}
.qa-more{margin:0;font-size:.86rem}
.qa-cardgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:.8rem}
.qa-card{display:flex;flex-direction:column;gap:.25rem;position:relative;background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:1rem;text-decoration:none;color:var(--ink)}
.qa-card:hover{border-color:var(--accent)}
.qa-card-name{font-weight:700}
.qa-card-meta{color:var(--ink-soft);font-size:.86rem}
.qa-dot{position:absolute;top:1rem;right:1rem;width:.6rem;height:.6rem;border-radius:999px;background:var(--partial)}
.qa-dot-pass{background:var(--pass)}
.qa-dot-fail{background:var(--fail)}
.qa-state{background:var(--surface);border:1px solid var(--rule);border-radius:14px;padding:1.2rem;margin:0 0 1.4rem}
.qa-state-name{color:var(--ink-soft);font-weight:500}
.qa-meta{display:flex;flex-wrap:wrap;gap:.3rem 1rem;color:var(--ink-soft);font-size:.9rem;margin:0 0 .4rem}
.qa-legresults{margin:.4rem 0 1rem;padding-left:1.1rem;color:var(--ink-soft);font-size:.92rem}
.qa-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.7rem;margin:0 0 1.2rem}
.qa-cell{margin:0;background:var(--sunk);border:1px solid var(--rule);border-radius:10px;padding:.5rem;display:flex;flex-direction:column;gap:.4rem}
.qa-cell figcaption,.qa-cell>figcaption{font-family:var(--mono);font-size:.78rem;color:var(--ink-soft)}
.qa-cell img{border-radius:6px;display:block}
.qa-viewer{border-top:1px solid var(--rule);padding-top:1rem}
.qa-leg-switch,.qa-view-switch{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .7rem}
.qa-leg-switch button,.qa-view-switch button{font:inherit;font-size:.84rem;cursor:pointer;background:var(--sunk);color:var(--ink);border:1px solid var(--rule);border-radius:999px;padding:.25rem .8rem}
.qa-leg-switch button[aria-selected="true"],.qa-view-switch button[aria-selected="true"]{background:var(--accent);color:var(--surface);border-color:var(--accent)}
.qa-stage{background:var(--sunk);border:1px solid var(--rule);border-radius:10px;padding:.6rem;min-height:4rem}
.qa-stage img,.qa-stage video{display:block;max-width:100%;height:auto;border-radius:6px;margin:0 auto}
.qa-device{max-width:20rem;margin:0 auto;padding:.7rem;background:var(--ink);border-radius:1.6rem;box-shadow:0 0 0 2px var(--rule) inset}
.qa-device img{border-radius:.9rem}
.qa-blank{background:var(--fail-soft);color:var(--fail);border:1px dashed var(--fail);border-radius:8px;padding:.7rem .8rem;font-size:.9rem}
.qa-blank-mark{font-family:var(--mono);font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;margin-right:.3rem}
@media (max-width:540px){.qa-score{flex-direction:column;align-items:flex-start}}
.qa-layout{display:flex;align-items:flex-start;gap:1rem;max-width:88rem;margin:0 auto}
.qa-layout .qa-main{flex:1 1 auto;min-width:0}
.qa-comments{flex:0 0 20rem;position:sticky;top:3.4rem;align-self:flex-start;max-height:calc(100vh - 4rem);overflow:auto;background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:.9rem;margin:1.4rem 1rem 0 0}
.qa-comments-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.qa-comments-head h2{margin:0;font-size:1rem}
.qa-comment-empty{color:var(--ink-soft);font-size:.9rem}
.qa-comment{border:1px solid var(--rule);border-radius:10px;padding:.6rem;margin:.6rem 0;background:var(--sunk)}
.qa-comment[data-status="resolved"]{opacity:.6}
.qa-comment-head{display:flex;align-items:center;gap:.4rem;font-size:.8rem;color:var(--ink-soft)}
.qa-comment-author{font-weight:600;color:var(--ink)}
.qa-comment-anchor{font-family:var(--mono);font-size:.74rem;color:var(--ink-soft);margin:.2rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qa-comment-body{margin:.2rem 0;font-size:.9rem}
.qa-replies{margin:.3rem 0;padding-left:1rem;font-size:.84rem;color:var(--ink-soft)}
.qa-mark-n{display:inline-flex;align-items:center;justify-content:center;min-width:1.3rem;height:1.3rem;border-radius:999px;background:var(--accent);color:var(--surface);font-size:.74rem;font-weight:700}
.qa-marks{display:flex;flex-wrap:wrap;gap:.3rem;margin:0 0 .6rem}
.qa-mark{cursor:pointer;min-width:1.5rem;height:1.5rem;border-radius:999px;border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700;font-size:.78rem}
.qa-mark[data-status="resolved"]{border-color:var(--rule);background:var(--sunk);color:var(--ink-soft)}
.qa-comment-actions{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem}
.qa-reply{display:flex;gap:.3rem;flex-wrap:wrap}
.qa-reply input,.qa-add input,.qa-add textarea{font:inherit;font-size:.82rem;border:1px solid var(--rule);border-radius:6px;padding:.2rem .4rem;background:var(--ground);color:var(--ink);max-width:100%}
.qa-add{display:flex;flex-direction:column;gap:.4rem;margin:.5rem 0;padding:.5rem;border:1px solid var(--rule);border-radius:8px}
.qa-add-target{margin:0;font-weight:600;font-size:.84rem}
.qa-add-row{display:flex;gap:.4rem}
.qa-add-open,.qa-reply button,.qa-resolve,.qa-add button,.qa-time-add,.qa-add-row button{font:inherit;font-size:.8rem;cursor:pointer;border:1px solid var(--rule);border-radius:6px;padding:.2rem .6rem;background:var(--sunk);color:var(--ink)}
.qa-add-open[disabled],.qa-reply button[disabled],.qa-resolve[disabled],.qa-add button[disabled],.qa-time-add[disabled]{cursor:not-allowed;opacity:.5}
.qa-timebar{margin-top:.4rem}
.qa-comment.qa-hit{outline:2px solid var(--accent);outline-offset:2px}
@media (max-width:860px){.qa-layout{flex-direction:column}.qa-comments{position:static;flex-basis:auto;width:auto;max-height:none;margin:0 1rem 1.4rem}}
`;
var SCRIPT = `
document.addEventListener('click',function(ev){
  var legBtn=ev.target.closest('[data-qa-leg-switch] button[data-leg]');
  if(legBtn){
    var viewer=legBtn.closest('[data-qa-viewer]');
    var leg=legBtn.getAttribute('data-leg');
    viewer.querySelectorAll('[data-qa-leg-switch] button[data-leg]').forEach(function(b){b.setAttribute('aria-selected',String(b===legBtn));});
    viewer.querySelectorAll('.qa-legpanels > .qa-legpanel[data-leg]').forEach(function(p){
      var show=p.getAttribute('data-leg')===leg;
      p.hidden=!show;
      if(!show){var v=p.querySelector('video');if(v){v.pause();}}
    });
    return;
  }
  var viewBtn=ev.target.closest('[data-qa-view-switch] button[data-view]');
  if(viewBtn){
    var panel=viewBtn.closest('.qa-legpanel')||viewBtn.closest('[data-qa-viewer]');
    var view=viewBtn.getAttribute('data-view');
    viewBtn.closest('[data-qa-view-switch]').querySelectorAll('button[data-view]').forEach(function(b){b.setAttribute('aria-selected',String(b===viewBtn));});
    panel.querySelectorAll('.qa-stage > .qa-view[data-view]').forEach(function(vw){
      var show=vw.getAttribute('data-view')===view;
      vw.hidden=!show;
      if(!show){var v=vw.querySelector('video');if(v){v.pause();}}
    });
  }
});

// Reviewer comments (spec 2.9). A mark scrolls to its sidebar card in any mode. When the page is
// served (not file://), the add, reply and resolve controls turn on and write through the store.
(function(){
  var served=location.protocol!=='file:';
  function post(payload){
    return fetch(new URL('comments',location.href).href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){if(!r.ok)throw new Error('post failed');location.reload();})
      .catch(function(err){console.error('qa comments:',err);});
  }
  document.addEventListener('click',function(ev){
    var mark=ev.target.closest('[data-qa-mark]');
    if(!mark)return;
    var id=mark.getAttribute('data-comment-id');
    var sel=(window.CSS&&CSS.escape)?CSS.escape(id):id;
    var card=document.querySelector('.qa-comment[data-comment-id="'+sel+'"]');
    if(card){card.scrollIntoView({block:'center'});card.classList.add('qa-hit');setTimeout(function(){card.classList.remove('qa-hit');},1200);}
  });
  if(!served)return;
  document.querySelectorAll('[data-qa-add-open]').forEach(function(b){b.disabled=false;b.hidden=false;});
  document.querySelectorAll('[data-qa-actions]').forEach(function(a){a.hidden=false;a.querySelectorAll('button').forEach(function(b){b.disabled=false;});});
  document.querySelectorAll('[data-qa-time]').forEach(function(b){b.disabled=false;});
  var side=document.querySelector('[data-qa-comments]');
  var form=side&&side.querySelector('[data-qa-add]');
  var anchorField=form&&form.querySelector('[name=anchor]');
  var targetLabel=form&&form.querySelector('[data-qa-add-target]');
  function openAdd(anchor,label){
    if(!form)return;
    anchorField.value=JSON.stringify(anchor);
    if(targetLabel)targetLabel.textContent=label;
    form.hidden=false;
    var body=form.querySelector('[name=body]');if(body)body.focus();
  }
  document.querySelectorAll('[data-qa-add-open]').forEach(function(b){
    b.addEventListener('click',function(){
      var page=side.getAttribute('data-page')||'overview';
      var sel=window.getSelection&&window.getSelection();
      var quote=sel&&String(sel).trim();
      if(quote){
        var node=sel.anchorNode;var host=node&&(node.nodeType===1?node:node.parentElement);
        var sect=host&&host.closest('[data-qa-section]');
        if(sect){openAdd({kind:'text',section:sect.getAttribute('data-qa-section'),quote:quote},'Text note');return;}
      }
      openAdd({kind:'flow',name:page},'Flow note');
    });
  });
  if(form){
    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      var anchor;try{anchor=JSON.parse(anchorField.value);}catch(e){return;}
      post({op:'add',comment:{anchor:anchor,author:(form.querySelector('[name=author]').value||'reviewer'),body:(form.querySelector('[name=body]').value||'')}});
    });
    var cancel=form.querySelector('[data-qa-add-cancel]');
    if(cancel)cancel.addEventListener('click',function(){form.hidden=true;});
  }
  document.querySelectorAll('.qa-stage img').forEach(function(img){
    img.addEventListener('click',function(ev){
      var state=img.closest('[data-row]');if(!state)return;
      var row=state.getAttribute('data-row');
      var panel=img.closest('.qa-legpanel');var leg=panel&&panel.getAttribute('data-leg');
      var view=img.closest('.qa-view');var vid=view&&view.getAttribute('data-view');
      if(vid&&vid.indexOf('step-')===0){openAdd({kind:'step',row:row,leg:leg||'',attempt:1,step:Number(vid.slice(5))},'Step note');return;}
      var rect=img.getBoundingClientRect();
      var x=(ev.clientX-rect.left)/rect.width,y=(ev.clientY-rect.top)/rect.height;
      var path=img.getAttribute('src').replace(/^(\\.\\.\\/)+/,'');
      openAdd({kind:'region',screenshot:path,row:row,x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y)),w:0.1,h:0.1},'Region note');
    });
  });
  document.querySelectorAll('[data-qa-time]').forEach(function(b){
    b.addEventListener('click',function(){
      var view=b.closest('.qa-view');var video=view&&view.querySelector('[data-qa-video]');
      if(!video)return;
      openAdd({kind:'time',video:video.getAttribute('data-path'),row:video.getAttribute('data-row'),start:Math.round(video.currentTime*100)/100},'Time note');
    });
  });
  document.querySelectorAll('[data-qa-reply]').forEach(function(f){
    f.addEventListener('submit',function(ev){
      ev.preventDefault();
      var art=f.closest('[data-comment-id]');
      post({op:'reply',id:art.getAttribute('data-comment-id'),reply:{author:(f.querySelector('[name=author]').value||'reviewer'),body:(f.querySelector('[name=body]').value||'')}});
    });
  });
  document.querySelectorAll('[data-qa-resolve]').forEach(function(b){
    b.addEventListener('click',function(){
      var art=b.closest('[data-comment-id]');
      post({op:b.getAttribute('data-op'),id:art.getAttribute('data-comment-id')});
    });
  });
})();
`;

export {
  viewerDirName,
  renderViewerBundle,
  loadViewerInput,
  buildViewer
};
//# sourceMappingURL=chunk-CHZAXL2Z.js.map