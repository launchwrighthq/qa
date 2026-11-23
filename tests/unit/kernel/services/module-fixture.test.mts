import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { moduleFixture } from '../../../../src/kernel/index.mts';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';

async function put(root: string, rel: string, text = ''): Promise<void> {
  await mkdir(dirname(join(root, rel)), { recursive: true });
  await writeFile(join(root, rel), text);
}

const CASES = 'contract/target.cases.json';

describe('moduleFixture', () => {
  it('finds the package fixtures from a source folder and from a dist chunk', async () => {
    const root = await tmpDir();
    await put(root, 'package.json', '{}');
    await put(root, `fixtures/${CASES}`, '{}');
    const expected = pathToFileURL(join(root, 'fixtures', CASES)).href;
    expect(moduleFixture(pathToFileURL(join(root, 'src/testing/target-contract.mts')), CASES).href).toBe(expected);
    expect(moduleFixture(pathToFileURL(join(root, 'dist/testing.js')), CASES).href).toBe(expected);
  });

  it('finds fixtures next to ts/ in the framework layout', async () => {
    const root = await tmpDir();
    await put(root, 'ts/package.json', '{}');
    await put(root, `fixtures/${CASES}`, '{}');
    expect(moduleFixture(pathToFileURL(join(root, 'ts/src/testing/x.mts')), CASES).href).toBe(pathToFileURL(join(root, 'fixtures', CASES)).href);
  });

  it('names the path in the package folder when no folder holds the file, and stops above the package', async () => {
    const root = await tmpDir();
    await put(root, `outer/fixtures/${CASES}`, '{}');
    await put(root, 'outer/inner/pkg/package.json', '{}');
    const url = moduleFixture(pathToFileURL(join(root, 'outer/inner/pkg/dist/testing.js')), CASES);
    expect(url.href).toBe(pathToFileURL(join(root, 'outer/inner/pkg/fixtures', CASES)).href);
  });
});
