// The run contract (spec 2.6): the requirements manifest, the consent grant and its record.
//
// Before a pass opens a browser or touches a device, it computes a manifest of every need in four
// groups: credentials, devices and rigs, outward actions, and data and isolation. The pass asks
// once per item or takes a single "allow all", and persists the grant keyed by the manifest hash.
// A rerun with the same manifest asks nothing; a grown manifest asks only the new items.
//
// This file never receives, stores or prints a secret value. A credential carries set/empty and a
// short sha256 only. The caller computes that short hash and passes the key, never the value.
import { mkdir, writeFile } from 'node:fs/promises';
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
}

/** A per-item grant map, or the string `all`. */
export type GrantChoices = 'all' | Record<string, boolean>;

/** The persistence of consent records, injected so a test uses an in-memory store (spec 2.6). */
export interface ConsentStore {
  read(hash: string): Promise<ConsentRecord | null>;
  write(hash: string, record: ConsentRecord): Promise<void>;
}

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
    items.set(item.id, item);
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

/**
 * The items still to ask, given a prior record (spec 2.6). An item a prior grant covers drops out,
 * so an unchanged manifest returns nothing and a grown manifest returns only its new items. A null
 * record, or none, asks every item.
 */
export function diff(prior: ConsentRecord | null, manifest: ConsentManifest): ManifestItem[] {
  const granted = new Set((prior?.grants ?? []).map((g) => g.id));
  return manifest.items.filter((item) => !granted.has(item.id));
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
  };
}
