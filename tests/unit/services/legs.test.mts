import { LaunchwrightError } from '../../../src/kernel/index.mts';
import { describe, expect, it } from 'vitest';
import { qaConfig } from '../../../src/config.mts';
import { DEFAULT_LEGS, DESKTOP_USER_AGENT, legDefinitions, NO_TARGET, resolveLegs } from '../../../src/services/legs.mts';

const config = (legs: unknown = {}) => qaConfig.parse({ legs });

describe('legs (spec 2.3, R4)', () => {
  it('has the six default legs in report order', () => {
    expect(Object.keys(DEFAULT_LEGS)).toEqual(['desktop', 'mobile-web', 'miniapp', 'telegram-fake', 'telegram-android', 'safari-ios']);
    const desktop = legDefinitions(config()).find((l) => l.name === 'desktop');
    expect(desktop).toMatchObject({ surface: 'web', target: 'playwright', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: DESKTOP_USER_AGENT });
    expect(legDefinitions(config()).find((l) => l.name === 'mobile-web')).toMatchObject({ descriptor: 'Pixel 7', userAgent: DESKTOP_USER_AGENT });
  });

  it('merges qa.legs: an entry overrides or adds a leg, false removes one', () => {
    const legs = legDefinitions(
      config({
        desktop: { surface: 'web', target: 'playwright', viewport: { width: 1280, height: 720 } },
        tablet: { surface: 'web', target: 'playwright', descriptor: 'iPad Mini' },
        'safari-ios': false,
      }),
    );
    expect(legs.map((l) => l.name)).toEqual(['desktop', 'mobile-web', 'miniapp', 'telegram-fake', 'telegram-android', 'tablet']);
    expect(legs[0]).toEqual({ name: 'desktop', surface: 'web', target: 'playwright', viewport: { width: 1280, height: 720 } });
  });

  it('marks a leg whose target is not registered as n/a with the reason "no target", and drops none', () => {
    const resolved = resolveLegs(config(), ['playwright']);
    expect(resolved).toHaveLength(6);
    const byName = Object.fromEntries(resolved.map((r) => [r.leg.name, r]));
    expect(byName.desktop).toMatchObject({ available: true });
    expect(byName['telegram-android']).toEqual(expect.objectContaining({ available: false, reason: NO_TARGET }));
    expect(byName['safari-ios']?.reason).toBe('no target');
  });

  it('refuses a leg name that is not kebab case', () => {
    expect(() => legDefinitions(config({ Bad_Leg: { surface: 'web', target: 'playwright' } }))).toThrow(LaunchwrightError);
  });
});
