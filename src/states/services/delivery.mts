// The delivery scan (spec 2.7, 2.14 rule C4): which route renders each state union. The answer is
// read off the app, never written by hand per union, because a hand list goes stale when a feature
// is added and the new feature is then uncovered with nothing saying so.
//
//   1. build the import graph of the client roots and the route table files;
//   2. read each route table in `qa.routeTables` for its page rows;
//   3. resolve each row to the page module it draws;
//   4. a union's routes are the routes whose page reaches the union's anchor file.
//
// A route table row has one of two forms:
//
// - the framework route file (main spec 2.26.3): `g.page('/discover', 'discover')`. The page name
//   is the file `<client root>/pages/<name>.page.tsx`. A `prefix` on an enclosing `group({...})`
//   call is put in front of the path.
// - a router table in JSX: `<Route path="/discover" component={Discover} />`. The component is
//   followed through its import, or through a local constant to the components it mounts.
//
// A union that many pages reach is not a defect. Every route is emitted, nearest first. A union
// that no page reaches gets an empty list and a sentence, never a guess.
import { posix } from 'node:path';
import ts from 'typescript';
import type { Surface } from '../../services/types.mts';
import { type DeliveryRoute, type Inventory, mechanismFor, solveSite, type UnionEntry } from './inventory.mts';
import { parseSource, type SourceText } from './scan.mts';

/** One route table: a file and the surface its routes serve. */
export interface RouteTable {
  file: string;
  surface: Surface;
}

/** `qa.routeTables` as tables. A plain string is a `web` table. */
export function normaliseTables(entries: readonly (string | RouteTable)[]): RouteTable[] {
  return entries.map((entry) => (typeof entry === 'string' ? { file: entry, surface: 'web' } : entry));
}

/** How many hops of local indirection the resolvers follow. The bound stops a cycle. */
const MAX_HOPS = 4;

/** Every module specifier of a file: a static import, an `export ... from` and a dynamic `import()`. */
export function importSpecifiers(sf: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [first] = node.arguments;
      if (first && ts.isStringLiteral(first)) found.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...new Set(found)];
}

/** The suffixes a specifier is tried with, in the order a bundler tries them. */
const CANDIDATES = ['', '.ts', '.tsx', '.mts', '/index.ts', '/index.tsx', '/index.mts'];

/**
 * A specifier resolved to a project-relative file, or null. Null covers a package, a stylesheet,
 * and a broken import, which the type checker owns.
 *
 * @param aliases alias to project-relative folder, for example `{ '@ui': '<client app>/src/ui' }`
 */
export function resolveSpecifier(fromFile: string, specifier: string, files: ReadonlySet<string>, aliases: Readonly<Record<string, string>> = {}): string | null {
  let base: string | null = null;
  if (specifier.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  else {
    // The longest alias first, so `@app/ui` wins over `@app`.
    for (const alias of Object.keys(aliases).sort((a, b) => b.length - a.length)) {
      const dir = aliases[alias] as string;
      if (specifier === alias) base = dir;
      else if (specifier.startsWith(`${alias}/`)) base = posix.normalize(`${dir}${specifier.slice(alias.length)}`);
      if (base !== null) break;
    }
  }
  if (base === null) return null;
  // A `.js` specifier names a `.ts` source under NodeNext.
  const stems = /\.[mc]?js$/.test(base) ? [base.replace(/\.([mc]?)js$/, '.$1ts'), base.replace(/\.[mc]?js$/, ''), base] : [base];
  for (const stem of stems) {
    for (const suffix of CANDIDATES) {
      const candidate = `${stem}${suffix}`;
      if (files.has(candidate)) return candidate;
    }
  }
  return null;
}

/** The import graph over the sources: file to the files it imports. */
export function buildGraph(sources: readonly SourceText[], aliases: Readonly<Record<string, string>> = {}): { edges: Map<string, string[]>; parsed: Map<string, ts.SourceFile> } {
  const parsed = new Map(sources.map(({ file, text }) => [file, parseSource(file, text)] as const));
  const files = new Set(parsed.keys());
  const edges = new Map<string, string[]>();
  for (const [file, sf] of parsed) {
    const out: string[] = [];
    for (const specifier of importSpecifiers(sf)) {
      const target = resolveSpecifier(file, specifier, files, aliases);
      if (target !== null && target !== file) out.push(target);
    }
    edges.set(file, [...new Set(out)]);
  }
  return { edges, parsed };
}

/** Every file reachable from a root, with the fewest hops it is reachable in. */
export function reachFrom(edges: ReadonlyMap<string, string[]>, root: string): Map<string, number> {
  const distance = new Map([[root, 0]]);
  const queue = [root];
  while (queue.length > 0) {
    const at = queue.shift() as string;
    const next = (distance.get(at) ?? 0) + 1;
    for (const to of edges.get(at) ?? []) {
      if (distance.has(to)) continue;
      distance.set(to, next);
      queue.push(to);
    }
  }
  return distance;
}

/** The string members of every `const NAME = { key: '...' }` in a file: a path vocabulary by name. */
export function objectVocabulary(sf: ts.SourceFile): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      let initializer = node.initializer;
      while (initializer && (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer) || ts.isSatisfiesExpression(initializer))) {
        initializer = initializer.expression;
      }
      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        const paths = new Map<string, string>();
        for (const member of initializer.properties) {
          if (ts.isPropertyAssignment(member) && ts.isIdentifier(member.name) && (ts.isStringLiteral(member.initializer) || ts.isNoSubstitutionTemplateLiteral(member.initializer))) {
            paths.set(member.name.text, member.initializer.text);
          }
        }
        if (paths.size > 0) found.set(node.name.text, paths);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The local `const NAME = <expression>` declarations of one file, by name. */
function localConstants(sf: ts.SourceFile): Map<string, ts.Expression> {
  const found = new Map<string, ts.Expression>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && !found.has(node.name.text)) {
      found.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** What a path expression of one file is read against: its vocabulary objects, its constants, and its imports. */
export interface PathScope {
  vocabulary: ReadonlyMap<string, ReadonlyMap<string, string>>;
  constants: ReadonlyMap<string, ts.Expression>;
  /** The scope of the module that a name of this file comes from, and the name it has there. Null for a local or unknown name. */
  imported(name: string): { scope: PathScope; name: string } | null;
}

/** The scope of one file alone: an imported name stays unknown. */
export function fileScope(sf: ts.SourceFile): PathScope {
  return { vocabulary: objectVocabulary(sf), constants: localConstants(sf), imported: () => null };
}

/** How each name of a file comes from another module: `import { a as b }`, `import b`, `export { a as b } from` and `export * from`. */
function moduleLinks(sf: ts.SourceFile): { named: Map<string, { specifier: string; name: string }>; star: string[] } {
  const named = new Map<string, { specifier: string; name: string }>();
  const star: string[] = [];
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause.name) named.set(clause.name.text, { specifier, name: 'default' });
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) named.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (!statement.exportClause) star.push(specifier);
      else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) named.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
  }
  return { named, star };
}

/**
 * The scope of each parsed file, made on first use. An imported name is followed into the file
 * that the specifier resolves to, through a re-export and an `export *` of a barrel file too.
 */
export function moduleScopes(parsed: ReadonlyMap<string, ts.SourceFile>, resolve: (from: string, specifier: string) => string | null): (file: string) => PathScope | null {
  const made = new Map<string, PathScope>();
  const scopeOf = (file: string): PathScope | null => {
    const held = made.get(file);
    if (held) return held;
    const sf = parsed.get(file);
    if (!sf) return null;
    const own = fileScope(sf);
    let links: ReturnType<typeof moduleLinks> | null = null;
    const scope: PathScope = {
      vocabulary: own.vocabulary,
      constants: own.constants,
      imported(name) {
        links ??= moduleLinks(sf);
        const link = links.named.get(name);
        if (link) {
          const target = resolve(file, link.specifier);
          const targetScope = target === null ? null : scopeOf(target);
          return targetScope ? { scope: targetScope, name: link.name } : null;
        }
        for (const specifier of links.star) {
          const target = resolve(file, specifier);
          const targetScope = target === null ? null : scopeOf(target);
          if (targetScope && (targetScope.constants.has(name) || targetScope.vocabulary.has(name))) return { scope: targetScope, name };
        }
        return null;
      },
    };
    made.set(file, scope);
    return scope;
  };
  return scopeOf;
}

/** The expression that declares `name` and the scope it is read in, following imports. */
export function declarationOf(scope: PathScope, name: string, depth = 0): { expression: ts.Expression; scope: PathScope } | null {
  if (depth > MAX_HOPS) return null;
  const local = scope.constants.get(name);
  if (local) return { expression: local, scope };
  const link = scope.imported(name);
  return link ? declarationOf(link.scope, link.name, depth + 1) : null;
}

/** The string members of the vocabulary object `name`, following imports. */
function vocabularyOf(scope: PathScope, name: string, depth = 0): ReadonlyMap<string, string> | null {
  if (depth > MAX_HOPS) return null;
  const local = scope.vocabulary.get(name);
  if (local) return local;
  if (scope.constants.has(name)) return null;
  const link = scope.imported(name);
  return link ? vocabularyOf(link.scope, link.name, depth + 1) : null;
}

/**
 * A path expression as the address it serves, or null. It reads a literal, `PATHS.key` of a
 * vocabulary object, a constant, a template, and a one-argument wrapper call such as
 * `localized('/hot')`, in this file or in the module that a name is imported from. A wrapper is
 * unwrapped only when its argument is an address (starts with `/`).
 */
export function evaluatePath(node: ts.Node | null | undefined, scope: PathScope, depth = 0): string | null {
  if (!node || depth > MAX_HOPS * 2) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return evaluatePath(node.expression, scope, depth + 1);
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    return vocabularyOf(scope, node.expression.text)?.get(node.name.text) ?? null;
  }
  if (ts.isIdentifier(node)) {
    const declared = declarationOf(scope, node.text);
    return declared ? evaluatePath(declared.expression, declared.scope, depth + 1) : null;
  }
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const part = evaluatePath(span.expression, scope, depth + 1);
      if (part === null) return null;
      out += part + span.literal.text;
    }
    return out;
  }
  if (ts.isCallExpression(node) && node.arguments.length === 1) {
    const inner = evaluatePath(node.arguments[0], scope, depth + 1);
    return inner !== null && inner.startsWith('/') ? inner : null;
  }
  return null;
}

/** A path with a `:param` cannot be opened without a value the scan does not have. */
export function isDynamicPath(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith(':'));
}

/** One row of a route table. */
export interface RouteRow {
  path: string | null;
  /** JSX form: the identifier the row draws. */
  component: string | null;
  /** Framework form: the page name, for example `auth/sign-in`. */
  pageName: string | null;
  /** The path expression as written, for a row whose path did not resolve. */
  source: string;
  dynamic: boolean;
}

/** The `prefix` of every enclosing `group({ prefix })` call, outermost first. */
function groupPrefix(node: ts.Node, scope: PathScope): string {
  const prefixes: string[] = [];
  let at: ts.Node | undefined = node.parent;
  while (at) {
    if (ts.isCallExpression(at) && ts.isPropertyAccessExpression(at.expression) && at.expression.name.text === 'group') {
      const [options] = at.arguments;
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'prefix') {
            const value = evaluatePath(property.initializer, scope);
            if (value) prefixes.unshift(value.replace(/\/+$/, ''));
          }
        }
      }
    }
    at = at.parent;
  }
  return prefixes.join('');
}

function joinPath(prefix: string, path: string): string {
  if (prefix === '') return path;
  return path === '/' ? prefix : `${prefix}${path}`;
}

/**
 * Every page row of a route table. A catch-all `*` is left out: it answers every address, and a
 * route list that began with it would rank the one screen nobody can ask for first. `scope` reads
 * the path names; the default reads the file alone, so a name imported from another module stays unresolved.
 */
export function routeRows(sf: ts.SourceFile, scope: PathScope = fileScope(sf)): RouteRow[] {
  const rows: RouteRow[] = [];
  const push = (pathNode: ts.Node | null, component: string | null, pageName: string | null, prefix: string, at: PathScope = scope): void => {
    const raw = evaluatePath(pathNode, at);
    if (raw === '*') return;
    const path = raw === null ? null : joinPath(prefix, raw);
    rows.push({ path, component, pageName, source: pathNode ? pathNode.getText(pathNode.getSourceFile()) : '<no path>', dynamic: path === null ? false : isDynamicPath(path) });
  };
  const visit = (node: ts.Node): void => {
    // The framework form: `<group>.page(path, 'page/name')`.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'page' && node.arguments.length >= 2) {
      const [pathNode, nameNode] = node.arguments;
      const pageName = nameNode && (ts.isStringLiteral(nameNode) || ts.isNoSubstitutionTemplateLiteral(nameNode)) ? nameNode.text : null;
      push(pathNode ?? null, null, pageName, groupPrefix(node, scope));
    }
    // The JSX form: `<Route path={...} component={X} />`.
    const opening = ts.isJsxSelfClosingElement(node) ? node : ts.isJsxElement(node) ? node.openingElement : null;
    if (opening && ts.isIdentifier(opening.tagName) && opening.tagName.text === 'Route') {
      const attributes = new Map<string, ts.Node | null>();
      for (const attribute of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name) || !attribute.initializer) continue;
        const value = attribute.initializer;
        attributes.set(attribute.name.text, ts.isJsxExpression(value) ? (value.expression ?? null) : ts.isStringLiteral(value) ? value : null);
      }
      const componentNode = attributes.get('component') ?? null;
      const component = componentNode && ts.isIdentifier(componentNode) ? componentNode.text : null;
      const pathNode = attributes.get('path') ?? null;
      const declared = pathNode && ts.isIdentifier(pathNode) ? declarationOf(scope, pathNode.text) : null;
      // A router takes an array of paths too: one row per element, read in the file that declares the array.
      if (declared && ts.isArrayLiteralExpression(declared.expression)) for (const one of declared.expression.elements) push(one, component, null, '', declared.scope);
      else if (pathNode && ts.isArrayLiteralExpression(pathNode)) for (const one of pathNode.elements) push(one, component, null, '');
      else push(pathNode, component, null, '');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return rows;
}

/** Where a file's imported names come from: name to specifier. */
export function importedNames(sf: ts.SourceFile): Map<string, string> {
  const found = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (clause.name) found.set(clause.name.text, specifier);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) found.set(bindings.name.text, specifier);
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) found.set(element.name.text, specifier);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The tag names of every JSX element under a node: what it mounts, which beats what it mentions. */
function jsxTagsIn(node: ts.Node): Set<string> {
  const found = new Set<string>();
  const visit = (child: ts.Node): void => {
    const opening = ts.isJsxSelfClosingElement(child) ? child : ts.isJsxElement(child) ? child.openingElement : null;
    if (opening && ts.isIdentifier(opening.tagName)) found.add(opening.tagName.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/** The local constants and function declarations of one file, by name: what a row's component can be. */
function localDeclarations(sf: ts.SourceFile): Map<string, ts.Node> {
  const found = new Map<string, ts.Node>(localConstants(sf));
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && !found.has(statement.name.text)) found.set(statement.name.text, statement);
  }
  return found;
}

/** The names of the local helpers a node calls: `homeRoute('hot')` draws what `homeRoute` returns. */
function localCalleesIn(node: ts.Node, locals: ReadonlyMap<string, ts.Node>): Set<string> {
  const found = new Set<string>();
  const visit = (child: ts.Node): void => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && locals.has(child.expression.text)) found.add(child.expression.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * The page modules a JSX row's component draws. An imported component is its file. A local
 * constant or function is followed to the imported components its JSX mounts, and through the
 * local helpers it calls, up to `MAX_HOPS` hops.
 */
export function componentPages(component: string | null, sf: ts.SourceFile, resolve: (specifier: string) => string | null, seen = new Set<string>(), depth = 0): string[] {
  if (component === null || seen.has(component) || depth > MAX_HOPS) return [];
  seen.add(component);
  const imports = importedNames(sf);
  const specifier = imports.get(component);
  if (specifier !== undefined) {
    const file = resolve(specifier);
    return file === null ? [] : [file];
  }
  const locals = localDeclarations(sf);
  const declaration = locals.get(component);
  if (!declaration) return [];
  const pages: string[] = [];
  for (const name of new Set([...jsxTagsIn(declaration), ...localCalleesIn(declaration, locals)])) {
    if (name === component) continue;
    pages.push(...componentPages(name, sf, resolve, seen, depth + 1));
  }
  return [...new Set(pages)];
}

/** The suffixes of a page file (main spec 2.24.3: `<client root>/pages/<path>.page.tsx`, the root `{app:client}/src` of `qa.clientRoots`). */
const PAGE_SUFFIXES = ['.page.tsx', '.page.ts', '.page.mts', '.page.jsx'];

/** The page file of a framework page name, under the first client root that has it. */
export function pageFileFor(pageName: string, pageRoots: readonly string[], files: ReadonlySet<string>): string | null {
  for (const root of pageRoots) {
    for (const suffix of PAGE_SUFFIXES) {
      const candidate = posix.join(root, 'pages', `${pageName}${suffix}`);
      if (files.has(candidate)) return candidate;
    }
  }
  return null;
}

/** One table of the route map, as the summary prints it. */
export interface TableSummary {
  file: string;
  surface: Surface;
  found: boolean;
  rows: number;
  resolved: number;
  unresolved: string[];
  pageless: string[];
}

export interface RouteMapUnion {
  union: string;
  kind: UnionEntry['kind'];
  mechanism: ReturnType<typeof mechanismFor>;
  anchor: string;
  members: string[];
  routes: DeliveryRoute[];
  why?: string;
}

export interface RouteMap {
  generated: string;
  tables: TableSummary[];
  unions: RouteMapUnion[];
}

/**
 * The file a union's route is derived from: the module of the function that computes it, else its
 * own declaration. A page that can show a computed state imports the code that computes it, while
 * a type file is often shared by many unrelated screens.
 */
export function anchorFor(union: Pick<UnionEntry, 'outputs' | 'file'>): string {
  const site = solveSite(union) ?? union.outputs[0] ?? null;
  return site?.file ?? union.file;
}

function noRouteReason(anchor: string, tables: readonly TableSummary[]): string {
  if (tables.every((t) => !t.found)) {
    return `no route table could be read (${tables.map((t) => t.file).join(', ') || 'none configured'}), so no route was derived. Check qa.routeTables`;
  }
  if (tables.every((t) => t.rows === 0)) return 'the route tables hold no page row, so no route was derived for anything';
  return `no page in the route tables reaches ${anchor} through the import graph. Either nothing mounts this code, or a component draws it that the tables reach in another way`;
}

/**
 * The route map: every union, and every address that draws it, nearest first. Pure and without I/O.
 *
 * @param sources the client sources and the route table files
 * @param pageRoots the client roots that hold `pages/`
 */
export function buildRouteMap(input: {
  inventory: Pick<Inventory, 'unions'>;
  sources: readonly SourceText[];
  tables: readonly RouteTable[];
  pageRoots: readonly string[];
  aliases?: Readonly<Record<string, string>>;
  generated: string;
}): RouteMap {
  const aliases = input.aliases ?? {};
  const { edges, parsed } = buildGraph(input.sources, aliases);
  const files = new Set(parsed.keys());
  const scopeOf = moduleScopes(parsed, (from, specifier) => resolveSpecifier(from, specifier, files, aliases));

  const tables = input.tables.map((table) => {
    const sf = parsed.get(table.file);
    if (!sf) return { table, found: false, routes: [] as { path: string | null; dynamic: boolean; source: string; pages: string[] }[] };
    const resolve = (specifier: string): string | null => resolveSpecifier(table.file, specifier, files, aliases);
    const routes = routeRows(sf, scopeOf(table.file) ?? fileScope(sf)).map((row) => ({
      path: row.path,
      dynamic: row.dynamic,
      source: row.source,
      pages:
        row.pageName !== null
          ? [pageFileFor(row.pageName, input.pageRoots, files)].filter((f): f is string => f !== null)
          : componentPages(row.component, sf, resolve),
    }));
    return { table, found: true, routes };
  });
  const summaries: TableSummary[] = tables.map(({ table, found, routes }) => ({
    file: table.file,
    surface: table.surface,
    found,
    rows: routes.length,
    resolved: routes.filter((r) => r.path !== null).length,
    unresolved: routes.filter((r) => r.path === null).map((r) => r.source),
    pageless: routes.filter((r) => r.path !== null && r.pages.length === 0).map((r) => r.path as string),
  }));

  // One walk per page, because a page that two tables mount is one walk.
  const reach = new Map<string, Map<string, number>>();
  for (const { routes } of tables) for (const route of routes) for (const page of route.pages) if (!reach.has(page)) reach.set(page, reachFrom(edges, page));

  const unions = input.inventory.unions.map((union): RouteMapUnion => {
    const anchor = anchorFor(union);
    const found: DeliveryRoute[] = [];
    for (const { table, routes } of tables) {
      for (const route of routes) {
        if (route.path === null) continue;
        let best: number | null = null;
        let page: string | null = null;
        for (const candidate of route.pages) {
          const distance = reach.get(candidate)?.get(anchor);
          if (distance === undefined) continue;
          if (best === null || distance < best) {
            best = distance;
            page = candidate;
          }
        }
        if (best === null || page === null) continue;
        found.push({ surface: table.surface, route: route.path, page, distance: best, dynamic: route.dynamic, reaches: reach.get(page)?.size ?? 0 });
      }
    }
    // Nearest first, then the narrowest page: a route that reaches fewer files is the more specific claim.
    found.sort((a, b) => a.distance - b.distance || a.reaches - b.reaches || a.surface.localeCompare(b.surface) || a.route.localeCompare(b.route));
    return {
      union: union.name,
      kind: union.kind,
      mechanism: mechanismFor(union.kind),
      anchor,
      members: union.members,
      routes: found,
      ...(found.length === 0 ? { why: noRouteReason(anchor, summaries) } : {}),
    };
  });
  return { generated: input.generated, tables: summaries, unions };
}

/** The inventory with each union's routes, and the reason when it has none. */
export function attachRoutes<I extends Pick<Inventory, 'unions'>>(inventory: I, map: RouteMap): I {
  const byName = new Map(map.unions.map((u) => [u.union, u]));
  return {
    ...inventory,
    unions: inventory.unions.map((union) => {
      const mine = byName.get(union.name);
      if (!mine) return union;
      const next = { ...union, routes: mine.routes };
      if (mine.why === undefined) delete next.why;
      else next.why = mine.why;
      return next;
    }),
  };
}

/**
 * The aliases of a tsconfig `compilerOptions.paths` map, as project-relative folders. `@ui/*` to
 * `./src/ui/*` gives `{ '@ui': '<dir>/src/ui' }`. Only the first target of each key is used.
 *
 * @param text the tsconfig text; comments and trailing commas are allowed
 * @param dir the project-relative folder of the tsconfig file
 */
export function aliasesFromTsconfig(text: string, dir: string): Record<string, string> {
  const parsed = ts.parseConfigFileTextToJson('tsconfig.json', text);
  const options = (parsed.config as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } } | undefined)?.compilerOptions;
  const base = posix.join(dir, options?.baseUrl ?? '.');
  const out: Record<string, string> = {};
  for (const [key, targets] of Object.entries(options?.paths ?? {})) {
    const [target] = targets;
    if (target === undefined) continue;
    const alias = key.replace(/\/\*$/, '');
    out[alias] = posix.normalize(posix.join(base, target.replace(/\/\*$/, '')));
  }
  return out;
}

/** The summary a person reads: one block per union, and a sentence where there is no route. */
export function renderRouteSummary(map: RouteMap): string {
  const out: string[] = [];
  for (const table of map.tables) {
    if (!table.found) {
      out.push(`${table.file}  ${table.surface}  not found`);
      continue;
    }
    const extra = [
      table.unresolved.length > 0 ? `unresolved: ${table.unresolved.join(', ')}` : '',
      table.pageless.length > 0 ? `no page module: ${table.pageless.join(', ')}` : '',
    ].filter(Boolean);
    out.push(`${table.file}  ${table.surface}  ${table.resolved} of ${table.rows} route(s) resolved${extra.length > 0 ? `; ${extra.join('; ')}` : ''}`);
  }
  out.push('');
  for (const union of map.unions) {
    out.push(`${union.union}  (${union.kind}, ${union.mechanism ?? 'no mechanism'})  ${union.anchor}`);
    if (union.routes.length === 0) out.push(`    no route: ${union.why ?? 'none'}`);
    for (const route of union.routes.slice(0, 8)) {
      out.push(`    ${route.surface.padEnd(8)} ${route.route.padEnd(28)} ${route.dynamic ? 'dynamic ' : '        '}d=${route.distance}  ${route.page ?? ''}`);
    }
    if (union.routes.length > 8) out.push(`    and ${union.routes.length - 8} more`);
  }
  return out.join('\n');
}
