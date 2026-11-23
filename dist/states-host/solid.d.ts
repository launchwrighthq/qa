import { Component, JSX } from 'solid-js';
import { StatesMountArgs } from './page.js';

type SolidStateComponent = Component<Record<string, unknown>> | Component<{
    children?: JSX.Element;
}>;
declare function mountSolidState(args: StatesMountArgs<SolidStateComponent>): void;

export { type SolidStateComponent, mountSolidState };
