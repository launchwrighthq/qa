// `lw qa sink [--tunnel <driver>] [--fault <rule>...]` (spec 2.17): a recording HTTP sink behind a
// tunnel. A QA row or a webhook test points an outbound sender at the printed URL.
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { createContainer, LaunchwrightError, systemClock } from '@launchwrighthq/kernel';
import { parseCommandArgs, UsageError } from '@launchwrighthq/kernel/args';
import { type Tunnel, loadTunnel, type TunnelManagerInstance } from '../services/peers.mts';
import { parseFaults } from '../sink/services/faults.mts';
import { startSink } from '../sink/services/server.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

/** The folder of the record files, relative to the project root. */
export const SINK_DIR = '.lw/qa/sink';

const USAGE = [
  'usage: lw qa sink [--tunnel <driver|none>] [--fault <rule>]... [--port <n>] [--seed <n>]',
  '  rules: 503, 429, 410, 302:<url>, slow:<ms>; add x<count> (503x2) or @<ratio> (503@0.5)',
];

/** The tunnel manager of config section `tunnel`; `driver` replaces its default. Throws `qa.sink.tunnel`. */
async function tunnels(config: Record<string, unknown> | undefined, driver: string | undefined): Promise<TunnelManagerInstance> {
  const raw = (config?.tunnel ?? (driver ? { default: driver } : undefined)) as Record<string, unknown> | undefined;
  if (raw === undefined) {
    throw new LaunchwrightError('qa.sink.tunnel', 'The project config has no tunnel section. Add tunnel.default, or pass --tunnel <driver> or --tunnel none.');
  }
  const { tunnelConfig, TunnelManager } = await loadTunnel();
  const parsed = tunnelConfig.safeParse(driver ? { ...raw, default: driver } : raw);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `tunnel.${i.path.map(String).join('.')} ${i.message}`);
    throw new LaunchwrightError('qa.sink.tunnel', `Config section tunnel is invalid: ${keys.join('; ')}`, { context: { keys } });
  }
  return new TunnelManager(parsed.data, createContainer());
}

/** Resolves when `signal` aborts. Without a signal, on SIGINT or SIGTERM. */
function stopped(signal: AbortSignal | undefined): Promise<void> {
  if (signal) return signal.aborted ? Promise.resolve() : new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
  return new Promise((resolve) => {
    const done = (): void => {
      process.off('SIGINT', done);
      process.off('SIGTERM', done);
      resolve();
    };
    process.once('SIGINT', done);
    process.once('SIGTERM', done);
  });
}

function integer(text: string | undefined, name: string, min: number, max: number): number | undefined {
  if (text === undefined) return undefined;
  const n = Number(text);
  if (!/^\d+$/.test(text) || n < min || n > max) throw new LaunchwrightError('qa.sink.usage', `--${name} must be an integer from ${min} to ${max}, not ${text}.`);
  return n;
}

async function serve(values: { tunnel?: string; fault?: string[]; port?: string; seed?: string }, opts: QaCommandOptions): Promise<number> {
  const faults = parseFaults(values.fault ?? []);
  const port = integer(values.port, 'port', 0, 65535);
  const seed = integer(values.seed, 'seed', 0, 2 ** 32 - 1) ?? randomInt(1, 2 ** 31);
  const manager = values.tunnel === 'none' ? undefined : await tunnels(opts.config, values.tunnel);
  const run = systemClock.date().toISOString().replace(/[:.]/g, '-');
  const file = join(opts.cwd, SINK_DIR, `${run}.jsonl`);
  const sink = await startSink({
    faults,
    file,
    seed,
    ...(port === undefined ? {} : { port }),
    onRecord: (r, phase) => {
      if (phase !== 'done') return;
      opts.err(`lw qa sink: ${r.n} ${r.method} ${r.path} -> ${r.answered.status}${r.fault ? ` (${r.fault})` : ''}${r.closedEarly ? ', the sender closed first' : ''}`);
    },
  });
  let tunnel: Tunnel | undefined;
  try {
    if (manager) tunnel = await manager.driver().open(sink.port, { name: 'lw-sink' });
    opts.out(tunnel?.url ?? sink.url);
    opts.err(`lw qa sink: listening on ${sink.url}, records to ${file}`);
    opts.err(`lw qa sink: faults ${faults.map((f) => f.text).join(' ') || 'none'}, seed ${seed}; Ctrl-C stops it`);
    await stopped(opts.signal);
  } finally {
    try {
      await tunnel?.close();
    } finally {
      await sink.close();
    }
  }
  opts.err(`lw qa sink: ${sink.records.length} requests recorded in ${file}`);
  return 0;
}

const sink: QaSubcommand = {
  name: 'sink',
  summary: 'Serve a recording HTTP sink with fault rules behind a tunnel',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    let parsed;
    try {
      parsed = parseCommandArgs({ values: ['tunnel', 'port', 'seed'], repeated: ['fault'], switches: ['help'] }, args.map((a) => (a === '-h' ? '--help' : a)));
      const [extra] = parsed.positionals;
      if (extra !== undefined) throw new UsageError(`Unexpected argument '${extra}'.`);
    } catch (cause) {
      if (!(cause instanceof UsageError)) throw cause;
      opts.err(`lw qa sink: ${cause.message}`);
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const values = { ...parsed.values, fault: parsed.lists.fault };
    if (parsed.switches.has('help')) {
      for (const line of USAGE) opts.err(line);
      return 0;
    }
    try {
      return await serve(values, opts);
    } catch (cause) {
      if (!(cause instanceof LaunchwrightError)) throw cause;
      opts.err(`lw qa sink: ${cause.code}: ${cause.message}`);
      return 1;
    }
  },
};

export default sink;
