// The node runner on a stub program that never exits: the timeout of `run` ends it.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { nodeRunner } from '../../../../src/device/services/process.mts';

describe('nodeRunner', () => {
  it('kills a stuck process at its timeout', async () => {
    const stub = join(await tmpDir(), 'stuck');
    await writeFile(stub, '#!/bin/sh\nwhile true; do :; done\n', { mode: 0o755 });
    const res = await nodeRunner.run(stub, [], { timeoutMs: 200 });
    expect(res.code).toBe(128);
  });
});
