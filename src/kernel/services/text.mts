import { LaunchwrightError } from './errors.mts';
import { SEMVER } from './stamp.mts';

/**
 * The words of a name. `[` and `]` go, then the name splits at each character that is not a letter
 * or a digit (`-`, `_`, `/`, `.`, a space) and at each camel hump: `aB`, `1B` and `ABc` (`HTTPServer`).
 */
export function words(name: string): string[] {
  return name
    .replace(/[[\]]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== '');
}

/** A word in capitals, such as `MAX` or `HTTP`, reads as a plain word. */
function plain(word: string): string {
  return word === word.toUpperCase() ? word.toLowerCase() : word;
}

function capital(word: string): string {
  const w = plain(word);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** `send-digest`, `send_digest` and `SendDigest` give `sendDigest`. */
export function camel(name: string): string {
  const [first = '', ...rest] = words(name);
  const head = plain(first);
  return head.charAt(0).toLowerCase() + head.slice(1) + rest.map(capital).join('');
}

/** `send-digest` gives `SendDigest`. */
export function pascal(name: string): string {
  return words(name).map(capital).join('');
}

/** `sendDigest`, `MAX_GPUS` and `send-digest` give `send_digest`, `max_gpus` and `send_digest`. */
export function snake(name: string): string {
  return words(name)
    .map((w) => w.toLowerCase())
    .join('_');
}

/** `sendDigest` and `send_digest` give `send-digest`. */
export function kebab(name: string): string {
  return words(name)
    .map((w) => w.toLowerCase())
    .join('-');
}

interface SemverParts {
  core: number[];
  pre: string[];
}

/** A leading `v` and build metadata after `+` are dropped. Throws `kernel.version.invalid` for anything else. */
function semverParts(version: string): SemverParts {
  const text = version.trim().replace(/^v/, '').replace(/\+[0-9A-Za-z.-]+$/, '');
  if (!SEMVER.test(text)) {
    throw new LaunchwrightError('kernel.version.invalid', `"${version}" is not a semver MAJOR.MINOR.PATCH[-pre]`, { context: { version } });
  }
  const dash = text.indexOf('-');
  const core = (dash === -1 ? text : text.slice(0, dash)).split('.').map(Number);
  return { core, pre: dash === -1 ? [] : text.slice(dash + 1).split('.') };
}

/** Semver 2.0.0 rule 11.4: numeric identifiers compare as numbers and sort before text ones. */
function comparePre(a: string, b: string): number {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Number(a) - Number(b);
  if (na !== nb) return na ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The semver order of two versions: negative when `a` is older, 0 when equal, positive when newer.
 * A pre-release is older than its release (`1.5.0-rc.1` < `1.5.0`). Build metadata is ignored.
 */
export function compareVersions(a: string, b: string): number {
  const pa = semverParts(a);
  const pb = semverParts(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa.core[i] ?? 0) - (pb.core[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.pre.length === 0 || pb.pre.length === 0) return pb.pre.length - pa.pre.length;
  for (let i = 0; i < Math.min(pa.pre.length, pb.pre.length); i += 1) {
    const diff = comparePre(pa.pre[i] ?? '', pb.pre[i] ?? '');
    if (diff !== 0) return diff;
  }
  return pa.pre.length - pb.pre.length;
}

/** The POSIX shell form of a value: single quotes, and each `'` as `'\''`. */
export function shq(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
