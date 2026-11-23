// Finds the media links in the Markdown of a GitHub issue body or comment (spec 2.15.2).

/** Hosts whose links are GitHub uploads. Every link to them counts, in any form. */
const UPLOAD_HOSTS = ['user-images.githubusercontent.com', 'private-user-images.githubusercontent.com'];
const UPLOAD_PATH = /^\/user-attachments\/(assets|files)\//;
const MEDIA_EXTENSION = /\.(png|jpe?g|gif|webp|heic|mp4|mov|webm)$/i;

/** True when the URL is a GitHub upload: `github.com/user-attachments/...` or a user-images host. */
export function isGithubUpload(url: URL): boolean {
  if (UPLOAD_HOSTS.includes(url.hostname)) return true;
  return url.hostname === 'github.com' && UPLOAD_PATH.test(url.pathname);
}

/**
 * True when the token of the `gh` login may go to this URL: a GitHub upload over https. Issue text
 * is not trusted, so the token goes to no other GitHub URL.
 */
export function takesGithubToken(url: URL): boolean {
  return url.protocol === 'https:' && isGithubUpload(url);
}

/** The storage host a GitHub upload redirects to. */
const ASSET_STORE = /^github-production-user-asset-[a-z0-9]+\.s3\.amazonaws\.com$/;

/**
 * True when intake may download from this URL: https to a GitHub upload, a `githubusercontent.com`
 * host or the asset store an upload redirects to. Any other link in issue text is skipped, so a
 * reporter cannot point the operator's machine at a local or private address.
 */
export function isGithubMediaHost(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  return isGithubUpload(url) || url.hostname.endsWith('.githubusercontent.com') || ASSET_STORE.test(url.hostname);
}

function parse(raw: string): URL | null {
  const trimmed = raw.replace(/[),.;:!?'"\]>]+$/, '');
  if (!URL.canParse(trimmed)) return null;
  const url = new URL(trimmed);
  return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
}

/**
 * The media links of a Markdown text, in order and without repeats: every GitHub upload link,
 * every Markdown image, every `<img>` and `<video>` source, and every bare link to an image or
 * video file.
 */
export function mediaLinks(markdown: string): string[] {
  const found: { index: number; url: string }[] = [];
  const add = (index: number, raw: string | undefined, always: boolean): void => {
    if (raw === undefined) return;
    const url = parse(raw);
    if (url === null) return;
    if (always || isGithubUpload(url) || MEDIA_EXTENSION.test(url.pathname)) found.push({ index, url: url.href });
  };
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g)) add(m.index, m[1], true);
  for (const m of markdown.matchAll(/<(?:img|video|source)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m.index, m[1], true);
  for (const m of markdown.matchAll(/https?:\/\/[^\s<>()"'`]+/g)) add(m.index, m[0], false);
  found.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of found) {
    if (seen.has(f.url)) continue;
    seen.add(f.url);
    out.push(f.url);
  }
  return out;
}
