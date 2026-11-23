import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { featuresWithoutWorld, loadRegistry, rawSqlFindings, worldFiles, worldLintFindings } from '../../../../src/world/services/discover.mts';

async function put(root: string, file: string, text: string): Promise<void> {
  await mkdir(dirname(join(root, file)), { recursive: true });
  await writeFile(join(root, file), text);
}

const WORLD = `export default {
  personas: [{ id: 'member', summary: 'A member', seed: async () => ({ userId: 'u1' }) }],
  facts: [{ id: 'shelf.empty', summary: 'No item', handleKeys: ['shelfId'], seed: async () => ({ shelfId: 's' }) }],
};
`;

describe('world file discovery', () => {
  it('finds world files by suffix and skips node_modules and dot folders', async () => {
    const root = await tmpDir();
    await put(root, 'apps/api/src/telegram/start.world.mts', WORLD);
    await put(root, 'qa/members.world.mts', WORLD);
    await put(root, 'node_modules/pkg/x.world.mts', WORLD);
    await put(root, '.lw/qa/old.world.mts', WORLD);
    expect(await worldFiles(root)).toEqual(['apps/api/src/telegram/start.world.mts', 'qa/members.world.mts']);
  });

  it('loads each world with the feature of its file name', async () => {
    const root = await tmpDir();
    await put(root, 'qa/members.world.mts', WORLD);
    const registry = await loadRegistry(root);
    expect(registry.personas.map((p) => [p.id, p.feature, p.file])).toEqual([['member', 'members', 'qa/members.world.mts']]);
    expect(registry.facts.map((f) => f.id)).toEqual(['shelf.empty']);
  });

  it('refuses a world file without a world as default export', async () => {
    const root = await tmpDir();
    await put(root, 'qa/bad.world.mts', 'export default 42;\n');
    await expect(loadRegistry(root)).rejects.toMatchObject({ code: 'qa.world.file' });
  });
});

describe('world lint for lw qa check', () => {
  it('finds raw SQL in a seed with its line', () => {
    const text = ["import { sql } from 'drizzle-orm';", 'const a = 1;', 'await db.execute(sql`delete from x`);', 'await ctx.app.get(USERS).create(t, {});'].join('\n');
    expect(rawSqlFindings('qa/x.world.mts', text).map((f) => [f.line, f.rule])).toEqual([
      [1, 'world.raw-sql'],
      [3, 'world.raw-sql'],
    ]);
  });

  it('reports the raw SQL of every world file of the project', async () => {
    const root = await tmpDir();
    await put(root, 'qa/clean.world.mts', WORLD);
    await put(root, 'qa/raw.world.mts', 'await db.execute(sql`truncate users`);\n');
    expect((await worldLintFindings(root)).map((f) => f.file)).toEqual(['qa/raw.world.mts']);
  });

  it('lists the feature files that have no world file beside them', async () => {
    const root = await tmpDir();
    await put(root, 'apps/api/src/telegram/start.feature.mts', 'export default {};\n');
    await put(root, 'apps/api/src/telegram/start.world.mts', WORLD);
    await put(root, 'apps/api/src/telegram/menu.feature.mts', 'export default {};\n');
    expect(await featuresWithoutWorld(root)).toEqual(['apps/api/src/telegram/menu.feature.mts']);
  });
});
