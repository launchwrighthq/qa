// `lw qa device <verb>` (spec 2.9): parses the verb and its flags, runs it through the
// `DeviceVerbs` service and prints the outcome. Every verb takes `--device <name>`; with one device
// in config it may be left out.
import { isCodedError } from '../../kernel/index.mts';
import { parseCommandArgs } from '../../kernel/services/args.mts';
import type { QaCommandOptions, QaSubcommand } from '../../index.mts';
import { qaConfigOf } from '../config.mts';
import { DeviceVerbs, type Verb, type VerbArgs, VERBS } from '../services/device-verbs.mts';
import { type DeviceDeps, systemDeviceDeps } from '../services/process.mts';
import { createDeviceContext, type DeviceContext } from '../services/rigs.mts';

const USAGE = `usage: lw qa device <verb> [--device <name>] [args]
  list                       rigs and devices from qa.device
  doctor                     ssh, adb, the SDK, ios_webkit_debug_proxy, scrcpy, ffmpeg and pairing, each with its fix
  open --bot <bot> | --url <url>   boot, apply the ingress, open the Mini App or the page, attach
  eval <js | @file>          evaluate in the visible page; --probe video reads every <video>
  logs [seconds]             page errors, console output and failed requests (default 15 s)
  mirror                     scrcpy the Android screen onto this machine
  tap <label> [--x 0..1]     tap a native control by its accessibility label
  point <x> <y>              tap a screen point
  back                       the system back gesture
  key <code>                 an Android keyevent
  shot [file]                a PNG of the screen
  record <seconds> [file]    a video of the screen
  snapshot [label]           copy the AVD folder on the rig (cp -c)
  restore [path] --force     put a snapshot back over the AVD
  install [--force]          the pinned Telegram APK
  down                       stop the emulator, clear the ingress, close the ssh master, end a BrowserStack session
  budget                     BrowserStack minutes used and the per-run budget`;

export function parseDeviceArgs(args: string[]): VerbArgs {
  const parsed = parseCommandArgs({ values: ['device', 'bot', 'url', 'x', 'match', 'package', 'probe'], switches: ['force'] }, args);
  const flags: Record<string, string | true> = { ...parsed.values };
  for (const name of parsed.switches) flags[name] = true;
  return { device: parsed.values.device, flags, rest: parsed.positionals };
}

/** Runs `lw qa device` with explicit seams. The default export uses real processes. */
export async function runDeviceCommand(args: string[], opts: QaCommandOptions, deps: DeviceDeps = systemDeviceDeps(opts.cwd, opts.processEnv)): Promise<number> {
  const [verb, ...rest] = args;
  if (!verb || verb === '--help' || verb === '-h' || !(VERBS as readonly string[]).includes(verb)) {
    if (verb && verb !== '--help' && verb !== '-h') opts.err(`lw qa device: unknown verb ${verb}`);
    opts.err(USAGE);
    return 2;
  }
  let parsed: VerbArgs;
  let ctx: DeviceContext;
  try {
    parsed = parseDeviceArgs(rest);
    ctx = createDeviceContext(qaConfigOf(opts.config), deps);
  } catch (err) {
    if (!isCodedError(err)) throw err;
    opts.err(`lw qa device ${verb}: ${err.message}`);
    return 2;
  }
  try {
    return await new DeviceVerbs(ctx, opts).run(verb as Verb, parsed);
  } catch (err) {
    if (!isCodedError(err)) throw err;
    opts.err(`lw qa device ${verb}: ${err.message} [${err.code}]`);
    return err.code === 'qa.device.usage' ? 2 : 1;
  }
}

const qaDevice: QaSubcommand = {
  name: 'device',
  summary: 'Rigs and devices: list, doctor, open, eval, logs, mirror, tap, shot, record, snapshot, restore, install, down, budget',
  run: (args, opts) => runDeviceCommand(args, opts),
};

export default qaDevice;
