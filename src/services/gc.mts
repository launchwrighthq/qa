// `lw qa gc --keep <n>` (spec 2.12.3): deletes the evidence of older reports. The report files
// stay: `<slug>.md` and `<slug>.shots.json`. Of each older report it deletes `assets/<slug>/` and
// the rendered page `dist/<slug>.html`, which links the deleted evidence.
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { reportPaths } from './ledger.mts';

const REPORT_RE = /^(\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

export interface GcResult {
  /** The slugs whose evidence stays, newest first. */
  kept: string[];
  /** The slugs whose evidence the run deleted, with the bytes freed. */
  deleted: Array<{ slug: string; bytes: number }>;
}

async function size(path: string): Promise<number> {
  let s;
  try {
    s = await stat(path);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw new LaunchwrightError('qa.gc.read', `Cannot read ${path}`, { cause });
  }
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const name of await readdir(path)) total += await size(join(path, name));
  return total;
}

/**
 * Keeps the evidence of the `keep` newest reports in `reportDir` and deletes the evidence of the
 * others. The order is the slug, which starts with the report date. An asset folder with no
 * report stays: a run that has not written its report yet owns it.
 */
export async function gcReports(reportDir: string, keep: number): Promise<GcResult> {
  if (!Number.isInteger(keep) || keep < 0) throw new LaunchwrightError('qa.gc.keep', `--keep must be a whole number of reports, not ${keep}`);
  let names: string[];
  try {
    names = await readdir(reportDir);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return { kept: [], deleted: [] };
    throw new LaunchwrightError('qa.gc.read', `Cannot list ${reportDir}`, { cause });
  }
  const slugs = names
    .map((n) => REPORT_RE.exec(n)?.[1])
    .filter((s): s is string => s !== undefined)
    .sort()
    .reverse();
  const result: GcResult = { kept: slugs.slice(0, keep), deleted: [] };
  for (const slug of slugs.slice(keep)) {
    const paths = reportPaths(reportDir, slug);
    const bytes = (await size(paths.assets)) + (await size(paths.html));
    await rm(paths.assets, { recursive: true, force: true });
    await rm(paths.html, { force: true });
    if (bytes > 0) result.deleted.push({ slug, bytes });
  }
  return result;
}
