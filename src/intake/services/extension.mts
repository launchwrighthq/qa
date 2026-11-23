// The qa extension of qa-intake: `lw qa intake`. The `lw qa` command loads it from the project
// folder when the project config has section `qa-intake`.
import type { QaExtension } from '../../index.mts';

export const qaExtension: QaExtension = {
  name: 'qa-intake',
  subcommands: { intake: async () => (await import('../commands/qa-intake.mts')).default },
};
