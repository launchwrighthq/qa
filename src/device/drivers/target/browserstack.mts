// The `browserstack` qa.target driver (spec 2.8): a real cloud phone on BrowserStack Automate over
// W3C WebDriver. One target instance is one run: its minute budget starts with its first session.
import { isCodedError } from '../../../kernel/index.mts';
import type { Leg } from '../../../index.mts';
import { cloudDeviceKeys, deviceKeys } from '../../config.mts';
import { CloudSession, type RunBudget } from '../../services/cloud-session.mts';
import { deviceKind } from '../../services/device-kinds.mts';
import { checkBudget } from '../../services/browserstack.mts';
import { type DeviceContext, resolveDevice } from '../../services/rigs.mts';
import { type OpenOptions, QA_TARGET_SPEC_VERSION, type QaSession, type QaTarget, type QaTargetCapability, type TargetReadiness } from './contract.mts';

class BrowserstackTarget implements QaTarget {
  readonly name = 'browserstack';
  readonly specVersion = QA_TARGET_SPEC_VERSION;
  readonly capabilities: ReadonlySet<QaTargetCapability> = new Set<QaTargetCapability>(['input', 'screenshot', 'video']);
  private readonly budget: RunBudget = { startedAt: null };

  constructor(private readonly ctx: DeviceContext) {}

  supports(cap: string): boolean {
    return this.capabilities.has(cap as QaTargetCapability);
  }

  async ready(leg: Leg): Promise<TargetReadiness> {
    if (!leg.device) return { ready: false, reason: `Leg ${leg.name} names no device. Set qa.legs.${leg.name}.device to a qa.device.devices name.` };
    const cfg = this.ctx.config.device.browserstack;
    try {
      const resolved = resolveDevice(this.ctx.config, leg.device);
      if (deviceKind(resolved.device.kind).access !== 'webdriver') return { ready: false, reason: `Device ${resolved.name} is ${resolved.device.kind}, not a cloud device.` };
      deviceKeys(resolved.name, resolved.device, cloudDeviceKeys);
      if (!cfg.username || !cfg.accessKey) {
        return { ready: false, reason: 'qa.device.browserstack.username and accessKey are not set. Map BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY from the secret store.' };
      }
      if (this.budget.startedAt !== null) checkBudget(this.budget.startedAt, this.ctx.deps.clock.now(), cfg);
      return { ready: true };
    } catch (err) {
      if (isCodedError(err)) return { ready: false, reason: err.message };
      throw err;
    }
  }

  open(opts: OpenOptions): Promise<QaSession> {
    return CloudSession.open(this.ctx, opts, this.budget, this.name);
  }
}

export function createBrowserstackTarget(ctx: DeviceContext): QaTarget {
  return new BrowserstackTarget(ctx);
}
