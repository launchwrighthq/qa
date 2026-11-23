// `lw qa intake`: GitHub and Telegram records, the review step, the cursor, the listing, and the
// privacy rule of R27 (no chat text, name, token or session outside `.lw/qa/intake/`).
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it, vi } from 'vitest';
import { createIntakeCommand } from '../../../../src/intake/commands/qa-intake.mts';
import type { QaCommandOptions } from '../../../../src/index.mts';
import { FakeIntakeDriver } from '../../../../src/intake/drivers/intake/fake.mts';
import type { IntakeDeps } from '../../../../src/intake/services/registry.mts';
import { recordedGh, recordedGramJs } from '../../../../src/intake/testing/index.mts';
import { CHAT, FIXTURE_NAMES, FIXTURE_TEXTS, GH_FILE, GH_TOKEN, githubFetch, GRAMJS_FILE, ISSUE_URL, SESSION } from '../../../support/intake.mts';

interface Run {
  code: number;
  out: string[];
  err: string[];
}

function config(): Record<string, unknown> {
  return { qa: { intake: { default: 'github', drivers: { 'telegram-mtproto': { apiId: '12345', apiHash: 'fixture-api-hash', session: SESSION } } } } };
}

async function run(root: string, args: string[], deps: IntakeDeps = {}, extra: Partial<QaCommandOptions> = {}): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await createIntakeCommand(deps).run(args, { cwd: root, out: (l) => out.push(l), err: (l) => err.push(l), config: config(), ...extra });
  return { code, out, err };
}

async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await filesUnder(path)));
    else out.push(path);
  }
  return out;
}

const mtproto = (): IntakeDeps => ({ loadGramJs: recordedGramJs(GRAMJS_FILE).loader });

describe('lw qa intake github', () => {
  it('writes the record with the downloads and prints only the id, counts and path', async () => {
    const root = await tmpDir();
    const r = await run(root, ['github', ISSUE_URL], { gh: recordedGh(GH_FILE), fetch: githubFetch().fetch });
    expect(r).toEqual({
      code: 0,
      out: ['wrote github-acme-test-widget-42: 3 attachments, 2 skipped', '  .lw/qa/intake/github-acme-test-widget-42/issue.md'],
      err: [],
    });
    const issue = JSON.parse(await readFile(join(root, '.lw/qa/intake/github-acme-test-widget-42/issue.json'), 'utf8'));
    expect(issue).toMatchObject({ source: 'github', ref: ISSUE_URL, reporter: 'fixture-reporter', reportedAt: '2026-11-10T09:00:00.000Z' });
    expect(issue.thread).toHaveLength(2);
    expect(issue.attachments.map((a: { path: string }) => a.path)).toEqual(['assets/01-1b2c3d4e-0000-4000-8000-000000000001.png', 'assets/02-1b2c3d4e-0000-4000-8000-000000000002.mp4', 'assets/03-legacy-shot.gif']);
    expect(issue.skipped.map((s: { reason: string }) => s.reason)).toEqual(['too-large', 'unreachable']);
  });

  it('exits 1 with the code for a pull request URL and an unreadable repository', async () => {
    const root = await tmpDir();
    const pr = await run(root, ['github', 'https://github.com/acme-test/widget/pull/5'], { gh: recordedGh(GH_FILE) });
    expect(pr.code).toBe(1);
    expect(pr.err[0]).toContain('(qa.intake.github.not-issue)');
    const denied = await run(root, ['github', 'https://github.com/acme-test/private/issues/7'], { gh: recordedGh(GH_FILE) });
    expect(denied.code).toBe(1);
    expect(denied.err[0]).toContain('(qa.intake.github.access)');
  });
});

describe('lw qa intake telegram', () => {
  it('stages the chat, proposes groups, keeps the cursor, and applies the reviewed groups', async () => {
    const root = await tmpDir();
    const first = await run(root, ['telegram', '--chat', CHAT], mtproto());
    expect(first).toEqual({
      code: 0,
      out: [
        `read 7 messages from chat ${CHAT} with telegram-mtproto; 7 staged`,
        `proposed 3 groups: .lw/qa/intake/telegram/${CHAT}/groups.proposed.json`,
        `review it, write groups.json beside it, then run: lw qa intake telegram --chat ${CHAT} --apply`,
      ],
      err: [],
    });
    expect(JSON.parse(await readFile(join(root, `.lw/qa/intake/telegram/${CHAT}.cursor`), 'utf8'))).toEqual({ 'telegram-mtproto': '208' });
    const proposed = JSON.parse(await readFile(join(root, `.lw/qa/intake/telegram/${CHAT}/groups.proposed.json`), 'utf8'));
    expect(proposed.groups.map((g: { messages: string[] }) => g.messages)).toEqual([['201', '202', '204', '205'], ['206'], ['207', '208']]);

    const second = await run(root, ['telegram', '--chat', CHAT], mtproto());
    expect(second.out[0]).toBe(`read 0 messages from chat ${CHAT} with telegram-mtproto; 7 staged`);

    const noGroups = await run(root, ['telegram', '--chat', CHAT, '--apply']);
    expect(noGroups.code).toBe(1);
    expect(noGroups.err[0]).toContain('(qa.intake.telegram.groups)');

    await copyFile(join(root, `.lw/qa/intake/telegram/${CHAT}/groups.proposed.json`), join(root, `.lw/qa/intake/telegram/${CHAT}/groups.json`));
    const applied = await run(root, ['telegram', '--chat', CHAT, '--apply']);
    expect(applied.out).toEqual([
      'wrote tg--1001234567890-201: 3 attachments, 0 skipped',
      'wrote tg--1001234567890-206: 0 attachments, 1 skipped',
      'wrote tg--1001234567890-207: 0 attachments, 1 skipped',
      '3 records in .lw/qa/intake',
    ]);

    const list = await run(root, ['list']);
    expect(list.out).toEqual([
      'tg--1001234567890-201  telegram    3  Telegram report -1001234567890/201 (4 messages)',
      'tg--1001234567890-206  telegram    0  Telegram report -1001234567890/206 (1 message)',
      'tg--1001234567890-207  telegram    0  Telegram report -1001234567890/207 (2 messages)',
    ]);
  });

  it('reads with --since and --until and takes --driver', async () => {
    const root = await tmpDir();
    const r = await run(root, ['telegram', '--chat', CHAT, '--since', '204', '--until', '2026-11-02T08:10:00Z'], mtproto());
    expect(r.out[0]).toBe(`read 2 messages from chat ${CHAT} with telegram-mtproto; 2 staged`);
    const fake = await run(await tmpDir(), ['telegram', '--chat', '-1001', '--driver', 'fake']);
    expect(fake.out[0]).toBe('read 6 messages from chat -1001 with fake; 6 staged');
  });

  it('follows with the command signal until it aborts', async () => {
    const root = await tmpDir();
    const ctl = new AbortController();
    const driver = new FakeIntakeDriver({ items: [], arriving: [{ id: '9', at: '2026-11-03T00:00:00.000Z', author: 'a', text: 't', media: [] }] });
    const pending = run(root, ['telegram', '--chat', '-1001', '--driver', 'fake', '--follow'], { drivers: { fake: driver } }, { signal: ctl.signal });
    ctl.abort();
    const r = await pending;
    expect(r.out.slice(0, 2)).toEqual(['following chat -1001; stop with Ctrl-C', 'read 1 messages from chat -1001 with fake; 1 staged']);
  });

  it('refuses --follow on a driver that cannot follow, and bad arguments', async () => {
    const root = await tmpDir();
    expect((await run(root, ['telegram', '--chat', CHAT, '--follow'], mtproto())).code).toBe(2);
    expect((await run(root, ['telegram'])).code).toBe(2);
    expect((await run(root, ['telegram', '--chat'])).code).toBe(2);
    expect((await run(root, ['telegram', '--chat', CHAT, '--apply', '--since', '1'])).code).toBe(2);
    expect((await run(root, ['telegram', '--chat', CHAT, '--driver', 'github'])).code).toBe(2);
    const bad = await run(root, ['telegram', '--chat', CHAT, '--since', 'yesterday-ish'], mtproto());
    expect(bad.code).toBe(1);
    expect(bad.err[0]).toContain('(qa.intake.window)');
    expect((await run(root, ['nope'])).code).toBe(2);
    expect((await run(root, [])).code).toBe(2);
  });
});

describe('lw qa intake list', () => {
  it('says when there is no record', async () => {
    expect((await run(await tmpDir(), ['list'])).out).toEqual(['no intake records in .lw/qa/intake']);
  });
});

describe('intake privacy (R27, A3)', () => {
  it('keeps chat text, names, the token and the session out of output, logs and files outside .lw/qa/intake', async () => {
    const root = await tmpDir();
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs', 'readme.md'), '# project\n');
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'debug')];
    const gh = recordedGh(GH_FILE);
    const runs: Run[] = [];
    runs.push(await run(root, ['github', ISSUE_URL], { gh, fetch: githubFetch().fetch }));
    runs.push(await run(root, ['telegram', '--chat', CHAT], mtproto()));
    await copyFile(join(root, `.lw/qa/intake/telegram/${CHAT}/groups.proposed.json`), join(root, `.lw/qa/intake/telegram/${CHAT}/groups.json`));
    runs.push(await run(root, ['telegram', '--chat', CHAT, '--apply']));
    runs.push(await run(root, ['list']));
    runs.push(await run(root, ['github', 'https://github.com/acme-test/private/issues/7'], { gh }));
    const printed = [...runs.flatMap((r) => [...r.out, ...r.err]), ...logs.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(' ')))].join('\n');
    expect([...FIXTURE_TEXTS, ...FIXTURE_NAMES, SESSION, GH_TOKEN].filter((s) => printed.includes(s))).toEqual([]);

    const files = await filesUnder(root);
    expect(files.length).toBeGreaterThan(5);
    const leaks: string[] = [];
    for (const file of files) {
      const rel = relative(root, file);
      const text = await readFile(file, 'utf8');
      const banned = rel.startsWith('.lw/qa/intake/') ? [SESSION, GH_TOKEN] : [SESSION, GH_TOKEN, ...FIXTURE_TEXTS, ...FIXTURE_NAMES];
      leaks.push(...banned.filter((s) => text.includes(s)).map((s) => `${rel}: ${s}`));
    }
    expect(leaks).toEqual([]);
    expect(files.filter((f) => !relative(root, f).startsWith('.lw/qa/intake/')).map((f) => relative(root, f))).toEqual(['docs/readme.md']);

    for (const args of gh.calls) expect(['issue view', 'auth token']).toContain(args.slice(0, 2).join(' '));
  });
});
