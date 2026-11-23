import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fakeClock, tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import type { Inventory, UnionEntry } from '../../../../src/states/services/inventory.mts';
import { plannedCaptures } from '../../../../src/states/services/inventory.mts';
import { captureMounted, mountUrl, resolveMount } from '../../../../src/states/services/mount.mts';
import { ScriptedSession } from '../../../support/states-fakes.mts';

const site = { interface: 'TileProps', field: 'state', optional: false, file: 'apps/client/src/tile.tsx', component: 'Tile', componentFile: 'apps/client/src/tile.tsx' };
const tile: UnionEntry = { name: 'TileState', file: 'apps/client/src/tile.tsx', line: 1, members: ['open', 'closed'], kind: 'input', flattens: [], inputs: [site], outputs: [] };
const inventory: Pick<Inventory, 'unions'> = { unions: [tile] };

const HARNESS = { harness: true, error: null, roots: 1 };

describe('mounted capture', () => {
  it('builds the /__states address with the component, the props as JSON and the width', () => {
    expect(mountUrl({ component: 'Tile', props: { state: 'open' } })).toBe('/__states?c=Tile&props=%7B%22state%22%3A%22open%22%7D');
    expect(mountUrl({ component: 'Tile', width: 320 })).toBe('/__states?c=Tile&props=%7B%7D&w=320');
  });

  it('writes the field under test last, over every hint', () => {
    const capture = plannedCaptures(inventory)[0];
    if (!capture) throw new Error('no capture');
    const resolved = resolveMount({ unions: [{ ...tile, mount: { props: { state: 'closed', title: 'T' }, members: { open: { busy: true } } } }] }, capture, 'desktop');
    expect(resolved).toMatchObject({ component: 'Tile', field: 'state', props: { state: 'open', title: 'T', busy: true }, refusal: null });
  });

  it('refuses a union that no component takes, and the null rendering', () => {
    const orphan = { ...tile, inputs: [{ ...site, component: null, componentFile: null }] };
    const [capture] = plannedCaptures({ unions: [orphan] });
    if (!capture) throw new Error('no capture');
    expect(resolveMount({ unions: [orphan] }, capture, 'desktop').refusal).toMatchObject({ reason: 'unmountable', detail: { missingProp: 'TileProps.state (no component takes this union)' } });
    expect(resolveMount(inventory, { ...capture, union: 'TileState', member: null }, 'desktop').refusal?.reason).toBe('unmountable');
    expect(resolveMount(inventory, { ...capture, union: 'Nope' }, 'desktop').refusal?.reason).toBe('blocked');
  });

  it('mounts a member, photographs it and records the image', async () => {
    const reportDir = await tmpDir();
    const clock = fakeClock();
    const url = '/__states';
    const session = new ScriptedSession({ site: { [url]: { harness: HARNESS } } });
    const [capture] = plannedCaptures(inventory);
    if (!capture) throw new Error('no capture');
    const recorded: string[] = [];
    const result = await captureMounted(session, resolveMount(inventory, capture, 'desktop'), {
      reportDir,
      slug: 'run',
      now: () => clock.now(),
      record: async ({ file, kind, row }) => {
        recorded.push(`${kind} ${row} ${file}`);
      },
    });
    expect(result).toMatchObject({ id: 'TileState.open', ok: true, provenance: 'mounted', verified: null, subject: 'assets/run/states/TileState.open.subject.png', component: 'Tile' });
    expect(result.expect).toBe('Tile drawn with state="open"');
    expect(session.calls[0]).toBe('navigate /__states?c=Tile&props=%7B%22state%22%3A%22open%22%7D');
    expect(existsSync(join(reportDir, 'assets/run/states/TileState.open.subject.png'))).toBe(true);
    expect(recorded).toEqual([`screenshot TileState.open ${join(reportDir, 'assets/run/states/TileState.open.subject.png')}`]);
  });

  it('fails as unmountable with the harness sentence, as blocked off the harness, and without evaluate', async () => {
    const [capture] = plannedCaptures(inventory);
    if (!capture) throw new Error('no capture');
    const ctx = { reportDir: await tmpDir(), slug: 'run', now: () => 0, record: async () => {} };
    const broken = new ScriptedSession({ site: { '/__states': { harness: { harness: true, error: 'Tile threw: props.state is undefined', roots: 0 } } } });
    expect(await captureMounted(broken, resolveMount(inventory, capture, 'desktop'), ctx)).toMatchObject({ ok: false, reason: 'unmountable', missingProp: 'Tile threw: props.state is undefined' });
    const elsewhere = new ScriptedSession({ site: {} });
    expect(await captureMounted(elsewhere, resolveMount(inventory, capture, 'desktop'), ctx)).toMatchObject({ ok: false, reason: 'blocked' });
    const blind = new ScriptedSession({ evaluate: false });
    const result = await captureMounted(blind, resolveMount(inventory, capture, 'desktop'), ctx);
    expect(result).toMatchObject({ ok: false, reason: 'blocked' });
    expect(result.error).toContain('cannot evaluate');
    expect(blind.calls).toEqual([]);
  });
});
