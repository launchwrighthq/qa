import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaConfigOf } from '../../../../src/config.mts';
import { stateFindings } from '../../../../src/states/services/check.mts';
import { readAliases, scanStates } from '../../../../src/states/services/project.mts';

const GENERATED = '2026-01-01T00:00:00.000Z';

async function project(files: Record<string, string>): Promise<string> {
  const root = await tmpDir();
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const ROUTES = "export default routes((r) => r.group({ name: 'public' }, (g) => { g.page('/', 'home'); }));";

const config = qaConfigOf({});

describe('state rules of lw qa check', () => {
  it('passes a mountable input union and a routed output union', async () => {
    const root = await project({
      'apps/api/src/routes.mts': ROUTES,
      'apps/client/src/pages/home.page.tsx': "import { mark } from '../mark';\nexport default function Home() { return null; }",
      'apps/client/src/mark.ts': "export type DotMark = 'on' | 'off';\nexport function mark(x: { on: boolean }): DotMark { return x.on ? 'on' : 'off'; }",
      'apps/client/src/tile.tsx': "export type TileState = 'a' | 'b';\nexport interface TileProps { state: TileState }\nexport const Tile = (p: TileProps) => null;",
    });
    expect(stateFindings(root, config, GENERATED)).toEqual([]);
  });

  it('fails a neither union and an ignore tag without a reason under C1', async () => {
    const root = await project({
      'apps/api/src/routes.mts': ROUTES,
      'apps/client/src/pages/home.page.tsx': 'export default function Home() { return null; }',
      'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';\n/** @qa-states ignore */\nexport type HostKind = 'x' | 'y';",
    });
    const findings = stateFindings(root, config, GENERATED);
    expect(findings.map((f) => [f.rule, f.union])).toEqual([
      ['C1', 'MenuPhase'],
      ['C1', 'HostKind'],
      ['C1', 'HostKind'],
    ]);
    expect(findings[0]?.message).toContain('apps/client/src/menu.ts:1 MenuPhase is neither an input nor an output');
    expect(findings.some((f) => f.message.includes('ignore with no reason'))).toBe(true);
  });

  it('fails an output union that no route delivers and no harness mounts under C4', async () => {
    const root = await project({
      'apps/api/src/routes.mts': ROUTES,
      'apps/client/src/pages/home.page.tsx': 'export default function Home() { return null; }',
      'apps/client/src/orphan.ts': "export type OrphanStatus = 'a' | 'b';\nexport function orphan(x: { a: boolean }): OrphanStatus { return x.a ? 'a' : 'b'; }",
    });
    const findings = stateFindings(root, config, GENERATED);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'C4', union: 'OrphanStatus', file: 'apps/client/src/orphan.ts', line: 1 });
    expect(findings[0]?.message).toContain('has no route and no mount');
  });

  it('reads the route table from qa.routeTables and the aliases from the client tsconfig', async () => {
    const root = await project({
      'apps/client/tsconfig.json': '{ "compilerOptions": { "paths": { "@lib/*": ["./src/lib/*"] } } }',
      'apps/client/src/routes.tsx': "import { Home } from '@lib/home';\nexport const App = () => <Route path=\"/start\" component={Home} />;",
      'apps/client/src/lib/home.tsx': "import { mark } from './mark';\nexport const Home = () => null;",
      'apps/client/src/lib/mark.ts': "export type DotMark = 'on' | 'off';\nexport function mark(x: { on: boolean }): DotMark { return x.on ? 'on' : 'off'; }",
    });
    expect(readAliases(root, ['apps/client/src'])).toEqual({ '@lib': 'apps/client/src/lib' });
    const custom = qaConfigOf({ qa: { routeTables: ['apps/client/src/routes.tsx'] } });
    const { inventory } = scanStates(root, custom, GENERATED);
    expect(inventory.unions[0]?.routes?.map((r) => [r.surface, r.route, r.page])).toEqual([['web', '/start', 'apps/client/src/lib/home.tsx']]);
    expect(stateFindings(root, custom, GENERATED)).toEqual([]);
  });

  it('fails a missing client root with qa.states.root', async () => {
    const root = await project({});
    expect(() => stateFindings(root, config, GENERATED)).toThrow(expect.objectContaining({ code: 'qa.states.root' }));
  });
});
