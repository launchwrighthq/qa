// The gh runner on a stub program that never exits: the call timeout ends it.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { ghRunner } from '../../../../src/intake/services/gh.mts';

describe('ghRunner', () => {
  it('stops a stuck gh call at its timeout', async () => {
    const stub = join(await tmpDir(), 'gh');
    await writeFile(stub, '#!/bin/sh\nwhile true; do :; done\n', { mode: 0o755 });
    const gh = ghRunner({ bin: stub, timeoutMs: 200 });
    await expect(gh(['issue', 'view', '7'])).rejects.toMatchObject({ code: 'qa.intake.github.timeout', context: { command: 'issue view', timeoutMs: 200 } });
  });
});
