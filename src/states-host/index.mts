// The states host of @launchwrighthq/qa (spec 2.3): the framework-free `/__states` page and its
// Vite dev plugin. The UI mounts are separate exports, `./states-host/solid` and
// `./states-host/react`, so a project loads only the UI library it uses.
export { QA_DEV_MARKER, QA_STATES_ATTRIBUTE, QA_STATES_PATH, QA_STATES_ROOT_ID } from './names.mts';
export { readStatesRequest, startStatesPage, type StatesMountArgs, type StatesPageOptions, type StatesRequest } from './page.mts';
export { qaStatesEntry, qaStatesHtml, qaStatesPage, type QaStatesOptions } from './vite.mts';
