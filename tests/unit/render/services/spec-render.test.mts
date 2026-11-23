import { describe, expect, it } from 'vitest';
import { PLACEHOLDERS, renderBody, renderWithTemplate, SpecError } from '../../../../src/render/services/spec-render.mts';

const SHELL = PLACEHOLDERS.map((slot) => (/STATUS|SUBJECT|RANGE/.test(slot) ? `<li class="chip">${slot}</li>` : slot)).join('|');
const HEAD = '# T\n\nDate: 2026-01-01\nStatus: draft\n\n';
const BODY = PLACEHOLDERS.indexOf('{{BODY}}');
const CHECK = '<div class="code" data-lang="bash"><pre><code>ah check</code></pre></div>';
const ASK = '<blockquote><p>Is it done?</p></blockquote>';

function bodyOf(markdown: string): string {
  return renderWithTemplate(HEAD + '## S\n\n' + markdown, 'docs/specs/a.md', SHELL).html.split('|')[BODY] as string;
}

describe('renderWithTemplate', () => {
  it.each([
    ['- Run it:\n\n  ```bash\n  ah check\n  ```\n', `<ul><li>Run it:${CHECK}</li></ul>`],
    ['- Run it:\n  ```bash\n  ah check\n  ```\n', `<ul><li>Run it:${CHECK}</li></ul>`],
    ['1. Run it:\n\n   ```bash\n   ah check\n   ```\n2. Next\n', `<ol><li>Run it:${CHECK}</li><li>Next</li></ol>`],
    ['- Ask:\n  > Is it done?\n', `<ul><li>Ask:${ASK}</li></ul>`],
    ['1. Ask:\n\n   > Is it done?\n', `<ol><li>Ask:${ASK}</li></ol>`],
    [
      '- Steps:\n\n  ```text\n  - not an item\n  1. not either\n  ```\n',
      '<ul><li>Steps:<div class="code" data-lang="text"><pre><code>- not an item\n1. not either</code></pre></div></li></ul>',
    ],
    [
      '- Run it:\n\n  ```bash\n  ah check\n  ```\n\n  It prints the result.\n- Next\n',
      `<ul><li>Run it:${CHECK}<p>It prints the result.</p></li><li>Next</li></ul>`,
    ],
  ])('renders the block indented under the item %j inside that item', (markdown, html) => {
    expect(bodyOf(markdown).slice(-html.length - 1)).toBe(`\n${html}`);
  });

  it('refuses a fenced code line left of its list item and says how to indent it', () => {
    expect(() => bodyOf('- Run it:\n\n  ```bash\nah check\n  ```\n')).toThrow(
      new SpecError(
        'docs/specs/a.md:11: a fenced code block in a list item has a line at or left of the item' +
          ' marker. Indent every line of the block, the closing fence too, under the item text, or' +
          ' end the list with a blank line and start the fence at the left margin below it',
      ),
    );
  });
});

describe('renderBody', () => {
  const input = { source: 'qa/2026-01-01-pass.md', bodyStart: 7, assetPrefix: '../' };

  it('renders the body with the asset prefix and lists each section heading', () => {
    const lines = ['## 1 Scope', '', '![Home](assets/pass/home.png)'];
    expect(renderBody({ ...input, lines })).toEqual({
      body: [
        '<h2 id="1-scope" class="h2"><span class="eyebrow">1 </span>Scope</h2>',
        '<figure class="figure"><img src="../assets/pass/home.png" alt="Home" loading="lazy"></figure>',
      ].join('\n'),
      toc: [{ anchor: '1-scope', eyebrow: '1', title: 'Scope' }],
    });
  });

  it('names the source line of a refused image from the body start', () => {
    const lines = ['## 1 Scope', '', '![Home](home.png)'];
    expect(() => renderBody({ ...input, lines })).toThrow(
      new SpecError("qa/2026-01-01-pass.md:10: an image must be referenced as assets/<file>, not 'home.png'"),
    );
  });
});
