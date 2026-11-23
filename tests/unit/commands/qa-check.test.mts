import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaCommand } from '../../../src/commands/qa.command.mts';

async function project(files: Record<string, string>): Promise<string> {
  const root = await tmpDir();
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), text);
  }
  return root;
}

async function lw(args: string[], root: string, config: Record<string, unknown> = {}): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await qaCommand.run(args, { cwd: root, out: (l) => out.push(l), err: (l) => err.push(l), config });
  return { code, out, err };
}

const CLEAN = {
  'apps/api/src/routes.mts': "export default routes((r) => r.group({ name: 'public' }, (g) => { g.page('/', 'home'); }));",
  'apps/client/src/pages/home.page.tsx': 'export default function Home() { return null; }',
};

describe('lw qa check', () => {
  it('exits 0 and prints no finding for a clean project', async () => {
    const root = await project(CLEAN);
    const { code, out, err } = await lw(['check'], root);
    expect(code).toBe(0);
    expect(out).toEqual([]);
    expect(err).toEqual(['lw qa check: no finding']);
  });

  it('exits 1 on a neither union and prints <rule> <file>:<line> <message>', async () => {
    const root = await project({ ...CLEAN, 'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';\n" });
    const { code, out } = await lw(['check'], root);
    expect(code).toBe(1);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^C1 apps\/client\/src\/menu\.ts:1 MenuPhase is neither/);
  });

  it('exits 1 on raw SQL in a world file', async () => {
    const root = await project({ ...CLEAN, 'qa/shop.world.mts': 'await db.execute(sql`delete from orders`);\n' });
    const { code, out } = await lw(['check'], root);
    expect(code).toBe(1);
    expect(out[0]).toMatch(/^S1 qa\/shop\.world\.mts:1 /);
  });

  it('scans qa.buildDirs and fails a missing build only with --build', async () => {
    const root = await project(CLEAN);
    const config = { qa: { buildDirs: ['web/out'] } };
    expect((await lw(['check'], root, config)).code).toBe(0);
    const built = await lw(['check', '--build'], root, config);
    expect(built.code).toBe(1);
    expect(built.out).toEqual(['S3 web/out:0 the production client build is missing. Build the client, or fix qa.buildDirs.']);
  });

  it('exits 1 with the config error for a client root that is missing', async () => {
    const root = await project({});
    const { code, err } = await lw(['check'], root);
    expect(code).toBe(1);
    expect(err.join('\n')).toContain('qa.states.root');
  });

  it('exits 2 on an unknown argument', async () => {
    const root = await project(CLEAN);
    expect((await lw(['check', '--fix'], root)).code).toBe(2);
  });
});
