/** A failure of a dependency order: a missing item or a cycle. */
export type OrderProblem = { kind: 'missing'; item: string; missing: string } | { kind: 'cycle'; chain: string[] };

/**
 * Orders items so that each item comes after the items it requires.
 * Items without a requirement between them keep their input order.
 * Calls `fail` and throws what it returns for a missing item or a cycle.
 */
export function orderByRequires<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  requiresOf: (item: T) => readonly string[],
  fail: (p: OrderProblem) => Error,
): T[] {
  const byName = new Map(items.map((item) => [nameOf(item), item] as const));
  const done = new Set<string>();
  const path: string[] = [];
  const out: T[] = [];

  const visit = (item: T): void => {
    const name = nameOf(item);
    if (done.has(name)) return;
    if (path.includes(name)) throw fail({ kind: 'cycle', chain: [...path.slice(path.indexOf(name)), name] });
    path.push(name);
    for (const dep of requiresOf(item)) {
      const next = byName.get(dep);
      if (next === undefined) throw fail({ kind: 'missing', item: name, missing: dep });
      visit(next);
    }
    path.pop();
    done.add(name);
    out.push(item);
  };

  for (const item of items) visit(item);
  return out;
}
