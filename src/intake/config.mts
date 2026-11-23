// Config of qa-intake (QA spec 2.15): key `qa.intake` of config section `qa`. The core keeps the
// key as an open record, and this module parses it.
import { z } from '@launchwrighthq/kernel';

/** Key `qa.intake` of config section `qa`. */
export const qaIntakeConfig = z
  .object({
    default: z.string().default('github'),
    maxFileMb: z.number().positive().default(200),
    drivers: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  })
  .prefault({});
export type IntakeConfig = z.infer<typeof qaIntakeConfig>;
