// `lw qa check [--build]` (spec 2.14, 2.11.5, 2.6): the testability gate of a project. It prints
// each finding as `<rule> <file>:<line> <message>` and exits 1 on any. `lw verify` runs it when
// the qa module is installed.
import { LaunchwrightError, systemClock } from '../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { qaConfig, withAppPaths } from '../config.mts';
import { findingLine, runChecks } from '../services/check.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa check [--build]',
  '  C1, C4  every state union is reachable live, mounted or intercepted (the state scan)',
  '  C3      no component in qa.clientRoots reads ?qa= or branches on a QA flag',
  '  S1      no raw SQL in a .world.mts, and a feature with a client route has a .world.mts',
  '  wait    no waitForTimeout in a .world.mts, a .shots.json or a file under a qa/ folder',
  '  S3      no file in qa.buildDirs holds lw-qa-dev-only',
  '  --build a missing folder of qa.buildDirs is a finding too',
];

async function run(args: string[], opts: QaCommandOptions): Promise<number> {
  let build: boolean;
  try {
    const parsed = parseCommandArgs({ switches: ['build'] }, args);
    const [extra] = parsed.positionals;
    if (extra !== undefined) throw new UsageError(`unknown argument ${extra}`);
    build = parsed.switches.has('build');
  } catch (cause) {
    if (!(cause instanceof UsageError)) throw cause;
    opts.err(`lw qa check: ${cause.message}`);
    for (const line of USAGE) opts.err(line);
    return 2;
  }
  const parsed = qaConfig.safeParse(opts.config?.qa ?? {});
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `qa.${i.path.map(String).join('.')} ${i.message}`);
    throw new LaunchwrightError('qa.config.invalid', `Config section qa is invalid: ${keys.join('; ')}`, { context: { keys } });
  }
  const findings = await runChecks({ root: opts.cwd, qa: withAppPaths(parsed.data, opts.config), generated: systemClock.date().toISOString(), requireBuild: build });
  for (const f of findings) opts.out(findingLine(f));
  opts.err(findings.length === 0 ? 'lw qa check: no finding' : `lw qa check: ${findings.length} finding(s)`);
  return findings.length === 0 ? 0 : 1;
}

const check: QaSubcommand = {
  name: 'check',
  summary: 'Check testability: state triggers, no QA flag in components, world files, no waitForTimeout, no dev marker in the build',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    if (args[0] === '--help' || args[0] === '-h') {
      for (const line of USAGE) opts.err(line);
      return 0;
    }
    try {
      return await run(args, opts);
    } catch (cause) {
      if (!(cause instanceof LaunchwrightError)) throw cause;
      opts.err(`lw qa check: ${cause.message} (${cause.code})`);
      return 1;
    }
  },
};

export default check;
