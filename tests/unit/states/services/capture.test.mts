import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fakeClock, tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import type { RoutablePage } from '../../../../src/drivers/target/contract.mts';
import {
  CaptureFailure,
  captureGroup,
  diffNodes,
  getAtPath,
  identicalRenderings,
  installSubstitution,
  locateSubjects,
  moduleUrl,
  numbersUnderKey,
  pathSelector,
  rotate,
  setAtPath,
  type TreeNode,
} from '../../../../src/states/services/capture.mts';
import { groupFor } from '../../../../src/states/services/loop.mts';
import { plannedCaptures, type UnionEntry } from '../../../../src/states/services/inventory.mts';
import { FakeRoutablePage, ScriptedSession } from '../../../support/states-fakes.mts';

const node = (tag: string, text: string, children: TreeNode[] = []): TreeNode => ({ tag, self: JSON.stringify([tag, [], text]), children });
const list = (...texts: string[]): TreeNode => node('BODY', '', [node('H1', 'Invites'), node('UL', '', texts.map((t) => node('LI', t)))]);

/** The app's own state function: an invite is open until it is closed. */
const inviteState = (row: Record<string, unknown>): string | null => (row.closed === true ? 'closed' : 'open');

const union: UnionEntry = {
  name: 'InviteState',
  file: 'apps/client/src/invite.ts',
  line: 1,
  members: ['open', 'closed'],
  kind: 'output',
  flattens: [],
  inputs: [],
  outputs: [
    {
      fn: 'inviteState',
      file: 'apps/client/src/invite.ts',
      exported: true,
      nullable: false,
      async: false,
      solvable: true,
      pivots: { literals: [], names: [] },
      params: [{ name: 'invite', type: 'Invite', typeFile: null, shape: { type: 'Invite', fields: { closed: { kind: 'boolean' }, name: { kind: 'opaque' } } } }],
    },
  ],
  delivery: { route: '/invites', intercept: { url: '**/api/invites*', container: 'items' }, settle: { selector: 'li' } },
};

describe('intercepted capture', () => {
  it('reads and writes a dotted path, and creates nothing on the way', () => {
    const body = { data: { items: [1, 2] }, rows: [{ a: 1 }] };
    expect(getAtPath(body, 'data.items')).toEqual([1, 2]);
    expect(getAtPath(body, 'rows.0.a')).toBe(1);
    expect(setAtPath(body, 'data.items', [3])).toBe(true);
    expect(body.data.items).toEqual([3]);
    expect(setAtPath(body, 'data.missing', [])).toBe(false);
    expect(setAtPath(body, 'rows.5', {})).toBe(false);
  });

  it('rotates by one, so every slot differs and the multiset stays', () => {
    expect(rotate([1, 2, 3])).toEqual([2, 3, 1]);
    expect(rotate([1])).toEqual([1]);
  });

  it('locates N subjects as N differing children of one tag', () => {
    const located = locateSubjects(list('open', 'closed'), list('closed', 'open'), 2);
    expect(located).toEqual({ ancestor: [1], paths: [[1, 0], [1, 1]] });
    expect(pathSelector('body', [1, 0])).toBe('body > *:nth-child(2) > *:nth-child(1)');
    expect(diffNodes(list('a'), list('a'))).toEqual([]);
  });

  it('fails identical renderings as the identical finding, and names the pair that collapsed', () => {
    expect(() => locateSubjects(list('x', 'x'), list('x', 'x'), 2)).toThrow(expect.objectContaining({ reason: 'identical' }));
    const collapsed = (() => {
      try {
        locateSubjects(list('a', 'b', 'b'), list('b', 'b', 'a'), 3);
      } catch (e) {
        return e as CaptureFailure;
      }
      return null;
    })();
    expect(collapsed?.reason).toBe('identical');
    expect(collapsed?.message).toContain('Subjects 1 and 2 render an identical element');
    expect(identicalRenderings([node('LI', 'a'), node('LI', 'b'), node('LI', 'a')])).toEqual([[0, 2]]);
  });

  it('addresses a project module through the dev server /@fs path', () => {
    expect(moduleUrl('/work/app', 'apps/client/src/invite.ts')).toBe('/@fs/work/app/apps/client/src/invite.ts');
    expect(numbersUnderKey({ a: [{ bar: 3 }, { bar: 3 }, { bar: 4 }] }, 'bar')).toEqual([3, 4]);
  });

  it('collects the real rows, rewrites only the container, and fails when the interception never fired', async () => {
    const page = new FakeRoutablePage({ url: '**/api/invites*', body: { items: [{ closed: false, name: 'one' }], total: 1 } }, inviteState, '/p');
    const substitution = await installSubstitution(page as RoutablePage, { url: '**/api/invites*', container: 'items' });
    substitution.record();
    await page.load();
    substitution.assertApplied();
    expect(substitution.corpus).toEqual([{ closed: false, name: 'one' }]);
    substitution.use([{ closed: true, name: 'two' }]);
    await page.load();
    expect(JSON.parse(page.fulfilled.at(-1) as string)).toEqual({ items: [{ closed: true, name: 'two' }], total: 1 });
    substitution.use([]);
    expect(() => substitution.assertApplied()).toThrow(expect.objectContaining({ reason: 'blocked' }));
    await substitution.dispose();
    expect(page.handlers).toEqual([]);
  });

  it('records a container the response does not carry as a blocked capture', async () => {
    const page = new FakeRoutablePage({ url: '**/api/invites*', body: { items: [] } }, inviteState, '/p');
    const substitution = await installSubstitution(page as RoutablePage, { url: '**/api/invites*', container: 'rows' });
    substitution.use([{}]);
    await page.load();
    expect(() => substitution.assertApplied()).toThrow(/"rows" is not in the response/);
  });

  it('solves, locates, verifies and photographs every member of a group', async () => {
    const projectRoot = await tmpDir();
    const reportDir = join(projectRoot, 'docs/qa');
    const page = new FakeRoutablePage({ url: '**/api/invites*', body: { items: [{ closed: false, name: 'Ada' }] } }, inviteState, projectRoot);
    const session = new ScriptedSession({ page, site: {} });
    const clock = fakeClock();
    const recorded: string[] = [];
    const built = groupFor(union, plannedCaptures({ unions: [union] }), 'desktop');
    if (!built.group) throw new Error(built.missing.join(', '));
    session.route = '/invites';
    const { results, notes } = await captureGroup(session, page, built.group, {
      projectRoot,
      reportDir,
      slug: 'run',
      now: () => clock.now(),
      record: async ({ file, row }) => {
        recorded.push(`${row} ${file.slice(reportDir.length + 1)}`);
      },
    });
    expect(results.map((r) => [r.id, r.ok, r.provenance, r.verified, r.answered, r.subject])).toEqual([
      ['InviteState.open', true, 'intercepted', true, 'open', 'assets/run/states/InviteState.open.subject.png'],
      ['InviteState.closed', true, 'intercepted', true, 'closed', 'assets/run/states/InviteState.closed.subject.png'],
    ]);
    expect(recorded).toEqual([
      'InviteState.open assets/run/states/InviteState.open.context.png',
      'InviteState.open assets/run/states/InviteState.open.subject.png',
      'InviteState.closed assets/run/states/InviteState.closed.context.png',
      'InviteState.closed assets/run/states/InviteState.closed.subject.png',
    ]);
    expect(existsSync(join(reportDir, 'assets/run/states/InviteState.closed.subject.png'))).toBe(true);
    expect(notes[0]).toContain('corpus 1 real Invite row(s)');
    // Both subjects are the one real row with only the field under test changed.
    expect(JSON.parse(page.fulfilled.at(-1) as string)).toEqual({ items: [{ closed: false, name: 'Ada' }, { closed: true, name: 'Ada' }] });
    expect(page.handlers).toEqual([]);
  });

  it('fails every member of a group whose state cannot be produced, naming the fields tried', async () => {
    const projectRoot = await tmpDir();
    const page = new FakeRoutablePage({ url: '**/api/invites*', body: { items: [{ closed: false, name: 'Ada' }] } }, () => 'open', projectRoot);
    const session = new ScriptedSession({ page });
    session.route = '/invites';
    const built = groupFor(union, plannedCaptures({ unions: [union] }), 'desktop');
    if (!built.group) throw new Error('no group');
    const { results } = await captureGroup(session, page, built.group, { projectRoot, reportDir: projectRoot, slug: 'run', now: () => 0, record: async () => {} });
    expect(results.map((r) => [r.id, r.ok, r.reason])).toEqual([
      ['InviteState.open', false, 'blocked'],
      ['InviteState.closed', false, 'blocked'],
    ]);
    expect(results[0]?.error).toContain('only one member of InviteState has a subject');
  });

  it('fails a group whose page left the route', async () => {
    const projectRoot = await tmpDir();
    const page = new FakeRoutablePage({ url: '**/api/invites*', body: { items: [{ closed: false }] } }, inviteState, projectRoot);
    const session = new ScriptedSession({ page });
    session.navigate = async (route: string) => {
      session.route = route === '/invites' ? '/sign-in' : route;
      await page.load();
    };
    const built = groupFor(union, plannedCaptures({ unions: [union] }), 'desktop');
    if (!built.group) throw new Error('no group');
    const { results } = await captureGroup(session, page, built.group, { projectRoot, reportDir: projectRoot, slug: 'run', now: () => 0, record: async () => {} });
    expect(results[0]).toMatchObject({ ok: false, reason: 'blocked' });
    expect(results[0]?.error).toContain('the page left /invites for /sign-in');
  });
});
