// The github driver: read-only gh use, the token in a header only, and the error codes (R24, A3).
import { describe, expect, it } from 'vitest';
import { GithubIntakeDriver, ISSUE_FIELDS, parseIssueUrl } from '../../../../../src/intake/drivers/intake/github.mts';
import { recordedGh } from '../../../../../src/intake/testing/index.mts';
import { GH_FILE, GH_TOKEN, githubFetch, ISSUE_URL } from '../../../../support/intake.mts';

const MAX = 200 * 1024 * 1024;

function driver() {
  const gh = recordedGh(GH_FILE);
  const http = githubFetch();
  return { d: new GithubIntakeDriver({ maxBytes: MAX, gh, fetch: http.fetch }), gh, http };
}

describe('github intake driver', () => {
  it('reads the issue, its comments and every linked image and video', async () => {
    const { d, http } = driver();
    const b = await d.fetch(ISSUE_URL);
    expect(b).toMatchObject({ source: 'github', ref: ISSUE_URL, title: 'Checkout button does nothing' });
    expect(b.items.map((i) => [i.id, i.author, i.at])).toEqual([
      ['body', 'fixture-reporter', '2026-11-10T09:00:00.000Z'],
      ['IC_1', 'fixture-dev', '2026-11-10T09:30:00.000Z'],
      ['IC_2', 'fixture-reporter', '2026-11-10T10:00:00.000Z'],
    ]);
    const media = b.items.flatMap((i) => i.media.map((m) => ({ from: m.from, kind: m.kind, mime: m.mime, skipped: m.skipped, bytes: m.data?.byteLength })));
    expect(media).toEqual([
      { from: 'https://github.com/user-attachments/assets/1b2c3d4e-0000-4000-8000-000000000001', kind: 'image', mime: 'image/png', skipped: undefined, bytes: 25 },
      { from: 'https://github.com/user-attachments/assets/1b2c3d4e-0000-4000-8000-000000000002', kind: 'video', mime: 'video/mp4', skipped: undefined, bytes: 20 },
      { from: 'https://user-images.githubusercontent.com/1000/legacy-shot.png', kind: 'image', mime: 'image/gif', skipped: undefined, bytes: 27 },
      { from: 'https://private-user-images.githubusercontent.com/1000/big-video.mp4', kind: 'video', mime: 'video/mp4', skipped: 'too-large', bytes: undefined },
      { from: 'https://github.com/user-attachments/assets/1b2c3d4e-0000-4000-8000-000000000003', kind: 'file', mime: 'application/octet-stream', skipped: 'unreachable', bytes: undefined },
    ]);
    expect(http.fetch.remaining()).toBe(0);
  });

  it('runs only gh issue view and gh auth token, and never puts the token in an argument', async () => {
    const { d, gh } = driver();
    await d.fetch(ISSUE_URL);
    expect(gh.calls).toEqual([
      ['issue', 'view', ISSUE_URL, '--json', ISSUE_FIELDS],
      ['auth', 'token'],
    ]);
    for (const args of gh.calls) {
      expect(['issue view', 'auth token']).toContain(args.slice(0, 2).join(' '));
      expect(args.join(' ')).not.toContain(GH_TOKEN);
    }
  });

  it('sends the token as a header to GitHub hosts only, never to the redirect target', async () => {
    const { d, http } = driver();
    await d.fetch(ISSUE_URL);
    const expected = http.seen.map((r) => {
      const host = new URL(r.url).hostname;
      return { url: r.url, authorization: host === 'github.com' || host.endsWith('.githubusercontent.com') ? `Bearer ${GH_TOKEN}` : null };
    });
    expect(http.seen).toEqual(expected);
    expect(http.seen.filter((r) => r.url.includes(GH_TOKEN))).toEqual([]);
    expect(http.seen.some((r) => r.url.includes('s3.amazonaws.com'))).toBe(true);
  });

  it('fails a pull request URL with qa.intake.github.not-issue before gh runs', async () => {
    const { d, gh } = driver();
    await expect(d.fetch('https://github.com/acme-test/widget/pull/5')).rejects.toMatchObject({ code: 'qa.intake.github.not-issue' });
    expect(gh.calls).toEqual([]);
  });

  it('fails an issue number that gh shows as a pull request with qa.intake.github.not-issue', async () => {
    const { d } = driver();
    await expect(d.fetch('https://github.com/acme-test/widget/issues/43')).rejects.toMatchObject({ code: 'qa.intake.github.not-issue' });
  });

  it('fails a repository the login cannot read with qa.intake.github.access', async () => {
    const { d, gh } = driver();
    await expect(d.fetch('https://github.com/acme-test/private/issues/7')).rejects.toMatchObject({ code: 'qa.intake.github.access' });
    expect(gh.calls).toHaveLength(1);
  });

  it('fails a ref that is not an issue URL with qa.intake.github.ref', () => {
    for (const ref of ['acme/widget#4', 'https://gitlab.com/a/b/issues/1', 'https://github.com/a/b/issues/x']) {
      expect(() => parseIssueUrl(ref)).toThrow(expect.objectContaining({ code: 'qa.intake.github.ref' }));
    }
    expect(parseIssueUrl('https://github.com/acme-test/widget/issues/42/')).toEqual({ owner: 'acme-test', repo: 'widget', number: 42 });
  });

  it('asks for no token when the issue links no media', async () => {
    const gh = Object.assign(
      async (args: string[]) => {
        gh.calls.push(args);
        return { code: 0, stderr: '', stdout: JSON.stringify({ number: 1, title: 't', body: 'no media', author: null, labels: [], comments: [], createdAt: '2026-11-10T09:00:00Z', url: 'https://github.com/a/b/issues/1', state: 'OPEN' }) };
      },
      { calls: [] as string[][] },
    );
    const b = await new GithubIntakeDriver({ maxBytes: MAX, gh }).fetch('https://github.com/a/b/issues/1');
    expect(b.items).toEqual([{ id: 'body', at: '2026-11-10T09:00:00.000Z', author: 'ghost', text: 'no media', media: [] }]);
    expect(gh.calls.map((a) => a.slice(0, 2).join(' '))).toEqual(['issue view']);
  });
});
