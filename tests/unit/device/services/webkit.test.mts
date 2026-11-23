import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { consoleLogKind } from '../../../../src/device/services/session-base.mts';
import {
  framed,
  localise,
  parseDeviceList,
  pickPage,
  proxyCommand,
  unframe,
  webkitConsole,
  webkitEvaluate,
  webkitSnapshot,
  withTarget,
} from '../../../../src/device/services/webkit.mts';
import { pngSize } from '../../../../src/index.mts';
import { deviceJson, FakeSite, fakeDeps, webkitSockets } from '../../../support/device.mts';

const site = (): FakeSite => new FakeSite('https://app.test/site');
const pagePort = 9222;

describe('the WebKit inspector wire of ios_webkit_debug_proxy', () => {
  it('reads the recorded device list with the page port of each phone', () => {
    expect(parseDeviceList(deviceJson('webkit-device-list.json'))).toEqual([{ id: 'FAKE-UDID-0001', name: 'Fixture iPhone', version: '18.6', port: pagePort }]);
  });

  it('refuses a device row without a page port and names only its index', () => {
    expect(() => parseDeviceList([{ deviceId: 'SECRET-UDID', url: '' }])).toThrow(/^Device 0 in the proxy list has no page port/);
  });

  it('picks a document page and skips JSContext and blank pages', () => {
    const pages = deviceJson('webkit-pages.json', { url: 'https://app.test/site/' });
    expect(pickPage(pages)).toMatchObject({ url: 'https://app.test/site/' });
    expect(pickPage(pages, 'APP.TEST')).toMatchObject({ title: 'contract' });
    expect(() => pickPage(pages, 'other.test')).toThrow(/No page matches "other.test"/);
    expect(() => pickPage([{ title: 'JSContext', url: '' }])).toThrow(/Unlock the iPhone/);
  });

  it('wraps a command for the Target domain with the message as a string', () => {
    const f = framed('page-1', 3, 'Runtime.evaluate', { expression: '1' });
    expect(f).toEqual({ id: 3, method: 'Target.sendMessageToTarget', params: { targetId: 'page-1', message: '{"id":3,"method":"Runtime.evaluate","params":{"expression":"1"}}' } });
    expect(unframe(JSON.stringify(deviceJson<{ targetCreated: object }>('webkit-frames.json', { url: '', origin: '' }).targetCreated))).toEqual({ kind: 'target-created', targetId: 'page-1' });
  });

  it('points the phone socket URL down the local forward', () => {
    expect(localise('ws://localhost:9222/devtools/page/1', 41002)).toBe('ws://127.0.0.1:41002/devtools/page/1');
  });

  it('builds the console command that starts the proxy for the rig ports', () => {
    expect(proxyCommand(9221, 9222)).toBe('sudo ios_webkit_debug_proxy -c null:9221,:9222-9299');
  });
});

describe('one inspector session on a page', () => {
  it('evaluates an object in two calls because WebKit ignores returnByValue promises', async () => {
    const s = site();
    const socket = webkitSockets(s);
    const deps = fakeDeps({ root: await tmpDir(), socket });
    const page = pickPage(deviceJson('webkit-pages.json', { url: s.href() }));
    const value = await withTarget(deps, page, 41002, 5000, (session) => webkitEvaluate(session, '[performance.timeOrigin, document.readyState]'));
    expect(value).toEqual([1, 'complete']);
    expect(socket.origins).toEqual(['http://127.0.0.1:41002']);
  });

  it('captures the viewport as a PNG with Page.snapshotRect', async () => {
    const s = site();
    const deps = fakeDeps({ root: await tmpDir(), socket: webkitSockets(s) });
    const page = pickPage(deviceJson('webkit-pages.json', { url: s.href() }));
    const png = await withTarget(deps, page, 41002, 5000, (session) => webkitSnapshot(session));
    expect(pngSize(png)).toEqual({ width: 36, height: 64 });
  });

  it('collects the replayed console and maps each source to a log kind', async () => {
    const s = site();
    s.load('/site/errors');
    const deps = fakeDeps({ root: await tmpDir(), socket: webkitSockets(s) });
    const page = pickPage(deviceJson('webkit-pages.json', { url: s.href() }));
    const lines = await withTarget(deps, page, 41002, 5000, (session) => webkitConsole(deps, session, 500));
    expect(lines.map((l) => consoleLogKind(l))).toEqual(['console-error', 'response-5xx', 'page-error']);
    expect(consoleLogKind({ source: 'console-api', level: 'log', text: 'hello' })).toBeNull();
    expect(consoleLogKind({ source: 'network', level: 'error', text: 'Failed to load resource: The network connection was lost.' })).toBe('request-failed');
  });
});
