// `lw qa changes [--since <date|sha> | --last] [--json]`: what a commit range changed (spec 1.3).
import { LaunchwrightError, systemClock } from '../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { qaConfigOf } from '../config.mts';
import { digest, renderChanges, repoRoot } from '../services/changes.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa changes [--since <date|sha> | --last] [--json]',
  '  --since 2026-08-21 | "2026-08-21 14:00" | <sha>   the first commit of the range',
  '  --last    continue after the Range: line of the newest report (the default)',
  '  --json    the whole digest as JSON',
];

const changes: QaSubcommand = {
  name: 'changes',
  summary: 'Group the commits of a range by area and list the signals of user-visible change',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    let parsed;
    try {
      parsed = parseCommandArgs({ values: ['since'], switches: ['json', 'last'] }, args);
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
      parsed = undefined;
    }
    if (!parsed || parsed.positionals.length > 0) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const since = parsed.switches.has('last') ? undefined : parsed.values.since;
    const json = parsed.switches.has('json');
    const config = qaConfigOf(opts.config);
    try {
      const result = digest(repoRoot(opts.cwd), { ...(since !== undefined ? { since } : {}), reportDir: config.reportDir, clock: systemClock });
      opts.out(json ? JSON.stringify(result, null, 2) : renderChanges(result));
      return 0;
    } catch (cause) {
      if (!(cause instanceof LaunchwrightError)) throw cause;
      opts.err(`lw qa changes: ${cause.message}`);
      return 1;
    }
  },
};

export default changes;
