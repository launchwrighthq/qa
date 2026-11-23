// A Chromium target for the synthetic checks of spec 3.3 that also keeps the page text of each
// screenshot, so a test reads what the photographed page showed.
import { createPlaywrightTarget } from '../../src/drivers/target/playwright.mts';
import type { QaSession, QaTarget } from '../../src/drivers/target/contract.mts';
import { headlessShell } from './chromium.mts';

/** A `playwright` target on the headless shell, and the page text of each screenshot path. */
export function textTarget(): { target: QaTarget; texts: Map<string, string> } {
  const inner = createPlaywrightTarget({ executablePath: headlessShell() });
  const texts = new Map<string, string>();
  const target: QaTarget = {
    name: inner.name,
    specVersion: inner.specVersion,
    capabilities: inner.capabilities,
    supports: (cap) => inner.supports(cap),
    ready: (leg) => inner.ready(leg),
    async open(opts) {
      const session = await inner.open(opts);
      const evaluate = session.evaluate?.bind(session);
      const wrapped: QaSession = {
        navigate: (route) => session.navigate(route),
        act: (step) => session.act(step),
        settle: (rule) => session.settle(rule),
        currentRoute: () => session.currentRoute(),
        async screenshot(path) {
          texts.set(path, String(await evaluate?.('document.body.innerText')));
          return session.screenshot(path);
        },
        startVideo: (path) => session.startVideo(path),
        stopVideo: () => session.stopVideo(),
        trace: (path) => session.trace(path),
        dump: (path) => session.dump(path),
        logs: () => session.logs(),
        close: () => session.close(),
        ...(evaluate ? { evaluate } : {}),
      };
      return wrapped;
    },
  };
  return { target, texts };
}
