"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/states-host/index.mts
var states_host_exports = {};
__export(states_host_exports, {
  QA_DEV_MARKER: () => QA_DEV_MARKER,
  QA_STATES_ATTRIBUTE: () => QA_STATES_ATTRIBUTE,
  QA_STATES_PATH: () => QA_STATES_PATH,
  QA_STATES_ROOT_ID: () => QA_STATES_ROOT_ID,
  qaStatesEntry: () => qaStatesEntry,
  qaStatesHtml: () => qaStatesHtml,
  qaStatesPage: () => qaStatesPage,
  readStatesRequest: () => readStatesRequest,
  startStatesPage: () => startStatesPage
});
module.exports = __toCommonJS(states_host_exports);

// node_modules/.pnpm/tsup@8.5.1_postcss@8.5.33_tsx@4.23.15_typescript@6.0.3/node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/states-host/names.mts
var QA_DEV_MARKER = "lw-qa-dev-only";
var QA_STATES_PATH = "/__states";
var QA_STATES_ATTRIBUTE = "data-qa-states";
var QA_STATES_ROOT_ID = "lw-qa-states";

// src/kernel/services/errors.mts
var LaunchwrightError = class extends Error {
  code;
  context;
  constructor(code, message, opts) {
    super(message, opts && "cause" in opts ? { cause: opts.cause } : void 0);
    this.name = new.target.name;
    this.code = code;
    this.context = opts?.context ?? {};
  }
};
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

// src/states-host/page.mts
var isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function readStatesRequest(search, names) {
  const query = new URLSearchParams(search);
  const name = query.get("c");
  if (!name) return "No component named. Add ?c=<Component>.";
  if (!names.includes(name)) return `No component named ${name} is mountable.`;
  const raw = query.get("props");
  let props = {};
  if (raw !== null && raw !== "") {
    try {
      props = JSON.parse(raw);
    } catch (err) {
      return `props is not JSON: ${messageOf(err)}`;
    }
  }
  if (!isPlainObject(props)) return 'props must be a JSON object, for example {"state":"locked"}.';
  return { name, props };
}
function drawFailure(root, reason, names) {
  const panel = document.createElement("div");
  panel.setAttribute("role", "alert");
  panel.setAttribute("data-qa-states-error", QA_DEV_MARKER);
  const text = document.createElement("p");
  text.textContent = reason;
  const known = document.createElement("p");
  known.textContent = `Mountable: ${names.join(", ")}`;
  panel.append(text, known);
  root.replaceChildren(panel);
  root.setAttribute("aria-busy", "false");
  console.error(`[launchwright] /__states: ${reason}`);
}
async function startStatesPage(opts) {
  const selector = `#${QA_STATES_ROOT_ID}[${QA_STATES_ATTRIBUTE}="${QA_DEV_MARKER}"]`;
  const root = document.querySelector(selector);
  if (root === null) throw new LaunchwrightError("client.qa.states.root", `/__states: the page has no ${selector} element`);
  const names = Object.keys(opts.components).sort();
  const request = readStatesRequest(opts.search ?? window.location.search, names);
  if (typeof request === "string") return drawFailure(root, request, names);
  const { name, props } = request;
  const load = opts.components[name];
  let mod;
  try {
    mod = load === void 0 ? {} : await load();
  } catch (err) {
    return drawFailure(root, `${name} could not load: ${messageOf(err)}`, names);
  }
  const component = mod[name] ?? mod.default;
  if (typeof component !== "function") return drawFailure(root, `The module of ${name} exports no component named ${name} and no default export.`, names);
  const target = document.createElement("div");
  target.setAttribute("data-qa-subject", name);
  root.replaceChildren(target);
  const fail = (reason) => drawFailure(root, reason, names);
  try {
    opts.mount({ name, component, props, target, ...opts.wrapper !== void 0 ? { wrapper: opts.wrapper } : {}, fail });
  } catch (err) {
    return fail(`${name} threw while rendering: ${messageOf(err)}`);
  }
  root.setAttribute("aria-busy", "false");
}

// src/states-host/vite.mts
var import_node_fs = require("fs");
var import_node_url = require("url");
var ENTRY_ID = "virtual:lw-qa-states";
var RESOLVED_ENTRY_ID = `\0${ENTRY_ID}`;
function fsUrl(root, path) {
  const absolute = /^(?:\/|[A-Za-z]:[\\/])/.test(path) ? path : `${root}/${path.replace(/^\.\//, "")}`;
  const slashed = absolute.replace(/\\/g, "/");
  return `/@fs${slashed.startsWith("/") ? "" : "/"}${slashed}`;
}
function ownUrl(name) {
  const candidates = [`./${name}.mts`, `./states-host/${name}.js`].map((relative) => (0, import_node_url.fileURLToPath)(new URL(relative, importMetaUrl)));
  const found = candidates.find((path) => (0, import_node_fs.existsSync)(path));
  if (found === void 0) throw new LaunchwrightError("client.qa.states.files", `The state page file ${name} is missing from the package`, { context: { candidates } });
  return fsUrl("", found);
}
function qaStatesEntry(opts, root) {
  const mount = opts.framework === "react" ? `import { mountReactState as mount } from ${JSON.stringify(ownUrl("react"))};` : `import { mountSolidState as mount } from ${JSON.stringify(ownUrl("solid"))};`;
  const wrapper = opts.wrapper === void 0 ? "const wrapper = undefined;" : `import wrapper from ${JSON.stringify(fsUrl(root, opts.wrapper))};`;
  const components = Object.entries(opts.components).map(([name, path]) => `  ${JSON.stringify(name)}: () => import(${JSON.stringify(fsUrl(root, path))}),`).join("\n");
  return `// ${QA_DEV_MARKER}: the entry of the dev state page.
import { startStatesPage } from ${JSON.stringify(ownUrl("page"))};
${mount}
${wrapper}
const components = {
${components}
};
void startStatesPage({ components, wrapper, mount });
`;
}
function qaStatesHtml() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>States</title></head>
<body>
<main id="${QA_STATES_ROOT_ID}" ${QA_STATES_ATTRIBUTE}="${QA_DEV_MARKER}" aria-busy="true"></main>
<script type="module" src="/@id/__x00__${ENTRY_ID}"></script>
</body>
</html>
`;
}
function qaStatesPage(opts) {
  if (Object.keys(opts.components).length === 0) throw new LaunchwrightError("client.qa.states.components", "qaStatesPage needs at least one component");
  let config;
  return {
    name: "launchwright:qa-states",
    apply: "serve",
    configResolved(resolved) {
      config = resolved;
    },
    resolveId(id) {
      return id === ENTRY_ID ? RESOLVED_ENTRY_ID : void 0;
    },
    load(id) {
      if (id !== RESOLVED_ENTRY_ID) return void 0;
      if (config === void 0) throw new LaunchwrightError("client.qa.states.config", "The state page entry loaded before Vite resolved the config");
      return qaStatesEntry(opts, config.root);
    },
    configureServer(server) {
      const base = server.config.base;
      const pagePath = `${base.replace(/\/$/, "")}${QA_STATES_PATH}`;
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        if (req.method !== "GET" || new URL(url, "http://dev.invalid").pathname !== pagePath) return next();
        server.transformIndexHtml(url, qaStatesHtml(), req.originalUrl).then((html) => {
          res.statusCode = 200;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.end(html);
        }).catch((err) => next(new LaunchwrightError("client.qa.states.page", "The state page could not be transformed", { cause: err })));
      });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  QA_DEV_MARKER,
  QA_STATES_ATTRIBUTE,
  QA_STATES_PATH,
  QA_STATES_ROOT_ID,
  qaStatesEntry,
  qaStatesHtml,
  qaStatesPage,
  readStatesRequest,
  startStatesPage
});
//# sourceMappingURL=states-host.cjs.map