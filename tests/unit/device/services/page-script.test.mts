import { describe, expect, it } from 'vitest';
import {
  actExpression,
  chooseVisiblePage,
  parseSelector,
  pushRouteExpression,
  relativeRoute,
  routeUrl,
  settleExpression,
} from '../../../../src/device/services/page-script.mts';

describe('the page scripts every device leg runs', () => {
  it('reads a role selector with a quoted accessible name', () => {
    expect(parseSelector('role=button[name="Get started"]')).toEqual({ kind: 'role', role: 'button', name: 'Get started' });
    expect(parseSelector("role=link[name='Next']")).toEqual({ kind: 'role', role: 'link', name: 'Next' });
    expect(parseSelector('input[name=email]')).toEqual({ kind: 'css', css: 'input[name=email]' });
  });

  it('refuses a settle rule that names two conditions', () => {
    expect(() => settleExpression({ selector: '#a', busy: true })).toThrow(/exactly one of selector, artwork, video, busy/);
    expect(settleExpression({ busy: true })).toContain('aria-busy="true"');
  });

  it('refuses an act step without its target', () => {
    expect(() => actExpression({ kind: 'click' })).toThrow(expect.objectContaining({ code: 'qa.target.act' }));
  });

  it('refuses a pushed route that does not start with a slash', () => {
    expect(() => pushRouteExpression('next')).toThrow(/starts with \//);
  });

  it('joins a leg route to the base path of the surface', () => {
    expect(routeUrl('https://app.test/app', '/plans?x=1')).toEqual({ url: 'https://app.test/app/plans?x=1', path: '/app/plans?x=1', origin: 'https://app.test' });
    expect(relativeRoute('https://app.test/app', '/app/plans?x=1')).toBe('/plans?x=1');
    expect(relativeRoute('https://app.test/app', '/app/')).toBe('/');
    expect(relativeRoute('https://app.test/', '/x')).toBe('/x');
  });

  it('keeps the one visible page of a WebView pool', () => {
    const pool = [
      { id: 'A1', url: 'https://app.test/app/ranking', visibility: 'hidden' },
      { id: 'C3', url: 'https://app.test/app/', visibility: 'visible' },
    ];
    expect(chooseVisiblePage(pool).id).toBe('C3');
  });

  it('refuses a pool with no visible page or two visible pages', () => {
    expect(() => chooseVisiblePage([{ id: 'A1', visibility: 'hidden' }])).toThrow(/No page is visible/);
    expect(() =>
      chooseVisiblePage([
        { id: 'A1', visibility: 'visible' },
        { id: 'B2', visibility: 'visible' },
      ]),
    ).toThrow(/2 pages claim to be visible/);
  });
});
