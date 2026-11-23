// The `github` intake driver (spec 2.15.2). It runs only `gh issue view` and `gh auth token`. The
// token goes only into an HTTP header to a GitHub host: never into an argument list or a log line.
import { BaseDriver, LaunchwrightError } from '../../../kernel/index.mts';
import { mimeOfExtension } from '../../../index.mts';
import { type GhRunner, spawnGh } from '../../services/gh.mts';
import { isGithubMediaHost, mediaLinks, takesGithubToken } from '../../services/links.mts';
import { download, type FetchFn, kindOf, sourceOf } from '../../services/media.mts';
import { type IntakeBatch, QA_INTAKE_SPEC_VERSION, type QaIntakeDriver, type RawItem, type RawMedia } from './contract.mts';

/** The fields that `gh issue view --json` reads. */
export const ISSUE_FIELDS = 'number,title,body,author,labels,comments,createdAt,url,state';

export interface GithubIntakeOptions {
  /** The size cap of one file, in bytes. */
  maxBytes: number;
  gh?: GhRunner;
  fetch?: FetchFn;
}

interface GhAuthor {
  login?: string;
}

interface GhIssue {
  number: number;
  title: string;
  body: string;
  author: GhAuthor | null;
  createdAt: string;
  url: string;
  state: string;
  labels: { name: string }[];
  comments: { id?: string; author: GhAuthor | null; body: string; createdAt: string }[];
}

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
}

/** Reads `https://github.com/<owner>/<repo>/issues/<n>`. A pull request URL throws `qa.intake.github.not-issue`. */
export function parseIssueUrl(ref: string): IssueRef {
  const url = URL.canParse(ref) ? new URL(ref) : null;
  const m = url?.hostname === 'github.com' ? /^\/([\w.-]+)\/([\w.-]+)\/(issues|pull|pulls)\/(\d+)\/?$/.exec(url.pathname) : null;
  if (!m) {
    throw new LaunchwrightError('qa.intake.github.ref', 'The ref is not a GitHub issue URL: https://github.com/<owner>/<repo>/issues/<n>.', { context: { ref } });
  }
  if (m[3] !== 'issues') {
    throw new LaunchwrightError('qa.intake.github.not-issue', 'The URL is a pull request. lw qa intake github reads issues only.', { context: { ref } });
  }
  return { owner: m[1] as string, repo: m[2] as string, number: Number(m[4]) };
}

function viewFailure(stderr: string, ref: string): LaunchwrightError {
  const reason = stderr.trim().split('\n')[0]?.slice(0, 300) ?? '';
  if (/pull request/i.test(reason)) {
    return new LaunchwrightError('qa.intake.github.not-issue', 'The number is a pull request. lw qa intake github reads issues only.', { context: { ref } });
  }
  if (/gh auth login|authentication|not logged/i.test(reason)) {
    return new LaunchwrightError('qa.intake.github.auth', 'gh has no login. Run gh auth login.', { context: { ref, reason } });
  }
  if (/could not resolve|not found|HTTP 40[134]|not accessible|permission/i.test(reason)) {
    return new LaunchwrightError('qa.intake.github.access', 'The gh login cannot read this issue or its repository.', { context: { ref, reason } });
  }
  return new LaunchwrightError('qa.intake.github.gh', 'gh issue view failed.', { context: { ref, reason } });
}

export class GithubIntakeDriver extends BaseDriver implements QaIntakeDriver {
  readonly source = 'github' as const;
  private readonly gh: GhRunner;
  private readonly fetchFn: FetchFn;

  constructor(private readonly opts: GithubIntakeOptions) {
    super('github', QA_INTAKE_SPEC_VERSION, []);
    this.gh = opts.gh ?? spawnGh;
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  async fetch(ref: string): Promise<IntakeBatch> {
    parseIssueUrl(ref);
    const view = await this.gh(['issue', 'view', ref, '--json', ISSUE_FIELDS]);
    if (view.code !== 0) throw viewFailure(view.stderr, ref);
    let issue: GhIssue;
    try {
      issue = JSON.parse(view.stdout) as GhIssue;
    } catch (cause) {
      throw new LaunchwrightError('qa.intake.github.gh', 'gh issue view did not print JSON.', { cause, context: { ref } });
    }
    if (issue.url.includes('/pull/')) {
      throw new LaunchwrightError('qa.intake.github.not-issue', 'The number is a pull request. lw qa intake github reads issues only.', { context: { ref } });
    }
    const posts = [
      { id: 'body', author: issue.author, text: issue.body ?? '', at: issue.createdAt },
      ...(issue.comments ?? []).map((c, i) => ({ id: c.id ?? `comment-${i + 1}`, author: c.author, text: c.body ?? '', at: c.createdAt })),
    ];
    const needsToken = posts.some((p) => mediaLinks(p.text).length > 0);
    const token = needsToken ? await this.token() : null;
    const items: RawItem[] = [];
    for (const p of posts) {
      const media: RawMedia[] = [];
      for (const link of mediaLinks(p.text)) media.push(await this.media(link, token));
      items.push({ id: p.id, at: new Date(p.at).toISOString(), author: p.author?.login ?? 'ghost', text: p.text, media });
    }
    return { source: 'github', ref: issue.url, title: issue.title, items };
  }

  /** The token of the `gh` login, read from the child's stdout. */
  private async token(): Promise<string> {
    const res = await this.gh(['auth', 'token']);
    const token = res.stdout.trim();
    if (res.code !== 0 || token === '') {
      throw new LaunchwrightError('qa.intake.github.auth', 'gh auth token gave no token. Run gh auth login.');
    }
    return token;
  }

  private async media(link: string, token: string | null): Promise<RawMedia> {
    const name = new URL(link).pathname.split('/').pop() ?? '';
    const got = await download(link, {
      fetch: this.fetchFn,
      maxBytes: this.opts.maxBytes,
      name,
      allow: isGithubMediaHost,
      headersFor: (url): Record<string, string> => (token !== null && takesGithubToken(url) ? { authorization: `Bearer ${token}` } : {}),
    });
    const from = sourceOf(link);
    if ('skipped' in got) {
      const mime = mimeOfExtension(name) ?? 'application/octet-stream';
      return { from, kind: kindOf(mime), mime, ...(name ? { name } : {}), skipped: got.skipped };
    }
    return { from, kind: kindOf(got.mime), mime: got.mime, ...(name ? { name } : {}), data: got.data };
  }
}
