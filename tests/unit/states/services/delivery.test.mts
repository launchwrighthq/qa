import { describe, expect, it } from 'vitest';
import {
  aliasesFromTsconfig,
  attachRoutes,
  buildRouteMap,
  normaliseTables,
  resolveSpecifier,
  routeRows,
} from '../../../../src/states/services/delivery.mts';
import { analyzeSources, parseSource, type SourceText } from '../../../../src/states/services/scan.mts';

const GENERATED = '2026-01-01T00:00:00.000Z';

const client: SourceText[] = [
  {
    file: 'apps/client/src/invites/mark.ts',
    text: "export type InviteMark = 'pending' | 'capped';\nexport function inviteMark(i: { capped: boolean }): InviteMark { return i.capped ? 'capped' : 'pending'; }",
  },
  { file: 'apps/client/src/invites/list.tsx', text: "import { inviteMark } from './mark';\nexport const List = () => null;" },
  { file: 'apps/client/src/pages/invites.page.tsx', text: "import { List } from '@invites/list';\nexport default function Page() { return null; }" },
  { file: 'apps/client/src/pages/home.page.tsx', text: 'export default function Home() { return null; }' },
  { file: 'apps/client/src/pages/items/[id].page.tsx', text: "import { List } from '../../invites/list';\nexport default function Item() { return null; }" },
  { file: 'apps/client/src/menu.ts', text: "export type MenuPhase = 'idle' | 'busy';" },
];

const routeFile: SourceText = {
  file: 'apps/api/src/routes.mts',
  text: `
import { routes } from '@launchwrighthq/http';
const PATHS = { invites: '/invites' } as const;
export default routes((r) => {
  r.group({ name: 'public' }, (g) => {
    g.page('/', 'home');
    g.page(PATHS.invites, 'invites');
  });
  r.group({ name: 'account', prefix: '/account' }, (g) => {
    g.page('/items/:id', 'items/[id]');
    g.page('/gone', 'missing');
  });
  r.api({ version: 'v1' }, (a) => a.get('/x', () => null));
});
`,
};

function inventory() {
  return analyzeSources({ sources: client, roots: ['apps/client/src'], generated: GENERATED }).inventory;
}

describe('delivery scan', () => {
  it('reads a plain string table as a web table', () => {
    expect(normaliseTables(['apps/api/src/routes.mts', { file: 'apps/client/src/mini/routes.tsx', surface: 'miniapp' }])).toEqual([
      { file: 'apps/api/src/routes.mts', surface: 'web' },
      { file: 'apps/client/src/mini/routes.tsx', surface: 'miniapp' },
    ]);
  });

  it('reads framework page rows with a vocabulary path and a group prefix', () => {
    const rows = routeRows(parseSource(routeFile.file, routeFile.text));
    expect(rows.map((r) => [r.path, r.pageName, r.dynamic])).toEqual([
      ['/', 'home', false],
      ['/invites', 'invites', false],
      ['/account/items/:id', 'items/[id]', true],
      ['/account/gone', 'missing', false],
    ]);
  });

  it('reads JSX Route rows, an array of paths, and leaves out the catch-all', () => {
    const sf = parseSource(
      'apps/client/src/app.tsx',
      "import { Home } from './home';\nconst LIST = ['/a', '/b'];\nexport const App = () => <Router><Route path=\"/\" component={Home} /><Route path={LIST} component={Home} /><Route path=\"*\" component={Home} /></Router>;",
    );
    expect(routeRows(sf).map((r) => [r.path, r.component])).toEqual([
      ['/', 'Home'],
      ['/a', 'Home'],
      ['/b', 'Home'],
    ]);
  });

  it('resolves a relative specifier, an alias, an index file and a .js name of a .ts source', () => {
    const files = new Set(['apps/client/src/ui/index.tsx', 'apps/client/src/a.ts', 'apps/client/src/b.mts']);
    expect(resolveSpecifier('apps/client/src/x.ts', './a', files)).toBe('apps/client/src/a.ts');
    expect(resolveSpecifier('apps/client/src/x.ts', './a.js', files)).toBe('apps/client/src/a.ts');
    expect(resolveSpecifier('apps/client/src/x.ts', './b.mjs', files)).toBe('apps/client/src/b.mts');
    expect(resolveSpecifier('apps/client/src/x.ts', '@ui', files, { '@ui': 'apps/client/src/ui' })).toBe('apps/client/src/ui/index.tsx');
    expect(resolveSpecifier('apps/client/src/x.ts', 'solid-js', files)).toBeNull();
  });

  it('reads the aliases of a tsconfig paths map with comments', () => {
    const text = '{ // client\n "compilerOptions": { "baseUrl": ".", "paths": { "@ui/*": ["./src/ui/*"], "@app": ["./src/app"] } } }';
    expect(aliasesFromTsconfig(text, 'apps/client')).toEqual({ '@ui': 'apps/client/src/ui', '@app': 'apps/client/src/app' });
  });

  it('maps each union to every route whose page reaches its anchor, nearest first, and says why when none does', () => {
    const map = buildRouteMap({
      inventory: inventory(),
      sources: [...client, routeFile],
      tables: normaliseTables(['apps/api/src/routes.mts']),
      pageRoots: ['apps/client/src'],
      aliases: { '@invites': 'apps/client/src/invites' },
      generated: GENERATED,
    });
    expect(map.tables).toEqual([{ file: 'apps/api/src/routes.mts', surface: 'web', found: true, rows: 4, resolved: 4, unresolved: [], pageless: ['/account/gone'] }]);
    const mark = map.unions.find((u) => u.union === 'InviteMark');
    expect(mark?.anchor).toBe('apps/client/src/invites/mark.ts');
    expect(mark?.routes.map((r) => [r.route, r.distance, r.dynamic])).toEqual([
      ['/account/items/:id', 2, true],
      ['/invites', 2, false],
    ]);
    const menu = map.unions.find((u) => u.union === 'MenuPhase');
    expect(menu?.routes).toEqual([]);
    expect(menu?.why).toContain('no page in the route tables reaches apps/client/src/menu.ts');
    const attached = attachRoutes(inventory(), map);
    expect(attached.unions.find((u) => u.name === 'InviteMark')?.routes).toHaveLength(2);
    expect(attached.unions.find((u) => u.name === 'MenuPhase')?.why).toBe(menu?.why);
  });

  it('says that no route table could be read', () => {
    const map = buildRouteMap({ inventory: inventory(), sources: client, tables: normaliseTables(['apps/api/src/routes.mts']), pageRoots: ['apps/client/src'], generated: GENERATED });
    expect(map.tables[0]?.found).toBe(false);
    expect(map.unions[0]?.why).toContain('no route table could be read (apps/api/src/routes.mts)');
  });
});
