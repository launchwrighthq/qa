// `lw qa report check|update|render|viewer <md>` (spec 2.12.3, 2.8).
import { isAbsolute, resolve } from 'node:path';
import { isCodedError } from '../kernel/index.mts';
import { qaConfigOf } from '../config.mts';
import { legDefinitions } from '../services/legs.mts';
import { checkReport, RENDERER_DIR, renderReport, scoreReport, updateReport } from '../services/report.mts';
import { buildViewer } from '../services/viewer.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const ACTIONS = ['check', 'update', 'render', 'viewer'] as const;

const USAGE = [
  'usage: lw qa report <check|update|render|viewer> <report.md>',
  '  check   exit 1 and list every problem: missing, blank, unembedded or edited evidence, a wrong Status, an issue with no statement, a CONFIRMED finding with no severity',
  '  update  write section 3, the section 5 lines and the Status, Legs and Coverage lines from the ledger, and print the score',
  '  render  write <reportDir>/dist/<slug>.html with the spec renderer',
  '  viewer  write the interactive multi-page viewer under <reportDir>/dist/<slug>-viewer/',
];

const report: QaSubcommand = {
  name: 'report',
  summary: 'Check, update or render a QA report',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    const [action, file, ...rest] = args;
    if (!action || !file || rest.length > 0 || !(ACTIONS as readonly string[]).includes(action)) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const md = isAbsolute(file) ? file : resolve(opts.cwd, file);
    const config = qaConfigOf(opts.config);
    const legs = legDefinitions(config).map((l) => l.name);
    try {
      if (action === 'check') {
        const problems = await checkReport(md, { legs, blankStdDev: config.evidence.blankStdDev, root: opts.cwd });
        if (problems.length === 0) {
          opts.out(`lw qa report check: ${file} passes`);
          return 0;
        }
        opts.err(`lw qa report check: ${file} has ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
        for (const p of problems) opts.err(`  ${p.code}: ${p.message}`);
        return 1;
      }
      const score = config.score;
      if (action === 'update') {
        const status = await updateReport(md, { legs });
        const scored = await scoreReport(md, { legs, score });
        const scoreText = scored ? `, score ${scored.result.score} of 100, confidence ${Math.round(scored.result.confidence * 100)}%` : '';
        opts.out(`lw qa report update: ${file} Status: ${status}${scoreText}`);
        return 0;
      }
      if (action === 'viewer') {
        const result = await buildViewer(md, { legs, weights: score.weights, gaugeColor: score.gaugeColor });
        opts.out(`lw qa report viewer: wrote ${result.pages.length} pages, open ${result.index}`);
        return 0;
      }
      const page = await renderReport(md, RENDERER_DIR, opts.cwd, { legs, score });
      opts.out(`lw qa report render: wrote ${page}`);
      return 0;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa report ${action}: ${cause.code}: ${cause.message}`);
      return 1;
    }
  },
};

export default report;
