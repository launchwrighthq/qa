import {
  messageOf
} from "../chunk-L57WEOVE.js";

// src/states-host/solid.mts
import { createComponent, ErrorBoundary } from "solid-js";
import { render } from "solid-js/web";
function mountSolidState(args) {
  const { name, props, target, fail } = args;
  const component = args.component;
  const wrapper = args.wrapper;
  const subject = () => createComponent(component, props);
  render(
    () => createComponent(ErrorBoundary, {
      fallback: (err) => {
        fail(`${name} threw while rendering: ${messageOf(err)}`);
        return null;
      },
      get children() {
        return wrapper === void 0 ? subject() : createComponent(wrapper, {
          get children() {
            return subject();
          }
        });
      }
    }),
    target
  );
}
export {
  mountSolidState
};
//# sourceMappingURL=solid.js.map