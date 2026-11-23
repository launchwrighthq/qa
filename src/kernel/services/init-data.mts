// The Telegram Mini App `initData` check, HMAC form (Telegram "Validating data received via the
// Mini App"). It sits in the kernel so that `auth` checks initData without the `telegram` package.
//   secret = HMAC_SHA256(key = "WebAppData", message = bot token)
//   check  = every field except `hash`, as `key=value`, sorted by key, joined by "\n"
//   hash   = hex(HMAC_SHA256(key = secret, message = check))
// "WebAppData" is the key of the first step, not the message.
import { createHmac } from 'node:crypto';
import { LaunchwrightError } from './errors.mts';
import { hmacHex, safeEqual } from './hmac.mts';

export interface InitDataCheckOptions {
  /** Now, in epoch milliseconds. */
  nowMs: number;
  /** The oldest `auth_date`, in seconds. Default 86400 (one day). 0 turns the check off. */
  maxAgeSec?: number;
  /** How far in the future `auth_date` may be (client clock skew), in seconds. Default 60. */
  futureSkewSec?: number;
}

export interface InitDataCheck {
  /** `auth_date`, in seconds since the epoch. */
  authDate: number;
  /** Every field as Telegram sent it, `hash` and `signature` out. JSON fields such as `user` stay text. */
  fields: Record<string, string>;
}

type InitDataReason = 'malformed' | 'signature' | 'expired' | 'future';

function initDataError(reason: InitDataReason, message: string): LaunchwrightError {
  return new LaunchwrightError(`kernel.initdata.${reason}`, message, { context: { reason } });
}

/** The data-check string: every field not in `skip`, `key=value`, sorted by key, joined by line feeds. */
export function initDataCheckString(params: URLSearchParams, skip: readonly string[] = ['hash']): string {
  return [...params.entries()]
    .filter(([k]) => !skip.includes(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function parseInitData(raw: string): URLSearchParams {
  if (typeof raw !== 'string' || raw === '') throw initDataError('malformed', 'initData is empty.');
  const params = new URLSearchParams(raw);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw initDataError('malformed', 'initData repeats a field.');
  return params;
}

function checkAuthDate(params: URLSearchParams, opts: InitDataCheckOptions): number {
  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate <= 0) throw initDataError('malformed', 'initData has no valid auth_date.');
  const now = Math.floor(opts.nowMs / 1000);
  const maxAge = opts.maxAgeSec ?? 86_400;
  const skew = opts.futureSkewSec ?? 60;
  if (authDate > now + skew) throw initDataError('future', `initData auth_date is ${authDate - now} s in the future (at most ${skew} s).`);
  if (maxAge > 0 && now - authDate > maxAge) throw initDataError('expired', `initData is ${now - authDate} s old (at most ${maxAge} s).`);
  return authDate;
}

/**
 * Checks Mini App `initData` with the bot token and `auth_date`, and returns the fields. Throws
 * LaunchwrightError `kernel.initdata.<reason>` (`malformed`, `signature`, `expired`, `future`).
 * The caller reads `user` from the fields and owns its own error codes.
 */
export function verifyInitData(initData: string, botToken: string, opts: InitDataCheckOptions): InitDataCheck {
  if (!botToken) throw initDataError('malformed', 'The bot token is empty.');
  const params = parseInitData(initData);
  const hash = params.get('hash') ?? '';
  if (!/^[0-9a-f]{64}$/.test(hash)) throw initDataError('malformed', 'initData has no hash.');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  if (!safeEqual(hash, hmacHex(secret, initDataCheckString(params)))) throw initDataError('signature', 'initData hash does not match.');
  const authDate = checkAuthDate(params, opts);
  const fields: Record<string, string> = {};
  for (const [k, v] of params.entries()) if (k !== 'hash' && k !== 'signature') fields[k] = v;
  return { authDate, fields };
}
