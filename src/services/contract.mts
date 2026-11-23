// The run contract (spec 2.6): the requirements manifest, the consent grant and its record.
//
// Before a pass opens a browser or touches a device, it computes a manifest of every need in four
// groups: credentials, devices and rigs, outward actions, and data and isolation. The pass asks
// once per item or takes a single "allow all", and persists the grant keyed by the manifest hash.
// A rerun with the same manifest asks nothing; a grown manifest asks only the new items.
//
// The manifest never stores or prints a secret value. A credential carries set/empty and a short
// sha256 only. `credentialNeed` turns a value into that pair at once and keeps no reference to it.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchwrightError } from '../kernel/index.mts';
import { readTextOrNull, sha256 } from '../kernel/services/fs.mts';
import type { Leg } from './types.mts';

/** The four groups of a run contract manifest (spec 2.6). */
export type ConsentGroup = 'credentials' | 'devices' | 'outward' | 'data';

/** The report order of the groups. */
const GROUP_ORDER: Record<ConsentGroup, number> = { credentials: 0, devices: 1, outward: 2, data: 3 };

/** One need the pass asks consent for. The printed manifest shows the title, never a value. */
export interface ManifestItem {
  /** Stable unique id within the manifest, `<group>:<name>`. */
  id: string;
  group: ConsentGroup;
  /** One short line the reviewer reads. */
  title: string;
  /** True when the item reaches outside and always needs an explicit grant (spec 2.6). */
  outward: boolean;
  /** A credentials item only: the environment key. Never the value. */
  key?: string;
  /** A credentials item only: whether the secret store holds a value. */
  present?: boolean;
  /** A credentials item that is set: a short sha256 of the value, 16 hex characters at most. */
  fingerprint?: string;
  /** The legs that need the item, sorted. A pass that drops them drops the need. */
  legs?: string[];
}

/** The requirements manifest a pass computes before any outward action (spec 2.6). */
export interface ConsentManifest {
  title: string;
  /** The items, sorted by group then id, so the same needs give the same manifest. */
  items: ManifestItem[];
}

/** A credential the pass needs. The caller gives set/empty and a short hash, never the value. */
export interface CredentialNeed {
  key: string;
  present: boolean;
  /** A short sha256 of the value, 1 to 16 hex characters. Absent when empty. */
  fingerprint?: string;
  /** The legs that need the credential. */
  legs?: string[];
}

/** The length of a credential fingerprint: enough to see a change, too short to guess the value. */
const FINGERPRINT_LENGTH = 12;

/** The need of one credential: set or empty, and a short sha256 when set. The value stays here. */
export function credentialNeed(envKey: string, value: string | undefined, legs?: readonly string[]): CredentialNeed {
  const present = value !== undefined && value !== '';
  return {
    key: envKey,
    present,
    ...(present ? { fingerprint: sha256(value).slice(0, FINGERPRINT_LENGTH) } : {}),
    ...(legs && legs.length > 0 ? { legs: [...legs] } : {}),
  };
}

/** An outward action the pass will take (spec 2.6). Each always needs an explicit grant. */
export interface OutwardNeed {
  /** `throwaway-bot`, `test-account`, `third-party-request`, `invoice`. */
  id: string;
  title: string;
}

/** A data or isolation step the pass will run (spec 2.6). */
export interface DataNeed {
  /** `world-reset`, `per-pass-fork`, `dev-db-copy`. */
  id: string;
  title: string;
}

/** The input of a manifest: the title, the legs and the needs the caller read from the rows and config. */
export interface ManifestInput {
  /** The pass or report title, for the printed manifest. */
  title: string;
  /** The legs the pass runs. A device leg adds one device item. */
  legs: Leg[];
  credentials?: CredentialNeed[];
  outward?: OutwardNeed[];
  data?: DataNeed[];
}

/** One recorded grant: the item id and how the reviewer gave it. */
export interface ConsentGrant {
  id: string;
  /** `item` for a per-item yes, `all` for an "allow all". */
  via: 'item' | 'all';
}

/** The persisted consent for one manifest, keyed by its hash. Holds no secret value. */
export interface ConsentRecord {
  hash: string;
  grants: ConsentGrant[];
  /** The manifest title the reviewer saw. */
  title?: string;
  /** The items the reviewer saw. A grant covers only an item that a recorded manifest lists. */
  items?: ManifestItem[];
}

/** A per-item grant map, or the string `all`. */
export type GrantChoices = 'all' | Record<string, boolean>;

/** The persistence of consent records, injected so a test uses an in-memory store (spec 2.6). */
export interface ConsentStore {
  read(hash: string): Promise<ConsentRecord | null>;
  write(hash: string, record: ConsentRecord): Promise<void>;
  /** Every record, sorted by hash. */
  list(): Promise<ConsentRecord[]>;
  /** Removes the record of `hash`, or every record when `hash` is absent. Returns the count. */
  remove(hash?: string): Promise<number>;
}

/** The consent store folder, relative to the project root (spec 2.6). */
export const CONSENT_DIR = '.lw/qa/consent';

/** A device target that needs a device or rig grant, and the line the reviewer reads. */
const DEVICE_RIGS: Record<string, string> = {
  'android-adb': 'An Android device over adb',
  'android-emulator': 'The Android emulator',
  'ios-webkit': 'An iOS device over WebKit',
  'ios-simulator': 'The iOS simulator',
  browserstack: 'A BrowserStack slot',
};

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FINGERPRINT = /^[0-9a-f]{1,16}$/;
const HEX64 = /^[0-9a-f]{64}$/;

function credentialItem(need: CredentialNeed): ManifestItem {
  if (Object.hasOwn(need, 'value')) {
    throw new LaunchwrightError('qa.consent.secret', `The credential ${need.key} carries a value. Pass set/empty and a short hash only, never the secret.`, { context: { key: need.key } });
  }
  if (need.fingerprint !== undefined && !FINGERPRINT.test(need.fingerprint)) {
    throw new LaunchwrightError('qa.consent.fingerprint', `The fingerprint of ${need.key} is not a short sha256 of 1 to 16 hex characters. It must never be the value.`, { context: { key: need.key } });
  }
  const item: ManifestItem = { id: `credentials:${need.key}`, group: 'credentials', title: `${need.key} (${need.present ? 'set' : 'empty'})`, outward: false, key: need.key, present: need.present };
  if (need.present && need.fingerprint !== undefined) item.fingerprint = need.fingerprint;
  if (need.legs !== undefined && need.legs.length > 0) item.legs = [...new Set(need.legs)].sort();
  return item;
}

/** The device and rig items a set of legs needs. A browser leg needs no device grant. */
function deviceItems(legs: Leg[]): ManifestItem[] {
  const items = new Map<string, ManifestItem>();
  for (const leg of legs) {
    const rig = DEVICE_RIGS[leg.target];
    if (rig === undefined) continue;
    const id = leg.device ? `devices:${leg.target}:${leg.device}` : `devices:${leg.target}`;
    items.set(id, { id, group: 'devices', title: leg.device ? `${rig} (${leg.device})` : rig, outward: false });
  }
  return [...items.values()];
}

function namedItem(group: 'outward' | 'data', need: OutwardNeed | DataNeed): ManifestItem {
  if (!NAME.test(need.id)) {
    throw new LaunchwrightError('qa.consent.id', `The ${group} id "${need.id}" is not kebab case, for example "throwaway-bot".`, { context: { id: need.id } });
  }
  return { id: `${group}:${need.id}`, group, title: need.title, outward: group === 'outward' };
}

/**
 * The requirements manifest of a pass (spec 2.6). The caller reads the needs from the resolved
 * rows, the legs and the config. The items are sorted by group then id, so the same needs give the
 * same manifest and the same hash.
 */
export function computeManifest(input: ManifestInput): ConsentManifest {
  const items = new Map<string, ManifestItem>();
  const add = (item: ManifestItem): void => {
    const legs = [...new Set([...(items.get(item.id)?.legs ?? []), ...(item.legs ?? [])])].sort();
    items.set(item.id, legs.length > 0 ? { ...item, legs } : item);
  };
  for (const need of input.credentials ?? []) add(credentialItem(need));
  for (const item of deviceItems(input.legs ?? [])) add(item);
  for (const need of input.outward ?? []) add(namedItem('outward', need));
  for (const need of input.data ?? []) add(namedItem('data', need));
  const sorted = [...items.values()].sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { title: input.title, items: sorted };
}

/** A value with every object key sorted, so the serialized form does not depend on key order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}

/** The stable sha256 of a manifest. The same needs give the same hash across runs (spec 2.6). */
export function manifestHash(manifest: ConsentManifest): string {
  return sha256(JSON.stringify(canonical(manifest)));
}

/**
 * The consent record for a manifest and the reviewer's choices. `all` grants every listed item,
 * outward actions included, because the reviewer chose it with those actions in front of them. A
 * per-item map grants an item only when its choice is `true`, so an outward action always needs an
 * explicit grant (spec 2.6).
 */
export function grant(manifest: ConsentManifest, choices: GrantChoices): ConsentRecord {
  const grants: ConsentGrant[] = [];
  for (const item of manifest.items) {
    if (choices === 'all') grants.push({ id: item.id, via: 'all' });
    else if (choices[item.id] === true) grants.push({ id: item.id, via: 'item' });
  }
  return { hash: manifestHash(manifest), grants };
}

/** The ids that a set of records grants. */
function grantedIds(prior: ConsentRecord | readonly ConsentRecord[] | null): Set<string> {
  const records: readonly ConsentRecord[] = prior === null ? [] : Array.isArray(prior) ? prior : [prior as ConsentRecord];
  return new Set(records.flatMap((record) => record.grants.map((g) => g.id)));
}

/**
 * The items still to ask, given the prior records (spec 2.6). A grant is per item, so it covers the
 * item in any manifest: an unchanged manifest returns nothing and a grown manifest returns only its
 * new items. A null record, or none, asks every item.
 */
export function diff(prior: ConsentRecord | readonly ConsentRecord[] | null, manifest: ConsentManifest): ManifestItem[] {
  const granted = grantedIds(prior);
  return manifest.items.filter((item) => !granted.has(item.id));
}

/**
 * The record of a manifest after a decision (spec 2.6). It keeps the prior grants of the listed
 * items and adds `all` (every item) or the named ids. An id that the manifest does not list fails
 * with `qa.consent.unlisted`, so an outward action is granted only when the reviewer saw it.
 */
export function recordGrants(manifest: ConsentManifest, prior: readonly ConsentRecord[], choice: 'all' | readonly string[]): ConsentRecord {
  const listed = new Set(manifest.items.map((item) => item.id));
  const unlisted = choice === 'all' ? [] : choice.filter((id) => !listed.has(id));
  if (unlisted.length > 0) {
    throw new LaunchwrightError('qa.consent.unlisted', `The manifest "${manifest.title}" does not list ${unlisted.join(', ')}. Grant only an item it lists: ${[...listed].join(', ') || 'none'}.`, {
      context: { unlisted },
    });
  }
  const before = new Map(prior.flatMap((record) => record.grants.map((g) => [g.id, g.via] as const)));
  const grants: ConsentGrant[] = [];
  for (const item of manifest.items) {
    const via = before.get(item.id) ?? (choice === 'all' ? 'all' : choice.includes(item.id) ? 'item' : undefined);
    if (via !== undefined) grants.push({ id: item.id, via });
  }
  return { hash: manifestHash(manifest), title: manifest.title, items: manifest.items, grants };
}

/** The credentials items with no value. A pass refuses to start while one stays in its manifest. */
export function missingCredentials(manifest: ConsentManifest): ManifestItem[] {
  return manifest.items.filter((item) => item.group === 'credentials' && item.present === false);
}

/**
 * A consent store that writes one JSON record per hash under `dir`, the project's `.lw/qa/consent`
 * folder. The record holds the grant and no secret value.
 */
export function fileConsentStore(dir: string): ConsentStore {
  const fileFor = (hash: string): string => {
    if (!HEX64.test(hash)) throw new LaunchwrightError('qa.consent.hash', `A consent hash is 64 hex characters, not "${hash}".`, { context: { hash } });
    return join(dir, `${hash}.json`);
  };
  return {
    async read(hash) {
      const file = fileFor(hash);
      const text = await readTextOrNull(file);
      if (text === null) return null;
      try {
        return JSON.parse(text) as ConsentRecord;
      } catch (cause) {
        throw new LaunchwrightError('qa.consent.read', `The consent record ${file} is not JSON.`, { cause, context: { hash } });
      }
    },
    async write(hash, record) {
      const file = fileFor(hash);
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
    },
    async list() {
      const records: ConsentRecord[] = [];
      for (const hash of await recordHashes(dir)) {
        const record = await this.read(hash);
        if (record !== null) records.push(record);
      }
      return records;
    },
    async remove(hash) {
      const hashes = hash === undefined ? await recordHashes(dir) : [hash];
      let removed = 0;
      for (const h of hashes) {
        const file = fileFor(h);
        if ((await readTextOrNull(file)) === null) continue;
        await rm(file);
        removed += 1;
      }
      return removed;
    },
  };
}

/** The hashes of the records under `dir`, sorted. A missing folder holds none. */
async function recordHashes(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new LaunchwrightError('qa.consent.list', `Cannot list the consent records in ${dir}.`, { cause });
  }
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter((hash) => HEX64.test(hash))
    .sort();
}
