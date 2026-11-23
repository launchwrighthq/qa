import { ComponentType, ReactNode } from 'react';
import { StatesMountArgs } from './page.js';

type ReactStateComponent = ComponentType<Record<string, unknown>> | ComponentType<{
    children?: ReactNode;
}>;
declare function mountReactState(args: StatesMountArgs<ReactStateComponent>): void;

export { type ReactStateComponent, mountReactState };
