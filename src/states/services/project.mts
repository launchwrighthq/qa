// The state scan of one project from disk: the client roots, the type roots, the route tables and
// the tsconfig aliases. `lw qa states scan` and `lw qa check` both call `scanStates`, so the two
// cannot disagree about the inventory.
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { QaConfig } from '../../config.mts';
import { aliasesFromTsconfig, attachRoutes, buildRouteMap, normaliseTables, type RouteMap } from './delivery.mts';
import type { Inventory } from './inventory.mts';
import { type ScanProblem, scanProject, type SourceText } from './scan.mts';

/** The project-relative path of the inventory file (spec 2.7). */
export const STATES_FILE = '.lw/qa/states.json';

/** The tsconfig files that may hold the aliases of a client root, nearest first. */
const TSCONFIG_NAMES = ['tsconfig.json', 'tsconfig.app.json'];

/**
 * The import aliases of the client roots, read from `compilerOptions.paths` of a tsconfig in each
 * root or in its parent folder (for `apps/client/src`, that is `apps/client`). An `extends` chain
 * is not followed.
 */
export function readAliases(projectRoot: string, clientRoots: readonly string[]): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const root of clientRoots) {
    for (const dir of [root, posix.dirname(root)]) {
      for (const name of TSCONFIG_NAMES) {
        const path = join(projectRoot, dir, name);
        if (!existsSync(path)) continue;
        for (const [alias, target] of Object.entries(aliasesFromTsconfig(readFileSync(path, 'utf8'), dir))) aliases[alias] ??= target;
      }
    }
  }
  return aliases;
}

export interface StatesScan {
  /** The inventory with the routes of each union attached. */
  inventory: Inventory;
  problems: ScanProblem[];
  map: RouteMap;
}

/** Scans the states of a project and derives the route of each union. */
export function scanStates(projectRoot: string, config: Pick<QaConfig, 'clientRoots' | 'typeRoots' | 'routeTables'>, generated: string): StatesScan {
  const scanned = scanProject(projectRoot, { clientRoots: config.clientRoots, typeRoots: config.typeRoots, generated });
  const tables = normaliseTables(config.routeTables);
  const known = new Set(scanned.sources.map((s) => s.file));
  const tableSources: SourceText[] = tables
    .filter((t) => !known.has(t.file) && existsSync(join(projectRoot, t.file)))
    .map((t) => ({ file: t.file, text: readFileSync(join(projectRoot, t.file), 'utf8') }));
  const map = buildRouteMap({
    inventory: scanned.inventory,
    sources: [...scanned.sources, ...tableSources],
    tables,
    pageRoots: config.clientRoots,
    aliases: readAliases(projectRoot, config.clientRoots),
    generated,
  });
  return { inventory: attachRoutes(scanned.inventory, map), problems: scanned.problems, map };
}
