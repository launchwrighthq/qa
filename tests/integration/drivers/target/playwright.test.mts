import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runContract } from '../../../../src/kernel/testing/index.mts';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPlaywrightTarget } from '../../../../src/drivers/target/playwright.mts';
import type { Leg } from '../../../../src/services/types.mts';
import { type ContractSite, serveContractSite, targetContract, targetHarness } from '../../../../src/testing/target-contract.mts';
import { headlessShell, useBrowserCache } from '../../../support/chromium.mts';

const executablePath = headlessShell();
let site: ContractSite;

beforeAll(async () => {
  site = await serveContractSite();
});
afterAll(async () => {
  await site.close();
});
beforeEach(() => useBrowserCache());

runContract(targetContract, () => targetHarness(createPlaywrightTarget({ executablePath }), { baseUrl: site.baseUrl, outDir: tmpDir }));

/** A loopback app with the persona route and one page that shows the session cookie and the query. */
async function serveApp(): Promise<{ baseUrl: string; posts: string[]; close(): Promise<void> }> {
  const posts: string[] = [];
  const body = async (req: IncomingMessage): Promise<string> => {
    let text = '';
    for await (const chunk of req) text += String(chunk);
    return text;
  };
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://mini.test');
    if (req.method === 'POST' && url.pathname === '/__qa/session') {
      const { persona } = JSON.parse(await body(req)) as { persona: string };
      posts.push(persona);
      if (persona === 'missing') {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'set-cookie': `session=qa:${persona}; Path=/; HttpOnly` }).end('{}');
      return;
    }
    const who = /session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1] ?? 'none';
    res.writeHead(200, { 'content-type': 'text/html' }).end(`<p id="who">${who}</p><p id="qa">${url.searchParams.get('qa') ?? 'none'}</p>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/mini`,
    posts,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

const webLeg: Leg = { name: 'desktop', surface: 'web', target: 'playwright', viewport: { width: 400, height: 300 } };

describe('playwright target persona sign-in', () => {
  it('posts the persona to /__qa/session before a web leg opens a page', async () => {
    const app = await serveApp();
    const session = await createPlaywrightTarget({ executablePath }).open({ leg: webLeg, baseUrl: app.baseUrl, persona: 'member', outDir: await tmpDir() });
    try {
      await session.navigate('/home');
      expect(app.posts).toEqual(['member']);
      expect(await (session.evaluate as (e: string) => Promise<unknown>)('document.getElementById("who").textContent')).toBe('qa:member');
      expect(await session.currentRoute()).toBe('/home');
    } finally {
      await session.close();
      await app.close();
    }
  });

  it('adds ?qa=<persona> on a miniapp leg and posts nothing', async () => {
    const app = await serveApp();
    const leg: Leg = { name: 'miniapp', surface: 'miniapp', target: 'playwright', descriptor: 'Pixel 7' };
    const session = await createPlaywrightTarget({ executablePath }).open({ leg, baseUrl: app.baseUrl, persona: 'member', outDir: await tmpDir() });
    try {
      await session.navigate('/home');
      expect(app.posts).toEqual([]);
      expect(await (session.evaluate as (e: string) => Promise<unknown>)('document.getElementById("qa").textContent')).toBe('member');
      expect(await (session.evaluate as (e: string) => Promise<unknown>)('window.screen.width')).toBe(412);
    } finally {
      await session.close();
      await app.close();
    }
  });

  it('fails with qa.target.persona when the persona route refuses', async () => {
    const app = await serveApp();
    try {
      const err = await createPlaywrightTarget({ executablePath })
        .open({ leg: webLeg, baseUrl: app.baseUrl, persona: 'missing', outDir: await tmpDir() })
        .catch((e: unknown) => e);
      expect(err).toMatchObject({ code: 'qa.target.persona' });
    } finally {
      await app.close();
    }
  });
});

describe('playwright target navigation and crash probe', () => {
  /** A page whose image request never answers, so the `load` event never fires. */
  async function serveHeldPage(): Promise<{ baseUrl: string; close(): Promise<void> }> {
    const held: ServerResponse[] = [];
    const server: Server = createServer((req, res) => {
      if (req.url === '/held.png') {
        held.push(res);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' }).end('<p id="ready">ready</p><img src="/held.png">');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: () => {
        for (const res of held) res.destroy();
        return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      },
    };
  }

  it('opens a page that holds a request open, after DOMContentLoaded and a bounded wait for load', async () => {
    const app = await serveHeldPage();
    const session = await createPlaywrightTarget({ executablePath, loadGraceMs: 300, navigateTimeoutMs: 5_000 }).open({ leg: webLeg, baseUrl: app.baseUrl, outDir: await tmpDir() });
    try {
      const started = Date.now();
      await session.navigate('/');
      expect(Date.now() - started).toBeLessThan(4_000);
      expect(await (session.evaluate as (e: string) => Promise<unknown>)('document.getElementById("ready").textContent')).toBe('ready');
      expect(session.isClosed?.()).toBe(false);
    } finally {
      await session.close();
      await app.close();
    }
    expect(session.isClosed?.()).toBe(true);
  });

  it('reports a crashed page as closed', async () => {
    const app = await serveHeldPage();
    const session = await createPlaywrightTarget({ executablePath, loadGraceMs: 100 }).open({ leg: webLeg, baseUrl: app.baseUrl, outDir: await tmpDir() });
    try {
      const page = session.routable?.() as unknown as { goto(url: string): Promise<unknown>; waitForEvent(name: string): Promise<unknown> };
      const crashed = page.waitForEvent('crash');
      await page.goto('chrome://crash').then(
        () => undefined,
        (err: unknown) => expect(String(err)).toMatch(/crash|closed/i),
      );
      await crashed;
      expect(session.isClosed?.()).toBe(true);
    } finally {
      await session.close().then(
        () => undefined,
        (err: unknown) => expect(String(err)).toMatch(/crash|closed/i),
      );
      await app.close();
    }
  });
});
