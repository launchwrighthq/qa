import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { extensionNames, extensionTargets, loadExtensions } from '../../../src/commands/extensions.mts';
import { qaConfig } from '../../../src/config.mts';
import { extensionProject } from '../../support/extension-package.mts';

describe('extensionNames', () => {
  it('names each config section that starts with qa- in sorted order', () => {
    expect(extensionNames({ qa: {}, 'qa-intake': {}, db: {}, 'qa-device': {} })).toEqual(['qa-device', 'qa-intake']);
  });
});

describe('loadExtensions', () => {
  it('loads qaExtension of each enabled module from the project folder', async () => {
    const root = await extensionProject();
    const [ext] = await loadExtensions(root, { 'qa-probe': {} });
    expect(ext?.name).toBe('qa-probe');
    expect(Object.keys(ext?.subcommands ?? {})).toEqual(['probe']);
  });

  it('loads nothing when no config section names an extension', async () => {
    expect(await loadExtensions(await tmpDir(), { qa: {} })).toEqual([]);
  });

  it('fails with qa.extension and the module name when the package is not installed', async () => {
    await expect(loadExtensions(await tmpDir(), { 'qa-probe': {} })).rejects.toMatchObject({ code: 'qa.extension', message: expect.stringContaining('@launchwrighthq/qa-probe') });
  });

  it('fails with qa.extension when the package exports no qaExtension', async () => {
    const root = await extensionProject({ bare: true });
    await expect(loadExtensions(root, { 'qa-probe': {} })).rejects.toMatchObject({ code: 'qa.extension', message: expect.stringContaining('exports no qaExtension') });
  });
});

describe('extensionTargets', () => {
  it('builds the targets of each extension from the qa config and the project root', async () => {
    const root = await extensionProject();
    const targets = extensionTargets(await loadExtensions(root, { 'qa-probe': {} }), qaConfig.parse({ reportDir: 'r' }), root);
    expect(targets).toEqual({ 'probe-phone': { name: 'probe-phone', reportDir: 'r', root } });
  });
});
