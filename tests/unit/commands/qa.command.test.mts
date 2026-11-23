import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaCommand, SUBCOMMANDS } from '../../../src/commands/qa.command.mts';
import { extensionProject } from '../../support/extension-package.mts';

function io(cwd: string, config: Record<string, unknown>) {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: { cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config } };
}

describe('lw qa', () => {
  it('runs the subcommand of an extension module with the targets of the extension', async () => {
    const root = await extensionProject();
    const c = io(root, { 'qa-probe': {} });
    expect(await qaCommand.run(['probe', 'one'], c.opts)).toBe(0);
    expect(c.out).toEqual(['probe one probe-phone']);
  });

  it('lists the subcommands of an extension module in the usage', async () => {
    const root = await extensionProject();
    const c = io(root, { 'qa-probe': {} });
    expect(await qaCommand.run(['--help'], c.opts)).toBe(2);
    expect(c.err).toContain(`  ${'probe'.padEnd(10)} prints the targets it receives (module qa-probe)`);
  });

  it('names the extension module of an unknown subcommand and exits 2', async () => {
    const c = io(await tmpDir(), {});
    expect(await qaCommand.run(['device', 'list'], c.opts)).toBe(2);
    expect(c.err[0]).toBe('lw qa: unknown subcommand device. A subcommand of an extension module needs that module in the project config, for example qa-device.');
  });

  it('lists every core subcommand with its summary from the static registry', async () => {
    const c = io(await tmpDir(), {});
    expect(await qaCommand.run(['--help'], c.opts)).toBe(2);
    expect(c.err[0]).toBe('usage: lw qa <subcommand> [args]');
    const listed = c.err.slice(1).map((l) => l.trim().split(/\s+/)[0]);
    expect(listed).toEqual([...SUBCOMMANDS]);
    expect(c.err.slice(1).every((l) => l.trim().split(/\s+/).length > 1)).toBe(true);
  });
});
