// `lw qa comments serve|export|resolve <slug>` (spec 2.9, 2.10, R9, R10). `serve` starts a loopback
// server that serves the interactive viewer and a GET and POST comment store, so a reviewer adds
// comments in the browser. `export` resolves each open comment to its target, writes the crop of each
// region comment and prints an agent task list. `resolve` marks one comment resolved in the store.
import { basename, isAbsolute, join, resolve } from 'node:path';
import { isCodedError, LaunchwrightError, systemClock } from '../kernel/index.mts';
import { qaConfigOf } from '../config.mts';
import { legDefinitions } from '../services/legs.mts';
import { startCommentServer } from '../services/comment-server.mts';
import { exportTaskList, writeRegionCrops } from '../services/comment-export.mts';
import { type Comment, COMMENTS_DIR, commentsFile, fileCommentStore, replyToComment, setStatus } from '../services/comments.mts';
import { loadViewerInput, renderViewerBundle, viewerDirName } from '../services/viewer.mts';
import { parseArgs, processSignal } from '../world/services/context.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa comments <serve|export|resolve> <slug> [options]',
  '  serve <slug> [--port <n>]                 serve the viewer and the comment store on 127.0.0.1',
  '  export <slug>                             print the agent task list of the open comments, with region crops',
  '  resolve <slug> <id> [--reply <text>]      mark comment <id> resolved, after an optional reply',
];

/** The author of a reply that `resolve` writes. */
const RESOLVER = 'agent';

/** The leg names of the project config, so a plan with a custom leg validates. */
function legNames(opts: QaCommandOptions): string[] {
  return legDefinitions(qaConfigOf(opts.config)).map((l) => l.name);
}

/** The report file of a slug or a path, and its slug. */
function reportOf(arg: string, opts: QaCommandOptions): { md: string; slug: string } {
  if (arg.endsWith('.md') || arg.includes('/')) {
    const md = isAbsolute(arg) ? arg : resolve(opts.cwd, arg);
    return { md, slug: basename(md).replace(/\.md$/, '') };
  }
  const root = qaConfigOf(opts.config).reportDir;
  const reportDir = isAbsolute(root) ? root : resolve(opts.cwd, root);
  return { md: join(reportDir, `${arg}.md`), slug: arg };
}

function port(option: string | true | undefined): number | undefined {
  if (option === undefined) return undefined;
  const n = Number(option);
  if (typeof option !== 'string' || !/^\d+$/.test(option) || n > 65535) {
    throw new LaunchwrightError('qa.comments.usage', `--port must be an integer from 0 (a free port) to 65535, not ${String(option)}.`);
  }
  return n;
}

async function serve(arg: string, chosen: number | undefined, opts: QaCommandOptions): Promise<number> {
  const { md, slug } = reportOf(arg, opts);
  const { input, reportDir } = await loadViewerInput(md, { legs: legNames(opts) });
  const store = fileCommentStore(join(opts.cwd, COMMENTS_DIR));
  const viewerDir = `dist/${viewerDirName(slug)}`;
  const renderPages = (comments: readonly Comment[]): Map<string, string> => renderViewerBundle({ ...input, comments }, {}).pages;
  const server = await startCommentServer({ reportDir, viewerDir, slug, store, renderPages, clock: systemClock, ...(chosen === undefined ? {} : { port: chosen }) });
  const stop = processSignal(opts.signal);
  try {
    opts.out(server.indexUrl);
    opts.err(`lw qa comments serve: ${slug} on ${server.url}, store ${COMMENTS_DIR}/${slug}.json; Ctrl-C stops it`);
    if (!stop.signal.aborted) await new Promise<void>((resolve) => stop.signal.addEventListener('abort', () => resolve(), { once: true }));
  } finally {
    stop.dispose();
    await server.close();
  }
  return 0;
}

async function exportComments(arg: string, opts: QaCommandOptions): Promise<number> {
  const { md, slug } = reportOf(arg, opts);
  const { input, reportDir } = await loadViewerInput(md, { legs: legNames(opts) });
  const comments = await fileCommentStore(join(opts.cwd, COMMENTS_DIR)).read(slug);
  const ctx = { manifest: input.manifest, entries: input.entries };
  const crops = await writeRegionCrops(comments, ctx, { reportDir, cropDir: join(opts.cwd, COMMENTS_DIR, slug), root: opts.cwd });
  const list = exportTaskList(comments, { ...ctx, crops });
  for (const line of list.split('\n')) opts.out(line);
  return 0;
}

async function resolveComment(arg: string, id: string, reply: string | undefined, opts: QaCommandOptions): Promise<number> {
  const { slug } = reportOf(arg, opts);
  const store = fileCommentStore(join(opts.cwd, COMMENTS_DIR));
  let list = await store.read(slug);
  if (reply !== undefined) list = replyToComment(list, id, { author: RESOLVER, body: reply, createdAt: systemClock.date().toISOString() });
  list = setStatus(list, id, 'resolved');
  await store.write(slug, list);
  opts.out(`lw qa comments resolve: ${id} resolved${reply === undefined ? '' : ' with a reply'} in ${commentsFile(COMMENTS_DIR, slug)}`);
  return 0;
}

const comments: QaSubcommand = {
  name: 'comments',
  summary: 'Serve reviewer comments and export the agent task list of the open ones',
  async run(args: string[], opts: QaCommandOptions): Promise<number> {
    const [verb, ...rest] = args;
    const { words, options } = parseArgs(rest, ['help'], ['port', 'reply']);
    if (verb === undefined || verb === '--help' || verb === '-h' || options.help === true) {
      for (const line of USAGE) opts.err(line);
      return verb === undefined ? 2 : 0;
    }
    const [slug, id, extra] = words;
    const wantsId = verb === 'resolve';
    const reply = typeof options.reply === 'string' ? options.reply : undefined;
    const known = verb === 'serve' || verb === 'export' || verb === 'resolve';
    if (!known || slug === undefined || (wantsId ? id === undefined || extra !== undefined : id !== undefined) || (options.reply !== undefined && (!wantsId || reply === undefined))) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    try {
      if (verb === 'serve') return await serve(slug, port(options.port), opts);
      if (verb === 'resolve') return await resolveComment(slug, id as string, reply, opts);
      return await exportComments(slug, opts);
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa comments ${verb}: ${cause.code}: ${cause.message}`);
      return 1;
    }
  },
};

export default comments;
