// The stamp of a build: config section `stamp` (versioning spec 2.4).
import { z } from 'zod';
import { systemClock } from './clock.mts';
import { LaunchwrightError } from './errors.mts';

/** The release id of a local run, and of a build with no CI stamp. */
export const DEV_RELEASE = 'dev';

/** The release id of a CI build: `<commit count>-<sha7>`, for example `1842-a1b2c3d`. */
export const RELEASE_ID = /^[1-9][0-9]{0,8}-[0-9a-f]{7}$/;

/** A semver `MAJOR.MINOR.PATCH` with an optional pre-release. Build metadata (`+...`) is refused. */
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;

/** The version of a project that has no `VERSION` file yet. */
export const NO_VERSION = '0.0.0';

/** The schema of config section `stamp`. The project loaders fill it, and no project file sets it. */
export const stampConfig = z.strictObject({
  version: z.string().regex(SEMVER, 'must be semver MAJOR.MINOR.PATCH[-pre] with no build metadata'),
  release: z.string().refine((r) => r === DEV_RELEASE || RELEASE_ID.test(r), `must be ${DEV_RELEASE} or <build>-<sha7>`),
  commit: z.string().regex(/^[0-9a-f]{40}$/, 'must be 40 lower-case hex digits').nullable(),
  builtAt: z.iso.datetime({ offset: true, error: 'must be an ISO date and time' }),
});

/** The version, the release id, the commit and the build time of the running code. */
export type Stamp = z.infer<typeof stampConfig>;

/** The stamp of an app that got no `stamp` section, such as a test app. */
export function devStamp(now: Date = systemClock.date()): Stamp {
  return { version: NO_VERSION, release: DEV_RELEASE, commit: null, builtAt: now.toISOString() };
}

/**
 * The version in the text of a `VERSION` file: one line, semver, and an optional final newline.
 * Throws LaunchwrightError('release.version.file') with `context.problem` `lines` or `semver`.
 */
export function parseVersion(text: string, file = 'VERSION'): string {
  const body = text.endsWith('\r\n') ? text.slice(0, -2) : text.endsWith('\n') ? text.slice(0, -1) : text;
  if (/[\r\n]/.test(body)) {
    throw new LaunchwrightError('release.version.file', `${file} must hold one line, the version`, { context: { file, problem: 'lines' } });
  }
  if (!SEMVER.test(body)) {
    throw new LaunchwrightError('release.version.file', `${file} must hold a semver MAJOR.MINOR.PATCH[-pre] with no build metadata, not "${body}"`, {
      context: { file, problem: 'semver' },
    });
  }
  return body;
}
