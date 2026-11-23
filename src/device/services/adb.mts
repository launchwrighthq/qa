// adb against one device, local or on a rig (spec 2.8 `android-adb`). The adb client runs on this
// machine; on an ssh rig it talks to the rig's adb server through the master, so binary output
// (`screencap`, a recording) rides the same socket. Parsers are pure and take captured text.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { type DeviceDeps, orFail, out, type ProcessResult, type RunningProcess, said, type StartOptions } from './process.mts';
import type { Rig } from './rigs.mts';

export interface Adb {
  readonly serial: string;
  readonly rig: Rig;
  run(args: string[], opts?: { timeoutMs?: number }): Promise<ProcessResult>;
  start(args: string[], opts: Pick<StartOptions, 'timeoutMs'>): Promise<RunningProcess>;
  /** `adb shell <args>`, failing with `code` on a non-zero exit. Returns stdout. */
  shell(args: string[], code?: string): Promise<string>;
}

export function createAdb(rig: Rig, serial: string, deps: DeviceDeps, bin: string): Adb {
  const argv = async (args: string[]): Promise<string[]> => [...(await rig.adbServer()), '-s', serial, ...args];
  const adb: Adb = {
    serial,
    rig,
    async run(args, opts) {
      return deps.run.run(bin, await argv(args), { timeoutMs: opts?.timeoutMs ?? 60_000 });
    },
    async start(args, opts) {
      return deps.run.start(bin, await argv(args), opts);
    },
    async shell(args, code = 'qa.device.adb') {
      return orFail(await adb.run(['shell', ...args]), code, `adb -s ${serial} shell ${args.join(' ')}`, { serial });
    },
  };
  return adb;
}

/** One row of `adb devices`. */
export interface AdbDevice {
  serial: string;
  state: string;
}

/** `adb devices` output, every state kept: `offline` and `unauthorized` are answers. */
export function parseDevices(stdout: string): AdbDevice[] {
  return stdout
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 2 && p[0])
    .map(([serial, state]) => ({ serial: serial as string, state: state as string }));
}

/** The state of `serial` on the adb server of `rig`, or `absent`. */
export async function deviceState(rig: Rig, serial: string, deps: DeviceDeps, bin: string): Promise<string> {
  const res = await deps.run.run(bin, [...(await rig.adbServer()), 'devices']);
  if (res.code !== 0) {
    throw new LaunchwrightError('qa.device.adb', `adb devices failed (exit ${res.code}): ${said(res)}`, { context: { rig: rig.name } });
  }
  return parseDevices(out(res)).find((d) => d.serial === serial)?.state ?? 'absent';
}

/**
 * The lock screen from `dumpsys window policy`: `open` when no lock screen shows, `swipe` when it
 * shows without a credential, `credential` when a PIN, pattern or password guards it.
 */
export function parseKeyguard(text: string): 'open' | 'swipe' | 'credential' {
  const block = text.slice(text.indexOf('KeyguardServiceDelegate'));
  if (!/^\s*showing=true\b/m.test(block)) return 'open';
  return /^\s*inputRestricted=true\b/m.test(block) ? 'credential' : 'swipe';
}

export async function keyguard(adb: Adb): Promise<'open' | 'swipe' | 'credential'> {
  return parseKeyguard(await adb.shell(['dumpsys', 'window', 'policy']));
}

// The accessibility tree ---------------------------------------------------------------------

export interface UiNode {
  text: string;
  desc: string;
  id: string;
  cls: string;
  clickable: boolean;
  bounds: { x1: number; y1: number; x2: number; y2: number } | null;
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Every `<node>` of a uiautomator dump. uiautomator writes flat, double-quoted attributes, which is
 * the narrow shape this reads. It is not a general XML parser.
 */
export function parseNodes(xml: string): UiNode[] {
  const nodes: UiNode[] = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of (m[1] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1] as string] = decodeEntities(a[2] as string);
    const b = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attrs.bounds ?? '');
    nodes.push({
      text: attrs.text ?? '',
      desc: attrs['content-desc'] ?? '',
      id: attrs['resource-id'] ?? '',
      cls: attrs.class ?? '',
      clickable: attrs.clickable === 'true',
      bounds: b ? { x1: Number(b[1]), y1: Number(b[2]), x2: Number(b[3]), y2: Number(b[4]) } : null,
    });
  }
  return nodes;
}

const labelOf = (n: UiNode): string => n.text || n.desc;

/**
 * The node whose text or content description holds `needle`, the shortest label first. A message
 * that quotes a button label is longer than the button, so the shortest match is the control.
 */
export function findNode(nodes: UiNode[], needle: string): UiNode | null {
  return nodes.filter((n) => n.bounds && labelOf(n).includes(needle)).sort((a, b) => labelOf(a).length - labelOf(b).length)[0] ?? null;
}

/** The screen size, from the largest bounds in the tree. */
export function screenSize(nodes: UiNode[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const n of nodes) {
    if (!n.bounds) continue;
    width = Math.max(width, n.bounds.x2);
    height = Math.max(height, n.bounds.y2);
  }
  return { width, height };
}

/** `wm size` output to the physical size. An override line wins over the physical line. */
export function parseWmSize(stdout: string): { width: number; height: number } | null {
  const over = /Override size:\s*(\d+)x(\d+)/.exec(stdout);
  const phys = /Physical size:\s*(\d+)x(\d+)/.exec(stdout);
  const m = over ?? phys;
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/** The dump file on the device. `/dev/tty` is missing on some images and writes errors into the XML. */
const DUMP_PATH = '/sdcard/window_dump.xml';

/** The accessibility tree as XML. uiautomator refuses while the UI animates, so the caller retries. */
export async function uiDump(adb: Adb): Promise<string | null> {
  const dumped = await adb.run(['shell', 'uiautomator', 'dump', DUMP_PATH]);
  if (!/dumped to/i.test(`${out(dumped)}${dumped.stderr}`)) return null;
  const read = await adb.run(['shell', 'cat', DUMP_PATH]);
  const xml = out(read);
  return read.code === 0 && xml.includes('<hierarchy') ? xml : null;
}

// Pixels and touch ---------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A PNG of the whole screen. `exec-out`, because `shell` may rewrite LF to CRLF and break it. */
export async function screencap(adb: Adb): Promise<Buffer> {
  const res = await adb.run(['exec-out', 'screencap', '-p']);
  if (res.code !== 0) throw new LaunchwrightError('qa.device.screencap', `screencap on ${adb.serial} failed: ${said(res)}`, { context: { serial: adb.serial } });
  if (!res.stdout.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new LaunchwrightError('qa.device.screencap', `screencap on ${adb.serial} returned ${res.stdout.length} bytes that are not a PNG.`, {
      context: { serial: adb.serial },
    });
  }
  return res.stdout;
}

export async function tap(adb: Adb, x: number, y: number): Promise<void> {
  await adb.shell(['input', 'tap', String(Math.round(x)), String(Math.round(y))]);
}

/**
 * The system back gesture: a swipe in from the left edge. It is not KEYCODE_BACK, and an app can
 * tell the two apart.
 */
export async function backGesture(adb: Adb, height: number): Promise<void> {
  const y = String(Math.round(height / 2));
  await adb.shell(['input', 'swipe', '2', y, String(Math.round(height / 3)), y, '200']);
}

export async function keyevent(adb: Adb, key: string): Promise<void> {
  await adb.shell(['input', 'keyevent', key]);
}

/** The screen size from `wm size`. */
export async function wmSize(adb: Adb): Promise<{ width: number; height: number }> {
  const text = await adb.shell(['wm', 'size']);
  const size = parseWmSize(text);
  if (!size) throw new LaunchwrightError('qa.device.adb', `wm size on ${adb.serial} printed no size: ${text.trim().slice(0, 120)}`);
  return size;
}

// Recording ----------------------------------------------------------------------------------

/** `screenrecord` stops itself at 180 s. The evidence cap (`qa.evidence.videoCapS`) is lower. */
export const SCREENRECORD_MAX_S = 180;
/** The seconds that the adb client of a recording may run past `--time-limit`: the stop and the file close. */
const SCREENRECORD_GRACE_S = 30;

/** The `--time-limit` of a recording: whole seconds from 1 to `SCREENRECORD_MAX_S`. */
function screenrecordCapS(seconds: number): number {
  return Math.min(Math.max(1, Math.round(seconds)), SCREENRECORD_MAX_S);
}

/** The `adb shell screenrecord` arguments. `--time-limit` is always set, so a clip ends by itself. */
export function screenrecordArgs(seconds: number, remote: string, size?: string): string[] {
  const capped = screenrecordCapS(seconds);
  return ['shell', 'screenrecord', '--time-limit', String(capped), ...(size ? ['--size', size] : []), remote];
}

/** A clip in progress. */
export interface Recording {
  readonly path: string;
  readonly startedAt: number;
  stop(): Promise<Buffer>;
}

/**
 * Starts `screenrecord` and returns. `stop` sends SIGINT on the device, because a killed recorder
 * leaves an MP4 with no index, then pulls the file and removes it from the device.
 */
export async function startScreenrecord(adb: Adb, deps: DeviceDeps, seconds: number, label: string): Promise<Recording> {
  const remote = `/sdcard/lw-qa-${label.replace(/[^\w.-]/g, '_')}.mp4`;
  await adb.run(['shell', 'rm', '-f', remote]);
  const proc = await adb.start(screenrecordArgs(seconds, remote), { timeoutMs: (screenrecordCapS(seconds) + SCREENRECORD_GRACE_S) * 1000 });
  const startedAt = deps.clock.now();
  return {
    path: remote,
    startedAt,
    async stop() {
      await adb.run(['shell', 'pkill', '-INT', '-x', 'screenrecord']);
      await proc.done;
      const pulled = await adb.run(['exec-out', 'cat', remote], { timeoutMs: 120_000 });
      if (pulled.code !== 0 || pulled.stdout.length === 0) {
        throw new LaunchwrightError('qa.device.record', `pulling ${remote} from ${adb.serial} failed: ${said(pulled) || 'empty file'}`);
      }
      if (pulled.stdout.subarray(4, 8).toString('latin1') !== 'ftyp') {
        throw new LaunchwrightError('qa.device.record', `${remote} on ${adb.serial} is not an MP4 (${pulled.stdout.length} bytes).`);
      }
      await adb.run(['shell', 'rm', '-f', remote]);
      return pulled.stdout;
    },
  };
}

// WebView devtools sockets -------------------------------------------------------------------

/** One devtools socket: `webview_devtools_remote_<pid>` or `chrome_devtools_remote`. */
export interface DevtoolsSocket {
  name: string;
  pid: number | null;
  kind: 'webview' | 'other';
  listening: boolean;
  process: string | null;
}

/**
 * The devtools sockets in `/proc/net/unix`, one per name. A name shows twice once a client is
 * attached (the listener and the accepted connection), and the listener wins. `adb shell` runs on a
 * pty, so each line is trimmed: a CR left on the socket name forwards nothing.
 */
export function devtoolsSockets(text: string): Omit<DevtoolsSocket, 'process'>[] {
  const byName = new Map<string, Omit<DevtoolsSocket, 'process'>>();
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8 || parts[0] === 'Num' || !(parts[0] as string).endsWith(':')) continue;
    const raw = parts[7] as string;
    if (!raw.startsWith('@')) continue;
    const name = raw.slice(1);
    if (!/_devtools_remote(_\d+)?$/.test(name)) continue;
    const pid = /_(\d+)$/.exec(name);
    const listening = parts[5] === '01';
    const seen = byName.get(name);
    if (seen) {
      seen.listening ||= listening;
      continue;
    }
    byName.set(name, { name, pid: pid ? Number(pid[1]) : null, kind: name.startsWith('webview_devtools_remote') ? 'webview' : 'other', listening });
  }
  return [...byName.values()];
}

/**
 * The process name from `/proc/<pid>/cmdline`: NUL-separated, the first field is the name.
 * `/proc/<pid>/comm` is no use: the kernel cuts it to 15 characters.
 */
export function processNameFromCmdline(text: string): string {
  return (text.split('\0')[0] ?? '').trim();
}

/** True when the process name is the package or one of its `<pkg>:<suffix>` processes. */
export function processBelongsTo(name: string, pkg: string): boolean {
  return name === pkg || name.startsWith(`${pkg}:`);
}

/**
 * True for the devtools socket of a browser: `chrome_devtools_remote` (Chrome and Chromium builds)
 * or `<pkg>_devtools_remote`. An app that embeds Stetho publishes `stetho_<pkg>_devtools_remote`,
 * which is not a browser.
 */
export function isBrowserSocket(name: string, pkg: string): boolean {
  return name === 'chrome_devtools_remote' || name === `${pkg}_devtools_remote`;
}

/** The sockets, the package's own first, then its child processes, then other WebViews. */
export function chooseSocket(sockets: DevtoolsSocket[], pkg: string): DevtoolsSocket[] {
  const rank = (s: DevtoolsSocket): number =>
    s.process === pkg ? 0 : s.process && processBelongsTo(s.process, pkg) ? 1 : s.kind === 'webview' ? 2 : 3;
  return [...sockets].sort((a, b) => rank(a) - rank(b) || (a.pid ?? 0) - (b.pid ?? 0));
}

/** Every devtools socket on the device, each with the process that published it, ranked for `pkg`. */
export async function sockets(adb: Adb, pkg: string): Promise<DevtoolsSocket[]> {
  const found = devtoolsSockets(await adb.shell(['cat', '/proc/net/unix']));
  const named: DevtoolsSocket[] = [];
  for (const s of found) {
    let proc: string | null = null;
    if (s.pid !== null) {
      const res = await adb.run(['exec-out', 'cat', `/proc/${s.pid}/cmdline`]);
      proc = res.code === 0 ? processNameFromCmdline(out(res)) || null : null;
    }
    named.push({ ...s, process: proc });
  }
  return chooseSocket(named, pkg);
}

/** The local port that an existing `adb forward --list` row holds for the socket, or null. */
export function parseExistingForward(listing: string, socketName: string): number | null {
  const remote = `localabstract:${socketName}`;
  for (const line of listing.split('\n')) {
    const m = /\btcp:(\d+)\s+(\S+)\s*$/.exec(line.trim());
    if (m && m[2] === remote) return Number(m[1]);
  }
  return null;
}

/** A forward of a devtools socket, as the rig sees it. */
export interface SocketForward {
  /** The port on the machine that runs the adb server. */
  port: number;
  /** True when the forward was there before: it is kept on close. */
  reused: boolean;
}

/**
 * `adb forward tcp:0 localabstract:<socket>`. An existing forward of the socket is reused, because
 * a second port for the same socket is a port no ssh forward points at.
 */
export async function forwardSocket(adb: Adb, socketName: string): Promise<SocketForward> {
  const list = await adb.run(['forward', '--list']);
  const held = parseExistingForward(out(list), socketName);
  if (held !== null) return { port: held, reused: true };
  const res = await adb.run(['forward', 'tcp:0', `localabstract:${socketName}`]);
  const text = orFail(res, 'qa.device.forward', `adb forward of ${socketName}`).trim();
  if (!/^\d+$/.test(text)) {
    throw new LaunchwrightError('qa.device.forward', `adb forward of ${socketName} printed ${JSON.stringify(text)}, which names no port.`);
  }
  return { port: Number(text), reused: false };
}

export async function removeForward(adb: Adb, port: number): Promise<void> {
  const res = await adb.run(['forward', '--remove', `tcp:${port}`]);
  orFail(res, 'qa.device.forward', `adb forward --remove tcp:${port}`);
}
