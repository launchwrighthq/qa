import { describe, expect, it } from 'vitest';
import {
  aliasesFromTsconfig,
  attachRoutes,
  buildRouteMap,
  isDynamicPath,
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

  it('reads a path vocabulary, an array and a constant that the table imports from other modules', () => {
    const app: SourceText[] = [
      { file: 'web/src/app/paths.ts', text: "export const PATHS = { home: '/', inbox: '/inbox', item: '/items/:id', extra: `/extra` } as const;" },
      { file: 'web/src/app/index.ts', text: "export { PATHS as SHARED_PATHS } from './paths';\nexport * from './lists';" },
      { file: 'web/src/app/lists.ts', text: "import { PATHS } from './paths';\nexport const LIST_PATHS = [PATHS.inbox, `${PATHS.inbox}/archive`];\nexport const ITEM_PATH = PATHS.item;" },
      { file: 'web/src/pages/inbox/index.tsx', text: "import { Shelf } from '../../shelf';\nexport const InboxPage = () => <Shelf />;" },
      { file: 'web/src/shelf.tsx', text: "export type ShelfMark = 'empty' | 'full';\nexport interface ShelfProps { mark: ShelfMark }\nexport const Shelf = (p: ShelfProps) => null;" },
    ];
    const table: SourceText = {
      file: 'web/src/app/App.tsx',
      text: `
import { InboxPage } from '@pages/inbox';
import { SHARED_PATHS, LIST_PATHS, ITEM_PATH } from './index';
function localized(path: string): string { return path; }
export const App = () => (
  <Router>
    <Route path={localized(SHARED_PATHS.home)} component={InboxPage} />
    <Route path={LIST_PATHS} component={InboxPage} />
    <Route path={ITEM_PATH} component={InboxPage} />
    <Route path={\`\${SHARED_PATHS.extra}/more\`} component={InboxPage} />
    <Route path={UNKNOWN.key} component={InboxPage} />
  </Router>
);
`,
    };
    const sources = [...app, table];
    const map = buildRouteMap({
      inventory: analyzeSources({ sources, roots: ['web/src'], generated: GENERATED }).inventory,
      sources,
      tables: [{ file: table.file, surface: 'web' }],
      pageRoots: ['web/src'],
      aliases: { '@pages': 'web/src/pages' },
      generated: GENERATED,
    });
    expect(map.tables[0]).toMatchObject({ rows: 6, resolved: 5, unresolved: ['UNKNOWN.key'], pageless: [] });
    expect(map.unions.find((u) => u.union === 'ShelfMark')?.routes.map((r) => [r.route, r.dynamic])).toEqual([
      ['/', false],
      ['/extra/more', false],
      ['/inbox', false],
      ['/inbox/archive', false],
      ['/items/:id', true],
    ]);
  });

  it('follows a row component through the local helpers it calls to the page it draws', () => {
    const sources: SourceText[] = [
      { file: 'web/src/pages/menu/index.tsx', text: "import { Shelf } from '../../shelf';\nexport const MenuPage = (p: { section?: string }) => <Shelf />;" },
      { file: 'web/src/shelf.tsx', text: "export type ShelfMark = 'empty' | 'full';\nexport interface ShelfProps { mark: ShelfMark }\nexport const Shelf = (p: ShelfProps) => null;" },
      {
        file: 'web/src/app/App.tsx',
        text: `
import { MenuPage } from '../pages/menu';
function sectionRoute(section: string) { return <MenuPage section={section} />; }
const pageFor = (name: string) => () => <MenuPage section={name} />;
const MenuRoute = () => sectionRoute('all');
const LegalRoute = pageFor('legal');
export const App = () => (
  <Router>
    <Route path="/menu" component={MenuRoute} />
    <Route path="/legal" component={LegalRoute} />
  </Router>
);
`,
      },
    ];
    const map = buildRouteMap({
      inventory: analyzeSources({ sources, roots: ['web/src'], generated: GENERATED }).inventory,
      sources,
      tables: [{ file: 'web/src/app/App.tsx', surface: 'web' }],
      pageRoots: ['web/src'],
      generated: GENERATED,
    });
    expect(map.tables[0]?.pageless).toEqual([]);
    expect(map.unions.find((u) => u.union === 'ShelfMark')?.routes.map((r) => r.route)).toEqual(['/legal', '/menu']);
  });

  it('says that no route table could be read', () => {
    const map = buildRouteMap({ inventory: inventory(), sources: client, tables: normaliseTables(['apps/api/src/routes.mts']), pageRoots: ['apps/client/src'], generated: GENERATED });
    expect(map.tables[0]?.found).toBe(false);
    expect(map.unions[0]?.why).toContain('no route table could be read (apps/api/src/routes.mts)');
  });

  it('reads a wrapper body that adds an optional segment, follows an imported wrapper, and falls back to qa.routeWrappers', () => {
    const sources: SourceText[] = [
      { file: 'web/src/paths.ts', text: "export const PATHS = { home: '/', wheel: '/wheel', shelf: '/shelf/:slug', account: '/account' } as const;" },
      { file: 'web/src/region.ts', text: "export const withRegion = (path: string): string => '/:region?' + path;" },
      { file: 'web/src/pages/wheel.tsx', text: "import { Wheel } from '../wheel';\nexport const WheelPage = () => <Wheel />;" },
      { file: 'web/src/wheel.tsx', text: "export type WheelMark = 'idle' | 'won';\nexport interface WheelProps { mark: WheelMark }\nexport const Wheel = (p: WheelProps) => null;" },
      {
        file: 'web/src/App.tsx',
        text: `
import { prefixed } from 'some-router-kit';
import { PATHS } from './paths';
import { withRegion } from './region';
import { WheelPage } from './pages/wheel';
function localized(path: string): string {
  return path === '/' ? '/:lang?' : \`/:lang?\${path}\`;
}
function scoped(path: string): string {
  if (path === '/') return '/:scope?';
  return '/:scope?' + path;
}
export const App = () => (
  <Router>
    <Route path={localized(PATHS.home)} component={WheelPage} />
    <Route path={localized(PATHS.wheel)} component={WheelPage} />
    <Route path={localized(PATHS.shelf)} component={WheelPage} />
    <Route path={withRegion(PATHS.wheel)} component={WheelPage} />
    <Route path={scoped(PATHS.account)} component={WheelPage} />
    <Route path={prefixed(PATHS.account)} component={WheelPage} />
    <Route path={PATHS.account} component={WheelPage} />
  </Router>
);
`,
      },
    ];
    const build = (wrappers?: Record<string, string>) =>
      buildRouteMap({
        inventory: analyzeSources({ sources, roots: ['web/src'], generated: GENERATED }).inventory,
        sources,
        tables: [{ file: 'web/src/App.tsx', surface: 'web' }],
        pageRoots: ['web/src'],
        ...(wrappers ? { wrappers } : {}),
        generated: GENERATED,
      });
    const routesOf = (map: ReturnType<typeof build>) => map.unions.find((u) => u.union === 'WheelMark')?.routes.map((r) => [r.route, r.dynamic]);
    expect(routesOf(build())).toEqual([
      ['/:lang?', false],
      ['/:lang?/shelf/:slug', true],
      ['/:lang?/wheel', false],
      ['/:region?/wheel', false],
      ['/:scope?/account', false],
      ['/account', false],
      ['/account', false],
    ]);
    // The package wrapper has no body to read, so it is the bare path until qa.routeWrappers declares it.
    expect(routesOf(build({ prefixed: '/:lang?', localized: '/:ignored?' }))).toContainEqual(['/:lang?/account', false]);
    expect(routesOf(build({ localized: '/:ignored?' }))?.some(([route]) => String(route).includes('ignored'))).toBe(false);
    expect(isDynamicPath('/:lang?/wheel')).toBe(false);
    expect(isDynamicPath('/:lang?/shelf/:slug')).toBe(true);
  });
});
