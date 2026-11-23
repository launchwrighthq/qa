// The fault rules of `lw qa sink` (spec 2.17): the answers that make a sender retry, pause, give up
// or time out. They come from the source sink of the outbound delivery flows.
import { LaunchwrightError } from '../../kernel/index.mts';

/** The kinds of fault. `slow` holds the answer and then answers 200. */
export type FaultKind = '503' | '429' | '410' | '302' | 'slow';

/** One parsed rule. `count` or `ratio` limits it; without both it fires on every request. */
export interface FaultRule {
  /** The rule as written, for the record and the messages. */
  text: string;
  kind: FaultKind;
  /** The `Location` of a `302` rule. */
  location?: string;
  /** The hold time of a `slow` rule in ms. */
  ms?: number;
  /** The rule fires on this many requests, then stops. */
  count?: number;
  /** The rule fires on each request with this probability, drawn from the seeded random source. */
  ratio?: number;
}

/** What the sink answers to one request. */
export interface Reply {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** The time the sink holds the answer, in ms. */
  holdMs: number;
}

/** The `Retry-After` value of a `429` answer, in seconds. */
export const RETRY_AFTER_S = 30;

/** The answer when no rule fires. */
export const OK_REPLY: Reply = { status: 200, headers: {}, body: 'ok', holdMs: 0 };

const RULE = /^(?:(?<plain>503|429|410)|302:(?<url>.+?)|slow:(?<ms>\d{1,7}))(?:x(?<count>\d{1,9})|@(?<ratio>0(?:\.\d+)?|1(?:\.0+)?))?$/;

const GRAMMAR = 'a rule is 503, 429, 410, 302:<url> or slow:<ms>, with an optional count (503x2) or ratio (503@0.5)';

/**
 * Parses one rule: `503`, `429`, `410`, `302:<url>` or `slow:<ms>`, then `x<count>` or
 * `@<ratio from 0 to 1>`. A `302` URL must not end in `x<digits>` or `@<number>`: that text is read
 * as the count or the ratio. Throws `qa.sink.fault`.
 */
export function parseFault(text: string): FaultRule {
  const m = RULE.exec(text.trim());
  const g = m?.groups;
  if (!g) throw new LaunchwrightError('qa.sink.fault', `Fault rule "${text}" is not valid: ${GRAMMAR}.`, { context: { rule: text } });
  const limit = {
    ...(g.count !== undefined ? { count: Number(g.count) } : {}),
    ...(g.ratio !== undefined ? { ratio: Number(g.ratio) } : {}),
  };
  if (limit.count === 0) throw new LaunchwrightError('qa.sink.fault', `Fault rule "${text}" has count 0, so it never fires.`, { context: { rule: text } });
  if (g.plain !== undefined) return { text, kind: g.plain as FaultKind, ...limit };
  if (g.ms !== undefined) return { text, kind: 'slow', ms: Number(g.ms), ...limit };
  const url = g.url as string;
  let location: URL;
  try {
    location = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError('qa.sink.fault', `Fault rule "${text}": ${url} is not an absolute URL.`, { cause, context: { rule: text } });
  }
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    throw new LaunchwrightError('qa.sink.fault', `Fault rule "${text}": the 302 target must be an http or https URL.`, { context: { rule: text } });
  }
  return { text, kind: '302', location: url, ...limit };
}

/** Parses each rule. Throws `qa.sink.fault` for the first bad one. */
export function parseFaults(texts: readonly string[]): FaultRule[] {
  return texts.map(parseFault);
}

/** The answer of a rule that fires. */
export function replyOf(rule: FaultRule): Reply {
  switch (rule.kind) {
    case '503':
      return { status: 503, headers: {}, body: 'busy', holdMs: 0 };
    case '429':
      return { status: 429, headers: { 'retry-after': String(RETRY_AFTER_S) }, body: 'slow down', holdMs: 0 };
    case '410':
      return { status: 410, headers: {}, body: 'gone', holdMs: 0 };
    case '302':
      return { status: 302, headers: { location: rule.location as string }, body: '', holdMs: 0 };
    case 'slow':
      return { ...OK_REPLY, holdMs: rule.ms as number };
  }
}

/**
 * A repeatable random source in [0, 1) (mulberry32), so a ratio rule gives the same answers for the
 * same seed. `@launchwrighthq/testing` has the same function for tests; product code does not import
 * the testing package.
 */
export function seededSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The rules of one sink run. `next()` walks the rules in order for each request and the first rule
 * that fires answers. A count rule fires on its first N turns. A ratio rule draws one random value
 * on each turn. Without a firing rule the answer is 200 `ok`.
 */
export class FaultPlan {
  private readonly used: number[];

  constructor(
    private readonly rules: readonly FaultRule[],
    private readonly random: () => number,
  ) {
    this.used = rules.map(() => 0);
  }

  next(): { rule: FaultRule | null; reply: Reply } {
    for (const [i, rule] of this.rules.entries()) {
      if (!this.fires(rule, i)) continue;
      return { rule, reply: replyOf(rule) };
    }
    return { rule: null, reply: OK_REPLY };
  }

  private fires(rule: FaultRule, i: number): boolean {
    if (rule.count !== undefined) {
      if ((this.used[i] as number) >= rule.count) return false;
      this.used[i] = (this.used[i] as number) + 1;
      return true;
    }
    if (rule.ratio !== undefined) return this.random() < rule.ratio;
    return true;
  }
}
