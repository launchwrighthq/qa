import { LaunchwrightError } from './errors.mts';

/**
 * The entries of a signature header, by key. Two forms are read:
 * - `t=1700000000,v1=abc,v1=def` (Stripe, `Lw-Signature`): `key=value` parts split by commas;
 * - `v1,c2ln v1,b3Ro` (Standard Webhooks): `version,value` entries split by spaces.
 * An entry whose text before the first comma holds no `=` is the second form. Values keep their case.
 */
export function parseSignatureHeader(header: string): ReadonlyMap<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (key: string, value: string): void => {
    if (key !== '' && value !== '') out.set(key, [...(out.get(key) ?? []), value]);
  };
  for (const entry of header.trim().split(/\s+/)) {
    const comma = entry.indexOf(',');
    if (comma > 0 && !entry.slice(0, comma).includes('=')) {
      add(entry.slice(0, comma), entry.slice(comma + 1));
      continue;
    }
    for (const part of entry.split(',')) {
      const eq = part.indexOf('=');
      if (eq > 0) add(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
  }
  return out;
}

/**
 * Checks a signed timestamp and returns it in seconds. `ts` is Unix seconds, or milliseconds when it
 * is 1e12 or more. Throws `kernel.timestamp.invalid` for a value that is not a whole number, and
 * `kernel.timestamp.skew` when it is more than `toleranceSec` from `nowMs` in either direction.
 */
export function checkTimestamp(ts: string | number, nowMs: number, toleranceSec: number): number {
  const valid = typeof ts === 'string' ? /^\d{1,16}$/.test(ts) : Number.isSafeInteger(ts) && ts >= 0;
  if (!valid) throw new LaunchwrightError('kernel.timestamp.invalid', 'The timestamp is not a whole number of seconds or milliseconds');
  const n = Number(ts);
  const seconds = n < 1e12 ? n : n / 1000;
  const skewMs = Math.abs(nowMs - seconds * 1000);
  if (skewMs > toleranceSec * 1000) {
    const skewSec = Math.round(skewMs / 1000);
    throw new LaunchwrightError('kernel.timestamp.skew', `The timestamp is ${skewSec} s from the current time (at most ${toleranceSec} s)`, {
      context: { skewSec, toleranceSec },
    });
  }
  return seconds;
}
