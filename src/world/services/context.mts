// What the `lw qa world|fixture|job` commands share: the project facts, the QA database, the
// overlay of the QA app, and argument parsing.
import { type Clock, LaunchwrightError, systemClock } from '@launchwrighthq/kernel';
import { parseCommandArgs, UsageError } from '@launchwrighthq/kernel/args';
import { qaConfig, type QaConfig, withAppPaths } from '../../config.mts';
import { loadAppEntry, openWorld, qaDatabase, type QaOverlay, type QaWorld } from './app.mts';
import { type CheckoutFacts, readCheckout } from './checkout.mts';
import { loadRegistry } from './discover.mts';
import { listWorld, registryHash } from './registry.mts';
import type { WorldRegistry } from './types.mts';

/** The options that a `lw qa` subcommand gets (the fields of `QaCommandOptions` that the world reads). */
export interface WorldCommandOptions {
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
  config?: Record<string, unknown>;
  env?: string;
  processEnv?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

/** The facts of one world command. */
export interface WorldContext {
  root: string;
  sections: Record<string, unknown>;
  env: string;
  qa: QaConfig;
  checkout: CheckoutFacts;
  overlay: QaOverlay;
  registry: WorldRegistry;
  clock: Clock;
}

/** Reads the qa section and the checkout, and names the QA database. */
export async function worldContext(opts: WorldCommandOptions, clock: Clock = systemClock): Promise<WorldContext> {
  const sections = opts.config ?? {};
  const parsed = qaConfig.safeParse(sections.qa ?? {});
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `qa.${i.path.map(String).join('.')} ${i.message}`);
    throw new LaunchwrightError('qa.config.invalid', `Config section qa is invalid: ${keys.join('; ')}`, { context: { keys } });
  }
  const checkout = await readCheckout(opts.cwd);
  const database = qaDatabase(sections, checkout);
  const registry = await loadRegistry(opts.cwd);
  return {
    root: opts.cwd,
    sections,
    env: opts.env ?? 'local',
    qa: withAppPaths(parsed.data, sections),
    checkout,
    overlay: { root: opts.cwd, database, telegramUrl: parsed.data.telegramUrl, registryHash: registryHash(listWorld(registry)) },
    registry,
    clock,
  };
}

/** Opens the QA app of the project and the registry, runs `fn`, and shuts the app down. */
export async function withWorld<T>(ctx: WorldContext, fn: (world: QaWorld, registry: WorldRegistry) => Promise<T>): Promise<T> {
  const entry = await loadAppEntry(ctx.root, ctx.qa);
  const world = await openWorld(entry, ctx.sections, ctx.env, ctx.overlay);
  try {
    return await fn(world, ctx.registry);
  } finally {
    await world.close();
  }
}

/**
 * Splits `args` into positional words and `--flag [value]` options. `flags` names the options that
 * take no value, `values` the options that take one. Any other option throws the kernel UsageError.
 */
export function parseArgs(args: readonly string[], flags: readonly string[], values: readonly string[] = []): { words: string[]; options: Record<string, string | true> } {
  const parsed = parseCommandArgs({ switches: flags, values }, args);
  const options: Record<string, string | true> = {};
  for (const [name, value] of Object.entries(parsed.values)) if (value !== undefined) options[name] = value;
  for (const name of parsed.switches) options[name] = true;
  return { words: parsed.positionals, options };
}

/** Runs a command body: a LaunchwrightError becomes one line on stderr and exit 1, a UsageError exit 2. */
export async function guarded(command: string, opts: Pick<WorldCommandOptions, 'err'>, body: () => Promise<number>): Promise<number> {
  try {
    return await body();
  } catch (cause) {
    if (!(cause instanceof LaunchwrightError)) throw cause;
    opts.err(`lw qa ${command}: ${cause.message} (${cause.code})`);
    return cause instanceof UsageError ? 2 : 1;
  }
}

/** An abort signal for SIGINT and SIGTERM, when the CLI gives none. `dispose` removes the listeners. */
export function processSignal(given: AbortSignal | undefined): { signal: AbortSignal; dispose(): void } {
  if (given) return { signal: given, dispose: () => undefined };
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return {
    signal: controller.signal,
    dispose() {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    },
  };
}
