import { BootError, CONFIG, provider } from '../kernel/index.mts';
import type { QaConfig } from '../index.mts';
import { qaIntakeConfig } from './config.mts';

/**
 * Checks key `qa.intake` of config section `qa` at boot. A bad key fails with
 * `qa.intake.config`, which names each issue. The drivers load on first use in `lw qa intake`.
 */
export const qaIntakeProvider = provider({
  name: 'qa-intake',
  requires: ['kernel', 'qa'],
  register(app) {
    const parsed = qaIntakeConfig.safeParse(app.get(CONFIG).section<QaConfig>('qa').intake);
    if (parsed.success) return;
    const issues = parsed.error.issues.map((i) => `${['qa.intake', ...i.path].join('.')}: ${i.message}`).join('; ');
    throw new BootError('qa.intake.config', `Boot failed in module "qa-intake": ${issues}. Check ${app.config.envFile}.`, {
      cause: parsed.error,
      context: { module: 'qa-intake', key: 'qa.intake', envFile: app.config.envFile },
    });
  },
});
