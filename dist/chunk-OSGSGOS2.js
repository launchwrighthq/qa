import {
  IGNORE_TAG,
  isStateUnionName,
  kindFor,
  mechanismFor,
  solveSite,
  validateInventory,
  validateShape
} from "./chunk-42WWWMVO.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/states/services/scan.mts
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import ts from "typescript";
function isProductSource(rel) {
  if (!/\.(tsx?|mts)$/.test(rel) || /\.d\.m?ts$/.test(rel)) return false;
  const segments = rel.split("/");
  const base = segments[segments.length - 1] ?? "";
  if (/\.(test|spec)\.(tsx?|mts)$/.test(base)) return false;
  return !segments.some((s) => s === "__tests__" || s === "__mocks__" || s === "node_modules");
}
function parseSource(rel, text) {
  return ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true, rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}
function isExported(node) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}
function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}
function referencedName(typeNode) {
  return typeNode && ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName) ? typeNode.typeName.text : null;
}
function isNullish(typeNode) {
  return ts.isLiteralTypeNode(typeNode) && typeNode.literal.kind === ts.SyntaxKind.NullKeyword || typeNode.kind === ts.SyntaxKind.UndefinedKeyword;
}
function unionParts(typeNode) {
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) return null;
  const parts = [];
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
function ignoreReason(node, file, sf) {
  const tags = ts.getJSDocTags(node).filter((t) => t.tagName.text === IGNORE_TAG);
  if (tags.length === 0) return { reason: null, problem: null };
  const name = ts.isTypeAliasDeclaration(node) ? node.name.text : "<declaration>";
  const line = lineOf(sf, node);
  if (tags.length > 1) {
    return {
      reason: null,
      problem: { code: "ignore-repeated", file, line, union: name, message: `${file}:${line} "${name}" carries ${tags.length} @${IGNORE_TAG} tags. It may carry one.` }
    };
  }
  const [tag] = tags;
  const text = (ts.getTextOfJSDocComment(tag?.comment) ?? "").replace(/\s+/g, " ").trim();
  const directive = /^ignore(?:\s+(.*))?$/.exec(text);
  if (!directive) {
    return {
      reason: null,
      problem: {
        code: "ignore-directive",
        file,
        line,
        union: name,
        message: `${file}:${line} "${name}" has @${IGNORE_TAG} "${text}". The only directive is "ignore <reason>".`
      }
    };
  }
  const reason = (directive[1] ?? "").trim();
  if (!reason) {
    return {
      reason: null,
      problem: {
        code: "ignore-without-reason",
        file,
        line,
        union: name,
        message: `${file}:${line} "${name}" is marked @${IGNORE_TAG} ignore with no reason. A reason is required (spec 2.14 rule C1).`
      }
    };
  }
  return { reason, problem: null };
}
function findUnions(sf, file) {
  const unions = [];
  const problems = [];
  walk(sf, (node) => {
    if (!ts.isTypeAliasDeclaration(node) || !isExported(node) || !isStateUnionName(node.name.text)) return;
    const { reason, problem } = ignoreReason(node, file, sf);
    if (problem) problems.push(problem);
    const parts = unionParts(node.type);
    if (parts) unions.push({ name: node.name.text, file, line: lineOf(sf, node), parts, reason });
  });
  return { unions, problems };
}
function flattenUnions(declared) {
  const resolved = /* @__PURE__ */ new Map();
  for (let pass = 0; pass <= declared.size; pass += 1) {
    let progress = false;
    for (const [name, declaration] of declared) {
      if (resolved.has(name)) continue;
      const members = [];
      let complete = true;
      for (const part of declaration.parts) {
        if ("literal" in part) {
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
function referencedUnions(name, declared, seen = /* @__PURE__ */ new Set()) {
  for (const part of declared.get(name)?.parts ?? []) {
    if (!("ref" in part) || seen.has(part.ref)) continue;
    seen.add(part.ref);
    referencedUnions(part.ref, declared, seen);
  }
  return seen;
}
function holderOf(prop) {
  const parent = prop.parent;
  if (ts.isInterfaceDeclaration(parent)) return parent.name.text;
  if (!ts.isTypeLiteralNode(parent)) return null;
  let node = parent;
  while (node.parent && (ts.isUnionTypeNode(node.parent) || ts.isIntersectionTypeNode(node.parent) || ts.isParenthesizedTypeNode(node.parent))) {
    node = node.parent;
  }
  return node.parent && ts.isTypeAliasDeclaration(node.parent) ? node.parent.name.text : null;
}
function propertyName(prop, sf) {
  return ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText(sf);
}
function findInputSites(sf, file, names) {
  const found = [];
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
function returnsUnion(typeNode, names) {
  if (typeNode && ts.isTypeReferenceNode(typeNode) && referencedName(typeNode) === "Promise" && typeNode.typeArguments?.length === 1) {
    const awaited = returnsUnion(typeNode.typeArguments[0], names);
    return awaited ? { ...awaited, async: true } : null;
  }
  const direct = referencedName(typeNode);
  if (direct && names.has(direct)) return { union: direct, nullable: false, async: false };
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) return null;
  let union = null;
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
function functionLike(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { name: node.name.text, fn: node, declaredType: void 0, exported: isExported(node) };
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
    const statement = node.parent?.parent;
    return { name: node.name.text, fn: node.initializer, declaredType: node.type, exported: Boolean(statement && isExported(statement)) };
  }
  return null;
}
function reExportedNames(sf) {
  const names = /* @__PURE__ */ new Set();
  walk(sf, (node) => {
    if (!ts.isExportDeclaration(node) || !node.exportClause || !ts.isNamedExports(node.exportClause) || node.moduleSpecifier) return;
    for (const element of node.exportClause.elements) names.add((element.propertyName ?? element.name).text);
  });
  return names;
}
var NO_TYPES = { fileOf: () => null, declOf: () => null };
function paramSite(param, sf, file, resolver, problems) {
  const name = ts.isIdentifier(param.name) ? param.name.text : param.name.getText(sf);
  const referenced = referencedName(param.type);
  const type = referenced ?? (param.type ? param.type.getText(sf) : "unknown");
  const declaration = referenced ? resolver.declOf(referenced) : param.type ?? null;
  let shape = shapeFor(type, declaration, (n) => resolver.declOf(n));
  const errors = shape ? validateShape(shape) : [];
  if (errors.length > 0) {
    problems.push({ code: "invalid-shape", file, line: lineOf(sf, param), union: type, message: `The shape derived for "${type}" is invalid: ${errors.join("; ")}` });
    shape = null;
  }
  return { name, type, typeFile: referenced ? resolver.fileOf(referenced) : null, shape };
}
function findOutputSites(sf, file, names, resolver = NO_TYPES, problems = []) {
  const found = [];
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
      params
    });
  });
  return found;
}
function componentPropsType({ fn, declaredType }) {
  if (declaredType && ts.isTypeReferenceNode(declaredType) && declaredType.typeArguments?.length === 1) {
    const argument = referencedName(declaredType.typeArguments[0]);
    if (argument) return argument;
  }
  return fn.parameters.length === 1 ? referencedName(fn.parameters[0]?.type) : null;
}
function findComponentCandidates(sf, file) {
  if (!file.endsWith(".tsx")) return [];
  const found = [];
  walk(sf, (node) => {
    const candidate = functionLike(node);
    if (!candidate || !/^[A-Z]/.test(candidate.name)) return;
    const propsType = componentPropsType(candidate);
    if (propsType) found.push({ component: candidate.name, componentFile: file, propsType });
  });
  return found;
}
function findTypeComposition(sf) {
  const found = [];
  const namesIn = (typeNode) => {
    if (!typeNode) return [];
    if (ts.isParenthesizedTypeNode(typeNode)) return namesIn(typeNode.type);
    if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) return typeNode.types.flatMap(namesIn);
    const name = referencedName(typeNode);
    return name ? [name] : [];
  };
  walk(sf, (node) => {
    if (ts.isTypeAliasDeclaration(node)) {
      const of2 = namesIn(node.type);
      if (of2.length) found.push({ name: node.name.text, of: of2 });
      return;
    }
    if (!ts.isInterfaceDeclaration(node)) return;
    const of = (node.heritageClauses ?? []).flatMap(
      (clause) => clause.types.flatMap((t) => ts.isIdentifier(t.expression) ? [t.expression.text] : [])
    );
    if (of.length) found.push({ name: node.name.text, of });
  });
  return found;
}
function findTypeDeclarations(sf, file) {
  const found = [];
  walk(sf, (node) => {
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      found.push({ name: node.name.text, file, node });
    }
  });
  return found;
}
var KEYWORD_KINDS = /* @__PURE__ */ new Map([
  [ts.SyntaxKind.BooleanKeyword, "boolean"],
  [ts.SyntaxKind.NumberKeyword, "number"],
  [ts.SyntaxKind.StringKeyword, "string"]
]);
var MAX_TYPE_HOPS = 6;
var NEGATIVE = /* @__PURE__ */ new Set([ts.SyntaxKind.MinusToken]);
function literalValue(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && NEGATIVE.has(node.operator) && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  return void 0;
}
function fieldFor(typeNode, resolve, hops = 0) {
  if (!typeNode) return { kind: "opaque" };
  const keyword = KEYWORD_KINDS.get(typeNode.kind);
  if (keyword) return { kind: keyword };
  if (ts.isUnionTypeNode(typeNode)) {
    const present = typeNode.types.filter((t) => !isNullish(t));
    const nullable = present.length !== typeNode.types.length;
    const inner = unionField(present, resolve, hops);
    if (!inner) return { kind: "opaque" };
    return nullable ? { kind: "nullable", of: inner } : inner;
  }
  if (ts.isTypeReferenceNode(typeNode) && hops < MAX_TYPE_HOPS) {
    const name = referencedName(typeNode);
    const aliased = name ? resolve(name) : null;
    if (aliased) return fieldFor(aliased, resolve, hops + 1);
  }
  return { kind: "opaque" };
}
function unionField(present, resolve, hops) {
  if (present.length === 0) return null;
  if (present.length === 1) {
    const only = fieldFor(present[0], resolve, hops);
    return only.kind === "nullable" ? { kind: "opaque" } : only;
  }
  const values = present.map((t) => ts.isLiteralTypeNode(t) ? literalValue(t.literal) : void 0);
  if (values.every((v) => v !== void 0)) return { kind: "enum", values };
  return { kind: "opaque" };
}
function membersOf(node, resolveDecl, seen = /* @__PURE__ */ new Set()) {
  if (!node) return [];
  if (ts.isInterfaceDeclaration(node)) {
    if (seen.has(node)) return [];
    seen.add(node);
    const inherited = (node.heritageClauses ?? []).flatMap(
      (clause) => clause.types.flatMap((t) => ts.isIdentifier(t.expression) ? membersOf(resolveDecl(t.expression.text), resolveDecl, seen) : [])
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
  if (ts.isIntersectionTypeNode(node)) return node.types.flatMap((t) => membersOf(t, resolveDecl, seen));
  if (ts.isTypeReferenceNode(node)) {
    const name = referencedName(node);
    return name ? membersOf(resolveDecl(name), resolveDecl, seen) : [];
  }
  return [];
}
function shapeFor(typeName, declaration, resolveDecl) {
  const members = membersOf(declaration, resolveDecl);
  const resolveType = (name) => {
    const found = resolveDecl(name);
    return found && ts.isTypeAliasDeclaration(found) ? found.type : null;
  };
  const fields = {};
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
    const field = fieldFor(member.type, resolveType);
    fields[member.name.text] = member.questionToken ? { ...field, optional: true } : field;
  }
  const names = Object.keys(fields);
  if (names.length === 0 || names.every((n) => fields[n]?.kind === "opaque")) return null;
  return { type: typeName, fields };
}
var RELATIONAL = /* @__PURE__ */ new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken
]);
var EQUALITY = /* @__PURE__ */ new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken
]);
function pivotsIn(fn) {
  const literals = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Set();
  walk(fn, (node) => {
    if (!ts.isBinaryExpression(node)) return;
    const relational = RELATIONAL.has(node.operatorToken.kind);
    if (!relational && !EQUALITY.has(node.operatorToken.kind)) return;
    for (const side of [node.left, node.right]) {
      const value = literalValue(side);
      if (typeof value === "number") literals.add(value);
      else if (relational && ts.isIdentifier(side)) names.add(side.text);
    }
  });
  return { literals: [...literals].sort((a, b) => a - b), names: [...names].sort() };
}
function partsOf(name, composedOf) {
  const seen = /* @__PURE__ */ new Set();
  const queue = [...composedOf.get(name) ?? []];
  while (queue.length) {
    const next = queue.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...composedOf.get(next) ?? []);
  }
  return seen;
}
function analyzeSources(input) {
  const { sources, extraTypes = [], roots, generated } = input;
  const parsed = sources.map(({ file, text }) => ({ file, sf: parseSource(file, text) }));
  const problems = [];
  const declaredIn = /* @__PURE__ */ new Map();
  for (const { file, sf } of [...parsed, ...extraTypes.map(({ file: file2, text }) => ({ file: file2, sf: parseSource(file2, text) }))]) {
    for (const decl of findTypeDeclarations(sf, file)) {
      const seen = declaredIn.get(decl.name);
      if (seen === void 0) declaredIn.set(decl.name, decl);
      else if (seen === null || seen.file !== file) declaredIn.set(decl.name, null);
    }
  }
  const resolver = {
    fileOf: (name) => declaredIn.get(name)?.file ?? null,
    declOf: (name) => declaredIn.get(name)?.node ?? null
  };
  const unions = /* @__PURE__ */ new Map();
  for (const { file, sf } of parsed) {
    const found = findUnions(sf, file);
    problems.push(...found.problems);
    for (const union of found.unions) {
      const clash = unions.get(union.name);
      if (clash) {
        problems.push({
          code: "duplicate-union",
          file,
          line: union.line,
          union: union.name,
          message: `Two state unions are named "${union.name}": ${clash.file}:${clash.line} and ${file}:${union.line}. Rename one.`
        });
        continue;
      }
      unions.set(union.name, union);
    }
  }
  const members = flattenUnions(unions);
  const names = new Set(members.keys());
  const composedOf = /* @__PURE__ */ new Map();
  const candidates = [];
  const inputs = [];
  const outputs = [];
  for (const { file, sf } of parsed) {
    for (const { name, of } of findTypeComposition(sf)) composedOf.set(name, [...composedOf.get(name) ?? [], ...of]);
    candidates.push(...findComponentCandidates(sf, file));
    inputs.push(...findInputSites(sf, file, names));
    outputs.push(...findOutputSites(sf, file, names, resolver, problems));
  }
  candidates.sort((a, b) => a.componentFile.localeCompare(b.componentFile) || a.component.localeCompare(b.component));
  const componentFor = (holder) => candidates.find((c) => c.propsType === holder || partsOf(c.propsType, composedOf).has(holder)) ?? null;
  const sitesFor = (name) => ({
    inputs: inputs.filter((i) => i.union === name).sort((a, b) => a.file.localeCompare(b.file) || a.field.localeCompare(b.field)).map(({ union: _u, ...site }) => {
      const component = componentFor(site.interface);
      return { ...site, component: component?.component ?? null, componentFile: component?.componentFile ?? null };
    }),
    outputs: outputs.filter((o) => o.union === name).sort((a, b) => a.file.localeCompare(b.file) || a.fn.localeCompare(b.fn)).map(({ union: _u, ...site }) => site)
  });
  const absorbed = /* @__PURE__ */ new Set();
  for (const name of names) {
    for (const ref of referencedUnions(name, unions)) {
      if (ref === name || !names.has(ref)) continue;
      const site = sitesFor(ref);
      if (site.inputs.length === 0 && site.outputs.length === 0) absorbed.add(ref);
    }
  }
  const declaration = (name) => unions.get(name);
  const membersOfUnion = (name) => members.get(name) ?? [];
  const ignored = [...names].filter((name) => declaration(name).reason !== null).sort((a, b) => a.localeCompare(b)).map((name) => ({
    name,
    file: declaration(name).file,
    line: declaration(name).line,
    members: membersOfUnion(name),
    reason: declaration(name).reason
  }));
  const isIgnored = new Set(ignored.map((u) => u.name));
  const entries = [...names].filter((name) => !absorbed.has(name) && !isIgnored.has(name)).sort((a, b) => a.localeCompare(b)).map((name) => {
    const mine = sitesFor(name);
    const flattens = [...referencedUnions(name, unions)].filter((ref) => absorbed.has(ref)).sort().map((ref) => ({ name: ref, file: declaration(ref).file, line: declaration(ref).line, members: membersOfUnion(ref) }));
    return {
      name,
      file: declaration(name).file,
      line: declaration(name).line,
      members: membersOfUnion(name),
      kind: kindFor(mine.inputs, mine.outputs),
      flattens,
      inputs: mine.inputs,
      outputs: mine.outputs,
      components: [...new Set(mine.inputs.flatMap((i) => i.component ? [i.component] : []))]
    };
  });
  const inventory = { generated, roots, unions: entries, ignored };
  const errors = validateInventory(inventory);
  if (errors.length > 0) {
    throw new LaunchwrightError("qa.states.inventory", `The scan produced an invalid inventory:
  ${errors.join("\n  ")}`, { context: { errors } });
  }
  return { inventory, problems };
}
function readTree(projectRoot, dir) {
  const absolute = join(projectRoot, dir);
  if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) {
    throw new LaunchwrightError("qa.states.root", `${dir} is not a folder under ${projectRoot}. Check qa.clientRoots and qa.typeRoots.`, { context: { dir } });
  }
  const files = [];
  const visit = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") visit(child);
        continue;
      }
      const rel = relative(projectRoot, child).split(/[\\/]/).join("/");
      if (isProductSource(rel)) files.push({ file: rel, text: readFileSync(child, "utf8") });
    }
  };
  visit(absolute);
  return files;
}
function scanProject(projectRoot, options) {
  const sources = options.clientRoots.flatMap((dir) => readTree(projectRoot, dir));
  const extraTypes = (options.typeRoots ?? []).flatMap((dir) => readTree(projectRoot, dir));
  return { ...analyzeSources({ sources, extraTypes, roots: options.clientRoots, generated: options.generated }), sources };
}

// src/states/services/delivery.mts
import { posix } from "path";
import ts2 from "typescript";
function normaliseTables(entries) {
  return entries.map((entry) => typeof entry === "string" ? { file: entry, surface: "web" } : entry);
}
var MAX_HOPS = 4;
function importSpecifiers(sf) {
  const found = [];
  const visit = (node) => {
    if ((ts2.isImportDeclaration(node) || ts2.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts2.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    } else if (ts2.isCallExpression(node) && node.expression.kind === ts2.SyntaxKind.ImportKeyword) {
      const [first] = node.arguments;
      if (first && ts2.isStringLiteral(first)) found.push(first.text);
    }
    ts2.forEachChild(node, visit);
  };
  visit(sf);
  return [...new Set(found)];
}
var CANDIDATES = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx", "/index.mts"];
function resolveSpecifier(fromFile, specifier, files, aliases = {}) {
  let base = null;
  if (specifier.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  else {
    for (const alias of Object.keys(aliases).sort((a, b) => b.length - a.length)) {
      const dir = aliases[alias];
      if (specifier === alias) base = dir;
      else if (specifier.startsWith(`${alias}/`)) base = posix.normalize(`${dir}${specifier.slice(alias.length)}`);
      if (base !== null) break;
    }
  }
  if (base === null) return null;
  const stems = /\.[mc]?js$/.test(base) ? [base.replace(/\.([mc]?)js$/, ".$1ts"), base.replace(/\.[mc]?js$/, ""), base] : [base];
  for (const stem of stems) {
    for (const suffix of CANDIDATES) {
      const candidate = `${stem}${suffix}`;
      if (files.has(candidate)) return candidate;
    }
  }
  return null;
}
function buildGraph(sources, aliases = {}) {
  const parsed = new Map(sources.map(({ file, text }) => [file, parseSource(file, text)]));
  const files = new Set(parsed.keys());
  const edges = /* @__PURE__ */ new Map();
  for (const [file, sf] of parsed) {
    const out = [];
    for (const specifier of importSpecifiers(sf)) {
      const target = resolveSpecifier(file, specifier, files, aliases);
      if (target !== null && target !== file) out.push(target);
    }
    edges.set(file, [...new Set(out)]);
  }
  return { edges, parsed };
}
function reachFrom(edges, root) {
  const distance = /* @__PURE__ */ new Map([[root, 0]]);
  const queue = [root];
  while (queue.length > 0) {
    const at = queue.shift();
    const next = (distance.get(at) ?? 0) + 1;
    for (const to of edges.get(at) ?? []) {
      if (distance.has(to)) continue;
      distance.set(to, next);
      queue.push(to);
    }
  }
  return distance;
}
function objectVocabulary(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (ts2.isVariableDeclaration(node) && ts2.isIdentifier(node.name)) {
      let initializer = node.initializer;
      while (initializer && (ts2.isAsExpression(initializer) || ts2.isParenthesizedExpression(initializer) || ts2.isSatisfiesExpression(initializer))) {
        initializer = initializer.expression;
      }
      if (initializer && ts2.isObjectLiteralExpression(initializer)) {
        const paths = /* @__PURE__ */ new Map();
        for (const member of initializer.properties) {
          if (ts2.isPropertyAssignment(member) && ts2.isIdentifier(member.name) && (ts2.isStringLiteral(member.initializer) || ts2.isNoSubstitutionTemplateLiteral(member.initializer))) {
            paths.set(member.name.text, member.initializer.text);
          }
        }
        if (paths.size > 0) found.set(node.name.text, paths);
      }
    }
    ts2.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function localConstants(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (ts2.isVariableDeclaration(node) && ts2.isIdentifier(node.name) && node.initializer && !found.has(node.name.text)) {
      found.set(node.name.text, node.initializer);
    }
    ts2.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function localFunctions(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (ts2.isFunctionDeclaration(node) && node.name && node.body && !found.has(node.name.text)) found.set(node.name.text, node);
    ts2.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function fileScope(sf) {
  return { vocabulary: objectVocabulary(sf), constants: localConstants(sf), functions: localFunctions(sf), imported: () => null };
}
function moduleLinks(sf) {
  const named = /* @__PURE__ */ new Map();
  const star = [];
  for (const statement of sf.statements) {
    if (ts2.isImportDeclaration(statement) && statement.importClause && ts2.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause.name) named.set(clause.name.text, { specifier, name: "default" });
      if (clause.namedBindings && ts2.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) named.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
    if (ts2.isExportDeclaration(statement) && statement.moduleSpecifier && ts2.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (!statement.exportClause) star.push(specifier);
      else if (ts2.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) named.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
      }
    }
  }
  return { named, star };
}
function moduleScopes(parsed, resolve) {
  const made = /* @__PURE__ */ new Map();
  const scopeOf = (file) => {
    const held = made.get(file);
    if (held) return held;
    const sf = parsed.get(file);
    if (!sf) return null;
    const own = fileScope(sf);
    let links = null;
    const scope = {
      vocabulary: own.vocabulary,
      constants: own.constants,
      functions: own.functions,
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
          if (targetScope && (targetScope.constants.has(name) || targetScope.vocabulary.has(name) || targetScope.functions.has(name))) return { scope: targetScope, name };
        }
        return null;
      }
    };
    made.set(file, scope);
    return scope;
  };
  return scopeOf;
}
function declarationOf(scope, name, depth = 0) {
  if (depth > MAX_HOPS) return null;
  const local = scope.constants.get(name);
  if (local) return { expression: local, scope };
  const link = scope.imported(name);
  return link ? declarationOf(link.scope, link.name, depth + 1) : null;
}
function vocabularyOf(scope, name, depth = 0) {
  if (depth > MAX_HOPS) return null;
  const local = scope.vocabulary.get(name);
  if (local) return local;
  if (scope.constants.has(name)) return null;
  const link = scope.imported(name);
  return link ? vocabularyOf(link.scope, link.name, depth + 1) : null;
}
function functionOf(scope, name, depth = 0) {
  if (depth > MAX_HOPS) return null;
  const declared = scope.functions.get(name);
  if (declared) return { fn: declared, scope };
  let constant = scope.constants.get(name);
  while (constant && (ts2.isParenthesizedExpression(constant) || ts2.isAsExpression(constant) || ts2.isSatisfiesExpression(constant))) constant = constant.expression;
  if (constant) return ts2.isArrowFunction(constant) || ts2.isFunctionExpression(constant) ? { fn: constant, scope } : null;
  const link = scope.imported(name);
  return link ? functionOf(link.scope, link.name, depth + 1) : null;
}
function evaluateCondition(node, scope, depth, env) {
  if (ts2.isParenthesizedExpression(node)) return evaluateCondition(node.expression, scope, depth + 1, env);
  if (!ts2.isBinaryExpression(node)) return null;
  const op = node.operatorToken.kind;
  const equal = op === ts2.SyntaxKind.EqualsEqualsEqualsToken || op === ts2.SyntaxKind.EqualsEqualsToken;
  if (!equal && op !== ts2.SyntaxKind.ExclamationEqualsEqualsToken && op !== ts2.SyntaxKind.ExclamationEqualsToken) return null;
  const left = evaluatePath(node.left, scope, depth + 1, env);
  const right = evaluatePath(node.right, scope, depth + 1, env);
  if (left === null || right === null) return null;
  return equal ? left === right : left !== right;
}
function evaluateBody(body, scope, depth, env) {
  if (!ts2.isBlock(body) && !ts2.isReturnStatement(body) && !ts2.isIfStatement(body)) return ts2.isExpression(body) ? evaluatePath(body, scope, depth + 1, env) : null;
  const statements = ts2.isBlock(body) ? body.statements : [body];
  for (const statement of statements) {
    if (ts2.isReturnStatement(statement)) return evaluatePath(statement.expression, scope, depth + 1, env);
    if (!ts2.isIfStatement(statement)) return null;
    const taken = evaluateCondition(statement.expression, scope, depth, env);
    if (taken === null) return null;
    const branch = taken ? statement.thenStatement : statement.elseStatement;
    if (branch === void 0) continue;
    return evaluateBody(branch, scope, depth + 1, env);
  }
  return null;
}
function wrappedPath(call, inner, scope, depth, env) {
  const name = ts2.isIdentifier(call.expression) ? call.expression.text : ts2.isPropertyAccessExpression(call.expression) ? call.expression.name.text : null;
  if (name === null) return inner;
  const found = ts2.isIdentifier(call.expression) ? functionOf(scope, name) : null;
  const param = found?.fn.parameters[0]?.name;
  if (found && found.fn.body && param && ts2.isIdentifier(param)) {
    const out = evaluateBody(found.fn.body, found.scope, depth + 1, { ...env, bindings: /* @__PURE__ */ new Map([[param.text, inner]]) });
    if (out !== null && out.startsWith("/")) return out;
  }
  const prefix = env.wrappers?.[name];
  return prefix === void 0 ? inner : joinPath(prefix.replace(/\/+$/, ""), inner);
}
function evaluatePath(node, scope, depth = 0, env = {}) {
  if (!node || depth > MAX_HOPS * 4) return null;
  if (ts2.isStringLiteral(node) || ts2.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts2.isParenthesizedExpression(node) || ts2.isAsExpression(node) || ts2.isSatisfiesExpression(node)) return evaluatePath(node.expression, scope, depth + 1, env);
  if (ts2.isPropertyAccessExpression(node) && ts2.isIdentifier(node.expression)) {
    return vocabularyOf(scope, node.expression.text)?.get(node.name.text) ?? null;
  }
  if (ts2.isIdentifier(node)) {
    const bound = env.bindings?.get(node.text);
    if (bound !== void 0) return bound;
    const declared = declarationOf(scope, node.text);
    return declared ? evaluatePath(declared.expression, declared.scope, depth + 1, env) : null;
  }
  if (ts2.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const part = evaluatePath(span.expression, scope, depth + 1, env);
      if (part === null) return null;
      out += part + span.literal.text;
    }
    return out;
  }
  if (ts2.isBinaryExpression(node) && node.operatorToken.kind === ts2.SyntaxKind.PlusToken) {
    const left = evaluatePath(node.left, scope, depth + 1, env);
    const right = left === null ? null : evaluatePath(node.right, scope, depth + 1, env);
    return left === null || right === null ? null : left + right;
  }
  if (ts2.isConditionalExpression(node)) {
    const taken = evaluateCondition(node.condition, scope, depth, env);
    return taken === null ? null : evaluatePath(taken ? node.whenTrue : node.whenFalse, scope, depth + 1, env);
  }
  if (ts2.isCallExpression(node) && node.arguments.length === 1) {
    const inner = evaluatePath(node.arguments[0], scope, depth + 1, env);
    return inner !== null && inner.startsWith("/") ? wrappedPath(node, inner, scope, depth, env) : null;
  }
  return null;
}
function isDynamicPath(path) {
  return path.split("/").some((segment) => segment.startsWith(":") && !segment.endsWith("?"));
}
function groupPrefix(node, scope, env) {
  const prefixes = [];
  let at = node.parent;
  while (at) {
    if (ts2.isCallExpression(at) && ts2.isPropertyAccessExpression(at.expression) && at.expression.name.text === "group") {
      const [options] = at.arguments;
      if (options && ts2.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (ts2.isPropertyAssignment(property) && ts2.isIdentifier(property.name) && property.name.text === "prefix") {
            const value = evaluatePath(property.initializer, scope, 0, env);
            if (value) prefixes.unshift(value.replace(/\/+$/, ""));
          }
        }
      }
    }
    at = at.parent;
  }
  return prefixes.join("");
}
function joinPath(prefix, path) {
  if (prefix === "") return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}
function routeRows(sf, scope = fileScope(sf), env = {}) {
  const rows = [];
  const push = (pathNode, component, pageName, prefix, at = scope) => {
    const raw = evaluatePath(pathNode, at, 0, env);
    if (raw === "*") return;
    const path = raw === null ? null : joinPath(prefix, raw);
    rows.push({ path, component, pageName, source: pathNode ? pathNode.getText(pathNode.getSourceFile()) : "<no path>", dynamic: path === null ? false : isDynamicPath(path) });
  };
  const visit = (node) => {
    if (ts2.isCallExpression(node) && ts2.isPropertyAccessExpression(node.expression) && node.expression.name.text === "page" && node.arguments.length >= 2) {
      const [pathNode, nameNode] = node.arguments;
      const pageName = nameNode && (ts2.isStringLiteral(nameNode) || ts2.isNoSubstitutionTemplateLiteral(nameNode)) ? nameNode.text : null;
      push(pathNode ?? null, null, pageName, groupPrefix(node, scope, env));
    }
    const opening = ts2.isJsxSelfClosingElement(node) ? node : ts2.isJsxElement(node) ? node.openingElement : null;
    if (opening && ts2.isIdentifier(opening.tagName) && opening.tagName.text === "Route") {
      const attributes = /* @__PURE__ */ new Map();
      for (const attribute of opening.attributes.properties) {
        if (!ts2.isJsxAttribute(attribute) || !ts2.isIdentifier(attribute.name) || !attribute.initializer) continue;
        const value = attribute.initializer;
        attributes.set(attribute.name.text, ts2.isJsxExpression(value) ? value.expression ?? null : ts2.isStringLiteral(value) ? value : null);
      }
      const componentNode = attributes.get("component") ?? null;
      const component = componentNode && ts2.isIdentifier(componentNode) ? componentNode.text : null;
      const pathNode = attributes.get("path") ?? null;
      const declared = pathNode && ts2.isIdentifier(pathNode) ? declarationOf(scope, pathNode.text) : null;
      if (declared && ts2.isArrayLiteralExpression(declared.expression)) for (const one of declared.expression.elements) push(one, component, null, "", declared.scope);
      else if (pathNode && ts2.isArrayLiteralExpression(pathNode)) for (const one of pathNode.elements) push(one, component, null, "");
      else push(pathNode, component, null, "");
    }
    ts2.forEachChild(node, visit);
  };
  visit(sf);
  return rows;
}
function importedNames(sf) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
    if (ts2.isImportDeclaration(node) && node.importClause && ts2.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (clause.name) found.set(clause.name.text, specifier);
      const bindings = clause.namedBindings;
      if (bindings && ts2.isNamespaceImport(bindings)) found.set(bindings.name.text, specifier);
      if (bindings && ts2.isNamedImports(bindings)) for (const element of bindings.elements) found.set(element.name.text, specifier);
    }
    ts2.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
function jsxTagsIn(node) {
  const found = /* @__PURE__ */ new Set();
  const visit = (child) => {
    const opening = ts2.isJsxSelfClosingElement(child) ? child : ts2.isJsxElement(child) ? child.openingElement : null;
    if (opening && ts2.isIdentifier(opening.tagName)) found.add(opening.tagName.text);
    ts2.forEachChild(child, visit);
  };
  visit(node);
  return found;
}
function localDeclarations(sf) {
  const found = new Map(localConstants(sf));
  for (const statement of sf.statements) {
    if (ts2.isFunctionDeclaration(statement) && statement.name && !found.has(statement.name.text)) found.set(statement.name.text, statement);
  }
  return found;
}
function localCalleesIn(node, locals) {
  const found = /* @__PURE__ */ new Set();
  const visit = (child) => {
    if (ts2.isCallExpression(child) && ts2.isIdentifier(child.expression) && locals.has(child.expression.text)) found.add(child.expression.text);
    ts2.forEachChild(child, visit);
  };
  visit(node);
  return found;
}
function componentPages(component, sf, resolve, seen = /* @__PURE__ */ new Set(), depth = 0) {
  if (component === null || seen.has(component) || depth > MAX_HOPS) return [];
  seen.add(component);
  const imports = importedNames(sf);
  const specifier = imports.get(component);
  if (specifier !== void 0) {
    const file = resolve(specifier);
    return file === null ? [] : [file];
  }
  const locals = localDeclarations(sf);
  const declaration = locals.get(component);
  if (!declaration) return [];
  const pages = [];
  for (const name of /* @__PURE__ */ new Set([...jsxTagsIn(declaration), ...localCalleesIn(declaration, locals)])) {
    if (name === component) continue;
    pages.push(...componentPages(name, sf, resolve, seen, depth + 1));
  }
  return [...new Set(pages)];
}
var PAGE_SUFFIXES = [".page.tsx", ".page.ts", ".page.mts", ".page.jsx"];
function pageFileFor(pageName, pageRoots, files) {
  for (const root of pageRoots) {
    for (const suffix of PAGE_SUFFIXES) {
      const candidate = posix.join(root, "pages", `${pageName}${suffix}`);
      if (files.has(candidate)) return candidate;
    }
  }
  return null;
}
function anchorFor(union) {
  const site = solveSite(union) ?? union.outputs[0] ?? null;
  return site?.file ?? union.file;
}
function noRouteReason(anchor, tables) {
  if (tables.every((t) => !t.found)) {
    return `no route table could be read (${tables.map((t) => t.file).join(", ") || "none configured"}), so no route was derived. Check qa.routeTables`;
  }
  if (tables.every((t) => t.rows === 0)) return "the route tables hold no page row, so no route was derived for anything";
  return `no page in the route tables reaches ${anchor} through the import graph. Either nothing mounts this code, or a component draws it that the tables reach in another way`;
}
function buildRouteMap(input) {
  const aliases = input.aliases ?? {};
  const { edges, parsed } = buildGraph(input.sources, aliases);
  const files = new Set(parsed.keys());
  const scopeOf = moduleScopes(parsed, (from, specifier) => resolveSpecifier(from, specifier, files, aliases));
  const tables = input.tables.map((table) => {
    const sf = parsed.get(table.file);
    if (!sf) return { table, found: false, routes: [] };
    const resolve = (specifier) => resolveSpecifier(table.file, specifier, files, aliases);
    const routes = routeRows(sf, scopeOf(table.file) ?? fileScope(sf), { wrappers: input.wrappers ?? {} }).map((row) => ({
      path: row.path,
      dynamic: row.dynamic,
      source: row.source,
      pages: row.pageName !== null ? [pageFileFor(row.pageName, input.pageRoots, files)].filter((f) => f !== null) : componentPages(row.component, sf, resolve)
    }));
    return { table, found: true, routes };
  });
  const summaries = tables.map(({ table, found, routes }) => ({
    file: table.file,
    surface: table.surface,
    found,
    rows: routes.length,
    resolved: routes.filter((r) => r.path !== null).length,
    unresolved: routes.filter((r) => r.path === null).map((r) => r.source),
    pageless: routes.filter((r) => r.path !== null && r.pages.length === 0).map((r) => r.path)
  }));
  const reach = /* @__PURE__ */ new Map();
  for (const { routes } of tables) for (const route of routes) for (const page of route.pages) if (!reach.has(page)) reach.set(page, reachFrom(edges, page));
  const unions = input.inventory.unions.map((union) => {
    const anchor = anchorFor(union);
    const found = [];
    for (const { table, routes } of tables) {
      for (const route of routes) {
        if (route.path === null) continue;
        let best = null;
        let page = null;
        for (const candidate of route.pages) {
          const distance = reach.get(candidate)?.get(anchor);
          if (distance === void 0) continue;
          if (best === null || distance < best) {
            best = distance;
            page = candidate;
          }
        }
        if (best === null || page === null) continue;
        found.push({ surface: table.surface, route: route.path, page, distance: best, dynamic: route.dynamic, reaches: reach.get(page)?.size ?? 0 });
      }
    }
    found.sort((a, b) => a.distance - b.distance || a.reaches - b.reaches || a.surface.localeCompare(b.surface) || a.route.localeCompare(b.route));
    return {
      union: union.name,
      kind: union.kind,
      mechanism: mechanismFor(union.kind),
      anchor,
      members: union.members,
      routes: found,
      ...found.length === 0 ? { why: noRouteReason(anchor, summaries) } : {}
    };
  });
  return { generated: input.generated, tables: summaries, unions };
}
function attachRoutes(inventory, map) {
  const byName = new Map(map.unions.map((u) => [u.union, u]));
  return {
    ...inventory,
    unions: inventory.unions.map((union) => {
      const mine = byName.get(union.name);
      if (!mine) return union;
      const next = { ...union, routes: mine.routes };
      if (mine.why === void 0) delete next.why;
      else next.why = mine.why;
      return next;
    })
  };
}
function aliasesFromTsconfig(text, dir) {
  const parsed = ts2.parseConfigFileTextToJson("tsconfig.json", text);
  const options = parsed.config?.compilerOptions;
  const base = posix.join(dir, options?.baseUrl ?? ".");
  const out = {};
  for (const [key, targets] of Object.entries(options?.paths ?? {})) {
    const [target] = targets;
    if (target === void 0) continue;
    const alias = key.replace(/\/\*$/, "");
    out[alias] = posix.normalize(posix.join(base, target.replace(/\/\*$/, "")));
  }
  return out;
}
function renderRouteSummary(map) {
  const out = [];
  for (const table of map.tables) {
    if (!table.found) {
      out.push(`${table.file}  ${table.surface}  not found`);
      continue;
    }
    const extra = [
      table.unresolved.length > 0 ? `unresolved: ${table.unresolved.join(", ")}` : "",
      table.pageless.length > 0 ? `no page module: ${table.pageless.join(", ")}` : ""
    ].filter(Boolean);
    out.push(`${table.file}  ${table.surface}  ${table.resolved} of ${table.rows} route(s) resolved${extra.length > 0 ? `; ${extra.join("; ")}` : ""}`);
  }
  out.push("");
  for (const union of map.unions) {
    out.push(`${union.union}  (${union.kind}, ${union.mechanism ?? "no mechanism"})  ${union.anchor}`);
    if (union.routes.length === 0) out.push(`    no route: ${union.why ?? "none"}`);
    for (const route of union.routes.slice(0, 8)) {
      out.push(`    ${route.surface.padEnd(8)} ${route.route.padEnd(28)} ${route.dynamic ? "dynamic " : "        "}d=${route.distance}  ${route.page ?? ""}`);
    }
    if (union.routes.length > 8) out.push(`    and ${union.routes.length - 8} more`);
  }
  return out.join("\n");
}

// src/states/services/project.mts
import { existsSync, readFileSync as readFileSync2 } from "fs";
import { join as join2, posix as posix2 } from "path";
var STATES_FILE = ".lw/qa/states.json";
var TSCONFIG_NAMES = ["tsconfig.json", "tsconfig.app.json"];
function readAliases(projectRoot, clientRoots) {
  const aliases = {};
  for (const root of clientRoots) {
    for (const dir of [root, posix2.dirname(root)]) {
      for (const name of TSCONFIG_NAMES) {
        const path = join2(projectRoot, dir, name);
        if (!existsSync(path)) continue;
        for (const [alias, target] of Object.entries(aliasesFromTsconfig(readFileSync2(path, "utf8"), dir))) aliases[alias] ??= target;
      }
    }
  }
  return aliases;
}
function scanStates(projectRoot, config, generated) {
  const scanned = scanProject(projectRoot, { clientRoots: config.clientRoots, typeRoots: config.typeRoots, generated });
  const tables = normaliseTables(config.routeTables);
  const known = new Set(scanned.sources.map((s) => s.file));
  const tableSources = tables.filter((t) => !known.has(t.file) && existsSync(join2(projectRoot, t.file))).map((t) => ({ file: t.file, text: readFileSync2(join2(projectRoot, t.file), "utf8") }));
  const map = buildRouteMap({
    inventory: scanned.inventory,
    sources: [...scanned.sources, ...tableSources],
    tables,
    pageRoots: config.clientRoots,
    aliases: readAliases(projectRoot, config.clientRoots),
    wrappers: config.routeWrappers ?? {},
    generated
  });
  return { inventory: attachRoutes(scanned.inventory, map), problems: scanned.problems, map };
}

export {
  isProductSource,
  analyzeSources,
  readTree,
  scanProject,
  normaliseTables,
  buildRouteMap,
  attachRoutes,
  renderRouteSummary,
  STATES_FILE,
  readAliases,
  scanStates
};
//# sourceMappingURL=chunk-OSGSGOS2.js.map