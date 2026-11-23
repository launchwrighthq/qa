// The Telegram app on an Android device (spec 2.8): the APK fetched and checked against a pinned
// SHA-256, an install that refuses to replace an installed Telegram without `force`, and the launch
// of a bot's Mini App. The bot name comes from the leg, never from this file.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { LaunchwrightError, safeEqual } from '../../kernel/index.mts';
import { sha256 } from '../../kernel/services/fs.mts';
import type { TelegramDeviceConfig } from '../config.mts';
import type { Adb } from './adb.mts';
import { type DeviceDeps, orFail, out } from './process.mts';
import { DEVICE_STATE_DIR } from './rigs.mts';

export function apkPath(root: string): string {
  return join(root, DEVICE_STATE_DIR, 'telegram.apk');
}

/** The pin, or `qa.device.telegram.pin` naming the config key. */
function pinOf(cfg: TelegramDeviceConfig): string {
  if (!cfg.apkSha256) {
    throw new LaunchwrightError(
      'qa.device.telegram.pin',
      'qa.device.telegram.apkSha256 is not set. Pin the APK you trust: fetch it once, check it, and set the key to its sha256sum.',
    );
  }
  return cfg.apkSha256;
}

/** Fails with `qa.device.telegram.pin` when the bytes are not the pinned build. */
export function checkPin(bytes: Uint8Array, cfg: TelegramDeviceConfig): void {
  const want = pinOf(cfg);
  const got = sha256(bytes);
  if (!safeEqual(got, want)) {
    throw new LaunchwrightError(
      'qa.device.telegram.pin',
      `The Telegram APK has sha256 ${got}, not the pinned ${want}. Telegram may have published a new build: check it, then move the pin in qa.device.telegram.apkSha256.`,
      { context: { got, want } },
    );
  }
}

/**
 * The APK at `.lw/qa/device/telegram.apk`, fetched when absent. A download is written only when it
 * is whole and matches the pin, so a failed transfer leaves no file for the next run to trust.
 */
export async function fetchApk(cfg: TelegramDeviceConfig, deps: DeviceDeps): Promise<string> {
  const path = apkPath(deps.root);
  let bytes: Buffer | null = null;
  try {
    bytes = await readFile(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw new LaunchwrightError('qa.device.telegram.apk', `Cannot read ${path}.`, { cause: err });
  }
  if (bytes) {
    checkPin(bytes, cfg);
    return path;
  }
  pinOf(cfg);
  const res = await deps.fetch(cfg.apkUrl, { redirect: 'follow', signal: AbortSignal.timeout(600_000) });
  // The redirect target carries an access token, so a message names the configured URL only.
  if (!res.ok) throw new LaunchwrightError('qa.device.telegram.apk', `GET ${cfg.apkUrl} answered ${res.status}.`);
  const body = Buffer.from(await res.arrayBuffer());
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared && body.length !== declared) {
    throw new LaunchwrightError('qa.device.telegram.apk', `The APK download is truncated: ${body.length} of ${declared} bytes.`);
  }
  checkPin(body, cfg);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return path;
}

export async function installed(adb: Adb, pkg: string): Promise<boolean> {
  const res = await adb.run(['shell', 'pm', 'path', pkg]);
  return res.code === 0 && out(res).includes('package:');
}

/**
 * Installs the pinned APK. An installed Telegram can be signed in to a real account, so the install
 * refuses it without `force`.
 */
export async function installTelegram(adb: Adb, cfg: TelegramDeviceConfig, deps: DeviceDeps, force: boolean): Promise<string> {
  const path = await fetchApk(cfg, deps);
  if (!force && (await installed(adb, cfg.package))) {
    throw new LaunchwrightError(
      'qa.device.telegram.signed-in',
      `${cfg.package} is installed on ${adb.serial} and may be signed in to a real account. Install over it only with --force, after its owner agrees.`,
      { context: { serial: adb.serial } },
    );
  }
  const res = await adb.run(['install', '-r', '-g', path], { timeoutMs: 300_000 });
  const text = `${out(res)}${res.stderr}`.trim();
  if (res.code !== 0 || !/\bSuccess\b/.test(text)) throw new LaunchwrightError('qa.device.telegram.install', `adb install on ${adb.serial} failed: ${text.slice(0, 400)}`);
  return path;
}

/** The start parameter of a launch that names none. */
export const DEFAULT_START_PARAM = 'lw';

/**
 * The deep link that opens the main Mini App of a bot. Telegram for Android 13.2 opens the bot chat,
 * not the Mini App, for `startapp` with no value or an empty one, so the link always carries a value.
 */
export function miniAppLink(bot: string, startParam: string = DEFAULT_START_PARAM): string {
  if (!/^[A-Za-z][\w]{3,31}$/.test(bot)) throw new LaunchwrightError('qa.device.telegram.bot', `${JSON.stringify(bot)} is not a Telegram bot username.`);
  return `tg://resolve?domain=${bot}&startapp=${encodeURIComponent(startParam || DEFAULT_START_PARAM)}`;
}

/** Opens a URL or deep link with an Android VIEW intent, in `pkg` when given. */
export async function viewIntent(adb: Adb, uri: string, pkg?: string): Promise<void> {
  const res = await adb.run(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `'${uri.replaceAll("'", '')}'`, ...(pkg ? [pkg] : [])]);
  orFail(res, 'qa.device.intent', `am start ${uri.split('?')[0]}`);
  if (/Error:/i.test(out(res))) throw new LaunchwrightError('qa.device.intent', `am start ${uri.split('?')[0]} failed: ${out(res).trim().slice(0, 300)}`);
}

export async function forceStop(adb: Adb, pkg: string): Promise<void> {
  await adb.shell(['am', 'force-stop', pkg]);
}
