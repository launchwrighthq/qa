import type { AccountStatusReader } from './services/actor.mts';
import type { App } from './services/app.mts';
import type { Clock } from './services/clock.mts';
import type { ConfigStore } from './config.mts';
import type { EventBus } from './events.mts';
import type { Logger } from './services/logger.mts';

/** A typed container key. No decorators, no reflect-metadata. */
export interface Token<T> {
  readonly key: symbol;
  readonly name: string;
  readonly __type?: T;
}

export function token<T>(name: string): Token<T> {
  return Object.freeze({ key: Symbol(name), name }) as Token<T>;
}

export const APP: Token<App> = token<App>('kernel.app');
export const CONFIG: Token<ConfigStore> = token<ConfigStore>('kernel.config');
export const LOGGER: Token<Logger> = token<Logger>('kernel.logger');
export const EVENTS: Token<EventBus> = token<EventBus>('kernel.events');
export const CLOCK: Token<Clock> = token<Clock>('kernel.clock');

/** The state of user accounts. The `auth` provider binds it; `api` reads it when it is bound. */
export const ACCOUNTS: Token<AccountStatusReader> = token<AccountStatusReader>('kernel.accounts');
