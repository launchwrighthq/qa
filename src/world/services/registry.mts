// The registry of personas and facts, and its checks (ported from the source `registryProblem`).
// The registry is the denominator of a QA report: every state that a feature declares is here.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { sha256 } from '@launchwrighthq/kernel/fs';
import { idProblem, qaTelegramId } from './ids.mts';
import type { Fact, FeatureWorld, Owned, Persona, WorldEntry, WorldRegistry } from './types.mts';

/** The default export of a `<feature>.world.mts` file. It returns the world as it is. */
export function defineWorld(world: FeatureWorld): FeatureWorld {
  return world;
}

/** One loaded world file. */
export interface LoadedWorld {
  /** The feature: the file name without `.world.mts`. */
  feature: string;
  /** The path relative to the project root. */
  file: string;
  world: FeatureWorld;
}

/** The registry of the loaded world files, in file order. Facts seed before personas. */
export function buildRegistry(worlds: readonly LoadedWorld[]): WorldRegistry {
  const own = <T,>(w: LoadedWorld, items: readonly T[] | undefined): Owned<T>[] => (items ?? []).map((item) => ({ ...item, feature: w.feature, file: w.file }));
  return {
    personas: worlds.flatMap((w) => own<Persona>(w, w.world.personas)),
    facts: worlds.flatMap((w) => own<Fact>(w, w.world.facts)),
  };
}

/**
 * Why the registry cannot be seeded, or null. An empty registry, a duplicate id, an id that is
 * not kebab case or dotted, a blank summary, a bad handle key and two personas with one Telegram
 * id each give a wrong or unreadable shot, so each one is a refusal.
 */
export function registryProblem(registry: WorldRegistry): string | null {
  if (registry.personas.length === 0) return 'no world file declares a persona, so there is no user to be';
  if (registry.facts.length === 0) return 'no world file declares a fact, so there is no state to address';
  const seen = new Map<string, string>();
  for (const entry of [...registry.personas, ...registry.facts]) {
    if (typeof entry.id !== 'string') return `an entry of ${entry.file} has no id`;
    const bad = idProblem(entry.id);
    if (bad) return `${bad} (${entry.file})`;
    const other = seen.get(entry.id);
    if (other !== undefined) return `duplicate id ${entry.id} in ${other} and ${entry.file}`;
    seen.set(entry.id, entry.file);
    if (typeof entry.summary !== 'string' || entry.summary.trim() === '') return `${entry.id} has no summary, so its report row is blank`;
    if (typeof entry.seed !== 'function') return `${entry.id} has no seed function`;
  }
  for (const fact of registry.facts) {
    if (!Array.isArray(fact.handleKeys)) return `${fact.id} declares no handleKeys; write [] when it has none`;
    for (const key of fact.handleKeys as readonly unknown[]) {
      if (typeof key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) return `${fact.id} declares handle key "${String(key)}", which cannot name a route parameter`;
    }
    if ((fact.arm === undefined) !== (fact.undo === undefined)) return `${fact.id} declares only one of arm and undo; an armed fact needs both`;
  }
  const ids = new Map<number, string>();
  for (const persona of registry.personas) {
    const tid = qaTelegramId(persona.id);
    const clash = ids.get(tid);
    if (clash !== undefined) return `${persona.id} and ${clash} both map to Telegram id ${tid}`;
    ids.set(tid, persona.id);
  }
  return null;
}

/** Throws `qa.world.registry` when the registry cannot be seeded. */
export function assertRegistry(registry: WorldRegistry): void {
  const problem = registryProblem(registry);
  if (problem) throw new LaunchwrightError('qa.world.registry', `The QA world cannot be seeded: ${problem}.`, { context: { problem } });
}

/** The registry as plain data. */
export function listWorld(registry: WorldRegistry): WorldEntry[] {
  return [
    ...registry.personas.map((p) => ({ kind: 'persona' as const, id: p.id, summary: p.summary, feature: p.feature })),
    ...registry.facts.map((f) => ({ kind: 'fact' as const, id: f.id, summary: f.summary, feature: f.feature, handleKeys: [...f.handleKeys] })),
  ];
}

/**
 * The fingerprint of the registry: 12 hex of SHA-256 over the sorted kind, id, feature and
 * summary of each entry. A changed summary makes the world stale, because a report prints the
 * live summary beside a shot of the seeded world.
 */
export function registryHash(entries: readonly WorldEntry[]): string {
  const lines = entries.map((e) => `${e.kind}\t${e.id}\t${e.feature}\t${e.summary}`).sort();
  return sha256(lines.join('\n')).slice(0, 12);
}

/** The persona with this id. Throws `qa.world.persona` for an unknown id: an unknown persona is never a fallback user. */
export function personaById(registry: WorldRegistry, id: string): Owned<Persona> {
  const found = registry.personas.find((p) => p.id === id);
  if (!found) throw new LaunchwrightError('qa.world.persona', `No world file declares persona ${id}. Run lw qa world list.`, { context: { persona: id } });
  return found;
}

/** The fact with this id. Throws `qa.world.fact` for an unknown id. */
export function factById(registry: WorldRegistry, id: string): Owned<Fact> {
  const found = registry.facts.find((f) => f.id === id);
  if (!found) throw new LaunchwrightError('qa.world.fact', `No world file declares fact ${id}. Run lw qa world list.`, { context: { fact: id } });
  return found;
}
