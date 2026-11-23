// Applied-seed capture (spec 2.5, provenance `forged`): the fallback for a declared state that no
// seed and no route reaches. `lw qa states infer --apply` records a forged capture for each member
// of an inferred seed. A forged capture never counts as a live pass (spec 2.5, 2.12.2), so the
// report marks the state and leaves the run partial.
//
// The seed runs through the app services where a running app supplies them, else a labelled direct
// row write. The library cannot reach a running app from here, so the capture is recorded at the
// states-run level: it writes the inferred seed as the evidence, and the recorder tags it `forged`.
// A full live apply still needs a running app on the real route to render and photograph the state.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import type { EvidenceRecorder } from './capture.mts';
import { type SeedProposal, statePath, type StateResult } from './inventory.mts';

/** The caveat every forged capture carries. A reviewer reads it beside the state. */
export const FORGE_CAVEAT =
  'A forged capture records the inferred seed only. A live apply needs a running app on the real route to render and photograph the state.';

/** What the forged artifact file holds: the seed the library inferred, so a reviewer can read it. */
export interface ForgedArtifact {
  union: string;
  member: string;
  via: SeedProposal['via'];
  provenance: 'forged';
  fields: SeedProposal['fields'];
  reason: string;
  note: string;
}

/**
 * Records one forged capture for one member of an inferred seed (spec 2.5). The library reached the
 * state by neither a route nor a mount, so it writes the inferred seed as the evidence file and
 * records it through the recorder with provenance `forged`. The report marks the state forged and
 * never counts it as a live pass (spec 2.12.2).
 */
export async function captureForged(
  seed: SeedProposal,
  member: string,
  ctx: { reportDir: string; slug: string; record: EvidenceRecorder; now: () => number },
): Promise<StateResult> {
  const started = ctx.now();
  const id = `${seed.union}.${member}`;
  const rel = statePath(ctx.slug, id, 'forged', 'json');
  const file = posix.join(ctx.reportDir, rel);
  const artifact: ForgedArtifact = {
    union: seed.union,
    member,
    via: seed.via,
    provenance: 'forged',
    fields: seed.fields,
    reason: seed.reason,
    note: FORGE_CAVEAT,
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`);
  await ctx.record({ file, kind: 'log', row: id });
  return {
    id,
    union: seed.union,
    member,
    ok: true,
    subject: null,
    context: null,
    provenance: 'forged',
    // No feature function runs over a forged seed. Null is "not checked", never "it agreed".
    verified: null,
    error: null,
    expect: `forged seed via ${seed.via}: a live apply renders ${seed.union}=${member}. Not proven here.`,
    ms: ctx.now() - started,
  };
}
