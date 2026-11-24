// Config of qa-device (QA spec 2.8, 2.9): key `qa.device` of config section `qa`. The core keeps
// the key as an open record, and this module parses it. The keys of one device pass through
// `deviceConfig` and are read here, by kind.
import { LaunchwrightError, z } from '../kernel/index.mts';
import { type QaConfig as CoreQaConfig, qaConfigOf as coreQaConfigOf } from '../index.mts';
import { deviceKindNames } from './services/device-kinds.mts';

/** The host proxy of a rig whose gateway does not hairpin (spec 2.9, `ingress: host-proxy`). */
export const hostProxyConfig = z.object({
  /** The address that serves the tunnel hostname, for example the tailnet address of the ingress. */
  upstream: z.string().min(1),
  /** The loopback port of the proxy on the rig, and of `adb reverse` on the device. */
  port: z.number().int().positive().default(8899),
});

/** The local tools. A name is looked up on PATH; a path is used as it is. */
export const deviceToolsConfig = z.object({
  adb: z.string().min(1).default('adb'),
  ssh: z.string().min(1).default('ssh'),
  scrcpy: z.string().min(1).default('scrcpy'),
  /** The scrcpy version the doctor accepts as the minimum. Older builds fail on Android 15 and later. */
  scrcpyVersion: z.string().regex(/^\d+(\.\d+)*$/).default('3.1'),
  ffmpeg: z.string().min(1).default('ffmpeg'),
});

/** The Telegram app on an Android device (spec 2.8). */
export const telegramDeviceConfig = z.object({
  /** The Android package of the Telegram build on the device. */
  package: z.string().min(1).default('org.telegram.messenger.web'),
  /** Where `lw qa device install` fetches the APK. */
  apkUrl: z.string().url().default('https://telegram.org/dl/android/apk'),
  /** The SHA-256 the fetched APK must have. `install` refuses an APK without a pin. */
  apkSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

/** BrowserStack Automate (spec 2.8). The keys come from the secret store through the config. */
export const browserstackConfig = z.object({
  username: z.string().min(1).optional(),
  accessKey: z.string().min(1).optional(),
  hub: z.string().url().default('https://hub-cloud.browserstack.com/wd/hub'),
  api: z.string().url().default('https://api.browserstack.com/automate'),
  /** The minutes one run may spend. A session past it closes with `qa.device.browserstack.budget`. */
  budgetMinutes: z.number().positive().default(5),
  /** Seconds a session may sit idle before BrowserStack ends it. Its own ceiling is 300. */
  idleTimeoutS: z.number().int().min(1).max(300).default(120),
  project: z.string().min(1).default('launchwright-qa'),
  build: z.string().min(1).default('qa'),
});

/** A rig: a host that holds devices (spec 2.9). */
export const rigConfig = z.object({
  transport: z.enum(['local', 'ssh', 'cloud']),
  host: z.string().optional(),
  adbPort: z.number().int().positive().optional(),
  webkitPorts: z.array(z.number().int().positive()).optional(),
  ingress: z.enum(['direct', 'host-proxy']).default('direct'),
  /** The proxy target of `ingress: host-proxy`. */
  hostProxy: hostProxyConfig.optional(),
});

/** A device on a rig (spec 2.9). Driver-specific keys pass through. */
export const deviceConfig = z
  .object({
    rig: z.string().min(1),
    /** A kind of `registerDeviceKind`: the built-in ones, or one that the project adds. */
    kind: z
      .string()
      .min(1)
      .refine((kind) => deviceKindNames().includes(kind), 'is no registered device kind; registerDeviceKind adds one'),
  })
  .passthrough();

/** Key `qa.device` of config section `qa`. */
export const qaDeviceConfig = z
  .object({
    rigs: z.record(z.string(), rigConfig).prefault({ local: { transport: 'local' } }),
    devices: z.record(z.string(), deviceConfig).default({}),
    tools: deviceToolsConfig.prefault({}),
    telegram: telegramDeviceConfig.prefault({}),
    browserstack: browserstackConfig.prefault({}),
  })
  .prefault({});

export type RigConfig = z.infer<typeof rigConfig>;
export type DeviceConfig = z.infer<typeof deviceConfig>;
export type QaDeviceConfig = z.infer<typeof qaDeviceConfig>;

/** Config section `qa` with key `device` parsed by `qaDeviceConfig`. */
export type QaConfig = Omit<CoreQaConfig, 'device'> & { device: QaDeviceConfig };

/** The env keys that give the BrowserStack keys when `qa.device.browserstack` names none. */
export const BROWSERSTACK_ENV = { username: 'BROWSERSTACK_USERNAME', accessKey: 'BROWSERSTACK_ACCESS_KEY' } as const;

/** `cfg` with each BrowserStack key that the config leaves unset taken from `env`. */
export function withBrowserstackEnv(cfg: QaConfig, env: Readonly<Record<string, string | undefined>> = {}): QaConfig {
  const bs = cfg.device.browserstack;
  const username = bs.username ?? (env[BROWSERSTACK_ENV.username] || undefined);
  const accessKey = bs.accessKey ?? (env[BROWSERSTACK_ENV.accessKey] || undefined);
  if (username === bs.username && accessKey === bs.accessKey) return cfg;
  return { ...cfg, device: { ...cfg.device, browserstack: { ...bs, ...(username ? { username } : {}), ...(accessKey ? { accessKey } : {}) } } };
}

/** Every issue of a failed parse, as `path: message` joined with `; `. */
function issuesOf(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

/** `cfg` with key `device` parsed. Fails with `qa.device.config` and every issue. */
export function withDevice(cfg: CoreQaConfig): QaConfig {
  const parsed = qaDeviceConfig.safeParse(cfg.device);
  if (parsed.success) return { ...cfg, device: parsed.data };
  const issues = issuesOf(parsed.error);
  throw new LaunchwrightError('qa.device.config', `qa.device is not valid: ${issues}.`, { cause: parsed.error });
}

/** Config section `qa` of `sections`, parsed, with the app folders and key `device` parsed. */
export function qaConfigOf(sections: Record<string, unknown> = {}): QaConfig {
  return withDevice(coreQaConfigOf(sections));
}

/** How an Android target films a row. */
const recorder = z.enum(['screenrecord', 'scrcpy']).default('screenrecord');

/** Keys of a device of kind `android`: a phone on USB, local or on a rig. */
export const androidDeviceKeys = z.object({
  serial: z.string().min(1),
  recorder,
  /** The browser package for a `web` leg. */
  browserPackage: z.string().min(1).default('com.android.chrome'),
});

/** Keys of a device of kind `android-emulator`: an AVD on a rig. */
export const emulatorDeviceKeys = z.object({
  /** The AVD name. Letters, digits, `.`, `_` and `-`, as `avdmanager` allows. */
  avd: z.string().regex(/^[\w.-]+$/),
  /** The emulator console port. Even, 5554 to 5682. The serial is `emulator-<port>`. */
  port: z.number().int().min(5554).max(5682).refine((p) => p % 2 === 0, 'the console port is even').default(5554),
  gpu: z.string().min(1).default('swiftshader_indirect'),
  recorder,
  browserPackage: z.string().min(1).default('com.android.chrome'),
});

/** Keys of a device of kind `ios`: an iPhone on a rig, through `ios_webkit_debug_proxy`. */
export const iosDeviceKeys = z.object({
  /** Picks the phone out of the proxy device list. Never printed. */
  udid: z.string().min(1).optional(),
  /** A substring of the page URL or title. Default: the host of the leg base URL. */
  match: z.string().min(1).optional(),
});

/** Keys of a device of kind `ios-simulator`. */
export const simulatorDeviceKeys = z.object({
  /** The simulator UDID. Default: the booted simulator. */
  udid: z.string().min(1).optional(),
  /** The tool that taps on the simulator. `simctl` has no input verb, so the target is not ready without one. */
  inputTool: z.string().min(1).optional(),
  /**
   * The rig port of an `ios_webkit_debug_proxy` that serves the simulator (`-s unix:<webinspectord_sim socket>`).
   * Settle, the route and the logs read the page through it.
   */
  inspectorPort: z.number().int().positive().optional(),
});

/** Keys of a BrowserStack device (`ios-safari`, `android-chrome`). */
export const cloudDeviceKeys = z.object({
  model: z.string().min(1),
  os: z.string().min(1),
});

export type HostProxyConfig = z.infer<typeof hostProxyConfig>;
export type DeviceToolsConfig = z.infer<typeof deviceToolsConfig>;
export type TelegramDeviceConfig = z.infer<typeof telegramDeviceConfig>;
export type BrowserstackConfig = z.infer<typeof browserstackConfig>;
export type AndroidDeviceKeys = z.infer<typeof androidDeviceKeys>;
export type EmulatorDeviceKeys = z.infer<typeof emulatorDeviceKeys>;
export type IosDeviceKeys = z.infer<typeof iosDeviceKeys>;
export type SimulatorDeviceKeys = z.infer<typeof simulatorDeviceKeys>;
export type CloudDeviceKeys = z.infer<typeof cloudDeviceKeys>;

/** Reads the kind-specific keys of one device, or fails with `qa.device.config` and every issue. */
export function deviceKeys<S extends z.ZodType>(name: string, device: DeviceConfig, schema: S): z.infer<S> {
  const parsed = schema.safeParse(device);
  if (parsed.success) return parsed.data;
  const issues = issuesOf(parsed.error);
  throw new LaunchwrightError('qa.device.config', `qa.device.devices.${name} (kind ${device.kind}) is not valid: ${issues}.`, {
    cause: parsed.error,
    context: { device: name, kind: device.kind },
  });
}
