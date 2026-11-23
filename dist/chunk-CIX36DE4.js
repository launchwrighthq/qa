// src/intake/services/links.mts
var UPLOAD_HOSTS = ["user-images.githubusercontent.com", "private-user-images.githubusercontent.com"];
var UPLOAD_PATH = /^\/user-attachments\/(assets|files)\//;
var MEDIA_EXTENSION = /\.(png|jpe?g|gif|webp|heic|mp4|mov|webm)$/i;
function isGithubUpload(url) {
  if (UPLOAD_HOSTS.includes(url.hostname)) return true;
  return url.hostname === "github.com" && UPLOAD_PATH.test(url.pathname);
}
function takesGithubToken(url) {
  return url.protocol === "https:" && isGithubUpload(url);
}
var ASSET_STORE = /^github-production-user-asset-[a-z0-9]+\.s3\.amazonaws\.com$/;
function isGithubMediaHost(url) {
  if (url.protocol !== "https:") return false;
  return isGithubUpload(url) || url.hostname.endsWith(".githubusercontent.com") || ASSET_STORE.test(url.hostname);
}
function parse(raw) {
  const trimmed = raw.replace(/[),.;:!?'"\]>]+$/, "");
  if (!URL.canParse(trimmed)) return null;
  const url = new URL(trimmed);
  return url.protocol === "https:" || url.protocol === "http:" ? url : null;
}
function mediaLinks(markdown) {
  const found = [];
  const add = (index, raw, always) => {
    if (raw === void 0) return;
    const url = parse(raw);
    if (url === null) return;
    if (always || isGithubUpload(url) || MEDIA_EXTENSION.test(url.pathname)) found.push({ index, url: url.href });
  };
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g)) add(m.index, m[1], true);
  for (const m of markdown.matchAll(/<(?:img|video|source)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m.index, m[1], true);
  for (const m of markdown.matchAll(/https?:\/\/[^\s<>()"'`]+/g)) add(m.index, m[0], false);
  found.sort((a, b) => a.index - b.index);
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const f of found) {
    if (seen.has(f.url)) continue;
    seen.add(f.url);
    out.push(f.url);
  }
  return out;
}

export {
  isGithubUpload,
  takesGithubToken,
  isGithubMediaHost,
  mediaLinks
};
//# sourceMappingURL=chunk-CIX36DE4.js.map