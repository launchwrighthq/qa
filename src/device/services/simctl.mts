// `xcrun simctl` on a rig (spec 2.8 `ios-simulator`): open a URL, take a screenshot, record a
// video. `simctl` has no input verb and no page access. A simulator can hold a signed-in Telegram,
// so nothing here boots, erases or shuts one down, and `openUrl` refuses a `tg://` link.
import { LaunchwrightError } from '../../kernel/index.mts';
import { shq } from '../../kernel/services/text.mts';
import { orFail, said } from './process.mts';
import { type Rig } from './rigs.mts';

/** `xcrun` ships with macOS and needs no PATH change. */
const XCRUN = '/usr/bin/xcrun';

export interface SimDevice {
  name: string;
  udid: string;
  runtime: string;
  state: string;
  booted: boolean;
  available: boolean;
}

/** `simctl list devices` text to one row per simulator. The UDID is the anchor, not the name. */
export function parseSimList(stdout: string): SimDevice[] {
  const devices: SimDevice[] = [];
  let runtime = '';
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line) continue;
    const heading = /^--\s*(.+?)\s*--$/.exec(line);
    if (heading) {
      runtime = heading[1] as string;
      continue;
    }
    const row = /^\s{2,}(.+?)\s+\(([0-9A-Fa-f-]{36})\)\s+\(([A-Za-z]+)\)(.*)$/.exec(line);
    if (!row) continue;
    devices.push({
      name: row[1] as string,
      udid: row[2] as string,
      runtime,
      state: row[3] as string,
      booted: row[3] === 'Booted',
      available: !/unavailable/i.test(row[4] ?? ''),
    });
  }
  return devices;
}

function simctl(args: string[]): string {
  return [XCRUN, 'simctl', ...args].map(shq).join(' ');
}

export async function listSimulators(rig: Rig): Promise<SimDevice[]> {
  return parseSimList(orFail(await rig.exec(simctl(['list', 'devices'])), 'qa.device.simctl', 'simctl list devices'));
}

/** The simulator a device addresses: its UDID, else the one booted simulator. */
export async function bootedSimulator(rig: Rig, udid?: string): Promise<SimDevice> {
  const all = await listSimulators(rig);
  const booted = all.filter((d) => d.booted);
  const hit = udid ? booted.find((d) => d.udid === udid) : booted.length === 1 ? booted[0] : undefined;
  if (hit) return hit;
  const why = udid ? 'the configured simulator is not booted' : `${booted.length} simulators are booted, and the device names no udid`;
  throw new LaunchwrightError(
    'qa.device.simctl.booted',
    `No simulator to drive on rig ${rig.name}: ${why}. Booting one is an operator step, because a simulator can hold a signed-in Telegram.`,
  );
}

/** Opens an http(s) URL in Safari. A `tg://` link would act as the signed-in account, so it is refused. */
export async function openUrl(rig: Rig, udid: string, url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new LaunchwrightError('qa.device.simctl', `simctl openurl takes an http(s) URL, not ${url.split(':')[0]}:.`);
  orFail(await rig.exec(simctl(['openurl', udid, url])), 'qa.device.simctl', 'simctl openurl');
}

/** A PNG of the whole simulator screen, written on the rig, read back, and removed there. */
export async function simScreenshot(rig: Rig, udid: string, remotePath: string): Promise<Buffer> {
  const text = orFail(await rig.exec(simctl(['io', udid, 'screenshot', remotePath])), 'qa.device.simctl', 'simctl io screenshot');
  if (!/Wrote screenshot to/i.test(text)) throw new LaunchwrightError('qa.device.simctl', `simctl io screenshot said nothing about ${remotePath}.`);
  const read = await rig.exec(`cat ${shq(remotePath)} && rm -f ${shq(remotePath)}`, { timeoutMs: 60_000 });
  orFail(read, 'qa.device.simctl', `reading ${remotePath}`);
  return read.stdout;
}

/**
 * Starts `simctl io recordVideo` in the background on the rig and returns its pid. `stopSimVideo`
 * sends SIGINT, which makes the recorder write the file index, then reads the file back.
 */
export async function startSimVideo(rig: Rig, udid: string, remotePath: string): Promise<number> {
  const cmd = `rm -f ${shq(remotePath)}; nohup ${simctl(['io', udid, 'recordVideo', '--codec=h264', '--force', remotePath])} >/dev/null 2>&1 & echo $!`;
  const pid = Number(orFail(await rig.exec(cmd), 'qa.device.simctl', 'simctl io recordVideo').trim().split('\n').pop());
  if (!Number.isInteger(pid) || pid <= 0) throw new LaunchwrightError('qa.device.simctl', 'simctl io recordVideo printed no pid.');
  return pid;
}

export async function stopSimVideo(rig: Rig, pid: number, remotePath: string): Promise<Buffer> {
  const wait = `kill -INT ${pid}; i=0; while kill -0 ${pid} 2>/dev/null; do i=$((i+1)); [ $i -ge 50 ] && exit 3; sleep 0.2; done`;
  const stopped = await rig.exec(wait, { timeoutMs: 30_000 });
  if (stopped.code !== 0) throw new LaunchwrightError('qa.device.simctl', `The simulator recorder (pid ${pid}) did not stop within 10 s: ${said(stopped)}`);
  const read = await rig.exec(`cat ${shq(remotePath)} && rm -f ${shq(remotePath)}`, { timeoutMs: 120_000 });
  orFail(read, 'qa.device.simctl', `reading ${remotePath}`);
  if (read.stdout.length === 0) throw new LaunchwrightError('qa.device.simctl', 'The simulator recorder wrote an empty file.');
  return read.stdout;
}
