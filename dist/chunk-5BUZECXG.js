import {
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/states/services/sessions.mts
var PERSONA_LAUNCH_ROUTE = "/";
function sessionPool(target, base) {
  const held = /* @__PURE__ */ new Map();
  const notes = [];
  const label = (persona) => persona === null ? "no persona" : `persona ${persona}`;
  const dispose = async (session, persona) => {
    try {
      await session.close();
    } catch (err) {
      notes.push(`the lost session of ${label(persona)} did not close: ${messageOf(err).split("\n")[0]}`);
    }
  };
  const lost = (session) => session.isClosed?.() === true;
  return {
    notes,
    lost,
    async get(persona) {
      const key = persona ?? "";
      const open = held.get(key);
      if (open && !lost(open)) return open;
      if (open) {
        held.delete(key);
        await dispose(open, persona);
        notes.push(`the browser of ${label(persona)} closed, so a new session opened`);
      }
      const session = await target.open({ ...base, ...persona === null ? {} : { persona } });
      if (persona !== null && base.leg.surface === "miniapp") {
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
        if (lost(session)) await dispose(session, key === "" ? null : key);
        else await session.close();
      }
    }
  };
}
function failedResult(capture, reason, error) {
  return { id: capture.id, union: capture.union, member: capture.member, ok: false, subject: null, context: null, provenance: null, verified: null, error, reason, ms: 0 };
}
var firstLine = (err) => messageOf(err).split("\n")[0] ?? "";
async function onSession(pool, persona, captures, work) {
  let session;
  try {
    session = await pool.get(persona);
  } catch (err) {
    const who = persona === null ? "the session" : `the session of persona ${persona}`;
    return captures.map((c) => failedResult(c, "blocked", `${who} did not open: ${firstLine(err)}`));
  }
  let results;
  try {
    results = await work(session);
  } catch (err) {
    if (!pool.lost(session)) throw err;
    results = captures.map((c) => failedResult(c, "crashed", firstLine(err)));
  }
  if (!pool.lost(session)) return results;
  return results.map((r) => r.ok ? r : { ...r, reason: "crashed", error: `the browser closed during this capture: ${r.error ?? "no reason given"}` });
}

export {
  PERSONA_LAUNCH_ROUTE,
  sessionPool,
  failedResult,
  onSession
};
//# sourceMappingURL=chunk-5BUZECXG.js.map