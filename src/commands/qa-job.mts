// `lw qa job` lists the registered jobs; `lw qa job run <kind> [--payload <json>] [--tenant <id>]`
// runs one once on the QA app (spec 2.14 rule S4).
import { appPath, LaunchwrightError } from '@launchwrighthq/kernel';
import { importFromProject, loadAppEntry } from '../world/services/app.mts';
import { guarded, parseArgs, withWorld, worldContext } from '../world/services/context.mts';
import { importProjectJobs, type JobRegistry, listJobs, runJob } from '../world/services/jobs.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa job [list]                                      list the registered jobs',
  '       lw qa job run <kind> [--payload <json>] [--tenant <id>] run one job once on the QA app',
];

function payloadOf(text: string | true | undefined): unknown {
  if (typeof text !== 'string') return undefined;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError('qa.job.payload', '--payload is not JSON.', { cause });
  }
}

async function run(args: string[], opts: QaCommandOptions): Promise<number> {
  const { words, options } = parseArgs(args, [], ['payload', 'tenant']);
  const [sub = 'list', kind] = words;
  if (sub !== 'list' && !(sub === 'run' && kind !== undefined)) {
    for (const line of USAGE) opts.err(line);
    return 2;
  }
  const ctx = await worldContext(opts);
  // The app module imports the module packages, so their jobs register; then the project jobs.
  await loadAppEntry(ctx.root, ctx.qa);
  await importProjectJobs(ctx.root, `${appPath(opts.config ?? {}, 'node', 'apps/api')}/src/jobs`);
  const queue = await importFromProject<JobRegistry>(ctx.root, '@launchwrighthq/queue');
  if (sub === 'list') {
    const kinds = listJobs(queue);
    for (const k of kinds) opts.out(k);
    if (kinds.length === 0) opts.out('no registered job');
    return 0;
  }
  const payload = payloadOf(options.payload);
  const tenantId = typeof options.tenant === 'string' ? options.tenant : undefined;
  await withWorld(ctx, (world) => runJob(world, queue, { kind: kind!, payload, ...(tenantId ? { tenantId } : {}), clock: ctx.clock }));
  opts.out(`ran ${kind} once on ${ctx.overlay.database}`);
  return 0;
}

const job: QaSubcommand = {
  name: 'job',
  summary: 'list the registered jobs, or run one once on the QA app',
  run: (args, opts) => guarded('job', opts, () => run(args, opts)),
};

export default job;
