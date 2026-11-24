// The sessions of a state run (spec 2.7): one per persona, opened when a capture first needs it.
// A session whose browser or page closed by itself is dropped, and the next capture opens a new
// one. One crash then fails one capture, never every capture after it.
import { messageOf } from '../../kernel/index.mts';
import type { OpenOptions, QaSession, QaTarget } from '../../drivers/target/contract.mts';
import type { FailReason, PlannedCapture, StateResult } from './inventory.mts';

/**
 * The route a Mini App persona session opens first. The navigation carries `?qa=<persona>`, and
 * the launch signs the persona in, as on a session row (spec 2.6). A web session signs in when it
 * opens, through `POST /__qa/session`.
 */
export const PERSONA_LAUNCH_ROUTE = '/';

export interface SessionPool {
  /** The open session of a persona, or of no persona for null. It opens on first use, and again after a crash. */
  get(persona: string | null): Promise<QaSession>;
  /** True when the session closed by itself. The next `get` of its persona opens a new one. */
  lost(session: QaSession): boolean;
  /** What the pool did that a reader should know: each reopen, and each failure to close a lost session. */
  readonly notes: string[];
  close(): Promise<void>;
}

/** A pool over one target and leg. `base` is the open options of every session, without the persona. */
export function sessionPool(target: QaTarget, base: Omit<OpenOptions, 'persona'>): SessionPool {
  const held = new Map<string, QaSession>();
  const notes: string[] = [];
  const label = (persona: string | null): string => (persona === null ? 'no persona' : `persona ${persona}`);
  const dispose = async (session: QaSession, persona: string | null): Promise<void> => {
    try {
      await session.close();
    } catch (err) {
      // A crashed browser often refuses its own close. The note keeps the reason.
      notes.push(`the lost session of ${label(persona)} did not close: ${messageOf(err).split('\n')[0]}`);
    }
  };
  const lost = (session: QaSession): boolean => session.isClosed?.() === true;
  return {
    notes,
    lost,
    async get(persona) {
      const key = persona ?? '';
      const open = held.get(key);
      if (open && !lost(open)) return open;
      if (open) {
        held.delete(key);
        await dispose(open, persona);
        notes.push(`the browser of ${label(persona)} closed, so a new session opened`);
      }
      const session = await target.open({ ...base, ...(persona === null ? {} : { persona }) });
      if (persona !== null && base.leg.surface === 'miniapp') {
        try {
          await session.navigate(PERSONA_LAUNCH_ROUTE);
        } catch (err) {
          await dispose(session, persona);
          throw err;
        }
      }
      held.set(key, session);
      return session;
    },
    async close() {
      const all = [...held.entries()];
      held.clear();
      for (const [key, session] of all) {
        if (lost(session)) await dispose(session, key === '' ? null : key);
        else await session.close();
      }
    },
  };
}

/** A failed result for a capture that never reached its runner. */
export function failedResult(capture: Pick<PlannedCapture, 'id' | 'union' | 'member'>, reason: FailReason, error: string): StateResult {
  return { id: capture.id, union: capture.union, member: capture.member, ok: false, subject: null, context: null, provenance: null, verified: null, error, reason, ms: 0 };
}

const firstLine = (err: unknown): string => messageOf(err).split('\n')[0] ?? '';

/**
 * Runs captures on the session of a persona. A session that does not open fails each capture as
 * `blocked` with the reason. When the session closed during the work, each failed capture becomes
 * `crashed` with the reason, and the next call opens a new session.
 */
export async function onSession(
  pool: SessionPool,
  persona: string | null,
  captures: readonly Pick<PlannedCapture, 'id' | 'union' | 'member'>[],
  work: (session: QaSession) => Promise<StateResult[]>,
): Promise<StateResult[]> {
  let session: QaSession;
  try {
    session = await pool.get(persona);
  } catch (err) {
    const who = persona === null ? 'the session' : `the session of persona ${persona}`;
    return captures.map((c) => failedResult(c, 'blocked', `${who} did not open: ${firstLine(err)}`));
  }
  let results: StateResult[];
  try {
    results = await work(session);
  } catch (err) {
    if (!pool.lost(session)) throw err;
    results = captures.map((c) => failedResult(c, 'crashed', firstLine(err)));
  }
  if (!pool.lost(session)) return results;
  return results.map((r) => (r.ok ? r : { ...r, reason: 'crashed' as const, error: `the browser closed during this capture: ${r.error ?? 'no reason given'}` }));
}
