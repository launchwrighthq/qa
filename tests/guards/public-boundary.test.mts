// Spec 2.12 "The public boundary: nothing personal" and R12: the source, tests and fixtures of the
// library hold no real credential, no real phone number and no product
// word. This guard scans the text and fails a string shaped like a real Telegram bot token, a long
// hex or API key, a real-looking phone number, or a product word. The product-word denylist and the
// whole-word approach come from the framework-words strip list of port-completeness.test.mts (spec
// 1.3), so this file does not hold the product literals it refuses. The scan reads source text, so
// it sits in the guards tier.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LIBRARY_ROOT, libraryFiles } from '../support/library-files.mts';

const SELF = fileURLToPath(import.meta.url);

/**
 * The product words of the strip list of spec 1.3, in base64, reused from port-completeness.test.mts.
 * The literals never appear in this file.
 */
const WORDS = ['ZHJhbWE=', 'bW9vbmVsbGE=', 'aWxvdmVkcmFtYQ==', 'YmVzdGRyYW1hc2VyaWVzYm90', 'ZHVja2Rucw==', 'Y29zbWljLWNhY3R1cw==', 'a2VpdGFybw=='].map((b) =>
  Buffer.from(b, 'base64').toString('utf8'),
);

/** Git's own empty tree object id, a constant in services/changes.mts, not a credential. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** A run of four or more identical characters marks a placeholder, such as AAAA or a rule of dashes. */
const RUN4 = /(.)\1{3}/;
/** A word that marks an obviously fake sample. */
const PLACEHOLDER = /test|fake|sample|example|placeholder|dummy|playground/i;
/** A high-entropy token mixes lower case, upper case and a digit. A path or an identifier does not. */
const highEntropy = (s: string): boolean => /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s);

/** A Telegram bot token: a numeric id, a colon, then a 30 to 45 character base64url secret. */
const BOT_TOKEN = /(?<![A-Za-z0-9_])([0-9]{5,12}):([A-Za-z0-9_-]{30,45})(?![A-Za-z0-9_-])/g;
/** A long hex run, such as a 40 or 64 character key or digest. */
const HEX_KEY = /(?<![0-9A-Za-z])[0-9a-fA-F]{32,}(?![0-9A-Za-z])/g;
/** A real-looking international phone number in E.164 form. */
const PHONE = /(?<![0-9+.])\+[1-9][0-9]{9,14}(?![0-9])/g;
/** Known credential prefixes. A match is a secret shape, unless a run of four or a placeholder word marks a fixture. */
const PREFIXES: ReadonlyArray<RegExp> = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /\bsk-[A-Za-z0-9]{20,}/g,
  /\bgh[posur]_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
];
/** The product words as whole-word patterns, in any case. */
const PRODUCT: ReadonlyArray<{ word: string; pattern: RegExp }> = WORDS.map((word) => ({
  word,
  pattern: new RegExp(`(?<![a-z0-9_])${word.replace('-', '\\-')}(?![a-z0-9_])`, 'i'),
}));

interface Hit {
  kind: string;
  line: number;
  value: string;
}

/** Each credential, phone or product-word hit in one block of text. */
function scanText(text: string): Hit[] {
  const hits: Hit[] = [];
  text.split('\n').forEach((line, i) => {
    const n = i + 1;
    for (const m of line.matchAll(BOT_TOKEN)) {
      const secret = m[2] as string;
      if (!RUN4.test(secret) && !PLACEHOLDER.test(secret) && highEntropy(secret)) hits.push({ kind: 'bot-token', line: n, value: m[0] as string });
    }
    for (const m of line.matchAll(HEX_KEY)) {
      const run = m[0] as string;
      if (!RUN4.test(run) && run.toLowerCase() !== EMPTY_TREE) hits.push({ kind: 'hex-key', line: n, value: run });
    }
    for (const m of line.matchAll(PHONE)) {
      const number = m[0] as string;
      if (!number.startsWith('+999')) hits.push({ kind: 'phone', line: n, value: number });
    }
    for (const re of PREFIXES)
      for (const m of line.matchAll(re)) {
        const key = m[0] as string;
        if (!RUN4.test(key) && !PLACEHOLDER.test(key)) hits.push({ kind: 'api-key', line: n, value: key });
      }
    for (const { word, pattern } of PRODUCT) if (pattern.test(line)) hits.push({ kind: 'product-word', line: n, value: word });
  });
  return hits;
}


describe('public boundary (spec 2.12, R12)', () => {
  it('flags a planted credential, phone or product sample', () => {
    // The samples are planted here and tested against the matcher. No bad fixture joins the tree.
    const productWord = WORDS[0] as string;
    const planted: ReadonlyArray<{ text: string; kind: string }> = [
      { text: '8123456789:AAE4x2Zk9pQvNmRtYwLsBdFgHjKlPoIuY7R', kind: 'bot-token' },
      { text: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4', kind: 'hex-key' },
      { text: 'sk-ant-api03-Xk92LmQp4RtZ7wVn3BdFgHjKsPoIuY6TeWqA1', kind: 'api-key' }, // planted sample. publish-audit: allow
      { text: `ghp_${'Xk92LmQp4RtZ7wVn3BdF'}${'gHjKsPoIuY6TeWqAB'}`, kind: 'api-key' }, // planted sample. publish-audit: allow
      { text: 'AKIA4HVBZ7QN2WX9PLMT', kind: 'api-key' }, // planted sample. publish-audit: allow
      { text: '+442079460958', kind: 'phone' },
      { text: `A ${productWord} app signs in`, kind: 'product-word' },
    ];
    for (const { text, kind } of planted) expect(scanText(text).map((h) => h.kind)).toContain(kind);
  });

  it('ignores the obviously fake fixtures', () => {
    const fakes = ['123456:AAAA', `424242:${'Playground' + 'TestToken' + 'A'.repeat(16)}`, `gho_${'Fixture' + 'Token' + '0'.repeat(30)}`, EMPTY_TREE, '+99966123456', '0000000000', '4294967296'];
    for (const text of fakes) expect(scanText(text)).toEqual([]);
  });

  it('finds no credential, phone or product word in the library', () => {
    const files = libraryFiles().filter((file) => file !== SELF);
    expect(files.length).toBeGreaterThan(100);
    const hits = files.flatMap((file) => scanText(readFileSync(file, 'utf8')).map((h) => `${h.kind} ${relative(LIBRARY_ROOT, file)}:${h.line} ${h.value}`));
    expect(hits).toEqual([]);
  });
});
