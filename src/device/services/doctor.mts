// `lw qa device doctor` (spec 2.9): can this machine and its rigs run the configured devices? It
// checks ssh, adb, the Android SDK, ios_webkit_debug_proxy, scrcpy, ffmpeg and pairing, and names
// the fix for each failure. It never installs, starts or stops anything. A check never throws: a
// failure is a row.
import { LaunchwrightError } from '../../kernel/index.mts';
import { deviceKeys, simulatorDeviceKeys } from '../config.mts';
import { deviceState, keyguard } from './adb.mts';
import { androidHandle, stateFix } from './android-session.mts';
import { budget, budgetLine, createBrowserstackClient } from './browserstack.mts';
import { type DeviceKind, deviceKind } from './device-kinds.mts';
import { avdExists, booted, sdkRoot } from './emulator.mts';
import { DEFAULT_WEBKIT_PORTS, deviceAccess, simulatorReadiness } from './ios-session.mts';
import { out, said } from './process.mts';
import { type DeviceContext, type ResolvedDevice, resolveDevice } from './rigs.mts';
import { listSimulators } from './simctl.mts';
import { proxyCommand } from './webkit.mts';

export interface DoctorCheck {
  /** `tool`, `rig <name>` or `device <name>`. */
  scope: string;
  name: string;
  ok: boolean;
  detail: string;
  /** The step that fixes a failure. */
  fix?: string;
  /** A failure that blocks no configured device: the doctor still exits 0. */
  optional?: boolean;
}

const pass = (scope: string, name: string, detail: string): DoctorCheck => ({ scope, name, ok: true, detail });
const fail = (scope: string, name: string, detail: string, fix: string, optional = false): DoctorCheck => ({ scope, name, ok: false, detail, fix, ...(optional ? { optional } : {}) });

/** The version in `scrcpy --version` output, as numbers. */
export function parseScrcpyVersion(text: string): number[] | null {
  const m = /scrcpy\s+v?(\d+(?:\.\d+)*)/i.exec(text);
  return m ? (m[1] as string).split('.').map(Number) : null;
}

/** True when `have` is the same as or newer than `want`. */
export function versionAtLeast(have: number[], want: number[]): boolean {
  for (let i = 0; i < Math.max(have.length, want.length); i += 1) {
    const a = have[i] ?? 0;
    const b = want[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/** Runs one check and turns a LaunchwrightError into a failed row with its message as the fix. */
async function guard(scope: string, name: string, fn: () => Promise<DoctorCheck>): Promise<DoctorCheck> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof LaunchwrightError) return fail(scope, name, err.code, err.message);
    throw err;
  }
}

async function toolChecks(ctx: DeviceContext, devices: ResolvedDevice[]): Promise<DoctorCheck[]> {
  const tools = ctx.config.device.tools;
  const run = (bin: string, args: string[]) => ctx.deps.run.run(bin, args, { timeoutMs: 15_000 });
  const android = devices.filter((d) => deviceKind(d.device.kind).access === 'adb');
  const checks: DoctorCheck[] = [];
  if (android.length > 0) {
    const adb = await run(tools.adb, ['version']);
    checks.push(
      adb.code === 0
        ? pass('tool', 'adb', out(adb).split('\n')[0]?.trim() ?? '')
        : fail('tool', 'adb', said(adb) || `exit ${adb.code}`, 'Install Android platform-tools (sdkmanager "platform-tools", or the distro adb), or set qa.device.tools.adb.'),
    );
    const usesScrcpy = android.some((d) => d.device.recorder === 'scrcpy');
    const sc = await run(tools.scrcpy, ['--version']);
    const have = sc.code === 0 ? parseScrcpyVersion(out(sc)) : null;
    const want = tools.scrcpyVersion.split('.').map(Number);
    const fix = `Install scrcpy ${tools.scrcpyVersion} or newer (github.com/Genymobile/scrcpy/releases), or set qa.device.tools.scrcpy. Older builds fail on Android 15 and later.`;
    if (!have) checks.push(fail('tool', 'scrcpy', said(sc) || 'not installed', fix, !usesScrcpy));
    else if (!versionAtLeast(have, want)) checks.push(fail('tool', 'scrcpy', `version ${have.join('.')} is older than ${tools.scrcpyVersion}`, fix, !usesScrcpy));
    else checks.push(pass('tool', 'scrcpy', `version ${have.join('.')}`));
  }
  if (devices.length > 0) {
    const ff = await run(tools.ffmpeg, ['-version']);
    checks.push(
      ff.code === 0
        ? pass('tool', 'ffmpeg', out(ff).split('\n')[0]?.trim() ?? '')
        : fail('tool', 'ffmpeg', said(ff) || 'not installed', 'Install ffmpeg: the blank-video check of every device video needs it. Or set qa.device.tools.ffmpeg.'),
    );
  }
  return checks;
}

async function rigChecks(ctx: DeviceContext, devices: ResolvedDevice[]): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  for (const name of [...new Set(devices.map((d) => d.rigName))].sort()) {
    const rig = ctx.rigs.get(name);
    if (rig.config.transport !== 'ssh') continue;
    checks.push(
      await guard(`rig ${name}`, 'ssh', async () => {
        await rig.ensure();
        return pass(`rig ${name}`, 'ssh', `master open to ${rig.config.host}, BatchMode=yes`);
      }),
    );
  }
  return checks;
}

async function androidChecks(ctx: DeviceContext, d: ResolvedDevice): Promise<DoctorCheck[]> {
  const scope = `device ${d.name}`;
  const checks: DoctorCheck[] = [];
  const h = androidHandle(ctx, d.name, deviceKind(d.device.kind).target);
  if (h.emulator) {
    const avd = h.emulator.avd;
    checks.push(
      await guard(scope, 'sdk', async () => {
        const root = await sdkRoot(h.rig);
        return root
          ? pass(scope, 'sdk', root)
          : fail(scope, 'sdk', `no Android SDK on rig ${h.rig.name}`, `Install the Android SDK command-line tools on rig ${h.rig.name}, then run sdkmanager "emulator" "platform-tools" and the system image of AVD ${avd}.`);
      }),
      await guard(scope, 'avd', async () =>
        (await avdExists(h.rig, avd)) ? pass(scope, 'avd', avd) : fail(scope, 'avd', `no AVD ${avd} on rig ${h.rig.name}`, `Create AVD ${avd} with avdmanager on rig ${h.rig.name}.`),
      ),
      await guard(scope, 'boot', async () =>
        pass(scope, 'boot', (await booted(h.adb)) ? `${h.adb.serial} booted` : `${h.adb.serial} not booted; lw qa device open boots it`),
      ),
    );
    return checks;
  }
  checks.push(
    await guard(scope, 'pairing', async () => {
      const state = await deviceState(h.rig, h.adb.serial, ctx.deps, ctx.config.device.tools.adb);
      return state === 'device' ? pass(scope, 'pairing', `${h.adb.serial} attached`) : fail(scope, 'pairing', `adb state ${state}`, stateFix(state, h.adb.serial, h.rig.name));
    }),
  );
  if (checks.at(-1)?.ok) {
    // A locked screen hides every page, so each row would fail its screenshot.
    checks.push(
      await guard(scope, 'screen lock', async () => {
        const lock = await keyguard(h.adb);
        if (lock === 'open') return pass(scope, 'screen lock', 'unlocked');
        if (lock === 'swipe') return fail(scope, 'screen lock', 'the lock screen shows', `Dismiss it: adb -s ${h.adb.serial} shell wm dismiss-keyguard on rig ${h.rig.name}.`);
        return fail(scope, 'screen lock', 'locked with a PIN, pattern or password', `A person unlocks ${d.name} by hand. lw never enters a credential.`);
      }),
    );
  }
  return checks;
}

async function iosChecks(ctx: DeviceContext, d: ResolvedDevice): Promise<DoctorCheck[]> {
  const scope = `device ${d.name}`;
  const rig = ctx.rigs.get(d.rigName);
  const [listPort, pagePort] = [rig.config.webkitPorts?.[0] ?? DEFAULT_WEBKIT_PORTS[0], rig.config.webkitPorts?.[1] ?? DEFAULT_WEBKIT_PORTS[1]];
  const proxy = await guard(scope, 'ios_webkit_debug_proxy', async () => {
    const res = await rig.exec('command -v ios_webkit_debug_proxy || true; echo ---; pgrep -x ios_webkit_debug_proxy | wc -l');
    const [head = '', tail = ''] = out(res).split('---');
    const path = head.trim().split('\n')[0] ?? '';
    if (!path) return fail(scope, 'ios_webkit_debug_proxy', `not installed on rig ${rig.name}`, `Run brew install ios-webkit-debug-proxy on rig ${rig.name}.`);
    if (!(Number(tail.trim()) > 0)) {
      return fail(scope, 'ios_webkit_debug_proxy', `installed on rig ${rig.name} and not running`, `Start it at the console of rig ${rig.name}: ${proxyCommand(listPort, pagePort)}. It runs under sudo, so lw never starts it.`);
    }
    return pass(scope, 'ios_webkit_debug_proxy', `running on rig ${rig.name}`);
  });
  const checks = [proxy];
  if (proxy.ok) {
    checks.push(
      await guard(scope, 'pairing', async () => {
        const access = await deviceAccess(ctx, d.name);
        await access.close();
        return pass(scope, 'pairing', 'the iPhone is in the proxy device list');
      }),
    );
  }
  return checks;
}

async function simulatorChecks(ctx: DeviceContext, d: ResolvedDevice): Promise<DoctorCheck[]> {
  const scope = `device ${d.name}`;
  const rig = ctx.rigs.get(d.rigName);
  const keys = deviceKeys(d.name, d.device, simulatorDeviceKeys);
  const sims = await guard(scope, 'simctl', async () => {
    const all = await listSimulators(rig);
    const up = all.filter((s) => s.booted && (!keys.udid || s.udid === keys.udid));
    return up.length > 0
      ? pass(scope, 'simctl', `${up.length} booted simulator(s)`)
      : fail(scope, 'simctl', 'no booted simulator', `Boot the simulator at the console of rig ${rig.name}. lw never boots one: it can hold a signed-in Telegram.`);
  });
  const reason = simulatorReadiness(d.name, keys);
  return [sims, reason ? fail(scope, 'input tool', 'no input tool is configured', reason) : pass(scope, 'input tool', String(keys.inputTool))];
}

async function cloudChecks(ctx: DeviceContext, d: ResolvedDevice): Promise<DoctorCheck[]> {
  const scope = `device ${d.name}`;
  const cfg = ctx.config.device.browserstack;
  return [
    await guard(scope, 'browserstack', async () => pass(scope, 'browserstack', budgetLine(await budget(createBrowserstackClient(cfg, ctx.deps)), cfg))),
  ];
}

/** The device checks of a kind, by the way lw reaches it. */
function checksOf(kind: DeviceKind): (ctx: DeviceContext, d: ResolvedDevice) => Promise<DoctorCheck[]> {
  if (kind.access === 'adb') return androidChecks;
  if (kind.access === 'webkit') return kind.simulator === true ? simulatorChecks : iosChecks;
  return cloudChecks;
}

/** Every check for one device, or for every configured device. */
export async function collectDoctor(ctx: DeviceContext, deviceName?: string): Promise<DoctorCheck[]> {
  const names = deviceName ? [deviceName] : Object.keys(ctx.config.device.devices).sort();
  const devices = names.map((n) => resolveDevice(ctx.config, n));
  const checks = [...(await toolChecks(ctx, devices)), ...(await rigChecks(ctx, devices))];
  const rigDown = new Set(checks.filter((c) => c.scope.startsWith('rig ') && !c.ok).map((c) => c.scope.slice(4)));
  for (const d of devices) {
    if (rigDown.has(d.rigName)) {
      checks.push(fail(`device ${d.name}`, 'rig', `rig ${d.rigName} is not reachable`, `Fix the ssh check of rig ${d.rigName} first.`));
      continue;
    }
    try {
      checks.push(...(await checksOf(deviceKind(d.device.kind))(ctx, d)));
    } catch (err) {
      if (!(err instanceof LaunchwrightError)) throw err;
      checks.push(fail(`device ${d.name}`, 'config', err.code, err.message));
    }
  }
  return checks;
}

/** The report lines. A failure gets a second line with its fix. */
export function formatDoctor(checks: DoctorCheck[]): string[] {
  const lines: string[] = [];
  for (const c of checks) {
    const mark = c.ok ? 'ok  ' : c.optional ? 'warn' : 'FAIL';
    lines.push(`${mark} ${c.scope.padEnd(18)} ${c.name.padEnd(24)} ${c.detail}`);
    if (!c.ok && c.fix) lines.push(`     fix: ${c.fix}`);
  }
  const blocking = checks.filter((c) => !c.ok && !c.optional).length;
  lines.push(blocking === 0 ? 'verdict: ready' : `verdict: ${blocking} check(s) fail`);
  return lines;
}
