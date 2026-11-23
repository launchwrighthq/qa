import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, onTestFinished } from 'vitest';

/**
 * Makes an empty folder under the worker temp root. Inside a test, the folder goes away when
 * the test finishes. A folder from a `beforeAll` hook goes away with the worker temp root.
 */
export async function tmpDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'lw-'));
  if (expect.getState().currentTestName) {
    onTestFinished(() => rm(dir, { recursive: true, force: true }));
  }
  return dir;
}
