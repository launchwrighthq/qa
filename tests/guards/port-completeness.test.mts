// Spec 3.3 "Port completeness" and R3: no literal of the strip list appears in the library tree
// (source, tests, fixtures, harness, assets and the root files). The scan reads source text, so it
// sits in the guards tier.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LIBRARY_ROOT, libraryFiles } from '../support/library-files.mts';

const SELF = fileURLToPath(import.meta.url);

/**
 * The words of the strip list of spec 1.3: product names, bot names and hosts. They are in base64,
 * so this file does not hold the literals it refuses.
 */
const WORDS = ['ZHJhbWE=', 'bW9vbmVsbGE=', 'aWxvdmVkcmFtYQ==', 'YmVzdGRyYW1hc2VyaWVzYm90', 'ZHVja2Rucw==', 'Y29zbWljLWNhY3R1cw==', 'a2VpdGFybw=='].map((b) =>
  Buffer.from(b, 'base64').toString('utf8'),
);
const [PRODUCT, PROJECT, SITE, BOT, DNS, HOST, TRACKER] = WORDS as [string, string, string, string, string, string, string];

/** A private network prefix of the strip list, joined at run time so this file does not hold it. */
const PRIVATE_NET = ['10', '60', ''].join('.');

/** The strip list of spec 1.3: the words above and network addresses. */
const STRIP: ReadonlyArray<{ literal: string; pattern: RegExp }> = [
  ...WORDS.map((word) => ({
    literal: word,
    pattern: new RegExp(`(?<![a-z0-9_])${word.replace('-', '\\-')}(?![a-z0-9_])`, 'i'),
  })),
  ...['100.64.', PRIVATE_NET].map((prefix) => ({ literal: prefix, pattern: new RegExp(`(?<![0-9.])${prefix.replaceAll('.', '\\.')}`) })),
];


/** A dotted address built from its parts, so the file holds no address-shaped literal. */
const address = (...parts: number[]): string => parts.join('.');

/** Each hit as `<file>:<line> <literal>`. */
function stripHits(file: string, text: string): string[] {
  const hits: string[] = [];
  text.split('\n').forEach((line, i) => {
    for (const { literal, pattern } of STRIP) if (pattern.test(line)) hits.push(`${file}:${i + 1} ${literal}`);
  });
  return hits;
}

describe('port completeness (spec 3.3, R3)', () => {
  it('finds each literal as a whole word in any case, and skips a longer word or address', () => {
    const sample = [`A ${PRODUCT.toUpperCase()} app`, `${PROJECT}_qa`, `${SITE}.tv`, BOT.toUpperCase(), `x.${DNS}.org`, HOST.toUpperCase(), TRACKER, address(100, 64, 0, 1), address(10, 60, 0, 1)];
    expect(stripHits('x', sample.join('\n'))).toEqual([
      `x:1 ${PRODUCT}`,
      `x:3 ${SITE}`,
      `x:4 ${BOT}`,
      `x:5 ${DNS}`,
      `x:6 ${HOST}`,
      `x:7 ${TRACKER}`,
      'x:8 100.64.',
      `x:9 ${PRIVATE_NET}`,
    ]);
    expect(stripHits('x', [`${PRODUCT}tic`, address(110, 60, 1, 1), address(1, 10, 60, 2), `melo${PRODUCT}`].join('\n'))).toEqual([]);
  });

  it('finds no strip literal in any source, test, fixture, harness or doc file of the library', () => {
    const files = libraryFiles().filter((file) => file !== SELF);
    expect(files.length).toBeGreaterThan(100);
    const hits = files.flatMap((file) => stripHits(relative(LIBRARY_ROOT, file), readFileSync(file, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('finds no waitForTimeout call in the library source', () => {
    const calls = libraryFiles(['src']).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (/\bwaitForTimeout\s*\(/.test(line) ? [`${relative(LIBRARY_ROOT, file)}:${i + 1}`] : [])),
    );
    expect(calls).toEqual([]);
  });
});
