// `lw qa consent show|reset|grant` (spec 2.6): reads and changes the local consent records of the
// run contract under `.lw/qa/consent`. A record holds item ids, titles and grants, never a value.
import { isCodedError, LaunchwrightError } from '../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../kernel/services/args.mts';
import { consentStoreOf, itemLine } from '../services/consent-gate.mts';
import { CONSENT_DIR, type ConsentRecord, type ConsentStore } from '../services/contract.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa consent show [<hash>]',
  '       lw qa consent reset [<hash>]',
  '       lw qa consent grant <item-id> [<hash>]',
  '  show    print each consent record: its manifest items and which ones hold a grant',
  '  reset   remove every record, or the record of one manifest hash (a unique prefix is enough)',
  '  grant   grant one item that a recorded manifest lists, for example outward:throwaway-bot-create',
];

/** The length of a hash in printed lines. */
const SHORT_HASH = 12;

/** Exit 2 for a usage error or a refused grant, else 1. */
const REFUSALS = new Set(['kernel.usage', 'qa.consent.usage', 'qa.consent.unlisted']);

/** The records of `prefix`, or every record. A prefix that matches no record fails. */
async function recordsOf(store: ConsentStore, prefix: string | undefined): Promise<ConsentRecord[]> {
  const records = await store.list();
  if (prefix === undefined) return records;
  if (!/^[0-9a-f]{1,64}$/.test(prefix)) throw new LaunchwrightError('qa.consent.usage', `"${prefix}" is not a manifest hash or a prefix of one.`);
  const found = records.filter((record) => record.hash.startsWith(prefix));
  if (found.length === 0) throw new LaunchwrightError('qa.consent.missing', `No consent record has the hash ${prefix}. lw qa consent show lists them.`);
  return found;
}

function oneHash(found: ConsentRecord[], prefix: string): ConsentRecord {
  if (found.length > 1) throw new LaunchwrightError('qa.consent.usage', `The prefix ${prefix} matches ${found.length} records. Give more characters of the hash.`);
  return found[0] as ConsentRecord;
}

function show(records: ConsentRecord[], opts: QaCommandOptions): number {
  if (records.length === 0) {
    opts.out(`no consent record under ${CONSENT_DIR}`);
    return 0;
  }
  for (const record of records) {
    const via = new Map(record.grants.map((g) => [g.id, g.via]));
    const items = record.items ?? [];
    opts.out(`${record.hash.slice(0, SHORT_HASH)}  "${record.title ?? 'untitled'}": ${items.length} item(s), ${record.grants.length} grant(s)`);
    for (const item of items) {
      const given = via.get(item.id);
      opts.out(`${given ? `granted (${given})` : 'not granted'.padEnd(13)}${itemLine(item)}`);
    }
    for (const g of record.grants) if (!items.some((item) => item.id === g.id)) opts.out(`granted (${g.via})  ${g.id}`);
  }
  return 0;
}

/** Adds a per-item grant of `id` to each record that lists the item, so only a listed item is granted. */
async function grantItem(store: ConsentStore, records: ConsentRecord[], id: string, opts: QaCommandOptions): Promise<number> {
  const listing = records.filter((record) => (record.items ?? []).some((item) => item.id === id));
  if (listing.length === 0) {
    throw new LaunchwrightError(
      'qa.consent.unlisted',
      `No recorded manifest lists ${id}. Run the pass or the command first, so it prints its manifest, then grant an item that manifest lists.`,
      { context: { id } },
    );
  }
  for (const record of listing) {
    if (record.grants.some((g) => g.id === id)) continue;
    await store.write(record.hash, { ...record, grants: [...record.grants, { id, via: 'item' }] });
  }
  opts.out(`granted ${id} in ${listing.length} consent record(s) under ${CONSENT_DIR}`);
  return 0;
}

async function run(action: string | undefined, rest: string[], opts: QaCommandOptions): Promise<number | null> {
  const words = parseCommandArgs({}, rest).positionals;
  const store = consentStoreOf({ cwd: opts.cwd });
  if (action === 'show' && words.length <= 1) return show(await recordsOf(store, words[0]), opts);
  if (action === 'reset' && words.length <= 1) {
    const prefix = words[0];
    const hash = prefix === undefined ? undefined : oneHash(await recordsOf(store, prefix), prefix).hash;
    const removed = await store.remove(hash);
    opts.out(`removed ${removed} consent record(s) from ${CONSENT_DIR}`);
    return 0;
  }
  if (action === 'grant' && (words.length === 1 || words.length === 2)) {
    const [id, prefix] = words as [string, string | undefined];
    return grantItem(store, await recordsOf(store, prefix), id, opts);
  }
  return null;
}

const consent: QaSubcommand = {
  name: 'consent',
  summary: 'Show, reset or grant the run contract consent records of .lw/qa/consent',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    const [action, ...rest] = args;
    try {
      const code = await run(action, rest, opts);
      if (code !== null) return code;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa consent ${action ?? ''}: ${cause.code}: ${cause.message}`);
      return cause instanceof UsageError || REFUSALS.has(cause.code) ? 2 : 1;
    }
    for (const line of USAGE) opts.err(line);
    return 2;
  },
};

export default consent;
