// Finds the `<feature>.world.mts` files of a project by suffix (main spec 2.24.3), loads them, and
// gives the lint findings that `lw qa check` reports for them (spec 2.5.1, 2.14 rule S1).
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LaunchwrightError, messageOf } from '@launchwrighthq/kernel';
import { buildRegistry, type LoadedWorld } from './registry.mts';
import type { FeatureWorld, WorldRegistry } from './types.mts';

export const WORLD_SUFFIX = '.world.mts';
export const FEATURE_SUFFIX = '.feature.mts';

/** Folders that never hold project source. A folder whose name starts with `.` is skipped too. */
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage']);

async function walk(root: string, dir: string, suffix: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw new LaunchwrightError('qa.world.walk', `Cannot read folder ${dir}.`, { cause, context: { dir } });
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(root, path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(relative(root, path).split(sep).join('/'));
  }
}

/** The files of the project with this suffix, relative to the root with `/`, sorted. */
async function filesWithSuffix(root: string, suffix: string): Promise<string[]> {
  const out: string[] = [];
  await walk(root, root, suffix, out);
  return out.sort();
}

/** Every `<feature>.world.mts` of the project. `lw qa check` lints each one. */
export function worldFiles(root: string): Promise<string[]> {
  return filesWithSuffix(root, WORLD_SUFFIX);
}

function isWorld(value: unknown): value is FeatureWorld {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const w = value as Record<string, unknown>;
  return (w.personas === undefined || Array.isArray(w.personas)) && (w.facts === undefined || Array.isArray(w.facts));
}

/** Imports each world file. Throws `qa.world.file` for a file whose default export is not a world. */
export async function loadWorlds(root: string): Promise<LoadedWorld[]> {
  const out: LoadedWorld[] = [];
  for (const file of await worldFiles(root)) {
    let mod: { default?: unknown };
    try {
      mod = (await import(pathToFileURL(join(root, file)).href)) as { default?: unknown };
    } catch (cause) {
      throw new LaunchwrightError('qa.world.file', `Cannot load world file ${file}: ${messageOf(cause)}`, { cause, context: { file } });
    }
    if (!isWorld(mod.default)) {
      throw new LaunchwrightError('qa.world.file', `${file} needs a default export defineWorld({ personas, facts }).`, { context: { file } });
    }
    out.push({ feature: basename(file, WORLD_SUFFIX), file, world: mod.default });
  }
  return out;
}

/** The registry of the project's world files. */
export async function loadRegistry(root: string): Promise<WorldRegistry> {
  return buildRegistry(await loadWorlds(root));
}

/** One lint finding of a world file. */
export interface WorldFinding {
  file: string;
  line: number;
  rule: 'world.raw-sql';
  message: string;
}

const RAW_SQL: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\bsql\s*`/, what: 'a sql template' },
  { pattern: /\bsql\.(raw|join|identifier)\s*\(/, what: 'a sql helper' },
  { pattern: /\.execute\s*[<(]/, what: 'an execute() call' },
  { pattern: /import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/, what: 'an import of sql from drizzle-orm' },
];

/** The raw SQL in the text of one world file. A seed writes through the app's own services (spec 2.5.1). */
export function rawSqlFindings(file: string, text: string): WorldFinding[] {
  const out: WorldFinding[] = [];
  text.split('\n').forEach((line, i) => {
    for (const { pattern, what } of RAW_SQL) {
      if (pattern.test(line)) {
        out.push({ file, line: i + 1, rule: 'world.raw-sql', message: `${what}: a seed calls the services of ctx.app, never raw SQL` });
        break;
      }
    }
  });
  return out;
}

/** The raw SQL findings of every world file of the project. */
export async function worldLintFindings(root: string): Promise<WorldFinding[]> {
  const out: WorldFinding[] = [];
  for (const file of await worldFiles(root)) out.push(...rawSqlFindings(file, await readFile(join(root, file), 'utf8')));
  return out;
}

/**
 * The `.feature.mts` files that have no `.world.mts` beside them. `lw qa check` fails each one
 * that has a client route (spec 2.5.1); it decides which ones do.
 */
export async function featuresWithoutWorld(root: string): Promise<string[]> {
  const worlds = new Set(await worldFiles(root));
  return (await filesWithSuffix(root, FEATURE_SUFFIX)).filter((f) => {
    const world = join(dirname(f), `${basename(f, FEATURE_SUFFIX)}${WORLD_SUFFIX}`).split(sep).join('/');
    return !worlds.has(world);
  });
}
