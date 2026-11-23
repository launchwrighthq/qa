import { existsSync } from 'node:fs';
import { LaunchwrightError } from './errors.mts';

/**
 * The URL of `fixtures/<relative>` of the module that holds the source file `from` (pass
 * `import.meta.url`). A published package carries the file in its own folder
 * (`<package>/fixtures/`, written by `tools/release/pack.mjs` from the `launchwright.fixtures`
 * list of its package.json). In the framework repo, `fixtures/` sits next to `ts/`. When neither
 * holds the file, the package path comes back, so a read error names where the file belongs.
 * URL arithmetic only: an edge bundle of the kernel resolves `node:fs` and no `node:url`.
 */
export function moduleFixture(from: string | URL, relative: string): URL {
  let pkg = new URL('.', from);
  while (!existsSync(new URL('package.json', pkg))) {
    const parent = new URL('..', pkg);
    if (parent.href === pkg.href) {
      throw new LaunchwrightError('kernel.fixture.package', `No package.json is above ${String(from)}, so its fixtures/ folder is unknown.`, {
        context: { file: String(from) },
      });
    }
    pkg = parent;
  }
  const published = new URL(`fixtures/${relative}`, pkg);
  const repo = new URL(`../fixtures/${relative}`, pkg);
  return existsSync(published) || !existsSync(repo) ? published : repo;
}
