// `lw qa publish <slug>` (spec 2.12.3): copies a report bundle to the `qa.publish.storage` disk.
// The copy leaves the machine, so it is an outward action with a run contract grant (spec 2.6).
import type { App } from '../kernel/index.mts';
import { isCodedError } from '../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { qaConfigOf } from '../config.mts';
import { consentGate } from '../services/consent-gate.mts';
import { computeManifest, type ConsentManifest } from '../services/contract.mts';
import { loadStorage } from '../services/peers.mts';
import { legDefinitions } from '../services/legs.mts';
import { publishReport } from '../services/publish.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = 'usage: lw qa publish <slug> [--allow-all | --allow <item-id>]   the slug is the report file name without .md';

/** The run contract of a publish: one outward item per storage disk, so a grant names its disk. */
export function publishManifest(disk: string): ConsentManifest {
  const id = `storage-publish-${disk.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'disk'}`;
  return computeManifest({ title: 'lw qa publish', legs: [], outward: [{ id, title: `Copy QA reports and their evidence to the storage disk ${disk}` }] });
}

const publish: QaSubcommand = {
  name: 'publish',
  summary: 'Copy a report, its ledger and its evidence to the qa.publish.storage disk',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    let parsed;
    try {
      parsed = parseCommandArgs({ switches: ['allow-all'], repeated: ['allow'] }, args);
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
      opts.err(`lw qa publish: ${cause.message}`);
      opts.err(USAGE);
      return 2;
    }
    const [slug, ...rest] = parsed.positionals;
    if (!slug || rest.length > 0) {
      opts.err(USAGE);
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
    const choice = { allowAll: parsed.switches.has('allow-all'), allow: parsed.lists.allow };
    if (!(await consentGate(publishManifest(disk), { cwd: opts.cwd, out: opts.out, err: opts.err, ...choice }))) return 2;
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
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa publish: ${cause.code}: ${cause.message}`);
      return 1;
    }
  },
};

export default publish;
