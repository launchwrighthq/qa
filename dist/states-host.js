import {
  readStatesRequest,
  startStatesPage
} from "./chunk-DN6FXBHF.js";
import {
  QA_DEV_MARKER,
  QA_STATES_ATTRIBUTE,
  QA_STATES_PATH,
  QA_STATES_ROOT_ID
} from "./chunk-277Y4WQJ.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/states-host/vite.mts
import { existsSync } from "fs";
import { fileURLToPath } from "url";
var ENTRY_ID = "virtual:lw-qa-states";
var RESOLVED_ENTRY_ID = `\0${ENTRY_ID}`;
function fsUrl(root, path) {
  const absolute = /^(?:\/|[A-Za-z]:[\\/])/.test(path) ? path : `${root}/${path.replace(/^\.\//, "")}`;
  const slashed = absolute.replace(/\\/g, "/");
  return `/@fs${slashed.startsWith("/") ? "" : "/"}${slashed}`;
}
function ownUrl(name) {
  const candidates = [`./${name}.mts`, `./states-host/${name}.js`].map((relative) => fileURLToPath(new URL(relative, import.meta.url)));
  const found = candidates.find((path) => existsSync(path));
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
export {
  QA_DEV_MARKER,
  QA_STATES_ATTRIBUTE,
  QA_STATES_PATH,
  QA_STATES_ROOT_ID,
  qaStatesEntry,
  qaStatesHtml,
  qaStatesPage,
  readStatesRequest,
  startStatesPage
};
//# sourceMappingURL=states-host.js.map