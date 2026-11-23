/** The base error of the framework. `code` is a stable, dotted identifier such as `kernel.unbound`. */
export class LaunchwrightError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;

  constructor(code: string, message: string, opts?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message, opts && 'cause' in opts ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.context = opts?.context ?? {};
  }
}

/** A failure at createApp or boot. The message names the module, the key and the env file. */
export class BootError extends LaunchwrightError {}

/** Facts that a boot failure message gives. */
export interface BootFacts {
  module: string;
  key: string;
  envFile: string;
  reason: string;
}

/** Builds a BootError whose message and context name the module, the key and the env file. */
export function bootError(code: string, facts: BootFacts, opts?: { cause?: unknown; context?: Record<string, unknown> }): BootError {
  const message = `Boot failed in module "${facts.module}": key "${facts.key}" ${facts.reason}. Check ${facts.envFile}.`;
  return new BootError(code, message, {
    ...(opts && 'cause' in opts ? { cause: opts.cause } : {}),
    context: { ...opts?.context, module: facts.module, key: facts.key, envFile: facts.envFile },
  });
}

/** The env file name for an environment: `.env.<env>`, or `.env` when no environment is set. */
export function envFileFor(env: string | undefined): string {
  return env ? `.env.${env}` : '.env';
}

/** The message of any thrown value. */
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
