// src/render/services/spec-render.mts
import { existsSync, readFileSync } from "fs";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";
var TEMPLATE_SEARCH_DEPTH = 5;
var TEMPLATE_DIR = templateDir();
function templateDir() {
  let dir = dirname(fileURLToPath(import.meta.url));
  let packageRoot = null;
  for (let up = 0; up <= TEMPLATE_SEARCH_DEPTH; up += 1) {
    const candidate = join(dir, "assets", "renderer");
    if (existsSync(join(candidate, "spec-template.html"))) return candidate;
    if (packageRoot === null && existsSync(join(dir, "package.json"))) packageRoot = dir;
    dir = dirname(dir);
  }
  return join(packageRoot ?? dirname(fileURLToPath(import.meta.url)), "assets", "renderer");
}
var TEMPLATE = join(TEMPLATE_DIR, "spec-template.html");
var STATUS_VALUES = [
  "draft",
  "approved",
  "in-progress",
  "analysis",
  "blocked",
  "implemented",
  "superseded-by",
  "abandoned",
  "answered"
];
var LIVE_STATUSES = /* @__PURE__ */ new Set(["approved", "in-progress", "implemented"]);
var HEADER_FIELD_RE = /^(Date|Status|Subject|Range):\s*(.*)$/;
var STATUS_TOKEN_RE = /\bStatus:\s*([a-z-]+)([^\n]*)/i;
var DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})-/;
var IMAGE_RE = /!\[([^\]]*)\]\(([^)]*)\)/g;
var MD_LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;
var LONE_IMAGE_RE = /^<(?:img [^>]*>|video [^>]*>[^<]*<\/video>)$/;
var VIDEO_RE = /\.(?:mp4|webm)$/i;
function asBlock(html) {
  return LONE_IMAGE_RE.test(html) ? `<figure class="figure">${html}</figure>` : `<p>${html}</p>`;
}
var PLACEHOLDERS = [
  "{{NAV}}",
  "{{BODY}}",
  "{{TITLE}}",
  "{{DATE}}",
  "{{STATUS}}",
  "{{SUBJECT}}",
  "{{RANGE}}",
  "{{STANDFIRST}}",
  "{{KIND}}",
  "{{KIND_CLASS}}",
  "{{SOURCE}}"
];
var PLACEHOLDER_RE = /<li class="chip">\{\{STATUS\}\}<\/li>|<li class="chip">\{\{SUBJECT\}\}<\/li>|<li class="chip">\{\{RANGE\}\}<\/li>|\{\{(\w+)\}\}/g;
var SpecError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SpecError";
  }
};
var DOMAINS = [
  { dir: "docs/specs", kind: "spec", label: "SPECIFICATION", statuses: STATUS_VALUES },
  { dir: "docs/superpowers/plans", kind: "plan", label: "PLAN", statuses: STATUS_VALUES }
];
var DOMAIN_RE = /(?:^|\/)(docs\/specs|docs\/superpowers\/plans)\//;
var posixify = (path) => path.split("\\").join("/");
function domainOf(sourceName) {
  const match = DOMAIN_RE.exec(posixify(sourceName));
  const found = match ? DOMAINS.find((domain) => domain.dir === match[1]) : void 0;
  if (!found) {
    throw new SpecError(
      `${sourceName}: not under ${DOMAINS.map((domain) => `${domain.dir}/`).join(", ")}, so it has no document kind`
    );
  }
  return found;
}
function assetPrefixFor(sourceName) {
  const domain = domainOf(sourceName);
  const posix = posixify(sourceName);
  const relative = posix.slice(posix.indexOf(`${domain.dir}/`) + domain.dir.length + 1);
  return "../".repeat(relative.split("/").length);
}
function imageProblem(url) {
  if (/^data:/i.test(url)) {
    return `an inline data: image belongs in the domain's assets/, where it can be seen and reused`;
  }
  if (!/^assets\/[^/]/.test(url)) return `an image must be referenced as assets/<file>, not '${url}'`;
  return null;
}
function checkImages(line, fail) {
  for (const match of line.matchAll(IMAGE_RE)) {
    const problem = imageProblem(match[2]);
    if (problem) fail(problem);
  }
}
function esc(text, quote = false) {
  const out = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return quote ? out.replace(/"/g, "&quot;").replace(/'/g, "&#x27;") : out;
}
function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function plain(text) {
  return text.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}
function emphasis(text) {
  let out = text.replace(/\*\*(.+?)\*\*/g, (_m, inner) => `<strong>${emphasis(inner)}</strong>`);
  out = out.replace(/~~(.+?)~~/g, "<s>$1</s>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/(?<![A-Za-z0-9_])_(.+?)_(?![A-Za-z0-9_])/g, "<em>$1</em>");
  return out;
}
function splitCodeSpans(text) {
  const pieces = [];
  let buffer = "";
  let i = 0;
  const runLength = (at) => {
    let n = 0;
    while (text[at + n] === "`") n += 1;
    return n;
  };
  while (i < text.length) {
    if (text[i] !== "`") {
      buffer += text[i];
      i += 1;
      continue;
    }
    const open = runLength(i);
    const contentStart = i + open;
    let j = contentStart;
    let close = -1;
    while (j < text.length) {
      if (text[j] !== "`") {
        j += 1;
        continue;
      }
      const run = runLength(j);
      if (run === open) {
        close = j;
        break;
      }
      j += run;
    }
    if (close === -1) {
      buffer += text.slice(i, contentStart);
      i = contentStart;
      continue;
    }
    if (buffer) {
      pieces.push({ code: false, text: buffer });
      buffer = "";
    }
    let content = text.slice(contentStart, close);
    if (content.length > 1 && content.startsWith(" ") && content.endsWith(" ") && content.trim()) {
      content = content.slice(1, -1);
    }
    pieces.push({ code: true, text: content });
    i = close + open;
  }
  if (buffer) pieces.push({ code: false, text: buffer });
  return pieces;
}
function withoutCodeSpans(text) {
  return splitCodeSpans(text).filter((piece) => !piece.code).map((piece) => piece.text).join("");
}
function inline(text, assetPrefix = "") {
  const codes = [];
  const links = [];
  let staged = "";
  for (const piece of splitCodeSpans(text)) {
    if (piece.code) {
      codes.push(piece.text);
      staged += `\0${codes.length - 1}\0`;
    } else {
      staged += piece.text;
    }
  }
  staged = staged.replace(IMAGE_RE, (_m, alt, url) => {
    const problem = imageProblem(url);
    if (problem) throw new SpecError(problem);
    const src = esc(assetPrefix + url, true);
    links.push(
      VIDEO_RE.test(url) ? (
        // `playsinline` so iOS does not take the recording fullscreen, `preload="metadata"` so a
        // page of ten recordings costs ten headers rather than ten files, and `alt` becomes the
        // fallback sentence for a browser that will not play it.
        `<video src="${src}" controls playsinline preload="metadata">${esc(alt)}</video>`
      ) : `<img src="${src}" alt="${esc(alt, true)}" loading="lazy">`
    );
    return `${links.length - 1}`;
  });
  staged = staged.replace(MD_LINK_RE, (_m, label, url) => {
    const href = /^assets\/[^/]/.test(url) ? assetPrefix + url : url;
    links.push(`<a href="${esc(href, true)}">${emphasis(esc(label))}</a>`);
    return `${links.length - 1}`;
  });
  staged = esc(staged);
  staged = emphasis(staged);
  staged = staged.replace(/\u0001(\d+)\u0001/g, (_m, n) => links[Number(n)]);
  staged = staged.replace(/\u0000(\d+)\u0000/g, (_m, n) => `<code>${esc(codes[Number(n)])}</code>`);
  return staged;
}
function parseHead(lines, sourceName) {
  const domain = domainOf(sourceName);
  const assetPrefix = assetPrefixFor(sourceName);
  const bodyStart = lines.findIndex((line) => line.startsWith("##"));
  const end = bodyStart === -1 ? lines.length : bodyStart;
  const header = lines.slice(0, end);
  const titleIndex = header.findIndex((line) => /^#\s/.test(line));
  if (titleIndex === -1) throw new SpecError(`${sourceName}: missing a '# H1' at the top of the file`);
  const title = header[titleIndex].slice(1).trim();
  const fields = /* @__PURE__ */ new Map();
  const consumed = /* @__PURE__ */ new Set([titleIndex]);
  header.forEach((line, n) => {
    const match = HEADER_FIELD_RE.exec(line);
    if (!match) return;
    if (!fields.has(match[1])) fields.set(match[1], match[2].trim());
    consumed.add(n);
  });
  let date = fields.get("Date") ?? null;
  if (date === null) {
    const prefix = DATE_PREFIX_RE.exec(basename(sourceName));
    date = prefix ? prefix[1] : null;
  }
  if (date === null) {
    throw new SpecError(
      `${sourceName}: missing 'Date:' below the H1, and '${basename(sourceName)}' has no YYYY-MM-DD- prefix`
    );
  }
  let statusMatch = fields.has("Status") ? STATUS_TOKEN_RE.exec(`Status: ${fields.get("Status")}`) : null;
  if (!statusMatch) {
    statusMatch = STATUS_TOKEN_RE.exec(header.join("\n"));
    header.forEach((line, n) => {
      if (/\bStatus:/i.test(line) && /^\s*<!--.*-->\s*$/.test(line)) consumed.add(n);
    });
  }
  if (!statusMatch) throw new SpecError(`${sourceName}: missing 'Status:' below the H1`);
  const token = statusMatch[1].toLowerCase();
  if (!domain.statuses.includes(token)) {
    throw new SpecError(
      `${sourceName}: Status '${token}' is not one of ${domain.statuses.join(", ")} for a document in ${domain.dir}/`
    );
  }
  const tail = statusMatch[2].replace(/-->\s*$/, "").trim();
  const statusText = token === "superseded-by" && tail ? `${token} ${tail}` : token;
  const paragraphs = [];
  let current = [];
  header.forEach((line, n) => {
    if (consumed.has(n)) return;
    checkImages(line, (message) => {
      throw new SpecError(`${sourceName}:${n + 1}: ${message}`);
    });
    if (line.trim()) current.push(line.trim());
    else if (current.length) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  });
  if (current.length) paragraphs.push(current.join(" "));
  const head = {
    title,
    date,
    status: token,
    statusText,
    subject: fields.get("Subject") ?? null,
    range: fields.get("Range") ?? null,
    standfirst: inline(paragraphs.join(" "), assetPrefix)
  };
  return { head, start: end };
}
var indentOf = (line) => line.length - line.replace(/^\s+/, "").length;
var opensBlock = (line) => /^(```|>)/.test(line.trimStart());
var FENCE_LEAVES_ITEM = "a fenced code block in a list item has a line at or left of the item marker. Indent every line of the block, the closing fence too, under the item text, or end the list with a blank line and start the fence at the left margin below it";
var Renderer = class {
  i = 0;
  out = [];
  tocEntries = [];
  anchors = /* @__PURE__ */ new Set();
  /**
   * @param start how many lines of `sourceName` were consumed by the header block, so a
   * 0-based index into `lines` reports as the real 1-based line of the source file.
   */
  lines;
  sourceName;
  start;
  assetPrefix;
  // Plain fields, not parameter properties, so node runs this file with type stripping alone.
  constructor(lines, sourceName, start = 0, assetPrefix = assetPrefixFor(sourceName)) {
    this.lines = lines;
    this.sourceName = sourceName;
    this.start = start;
    this.assetPrefix = assetPrefix;
  }
  peek() {
    return this.i < this.lines.length ? this.lines[this.i] : null;
  }
  run() {
    while (this.i < this.lines.length) {
      const line = this.lines[this.i];
      if (!line.trim()) this.i += 1;
      else if (line.startsWith("```")) this.out.push(this.code());
      else if (line.startsWith(">")) this.out.push(this.quote());
      else if (line.startsWith("#")) this.heading();
      else if (line.startsWith("| ")) this.table();
      else if (/^- /.test(line)) this.ulist(0);
      else if (/^\d+\. /.test(line)) this.olist(0);
      else this.para();
    }
    return { body: this.out.join("\n"), toc: this.tocEntries };
  }
  fail(index, message) {
    throw new SpecError(`${this.sourceName}:${this.start + index + 1}: ${message}`);
  }
  /** Refuse what this renderer cannot express, rather than emit a silently wrong page. */
  checkLine(line, index) {
    checkImages(withoutCodeSpans(line), (message) => this.fail(index, message));
  }
  /**
   * A slug unique within this render.
   *
   * Two headings with identical text otherwise emit the same id, and every rail link aimed
   * at the second scrolls to the first. `slug()` has no memory of what it already emitted;
   * this is that memory, appending `-2`, `-3`, ... on a collision.
   */
  anchor(text) {
    const base = slug(text);
    let anchor = base;
    let n = 2;
    while (this.anchors.has(anchor)) {
      anchor = `${base}-${n}`;
      n += 1;
    }
    this.anchors.add(anchor);
    return anchor;
  }
  heading() {
    const index = this.i;
    const line = this.lines[this.i];
    this.i += 1;
    this.checkLine(line, index);
    const level = line.length - line.replace(/^#+/, "").length;
    const text = line.slice(level).trim();
    const numbered = /^(\d+(?:\.\d+)*)(\.?)\s+(.*)$/.exec(text);
    const anchor = this.anchor(text);
    const eyebrow = numbered ? numbered[1] : "";
    const dot = numbered ? numbered[2] : "";
    const title = numbered ? numbered[3] : text;
    if (level === 2) this.tocEntries.push({ anchor, eyebrow, title });
    const eb = eyebrow ? `<span class="eyebrow">${eyebrow}${dot} </span>` : "";
    this.out.push(
      `<h${level} id="${anchor}" class="h${level}${eyebrow ? "" : " no-eyebrow"}">${eb}${inline(title, this.assetPrefix)}</h${level}>`
    );
  }
  para() {
    this.checkLine(this.lines[this.i], this.i);
    const buffer = [this.lines[this.i].trim()];
    this.i += 1;
    for (; ; ) {
      const next = this.peek();
      if (next === null || !next.trim() || /^(```|#|\||- |\d+\. |>)/.test(next)) break;
      this.checkLine(next, this.i);
      buffer.push(next.trim());
      this.i += 1;
    }
    this.out.push(asBlock(inline(buffer.join(" "), this.assetPrefix)));
  }
  /** A blockquote. In a list item, `marker` is the column of the item marker: each line sits
   * right of it, and its indent is stripped. */
  quote(marker = -1) {
    const buffer = [];
    for (; ; ) {
      const line = this.peek();
      if (line === null || marker >= 0 && indentOf(line) <= marker) break;
      const text = marker >= 0 ? line.trimStart() : line;
      if (!text.startsWith(">")) break;
      this.checkLine(line, this.i);
      const stripped = text.replace(/^>\s?/, "").trim();
      if (stripped) buffer.push(stripped);
      this.i += 1;
    }
    return `<blockquote><p>${inline(buffer.join(" "), this.assetPrefix)}</p></blockquote>`;
  }
  /** A fenced code block. In a list item, `marker` is the column of the item marker. Each body
   * line loses the indent of the opening fence, as in CommonMark, and a line at or left of the
   * marker is refused. */
  code(marker = -1) {
    const opening = this.lines[this.i];
    const width = marker >= 0 ? indentOf(opening) : 0;
    const lang = opening.slice(width + 3).trim() || "text";
    this.i += 1;
    const body = [];
    for (; ; ) {
      const line = this.peek();
      if (line === null) break;
      if (marker >= 0 && line.trim() && indentOf(line) <= marker) this.fail(this.i, FENCE_LEAVES_ITEM);
      const text = line.slice(Math.min(width, indentOf(line)));
      if ((marker >= 0 ? text.trimStart() : text).startsWith("```")) break;
      body.push(text);
      this.i += 1;
    }
    this.i += 1;
    return `<div class="code" data-lang="${esc(lang, true)}"><pre><code>${esc(body.join("\n"))}</code></pre></div>`;
  }
  table() {
    const rows = [];
    for (; ; ) {
      const line = this.peek();
      if (line === null || !line.startsWith("|")) break;
      this.checkLine(line, this.i);
      rows.push(
        line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
      );
      this.i += 1;
    }
    const head = rows[0];
    const body = rows.slice(2);
    const th = head.map((cell) => `<th>${inline(cell, this.assetPrefix)}</th>`).join("");
    const trs = body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell, this.assetPrefix)}</td>`).join("")}</tr>`).join("");
    this.out.push(`<div class="scroller"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`);
  }
  /** Consume one list item's own text, including the lines it wraps onto. Any list marker
   * ends it, at any indent: a shallower one is the next item, a deeper one is a nested list,
   * and `itemBlocks` takes both. */
  itemText(indent, marker) {
    const index = this.i;
    const line = this.lines[this.i];
    this.checkLine(line, index);
    const text = line.trim().replace(marker, "");
    this.i += 1;
    const cont = [];
    for (; ; ) {
      const next = this.peek();
      if (next === null || !next.trim()) break;
      if (/^\s*(- |\d+\. )/.test(next)) break;
      if (next.startsWith("#") || next.startsWith("|") || opensBlock(next)) break;
      this.checkLine(next, this.i);
      cont.push(next.trim());
      this.i += 1;
    }
    return [text, ...cont].join(" ");
  }
  /**
   * The blocks that belong to an item under its own text: a nested list, a fenced code block,
   * a blockquote, and a continuation paragraph. Anything indented deeper than the item's
   * marker is part of the item and must NOT close the list.
   *
   * That last point is the whole reason this exists. An ordered list which closes and
   * reopens restarts its numbering, so a list of ten items, three of them carrying an indented
   * paragraph, rendered as a list of nine followed by a list of three, and its tenth item
   * printed as "1.". Nothing was refused and nothing looked broken.
   *
   * @returns markup to append to the still-open `<li>`.
   */
  itemBlocks(indent) {
    let html = "";
    for (; ; ) {
      let j = this.i;
      while (j < this.lines.length && !this.lines[j].trim()) j += 1;
      if (j >= this.lines.length) break;
      const next = this.lines[j];
      const cur = indentOf(next);
      if (cur <= indent) break;
      this.i = j;
      if (next.trimStart().startsWith("```")) html += this.code(indent);
      else if (next.trimStart().startsWith(">")) html += this.quote(indent);
      else if (/^\s*- /.test(next)) html += this.ulist(cur);
      else if (/^\s*\d+\. /.test(next)) html += this.olist(cur);
      else html += this.itemParagraph(indent);
    }
    return html;
  }
  /** One continuation paragraph inside a list item. It ends at a blank line, at a line no
   * deeper than the item's marker, at a nested list, or at a code block or a blockquote. */
  itemParagraph(indent) {
    const buffer = [];
    for (; ; ) {
      const line = this.peek();
      if (line === null || !line.trim() || indentOf(line) <= indent) break;
      if (buffer.length && (/^\s*(- |\d+\. )/.test(line) || opensBlock(line))) break;
      this.checkLine(line, this.i);
      buffer.push(line.trim());
      this.i += 1;
    }
    return `<p>${inline(buffer.join(" "), this.assetPrefix)}</p>`;
  }
  /** @returns the markup when `indent` is non-zero, so the caller can put it inside the
   * `<li>` that owns it; the empty string when the list is top level and already out. */
  ulist(indent) {
    const items = [];
    for (; ; ) {
      const line = this.peek();
      if (line === null) break;
      if (!line.trim()) {
        const next = this.lines[this.i + 1] ?? "";
        if (!/^\s*- /.test(next) || indentOf(next) !== indent) break;
        this.i += 1;
        continue;
      }
      if (!/^\s*- /.test(line) || indentOf(line) !== indent) break;
      items.push(`<li>${inline(this.itemText(indent, /^- /), this.assetPrefix)}${this.itemBlocks(indent)}`);
    }
    const chunk = `<ul>${items.map((item) => `${item}</li>`).join("")}</ul>`;
    if (indent) return chunk;
    this.out.push(chunk);
    return "";
  }
  /** The ordered twin of `ulist`, with the same contract. */
  olist(indent) {
    const items = [];
    for (; ; ) {
      const line = this.peek();
      if (line === null) break;
      if (!line.trim()) {
        const next = this.lines[this.i + 1] ?? "";
        if (!/^\s*\d+\. /.test(next) || indentOf(next) !== indent) break;
        this.i += 1;
        continue;
      }
      if (!/^\s*\d+\. /.test(line) || indentOf(line) !== indent) break;
      items.push(`<li>${inline(this.itemText(indent, /^\d+\. /), this.assetPrefix)}${this.itemBlocks(indent)}`);
    }
    const chunk = `<ol>${items.map((item) => `${item}</li>`).join("")}</ol>`;
    if (indent) return chunk;
    this.out.push(chunk);
    return "";
  }
};
function renderBody(input) {
  return new Renderer([...input.lines], input.source, input.bodyStart, input.assetPrefix).run();
}
function renderWithTemplate(markdown, sourceName, shell) {
  const missing = PLACEHOLDERS.filter((placeholder) => !shell.includes(placeholder));
  if (missing.length) throw new SpecError(`${TEMPLATE}: missing ${missing.join(", ")} placeholder(s)`);
  const domain = domainOf(sourceName);
  const lines = markdown.split("\n");
  const { head, start } = parseHead(lines, sourceName);
  const { body, toc } = new Renderer(lines.slice(start), sourceName, start).run();
  const nav = toc.map(
    (entry) => `<li><a href="#${entry.anchor}"><span class="n">${entry.eyebrow}</span>${esc(plain(entry.title))}</a></li>`
  ).join("");
  const values = /* @__PURE__ */ new Map([
    ["NAV", nav],
    ["BODY", body],
    ["TITLE", esc(head.title)],
    ["DATE", esc(head.date)],
    ["STATUS", esc(head.statusText)],
    ["SUBJECT", head.subject === null ? "" : esc(head.subject)],
    ["RANGE", head.range === null ? "" : esc(head.range)],
    ["STANDFIRST", head.standfirst],
    ["KIND", domain.label],
    ["KIND_CLASS", `kind-${domain.kind}`],
    ["SOURCE", esc(sourceName)]
  ]);
  const statusChip = `<li class="${LIVE_STATUSES.has(head.status) ? "chip is-live" : "chip"}">${values.get("STATUS")}</li>`;
  const subjectChip = head.subject === null ? "" : `<li class="chip">${values.get("SUBJECT")}</li>`;
  const rangeChip = head.range === null ? "" : `<li class="chip">${values.get("RANGE")}</li>`;
  const html = shell.replace(PLACEHOLDER_RE, (whole, name) => {
    if (whole === '<li class="chip">{{STATUS}}</li>') return statusChip;
    if (whole === '<li class="chip">{{SUBJECT}}</li>') return subjectChip;
    if (whole === '<li class="chip">{{RANGE}}</li>') return rangeChip;
    const value = values.get(name);
    if (value === void 0) throw new SpecError(`${TEMPLATE}: {{${name}}} has no substitution`);
    return value;
  });
  return { html, sections: toc.length };
}
function render(markdown, sourceName) {
  return renderWithTemplate(markdown, sourceName, readFileSync(TEMPLATE, "utf8"));
}

export {
  TEMPLATE_DIR,
  STATUS_VALUES,
  PLACEHOLDERS,
  SpecError,
  DOMAIN_RE,
  posixify,
  domainOf,
  plain,
  inline,
  renderBody,
  renderWithTemplate,
  render
};
//# sourceMappingURL=chunk-JYL7CKWM.js.map