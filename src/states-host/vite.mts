// The dev state page (spec 2.3, 2.7, `mounted` provenance): a Vite dev server plugin that serves
// `/__states?c=<Component>&props=<json>`. The page mounts the named component with the JSON
// props, inside the providers that the project supplies. Dev only (`apply: 'serve'`): the page,
// its entry module and its runtime carry the marker `lw-qa-dev-only`, and a production build
// never contains them.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin, ResolvedConfig } from 'vite';
import { LaunchwrightError } from '../kernel/services/errors.mts';
import { QA_DEV_MARKER, QA_STATES_ATTRIBUTE, QA_STATES_PATH, QA_STATES_ROOT_ID } from './names.mts';

const ENTRY_ID = 'virtual:lw-qa-states';
const RESOLVED_ENTRY_ID = `\0${ENTRY_ID}`;

export interface QaStatesOptions {
  /** The UI library of the project. */
  framework: 'solid' | 'react';
  /**
   * Component name to module path. A relative path starts at the Vite root. The page mounts the
   * export with the component name, else the default export.
   */
  components: Record<string, string>;
  /**
   * The module path of the providers. Its default export is a component that renders its
   * children inside the project providers, filled with fakes (spec 2.14 C2).
   */
  wrapper?: string;
}

/** The URL of a file on disk that the Vite dev server serves. */
function fsUrl(root: string, path: string): string {
  const absolute = /^(?:\/|[A-Za-z]:[\\/])/.test(path) ? path : `${root}/${path.replace(/^\.\//, '')}`;
  const slashed = absolute.replace(/\\/g, '/');
  return `/@fs${slashed.startsWith('/') ? '' : '/'}${slashed}`;
}

/**
 * The URL of a browser file of the host: `page`, `solid` or `react`. In the source tree the file
 * sits beside this module (`<name>.mts`). In the built package this module is `dist/states-host.js`
 * and the file is `dist/states-host/<name>.js`.
 */
function ownUrl(name: 'page' | 'solid' | 'react'): string {
  const candidates = [`./${name}.mts`, `./states-host/${name}.js`].map((relative) => fileURLToPath(new URL(relative, import.meta.url)));
  const found = candidates.find((path) => existsSync(path));
  if (found === undefined) throw new LaunchwrightError('client.qa.states.files', `The state page file ${name} is missing from the package`, { context: { candidates } });
  return fsUrl('', found);
}

/** The source of the entry module: the runtime, the adapter mount, the wrapper and the registry. */
export function qaStatesEntry(opts: QaStatesOptions, root: string): string {
  const mount =
    opts.framework === 'react'
      ? `import { mountReactState as mount } from ${JSON.stringify(ownUrl('react'))};`
      : `import { mountSolidState as mount } from ${JSON.stringify(ownUrl('solid'))};`;
  const wrapper = opts.wrapper === undefined ? 'const wrapper = undefined;' : `import wrapper from ${JSON.stringify(fsUrl(root, opts.wrapper))};`;
  const components = Object.entries(opts.components)
    .map(([name, path]) => `  ${JSON.stringify(name)}: () => import(${JSON.stringify(fsUrl(root, path))}),`)
    .join('\n');
  return `// ${QA_DEV_MARKER}: the entry of the dev state page.
import { startStatesPage } from ${JSON.stringify(ownUrl('page'))};
${mount}
${wrapper}
const components = {
${components}
};
void startStatesPage({ components, wrapper, mount });
`;
}

/** The HTML of the state page. The dev HTML transform puts the Vite `base` before `src`. */
export function qaStatesHtml(): string {
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

/**
 * A Vite dev server plugin (`apply: 'serve'`) that serves the state page at `/__states` under
 * the Vite `base`. The page runs through the plugins of the project (`transformIndexHtml`), so
 * the JSX transform and the HMR client apply.
 */
export function qaStatesPage(opts: QaStatesOptions): Plugin {
  if (Object.keys(opts.components).length === 0) throw new LaunchwrightError('client.qa.states.components', 'qaStatesPage needs at least one component');
  let config: ResolvedConfig | undefined;
  return {
    name: 'launchwright:qa-states',
    apply: 'serve',
    configResolved(resolved) {
      config = resolved;
    },
    resolveId(id) {
      return id === ENTRY_ID ? RESOLVED_ENTRY_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ENTRY_ID) return undefined;
      if (config === undefined) throw new LaunchwrightError('client.qa.states.config', 'The state page entry loaded before Vite resolved the config');
      return qaStatesEntry(opts, config.root);
    },
    configureServer(server) {
      const base = server.config.base;
      const pagePath = `${base.replace(/\/$/, '')}${QA_STATES_PATH}`;
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';
        if (req.method !== 'GET' || new URL(url, 'http://dev.invalid').pathname !== pagePath) return next();
        server
          .transformIndexHtml(url, qaStatesHtml(), req.originalUrl)
          .then((html) => {
            res.statusCode = 200;
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.end(html);
          })
          .catch((err: unknown) => next(new LaunchwrightError('client.qa.states.page', 'The state page could not be transformed', { cause: err })));
      });
    },
  };
}
