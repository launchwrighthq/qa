// The plain config file of the `lw-qa` bin: `qa.toml` (or `.lw/qa.toml`). A string value may name a
// process env value as `${NAME}` or `${NAME:-default}`, so a secret stays in the env and out of the
// file. `$${` writes a literal `${`. An error names the key and the file, never a value.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { LaunchwrightError } from '../kernel/index.mts';

/** The files the bin reads, in order. The first one that exists wins. */
export const QA_TOML_FILES = ['qa.toml', '.lw/qa.toml'] as const;

type Env = Readonly<Record<string, string | undefined>>;

const REF = /\$\$\{|\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|\$\{[^}]*\}?/g;

/** `text` with each `${NAME}` and `${NAME:-default}` replaced from `env`. `key` and `file` name the place in an error. */
export function interpolateEnv(text: string, env: Env, key: string, file: string): string {
  return text.replace(REF, (match: string, name: string | undefined, fallback: string | undefined) => {
    if (match === '$${') return '${';
    if (name === undefined) {
      throw new LaunchwrightError('qa.config.env', `${file}: key ${key} has a malformed env reference. Write \${NAME} or \${NAME:-default}.`, { context: { key, file } });
    }
    // Shell rules: `:-` takes the default for an unset or empty value, and a bare reference keeps an empty one.
    const value = env[name];
    if (fallback !== undefined) return value === undefined || value === '' ? fallback : value;
    if (value !== undefined) return value;
    throw new LaunchwrightError('qa.config.env', `${file}: key ${key} names the env key ${name}, which is not set and has no default. Set ${name}, or write \${${name}:-<default>}.`, {
      context: { key, file, envKey: name },
    });
  });
}

/** `value` with every string inside it interpolated. `path` is the dotted key of `value`. */
export function interpolateTree(value: unknown, env: Env, path: string, file: string): unknown {
  if (typeof value === 'string') return interpolateEnv(value, env, path || '(root)', file);
  if (Array.isArray(value)) return value.map((item, i) => interpolateTree(item, env, `${path}[${i}]`, file));
  // A TOML table has no prototype or the plain one. A TOML date is a `Date` and stays as it is.
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolateTree(v, env, path ? `${path}.${k}` : k, file)]));
  }
  return value;
}

/**
 * The config sections of the project at `cwd`: the first file of `QA_TOML_FILES`, with each env
 * reference filled from `env`. A file without a `qa` table is the `qa` section itself. `{}` when no
 * file exists, so the defaults apply.
 */
export function loadQaToml(cwd: string, env: Env): Record<string, unknown> {
  for (const name of QA_TOML_FILES) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = parseToml(readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch (err) {
      throw new LaunchwrightError('qa.config.toml', `${name} is not valid TOML.`, { cause: err, context: { file: name } });
    }
    const sections = 'qa' in parsed ? parsed : { qa: parsed };
    return interpolateTree(sections, env, '', name) as Record<string, unknown>;
  }
  return {};
}
