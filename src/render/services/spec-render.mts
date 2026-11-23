// The spec renderer (QA spec 2.12, audit fixes spec 2.8): a spec, a plan or a QA report in
// Markdown becomes one HTML page. It handles exactly the constructs the specs use: a header block
// of H1/Date/Status, the optional Subject and Range fields and a standfirst, headings h2 through
// h4, paragraphs, ordered and unordered lists with one level of nesting, fenced code blocks, pipe
// tables, blockquotes, inline code, bold, italic, strikethrough and links. Anything outside that
// set fails with a `SpecError` that names the source file and the 1-based line number. The public
// entry is the subpath `@launchwrighthq/qa/render`. The command line entry is
// `tools/docs/spec2html.mts`; `ah spec render` of agent-harness is its Python port.
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The folder of the page template `spec-template.html`. A published package carries `assets/` in
 * its own folder (`<package>/assets/renderer`). In the framework repo, `assets/` sits next to
 * `ts/` (`modules/qa/assets/renderer`).
 */
export const TEMPLATE_DIR = templateDir();

function templateDir(): string {
  const published = fileURLToPath(new URL('../../../assets/renderer/', import.meta.url));
  return existsSync(published) ? published : fileURLToPath(new URL('../../../../assets/renderer/', import.meta.url));
}

const TEMPLATE = join(TEMPLATE_DIR, 'spec-template.html');

/** The vocabulary `.claude/rules/lw/spec-format.md` defines for a spec or plan: the active
 * statuses then the settled ones. Mirrored here so a bad `Status:` fails at render time
 * rather than waiting for the hook. */
export const STATUS_VALUES = [
  'draft',
  'approved',
  'in-progress',
  'analysis',
  'blocked',
  'implemented',
  'superseded-by',
  'abandoned',
  'answered',
] as const;

export type Status = (typeof STATUS_VALUES)[number];

/** Chips for these read as live; the rest read as not-yet-final. */
const LIVE_STATUSES = new Set<string>(['approved', 'in-progress', 'implemented']);

/** `Date:` and `Status:` are required; `Subject:` and `Range:` are optional in ALL THREE
 * domains, and an absent one drops its chip rather than printing an empty one. */
const HEADER_FIELD_RE = /^(Date|Status|Subject|Range):\s*(.*)$/;

/**
 * Finds `Status:` wherever it sits: a clean field line, a sentence with trailing prose
 * ("Status: implemented, landed on 2026-08-15"), or an HTML comment
 * (`<!-- Status: draft -->`). The corpus uses all three shapes, and a parser that accepts
 * only the clean one rejects most of what is already committed.
 */
const STATUS_TOKEN_RE = /\bStatus:\s*([a-z-]+)([^\n]*)/i;

/** The naming convention `.claude/rules/lw/spec-format.md` mandates. Used when a source
 * carries no `Date:` line of its own. */
const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})-/;

/** `![alt](url)`, the only image syntax this renderer reads. See `imageProblem` for the
 * one URL shape it accepts. */
const IMAGE_RE = /!\[([^\]]*)\]\(([^)]*)\)/g;

const MD_LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;

/** A paragraph whose whole content is one image or one video. Nothing else may share the line. */
const LONE_IMAGE_RE = /^<(?:img [^>]*>|video [^>]*>[^<]*<\/video>)$/;

/**
 * The asset extensions rendered as a PLAYER rather than a picture.
 *
 * A QA session records `.webm` from a browser and `.mp4` from a device, and both were being
 * written as `![...](assets/x.mp4)`, which emits an `<img>` that draws nothing at all. The
 * reader saw a blank box, or, when the author wrote the path in backticks instead, no box.
 */
const VIDEO_RE = /\.(?:mp4|webm)$/i;

/**
 * Wrap a top-level paragraph, and give a lone image a wider track than the prose.
 *
 * `article > *` is capped at `--measure` (68ch), which is the right width for a column of text
 * and the wrong one for a drawing: a 1400px mockup landed at about 600px, so its 13px labels
 * rendered at 5.6px and the picture became decoration. A figure now takes the same wide track
 * `.scroller` and `.code` already use, so it displays near 928px.
 *
 * Only a paragraph that is NOTHING BUT an image qualifies. An image with a sentence beside it is
 * prose, and prose keeps the measure.
 */
function asBlock(html: string): string {
  return LONE_IMAGE_RE.test(html) ? `<figure class="figure">${html}</figure>` : `<p>${html}</p>`;
}

export const PLACEHOLDERS = [
  '{{NAV}}',
  '{{BODY}}',
  '{{TITLE}}',
  '{{DATE}}',
  '{{STATUS}}',
  '{{SUBJECT}}',
  '{{RANGE}}',
  '{{STANDFIRST}}',
  '{{KIND}}',
  '{{KIND_CLASS}}',
  '{{SOURCE}}',
] as const;

/**
 * One pass over the template, left to right. A rendered value (a heading's text, a header
 * field) can itself contain literal `{{X}}` text; a single `replace` never rescans what it
 * just wrote, so that text reaches the page unchanged. A chain of `.replace()` calls does
 * rescan, and a spec quoting `{{TITLE}}` in its own prose had it rewritten with the real
 * title. The three `<li>` alternatives come first so they win the match at that position and
 * carry the whole chip element rather than only the token inside it.
 */
const PLACEHOLDER_RE =
  /<li class="chip">\{\{STATUS\}\}<\/li>|<li class="chip">\{\{SUBJECT\}\}<\/li>|<li class="chip">\{\{RANGE\}\}<\/li>|\{\{(\w+)\}\}/g;

/** Every refusal this tool makes. The message already names the file, and the line where
 * there is one, so a caller prints `err.message` and nothing else. */
export class SpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpecError';
  }
}

export interface RenderResult {
  html: string;
  /** The number of `##` headings, which is the number of rows in the contents rail. */
  sections: number;
}

/** What a source's domain decides. Everything else about the page is shared. */
export interface Domain {
  /** The directory under the repository root that a source of this kind lives in. */
  dir: string;
  /** The rail badge's modifier class, and the token a test names a kind by. */
  kind: 'spec' | 'plan';
  /** The word the rail badge prints. */
  label: string;
  /** The accepted `Status:` vocabulary, which is a property of the domain. */
  statuses: readonly string[];
}

export const DOMAINS: readonly Domain[] = [
  { dir: 'docs/specs', kind: 'spec', label: 'SPECIFICATION', statuses: STATUS_VALUES },
  { dir: 'docs/superpowers/plans', kind: 'plan', label: 'PLAN', statuses: STATUS_VALUES },
];

/** The two domains, matched wherever the path starts: `docs/specs/<name>.md` and an
 * absolute path ending in it are the same document. The whole matched directory is the
 * capture, so `domainOf` compares it straight against `Domain.dir`. Backslashes are
 * normalised first. */
export const DOMAIN_RE = /(?:^|\/)(docs\/specs|docs\/superpowers\/plans)\//;

export const posixify = (path: string): string => path.split('\\').join('/');

/**
 * The domain `sourceName` belongs to.
 *
 * A source outside the two RAISES rather than taking a default. A default would put a
 * badge on the page saying which kind of document a reader is holding, chosen by nothing,
 * and the status vocabulary hangs off the same answer, so a document gets the kind its
 * directory names and nothing else.
 */
export function domainOf(sourceName: string): Domain {
  const match = DOMAIN_RE.exec(posixify(sourceName));
  const found = match ? DOMAINS.find((domain) => domain.dir === (match[1] as string)) : undefined;
  if (!found) {
    throw new SpecError(
      `${sourceName}: not under ${DOMAINS.map((domain) => `${domain.dir}/`).join(', ')}, so it has no document kind`,
    );
  }
  return found;
}

/**
 * The `../` prefix that takes the PAGE back to its domain's `assets/`.
 *
 * `dist/` sits beside `assets/` in the same domain, so a page one level down writes
 * `../assets/<file>` and one in `dist/archive/` writes `../../assets/<file>`. The depth is
 * derived from the SOURCE, since `dist/` mirrors the source tree exactly.
 */
export function assetPrefixFor(sourceName: string): string {
  const domain = domainOf(sourceName);
  const posix = posixify(sourceName);
  const relative = posix.slice(posix.indexOf(`${domain.dir}/`) + domain.dir.length + 1);
  return '../'.repeat(relative.split('/').length);
}

/**
 * Why an image URL cannot be rendered, or null when it can.
 *
 * One accepted form: `assets/<file>`, the domain's own asset directory. A `data:` URI is
 * refused loudest because it is the form that looks like it works. Inlining is what made one
 * converted document 663KB for 45KB of text, and an image nobody can open in a file browser
 * cannot be reused by the next document that needs it.
 */
function imageProblem(url: string): string | null {
  if (/^data:/i.test(url)) {
    return `an inline data: image belongs in the domain's assets/, where it can be seen and reused`;
  }
  if (!/^assets\/[^/]/.test(url)) return `an image must be referenced as assets/<file>, not '${url}'`;
  return null;
}

/** Refuse every image form but `assets/<file>`, through the caller's own locator. */
function checkImages(line: string, fail: (message: string) => never): void {
  for (const match of line.matchAll(IMAGE_RE)) {
    const problem = imageProblem(match[2] as string);
    if (problem) fail(problem);
  }
}

/** The parsed header block. `status` is the bare token the valid-set check runs against;
 * `statusText` is what the page prints, which for `superseded-by` keeps the path. */
export interface Head {
  title: string;
  date: string;
  status: Status;
  statusText: string;
  subject: string | null;
  /** The commit range a QA report covers, and null in every document that writes none. */
  range: string | null;
  standfirst: string;
}

function esc(text: string, quote = false): string {
  const out = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return quote ? out.replace(/"/g, '&quot;').replace(/'/g, '&#x27;') : out;
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Strip inline markup for a context that cannot render it, such as a nav label. */
export function plain(text: string): string {
  return text.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * Bold, italic and strikethrough over already-escaped text with no code spans left in it.
 *
 * Bold runs first so `**bold *and italic* text**` keeps its outer pair: the lazy `(.+?)`
 * stops at the next literal `**`, and the captured group goes back through this function
 * before it is wrapped, which is how the inner `*and italic*` becomes `<em>` while the
 * `<strong>` closes around it. What is left carries no `**` at all, so the italic patterns
 * below cannot re-split a bold pair into two italics.
 *
 * `_text_` triggers italic only when neither side touches a word character, the same
 * intraword rule GFM applies: this corpus's prose is full of `snake_case_identifiers`
 * outside backticks, and a plain `_(.+?)_` would light half of them up.
 */
export function emphasis(text: string): string {
  let out = text.replace(/\*\*(.+?)\*\*/g, (_m, inner: string) => `<strong>${emphasis(inner)}</strong>`);
  out = out.replace(/~~(.+?)~~/g, '<s>$1</s>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/(?<![A-Za-z0-9_])_(.+?)_(?![A-Za-z0-9_])/g, '<em>$1</em>');
  return out;
}

interface Piece {
  code: boolean;
  text: string;
}

/**
 * Split a line into code spans and the text between them, LONGEST BACKTICK RUN FIRST.
 *
 * A run of N backticks opens a span that only a run of exactly N closes, so a span
 * delimited by two backticks may contain one. A single `` `([^`]+)` `` regex pairs the wrong
 * backticks of ``` `` `[text](url)` `` ``` and leaves the link live, so this is a scanner: a
 * regex engine that advances one character at a time cannot prefer the longer opener.
 *
 * An unclosed run is not an error. Its backticks are emitted as ordinary text and the scan
 * resumes after them, so a line can never consume the parser without producing output.
 */
export function splitCodeSpans(text: string): Piece[] {
  const pieces: Piece[] = [];
  let buffer = '';
  let i = 0;

  const runLength = (at: number): number => {
    let n = 0;
    while (text[at + n] === '`') n += 1;
    return n;
  };

  while (i < text.length) {
    if (text[i] !== '`') {
      buffer += text[i];
      i += 1;
      continue;
    }
    const open = runLength(i);
    const contentStart = i + open;
    let j = contentStart;
    let close = -1;
    while (j < text.length) {
      if (text[j] !== '`') {
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
      buffer = '';
    }
    // One leading and one trailing space are stripped, per CommonMark. Without that a span
    // whose content starts or ends with a backtick has no spelling at all: the space is the
    // only thing separating the content's backtick from the delimiter's.
    let content = text.slice(contentStart, close);
    if (content.length > 1 && content.startsWith(' ') && content.endsWith(' ') && content.trim()) {
      content = content.slice(1, -1);
    }
    pieces.push({ code: true, text: content });
    i = close + open;
  }
  if (buffer) pieces.push({ code: false, text: buffer });
  return pieces;
}

/** The line with every code span removed, for a check that must not see quoted syntax. */
function withoutCodeSpans(text: string): string {
  return splitCodeSpans(text)
    .filter((piece) => !piece.code)
    .map((piece) => piece.text)
    .join('');
}

/**
 * Escape, then apply inline markup. Code spans, images and links are protected from the rest.
 *
 * All three are stashed behind markers before the surrounding text is escaped: a code span
 * holds its content raw and is escaped only at reinsertion, and an image or a link is built
 * to its final element right here, so the outer escape and emphasis passes never see `[]()`
 * syntax or a raw URL. Images go first, because `![alt](url)` contains a link's own syntax
 * and the link pass would take `[alt](url)` out of it and leave the `!` behind. Links are
 * put back BEFORE code spans, so a code span written inside link text still reaches the page.
 *
 * @param assetPrefix the `../` walk from the PAGE back to the domain's `assets/`, since a
 * source writes `assets/<file>` and the page that renders it lives one or two levels deeper.
 */
export function inline(text: string, assetPrefix = ''): string {
  const codes: string[] = [];
  const links: string[] = [];

  let staged = '';
  for (const piece of splitCodeSpans(text)) {
    if (piece.code) {
      codes.push(piece.text);
      staged += `\u0000${codes.length - 1}\u0000`;
    } else {
      staged += piece.text;
    }
  }

  staged = staged.replace(IMAGE_RE, (_m, alt: string, url: string) => {
    // The block layer refuses a bad image with a file and a line. This is the backstop for a
    // caller that reaches `inline` directly, so no refused form is ever rendered instead.
    const problem = imageProblem(url);
    if (problem) throw new SpecError(problem);
    const src = esc(assetPrefix + url, true);
    links.push(
      VIDEO_RE.test(url)
        ? // `playsinline` so iOS does not take the recording fullscreen, `preload="metadata"` so a
          // page of ten recordings costs ten headers rather than ten files, and `alt` becomes the
          // fallback sentence for a browser that will not play it.
          `<video src="${src}" controls playsinline preload="metadata">${esc(alt)}</video>`
        : `<img src="${src}" alt="${esc(alt, true)}" loading="lazy">`,
    );
    return `\u0001${links.length - 1}\u0001`;
  });

  staged = staged.replace(MD_LINK_RE, (_m, label: string, url: string) => {
    /* A LINK INTO `assets/` TAKES THE SAME WALK AN IMAGE DOES. The page renders one or two
       levels below the domain, so a source's `assets/<file>` resolves to `dist/assets/<file>`
       and 404s. Images were already prefixed; a link to a hand-written asset page was not, and
       the only such link in the tree opened nothing. */
    const href = /^assets\/[^/]/.test(url) ? assetPrefix + url : url;
    links.push(`<a href="${esc(href, true)}">${emphasis(esc(label))}</a>`);
    return `\u0001${links.length - 1}\u0001`;
  });
  staged = esc(staged);
  staged = emphasis(staged);
  staged = staged.replace(/\u0001(\d+)\u0001/g, (_m, n: string) => links[Number(n)] as string);
  staged = staged.replace(/\u0000(\d+)\u0000/g, (_m, n: string) => `<code>${esc(codes[Number(n)] as string)}</code>`);
  return staged;
}

/**
 * The H1, the Date/Status/Subject fields, and the standfirst paragraph(s).
 *
 * Returns the parsed header and the index of the first body line. The header region is
 * everything above the first `##`, and the fields are searched across ALL of it rather than
 * read from the lines under the title: two committed specs write `Status:` ABOVE their `# `
 * title, and a parser that expects the field to follow the title rejects both.
 */
export function parseHead(lines: string[], sourceName: string): { head: Head; start: number } {
  const domain = domainOf(sourceName);
  const assetPrefix = assetPrefixFor(sourceName);
  const bodyStart = lines.findIndex((line) => line.startsWith('##'));
  const end = bodyStart === -1 ? lines.length : bodyStart;
  const header = lines.slice(0, end);

  const titleIndex = header.findIndex((line) => /^#\s/.test(line));
  if (titleIndex === -1) throw new SpecError(`${sourceName}: missing a '# H1' at the top of the file`);
  const title = (header[titleIndex] as string).slice(1).trim();

  const fields = new Map<string, string>();
  const consumed = new Set<number>([titleIndex]);
  header.forEach((line, n) => {
    const match = HEADER_FIELD_RE.exec(line);
    if (!match) return;
    if (!fields.has(match[1] as string)) fields.set(match[1] as string, (match[2] as string).trim());
    consumed.add(n);
  });

  let date = fields.get('Date') ?? null;
  if (date === null) {
    const prefix = DATE_PREFIX_RE.exec(basename(sourceName));
    date = prefix ? (prefix[1] as string) : null;
  }
  if (date === null) {
    throw new SpecError(
      `${sourceName}: missing 'Date:' below the H1, and '${basename(sourceName)}' has no YYYY-MM-DD- prefix`,
    );
  }

  // A field line gives the status directly. When there is none, the whole header region is
  // searched, which is what accepts the `<!-- Status: ... -->` comment form.
  let statusMatch = fields.has('Status') ? STATUS_TOKEN_RE.exec(`Status: ${fields.get('Status') as string}`) : null;
  if (!statusMatch) {
    statusMatch = STATUS_TOKEN_RE.exec(header.join('\n'));
    header.forEach((line, n) => {
      if (/\bStatus:/i.test(line) && /^\s*<!--.*-->\s*$/.test(line)) consumed.add(n);
    });
  }
  if (!statusMatch) throw new SpecError(`${sourceName}: missing 'Status:' below the H1`);
  const token = (statusMatch[1] as string).toLowerCase();
  // The accepted set is the DOMAIN's. A specification and a plan share one vocabulary here,
  // and a word outside it lands in this branch, where the message names the directory so the
  // author can see where the status is rejected.
  if (!domain.statuses.includes(token)) {
    throw new SpecError(
      `${sourceName}: Status '${token}' is not one of ${domain.statuses.join(', ')} for a document in ${domain.dir}/`,
    );
  }
  // Every other status is one word and any trailing prose is commentary. `superseded-by`
  // is the exception: the path after it IS the value, and dropping it loses the pointer
  // that `docs-shape`'s superseded assertion follows.
  const tail = (statusMatch[2] as string).replace(/-->\s*$/, '').trim();
  const statusText = token === 'superseded-by' && tail ? `${token} ${tail}` : token;

  // The standfirst is every remaining paragraph above the first `##`, blank-line breaks
  // collapsed to spaces, because the template has one `<p class="standfirst">` to hold it.
  const paragraphs: string[] = [];
  let current: string[] = [];
  header.forEach((line, n) => {
    if (consumed.has(n)) return;
    // The body's own image check lives in `Renderer.checkLine`, which never sees the header.
    // Without this a `data:` URI in a standfirst would reach `inline`, whose backstop can
    // name the problem but not where it is.
    checkImages(line, (message) => {
      throw new SpecError(`${sourceName}:${n + 1}: ${message}`);
    });
    if (line.trim()) current.push(line.trim());
    else if (current.length) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  });
  if (current.length) paragraphs.push(current.join(' '));

  const head: Head = {
    title,
    date,
    status: token as Status,
    statusText,
    subject: fields.get('Subject') ?? null,
    range: fields.get('Range') ?? null,
    standfirst: inline(paragraphs.join(' '), assetPrefix),
  };
  return { head, start: end };
}

/** One `##` heading, as the contents rail needs it: anchor, eyebrow number, title. */
export type TocEntry = { anchor: string; eyebrow: string; title: string };

const indentOf = (line: string): number => line.length - line.replace(/^\s+/, '').length;

/** True for the first line of a fenced code block or a blockquote, at any indent. */
const opensBlock = (line: string): boolean => /^(```|>)/.test(line.trimStart());

const FENCE_LEAVES_ITEM =
  'a fenced code block in a list item has a line at or left of the item marker. Indent every' +
  ' line of the block, the closing fence too, under the item text, or end the list with a' +
  ' blank line and start the fence at the left margin below it';

class Renderer {
  private i = 0;
  private readonly out: string[] = [];
  private readonly tocEntries: TocEntry[] = [];
  private readonly anchors = new Set<string>();

  /**
   * @param start how many lines of `sourceName` were consumed by the header block, so a
   * 0-based index into `lines` reports as the real 1-based line of the source file.
   */
  private readonly lines: string[];
  private readonly sourceName: string;
  private readonly start: number;
  private readonly assetPrefix: string;

  // Plain fields, not parameter properties, so node runs this file with type stripping alone.
  constructor(
    lines: string[],
    sourceName: string,
    start = 0,
    /** Defaulted from the source, so the caller cannot pass a prefix that disagrees with it. */
    assetPrefix = assetPrefixFor(sourceName),
  ) {
    this.lines = lines;
    this.sourceName = sourceName;
    this.start = start;
    this.assetPrefix = assetPrefix;
  }

  private peek(): string | null {
    return this.i < this.lines.length ? (this.lines[this.i] as string) : null;
  }

  run(): { body: string; toc: TocEntry[] } {
    while (this.i < this.lines.length) {
      const line = this.lines[this.i] as string;
      if (!line.trim()) this.i += 1;
      else if (line.startsWith('```')) this.out.push(this.code());
      else if (line.startsWith('>')) this.out.push(this.quote());
      else if (line.startsWith('#')) this.heading();
      else if (line.startsWith('| ')) this.table();
      else if (/^- /.test(line)) this.ulist(0);
      else if (/^\d+\. /.test(line)) this.olist(0);
      else this.para();
    }
    return { body: this.out.join('\n'), toc: this.tocEntries };
  }

  private fail(index: number, message: string): never {
    throw new SpecError(`${this.sourceName}:${this.start + index + 1}: ${message}`);
  }

  /** Refuse what this renderer cannot express, rather than emit a silently wrong page. */
  private checkLine(line: string, index: number): void {
    checkImages(withoutCodeSpans(line), (message) => this.fail(index, message));
  }

  /**
   * A slug unique within this render.
   *
   * Two headings with identical text otherwise emit the same id, and every rail link aimed
   * at the second scrolls to the first. `slug()` has no memory of what it already emitted;
   * this is that memory, appending `-2`, `-3`, ... on a collision.
   */
  private anchor(text: string): string {
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

  private heading(): void {
    const index = this.i;
    const line = this.lines[this.i] as string;
    this.i += 1;
    this.checkLine(line, index);
    const level = line.length - line.replace(/^#+/, '').length;
    const text = line.slice(level).trim();
    const numbered = /^(\d+(?:\.\d+)*)(\.?)\s+(.*)$/.exec(text);
    const anchor = this.anchor(text);
    const eyebrow = numbered ? (numbered[1] as string) : '';
    const dot = numbered ? (numbered[2] as string) : '';
    const title = numbered ? (numbered[3] as string) : text;
    if (level === 2) this.tocEntries.push({ anchor, eyebrow, title });
    // The heading's text spells the source line, `4. The section title`, dot and space
    // included, so a selection copied off the page pastes as one greppable line. The eyebrow
    // is an inline-block, not a grid item: a grid item is a block, and a block boundary
    // copies as a newline. The title is text, not a link: a click meant to start a selection
    // followed the anchor and scrolled the page. An UNNUMBERED heading emits no eyebrow, so
    // `no-eyebrow` drops the gutter its title would otherwise wrap inside.
    const eb = eyebrow ? `<span class="eyebrow">${eyebrow}${dot} </span>` : '';
    this.out.push(
      `<h${level} id="${anchor}" class="h${level}${eyebrow ? '' : ' no-eyebrow'}">` +
        `${eb}${inline(title, this.assetPrefix)}</h${level}>`,
    );
  }

  private para(): void {
    // The first line is taken BEFORE the loop tests anything, so this always advances.
    // `run` sends a line here whenever no other branch claims it, and the loop's own stop
    // pattern includes `|`. A line opening with a single `|` and no space matched neither
    // the table branch nor this loop, so the index never moved and the render hung rather
    // than failed: MEASURED upstream on 2026-08-18, `|bad` on its own line spun until it
    // was killed. A table separator row is exactly that shape. A parser that can refuse a
    // line must still consume it.
    this.checkLine(this.lines[this.i] as string, this.i);
    const buffer: string[] = [(this.lines[this.i] as string).trim()];
    this.i += 1;
    for (;;) {
      const next = this.peek();
      if (next === null || !next.trim() || /^(```|#|\||- |\d+\. |>)/.test(next)) break;
      this.checkLine(next, this.i);
      buffer.push(next.trim());
      this.i += 1;
    }
    this.out.push(asBlock(inline(buffer.join(' '), this.assetPrefix)));
  }

  /** A blockquote. In a list item, `marker` is the column of the item marker: each line sits
   * right of it, and its indent is stripped. */
  private quote(marker = -1): string {
    const buffer: string[] = [];
    for (;;) {
      const line = this.peek();
      if (line === null || (marker >= 0 && indentOf(line) <= marker)) break;
      const text = marker >= 0 ? line.trimStart() : line;
      if (!text.startsWith('>')) break;
      this.checkLine(line, this.i);
      const stripped = text.replace(/^>\s?/, '').trim();
      if (stripped) buffer.push(stripped);
      this.i += 1;
    }
    return `<blockquote><p>${inline(buffer.join(' '), this.assetPrefix)}</p></blockquote>`;
  }

  /** A fenced code block. In a list item, `marker` is the column of the item marker. Each body
   * line loses the indent of the opening fence, as in CommonMark, and a line at or left of the
   * marker is refused. */
  private code(marker = -1): string {
    const opening = this.lines[this.i] as string;
    const width = marker >= 0 ? indentOf(opening) : 0;
    const lang = opening.slice(width + 3).trim() || 'text';
    this.i += 1;
    const body: string[] = [];
    for (;;) {
      const line = this.peek();
      if (line === null) break;
      if (marker >= 0 && line.trim() && indentOf(line) <= marker) this.fail(this.i, FENCE_LEAVES_ITEM);
      const text = line.slice(Math.min(width, indentOf(line)));
      if ((marker >= 0 ? text.trimStart() : text).startsWith('```')) break;
      body.push(text);
      this.i += 1;
    }
    this.i += 1;
    return `<div class="code" data-lang="${esc(lang, true)}"><pre><code>${esc(body.join('\n'))}</code></pre></div>`;
  }

  private table(): void {
    const rows: string[][] = [];
    for (;;) {
      const line = this.peek();
      if (line === null || !line.startsWith('|')) break;
      this.checkLine(line, this.i);
      rows.push(
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim()),
      );
      this.i += 1;
    }
    const head = rows[0] as string[];
    const body = rows.slice(2);
    const th = head.map((cell) => `<th>${inline(cell, this.assetPrefix)}</th>`).join('');
    const trs = body
      .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell, this.assetPrefix)}</td>`).join('')}</tr>`)
      .join('');
    this.out.push(`<div class="scroller"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`);
  }

  /** Consume one list item's own text, including the lines it wraps onto. Any list marker
   * ends it, at any indent: a shallower one is the next item, a deeper one is a nested list,
   * and `itemBlocks` takes both. */
  private itemText(indent: number, marker: RegExp): string {
    const index = this.i;
    const line = this.lines[this.i] as string;
    this.checkLine(line, index);
    const text = line.trim().replace(marker, '');
    this.i += 1;
    const cont: string[] = [];
    for (;;) {
      const next = this.peek();
      if (next === null || !next.trim()) break;
      if (/^\s*(- |\d+\. )/.test(next)) break;
      if (next.startsWith('#') || next.startsWith('|') || opensBlock(next)) break;
      this.checkLine(next, this.i);
      cont.push(next.trim());
      this.i += 1;
    }
    return [text, ...cont].join(' ');
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
  private itemBlocks(indent: number): string {
    let html = '';
    for (;;) {
      let j = this.i;
      while (j < this.lines.length && !(this.lines[j] as string).trim()) j += 1;
      if (j >= this.lines.length) break;
      const next = this.lines[j] as string;
      const cur = indentOf(next);
      if (cur <= indent) break;
      this.i = j;
      if (next.trimStart().startsWith('```')) html += this.code(indent);
      else if (next.trimStart().startsWith('>')) html += this.quote(indent);
      else if (/^\s*- /.test(next)) html += this.ulist(cur);
      else if (/^\s*\d+\. /.test(next)) html += this.olist(cur);
      else html += this.itemParagraph(indent);
    }
    return html;
  }

  /** One continuation paragraph inside a list item. It ends at a blank line, at a line no
   * deeper than the item's marker, at a nested list, or at a code block or a blockquote. */
  private itemParagraph(indent: number): string {
    const buffer: string[] = [];
    for (;;) {
      const line = this.peek();
      if (line === null || !line.trim() || indentOf(line) <= indent) break;
      if (buffer.length && (/^\s*(- |\d+\. )/.test(line) || opensBlock(line))) break;
      this.checkLine(line, this.i);
      buffer.push(line.trim());
      this.i += 1;
    }
    return `<p>${inline(buffer.join(' '), this.assetPrefix)}</p>`;
  }

  /** @returns the markup when `indent` is non-zero, so the caller can put it inside the
   * `<li>` that owns it; the empty string when the list is top level and already out. */
  private ulist(indent: number): string {
    const items: string[] = [];
    for (;;) {
      const line = this.peek();
      if (line === null) break;
      if (!line.trim()) {
        const next = this.lines[this.i + 1] ?? '';
        if (!/^\s*- /.test(next) || indentOf(next) !== indent) break;
        this.i += 1;
        continue;
      }
      if (!/^\s*- /.test(line) || indentOf(line) !== indent) break;
      items.push(`<li>${inline(this.itemText(indent, /^- /), this.assetPrefix)}${this.itemBlocks(indent)}`);
    }
    const chunk = `<ul>${items.map((item) => `${item}</li>`).join('')}</ul>`;
    if (indent) return chunk;
    this.out.push(chunk);
    return '';
  }

  /** The ordered twin of `ulist`, with the same contract. */
  private olist(indent: number): string {
    const items: string[] = [];
    for (;;) {
      const line = this.peek();
      if (line === null) break;
      if (!line.trim()) {
        const next = this.lines[this.i + 1] ?? '';
        if (!/^\s*\d+\. /.test(next) || indentOf(next) !== indent) break;
        this.i += 1;
        continue;
      }
      if (!/^\s*\d+\. /.test(line) || indentOf(line) !== indent) break;
      items.push(`<li>${inline(this.itemText(indent, /^\d+\. /), this.assetPrefix)}${this.itemBlocks(indent)}`);
    }
    const chunk = `<ol>${items.map((item) => `${item}</li>`).join('')}</ol>`;
    if (indent) return chunk;
    this.out.push(chunk);
    return '';
  }
}

/** The input of `renderBody`: the lines of a source below its header block. */
export interface BodyInput {
  lines: readonly string[];
  /** The source path. Every refusal names it. */
  source: string;
  /** The 0-based index of `lines[0]` in the source, so a refusal names the real source line. */
  bodyStart: number;
  /** The `../` walk from the page back to the folder that holds `assets/`. */
  assetPrefix: string;
}

/** The rendered body and the rows of the contents rail. */
export interface RenderedBody {
  body: string;
  toc: TocEntry[];
}

/** Render the body of a source whose header block the caller reads itself, such as a QA report. */
export function renderBody(input: BodyInput): RenderedBody {
  return new Renderer([...input.lines], input.source, input.bodyStart, input.assetPrefix).run();
}

/** Render `markdown` into the page shell `shell`. `sourceName` names the source in every
 * refusal, supplies the date fallback, and is printed in the page footer. */
export function renderWithTemplate(markdown: string, sourceName: string, shell: string): RenderResult {
  const missing = PLACEHOLDERS.filter((placeholder) => !shell.includes(placeholder));
  if (missing.length) throw new SpecError(`${TEMPLATE}: missing ${missing.join(', ')} placeholder(s)`);

  const domain = domainOf(sourceName);
  const lines = markdown.split('\n');
  const { head, start } = parseHead(lines, sourceName);
  const { body, toc } = new Renderer(lines.slice(start), sourceName, start).run();
  const nav = toc
    .map(
      (entry) =>
        `<li><a href="#${entry.anchor}"><span class="n">${entry.eyebrow}</span>` +
        `${esc(plain(entry.title))}</a></li>`,
    )
    .join('');

  const values = new Map<string, string>([
    ['NAV', nav],
    ['BODY', body],
    ['TITLE', esc(head.title)],
    ['DATE', esc(head.date)],
    ['STATUS', esc(head.statusText)],
    ['SUBJECT', head.subject === null ? '' : esc(head.subject)],
    ['RANGE', head.range === null ? '' : esc(head.range)],
    ['STANDFIRST', head.standfirst],
    ['KIND', domain.label],
    ['KIND_CLASS', `kind-${domain.kind}`],
    ['SOURCE', esc(sourceName)],
  ]);

  // The status chip's class is data-driven and an absent `Subject:` or `Range:` drops its
  // chip entirely, so all three replace the whole `<li>` rather than the token inside it.
  const statusChip = `<li class="${LIVE_STATUSES.has(head.status) ? 'chip is-live' : 'chip'}">${values.get('STATUS') as string}</li>`;
  const subjectChip = head.subject === null ? '' : `<li class="chip">${values.get('SUBJECT') as string}</li>`;
  const rangeChip = head.range === null ? '' : `<li class="chip">${values.get('RANGE') as string}</li>`;

  const html = shell.replace(PLACEHOLDER_RE, (whole, name: string | undefined) => {
    if (whole === '<li class="chip">{{STATUS}}</li>') return statusChip;
    if (whole === '<li class="chip">{{SUBJECT}}</li>') return subjectChip;
    if (whole === '<li class="chip">{{RANGE}}</li>') return rangeChip;
    const value = values.get(name as string);
    if (value === undefined) throw new SpecError(`${TEMPLATE}: {{${name}}} has no substitution`);
    return value;
  });

  return { html, sections: toc.length };
}

/** Render the spec or plan `markdown` at `sourceName` into one page with the shipped template. */
export function render(markdown: string, sourceName: string): RenderResult {
  return renderWithTemplate(markdown, sourceName, readFileSync(TEMPLATE, 'utf8'));
}
