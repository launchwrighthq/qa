import { fakeClock } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { parseShift, ShiftClock } from '../../../../src/world/services/clock.mts';

describe('parseShift', () => {
  it('reads signed durations in each unit and a number of milliseconds', () => {
    expect(parseShift('+2d')).toBe(172_800_000);
    expect(parseShift('-3h')).toBe(-10_800_000);
    expect(parseShift('90m')).toBe(5_400_000);
    expect(parseShift('15s')).toBe(15_000);
    expect(parseShift('500ms')).toBe(500);
    expect(parseShift('1w')).toBe(604_800_000);
    expect(parseShift(1234)).toBe(1234);
  });

  it('refuses a text that is not a duration', () => {
    expect(() => parseShift('tomorrow')).toThrow(expect.objectContaining({ code: 'qa.clock.shift' }));
    expect(() => parseShift(undefined)).toThrow(expect.objectContaining({ code: 'qa.clock.shift' }));
  });
});

describe('ShiftClock', () => {
  it('adds the offset to the base clock and resets to it', async () => {
    const base = fakeClock('2026-01-01T00:00:00Z');
    const clock = new ShiftClock(base);
    clock.shift(parseShift('+1d'));
    expect(clock.date().toISOString()).toBe('2026-01-02T00:00:00.000Z');
    await base.advance(60_000);
    expect(clock.date().toISOString()).toBe('2026-01-02T00:01:00.000Z');
    clock.reset();
    expect(clock.now()).toBe(base.now());
  });
});
