// The `qa.target` registry (spec 2.8): `playwright` and `fake`, then the targets the caller passes.
// An extension module, such as `qa-device`, adds its targets with `add` at boot.
import { type Clock, LaunchwrightError, systemClock } from '@launchwrighthq/kernel';
import type { QaConfig } from '../config.mts';
import type { OpenTargetRegistry, QaTarget } from '../drivers/target/contract.mts';
import { createFakeTarget } from '../drivers/target/fake.mts';
import { createPlaywrightTarget } from '../drivers/target/playwright.mts';

/**
 * Every registered target. `extra` adds targets or replaces a built-in one, for example a fake
 * with scripted routes. The registry key is the name a leg's `target` field uses. The built-in
 * targets read no key of `_config`; the parameter stays for the callers of the earlier signature.
 */
export function createTargetRegistry(_config: QaConfig, extra: Record<string, QaTarget> = {}, clock: Clock = systemClock): OpenTargetRegistry {
  const targets: Record<string, QaTarget> = {
    playwright: createPlaywrightTarget({ clock }),
    fake: createFakeTarget({ clock }),
    ...extra,
  };
  return {
    names: () => Object.keys(targets).sort(),
    get(name) {
      const target = targets[name];
      if (!target) {
        throw new LaunchwrightError('qa.target.unknown', `No qa.target driver is named ${name}. Targets: ${Object.keys(targets).sort().join(', ') || 'none'}.`, {
          context: { target: name },
        });
      }
      return target;
    },
    add(more) {
      for (const [name, target] of Object.entries(more)) {
        if (targets[name]) throw new LaunchwrightError('qa.target.duplicate', `A qa.target driver named ${name} is already registered.`, { context: { target: name } });
        targets[name] = target;
      }
    },
  };
}
