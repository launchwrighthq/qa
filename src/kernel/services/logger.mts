import { type Clock, systemClock } from './clock.mts';
import { redactMatcher } from './key-words.mts';

export interface Logger {
  debug(m: string, f?: object): void;
  info(m: string, f?: object): void;
  warn(m: string, f?: object): void;
  error(m: string, f?: object): void;
  child(b: object): Logger;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * The terms that the logger always redacts, matched by the word rule of `secrets.redact`
 * (`keyMatcher`). It leaves out the bare word `key` of `SECRET_WORDS`: a log line names cache,
 * storage and config keys. `redact` and the project words of `secrets.redact.words` add to this list.
 */
export const DEFAULT_REDACT: readonly string[] = ['password', 'secret', 'token', 'authorization', 'api key', 'access key', 'private key'];

const REDACTED = '[redacted]';

function clean(value: unknown, isSecret: (key: string) => boolean, seen: WeakSet<object>): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => clean(v, isSecret, seen));
  const source: Record<string, unknown> =
    value instanceof Error
      ? {
          ...value,
          name: value.name,
          message: value.message,
          stack: value.stack,
          ...(value.cause !== undefined ? { cause: value.cause } : {}),
        }
      : (value as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    out[k] = isSecret(k) ? REDACTED : clean(v, isSecret, seen);
  }
  return out;
}

/**
 * A logger that writes one JSON object per line and redacts secret keys at any depth: a key is
 * secret when it holds the words of a term in a row (`redactMatcher`). A key of `allow` or of
 * `secrets.redact.allow` stays visible. `bindings` go on every line, as with `child(bindings)`;
 * `createApp` binds `release` of the stamp. `clock` gives the `time` of each line.
 */
export function jsonLogger(opts?: {
  level?: LogLevel;
  write?: (line: string) => void;
  redact?: string[];
  allow?: string[];
  bindings?: object;
  clock?: Clock;
}): Logger {
  const clock = opts?.clock ?? systemClock;
  const min = LEVELS[opts?.level ?? 'info'];
  const write = opts?.write ?? ((line: string) => void process.stdout.write(`${line}\n`));
  const isSecret = redactMatcher([...DEFAULT_REDACT, ...(opts?.redact ?? [])], { allow: opts?.allow ?? [] });

  const make = (bindings: object): Logger => {
    const emit = (level: LogLevel, msg: string, fields?: object): void => {
      if (LEVELS[level] < min) return;
      const body = clean({ ...bindings, ...fields }, isSecret, new WeakSet()) as Record<string, unknown>;
      write(JSON.stringify({ level, time: clock.date().toISOString(), msg, ...body }));
    };
    return {
      debug: (m, f) => emit('debug', m, f),
      info: (m, f) => emit('info', m, f),
      warn: (m, f) => emit('warn', m, f),
      error: (m, f) => emit('error', m, f),
      child: (b) => make({ ...bindings, ...b }),
    };
  };
  return make(opts?.bindings ?? {});
}
