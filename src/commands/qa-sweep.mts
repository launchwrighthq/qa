// `lw qa sweep plan --world <world.json> --delivery <delivery.json>`: a manifest with one row per
// world state and address (spec 1.3).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isCodedError, LaunchwrightError, systemClock } from '../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { readTextOrNullSync } from '../kernel/services/fs.mts';
import { qaConfigOf } from '../config.mts';
import { legDefinitions } from '../services/legs.mts';
import { validateManifest } from '../services/manifest.mts';
import { DEFAULT_CAP, planSweep, renderSweep } from '../services/sweep.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa sweep plan --world <world.json> --delivery <delivery.json> [--out <plan.shots.json>]',
  `         [--cap <n>] [--spec <path>] [--title <text>] [--spec-ref <n.n>] [--strict]`,
  '  --world      lw qa world list --json, or lw qa world status --json for seeded handle values',
  '  --delivery   the route map of lw qa states scan',
  `  --cap        addresses per state, default ${DEFAULT_CAP}`,
  '  --strict     exit 1 when a state is owed',
];

const VALUE_FLAGS = ['world', 'delivery', 'out', 'cap', 'spec', 'title', 'spec-ref'] as const;

/** The JSON of an input file. A missing file or text that is not JSON throws `qa.sweep.input`. */
function inputJson(cwd: string, path: string, what: string): unknown {
  const at = resolve(cwd, path);
  const raw = readTextOrNullSync(at);
  if (raw === null) throw new LaunchwrightError('qa.sweep.input', `Cannot read the ${what} file ${at}.`);
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new LaunchwrightError('qa.sweep.input', `The ${what} file ${at} is not JSON.`, { cause });
  }
}

const sweep: QaSubcommand = {
  name: 'sweep',
  summary: 'Plan one row per world state and address from the world registry and the delivery map',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    const [action, ...rest] = args;
    let parsed;
    try {
      parsed = parseCommandArgs({ values: VALUE_FLAGS, switches: ['strict'] }, rest);
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
      parsed = undefined;
    }
    const flags = parsed?.values ?? {};
    if (action !== 'plan' || !parsed || parsed.positionals.length > 0 || flags.world === undefined || flags.delivery === undefined) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const strict = parsed.switches.has('strict');
    const config = qaConfigOf(opts.config);
    const legs = legDefinitions(config);
    try {
      const cap = flags.cap !== undefined ? Number(flags.cap) : DEFAULT_CAP;
      const manifest = planSweep({
        world: inputJson(opts.cwd, flags.world, 'world'),
        delivery: inputJson(opts.cwd, flags.delivery, 'delivery'),
        legs,
        cap,
        generated: systemClock.date().toISOString(),
        ...(flags.spec !== undefined ? { spec: flags.spec } : {}),
        ...(flags.title !== undefined ? { title: flags.title } : {}),
        ...(flags['spec-ref'] !== undefined ? { specRef: flags['spec-ref'] } : {}),
      });
      // The planner checks its plan with the runner's own check: a plan the runner refuses is worth nothing.
      const errors = validateManifest(manifest, { legs: legs.map((l) => l.name) });
      if (errors.length > 0) {
        opts.err('lw qa sweep: the plan is not a valid manifest');
        for (const e of errors) opts.err(`  ${e}`);
        return 1;
      }
      const json = `${JSON.stringify(manifest, null, 2)}\n`;
      const out = flags.out;
      if (out) {
        const target = resolve(opts.cwd, out);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, json);
        opts.out(`${renderSweep(manifest)}\nplan -> ${target}`);
      } else {
        opts.out(json.trimEnd());
        opts.err(renderSweep(manifest));
      }
      // Owed states are red rows of the report, not a planner failure. `--strict` makes them one.
      return strict && manifest.sweep.owed > 0 ? 1 : 0;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa sweep: ${cause.message}`);
      return 1;
    }
  },
};

export default sweep;
