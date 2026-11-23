// The contract suite of driver kind `qa.intake` (spec 2.15.1, 3.3 "Intake contract"). Every
// intake driver runs it against its own fixtures, described by an `IntakeScenario`.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { defineContract } from '@launchwrighthq/kernel/testing';
import { expect } from 'vitest';
import { type AttachmentKind, QA_INTAKE_SPEC_VERSION, type QaIntakeDriver } from '../drivers/intake/contract.mts';

/** What the fixtures of one driver hold. */
export interface IntakeScenario {
  /** The ref that the fixtures answer. */
  ref: string;
  /** The item count of a full fetch. */
  items: number;
  /** The kinds that arrive with bytes. */
  kinds: AttachmentKind[];
  /** The `from` of each media over the size cap. */
  tooLarge: string[];
  /** A ref that the driver refuses, and the error code. */
  badRef: { ref: string; code: string };
  /** With the `window` capability: a message id, and the ids of the items after it. */
  since?: { id: number; items: string[] };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(LaunchwrightError);
  return (err as LaunchwrightError).code;
}

/** The `qa.intake` contract suite for one driver's fixtures. */
export function intakeContract(s: IntakeScenario) {
  return defineContract<QaIntakeDriver>('qa.intake', QA_INTAKE_SPEC_VERSION, [
    {
      name: 'fetch returns the items of the ref in time order with unique ids',
      async run(d) {
        const b = await d.fetch(s.ref);
        expect(b.source).toBe(d.source);
        expect(b.ref).not.toBe('');
        expect(b.items).toHaveLength(s.items);
        expect(new Set(b.items.map((i) => i.id)).size).toBe(b.items.length);
        const times = b.items.map((i) => Date.parse(i.at));
        for (const [n, i] of b.items.entries()) {
          expect(new Date(i.at).toISOString()).toBe(i.at);
          expect(i.author).not.toBe('');
          expect(typeof i.text).toBe('string');
          if (n > 0) expect(times[n] as number).toBeGreaterThanOrEqual(times[n - 1] as number);
        }
      },
    },
    {
      name: 'every media holds bytes and a media type, or a skip reason',
      async run(d) {
        const b = await d.fetch(s.ref);
        const media = b.items.flatMap((i) => i.media);
        expect(media.length).toBeGreaterThan(0);
        for (const m of media) {
          expect(m.from).not.toBe('');
          expect(m.from).not.toContain('?');
          if (m.data !== undefined) {
            expect(m.skipped).toBeUndefined();
            expect(m.data.byteLength).toBeGreaterThan(0);
            expect(m.mime).toMatch(/^[a-z]+\/[\w.+-]+$/);
          } else {
            expect(['too-large', 'unreachable', 'unsupported']).toContain(m.skipped);
          }
        }
      },
    },
    {
      name: 'the media kinds of the fixtures arrive with bytes',
      async run(d) {
        const b = await d.fetch(s.ref);
        const kinds = new Set(b.items.flatMap((i) => i.media.filter((m) => m.data !== undefined).map((m) => m.kind)));
        for (const k of s.kinds) expect(kinds).toContain(k);
      },
    },
    {
      name: 'a media over qa.intake.maxFileMb is skipped as too-large',
      async run(d) {
        expect(s.tooLarge.length).toBeGreaterThan(0);
        const b = await d.fetch(s.ref);
        const media = b.items.flatMap((i) => i.media);
        for (const from of s.tooLarge) {
          const m = media.find((x) => x.from === from);
          expect(m, from).toBeDefined();
          expect(m?.skipped).toBe('too-large');
          expect(m?.data).toBeUndefined();
        }
      },
    },
    {
      name: 'a bad ref fails with a qa.intake error code',
      async run(d) {
        expect(s.badRef.code).toMatch(/^qa\.intake\./);
        expect(await codeOf(d.fetch(s.badRef.ref))).toBe(s.badRef.code);
      },
    },
    {
      name: 'a fetch from the cursor of a fetch reads no old item',
      async run(d) {
        const first = await d.fetch(s.ref);
        if (!d.supports('cursor')) {
          expect(first.cursor).toBeUndefined();
          return;
        }
        expect(first.cursor).toBeDefined();
        const again = await d.fetch(s.ref, { cursor: first.cursor as string });
        const old = new Set(first.items.map((i) => i.id));
        expect(again.items.filter((i) => old.has(i.id))).toEqual([]);
      },
    },
    {
      name: 'a since bound keeps only the items after it',
      async run(d) {
        if (!d.supports('window')) {
          expect(s.since).toBeUndefined();
          return;
        }
        expect(s.since).toBeDefined();
        const since = s.since as { id: number; items: string[] };
        const b = await d.fetch(s.ref, { since: since.id });
        expect(b.items.map((i) => i.id)).toEqual(since.items);
      },
    },
  ]);
}
