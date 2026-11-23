import { describe, expect, it } from 'vitest';
import { isGithubMediaHost, isGithubUpload, mediaLinks, takesGithubToken } from '../../../../src/intake/services/links.mts';

/** The cloud metadata address, the target of a server-side request forgery. */
const METADATA = '169.254.169.254'; // publish-audit: allow

describe('mediaLinks', () => {
  it('finds uploads, Markdown images, img and video sources and bare video links in order, once each', () => {
    const md = [
      '<img width="320" alt="a" src="https://github.com/user-attachments/assets/aaa" />',
      'https://github.com/user-attachments/assets/bbb',
      '![shot](https://user-images.githubusercontent.com/1/shot.png)',
      '![signed](https://private-user-images.githubusercontent.com/1/v.mp4?jwt=x.y)',
      '<video src="https://cdn.example.com/clip.webm"></video>',
      'A bare clip: https://cdn.example.com/run.mov.',
      '[the page](https://example.com/report) and https://example.com/docs',
      'Again: https://github.com/user-attachments/assets/aaa',
      '[log file](https://github.com/user-attachments/files/123/log.txt)',
    ].join('\n');
    expect(mediaLinks(md)).toEqual([
      'https://github.com/user-attachments/assets/aaa',
      'https://github.com/user-attachments/assets/bbb',
      'https://user-images.githubusercontent.com/1/shot.png',
      'https://private-user-images.githubusercontent.com/1/v.mp4?jwt=x.y',
      'https://cdn.example.com/clip.webm',
      'https://cdn.example.com/run.mov',
      'https://github.com/user-attachments/files/123/log.txt',
    ]);
  });

  it('gives nothing for text without media links', () => {
    expect(mediaLinks('No link here. See https://example.com/page and [docs](https://example.com/docs).')).toEqual([]);
  });
});

describe('GitHub hosts', () => {
  it('sends the token only to GitHub upload URLs over https', () => {
    expect(takesGithubToken(new URL('https://github.com/user-attachments/assets/a'))).toBe(true);
    expect(takesGithubToken(new URL('https://private-user-images.githubusercontent.com/a'))).toBe(true);
    expect(takesGithubToken(new URL('https://api.github.com/user'))).toBe(false);
    expect(takesGithubToken(new URL('https://raw.githubusercontent.com/a'))).toBe(false);
    expect(takesGithubToken(new URL('https://github.com/acme/widget/issues/1'))).toBe(false);
    expect(takesGithubToken(new URL('https://github-production-user-asset-6210df.s3.amazonaws.com/a'))).toBe(false);
    expect(takesGithubToken(new URL('https://github.com.example.com/a'))).toBe(false);
    expect(takesGithubToken(new URL('http://github.com/user-attachments/assets/a'))).toBe(false);
  });

  it('downloads only from GitHub media hosts over https', () => {
    expect(isGithubMediaHost(new URL('https://github.com/user-attachments/assets/a'))).toBe(true);
    expect(isGithubMediaHost(new URL('https://github-production-user-asset-6210df.s3.amazonaws.com/a'))).toBe(true);
    expect(isGithubMediaHost(new URL('https://user-images.githubusercontent.com/1/a.png'))).toBe(true);
    expect(isGithubMediaHost(new URL('https://example.com/a.png'))).toBe(false);
    expect(isGithubMediaHost(new URL('https://127.0.0.1/a.png'))).toBe(false);
    expect(isGithubMediaHost(new URL(`https://${METADATA}/latest/meta-data`))).toBe(false);
    expect(isGithubMediaHost(new URL('http://user-images.githubusercontent.com/1/a.png'))).toBe(false);
  });

  it('knows an upload link', () => {
    expect(isGithubUpload(new URL('https://github.com/user-attachments/assets/a'))).toBe(true);
    expect(isGithubUpload(new URL('https://github.com/acme/widget/issues/1'))).toBe(false);
  });
});
