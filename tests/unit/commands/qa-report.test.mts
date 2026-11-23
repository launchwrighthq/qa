import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import report from '../../../src/commands/qa-report.mts';
import { renderReport } from '../../../src/services/report.mts';
import { writeIssueReportFixture, writeReportFixture } from '../../../src/testing/report-fixture.mts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: (cwd: string) => ({ cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config: {} }) };
}

async function project() {
  const root = await tmpDir();
  const { mdPath, slug } = await writeReportFixture(join(root, 'docs/qa'));
  return { root, mdPath, slug };
}

describe('lw qa report', () => {
  it('check exits 0 on a passing report', async () => {
    const { root, slug } = await project();
    const c = io();
    expect(await report.run(['check', `docs/qa/${slug}.md`], c.opts(root))).toBe(0);
    expect(c.out[0]).toContain('passes');
  });

  it('check exits 1 and lists every problem', async () => {
    const { root, mdPath, slug } = await project();
    const text = await readFile(mdPath, 'utf8');
    await writeFile(mdPath, text.replace('Status: passed', 'Status: failed').replace('Expect: home', 'Expect: Home'));
    const c = io();
    expect(await report.run(['check', mdPath], c.opts(root))).toBe(1);
    expect(c.err[0]).toContain('2 problems');
    expect(c.err.slice(1).map((l) => l.trim().split(':')[0])).toEqual(['block-edited', 'status']);
    expect(slug).toMatch(/^2026-/);
  });

  it('check resolves a section 4 media link against the project root (R28)', async () => {
    const root = await tmpDir();
    const { mdPath, slug, issue, link } = await writeIssueReportFixture(root);
    const text = await readFile(mdPath, 'utf8');
    await writeFile(mdPath, text.replace('## 4 Findings\n', `## 4 Findings\n\n- issue ${issue}: REPRODUCED\n\n[reporter screenshot](${link})\n`));
    const c = io();
    expect(await report.run(['check', `docs/qa/${slug}.md`], c.opts(root))).toBe(0);
    await writeFile(mdPath, text.replace('## 4 Findings\n', `## 4 Findings\n\n[reporter screenshot](${link})\n`));
    expect(await report.run(['check', `docs/qa/${slug}.md`], c.opts(root))).toBe(1);
    expect(c.err.slice(1).map((l) => l.trim().split(':')[0])).toEqual(['issue-statement']);
  });

  it('update rewrites an edited block and the Status line', async () => {
    const { root, mdPath } = await project();
    const text = await readFile(mdPath, 'utf8');
    await writeFile(mdPath, text.replace('Status: passed', 'Status: failed').replace('Expect: home', 'Expect: Home'));
    const c = io();
    expect(await report.run(['update', mdPath], c.opts(root))).toBe(0);
    expect(c.out[0]).toContain('Status: passed');
    expect(await readFile(mdPath, 'utf8')).toBe(text);
  });

  it('render writes <reportDir>/dist/<slug>.html with the spec renderer and the evidence', async () => {
    const { root, slug } = await project();
    const c = io();
    expect(await report.run(['render', `docs/qa/${slug}.md`], c.opts(root))).toBe(0);
    const html = await readFile(join(root, `docs/qa/dist/${slug}.html`), 'utf8');
    expect(html).toContain(`<img src="../assets/${slug}/desktop-home.guest.png"`);
    expect(html).toContain('QA REPORT');
    expect(html).toContain('<li class="chip">passed</li>');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('render names the page template and the package when the template is missing', async () => {
    const { root, slug } = await project();
    const missing = join(root, 'no-renderer');
    await expect(renderReport(join(root, `docs/qa/${slug}.md`), missing, root)).rejects.toThrow(
      `The page template of the spec renderer is not at ${join(missing, 'spec-template.html')}. Reinstall @launchwrighthq/qa.`,
    );
  });

  it('exits 2 with the usage for a bad call', async () => {
    const c = io();
    expect(await report.run(['show'], c.opts(await tmpDir()))).toBe(2);
    expect(c.err[0]).toContain('usage: lw qa report');
  });
});
