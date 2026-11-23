import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import {
  addComment,
  type Comment,
  type CommentAnchor,
  commentsFile,
  fileCommentStore,
  makeComment,
  replyToComment,
  setStatus,
  validateAnchor,
} from '../../../src/services/comments.mts';

const AT = '2026-01-01T00:00:00.000Z';
const SLUG = '2026-01-01-sample';

/** One comment per anchor kind, with a neutral author and body. */
const ANCHORS: CommentAnchor[] = [
  { kind: 'step', row: 'home.guest', leg: 'desktop', attempt: 1, step: 2 },
  { kind: 'text', section: 'home.guest', quote: 'home shows guest' },
  { kind: 'region', screenshot: `assets/${SLUG}/desktop-home.guest.png`, row: 'home.guest', x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
  { kind: 'time', video: `assets/${SLUG}/desktop-home.guest.webm`, row: 'home.guest', start: 1.5, end: 3 },
  { kind: 'flow', name: 'home.guest' },
];

function sampleComments(): Comment[] {
  return ANCHORS.map((anchor, i) => makeComment({ id: `c${i}`, anchor, author: 'guest', body: `note ${i}`, createdAt: AT }));
}

describe('fileCommentStore', () => {
  it('stores and reads back every anchor kind', async () => {
    const store = fileCommentStore(await tmpDir());
    const comments = sampleComments();
    await store.write(SLUG, comments);
    expect(await store.read(SLUG)).toEqual(comments);
  });

  it('reads an empty list for an unwritten slug', async () => {
    const store = fileCommentStore(await tmpDir());
    expect(await store.read(SLUG)).toEqual([]);
  });

  it('refuses an unsafe report slug', async () => {
    const store = fileCommentStore(await tmpDir());
    await expect(store.read('../escape')).rejects.toMatchObject({ code: 'qa.comment.slug' });
  });
});

describe('commentsFile', () => {
  it('names the json file of a slug', () => {
    expect(commentsFile('/tmp/store', SLUG)).toBe(`/tmp/store/${SLUG}.json`);
  });
});

describe('makeComment', () => {
  it('starts a comment open with no replies', () => {
    const c = makeComment({ anchor: ANCHORS[4] as CommentAnchor, author: 'guest', body: 'note', createdAt: AT });
    expect(c.status).toBe('open');
    expect(c.replies).toEqual([]);
  });

  it('refuses a region coordinate outside zero to one', () => {
    const bad: CommentAnchor = { kind: 'region', screenshot: 'assets/x/y.png', row: 'home.guest', x: 1.5, y: 0, w: 0.1, h: 0.1 };
    expect(() => makeComment({ anchor: bad, author: 'guest', body: 'note', createdAt: AT })).toThrow(/qa\.comment\.anchor|invalid/);
  });
});

describe('validateAnchor', () => {
  it('names a missing field of a step anchor', () => {
    expect(validateAnchor({ kind: 'step', row: 'home.guest', leg: 'desktop', attempt: 1 })).toEqual(['step anchor: step must be a positive integer']);
  });

  it('accepts a well formed flow anchor', () => {
    expect(validateAnchor({ kind: 'flow', name: 'home.guest' })).toEqual([]);
  });
});

describe('addComment', () => {
  it('refuses a duplicate comment id', () => {
    const [first] = sampleComments();
    expect(() => addComment([first as Comment], first as Comment)).toThrow(/already exists/);
  });
});

describe('replyToComment', () => {
  it('appends a reply under an existing comment', () => {
    const [first] = sampleComments();
    const next = replyToComment([first as Comment], 'c0', { author: 'desktop', body: 'seen', createdAt: AT });
    expect(next[0]?.replies).toEqual([{ author: 'desktop', body: 'seen', createdAt: AT }]);
  });

  it('refuses a reply to a missing comment', () => {
    expect(() => replyToComment([], 'nope', { author: 'guest', body: 'x', createdAt: AT })).toThrow(/to reply to/);
  });
});

describe('setStatus', () => {
  it('marks an open comment resolved', () => {
    const [first] = sampleComments();
    expect(setStatus([first as Comment], 'c0', 'resolved')[0]?.status).toBe('resolved');
  });
});
