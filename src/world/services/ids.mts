// The ids of a persona. Each one is a pure function of the persona id, so two resets give the same
// ids. `qaTelegramId` is inlined from client (services/qa-persona.mts), identical in behaviour, so
// the engine needs no client peer: the Mini App launch and the seed still derive the same id.
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { PersonaIds } from './types.mts';

/** The first Telegram id of the QA block, far below real user ids. */
const QA_TELEGRAM_ID_BASE = 900_000_000;
/** The size of the QA block of Telegram ids. */
const QA_TELEGRAM_ID_SPAN = 1_000_000;

/**
 * The Telegram id of a QA persona: FNV-1a (32 bit) over the persona id, folded into
 * `900_000_000 + hash % 1_000_000`. Inlined from client so the engine needs no client peer.
 */
export function qaTelegramId(persona: string): number {
  if (persona.length === 0) throw new LaunchwrightError('client.qa.persona', 'qaTelegramId needs a persona id');
  let hash = 0x811c9dc5;
  for (let i = 0; i < persona.length; i += 1) {
    hash ^= persona.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return QA_TELEGRAM_ID_BASE + (hash % QA_TELEGRAM_ID_SPAN);
}

/** The identity provider of a persona account. The account id is `qa:<persona>`. */
export const QA_PROVIDER = 'qa';

/** The account id of a persona: `qa:<persona>`. */
export function qaAccountId(persona: string): string {
  return `${QA_PROVIDER}:${persona}`;
}

/** Every id of a persona. */
export function personaIds(persona: string): PersonaIds {
  return { persona, accountId: qaAccountId(persona), telegramId: qaTelegramId(persona) };
}

/** Why a text cannot be a persona or fact id, or null. Kebab case or dotted, so it survives a URL. */
export function idProblem(id: string): string | null {
  if (id.length === 0) return 'an id is empty';
  if (id.length > 64) return `${id} has more than 64 characters`;
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id) ? null : `${id} is not a kebab case or dotted id, and it must survive a URL`;
}
