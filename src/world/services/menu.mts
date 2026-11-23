// `lw qa worktree --set-menu`: points the menu button of the dev bot at the tunnel URL of the run,
// through the library's Bot API client (`setChatMenuButton`).
import { LaunchwrightError } from '../../kernel/index.mts';
import { BotApi, type FetchFn } from '../../telegram/bot-api.mts';

export interface MenuOptions {
  /** Config section `telegram`. */
  telegram: unknown;
  /** The bot of `telegram.bots`. Default: the only bot. */
  bot?: string;
  /** The label of the button. */
  text: string;
  url: string;
  /** The `fetch` of the Bot API client. Tests pass the one of `FakeBotApi`. */
  fetch?: FetchFn;
}

/** Sets the default menu button of the bot to open `url` as a Mini App. Throws `qa.menu.bot`. */
export async function setMenuButton(o: MenuOptions): Promise<void> {
  const section = (o.telegram ?? {}) as { apiUrl?: string; bots?: Record<string, { token?: string }> };
  const bots = Object.entries(section.bots ?? {});
  const picked = o.bot === undefined ? (bots.length === 1 ? bots[0] : undefined) : bots.find(([name]) => name === o.bot);
  if (picked === undefined) {
    const names = bots.map(([name]) => name).join(', ') || 'none';
    throw new LaunchwrightError('qa.menu.bot', o.bot === undefined ? `Name the dev bot with --bot. Bots: ${names}.` : `No bot ${o.bot} in config telegram.bots. Bots: ${names}.`);
  }
  const [name, bot] = picked;
  if (bot.token === undefined) throw new LaunchwrightError('qa.menu.bot', `Bot ${name} has no token in config, so lw qa cannot set its menu button.`);
  const api = new BotApi({ token: bot.token, ...(section.apiUrl ? { apiUrl: section.apiUrl } : {}), ...(o.fetch ? { fetch: o.fetch } : {}) });
  await api.setChatMenuButton({ type: 'web_app', text: o.text, web_app: { url: o.url } });
}
