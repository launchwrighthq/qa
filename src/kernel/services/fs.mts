import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { parse as parseToml } from 'smol-toml';
import { LaunchwrightError } from './errors.mts';

/** The error codes of a path that does not exist: no entry, or a part of the path that is a file. */
const MISSING: ReadonlySet<string> = new Set(['ENOENT', 'ENOTDIR']);

export type PathKind = 'file' | 'dir' | 'missing';

function isMissing(err: unknown): boolean {
  return MISSING.has(String((err as { code?: unknown } | null)?.code));
}

function readError(path: string, cause: unknown): LaunchwrightError {
  return new LaunchwrightError('kernel.fs.read', `Cannot read ${path}`, { cause, context: { path } });
}

/** `file`, `dir`, or `missing` when nothing is at `path`. Any other error throws `kernel.fs.read`. */
export async function pathKind(path: string): Promise<PathKind> {
  try {
    return (await stat(path)).isDirectory() ? 'dir' : 'file';
  } catch (cause) {
    if (isMissing(cause)) return 'missing';
    throw readError(path, cause);
  }
}

/** The blocking form of `pathKind`. */
export function pathKindSync(path: string): PathKind {
  try {
    return statSync(path).isDirectory() ? 'dir' : 'file';
  } catch (cause) {
    if (isMissing(cause)) return 'missing';
    throw readError(path, cause);
  }
}

/** The UTF-8 text of a file, or null when it does not exist. Any other error throws `kernel.fs.read`. */
export async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (cause) {
    if (isMissing(cause)) return null;
    throw readError(path, cause);
  }
}

/** The blocking form of `readTextOrNull`. */
export function readTextOrNullSync(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    if (isMissing(cause)) return null;
    throw readError(path, cause);
  }
}

/** The parsed JSON of a file, or null when it does not exist. Text that is not JSON throws `kernel.fs.json`. */
export async function readJsonOrNull(path: string): Promise<unknown> {
  const text = await readTextOrNull(path);
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new LaunchwrightError('kernel.fs.json', `${path} is not valid JSON`, { cause, context: { path } });
  }
}

/** The parsed TOML of a file, or null when it does not exist. Text that is not TOML throws `kernel.fs.toml`. */
export async function readTomlOrNull(path: string): Promise<Record<string, unknown> | null> {
  const text = await readTextOrNull(path);
  if (text === null) return null;
  try {
    return parseToml(text) as Record<string, unknown>;
  } catch (cause) {
    throw new LaunchwrightError('kernel.fs.toml', `${path} is not valid TOML`, { cause, context: { path } });
  }
}

/** The SHA-256 of text (as UTF-8) or bytes, as lower-case hex. */
export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** The SHA-256 of a file as lower-case hex, read as a stream. A failed read throws `kernel.fs.read`. */
export async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  try {
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  } catch (cause) {
    throw readError(path, cause);
  }
  return hash.digest('hex');
}
