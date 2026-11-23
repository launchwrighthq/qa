import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { afterEach, describe, expect, it } from 'vitest';
import { type CommentServer, startCommentServer } from '../../../src/services/comment-server.mts';
import { type Comment, fileCommentStore } from '../../../src/services/comments.mts';
import { nodeFetch } from '../../support/node-fetch.mts';

const SLUG = '2026-01-01-sample';
const VIEWER = 'dist/x-viewer';

let running: CommentServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

/** A server over a temp report folder and comment store, with a stub page renderer. */
async function startServer(): Promise<{ server: CommentServer; reportDir: string; store: ReturnType<typeof fileCommentStore> }> {
  const reportDir = await tmpDir();
  const store = fileCommentStore(join(await tmpDir(), 'comments'));
  const renderPages = (comments: readonly Comment[]): Map<string, string> => new Map([['index.html', `<html>page ${comments.length}</html>`]]);
  const server = await startCommentServer({ reportDir, viewerDir: VIEWER, slug: SLUG, store, renderPages, clock: fakeClock() });
  running = server;
  return { server, reportDir, store };
}

function addFlow(url: string): Promise<Response> {
  const body = JSON.stringify({ op: 'add', comment: { anchor: { kind: 'flow', name: 'overview' }, author: 'guest', body: 'note' } });
  return nodeFetch(`${url}/${VIEWER}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
}

describe('startCommentServer', () => {
  it('reads an empty comment list over GET', async () => {
    const { server } = await startServer();
    const res = await nodeFetch(`${server.url}/${VIEWER}/comments`);
    expect(await res.json()).toEqual({ slug: SLUG, comments: [] });
  });

  it('adds a comment over POST and persists it', async () => {
    const { server, store } = await startServer();
    const res = await addFlow(server.url);
    const payload = (await res.json()) as { comments: Comment[] };
    expect(payload.comments).toHaveLength(1);
    expect(payload.comments[0]?.anchor).toEqual({ kind: 'flow', name: 'overview' });
    expect(await store.read(SLUG)).toHaveLength(1);
  });

  it('serves a rendered viewer page', async () => {
    const { server } = await startServer();
    const res = await nodeFetch(`${server.url}/${VIEWER}/index.html`);
    expect(await res.text()).toBe('<html>page 0</html>');
  });

  it('redirects the root to the index page', async () => {
    const { server } = await startServer();
    const res = await nodeFetch(`${server.url}/`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`/${VIEWER}/index.html`);
  });

  it('serves an asset file from the report folder', async () => {
    const { server, reportDir } = await startServer();
    await mkdir(join(reportDir, 'assets', SLUG), { recursive: true });
    await writeFile(join(reportDir, 'assets', SLUG, 'a.png'), Buffer.from([1, 2, 3]));
    const res = await nodeFetch(`${server.url}/assets/${SLUG}/a.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('answers a bad operation with status 400', async () => {
    const { server } = await startServer();
    const res = await nodeFetch(`${server.url}/${VIEWER}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'bogus' }) });
    expect(res.status).toBe(400);
  });
});
