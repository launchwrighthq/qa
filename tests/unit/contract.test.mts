import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import {
  computeManifest,
  type ConsentRecord,
  type ConsentStore,
  diff,
  fileConsentStore,
  grant,
  type ManifestInput,
  manifestHash,
} from '../../src/services/contract.mts';
import type { Leg } from '../../src/services/types.mts';

const androidLeg: Leg = { name: 'telegram-android', surface: 'miniapp', target: 'android-adb' };

function sampleInput(overrides: Partial<ManifestInput> = {}): ManifestInput {
  return {
    title: 'Checkout pass',
    legs: [androidLeg],
    credentials: [
      { key: 'BROWSERSTACK_ACCESS_KEY', present: true, fingerprint: '0a1b2c3d4e5f' },
      { key: 'QA_TELEGRAM_SESSION', present: false },
    ],
    outward: [
      { id: 'throwaway-bot', title: 'Create a throwaway bot through BotFather' },
      { id: 'invoice', title: 'Mint a test invoice' },
    ],
    data: [{ id: 'world-reset', title: 'Reset the QA world from seeds' }],
    ...overrides,
  };
}

/** A consent store kept in a Map, so no test touches the disk for the grant round trip. */
function memoryStore(): ConsentStore {
  const records = new Map<string, ConsentRecord>();
  return {
    async read(hash) {
      return records.get(hash) ?? null;
    },
    async write(hash, record) {
      records.set(hash, record);
    },
  };
}

describe('run contract (spec 2.6, R5, R6)', () => {
  it('lists the outward actions in the outward group', () => {
    const manifest = computeManifest(sampleInput());
    const outward = manifest.items.filter((i) => i.group === 'outward');
    expect(outward.map((i) => i.id)).toEqual(['outward:invoice', 'outward:throwaway-bot']);
    expect(outward.every((i) => i.outward === true)).toBe(true);
    expect(outward.map((i) => i.title)).toEqual(['Mint a test invoice', 'Create a throwaway bot through BotFather']);
  });

  it('shows a credential as set or empty and never as a value', () => {
    const credentials = computeManifest(sampleInput()).items.filter((i) => i.group === 'credentials');
    expect(credentials.map((i) => [i.key, i.present, i.title])).toEqual([
      ['BROWSERSTACK_ACCESS_KEY', true, 'BROWSERSTACK_ACCESS_KEY (set)'],
      ['QA_TELEGRAM_SESSION', false, 'QA_TELEGRAM_SESSION (empty)'],
    ]);
    for (const item of credentials) expect(item).not.toHaveProperty('value');
    expect(credentials[0]?.fingerprint).toBe('0a1b2c3d4e5f');
  });

  it('refuses a credential need that carries a value', () => {
    const bad = { title: 't', legs: [], credentials: [{ key: 'QA_TELEGRAM_SESSION', present: true, value: '1a2b3c' }] } as unknown as ManifestInput;
    expect(() => computeManifest(bad)).toThrow(expect.objectContaining({ code: 'qa.consent.secret' }));
  });

  it('gives the same manifest the same hash whatever the input order', () => {
    const forward = computeManifest(sampleInput());
    const reversed = computeManifest(
      sampleInput({
        outward: [
          { id: 'invoice', title: 'Mint a test invoice' },
          { id: 'throwaway-bot', title: 'Create a throwaway bot through BotFather' },
        ],
      }),
    );
    expect(manifestHash(reversed)).toBe(manifestHash(forward));
  });

  it('grants every item on allow all including outward actions', () => {
    const manifest = computeManifest(sampleInput());
    const record = grant(manifest, 'all');
    expect(record.hash).toBe(manifestHash(manifest));
    expect(record.grants.map((g) => g.id).sort()).toEqual(manifest.items.map((i) => i.id).sort());
    expect(record.grants.every((g) => g.via === 'all')).toBe(true);
    expect(record.grants.map((g) => g.id)).toContain('outward:throwaway-bot');
  });

  it('grants an outward action only on an explicit per-item yes', () => {
    const manifest = computeManifest(sampleInput());
    const record = grant(manifest, { 'data:world-reset': true, 'outward:invoice': true, 'outward:throwaway-bot': false });
    const ids = record.grants.map((g) => g.id);
    expect(ids).toContain('outward:invoice');
    expect(ids).not.toContain('outward:throwaway-bot');
    expect(ids).not.toContain('credentials:BROWSERSTACK_ACCESS_KEY');
    expect(record.grants.every((g) => g.via === 'item')).toBe(true);
  });

  it('asks nothing on a rerun with the same manifest', async () => {
    const store = memoryStore();
    const manifest = computeManifest(sampleInput());
    const record = grant(manifest, 'all');
    await store.write(record.hash, record);
    const again = computeManifest(sampleInput());
    const prior = await store.read(manifestHash(again));
    expect(prior).toEqual(record);
    expect(diff(prior, again)).toEqual([]);
  });

  it('asks only the new items when the manifest grows', () => {
    const before = computeManifest(sampleInput());
    const record = grant(before, 'all');
    const after = computeManifest(
      sampleInput({
        outward: [
          { id: 'throwaway-bot', title: 'Create a throwaway bot through BotFather' },
          { id: 'invoice', title: 'Mint a test invoice' },
          { id: 'test-account', title: 'Create a test account' },
        ],
      }),
    );
    expect(diff(record, after).map((i) => i.id)).toEqual(['outward:test-account']);
  });
});

describe('fileConsentStore (spec 2.6)', () => {
  it('writes and reads a record by its manifest hash', async () => {
    const dir = await tmpDir();
    const store = fileConsentStore(dir);
    const manifest = computeManifest(sampleInput());
    const record = grant(manifest, 'all');
    await store.write(record.hash, record);
    expect(JSON.parse(await readFile(join(dir, `${record.hash}.json`), 'utf8'))).toEqual(record);
    expect(await store.read(record.hash)).toEqual(record);
  });

  it('reads null for a manifest hash with no record', async () => {
    const store = fileConsentStore(await tmpDir());
    expect(await store.read(manifestHash(computeManifest(sampleInput())))).toBeNull();
  });

  it('refuses a hash that is not 64 hex characters', async () => {
    const store = fileConsentStore(await tmpDir());
    await expect(store.read('../escape')).rejects.toMatchObject({ code: 'qa.consent.hash' });
  });
});
