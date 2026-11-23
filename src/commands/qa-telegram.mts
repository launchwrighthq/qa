// `lw qa telegram [--port <p>]` (spec 2.10): the fake Bot API server and the `/__tg` chat page on
// loopback, for the QA API and the `telegram-fake` leg. It serves the bots of config
// `telegram.bots` with the fake tokens of the QA API, and one chat per persona of the world files.
import { LaunchwrightError, optionalPeer } from '@launchwrighthq/kernel';
import { QA_TELEGRAM_PORT, type QaFakeBot, qaFakeBots } from '../world/services/app.mts';
import { guarded, parseArgs, processSignal, worldContext } from '../world/services/context.mts';
import { qaTelegramId } from '../world/services/ids.mts';
import type { WorldRegistry } from '../world/services/types.mts';
import type { QaCommandOptions, QaSubcommand } from './qa.command.mts';

const USAGE = [
  'usage: lw qa telegram [--port <p>]',
  '  serves the fake Bot API and the /__tg chat page on 127.0.0.1 until Ctrl-C.',
  `  --port  default: the port of qa.telegramUrl (${QA_TELEGRAM_PORT})`,
  'usage: lw qa telegram bot <create|destroy>  the throwaway bot lifecycle (spec 2.7)',
];

/** The webhook route prefix of the `telegram` module when config `telegram.webhook.path` is not set. */
const WEBHOOK_PATH = '/tg/bots';

/** A fake Telegram user per persona of the world: what `serveFakeTelegram` takes. */
export interface FakePersona {
  id: string;
  telegramId: number;
  firstName: string;
}

/** The first name of a persona on the chat page: `member-expiring` becomes `Member expiring`. */
export function firstNameOf(persona: string): string {
  const words = persona.replace(/[-.]+/g, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** One fake Telegram user per persona, with the Telegram id the world seeds. */
export function fakePersonas(registry: WorldRegistry): FakePersona[] {
  return registry.personas.map((p) => ({ id: p.id, telegramId: qaTelegramId(p.id), firstName: firstNameOf(p.id) }));
}

/**
 * The webhook of the QA API when a bot of config `telegram.bots` uses the webhook transport (the
 * default): `http://127.0.0.1:<qa.apiPort><telegram.webhook.path>/{botId}` with the master secret
 * of `telegram.webhook.secret`. Undefined when every bot polls. Throws `qa.telegram.webhook`
 * when the secret is missing.
 */
export function qaWebhook(sections: Record<string, unknown>, apiPort: number): { url: string; secret: string } | undefined {
  const telegram = sections.telegram as { bots?: Record<string, { transport?: unknown }>; webhook?: { path?: unknown; secret?: unknown } } | undefined;
  const bots = Object.values(telegram?.bots ?? {});
  if (!bots.some((b) => (b.transport ?? 'webhook') === 'webhook')) return undefined;
  const secret = telegram?.webhook?.secret;
  if (typeof secret !== 'string' || secret === '') {
    throw new LaunchwrightError(
      'qa.telegram.webhook',
      'A bot of telegram.bots uses the webhook transport, and telegram.webhook.secret is not set, so the fake server cannot sign its updates. Set the secret, or set transport: polling on each bot.',
    );
  }
  const path = typeof telegram?.webhook?.path === 'string' ? telegram.webhook.path : WEBHOOK_PATH;
  return { url: `http://127.0.0.1:${apiPort}${path}/{botId}`, secret };
}

/** The port of `--port`, else of config `qa.telegramUrl`. Throws `qa.telegram.usage`. */
export function telegramPort(option: string | true | undefined, telegramUrl: string): number {
  if (option === undefined) {
    const url = new URL(telegramUrl);
    return url.port === '' ? (url.protocol === 'https:' ? 443 : 80) : Number(url.port);
  }
  const n = Number(option);
  if (typeof option !== 'string' || !/^\d+$/.test(option) || n > 65535) {
    throw new LaunchwrightError('qa.telegram.usage', `--port must be an integer from 0 (a free port) to 65535, not ${String(option)}.`);
  }
  return n;
}

type ServeFakeTelegram = (opts: {
  port: number;
  host: string;
  bots: QaFakeBot[];
  personas: FakePersona[];
  webhook: { url: string; secret: string } | undefined;
  env: string;
}) => Promise<{ url: string; close(): Promise<void> }>;

async function loadServer(): Promise<ServeFakeTelegram> {
  const spec = '@launchwrighthq/telegram/testing';
  const mod = await optionalPeer(spec, () => import(spec) as Promise<{ serveFakeTelegram: ServeFakeTelegram }>);
  if (!mod) throw new LaunchwrightError('qa.telegram.module', 'lw qa telegram needs the telegram module. Run lw add telegram.');
  return mod.serveFakeTelegram;
}

async function run(args: string[], opts: QaCommandOptions): Promise<number> {
  if (args[0] === 'bot') {
    const { runTelegramBot } = await import('./qa-telegram-bot.mts');
    return runTelegramBot(args.slice(1), opts);
  }
  const { words, options } = parseArgs(args, ['help'], ['port']);
  if (options.help === true || words.length > 0 || Object.keys(options).some((k) => k !== 'port')) {
    for (const line of USAGE) opts.err(line);
    return options.help === true ? 0 : 2;
  }
  const env = opts.env ?? 'local';
  if (env === 'production') {
    throw new LaunchwrightError('qa.telegram.production', 'lw qa telegram does not start in the production environment (spec 2.14 rule S3).');
  }
  const ctx = await worldContext(opts);
  const bots = qaFakeBots(ctx.sections, ctx.overlay.registryHash);
  if (bots.length === 0) {
    throw new LaunchwrightError('qa.telegram.no-bot', 'Config telegram.bots has no bot with a token or an id, so the fake server has nothing to serve.');
  }
  const port = telegramPort(options.port, ctx.qa.telegramUrl);
  const webhook = qaWebhook(ctx.sections, ctx.qa.apiPort);
  const serveFakeTelegram = await loadServer();
  const fake = await serveFakeTelegram({ port, host: '127.0.0.1', bots, personas: fakePersonas(ctx.registry), webhook, env });
  const stop = processSignal(opts.signal);
  try {
    opts.out(fake.url);
    opts.out(`${fake.url}/__tg`);
    opts.err(`lw qa telegram: ${bots.length} bot(s), ${ctx.registry.personas.length} persona(s), ${webhook ? `updates to the webhook ${webhook.url}` : 'updates kept for getUpdates'}; Ctrl-C stops it`);
    if (options.port !== undefined && fake.url !== new URL(ctx.qa.telegramUrl).origin) {
      opts.err(`lw qa telegram: the QA API calls qa.telegramUrl ${ctx.qa.telegramUrl}, not this server.`);
    }
    if (!stop.signal.aborted) await new Promise<void>((resolve) => stop.signal.addEventListener('abort', () => resolve(), { once: true }));
  } finally {
    stop.dispose();
    await fake.close();
  }
  return 0;
}

const telegram: QaSubcommand = {
  name: 'telegram',
  summary: 'Serve the fake Bot API and the /__tg chat page on loopback for the QA API',
  run: (args, opts) => guarded('telegram', opts, () => run(args, opts)),
};

export default telegram;
