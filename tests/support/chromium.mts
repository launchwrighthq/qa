// The browser cache of the account for the Playwright tests of qa. The headless shell lookup is
// `headlessShell` of `@launchwrighthq/qa/testing`, which qa-device tests use too.
import { vi } from 'vitest';
import { BROWSERS_PATH } from '../../src/testing/chromium.mts';

export { BROWSERS_PATH, headlessShell } from '../../src/testing/chromium.mts';

/** Points Playwright at the account's browser cache, where its ffmpeg for video lives. Call in beforeEach. */
export function useBrowserCache(): void {
  vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', BROWSERS_PATH);
}
