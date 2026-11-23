// The text files of the library tree that the guards scan: every folder and root file the package
// ships or the repository holds, without `node_modules`, `dist` and binary fixtures.
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIBRARY_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const FOLDERS = ['src', 'tests', 'fixtures', 'harness', 'assets', 'bin'];
const ROOT_FILES = ['README.md', 'harness.toml', 'package.json', 'tsconfig.json', 'tsup.config.ts', 'vitest.config.ts'];

/** Binary fixtures: their bytes are not prose or code. */
const BINARY = new Set(['.png', '.mp4', '.webm', '.zip', '.jpg', '.jpeg', '.gif', '.webp']);

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.lw') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.isFile() && !BINARY.has(extname(entry.name).toLowerCase())) out.push(path);
  }
  return out;
}

/** The absolute paths of the text files under `folders` (default: the whole library tree). */
export function libraryFiles(folders: readonly string[] = FOLDERS): string[] {
  const files = folders.flatMap((folder) => walk(join(LIBRARY_ROOT, folder), []));
  return folders === FOLDERS ? [...files, ...ROOT_FILES.map((name) => join(LIBRARY_ROOT, name))] : files;
}
