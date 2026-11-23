// What `lw qa states run` and `lw qa paths crawl|record` share: the target registry, the clock,
// the checkout revision, the leg a run uses, and the recorder that puts each evidence file in the
// ledger (spec 2.11.3).
import { relative } from 'node:path';
import { type App, CLOCK, type Clock, LaunchwrightError, systemClock } from '@launchwrighthq/kernel';
import type { QaConfig } from '../../config.mts';
import type { QaTarget, QaTargetRegistry } from '../../drivers/target/contract.mts';
import { git } from '../../services/changes.mts';
import { appendLedger, ledgerEntry } from '../../services/ledger.mts';
import { legDefinitions } from '../../services/legs.mts';
import { BROWSER_TARGETS } from '../../services/runner.mts';
import { createTargetRegistry } from '../../services/targets.mts';
import type { Leg, LedgerEntry, Provenance } from '../../services/types.mts';
import { QA_TARGETS } from '../../tokens.mts';
import type { EvidenceRecorder } from './capture.mts';

/** The dependencies of a run. A test passes fakes; the command builds the defaults. */
export interface RunDeps {
  targets: QaTargetRegistry;
  clock: Clock;
  /** The commit and the dirty flag of the checkout, for each ledger entry. */
  revision: (cwd: string) => { commit: string; dirty: boolean };
}

/** The commit and dirty flag of a checkout, or `none` outside git. */
export function gitRevision(cwd: string): { commit: string; dirty: boolean } {
  const commit = git(cwd, ['rev-parse', 'HEAD'], { allowFail: true })?.trim() || 'none';
  const status = git(cwd, ['status', '--porcelain'], { allowFail: true });
  return { commit, dirty: (status ?? '').trim() !== '' };
}

/** The clock of a run: an override, else the booted app's kernel clock, else the system clock. */
export function runClock(app: App | undefined, overrides: Partial<RunDeps> = {}): Clock {
  return overrides.clock ?? (app ? app.get(CLOCK) : systemClock);
}

/**
 * The run dependencies: an override first, then the booted app's targets and clock, then a fresh
 * registry from the config and `extra` with the system clock.
 */
export function runDeps(config: QaConfig, app: App | undefined, overrides: Partial<RunDeps> = {}, extra: Record<string, QaTarget> = {}): RunDeps {
  const clock = runClock(app, overrides);
  return {
    clock,
    targets: overrides.targets ?? (app ? app.get(QA_TARGETS) : createTargetRegistry(config, extra, clock)),
    revision: overrides.revision ?? gitRevision,
  };
}

/** One leg by name, from the defaults and `qa.legs`. Fails with `qa.legs.unknown`. */
export function legByName(config: QaConfig, name: string): Leg {
  const legs = legDefinitions(config);
  const leg = legs.find((l) => l.name === name);
  if (!leg) {
    throw new LaunchwrightError('qa.legs.unknown', `No leg is named ${name}. Legs: ${legs.map((l) => l.name).join(', ')}.`, { context: { leg: name } });
  }
  return leg;
}

/**
 * The device a video names (spec 2.7: a video needs a device). A browser target names its browser.
 * A device target names `leg.device`, or null, which refuses the video.
 */
export function deviceOf(leg: Leg): string | null {
  if (BROWSER_TARGETS.has(leg.target)) return `browser ${leg.browser ?? 'chromium'}`;
  return leg.device ?? null;
}

/**
 * A recorder that collects ledger entries for one leg and one provenance, and writes them to the
 * ledger of the slug in one step on `flush`.
 */
export function ledgerRecorder(args: {
  reportDir: string;
  slug: string;
  leg: Leg;
  provenance: Provenance;
  clock: Clock;
  revision: { commit: string; dirty: boolean };
}): { record: EvidenceRecorder; flush: () => Promise<number> } {
  const entries: LedgerEntry[] = [];
  const device = args.leg.device;
  return {
    async record({ file, kind, row }) {
      entries.push(
        await ledgerEntry(args.reportDir, {
          path: relative(args.reportDir, file).split('\\').join('/'),
          kind,
          capturedAt: args.clock.date().toISOString(),
          commit: args.revision.commit,
          dirty: args.revision.dirty,
          leg: args.leg.name,
          target: args.leg.target,
          ...(device === undefined ? {} : { device }),
          provenance: args.provenance,
          row,
          attempt: 1,
        }),
      );
    },
    async flush() {
      const batch = entries.splice(0);
      if (batch.length > 0) await appendLedger(args.reportDir, args.slug, batch);
      return batch.length;
    },
  };
}
