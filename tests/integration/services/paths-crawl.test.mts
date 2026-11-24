// The path crawl on real Chromium: a launch sheet over the root, a browser killed mid-run, and a
// crawl signed in as a persona. The pages are synthetic and served from loopback.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { fakeClock, tmpDir } from '../../../src/kernel/testing/index.mts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPathsCommand } from '../../../src/commands/qa-paths.mts';
import type { QaSession, QaTarget } from '../../../src/drivers/target/contract.mts';
import { createPlaywrightTarget } from '../../../src/drivers/target/playwright.mts';
import { overlayProbeExpression } from '../../../src/services/overlays.mts';
import { buildCrawlPlan, controlsExpression, crawl, recordPath, targetsFrom } from '../../../src/services/paths.mts';
import type { Leg } from '../../../src/services/types.mts';
import { headlessShell, useBrowserCache } from '../../support/chromium.mts';
import { registryOf } from '../../support/states-fakes.mts';

const executablePath = headlessShell();
const webLeg: Leg = { name: 'desktop', surface: 'web', target: 'playwright', viewport: { width: 800, height: 600 } };

/** A fixed backdrop over the page, opened 1 s after load. Only its own button closes it. */
const LAYER_SHEET = `<script>setTimeout(() => {
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10';
  sheet.innerHTML = '<div style="position:absolute;left:0;right:0;bottom:0;background:#fff;padding:16px"><h2>Daily offer</h2><button data-sheet-close>Maybe later</button> <button>Get it</button></div>';
  document.body.append(sheet);
  sheet.querySelector('[data-sheet-close]').addEventListener('click', () => sheet.remove());
}, 1000);</script>`;

/** A modal dialog, opened 1 s after load. Escape closes it; its own button does not. */
const DIALOG_SHEET = `<dialog id="gift"><h2>Welcome gift</h2><button>Claim</button></dialog>
<script>setTimeout(() => document.getElementById('gift').showModal(), 1000);</script>`;

function html(links: [string, string][], extra = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body><main>${links.map(([label, href]) => `<p><a href="${href}">${label}</a></p>`).join('')}</main>${extra}</body></html>`;
}

type Handler = (req: IncomingMessage, res: ServerResponse, path: string) => void;

const servers: { close(): Promise<void> }[] = [];

async function serve(handler: Handler): Promise<string> {
  const server = createServer((req, res) => handler(req, res, new URL(req.url ?? '/', 'http://site.test').pathname));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  servers.push({ close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))) });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const page = (res: ServerResponse, text: string): void => {
  res.writeHead(200, { 'content-type': 'text/html' }).end(text);
};

/** A root with two links and a sheet, and two leaf pages that link home. */
function sheetSite(sheet: string): Handler {
  return (_req, res, path) => {
    if (path === '/') return page(res, html([['Alpha', '/alpha'], ['Beta', '/beta']], sheet));
    return page(res, html([['Home', '/']]));
  };
}

const targets = targetsFrom({ unions: [{ union: 'OfferState', routes: [{ surface: 'web', route: '/alpha' }, { surface: 'web', route: '/beta' }] }] });

beforeEach(() => useBrowserCache());
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

async function withSession<T>(baseUrl: string, work: (session: QaSession) => Promise<T>): Promise<T> {
  const session = await createPlaywrightTarget({ executablePath }).open({ leg: webLeg, baseUrl, outDir: await tmpDir() });
  try {
    return await work(session);
  } finally {
    await session.close();
  }
}

describe('crawl over a launch sheet', () => {
  it('sees only the sheet when nothing clears it, so no path leaves the root', async () => {
    const baseUrl = await serve(sheetSite(LAYER_SHEET));
    await withSession(baseUrl, async (session) => {
      const evaluate = (expression: string): Promise<unknown> => (session.evaluate as (e: string) => Promise<unknown>).call(session, expression);
      await session.navigate('/');
      expect(await evaluate(overlayProbeExpression(3000, 'present', []))).toEqual({ kind: 'layer', name: 'Daily offer' });
      expect((await evaluate(controlsExpression())) as { label: string }[]).toEqual([
        { label: 'Maybe later', role: 'button' },
        { label: 'Get it', role: 'button' },
      ]);
      const result = await crawl(session, buildCrawlPlan({ slug: 's', leg: 'desktop', surface: 'web', targets, overlayWaitMs: 1500 }));
      expect(result.paths).toEqual([]);
      expect(result.dismissals[0]).toEqual({ route: '/', by: 'auto', press: 'key Escape', overlay: 'layer "Daily offer"', cleared: false });
      expect(result.targets.map((t) => t.reached)).toEqual([false, false]);
    });
  });

  it('clears the sheet through the dismiss list in order, then reaches the links under it', async () => {
    const baseUrl = await serve(sheetSite(LAYER_SHEET));
    const dismiss = [{ key: 'Escape' }, { selector: '[data-missing]' }, { role: 'button', name: 'Maybe later' }];
    const result = await withSession(baseUrl, (session) => crawl(session, buildCrawlPlan({ slug: 's', leg: 'desktop', surface: 'web', targets, dismiss, overlayWaitMs: 1500 })));
    expect(result.paths.map((p) => p.readable)).toEqual(['/ -> "Alpha" -> /alpha', '/ -> "Beta" -> /beta']);
    // A dismiss is no step: each path holds the one link it pressed.
    expect(result.paths.map((p) => p.steps.map((s) => s.label))).toEqual([['Alpha'], ['Beta']]);
    const atRoot = result.dismissals.filter((d) => d.route === '/');
    expect(atRoot.slice(0, 2)).toEqual([
      { route: '/', by: 'list', press: 'key Escape', overlay: 'layer "Daily offer"', cleared: false },
      { route: '/', by: 'list', press: 'button "Maybe later"', overlay: 'layer "Daily offer"', cleared: true },
    ]);
    // One read of the root and one fresh open per edge: three sheets, each cleared by the list.
    expect(atRoot.filter((d) => d.cleared)).toHaveLength(3);
    expect(result.dismissals.some((d) => d.by === 'auto')).toBe(false);
    expect(result.targets.map((t) => [t.route, t.reached])).toEqual([
      ['/alpha', true],
      ['/beta', true],
    ]);
  });

  it('clears a modal dialog by itself with Escape when the dismiss list is empty', async () => {
    const baseUrl = await serve(sheetSite(DIALOG_SHEET));
    const result = await withSession(baseUrl, (session) => crawl(session, buildCrawlPlan({ slug: 's', leg: 'desktop', surface: 'web', targets, overlayWaitMs: 1500 })));
    expect(result.paths.map((p) => p.readable)).toEqual(['/ -> "Alpha" -> /alpha', '/ -> "Beta" -> /beta']);
    expect(result.dismissals).toEqual(Array.from({ length: 3 }, () => ({ route: '/', by: 'auto', press: 'key Escape', overlay: 'modal "Welcome gift"', cleared: true })));
  });

  it('replays a crawled path over the sheet: the root is cleared before the recorder starts', async () => {
    const baseUrl = await serve(sheetSite(LAYER_SHEET));
    const file = join(await tmpDir(), 'alpha.webm');
    const overlays = { dismiss: [{ selector: '[data-sheet-close]' }], overlayWaitMs: 1500 };
    const recorded = await withSession(baseUrl, (session) =>
      recordPath(session, { root: '/', path: { id: 'desktop.root.alpha', steps: [{ label: 'Alpha', role: 'link' }] }, file, device: 'browser chromium', capS: 170, overlays, now: () => Date.now() }),
    );
    expect(recorded).toMatchObject({ ok: true, kind: 'path', provenance: 'live', file });
    expect(recorded.ok && recorded.marks.map((m) => m.slice(m.indexOf('  ') + 2))).toEqual(['Alpha']);
  });
});

async function project(pages: string[]): Promise<string> {
  const root = await tmpDir();
  const route = (p: string): string => (p === 'home' ? '/' : `/${p}`);
  const files: Record<string, string> = {
    'apps/api/src/routes.mts': `export default routes((r) => r.group({ name: 'public' }, (g) => { ${pages.map((p) => `g.page('${route(p)}', '${p}');`).join(' ')} }));`,
    'apps/client/src/invite.ts': "export type InviteState = 'open' | 'closed';\nexport function inviteState(i: { closed: boolean }): InviteState { return i.closed ? 'closed' : 'open'; }",
  };
  for (const p of pages) files[`apps/client/src/pages/${p}.page.tsx`] = "import { inviteState } from '../invite';\nexport default function Page() { return null; }";
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

/** The playwright target, with each session it opens kept for the test. */
function keptTarget(): { target: QaTarget; sessions: QaSession[] } {
  const real = createPlaywrightTarget({ executablePath });
  const sessions: QaSession[] = [];
  const target: QaTarget = {
    name: real.name,
    specVersion: real.specVersion,
    capabilities: real.capabilities,
    supports: (cap) => real.supports(cap),
    ready: (leg) => real.ready(leg),
    open: async (opts) => {
      const session = await real.open(opts);
      sessions.push(session);
      return session;
    },
  };
  return { target, sessions };
}

function io(config: Record<string, unknown> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, opts: (cwd: string) => ({ cwd, out: (l: string) => out.push(l), err: (l: string) => err.push(l), config }) };
}

describe('lw qa paths crawl on Chromium', () => {
  it('opens a new session after the browser is killed, and ends with a row per target', async () => {
    const root = await project(['home', 'boom', 'next', 'other']);
    const { target, sessions } = keptTarget();
    let killed = 0;
    const crashes: unknown[] = [];
    const baseUrl = await serve((_req, res, path) => {
      if (path === '/boom' && killed === 0) {
        killed += 1;
        // The browser crashes while it loads the page. The protocol call dies with the browser.
        const live = sessions.at(-1)?.routable?.() as unknown as Page;
        void live
          .context()
          .newCDPSession(live)
          .then((cdp) => cdp.send('Browser.crash'))
          .catch((cause: unknown) => crashes.push(cause));
        // No answer: the page is still loading when the browser goes.
        return;
      }
      if (path === '/') return page(res, html([['Boom', '/boom'], ['Next', '/next'], ['Other', '/other']]));
      return page(res, html([['Home', '/']]));
    });
    const { out, err, opts } = io();
    const command = createPathsCommand({ clock: fakeClock(), targets: registryOf({ playwright: target }), revision: () => ({ commit: 'c', dirty: false }) });
    expect(await command.run(['crawl', '--base', baseUrl], opts(root))).toBe(1);
    expect(killed).toBe(1);
    expect(crashes).toHaveLength(1);
    expect(sessions).toHaveLength(2);
    expect(out).toContain('  / -> "Next" -> /next');
    expect(out).toContain('  / -> "Other" -> /other');
    expect(out).toContain('leg desktop: the browser of no persona closed, so a new session opened');
    const written = JSON.parse(readFileSync(join(root, '.lw/qa/paths/paths/targets.desktop.json'), 'utf8')) as { targets: { route: string; reached: boolean; crashed?: string; error?: string }[] };
    expect(written.targets.map((t) => [t.route, t.reached])).toEqual([
      ['/', false],
      ['/boom', false],
      ['/next', true],
      ['/other', true],
    ]);
    expect(written.targets[0]?.crashed).toMatch(/^the browser closed during press "Boom" on \/: the browser closed while the page settled: /);
    expect(written.targets.some((t) => t.error !== undefined)).toBe(false);
    expect(err.some((l) => l.startsWith('leg desktop: target /: the browser closed during press "Boom" on /') && l.endsWith('A new session opened and the crawl went on.'))).toBe(true);
  });

  it('signs the persona of qa.paths.fixture in first, and clears the sheet with the dismiss list of the config', async () => {
    const root = await project(['home', 'account']);
    const requests: string[] = [];
    const baseUrl = await serve((req, res, path) => {
      requests.push(`${req.method} ${path}`);
      if (req.method === 'POST' && path === '/__qa/session') {
        res.writeHead(200, { 'set-cookie': 'session=qa; Path=/; HttpOnly' }).end('{}');
        return;
      }
      const signedIn = /session=qa/.test(req.headers.cookie ?? '');
      if (path === '/') return page(res, html(signedIn ? [['Account', '/account']] : [['Sign in', '/signin']], LAYER_SHEET));
      return page(res, html([['Home', '/']]));
    });
    const config = { qa: { paths: { fixture: { persona: 'member' }, dismiss: ['[data-sheet-close]'], overlayWaitMs: 1500 } } };
    const { out, err, opts } = io(config);
    const command = createPathsCommand({ clock: fakeClock(), targets: registryOf({ playwright: createPlaywrightTarget({ executablePath }) }), revision: () => ({ commit: 'c', dirty: false }) });
    expect(await command.run(['crawl', '--base', baseUrl], opts(root))).toBe(0);
    expect(err).toEqual([]);
    expect(requests[0]).toBe('POST /__qa/session');
    expect(out[0]).toContain('1 path(s), 1 of 2 target route(s) reached as persona member');
    expect(out).toContain('  / -> "Account" -> /account');
    expect(out).toContain('leg desktop: dismiss (list) selector [data-sheet-close] on / over layer "Daily offer": cleared (2 times)');
  });
});
