import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LaunchwrightError } from './errors.mts';

/**
 * The conditions of the Node ESM resolver. A tool that loads a package of a project with `import()`
 * must reach the file that an `import` in the project code reaches. A package with `import` and
 * `require` builds (the compiled kernel and llm) otherwise loads twice, with two sets of tokens.
 */
const IMPORT_CONDITIONS = new Set(['node', 'import', 'module-sync', 'default']);

/** The path of an `exports` target under the ESM conditions, as Node picks it, or undefined. */
function exportTarget(target: unknown): string | undefined {
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) {
    for (const item of target) {
      const found = exportTarget(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (target === null || typeof target !== 'object') return undefined;
  for (const [condition, value] of Object.entries(target)) {
    if (!IMPORT_CONDITIONS.has(condition)) continue;
    const found = exportTarget(value);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The folder of package `name` in `node_modules` of `root` or of a parent folder, or undefined. */
function packageFolder(root: string, name: string): string | undefined {
  for (let dir = root; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) return undefined;
  }
}

/** The file at `base`, else `base.js`, else `base/index.js`, as `require` finds it, or undefined. */
function fileAt(base: string): string | undefined {
  for (const path of [base, `${base}.js`, join(base, 'index.js')]) if (statSync(path, { throwIfNoEntry: false })?.isFile()) return path;
  return undefined;
}

/**
 * The real path of the file that `import '<specifier>'` loads in the project folder `root`: the
 * package from `node_modules` of `root` or a parent, then its `exports` entry under the ESM
 * conditions (`import`, `node`, `module-sync`, `default`), or `main` for a package without
 * `exports`. `specifier` is a bare package specifier, such as `@launchwrighthq/llm/schema`.
 * Throws `kernel.resolve.failed` with `context.specifier` and `context.root`.
 */
export function resolveImport(specifier: string, root: string): string {
  const fail = (reason: string, cause?: unknown): LaunchwrightError =>
    new LaunchwrightError('kernel.resolve.failed', `Cannot resolve ${specifier} from ${root}: ${reason}.`, { ...(cause === undefined ? {} : { cause }), context: { specifier, root } });
  const parts = specifier.split('/');
  const size = specifier.startsWith('@') ? 2 : 1;
  const name = parts.slice(0, size).join('/');
  const subpath = ['.', ...parts.slice(size)].join('/');
  const dir = packageFolder(root, name);
  if (dir === undefined) throw fail(`package ${name} is not installed`);
  let manifest: { exports?: unknown; main?: unknown };
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { exports?: unknown; main?: unknown };
  } catch (cause) {
    throw fail(`${join(dir, 'package.json')} is not valid JSON`, cause);
  }
  let target: string | undefined;
  if (manifest.exports === undefined) {
    target = fileAt(join(dir, subpath === '.' ? (typeof manifest.main === 'string' ? manifest.main : 'index.js') : subpath));
  } else {
    const map = manifest.exports;
    const bySubpath = map !== null && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).some((k) => k.startsWith('.'));
    const entry = bySubpath ? (map as Record<string, unknown>)[subpath] : subpath === '.' ? map : undefined;
    const path = exportTarget(entry);
    if (path === undefined) throw fail(`package ${name} exports no ${subpath} for import`);
    const file = join(dir, path);
    target = statSync(file, { throwIfNoEntry: false })?.isFile() ? file : undefined;
  }
  if (target === undefined) throw fail(`${subpath} of package ${name} names a file that does not exist`);
  return realpathSync(target);
}
