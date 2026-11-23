// The state scan (spec 2.7): reads the TypeScript AST under `qa.clientRoots` and answers "which
// states does this client declare, and how is each one reached?". The result is the `Inventory` of
// `inventory.mts`.
//
// The scan parses each file alone with `createSourceFile`. Every question is syntactic (is this
// node a property signature, does this function declare that return type), so no type checker is
// needed. The cost: a union reached only through an alias (`type A = OtherState`) is not seen, and
// two unions of one name cannot be told apart, so the scan reports a duplicate name as a problem.
//
// The body is pure functions over parsed sources, with a small file reader at the end, so a test
// drives every classification from fixture strings.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import ts from 'typescript';
import {
  IGNORE_TAG,
  type IgnoredEntry,
  type InputSite,
  type Inventory,
  isStateUnionName,
  kindFor,
  type OutputSite,
  type ParamSite,
  type Pivots,
  type UnionEntry,
  validateInventory,
} from './inventory.mts';
import { type Field, type Shape, validateShape } from './solve.mts';

/** A source file, project-relative, with its text. */
export interface SourceText {
  file: string;
  text: string;
}

/** A finding of the scan that is not a union: an opt-out without a reason, or a duplicate name. */
export interface ScanProblem {
  code: 'ignore-without-reason' | 'ignore-directive' | 'ignore-repeated' | 'duplicate-union' | 'invalid-shape';
  file: string;
  line: number;
  union: string;
  message: string;
}

/**
 * True for a product source file, false for a test or a declaration file. A test declares local
 * functions that return a union and inline props that hold it. No capture can reach those, so
 * counting them would add states that no screenshot covers.
 */
export function isProductSource(rel: string): boolean {
  if (!/\.(tsx?|mts)$/.test(rel) || /\.d\.m?ts$/.test(rel)) return false;
  const segments = rel.split('/');
  const base = segments[segments.length - 1] ?? '';
  if (/\.(test|spec)\.(tsx?|mts)$/.test(base)) return false;
  return !segments.some((s) => s === '__tests__' || s === '__mocks__' || s === 'node_modules');
}

export function parseSource(rel: string, text: string): ts.SourceFile {
  return ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** The name a type reference names, when it is a plain identifier. */
function referencedName(typeNode: ts.TypeNode | undefined): string | null {
  return typeNode && ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName) ? typeNode.typeName.text : null;
}

function isNullish(typeNode: ts.TypeNode): boolean {
  return (ts.isLiteralTypeNode(typeNode) && typeNode.literal.kind === ts.SyntaxKind.NullKeyword) || typeNode.kind === ts.SyntaxKind.UndefinedKeyword;
}

export type UnionPart = { literal: string } | { ref: string };

/**
 * The parts of a union node in source order: a string literal's value or a reference's name. A
 * union may mix the two (`A = BPhase | 'done'`). Any other member makes the alias no state union.
 */
export function unionParts(typeNode: ts.TypeNode | undefined): UnionPart[] | null {
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) return null;
  const parts: UnionPart[] = [];
  for (const member of typeNode.types) {
    if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
      parts.push({ literal: member.literal.text });
      continue;
    }
    const ref = referencedName(member);
    if (!ref) return null;
    parts.push({ ref });
  }
  return parts.length >= 2 ? parts : null;
}

/**
 * The reason from `@qa-states ignore <reason>`, null when the alias has no tag, or a problem. A
 * tag with no reason is a problem: "ignore this" without a why is how a denominator shrinks.
 */
export function ignoreReason(node: ts.Node, file: string, sf: ts.SourceFile): { reason: string | null; problem: ScanProblem | null } {
  const tags = ts.getJSDocTags(node).filter((t) => t.tagName.text === IGNORE_TAG);
  if (tags.length === 0) return { reason: null, problem: null };
  const name = ts.isTypeAliasDeclaration(node) ? node.name.text : '<declaration>';
  const line = lineOf(sf, node);
  if (tags.length > 1) {
    return {
      reason: null,
      problem: { code: 'ignore-repeated', file, line, union: name, message: `${file}:${line} "${name}" carries ${tags.length} @${IGNORE_TAG} tags. It may carry one.` },
    };
  }
  const [tag] = tags;
  const text = (ts.getTextOfJSDocComment(tag?.comment) ?? '').replace(/\s+/g, ' ').trim();
  const directive = /^ignore(?:\s+(.*))?$/.exec(text);
  if (!directive) {
    return {
      reason: null,
      problem: {
        code: 'ignore-directive',
        file,
        line,
        union: name,
        message: `${file}:${line} "${name}" has @${IGNORE_TAG} "${text}". The only directive is "ignore <reason>".`,
      },
    };
  }
  const reason = (directive[1] ?? '').trim();
  if (!reason) {
    return {
      reason: null,
      problem: {
        code: 'ignore-without-reason',
        file,
        line,
        union: name,
        message: `${file}:${line} "${name}" is marked @${IGNORE_TAG} ignore with no reason. A reason is required (spec 2.14 rule C1).`,
      },
    };
  }
  return { reason, problem: null };
}

export interface DeclaredUnion {
  name: string;
  file: string;
  line: number;
  parts: UnionPart[];
  reason: string | null;
}

/** Every exported state union declared in one file, still unresolved, and the tag problems. */
export function findUnions(sf: ts.SourceFile, file: string): { unions: DeclaredUnion[]; problems: ScanProblem[] } {
  const unions: DeclaredUnion[] = [];
  const problems: ScanProblem[] = [];
  walk(sf, (node) => {
    if (!ts.isTypeAliasDeclaration(node) || !isExported(node) || !isStateUnionName(node.name.text)) return;
    // The tag is read before the parts, so a bad tag is reported wherever it is written.
    const { reason, problem } = ignoreReason(node, file, sf);
    if (problem) problems.push(problem);
    const parts = unionParts(node.type);
    if (parts) unions.push({ name: node.name.text, file, line: lineOf(sf, node), parts, reason });
  });
  return { unions, problems };
}

/**
 * Flattens every declaration whose parts resolve, and expands a reference in place. A fixpoint,
 * because a mixed union may reference another mixed union. A cycle, or a reference to something
 * that is no state union, never resolves, and the alias is dropped.
 */
export function flattenUnions(declared: ReadonlyMap<string, { parts: UnionPart[] }>): Map<string, string[]> {
  const resolved = new Map<string, string[]>();
  for (let pass = 0; pass <= declared.size; pass += 1) {
    let progress = false;
    for (const [name, declaration] of declared) {
      if (resolved.has(name)) continue;
      const members: string[] = [];
      let complete = true;
      for (const part of declaration.parts) {
        if ('literal' in part) {
          members.push(part.literal);
          continue;
        }
        const inner = resolved.get(part.ref);
        if (!inner) {
          complete = false;
          break;
        }
        members.push(...inner);
      }
      if (!complete) continue;
      resolved.set(name, [...new Set(members)]);
      progress = true;
    }
    if (!progress) break;
  }
  return resolved;
}

/** Every state union a declaration pulls in, transitively. */
export function referencedUnions(name: string, declared: ReadonlyMap<string, { parts: UnionPart[] }>, seen = new Set<string>()): Set<string> {
  for (const part of declared.get(name)?.parts ?? []) {
    if (!('ref' in part) || seen.has(part.ref)) continue;
    seen.add(part.ref);
    referencedUnions(part.ref, declared, seen);
  }
  return seen;
}

/**
 * The named type a property signature belongs to: an interface body, or a type literal that an
 * alias is written out of, also as a member of the alias's union or intersection. A literal that
 * is nested deeper gets null: its field is one level deeper than the outer name says.
 */
function holderOf(prop: ts.PropertySignature): string | null {
  const parent = prop.parent;
  if (ts.isInterfaceDeclaration(parent)) return parent.name.text;
  if (!ts.isTypeLiteralNode(parent)) return null;
  let node: ts.Node = parent;
  while (node.parent && (ts.isUnionTypeNode(node.parent) || ts.isIntersectionTypeNode(node.parent) || ts.isParenthesizedTypeNode(node.parent))) {
    node = node.parent;
  }
  return node.parent && ts.isTypeAliasDeclaration(node.parent) ? node.parent.name.text : null;
}

function propertyName(prop: ts.PropertySignature, sf: ts.SourceFile): string {
  return ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText(sf);
}

type RawInput = Omit<InputSite, 'component' | 'componentFile'> & { union: string };

/** Every field in one file whose type is one of the unions: the input half. */
export function findInputSites(sf: ts.SourceFile, file: string, names: ReadonlySet<string>): RawInput[] {
  const found: RawInput[] = [];
  walk(sf, (node) => {
    if (!ts.isPropertySignature(node)) return;
    const union = referencedName(node.type);
    if (!union || !names.has(union)) return;
    const holder = holderOf(node);
    if (!holder) return;
    found.push({ union, interface: holder, field: propertyName(node, sf), optional: Boolean(node.questionToken), file });
  });
  return found;
}

/**
 * How a return type produces a union: `T`, `T | null`, `Promise<T>` or `Promise<T | null>`.
 * `T | 'other'` does not qualify: a wider union is a different type with other states.
 */
export function returnsUnion(typeNode: ts.TypeNode | undefined, names: ReadonlySet<string>): { union: string; nullable: boolean; async: boolean } | null {
  if (typeNode && ts.isTypeReferenceNode(typeNode) && referencedName(typeNode) === 'Promise' && typeNode.typeArguments?.length === 1) {
    const awaited = returnsUnion(typeNode.typeArguments[0], names);
    return awaited ? { ...awaited, async: true } : null;
  }
  const direct = referencedName(typeNode);
  if (direct && names.has(direct)) return { union: direct, nullable: false, async: false };
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) return null;
  let union: string | null = null;
  let nullable = false;
  for (const member of typeNode.types) {
    const name = referencedName(member);
    if (name && names.has(name)) {
      if (union) return null;
      union = name;
    } else if (isNullish(member)) nullable = true;
    else return null;
  }
  return union ? { union, nullable, async: false } : null;
}

interface FunctionLike {
  name: string;
  fn: ts.SignatureDeclaration & { body?: ts.Node | undefined };
  declaredType: ts.TypeNode | undefined;
  exported: boolean;
}

/** A function declaration, or a `const` that holds an arrow function or a function expression. */
function functionLike(node: ts.Node): FunctionLike | null {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { name: node.name.text, fn: node, declaredType: undefined, exported: isExported(node) };
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    // `export` sits on the statement, two nodes up.
    const statement = node.parent?.parent;
    return { name: node.name.text, fn: node.initializer, declaredType: node.type, exported: Boolean(statement && isExported(statement)) };
  }
  return null;
}

/** The names a file exports with `export { a };`. A re-export from another module does not count. */
function reExportedNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  walk(sf, (node) => {
    if (!ts.isExportDeclaration(node) || !node.exportClause || !ts.isNamedExports(node.exportClause) || node.moduleSpecifier) return;
    for (const element of node.exportClause.elements) names.add((element.propertyName ?? element.name).text);
  });
  return names;
}

/** Resolves a type name to its file and its declaration. A name declared twice resolves to null. */
export interface TypeResolver {
  fileOf(name: string): string | null;
  declOf(name: string): ts.Node | null;
}

const NO_TYPES: TypeResolver = { fileOf: () => null, declOf: () => null };

function paramSite(param: ts.ParameterDeclaration, sf: ts.SourceFile, file: string, resolver: TypeResolver, problems: ScanProblem[]): ParamSite {
  const name = ts.isIdentifier(param.name) ? param.name.text : param.name.getText(sf);
  const referenced = referencedName(param.type);
  const type = referenced ?? (param.type ? param.type.getText(sf) : 'unknown');
  const declaration = referenced ? resolver.declOf(referenced) : (param.type ?? null);
  let shape = shapeFor(type, declaration, (n) => resolver.declOf(n));
  // A shape the solver refuses would report every state unreachable later, so it is refused here.
  const errors = shape ? validateShape(shape) : [];
  if (errors.length > 0) {
    problems.push({ code: 'invalid-shape', file, line: lineOf(sf, param), union: type, message: `The shape derived for "${type}" is invalid: ${errors.join('; ')}` });
    shape = null;
  }
  return { name, type, typeFile: referenced ? resolver.fileOf(referenced) : null, shape };
}

type RawOutput = OutputSite & { union: string };

/**
 * Every function in one file that returns one of the unions: the output half. An unexported one is
 * recorded, because the solver must be told why it cannot reach a state.
 */
export function findOutputSites(sf: ts.SourceFile, file: string, names: ReadonlySet<string>, resolver: TypeResolver = NO_TYPES, problems: ScanProblem[] = []): RawOutput[] {
  const found: RawOutput[] = [];
  const reExported = reExportedNames(sf);
  walk(sf, (node) => {
    const candidate = functionLike(node);
    if (!candidate) return;
    const hit = returnsUnion(candidate.fn.type, names);
    if (!hit) return;
    const params = candidate.fn.parameters.map((p) => paramSite(p, sf, file, resolver, problems));
    found.push({
      union: hit.union,
      fn: candidate.name,
      file,
      exported: candidate.exported || reExported.has(candidate.name),
      nullable: hit.nullable,
      async: hit.async,
      // A function with no searchable parameter can be evaluated and never steered.
      solvable: params.some((p) => p.shape !== null),
      pivots: pivotsIn(candidate.fn),
      params,
    });
  });
  return found;
}

/** The props type a component names: `Component<P>` on the const, or the type of its one parameter. */
function componentPropsType({ fn, declaredType }: FunctionLike): string | null {
  if (declaredType && ts.isTypeReferenceNode(declaredType) && declaredType.typeArguments?.length === 1) {
    const argument = referencedName(declaredType.typeArguments[0]);
    if (argument) return argument;
  }
  return fn.parameters.length === 1 ? referencedName(fn.parameters[0]?.type) : null;
}

/**
 * Every component in a `.tsx` file that names a props type. A component starts with a capital
 * letter, which is the rule of JSX: a lowercase tag is an intrinsic element.
 */
export function findComponentCandidates(sf: ts.SourceFile, file: string): { component: string; componentFile: string; propsType: string }[] {
  if (!file.endsWith('.tsx')) return [];
  const found: { component: string; componentFile: string; propsType: string }[] = [];
  walk(sf, (node) => {
    const candidate = functionLike(node);
    if (!candidate || !/^[A-Z]/.test(candidate.name)) return;
    const propsType = componentPropsType(candidate);
    if (propsType) found.push({ component: candidate.name, componentFile: file, propsType });
  });
  return found;
}

/** The named types each declaration is built from: `P = A & B` gives `[A, B]`, `interface P extends A` gives `[A]`. */
export function findTypeComposition(sf: ts.SourceFile): { name: string; of: string[] }[] {
  const found: { name: string; of: string[] }[] = [];
  const namesIn = (typeNode: ts.TypeNode | undefined): string[] => {
    if (!typeNode) return [];
    if (ts.isParenthesizedTypeNode(typeNode)) return namesIn(typeNode.type);
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) return typeNode.types.flatMap(namesIn);
    const name = referencedName(typeNode);
    return name ? [name] : [];
  };
  walk(sf, (node) => {
    if (ts.isTypeAliasDeclaration(node)) {
      const of = namesIn(node.type);
      if (of.length) found.push({ name: node.name.text, of });
      return;
    }
    if (!ts.isInterfaceDeclaration(node)) return;
    const of = (node.heritageClauses ?? []).flatMap((clause) =>
      clause.types.flatMap((t) => (ts.isIdentifier(t.expression) ? [t.expression.text] : [])),
    );
    if (of.length) found.push({ name: node.name.text, of });
  });
  return found;
}

/** Every type a file declares, so a parameter type can be traced to its file and its fields. */
export function findTypeDeclarations(sf: ts.SourceFile, file: string): { name: string; file: string; node: ts.Node }[] {
  const found: { name: string; file: string; node: ts.Node }[] = [];
  walk(sf, (node) => {
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      found.push({ name: node.name.text, file, node });
    }
  });
  return found;
}

const KEYWORD_KINDS = new Map<ts.SyntaxKind, Field['kind']>([
  [ts.SyntaxKind.BooleanKeyword, 'boolean'],
  [ts.SyntaxKind.NumberKeyword, 'number'],
  [ts.SyntaxKind.StringKeyword, 'string'],
]);

/** How far a type reference is followed before the answer is `opaque`. It stops a cycle. */
const MAX_TYPE_HOPS = 6;

/** The prefix operator of a negative numeric literal. */
const NEGATIVE = new Set<ts.SyntaxKind>([ts.SyntaxKind.MinusToken]);

function literalValue(node: ts.Node): string | number | boolean | undefined {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && NEGATIVE.has(node.operator) && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  return undefined;
}

/**
 * One field of a shape, from its type node. Every branch that is not certain answers `opaque`,
 * which the solver reads as "do not change this field".
 */
export function fieldFor(typeNode: ts.TypeNode | undefined, resolve: (name: string) => ts.TypeNode | null, hops = 0): Field {
  if (!typeNode) return { kind: 'opaque' };
  const keyword = KEYWORD_KINDS.get(typeNode.kind);
  if (keyword) return { kind: keyword };
  if (ts.isUnionTypeNode(typeNode)) {
    const present = typeNode.types.filter((t) => !isNullish(t));
    const nullable = present.length !== typeNode.types.length;
    const inner = unionField(present, resolve, hops);
    if (!inner) return { kind: 'opaque' };
    return nullable ? { kind: 'nullable', of: inner } : inner;
  }
  if (ts.isTypeReferenceNode(typeNode) && hops < MAX_TYPE_HOPS) {
    const name = referencedName(typeNode);
    const aliased = name ? resolve(name) : null;
    if (aliased) return fieldFor(aliased, resolve, hops + 1);
  }
  return { kind: 'opaque' };
}

function unionField(present: ts.TypeNode[], resolve: (name: string) => ts.TypeNode | null, hops: number): Field | null {
  if (present.length === 0) return null;
  if (present.length === 1) {
    const only = fieldFor(present[0], resolve, hops);
    return only.kind === 'nullable' ? { kind: 'opaque' } : only;
  }
  const values = present.map((t) => (ts.isLiteralTypeNode(t) ? literalValue(t.literal) : undefined));
  if (values.every((v) => v !== undefined)) return { kind: 'enum', values };
  return { kind: 'opaque' };
}

/** The property signatures a declaration contributes, through `extends` and `&`. */
function membersOf(node: ts.Node | null | undefined, resolveDecl: (name: string) => ts.Node | null, seen = new Set<ts.Node>()): ts.TypeElement[] {
  if (!node) return [];
  if (ts.isInterfaceDeclaration(node)) {
    if (seen.has(node)) return [];
    seen.add(node);
    const inherited = (node.heritageClauses ?? []).flatMap((clause) =>
      clause.types.flatMap((t) => (ts.isIdentifier(t.expression) ? membersOf(resolveDecl(t.expression.text), resolveDecl, seen) : [])),
    );
    return [...inherited, ...node.members];
  }
  if (ts.isTypeAliasDeclaration(node)) {
    if (seen.has(node)) return [];
    seen.add(node);
    return membersOf(node.type, resolveDecl, seen);
  }
  if (ts.isTypeLiteralNode(node)) return [...node.members];
  if (ts.isParenthesizedTypeNode(node)) return membersOf(node.type, resolveDecl, seen);
  // An intersection contributes every part. A union does not: its members disagree about what exists.
  if (ts.isIntersectionTypeNode(node)) return node.types.flatMap((t) => membersOf(t, resolveDecl, seen));
  if (ts.isTypeReferenceNode(node)) {
    const name = referencedName(node);
    return name ? membersOf(resolveDecl(name), resolveDecl, seen) : [];
  }
  return [];
}

/**
 * The shape the solver makes candidates from, or null when the type has nothing to vary: a
 * primitive parameter, or a type whose every field is `opaque`.
 */
export function shapeFor(typeName: string, declaration: ts.Node | null, resolveDecl: (name: string) => ts.Node | null): Shape | null {
  const members = membersOf(declaration, resolveDecl);
  const resolveType = (name: string): ts.TypeNode | null => {
    const found = resolveDecl(name);
    return found && ts.isTypeAliasDeclaration(found) ? found.type : null;
  };
  const fields: Record<string, Field> = {};
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
    const field = fieldFor(member.type, resolveType);
    // A later part of an intersection wins.
    fields[member.name.text] = member.questionToken ? { ...field, optional: true } : field;
  }
  const names = Object.keys(fields);
  if (names.length === 0 || names.every((n) => fields[n]?.kind === 'opaque')) return null;
  return { type: typeName, fields };
}

const RELATIONAL = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/**
 * The constants a function compares against. A relational comparison gives its numeric literals
 * as values and its identifiers as names, which the runner resolves in the page. An equality gives
 * its numeric literals only: `state === 'done'` holds no number.
 */
export function pivotsIn(fn: ts.Node): Pivots {
  const literals = new Set<number>();
  const names = new Set<string>();
  walk(fn, (node) => {
    if (!ts.isBinaryExpression(node)) return;
    const relational = RELATIONAL.has(node.operatorToken.kind);
    if (!relational && !EQUALITY.has(node.operatorToken.kind)) return;
    for (const side of [node.left, node.right]) {
      const value = literalValue(side);
      if (typeof value === 'number') literals.add(value);
      else if (relational && ts.isIdentifier(side)) names.add(side.text);
    }
  });
  return { literals: [...literals].sort((a, b) => a - b), names: [...names].sort() };
}

function partsOf(name: string, composedOf: ReadonlyMap<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const queue = [...(composedOf.get(name) ?? [])];
  while (queue.length) {
    const next = queue.pop() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...(composedOf.get(next) ?? []));
  }
  return seen;
}

/** The result of a scan: the inventory, and every problem found on the way. */
export interface ScanResult {
  inventory: Inventory;
  problems: ScanProblem[];
}

/**
 * The inventory from file contents. Pure and without I/O. `sources` declare the unions and hold the
 * sites. `extraTypes` only name the file and the fields of a parameter type. Problems are returned,
 * not thrown, so `lw qa check` can report each one (spec 2.14 rule C1).
 */
export function analyzeSources(input: { sources: SourceText[]; extraTypes?: SourceText[]; roots: string[]; generated: string }): ScanResult {
  const { sources, extraTypes = [], roots, generated } = input;
  const parsed = sources.map(({ file, text }) => ({ file, sf: parseSource(file, text) }));
  const problems: ScanProblem[] = [];

  // A name declared in two files resolves to nothing rather than to the first file read.
  const declaredIn = new Map<string, { file: string; node: ts.Node } | null>();
  for (const { file, sf } of [...parsed, ...extraTypes.map(({ file, text }) => ({ file, sf: parseSource(file, text) }))]) {
    for (const decl of findTypeDeclarations(sf, file)) {
      const seen = declaredIn.get(decl.name);
      if (seen === undefined) declaredIn.set(decl.name, decl);
      else if (seen === null || seen.file !== file) declaredIn.set(decl.name, null);
    }
  }
  const resolver: TypeResolver = {
    fileOf: (name) => declaredIn.get(name)?.file ?? null,
    declOf: (name) => declaredIn.get(name)?.node ?? null,
  };

  const unions = new Map<string, DeclaredUnion>();
  for (const { file, sf } of parsed) {
    const found = findUnions(sf, file);
    problems.push(...found.problems);
    for (const union of found.unions) {
      const clash = unions.get(union.name);
      if (clash) {
        problems.push({
          code: 'duplicate-union',
          file,
          line: union.line,
          union: union.name,
          message: `Two state unions are named "${union.name}": ${clash.file}:${clash.line} and ${file}:${union.line}. Rename one.`,
        });
        continue;
      }
      unions.set(union.name, union);
    }
  }
  const members = flattenUnions(unions);
  const names = new Set(members.keys());

  const composedOf = new Map<string, string[]>();
  const candidates: { component: string; componentFile: string; propsType: string }[] = [];
  const inputs: RawInput[] = [];
  const outputs: RawOutput[] = [];
  for (const { file, sf } of parsed) {
    for (const { name, of } of findTypeComposition(sf)) composedOf.set(name, [...(composedOf.get(name) ?? []), ...of]);
    candidates.push(...findComponentCandidates(sf, file));
    inputs.push(...findInputSites(sf, file, names));
    outputs.push(...findOutputSites(sf, file, names, resolver, problems));
  }
  candidates.sort((a, b) => a.componentFile.localeCompare(b.componentFile) || a.component.localeCompare(b.component));
  const componentFor = (holder: string) =>
    candidates.find((c) => c.propsType === holder || partsOf(c.propsType, composedOf).has(holder)) ?? null;

  const sitesFor = (name: string): { inputs: InputSite[]; outputs: OutputSite[] } => ({
    inputs: inputs
      .filter((i) => i.union === name)
      .sort((a, b) => a.file.localeCompare(b.file) || a.field.localeCompare(b.field))
      .map(({ union: _u, ...site }) => {
        const component = componentFor(site.interface);
        return { ...site, component: component?.component ?? null, componentFile: component?.componentFile ?? null };
      }),
    outputs: outputs
      .filter((o) => o.union === name)
      .sort((a, b) => a.file.localeCompare(b.file) || a.fn.localeCompare(b.fn))
      .map(({ union: _u, ...site }) => site),
  });

  // A union with no site of its own, absorbed by another union, gets no entry: each of its states
  // is reached through the absorbing union, and the denominator counts each state once. A
  // referenced union with its own site keeps its entry: two components are two renderings.
  const absorbed = new Set<string>();
  for (const name of names) {
    for (const ref of referencedUnions(name, unions)) {
      if (ref === name || !names.has(ref)) continue;
      const site = sitesFor(ref);
      if (site.inputs.length === 0 && site.outputs.length === 0) absorbed.add(ref);
    }
  }

  const declaration = (name: string): DeclaredUnion => unions.get(name) as DeclaredUnion;
  const membersOfUnion = (name: string): string[] => members.get(name) ?? [];

  const ignored: IgnoredEntry[] = [...names]
    .filter((name) => declaration(name).reason !== null)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      file: declaration(name).file,
      line: declaration(name).line,
      members: membersOfUnion(name),
      reason: declaration(name).reason as string,
    }));
  const isIgnored = new Set(ignored.map((u) => u.name));

  const entries: UnionEntry[] = [...names]
    .filter((name) => !absorbed.has(name) && !isIgnored.has(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const mine = sitesFor(name);
      const flattens = [...referencedUnions(name, unions)]
        .filter((ref) => absorbed.has(ref))
        .sort()
        .map((ref) => ({ name: ref, file: declaration(ref).file, line: declaration(ref).line, members: membersOfUnion(ref) }));
      return {
        name,
        file: declaration(name).file,
        line: declaration(name).line,
        members: membersOfUnion(name),
        kind: kindFor(mine.inputs, mine.outputs),
        flattens,
        inputs: mine.inputs,
        outputs: mine.outputs,
        components: [...new Set(mine.inputs.flatMap((i) => (i.component ? [i.component] : [])))],
      };
    });

  const inventory: Inventory = { generated, roots, unions: entries, ignored };
  const errors = validateInventory(inventory);
  if (errors.length > 0) {
    throw new LaunchwrightError('qa.states.inventory', `The scan produced an invalid inventory:\n  ${errors.join('\n  ')}`, { context: { errors } });
  }
  return { inventory, problems };
}

/** Every product source under one project-relative folder, project-relative and sorted. */
export function readTree(projectRoot: string, dir: string): SourceText[] {
  const absolute = join(projectRoot, dir);
  if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) {
    throw new LaunchwrightError('qa.states.root', `${dir} is not a folder under ${projectRoot}. Check qa.clientRoots and qa.typeRoots.`, { context: { dir } });
  }
  const files: SourceText[] = [];
  const visit = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') visit(child);
        continue;
      }
      const rel = relative(projectRoot, child).split(/[\\/]/).join('/');
      if (isProductSource(rel)) files.push({ file: rel, text: readFileSync(child, 'utf8') });
    }
  };
  visit(absolute);
  return files;
}

/** Scans a project: every client root, plus the type roots for parameter shapes. */
export function scanProject(projectRoot: string, options: { clientRoots: string[]; typeRoots?: string[]; generated: string }): ScanResult & { sources: SourceText[] } {
  const sources = options.clientRoots.flatMap((dir) => readTree(projectRoot, dir));
  const extraTypes = (options.typeRoots ?? []).flatMap((dir) => readTree(projectRoot, dir));
  return { ...analyzeSources({ sources, extraTypes, roots: options.clientRoots, generated: options.generated }), sources };
}
