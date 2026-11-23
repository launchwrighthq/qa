// The Solid mount of the dev state page `/__states` (lw-qa-dev-only). `render` is synchronous.
// An `ErrorBoundary` catches a render error, and the page draws its failure panel.
import { type Component, createComponent, ErrorBoundary, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { messageOf } from '../kernel/services/errors.mts';
import type { StatesMountArgs } from './page.mts';

export type SolidStateComponent = Component<Record<string, unknown>> | Component<{ children?: JSX.Element }>;

export function mountSolidState(args: StatesMountArgs<SolidStateComponent>): void {
  const { name, props, target, fail } = args;
  const component = args.component as Component<Record<string, unknown>>;
  const wrapper = args.wrapper as Component<{ children?: JSX.Element }> | undefined;
  const subject = (): JSX.Element => createComponent(component, props);
  render(
    () =>
      createComponent(ErrorBoundary, {
        fallback: (err: unknown) => {
          fail(`${name} threw while rendering: ${messageOf(err)}`);
          return null;
        },
        get children() {
          return wrapper === undefined
            ? subject()
            : createComponent(wrapper, {
                get children() {
                  return subject();
                },
              });
        },
      }),
    target,
  );
}
