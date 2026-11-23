import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import sweep from '../../../src/commands/qa-sweep.mts';

async function project(world: unknown) {
  const cwd = await tmpDir();
  writeFileSync(join(cwd, 'world.json'), JSON.stringify(world));
  writeFileSync(
    join(cwd, 'delivery.json'),
    JSON.stringify({ unions: [{ anchor: 'apps/client/src/features/cart/state.mts', routes: [{ surface: 'web', route: '/cart', page: 'apps/client/src/pages/cart.page.tsx', distance: 0, reaches: 1 }] }] }),
  );
  const out: string[] = [];
  const err: string[] = [];
  return { cwd, out, err, opts: { cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l) } };
}

const world = [
  { kind: 'persona', id: 'shopper', summary: 'A shopper with a full cart', feature: 'cart' },
  { kind: 'fact', id: 'orders.late', summary: 'A late order', feature: 'orders' },
];

describe('lw qa sweep plan', () => {
  it('writes a plan that the runner accepts and prints the summary', async () => {
    const p = await project(world);
    expect(await sweep.run(['plan', '--world', 'world.json', '--delivery', 'delivery.json', '--out', 'docs/qa/2026-11-12-sweep.shots.json'], p.opts)).toBe(0);
    const plan = JSON.parse(readFileSync(join(p.cwd, 'docs/qa/2026-11-12-sweep.shots.json'), 'utf8')) as { shots: Array<{ id: string }> };
    expect(plan.shots.map((s) => s.id)).toEqual(['cart.shopper']);
    expect(p.out.join('\n')).toContain('owed:  1 state(s)');
  });

  it('exits 1 with --strict when a state is owed', async () => {
    const p = await project(world);
    expect(await sweep.run(['plan', '--world', 'world.json', '--delivery', 'delivery.json', '--strict'], p.opts)).toBe(1);
  });

  it('exits 1 for a world file that is not world output, and 2 without --world', async () => {
    const p = await project({ nothing: true });
    expect(await sweep.run(['plan', '--world', 'world.json', '--delivery', 'delivery.json'], p.opts)).toBe(1);
    expect(p.err[0]).toContain('not `lw qa world list --json` output');
    expect(await sweep.run(['plan', '--delivery', 'delivery.json'], p.opts)).toBe(2);
  });
});
