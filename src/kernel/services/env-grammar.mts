// The env grammar of named profiles and task chains that `proxy` and `llm` share (proxy spec 2.10).
import { LaunchwrightError } from './errors.mts';

export interface EnvProfilesOptions {
  /** The task names of the code, such as `chat.reply`. */
  readonly tasks: readonly string[];
  /** Env field suffix to config key, such as `{ API_KEY: 'keyRef' }`. The key gets the env key name. */
  readonly refs?: Readonly<Record<string, string>>;
}

/** A type alias, so a config section of type `Record<string, unknown>` takes it as it is. */
export type EnvProfiles = {
  profiles: Record<string, Record<string, string>>;
  tasks: Record<string, string>;
  fallback?: string;
};

const WORDS = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const RESERVED = new Set(['TASK', 'DIRECT']);

function fail(key: string, reason: string): never {
  throw new LaunchwrightError('kernel.env.profiles', `The env key "${key}" ${reason}.`, { context: { key } });
}

/** `API_KEY` gives `apiKey`. */
function camel(suffix: string): string {
  return suffix
    .toLowerCase()
    .split('_')
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
}

/** Lower-cases the profile name of each link of a `a|b:mode` chain and keeps the rest. */
function lowerChain(chain: string): string {
  return chain
    .split('|')
    .map((link) => {
      const colon = link.indexOf(':');
      return colon < 0 ? link.toLowerCase() : link.slice(0, colon).toLowerCase() + link.slice(colon);
    })
    .join('|');
}

/** The env key suffix of each task name: upper case, each character outside A-Z0-9 becomes `_`. */
function taskKeys(head: string, tasks: readonly string[]): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const task of tasks) {
    const suffix = task.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (suffix === 'FALLBACK' || byKey.has(suffix)) fail(`${head}${suffix}`, `is the key of more than one task or of the fallback`);
    byKey.set(suffix, task);
  }
  return byKey;
}

/** The profile names that the `<PREFIX>_<NAME>_DRIVER` keys declare, longest first. */
function declaredNames(entries: readonly [string, string][], head: string, taskHead: string): string[] {
  const names: string[] = [];
  for (const [key] of entries) {
    if (!key.startsWith(head) || !key.endsWith('_DRIVER')) continue;
    const name = key.slice(head.length, -'_DRIVER'.length);
    if (RESERVED.has(name)) fail(key, `declares the reserved profile name "${name.toLowerCase()}"`);
    if (key.startsWith(taskHead)) continue;
    if (!WORDS.test(name)) fail(key, 'declares a name that is not upper-case letters, digits and single "_"');
    names.push(name);
  }
  return names.sort((a, b) => b.length - a.length);
}

/**
 * Builds `{ profiles, tasks, fallback }` from the `<prefix>_*` keys of `env` (proxy spec 2.10).
 * Reads only `env`. Skips an empty value. Throws `kernel.env.profiles` with `context.key` for an
 * unknown task key, a key of no declared profile, a reserved profile name or a task key collision.
 */
export function envProfiles(env: Readonly<Record<string, string | undefined>>, prefix: string, opts: EnvProfilesOptions): EnvProfiles {
  const head = `${prefix}_`;
  const taskHead = `${prefix}_TASK_`;
  const refs = opts.refs ?? {};
  const entries = Object.entries(env).filter((e): e is [string, string] => e[0].startsWith(head) && typeof e[1] === 'string' && e[1] !== '');
  const byTaskKey = taskKeys(taskHead, opts.tasks);
  const names = declaredNames(entries, head, taskHead);
  const out: EnvProfiles = { profiles: {}, tasks: {} };
  for (const name of names) out.profiles[name.toLowerCase()] = {};
  for (const [key, value] of entries) {
    if (key.startsWith(taskHead)) {
      const suffix = key.slice(taskHead.length);
      if (suffix === 'FALLBACK') out.fallback = lowerChain(value);
      else {
        const task = byTaskKey.get(suffix);
        if (task === undefined) fail(key, `names no declared task (declared: ${opts.tasks.join(', ') || 'none'})`);
        out.tasks[task] = lowerChain(value);
      }
      continue;
    }
    const name = names.find((n) => key.startsWith(`${head}${n}_`));
    if (name === undefined) fail(key, 'belongs to no declared profile: set its <NAME>_DRIVER key');
    const suffix = key.slice(head.length + name.length + 1);
    if (!WORDS.test(suffix)) fail(key, 'has a field name that is not upper-case letters, digits and single "_"');
    const ref = suffix !== 'DRIVER' && Object.hasOwn(refs, suffix) ? refs[suffix] : undefined;
    const field = suffix === 'DRIVER' ? 'driver' : (ref ?? camel(suffix));
    const profile = out.profiles[name.toLowerCase()] as Record<string, string>;
    if (Object.hasOwn(profile, field)) fail(key, `sets the field "${field}" a second time`);
    profile[field] = ref === undefined ? value : key;
  }
  return out;
}
