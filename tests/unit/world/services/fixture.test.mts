import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createApp } from '../../../../src/kernel/index.mts';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import type { QaWorld } from '../../../../src/world/services/app.mts';
import { armFact, disarmFact, readUndo, UNDO_FILE } from '../../../../src/world/services/fixture.mts';
import type { WorldRegistry } from '../../../../src/world/services/types.mts';
import { writeJson } from '../../../../src/world/services/world.mts';

/** A fact whose state is a counter, with one undo step per change. */
function counterWorld(): { registry: WorldRegistry; state: { items: number; personas: string[] } } {
  const state = { items: 3, personas: [] as string[] };
  const registry: WorldRegistry = {
    personas: [{ id: 'member', summary: 'A member', feature: 'm', file: 'm.world.mts', seed: async () => ({ userId: 'u1' }) }],
    facts: [
      {
        id: 'shelf.empty',
        summary: 'No item',
        handleKeys: [],
        feature: 'shelf',
        file: 'shelf.world.mts',
        seed: async () => ({}),
        async arm(ctx) {
          await ctx.record({ items: state.items });
          state.items = 0;
          await ctx.record({ persona: ctx.persona?.persona ?? null });
          if (ctx.persona) state.personas.push(ctx.persona.accountId);
        },
        async undo(_ctx, step) {
          const s = step as { items?: number; persona?: string | null };
          if (s.items !== undefined) state.items = s.items;
          if (s.persona) state.personas.pop();
        },
      },
      { id: 'shelf.full', summary: 'Many items', handleKeys: [], feature: 'shelf', file: 'shelf.world.mts', seed: async () => ({}) },
    ],
  };
  return { registry, state };
}

function world(database = 'app_qa'): QaWorld {
  const app = createApp({ providers: [], config: {} });
  return { app, tenantId: 't', database, sections: {}, close: () => app.shutdown() };
}

describe('lw qa fixture', () => {
  it('writes the undo steps of an armed fact and replays them in reverse on disarm', async () => {
    const root = await tmpDir();
    const { registry, state } = counterWorld();
    const armed = await armFact(world(), registry, root, 'shelf.empty', { persona: 'member' });
    expect(state).toEqual({ items: 0, personas: ['qa:member'] });
    expect(armed).toEqual({ fact: 'shelf.empty', persona: 'member', steps: [{ items: 3 }, { persona: 'member' }] });
    expect(JSON.parse(await readFile(join(root, UNDO_FILE), 'utf8'))).toEqual({ database: 'app_qa', armed: [armed] });
    expect(await disarmFact(world(), registry, root)).toEqual(['shelf.empty']);
    expect(state).toEqual({ items: 3, personas: [] });
    expect(await readUndo(root, 'app_qa')).toEqual({ database: 'app_qa', armed: [] });
  });

  it('keeps the undo step that was written before an arm failed', async () => {
    const root = await tmpDir();
    const { registry, state } = counterWorld();
    const failing: WorldRegistry = {
      ...registry,
      facts: registry.facts.map((f) =>
        f.id === 'shelf.empty'
          ? {
              ...f,
              async arm(ctx) {
                await ctx.record({ items: state.items });
                state.items = 0;
                throw new Error('the write failed');
              },
            }
          : f,
      ),
    };
    await expect(armFact(world(), failing, root, 'shelf.empty')).rejects.toThrow('the write failed');
    expect((await readUndo(root, 'app_qa')).armed).toEqual([{ fact: 'shelf.empty', steps: [{ items: 3 }] }]);
    await disarmFact(world(), registry, root);
    expect(state.items).toBe(3);
  });

  it('refuses a fact that is armed already, a fact without arm, and an unknown persona', async () => {
    const root = await tmpDir();
    const { registry } = counterWorld();
    await armFact(world(), registry, root, 'shelf.empty');
    await expect(armFact(world(), registry, root, 'shelf.empty')).rejects.toMatchObject({ code: 'qa.fixture.armed' });
    await expect(armFact(world(), registry, root, 'shelf.full')).rejects.toMatchObject({ code: 'qa.fixture.no-arm' });
    await expect(armFact(world(), registry, root, 'shelf.empty', { persona: 'nobody' })).rejects.toMatchObject({ code: 'qa.world.persona' });
  });

  it('refuses to disarm facts that were armed on another database', async () => {
    const root = await tmpDir();
    const { registry } = counterWorld();
    await writeJson(join(root, UNDO_FILE), { database: 'app', armed: [{ fact: 'shelf.empty', steps: [{ items: 1 }] }] });
    await expect(disarmFact(world('app_qa'), registry, root)).rejects.toMatchObject({ code: 'qa.fixture.database' });
  });

  it('answers nothing armed when the record is empty', async () => {
    const root = await tmpDir();
    expect(await disarmFact(world(), counterWorld().registry, root)).toEqual([]);
  });
});
