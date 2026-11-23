import { existsSync } from 'node:fs';
import { LaunchwrightError } from './errors.mts';

/**
 * The URL of `fixtures/<relative>` of the package that holds the source file `from` (pass
 * `import.meta.url`). The search walks up from the file to the first folder whose `fixtures/`
 * holds the file, and stops one folder above the nearest package.json. So it finds the file from
 * `src/<area>/` (two or three folders down), from a `dist/` chunk (one folder down) and in the
 * framework layout, where `fixtures/` sits next to `ts/`. When no folder holds it, the path in the
 * folder of the nearest package.json comes back, so a read error names where the file belongs.
 * URL arithmetic only: an edge bundle of the kernel resolves `node:fs` and no `node:url`.
 */
export function moduleFixture(from: string | URL, relative: string): URL {
  let dir = new URL('.', from);
  let pkg: URL | undefined;
  for (;;) {
    const candidate = new URL(`fixtures/${relative}`, dir);
    if (existsSync(candidate)) return candidate;
    const parent = new URL('..', dir);
    if (pkg !== undefined || parent.href === dir.href) break;
    if (existsSync(new URL('package.json', dir))) pkg = dir;
    dir = parent;
  }
  if (pkg === undefined) {
    throw new LaunchwrightError('kernel.fixture.package', `No package.json is above ${String(from)}, so its fixtures/ folder is unknown.`, {
      context: { file: String(from) },
    });
  }
  return new URL(`fixtures/${relative}`, pkg);
}
