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

// src/states-host/react.mts
var react_exports = {};
__export(react_exports, {
  mountReactState: () => mountReactState
});
module.exports = __toCommonJS(react_exports);
var import_react = require("react");
var import_react_dom = require("react-dom");
var import_client = require("react-dom/client");

// src/kernel/services/errors.mts
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

// src/states-host/react.mts
function mountReactState(args) {
  const { name, props, target, fail } = args;
  const component = args.component;
  const wrapper = args.wrapper;
  const root = (0, import_client.createRoot)(target, {
    onUncaughtError: (err) => fail(`${name} threw while rendering: ${messageOf(err)}`)
  });
  const subject = (0, import_react.createElement)(component, props);
  (0, import_react_dom.flushSync)(() => root.render(wrapper === void 0 ? subject : (0, import_react.createElement)(wrapper, null, subject)));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  mountReactState
});
//# sourceMappingURL=react.cjs.map