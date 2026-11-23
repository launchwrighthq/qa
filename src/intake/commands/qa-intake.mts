// `lw qa intake`: reads a GitHub issue or a Telegram chat into issue records (spec 2.15). Output
// names ids, counts and paths only: no reporter text, no reporter name, no token, no session.
import { relative } from 'node:path';
import { LaunchwrightError } from '../../kernel/index.mts';
import { parseCommandArgs, UsageError } from '../../kernel/services/args.mts';
import { INTAKE_DIR, listIssues, type QaCommandOptions, qaConfig, type QaSubcommand, recordDir, recordId, writeIssue } from '../../index.mts';
import { type IntakeConfig, qaIntakeConfig as intakeSchema } from '../config.mts';
import type { WindowBound } from '../drivers/intake/contract.mts';
import { createIntakeDriver, type IntakeDeps } from '../services/registry.mts';
import { applyGroups, proposeGroups, readCursor, stageBatch, writeCursor, writeProposal } from '../services/telegram.mts';

const USAGE = [
  'usage: lw qa intake github <issue-url>',
  '       lw qa intake telegram --chat <id> [--since <date|message-id>] [--until <date|message-id>] [--driver <d>] [--follow]',
  '       lw qa intake telegram --chat <id> --apply',
  '       lw qa intake list',
];

const TELEGRAM_DRIVERS = ['telegram-mtproto', 'telegram-bot', 'fake'];

function usage(opts: QaCommandOptions, problem?: string): number {
  if (problem) opts.err(`lw qa intake: ${problem}`);
  for (const line of USAGE) opts.err(line);
  return 2;
}

function intakeConfig(opts: QaCommandOptions): IntakeConfig {
  const section = qaConfig.safeParse(opts.config?.qa ?? {});
  const parsed = section.success ? intakeSchema.safeParse(section.data.intake) : section;
  if (!parsed.success) {
    const prefix = section.success ? 'qa.intake' : 'qa';
    const problems = parsed.error.issues.map((i) => `${[prefix, ...i.path].join('.')}: ${i.message}`).join('; ');
    throw new LaunchwrightError('qa.config', `Config section qa is not valid: ${problems}`);
  }
  return parsed.data;
}

/** A window bound: digits are a message id, anything else a date. */
function boundOf(flag: string, value: string): WindowBound {
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  if (Number.isNaN(at)) throw new LaunchwrightError('qa.intake.window', `${flag} takes a date (2026-11-01 or an ISO time) or a message id, not "${value}".`);
  return new Date(at);
}

interface TelegramArgs {
  chat?: string;
  since?: string;
  until?: string;
  driver?: string;
  follow: boolean;
  apply: boolean;
}

const TELEGRAM_VALUES = ['chat', 'since', 'until', 'driver'];

function parseTelegram(args: string[]): TelegramArgs | string {
  let parsed;
  try {
    parsed = parseCommandArgs({ values: TELEGRAM_VALUES, switches: ['follow', 'apply'] }, args);
  } catch (cause) {
    if (cause instanceof UsageError) return cause.message;
    throw cause;
  }
  const [extra] = parsed.positionals;
  if (extra !== undefined) return `unknown argument ${extra}`;
  return { ...parsed.values, follow: parsed.switches.has('follow'), apply: parsed.switches.has('apply') };
}

async function github(args: string[], opts: QaCommandOptions, deps: IntakeDeps): Promise<number> {
  if (args.length !== 1) return usage(opts, 'github takes one issue URL');
  const driver = await createIntakeDriver('github', intakeConfig(opts), deps);
  const batch = await driver.fetch(args[0] as string);
  const [body, ...comments] = batch.items;
  if (!body) throw new LaunchwrightError('qa.intake.github.gh', 'gh issue view gave no issue body.');
  const m = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/.exec(batch.ref);
  const id = m ? recordId('github', m[1] as string, m[2] as string, m[3] as string) : recordId('github', batch.ref);
  const issue = await writeIssue(opts.cwd, {
    id,
    source: 'github',
    ref: batch.ref,
    title: batch.title ?? id,
    reportedAt: body.at,
    reporter: body.author,
    text: body.text,
    thread: comments.map((c) => ({ at: c.at, author: c.author, text: c.text })),
    media: batch.items.flatMap((i) => i.media),
  });
  opts.out(`wrote ${issue.id}: ${issue.attachments.length} attachments, ${issue.skipped.length} skipped`);
  opts.out(`  ${relative(opts.cwd, recordDir(opts.cwd, issue.id))}/issue.md`);
  return 0;
}

/** The signal of a follow read: the command's signal, else Ctrl-C. */
function followSignal(opts: QaCommandOptions): { signal: AbortSignal; done: () => void } {
  if (opts.signal) return { signal: opts.signal, done: () => undefined };
  const ctl = new AbortController();
  const stop = (): void => ctl.abort();
  process.once('SIGINT', stop);
  return { signal: ctl.signal, done: () => process.off('SIGINT', stop) };
}

async function telegram(args: string[], opts: QaCommandOptions, deps: IntakeDeps): Promise<number> {
  const p = parseTelegram(args);
  if (typeof p === 'string') return usage(opts, p);
  if (p.chat === undefined) return usage(opts, 'telegram needs --chat <id>');
  const chat = p.chat;
  if (p.apply) {
    if (p.since !== undefined || p.until !== undefined || p.follow || p.driver !== undefined) return usage(opts, '--apply takes only --chat');
    const issues = await applyGroups(opts.cwd, chat);
    for (const issue of issues) opts.out(`wrote ${issue.id}: ${issue.attachments.length} attachments, ${issue.skipped.length} skipped`);
    opts.out(`${issues.length} records in ${INTAKE_DIR}`);
    return 0;
  }
  const intake = intakeConfig(opts);
  const name = p.driver ?? (TELEGRAM_DRIVERS.includes(intake.default) ? intake.default : 'telegram-mtproto');
  if (!TELEGRAM_DRIVERS.includes(name)) return usage(opts, `--driver takes ${TELEGRAM_DRIVERS.join(', ')}`);
  const driver = await createIntakeDriver(name, intake, deps);
  if (p.follow && !driver.supports('follow')) return usage(opts, `the ${name} driver cannot --follow; use --driver telegram-bot`);
  const since = p.since === undefined ? undefined : boundOf('--since', p.since);
  const until = p.until === undefined ? undefined : boundOf('--until', p.until);
  const cursor = since === undefined && driver.supports('cursor') ? await readCursor(opts.cwd, chat, name) : undefined;
  const follow = p.follow ? followSignal(opts) : undefined;
  if (follow) opts.out(`following chat ${chat}; stop with Ctrl-C`);
  let batch;
  try {
    batch = await driver.fetch(chat, {
      ...(since !== undefined ? { since } : {}),
      ...(until !== undefined ? { until } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
      ...(follow ? { follow: true, signal: follow.signal } : {}),
    });
  } finally {
    follow?.done();
  }
  const staged = await stageBatch(opts.cwd, chat, batch);
  if (batch.cursor !== undefined && driver.supports('cursor')) {
    const next = cursor !== undefined && Number(cursor) > Number(batch.cursor) ? cursor : batch.cursor;
    await writeCursor(opts.cwd, chat, name, next);
  }
  const groups = proposeGroups(chat, staged);
  const file = await writeProposal(opts.cwd, chat, groups);
  opts.out(`read ${batch.items.length} messages from chat ${chat} with ${name}; ${staged.length} staged`);
  opts.out(`proposed ${groups.length} groups: ${relative(opts.cwd, file)}`);
  opts.out(`review it, write groups.json beside it, then run: lw qa intake telegram --chat ${chat} --apply`);
  return 0;
}

async function list(args: string[], opts: QaCommandOptions): Promise<number> {
  if (args.length > 0) return usage(opts, 'list takes no arguments');
  const issues = await listIssues(opts.cwd);
  if (issues.length === 0) {
    opts.out(`no intake records in ${INTAKE_DIR}`);
    return 0;
  }
  const width = Math.max(...issues.map((i) => i.id.length));
  for (const i of issues) opts.out(`${i.id.padEnd(width)}  ${i.source.padEnd(8)}  ${String(i.attachments.length).padStart(3)}  ${i.title}`);
  return 0;
}

/** `lw qa intake` with replaceable drivers, runners and fetches. */
export function createIntakeCommand(deps: IntakeDeps = {}): QaSubcommand {
  return {
    name: 'intake',
    summary: 'read a GitHub issue or a Telegram chat into local issue records',
    async run(args, opts) {
      const [sub, ...rest] = args;
      try {
        if (sub === 'github') return await github(rest, opts, deps);
        if (sub === 'telegram') return await telegram(rest, opts, deps);
        if (sub === 'list') return await list(rest, opts);
      } catch (error) {
        if (!(error instanceof LaunchwrightError)) throw error;
        opts.err(`lw qa intake: ${error.message} (${error.code})`);
        return 1;
      }
      return usage(opts, sub === undefined || sub === '--help' || sub === '-h' ? undefined : `unknown subcommand ${sub}`);
    },
  };
}

export default createIntakeCommand();
