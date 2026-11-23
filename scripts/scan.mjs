#!/usr/bin/env node
// The publish scan of spec 2.12 and risk 3.5. It is plain Node ESM with no dependency, so it runs
// before a build. It scans files, the tree of a revision, or the commits of a range, and prints each
// hit as `path:line kind` with the value redacted. The guard test public-boundary.test.mts uses the
// same rules. A line that holds the exemption marker below is skipped.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOW_MARKER = 'publish-audit: allow';

/** The product words of the strip list of spec 1.3, in base64, so this file holds no product literal. */
const WORDS = ['ZHJhbWE=', 'bW9vbmVsbGE=', 'aWxvdmVkcmFtYQ==', 'YmVzdGRyYW1hc2VyaWVzYm90', 'ZHVja2Rucw==', 'Y29zbWljLWNhY3R1cw==', 'a2VpdGFybw=='].map((b) =>
  Buffer.from(b, 'base64').toString('utf8'),
);

/** Git's own empty tree object id, a constant of the engine, not a credential. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
/** A run of four or more identical characters marks a placeholder, such as AAAA or a rule of dashes. */
const RUN4 = /(.)\1{3}/;
const PLACEHOLDER = /test|fake|sample|example|placeholder|dummy|playground/i;
const BINARY = new Set(['.png', '.mp4', '.webm', '.zip', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2']);

const OCTET = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])';
const ALLOWED_IPV4 = new Set(['127.0.0.1', '0.0.0.0']);
const ALLOWED_HOMES = new Set(['user', 'dev']);
/** RFC 2606 and RFC 6761 names, which no real mailbox uses. */
const RESERVED_MAIL_DOMAIN = /(^|\.)example\.(com|org|net)$|\.(invalid|test|example|localhost)$/i;
const GITHUB_NOREPLY = /^[A-Za-z0-9._+-]+@users\.noreply\.github\.com$/i;

const highEntropy = (s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s);
const plausibleKey = (s) => !RUN4.test(s) && !PLACEHOLDER.test(s);

/** Each rule maps one line to the values it refuses. */
const RULES = [
  { kind: 'bot-token', re: /(?<![A-Za-z0-9_])[0-9]{5,12}:([A-Za-z0-9_-]{30,45})(?![A-Za-z0-9_-])/g, keep: (m) => plausibleKey(m[1]) && highEntropy(m[1]) },
  { kind: 'hex-key', re: /(?<![0-9A-Za-z])[0-9a-fA-F]{32,}(?![0-9A-Za-z])/g, keep: (m) => !RUN4.test(m[0]) && m[0].toLowerCase() !== EMPTY_TREE },
  { kind: 'phone', re: /(?<![0-9+.])\+[1-9][0-9]{9,14}(?![0-9])/g, keep: (m) => !m[0].startsWith('+999') },
  ...[
    /sk-ant-[A-Za-z0-9_-]{20,}/g,
    /\bsk-[A-Za-z0-9]{20,}/g,
    /\bgh[posur]_[A-Za-z0-9]{30,}/g,
    /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\bAIza[0-9A-Za-z_-]{35}\b/g,
    /\bxox[baprs]-[0-9A-Za-z-]{10,}/g,
    /\bglpat-[A-Za-z0-9_-]{20,}/g,
  ].map((re) => ({ kind: 'api-key', re, keep: (m) => plausibleKey(m[0]) })),
  { kind: 'ipv4', re: new RegExp(`(?<![0-9A-Za-z.])${OCTET}(?:\\.${OCTET}){3}(?!\\.?[0-9])(?![A-Za-z])`, 'g'), keep: (m) => !ALLOWED_IPV4.has(m[0]) },
  { kind: 'local-host', re: /(?<![\w.$-])[A-Za-z0-9][A-Za-z0-9-]*\.local(?![\w-]|\.[A-Za-z])/g, keep: () => true },
  { kind: 'home-path', re: /\/home\/([A-Za-z0-9._-]+)/g, keep: (m) => !ALLOWED_HOMES.has(m[1]) },
  { kind: 'home-path', re: /\/Users\/[A-Za-z0-9._-]+/g, keep: () => true },
  {
    kind: 'mail',
    re: /(?<![\w.+%-])([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})(?![\w-])/g,
    keep: (m) => !RESERVED_MAIL_DOMAIN.test(m[2]) && !/noreply/i.test(m[0]),
  },
  ...WORDS.map((word) => ({ kind: 'product-word', re: new RegExp(`(?<![a-z0-9_])${word.replace('-', '\\-')}(?![a-z0-9_])`, 'gi'), keep: () => true })),
];

export const productWords = () => [...WORDS];

/** Each hit in one block of text, as `{ kind, line, value }`. */
export function scanText(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const { kind, re, keep } of RULES) for (const m of line.matchAll(re)) if (keep(m)) hits.push({ kind, line: i + 1, value: m[0] });
  });
  return hits;
}

/** The hits of one git identity: a mail other than the GitHub noreply form, or a hit in the name. */
export function checkIdentity(name, email) {
  const hits = GITHUB_NOREPLY.test(email) ? [] : [{ kind: 'identity', line: 1, value: email }];
  return [...hits, ...scanText(name).filter((h) => h.kind !== 'mail')];
}

/** One finding as `path:line kind`, with the value replaced by its length. */
export const formatFinding = ({ label, hit }) => `${label}:${hit.line} ${hit.kind} [redacted, ${hit.value.length} chars]`;

const isBinary = (path, bytes) => BINARY.has(extname(path).toLowerCase()) || bytes.subarray(0, 8000).includes(0);
const blobFindings = (label, path, bytes) => (isBinary(path, bytes) ? [] : scanText(bytes.toString('utf8')).map((hit) => ({ label, hit })));
const emptyResult = () => ({ files: 0, commits: 0, tags: 0, findings: [] });

function merge(into, add) {
  into.files += add.files;
  into.commits += add.commits;
  into.tags += add.tags;
  into.findings.push(...add.findings);
  return into;
}

function git(args, input) {
  const r = spawnSync('git', args, { input, maxBuffer: 1 << 30 });
  if (r.error) throw new Error(`git ${args.join(' ')} did not start`, { cause: r.error });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} exited ${r.status}: ${r.stderr.toString('utf8').trim()}`);
  return r.stdout;
}

const lines = (buf) => buf.toString('utf8').split('\n').filter(Boolean);
const objectExists = (oid) => spawnSync('git', ['cat-file', '-e', oid]).status === 0;
const short = (oid) => oid.slice(0, 7);

/** The content of each object id, read with one `git cat-file --batch`. */
function readObjects(oids) {
  const out = new Map();
  if (oids.length === 0) return out;
  const buf = git(['cat-file', '--batch'], `${oids.join('\n')}\n`);
  let pos = 0;
  while (pos < buf.length) {
    const end = buf.indexOf(0x0a, pos);
    const [oid, type, size] = buf.subarray(pos, end).toString('utf8').split(' ');
    if (type === 'missing') throw new Error(`git object ${oid} is missing`);
    out.set(oid, buf.subarray(end + 1, end + 1 + Number(size)));
    pos = end + 1 + Number(size) + 1;
  }
  return out;
}

/** The headers and the message of a raw commit or tag object. */
function parseObject(bytes) {
  const text = bytes.toString('utf8');
  const split = text.indexOf('\n\n');
  const head = split < 0 ? text : text.slice(0, split);
  const ident = (key) => {
    const line = head.split('\n').find((l) => l.startsWith(`${key} `));
    const m = line ? /^\S+ (.*) <([^>]*)> \d+ [+-]\d{4}$/.exec(line) : null;
    return m ? { name: m[1], email: m[2] } : null;
  };
  return { ident, message: split < 0 ? '' : text.slice(split + 2) };
}

function identityFindings(label, ident) {
  if (!ident) return [{ label, hit: { kind: 'identity', line: 1, value: '' } }];
  return checkIdentity(ident.name, ident.email).map((hit) => ({ label, hit }));
}

/** Every file on disk in `paths`, labelled relative to `root`. */
export function scanFiles(paths, root = process.cwd()) {
  const result = emptyResult();
  for (const path of paths) {
    result.files += 1;
    result.findings.push(...blobFindings(relative(root, resolve(root, path)), path, readFileSync(path)));
  }
  return result;
}

/** Every blob of the tree of `rev`: the content `git archive <rev>` packs. */
export function scanTree(rev) {
  const entries = git(['ls-tree', '-r', '-z', '--full-tree', rev])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf('\t');
      const [, type, oid] = entry.slice(0, tab).split(' ');
      return { type, oid, path: entry.slice(tab + 1) };
    })
    .filter((e) => e.type === 'blob');
  const blobs = readObjects([...new Set(entries.map((e) => e.oid))]);
  const result = emptyResult();
  for (const { oid, path } of entries) {
    result.files += 1;
    result.findings.push(...blobFindings(path, path, blobs.get(oid)));
  }
  return result;
}

/** One annotated tag object: its tagger identity and its message. */
export function scanTag(oid, name) {
  const tag = parseObject(readObjects([oid]).get(oid));
  return {
    ...emptyResult(),
    tags: 1,
    findings: [...identityFindings(`tag ${name} tagger`, tag.ident('tagger')), ...scanText(tag.message).map((hit) => ({ label: `tag ${name} message`, hit }))],
  };
}

/**
 * The commits that `git rev-list <revArgs>` lists: the author, the committer, the message and each
 * blob a commit adds or changes, so every tree in the range is covered. An annotated tag that points
 * at one of the commits is scanned too.
 */
export function scanCommits(revArgs) {
  const shas = lines(git(['rev-list', ...revArgs]));
  const result = { ...emptyResult(), commits: shas.length };
  const commits = readObjects(shas);
  const blobs = new Map();
  for (const sha of shas) {
    const commit = parseObject(commits.get(sha));
    result.findings.push(
      ...identityFindings(`commit ${short(sha)} author`, commit.ident('author')),
      ...identityFindings(`commit ${short(sha)} committer`, commit.ident('committer')),
      ...scanText(commit.message).map((hit) => ({ label: `commit ${short(sha)} message`, hit })),
    );
    const tokens = git(['diff-tree', '-r', '-m', '--root', '-z', '--no-commit-id', '--diff-filter=AMT', sha]).toString('utf8').split('\0');
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      const [, mode, , oid] = tokens[i].split(' ');
      if (mode !== '160000' && !blobs.has(oid)) blobs.set(oid, { path: tokens[i + 1], label: `${short(sha)}:${tokens[i + 1]}` });
    }
  }
  const contents = readObjects([...blobs.keys()]);
  for (const [oid, bytes] of contents) {
    const { path, label } = blobs.get(oid);
    result.files += 1;
    result.findings.push(...blobFindings(label, path, bytes));
  }
  const inRange = new Set(shas);
  for (const line of lines(git(['for-each-ref', 'refs/tags', '--format=%(objecttype) %(objectname) %(*objectname) %(refname:short)']))) {
    const [type, oid, target, name] = line.split(' ');
    if (type === 'tag' && inRange.has(target)) merge(result, scanTag(oid, name));
  }
  return result;
}

/** The newest `v*` tag that is an ancestor of the parent of `rev`, or null when there is none. */
export function lastTag(rev) {
  if (!objectExists(`${rev}^`)) return null;
  const r = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*', `${rev}^`]);
  if (r.status === 0) return r.stdout.toString('utf8').trim();
  const stderr = r.stderr.toString('utf8');
  if (/No names found|No tags can describe|cannot describe/.test(stderr)) return null;
  throw new Error(`git describe ${rev}^ exited ${r.status}: ${stderr.trim()}`);
}

/** The commits after the last `v*` tag before `rev`, up to `rev`. */
export function sinceTagRange(rev) {
  const tag = lastTag(rev);
  return tag ? [`${tag}..${rev}`] : [rev];
}

/** The author and committer identity that git uses for the next commit and tag. */
export function scanCurrentIdentity() {
  const result = emptyResult();
  for (const variable of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    const m = /^(.*) <([^>]*)>/.exec(git(['var', variable]).toString('utf8').trim());
    result.findings.push(...identityFindings(variable, m ? { name: m[1], email: m[2] } : null));
  }
  return result;
}

/**
 * The lines git gives a pre-push hook on stdin: `<local ref> <local oid> <remote ref> <remote oid>`.
 * Each pushed ref gets its new commits scanned, and a tag also gets its whole tree and tag object.
 */
export function scanPush(input, remote) {
  const result = emptyResult();
  const shas = new Set();
  const tags = [];
  for (const line of input.split('\n').filter(Boolean)) {
    const [, localOid, remoteRef, remoteOid] = line.split(' ');
    if (/^0+$/.test(localOid)) continue;
    const known = !/^0+$/.test(remoteOid) && objectExists(remoteOid);
    for (const sha of lines(git(['rev-list', ...(known ? [`${remoteOid}..${localOid}`] : [localOid, '--not', `--remotes=${remote}`])]))) shas.add(sha);
    if (!remoteRef.startsWith('refs/tags/')) continue;
    merge(result, scanTree(localOid));
    if (git(['cat-file', '-t', localOid]).toString('utf8').trim() === 'tag') tags.push({ oid: localOid, name: remoteRef.slice('refs/tags/'.length) });
  }
  if (shas.size) merge(result, scanCommits(['--no-walk', ...shas]));
  for (const { oid, name } of tags) if (!shas.has(git(['rev-parse', `${oid}^{commit}`]).toString('utf8').trim())) merge(result, scanTag(oid, name));
  return result;
}

/** Prints the result and returns the exit code: 0 with no hit, 1 with a hit. */
export function report(result, out = console.log) {
  const scope = `${result.files} files, ${result.commits} commits, ${result.tags} tags`;
  if (result.findings.length === 0) {
    out(`publish scan: ${scope}, no hit`);
    return 0;
  }
  out(`publish scan: refused, ${result.findings.length} hits in ${scope}`);
  for (const finding of result.findings) out(`  ${formatFinding(finding)}`);
  out(`publish scan: fix each hit at its source, or mark a synthetic sample line with "${ALLOW_MARKER}"`);
  return 1;
}

const USAGE = `usage: node scripts/scan.mjs [--tree <rev>] [--commits <range>] [--since-tag <rev>] [--identity] [--pre-push <remote>] [file ...]`;

function main(argv) {
  const result = emptyResult();
  const files = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v) throw new Error(`${arg} needs a value. ${USAGE}`);
      return v;
    };
    if (arg === '--tree') merge(result, scanTree(value()));
    else if (arg === '--commits') merge(result, scanCommits([value()]));
    else if (arg === '--since-tag') merge(result, scanCommits(sinceTagRange(value())));
    else if (arg === '--identity') merge(result, scanCurrentIdentity());
    else if (arg === '--pre-push') merge(result, scanPush(readFileSync(0, 'utf8'), value()));
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      return 0;
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}. ${USAGE}`);
    else files.push(arg);
  }
  if (files.length) merge(result, scanFiles(files));
  return report(result);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`publish scan: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
