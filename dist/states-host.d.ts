export { StatesMountArgs, StatesPageOptions, StatesRequest, readStatesRequest, startStatesPage } from './states-host/page.js';
import { Plugin } from 'vite';

/** The string that marks dev-only QA code. `lw qa check` fails a production build that holds it. */
declare const QA_DEV_MARKER = "lw-qa-dev-only";
/** The path of the state page under the Vite `base`. */
declare const QA_STATES_PATH = "/__states";
/** The attribute on the page root. Its value is `lw-qa-dev-only`. */
declare const QA_STATES_ATTRIBUTE = "data-qa-states";
/** The element of the page that holds the subject. The page HTML of `qaStatesPage` writes it. */
declare const QA_STATES_ROOT_ID = "lw-qa-states";

interface QaStatesOptions {
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
    /**
     * Which `transformIndexHtml` hooks of the other plugins run on the state page.
     * - `'vite'` (the default): only plugins whose name starts with `vite:`. Those are Vite itself
     *   and its official framework plugins, such as the React refresh preamble. A project hook
     *   that rewrites the app page, for example one that adds a script or a meta tag, leaves the
     *   state page alone.
     * - `'all'`: every hook, as on the project index page.
     * - a list of plugin names: the `vite:` hooks and the hooks of the named plugins.
     */
    htmlTransforms?: 'vite' | 'all' | readonly string[];
}
/** The hook of a plugin that the state page keeps under `htmlTransforms`. */
declare function keepsHtmlTransform(pluginName: string, htmlTransforms?: QaStatesOptions['htmlTransforms']): boolean;
/** The source of the entry module: the runtime, the adapter mount, the wrapper and the registry. */
declare function qaStatesEntry(opts: QaStatesOptions, root: string): string;
/** The HTML of the state page. The dev HTML transform puts the Vite `base` before `src`. */
declare function qaStatesHtml(): string;
/**
 * A Vite dev server plugin (`apply: 'serve'`) that serves the state page at `/__states` under
 * the Vite `base`. The page gets the Vite client and the HTML hooks that `htmlTransforms` keeps.
 * The modules it imports go through every plugin, so the JSX transform applies.
 */
declare function qaStatesPage(opts: QaStatesOptions): Plugin;

export { QA_DEV_MARKER, QA_STATES_ATTRIBUTE, QA_STATES_PATH, QA_STATES_ROOT_ID, type QaStatesOptions, keepsHtmlTransform, qaStatesEntry, qaStatesHtml, qaStatesPage };
