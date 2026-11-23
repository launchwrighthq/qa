// The video tools on a stub program that never exits: the run timeout ends it.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { systemVideoTools } from '../../../src/services/video.mts';

describe('systemVideoTools', () => {
  it('stops a stuck tool at its timeout', async () => {
    const stub = join(await tmpDir(), 'ffprobe');
    await writeFile(stub, '#!/bin/sh\nwhile true; do :; done\n', { mode: 0o755 });
    const tools = systemVideoTools({ ffprobe: stub, timeoutMs: 200 });
    await expect(tools.ffprobe([])).rejects.toMatchObject({ code: 'qa.video.timeout', context: { bin: stub, timeoutMs: 200 } });
  });
});
