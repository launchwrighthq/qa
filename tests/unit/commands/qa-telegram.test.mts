import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaCommand } from '../../../src/commands/qa.command.mts';
import { fakePersonas, firstNameOf, qaWebhook, telegramPort } from '../../../src/commands/qa-telegram.mts';
import { listWorld, loadRegistry, qaFakeToken, qaTelegramId, registryHash } from '../../../src/world/index.mts';
import { nodeFetch } from '../../support/node-fetch.mts';

const WORLD = `export default {
  personas: [{ id: 'member-expiring', summary: 'A member', seed: async () => ({ userId: 'u1' }) }],
};
`;
const BOTS = { telegram: { bots: { main: { id: 4242, username: 'main_test_bot', transport: 'polling' } } } };

async function projectWithWorld(): Promise<string> {
  const root = await tmpDir();
  await mkdir(join(root, 'qa'), { recursive: true });
  await writeFile(join(root, 'qa/members.world.mts'), WORLD);
  return root;
}

describe('lw qa telegram helpers', () => {
  it('gives each persona its QA Telegram id and a first name', () => {
    expect(firstNameOf('member-expiring')).toBe('Member expiring');
    expect(firstNameOf('shop.owner')).toBe('Shop owner');
    const personas = fakePersonas({ personas: [{ id: 'guest', summary: 's', feature: 'f', file: 'f.world.mts', seed: async () => ({ userId: 'u' }) }], facts: [] });
    expect(personas).toEqual([{ id: 'guest', telegramId: qaTelegramId('guest'), firstName: 'Guest' }]);
  });

  it('takes the port of qa.telegramUrl unless --port names one', () => {
    expect(telegramPort(undefined, 'http://127.0.0.1:9102')).toBe(9102);
    expect(telegramPort('0', 'http://127.0.0.1:9102')).toBe(0);
    expect(() => telegramPort('99999', 'http://127.0.0.1:9102')).toThrow(expect.objectContaining({ code: 'qa.telegram.usage' }));
  });

  it('posts to the QA API webhook when a bot uses the webhook transport', () => {
    const secret = 's'.repeat(32);
    expect(qaWebhook({ telegram: { bots: { a: { transport: 'polling' } } } }, 9101)).toBeUndefined();
    expect(qaWebhook({ telegram: { bots: { a: {} }, webhook: { secret } } }, 9101)).toEqual({ url: 'http://127.0.0.1:9101/tg/bots/{botId}', secret });
    expect(qaWebhook({ telegram: { bots: { a: {} }, webhook: { secret, path: '/hooks/tg' } } }, 9200)?.url).toBe('http://127.0.0.1:9200/hooks/tg/{botId}');
    expect(() => qaWebhook({ telegram: { bots: { a: {} } } }, 9101)).toThrow(expect.objectContaining({ code: 'qa.telegram.webhook' }));
  });
});

describe('lw qa telegram', () => {
  it('refuses the production environment', async () => {
    const root = await projectWithWorld();
    const err: string[] = [];
    const code = await qaCommand.run(['telegram'], { cwd: root, out: () => undefined, err: (l) => err.push(l), config: BOTS, env: 'production' });
    expect(code).toBe(1);
    expect(err.join('\n')).toContain('qa.telegram.production');
  });

  it('refuses a project with no bot', async () => {
    const root = await projectWithWorld();
    const err: string[] = [];
    const code = await qaCommand.run(['telegram', '--port', '0'], { cwd: root, out: () => undefined, err: (l) => err.push(l), config: {} });
    expect(code).toBe(1);
    expect(err.join('\n')).toContain('qa.telegram.no-bot');
  });

  it('serves the bots with their fake tokens and the chat page until the signal aborts', async () => {
    const root = await projectWithWorld();
    const out: string[] = [];
    const controller = new AbortController();
    let listening!: () => void;
    const ready = new Promise<void>((resolve) => (listening = resolve));
    const running = qaCommand.run(['telegram', '--port', '0'], {
      cwd: root,
      out: (l) => {
        out.push(l);
        if (out.length === 2) listening();
      },
      err: () => undefined,
      config: BOTS,
      env: 'local',
      signal: controller.signal,
    });
    await Promise.race([ready, running.then((code) => Promise.reject(new Error(`lw qa telegram exited ${code} before it listened`)))]);
    const [url, page] = out as [string, string];
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(page).toBe(`${url}/__tg`);
    const hash = registryHash(listWorld(await loadRegistry(root)));
    const me = (await (await nodeFetch(`${url}/bot${qaFakeToken(4242, hash)}/getMe`)).json()) as { ok: boolean; result: { username: string } };
    expect(me).toMatchObject({ ok: true, result: { username: 'main_test_bot' } });
    const chat = await nodeFetch(page);
    expect(chat.status).toBe(200);
    expect(await chat.text()).toContain('<html');
    controller.abort();
    expect(await running).toBe(0);
  });
});
