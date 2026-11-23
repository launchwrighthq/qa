// `lw qa fixture arm <fact> [--persona <p>]` and `lw qa fixture disarm` (spec 2.5.3).
import { guarded, parseArgs, withWorld, worldContext } from '../world/services/context.mts';
import { armFact, disarmFact } from '../world/services/fixture.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa fixture arm <fact> [--persona <p>]  make a fact true on the QA database; the undo record is written first',
  '       lw qa fixture disarm                       replay every undo step in reverse order',
];

async function run(args: string[], opts: QaCommandOptions): Promise<number> {
  const { words, options } = parseArgs(args, [], ['persona']);
  const [sub, fact] = words;
  if (sub === 'arm' && fact !== undefined) {
    const ctx = await worldContext(opts);
    const persona = typeof options.persona === 'string' ? options.persona : undefined;
    const armed = await withWorld(ctx, (world, registry) => armFact(world, registry, ctx.root, fact, persona === undefined ? {} : { persona }));
    opts.out(`armed ${armed.fact}${armed.persona ? ` for ${armed.persona}` : ''} on ${ctx.overlay.database}: ${armed.steps.length} undo step(s). Disarm with lw qa fixture disarm.`);
    return 0;
  }
  if (sub === 'disarm') {
    const ctx = await worldContext(opts);
    const done = await withWorld(ctx, (world, registry) => disarmFact(world, registry, ctx.root));
    opts.out(done.length > 0 ? `disarmed ${done.join(', ')}` : 'nothing armed');
    return 0;
  }
  for (const line of USAGE) opts.err(line);
  return 2;
}

const fixture: QaSubcommand = {
  name: 'fixture',
  summary: 'arm a fact on the QA database for one row, and disarm it',
  run: (args, opts) => guarded('fixture', opts, () => run(args, opts)),
};

export default fixture;
