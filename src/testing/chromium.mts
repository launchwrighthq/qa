// The Chromium that `playwright install` put on this machine. A test worker has HOME at its temp
// root, so Playwright cannot find its browser cache by itself. This helper reads the cache of the
// account (os.userInfo, not HOME) and names the newest headless shell.
import { existsSync, readdirSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { LaunchwrightError } from '../kernel/index.mts';

/** The Playwright browser cache of the account that runs the tests. */
export const BROWSERS_PATH = join(userInfo().homedir, '.cache', 'ms-playwright');

/** The newest installed `chrome-headless-shell`. Fails with the install command when there is none. */
export function headlessShell(): string {
  const dirs = existsSync(BROWSERS_PATH) ? readdirSync(BROWSERS_PATH).filter((d) => d.startsWith('chromium_headless_shell-')) : [];
  const found = dirs
    .map((d) => ({ build: Number(d.split('-')[1]), path: join(BROWSERS_PATH, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell') }))
    .filter((d) => existsSync(d.path))
    .sort((a, b) => b.build - a.build)[0];
  if (!found) {
    throw new LaunchwrightError('qa.test.chromium', `No chrome-headless-shell under ${BROWSERS_PATH}. Run: npx playwright install chromium`);
  }
  return found.path;
}
