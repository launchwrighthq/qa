import { describe, expect, it } from 'vitest';
import { type ExportContext, exportTaskList, resolveComments } from '../../../src/services/comment-export.mts';
import { type Comment, type CommentAnchor, makeComment } from '../../../src/services/comments.mts';
import type { Manifest } from '../../../src/services/manifest.mts';
import type { LedgerEntry } from '../../../src/services/types.mts';

const AT = '2026-01-01T00:00:00.000Z';
const SLUG = '2026-01-01-sample';

function entry(path: string, kind: LedgerEntry['kind']): LedgerEntry {
  return { path, kind, sha256: '0'.repeat(64), bytes: 1, capturedAt: AT, commit: 'abc1234', dirty: false, leg: 'desktop', target: 'playwright', provenance: 'live', row: 'home.guest', attempt: 1 };
}

function context(): ExportContext {
  const manifest: Manifest = {
    title: 'Sample',
    generated: AT,
    shots: [{ id: 'home.guest', screen: 'home', state: 'guest', source: ['commit:abc1234'], legs: ['desktop'], route: '/home', fixture: { arm: [] }, settle: { busy: true }, expect: 'home shows guest' }],
  };
  const entries = [entry(`assets/${SLUG}/desktop-home.guest.png`, 'screenshot'), entry(`assets/${SLUG}/desktop-home.guest.2.png`, 'step'), entry(`assets/${SLUG}/desktop-home.guest.webm`, 'video')];
  return { manifest, entries };
}

const ANCHORS: Record<string, CommentAnchor> = {
  step: { kind: 'step', row: 'home.guest', leg: 'desktop', attempt: 1, step: 2 },
  text: { kind: 'text', section: 'home.guest', quote: 'home shows guest' },
  region: { kind: 'region', screenshot: `assets/${SLUG}/desktop-home.guest.png`, row: 'home.guest', x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
  time: { kind: 'time', video: `assets/${SLUG}/desktop-home.guest.webm`, row: 'home.guest', start: 1.5, end: 3 },
  flow: { kind: 'flow', name: 'home.guest' },
};

function openComments(): Comment[] {
  return Object.entries(ANCHORS).map(([k, anchor]) => makeComment({ id: `c-${k}`, anchor, author: 'guest', body: `${k} note`, createdAt: AT }));
}

describe('resolveComments', () => {
  it('resolves each anchor kind to its target', () => {
    const resolved = resolveComments(openComments(), context());
    const by = (kind: string): (typeof resolved)[number] => resolved.find((r) => r.kind === kind) as (typeof resolved)[number];
    expect(resolved).toHaveLength(5);
    expect(by('step').target).toBe(`assets/${SLUG}/desktop-home.guest.2.png`);
    expect(by('step').located).toContain('step 2');
    expect(by('region').target).toBe(`assets/${SLUG}/desktop-home.guest.png`);
    expect(by('region').located).toContain('rectangle');
    expect(by('time').target).toBe(`assets/${SLUG}/desktop-home.guest.webm`);
    expect(by('time').located).toContain('t=1.5s to 3s');
    expect(by('text').located).toContain('home shows guest');
    expect(by('flow').target).toContain('home guest');
  });

  it('omits a resolved comment from the result', () => {
    const comments = [...openComments(), { ...(makeComment({ anchor: ANCHORS.flow as CommentAnchor, author: 'guest', body: 'done note', createdAt: AT, id: 'c-done' })), status: 'resolved' as const }];
    const resolved = resolveComments(comments, context());
    expect(resolved.map((r) => r.id)).not.toContain('c-done');
  });

  it('marks an orphaned anchor whose file left the ledger', () => {
    const orphan = makeComment({ id: 'c-orphan', anchor: { kind: 'region', screenshot: 'assets/gone/missing.png', row: 'home.guest', x: 0, y: 0, w: 0.1, h: 0.1 }, author: 'guest', body: 'gone', createdAt: AT });
    expect(resolveComments([orphan], context())[0]?.orphaned).toBe(true);
  });
});

describe('exportTaskList', () => {
  it('prints one line per open comment with its note', () => {
    const text = exportTaskList(openComments(), context());
    expect(text).toContain('5 open comments to act on:');
    expect(text).toContain('step note');
  });

  it('leaves a resolved comment off the task list', () => {
    const comments = [{ ...(makeComment({ anchor: ANCHORS.flow as CommentAnchor, author: 'guest', body: 'done note', createdAt: AT, id: 'c-done' })), status: 'resolved' as const }];
    expect(exportTaskList(comments, context())).toBe('No open comments to act on.');
  });
});
