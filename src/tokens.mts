import { token } from '@launchwrighthq/kernel';
import type { OpenTargetRegistry } from './drivers/target/contract.mts';

/** The registered `qa.target` drivers: `app.get(QA_TARGETS).get('playwright')`. Extension modules add theirs at boot. */
export const QA_TARGETS = token<OpenTargetRegistry>('qa.targets');
