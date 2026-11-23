import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import consent from '../../../src/commands/qa-consent.mts';
import { qaCommand } from '../../../src/commands/qa.command.mts';
import { consentGate } from '../../../src/services/consent-gate.mts';
import { CONSENT_DIR, computeManifest, type ConsentManifest, fileConsentStore, manifestHash } from '../../../src/services/contract.mts';

const manifest: ConsentManifest = computeManifest({
  title: 'Bot pass',
  legs: [{ name: 'telegram-android', surface: 'miniapp', target: 'android-adb' }],
  outward: [{ id: 'throwaway-bot-create', title: 'Create a throwaway bot through BotFather' }],
  data: [{ id: 'qa-world-arm', title: 'Arm 1 state(s) on the QA world database, then disarm them' }],
});

function cli(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: { cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l) } };
}

/** Runs the gate once with no grant, so the record holds the manifest the reviewer saw. */
async function refusedPass(cwd: string): Promise<void> {
  const c = cli(cwd);
  expect(await consentGate(manifest, { ...c.opts, allowAll: false, allow: [] })).toBe(false);
}

describe('lw qa consent (spec 2.6, M1)', () => {
  it('is a registered subcommand with a summary', async () => {
    const c = cli(await tmpDir());
    await qaCommand.run([], c.opts);
    expect(c.err.some((l) => /^ {2}consent +Show, reset or grant the run contract consent records/.test(l))).toBe(true);
  });

  it('show prints each item and whether it holds a grant', async () => {
    const root = await tmpDir();
    const empty = cli(root);
    expect(await consent.run(['show'], empty.opts)).toBe(0);
    expect(empty.out).toEqual([`no consent record under ${CONSENT_DIR}`]);
    await refusedPass(root);
    const c = cli(root);
    expect(await consent.run(['show'], c.opts)).toBe(0);
    expect(c.out[0]).toBe(`${manifestHash(manifest).slice(0, 12)}  "Bot pass": 3 item(s), 0 grant(s)`);
    expect(c.out.filter((l) => l.startsWith('not granted'))).toHaveLength(3);
    expect(c.out.some((l) => l.includes('outward:throwaway-bot-create') && l.includes('[outward]'))).toBe(true);
  });

  it('grant adds one listed item, and the next gate asks only the rest', async () => {
    const root = await tmpDir();
    await refusedPass(root);
    const c = cli(root);
    expect(await consent.run(['grant', 'outward:throwaway-bot-create'], c.opts)).toBe(0);
    expect(c.out).toEqual([`granted outward:throwaway-bot-create in 1 consent record(s) under ${CONSENT_DIR}`]);
    const shown = cli(root);
    await consent.run(['show'], shown.opts);
    expect(shown.out.some((l) => l.startsWith('granted (item)') && l.includes('outward:throwaway-bot-create'))).toBe(true);
    const gate = cli(root);
    expect(await consentGate(manifest, { ...gate.opts, allowAll: false, allow: [] })).toBe(false);
    const asked = gate.err.filter((l) => l.startsWith('  '));
    expect(asked.map((l) => l.trim().split(/\s+/).at(0))).toEqual(['devices:android-adb', 'data:qa-world-arm']);
  });

  it('grant refuses an item no recorded manifest lists, with exit 2', async () => {
    const root = await tmpDir();
    await refusedPass(root);
    const c = cli(root);
    expect(await consent.run(['grant', 'outward:invoice'], c.opts)).toBe(2);
    expect(c.err[0]).toContain('qa.consent.unlisted');
    const record = await fileConsentStore(join(root, CONSENT_DIR)).read(manifestHash(manifest));
    expect(record?.grants).toEqual([]);
  });

  it('reset removes one record by a hash prefix, or every record', async () => {
    const root = await tmpDir();
    await refusedPass(root);
    const other = computeManifest({ title: 'Other', legs: [], data: [{ id: 'qa-database-fork', title: 'Fork the QA database' }] });
    expect(await consentGate(other, { ...cli(root).opts, allowAll: true, allow: [] })).toBe(true);
    const store = fileConsentStore(join(root, CONSENT_DIR));
    expect(await store.list()).toHaveLength(2);
    const one = cli(root);
    expect(await consent.run(['reset', manifestHash(other).slice(0, 12)], one.opts)).toBe(0);
    expect(one.out).toEqual([`removed 1 consent record(s) from ${CONSENT_DIR}`]);
    expect((await store.list()).map((r) => r.hash)).toEqual([manifestHash(manifest)]);
    const all = cli(root);
    expect(await consent.run(['reset'], all.opts)).toBe(0);
    expect(all.out).toEqual([`removed 1 consent record(s) from ${CONSENT_DIR}`]);
    expect(await store.list()).toEqual([]);
  });

  it('reset names a hash with no record and exits 1', async () => {
    const c = cli(await tmpDir());
    expect(await consent.run(['reset', 'abc123'], c.opts)).toBe(1);
    expect(c.err[0]).toContain('qa.consent.missing');
  });

  it('prints the usage and exits 2 for an unknown action', async () => {
    const c = cli(await tmpDir());
    expect(await consent.run(['revoke'], c.opts)).toBe(2);
    expect(c.err[0]).toBe('usage: lw qa consent show [<hash>]');
  });
});
