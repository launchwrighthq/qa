import { H as Surface, P as Provenance, E as EvidenceKind, t as QaSession, a1 as RoutablePage, S as Settle, Q as QaTarget, o as OpenOptions } from './contract-B9QWKAsv.js';
import { Q as QaConfig } from './config-Du8sHpQm.js';
import { L as LaunchwrightError } from './errors-DgRPaUlC.js';
import 'zod';

/** The cap on one candidate stream, over every phase. A ten-field shape stays under it. */
declare const MAX_CANDIDATES = 500;
/** Every field kind a shape may declare. */
declare const FIELD_KINDS: readonly ["boolean", "number", "string", "enum", "nullable", "opaque"];
type FieldKind = (typeof FIELD_KINDS)[number];
/**
 * The value that means "this optional field is not on the wire". It appears in a `fieldValues`
 * list and in a change record, and never in a candidate: the key is deleted instead.
 */
declare const ABSENT: unique symbol;
/** The key a null answer is covered under. `plannedCaptures` plans the capture `<Union>.null`. */
declare const NULL_STATE = "null";
interface Field {
    kind: FieldKind;
    /** The key may be missing entirely. */
    optional?: boolean;
    /** `number` only: constants the function compares against. */
    pivots?: number[];
    /** `string` only: a representative present value. */
    sample?: string;
    /** `enum` only. */
    values?: unknown[];
    /** `nullable` only. */
    of?: Field;
}
interface Shape {
    /** The parameter type name. */
    type: string;
    fields: Record<string, Field>;
}
type Candidate = Record<string, unknown>;
interface Change {
    field: string;
    from: unknown;
    to: unknown;
}
interface PlanStep {
    candidate: Candidate;
    /** The corpus entry the candidate was made from. */
    base: Candidate;
    baseIndex: number;
    changes: Change[];
    /** `capped: false -> true`. */
    text: string;
}
/** The app's own function over one candidate. It answers a member name, or null. */
type Evaluate = (candidate: Candidate) => unknown;
/** Every problem of a shape, as sentences that name the field. */
declare function validateShape(shape: unknown): string[];
/**
 * The ordered values one field admits, most likely first. An optional field ends with ABSENT.
 * `options.pivots` applies to every number field, because the solver cannot know which field a
 * comparison reads.
 */
declare function fieldValues(field: Field, options?: {
    pivots?: number[];
}): unknown[];
/**
 * The ordered, finite, deduplicated candidate stream. It throws on an empty corpus: an empty
 * stream reports every state unreachable when the truth is that nothing was captured.
 */
declare function candidatePlan(shape: Shape, corpus: readonly Candidate[], options?: {
    limit?: number;
    pivots?: number[];
}): PlanStep[];
/** The candidate stream alone. */
declare function candidates(shape: Shape, corpus: readonly Candidate[], options?: {
    limit?: number;
    pivots?: number[];
}): Candidate[];
/** What changed to make a candidate, so a report can say "capped: false -> true". */
declare function describeCandidate(candidate: Candidate, corpusEntry: Candidate): {
    changes: Change[];
    text: string;
};
/**
 * The sentence a report prints when no candidate produced a member, or null when every member was
 * covered. It names the fields that were varied, so a reader can tell a finding from a narrow search.
 */
declare function unreachable(union: {
    name: string;
    members: string[];
    covered?: string[];
}, tried: {
    count: number;
    fields: string[];
}): string | null;
interface SolveResult {
    covered: Record<string, PlanStep & {
        state: string;
    }>;
    order: string[];
    tried: number;
    planned: number;
    limit: number;
    missing: string[];
    extra: string[];
    sentence: string | null;
}
/** Runs the stream through the app's own function until every member is covered. */
declare function solve(args: {
    shape: Shape;
    corpus: readonly Candidate[];
    evaluate: Evaluate;
    members?: string[] | null;
    union?: string;
    limit?: number;
    pivots?: number[];
}): Promise<SolveResult>;
/**
 * Builds every solved subject on one real row, so two renderings differ only in the field under
 * test. Phase 0 of the plan offers every corpus entry, and a corpus already holds several states,
 * so the first answers come from different rows. A diff of two different rows locates the page,
 * not the state.
 *
 * For each member: graft every field where the candidate differs from the base, then drop one
 * field at a time while the app's own function still answers the member. A member the graft
 * cannot produce keeps the solver's row, and a note says so.
 */
declare function anchorSubjects(args: {
    shape: Shape;
    base: Candidate;
    covered: Record<string, {
        candidate: Candidate;
    }>;
    members: readonly string[];
    evaluate: Evaluate;
}): Promise<{
    subjects: Record<string, Candidate>;
    fields: string[];
    anchored: string[];
    loose: string[];
    notes: string[];
    evaluations: number;
}>;

/** The name suffixes of a state union. A suffix list, so a new suffix is a decision made here. */
declare const STATE_SUFFIXES: readonly ["State", "Mark", "Status", "Kind", "Phase", "Variant"];
/** True when a type name looks like a state union: it ends in a suffix and has more than the suffix. */
declare function isStateUnionName(name: string): boolean;
/**
 * How a union is reached.
 *
 * - `input`: a field of a props or options type holds it, so a component takes it.
 * - `output`: a function returns it, so it comes from that function's parameter.
 * - `both`: both, and either mechanism reaches it.
 * - `neither`: nothing takes it and nothing returns it. It fails the run (spec 2.14 rule C1).
 */
declare const KINDS: readonly ["input", "output", "both", "neither"];
type UnionKind = (typeof KINDS)[number];
/** The JSDoc tag that opts a union out: `@qa-states ignore <reason>`. The reason is required. */
declare const IGNORE_TAG = "qa-states";
/** How a capture was produced. A report labels every shot that is not `live`. */
declare const PROVENANCE: readonly Provenance[];
/**
 * Why a capture failed. The report switches on the code, and a person reads `error`.
 *
 * - `unreachable`: no candidate produced the member. `fieldsTried` names what was varied.
 * - `identical`: two members render the same element. `sameAs` names the twin.
 * - `state-mismatch`: the feature's own function disagreed. `intended` and `actual` say how.
 * - `unmountable`: the harness could not mount the component. `missingProp` says why.
 * - `no-mechanism`: a `neither` union. Nothing can reach it.
 * - `blocked`: a prerequisite is missing, for example a delivery descriptor.
 * - `not-run`: the mechanism did not run. It counts against the exit code.
 * - `crashed`: any other failure. `error` holds all that is known.
 */
declare const FAIL_REASONS: readonly ["unreachable", "identical", "state-mismatch", "unmountable", "no-mechanism", "blocked", "not-run", "crashed"];
type FailReason = (typeof FAIL_REASONS)[number];
/** A field that holds the union: the input half. */
interface InputSite {
    interface: string;
    field: string;
    optional: boolean;
    /** Project-relative. */
    file: string;
    /** The component whose props type holds the field, or null when no component names it. */
    component: string | null;
    componentFile: string | null;
}
/** One parameter of an output function, with the shape the solver searches over. */
interface ParamSite {
    name: string;
    type: string;
    typeFile: string | null;
    shape: Shape | null;
}
/** The constants a function compares against. Names are resolved by the runner in the page. */
interface Pivots {
    literals: number[];
    names: string[];
}
/** A function that returns the union: the output half. */
interface OutputSite {
    fn: string;
    file: string;
    /** An unexported function cannot be evaluated from a page. */
    exported: boolean;
    /** `T | null`: the null answer is a rendering of its own. */
    nullable: boolean;
    /** `Promise<T>`: the evaluator awaits it. */
    async: boolean;
    /** True when a parameter has a shape, so the solver can steer the function. */
    solvable: boolean;
    pivots: Pivots;
    params: ParamSite[];
}
/** A union that another union absorbed, because it has no site of its own. */
interface FlattenedUnion {
    name: string;
    file: string;
    line: number;
    members: string[];
}
/** One route that delivers a union, from the delivery scan (spec 2.14 rule C4). */
interface DeliveryRoute {
    surface: Surface;
    route: string;
    /** The page module the route draws. */
    page: string | null;
    /** Import hops from the page to the union's anchor file. */
    distance: number;
    /** The route has a required `:param`, so a crawl cannot open it without a value. An optional `:param?` is left out. */
    dynamic: boolean;
    /** How many files the page reaches. A smaller number is a more specific route. */
    reaches: number;
}
/**
 * What a mechanism B capture group needs that no scan can know: the response that carries the
 * subjects and the settle rule, and the route when the scan derives none. It sits beside a union in the inventory file.
 */
interface DeliveryDescriptor {
    /** Default: the nearest derived route without a required `:param` on the surface of the leg. */
    route?: string;
    leg?: string;
    intercept: {
        url: string;
        container: string;
    };
    settle: {
        selector?: string;
        artwork?: boolean;
        video?: boolean;
        busy?: boolean;
        timeout?: number;
    };
    act?: unknown[];
    verifyArgs?: unknown[];
    pivotModules?: string[];
    limit?: number;
    batchSize?: number;
    contrast?: unknown;
    diffRoot?: string;
    ignoreAttributes?: string[];
    maxSubjectAreaRatio?: number;
    /** The persona the capture runs signed in as, as on a session row. */
    fixture?: CaptureFixture;
}
/** The fixture of a state capture: the persona from the world registry that is signed in first. */
interface CaptureFixture {
    persona?: string;
}
/** What a mounted capture may say beyond the scan (spec 2.14 rule C2). */
interface MountHints {
    component?: string;
    leg?: string;
    width?: string;
    props?: Record<string, unknown>;
    members?: Record<string, Record<string, unknown>>;
    settle?: {
        selector?: string;
        timeout?: number;
    };
    /** The persona the capture runs signed in as, as on a session row. */
    fixture?: CaptureFixture;
}
interface UnionEntry {
    name: string;
    file: string;
    line: number;
    members: string[];
    kind: UnionKind;
    flattens: FlattenedUnion[];
    inputs: InputSite[];
    outputs: OutputSite[];
    /** The components that render the union. Written into `.lw/qa/states.json`. */
    components?: string[];
    /** The routes that deliver the union. Written into `.lw/qa/states.json`. */
    routes?: DeliveryRoute[];
    /** Why `routes` is empty, when it is. */
    why?: string;
    delivery?: DeliveryDescriptor;
    mount?: MountHints;
}
/** A union a person opted out of, with the reason. Reported, never dropped. */
interface IgnoredEntry {
    name: string;
    file: string;
    line: number;
    members: string[];
    reason: string;
}
interface Inventory {
    generated: string;
    /** The client roots the scan read, project-relative. */
    roots: string[];
    unions: UnionEntry[];
    ignored: IgnoredEntry[];
}
/** One planned capture: one per member, plus `null` for a nullable output. */
interface PlannedCapture {
    id: string;
    union: string;
    member: string | null;
    kind: UnionKind;
    mechanism: Mechanism | null;
}
type Mechanism = 'mount' | 'solve';
/** One line of a state run's results file, appended per capture. */
interface StateResult {
    id: string;
    union: string;
    member: string | null;
    ok: boolean;
    /** Report-relative path of the subject image, or null when no file was written. */
    subject: string | null;
    context: string | null;
    provenance: Provenance | null;
    /** Did the feature's own function agree. Null when no function was declared. */
    verified: boolean | null;
    answered?: string | null;
    error: string | null;
    reason?: FailReason;
    fieldsTried?: string[];
    sameAs?: string | null;
    intended?: string | null;
    actual?: string | null;
    missingProp?: string | null;
    component?: string;
    expect?: string;
    ms: number;
}
/** The kind that the sites imply. It is the only way a kind is set. */
declare function kindFor(inputs: readonly unknown[], outputs: readonly unknown[]): UnionKind;
/** The mechanism for a kind. `both` prefers mounting, because a mount cannot miss its member. */
declare function mechanismFor(kind: UnionKind): Mechanism | null;
/**
 * Every problem of an inventory, as sentences that name the union. It returns all of them at once,
 * because a scanner that drifted is wrong about a whole shape of thing.
 */
declare function validateInventory(inv: unknown): string[];
/**
 * Every capture an inventory demands: one per member per union, plus one for `null` where a
 * function may return it. A `neither` union still yields captures, so the run fails and names them.
 */
declare function plannedCaptures(inv: Pick<Inventory, 'unions'>): PlannedCapture[];

/** An inventory from text, validated, or an error that names every problem. */
declare function parseInventory(text: string, source: string): Inventory;
/** The unions that nothing takes and nothing returns. Each fails the run (spec 2.14 rule C1). */
declare function neitherUnions(inv: Pick<Inventory, 'unions'>): UnionEntry[];
/** The issue a `neither` union earns, ready to file by hand. Nothing here opens a connection. */
declare function issueFor(union: UnionEntry): {
    title: string;
    body: string;
};
/** The runner's JSONL. A line that does not parse is reported, never skipped. */
declare function parseResults(text: string): {
    attempts: StateResult[];
    malformed: string[];
};
/** A planned capture joined to its result line, or to the reason it has none. */
type MergedRow = Partial<StateResult> & Partial<PlannedCapture> & {
    id: string;
    ok: boolean;
    reported: boolean;
    extra?: boolean;
    why?: string;
    error?: string | null;
};
/**
 * The state coverage section: a matrix per union, and the heading carries the arithmetic. It
 * counts renderings, not members, so a union may report more rows than members.
 */
declare function renderReport(args: {
    inventory: Pick<Inventory, 'unions'>;
    rows: readonly MergedRow[];
    slug?: string;
    narrowedBy?: string | null;
    notRun?: Partial<Record<Mechanism, string>>;
}): string;
/** A capture group for the intercepted runner: one union, one route, one response. */
interface CaptureGroup {
    id: string;
    union: string;
    leg: string;
    route: string;
    provenance: 'intercepted';
    intercept: {
        url: string;
        container: string;
    };
    settle: DeliveryDescriptor['settle'];
    act?: unknown[];
    verify: {
        module: string;
        export: string;
        async?: boolean;
        args?: unknown[];
    };
    solve?: {
        shape: Shape;
        pivots?: {
            literals: number[];
            names: string[];
        };
        pivotModules?: string[];
        limit?: number;
        batchSize?: number;
    };
    members: {
        id: string;
        member: string | null;
        expect?: string | null;
        subject?: unknown;
    }[];
    contrast?: unknown;
    diffRoot?: string;
    ignoreAttributes?: string[];
    maxSubjectAreaRatio?: number;
    /** The persona the group runs signed in as (`fixture.persona` of the descriptor). */
    persona?: string;
}
/** Every group the intercepted runner can take, and every union it cannot take, with the reason. */
declare function groupsFor(inventory: Pick<Inventory, 'unions'>, captures: readonly PlannedCapture[], defaultLeg: string, surface?: Surface): {
    groups: CaptureGroup[];
    blocked: Record<string, string>;
};
/** The inventory with delivery descriptors attached by union name. */
declare function mergeDelivery(inventory: Inventory, delivery: Record<string, DeliveryDescriptor>): Inventory;
/** A state run plan: the inventory and every capture, before anything renders. */
interface StatesPlan {
    generated: string;
    slug: string;
    source: string;
    scanned: number;
    narrowedBy: string | null;
    inventory: Inventory;
    captures: PlannedCapture[];
}
/** Builds the plan of a run from an inventory, narrowed when files or folders are given. */
declare function buildPlan(args: {
    inventory: Inventory;
    source: string;
    slug: string;
    generated: string;
    narrow?: {
        files?: string[];
        dirs?: string[];
        label: string;
    };
}): StatesPlan;
/**
 * The full report of a run and its exit code: the matrix, the refusals and the `neither` issues.
 * A mechanism that did not run counts against the exit code: coverage it did not measure is
 * coverage the report cannot claim.
 */
declare function finishRun(args: {
    plan: StatesPlan;
    attempts: readonly StateResult[];
    malformed?: readonly string[];
    notRun?: Partial<Record<Mechanism, string>>;
    blocked?: Record<string, string>;
}): {
    lines: string[];
    code: number;
    rows: MergedRow[];
};

/** The detail fields a failure reason carries. */
interface FailureDetail {
    fieldsTried?: string[];
    sameAs?: string | null;
    intended?: string | null;
    actual?: string | null;
    missingProp?: string | null;
}
/** A failure that knows its reason, so nothing has to read its text. */
declare class CaptureFailure extends LaunchwrightError {
    readonly reason: FailReason;
    readonly detail: FailureDetail;
    constructor(reason: FailReason, message: string, detail?: FailureDetail, cause?: unknown);
}
/** A live interception, the corpus it collected, and whether it fired. */
interface Substitution {
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
/**
 * Rewrites one list inside the real API response and leaves every other byte alone. A throw in a
 * route handler is lost by the browser runner, so every failure is recorded and `assertApplied`
 * turns it into a failed capture.
 */
declare function installSubstitution(page: RoutablePage, spec: {
    url: string;
    container: string;
}): Promise<Substitution>;
/** One element's identity and its children. The path is derived by the diff, not stored. */
interface TreeNode {
    tag: string;
    /** Tag, sorted attributes and the node's own text. */
    self: string;
    children: TreeNode[];
}
/**
 * Where the state is drawn, found by asking the page what changed. The container is the deepest
 * node whose differing children are exactly `count` elements of one tag: N renderings of one
 * component. No difference is the `identical` finding.
 */
declare function locateSubjects(a: TreeNode, b: TreeNode, count: number): {
    ancestor: number[];
    paths: number[][];
};
/** Records one evidence file in the ledger. The caller knows the leg, the target and the attempt. */
type EvidenceRecorder = (entry: {
    file: string;
    kind: EvidenceKind;
    row: string;
}) => Promise<void>;
/** What a capture run needs besides the session. */
interface CaptureContext {
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
 * Captures every member of one group: a subject image and a context image each, provenance
 * `intercepted`. It returns one result per member, also when the group fails before any picture.
 */
declare function captureGroup(session: QaSession, page: RoutablePage, group: CaptureGroup, ctx: CaptureContext): Promise<{
    results: StateResult[];
    notes: string[];
}>;

/** A source file, project-relative, with its text. */
interface SourceText {
    file: string;
    text: string;
}
/** A finding of the scan that is not a union: an opt-out without a reason, or a duplicate name. */
interface ScanProblem {
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
declare function isProductSource(rel: string): boolean;
/** The result of a scan: the inventory, and every problem found on the way. */
interface ScanResult {
    inventory: Inventory;
    problems: ScanProblem[];
}
/**
 * The inventory from file contents. Pure and without I/O. `sources` declare the unions and hold the
 * sites. `extraTypes` only name the file and the fields of a parameter type. Problems are returned,
 * not thrown, so `lw qa check` can report each one (spec 2.14 rule C1).
 */
declare function analyzeSources(input: {
    sources: SourceText[];
    extraTypes?: SourceText[];
    roots: string[];
    generated: string;
}): ScanResult;
/** Every product source under one project-relative folder, project-relative and sorted. */
declare function readTree(projectRoot: string, dir: string): SourceText[];
/** Scans a project: every client root, plus the type roots for parameter shapes. */
declare function scanProject(projectRoot: string, options: {
    clientRoots: string[];
    typeRoots?: string[];
    generated: string;
}): ScanResult & {
    sources: SourceText[];
};

/** One route table: a file and the surface its routes serve. */
interface RouteTable {
    file: string;
    surface: Surface;
}
/** `qa.routeTables` as tables. A plain string is a `web` table. */
declare function normaliseTables(entries: readonly (string | RouteTable)[]): RouteTable[];
/** One table of the route map, as the summary prints it. */
interface TableSummary {
    file: string;
    surface: Surface;
    found: boolean;
    rows: number;
    resolved: number;
    unresolved: string[];
    pageless: string[];
}
interface RouteMapUnion {
    union: string;
    kind: UnionEntry['kind'];
    mechanism: ReturnType<typeof mechanismFor>;
    anchor: string;
    members: string[];
    routes: DeliveryRoute[];
    why?: string;
}
interface RouteMap {
    generated: string;
    tables: TableSummary[];
    unions: RouteMapUnion[];
}
/**
 * The route map: every union, and every address that draws it, nearest first. Pure and without I/O.
 *
 * @param sources the client sources and the route table files
 * @param pageRoots the client roots that hold `pages/`
 */
declare function buildRouteMap(input: {
    inventory: Pick<Inventory, 'unions'>;
    sources: readonly SourceText[];
    tables: readonly RouteTable[];
    pageRoots: readonly string[];
    aliases?: Readonly<Record<string, string>>;
    /** `qa.routeWrappers`: the prefix a path wrapper adds, by function name, for a wrapper whose body the scan cannot read. */
    wrappers?: Readonly<Record<string, string>>;
    generated: string;
}): RouteMap;
/** The inventory with each union's routes, and the reason when it has none. */
declare function attachRoutes<I extends Pick<Inventory, 'unions'>>(inventory: I, map: RouteMap): I;
/** The summary a person reads: one block per union, and a sentence where there is no route. */
declare function renderRouteSummary(map: RouteMap): string;

/** The project-relative path of the inventory file (spec 2.7). */
declare const STATES_FILE = ".lw/qa/states.json";
/**
 * The import aliases of the client roots, read from `compilerOptions.paths` of a tsconfig in each
 * root or in its parent folder (for `apps/client/src`, that is `apps/client`). An `extends` chain
 * is not followed.
 */
declare function readAliases(projectRoot: string, clientRoots: readonly string[]): Record<string, string>;
interface StatesScan {
    /** The inventory with the routes of each union attached. */
    inventory: Inventory;
    problems: ScanProblem[];
    map: RouteMap;
}
/** Scans the states of a project and derives the route of each union. */
declare function scanStates(projectRoot: string, config: Pick<QaConfig, 'clientRoots' | 'typeRoots' | 'routeTables'> & Partial<Pick<QaConfig, 'routeWrappers'>>, generated: string): StatesScan;

interface StateFinding {
    rule: 'C1' | 'C4';
    union: string;
    file: string;
    line: number;
    message: string;
}
/**
 * Rule C1: every visible state comes from a named state union, or carries
 * `@qa-states ignore <reason>`. It fails a `neither` union, an ignore tag without a reason or with
 * another directive, a repeated tag, and two unions of one name.
 */
declare function c1Findings(inventory: Pick<Inventory, 'unions'>, problems: readonly ScanProblem[]): StateFinding[];
/**
 * Rule C4: every route sits in the route table. It fails a union that no route in the tables
 * delivers and no harness can mount: nothing reaches its states. A `neither` union is C1's.
 * The inventory must carry the routes of `scanStates`.
 */
declare function c4Findings(inventory: Pick<Inventory, 'unions'>): StateFinding[];
/** Runs the scan of a project and returns every C1 and C4 finding, sorted by file and line. */
declare function stateFindings(projectRoot: string, config: Pick<QaConfig, 'clientRoots' | 'typeRoots' | 'routeTables'>, generated: string): StateFinding[];

/** The harness route, relative to the surface base (spec 2.7). */
declare const STATES_HARNESS_PATH = "/__states";
/**
 * The address that mounts one component with one set of props, relative to the surface base.
 * The props are JSON in the `props` query value. `width` sets the frame width (`w`).
 */
declare function mountUrl(options: {
    component: string;
    props?: Record<string, unknown>;
    width?: string | number | null;
}): string;
/** One planned capture resolved to a component, a field and props, or to the refusal that says why not. */
interface ResolvedMount {
    capture: PlannedCapture;
    leg: string;
    component: string | null;
    field: string | null;
    props: Record<string, unknown>;
    width: string | null;
    settle: Settle;
    /** The persona the capture runs signed in as (`fixture.persona` of the hints), or null. */
    persona: string | null;
    refusal: CaptureFailure | null;
}
/**
 * Resolves one capture for the harness. Every refusal is `unmountable` or `blocked`, and both are
 * failures: a state that nothing can mount is the finding. The field under test is written last,
 * so no hint can decide the state that the picture carries.
 */
declare function resolveMount(inventory: Pick<Inventory, 'unions'>, capture: PlannedCapture, defaultLeg: string): ResolvedMount;
/**
 * Mounts one capture and photographs it. A target without `evaluate` cannot prove the page is the
 * harness, so it is refused rather than trusted.
 */
declare function captureMounted(session: QaSession, r: ResolvedMount, ctx: {
    reportDir: string;
    slug: string;
    record: EvidenceRecorder;
    now: () => number;
}): Promise<StateResult>;

/** The descriptor files a run reads when `qa.states` names none. Both are optional. */
declare const DEFAULT_DELIVERY_FILE = ".lw/qa/delivery.json";
declare const DEFAULT_MOUNTS_FILE = ".lw/qa/mounts.json";
/** The inventory with each union's delivery descriptor and mount hints from the descriptor files. */
declare function withDescriptors(inventory: Inventory, root: string, config: Pick<QaConfig, 'states'>): Inventory;

/**
 * The route a Mini App persona session opens first. The navigation carries `?qa=<persona>`, and
 * the launch signs the persona in, as on a session row (spec 2.6). A web session signs in when it
 * opens, through `POST /__qa/session`.
 */
declare const PERSONA_LAUNCH_ROUTE = "/";
interface SessionPool {
    /** The open session of a persona, or of no persona for null. It opens on first use, and again after a crash. */
    get(persona: string | null): Promise<QaSession>;
    /** True when the session closed by itself. The next `get` of its persona opens a new one. */
    lost(session: QaSession): boolean;
    /** What the pool did that a reader should know: each reopen, and each failure to close a lost session. */
    readonly notes: string[];
    close(): Promise<void>;
}
/** A pool over one target and leg. `base` is the open options of every session, without the persona. */
declare function sessionPool(target: QaTarget, base: Omit<OpenOptions, 'persona'>): SessionPool;
/** A failed result for a capture that never reached its runner. */
declare function failedResult(capture: Pick<PlannedCapture, 'id' | 'union' | 'member'>, reason: FailReason, error: string): StateResult;
/**
 * Runs captures on the session of a persona. A session that does not open fails each capture as
 * `blocked` with the reason. When the session closed during the work, each failed capture becomes
 * `crashed` with the reason, and the next call opens a new session.
 */
declare function onSession(pool: SessionPool, persona: string | null, captures: readonly Pick<PlannedCapture, 'id' | 'union' | 'member'>[], work: (session: QaSession) => Promise<StateResult[]>): Promise<StateResult[]>;

export { ABSENT, type CaptureContext, CaptureFailure, type CaptureGroup, DEFAULT_DELIVERY_FILE, DEFAULT_MOUNTS_FILE, type DeliveryDescriptor, type DeliveryRoute, type EvidenceRecorder, FAIL_REASONS, type FailReason, type Field, IGNORE_TAG, type IgnoredEntry, type InputSite, type Inventory, KINDS, MAX_CANDIDATES, type Mechanism, type MountHints, NULL_STATE, type OutputSite, PERSONA_LAUNCH_ROUTE, PROVENANCE, type PlannedCapture, type RouteMap, type RouteTable, STATES_FILE, STATES_HARNESS_PATH, STATE_SUFFIXES, type ScanProblem, type ScanResult, type SessionPool, type Shape, type SourceText, type StateFinding, type StateResult, type StatesPlan, type StatesScan, type UnionEntry, type UnionKind, analyzeSources, anchorSubjects, attachRoutes, buildPlan, buildRouteMap, c1Findings, c4Findings, candidatePlan, candidates, captureGroup, captureMounted, describeCandidate, failedResult, fieldValues, finishRun, groupsFor, installSubstitution, isProductSource, isStateUnionName, issueFor, kindFor, locateSubjects, mechanismFor, mergeDelivery, mountUrl, neitherUnions, normaliseTables, onSession, parseInventory, parseResults, plannedCaptures, readAliases, readTree, renderReport, renderRouteSummary, resolveMount, scanProject, scanStates, sessionPool, solve, stateFindings, unreachable, validateInventory, validateShape, withDescriptors };
