// The device kinds of `qa.device.devices.<name>.kind` (QA spec 2.9). Each kind declares how lw
// reaches the device. The verbs, the doctor and the targets read these traits, never a kind name,
// so a project adds a kind with `registerDeviceKind` and edits no framework file.
import { LaunchwrightError } from '@launchwrighthq/kernel';

/** How lw reaches a device: adb, the WebKit inspector of iOS, or WebDriver on a cloud phone. */
export type DeviceAccess = 'adb' | 'webkit' | 'webdriver';

/** The traits of one device kind. */
export interface DeviceKind {
  readonly access: DeviceAccess;
  /** The `qa.target` driver that runs a QA leg on a device of the kind. */
  readonly target: string;
  /** `adb` only: an AVD on a rig, with the keys `emulatorDeviceKeys`, that lw boots and stops. */
  readonly emulator?: boolean;
  /** `webkit` only: an iOS simulator on a rig, with the keys `simulatorDeviceKeys`. `simctl` takes its screenshots and video. */
  readonly simulator?: boolean;
  /** `webdriver` only: the browser of the cloud phone. */
  readonly browser?: 'chrome' | 'safari';
  /** `webdriver` only: the WebDriver session reads the page console. */
  readonly console?: boolean;
}

const kinds = new Map<string, DeviceKind>();

/** Adds or replaces a device kind. A config names it in `qa.device.devices.<name>.kind`. */
export function registerDeviceKind(name: string, kind: DeviceKind): void {
  kinds.set(name, Object.freeze({ ...kind }));
}

/** The name of every registered kind, sorted. */
export function deviceKindNames(): string[] {
  return [...kinds.keys()].sort();
}

/** The traits of `kind`. Throws `qa.device.kind` for a kind that no one registered. */
export function deviceKind(kind: string): DeviceKind {
  const found = kinds.get(kind);
  if (found === undefined) {
    throw new LaunchwrightError('qa.device.kind', `No device kind ${kind}. Kinds: ${deviceKindNames().join(', ')}. registerDeviceKind adds one.`, { context: { kind } });
  }
  return found;
}

registerDeviceKind('android', { access: 'adb', target: 'android-adb' });
registerDeviceKind('android-emulator', { access: 'adb', target: 'android-emulator', emulator: true });
registerDeviceKind('ios', { access: 'webkit', target: 'ios-webkit' });
registerDeviceKind('ios-simulator', { access: 'webkit', target: 'ios-simulator', simulator: true });
registerDeviceKind('ios-safari', { access: 'webdriver', target: 'browserstack', browser: 'safari' });
registerDeviceKind('android-chrome', { access: 'webdriver', target: 'browserstack', browser: 'chrome', console: true });
