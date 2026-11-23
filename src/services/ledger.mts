// The evidence ledger (spec 2.11.3): `<reportDir>/assets/<slug>/evidence.lock.json`, one entry per
// file with its hash. Only the runner writes it. The report check verifies every hash.
//
// The files of a report, relative to the report folder:
//   <slug>.md                              the report
//   <slug>.shots.json                      the plan, one Manifest
//   assets/<slug>/evidence.lock.json       the ledger
//   assets/<slug>/results.jsonl            one RowResult per line, the last line of a row and leg wins
//   assets/<slug>/<leg>-<id>...            the evidence files
//   dist/<slug>.html                       the rendered page
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { LaunchwrightError } from '../kernel/index.mts';
import { hashFile, readTextOrNull } from '../kernel/services/fs.mts';
import { type LedgerEntry, type RowResult } from './types.mts';

export const LEDGER_FILE = 'evidence.lock.json';
export const RESULTS_FILE = 'results.jsonl';
export const LEDGER_FORMAT = 1;

/** The ledger file. */
export interface Ledger {
  format: typeof LEDGER_FORMAT;
  slug: string;
  entries: LedgerEntry[];
}

/** The folder of a report's evidence, relative to the report folder. */
export const assetsRel = (slug: string): string => `assets/${slug}`;

/** The paths of one report, absolute when `reportDir` is absolute. */
export function reportPaths(reportDir: string, slug: string) {
  return {
    md: join(reportDir, `${slug}.md`),
    plan: join(reportDir, `${slug}.shots.json`),
    assets: join(reportDir, assetsRel(slug)),
    ledger: join(reportDir, assetsRel(slug), LEDGER_FILE),
    results: join(reportDir, assetsRel(slug), RESULTS_FILE),
    html: join(reportDir, 'dist', `${slug}.html`),
  };
}

/** The sha256 hex of a file and its size. */
export async function fileDigest(path: string): Promise<{ sha256: string; bytes: number }> {
  const sha256 = await hashFile(path);
  return { sha256, bytes: (await stat(path)).size };
}

/** The fields of an entry that the runner knows. The file gives `sha256` and `bytes`. */
export type EntryFacts = Omit<LedgerEntry, 'sha256' | 'bytes'>;

/** A ledger entry for one file under `reportDir`. */
export async function ledgerEntry(reportDir: string, facts: EntryFacts): Promise<LedgerEntry> {
  checkEntryPath(facts.path);
  const { sha256, bytes } = await fileDigest(join(reportDir, facts.path));
  return { ...facts, sha256, bytes };
}

function checkEntryPath(path: string): void {
  if (!/^assets\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-][A-Za-z0-9._/-]*$/.test(path) || path.split('/').includes('..')) {
    throw new LaunchwrightError('qa.ledger.path', `Ledger path ${path} is not assets/<slug>/<file>`, { context: { path } });
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function entryProblem(e: unknown): string | null {
  if (!isObject(e)) return 'not an object';
  for (const key of ['path', 'kind', 'sha256', 'capturedAt', 'commit', 'leg', 'target', 'provenance', 'row'] as const) {
    if (typeof e[key] !== 'string' || e[key] === '') return `${key} is missing`;
  }
  if (!/^[0-9a-f]{64}$/.test(e.sha256 as string)) return 'sha256 is not 64 hex characters';
  if (typeof e.bytes !== 'number' || typeof e.attempt !== 'number' || typeof e.dirty !== 'boolean') return 'bytes, attempt or dirty has the wrong type';
  return null;
}

/** Reads a ledger. Returns null when the file does not exist. Fails with `qa.ledger.invalid`. */
export async function readLedger(path: string): Promise<Ledger | null> {
  const raw = await readTextOrNull(path);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError('qa.ledger.invalid', `The ledger ${path} is not JSON`, { cause, context: { path } });
  }
  if (!isObject(parsed) || parsed.format !== LEDGER_FORMAT || typeof parsed.slug !== 'string' || !Array.isArray(parsed.entries)) {
    throw new LaunchwrightError('qa.ledger.invalid', `The ledger ${path} is not format ${LEDGER_FORMAT} with slug and entries`, { context: { path } });
  }
  parsed.entries.forEach((e, i) => {
    const problem = entryProblem(e);
    if (problem) throw new LaunchwrightError('qa.ledger.invalid', `The ledger ${path} entry ${i}: ${problem}`, { context: { path, entry: i } });
  });
  return parsed as unknown as Ledger;
}

/** Writes a ledger with the entries sorted by path, through a temp file and a rename. Returns what it wrote. */
export async function writeLedger(path: string, ledger: Ledger): Promise<Ledger> {
  const paths = new Set<string>();
  for (const e of ledger.entries) {
    checkEntryPath(e.path);
    if (paths.has(e.path)) throw new LaunchwrightError('qa.ledger.duplicate', `The ledger lists ${e.path} twice`, { context: { path: e.path } });
    paths.add(e.path);
  }
  const sorted = { ...ledger, entries: [...ledger.entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) };
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(sorted, null, 2)}\n`);
  await rename(tmp, path);
  return sorted;
}

/** Adds entries to the ledger of `slug`, replacing an entry with the same path. */
export async function appendLedger(reportDir: string, slug: string, entries: LedgerEntry[]): Promise<Ledger> {
  const path = reportPaths(reportDir, slug).ledger;
  const current = (await readLedger(path)) ?? { format: LEDGER_FORMAT, slug, entries: [] };
  const byPath = new Map(current.entries.map((e) => [e.path, e]));
  for (const e of entries) byPath.set(e.path, e);
  return writeLedger(path, { format: LEDGER_FORMAT, slug, entries: [...byPath.values()] });
}

/**
 * Drops the entries of one row and leg from the ledger of `slug`, and deletes their files. A new run
 * of the row and leg calls it first, so the ledger holds the attempts of that run only (2.11.4).
 */
export async function dropRowLeg(reportDir: string, slug: string, row: string, leg: string): Promise<void> {
  const path = reportPaths(reportDir, slug).ledger;
  const current = await readLedger(path);
  if (!current) return;
  const stale = current.entries.filter((e) => e.row === row && e.leg === leg);
  if (stale.length === 0) return;
  for (const e of stale) {
    checkEntryPath(e.path);
    if (!e.path.startsWith(`${assetsRel(slug)}/`)) {
      throw new LaunchwrightError('qa.ledger.path', `Ledger path ${e.path} is outside ${assetsRel(slug)}`, { context: { path: e.path } });
    }
  }
  for (const e of stale) await rm(join(reportDir, e.path), { force: true });
  await writeLedger(path, { ...current, entries: current.entries.filter((e) => !(e.row === row && e.leg === leg)) });
}

/** One problem of a ledger file on disk. */
export interface LedgerProblem {
  code: 'missing-file' | 'hash';
  path: string;
  row: string;
  leg: string;
  message: string;
}

/** Every entry whose file is missing or whose hash or size differs. */
export async function verifyLedger(reportDir: string, entries: readonly LedgerEntry[]): Promise<LedgerProblem[]> {
  const out: LedgerProblem[] = [];
  for (const e of entries) {
    const file = join(reportDir, e.path);
    const where = `row ${e.row}, leg ${e.leg}`;
    try {
      await stat(file);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw new LaunchwrightError('qa.ledger.read', `Cannot read ${file}`, { cause });
      out.push({ code: 'missing-file', path: e.path, row: e.row, leg: e.leg, message: `${e.path} is in the ledger and missing on disk (${where})` });
      continue;
    }
    const actual = await fileDigest(file);
    if (actual.sha256 !== e.sha256 || actual.bytes !== e.bytes) {
      out.push({ code: 'hash', path: e.path, row: e.row, leg: e.leg, message: `${e.path} does not match its ledger hash (${where})` });
    }
  }
  return out;
}

/** Reads `results.jsonl`. Returns [] when the file does not exist. Fails with `qa.results.invalid`. */
export async function readResults(path: string): Promise<RowResult[]> {
  const raw = await readTextOrNull(path);
  if (raw === null) return [];
  const out: RowResult[] = [];
  raw.split('\n').forEach((line, i) => {
    if (line.trim() === '') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (cause) {
      throw new LaunchwrightError('qa.results.invalid', `${path}:${i + 1} is not JSON`, { cause, context: { path, line: i + 1 } });
    }
    if (!isObject(parsed) || typeof parsed.row !== 'string' || typeof parsed.leg !== 'string' || typeof parsed.status !== 'string' || !Array.isArray(parsed.failures)) {
      throw new LaunchwrightError('qa.results.invalid', `${path}:${i + 1} is not a row result`, { context: { path, line: i + 1 } });
    }
    out.push(parsed as unknown as RowResult);
  });
  return out;
}

/** Adds one row result line. */
export async function appendResult(path: string, result: RowResult): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(result)}\n`, { flag: 'a' });
}

/** The last result of each row and leg, keyed `<row>\u0000<leg>`. */
export function latestResults(results: readonly RowResult[]): Map<string, RowResult> {
  const out = new Map<string, RowResult>();
  for (const r of results) out.set(pairKey(r.row, r.leg), r);
  return out;
}

export const pairKey = (row: string, leg: string): string => `${row}\u0000${leg}`;
