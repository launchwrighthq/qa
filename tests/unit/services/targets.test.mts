import { describe, expect, it } from 'vitest';
import { qaConfig } from '../../../src/config.mts';
import { createFakeTarget } from '../../../src/drivers/target/fake.mts';
import { createTargetRegistry } from '../../../src/services/targets.mts';

const config = qaConfig.parse({});

describe('createTargetRegistry', () => {
  it('registers only the playwright and fake targets of the core', () => {
    const registry = createTargetRegistry(config);
    expect(registry.names()).toEqual(['fake', 'playwright']);
    expect(registry.get('playwright').name).toBe('playwright');
    expect(registry.get('fake').specVersion).toBe('1');
  });

  it('lets an extra target replace a built-in one', () => {
    const scripted = createFakeTarget({ routes: { '/': { selectors: ['#x'] } } });
    expect(createTargetRegistry(config, { fake: scripted }).get('fake')).toBe(scripted);
  });

  it('adds the targets of an extension module after it is built', () => {
    const registry = createTargetRegistry(config);
    const phone = createFakeTarget({ name: 'fake-phone', routes: {} });
    registry.add({ 'fake-phone': phone });
    expect(registry.names()).toEqual(['fake', 'fake-phone', 'playwright']);
    expect(registry.get('fake-phone')).toBe(phone);
  });

  it('refuses to add a target under a name that the registry holds', () => {
    const registry = createTargetRegistry(config);
    expect(() => registry.add({ fake: createFakeTarget({ routes: {} }) })).toThrow(expect.objectContaining({ code: 'qa.target.duplicate' }));
  });

  it('fails with qa.target.unknown and lists the names for an unknown target', () => {
    expect(() => createTargetRegistry(config).get('android-adb-x')).toThrow(expect.objectContaining({ code: 'qa.target.unknown', message: expect.stringContaining('fake') }));
  });
});
