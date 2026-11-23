// The contract suite of the `qa.target` driver kind (spec 2.8, testing spec T10). Every target
// driver runs it through `runContract(targetContract, () => targetHarness(target, site))`. A
// browser target opens the loopback site of `serveContractSite()`; the fake target opens the
// same pages from `contractFakeRoutes()`.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { type Driver, LaunchwrightError, moduleFixture } from '@launchwrighthq/kernel';
import { defineContract } from '@launchwrighthq/kernel/testing';
import { expect } from 'vitest';
import { FAKE_CLIP, type FakeRoute } from '../drivers/target/fake.mts';
import {
  QA_TARGET_SPEC_VERSION,
  type QaSession,
  type QaTarget,
  type QaTargetCapability,
} from '../drivers/target/contract.mts';
import { pngSize } from '../services/png.mts';
import type { Leg } from '../services/types.mts';

/** A target under the contract, with the surface it opens and a folder for its files. */
export interface TargetHarness extends Driver {
  readonly target: QaTarget;
  readonly leg: Leg;
  readonly baseUrl: string;
  /** A fresh folder for the files of one case. */
  outDir(): Promise<string>;
}

export interface HarnessOptions {
  baseUrl: string;
  outDir: () => Promise<string>;
  /** The leg the cases open. Default: a 640x480 `web` leg on this target. */
  leg?: Leg;
}

/** Wraps a target for `runContract`: the harness reports the target's name, version and capabilities. */
export function targetHarness(target: QaTarget, opts: HarnessOptions): TargetHarness {
  return {
    name: target.name,
    specVersion: target.specVersion,
    capabilities: target.capabilities,
    supports: (cap) => target.supports(cap),
    target,
    leg: opts.leg ?? { name: 'contract', surface: 'web', target: target.name, viewport: { width: 640, height: 480 } },
    baseUrl: opts.baseUrl,
    outDir: opts.outDir,
  };
}

/** The base path of the contract site. Routes are relative to it. */
export const CONTRACT_BASE = '/site';

const page = (body: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><title>contract</title></head><body>${body}</body></html>`;

const DOT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** The pages of the contract site, by route. `{base}` is the site base path. */
const SITE: Record<string, string> = {
  '/': page(
    `<main id="home"><h1>Home</h1><a href="{base}/next">Next</a><input id="name" aria-label="Name">` +
      `<img alt="dot" src="${DOT_PNG}" width="8" height="8"><div style="height:3000px"></div></main>`,
  ),
  '/next': page('<main id="next"><h1>Next</h1></main>'),
  '/busy': page(
    '<main id="busy" aria-busy="true"><h1>Busy</h1></main>' +
      `<script>requestAnimationFrame(() => document.getElementById('busy').setAttribute('aria-busy', 'false'))</script>`,
  ),
  '/video': page('<video id="clip" src="{base}/clip.webm" autoplay muted loop playsinline width="32" height="32"></video>'),
  '/errors': page(
    '<main id="errors"><h1>Errors</h1></main><script>' +
      `console.error('contract console error');` +
      `fetch('{base}/fail').then(() => { const d = document.createElement('p'); d.id = 'done'; d.textContent = 'done'; document.body.append(d); });` +
      `throw new Error('contract page error');</script>`,
  ),
};

/** The fake target pages that mirror the contract site. */
export function contractFakeRoutes(): Record<string, FakeRoute> {
  return {
    '/': { selectors: ['#home', '#name', 'role=link[name="Next"]'], links: { 'role=link[name="Next"]': '/next' }, artwork: true },
    '/next': { selectors: ['#next'] },
    '/busy': { selectors: ['#busy'] },
    '/video': { selectors: ['#clip'], video: true },
    '/errors': {
      selectors: ['#errors', '#done'],
      logs: [
        { kind: 'console-error', text: 'contract console error' },
        { kind: 'response-5xx', text: `500 GET ${CONTRACT_BASE}/fail` },
        { kind: 'page-error', text: 'contract page error' },
      ],
    },
    '/redirect': { redirect: '/next' },
  };
}

/** A running contract site on loopback. */
export interface ContractSite {
  /** `http://127.0.0.1:<port>/site` */
  baseUrl: string;
  close(): Promise<void>;
}

/** Serves the contract site on `127.0.0.1` with a free port. */
export async function serveContractSite(): Promise<ContractSite> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://site.test').pathname;
    const route = path === CONTRACT_BASE ? '/' : path.startsWith(`${CONTRACT_BASE}/`) ? path.slice(CONTRACT_BASE.length) : null;
    if (route === '/redirect') {
      res.writeHead(302, { location: `${CONTRACT_BASE}/next` }).end();
      return;
    }
    if (route === '/fail') {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('fail');
      return;
    }
    if (route === '/clip.webm') {
      res.writeHead(200, { 'content-type': 'video/webm', 'content-length': FAKE_CLIP.length }).end(FAKE_CLIP);
      return;
    }
    const html = route === null ? undefined : SITE[route];
    if (html === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html.replaceAll('{base}', CONTRACT_BASE));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}${CONTRACT_BASE}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

/** Opens a session on the harness leg, runs `fn`, and closes the session also when `fn` throws. */
async function using(h: TargetHarness, fn: (s: QaSession, dir: string) => Promise<void>): Promise<void> {
  const dir = await h.outDir();
  const session = await h.target.open({ leg: h.leg, baseUrl: h.baseUrl, outDir: dir });
  try {
    await fn(session, dir);
  } finally {
    await session.close();
  }
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(LaunchwrightError);
  return (err as LaunchwrightError).code;
}

function has(h: TargetHarness, cap: QaTargetCapability): boolean {
  return h.target.capabilities.has(cap);
}

/** The cases file: `modules/qa/fixtures/contract/target.cases.json`. */
const CASES_FILE = moduleFixture(import.meta.url, 'contract/target.cases.json');

/** The contract suite of the `qa.target` driver kind. */
export const targetContract = defineContract<TargetHarness>(
  'qa.target',
  QA_TARGET_SPEC_VERSION,
  [
    {
      name: 'navigate shows the route relative to the surface base',
      async run(h) {
        await using(h, async (s) => {
          await s.navigate('/next');
          expect(await s.currentRoute()).toBe('/next');
          await s.navigate('/');
          expect(await s.currentRoute()).toBe('/');
        });
      },
    },
    {
      name: 'a redirect shows in currentRoute',
      async run(h) {
        await using(h, async (s) => {
          await s.navigate('/redirect');
          expect(await s.currentRoute()).toBe('/next');
        });
      },
    },
    {
      name: 'click on a role selector opens the linked route',
      async run(h) {
        await using(h, async (s) => {
          await s.navigate('/');
          if (!has(h, 'input')) {
            expect(await codeOf(s.act({ kind: 'click', target: 'role=link[name="Next"]' }))).toBe('qa.target.capability');
            return;
          }
          await s.act({ kind: 'click', target: 'role=link[name="Next"]' });
          await s.settle({ selector: '#next', timeout: 5000 });
          expect(await s.currentRoute()).toBe('/next');
        });
      },
    },
    {
      name: 'type, press, scroll, wait and back run in order',
      async run(h) {
        await using(h, async (s) => {
          await s.navigate('/next');
          await s.navigate('/');
          if (!has(h, 'input')) {
            expect(await codeOf(s.act({ kind: 'type', target: '#name', text: 'hello' }))).toBe('qa.target.capability');
            return;
          }
          await s.act({ kind: 'type', target: '#name', text: 'hello' });
          await s.act({ kind: 'press', target: '#name', key: 'Tab' });
          await s.act({ kind: 'scroll', dy: 400 });
          await s.act({ kind: 'wait', ms: 0, why: 'the contract checks that wait runs' });
          await s.act({ kind: 'back' });
          expect(await s.currentRoute()).toBe('/next');
        });
      },
    },
    {
      name: 'an act on a missing element fails with qa.target.act',
      async run(h) {
        if (!has(h, 'input')) return;
        await using(h, async (s) => {
          await s.navigate('/next');
          expect(await codeOf(s.act({ kind: 'click', target: '#nothing-here' }))).toBe('qa.target.act');
        });
      },
    },
    {
      name: 'settle waits for a selector, artwork, a playing video and no busy element',
      async run(h) {
        await using(h, async (s) => {
          await s.navigate('/');
          await s.settle({ selector: '#home', timeout: 5000 });
          await s.settle({ artwork: true, timeout: 5000 });
          await s.navigate('/busy');
          await s.settle({ busy: true, timeout: 5000 });
          await s.navigate('/video');
          await s.settle({ video: true, timeout: 10000 });
        });
      },
    },
    {
      name: 'settle on a missing selector fails with qa.target.settle',
      async run(h) {
        await using(h, async (s) => {
          await s.navigate('/next');
          expect(await codeOf(s.settle({ selector: '#never', timeout: 300 }))).toBe('qa.target.settle');
        });
      },
    },
    {
      name: 'screenshot writes a PNG whose header gives the capture size',
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate('/');
          const path = join(dir, 'leg-row.png');
          if (!has(h, 'screenshot')) {
            expect(await codeOf(s.screenshot(path))).toBe('qa.target.capability');
            return;
          }
          const shot = await s.screenshot(path);
          expect(shot.path).toBe(path);
          const size = pngSize(readFileSync(path));
          expect(size).not.toBeNull();
          expect(size).toEqual({ width: shot.width, height: shot.height });
        });
      },
    },
    {
      name: 'startVideo and stopVideo write a clip with a duration',
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate('/');
          const path = join(dir, 'leg-row.webm');
          if (!has(h, 'video')) {
            expect(await codeOf(s.startVideo(path))).toBe('qa.target.capability');
            return;
          }
          await s.startVideo(path);
          await s.navigate('/next');
          await s.settle({ selector: '#next', timeout: 5000 });
          const clip = await s.stopVideo();
          expect(clip.path).toBe(path);
          expect(clip.durationMs).toBeGreaterThan(0);
          expect(readFileSync(path).length).toBeGreaterThan(0);
        });
      },
    },
    {
      name: 'logs hold page errors, console errors and 5xx responses',
      async run(h) {
        await using(h, async (s) => {
          await s.navigate('/errors');
          await s.settle({ selector: '#done', timeout: 5000 });
          const logs = await s.logs();
          const kinds = new Set(logs.map((l) => l.kind));
          expect(kinds).toEqual(new Set(['page-error', 'console-error', 'response-5xx']));
          for (const line of logs) expect(Number.isNaN(Date.parse(line.at))).toBe(false);
          expect(logs.find((l) => l.kind === 'page-error')?.text).toContain('contract page error');
        });
      },
    },
    {
      name: 'a missing capability rejects with qa.target.capability',
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate('/');
          if (!has(h, 'input')) expect(await codeOf(s.act({ kind: 'back' }))).toBe('qa.target.capability');
          if (!has(h, 'screenshot')) expect(await codeOf(s.screenshot(join(dir, 'x.png')))).toBe('qa.target.capability');
          if (!has(h, 'video')) {
            expect(await codeOf(s.startVideo(join(dir, 'x.webm')))).toBe('qa.target.capability');
            expect(await codeOf(s.stopVideo())).toBe('qa.target.capability');
          }
          for (const cap of ['input', 'screenshot', 'video'] as const) expect(h.supports(cap)).toBe(has(h, cap));
        });
      },
    },
    {
      name: 'trace and dump give a written path or null',
      async run(h) {
        await using(h, async (s, dir) => {
          await s.navigate('/');
          for (const [call, path] of [
            [s.trace.bind(s), join(dir, 'leg-row.trace.zip')],
            [s.dump.bind(s), join(dir, 'leg-row.ui.xml')],
          ] as const) {
            const written = await call(path);
            if (written === null) continue;
            expect(written).toBe(path);
            expect(readFileSync(path).length).toBeGreaterThan(0);
          }
        });
      },
    },
    {
      name: 'ready answers a boolean and a reason when not ready',
      async run(h) {
        const r = await h.target.ready(h.leg);
        expect(typeof r.ready).toBe('boolean');
        if (!r.ready) expect(r.reason ?? '').not.toBe('');
      },
    },
    {
      name: 'close ends the session and a second close does nothing',
      async run(h) {
        const session = await h.target.open({ leg: h.leg, baseUrl: h.baseUrl, outDir: await h.outDir() });
        await session.navigate('/');
        await session.close();
        await session.close();
      },
    },
  ],
  { casesFile: CASES_FILE },
);
