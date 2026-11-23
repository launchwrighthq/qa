import { createHmac, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();

/** Compares two signatures or tokens in constant time. Returns false on a length mismatch. */
export function safeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean {
  const x = typeof a === 'string' ? encoder.encode(a) : a;
  const y = typeof b === 'string' ? encoder.encode(b) : b;
  if (x.byteLength !== y.byteLength) return false;
  return timingSafeEqual(x, y);
}

type Part = string | Uint8Array;

function hmac(key: string | Uint8Array, data: Part | readonly Part[]): Buffer {
  const h = createHmac('sha256', key);
  for (const part of typeof data === 'string' || data instanceof Uint8Array ? [data] : data) h.update(part);
  return h.digest();
}

/** HMAC-SHA256 of `data` (the parts in order, text as UTF-8), as lower-case hex. */
export function hmacHex(key: string | Uint8Array, data: Part | readonly Part[]): string {
  return hmac(key, data).toString('hex');
}

/** HMAC-SHA256 of `data`, as base64: the Standard Webhooks (Svix) form. */
export function hmacBase64(key: string | Uint8Array, data: Part | readonly Part[]): string {
  return hmac(key, data).toString('base64');
}
