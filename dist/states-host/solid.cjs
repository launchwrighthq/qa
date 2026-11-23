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

// src/states-host/solid.mts
var solid_exports = {};
__export(solid_exports, {
  mountSolidState: () => mountSolidState
});
module.exports = __toCommonJS(solid_exports);
var import_solid_js = require("solid-js");
var import_web = require("solid-js/web");

// src/kernel/services/errors.mts
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

// src/states-host/solid.mts
function mountSolidState(args) {
  const { name, props, target, fail } = args;
  const component = args.component;
  const wrapper = args.wrapper;
  const subject = () => (0, import_solid_js.createComponent)(component, props);
  (0, import_web.render)(
    () => (0, import_solid_js.createComponent)(import_solid_js.ErrorBoundary, {
      fallback: (err) => {
        fail(`${name} threw while rendering: ${messageOf(err)}`);
        return null;
      },
      get children() {
        return wrapper === void 0 ? subject() : (0, import_solid_js.createComponent)(wrapper, {
          get children() {
            return subject();
          }
        });
      }
    }),
    target
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  mountSolidState
});
//# sourceMappingURL=solid.cjs.map