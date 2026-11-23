import { r as SessionLogLine, g as OpenOptions, Q as QaTarget, l as QaTargetCapability, T as TargetReadiness, L as Leg, D as Driver, q as RowResult } from './contract-xgrBaS32.cjs';
import { C as Clock } from './clock-BUdCJ9bN.cjs';

/** One check of a driver kind's contract. */
interface ContractCase<D> {
    name: string;
    run(driver: D): Promise<void> | void;
}

/** One scripted page of the fake target. */
interface FakeRoute {
    /** Selectors the page shows. `body` is always there. */
    selectors?: string[];
    /** The route the page lands on instead, as a server redirect does. */
    redirect?: string;
    /** Click targets that open another route. */
    links?: Record<string, string>;
    /** The page has a decoded image (settle `artwork`). */
    artwork?: boolean;
    /** The page has a playing video (settle `video`). */
    video?: boolean;
    /** The page keeps `aria-busy="true"` (settle `busy` fails). */
    busy?: boolean;
    /** Log lines the page writes when it opens. */
    logs?: Omit<SessionLogLine, 'at'>[];
    /** The screenshot is one flat colour, as a blank screen is. */
    blank?: boolean;
}
interface FakeTargetOptions {
    /** The driver name. Default `fake`. */
    name?: string;
    /** Default `input`, `screenshot`, `video`, `webview`. */
    capabilities?: QaTargetCapability[];
    /** Pages by route. A route not listed is an empty page. */
    routes?: Record<string, FakeRoute>;
    /** What `ready` answers. Default ready. */
    readiness?: TargetReadiness;
    /** Writes a trace file in `trace()`. Default false: `trace()` gives null. */
    trace?: boolean;
    /** Writes an accessibility dump in `dump()`. Default false: `dump()` gives null. */
    dump?: boolean;
    clock?: Clock;
}
/** What the fake records about one session, for assertions. */
interface FakeSessionLog {
    opts: OpenOptions;
    /** One line per call: `navigate /x`, `act click #go`, `screenshot <path>`, ... */
    calls: string[];
    closed: boolean;
}
/** The fake target, with the log of every session it opened. */
interface FakeTarget extends QaTarget {
    readonly sessions: FakeSessionLog[];
}
/** The required fake `qa.target` driver. */
declare function createFakeTarget(opts?: FakeTargetOptions): FakeTarget;

/** A target under the contract, with the surface it opens and a folder for its files. */
interface TargetHarness extends Driver {
    readonly target: QaTarget;
    readonly leg: Leg;
    readonly baseUrl: string;
    /** A fresh folder for the files of one case. */
    outDir(): Promise<string>;
}
interface HarnessOptions {
    baseUrl: string;
    outDir: () => Promise<string>;
    /** The leg the cases open. Default: a 640x480 `web` leg on this target. */
    leg?: Leg;
}
/** Wraps a target for `runContract`: the harness reports the target's name, version and capabilities. */
declare function targetHarness(target: QaTarget, opts: HarnessOptions): TargetHarness;
/** The base path of the contract site. Routes are relative to it. */
declare const CONTRACT_BASE = "/site";
/** The fake target pages that mirror the contract site. */
declare function contractFakeRoutes(): Record<string, FakeRoute>;
/** A running contract site on loopback. */
interface ContractSite {
    /** `http://127.0.0.1:<port>/site` */
    baseUrl: string;
    close(): Promise<void>;
}
/** Serves the contract site on `127.0.0.1` with a free port. */
declare function serveContractSite(): Promise<ContractSite>;
/** The contract suite of the `qa.target` driver kind. */
declare const targetContract: {
    kind: string;
    specVersion: string;
    cases: ContractCase<TargetHarness>[];
};

/** The Playwright browser cache of the account that runs the tests. */
declare const BROWSERS_PATH: string;
/** The newest installed `chrome-headless-shell`. Fails with the install command when there is none. */
declare function headlessShell(): string;

/** An RGBA image with a diagonal pattern, so its luminance spread is far above the blank limit. */
declare function patternPng(width: number, height: number): Uint8Array;
/** An RGBA image of one color. */
declare function uniformPng(width: number, height: number, gray?: number): Uint8Array;
/** What one row and leg of the fixture records. Default: passed, one landscape or portrait screenshot. */
interface FixturePair {
    status?: RowResult['status'];
    failures?: RowResult['failures'];
    reason?: string;
    /** False: no evidence file. */
    files?: boolean;
}
interface ReportFixtureOptions {
    slug?: string;
    /** Rows with their legs and `source`. Default: `home.guest` on `desktop` and `mobile-web`, source `commit:abc1234`. */
    rows?: Array<{
        id: string;
        legs: string[];
        source?: string[];
    }>;
    /** Overrides by `<row>@<leg>`. */
    pairs?: Record<string, FixturePair>;
    /** The header line that names what the pass covers. Default: `Range: abc1234..def5678`. */
    header?: {
        field: 'Range' | 'Spec' | 'Issues';
        value: string;
    };
}
/** Writes the report and returns its path and slug. The `desktop` leg gets landscape shots. */
declare function writeReportFixture(reportDir: string, opts?: ReportFixtureOptions): Promise<{
    mdPath: string;
    slug: string;
}>;
/** The intake id of the issue fixture. */
declare const FIXTURE_ISSUE = "tg-fixture-7";
/**
 * An issue pass on disk (spec 2.15.4): under `<root>/docs/qa`, the report fixture with the header
 * `Issues: tg-fixture-7`, the row `home.guest` and the row `bot.silent` with `source: issue:tg-fixture-7`,
 * both on `desktop`; and under `<root>/.lw/qa/intake/tg-fixture-7/`, the record with one image.
 * `link` is the report-relative link to that image. Section 4 holds no statement yet.
 */
declare function writeIssueReportFixture(root: string, opts?: Pick<ReportFixtureOptions, 'pairs'>): Promise<{
    mdPath: string;
    slug: string;
    reportDir: string;
    issue: string;
    link: string;
}>;

export { BROWSERS_PATH, CONTRACT_BASE, type ContractSite, FIXTURE_ISSUE, type FakeRoute, type FakeSessionLog, type FakeTarget, type FakeTargetOptions, type FixturePair, type HarnessOptions, type ReportFixtureOptions, type TargetHarness, contractFakeRoutes, createFakeTarget, headlessShell, patternPng, serveContractSite, targetContract, targetHarness, uniformPng, writeIssueReportFixture, writeReportFixture };
