// The `ios-webkit` qa.target driver (spec 2.8): a real iPhone on a rig, through
// `ios_webkit_debug_proxy` forwarded over the rig's ssh master. It navigates by `location.href`
// only, photographs the WebView with `Page.snapshotRect`, and has no video.
import { isCodedError } from '../../../kernel/index.mts';
import type { Leg } from '../../../index.mts';
import { deviceAccess, iosDevice, PhoneSession } from '../../services/ios-session.mts';
import type { DeviceContext } from '../../services/rigs.mts';
import { type OpenOptions, QA_TARGET_SPEC_VERSION, type QaSession, type QaTarget, type QaTargetCapability, type TargetReadiness } from './contract.mts';

class IosWebkitTarget implements QaTarget {
  readonly name = 'ios-webkit';
  readonly specVersion = QA_TARGET_SPEC_VERSION;
  readonly capabilities: ReadonlySet<QaTargetCapability> = new Set<QaTargetCapability>(['screenshot', 'webview', 'telegram']);

  constructor(private readonly ctx: DeviceContext) {}

  supports(cap: string): boolean {
    return this.capabilities.has(cap as QaTargetCapability);
  }

  async ready(leg: Leg): Promise<TargetReadiness> {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    try {
      const { resolved } = iosDevice(this.ctx, leg.device, this.name, false);
      const access = await deviceAccess(this.ctx, resolved.name);
      await access.close();
      return { ready: true };
    } catch (err) {
      if (isCodedError(err)) return { ready: false, reason: err.message };
      throw err;
    }
  }

  open(opts: OpenOptions): Promise<QaSession> {
    return PhoneSession.open(this.ctx, opts, this.name);
  }
}

export function createIosWebkitTarget(ctx: DeviceContext): QaTarget {
  return new IosWebkitTarget(ctx);
}
