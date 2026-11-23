// `lw qa <sub>`: each core subcommand is the default export of `./qa-<sub>.mts` (spec 2.2). An
// extension module adds its own subcommands and targets (`./extensions.mts`).
import { qaConfigOf } from '../config.mts';
import type { QaTarget } from '../drivers/target/contract.mts';
import { extensionTargets, loadExtensions, type QaExtension } from './extensions.mts';

/** The options the CLI gives a module command, plus test overrides. */
export interface QaCommandOptions {
  /** The project root. */
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
  /** The project config sections. */
  config?: Record<string, unknown>;
  /** The kernel environment name. */
  env?: string;
  /** The booted app, when the CLI gives one. */
  app?: unknown;
  /** The process environment. Default: `process.env`. */
  processEnv?: Record<string, string | undefined>;
  /** Stops a long-running subcommand (`lw qa telegram`, `lw qa sink`). */
  signal?: AbortSignal;
  /**
   * The command the user typed: `lw qa` (the default, the framework CLI) or `lw-qa` (the bin of the
   * library). Every usage, hint and error line prints it.
   */
  commandName?: string;
  /**
   * `qa.target` drivers that a run adds or uses in place of a built-in one, for example
   * `playwright` with a browser binary. `lw qa` adds the targets of the extension modules here.
   */
  targets?: Record<string, QaTarget>;
  /**
   * Extension modules the CLI always has. The `lw-qa` bin gives the intake and device extensions of
   * the library, which have no `qa-<x>` package to load. An enabled config section of the same name wins.
   */
  extensions?: readonly QaExtension[];
}

/** A `lw qa <sub>` module: `./qa-<sub>.mts` with this default export. */
export interface QaSubcommand {
  name: string;
  summary: string;
  run(args: string[], opts: QaCommandOptions): Promise<number>;
}

export const SUBCOMMANDS = [
  'changes', 'session', 'sweep', 'report', 'publish', 'gc', 'check',
  'world', 'fixture', 'worktree', 'job',
  'states', 'paths',
  'telegram', 'sink', 'comments',
] as const;

type CoreSubcommand = (typeof SUBCOMMANDS)[number];

/**
 * The module of each core subcommand. Each import has a literal specifier, so a bundle carries every
 * subcommand, and each module still loads on first use.
 */
const CORE: Readonly<Record<CoreSubcommand, () => Promise<{ default: QaSubcommand }>>> = {
  changes: () => import('./qa-changes.mts'),
  session: () => import('./qa-session.mts'),
  sweep: () => import('./qa-sweep.mts'),
  report: () => import('./qa-report.mts'),
  publish: () => import('./qa-publish.mts'),
  gc: () => import('./qa-gc.mts'),
  check: () => import('./qa-check.mts'),
  world: () => import('./qa-world.mts'),
  fixture: () => import('./qa-fixture.mts'),
  worktree: () => import('./qa-worktree.mts'),
  job: () => import('./qa-job.mts'),
  states: () => import('./qa-states.mts'),
  paths: () => import('./qa-paths.mts'),
  telegram: () => import('./qa-telegram.mts'),
  sink: () => import('./qa-sink.mts'),
  comments: () => import('./qa-comments.mts'),
};

function isCore(sub: string): sub is CoreSubcommand {
  return Object.hasOwn(CORE, sub);
}

async function load(sub: CoreSubcommand): Promise<QaSubcommand> {
  return (await CORE[sub]()).default;
}

/** The subcommand `sub` of the core or of an extension: undefined when none has it. */
async function subcommandOf(sub: string, extensions: readonly QaExtension[]): Promise<QaSubcommand | undefined> {
  if (isCore(sub)) return load(sub);
  const loader = extensions.find((e) => e.subcommands?.[sub])?.subcommands?.[sub];
  return loader ? loader() : undefined;
}

async function usage(opts: QaCommandOptions, extensions: readonly QaExtension[]): Promise<number> {
  opts.err('usage: lw qa <subcommand> [args]');
  for (const sub of SUBCOMMANDS) opts.err(`  ${sub.padEnd(10)} ${(await load(sub)).summary}`);
  for (const ext of extensions) {
    for (const [sub, loader] of Object.entries(ext.subcommands ?? {})) opts.err(`  ${sub.padEnd(10)} ${(await loader()).summary} (module ${ext.name})`);
  }
  return 2;
}

/** The name every subcommand line holds. `commandName` replaces it on the way out. */
const DEFAULT_NAME = 'lw qa';

/** `opts` with `out` and `err` that print `commandName` wherever a line names `lw qa`. */
function named(opts: QaCommandOptions): QaCommandOptions {
  const name = opts.commandName ?? DEFAULT_NAME;
  if (name === DEFAULT_NAME) return opts;
  const rename = (write: (line: string) => void) => (line: string): void => write(line.replace(/\blw qa\b/g, name));
  return { ...opts, out: rename(opts.out), err: rename(opts.err) };
}

export const qaCommand = {
  name: 'qa',
  summary: 'QA passes with evidence, personas, state triggers, devices, fake Telegram, issue intake',
  async run(args: string[], given: QaCommandOptions): Promise<number> {
    const opts = named(given);
    const [first, ...rest] = args;
    const loaded = await loadExtensions(opts.cwd, opts.config);
    const extensions = [...(opts.extensions ?? []).filter((e) => !loaded.some((l) => l.name === e.name)), ...loaded];
    if (first === undefined || first === '--help' || first === '-h') return usage(opts, extensions);
    const spec = await subcommandOf(first, extensions);
    if (spec === undefined) {
      opts.err(`lw qa: unknown subcommand ${first}. A subcommand of an extension module needs that module in the project config, for example qa-${first}.`);
      return usage(opts, extensions);
    }
    const added = extensions.some((e) => e.targets) ? extensionTargets(extensions, qaConfigOf(opts.config), opts.cwd) : {};
    return spec.run(rest, { ...opts, targets: { ...added, ...opts.targets } });
  },
};

export default qaCommand;
