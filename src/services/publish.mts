// `lw qa publish <slug>` (spec 2.12.3): copies one report bundle to a `storage` disk. The bundle is
// the report, its plan, the rendered page when it exists, and `assets/<slug>/` with the ledger and
// the row results. Intake records (`.lw/qa/intake/`) never enter a bundle (spec 2.15.1): the
// published report and page carry plain text where section 4 links reporter media (spec 2.15.4).
import { readdir, readFile, realpath } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { pathKind } from '@launchwrighthq/kernel/fs';
import type { StorageDriver } from './peers.mts';
import { reportPaths } from './ledger.mts';
import { checkReport, type CheckOptions, intakeStaysLocal, intakeTarget, type ReportProblem, withoutIntakeLinks } from './report.mts';
import { INTAKE_DIR } from './types.mts';

/** The key prefix of every published report. The keys mirror the report folder. */
export const PUBLISH_PREFIX = 'qa';
/** The life of a printed link: 7 days, the longest a presigned URL can live. */
export const LINK_TTL_S = 604800;

const CONTENT_TYPES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.jsonl': 'application/x-ndjson',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.xml': 'application/xml',
};

const contentType = (file: string): string => CONTENT_TYPES[/\.[^./]+$/.exec(file)?.[0] ?? ''] ?? 'application/octet-stream';

export interface PublishInput {
  /** The project root. */
  root: string;
  /** `qa.reportDir`, relative to the root. */
  reportDir: string;
  slug: string;
  driver: StorageDriver;
  check?: CheckOptions;
}

export interface PublishedFile {
  key: string;
  bytes: number;
  /** A presigned GET link when the driver can sign one. */
  url?: string;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

/** The rendered page in `pageDir` without its links to reporter media, which `renderReport` writes as `<a href>`. */
function pageWithoutIntakeLinks(html: string, pageDir: string, root: string): string {
  return html.replace(/<a href="([^"]*)">[\s\S]*?<\/a>|<img src="([^"]*)"[^>]*>|<video src="([^"]*)"[^>]*>[\s\S]*?<\/video>/g, (m, a?: string, img?: string, video?: string) => {
    const target = intakeTarget(pageDir, root, (a ?? img ?? video) as string);
    return target === null ? m : intakeStaysLocal(target.id);
  });
}

/**
 * Publishes one report bundle. It refuses a report that fails `checkReport` (`qa.publish.check`),
 * a file whose real path is under the intake folder, and a published text that still names the
 * intake folder after its links to reporter media became plain text (`qa.publish.intake`). The
 * upload starts only after every file passes.
 */
export async function publishReport(input: PublishInput): Promise<PublishedFile[]> {
  const dir = resolve(input.root, input.reportDir);
  const paths = reportPaths(dir, input.slug);
  if (!('missing' !== await pathKind(paths.md))) {
    throw new LaunchwrightError('qa.publish.missing', `No report ${paths.md}`, { context: { slug: input.slug } });
  }
  const problems: ReportProblem[] = await checkReport(paths.md, { ...input.check, root: input.root });
  if (problems.length > 0) {
    throw new LaunchwrightError('qa.publish.check', `The report ${input.slug} fails lw qa report check:\n  ${problems.map((p) => p.message).join('\n  ')}`, {
      context: { slug: input.slug, problems: problems.length },
    });
  }
  const files = [paths.md, paths.plan];
  if ('missing' !== await pathKind(paths.html)) files.push(paths.html);
  if ('missing' !== await pathKind(paths.assets)) files.push(...(await walk(paths.assets)));

  const intake = resolve(input.root, INTAKE_DIR);
  const intakeReal = ('missing' !== await pathKind(intake)) ? await realpath(intake) : intake;
  for (const file of files) {
    const real = await realpath(file);
    if (real === intakeReal || real.startsWith(intakeReal + sep) || real.startsWith(intake + sep)) {
      throw new LaunchwrightError('qa.publish.intake', `${relative(input.root, file)} is intake content, which never leaves ${INTAKE_DIR}/`, {
        context: { file: relative(input.root, file) },
      });
    }
  }

  const bodies = new Map<string, Buffer>();
  for (const file of files) {
    let body = await readFile(file);
    if (file === paths.md || file === paths.html) {
      const text = body.toString('utf8');
      const published = file === paths.md ? withoutIntakeLinks(text, dir, input.root) : pageWithoutIntakeLinks(text, dirname(paths.html), input.root);
      if (published.includes(INTAKE_DIR)) {
        throw new LaunchwrightError('qa.publish.intake', `${relative(input.root, file)} names ${INTAKE_DIR}/ outside a section 4 link to reporter media. Intake content stays local.`, {
          context: { file: relative(input.root, file) },
        });
      }
      body = Buffer.from(published, 'utf8');
    }
    bodies.set(file, body);
  }

  const out: PublishedFile[] = [];
  const presign = input.driver.supports('presign');
  for (const file of files) {
    const rel = relative(dir, file).split(sep).join('/');
    const key = `${PUBLISH_PREFIX}/${rel}`;
    const body = bodies.get(file) as Buffer;
    try {
      await input.driver.put(key, body, { contentType: contentType(file) });
    } catch (cause) {
      throw new LaunchwrightError('qa.publish.put', `Cannot publish ${rel} as ${key}`, { cause, context: { key } });
    }
    const url = presign ? await input.driver.presign(key, { method: 'GET', expiresIn: LINK_TTL_S }) : undefined;
    out.push({ key, bytes: body.length, ...(url !== undefined ? { url } : {}) });
  }
  return out;
}
