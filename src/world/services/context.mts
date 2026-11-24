// What the `lw qa world|fixture|job` commands share: the project facts, the QA database, the
// overlay of the QA app, and argument parsing.
import { type Clock, isCodedError, LaunchwrightError, systemClock } from '../../kernel/index.mts';
import { parseCommandArgs } from '../../kernel/services/args.mts';
import { qaConfig, type QaConfig, withAppPaths } from '../../config.mts';
import { optionalDb } from '../../services/peers.mts';
import { entryConnect, loadAppEntry, openWorld, qaDatabase, type QaOverlay, type QaWorld } from './app.mts';
import { type CheckoutFacts, readCheckout } from './checkout.mts';
import { loadRegistry } from './discover.mts';
import { listWorld, registryHash } from './registry.mts';
import type { ConnectDb } from './stack.mts';
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

/**
 * The Postgres maintenance connection of a command that has not loaded the QA app entry: the db
 * module when the project installs it, else `qaApp.connect`. A PGlite world never calls it.
 */
export function worldConnect(ctx: Pick<WorldContext, 'root' | 'qa'>): ConnectDb {
  return async (url) => {
    const db = await optionalDb();
    if (db) return db.createDb({ driver: 'pg', url });
    const connect = entryConnect(await loadAppEntry(ctx.root, ctx.qa));
    if (connect === undefined) {
      throw new LaunchwrightError('qa.world.connect', `The db module is not installed, and qaApp of ${ctx.qa.app} has no connect(url). Add qaApp.connect, or install the db module.`, {
        context: { app: ctx.qa.app },
      });
    }
    return connect(url);
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

/** The code of the kernel UsageError. */
const USAGE_CODE = 'kernel.usage';

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

/**
 * Runs a command body: a LaunchwrightError becomes one line on stderr and exit 1, a UsageError exit 2.
 * The error may come from the kernel copy of a framework app, so the check reads the code, not the class.
 */
export async function guarded(command: string, opts: Pick<WorldCommandOptions, 'err'>, body: () => Promise<number>): Promise<number> {
  try {
    return await body();
  } catch (cause) {
    if (!isCodedError(cause)) throw cause;
    opts.err(`lw qa ${command}: ${cause.message} (${cause.code})`);
    return cause.code === USAGE_CODE ? 2 : 1;
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
