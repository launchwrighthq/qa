import { type Browser, chromium, type Page } from '@playwright/test';
import { sweep } from '../../../../src/kernel/testing/index.mts';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IMPLICIT_ROLES, settleExpression } from '../../../../src/device/services/page-script.mts';
import { headlessShell } from '../../../../src/testing/index.mts';

/** One element per implicit role, each with the accessible name `n-<role>`. */
const PAGE = `
  <article aria-label="n-article">a</article>
  <button>n-button</button>
  <input type="checkbox" aria-label="n-checkbox">
  <select aria-label="n-combobox"><option>o</option></select>
  <dialog open aria-label="n-dialog">d</dialog>
  <form aria-label="n-form"><input type="radio" aria-label="n-radio"></form>
  <h2>n-heading</h2>
  <img alt="n-img" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="4" height="4">
  <a href="#x">n-link</a>
  <ul aria-label="n-list"><li aria-label="n-listitem">i</li></ul>
  <main aria-label="n-main">m</main>
  <nav aria-label="n-navigation">n</nav>
  <section aria-label="n-region">r</section>
  <table aria-label="n-table"><tr><td>t</td></tr></table>
  <textarea aria-label="n-textbox"></textarea>
`;

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch({ executablePath: headlessShell() });
});

afterAll(async () => {
  await browser?.close();
});

beforeEach(async () => {
  page = await browser.newPage();
});

afterEach(async () => {
  await page?.close();
});

describe('settleExpression', () => {
  it('settles on each implicit role where Playwright finds the same element', async () => {
    await page.setContent(PAGE);
    await sweep(Object.keys(IMPLICIT_ROLES), async (role) => {
      const playwright = await page.getByRole(role as Parameters<Page['getByRole']>[0], { name: `n-${role}` }).count();
      const device = (await page.evaluate(settleExpression({ selector: `role=${role}[name="n-${role}"]` }))) as { ok: boolean };
      expect({ role, playwright, device: device.ok }).toEqual({ role, playwright: 1, device: true });
    });
  });

  it('does not settle on a section without an accessible name as a region', async () => {
    await page.setContent('<section>plain</section>');
    const device = (await page.evaluate(settleExpression({ selector: 'role=region' }))) as { ok: boolean };
    expect(device.ok).toBe(false);
  });
});
