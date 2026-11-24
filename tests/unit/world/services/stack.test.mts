import { join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaFakeBots, qaFakeToken, qaSections } from '../../../../src/world/services/app.mts';
import {
  assertQaTarget,
  databaseName,
  pgAdmin,
  pgliteAdmin,
  pgliteDir,
  qaDbSection,
  qaTargetProblem,
  urlWithDatabase,
} from '../../../../src/world/services/stack.mts';

const ROOT = '/srv/project';
/** A database on a private address (RFC 1918), off this machine. */
const REMOTE_DB = 'postgres://lw@10.0.0.5/app'; // publish-audit: allow
const DEV = 'postgres://lw:secret@127.0.0.1:5432/app?sslmode=disable';

describe('qaTargetProblem', () => {
  it('accepts the QA database on a loopback host', () => {
    expect(qaTargetProblem({ url: 'postgres://lw:secret@localhost:5432/app_qa' }, 'app_qa', ROOT)).toBeNull();
    expect(qaTargetProblem({ url: 'postgresql://lw@[::1]:5432/app_qa' }, 'app_qa', ROOT)).toBeNull();
  });

  it('refuses a host that is not this machine and names the host, never the password', () => {
    const problem = qaTargetProblem({ url: 'postgres://lw:secret@db.example.com:5432/app_qa' }, 'app_qa', ROOT);
    expect(problem).toMatch(/host db\.example\.com is not this machine/);
    expect(problem).not.toMatch(/secret/);
  });

  it('refuses the dev database, which differs by its name alone', () => {
    expect(qaTargetProblem({ url: DEV }, 'app_qa', ROOT)).toMatch(/database app is not app_qa/);
  });

  it('refuses a URL that is not a postgres URL', () => {
    expect(qaTargetProblem({ url: 'mysql://127.0.0.1/app_qa' }, 'app_qa', ROOT)).toMatch(/mysql is not a postgres URL/);
  });

  it('accepts only the PGlite folder of the QA database', () => {
    expect(qaTargetProblem({ driver: 'pglite', dataDir: '.lw/qa/pglite/app_qa' }, 'app_qa', ROOT)).toBeNull();
    expect(qaTargetProblem({ driver: 'pglite', dataDir: 'data/dev' }, 'app_qa', ROOT)).toMatch(/is not \/srv\/project\/\.lw\/qa\/pglite\/app_qa/);
    expect(qaTargetProblem({ driver: 'pglite' }, 'app_qa', ROOT)).toMatch(/in-memory/);
  });

  it('throws qa.stack.target from assertQaTarget', () => {
    expect(() => assertQaTarget({ url: DEV }, 'app_qa', ROOT)).toThrow(expect.objectContaining({ code: 'qa.stack.target' }));
  });
});

describe('qaDbSection', () => {
  it('keeps the server, role and query and changes only the database name', () => {
    expect(qaDbSection({ url: DEV, tables: {} }, 'app_qa', ROOT)).toEqual({ url: 'postgres://lw:secret@127.0.0.1:5432/app_qa?sslmode=disable', tables: {} });
  });

  it('gives a PGlite project a folder of its own', () => {
    expect(qaDbSection({ driver: 'pglite' }, 'app_qa', ROOT)).toEqual({ driver: 'pglite', dataDir: '/srv/project/.lw/qa/pglite/app_qa' });
  });

  it('refuses a remote dev server and a database name that is not a plain identifier', () => {
    expect(() => qaDbSection({ url: REMOTE_DB }, 'app_qa', ROOT)).toThrow(expect.objectContaining({ code: 'qa.stack.target' }));
    expect(() => qaDbSection({ url: DEV }, 'app-qa', ROOT)).toThrow(expect.objectContaining({ code: 'qa.stack.name' }));
  });

  it('makes a database name out of a project name', () => {
    expect(databaseName('My-Project_qa')).toBe('my_project_qa');
    expect(urlWithDatabase(DEV, 'postgres')).toBe('postgres://lw:secret@127.0.0.1:5432/postgres?sslmode=disable');
  });
});

describe('qaSections', () => {
  it('gives each bot a fake token from its id and the registry hash, the same in qaFakeBots', () => {
    const sections = { telegram: { bots: { brand: { token: '424242:PlaygroundTestTokenAAAAAAAAAAAAAAAA', username: 'brand_bot' }, side: { id: 777 } } } };
    const token = qaFakeToken(424242, 'abc123def456');
    expect(token).toMatch(/^424242:[A-Za-z0-9_-]{32}$/);
    expect(qaFakeToken(424242, 'abc123def456')).toBe(token);
    expect(qaFakeToken(424242, 'other0000000')).not.toBe(token);
    expect(qaFakeBots(sections, 'abc123def456')).toEqual([
      { username: 'brand_bot', token },
      { username: 'side', token: qaFakeToken(777, 'abc123def456') },
    ]);
    const out = qaSections({ ...sections, db: { url: DEV } }, { root: ROOT, database: 'app_qa', telegramUrl: 'http://127.0.0.1:9102', registryHash: 'abc123def456' });
    expect((out.telegram as { bots: Record<string, { token?: string }> }).bots.brand?.token).toBe(token);
    expect(JSON.stringify(out)).not.toContain('PlaygroundTestToken');
  });

  it('points db at the QA database, telegram at the fake Bot API with fake tokens, and turns qa.routes on', () => {
    const sections = {
      db: { url: DEV },
      telegram: { apiUrl: 'https://api.telegram.org', bots: { brand: { token: '424242:PlaygroundTestTokenAAAAAAAAAAAAAAAA', transport: 'polling' } } },
      qa: { database: 'app_qa' },
      mail: { default: 'fake' },
    };
    const out = qaSections(sections, { root: ROOT, database: 'app_qa', telegramUrl: 'http://127.0.0.1:9102', registryHash: 'abc123def456' });
    expect(out.db).toEqual({ url: 'postgres://lw:secret@127.0.0.1:5432/app_qa?sslmode=disable' });
    expect(out.telegram).toEqual({ apiUrl: 'http://127.0.0.1:9102', bots: { brand: { token: qaFakeToken(424242, 'abc123def456'), transport: 'polling' } } });
    expect(out.qa).toEqual({ database: 'app_qa', routes: true });
    expect(out.mail).toBe(sections.mail);
    expect(sections.db).toEqual({ url: DEV });
  });
});

describe('pgliteAdmin', () => {
  it('creates, lists and drops QA database folders and refuses other names', async () => {
    const root = await tmpDir();
    const admin = pgliteAdmin(root, (name) => name.startsWith('app_'));
    await admin.create('app_qa');
    expect(await admin.exists('app_qa')).toBe(true);
    expect(await admin.list('app_')).toEqual(['app_qa']);
    expect(pgliteDir(root, 'app_qa')).toBe(join(root, '.lw/qa/pglite/app_qa'));
    await expect(admin.drop('other')).rejects.toMatchObject({ code: 'qa.stack.guard' });
    await admin.drop('app_qa');
    expect(await admin.exists('app_qa')).toBe(false);
  });
});

describe('pgAdmin', () => {
  it('refuses a server that is not on this machine before it connects', async () => {
    await expect(pgAdmin('postgres://lw:secret@db.example.com/app', () => true)).rejects.toMatchObject({ code: 'qa.stack.host' });
  });

  it('runs the statements on the connection of a connect hook, on the maintenance database', async () => {
    const urls: string[] = [];
    const sql: string[] = [];
    const connect = async (url: string) => {
      urls.push(url);
      return {
        execute: async (statement: string) => {
          sql.push(statement);
          return { rows: statement.startsWith('select datname') ? [{ datname: 'app' }, { datname: 'app_qa' }] : [] };
        },
        close: async () => undefined,
      };
    };
    const admin = await pgAdmin(DEV, (name) => name === 'app_qa', connect);
    expect(await admin.exists('app_qa')).toBe(true);
    await admin.drop('app_qa');
    await admin.create('app_qa');
    await expect(admin.drop('app')).rejects.toMatchObject({ code: 'qa.stack.guard' });
    await admin.close();
    expect(urls).toEqual([urlWithDatabase(DEV, 'postgres')]);
    expect(sql.slice(-2)).toEqual(['drop database if exists "app_qa"', 'create database "app_qa"']);
  });
});
