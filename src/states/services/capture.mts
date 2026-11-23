// Intercepted capture (spec 2.7, provenance `intercepted`): the last-resort trigger. Three general
// mechanisms, and none of them knows a feature:
//
//   1. deliver a chosen object by rewriting the real API response through browser routing;
//   2. find the element that draws it by diffing two renderings of the page;
//   3. prove the state took by running the feature's own function over the injected object.
//
// The real request is always sent and only one array in its JSON body is replaced. A hand-built
// body would be a picture of a shape the server does not send.
//
// Every in-page step is a script expression string, so it runs through `RoutablePage.evaluate`
// on any browser target, and a unit test can check the expression without a browser.
import { posix } from 'node:path';
import { LaunchwrightError, messageOf } from '../../kernel/index.mts';
import type { QaSession, RoutableLocator, RoutablePage, RoutedRoute } from '../../drivers/target/contract.mts';
import { routeMatches } from '../../services/paths.mts';
import type { Act, EvidenceKind, Settle } from '../../services/types.mts';
import { type FailReason, type StateResult, statePath } from './inventory.mts';
import type { CaptureGroup } from './loop.mts';
import { anchorSubjects, type Candidate, candidatePlan, canonical, type Shape, solve, type SolveResult } from './solve.mts';

/** The most elements a tree snapshot may hold. A bigger page means the diff root is wrong. */
export const MAX_TREE_NODES = 40_000;

/** The largest share of the diff root a located subject may cover before it counts as the page. */
export const DEFAULT_MAX_SUBJECT_AREA_RATIO = 0.9;

/** The element a tree is snapshotted from when a group names none. */
export const DEFAULT_DIFF_ROOT = 'body';

/** How many real rows one interception keeps. A corpus is a sample. */
export const MAX_CORPUS = 60;

/** How many parsed bodies one interception keeps, to resolve a named pivot. */
export const MAX_BODIES = 10;

/** How many candidates one evaluate carries. One round trip per candidate would dominate a run. */
export const DEFAULT_EVALUATE_BATCH = 100;

/** The detail fields a failure reason carries. */
export interface FailureDetail {
  fieldsTried?: string[];
  sameAs?: string | null;
  intended?: string | null;
  actual?: string | null;
  missingProp?: string | null;
}

/** A failure that knows its reason, so nothing has to read its text. */
export class CaptureFailure extends LaunchwrightError {
  readonly reason: FailReason;
  readonly detail: FailureDetail;

  constructor(reason: FailReason, message: string, detail: FailureDetail = {}, cause?: unknown) {
    super(`qa.states.${reason}`, message, { ...(cause === undefined ? {} : { cause }), context: { reason, ...detail } });
    this.reason = reason;
    this.detail = detail;
  }
}

/** The reason fields of a caught value: its own when it declared one, `crashed` otherwise. */
export function failureFields(e: unknown): { reason: FailReason } & FailureDetail {
  if (e instanceof CaptureFailure) return { reason: e.reason, ...e.detail };
  return { reason: 'crashed' };
}

export function errorText(e: unknown): string {
  return messageOf(e);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads a dotted path out of a parsed body: `items`, `data.items`, `pages.0.rows`. */
export function getAtPath(root: unknown, path: string): unknown {
  let node: unknown = root;
  for (const key of path.split('.')) {
    if (Array.isArray(node)) {
      const index = Number(key);
      if (!Number.isInteger(index)) return undefined;
      node = node[index];
      continue;
    }
    if (!isPlainObject(node)) return undefined;
    node = node[key];
  }
  return node;
}

/**
 * Writes a dotted path back into a parsed body. It creates nothing on the way: a container the
 * response does not carry is a shape the server never sends, and creating it would photograph that.
 */
export function setAtPath(root: unknown, path: string, value: unknown): boolean {
  const keys = path.split('.');
  const last = keys.pop();
  if (last === undefined) return false;
  let node: unknown = root;
  for (const key of keys) {
    if (Array.isArray(node)) node = node[Number(key)];
    else if (isPlainObject(node)) node = node[key];
    else return false;
  }
  if (Array.isArray(node)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= node.length) return false;
    node[index] = value;
    return true;
  }
  if (!isPlainObject(node) || !(last in node)) return false;
  node[last] = value;
  return true;
}

/** A live interception, the corpus it collected, and whether it fired. */
export interface Substitution {
  readonly hits: number;
  readonly errors: readonly string[];
  /** The rows the app really received at the container path, in arrival order. */
  readonly corpus: readonly Candidate[];
  /** The whole parsed bodies, to find a named pivot in what the app was sent. */
  readonly bodies: readonly unknown[];
  /** Pass the real response through and only collect. */
  record(): void;
  /** What the next matching response carries. */
  use(subjects: readonly unknown[]): void;
  /** Throws unless the interception fired cleanly since the last `use` or `record`. */
  assertApplied(): void;
  dispose(): Promise<void>;
}

/** Headers that no longer describe a body after it is rewritten. */
const STALE_HEADERS = new Set(['content-length', 'content-encoding', 'transfer-encoding']);

function freshHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !STALE_HEADERS.has(name.toLowerCase())));
}

/**
 * Rewrites one list inside the real API response and leaves every other byte alone. A throw in a
 * route handler is lost by the browser runner, so every failure is recorded and `assertApplied`
 * turns it into a failed capture.
 */
export async function installSubstitution(page: RoutablePage, spec: { url: string; container: string }): Promise<Substitution> {
  const state = {
    subjects: null as readonly unknown[] | null,
    hits: 0,
    errors: [] as string[],
    corpus: [] as Candidate[],
    bodies: [] as unknown[],
  };
  const collect = (parsed: unknown, container: readonly unknown[]): void => {
    if (state.bodies.length < MAX_BODIES) state.bodies.push(parsed);
    for (const row of container) {
      if (state.corpus.length >= MAX_CORPUS) break;
      if (isPlainObject(row)) state.corpus.push(row);
    }
  };
  const handler = async (route: RoutedRoute): Promise<void> => {
    try {
      const response = await route.fetch();
      const text = await response.text();
      const status = response.status();
      const headers = freshHeaders(response.headers());
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        state.errors.push(`${spec.url}: the response is not JSON, so no subject can be put into it`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      const container = getAtPath(parsed, spec.container);
      if (!Array.isArray(container)) {
        const what = container === undefined ? 'not in the response' : 'not an array';
        state.errors.push(`${spec.url}: "${spec.container}" is ${what}, so the descriptor assumes a shape the server does not send`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      // The real rows are the corpus, and they are gone once replaced.
      collect(parsed, container);
      if (state.subjects === null) {
        state.hits += 1;
        await route.fulfill({ status, headers, body: text });
        return;
      }
      if (!setAtPath(parsed, spec.container, [...state.subjects])) {
        state.errors.push(`${spec.url}: "${spec.container}" could not be written back`);
        await route.fulfill({ status, headers, body: text });
        return;
      }
      state.hits += 1;
      await route.fulfill({ status, headers, body: JSON.stringify(parsed) });
    } catch (e) {
      state.errors.push(`${spec.url}: ${errorText(e)}`);
      await route.continue();
    }
  };
  await page.route(spec.url, handler);
  return {
    get hits() {
      return state.hits;
    },
    get errors() {
      return state.errors;
    },
    get corpus() {
      return state.corpus;
    },
    get bodies() {
      return state.bodies;
    },
    record() {
      state.subjects = null;
      state.hits = 0;
      state.errors = [];
    },
    use(subjects) {
      state.subjects = subjects;
      state.hits = 0;
      state.errors = [];
    },
    assertApplied() {
      if (state.errors.length > 0) throw new CaptureFailure('blocked', `the interception failed: ${state.errors.join('; ')}`);
      if (state.hits === 0) {
        throw new CaptureFailure(
          'blocked',
          `the interception never fired: no request matched ${spec.url} during this rendering, so the page shows what the ` +
            'server really answered. A screenshot here would carry a state that nothing delivered',
        );
      }
    },
    async dispose() {
      await page.unroute(spec.url, handler);
    },
  };
}

/**
 * The contrast subjects: the list rotated by one. Every slot then differs, and the multiset is the
 * same, so a count the page derives from the list adds no difference of its own.
 */
export function rotate<T>(subjects: readonly T[]): T[] {
  if (subjects.length < 2) return [...subjects];
  return [...subjects.slice(1), subjects[0] as T];
}

/** One element's identity and its children. The path is derived by the diff, not stored. */
export interface TreeNode {
  tag: string;
  /** Tag, sorted attributes and the node's own text. */
  self: string;
  children: TreeNode[];
}

/** The expression that snapshots the rendered tree under `root`. */
export function snapshotExpression(root: string, ignoreAttributes: readonly string[] = [], maxNodes = MAX_TREE_NODES): string {
  return `(() => {
  const rootSelector = ${JSON.stringify(root)};
  const skip = new Set(${JSON.stringify([...ignoreAttributes])});
  const cap = ${JSON.stringify(maxNodes)};
  const start = document.querySelector(rootSelector);
  if (start === null) throw new Error('qa states: no element matches the diff root ' + rootSelector);
  let seen = 0;
  const walk = (el) => {
    seen += 1;
    if (seen > cap) throw new Error('qa states: the tree under ' + rootSelector + ' exceeds ' + cap + ' nodes');
    const attrs = [];
    for (const a of Array.from(el.attributes)) if (!skip.has(a.name)) attrs.push(a.name + '=' + a.value);
    attrs.sort();
    let own = '';
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) own += ' ' + (n.textContent || '');
    const text = own.replace(/\\s+/g, ' ').trim();
    return { tag: el.tagName, self: JSON.stringify([el.tagName, attrs, text]), children: Array.from(el.children).map(walk) };
  };
  return walk(start);
})()`;
}

export async function snapshotTree(page: RoutablePage, options: { root?: string; ignoreAttributes?: readonly string[]; maxNodes?: number } = {}): Promise<TreeNode> {
  return (await page.evaluate(snapshotExpression(options.root ?? DEFAULT_DIFF_ROOT, options.ignoreAttributes ?? [], options.maxNodes ?? MAX_TREE_NODES))) as TreeNode;
}

/**
 * The maximal subtrees that differ, as paths of child indices from the root. A node whose identity
 * or child count differs is reported whole. Only a node that matches its twin is descended into.
 */
export function diffNodes(a: TreeNode, b: TreeNode): number[][] {
  const out: number[][] = [];
  const walk = (x: TreeNode, y: TreeNode, path: number[]): void => {
    if (x.self !== y.self || x.children.length !== y.children.length) {
      out.push(path);
      return;
    }
    for (let i = 0; i < x.children.length; i += 1) walk(x.children[i] as TreeNode, y.children[i] as TreeNode, [...path, i]);
  };
  walk(a, b, []);
  return out;
}

/** The longest path prefix every difference shares. */
export function commonAncestor(paths: readonly number[][]): number[] {
  const [first] = paths;
  if (first === undefined) return [];
  let depth = first.length;
  for (const p of paths.slice(1)) {
    let i = 0;
    while (i < depth && i < p.length && p[i] === first[i]) i += 1;
    depth = i;
  }
  return first.slice(0, depth);
}

/** The node at a path, or null. */
export function nodeAt(tree: TreeNode, path: readonly number[]): TreeNode | null {
  let node: TreeNode = tree;
  for (const i of path) {
    const next = node.children[i];
    if (next === undefined) return null;
    node = next;
  }
  return node;
}

/** A subtree as one string, so two renderings can be compared as pictures. */
export function subtreeDigest(node: TreeNode): string {
  return `${node.self}(${node.children.map(subtreeDigest).join(',')})`;
}

/** `body > *:nth-child(2) > *:nth-child(1)`: a structural address with no class in it. */
export function pathSelector(root: string, path: readonly number[]): string {
  return [root, ...path.map((i) => `*:nth-child(${i + 1})`)].join(' > ');
}

interface DiffCluster {
  prefix: number[];
  children: number[];
  diffs: number;
  tag: string | null;
}

function diffClusters(tree: TreeNode, diffs: readonly number[][]): DiffCluster[] {
  const byPrefix = new Map<string, { prefix: number[]; children: Set<number>; diffs: number }>();
  for (const d of diffs) {
    for (let k = 0; k < d.length; k += 1) {
      const key = d.slice(0, k).join(',');
      let entry = byPrefix.get(key);
      if (entry === undefined) {
        entry = { prefix: d.slice(0, k), children: new Set<number>(), diffs: 0 };
        byPrefix.set(key, entry);
      }
      entry.children.add(d[k] as number);
      entry.diffs += 1;
    }
  }
  const out: DiffCluster[] = [];
  for (const entry of byPrefix.values()) {
    const children = [...entry.children].sort((x, y) => x - y);
    const tags = children.map((i) => nodeAt(tree, [...entry.prefix, i])?.tag ?? null);
    const firstTag = tags[0] ?? null;
    const tag = firstTag !== null && tags.every((t) => t === firstTag) ? firstTag : null;
    out.push({ prefix: entry.prefix, children, diffs: entry.diffs, tag });
  }
  // Deepest first: the answer is the list, not the page the list is on.
  out.sort((x, y) => y.prefix.length - x.prefix.length || y.diffs - x.diffs);
  return out;
}

/**
 * Where the state is drawn, found by asking the page what changed. The container is the deepest
 * node whose differing children are exactly `count` elements of one tag: N renderings of one
 * component. No difference is the `identical` finding.
 */
export function locateSubjects(a: TreeNode, b: TreeNode, count: number): { ancestor: number[]; paths: number[][] } {
  const diffs = diffNodes(a, b);
  if (diffs.length === 0) {
    throw new CaptureFailure('identical', 'the two renderings are identical: no element differs. Either these states render the same, which is the finding, or the subjects never reached the page');
  }
  if (diffs.some((d) => d.length === 0)) {
    throw new CaptureFailure('crashed', 'the diff root itself differs between the two renderings, so the subject was not isolated');
  }
  const clusters = diffClusters(a, diffs).filter((c) => c.tag !== null);
  const exact = clusters.filter((c) => c.children.length === count);
  const [best, second] = exact;
  if (best && second && best.prefix.length === second.prefix.length && best.diffs === second.diffs) {
    throw new CaptureFailure(
      'crashed',
      `two elements each hold ${count} differing children of one tag (${pathSelector('root', best.prefix)} and ${pathSelector('root', second.prefix)}), ` +
        'so which one draws the subjects is a guess. The renderings differ in more than the state',
    );
  }
  if (!best) throw noContainer(a, clusters, diffs, count);
  return { ancestor: best.prefix, paths: best.children.map((slot) => [...best.prefix, slot]) };
}

function noContainer(tree: TreeNode, clusters: readonly DiffCluster[], diffs: readonly number[][], count: number): CaptureFailure {
  const best = [...clusters].sort((x, y) => y.children.length - x.children.length || y.prefix.length - x.prefix.length)[0];
  const span = pathSelector('root', commonAncestor(diffs));
  if (best === undefined) {
    return new CaptureFailure(
      'identical',
      `the ${diffs.length} difference(s) sit under ${span} and no element holds ${count} differing children of one tag, so the ` +
        `${count} subjects are not told apart. Something other than the subjects changed between the renderings`,
    );
  }
  const container = nodeAt(tree, best.prefix);
  const collapsed: string[] = [];
  if (best.children.length < count && container !== null && container.children.length === count) {
    for (let slot = 0; slot < count; slot += 1) if (!best.children.includes(slot)) collapsed.push(`${slot} and ${(slot + 1) % count}`);
  }
  return new CaptureFailure(
    'identical',
    `${pathSelector('root', best.prefix)} holds ${best.children.length} differing <${best.tag}> child(ren) for ${count} subjects ` +
      `(${diffs.length} difference(s), spanning ${span}). ` +
      (collapsed.length > 0
        ? `Subjects ${collapsed.join(', and ')} render an identical element, which is the finding`
        : 'Either two consecutive members render identically, which is the finding, or something other than the subjects changed'),
  );
}

/** Pairs of located subjects that render the same subtree. */
export function identicalRenderings(nodes: readonly TreeNode[]): [number, number][] {
  const digests = nodes.map(subtreeDigest);
  const pairs: [number, number][] = [];
  for (let i = 0; i < digests.length; i += 1) for (let j = i + 1; j < digests.length; j += 1) if (digests[i] === digests[j]) pairs.push([i, j]);
  return pairs;
}

/** Refuses a located subject that covers the page rather than a part of it. */
export async function assertSubjectIsolated(subject: RoutableLocator, root: RoutableLocator, maxRatio: number): Promise<void> {
  const [box, rootBox] = await Promise.all([subject.boundingBox(), root.boundingBox()]);
  if (box === null || box.width === 0 || box.height === 0) {
    throw new CaptureFailure('crashed', 'the located subject has no box on screen, so there is nothing to photograph');
  }
  if (rootBox === null || rootBox.width === 0 || rootBox.height === 0) return;
  const ratio = (box.width * box.height) / (rootBox.width * rootBox.height);
  if (ratio > maxRatio) {
    throw new CaptureFailure(
      'crashed',
      `the located subject covers ${(ratio * 100).toFixed(0)}% of the diff root, over the ${(maxRatio * 100).toFixed(0)}% bound: the diff is the whole page`,
    );
  }
}

/**
 * The dev server URL of a project file: `/@fs<absolute path>`, the address the Vite dev server
 * serves every module under. Dev only: a built bundle has no module names.
 */
export function moduleUrl(projectRoot: string, relativePath: string): string {
  return `/@fs${posix.join(projectRoot.split('\\').join('/'), relativePath)}`;
}

/** The feature's own state function, reached through the dev server's module graph. */
export interface VerifySpec {
  module: string;
  export: string;
  args?: readonly unknown[];
}

/** One candidate's answer, or the reason the function could not answer. */
export interface BatchAnswer {
  state: string | null;
  error: string | null;
}

/**
 * The expression that runs the app's own function over many candidates in one evaluate. Each item
 * has its own error, so one bad candidate does not cost the others their answers. A promise answer
 * is awaited.
 */
export function evaluateBatchExpression(moduleHref: string, exportName: string, items: readonly unknown[], extra: readonly unknown[] = []): string {
  return `(async () => {
  const href = ${JSON.stringify(moduleHref)};
  const name = ${JSON.stringify(exportName)};
  const mod = await import(/* @vite-ignore */ href);
  const fn = mod[name];
  if (typeof fn !== 'function') throw new Error('qa states: ' + href + ' exports no function named ' + name);
  const items = ${JSON.stringify(items)};
  const extra = ${JSON.stringify(extra)};
  const out = [];
  for (const item of items) {
    try {
      const answer = await fn(item, ...extra);
      out.push({ state: answer === null || answer === undefined ? null : String(answer), error: null });
    } catch (e) {
      out.push({ state: null, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
})()`;
}

export async function evaluateBatch(page: RoutablePage, projectRoot: string, spec: VerifySpec, batch: readonly unknown[]): Promise<BatchAnswer[]> {
  const answers = await page.evaluate(evaluateBatchExpression(moduleUrl(projectRoot, spec.module), spec.export, batch, spec.args ?? []));
  if (!Array.isArray(answers) || answers.length !== batch.length) {
    throw new CaptureFailure('crashed', `${spec.export}: the page answered ${Array.isArray(answers) ? answers.length : typeof answers} result(s) for ${batch.length} candidate(s)`);
  }
  return answers as BatchAnswer[];
}

/** Runs the feature's own function over the injected subject and returns its answer as a string. */
export async function verifyInPage(page: RoutablePage, projectRoot: string, spec: VerifySpec, subject: unknown): Promise<string> {
  const [answer] = await evaluateBatch(page, projectRoot, spec, [subject]);
  if (!answer || answer.error !== null) throw new CaptureFailure('crashed', `${spec.export} threw on the injected subject: ${answer?.error ?? 'no answer'}`);
  return answer.state ?? 'null';
}

export interface SolveReport {
  result: SolveResult;
  evaluated: number;
  batches: number;
  /** Candidates `solve` asked for that no batch answered. The expected count is zero. */
  memoMisses: number;
}

/**
 * Solves each member's input with the app's own function in the page. The plan is answered in a
 * few batches first, then `solve` reads the answers from a memo. A miss is a live round trip and
 * is counted, so the batching cannot become wrong. A candidate the function throws on is a finding.
 */
export async function solveWithPage(
  page: RoutablePage,
  projectRoot: string,
  args: { verify: VerifySpec; shape: Shape; corpus: readonly Candidate[]; members?: string[] | null; union?: string; limit?: number; pivots?: number[]; batchSize?: number },
): Promise<SolveReport> {
  const { verify, shape, members = null, union, limit, pivots } = args;
  const corpus = [...args.corpus];
  const batchSize = args.batchSize ?? DEFAULT_EVALUATE_BATCH;
  const options = { ...(limit === undefined ? {} : { limit }), ...(pivots === undefined ? {} : { pivots }) };
  const plan = candidatePlan(shape, corpus, options);
  const memo = new Map<string, string | null>();
  let batches = 0;
  for (let i = 0; i < plan.length; i += batchSize) {
    const slice = plan.slice(i, i + batchSize);
    const answers = await evaluateBatch(page, projectRoot, verify, slice.map((step) => step.candidate));
    batches += 1;
    for (const [j, answer] of answers.entries()) {
      const step = slice[j];
      if (!step) continue;
      if (answer.error !== null) throw new CaptureFailure('crashed', `${verify.export} threw on a candidate its type admits (${step.text}): ${answer.error}`);
      memo.set(canonical(step.candidate), answer.state);
    }
  }
  let memoMisses = 0;
  const result = await solve({
    shape,
    corpus,
    members,
    ...(union === undefined ? {} : { union }),
    ...options,
    evaluate: async (candidate) => {
      const key = canonical(candidate);
      if (memo.has(key)) return memo.get(key) ?? null;
      memoMisses += 1;
      const [answer] = await evaluateBatch(page, projectRoot, verify, [candidate]);
      if (!answer || answer.error !== null) throw new CaptureFailure('crashed', `${verify.export} threw on a candidate: ${answer?.error ?? 'no answer'}`);
      memo.set(key, answer.state);
      return answer.state;
    },
  });
  return { result, evaluated: plan.length, batches, memoMisses };
}

/** The constants the scanner found: literals it read, and names only the running app holds. */
export interface PivotHints {
  literals: number[];
  names: string[];
}

export interface ResolvedPivots {
  pivots: number[];
  resolved: Record<string, number>;
  /** A name, and what was looked in. Never a guess. */
  unresolved: Record<string, string>;
}

/** The expression that reads the parameter names of an exported function. Only plain identifiers count. */
export function parameterNamesExpression(moduleHref: string, exportName: string): string {
  return `(async () => {
  const mod = await import(/* @vite-ignore */ ${JSON.stringify(moduleHref)});
  const fn = mod[${JSON.stringify(exportName)}];
  if (typeof fn !== 'function') return [];
  const src = Function.prototype.toString.call(fn);
  const open = src.indexOf('(');
  if (open < 0) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') { depth -= 1; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) return [];
  return src.slice(open + 1, close).split(',').map((p) => p.trim()).map((p) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p) ? p : ''));
})()`;
}

/** The expression that reads an exported number of a module, or null. */
export function exportedNumberExpression(moduleHref: string, name: string): string {
  return `(async () => {
  let mod;
  try { mod = await import(/* @vite-ignore */ ${JSON.stringify(moduleHref)}); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  const found = mod[${JSON.stringify(name)}];
  return { value: typeof found === 'number' && Number.isFinite(found) ? found : null };
})()`;
}

/** Every number under `key`, anywhere in a parsed body. Distinct, in encounter order. */
export function numbersUnderKey(body: unknown, key: string): number[] {
  const found: number[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isPlainObject(node)) return;
    for (const [k, v] of Object.entries(node)) {
      if (k === key && typeof v === 'number' && Number.isFinite(v) && !found.includes(v)) found.push(v);
      visit(v);
    }
  };
  visit(body);
  return found;
}

/**
 * Resolves a named pivot from the running app, cheapest first: a number in `verify.args` at that
 * parameter, an exported number of that name in a module, then one distinct number under a key of
 * that name in a captured body. Several values are ambiguous and stay unresolved.
 */
export async function resolvePivots(
  page: RoutablePage,
  projectRoot: string,
  hints: PivotHints,
  options: { verify?: VerifySpec; modules?: readonly string[]; bodies?: readonly unknown[] } = {},
): Promise<ResolvedPivots> {
  const resolved: Record<string, number> = {};
  const unresolved: Record<string, string> = {};
  const declaredArgs = options.verify?.args ?? [];
  const modules = [...new Set([...(options.verify ? [options.verify.module] : []), ...(options.modules ?? [])])];
  const bodies = options.bodies ?? [];
  const params =
    options.verify !== undefined && hints.names.length > 0
      ? ((await page.evaluate(parameterNamesExpression(moduleUrl(projectRoot, options.verify.module), options.verify.export))) as string[])
      : [];
  for (const name of hints.names) {
    // Position 0 is the subject, so parameter k takes `args[k - 1]`.
    const at = params.indexOf(name);
    const fromArg = at > 0 ? declaredArgs[at - 1] : undefined;
    if (typeof fromArg === 'number' && Number.isFinite(fromArg)) {
      resolved[name] = fromArg;
      continue;
    }
    let fromModule: number | null = null;
    const importErrors: string[] = [];
    for (const rel of modules) {
      const answer = (await page.evaluate(exportedNumberExpression(moduleUrl(projectRoot, rel), name))) as { value?: number | null; error?: string };
      if (answer.error !== undefined) importErrors.push(`${rel}: ${answer.error}`);
      if (typeof answer.value === 'number') {
        fromModule = answer.value;
        break;
      }
    }
    if (fromModule !== null) {
      resolved[name] = fromModule;
      continue;
    }
    const seen: number[] = [];
    for (const body of bodies) for (const n of numbersUnderKey(body, name)) if (!seen.includes(n)) seen.push(n);
    if (seen.length === 1) {
      resolved[name] = seen[0] as number;
      continue;
    }
    unresolved[name] =
      seen.length > 1
        ? `"${name}" is ${seen.join(', ')} in the captured responses, and choosing one would be a guess`
        : `"${name}" is no argument of ${options.verify?.export ?? '(no function)'}(${params.join(', ')}), no exported number of ` +
          `${modules.join(' or ') || '(no module)'}, and under no key of that name in ${bodies.length} captured response(s)` +
          (importErrors.length > 0 ? `. Import failures: ${importErrors.join('; ')}` : '');
  }
  const pivots = [...new Set([...hints.literals, ...Object.values(resolved)])].filter(Number.isFinite);
  return { pivots, resolved, unresolved };
}

export interface SolvedSubjects {
  /** Aligned to `group.members`. Null where nothing produced the member. */
  subjectFor: (Candidate | null)[];
  unreachable: Map<number, string>;
  fieldsTried: string[];
  fieldsUnderTest: string[];
  anchor: { fields: string[]; loose: string[]; notes: string[]; evaluations: number };
  pivots: ResolvedPivots;
  report: SolveReport;
}

/** Solves every member of one group from the corpus this run captured, then anchors the answers on one row. */
export async function solveGroupSubjects(page: RoutablePage, projectRoot: string, group: CaptureGroup, corpus: readonly Candidate[], bodies: readonly unknown[]): Promise<SolvedSubjects> {
  if (group.solve === undefined) throw new CaptureFailure('blocked', `${group.id}: the group has no solve block`);
  const { verify } = group;
  const pivots = await resolvePivots(page, projectRoot, group.solve.pivots ?? { literals: [], names: [] }, {
    verify,
    ...(group.solve.pivotModules ? { modules: group.solve.pivotModules } : {}),
    bodies,
  });
  const members = group.members.map((m) => m.member ?? 'null');
  const report = await solveWithPage(page, projectRoot, {
    verify,
    shape: group.solve.shape,
    corpus,
    members,
    union: group.union,
    ...(group.solve.limit === undefined ? {} : { limit: group.solve.limit }),
    pivots: pivots.pivots,
    ...(group.solve.batchSize === undefined ? {} : { batchSize: group.solve.batchSize }),
  });
  const base = corpus[0];
  if (base === undefined) throw new CaptureFailure('unreachable', `${group.union}: the corpus is empty`, { fieldsTried: Object.keys(group.solve.shape.fields) });
  const anchor = await anchorSubjects({
    shape: group.solve.shape,
    base,
    covered: report.result.covered,
    members,
    evaluate: async (candidate) => {
      const [answer] = await evaluateBatch(page, projectRoot, verify, [candidate]);
      if (!answer || answer.error !== null) throw new CaptureFailure('crashed', `${verify.export} threw on an anchored candidate: ${answer?.error ?? 'no answer'}`);
      return answer.state;
    },
  });
  const unresolvedNames = Object.values(pivots.unresolved);
  const subjectFor: (Candidate | null)[] = [];
  const unreachable = new Map<number, string>();
  for (const [i, name] of members.entries()) {
    const hit = report.result.covered[name];
    if (hit === undefined) {
      subjectFor.push(null);
      const why = report.result.sentence ?? `${group.union}: ${name} was not produced by any candidate`;
      unreachable.set(i, unresolvedNames.length > 0 ? `${why} Unresolved pivot: ${unresolvedNames.join('; ')}` : why);
      continue;
    }
    subjectFor.push(anchor.subjects[name] ?? hit.candidate);
  }
  return {
    subjectFor,
    unreachable,
    fieldsTried: Object.keys(group.solve.shape.fields),
    fieldsUnderTest: anchor.fields,
    anchor: { fields: anchor.fields, loose: anchor.loose, notes: anchor.notes, evaluations: anchor.evaluations },
    pivots,
    report,
  };
}

/** Records one evidence file in the ledger. The caller knows the leg, the target and the attempt. */
export type EvidenceRecorder = (entry: { file: string; kind: EvidenceKind; row: string }) => Promise<void>;

/** What a capture run needs besides the session. */
export interface CaptureContext {
  /** The absolute project root, for `/@fs` module addresses. */
  projectRoot: string;
  /** The absolute report folder. Images land under `<reportDir>/assets/<slug>/states/`. */
  reportDir: string;
  slug: string;
  record: EvidenceRecorder;
  /** Milliseconds, from the kernel clock. */
  now: () => number;
}

/**
 * Navigate, act, settle, and check that the interception fired and the route held. It runs for
 * every rendering: the corpus one, the contrast one and the capture one. `subjects` null is the
 * corpus pass.
 */
export async function renderOnce(session: QaSession, group: CaptureGroup, substitution: Substitution, subjects: readonly unknown[] | null): Promise<void> {
  if (subjects === null) substitution.record();
  else substitution.use(subjects);
  await session.navigate(group.route);
  for (const step of group.act ?? []) await session.act(step as Act);
  await session.settle(group.settle as Settle);
  const held = await session.currentRoute();
  if (!routeMatches(group.route, held)) {
    throw new CaptureFailure('blocked', `the page left ${group.route} for ${held}, so a picture would be of another screen`);
  }
  substitution.assertApplied();
}

interface Prepared {
  tree: TreeNode;
  paths: number[][];
  diffRoot: string;
  /** `slots[k]` is the index in `group.members` that slot `k` carries. */
  slots: number[];
  subjectFor: (Candidate | null)[];
  unreachable: Map<number, string>;
  fieldsTried: string[];
  notes: string[];
}

/** The corpus, contrast and capture renderings, in that order, so the page ends on the subjects. */
async function prepare(session: QaSession, page: RoutablePage, group: CaptureGroup, ctx: CaptureContext): Promise<Prepared> {
  const diffRoot = group.diffRoot ?? DEFAULT_DIFF_ROOT;
  const snapshotOptions = { root: diffRoot, ignoreAttributes: group.ignoreAttributes ?? [] };
  const notes: string[] = [];
  const substitution = await installSubstitution(page, group.intercept);
  try {
    let subjectFor: (Candidate | null)[];
    let unreachable = new Map<number, string>();
    let fieldsTried: string[] = [];
    if (group.solve === undefined) {
      subjectFor = group.members.map((m) => (isPlainObject(m.subject) ? m.subject : null));
    } else {
      await renderOnce(session, group, substitution, null);
      const solved = await solveGroupSubjects(page, ctx.projectRoot, group, substitution.corpus, substitution.bodies);
      subjectFor = solved.subjectFor;
      unreachable = solved.unreachable;
      fieldsTried = solved.fieldsTried;
      notes.push(
        `corpus ${substitution.corpus.length} real ${group.solve.shape.type} row(s); ${solved.report.evaluated} candidates in ` +
          `${solved.report.batches} evaluate(s), ${solved.report.memoMisses} memo miss(es); pivots ${JSON.stringify(solved.pivots.pivots)}`,
      );
      for (const why of Object.values(solved.pivots.unresolved)) notes.push(`unresolved pivot: ${why}`);
      notes.push(...solved.anchor.notes);
    }
    const slots: number[] = [];
    const subjects: Candidate[] = [];
    for (const [i, subject] of subjectFor.entries()) {
      if (subject === null) continue;
      slots.push(i);
      subjects.push(subject);
    }
    if (subjects.length === 0) {
      throw new CaptureFailure('unreachable', `no member of ${group.union} has a subject to render: ${[...unreachable.values()].join('; ')}`, { fieldsTried });
    }
    if (subjects.length === 1 && group.contrast === undefined) {
      throw new CaptureFailure('blocked', `only one member of ${group.union} has a subject, and the group has no contrast, so there is no second rendering to diff against`);
    }
    const contrast = subjects.length === 1 ? [group.contrast] : rotate(subjects);
    await renderOnce(session, group, substitution, contrast);
    const before = await snapshotTree(page, snapshotOptions);
    await renderOnce(session, group, substitution, subjects);
    const tree = await snapshotTree(page, snapshotOptions);
    const { paths } = locateSubjects(tree, before, subjects.length);
    return { tree, paths, diffRoot, slots, subjectFor, unreachable, fieldsTried, notes };
  } finally {
    await substitution.dispose();
  }
}

function blankResult(group: CaptureGroup, index: number): StateResult {
  const member = group.members[index];
  return {
    id: member?.id ?? `${group.union}.${index}`,
    union: group.union,
    member: member?.member ?? null,
    ok: false,
    subject: null,
    context: null,
    provenance: 'intercepted',
    verified: null,
    answered: null,
    error: null,
    ms: 0,
  };
}

/**
 * Captures every member of one group: a subject image and a context image each, provenance
 * `intercepted`. It returns one result per member, also when the group fails before any picture.
 */
export async function captureGroup(session: QaSession, page: RoutablePage, group: CaptureGroup, ctx: CaptureContext): Promise<{ results: StateResult[]; notes: string[] }> {
  const started = ctx.now();
  let prepared: Prepared;
  try {
    prepared = await prepare(session, page, group, ctx);
  } catch (e) {
    const fields = failureFields(e);
    const ms = ctx.now() - started;
    return { results: group.members.map((_, i) => ({ ...blankResult(group, i), error: errorText(e), ...fields, ms })), notes: [] };
  }
  const { tree, paths, diffRoot, slots, subjectFor, unreachable, fieldsTried, notes } = prepared;
  const nodes = paths.map((p) => nodeAt(tree, p)).filter((n): n is TreeNode => n !== null);
  const twins = new Map<number, { why: string; sameAs: string }>();
  if (nodes.length === paths.length) {
    for (const [a, b] of identicalRenderings(nodes)) {
      const first = group.members[slots[a] as number];
      const second = group.members[slots[b] as number];
      if (!first || !second) continue;
      const why = `${first.id} and ${second.id} render an identical subtree`;
      twins.set(slots[a] as number, { why, sameAs: second.id });
      twins.set(slots[b] as number, { why, sameAs: first.id });
    }
  }
  const root = page.locator(diffRoot).first();
  const maxRatio = group.maxSubjectAreaRatio ?? DEFAULT_MAX_SUBJECT_AREA_RATIO;
  const results: StateResult[] = [];
  for (const [i, member] of group.members.entries()) {
    const at = ctx.now();
    const result = blankResult(group, i);
    try {
      const missing = unreachable.get(i);
      if (missing !== undefined) throw new CaptureFailure('unreachable', missing, { fieldsTried });
      const twin = twins.get(i);
      if (twin !== undefined) throw new CaptureFailure('identical', twin.why, { sameAs: twin.sameAs });
      const slot = slots.indexOf(i);
      const path = paths[slot];
      if (slot < 0 || path === undefined) throw new CaptureFailure('blocked', 'this member was never rendered, so there is nothing to photograph');
      // Before the pictures: the feature's own function must agree with the state (spec 2.7).
      const answered = await verifyInPage(page, ctx.projectRoot, group.verify, subjectFor[i]);
      const expected = member.expect === undefined ? (member.member ?? 'null') : (member.expect ?? 'null');
      result.answered = answered;
      result.verified = answered === expected;
      if (!result.verified) {
        throw new CaptureFailure(
          'state-mismatch',
          `${group.verify.export} answered "${answered}" for this subject, and the plan asked for "${expected}"`,
          { intended: expected, actual: answered },
        );
      }
      const subject = page.locator(pathSelector(diffRoot, path)).first();
      await assertSubjectIsolated(subject, root, maxRatio);
      await subject.scrollIntoViewIfNeeded();
      const context = statePath(ctx.slug, member.id, 'context');
      const subjectFile = statePath(ctx.slug, member.id, 'subject');
      await session.screenshot(posix.join(ctx.reportDir, context));
      await subject.screenshot({ path: posix.join(ctx.reportDir, subjectFile) });
      await ctx.record({ file: posix.join(ctx.reportDir, context), kind: 'screenshot', row: member.id });
      await ctx.record({ file: posix.join(ctx.reportDir, subjectFile), kind: 'screenshot', row: member.id });
      result.subject = subjectFile;
      result.context = context;
      result.expect = `${group.verify.export} answers ${expected}`;
      result.ok = true;
    } catch (e) {
      result.error = errorText(e);
      Object.assign(result, failureFields(e));
    }
    result.ms = ctx.now() - at;
    results.push(result);
  }
  return { results, notes };
}
