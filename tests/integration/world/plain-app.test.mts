// The QA world of an app without the framework db, auth and http modules: `lw qa world reset` and
// `status` run through the `QaAppEntry` hooks, a persona row signs in through the app's own
// `/__qa/session`, and a fork group copies the seeded snapshot that the reset wrote.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { qaCommand } from '../../../src/commands/qa.command.mts';
import { qaConfig } from '../../../src/config.mts';
import { systemClock } from '../../../src/kernel/index.mts';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { optionalDb, optionalHttp } from '../../../src/services/peers.mts';
import { runManifest, type RunSummary } from '../../../src/services/runner.mts';
import { createTargetRegistry } from '../../../src/services/targets.mts';
import { type Listening, listenQaApp } from '../../../src/world/services/api.mts';
import { openWorld, type QaWorld } from '../../../src/world/services/app.mts';
import { worldForkRunner } from '../../../src/world/services/fork-server.mts';
import { pgliteAdmin, pgliteDir } from '../../../src/world/services/stack.mts';
import { readStamp } from '../../../src/world/services/world.mts';
import { useBrowserCache } from '../../support/chromium.mts';
import { textTarget } from '../../support/page-text.mts';
import { qaApp, registry } from '../../support/plain-app.mts';

const APP = fileURLToPath(new URL('../../support/plain-app.mts', import.meta.url));
const DATABASE = 'plain_qa';
const SLUG = '2026-11-24-plain';
const SECTIONS = { db: { driver: 'pglite' }, qa: { database: DATABASE, app: APP, seed: 'base extra' } };
const base = { screen: 'board', source: ['spec:docs/specs/qa.md#R3'], legs: ['web'], route: '/board', settle: { selector: '#board' } };

let root: string;

async function lw(args: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await qaCommand.run(args, { cwd: root, out: (l) => out.push(l), err: (l) => err.push(l), config: SECTIONS });
  return { code, out, err };
}

/** Reads rows of the QA database folder while no app holds it. */
async function rows<T>(sql: string): Promise<T[]> {
  const pg = new PGlite(pgliteDir(root, DATABASE));
  try {
    return (await pg.query<T>(sql)).rows;
  } finally {
    await pg.close();
  }
}

beforeEach(() => useBrowserCache());

beforeAll(async () => {
  root = await tmpDir();
  await mkdir(join(root, 'qa'), { recursive: true });
  await writeFile(join(root, 'qa/board.world.mts'), `export { plainWorld as default } from ${JSON.stringify(pathToFileURL(APP).href)};\n`);
});

describe('the QA world of an app without the framework modules', () => {
  it('runs with no framework package installed', async () => {
    expect(await optionalDb()).toBeUndefined();
    expect(await optionalHttp()).toBeUndefined();
  });

  it('reports a missing world before the first reset', async () => {
    const { code, out } = await lw(['world', 'status', '--json']);
    expect(code).toBe(1);
    expect(JSON.parse(out.join('\n'))).toMatchObject({ database: DATABASE, exists: false, state: 'missing' });
  });

  it('resets through migrate, seed and linkPersona, and writes the seeded snapshot', async () => {
    const { code, out, err } = await lw(['world', 'reset']);
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(out).toContain(`migrated ${DATABASE} through qaApp.migrate`);
    expect(out).toContain('base seed through qaApp.seed: base, extra');
    expect(out).toContain(`snapshot ${DATABASE}_fork__seeded: each fork copies it`);
    expect(await pgliteAdmin(root, () => true).list(`${DATABASE}_fork_`)).toEqual([`${DATABASE}_fork__seeded`]);
    expect(await rows<{ name: string }>('select name from seed_run order by name')).toEqual([{ name: 'base' }, { name: 'extra' }]);
    expect(await rows('select subject, user_id from identity order by subject')).toEqual([
      { subject: 'qa:reader', user_id: 'user-r1' },
      { subject: 'qa:writer', user_id: 'user-writer' },
    ]);
    const stamp = await readStamp(root);
    expect(stamp === null || stamp === 'unreadable' ? [] : stamp.entries.filter((e) => e.kind === 'persona').map((e) => [e.id, e.handles?.userId])).toEqual([
      ['reader', 'user-r1'],
      ['writer', 'user-writer'],
    ]);
  });

  it('reports the reset world as current', async () => {
    const { code, out } = await lw(['world', 'status', '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(out.join('\n'))).toMatchObject({ database: DATABASE, exists: true, state: 'current' });
  });
});

describe('a pass on the plain world', () => {
  let shared: QaWorld;
  let api: Listening;
  let summary: RunSummary;
  let texts: Map<string, string>;
  const forkLines: string[] = [];

  beforeAll(async () => {
    const stamp = await readStamp(root);
    if (stamp === null || stamp === 'unreadable') throw new Error('the reset test above wrote no stamp');
    const overlay = { root, database: DATABASE, telegramUrl: 'http://127.0.0.1:9102', registryHash: stamp.hash };
    shared = await openWorld(qaApp, SECTIONS, 'local', overlay);
    // The default listen: with no http module it serves on node:http.
    api = await listenQaApp(qaApp.serve(shared.app), shared.app, 0);
    const config = qaConfig.parse({
      apiPort: api.port,
      baseUrls: { web: `http://127.0.0.1:${api.port}` },
      legs: { web: { surface: 'web', target: 'playwright', viewport: { width: 640, height: 360 } } },
    });
    const plan = join(root, `${SLUG}.shots.json`);
    const shots = [
      { ...base, id: 'board.reader', state: 'open', fixture: { persona: 'reader', arm: [] }, expect: 'the reader sees the open board' },
      { ...base, id: 'board.writer', state: 'claimed', fixture: { persona: 'writer', arm: ['board-claimed'] }, fork: 'writer', expect: 'the writer claimed the board' },
    ];
    await writeFile(plan, JSON.stringify({ title: 'plain world', generated: '2026-11-24T00:00:00Z', shots }));
    const chromium = textTarget();
    texts = chromium.texts;
    summary = await runManifest(
      { manifestPath: plan },
      {
        config,
        targets: createTargetRegistry(config, { playwright: chromium.target }),
        clock: systemClock,
        baseUrls: config.baseUrls,
        revision: { commit: 'c'.repeat(40), dirty: false },
        fork: worldForkRunner({ root, sections: SECTIONS, env: 'local', overlay, entry: qaApp, registry, out: (l) => forkLines.push(l) }),
        signals: { on: () => undefined, off: () => undefined },
        out: () => undefined,
        err: () => undefined,
      },
    );
  });

  afterAll(async () => {
    await api?.close();
    await shared?.close();
  });

  const textOf = (row: string): string => texts.get(join(root, `assets/${SLUG}/web-${row}.png`)) ?? '';

  it('passes both rows', () => {
    expect(summary.results.map((r) => [r.row, r.status]).sort()).toEqual([
      ['board.reader', 'passed'],
      ['board.writer', 'passed'],
    ]);
    expect(summary.exitCode).toBe(0);
  });

  it('signs each persona in as the user that the reset linked', () => {
    expect(textOf('board.reader')).toContain('signed in as user-r1');
    expect(textOf('board.writer')).toContain('signed in as user-writer');
  });

  it('arms the fork group on a copy of the seeded snapshot and leaves the shared world open', async () => {
    expect(forkLines).toContain(`forking ${DATABASE}_fork__seeded to ${DATABASE}_fork_writer`);
    expect(textOf('board.writer')).toContain('claimed by writer');
    expect(textOf('board.reader')).toContain('board open');
    expect(await pgliteAdmin(root, () => true).list(`${DATABASE}_fork_`)).toEqual([`${DATABASE}_fork__seeded`]);
    expect(JSON.parse(await readFile(join(root, '.lw/qa/world.json'), 'utf8'))).toMatchObject({ database: DATABASE });
  });
});
