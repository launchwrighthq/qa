// `lw qa publish <slug>` (spec 2.12.3): copies a report bundle to the `qa.publish.storage` disk.
import type { App } from '../kernel/index.mts';
import { LaunchwrightError } from '../kernel/index.mts';
import { qaConfigOf } from '../config.mts';
import { loadStorage } from '../services/peers.mts';
import { legDefinitions } from '../services/legs.mts';
import { publishReport } from '../services/publish.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const publish: QaSubcommand = {
  name: 'publish',
  summary: 'Copy a report, its ledger and its evidence to the qa.publish.storage disk',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    const [slug, ...rest] = args;
    if (!slug || rest.length > 0) {
      opts.err('usage: lw qa publish <slug>   the slug is the report file name without .md');
      return 2;
    }
    const config = qaConfigOf(opts.config);
    const disk = config.publish.storage;
    if (!disk) {
      opts.err('lw qa publish: set qa.publish.storage to a storage disk name in launchwright.config.ts');
      return 1;
    }
    const app = opts.app as App | undefined;
    if (!app) {
      opts.err('lw qa publish: the command needs the booted app with the storage module');
      return 1;
    }
    try {
      // The storage module is an optional peer, so it loads only when this command runs.
      const { STORAGE } = await loadStorage();
      const driver = app.get(STORAGE).driver(disk);
      const files = await publishReport({
        root: opts.cwd,
        reportDir: config.reportDir,
        slug,
        driver,
        check: { legs: legDefinitions(config).map((l) => l.name), blankStdDev: config.evidence.blankStdDev },
      });
      for (const f of files) opts.out(`${f.key}  ${f.bytes} bytes${f.url ? `  ${f.url}` : ''}`);
      opts.out(`lw qa publish: ${files.length} files to storage disk ${disk}`);
      return 0;
    } catch (cause) {
      if (!(cause instanceof LaunchwrightError)) throw cause;
      opts.err(`lw qa publish: ${cause.code}: ${cause.message}`);
      return 1;
    }
  },
};

export default publish;
