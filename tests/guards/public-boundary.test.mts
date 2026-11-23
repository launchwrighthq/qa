// Spec 2.12 "The public boundary: nothing personal" and R12: the repository holds no real credential,
// no real phone number, no product word, and no machine, network or mail data. The rules live in
// scripts/scan.mjs, the publish scan that gates a release, so this guard and the release never
// drift. The scan reads source text, so it sits in the guards tier. Each planted sample is built
// from parts or carries the exemption marker, so the scan of this file finds nothing.
import { describe, expect, it } from 'vitest';
import { ALLOW_MARKER, checkIdentity, productWords, scanFiles, scanText } from '../../scripts/scan.mjs';
import { LIBRARY_ROOT, libraryFiles } from '../support/library-files.mts';

/** Git's own empty tree object id, a constant in services/changes.mts, not a credential. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const AT = '@';

const kinds = (text: string): string[] => scanText(text).map((h) => h.kind);

describe('public boundary (spec 2.12, R12)', () => {
  it('flags a planted credential, phone or product sample', () => {
    const planted: ReadonlyArray<{ text: string; kind: string }> = [
      { text: '8123456789:' + 'AAE4x2Zk9pQvNmRtYwLsBdFgHjKlPoIuY7R', kind: 'bot-token' },
      { text: 'a1b2c3d4e5f60718' + '293a4b5c6d7e8f90a1b2c3d4', kind: 'hex-key' },
      { text: 'sk-ant-api03-Xk92LmQp4RtZ7wVn3BdFgHjKsPoIuY6TeWqA1', kind: 'api-key' }, // planted sample. publish-audit: allow
      { text: `ghp_${'Xk92LmQp4RtZ7wVn3BdF'}${'gHjKsPoIuY6TeWqAB'}`, kind: 'api-key' }, // planted sample. publish-audit: allow
      { text: 'AKIA4HVBZ7QN2WX9PLMT', kind: 'api-key' }, // planted sample. publish-audit: allow
      { text: '+44' + '2079460958', kind: 'phone' },
      { text: `A ${productWords()[0]} app signs in`, kind: 'product-word' },
    ];
    for (const { text, kind } of planted) expect(kinds(text)).toContain(kind);
  });

  it('flags a planted address, host, home folder or mail', () => {
    const planted: ReadonlyArray<{ text: string; kind: string }> = [
      { text: `ssh ${[192, 168, 1, 20].join('.')}`, kind: 'ipv4' },
      { text: `http://build-box${'.local'}:8080/`, kind: 'local-host' },
      { text: `${'/home/'}alice/src/app`, kind: 'home-path' },
      { text: `${'/Users/'}alice/src/app`, kind: 'home-path' },
      { text: `mail alice${AT}corp.io`, kind: 'mail' },
    ];
    for (const { text, kind } of planted) expect(kinds(text)).toContain(kind);
  });

  it('ignores the obviously fake fixtures and the allowed shapes', () => {
    const fakes = [
      '123456:AAAA',
      `424242:${'Playground' + 'TestToken' + 'A'.repeat(16)}`,
      `gho_${'Fixture' + 'Token' + '0'.repeat(30)}`,
      EMPTY_TREE,
      '+99966123456',
      '0000000000',
      '4294967296',
      'http://127.0.0.1:4173 and 0.0.0.0:80, version 1.9.18',
      `.env${'.local'}, settings.local.json and ~/.local/share`,
      '/home/user/app and /home/dev',
      `qa${AT}example.com, bot${AT}qa.invalid, 1+qa${AT}users.noreply.github.com, react${AT}19.3.1`,
    ];
    for (const text of fakes) expect(scanText(text)).toEqual([]);
  });

  it('skips a line that holds the exemption marker', () => {
    const sample = `ssh ${[192, 168, 1, 20].join('.')}`;
    expect(scanText(sample)).not.toEqual([]);
    expect(scanText(`${sample} // ${ALLOW_MARKER}`)).toEqual([]);
  });

  it('refuses a git identity other than the GitHub noreply form', () => {
    expect(checkIdentity('QA', `alice${AT}corp.io`).map((h) => h.kind)).toEqual(['identity']);
    expect(checkIdentity('QA', `qa${AT}example.invalid`).map((h) => h.kind)).toEqual(['identity']);
    expect(checkIdentity('QA', `1+qa${AT}users.noreply.github.com`)).toEqual([]);
  });

  it('finds no hit in the library, its scripts and its hooks', () => {
    const files = [...libraryFiles(), ...libraryFiles(['scripts', '.githooks', '.github'])];
    expect(files.length).toBeGreaterThan(100);
    const result = scanFiles(files, LIBRARY_ROOT);
    expect(result.findings.map((f) => `${f.label}:${f.hit.line} ${f.hit.kind}`)).toEqual([]);
  });
});
