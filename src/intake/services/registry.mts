// Builds a `qa.intake` driver from config `qa.intake`. Each driver file loads on first use, so the
// `github` driver needs no `telegram` module and the `telegram-*` drivers need no `gh`.
import { LaunchwrightError } from '../../kernel/index.mts';
import type { GramJsModule } from './telegram-peers.mts';
import type { IntakeConfig } from '../config.mts';
import type { QaIntakeDriver } from '../drivers/intake/contract.mts';
import type { GhRunner } from './gh.mts';
import type { FetchFn } from './media.mts';

export const INTAKE_DRIVERS = ['github', 'telegram-mtproto', 'telegram-bot', 'fake'] as const;
export type IntakeDriverName = (typeof INTAKE_DRIVERS)[number];

/** What a driver may get instead of the real thing. Tests pass recorded runners and fetches. */
export interface IntakeDeps {
  gh?: GhRunner;
  fetch?: FetchFn;
  loadGramJs?: () => Promise<GramJsModule>;
  /** Ready drivers by name. They win over config. */
  drivers?: Partial<Record<string, QaIntakeDriver>>;
}

/** `qa.intake.maxFileMb` in bytes. */
export function maxBytesOf(intake: IntakeConfig): number {
  return Math.floor(intake.maxFileMb * 1024 * 1024);
}

/** The driver `name`, built from `qa.intake.drivers.<name>`. An unknown name fails `qa.intake.driver`. */
export async function createIntakeDriver(name: string, intake: IntakeConfig, deps: IntakeDeps = {}): Promise<QaIntakeDriver> {
  const ready = deps.drivers?.[name];
  if (ready) return ready;
  const cfg = intake.drivers[name] ?? {};
  const maxBytes = maxBytesOf(intake);
  switch (name) {
    case 'github': {
      const { GithubIntakeDriver } = await import('../drivers/intake/github.mts');
      return new GithubIntakeDriver({ maxBytes, ...(deps.gh ? { gh: deps.gh } : {}), ...(deps.fetch ? { fetch: deps.fetch } : {}) });
    }
    case 'telegram-mtproto': {
      const { TelegramMtprotoIntakeDriver } = await import('../drivers/intake/telegram-mtproto.mts');
      return new TelegramMtprotoIntakeDriver(cfg, { maxBytes, ...(deps.loadGramJs ? { loader: deps.loadGramJs } : {}) });
    }
    case 'telegram-bot': {
      const { loadBotApi, TelegramBotIntakeDriver } = await import('../drivers/intake/telegram-bot.mts');
      return new TelegramBotIntakeDriver(cfg, { maxBytes, botApi: await loadBotApi(), ...(deps.fetch ? { fetch: deps.fetch } : {}) });
    }
    case 'fake': {
      const { FakeIntakeDriver } = await import('../drivers/intake/fake.mts');
      return new FakeIntakeDriver({ maxBytes });
    }
    default:
      throw new LaunchwrightError('qa.intake.driver', `No intake driver "${name}". Use ${INTAKE_DRIVERS.join(', ')}.`, { context: { driver: name } });
  }
}
