import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import comments from '../../../src/commands/qa-comments.mts';
import type { QaCommandOptions } from '../../../src/commands/qa.command.mts';
import { type Comment, COMMENTS_DIR, fileCommentStore, makeComment } from '../../../src/services/comments.mts';
import { writeReportFixture } from '../../../src/testing/report-fixture.mts';

const AT = '2026-01-01T00:00:00.000Z';

function io(cwd: string, over: Partial<QaCommandOptions> = {}): { out: string[]; err: string[]; opts: QaCommandOptions } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: { cwd, out: (l) => out.push(l), err: (l) => err.push(l), config: {}, ...over } };
}

/** A report fixture plus an open comment and a resolved comment in the store. */
async function fixture(): Promise<{ root: string; slug: string }> {
  const root = await tmpDir();
  const { slug } = await writeReportFixture(join(root, 'docs/qa'));
  const open = makeComment({ id: 'c-open', anchor: { kind: 'flow', name: 'home.guest' }, author: 'guest', body: 'open note', createdAt: AT });
  const done: Comment = { ...makeComment({ id: 'c-done', anchor: { kind: 'flow', name: 'home.guest' }, author: 'guest', body: 'done note', createdAt: AT }), status: 'resolved' };
  await fileCommentStore(join(root, COMMENTS_DIR)).write(slug, [open, done]);
  return { root, slug };
}

describe('lw qa comments export', () => {
  it('prints the open comment and omits the resolved one', async () => {
    const { root, slug } = await fixture();
    const c = io(root);
    expect(await comments.run(['export', slug], c.opts)).toBe(0);
    expect(c.out.join('\n')).toContain('open note');
    expect(c.out.join('\n')).not.toContain('done note');
  });
});

describe('lw qa comments serve', () => {
  it('serves the viewer and stops on an aborted signal', async () => {
    const { root, slug } = await fixture();
    const controller = new AbortController();
    controller.abort();
    const c = io(root, { signal: controller.signal });
    expect(await comments.run(['serve', slug], c.opts)).toBe(0);
    expect(c.out[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/dist\/.+-viewer\/index\.html$/);
  });
});

describe('comments command', () => {
  it('prints the usage without a verb', async () => {
    const c = io(await tmpDir());
    expect(await comments.run([], c.opts)).toBe(2);
    expect(c.err.join('\n')).toContain('lw qa comments <serve|export|resolve> <slug>');
  });
});
