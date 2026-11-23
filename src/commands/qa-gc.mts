// `lw qa gc --keep <n>` (spec 2.12.3): deletes the evidence of older reports and keeps the reports.
import { resolve } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { parseCommandArgs, UsageError } from '@launchwrighthq/kernel/args';
import { qaConfigOf } from '../config.mts';
import { gcReports } from '../services/gc.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const gc: QaSubcommand = {
  name: 'gc',
  summary: 'Delete the evidence of older reports and keep the report files',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    let given: string | undefined;
    try {
      const parsed = parseCommandArgs({ values: ['keep'] }, args);
      if (parsed.positionals.length === 0) given = parsed.values.keep;
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
    }
    const keep = given !== undefined && /^\d+$/.test(given) ? Number(given) : null;
    if (keep === null) {
      opts.err('usage: lw qa gc --keep <n>   keep the evidence of the n newest reports');
      return 2;
    }
    const config = qaConfigOf(opts.config);
    try {
      const result = await gcReports(resolve(opts.cwd, config.reportDir), keep);
      for (const d of result.deleted) opts.out(`deleted the evidence of ${d.slug} (${d.bytes} bytes)`);
      opts.out(`lw qa gc: kept the evidence of ${result.kept.length} reports, deleted ${result.deleted.length}`);
      return 0;
    } catch (cause) {
      if (!(cause instanceof LaunchwrightError)) throw cause;
      opts.err(`lw qa gc: ${cause.code}: ${cause.message}`);
      return 1;
    }
  },
};

export default gc;
