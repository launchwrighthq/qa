// `lw qa session resolve|check|run` (spec 2.4, 2.15.4).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isCodedError, LaunchwrightError, systemClock } from '../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { type QaConfig, qaConfigOf } from '../config.mts';
import { git, repoRoot } from '../services/changes.mts';
import { type ConsentManifest, computeManifest, diff, fileConsentStore, grant, manifestHash } from '../services/contract.mts';
import { legDefinitions } from '../services/legs.mts';
import { loadManifest, validateManifest } from '../services/manifest.mts';
import { resolveIssue, resolveSpec } from '../services/resolve.mts';
import { type FixtureArming, type ForkRunner, runManifest } from '../services/runner.mts';
import { createTargetRegistry } from '../services/targets.mts';
import type { Leg, Surface } from '../services/types.mts';
import { systemVideoTools } from '../services/video.mts';
import * as world from '../world/index.mts';
import { worldContext } from '../world/services/context.mts';
import { worldForkRunner } from '../world/services/fork-server.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa session resolve <spec.md>',
  '       lw qa session resolve --issue <id> [<id> ...]',
  '       lw qa session check <plan.shots.json>',
  '       lw qa session run <plan.shots.json> [--legs a,b] [--only <id>,<id>] [--base [<surface>=]<url>]... [--allow-all]',
  '  resolve   what the spec promised and what was built, or one row seed per intake issue, as JSON',
  '  check     validate a plan and print every problem',
  '  run       run every row on every leg, record the evidence, write the ledger and results.jsonl',
  '  --allow-all   grant every run contract item once, so a rerun asks nothing (spec 2.6)',
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
 * The per-pass fork runner (spec 2.4, R3): `worldForkRunner` forks the QA database for a row group,
 * serves the QA app on the fork, and drops the fork after the group. It reads the world context at
 * the first fork, so a pass with no fork group reads neither the checkout nor the QA app entry.
 */
function forkRunner(opts: QaCommandOptions): ForkRunner {
  let built: Promise<ForkRunner> | null = null;
  const runner = (): Promise<ForkRunner> =>
    (built ??= (async () => {
      const ctx = await worldContext({ cwd: opts.cwd, out: opts.out, err: opts.err, ...(opts.config ? { config: opts.config } : {}), ...(opts.env ? { env: opts.env } : {}) });
      const entry = await world.loadAppEntry(ctx.root, ctx.qa);
      return worldForkRunner({ root: ctx.root, sections: ctx.sections, env: ctx.env, overlay: ctx.overlay, entry, registry: ctx.registry, out: opts.out });
    })());
  return {
    create: async (label) => (await runner()).create(label),
    drop: async (name) => (await runner()).drop(name),
    serve: async (database) => (await runner()).serve(database),
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

/**
 * The run contract manifest of a plan (spec 2.6). The legs its rows use, narrowed by `--legs` and
 * `--only`, give the needs. `computeManifest` turns a device leg into one device or rig item.
 */
async function consentManifest(planPath: string, config: QaConfig, filter: { legs: string[] | null; only: string[] | null }): Promise<ConsentManifest> {
  const defs = legDefinitions(config);
  const byName = new Map(defs.map((leg) => [leg.name, leg]));
  const plan = await loadManifest(planPath, { legs: defs.map((leg) => leg.name) });
  const used = new Set<string>();
  for (const shot of plan.shots) {
    if (filter.only && !filter.only.includes(shot.id)) continue;
    for (const name of shot.legs) {
      if (!filter.legs || filter.legs.includes(name)) used.add(name);
    }
  }
  const legs = [...used].map((name) => byName.get(name)).filter((leg): leg is Leg => leg !== undefined);
  return computeManifest({ title: plan.title, legs });
}

/**
 * Prints the run contract once and reads the prior grant under `.lw/qa/consent` (spec 2.6). A
 * manifest with no need proceeds at once, and a need the record already covers asks nothing. With
 * `--allow-all` the pass records a grant for every item and proceeds. Without it, a new need stops
 * the pass, so an outward action never runs without an explicit grant. The print shows titles only.
 */
async function runContract(opts: QaCommandOptions, manifest: ConsentManifest, allowAll: boolean): Promise<boolean> {
  if (manifest.items.length === 0) return true;
  const store = fileConsentStore(join(opts.cwd, '.lw/qa/consent'));
  const hash = manifestHash(manifest);
  const prior = await store.read(hash);
  const pending = diff(prior, manifest);
  opts.out(`run contract for "${manifest.title}": ${manifest.items.length} item(s) need consent`);
  for (const item of manifest.items) opts.out(`  ${item.group.padEnd(11)} ${item.title}`);
  if (pending.length === 0) {
    opts.out('run contract: every item is granted; asking nothing');
    return true;
  }
  if (allowAll) {
    await store.write(hash, grant(manifest, 'all'));
    opts.out(`run contract: allow all recorded ${manifest.items.length} grant(s) under .lw/qa/consent`);
    return true;
  }
  opts.err(`run contract: ${pending.length} item(s) need a grant. Re-run with --allow-all to grant them:`);
  for (const item of pending) opts.err(`  ${item.outward ? 'outward ' : ''}${item.title}`);
  return false;
}

async function run(args: string[], opts: QaCommandOptions, config: QaConfig): Promise<number> {
  const parsed = parseCommandArgs({ values: ['legs', 'only'], switches: ['allow-all'], repeated: ['base'] }, args);
  const [manifestArg, extra] = parsed.positionals;
  if (!manifestArg) throw new LaunchwrightError('qa.session.usage', 'run needs a plan path');
  if (extra !== undefined) throw new LaunchwrightError('qa.session.usage', `run does not know ${extra}`);
  const legs = parsed.values.legs === undefined ? null : list(parsed.values.legs, '--legs');
  const only = parsed.values.only === undefined ? null : list(parsed.values.only, '--only');
  const baseUrls: Partial<Record<Surface, string>> = { ...config.baseUrls };
  for (const value of parsed.lists.base) baseFlag(value, baseUrls);
  const manifestPath = resolve(opts.cwd, manifestArg);
  const contract = await consentManifest(manifestPath, config, { legs, only });
  if (!(await runContract(opts, contract, parsed.switches.has('allow-all')))) return 2;
  const build = armingBuilder(opts);
  const fixtures = build?.();
  const summary = await runManifest(
    { manifestPath, legs, only },
    {
      config,
      targets: createTargetRegistry(config, opts.targets ?? {}, systemClock),
      clock: systemClock,
      baseUrls,
      revision: revision(opts.cwd),
      videoTools: systemVideoTools(),
      ...(fixtures ? { fixtures } : {}),
      fork: forkRunner(opts),
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
