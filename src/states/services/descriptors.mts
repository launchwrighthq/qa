// The descriptor files of a state run (spec 2.7). `qa.states.delivery` names the file that maps a
// union to its delivery descriptor, and `qa.states.mounts` the file that maps a union to its mount
// hints. Both can be tracked in git. A run checks each file against its schema before it uses it,
// and an error names the file, the union and the key.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LaunchwrightError, z } from '../../kernel/index.mts';
import type { QaConfig } from '../../config.mts';
import { KEBAB } from '../../services/manifest.mts';
import type { DeliveryDescriptor, Inventory, MountHints } from './inventory.mts';

/** The descriptor files a run reads when `qa.states` names none. Both are optional. */
export const DEFAULT_DELIVERY_FILE = '.lw/qa/delivery.json';
export const DEFAULT_MOUNTS_FILE = '.lw/qa/mounts.json';

const fixture = z.strictObject({ persona: z.string().regex(KEBAB, 'must be a kebab-case persona id').optional() });

const deliverySchema = z.strictObject({
  route: z.string().startsWith('/').optional(),
  leg: z.string().min(1).optional(),
  intercept: z.strictObject({ url: z.string().min(1), container: z.string().min(1) }),
  settle: z.strictObject({
    selector: z.string().min(1).optional(),
    artwork: z.boolean().optional(),
    video: z.boolean().optional(),
    busy: z.boolean().optional(),
    timeout: z.number().int().positive().optional(),
  }),
  act: z.array(z.unknown()).optional(),
  verifyArgs: z.array(z.unknown()).optional(),
  pivotModules: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
  batchSize: z.number().int().positive().optional(),
  contrast: z.unknown().optional(),
  diffRoot: z.string().min(1).optional(),
  ignoreAttributes: z.array(z.string()).optional(),
  maxSubjectAreaRatio: z.number().positive().max(1).optional(),
  fixture: fixture.optional(),
});

const mountSchema = z.strictObject({
  component: z.string().min(1).optional(),
  leg: z.string().min(1).optional(),
  width: z.string().min(1).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  members: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  settle: z.strictObject({ selector: z.string().min(1).optional(), timeout: z.number().int().positive().optional() }).optional(),
  fixture: fixture.optional(),
});

/** The two descriptor kinds: the config key that names the file, its default and its schema. */
const KINDS = {
  delivery: { key: 'qa.states.delivery', fallback: DEFAULT_DELIVERY_FILE, schema: deliverySchema },
  mounts: { key: 'qa.states.mounts', fallback: DEFAULT_MOUNTS_FILE, schema: mountSchema },
} as const;

type Kind = keyof typeof KINDS;

/** The issues of a parsed file as `<union>.<key>: <message>` lines. */
function issueLines(error: z.ZodError): string[] {
  return error.issues.map((issue) => `  ${issue.path.map(String).join('.') || '(file)'}: ${issue.message}`);
}

/**
 * The descriptors of one kind by union name, read and checked. A file that the config names must
 * exist. The default file may be absent, and then the map is empty. A union the scan does not know
 * is refused: a descriptor for a renamed union applies to nothing, and nothing would say so.
 */
function readDescriptors(kind: Kind, root: string, config: Pick<QaConfig, 'states'>, unions: readonly string[]): { file: string | null; entries: Record<string, unknown> } {
  const { key, fallback, schema } = KINDS[kind];
  const named = config.states[kind];
  const rel = named ?? fallback;
  const path = join(root, rel);
  if (!existsSync(path)) {
    if (named === undefined) return { file: null, entries: {} };
    throw new LaunchwrightError('qa.states.descriptors', `${key} names ${rel}, and the file does not exist.`, { context: { key, file: rel } });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new LaunchwrightError('qa.states.descriptors', `${rel} (${key}) is not JSON.`, { cause, context: { key, file: rel } });
  }
  const result = z.record(z.string(), schema).safeParse(parsed);
  if (!result.success) {
    throw new LaunchwrightError('qa.states.descriptors', `${rel} (${key}) does not match its schema:\n${issueLines(result.error).join('\n')}`, {
      context: { key, file: rel },
    });
  }
  const unknown = Object.keys(result.data).filter((name) => !unions.includes(name));
  if (unknown.length > 0) {
    throw new LaunchwrightError('qa.states.descriptors', `${rel} (${key}) names ${unknown.join(', ')}, and the state scan finds no union of that name.`, {
      context: { key, file: rel, unknown },
    });
  }
  return { file: rel, entries: result.data };
}

/** The inventory with each union's delivery descriptor and mount hints from the descriptor files. */
export function withDescriptors(inventory: Inventory, root: string, config: Pick<QaConfig, 'states'>): Inventory {
  const names = [...inventory.unions.map((u) => u.name), ...inventory.ignored.map((g) => g.name)];
  const delivery = readDescriptors('delivery', root, config, names).entries as Record<string, DeliveryDescriptor>;
  const mounts = readDescriptors('mounts', root, config, names).entries as Record<string, MountHints>;
  return {
    ...inventory,
    unions: inventory.unions.map((union) => ({
      ...union,
      ...(delivery[union.name] ? { delivery: delivery[union.name] } : {}),
      ...(mounts[union.name] ? { mount: mounts[union.name] } : {}),
    })),
  };
}
