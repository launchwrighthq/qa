import {
  QA_DEV_MARKER,
  QA_STATES_ATTRIBUTE,
  QA_STATES_ROOT_ID
} from "./chunk-277Y4WQJ.js";
import {
  LaunchwrightError,
  messageOf
} from "./chunk-L57WEOVE.js";

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

export {
  readStatesRequest,
  startStatesPage
};
//# sourceMappingURL=chunk-R5IKAOWO.js.map