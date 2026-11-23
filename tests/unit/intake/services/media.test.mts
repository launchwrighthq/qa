import { describe, expect, it } from 'vitest';
import { download, type FetchFn, kindOf, mimeOf, sniffMime, sourceOf } from '../../../../src/intake/services/media.mts';

/** The cloud metadata address, the target of a server-side request forgery. */
const METADATA = '169.254.169.254'; // publish-audit: allow

function server(routes: Record<string, () => Response>): { fetch: FetchFn; seen: { url: string; auth: string | null }[] } {
  const seen: { url: string; auth: string | null }[] = [];
  const fetch: FetchFn = async (input, init) => {
    seen.push({ url: input, auth: new Headers(init?.headers).get('authorization') });
    const route = routes[input];
    if (!route) throw new TypeError('fetch failed');
    return route();
  };
  return { fetch, seen };
}

const githubOnly = (url: URL): Record<string, string> => (url.hostname === 'github.com' ? { authorization: 'Bearer t0k' } : {});

describe('download', () => {
  it('follows a redirect and drops the header on the other host', async () => {
    const s = server({
      'https://github.com/a': () => new Response(null, { status: 302, headers: { location: 'https://bucket.example.com/a.png?sig=1' } }),
      'https://bucket.example.com/a.png?sig=1': () => new Response('png bytes', { headers: { 'content-type': 'image/png' } }),
    });
    const got = await download('https://github.com/a', { fetch: s.fetch, maxBytes: 1000, headersFor: githubOnly });
    expect(got).toMatchObject({ mime: 'image/png' });
    expect(s.seen).toEqual([
      { url: 'https://github.com/a', auth: 'Bearer t0k' },
      { url: 'https://bucket.example.com/a.png?sig=1', auth: null },
    ]);
  });

  it('marks a body over the cap too-large, by header and while reading', async () => {
    const s = server({
      'https://x.test/declared': () => new Response('x', { headers: { 'content-length': '5000' } }),
      'https://x.test/streamed': () => new Response('y'.repeat(2000)),
    });
    expect(await download('https://x.test/declared', { fetch: s.fetch, maxBytes: 1000 })).toEqual({ skipped: 'too-large' });
    expect(await download('https://x.test/streamed', { fetch: s.fetch, maxBytes: 1000 })).toEqual({ skipped: 'too-large' });
  });

  it('marks an error status, an HTML page, a network failure and a redirect loop unreachable', async () => {
    const s = server({
      'https://x.test/404': () => new Response('no', { status: 404 }),
      'https://x.test/login': () => new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      'https://x.test/loop': () => new Response(null, { status: 302, headers: { location: 'https://x.test/loop' } }),
    });
    for (const url of ['https://x.test/404', 'https://x.test/login', 'https://x.test/down', 'https://x.test/loop']) {
      expect(await download(url, { fetch: s.fetch, maxBytes: 1000 })).toEqual({ skipped: 'unreachable' });
    }
  });

  it('refuses a URL that allow rejects, on the first request and on a redirect hop', async () => {
    const s = server({
      'https://github.com/user-attachments/assets/a': () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:8080/admin' } }),
    });
    const allow = (url: URL): boolean => url.protocol === 'https:' && url.hostname === 'github.com';
    expect(await download(`https://${METADATA}/latest`, { fetch: s.fetch, maxBytes: 1000, allow })).toEqual({ skipped: 'unsupported' });
    expect(await download('https://github.com/user-attachments/assets/a', { fetch: s.fetch, maxBytes: 1000, allow })).toEqual({ skipped: 'unsupported' });
    expect(s.seen.map((x) => x.url)).toEqual(['https://github.com/user-attachments/assets/a']);
  });

  it('marks a link that is not http unsupported', async () => {
    expect(await download('ftp://x.test/a.png', { fetch: server({}).fetch, maxBytes: 1000 })).toEqual({ skipped: 'unsupported' });
  });

  it('passes on an error that is not a network failure', async () => {
    const fetch: FetchFn = async () => {
      throw new RangeError('a fault in the fetch');
    };
    await expect(download('https://x.test/a', { fetch, maxBytes: 1000 })).rejects.toThrow(RangeError);
  });
});

describe('media types', () => {
  it('sniffs the first bytes when the header is generic', () => {
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffMime(new TextEncoder().encode('\0\0\0\x18ftypmp42'))).toBe('video/mp4');
    expect(sniffMime(new TextEncoder().encode('OggS'))).toBe('audio/ogg');
    expect(mimeOf('application/octet-stream', new TextEncoder().encode('GIF89a'))).toBe('image/gif');
    expect(mimeOf('image/webp; q=1', new Uint8Array())).toBe('image/webp');
    expect(mimeOf(null, new Uint8Array([1, 2]), 'clip.mov')).toBe('video/quicktime');
  });

  it('gives the attachment kind', () => {
    expect(kindOf('image/png')).toBe('image');
    expect(kindOf('video/mp4')).toBe('video');
    expect(kindOf('audio/ogg', true)).toBe('voice');
    expect(kindOf('application/zip')).toBe('file');
  });

  it('keeps the query of a signed URL out of the source', () => {
    expect(sourceOf('https://private-user-images.githubusercontent.com/1/a.mp4?jwt=secret#x')).toBe('https://private-user-images.githubusercontent.com/1/a.mp4');
  });
});
