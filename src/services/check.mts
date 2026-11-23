// The rules of `lw qa check` (spec 2.14, 2.11.5, 2.6): C1 and C4 from the state scan, C3 on the
// client roots, S1 on the world and feature files, the `waitForTimeout` ban in project QA files,
// and S3, the scan of the production client build for the dev-only marker.
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, posix, relative, sep } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { pathKind, readTextOrNull } from '@launchwrighthq/kernel/fs';

/** The string that marks dev-only QA code. Inlined from client (services/qa-persona.mts). */
const QA_DEV_MARKER = 'lw-qa-dev-only';
import type { QaConfig } from '../config.mts';
import { stateFindings } from '../states/services/check.mts';
import { readTree } from '../states/services/scan.mts';
import { FEATURE_SUFFIX, featuresWithoutWorld, WORLD_SUFFIX, worldLintFindings } from '../world/services/discover.mts';

/** One finding. The command prints it as `<rule> <file>:<line> <message>`. */
export interface CheckFinding {
  rule: 'C1' | 'C3' | 'C4' | 'S1' | 'S3' | 'wait';
  file: string;
  /** 1-based. 0 for a finding about a whole file or folder. */
  line: number;
  message: string;
}

/** The C3 patterns: a component reads the persona parameter or branches on a QA flag. */
export const C3_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp; what: string }> = [
  { name: 'query', pattern: /[?&]qa=/, what: 'reads the ?qa= persona parameter' },
  { name: 'search-params', pattern: /\.(?:get|getAll|has)\(\s*(['"`])qa\1\s*\)/, what: "reads the query parameter 'qa'" },
  { name: 'param-constant', pattern: /\bQA_PERSONA_PARAM\b/, what: 'reads the persona parameter through QA_PERSONA_PARAM' },
  { name: 'env-flag', pattern: /\b(?:import\.meta\.env|process\.env)\.\w*QA\w*/, what: 'branches on a QA env flag' },
  { name: 'global-flag', pattern: /\b(?:window|globalThis|self)\.__?\w*[qQ][aA]\w*/, what: 'branches on a QA global' },
  { name: 'flag-name', pattern: /\b(?:isQa|isQA|qaMode|QA_MODE|__QA__|inQa|underQa)\b/, what: 'branches on a QA flag' },
];

/** The QA files where `waitForTimeout` is banned: a capture waits on `settle`, never on time. */
export const WAIT_PATTERN = /\bwaitForTimeout\b/;

/** A feature has a client route when its file opens the Mini App: it names a `web_app` button or link. */
export const CLIENT_ROUTE_PATTERN = /\bweb_app\b|\bwebApp\w*|\bminiApp\w*/;

/** Folders that never hold project QA files. A folder whose name starts with `.` is skipped too. */
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage']);

/** The text files the `waitForTimeout` ban reads. */
const CODE_FILE = /\.(?:[cm]?[jt]sx?|json)$/;

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

/** A line that holds only a comment. The rules read code, so a comment that names a pattern passes. */
function isCommentLine(line: string): boolean {
  return /^\s*(?:\/\/|\/\*|\*|#)/.test(line);
}

/** Rule C3: no component reads `?qa=` or branches on a QA flag. A file with the dev-only marker is dev-only code. */
export function c3Findings(file: string, text: string): CheckFinding[] {
  if (text.includes(QA_DEV_MARKER)) return [];
  const out: CheckFinding[] = [];
  text.split('\n').forEach((line, i) => {
    if (isCommentLine(line)) return;
    const hit = C3_PATTERNS.find((p) => p.pattern.test(line));
    if (hit) {
      out.push({
        rule: 'C3',
        file,
        line: i + 1,
        message: `${hit.what}. A component reaches a QA state through a persona or a fact, never through a test flag.`,
      });
    }
  });
  return out;
}

/** Rule C3 over every product source of the client roots. */
export function clientRootFindings(root: string, clientRoots: readonly string[]): CheckFinding[] {
  return clientRoots.flatMap((dir) => readTree(root, dir)).flatMap((source) => c3Findings(source.file, source.text));
}

/** The `waitForTimeout` findings of one QA file (spec 2.11.5). */
export function waitFindings(file: string, text: string): CheckFinding[] {
  const out: CheckFinding[] = [];
  text.split('\n').forEach((line, i) => {
    if (!isCommentLine(line) && WAIT_PATTERN.test(line)) {
      out.push({ rule: 'wait', file, line: i + 1, message: 'waitForTimeout in a QA file. Settle on a selector, artwork, a video or aria-busy instead.' });
    }
  });
  return out;
}

/** Whether a project file is a QA file: a world file, a shot manifest, or a code file under a `qa/` folder. */
export function isQaFile(rel: string, reportDir: string): boolean {
  if (!CODE_FILE.test(rel)) return false;
  const report = posix.normalize(reportDir).replace(/\/$/, '');
  if (rel.startsWith(`${report}/assets/`) || rel.startsWith(`${report}/dist/`)) return false;
  if (rel.endsWith(WORLD_SUFFIX) || rel.endsWith('.shots.json')) return true;
  return rel.split('/').slice(0, -1).includes('qa');
}

async function entriesOf(dir: string): Promise<import('node:fs').Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    throw new LaunchwrightError('qa.check.read', `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
}

/** Every project file that `keep` accepts, relative with `/`, sorted. Skips dot folders, node_modules and builds. */
async function projectFiles(root: string, keep: (rel: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    for (const entry of await entriesOf(dir)) {
      if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && keep(toPosix(relative(root, path)))) out.push(toPosix(relative(root, path)));
    }
  };
  await visit(root);
  return out.sort();
}

/** The text of `file` under `root`. A missing file throws `qa.check.read`. */
async function projectText(root: string, file: string): Promise<string> {
  const text = await readTextOrNull(join(root, file));
  if (text === null) throw new LaunchwrightError('qa.check.read', `Cannot read ${file}.`, { context: { file } });
  return text;
}

/** The `waitForTimeout` findings of every QA file of the project. */
export async function projectWaitFindings(root: string, reportDir: string): Promise<CheckFinding[]> {
  const out: CheckFinding[] = [];
  for (const file of await projectFiles(root, (rel) => isQaFile(rel, reportDir))) out.push(...waitFindings(file, await projectText(root, file)));
  return out;
}

/**
 * Rule S1: raw SQL in a world file, and a feature with a client route that has no world file
 * beside it (spec 2.5.1).
 */
export async function worldFindings(root: string): Promise<CheckFinding[]> {
  const out: CheckFinding[] = (await worldLintFindings(root)).map((f) => ({ rule: 'S1', file: f.file, line: f.line, message: f.message }));
  for (const feature of await featuresWithoutWorld(root)) {
    const text = await projectText(root, feature);
    if (!CLIENT_ROUTE_PATTERN.test(text)) continue;
    const world = `${basename(feature, FEATURE_SUFFIX)}${WORLD_SUFFIX}`;
    out.push({
      rule: 'S1',
      file: feature,
      line: 0,
      message: `the feature opens a client route and has no ${world} beside it. Add one with a persona or a fact for each state it shows.`,
    });
  }
  return out;
}

/** The first line of `text` that holds the marker. */
function markerLine(text: string): number {
  const at = text.indexOf(QA_DEV_MARKER);
  return text.slice(0, at).split('\n').length;
}

async function buildFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const visit = async (at: string): Promise<void> => {
    for (const entry of await entriesOf(at)) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  await visit(dir);
  return out.sort();
}

/**
 * Rule S3: no file of a production client build holds the marker `lw-qa-dev-only` (spec 2.6). A
 * missing build folder is a finding only when `requireBuild` is true (`lw qa check --build`).
 */
export async function bundleFindings(root: string, buildDirs: readonly string[], requireBuild: boolean): Promise<CheckFinding[]> {
  const out: CheckFinding[] = [];
  for (const dir of buildDirs) {
    if ((await pathKind(join(root, dir))) !== 'dir') {
      if (requireBuild) out.push({ rule: 'S3', file: dir, line: 0, message: 'the production client build is missing. Build the client, or fix qa.buildDirs.' });
      continue;
    }
    for (const path of await buildFiles(join(root, dir))) {
      let bytes: Buffer;
      try {
        bytes = await readFile(path);
      } catch (cause) {
        throw new LaunchwrightError('qa.check.read', `Cannot read ${path}.`, { cause });
      }
      if (!bytes.includes(QA_DEV_MARKER)) continue;
      out.push({
        rule: 'S3',
        file: toPosix(relative(root, path)),
        line: markerLine(bytes.toString('utf8')),
        message: `the production build holds ${QA_DEV_MARKER}. Dev-only QA code reached the bundle: import it only from the dev server.`,
      });
    }
  }
  return out;
}

export interface CheckOptions {
  root: string;
  qa: Pick<QaConfig, 'clientRoots' | 'typeRoots' | 'routeTables' | 'reportDir' | 'buildDirs'>;
  /** The time stamp of the state scan. */
  generated: string;
  /** A missing build folder is a finding. */
  requireBuild: boolean;
}

/** Every finding of `lw qa check`, sorted by rule, file and line. */
export async function runChecks(o: CheckOptions): Promise<CheckFinding[]> {
  const states: CheckFinding[] = stateFindings(o.root, o.qa, o.generated).map((f) => ({
    rule: f.rule,
    file: f.file,
    line: f.line,
    message: f.message.startsWith(`${f.file}:${f.line} `) ? f.message.slice(`${f.file}:${f.line} `.length) : f.message,
  }));
  const all = [
    ...states,
    ...clientRootFindings(o.root, o.qa.clientRoots),
    ...(await worldFindings(o.root)),
    ...(await projectWaitFindings(o.root, o.qa.reportDir)),
    ...(await bundleFindings(o.root, o.qa.buildDirs, o.requireBuild)),
  ];
  return all.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
}

/** The printed line of a finding. */
export function findingLine(f: CheckFinding): string {
  return `${f.rule} ${f.file}:${f.line} ${f.message}`;
}
