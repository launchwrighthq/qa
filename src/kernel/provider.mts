import type { ZodType } from 'zod';
import { kernelConfig } from './config.mts';
import type { App } from './services/app.mts';

/** A module's service provider: it binds services in register() and starts them in boot(). */
export interface Provider {
  name: string;
  /** Provider names that must register and boot first. */
  requires?: string[];
  /** The config section of the module. createApp validates it and throws BootError on a bad key. */
  config?: { section: string; schema: ZodType };
  register(app: App): void;
  boot?(app: App): void | Promise<void>;
  shutdown?(app: App): void | Promise<void>;
}

export function provider(p: Provider): Provider {
  return p;
}

/**
 * The kernel's own provider. createApp adds it when the list has no provider named `kernel`,
 * so a module provider can write `requires: ['kernel']`. createApp binds the core tokens itself.
 */
export const kernelProvider: Provider = provider({
  name: 'kernel',
  config: { section: 'kernel', schema: kernelConfig },
  register: () => undefined,
});
