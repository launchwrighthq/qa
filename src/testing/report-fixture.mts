// A complete QA report on disk for tests: the plan, PNG evidence, the ledger, the row results and
// the report with its generated parts. The synthetic checks of spec 3.3 start from it.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { appendLedger, appendResult, ledgerEntry, reportPaths } from '../services/ledger.mts';
import { evidencePath, type Manifest } from '../services/manifest.mts';
import { encodePng } from '../services/png.mts';
import { reportSkeleton, updateReport } from '../services/report.mts';
import { INTAKE_DIR, type RowResult } from '../services/types.mts';
import { writeIssue } from '../services/records.mts';

/** An RGBA image with a diagonal pattern, so its luminance spread is far above the blank limit. */
export function patternPng(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = (x * 7 + y * 13) % 256;
      rgba[i + 1] = (x * 3) % 256;
      rgba[i + 2] = (y * 5) % 256;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(width, height, rgba);
}

/** An RGBA image of one color. */
export function uniformPng(width: number, height: number, gray = 0): Uint8Array {
  const rgba = new Uint8Array(width * height * 4).fill(gray);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return encodePng(width, height, rgba);
}

/** What one row and leg of the fixture records. Default: passed, one landscape or portrait screenshot. */
export interface FixturePair {
  status?: RowResult['status'];
  failures?: RowResult['failures'];
  reason?: string;
  /** False: no evidence file. */
  files?: boolean;
}

export interface ReportFixtureOptions {
  slug?: string;
  /** Rows with their legs and `source`. Default: `home.guest` on `desktop` and `mobile-web`, source `commit:abc1234`. */
  rows?: Array<{ id: string; legs: string[]; source?: string[] }>;
  /** Overrides by `<row>@<leg>`. */
  pairs?: Record<string, FixturePair>;
  /** The header line that names what the pass covers. Default: `Range: abc1234..def5678`. */
  header?: { field: 'Range' | 'Spec' | 'Issues'; value: string };
}

/** Writes the report and returns its path and slug. The `desktop` leg gets landscape shots. */
export async function writeReportFixture(reportDir: string, opts: ReportFixtureOptions = {}): Promise<{ mdPath: string; slug: string }> {
  const slug = opts.slug ?? '2026-01-01-fixture';
  const rows = opts.rows ?? [{ id: 'home.guest', legs: ['desktop', 'mobile-web'] }];
  const paths = reportPaths(reportDir, slug);
  const manifest: Manifest = {
    title: 'fixture',
    generated: '2026-01-01T00:00:00.000Z',
    range: 'abc1234..def5678',
    shots: rows.map((r) => {
      const [screen, state] = r.id.split('.') as [string, string];
      return { id: r.id, screen, state, source: r.source ?? ['commit:abc1234'], legs: r.legs, route: `/${screen}`, fixture: { arm: [] }, settle: { busy: true }, expect: `${screen} shows ${state}` };
    }),
  };
  await mkdir(paths.assets, { recursive: true });
  await writeFile(paths.plan, `${JSON.stringify(manifest, null, 2)}\n`);
  const entries = [];
  for (const row of rows) {
    for (const leg of row.legs) {
      const pair = opts.pairs?.[`${row.id}@${leg}`] ?? {};
      const status = pair.status ?? 'passed';
      if (pair.files !== false && (status === 'passed' || status === 'failed')) {
        const rel = evidencePath(slug, leg, row.id, 'screenshot');
        await mkdir(dirname(join(reportDir, rel)), { recursive: true });
        await writeFile(join(reportDir, rel), leg === 'desktop' ? patternPng(64, 40) : patternPng(40, 64));
        entries.push(
          await ledgerEntry(reportDir, {
            path: rel,
            kind: 'screenshot',
            capturedAt: '2026-01-01T00:00:00.000Z',
            commit: 'abc1234',
            dirty: false,
            leg,
            target: 'playwright',
            provenance: 'live',
            row: row.id,
            attempt: 1,
          }),
        );
      }
      await appendResult(paths.results, {
        row: row.id,
        leg,
        status,
        failures: pair.failures ?? [],
        attempts: status === 'passed' || status === 'failed' ? 1 : 0,
        ms: 10,
        ...(pair.reason !== undefined ? { reason: pair.reason } : {}),
      });
    }
  }
  await appendLedger(reportDir, slug, entries);
  await writeFile(paths.md, reportSkeleton({ title: 'fixture', date: '2026-01-01', source: opts.header ?? { field: 'Range', value: 'abc1234..def5678' } }));
  await updateReport(paths.md);
  return { mdPath: paths.md, slug };
}

/** The intake id of the issue fixture. */
export const FIXTURE_ISSUE = 'tg-fixture-7';

/**
 * An issue pass on disk (spec 2.15.4): under `<root>/docs/qa`, the report fixture with the header
 * `Issues: tg-fixture-7`, the row `home.guest` and the row `bot.silent` with `source: issue:tg-fixture-7`,
 * both on `desktop`; and under `<root>/.lw/qa/intake/tg-fixture-7/`, the record with one image.
 * `link` is the report-relative link to that image. Section 4 holds no statement yet.
 */
export async function writeIssueReportFixture(
  root: string,
  opts: Pick<ReportFixtureOptions, 'pairs'> = {},
): Promise<{ mdPath: string; slug: string; reportDir: string; issue: string; link: string }> {
  const reportDir = join(root, 'docs/qa');
  const issue = await writeIssue(root, {
    id: FIXTURE_ISSUE,
    source: 'telegram',
    ref: 'chat 7, message 1',
    title: 'The bot stays silent',
    reportedAt: '2026-01-01T00:00:00.000Z',
    reporter: 'fixture reporter',
    text: 'I send /start and nothing comes back.',
    thread: [],
    media: [{ from: 'tg:7/1', kind: 'image', mime: 'image/png', name: 'chat.png', data: patternPng(40, 64) }],
  });
  const { mdPath, slug } = await writeReportFixture(reportDir, {
    rows: [
      { id: 'home.guest', legs: ['desktop'] },
      { id: 'bot.silent', legs: ['desktop'], source: [`issue:${FIXTURE_ISSUE}`] },
    ],
    header: { field: 'Issues', value: FIXTURE_ISSUE },
    ...opts,
  });
  const image = issue.attachments[0]?.path as string;
  return { mdPath, slug, reportDir, issue: FIXTURE_ISSUE, link: `../../${INTAKE_DIR}/${FIXTURE_ISSUE}/${image}` };
}
