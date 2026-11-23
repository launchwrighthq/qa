import {
  messageOf
} from "../chunk-L57WEOVE.js";

// src/states-host/react.mts
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
function mountReactState(args) {
  const { name, props, target, fail } = args;
  const component = args.component;
  const wrapper = args.wrapper;
  const root = createRoot(target, {
    onUncaughtError: (err) => fail(`${name} threw while rendering: ${messageOf(err)}`)
  });
  const subject = createElement(component, props);
  flushSync(() => root.render(wrapper === void 0 ? subject : createElement(wrapper, null, subject)));
}
export {
  mountReactState
};
//# sourceMappingURL=react.js.map