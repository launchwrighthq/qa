// A project folder with one installed qa extension package, `@launchwrighthq/qa-probe`. Its
// subcommand `probe` prints the names of the targets it receives; its one target is `probe-phone`.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../src/kernel/testing/index.mts';

const INDEX = `export const qaExtension = {
  name: 'qa-probe',
  subcommands: {
    probe: async () => ({
      name: 'probe',
      summary: 'prints the targets it receives',
      run: async (args, opts) => {
        opts.out(['probe', ...args, ...Object.keys(opts.targets ?? {}).sort()].join(' '));
        return 0;
      },
    }),
  },
  targets: (config, root) => ({ 'probe-phone': { name: 'probe-phone', reportDir: config.reportDir, root } }),
};
`;

/** A project root with `node_modules/@launchwrighthq/qa-probe` and, with `bare`, a package without `qaExtension`. */
export async function extensionProject(opts: { bare?: boolean } = {}): Promise<string> {
  const root = await tmpDir();
  const dir = join(root, 'node_modules', '@launchwrighthq', 'qa-probe');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@launchwrighthq/qa-probe', type: 'module', exports: { '.': './index.mjs' } }));
  await writeFile(join(dir, 'index.mjs'), opts.bare ? 'export const other = 1;\n' : INDEX);
  return root;
}
