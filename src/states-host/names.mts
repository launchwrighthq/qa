// The names of the `/__states` host (spec 2.3, 2.7). The host draws them, and the mounted-state
// runner (`states/services/mount.mts`) and `lw qa check` read them.

/** The string that marks dev-only QA code. `lw qa check` fails a production build that holds it. */
export const QA_DEV_MARKER = 'lw-qa-dev-only';

/** The path of the state page under the Vite `base`. */
export const QA_STATES_PATH = '/__states';

/** The attribute on the page root. Its value is `lw-qa-dev-only`. */
export const QA_STATES_ATTRIBUTE = 'data-qa-states';

/** The element of the page that holds the subject. The page HTML of `qaStatesPage` writes it. */
export const QA_STATES_ROOT_ID = 'lw-qa-states';
