import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaConfig } from '../../../src/config.mts';
import { legDefinitions } from '../../../src/services/legs.mts';
import { parseSpec, pathTokens, resolveIssue, specSlug, suggestLegs } from '../../../src/services/resolve.mts';
import type { QaIssue } from '../../../src/services/types.mts';

const legs = legDefinitions(qaConfig.parse({}));
const names = legs.map((l) => l.name);

async function project(issue: QaIssue): Promise<string> {
  const cwd = await tmpDir();
  const dir = join(cwd, '.lw/qa/intake', issue.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'issue.json'), JSON.stringify(issue));
  return cwd;
}

const issue: QaIssue = {
  id: 'tg-100-7',
  source: 'telegram',
  ref: '100:7-9',
  title: 'Cart button',
  reportedAt: '2026-11-10T09:00:00Z',
  reporter: 'Reporter',
  text: 'On my iPhone in Telegram the cart button does nothing.',
  thread: [{ at: '2026-11-10T09:05:00Z', author: 'Reporter', text: 'Same on Android.' }],
  attachments: [
    { kind: 'image', path: 'assets/1.jpg', sha256: 'a'.repeat(64), bytes: 10, mime: 'image/jpeg', from: 'message 7' },
    { kind: 'voice', path: 'assets/2.ogg', sha256: 'b'.repeat(64), bytes: 10, mime: 'audio/ogg', from: 'message 8' },
    { kind: 'video', path: 'assets/3.mp4', sha256: 'c'.repeat(64), bytes: 10, mime: 'video/mp4', from: 'message 9' },
  ],
  skipped: [{ from: 'message 10', reason: 'too-large' }],
};

describe('resolveIssue', () => {
  it('gives the reporter text as the claim, the media as reference and legs from device hints', async () => {
    const cwd = await project(issue);
    const seed = resolveIssue(cwd, 'tg-100-7', names);
    expect(seed).toMatchObject({ issue: 'tg-100-7', claim: issue.text, source: 'issue:tg-100-7' });
    expect(seed.reference).toEqual([
      { kind: 'image', path: '.lw/qa/intake/tg-100-7/assets/1.jpg' },
      { kind: 'video', path: '.lw/qa/intake/tg-100-7/assets/3.mp4' },
    ]);
    expect(seed.legs).toEqual([
      { leg: 'safari-ios', words: ['iphone'] },
      { leg: 'telegram-android', words: ['android'] },
      { leg: 'miniapp', words: ['telegram'] },
    ]);
    expect(seed.notes).toEqual(['1 attachment(s) were not downloaded: too-large.']);
  });

  it('hints at the mobile web leg for a phone model name', async () => {
    const cwd = await project({ ...issue, text: 'In Chrome on my Pixel the header is covered. Same on a Galaxy.', thread: [] });
    expect(resolveIssue(cwd, 'tg-100-7', names).legs).toEqual([
      { leg: 'mobile-web', words: ['pixel', 'galaxy'] },
      { leg: 'desktop', words: ['chrome'] },
    ]);
  });

  it('names no leg the config does not have, and says when the text hints at none', async () => {
    const cwd = await project({ ...issue, title: 'Typo', text: 'The footer says "Contcat".', thread: [] });
    const seed = resolveIssue(cwd, 'tg-100-7', ['desktop']);
    expect(seed.legs).toEqual([]);
    expect(seed.notes[0]).toContain('hints at no leg');
  });

  it('fails with qa.session.issue for an issue that intake did not write', async () => {
    const cwd = await tmpDir();
    expect(() => resolveIssue(cwd, 'github-o-r-1', names)).toThrow(expect.objectContaining({ code: 'qa.session.issue' }));
    expect(() => resolveIssue(cwd, '../escape', names)).toThrow(expect.objectContaining({ code: 'qa.session.issue' }));
  });
});

describe('parseSpec and pathTokens', () => {
  it('reads the header with a wrapped Status line and the sections', () => {
    const spec = parseSpec(['# Cart design', '', 'Date: 2026-11-01', 'Status: in-progress, built in abc1234', '  and def5678', '', '## 1. Scope', '### 1.1 Now'].join('\n'));
    expect(spec).toMatchObject({ title: 'Cart design', date: '2026-11-01', status: 'in-progress', statusText: 'in-progress, built in abc1234 and def5678' });
    expect(spec.sections.map((s) => s.heading)).toEqual(['1. Scope', '1.1 Now']);
  });

  it('strips line suffixes and skips URLs and absolute paths', () => {
    expect(pathTokens('apps/api/src/http/cart.mts:12-20, ./src/a.ts#L4 https://x.test/a /etc/hosts')).toEqual(['apps/api/src/http/cart.mts', 'src/a.ts']);
  });

  it('makes the slug without the date and the kind suffix', () => {
    expect(specSlug('docs/specs/2026-11-01-cart-design.md')).toBe('cart');
  });
});

describe('suggestLegs', () => {
  it('suggests the browser legs of the surfaces that the touched files reach, never a device leg', () => {
    const out = suggestLegs({
      specFiles: ['apps/client/src/pages/cart.page.tsx'],
      commitFiles: ['apps/api/src/telegram/cart.feature.mts'],
      clientRoots: ['apps/client/src'],
      legs,
    });
    expect(out.suggested).toEqual(['desktop', 'mobile-web', 'miniapp', 'telegram-fake']);
    expect(out.evidence.map((e) => [e.rule, e.fromSpec, e.fromCommits])).toEqual([
      ['a file under qa.clientRoots (apps/client/src)', ['apps/client/src/pages/cart.page.tsx'], []],
      ['a bot feature file (*.feature.mts)', [], ['apps/api/src/telegram/cart.feature.mts']],
    ]);
  });

  it('says so when no rule matches', () => {
    expect(suggestLegs({ specFiles: ['docs/a.md'], commitFiles: [], clientRoots: ['apps/client/src'], legs }).notes[0]).toContain('No rule matched');
  });
});
