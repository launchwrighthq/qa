// Issue records (spec 2.15.1): `.lw/qa/intake/<id>/issue.json`, `issue.md` and `assets/`. A
// record holds chat content and reporter names, so it stays under `.lw/` and nothing else reads
// it into `docs/`, a log line or a publish bundle.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchwrightError } from '../kernel/index.mts';
import { sha256 } from '../kernel/services/fs.mts';
import { extensionOf } from './mime.mts';
import { INTAKE_DIR, type QaIssue, type RawMedia } from './types.mts';

/** An issue before its media are files. */
export interface IssueDraft extends Omit<QaIssue, 'attachments' | 'skipped'> {
  media: RawMedia[];
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/** A record id from parts: `github-<owner>-<repo>-<n>` or `tg-<chat>-<first message id>`. */
export function recordId(...parts: (string | number)[]): string {
  return parts
    .map((p) => String(p).replace(/^@/, '').replace(/[^A-Za-z0-9_.-]+/g, '-'))
    .join('-');
}

/** The folder of one record. Throws `qa.intake.id` for an id that could leave the intake folder. */
export function recordDir(root: string, id: string): string {
  if (!ID.test(id) || id.includes('..')) throw new LaunchwrightError('qa.intake.id', `The intake id "${id}" has a character outside A-Z, a-z, 0-9, _, . and -.`, { context: { id } });
  return join(root, INTAKE_DIR, id);
}

function fileName(index: number, m: RawMedia): string {
  const ext = extensionOf(m.mime);
  const stem = (m.name ?? m.kind).replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40) || m.kind;
  return `${String(index).padStart(2, '0')}-${stem}.${ext}`;
}

function quote(text: string): string {
  return text === '' ? '> (no text)' : text.split('\n').map((l) => `> ${l}`).join('\n');
}

/** The `issue.md` of a record. */
export function issueMarkdown(issue: QaIssue): string {
  const lines = [
    `# ${issue.title}`,
    '',
    `- Id: ${issue.id}`,
    `- Source: ${issue.source}`,
    `- Ref: ${issue.ref}`,
    `- Reported at: ${issue.reportedAt}`,
    `- Reporter: ${issue.reporter}`,
    '',
    quote(issue.text),
  ];
  if (issue.thread.length > 0) {
    lines.push('', '## Thread');
    for (const t of issue.thread) lines.push('', `${t.at}, ${t.author}:`, '', quote(t.text));
  }
  if (issue.attachments.length > 0) {
    lines.push('', '## Attachments', '');
    for (const a of issue.attachments) {
      const link = a.kind === 'image' ? `![${a.path}](${a.path})` : `[${a.path}](${a.path})`;
      lines.push(`- ${a.kind}, ${a.mime}, ${a.bytes} bytes: ${link}`);
    }
  }
  if (issue.skipped.length > 0) {
    lines.push('', '## Skipped', '');
    for (const s of issue.skipped) lines.push(`- ${s.reason}: ${s.from}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Writes one record and its media. A record with the same id is replaced. */
export async function writeIssue(root: string, draft: IssueDraft): Promise<QaIssue> {
  const dir = recordDir(root, draft.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, 'assets'), { recursive: true });
  const { media, ...rest } = draft;
  const issue: QaIssue = { ...rest, attachments: [], skipped: [] };
  let index = 0;
  for (const m of media) {
    if (m.data === undefined) {
      issue.skipped.push({ from: m.from, reason: m.skipped ?? 'unreachable' });
      continue;
    }
    index += 1;
    const path = `assets/${fileName(index, m)}`;
    await writeFile(join(dir, path), m.data);
    issue.attachments.push({
      kind: m.kind,
      path,
      sha256: sha256(m.data),
      bytes: m.data.byteLength,
      mime: m.mime,
      from: m.from,
    });
  }
  await writeFile(join(dir, 'issue.json'), `${JSON.stringify(issue, null, 2)}\n`);
  await writeFile(join(dir, 'issue.md'), issueMarkdown(issue));
  return issue;
}

/** Reads one record. Throws `qa.intake.missing` when it does not exist. */
export async function readIssue(root: string, id: string): Promise<QaIssue> {
  const file = join(recordDir(root, id), 'issue.json');
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (cause) {
    throw new LaunchwrightError('qa.intake.missing', `No intake record ${id}. Run lw qa intake list.`, { cause, context: { id } });
  }
  return JSON.parse(text) as QaIssue;
}

/** Every record, sorted by id. Folders without `issue.json` (the Telegram staging folder) do not count. */
export async function listIssues(root: string): Promise<QaIssue[]> {
  const base = join(root, INTAKE_DIR);
  let names: string[];
  try {
    names = (await readdir(base, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new LaunchwrightError('qa.intake.read', `Cannot read ${INTAKE_DIR}.`, { cause });
  }
  const out: QaIssue[] = [];
  for (const name of names.sort()) {
    let text: string;
    try {
      text = await readFile(join(base, name, 'issue.json'), 'utf8');
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new LaunchwrightError('qa.intake.read', `Cannot read the intake record ${name}.`, { cause });
    }
    out.push(JSON.parse(text) as QaIssue);
  }
  return out;
}
