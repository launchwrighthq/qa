import { describe, expect, it } from 'vitest';
import {
  ABSENT,
  anchorSubjects,
  candidatePlan,
  candidates,
  type Candidate,
  describeCandidate,
  fieldValues,
  MAX_CANDIDATES,
  type Shape,
  solve,
  unreachable,
  validateShape,
} from '../../../../src/states/services/solve.mts';

const shape: Shape = {
  type: 'Invite',
  fields: {
    acceptedAt: { kind: 'nullable', of: { kind: 'string', sample: '2026-08-01T00:00:00Z' } },
    capped: { kind: 'boolean' },
    payable: { kind: 'boolean', optional: true },
    visits: { kind: 'number' },
    name: { kind: 'opaque' },
  },
};

/** The app's function: the chip shows only for an unpayable invite at or past the visit bar. */
function inviteMark(invite: Candidate, bar = 5): string | null {
  if (invite.acceptedAt === null) return 'pending';
  if (invite.capped === true) return 'capped';
  if (invite.payable === false) return (invite.visits as number) >= bar ? 'unpayable-past' : 'unpayable';
  return null;
}

const corpus: Candidate[] = [
  { acceptedAt: '2026-07-01T00:00:00Z', capped: false, payable: true, visits: 0, name: 'row one' },
  { acceptedAt: null, capped: false, payable: true, visits: 2, name: 'row two' },
];

describe('solver', () => {
  it('lists the values a field admits, most likely first, with ABSENT last for an optional field', () => {
    expect(fieldValues({ kind: 'boolean', optional: true })).toEqual([true, false, ABSENT]);
    expect(fieldValues({ kind: 'number', pivots: [5] })).toEqual([0, 1, 5, 6, 4]);
    expect(fieldValues({ kind: 'nullable', of: { kind: 'string' } })).toEqual([null, 'qa', '']);
    expect(fieldValues({ kind: 'opaque' })).toEqual([]);
  });

  it('refuses a bad shape with every problem at once', () => {
    expect(validateShape({ type: '', fields: { a: { kind: 'enum', values: [1] }, b: { kind: 'nullable', of: { kind: 'nullable' } } } })).toEqual([
      expect.stringContaining('type: missing'),
      'a: enum needs at least two values, or it is a constant',
      'b: nullable inside nullable adds a second null',
    ]);
    expect(validateShape({ type: 'X', fields: { a: { kind: 'opaque' } } })).toContain('fields: every field is opaque, so no candidate can differ from the corpus');
  });

  it('makes a deterministic, deduplicated stream: corpus first, then one field, then two fields', () => {
    const plan = candidatePlan(shape, corpus);
    expect(plan[0]?.candidate).toEqual(corpus[0]);
    expect(plan[1]?.candidate).toEqual(corpus[1]);
    expect(plan[2]?.text).toBe('acceptedAt: "2026-07-01T00:00:00Z" -> null');
    expect(new Set(plan.map((s) => JSON.stringify(s.candidate))).size).toBe(plan.length);
    expect(candidates(shape, corpus)).toEqual(plan.map((s) => s.candidate));
    expect(plan.some((s) => s.changes.length === 2)).toBe(true);
    expect(plan.length).toBeLessThanOrEqual(MAX_CANDIDATES);
  });

  it('deletes an absent optional key rather than setting it to undefined', () => {
    const absent = candidatePlan(shape, corpus).find((s) => s.changes.some((c) => c.field === 'payable' && c.to === ABSENT));
    expect(absent && Object.hasOwn(absent.candidate, 'payable')).toBe(false);
    expect(describeCandidate({ a: 1 }, { a: 1, b: 2 }).text).toBe('b: 2 -> (absent)');
  });

  it('stops at the limit and refuses an empty corpus', () => {
    expect(candidatePlan(shape, corpus, { limit: 7 })).toHaveLength(7);
    expect(() => candidatePlan(shape, [])).toThrow(/corpus is empty/);
  });

  it('covers a member that needs two fields at once, with the pivot, and every member in the end', async () => {
    const result = await solve({ shape, corpus, evaluate: (c) => inviteMark(c), members: ['pending', 'capped', 'unpayable', 'unpayable-past', 'null'], pivots: [5] });
    expect(result.missing).toEqual([]);
    expect(result.covered['unpayable-past']?.changes.map((c) => c.field).sort()).toEqual(['payable', 'visits']);
    expect(result.sentence).toBeNull();
  });

  it('reports a member it cannot reach with the fields it varied', async () => {
    const result = await solve({ shape, corpus, evaluate: (c) => inviteMark(c), members: ['pending', 'unpayable-past'], union: 'InviteMark' });
    expect(result.missing).toEqual(['unpayable-past']);
    expect(result.sentence).toContain('InviteMark: "unpayable-past" unreachable.');
    expect(result.sentence).toContain('varied acceptedAt, capped, payable, visits, name');
    expect(unreachable({ name: 'U', members: ['a'], covered: ['a'] }, { count: 1, fields: [] })).toBeNull();
  });

  it('refuses a state function that answers something other than a string or null', async () => {
    await expect(solve({ shape, corpus, evaluate: () => 3 })).rejects.toThrow(/answered number/);
  });

  it('anchors every subject on one base row, keeping only the field under test', async () => {
    const result = await solve({ shape, corpus, evaluate: (c) => inviteMark(c), members: ['pending', 'capped'] });
    const anchored = await anchorSubjects({ shape, base: corpus[0] as Candidate, covered: result.covered, members: ['pending', 'capped'], evaluate: (c) => inviteMark(c) });
    expect(anchored.anchored).toEqual(['pending', 'capped']);
    expect(anchored.subjects.pending).toEqual({ ...corpus[0], acceptedAt: null });
    expect(anchored.subjects.capped).toEqual({ ...corpus[0], capped: true });
    expect(anchored.fields.sort()).toEqual(['acceptedAt', 'capped']);
  });

  it('keeps the solver row for a member that the base row cannot produce, with a note', async () => {
    const covered = { odd: { candidate: { ...corpus[0], secret: 1 } } };
    const anchored = await anchorSubjects({ shape, base: corpus[0] as Candidate, covered, members: ['odd'], evaluate: (c) => (c.secret === 1 ? 'odd' : null) });
    expect(anchored.loose).toEqual(['odd']);
    expect(anchored.notes[0]).toContain('could not be anchored');
  });
});
