import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { appendLedger, ledgerEntry, reportPaths } from '../../../src/services/ledger.mts';
import { writeIssue } from '../../../src/services/records.mts';
import {
  checkReport,
  computeStatus,
  intakeTarget,
  loadReport,
  RENDERER_DIR,
  renderReport,
  reportScoreInput,
  reportSkeleton,
  slugOf,
  updateReport,
  withoutIntakeLinks,
} from '../../../src/services/report.mts';
import { computeScore } from '../../../src/services/score.mts';
import { patternPng, uniformPng, writeIssueReportFixture, writeReportFixture } from '../../../src/testing/report-fixture.mts';

const TWO_ROWS = [
  { id: 'home.guest', legs: ['desktop', 'mobile-web'] },
  { id: 'store.empty', legs: ['desktop', 'miniapp'] },
];

async function fixture(opts: Parameters<typeof writeReportFixture>[1] = {}) {
  const dir = await tmpDir();
  const r = await writeReportFixture(dir, { rows: TWO_ROWS, ...opts });
  return { dir, ...r, paths: reportPaths(dir, r.slug) };
}

const codes = (problems: Array<{ code: string }>) => problems.map((p) => p.code);

async function edit(path: string, from: string, to: string): Promise<void> {
  const text = await readFile(path, 'utf8');
  expect(text).toContain(from);
  await writeFile(path, text.replace(from, to));
}

describe('report check (spec 2.12.3, R18)', () => {
  it('passes a complete report with Status: passed', async () => {
    const { mdPath } = await fixture();
    expect(await readFile(mdPath, 'utf8')).toMatch(/^Status: passed$/m);
    expect(await checkReport(mdPath)).toEqual([]);
  });

  it('Missing evidence: a deleted asset fails and names the row and leg (spec 3.3)', async () => {
    const { mdPath, dir, slug } = await fixture();
    await rm(join(dir, `assets/${slug}/miniapp-store.empty.png`));
    const problems = await checkReport(mdPath);
    expect(problems).toContainEqual(expect.objectContaining({ code: 'missing-file', row: 'store.empty', leg: 'miniapp' }));
    expect(problems.find((p) => p.code === 'missing-file')?.message).toContain('row store.empty, leg miniapp');
  });

  it('Edited section 3: one changed character inside the generated block fails (spec 3.3)', async () => {
    const { mdPath } = await fixture();
    await edit(mdPath, 'Expect: home shows guest', 'Expect: home shows guesT');
    expect(codes(await checkReport(mdPath))).toEqual(['block-edited']);
  });

  it('Status mismatch: Status: passed with one unrun leg fails (spec 3.3)', async () => {
    const { mdPath } = await fixture({ pairs: { 'store.empty@miniapp': { status: 'not-run', reason: 'the run stopped' } } });
    expect(await readFile(mdPath, 'utf8')).toMatch(/^Status: partial$/m);
    expect(await checkReport(mdPath)).toEqual([]);
    await edit(mdPath, 'Status: partial', 'Status: passed');
    const problems = await checkReport(mdPath);
    expect(codes(problems)).toEqual(['status']);
    expect(problems[0]?.message).toContain('computed status partial');
  });

  it('fails a planned row and leg with no evidence and no section 5 line', async () => {
    const { mdPath } = await fixture({ pairs: { 'store.empty@miniapp': { status: 'not-run', reason: 'the run stopped' } } });
    await edit(mdPath, '- `store.empty` on `miniapp`: not run: the run stopped\n', '');
    const problems = await checkReport(mdPath);
    expect(problems).toContainEqual(expect.objectContaining({ code: 'no-evidence', row: 'store.empty', leg: 'miniapp' }));
  });

  it('accepts a hand-written section 5 line for a pair with no result', async () => {
    const { mdPath, paths } = await fixture({ pairs: { 'store.empty@miniapp': { status: 'not-run' } } });
    const results = (await readFile(paths.results, 'utf8')).split('\n').filter((l) => !l.includes('"leg":"miniapp"')).join('\n');
    await writeFile(paths.results, results);
    expect(await updateReport(mdPath)).toBe('partial');
    expect(codes(await checkReport(mdPath))).toEqual(['no-evidence']);
    await edit(mdPath, '## 6 How to retest', '- `store.empty` on `miniapp`: the device was offline\n\n## 6 How to retest');
    expect(await checkReport(mdPath)).toEqual([]);
  });

  it('fails a hash mismatch', async () => {
    const { mdPath, dir, slug } = await fixture();
    await writeFile(join(dir, `assets/${slug}/desktop-home.guest.png`), uniformPng(64, 40, 9));
    expect(await checkReport(mdPath)).toContainEqual(expect.objectContaining({ code: 'hash', row: 'home.guest', leg: 'desktop' }));
  });

  it('fails a file in assets/<slug>/ that the ledger does not list', async () => {
    const { mdPath, dir, slug } = await fixture();
    await writeFile(join(dir, `assets/${slug}/hand-shot.png`), 'x');
    expect(codes(await checkReport(mdPath))).toEqual(['unlisted-file']);
  });

  it('fails an embed outside assets/<slug>/ and an embed with no ledger entry', async () => {
    const { mdPath, slug } = await fixture();
    await edit(mdPath, '## 4 Findings\n', `## 4 Findings\n\n![old](assets/other/x.png)\n\n![new](assets/${slug}/y.png)\n`);
    expect(codes(await checkReport(mdPath))).toEqual(['embed-outside', 'embed-unledgered']);
  });

  it('fails a ledger file that section 3 does not embed', async () => {
    const { mdPath, slug } = await fixture();
    const text = await readFile(mdPath, 'utf8');
    const line = `![desktop home guest](assets/${slug}/desktop-home.guest.png)`;
    await writeFile(mdPath, text.replace(line, ''));
    expect(codes(await checkReport(mdPath))).toEqual(['block-edited', 'unembedded']);
  });

  it('fails a missing header line, a missing section and broken markers', async () => {
    const { mdPath } = await fixture();
    await edit(mdPath, 'Coverage: ', 'Cover: ');
    await edit(mdPath, '## 6 How to retest', '## Retest');
    await edit(mdPath, '<!-- qa:evidence:end -->', '');
    expect(codes(await checkReport(mdPath))).toEqual(['header', 'section', 'block']);
  });

  it('fails a blank screenshot under a passed row', async () => {
    const dir = await tmpDir();
    const { mdPath, slug } = await writeReportFixture(dir);
    const rel = `assets/${slug}/desktop-home.guest.png`;
    await writeFile(join(dir, rel), uniformPng(64, 40));
    const entry = await ledgerEntry(dir, { path: rel, kind: 'screenshot', capturedAt: 't', commit: 'c', dirty: false, leg: 'desktop', target: 'playwright', provenance: 'live', row: 'home.guest', attempt: 1 });
    await appendLedger(dir, slug, [entry]);
    await updateReport(mdPath);
    expect(await checkReport(mdPath)).toEqual([expect.objectContaining({ code: 'blank', row: 'home.guest', leg: 'desktop' })]);
  });

  it('fails a missing plan', async () => {
    const { mdPath, paths } = await fixture();
    await rm(paths.plan);
    expect(codes(await checkReport(mdPath))).toEqual(['plan']);
  });
});

describe('computeStatus (spec 2.12.2)', () => {
  it('is planned before any row runs, then passed, failed or partial', async () => {
    const { mdPath, paths } = await fixture({ pairs: { 'store.empty@miniapp': { status: 'failed', failures: ['blank'] } } });
    const r = await loadReport(mdPath);
    const manifest = r.manifest as NonNullable<typeof r.manifest>;
    const entries = r.ledger?.entries ?? [];
    expect(computeStatus({ manifest, results: [], entries })).toBe('planned');
    expect(computeStatus({ manifest, results: r.results, entries })).toBe('failed');
    const passed = r.results.map((x) => ({ ...x, status: 'passed' as const, failures: [] }));
    expect(computeStatus({ manifest, results: passed, entries })).toBe('passed');
    expect(computeStatus({ manifest, results: passed.slice(1), entries })).toBe('partial');
    expect(computeStatus({ manifest, results: passed, entries: entries.slice(1) })).toBe('partial');
    expect(paths.md).toBe(mdPath);
  });

  it('a planned report passes the check before any row runs', async () => {
    const dir = await tmpDir();
    const slug = '2026-02-03-plan-only';
    const paths = reportPaths(dir, slug);
    await mkdir(dir, { recursive: true });
    await writeFile(paths.plan, JSON.stringify({ title: 't', generated: 'g', spec: 'docs/specs/x.md', shots: [{ id: 'a.b', screen: 'a', state: 'b', source: ['spec:docs/specs/x.md#R1'], legs: ['desktop'], route: '/', fixture: { arm: [] }, settle: { busy: true }, expect: 'x' }] }));
    await writeFile(paths.md, reportSkeleton({ title: 't', date: '2026-02-03', source: { field: 'Spec', value: 'docs/specs/x.md' } }));
    expect(await updateReport(paths.md)).toBe('planned');
    expect(await checkReport(paths.md)).toEqual([]);
  });
});

describe('forged provenance (spec 2.5, R4)', () => {
  it('a forged state never counts as a live pass', async () => {
    const { mdPath } = await fixture();
    const r = await loadReport(mdPath);
    const manifest = r.manifest as NonNullable<typeof r.manifest>;
    const entries = r.ledger?.entries ?? [];
    const passed = r.results.map((x) => ({ ...x, status: 'passed' as const, failures: [] }));
    expect(computeStatus({ manifest, results: passed, entries })).toBe('passed');
    const forged = entries.map((e) => ({ ...e, provenance: 'forged' as const }));
    expect(computeStatus({ manifest, results: passed, entries: forged })).toBe('partial');
  });

  it('marks a forged shot in the report and keeps the check green', async () => {
    const { mdPath, dir, slug } = await fixture();
    const ledgerPath = reportPaths(dir, slug).ledger;
    const ledger = await readFile(ledgerPath, 'utf8');
    await writeFile(ledgerPath, ledger.replaceAll('"provenance": "live"', '"provenance": "forged"'));
    expect(await updateReport(mdPath)).toBe('partial');
    expect(await readFile(mdPath, 'utf8')).toContain('(forged)');
    expect(await checkReport(mdPath)).toEqual([]);
  });
});

describe('slugOf', () => {
  it('takes the slug from YYYY-MM-DD-<name>.md and refuses another name', () => {
    expect(slugOf('/p/docs/qa/2026-11-12-checkout.md')).toBe('2026-11-12-checkout');
    expect(() => slugOf('/p/docs/qa/checkout.md')).toThrow(/YYYY-MM-DD/);
  });
});

describe('report check of an issue pass (spec 2.15.4, R28)', () => {
  async function issuePass(opts: Parameters<typeof writeIssueReportFixture>[1] = {}) {
    const root = await tmpDir();
    return { root, ...(await writeIssueReportFixture(root, opts)) };
  }
  const findings = (mdPath: string, body: string) => edit(mdPath, '## 4 Findings\n', `## 4 Findings\n\n${body}\n`);
  const intakeFile = (root: string, id: string, file: string) => join(root, '.lw/qa/intake', id, file);

  it('passes a statement with the reporter media linked from section 4', async () => {
    const { root, mdPath, issue, link } = await issuePass();
    await findings(mdPath, `- issue ${issue}: REPRODUCED\n\n[reporter screenshot](${link})\n\n![reporter screenshot](${link})`);
    expect(await checkReport(mdPath, { root })).toEqual([]);
  });

  it('accepts a NOT REPRODUCED statement without a media link', async () => {
    const { root, mdPath, issue } = await issuePass();
    await findings(mdPath, `- issue ${issue}: NOT REPRODUCED`);
    expect(await checkReport(mdPath, { root })).toEqual([]);
  });

  it('fails an issue of the Issues line with no statement in section 4', async () => {
    const { root, mdPath, issue } = await issuePass();
    const problems = await checkReport(mdPath, { root });
    expect(codes(problems)).toEqual(['issue-statement']);
    expect(problems[0]?.message).toContain(`- issue ${issue}: REPRODUCED`);
  });

  it('fails an issue of the plan that the header names on no Issues line', async () => {
    const { root, mdPath, issue } = await issuePass();
    await edit(mdPath, `Issues: ${issue}`, 'Spec: docs/specs/x.md');
    const problems = await checkReport(mdPath, { root });
    expect(codes(problems)).toEqual(['issue-statement']);
    expect(problems[0]?.message).toContain(`the plan names issue ${issue}`);
  });

  it('fails a malformed statement and a second statement for one issue', async () => {
    const { root, mdPath, issue } = await issuePass();
    await findings(mdPath, `- issue ${issue}: reproduced`);
    expect(codes(await checkReport(mdPath, { root }))).toEqual(['issue-statement', 'issue-statement']);
    await edit(mdPath, `- issue ${issue}: reproduced`, `- issue ${issue}: REPRODUCED\n- issue ${issue}: NOT REPRODUCED`);
    expect(codes(await checkReport(mdPath, { root }))).toEqual(['issue-statement']);
  });

  it('fails a statement for an issue that the Issues line does not list', async () => {
    const { root, mdPath, issue } = await issuePass();
    await findings(mdPath, `- issue ${issue}: REPRODUCED\n- issue tg-fixture-8: NOT REPRODUCED`);
    const problems = await checkReport(mdPath, { root });
    expect(codes(problems)).toEqual(['issue-unknown']);
    expect(problems[0]?.message).toContain('tg-fixture-8');
  });

  it('fails a statement when no row of the issue has ledger evidence', async () => {
    const { root, mdPath, issue } = await issuePass({ pairs: { 'bot.silent@desktop': { status: 'not-run', reason: 'the stack was down' } } });
    await findings(mdPath, `- issue ${issue}: NOT REPRODUCED`);
    const problems = await checkReport(mdPath, { root });
    expect(codes(problems)).toEqual(['issue-evidence']);
    expect(problems[0]?.message).toContain(`issue:${issue}`);
  });

  it('leaves the statements unchecked while the report is planned', async () => {
    const { root, mdPath, reportDir, slug } = await issuePass();
    await rm(join(reportDir, `assets/${slug}`), { recursive: true });
    expect(await updateReport(mdPath)).toBe('planned');
    expect(await checkReport(mdPath, { root })).toEqual([]);
  });

  it('refuses a media link outside section 4', async () => {
    const { root, mdPath, issue, link } = await issuePass();
    await findings(mdPath, `- issue ${issue}: REPRODUCED`);
    await edit(mdPath, '## 6 How to retest\n', `## 6 How to retest\n\n[reporter screenshot](${link})\n`);
    const problems = await checkReport(mdPath, { root });
    expect(codes(problems)).toEqual(['intake-link']);
    expect(problems[0]?.message).toContain('outside section 4');
  });

  it('refuses a media link of an issue that the Issues line does not list', async () => {
    const { root, mdPath, issue, link } = await issuePass();
    const other = await writeIssue(root, { id: 'tg-fixture-8', source: 'telegram', ref: 'r', title: 't', reportedAt: 'a', reporter: 'r', text: 'x', thread: [], media: [{ from: 'tg:8/1', kind: 'image', mime: 'image/png', name: 'chat.png', data: patternPng(40, 64) }] });
    await findings(mdPath, `- issue ${issue}: REPRODUCED\n\n[other](${link.replace(issue, other.id)})`);
    const problems = await checkReport(mdPath, { root });
    expect(codes(problems)).toEqual(['intake-link']);
    expect(problems[0]?.message).toContain('Issues: header line does not list');
  });

  it('refuses a media link to a file that the record does not list or that is gone', async () => {
    const { root, mdPath, issue, link } = await issuePass();
    await writeFile(intakeFile(root, issue, 'assets/99-extra.png'), patternPng(40, 64));
    await findings(mdPath, `- issue ${issue}: REPRODUCED\n\n[extra](${link.replace(/[^/]+$/, '99-extra.png')})\n\n[reporter screenshot](${link})`);
    expect((await checkReport(mdPath, { root })).map((p) => p.message)).toEqual([expect.stringContaining('is not an attachment of issue')]);
    await rm(intakeFile(root, issue, link.replace(/^.*\/assets\//, 'assets/')));
    expect((await checkReport(mdPath, { root })).map((p) => p.message)).toEqual([expect.stringContaining('is not an attachment of issue'), expect.stringContaining('is missing from')]);
  });

  it('treats a media link as outside assets/<slug>/ when the check has no project root', async () => {
    const { mdPath, issue, link } = await issuePass();
    await findings(mdPath, `- issue ${issue}: REPRODUCED\n\n[reporter screenshot](${link})`);
    expect(codes(await checkReport(mdPath))).toEqual(['embed-outside']);
  });

  it('keeps a hand-written section 4 through lw qa report update', async () => {
    const { root, mdPath, issue, link } = await issuePass();
    const section = `- issue ${issue}: REPRODUCED\n\nThe bot stays silent after /start.\n\n[reporter screenshot](${link})`;
    await findings(mdPath, section);
    expect(await updateReport(mdPath)).toBe('passed');
    expect(await readFile(mdPath, 'utf8')).toContain(`## 4 Findings\n\n${section}\n`);
    expect(await checkReport(mdPath, { root })).toEqual([]);
  });
});

describe('reportScoreInput and the gauge (spec 2.11, R11)', () => {
  it('reads coverage, evidence and the console band from the run', async () => {
    const { mdPath } = await fixture({ pairs: { 'store.empty@miniapp': { status: 'failed', failures: ['page-error'] } } });
    const r = await loadReport(mdPath);
    const manifest = r.manifest as NonNullable<typeof r.manifest>;
    const input = reportScoreInput({ manifest, results: r.results, entries: r.ledger?.entries ?? [] });
    expect(input).toEqual({ coverage: 1, evidence: 0.75, consoleErrors: 1 });
  });

  it('leaves every severity dimension untested with no finding data', async () => {
    const { mdPath } = await fixture();
    const r = await loadReport(mdPath);
    const manifest = r.manifest as NonNullable<typeof r.manifest>;
    const input = reportScoreInput({ manifest, results: r.results, entries: r.ledger?.entries ?? [] });
    expect(Object.keys(input).sort()).toEqual(['consoleErrors', 'coverage', 'evidence']);
  });

  it('draws the gauge circle and the score number near the top of the page', async () => {
    const { dir, mdPath } = await fixture();
    const r = await loadReport(mdPath);
    const manifest = r.manifest as NonNullable<typeof r.manifest>;
    const { score } = computeScore(reportScoreInput({ manifest, results: r.results, entries: r.ledger?.entries ?? [] }));
    const page = await renderReport(mdPath, RENDERER_DIR, dir);
    const html = await readFile(page, 'utf8');
    expect(html).toContain('<circle');
    expect(html).toContain(`>${score}</text>`);
    expect(html).toContain(`aria-label="QA score ${score} of 100"`);
    expect(html.indexOf('class="qa-score"')).toBeLessThan(html.indexOf('<h2'));
  });

  it('leaves the gauge off a report before any row runs', async () => {
    const dir = await tmpDir();
    const slug = '2026-02-03-plan-only';
    const paths = reportPaths(dir, slug);
    await mkdir(dir, { recursive: true });
    await writeFile(paths.plan, JSON.stringify({ title: 't', generated: 'g', spec: 'docs/specs/x.md', shots: [{ id: 'a.b', screen: 'a', state: 'b', source: ['spec:docs/specs/x.md#R1'], legs: ['desktop'], route: '/', fixture: { arm: [] }, settle: { busy: true }, expect: 'x' }] }));
    await writeFile(paths.md, reportSkeleton({ title: 't', date: '2026-02-03', source: { field: 'Spec', value: 'docs/specs/x.md' } }));
    await updateReport(paths.md);
    const html = await readFile(await renderReport(paths.md, RENDERER_DIR, dir), 'utf8');
    expect(html).not.toContain('class="qa-score"');
  });
});

describe('intakeTarget and withoutIntakeLinks (spec 2.15.4)', () => {
  it('resolves a relative link into the intake folder and nothing else', () => {
    const root = '/p';
    expect(intakeTarget('/p/docs/qa', root, '../../.lw/qa/intake/tg-1/assets/01-a.png')).toEqual({ id: 'tg-1', file: 'assets/01-a.png' });
    expect(intakeTarget('/p/.lw/qa-pass', root, '../qa/intake/tg-1/assets/01-a.png')).toEqual({ id: 'tg-1', file: 'assets/01-a.png' });
    expect(intakeTarget('/p/docs/qa', root, '../.lw/qa/intake/tg-1/assets/01-a.png')).toBeNull();
    expect(intakeTarget('/p/docs/qa', root, '/p/.lw/qa/intake/tg-1/assets/01-a.png')).toBeNull();
    expect(intakeTarget('/p/docs/qa', root, 'assets/2026-01-01-x/desktop-a.b.png')).toBeNull();
  });

  it('replaces each media link and embed with plain text outside code spans', () => {
    const text = ['[shot](../../.lw/qa/intake/tg-1/assets/01-a.png) and ![shot](../../.lw/qa/intake/tg-1/assets/01-a.png)', '`[shot](../../.lw/qa/intake/tg-1/assets/01-a.png)`'].join('\n');
    expect(withoutIntakeLinks(text, '/p/docs/qa', '/p').split('\n')).toEqual([
      'reporter media of issue tg-1 stays local and reporter media of issue tg-1 stays local',
      '`[shot](../../.lw/qa/intake/tg-1/assets/01-a.png)`',
    ]);
  });
});
