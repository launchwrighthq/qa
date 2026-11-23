// What every device session shares: the capability refusal, the settle poll, the act answer and
// the PNG write. A device session drives a page through `evaluate`, so these take that function.
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isCodedError, LaunchwrightError } from '../../kernel/index.mts';
import { type Act, pngSize, type Settle } from '../../index.mts';
import type { Capture, QaTargetCapability, SessionLogLine } from '../drivers/target/contract.mts';
import { actExpression, type PageAnswer, settleExpression } from './page-script.mts';
import { type DeviceClock, type DeviceDeps, orFail } from './process.mts';

/** The default settle timeout (spec 2.4). */
export const SETTLE_TIMEOUT_MS = 20_000;

/** The poll interval of a settle check. */
const SETTLE_EVERY_MS = 250;

export function capabilityError(target: string, capability: QaTargetCapability, what: string): LaunchwrightError {
  return new LaunchwrightError('qa.target.capability', `The ${target} target has no ${capability} capability, so it cannot ${what}.`, {
    context: { target, capability },
  });
}

export function closedError(target: string, call: string): LaunchwrightError {
  return new LaunchwrightError('qa.target.closed', `The ${target} session is closed; ${call} needs an open session.`);
}

/**
 * Polls the settle rule until it holds. A throw while the document is replaced is a moment, not a
 * verdict, so it is kept and retried. At the deadline the last unmet condition or throw is the reason.
 */
export async function pollSettle(clock: DeviceClock, rule: Settle, evaluate: (expr: string) => Promise<unknown>, target: string): Promise<void> {
  const expression = settleExpression(rule);
  const timeout = rule.timeout ?? SETTLE_TIMEOUT_MS;
  const deadline = clock.now() + timeout;
  let missing: string[] = ['not evaluated'];
  for (;;) {
    try {
      const answer = (await evaluate(expression)) as PageAnswer | undefined;
      if (answer?.ok) return;
      missing = answer?.missing ?? ['no answer'];
    } catch (err) {
      if (!isCodedError(err)) throw err;
      missing = [`the check threw: ${err.message}`];
    }
    if (clock.now() >= deadline) {
      throw new LaunchwrightError('qa.target.settle', `The ${target} page never showed ${missing.join(', ')} within ${timeout} ms.`, {
        context: { rule, missing },
      });
    }
    await clock.sleep(SETTLE_EVERY_MS);
  }
}

/** Runs one in-page act step and fails with `qa.target.act` on an `{ ok: false }` answer. */
export async function pageAct(step: Act, evaluate: (expr: string) => Promise<unknown>, target: string): Promise<void> {
  const answer = (await evaluate(actExpression(step))) as PageAnswer | undefined;
  if (answer && answer.ok === false) {
    throw new LaunchwrightError('qa.target.act', `The act ${step.kind} on the ${target} page failed: ${answer.error ?? 'no reason given'}.`, {
      context: { kind: step.kind, target: step.target },
    });
  }
}

/** Writes PNG bytes and returns the capture, or fails with `qa.target.screenshot`. */
export async function writePng(path: string, bytes: Buffer, target: string): Promise<Capture> {
  const size = pngSize(bytes);
  if (size === null) throw new LaunchwrightError('qa.target.screenshot', `The ${target} target returned ${bytes.length} bytes that are not a PNG.`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return { path, ...size };
}

export async function writeBytes(path: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

/**
 * Holds the last frame of a clip until the wall-clock length of the recording. Android writes a
 * frame only when the screen changes, so a still page gives a clip of 0.2 s for a row of 2 s, and
 * the blank-video rule would fail it.
 */
export async function holdLastFrame(deps: Pick<DeviceDeps, 'run'>, ffmpeg: string, path: string, durationMs: number): Promise<void> {
  const seconds = (durationMs / 1000).toFixed(3);
  const held = `${path}.held.mp4`;
  const args = ['-y', '-v', 'error', '-i', path, '-vf', `tpad=stop_mode=clone:stop_duration=${seconds}`, '-t', seconds, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', held];
  orFail(await deps.run.run(ffmpeg, args, { timeoutMs: 120_000 }), 'qa.device.record', `holding the last frame of ${path} with ${ffmpeg}`);
  await rename(held, path);
}

/**
 * The session log kind (spec 2.11.1) of one console message, or null for a message the log does not
 * keep. WebKit writes level `error`, chromedriver `SEVERE`; both name the source the same way.
 */
export function consoleLogKind(line: { source: string; level: string; text: string }): SessionLogLine['kind'] | null {
  if (line.level !== 'error' && line.level !== 'SEVERE') return null;
  if (line.source === 'javascript') return 'page-error';
  if (line.source === 'console-api') return 'console-error';
  if (line.source === 'network') return /status of 5\d\d\b/.test(line.text) ? 'response-5xx' : 'request-failed';
  return null;
}

/** A `wait` act: the runner checked its `why`; the session sleeps on the device clock. */
export async function waitAct(clock: DeviceClock, step: Act): Promise<void> {
  if (!step.why) throw new LaunchwrightError('qa.target.act', 'A wait act needs a why: it names what the row waits for.');
  await clock.sleep(step.ms ?? 0);
}
