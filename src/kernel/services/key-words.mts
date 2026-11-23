// The word rule of a secret key (spec N54). The kernel logger and `secrets.redact` use it.
// `fixtures/secret-keys.cases.json` of the kernel holds the cases that both sides pass.
import { LaunchwrightError } from './errors.mts';

/** A key with one of these words or its plural, in any case, is secret. Python twin: `SECRET_WORDS`. */
export const SECRET_WORDS = ['password', 'secret', 'token', 'key', 'authorization'] as const;

/** Matches one word of a key that is secret: a secret word, or the word with `s`. */
export const SECRET_KEY_PATTERN = new RegExp(`^(?:${SECRET_WORDS.join('|')})s?$`, 'i');

const SEPARATORS = /[_\-.\s]+/;
const WORD = /[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+/g;

/**
 * The words of a key: split on `_`, `-`, `.`, white space and camelCase boundaries. `x-api-key`
 * gives `x`, `api`, `key`; `refreshTOKEN` gives `refresh`, `TOKEN`; `APIKey` gives `API`, `Key`.
 * Python twin: `key_words`.
 */
export function keyWords(key: string): string[] {
  return key.split(SEPARATORS).flatMap((part) => part.match(WORD) ?? []);
}

/** Options of `keyMatcher` and `redactMatcher`. */
export interface KeyMatcherOptions {
  /** Whole keys (any case), such as `sort_key`, that never match. */
  allow?: readonly string[];
}

/**
 * A test that is true for a key when the words of one term are words of the key in a row. Each
 * comparison ignores case, and the last word of a term also matches with `s`. With `SECRET_WORDS`
 * it gives the rule of `SECRET_KEY_PATTERN`: `monkey` and `tokenizer` are one word each, so they
 * are not secret. A key of `opts.allow` never matches. Python twin: `key_matcher`.
 */
export function keyMatcher(terms: readonly string[], opts: KeyMatcherOptions = {}): (key: string) => boolean {
  const patterns = terms.map((t) => keyWords(t).map((w) => w.toLowerCase())).filter((p) => p.length > 0);
  const allowed = new Set((opts.allow ?? []).map((k) => k.toLowerCase()));
  return (key) => {
    if (allowed.has(key.toLowerCase())) return false;
    const words = keyWords(key).map((w) => w.toLowerCase());
    return patterns.some((p) => words.some((_, i) => p.every((part, j) => words[i + j] === part || (j === p.length - 1 && words[i + j] === `${part}s`))));
  };
}

/** The project lists of config `secrets.redact` (spec N86). Python twin: `RedactLists`. */
export interface RedactLists {
  /** Terms that every redaction adds to its own terms. */
  readonly words: readonly string[];
  /** Whole keys that the word rule of every redaction leaves out. */
  readonly allow: readonly string[];
}

// One value per process. It comes from config only, so every replica sets the same lists at boot.
let lists: RedactLists = { words: [], allow: [] };

/**
 * Sets the project lists. The secrets provider calls it at register with config `secrets.redact`;
 * a missing list becomes empty. Throws `kernel.redact.word` for a word without a letter or a digit.
 */
export function setRedactLists(next: Partial<RedactLists>): void {
  const words = [...(next.words ?? [])];
  const bad = words.find((w) => keyWords(w).length === 0);
  if (bad !== undefined) {
    throw new LaunchwrightError('kernel.redact.word', `The redact word "${bad}" has no letter or digit. Remove it from secrets.redact.words.`, {
      context: { word: bad },
    });
  }
  lists = { words, allow: [...(next.allow ?? [])] };
}

/** The project lists that `setRedactLists` set last. */
export function redactLists(): RedactLists {
  return lists;
}

/**
 * `keyMatcher` of `terms` plus the project words, with `opts.allow` plus the project allow keys.
 * It reads the project lists at each call, so a matcher made before boot follows them.
 * Python twin: `redact_matcher`.
 */
export function redactMatcher(terms: readonly string[], opts: KeyMatcherOptions = {}): (key: string) => boolean {
  let built: { from: RedactLists; matches: (key: string) => boolean } | undefined;
  return (key) => {
    if (built?.from !== lists) {
      built = { from: lists, matches: keyMatcher([...terms, ...lists.words], { allow: [...(opts.allow ?? []), ...lists.allow] }) };
    }
    return built.matches(key);
  };
}
