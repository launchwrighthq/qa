// The React mount of the dev state page `/__states` (lw-qa-dev-only). `flushSync` renders the
// subject before the call returns, so the page clears `aria-busy` after the first paint. React
// reports a render error to `onUncaughtError`, and the page draws its failure panel.
import { type ComponentType, createElement, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { messageOf } from '../kernel/services/errors.mts';
import type { StatesMountArgs } from './page.mts';

export type ReactStateComponent = ComponentType<Record<string, unknown>> | ComponentType<{ children?: ReactNode }>;

export function mountReactState(args: StatesMountArgs<ReactStateComponent>): void {
  const { name, props, target, fail } = args;
  const component = args.component as ComponentType<Record<string, unknown>>;
  const wrapper = args.wrapper as ComponentType<{ children?: ReactNode }> | undefined;
  const root = createRoot(target, {
    onUncaughtError: (err) => fail(`${name} threw while rendering: ${messageOf(err)}`),
  });
  const subject = createElement(component, props);
  flushSync(() => root.render(wrapper === undefined ? subject : createElement(wrapper, null, subject)));
}
