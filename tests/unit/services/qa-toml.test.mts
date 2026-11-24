import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { interpolateEnv, loadQaToml } from '../../../src/services/qa-toml.mts';

const SECRET = 'pw-0f3c9a';

async function project(toml: string, file = 'qa.toml'): Promise<string> {
  const root = await tmpDir();
  await mkdir(join(root, '.lw'), { recursive: true });
  await writeFile(join(root, file), toml);
  return root;
}

describe('interpolateEnv', () => {
  it('fills a reference, a default and an escaped dollar', () => {
    const env = { A: 'one', EMPTY: '' };
    expect(interpolateEnv('x-${A}-y', env, 'k', 'qa.toml')).toBe('x-one-y');
    expect(interpolateEnv('${MISSING:-fallback}', env, 'k', 'qa.toml')).toBe('fallback');
    expect(interpolateEnv('${EMPTY:-fallback}', env, 'k', 'qa.toml')).toBe('fallback');
    expect(interpolateEnv('${EMPTY}', env, 'k', 'qa.toml')).toBe('');
    expect(interpolateEnv('${A:-}', env, 'k', 'qa.toml')).toBe('one');
    expect(interpolateEnv('$${A}', env, 'k', 'qa.toml')).toBe('${A}');
    expect(interpolateEnv('no reference', env, 'k', 'qa.toml')).toBe('no reference');
  });

  it('refuses a malformed reference with the key and the file', () => {
    expect(() => interpolateEnv('${1BAD}', {}, 'qa.database', 'qa.toml')).toThrow(expect.objectContaining({ code: 'qa.config.env', context: { key: 'qa.database', file: 'qa.toml' } }));
    expect(() => interpolateEnv('${OPEN', {}, 'qa.database', 'qa.toml')).toThrow(expect.objectContaining({ code: 'qa.config.env' }));
  });
});

describe('loadQaToml', () => {
  it('fills string values at every depth from the env', async () => {
    const root = await project(['url = "${QA_DATABASE_URL}"', 'clientRoots = ["${CLIENT:-web/src}"]', '[device.browserstack]', 'username = "${BS_USER}"', 'budgetMinutes = 3', ''].join('\n'));
    const sections = loadQaToml(root, { QA_DATABASE_URL: `postgres://qa:${SECRET}@127.0.0.1/qa`, BS_USER: 'user' });
    expect(sections).toEqual({
      qa: { url: `postgres://qa:${SECRET}@127.0.0.1/qa`, clientRoots: ['web/src'], device: { browserstack: { username: 'user', budgetMinutes: 3 } } },
    });
  });

  it('keeps a file with a qa table as sections, and reads .lw/qa.toml', async () => {
    const root = await project('[qa]\nreportDir = "${DIR:-docs/qa}"\n[apps.client]\ndir = "web"\n', '.lw/qa.toml');
    expect(loadQaToml(root, {})).toEqual({ qa: { reportDir: 'docs/qa' }, apps: { client: { dir: 'web' } } });
  });

  it('fails on a missing env key with the dotted key and the file, never a value', async () => {
    const root = await project(`[qa]\nseed = "${SECRET}"\n[qa.world]\nurl = "\${QA_DATABASE_URL}"\n`);
    let caught: unknown;
    try {
      loadQaToml(root, { OTHER: SECRET });
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ code: 'qa.config.env', context: { key: 'qa.world.url', file: 'qa.toml', envKey: 'QA_DATABASE_URL' } });
    expect((caught as Error).message).toContain('qa.world.url');
    expect((caught as Error).message).toContain('QA_DATABASE_URL');
    expect((caught as Error).message).not.toContain(SECRET);
  });

  it('gives {} when no file exists', async () => {
    expect(loadQaToml(await tmpDir(), {})).toEqual({});
  });
});
