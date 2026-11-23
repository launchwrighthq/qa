import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { afterEach, describe, expect, it } from 'vitest';
import { attachablePages, type CdpClient, logLineOf, openVisiblePage, rewriteWsUrl } from '../../../../src/device/services/cdp.mts';
import { cdpSockets, deviceJson, devtoolsFetch, FakeSite, fakeDeps } from '../../../support/device.mts';

const AT = '2026-11-12T10:00:00.000Z';
const open: CdpClient[] = [];

afterEach(() => {
  for (const client of open.splice(0)) client.close();
});

describe('the raw CDP client of an Android WebView', () => {
  it('lists only pages that a client can attach to', () => {
    const pages = attachablePages(deviceJson('cdp-json-list.json', { origin: 'https://app.test' }));
    expect(pages.map((p) => p.id)).toEqual(['A1', 'C3']);
  });

  it('points a page socket URL at the forwarded port', () => {
    expect(rewriteWsUrl('ws://localhost:9222/devtools/page/C3', 41001)).toBe('ws://127.0.0.1:41001/devtools/page/C3');
  });

  it('attaches to the visible page and closes the hidden one', async () => {
    const site = new FakeSite('https://app.test/site');
    const socket = cdpSockets(site);
    const deps = fakeDeps({ root: await tmpDir(), socket, fetch: devtoolsFetch(site) });
    const page = await openVisiblePage(deps, 41001);
    open.push(page.client);
    expect(page.target.id).toBe('C3');
    expect(socket.urls).toEqual(['ws://127.0.0.1:41001/devtools/page/A1', 'ws://127.0.0.1:41001/devtools/page/C3']);
    expect(await page.client.evaluate('location.pathname + location.search')).toBe('/site/');
  });

  it('fails a call that the page answers with a CDP error', async () => {
    const site = new FakeSite('https://app.test/site');
    const deps = fakeDeps({ root: await tmpDir(), socket: cdpSockets(site), fetch: devtoolsFetch(site) });
    const page = await openVisiblePage(deps, 41001);
    open.push(page.client);
    await expect(page.client.send('Input.dispatchTouchEvent')).rejects.toThrow(/CDP Input.dispatchTouchEvent failed/);
  });

  it('maps the recorded error events to session log kinds', () => {
    const events = deviceJson<Record<string, { method: string; params: Record<string, unknown> }>>('cdp-error-events.json', { origin: 'https://app.test' });
    expect(logLineOf(events['page-error'] as never, AT)).toEqual({ at: AT, kind: 'page-error', text: expect.stringContaining('contract page error') });
    expect(logLineOf(events['console-error'] as never, AT)?.kind).toBe('console-error');
    expect(logLineOf(events['response-5xx'] as never, AT)?.text).toBe('500 https://app.test/site/fail');
    expect(logLineOf({ method: 'Runtime.consoleAPICalled', params: { type: 'log', args: [] } }, AT)).toBeNull();
    expect(logLineOf({ method: 'Network.loadingFailed', params: { canceled: false, errorText: 'net::ERR_FAILED', type: 'Fetch' } }, AT)?.kind).toBe('request-failed');
  });
});
