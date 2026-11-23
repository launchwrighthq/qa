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

// src/states-host/page.mts
var page_exports = {};
__export(page_exports, {
  readStatesRequest: () => readStatesRequest,
  startStatesPage: () => startStatesPage
});
module.exports = __toCommonJS(page_exports);

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

// src/states-host/names.mts
var QA_DEV_MARKER = "lw-qa-dev-only";
var QA_STATES_ATTRIBUTE = "data-qa-states";
var QA_STATES_ROOT_ID = "lw-qa-states";

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  readStatesRequest,
  startStatesPage
});
//# sourceMappingURL=page.cjs.map