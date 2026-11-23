import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaCommand } from '../../../src/commands/qa.command.mts';

const WORLD = `export default {
  personas: [{ id: 'member', summary: 'A member', seed: async () => ({ userId: 'u1' }) }],
  facts: [{ id: 'shelf.empty', summary: 'No item', handleKeys: ['shelfId'], seed: async () => ({ shelfId: 's' }) }],
};
`;

async function lw(args: string[], root: string, config: Record<string, unknown> = {}): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await qaCommand.run(args, { cwd: root, out: (l) => out.push(l), err: (l) => err.push(l), config });
  return { code, out, err };
}

async function projectWithWorld(): Promise<string> {
  const root = await tmpDir();
  await mkdir(join(root, 'qa'), { recursive: true });
  await writeFile(join(root, 'qa/members.world.mts'), WORLD);
  return root;
}

describe('lw qa world', () => {
  it('prints the registry as JSON with its hash', async () => {
    const root = await projectWithWorld();
    const { code, out } = await lw(['world', 'list', '--json'], root);
    expect(code).toBe(0);
    const data = JSON.parse(out.join('\n')) as { hash: string; problem: null; entries: Array<{ id: string; feature: string }> };
    expect(data.problem).toBeNull();
    expect(data.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(data.entries.map((e) => [e.id, e.feature])).toEqual([
      ['member', 'members'],
      ['shelf.empty', 'members'],
    ]);
  });

  it('exits 1 for a registry that cannot be seeded', async () => {
    const root = await tmpDir();
    const { code, out } = await lw(['world', '--list'], root);
    expect(code).toBe(1);
    expect(out.at(-1)).toMatch(/not seedable: no world file declares a persona/);
  });

  it('reports a missing QA database with exit 1 on status', async () => {
    const root = await projectWithWorld();
    const { code, out } = await lw(['world', 'status', '--json'], root, { db: { driver: 'pglite' }, qa: { database: 'shop_qa' } });
    expect(code).toBe(1);
    expect(JSON.parse(out.join('\n'))).toMatchObject({ database: 'shop_qa', exists: false, state: 'missing' });
  });

  it('names the error code when the dev database is not on this machine', async () => {
    const root = await projectWithWorld();
    const { code, err } = await lw(['world', 'status'], root, { db: { url: 'postgres://lw@db.example.com/shop' }, qa: { database: 'shop_qa' } });
    expect(code).toBe(1);
    expect(err.join('\n')).toMatch(/host db\.example\.com is not this machine.+\(qa\.stack\.target\)$/);
  });

  it('prints the usage with exit 2 for an unknown subcommand', async () => {
    const root = await tmpDir();
    expect((await lw(['world', 'grow'], root)).code).toBe(2);
    expect((await lw(['fixture'], root)).code).toBe(2);
    expect((await lw(['job', 'start'], root)).code).toBe(2);
    expect((await lw(['worktree', 'extra'], root)).code).toBe(2);
  });
});
