import { FAKE_API_URL, FakeBotApi } from '../../../../src/telegram-fake/index.mts';
import { describe, expect, it } from 'vitest';
import { setMenuButton } from '../../../../src/world/services/menu.mts';

const TOKEN = '424242:PlaygroundTestTokenAAAAAAAAAAAAAAAA';

describe('setMenuButton', () => {
  it('calls setChatMenuButton of the only bot with the Mini App URL', async () => {
    const fake = new FakeBotApi();
    await setMenuButton({ telegram: { apiUrl: FAKE_API_URL, bots: { brand: { token: TOKEN } } }, text: 'Open', url: 'https://tunnel.test/app', fetch: fake.fetch });
    expect(fake.calls.map((c) => [c.method, c.params])).toEqual([['setChatMenuButton', { menu_button: { type: 'web_app', text: 'Open', web_app: { url: 'https://tunnel.test/app' } } }]]);
  });

  it('refuses an unnamed bot when the config has two, and a bot without a token', async () => {
    const two = { bots: { a: { token: TOKEN }, b: { token: TOKEN } } };
    await expect(setMenuButton({ telegram: two, text: 'Open', url: 'https://t.test' })).rejects.toMatchObject({ code: 'qa.menu.bot' });
    await expect(setMenuButton({ telegram: { bots: { a: { id: 1 } } }, bot: 'a', text: 'Open', url: 'https://t.test' })).rejects.toMatchObject({ code: 'qa.menu.bot' });
  });
});
