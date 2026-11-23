// Legs: where a row runs (spec 2.3). Six default legs, merged with config `qa.legs`. A leg whose
// target driver is not registered stays in the list as `n/a` with the reason "no target".
import { LaunchwrightError } from '../kernel/index.mts';
import type { LegConfig, QaConfig } from '../config.mts';
import type { Leg } from './types.mts';

/** The Chrome major version of the pinned desktop user agent. Bump it here only. */
const CHROME_MAJOR = 145;

/** A pinned desktop user agent. A browser default (`HeadlessChrome`) would change with the binary. */
export const DESKTOP_USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`;

/**
 * The default legs, in report order (spec 2.3). `mobile-web` keeps the desktop user agent: a
 * phone user agent can make a web client hand the visit to another app before it paints.
 */
export const DEFAULT_LEGS: Readonly<Record<string, LegConfig>> = Object.freeze({
  desktop: {
    surface: 'web',
    target: 'playwright',
    browser: 'chromium',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent: DESKTOP_USER_AGENT,
  },
  'mobile-web': { surface: 'web', target: 'playwright', browser: 'chromium', descriptor: 'Pixel 7', userAgent: DESKTOP_USER_AGENT },
  miniapp: { surface: 'miniapp', target: 'playwright', browser: 'chromium', descriptor: 'Pixel 7' },
  'telegram-fake': { surface: 'bot', target: 'playwright', browser: 'chromium', viewport: { width: 1280, height: 800 } },
  'telegram-android': { surface: 'miniapp', target: 'android-adb' },
  'safari-ios': { surface: 'web', target: 'ios-webkit' },
});

/** One leg after resolution. `available: false` carries the reason the leg is `n/a`. */
export interface ResolvedLeg {
  leg: Leg;
  available: boolean;
  reason?: string;
}

/** The reason a leg is `n/a` when its target driver is not registered. */
export const NO_TARGET = 'no target';

/** The leg definitions: the defaults, then `qa.legs` (an entry replaces a default, `false` removes it). */
export function legDefinitions(config: Pick<QaConfig, 'legs'>): Leg[] {
  const merged = new Map<string, LegConfig>(Object.entries(DEFAULT_LEGS));
  for (const [name, def] of Object.entries(config.legs ?? {})) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      throw new LaunchwrightError('qa.legs.name', `qa.legs.${name}: a leg name is kebab case, for example "tablet-web"`, {
        context: { leg: name },
      });
    }
    if (def === false) merged.delete(name);
    else merged.set(name, def);
  }
  return [...merged].map(([name, def]) => ({ name, ...def }));
}

/**
 * Every leg with its availability. A leg whose target is not in `targetNames` is `n/a` with the
 * reason "no target". No leg is dropped.
 */
export function resolveLegs(config: Pick<QaConfig, 'legs'>, targetNames: Iterable<string>): ResolvedLeg[] {
  const targets = new Set(targetNames);
  return legDefinitions(config).map((leg) =>
    targets.has(leg.target) ? { leg, available: true } : { leg, available: false, reason: NO_TARGET },
  );
}
