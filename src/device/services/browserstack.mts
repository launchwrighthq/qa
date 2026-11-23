// BrowserStack Automate over plain fetch (spec 2.8 `browserstack`): the W3C WebDriver hub, and the
// REST API that counts minutes. Every second of a session costs minutes, so a session carries an
// idle timeout and a per-run minute budget. The keys travel only in the Authorization header.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { isRedirect } from '@launchwrighthq/kernel/fetch';
import { readJsonOrNull } from '@launchwrighthq/kernel/fs';
import type { BrowserstackConfig, CloudDeviceKeys } from '../config.mts';
import { deviceKind } from './device-kinds.mts';
import type { DeviceDeps } from './process.mts';
import { DEVICE_STATE_DIR } from './rigs.mts';

/** A WebDriver error with the hub's error code, so a caller can tell an ended session. */
export class WebDriverError extends LaunchwrightError {
  constructor(
    message: string,
    readonly status: number,
    readonly wdCode: string,
    cause?: unknown,
  ) {
    super('qa.device.browserstack.webdriver', message, { ...(cause === undefined ? {} : { cause }), context: { status, wdCode } });
  }
}

export interface BrowserstackClient {
  wd(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<unknown>;
  api(path: string): Promise<unknown>;
}

/** A 3xx of the hub or the API. It is never followed, so the keys reach no other host. */
async function redirected(call: string, res: Response): Promise<LaunchwrightError> {
  await res.body?.cancel();
  return new LaunchwrightError('qa.device.browserstack.redirect', `${call} answered a redirect ${res.status}, which is not followed`, { context: { status: res.status } });
}

/** The client, or `qa.device.browserstack.keys` naming the config keys when a key is missing. */
export function createBrowserstackClient(cfg: BrowserstackConfig, deps: DeviceDeps): BrowserstackClient {
  if (!cfg.username || !cfg.accessKey) {
    throw new LaunchwrightError(
      'qa.device.browserstack.keys',
      'BrowserStack needs qa.device.browserstack.username and accessKey. Store BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in the secret store and map them into the qa config.',
    );
  }
  const authorization = `Basic ${Buffer.from(`${cfg.username}:${cfg.accessKey}`).toString('base64')}`;
  return {
    async wd(method, path, body, timeoutMs = 90_000) {
      const res = await deps.fetch(`${cfg.hub}${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (isRedirect(res)) throw await redirected(`${method} ${path}`, res);
      const text = await res.text();
      let json: { value?: { error?: string; message?: string } & Record<string, unknown> };
      try {
        json = JSON.parse(text);
      } catch (err) {
        throw new WebDriverError(`${method} ${path} answered ${res.status} with no JSON: ${text.slice(0, 200)}`, res.status, 'no json', err);
      }
      const error = json.value?.error;
      if (!res.ok || error) {
        throw new WebDriverError(`${method} ${path} answered ${res.status}: ${error ?? ''} ${String(json.value?.message ?? '').slice(0, 300)}`.trim(), res.status, error ?? '');
      }
      return json.value;
    },
    async api(path) {
      const res = await deps.fetch(`${cfg.api}${path}`, { headers: { authorization }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
      if (isRedirect(res)) throw await redirected(`GET ${path}`, res);
      const text = await res.text();
      if (!res.ok) throw new LaunchwrightError('qa.device.browserstack.api', `GET ${path} answered ${res.status}: ${text.slice(0, 200)}`);
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new LaunchwrightError('qa.device.browserstack.api', `GET ${path} answered ${text.length} bytes that are not JSON.`, { cause: err });
      }
    },
  };
}

/** The W3C new-session body for a cloud device. The keys are not in it. */
export function capabilities(kind: string, keys: CloudDeviceKeys, cfg: BrowserstackConfig, sessionName: string): Record<string, unknown> {
  const traits = deviceKind(kind);
  return {
    capabilities: {
      alwaysMatch: {
        browserName: traits.browser ?? 'safari',
        // A kind with `console` keeps the page console for `se/log` (chromedriver); Safari over WebDriver has none.
        ...(traits.console === true ? { 'goog:loggingPrefs': { browser: 'ALL' } } : {}),
        'bstack:options': {
          deviceName: keys.model,
          osVersion: keys.os,
          realMobile: 'true',
          projectName: cfg.project,
          buildName: cfg.build,
          sessionName,
          idleTimeout: cfg.idleTimeoutS,
          debug: false,
          networkLogs: false,
        },
      },
    },
  };
}

/**
 * The script for `execute/async`. The expression is spliced into the driver function, not passed to
 * the page `eval`, which a Content-Security-Policy may forbid. A page throw returns `{ ok: false }`.
 */
export function asyncScript(expression: string): string {
  const expr = expression.trim().replace(/;+\s*$/, '');
  return `var done = arguments[arguments.length - 1];
var fail = function (e) { done({ ok: false, error: String((e && e.stack) || e) }); };
try {
  Promise.resolve((function () { return (
${expr}
); })()).then(function (v) { done({ ok: true, value: v === undefined ? null : v }); }, fail);
} catch (e) { fail(e); }`;
}

/** Minutes spent, from the Automate session rows (`duration` in seconds). */
export interface MinuteSummary {
  plan: string;
  sessions: number;
  minutes: number;
  /** Each session rounded up to a whole minute: the most it can have cost. */
  billedMinutes: number;
  running: number;
  parallel: number;
}

export function minuteSummary(sessions: { duration?: number | string | null }[], plan: Record<string, unknown>): MinuteSummary {
  const seconds = sessions.map((s) => Number(s.duration) || 0);
  return {
    plan: String(plan.automate_plan ?? 'unknown'),
    sessions: seconds.length,
    minutes: Math.round(seconds.reduce((a, b) => a + b, 0) / 6) / 10,
    billedMinutes: seconds.reduce((a, s) => a + Math.ceil(s / 60), 0),
    running: Number(plan.parallel_sessions_running ?? 0),
    parallel: Number(plan.parallel_sessions_max_allowed ?? 0),
  };
}

export function budgetLine(s: MinuteSummary, cfg: BrowserstackConfig): string {
  return `Automate plan ${s.plan}: ${s.minutes} min used over ${s.sessions} session(s), ${s.billedMinutes} min rounded up; ${s.running} of ${s.parallel} parallel running; per-run budget ${cfg.budgetMinutes} min`;
}

/** Every session the account has run, 100 per page. */
export async function allSessions(client: BrowserstackClient): Promise<{ duration?: number; [k: string]: unknown }[]> {
  const rows: { duration?: number; [k: string]: unknown }[] = [];
  for (let offset = 0; ; offset += 100) {
    const builds = (await client.api(`/builds.json?limit=100&offset=${offset}`)) as { automation_build: { hashed_id: string } }[];
    for (const { automation_build: b } of builds) {
      for (let so = 0; ; so += 100) {
        const page = (await client.api(`/builds/${b.hashed_id}/sessions.json?limit=100&offset=${so}`)) as { automation_session: { duration?: number } }[];
        rows.push(...page.map((p) => p.automation_session));
        if (page.length < 100) break;
      }
    }
    if (builds.length < 100) return rows;
  }
}

export async function budget(client: BrowserstackClient): Promise<MinuteSummary> {
  const [plan, sessions] = await Promise.all([client.api('/plan.json'), allSessions(client)]);
  return minuteSummary(sessions, plan as Record<string, unknown>);
}

/** A held session between `lw qa device` calls. */
export interface HeldSession {
  id: string;
  device: string;
  startedAt: number;
}

export function heldSessionPath(root: string): string {
  return join(root, DEVICE_STATE_DIR, 'browserstack-session.json');
}

export async function readHeld(root: string): Promise<HeldSession | null> {
  return (await readJsonOrNull(heldSessionPath(root))) as HeldSession | null;
}

export async function writeHeld(root: string, held: HeldSession | null): Promise<void> {
  const path = heldSessionPath(root);
  if (held === null) {
    await rm(path, { force: true });
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(held, null, 1)}\n`);
}

/** Fails with `qa.device.browserstack.budget` once a session has run past the per-run budget. */
export function checkBudget(startedAt: number, now: number, cfg: BrowserstackConfig): void {
  const usedMin = (now - startedAt) / 60_000;
  if (usedMin > cfg.budgetMinutes) {
    throw new LaunchwrightError(
      'qa.device.browserstack.budget',
      `The BrowserStack session has run ${usedMin.toFixed(1)} min, past the per-run budget of ${cfg.budgetMinutes} min (qa.device.browserstack.budgetMinutes). It was closed.`,
      { context: { usedMin, budgetMinutes: cfg.budgetMinutes } },
    );
  }
}
