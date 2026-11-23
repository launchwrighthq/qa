import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeStorageDriver } from '../../support/fake-storage.mts';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { appendLedger, ledgerEntry, reportPaths } from '../../../src/services/ledger.mts';
import { publishReport } from '../../../src/services/publish.mts';
import { intakeStaysLocal, RENDERER_DIR, renderReport, updateReport } from '../../../src/services/report.mts';
import { INTAKE_DIR } from '../../../src/services/types.mts';
import { patternPng, writeIssueReportFixture, writeReportFixture } from '../../../src/testing/report-fixture.mts';

async function project() {
  const root = await tmpDir();
  const reportDir = join(root, 'docs/qa');
  const { slug, mdPath } = await writeReportFixture(reportDir);
  return { root, reportDir, slug, mdPath };
}

describe('publishReport (spec 2.12.3, R19)', () => {
  it('copies the report, the plan, the ledger, the results and the evidence to the disk, with links', async () => {
    const { root, slug } = await project();
    const driver = new FakeStorageDriver();
    const files = await publishReport({ root, reportDir: 'docs/qa', slug, driver });
    expect([...driver.objects.keys()].sort()).toEqual(
      [
        `qa/${slug}.md`,
        `qa/${slug}.shots.json`,
        `qa/assets/${slug}/evidence.lock.json`,
        `qa/assets/${slug}/results.jsonl`,
        `qa/assets/${slug}/desktop-home.guest.png`,
        `qa/assets/${slug}/mobile-web-home.guest.png`,
      ].sort(),
    );
    expect(driver.objects.get(`qa/assets/${slug}/desktop-home.guest.png`)?.contentType).toBe('image/png');
    expect(files.every((f) => f.url?.startsWith('https://fake-storage.invalid/qa/'))).toBe(true);
  });

  it('includes the rendered page when it exists', async () => {
    const { root, reportDir, slug } = await project();
    await mkdir(join(reportDir, 'dist'), { recursive: true });
    await writeFile(reportPaths(reportDir, slug).html, '<html></html>');
    const driver = new FakeStorageDriver();
    await publishReport({ root, reportDir: 'docs/qa', slug, driver });
    expect(driver.objects.has(`qa/dist/${slug}.html`)).toBe(true);
  });

  it('refuses a report that fails the check, and uploads nothing', async () => {
    const { root, reportDir, slug } = await project();
    await writeFile(join(reportDir, `assets/${slug}/stray.png`), 'x');
    const driver = new FakeStorageDriver();
    await expect(publishReport({ root, reportDir: 'docs/qa', slug, driver })).rejects.toMatchObject({ code: 'qa.publish.check' });
    expect(driver.objects.size).toBe(0);
  });

  it('never copies intake content, even through a link in the evidence folder (R27)', async () => {
    const { root, reportDir, slug, mdPath } = await project();
    const intake = join(root, '.lw/qa/intake/github-o-r-1/assets');
    await mkdir(intake, { recursive: true });
    await writeFile(join(intake, 'reporter.png'), patternPng(40, 64));
    const rel = `assets/${slug}/desktop-home.guest.2.png`;
    await symlink(join(intake, 'reporter.png'), join(reportDir, rel));
    const entry = await ledgerEntry(reportDir, { path: rel, kind: 'step', capturedAt: 't', commit: 'c', dirty: false, leg: 'desktop', target: 'playwright', provenance: 'live', row: 'home.guest', attempt: 1 });
    await appendLedger(reportDir, slug, [entry]);
    await updateReport(mdPath);
    const driver = new FakeStorageDriver();
    await expect(publishReport({ root, reportDir: 'docs/qa', slug, driver })).rejects.toMatchObject({ code: 'qa.publish.intake' });
    expect(driver.objects.size).toBe(0);
  });

  it('fails with qa.publish.missing for an unknown slug', async () => {
    const { root } = await project();
    await expect(publishReport({ root, reportDir: 'docs/qa', slug: '2026-09-09-none', driver: new FakeStorageDriver() })).rejects.toMatchObject({ code: 'qa.publish.missing' });
  });
});

describe('publishReport of an issue pass (spec 2.15.4, R28)', () => {
  async function issueProject(section4: (issue: string, link: string) => string) {
    const root = await tmpDir();
    const r = await writeIssueReportFixture(root);
    const text = await readFile(r.mdPath, 'utf8');
    await writeFile(r.mdPath, text.replace('## 4 Findings\n', `## 4 Findings\n\n${section4(r.issue, r.link)}\n`));
    return { root, ...r };
  }

  it('replaces each link to reporter media with plain text and copies no intake file', async () => {
    const { root, slug, issue } = await issueProject((id, link) => `- issue ${id}: REPRODUCED\n\n[reporter screenshot](${link})`);
    const driver = new FakeStorageDriver();
    await publishReport({ root, reportDir: 'docs/qa', slug, driver });
    const md = driver.objects.get(`qa/${slug}.md`)?.bytes.toString() ?? '';
    expect(md).toContain(`- issue ${issue}: REPRODUCED\n\n${intakeStaysLocal(issue)}\n`);
    expect(md).not.toContain(INTAKE_DIR);
    expect([...driver.objects.keys()].filter((k) => !k.startsWith(`qa/${slug}.`) && !k.startsWith(`qa/assets/${slug}/`))).toEqual([]);
  });

  it('replaces the link to reporter media in the rendered page', async () => {
    const { root, slug, issue, link, mdPath } = await issueProject((id, l) => `- issue ${id}: REPRODUCED\n\n![reporter screenshot](${l})`);
    const page = await renderReport(mdPath, RENDERER_DIR, root);
    expect(await readFile(page, 'utf8')).toContain(`<a href="../${link}">reporter screenshot</a>`);
    const driver = new FakeStorageDriver();
    await publishReport({ root, reportDir: 'docs/qa', slug, driver });
    const html = driver.objects.get(`qa/dist/${slug}.html`)?.bytes.toString() ?? '';
    expect(html).toContain(intakeStaysLocal(issue));
    expect(html).not.toContain(INTAKE_DIR);
  });

  it('refuses a report that names the intake folder outside a media link', async () => {
    const { root, slug } = await issueProject((id, link) => `- issue ${id}: NOT REPRODUCED\n\nThe file is \`${link}\`.`);
    const driver = new FakeStorageDriver();
    await expect(publishReport({ root, reportDir: 'docs/qa', slug, driver })).rejects.toMatchObject({ code: 'qa.publish.intake' });
    expect(driver.objects.size).toBe(0);
  });
});
