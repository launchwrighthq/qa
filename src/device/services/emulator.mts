// An Android emulator on a rig (spec 2.8 `android-emulator`): boot, stop, snapshot, restore. A boot
// never loads the emulator's own quick-boot snapshot: that file is written at shutdown, so after a
// crash it restores a state from before a sign-in. A snapshot here is a deliberate copy of the AVD
// folder, `cp -c` (a clone on APFS, a plain copy elsewhere).
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { shq } from '@launchwrighthq/kernel/text';
import type { EmulatorDeviceKeys } from '../config.mts';
import type { Adb } from './adb.mts';
import { type DeviceDeps, orFail, out, poll, said } from './process.mts';
import { type Rig } from './rigs.mts';

export function emulatorSerial(port: number): string {
  return `emulator-${port}`;
}

/** The AVD folder on the rig, as a shell word that expands `$HOME`. The name is `[\w.-]+`. */
function avdDir(avd: string): string {
  return `"$HOME/.android/avd/${avd}.avd"`;
}

function snapshotRoot(rig: Rig): string {
  return `${rig.stateDir}/snapshots`;
}

/** The shell that prints the Android SDK root of the rig, or exits 1. */
export const SDK_ROOT_SCRIPT =
  'for d in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do [ -n "$d" ] && [ -d "$d" ] && { echo "$d"; exit 0; }; done; exit 1';

export async function sdkRoot(rig: Rig): Promise<string | null> {
  const res = await rig.exec(SDK_ROOT_SCRIPT);
  return res.code === 0 ? out(res).trim().split('\n')[0] || null : null;
}

export async function avdExists(rig: Rig, avd: string): Promise<boolean> {
  return (await rig.exec(`test -d ${avdDir(avd)}`)).code === 0;
}

/** True when the emulator answers `sys.boot_completed=1`. A listed serial alone can be a dying process. */
export async function booted(adb: Adb): Promise<boolean> {
  const res = await adb.run(['shell', 'getprop', 'sys.boot_completed'], { timeoutMs: 15_000 });
  return res.code === 0 && out(res).trim() === '1';
}

/** The emulator arguments. No snapshot load or save, no window, no audio. */
export function emulatorArgs(keys: EmulatorDeviceKeys): string[] {
  return ['-avd', keys.avd, '-port', String(keys.port), '-no-boot-anim', '-no-audio', '-no-snapshot', '-no-window', '-netdelay', 'none', '-netspeed', 'full', '-gpu', keys.gpu];
}

/** Boots the AVD on the rig unless it is up, and waits up to 7 min for `sys.boot_completed`. */
export async function bootEmulator(rig: Rig, adb: Adb, keys: EmulatorDeviceKeys, deps: DeviceDeps): Promise<'already' | 'booted'> {
  if (await booted(adb)) return 'already';
  const sdk = await sdkRoot(rig);
  if (!sdk) throw new LaunchwrightError('qa.device.sdk', `Rig ${rig.name} has no Android SDK. Install the SDK command-line tools there, then the emulator package.`);
  if (!(await avdExists(rig, keys.avd))) {
    throw new LaunchwrightError('qa.device.avd', `Rig ${rig.name} has no AVD ${keys.avd}. Create it with avdmanager on that rig.`, { context: { avd: keys.avd } });
  }
  const log = `${rig.stateDir}/${keys.avd}.log`;
  const start = `mkdir -p ${shq(rig.stateDir)} && nohup ${shq(`${sdk}/emulator/emulator`)} ${emulatorArgs(keys).map(shq).join(' ')} > ${shq(log)} 2>&1 & echo started`;
  orFail(await rig.exec(start), 'qa.device.emulator', `starting AVD ${keys.avd} on rig ${rig.name}`);
  await poll(deps.clock, async () => ((await booted(adb)) ? true : null), {
    timeoutMs: 420_000,
    everyMs: 2000,
    code: 'qa.device.emulator.boot',
    what: `The boot of AVD ${keys.avd} on rig ${rig.name} (log: ${log})`,
  });
  return 'booted';
}

/**
 * Stops the emulator with `adb emu kill`, which flushes userdata on the way out, and waits up to
 * 90 s for it to leave. A SIGTERM soon after the kill cuts the flush short and loses a sign-in.
 * `adb emu` dials the console port on the machine of the adb client, so on an ssh rig the kill
 * runs on the rig, where the console listens.
 */
export async function stopEmulator(rig: Rig, adb: Adb, deps: DeviceDeps): Promise<void> {
  const kill = rig.remote ? await rig.exec(`adb -s ${shq(adb.serial)} emu kill`) : await adb.run(['emu', 'kill']);
  orFail(kill, 'qa.device.emulator.stop', `adb emu kill of ${adb.serial} on rig ${rig.name}`, { rig: rig.name });
  await poll(deps.clock, async () => ((await booted(adb)) ? null : true), {
    timeoutMs: 90_000,
    everyMs: 500,
    code: 'qa.device.emulator.stop',
    what: `The clean shutdown of ${adb.serial}`,
  });
}

function safeLabel(label: string): string {
  return label.replace(/[^\w-]/g, '').slice(0, 40);
}

/** Copies the AVD folder to `<stateDir>/snapshots/<avd>-<stamp>[-label]`. Returns the snapshot path. */
export async function snapshotAvd(rig: Rig, avd: string, label: string, now: number): Promise<string> {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = label ? `${stamp}-${safeLabel(label)}` : stamp;
  const dest = `${snapshotRoot(rig)}/${avd}-${tag}`;
  const cmd = `mkdir -p ${shq(snapshotRoot(rig))} && (cp -Rc ${avdDir(avd)} ${shq(dest)} 2>/dev/null || cp -R ${avdDir(avd)} ${shq(dest)}) && test -f ${shq(`${dest}/userdata-qemu.img.qcow2`)}`;
  const res = await rig.exec(cmd, { timeoutMs: 600_000 });
  if (res.code !== 0) throw new LaunchwrightError('qa.device.snapshot', `Snapshot of AVD ${avd} on rig ${rig.name} failed or has no userdata: ${said(res)}`);
  return dest;
}

/** The snapshots of the AVD, newest first. */
export async function listSnapshots(rig: Rig, avd: string): Promise<string[]> {
  const res = await rig.exec(`ls -1dt ${shq(snapshotRoot(rig))}/${avd}-* 2>/dev/null || true`);
  return out(res).trim().split('\n').filter(Boolean);
}

/**
 * Replaces the AVD with a snapshot. It refuses while the emulator runs, and without `force`:
 * a restore erases the current AVD, and with it a Telegram sign-in that only its owner can redo.
 */
export async function restoreAvd(rig: Rig, adb: Adb, avd: string, from: string | undefined, force: boolean): Promise<string> {
  if (await booted(adb)) throw new LaunchwrightError('qa.device.restore', `The emulator ${adb.serial} is running. Stop it with lw qa device down first.`);
  if (!force) {
    throw new LaunchwrightError(
      'qa.device.telegram.signed-in',
      `Restore replaces AVD ${avd}, and the Telegram sign-in on it. Run it again with --force after the owner of that account agrees.`,
    );
  }
  const snaps = await listSnapshots(rig, avd);
  const src = from ?? snaps[0];
  if (!src) throw new LaunchwrightError('qa.device.restore', `No snapshot of AVD ${avd} on rig ${rig.name}. Take one with lw qa device snapshot.`);
  if (!snaps.includes(src)) throw new LaunchwrightError('qa.device.restore', `${src} is not a snapshot of AVD ${avd}. Snapshots: ${snaps.join(', ') || 'none'}.`);
  const cmd = `rm -rf ${avdDir(avd)} && (cp -Rc ${shq(src)} ${avdDir(avd)} 2>/dev/null || cp -R ${shq(src)} ${avdDir(avd)})`;
  orFail(await rig.exec(cmd, { timeoutMs: 600_000 }), 'qa.device.restore', `restoring AVD ${avd} from ${src}`);
  return src;
}
