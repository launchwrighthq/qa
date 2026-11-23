import { parseArgs } from 'node:util';
import { LaunchwrightError } from './errors.mts';

/** A wrong command line. A command prints the message and its usage, then exits 2. */
export class UsageError extends LaunchwrightError {
  constructor(message: string, opts?: { cause?: unknown; context?: Record<string, unknown> }) {
    super('kernel.usage', message, opts);
  }
}

/** The flags of a command, by name without `--`. */
export interface CommandArgsSpec<V extends string, S extends string, R extends string> {
  /** Flags with one value: `--key value` or `--key=value`. The last one wins. */
  values?: readonly V[];
  /** Flags without a value: `--key`. */
  switches?: readonly S[];
  /** Flags with a value that may repeat. Each value is kept, in order. */
  repeated?: readonly R[];
}

export interface CommandArgs<V extends string, S extends string, R extends string> {
  positionals: string[];
  values: Partial<Record<V, string>>;
  switches: ReadonlySet<S>;
  /** Every value of each repeated flag. A flag that is not given has an empty list. */
  lists: Record<R, string[]>;
}

type OptionSpec = { type: 'string' | 'boolean'; multiple?: boolean };

function optionsOf(spec: CommandArgsSpec<string, string, string>): Record<string, OptionSpec> {
  const options: Record<string, OptionSpec> = {};
  for (const name of spec.values ?? []) options[name] = { type: 'string' };
  for (const name of spec.switches ?? []) options[name] = { type: 'boolean' };
  for (const name of spec.repeated ?? []) options[name] = { type: 'string', multiple: true };
  return options;
}

/** A parse error of node:util as a UsageError with its message, which names the flag. Any other error as it is. */
function asUsage(cause: unknown): unknown {
  const code = (cause as { code?: unknown } | null)?.code;
  if (typeof code !== 'string' || !code.startsWith('ERR_PARSE_ARGS_')) return cause;
  return new UsageError(String((cause as Error).message), { cause, context: { code } });
}

/** A word that is a negative number, such as `-100123` or `-0.5`. */
const NEGATIVE = /^-\d+(\.\d+)?$/;

/**
 * Stands in for a negative number in a positional place. node:util `parseArgs` reads `-3` as a short
 * flag. The spec declares no short flag, so a negative number is always a word. A NUL byte cannot
 * occur in a process argument, so no real word starts with it.
 */
const NEGATIVE_MARK = '\u0000';

/**
 * `argv` with each negative number made safe for `parseArgs`: after a lone value flag it joins the
 * flag (`--chat -1` becomes `--chat=-1`), elsewhere it gets the mark. Words after `--` stay as they are.
 */
function markNegatives(argv: readonly string[], valueFlags: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i] as string;
    if (word === '--') return [...out, ...argv.slice(i)];
    const next = argv[i + 1];
    if (word.startsWith('--') && valueFlags.has(word.slice(2)) && next !== undefined) {
      out.push(...(NEGATIVE.test(next) ? [`${word}=${next}`] : [word, next]));
      i++;
    } else out.push(NEGATIVE.test(word) ? NEGATIVE_MARK + word : word);
  }
  return out;
}

function unmark(word: string): string {
  return word.startsWith(NEGATIVE_MARK) ? word.slice(NEGATIVE_MARK.length) : word;
}

/**
 * Parses `argv` with node:util `parseArgs` in strict mode. Words that are not flags are positionals,
 * and `--` ends the flags. A negative number is a value after a value flag (`--chat -100123`) and a
 * positional elsewhere (`set key -3`). An unknown flag, a value on a switch, a missing value, or any
 * other value that starts with `-` after a space (write `--key=-x`) throws UsageError.
 */
export function parseCommandArgs<V extends string = never, S extends string = never, R extends string = never>(
  spec: CommandArgsSpec<V, S, R>,
  argv: readonly string[],
): CommandArgs<V, S, R> {
  const valueFlags = new Set<string>([...(spec.values ?? []), ...(spec.repeated ?? [])]);
  let parsed: { values: object; positionals: string[] };
  try {
    parsed = parseArgs({ args: markNegatives(argv, valueFlags), options: optionsOf(spec), strict: true, allowPositionals: true });
  } catch (cause) {
    throw asUsage(cause);
  }
  const found = parsed.values as Record<string, string | boolean | string[] | undefined>;
  const values: Partial<Record<V, string>> = {};
  for (const name of spec.values ?? []) {
    const value = found[name];
    if (typeof value === 'string') values[name] = value;
  }
  const switches = new Set<S>((spec.switches ?? []).filter((name) => found[name] === true));
  const lists = {} as Record<R, string[]>;
  for (const name of spec.repeated ?? []) {
    const value = found[name];
    lists[name] = Array.isArray(value) ? value : [];
  }
  return { positionals: parsed.positionals.map(unmark), values, switches, lists };
}
