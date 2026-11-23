// The `android-adb` qa.target driver (spec 2.8): any adb serial, on USB here or on a rig. Input is
// raw CDP in the visible WebView plus adb `input`; screenshots are `screencap`; video is
// `screenrecord` (one clip up to the evidence cap) or `scrcpy --record`; the dump is uiautomator.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { Leg } from '@launchwrighthq/qa';
import { deviceState } from '../../services/adb.mts';
import { androidHandle, AndroidSession, stateFix } from '../../services/android-session.mts';
import { avdExists } from '../../services/emulator.mts';
import type { DeviceContext } from '../../services/rigs.mts';
import { type OpenOptions, QA_TARGET_SPEC_VERSION, type QaSession, type QaTarget, type QaTargetCapability, type TargetReadiness } from './contract.mts';

export const ANDROID_CAPABILITIES: readonly QaTargetCapability[] = ['input', 'screenshot', 'video', 'webview', 'native', 'telegram'];

/**
 * Both Android drivers: they drive a device whose kind has `access: 'adb'`. With `emulatorOnly`
 * (`android-emulator`), the kind must be an emulator, and `ready` asks for the AVD, not a booted serial.
 */
export class AndroidTarget implements QaTarget {
  readonly specVersion = QA_TARGET_SPEC_VERSION;
  readonly capabilities: ReadonlySet<QaTargetCapability> = new Set(ANDROID_CAPABILITIES);

  constructor(
    readonly name: string,
    private readonly ctx: DeviceContext,
    private readonly emulatorOnly = false,
  ) {}

  supports(cap: string): boolean {
    return this.capabilities.has(cap as QaTargetCapability);
  }

  async ready(leg: Leg): Promise<TargetReadiness> {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    try {
      const h = androidHandle(this.ctx, leg.device, this.name, this.emulatorOnly);
      if (this.emulatorOnly && h.emulator) {
        if (await avdExists(h.rig, h.emulator.avd)) return { ready: true };
        return { ready: false, reason: `Rig ${h.rig.name} has no AVD ${h.emulator.avd}. Create it with avdmanager on that rig.` };
      }
      const state = await deviceState(h.rig, h.adb.serial, this.ctx.deps, this.ctx.config.device.tools.adb);
      return state === 'device' ? { ready: true } : { ready: false, reason: stateFix(state, h.adb.serial, h.rig.name) };
    } catch (err) {
      if (err instanceof LaunchwrightError) return { ready: false, reason: err.message };
      throw err;
    }
  }

  open(opts: OpenOptions): Promise<QaSession> {
    return AndroidSession.open(this.ctx, androidHandle(this.ctx, opts.leg.device, this.name, this.emulatorOnly), opts, this.name);
  }
}

export function createAndroidAdbTarget(ctx: DeviceContext): QaTarget {
  return new AndroidTarget('android-adb', ctx);
}
