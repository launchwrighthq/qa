// The seed file of a forged state (spec 2.5). `lw qa states infer --apply` writes a draft for each
// state that no seed and no route reaches. A reviewer fills it and sets `accepted`, and then
// `lw qa states forge` runs it. An app-service seed is a module that writes through the app services
// (`ctx.app`), as a world seed does. A direct-write seed lists rows, the last resort of spec 2.5.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LaunchwrightError, z } from '../../kernel/index.mts';
import type { SeedProposal } from './inventory.mts';

/** The folder of the seed files, relative to the project root. */
export const FORGE_DIR = '.lw/qa/forge';

/** The seed file of the state `<union>.<member>`, relative to the project root. */
export function seedFile(state: string): string {
  if (!/^[A-Za-z0-9_$-]+\.[A-Za-z0-9_$.-]+$/.test(state)) throw new LaunchwrightError('qa.forge.state', `${state} is not a state id <union>.<member>.`, { context: { state } });
  return `${FORGE_DIR}/${state}.seed.json`;
}

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** One row of a direct-write seed. A `{tenantId}` value is the tenant of the QA world. */
const seedRow = z.object({ table: z.string().regex(/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i), values: z.record(z.string().regex(/^[a-z_][a-z0-9_]*$/i), cell) });

const seedSchema = z.object({
  state: z.string(),
  accepted: z.boolean(),
  via: z.enum(['app-service', 'direct-write']),
  /** The route that renders the state on the QA app. */
  route: z.string().startsWith('/').nullable(),
  persona: z.string().optional(),
  settle: z.object({ selector: z.string(), artwork: z.boolean(), video: z.boolean(), busy: z.boolean(), timeout: z.number().positive() }).partial().optional(),
  /** app-service: a project-relative module whose default export writes the state through `ctx.app`. */
  module: z.string().optional(),
  /** direct-write: the rows to insert. */
  rows: z.array(seedRow).optional(),
  fields: z.array(z.object({ interface: z.string(), field: z.string(), file: z.string() })).optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
});
export type ForgeSeed = z.infer<typeof seedSchema>;
export type SeedRow = z.infer<typeof seedRow>;

/** An accepted seed: a route, and a module or rows by its `via`. */
export type AcceptedSeed = ForgeSeed & { accepted: true; route: string };

const DRAFT_NOTE =
  'Draft. Set route to the page that renders the state. For via app-service, set module to a project module whose default export ' +
  'writes the state through ctx.app. For via direct-write, list rows. Then set accepted to true and run lw qa states forge.';

/** The draft seed of one member of a proposal. */
export function draftSeed(proposal: SeedProposal, member: string): ForgeSeed {
  return {
    state: `${proposal.union}.${member}`,
    accepted: false,
    via: proposal.via,
    route: null,
    ...(proposal.via === 'app-service' ? { module: '' } : { rows: [] }),
    fields: proposal.fields,
    reason: proposal.reason,
    note: DRAFT_NOTE,
  };
}

/** Writes the draft of a state when it has no seed file yet. Gives true when it wrote one. */
export function writeDraft(root: string, proposal: SeedProposal, member: string): boolean {
  const path = join(root, seedFile(`${proposal.union}.${member}`));
  if (existsSync(path)) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(draftSeed(proposal, member), null, 2)}\n`);
  return true;
}

/** Reads a seed file. Throws `qa.forge.seed` for a file that is not a seed. */
export function readSeed(path: string): ForgeSeed {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new LaunchwrightError('qa.forge.seed', `Cannot read ${path} as JSON.`, { cause, context: { path } });
  }
  const parsed = seedSchema.safeParse(value);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'} ${i.message}`);
    throw new LaunchwrightError('qa.forge.seed', `${path} is not a seed file: ${keys.join('; ')}`, { context: { path } });
  }
  return parsed.data;
}

/** The seed as accepted, or the reason it cannot run yet. */
export function acceptedSeed(seed: ForgeSeed): AcceptedSeed | string {
  if (!seed.accepted) return 'it is a draft: a reviewer sets accepted to true';
  if (seed.route === null) return 'it names no route';
  if (seed.via === 'app-service' && !seed.module) return 'via app-service needs a module';
  if (seed.via === 'direct-write' && (seed.rows ?? []).length === 0) return 'via direct-write needs rows';
  return seed as AcceptedSeed;
}

function quoteName(name: string): string {
  return name
    .split('.')
    .map((part) => `"${part}"`)
    .join('.');
}

function literal(value: z.infer<typeof cell>, tenantId: string): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new LaunchwrightError('qa.forge.row', `${value} is not a finite number.`);
    return String(value);
  }
  const text = value === '{tenantId}' ? tenantId : value;
  return `'${text.replaceAll("'", "''")}'`;
}

/** The insert statement of each row. The schema limits names to plain identifiers; values are quoted literals. */
export function rowStatements(rows: readonly SeedRow[], tenantId: string): string[] {
  return rows.map((row) => {
    const columns = Object.keys(row.values);
    if (columns.length === 0) throw new LaunchwrightError('qa.forge.row', `A row of ${row.table} has no values.`, { context: { table: row.table } });
    const values = columns.map((c) => literal(row.values[c] ?? null, tenantId));
    return `insert into ${quoteName(row.table)} (${columns.map(quoteName).join(', ')}) values (${values.join(', ')})`;
  });
}
