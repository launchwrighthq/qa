import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { z } from 'zod';
import { LaunchwrightError, messageOf } from './errors.mts';
import { orderByRequires } from './order.mts';

/** The content of a module's `module.toml` (spec 2.7). */
export interface ModuleManifest {
  name: string;
  summary: string;
  requires: string[];
  languages: Array<'ts' | 'py'>;
  submodules: Record<string, { default?: boolean; requires?: string[] }>;
  contributes: Record<string, unknown>;
}

const manifestSchema = z.object({
  name: z.string().min(1),
  summary: z.string(),
  requires: z.array(z.string()).default([]),
  languages: z.array(z.enum(['ts', 'py'])).min(1),
  submodules: z
    .record(z.string(), z.object({ default: z.boolean().optional(), requires: z.array(z.string()).optional() }))
    .default({}),
  contributes: z.record(z.string(), z.unknown()).default({}),
});

/** Reads and validates `<dir>/module.toml`. */
export async function readManifest(dir: string): Promise<ModuleManifest> {
  const file = join(dir, 'module.toml');
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    throw new LaunchwrightError('kernel.manifest.read', `Cannot read ${file}: ${messageOf(err)}`, {
      cause: err,
      context: { file },
    });
  }
  let data: unknown;
  try {
    data = parse(text);
  } catch (err) {
    throw new LaunchwrightError('kernel.manifest.invalid', `${file} is not valid TOML: ${messageOf(err)}`, {
      cause: err,
      context: { file },
    });
  }
  const result = manifestSchema.safeParse(data);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
    throw new LaunchwrightError('kernel.manifest.invalid', `${file} is invalid: ${problems.join('; ')}`, {
      cause: result.error,
      context: { file, key: result.error.issues[0]?.path.map(String).join('.') },
    });
  }
  return result.data;
}

/**
 * Orders manifests so that each module comes after the modules it requires.
 * Throws LaunchwrightError('kernel.manifest.order') on a cycle or a missing module.
 */
export function orderModules(ms: ModuleManifest[]): ModuleManifest[] {
  return orderByRequires(
    ms,
    (m) => m.name,
    (m) => m.requires,
    (p) =>
      p.kind === 'missing'
        ? new LaunchwrightError('kernel.manifest.order', `Module "${p.item}" requires "${p.missing}", which is not installed.`, {
            context: { module: p.item, missing: p.missing },
          })
        : new LaunchwrightError('kernel.manifest.order', `Module cycle: ${p.chain.join(' -> ')}`, {
            context: { chain: p.chain },
          }),
  );
}
