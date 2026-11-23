// `lw qa job [run <name>]` (spec 2.14 rule S4): a job that changes visible state runs on demand,
// once, on the QA app, so a QA row can reach the state that the job writes.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appPath, type Clock, LaunchwrightError } from '../../kernel/index.mts';
import { loadDb } from '../../services/peers.mts';
import type { QaWorld } from './app.mts';

/** A registered job of the queue module, limited to the parts the command reads. */
interface AnyJobDef {
  kind: string;
  handle(payload: unknown, ctx: unknown): Promise<unknown> | unknown;
}

/** The parts of the queue module that the command reads: its process job registry. */
export interface JobRegistry {
  registeredJobs(): AnyJobDef[];
  jobOf(kind: string): AnyJobDef | undefined;
  parsePayload(def: AnyJobDef, payload: unknown): unknown;
  /** The context of a handler that runs outside a worker, with no effect ledger. A method, so the
   *  queue module's own factory stays assignable under bivariant parameter checking. */
  standaloneContext(options: { id: string; kind: string; attempts: number; maxAttempts: number; tenantId: string | null; container: unknown; log: unknown }): unknown;
}

/**
 * The folder of the project jobs: `<path>/src/jobs` of the first `node` app of config section
 * `apps` (first-consumer spec 2.2). Sections with no `apps` give the default apps.
 */
export function jobsDirOf(sections: Record<string, unknown> = {}): string {
  return `${appPath(sections, 'node', 'apps/api')}/src/jobs`;
}

/** The folder of the project jobs in the default app layout (main spec 2.24.3). */
export const JOBS_DIR = jobsDirOf();

/** Imports each `<jobsDir>/<name>.job.mts`, so its `job()` call registers it. Gives the files. */
export async function importProjectJobs(root: string, jobsDir = JOBS_DIR): Promise<string[]> {
  const dir = join(root, jobsDir);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new LaunchwrightError('qa.job.read', `Cannot read ${dir}.`, { cause });
  }
  const files = names.filter((n) => n.endsWith('.job.mts')).sort();
  for (const file of files) await import(pathToFileURL(join(dir, file)).href);
  return files;
}

/** The kinds of every registered job, sorted. */
export function listJobs(registry: Pick<JobRegistry, 'registeredJobs'>): string[] {
  return registry
    .registeredJobs()
    .map((j) => j.kind)
    .sort();
}

/** What `runJob` needs besides the world. */
export interface RunJobOptions {
  kind: string;
  payload?: unknown;
  /** The tenant of a tenant job. Default: a system job. */
  tenantId?: string;
  clock: Clock;
}

/** Runs one registered job once on the QA app. Throws `qa.job.unknown` for a kind that no job registers. */
export async function runJob(world: QaWorld, registry: JobRegistry, o: RunJobOptions): Promise<void> {
  const def = registry.jobOf(o.kind);
  if (def === undefined) {
    throw new LaunchwrightError('qa.job.unknown', `No registered job has kind ${o.kind}. Jobs: ${listJobs(registry).join(', ') || 'none'}.`, { context: { kind: o.kind } });
  }
  const payload = registry.parsePayload(def, o.payload ?? {});
  const scope = world.app.createScope();
  if (o.tenantId !== undefined) {
    const { TENANT_SCOPE, tenantScope } = await loadDb();
    scope.instance(TENANT_SCOPE, tenantScope(o.tenantId));
  }
  const ctx = registry.standaloneContext({
    id: `qa-${o.kind}-${o.clock.now()}`,
    kind: o.kind,
    attempts: 1,
    maxAttempts: 1,
    tenantId: o.tenantId ?? null,
    container: scope,
    log: world.app.log,
  });
  try {
    await def.handle(payload, ctx);
  } finally {
    await scope.dispose();
  }
}
