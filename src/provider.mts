import { BootError, CLOCK, CONFIG, provider } from '@launchwrighthq/kernel';
import { type QaConfig, qaConfig } from './config.mts';
import { createTargetRegistry } from './services/targets.mts';
import { QA_TARGETS } from './tokens.mts';
import { ShiftClock } from './world/services/clock.mts';

/**
 * Binds QA_TARGETS. With config `qa.routes` on, it wraps CLOCK in the shift clock of
 * `POST /__qa/clock`, and boot fails with `qa.routes.production` in the production environment
 * (spec 2.6, rule S3). Mount the routes with `qaRoutes(app)`.
 */
export const qaProvider = provider({
  name: 'qa',
  requires: ['kernel'],
  config: { section: 'qa', schema: qaConfig },
  register(app) {
    const cfg = app.get(CONFIG).section<QaConfig>('qa');
    if (cfg.routes && app.config.env === 'production') {
      throw new BootError(
        'qa.routes.production',
        `Boot failed in module "qa": key "qa.routes" is on in the production environment. The /__qa routes sign any persona in; turn qa.routes off. Check ${app.config.envFile}.`,
        { context: { module: 'qa', key: 'qa.routes', envFile: app.config.envFile } },
      );
    }
    if (cfg.routes) app.instance(CLOCK, new ShiftClock(app.get(CLOCK)));
    app.singleton(QA_TARGETS, (c) => createTargetRegistry(c.get(CONFIG).section<QaConfig>('qa')));
  },
});
