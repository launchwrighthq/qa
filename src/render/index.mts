// The render submodule of @launchwrighthq/qa: the spec renderer (QA spec 2.12, audit fixes spec
// 2.8). `render` writes a spec or plan page, and `renderBody` renders the body of a QA report.
export {
  type BodyInput,
  type Domain,
  DOMAIN_RE,
  domainOf,
  inline,
  PLACEHOLDERS,
  plain,
  posixify,
  render,
  renderBody,
  type RenderedBody,
  type RenderResult,
  renderWithTemplate,
  SpecError,
  type Status,
  STATUS_VALUES,
  TEMPLATE_DIR,
  type TocEntry,
} from './services/spec-render.mts';
