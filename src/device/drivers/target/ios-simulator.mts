// The `ios-simulator` qa.target driver (spec 2.8): `xcrun simctl` on a rig. It opens URLs with
// `openurl`, photographs the screen with `io screenshot` and films it with `io recordVideo`. It has
// no input, so `ready` is false until an input tool is configured, and the reason names the key.
import { isCodedError } from '../../../kernel/index.mts';
import type { Leg } from '../../../index.mts';
import { deviceKeys, simulatorDeviceKeys } from '../../config.mts';
import { iosDevice, SimulatorSession, simulatorReadiness } from '../../services/ios-session.mts';
import type { DeviceContext } from '../../services/rigs.mts';
import { type OpenOptions, QA_TARGET_SPEC_VERSION, type QaSession, type QaTarget, type QaTargetCapability, type TargetReadiness } from './contract.mts';

class IosSimulatorTarget implements QaTarget {
  readonly name = 'ios-simulator';
  readonly specVersion = QA_TARGET_SPEC_VERSION;
  readonly capabilities: ReadonlySet<QaTargetCapability> = new Set<QaTargetCapability>(['screenshot', 'video', 'webview']);

  constructor(private readonly ctx: DeviceContext) {}

  supports(cap: string): boolean {
    return this.capabilities.has(cap as QaTargetCapability);
  }

  async ready(leg: Leg): Promise<TargetReadiness> {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    try {
      const { resolved } = iosDevice(this.ctx, leg.device, this.name, true);
      const reason = simulatorReadiness(resolved.name, deviceKeys(resolved.name, resolved.device, simulatorDeviceKeys));
      return reason ? { ready: false, reason } : { ready: true };
    } catch (err) {
      if (isCodedError(err)) return { ready: false, reason: err.message };
      throw err;
    }
  }

  open(opts: OpenOptions): Promise<QaSession> {
    return SimulatorSession.open(this.ctx, opts, this.name);
  }
}

export function createIosSimulatorTarget(ctx: DeviceContext): QaTarget {
  return new IosSimulatorTarget(ctx);
}
