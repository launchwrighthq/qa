/**
 * The folder of the page template `spec-template.html`. The package carries it in
 * `<package>/assets/renderer`. This file runs from `src/render/services/` (three folders down),
 * from a `dist/` chunk (one folder down), or in the framework from `modules/qa/ts/src/render/services/`,
 * where `assets/` sits next to `ts/` (four folders down). So the search walks up from this file to
 * the first folder that holds the template.
 */
declare const TEMPLATE_DIR: string;
/** The vocabulary `.claude/rules/lw/spec-format.md` defines for a spec or plan: the active
 * statuses then the settled ones. Mirrored here so a bad `Status:` fails at render time
 * rather than waiting for the hook. */
declare const STATUS_VALUES: readonly ["draft", "approved", "in-progress", "analysis", "blocked", "implemented", "superseded-by", "abandoned", "answered"];
type Status = (typeof STATUS_VALUES)[number];
declare const PLACEHOLDERS: readonly ["{{NAV}}", "{{BODY}}", "{{TITLE}}", "{{DATE}}", "{{STATUS}}", "{{SUBJECT}}", "{{RANGE}}", "{{STANDFIRST}}", "{{KIND}}", "{{KIND_CLASS}}", "{{SOURCE}}"];
/** Every refusal this tool makes. The message already names the file, and the line where
 * there is one, so a caller prints `err.message` and nothing else. */
declare class SpecError extends Error {
    constructor(message: string);
}
interface RenderResult {
    html: string;
    /** The number of `##` headings, which is the number of rows in the contents rail. */
    sections: number;
}
/** What a source's domain decides. Everything else about the page is shared. */
interface Domain {
    /** The directory under the repository root that a source of this kind lives in. */
    dir: string;
    /** The rail badge's modifier class, and the token a test names a kind by. */
    kind: 'spec' | 'plan';
    /** The word the rail badge prints. */
    label: string;
    /** The accepted `Status:` vocabulary, which is a property of the domain. */
    statuses: readonly string[];
}
/** The two domains, matched wherever the path starts: `docs/specs/<name>.md` and an
 * absolute path ending in it are the same document. The whole matched directory is the
 * capture, so `domainOf` compares it straight against `Domain.dir`. Backslashes are
 * normalised first. */
declare const DOMAIN_RE: RegExp;
declare const posixify: (path: string) => string;
/**
 * The domain `sourceName` belongs to.
 *
 * A source outside the two RAISES rather than taking a default. A default would put a
 * badge on the page saying which kind of document a reader is holding, chosen by nothing,
 * and the status vocabulary hangs off the same answer, so a document gets the kind its
 * directory names and nothing else.
 */
declare function domainOf(sourceName: string): Domain;
/** Strip inline markup for a context that cannot render it, such as a nav label. */
declare function plain(text: string): string;
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
declare function inline(text: string, assetPrefix?: string): string;
/** One `##` heading, as the contents rail needs it: anchor, eyebrow number, title. */
type TocEntry = {
    anchor: string;
    eyebrow: string;
    title: string;
};
/** The input of `renderBody`: the lines of a source below its header block. */
interface BodyInput {
    lines: readonly string[];
    /** The source path. Every refusal names it. */
    source: string;
    /** The 0-based index of `lines[0]` in the source, so a refusal names the real source line. */
    bodyStart: number;
    /** The `../` walk from the page back to the folder that holds `assets/`. */
    assetPrefix: string;
}
/** The rendered body and the rows of the contents rail. */
interface RenderedBody {
    body: string;
    toc: TocEntry[];
}
/** Render the body of a source whose header block the caller reads itself, such as a QA report. */
declare function renderBody(input: BodyInput): RenderedBody;
/** Render `markdown` into the page shell `shell`. `sourceName` names the source in every
 * refusal, supplies the date fallback, and is printed in the page footer. */
declare function renderWithTemplate(markdown: string, sourceName: string, shell: string): RenderResult;
/** Render the spec or plan `markdown` at `sourceName` into one page with the shipped template. */
declare function render(markdown: string, sourceName: string): RenderResult;

export { type BodyInput, DOMAIN_RE, type Domain, PLACEHOLDERS, type RenderResult, type RenderedBody, STATUS_VALUES, SpecError, type Status, TEMPLATE_DIR, type TocEntry, domainOf, inline, plain, posixify, render, renderBody, renderWithTemplate };
