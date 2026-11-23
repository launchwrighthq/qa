import { describe, expect, it } from 'vitest';
import { personaIds, qaAccountId, qaTelegramId } from '../../../../src/world/services/ids.mts';
import { assertRegistry, buildRegistry, defineWorld, listWorld, personaById, registryHash, registryProblem } from '../../../../src/world/services/registry.mts';
import type { Fact, Persona, WorldRegistry } from '../../../../src/world/services/types.mts';

const persona = (id: string, summary = `User ${id}`): Persona => ({ id, summary, seed: async () => ({ userId: id }) });
const fact = (id: string, handleKeys: readonly string[] = ['shelfId']): Fact => ({ id, summary: `Fact ${id}`, handleKeys, seed: async () => ({ shelfId: 1 }) });

function registry(personas: Persona[], facts: Fact[]): WorldRegistry {
  return buildRegistry([{ feature: 'shelf', file: 'apps/api/src/shelf.world.mts', world: defineWorld({ personas, facts }) }]);
}

describe('persona ids', () => {
  it('pins the Telegram id of each persona to the FNV-1a block', () => {
    expect(qaTelegramId('member')).toBe(900708611);
    expect(qaTelegramId('member-expiring')).toBe(900518806);
    expect(qaTelegramId('guest')).toBe(900756659);
  });

  it('gives the account id qa:<persona> with the Telegram id', () => {
    expect(qaAccountId('member')).toBe('qa:member');
    expect(personaIds('guest')).toEqual({ persona: 'guest', accountId: 'qa:guest', telegramId: 900756659 });
  });
});

describe('registryProblem', () => {
  it('accepts a registry with kebab and dotted ids', () => {
    expect(registryProblem(registry([persona('member-expiring')], [fact('catalog.empty-shelf')]))).toBeNull();
  });

  it('refuses an empty registry', () => {
    expect(registryProblem(registry([], [fact('a')]))).toMatch(/no world file declares a persona/);
    expect(registryProblem(registry([persona('a')], []))).toMatch(/no world file declares a fact/);
  });

  it('refuses a duplicate id across personas and facts', () => {
    expect(registryProblem(registry([persona('same')], [fact('same')]))).toMatch(/duplicate id same/);
  });

  it('refuses an id that is not kebab case or dotted', () => {
    expect(registryProblem(registry([persona('Member_One')], [fact('a')]))).toMatch(/not a kebab case or dotted id/);
  });

  it('refuses a blank summary', () => {
    expect(registryProblem(registry([persona('member', '  ')], [fact('a')]))).toMatch(/member has no summary/);
  });

  it('refuses a handle key that cannot name a route parameter', () => {
    expect(registryProblem(registry([persona('member')], [fact('a', ['shelf-id'])]))).toMatch(/handle key "shelf-id"/);
  });

  it('refuses a fact with arm and no undo', () => {
    expect(registryProblem(registry([persona('member')], [{ ...fact('a'), arm: async () => undefined }]))).toMatch(/only one of arm and undo/);
  });

  it('refuses two personas with one Telegram id', () => {
    const ids = new Map<number, string>();
    let pair: [string, string] | undefined;
    for (let i = 0; pair === undefined; i++) {
      const id = `p${i}`;
      const other = ids.get(qaTelegramId(id));
      if (other !== undefined) pair = [other, id];
      ids.set(qaTelegramId(id), id);
    }
    expect(registryProblem(registry([persona(pair[0]), persona(pair[1])], [fact('a')]))).toMatch(/both map to Telegram id/);
  });

  it('throws qa.world.registry from assertRegistry', () => {
    expect(() => assertRegistry(registry([], []))).toThrow(expect.objectContaining({ code: 'qa.world.registry' }));
  });
});

describe('registry data', () => {
  it('lists every entry with its feature and the declared handle keys', () => {
    expect(listWorld(registry([persona('member')], [fact('a')]))).toEqual([
      { kind: 'persona', id: 'member', summary: 'User member', feature: 'shelf' },
      { kind: 'fact', id: 'a', summary: 'Fact a', feature: 'shelf', handleKeys: ['shelfId'] },
    ]);
  });

  it('hashes the registry without regard to the order of entries', () => {
    const a = listWorld(registry([persona('member'), persona('guest')], [fact('a')]));
    const b = listWorld(registry([persona('guest'), persona('member')], [fact('a')]));
    expect(registryHash(a)).toBe(registryHash(b));
    expect(registryHash(a)).toMatch(/^[0-9a-f]{12}$/);
    expect(registryHash(listWorld(registry([persona('member', 'Changed')], [fact('a')])))).not.toBe(registryHash(listWorld(registry([persona('member')], [fact('a')]))));
  });

  it('refuses an unknown persona instead of a fallback user', () => {
    expect(() => personaById(registry([persona('member')], [fact('a')]), 'nobody')).toThrow(expect.objectContaining({ code: 'qa.world.persona' }));
  });
});
