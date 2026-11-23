// `lw qa session resolve|check|run` (spec 2.4, 2.15.4).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isCodedError, LaunchwrightError, systemClock } from '../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { type QaConfig, qaConfigOf } from '../config.mts';
import { git, repoRoot } from '../services/changes.mts';
import type { QaTargetRegistry } from '../drivers/target/contract.mts';
import { consentGate } from '../services/consent-gate.mts';
import { type ConsentManifest, computeManifest, type CredentialNeed, type DataNeed, type OutwardNeed } from '../services/contract.mts';
import { legDefinitions } from '../services/legs.mts';
import { loadManifest, type Shot, validateManifest } from '../services/manifest.mts';
import { resolveIssue, resolveSpec } from '../services/resolve.mts';
import { type FixtureArming, type ForkRunner, forkLabel, runManifest } from '../services/runner.mts';
import { createTargetRegistry } from '../services/targets.mts';
import type { Leg, Surface } from '../services/types.mts';
import { systemVideoTools } from '../services/video.mts';
import * as world from '../world/index.mts';
import { createFork, dropFork } from '../world/services/fork.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa session resolve <spec.md>',
  '       lw qa session resolve --issue <id> [<id> ...]',
  '       lw qa session check <plan.shots.json>',
  '       lw qa session run <plan.shots.json> [--legs a,b] [--only <id>,<id>] [--base [<surface>=]<url>]... [--allow-all] [--allow <item-id>]...',
  '  resolve   what the spec promised and what was built, or one row seed per intake issue, as JSON',
  '  check     validate a plan and print every problem',
  '  run       run every row on every leg, record the evidence, write the ledger and results.jsonl',
  '  --allow-all   grant every item of the run contract that the pass prints, so a rerun asks nothing (spec 2.6)',
  '  --allow <id>  grant one printed item, for example data:qa-world-arm; repeat it per item',
];

const SURFACES: readonly Surface[] = ['web', 'miniapp', 'bot'];

/** The factory that the world submodule exports (`fixtureArming`). `database` targets a fork (spec 2.4). */
type FixtureArmingFactory = (opts: {
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
  config?: Record<string, unknown>;
  env?: string;
  database?: string;
}) => Promise<FixtureArming>;

/**
 * A builder of lazy arming, or undefined when the world submodule gives no fixture arming. The
 * builder opens the QA world only when a row arms a state. `database` names a fork database (spec
 * 2.4); omit it for the shared QA world.
 */
function armingBuilder(opts: QaCommandOptions): ((database?: string) => FixtureArming) | undefined {
  const factory = (world as { fixtureArming?: FixtureArmingFactory }).fixtureArming;
  if (!factory) return undefined;
  return (database) => {
    let opened: Promise<FixtureArming> | null = null;
    const open = (): Promise<FixtureArming> => {
      opened ??= factory({ cwd: opts.cwd, out: opts.out, err: opts.err, ...(opts.config ? { config: opts.config } : {}), ...(opts.env ? { env: opts.env } : {}), ...(database ? { database } : {}) });
      return opened;
    };
    return {
      arm: async (state, o) => (await open()).arm(state, o),
      disarm: async () => {
        if (opened) await (await opened).disarm();
      },
    };
  };
}

/**
 * The per-pass fork runner (spec 2.4, R3): it forks the QA database for a row group, arms the
 * group's facts on the fork, and drops the fork after the group. It names the QA database lazily, so
 * a pass with no fork group reads the checkout only when the first fork is created.
 */
function forkRunner(opts: QaCommandOptions, build: ((database?: string) => FixtureArming) | undefined): ForkRunner {
  const root = opts.cwd;
  const sections = opts.config ?? {};
  let named: Promise<string> | null = null;
  const database = (): Promise<string> => (named ??= world.readCheckout(root).then((checkout) => world.qaDatabase(sections, checkout)));
  return {
    create: async (label) => createFork({ root, sections, database: await database(), label, out: opts.out }),
    drop: async (name) => dropFork({ root, sections, database: await database(), name, out: opts.out }),
    ...(build ? { arming: (db: string) => build(db) } : {}),
  };
}

function list(value: string | undefined, flag: string): string[] {
  const parts = (value ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new LaunchwrightError('qa.session.usage', `${flag} needs a comma-separated list`);
  return parts;
}

/** `--base <url>` sets every surface; `--base web=<url>` sets one. */
function baseFlag(value: string | undefined, into: Partial<Record<Surface, string>>): void {
  const match = /^(web|miniapp|bot)=(.+)$/.exec(value ?? '');
  const url = match ? (match[2] as string) : (value ?? '');
  try {
    new URL(url);
  } catch (cause) {
    throw new LaunchwrightError('qa.session.usage', `--base ${value ?? ''} is not [<surface>=]<url>`, { cause });
  }
  for (const surface of match ? [match[1] as Surface] : SURFACES) into[surface] = url;
}

function revision(cwd: string): { commit: string; dirty: boolean } {
  const commit = git(cwd, ['rev-parse', 'HEAD'], { allowFail: true })?.trim();
  if (!commit) throw new LaunchwrightError('qa.session.git', `${cwd} has no commit. The ledger names the commit of each file.`);
  const status = git(cwd, ['status', '--porcelain'], { allowFail: true }) ?? '';
  return { commit, dirty: status.trim() !== '' };
}

/** The data and isolation steps of the selected rows: arming on the QA world, and forks (spec 2.4). */
function dataNeeds(shots: readonly Shot[]): DataNeed[] {
  const needs: DataNeed[] = [];
  const armed = new Set(shots.filter((shot) => forkLabel(shot) === undefined).flatMap((shot) => shot.fixture.arm));
  if (armed.size > 0) needs.push({ id: 'qa-world-arm', title: `Arm ${armed.size} state(s) on the QA world database, then disarm them` });
  const labels = [...new Set(shots.map(forkLabel).filter((label): label is string => label !== undefined))].sort();
  if (labels.length > 0) needs.push({ id: 'qa-database-fork', title: `Fork the QA database for row group(s) ${labels.join(', ')}, then drop each fork` });
  return needs;
}

/**
 * The run contract manifest of a plan (spec 2.6). The legs its rows use, narrowed by `--legs` and
 * `--only`, give the devices, and the `needs` hook of each leg's target gives its credentials and
 * outward actions. The selected rows give the data steps. A leg with no registered target runs as
 * `n/a`, so it adds no need.
 */
async function consentManifest(
  planPath: string,
  config: QaConfig,
  filter: { legs: string[] | null; only: string[] | null },
  targets: QaTargetRegistry,
): Promise<ConsentManifest> {
  const defs = legDefinitions(config);
  const byName = new Map(defs.map((leg) => [leg.name, leg]));
  const plan = await loadManifest(planPath, { legs: defs.map((leg) => leg.name) });
  const used = new Set<string>();
  const shots: Shot[] = [];
  for (const shot of plan.shots) {
    if (filter.only && !filter.only.includes(shot.id)) continue;
    const names = shot.legs.filter((name) => !filter.legs || filter.legs.includes(name));
    if (names.length > 0) shots.push(shot);
    for (const name of names) used.add(name);
  }
  const legs = [...used].map((name) => byName.get(name)).filter((leg): leg is Leg => leg !== undefined);
  const registered = new Set(targets.names());
  const credentials: CredentialNeed[] = [];
  const outward: OutwardNeed[] = [];
  const data: DataNeed[] = dataNeeds(shots);
  for (const leg of legs) {
    if (!registered.has(leg.target)) continue;
    const needs = targets.get(leg.target).needs?.(leg);
    credentials.push(...(needs?.credentials ?? []));
    outward.push(...(needs?.outward ?? []));
    data.push(...(needs?.data ?? []));
  }
  return computeManifest({ title: plan.title, legs, credentials, outward, data });
}

async function run(args: string[], opts: QaCommandOptions, config: QaConfig): Promise<number> {
  const parsed = parseCommandArgs({ values: ['legs', 'only'], switches: ['allow-all'], repeated: ['base', 'allow'] }, args);
  const [manifestArg, extra] = parsed.positionals;
  if (!manifestArg) throw new LaunchwrightError('qa.session.usage', 'run needs a plan path');
  if (extra !== undefined) throw new LaunchwrightError('qa.session.usage', `run does not know ${extra}`);
  const legs = parsed.values.legs === undefined ? null : list(parsed.values.legs, '--legs');
  const only = parsed.values.only === undefined ? null : list(parsed.values.only, '--only');
  const baseUrls: Partial<Record<Surface, string>> = { ...config.baseUrls };
  for (const value of parsed.lists.base) baseFlag(value, baseUrls);
  const manifestPath = resolve(opts.cwd, manifestArg);
  const targets = createTargetRegistry(config, opts.targets ?? {}, systemClock);
  const contract = await consentManifest(manifestPath, config, { legs, only }, targets);
  const choice = { allowAll: parsed.switches.has('allow-all'), allow: parsed.lists.allow };
  if (!(await consentGate(contract, { cwd: opts.cwd, out: opts.out, err: opts.err, ...choice }))) return 2;
  const build = armingBuilder(opts);
  const fixtures = build?.();
  const summary = await runManifest(
    { manifestPath, legs, only },
    {
      config,
      targets,
      clock: systemClock,
      baseUrls,
      revision: revision(opts.cwd),
      videoTools: systemVideoTools(),
      ...(fixtures ? { fixtures } : {}),
      fork: forkRunner(opts, build),
      out: opts.out,
      err: opts.err,
    },
  );
  const count = (status: string): number => summary.results.filter((r) => r.status === status).length;
  opts.out(
    `lw qa session run: ${summary.results.length} row and leg pairs: ${count('passed')} passed, ${count('failed')} failed, ` +
      `${count('n/a')} n/a, ${count('not-run')} not run. Next: lw qa report update ${config.reportDir}/${summary.slug}.md`,
  );
  return summary.exitCode;
}

const session: QaSubcommand = {
  name: 'session',
  summary: 'Resolve a spec or intake issues, check a plan, run a plan with evidence',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    const [action, ...rest] = args;
    const config = qaConfigOf(opts.config);
    const legs = legDefinitions(config);
    try {
      const resolveArgs = action === 'resolve' ? parseCommandArgs({ switches: ['issue'] }, rest) : null;
      if (resolveArgs?.switches.has('issue')) {
        const ids = resolveArgs.positionals;
        if (ids.length === 0) throw new UsageError('resolve --issue needs one issue id or more');
        const names = legs.map((l) => l.name);
        opts.out(JSON.stringify({ issues: ids.map((id) => resolveIssue(opts.cwd, id, names)) }, null, 2));
        return 0;
      }
      if (resolveArgs?.positionals.length === 1) {
        const repo = repoRoot(opts.cwd);
        const result = resolveSpec({
          repo,
          cwd: opts.cwd,
          specPath: resolveArgs.positionals[0] as string,
          reportDir: config.reportDir,
          clientRoots: config.clientRoots,
          legs,
          clock: systemClock,
        });
        opts.out(JSON.stringify(result, null, 2));
        return 0;
      }
      if (action === 'check' && rest.length === 1) {
        const path = resolve(opts.cwd, rest[0] as string);
        let parsed: unknown;
        try {
          parsed = JSON.parse(readFileSync(path, 'utf8'));
        } catch (cause) {
          throw new LaunchwrightError('qa.session.check', `Cannot read ${rest[0]} as JSON.`, { cause });
        }
        const errors = validateManifest(parsed, { legs: legs.map((l) => l.name) });
        if (errors.length > 0) {
          opts.err(`${rest[0]} is invalid: ${errors.length} problem(s)`);
          for (const e of errors) opts.err(`  ${e}`);
          return 1;
        }
        const shots = (parsed as { shots: Array<{ legs: string[] }> }).shots;
        const used = new Set(shots.flatMap((s) => s.legs));
        opts.out(`ok  ${rest[0]}: ${shots.length} row(s), legs ${legs.filter((l) => used.has(l.name)).map((l) => l.name).join(' ')}`);
        return 0;
      }
      if (action === 'run') return await run(rest, opts, config);
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa session ${action}: ${cause.code}: ${cause.message}`);
      return cause instanceof UsageError || cause.code === 'qa.session.usage' ? 2 : 1;
    }
    for (const line of USAGE) opts.err(line);
    return 2;
  },
};

export default session;
