import { devices } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { contextOptions, relativeRoute, routeUrl } from '../../../../src/drivers/target/playwright.mts';

describe('routeUrl', () => {
  it('puts a route under the surface base and adds ?qa= for a persona launch', () => {
    expect(routeUrl('http://127.0.0.1:5173/mini/', '/store')).toBe('http://127.0.0.1:5173/mini/store');
    expect(routeUrl('http://127.0.0.1:5173', '/store?tab=2', 'member')).toBe('http://127.0.0.1:5173/store?tab=2&qa=member');
  });
});

describe('relativeRoute', () => {
  it('removes the surface base and a trailing slash', () => {
    expect(relativeRoute('http://h/mini', 'http://h/mini/store/?x=1')).toBe('/store');
    expect(relativeRoute('http://h/mini', 'http://h/mini')).toBe('/');
    expect(relativeRoute('http://h', 'http://h/')).toBe('/');
    expect(relativeRoute('http://h/mini', 'http://h/other')).toBe('/other');
  });
});

describe('contextOptions', () => {
  it('takes the descriptor, then the viewport, scale and user agent of the leg', () => {
    const opts = contextOptions({ devices }, { name: 'm', surface: 'web', target: 'playwright', descriptor: 'Pixel 7', userAgent: 'UA/1' });
    expect(opts).toMatchObject({ viewport: devices['Pixel 7']?.viewport, isMobile: true, userAgent: 'UA/1' });
    const desk = contextOptions({ devices }, { name: 'd', surface: 'web', target: 'playwright', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    expect(desk).toEqual({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  });

  it('fails with qa.target.descriptor for a descriptor Playwright does not know', () => {
    expect(() => contextOptions({ devices }, { name: 'x', surface: 'web', target: 'playwright', descriptor: 'Phone 99' })).toThrow(
      expect.objectContaining({ code: 'qa.target.descriptor' }),
    );
  });
});
