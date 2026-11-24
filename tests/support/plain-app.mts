// A project app that uses no framework module, for the world tests of a plain consumer. Its data is
// PGlite in config `db.dataDir`. The schema, the base seed and the persona sign-in identities come
// from the `QaAppEntry` hooks, so `lw qa world reset` needs no db and no auth module. Its boot
// creates no table: a reset that skips `migrate` leaves a world that the first query refuses.
import { PGlite } from '@electric-sql/pglite';
import { createApp, escapeHtml, jsonLogger, provider, token } from '../../src/kernel/index.mts';
import type { Db } from '../../src/services/peers.mts';
import type { QaAppEntry, QaDatabaseContext } from '../../src/world/services/app.mts';
import type { Fact, Persona, WorldRegistry } from '../../src/world/services/types.mts';

const PG = token<PGlite>('plain.pg');

const SCHEMA = `
create table account (id text primary key, name text not null);
create table identity (subject text primary key, user_id text not null references account (id));
create table board (id text primary key, claimed_by text);
create table seed_run (name text primary key);
`;

function dataDir(sections: Record<string, unknown>): string {
  const dir = (sections.db as { dataDir?: string } | undefined)?.dataDir;
  if (!dir) throw new Error('the plain app needs db.dataDir');
  return dir;
}

async function withPg<T>(ctx: QaDatabaseContext, fn: (pg: PGlite) => Promise<T>): Promise<T> {
  const pg = new PGlite(dataDir(ctx.sections));
  try {
    return await fn(pg);
  } finally {
    await pg.close();
  }
}

function page(id: string, lines: string[]): Response {
  const body = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
  return new Response(`<!doctype html><html><head><title>${id}</title><link rel="icon" href="data:,"></head><body><main id="${id}">${body}</main></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function signedIn(request: Request): string {
  return /(?:^|;\s*)sid=([a-z0-9-]+)/.exec(request.headers.get('cookie') ?? '')?.[1] ?? 'nobody';
}

async function handle(pg: PGlite, request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/__qa/session') {
    const { persona } = (await request.json()) as { persona?: string };
    const { rows } = await pg.query<{ user_id: string }>('select user_id from identity where subject = $1', [`qa:${persona ?? ''}`]);
    const userId = rows[0]?.user_id;
    if (userId === undefined) return new Response('unseeded persona', { status: 404 });
    return Response.json({ persona, userId }, { headers: { 'set-cookie': `sid=${userId}; Path=/` } });
  }
  if (url.pathname === '/board') {
    const { rows } = await pg.query<{ claimed_by: string | null }>('select claimed_by from board order by id limit 1');
    const board = rows[0];
    return page('board', [board ? (board.claimed_by ? `claimed by ${board.claimed_by}` : 'board open') : 'no board', `signed in as ${signedIn(request)}`]);
  }
  return new Response('not found', { status: 404 });
}

export const qaApp: QaAppEntry = {
  tenantId: 'plain',
  create(sections, env) {
    const pg = new PGlite(dataDir(sections));
    return createApp({
      env,
      config: {},
      logger: jsonLogger({ write: () => undefined }),
      providers: [
        provider({
          name: 'plain',
          register: (app) => app.instance(PG, pg),
          boot: async () => {
            await pg.waitReady;
          },
          shutdown: () => pg.close(),
        }),
      ],
    });
  },
  serve: (app) => ({ fetch: (request) => handle(app.get(PG), request) }),
  db: (app): Db => ({
    execute: async (sql) => ({ rows: (await app.get(PG).query(sql)).rows }),
    close: async () => undefined,
  }),
  async migrate(ctx) {
    await withPg(ctx, (pg) => pg.exec(SCHEMA));
  },
  async seed(ctx, names) {
    await withPg(ctx, async (pg) => {
      for (const name of names) await pg.query('insert into seed_run (name) values ($1)', [name]);
    });
  },
  async linkPersona(world, link) {
    const pg = world.app.get(PG);
    const userId = link.userId ?? `user-${link.persona}`;
    await pg.query('insert into account (id, name) values ($1, $2) on conflict (id) do nothing', [userId, link.persona]);
    await pg.query('insert into identity (subject, user_id) values ($1, $2)', [link.accountId, userId]);
    return userId;
  },
};

/** `reader` makes its own user; `writer` leaves the user to `linkPersona`. */
const personas: Persona[] = [
  {
    id: 'reader',
    summary: 'A persona whose seed makes its user',
    async seed(ctx) {
      await ctx.app.get(PG).query("insert into account (id, name) values ('user-r1', 'reader')");
      return { userId: 'user-r1' };
    },
  },
  { id: 'writer', summary: 'A persona that linkPersona makes', seed: async () => ({ userId: '' }) },
];

const facts: Fact[] = [
  {
    id: 'board-open',
    summary: 'One board is open',
    handleKeys: ['boardId'],
    async seed(ctx) {
      await ctx.app.get(PG).query("insert into board (id) values ('b1')");
      return { boardId: 'b1' };
    },
  },
  {
    id: 'board-claimed',
    summary: 'The persona of the row claimed the only board',
    handleKeys: [],
    seed: async () => ({}),
    async arm(ctx) {
      await ctx.record({ release: 'b1' });
      await ctx.app.get(PG).query("update board set claimed_by = $1 where id = 'b1'", [ctx.persona?.persona ?? 'nobody']);
    },
    async undo(ctx, step) {
      await ctx.app.get(PG).query('update board set claimed_by = null where id = $1', [(step as { release: string }).release]);
    },
  },
];

/** The world of the plain app, as its `board.world.mts` file exports it. */
export const plainWorld = { personas, facts };

/** The registry of the plain app, for a test that skips the file discovery. */
export const registry: WorldRegistry = {
  personas: personas.map((p) => ({ ...p, feature: 'board', file: 'board.world.mts' })),
  facts: facts.map((f) => ({ ...f, feature: 'board', file: 'board.world.mts' })),
};
