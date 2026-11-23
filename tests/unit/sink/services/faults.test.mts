import { LaunchwrightError } from '../../../../src/kernel/index.mts';
import { describe, expect, it } from 'vitest';
import { FaultPlan, parseFault, replyOf, seededSource } from '../../../../src/sink/services/faults.mts';

function statuses(plan: FaultPlan, n: number): Array<number | string> {
  return Array.from({ length: n }, () => {
    const { rule, reply } = plan.next();
    return rule?.kind === 'slow' ? `slow:${reply.holdMs}` : reply.status;
  });
}

describe('parseFault', () => {
  it.each([
    ['503', { kind: '503' }],
    ['429x3', { kind: '429', count: 3 }],
    ['410@0.25', { kind: '410', ratio: 0.25 }],
    ['302:https://example.test/next', { kind: '302', location: 'https://example.test/next' }],
    ['302:http://example.test/latest/x1', { kind: '302', location: 'http://example.test/latest/', count: 1 }],
    ['slow:15000x1', { kind: 'slow', ms: 15000, count: 1 }],
    ['slow:200@1', { kind: 'slow', ms: 200, ratio: 1 }],
  ])('reads the rule %s into its kind and limit', (text, rule) => {
    expect(parseFault(text)).toEqual({ text, ...rule });
  });

  it.each(['500', '503x', '503@1.5', '503x0', 'slow', 'slow:fast', '302:', '302:/relative', '302:ftp://x.test/a', '503 x2'])('refuses %s with qa.sink.fault', (text) => {
    let err: unknown;
    try {
      parseFault(text);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(LaunchwrightError);
    expect((err as LaunchwrightError).code).toBe('qa.sink.fault');
  });
});

describe('replyOf', () => {
  it('answers like the source sink: 503 busy, 429 with Retry-After 30, 410 gone, 302 to the URL, slow then 200', () => {
    expect(replyOf(parseFault('503'))).toEqual({ status: 503, headers: {}, body: 'busy', holdMs: 0 });
    expect(replyOf(parseFault('429'))).toEqual({ status: 429, headers: { 'retry-after': '30' }, body: 'slow down', holdMs: 0 });
    expect(replyOf(parseFault('410'))).toEqual({ status: 410, headers: {}, body: 'gone', holdMs: 0 });
    expect(replyOf(parseFault('302:https://a.test/b'))).toEqual({ status: 302, headers: { location: 'https://a.test/b' }, body: '', holdMs: 0 });
    expect(replyOf(parseFault('slow:750'))).toEqual({ status: 200, headers: {}, body: 'ok', holdMs: 750 });
  });
});

describe('FaultPlan', () => {
  it('answers 200 without rules', () => {
    expect(statuses(new FaultPlan([], seededSource(1)), 3)).toEqual([200, 200, 200]);
  });

  it('a count rule fires on its first N requests, then the next rule answers', () => {
    const plan = new FaultPlan(['503x2', 'slow:100x1', '410'].map(parseFault), seededSource(1));
    expect(statuses(plan, 5)).toEqual([503, 503, 'slow:100', 410, 410]);
  });

  it('a ratio rule fires by the seeded random source, the same way for the same seed', () => {
    const run = (seed: number) => statuses(new FaultPlan([parseFault('503@0.5')], seededSource(seed)), 40);
    const a = run(7);
    expect(a).toEqual(run(7));
    expect(a).not.toEqual(run(8));
    const faulted = a.filter((s) => s === 503).length;
    expect(faulted).toBeGreaterThan(8);
    expect(faulted).toBeLessThan(32);
    expect(statuses(new FaultPlan([parseFault('429@0')], seededSource(7)), 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses(new FaultPlan([parseFault('429@1')], seededSource(7)), 3)).toEqual([429, 429, 429]);
  });
});
