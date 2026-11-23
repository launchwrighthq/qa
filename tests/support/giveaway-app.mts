// A small project app for the synthetic checks of spec 3.3 (fork isolation, forged provenance). It
// keeps its data in PGlite, in the folder of config `db.dataDir`, so a fork is a folder copy. Its
// services hold one giveaway and one menu phase; its pages read them; `POST /__qa/session` signs a
// persona in with a cookie. It exports `qaApp` as config `qa.app` names it.
import { PGlite } from '@electric-sql/pglite';
import { type App, createApp, escapeHtml, jsonLogger, provider, token } from '../../src/kernel/index.mts';
import type { Db } from '../../src/services/peers.mts';
import type { QaAppEntry } from '../../src/world/services/app.mts';
import type { Fact, Persona, WorldRegistry } from '../../src/world/services/types.mts';

export interface Giveaway {
  id: string;
  title: string;
  takenBy: string | null;
}

/** The giveaway service. Only one giveaway exists, so only one persona can take it. */
export interface Giveaways {
  open(id: string, title: string): Promise<void>;
  /** Gives the id of the giveaway the persona took. Throws when no giveaway is open. */
  take(persona: string): Promise<string>;
  release(id: string): Promise<void>;
  current(): Promise<Giveaway | null>;
}

/** The menu service: the phase of the one menu. */
export interface Menu {
  set(phase: string): Promise<void>;
  get(): Promise<string | null>;
}

export const GIVEAWAYS = token<Giveaways>('fixture.giveaways');
export const MENU = token<Menu>('fixture.menu');
const PG = token<PGlite>('fixture.pg');

const SCHEMA = `
create table if not exists giveaway (id text primary key, title text not null, taken_by text);
create table if not exists menu (id integer primary key, phase text not null);
`;

function giveaways(pg: PGlite): Giveaways {
  return {
    async open(id, title) {
      await pg.query('insert into giveaway (id, title) values ($1, $2)', [id, title]);
    },
    async take(persona) {
      const { rows } = await pg.query<{ id: string }>('update giveaway set taken_by = $1 where taken_by is null returning id', [persona]);
      if (rows.length === 0) throw new Error('no giveaway is open');
      return (rows[0] as { id: string }).id;
    },
    async release(id) {
      await pg.query('update giveaway set taken_by = null where id = $1', [id]);
    },
    async current() {
      const { rows } = await pg.query<{ id: string; title: string; taken_by: string | null }>('select id, title, taken_by from giveaway order by id limit 1');
      const row = rows[0];
      return row ? { id: row.id, title: row.title, takenBy: row.taken_by } : null;
    },
  };
}

function menu(pg: PGlite): Menu {
  return {
    async set(phase) {
      await pg.query('insert into menu (id, phase) values (1, $1) on conflict (id) do update set phase = excluded.phase', [phase]);
    },
    async get() {
      const { rows } = await pg.query<{ phase: string }>('select phase from menu where id = 1');
      return rows[0]?.phase ?? null;
    },
  };
}

function page(id: string, lines: string[]): Response {
  const body = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
  const html = `<!doctype html><html><head><title>${id}</title><link rel="icon" href="data:,"></head><body style="margin:0;font:28px sans-serif;background:linear-gradient(90deg,#123,#4a7);color:#fff"><main id="${id}">${body}</main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function persona(request: Request): string {
  const match = /(?:^|;\s*)qa_persona=([a-z-]+)/.exec(request.headers.get('cookie') ?? '');
  return match?.[1] ?? 'nobody';
}

async function handle(app: App, request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/__qa/session') {
    const body = (await request.json()) as { persona?: unknown };
    if (typeof body.persona !== 'string' || !/^[a-z-]+$/.test(body.persona)) return new Response('bad persona', { status: 400 });
    return new Response('{}', { headers: { 'content-type': 'application/json', 'set-cookie': `qa_persona=${body.persona}; Path=/` } });
  }
  if (url.pathname === '/giveaway') {
    const g = await app.get(GIVEAWAYS).current();
    return page('giveaway', g ? [g.title, g.takenBy ? `taken by ${g.takenBy}` : 'open', `signed in as ${persona(request)}`] : ['no giveaway']);
  }
  if (url.pathname === '/menu') return page('menu', [`menu phase ${(await app.get(MENU).get()) ?? 'unknown'}`]);
  return new Response('not found', { status: 404 });
}

/** The app factory: PGlite in `db.dataDir`, the two services, and the schema on boot. */
export const qaApp: QaAppEntry = {
  tenantId: 'fixture',
  create(sections, env) {
    const dataDir = (sections.db as { dataDir?: string } | undefined)?.dataDir;
    if (!dataDir) throw new Error('the fixture app needs db.dataDir');
    const pg = new PGlite(dataDir);
    return createApp({
      env,
      config: {},
      logger: jsonLogger({ write: () => undefined }),
      providers: [
        provider({
          name: 'fixture',
          register(app) {
            app.instance(PG, pg);
            app.singleton(GIVEAWAYS, () => giveaways(pg));
            app.singleton(MENU, () => menu(pg));
          },
          async boot() {
            await pg.waitReady;
            await pg.exec(SCHEMA);
          },
          async shutdown() {
            await pg.close();
          },
        }),
      ],
    });
  },
  serve: (app) => ({ fetch: (request) => handle(app, request) }),
  db: (app): Db => ({
    execute: async (sql) => ({ rows: (await app.get(PG).query(sql)).rows }),
    close: async () => undefined,
  }),
};

/** One persona per row of the fork check. Their seeds never run: the test seeds the facts only. */
const personas: Persona[] = ['alice', 'bob'].map((id) => ({ id, summary: `the persona ${id}`, seed: async () => ({ userId: id }) }));

/** `giveaway-open` seeds the only giveaway; `giveaway-taken` arms it for the row's persona. */
const facts: Fact[] = [
  {
    id: 'giveaway-open',
    summary: 'One giveaway is open',
    handleKeys: ['giveawayId'],
    async seed(ctx) {
      await ctx.app.get(GIVEAWAYS).open('g1', 'Spring draw');
      return { giveawayId: 'g1' };
    },
  },
  {
    id: 'giveaway-taken',
    summary: 'The persona of the row took the only open giveaway',
    handleKeys: [],
    seed: async () => ({}),
    async arm(ctx) {
      const service = ctx.app.get(GIVEAWAYS);
      const open = await service.current();
      if (open === null || open.takenBy !== null) throw new Error('no giveaway is open');
      await ctx.record({ release: open.id });
      await service.take(ctx.persona?.persona ?? 'nobody');
    },
    async undo(ctx, step) {
      await ctx.app.get(GIVEAWAYS).release((step as { release: string }).release);
    },
  },
];

/** The world registry of the fixture app. */
export const registry: WorldRegistry = {
  personas: personas.map((p) => ({ ...p, feature: 'giveaway', file: 'giveaway.world.mts' })),
  facts: facts.map((f) => ({ ...f, feature: 'giveaway', file: 'giveaway.world.mts' })),
};
