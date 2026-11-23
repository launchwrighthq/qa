// The apps of a project: section `apps` of `launchwright.config.ts` (first-consumer spec 2.2).
import { z } from 'zod';
import { LaunchwrightError } from './errors.mts';

export const APP_RUNTIMES = ['node', 'python', 'web'] as const;
export type AppRuntime = (typeof APP_RUNTIMES)[number];

/** An app or process name: letters, digits and `-`. It names the env slice, the dev surface and the deploy service. */
export const APP_NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

const processSchema = z.strictObject({
  command: z.string().trim().min(1),
  /** Ask the dev port registry for a port. */
  port: z.boolean().optional(),
  /** The queue lanes this process consumes (spec 2.6). */
  lanes: z.array(z.string().min(1)).optional(),
  /** The number of copies of the process. `lw dev` starts each as `<app>.<process>-<i>`. Default 1. */
  count: z.number().int().min(1).optional(),
  /** The part of the app's modules that this process starts. Default: every module of the app. */
  modules: z.array(z.string().min(1)).optional(),
});

export const appSchema = z.strictObject({
  runtime: z.enum(APP_RUNTIMES),
  path: z.string().min(1).optional(),
  modules: z.array(z.string().min(1)).optional(),
  processes: z.record(z.string().regex(APP_NAME, 'must be letters, digits and -'), processSchema).optional(),
  /** A `web` app: the `node` app that serves its files. */
  servedBy: z.string().min(1).optional(),
});

export const appsSchema = z.record(z.string().regex(APP_NAME, 'must be letters, digits and -'), appSchema);
export type AppInput = z.input<typeof appSchema>;

/** Section `contract`: the folders that get the generated `tables.py` and the generated TS client. */
export const contractSchema = z.looseObject({ python: z.array(z.string().min(1)).optional(), ts: z.array(z.string().min(1)).optional() });

export interface AppProcess {
  name: string;
  command: string;
  port?: boolean;
  lanes?: string[];
  count?: number;
  modules?: string[];
  /** The modules that `requires` added to the listed `modules`. Absent when it added none. */
  added?: string[];
}

/** One app with every default filled in. */
export interface ResolvedApp {
  name: string;
  runtime: AppRuntime;
  path: string;
  modules: string[];
  processes: AppProcess[];
  servedBy?: string;
  /** The modules that `requires` added to the listed ones. Absent when it added none. */
  added?: string[];
}

/** The apps of a project with no `apps` section: the four apps of design 2.9.1. */
export const DEFAULT_APPS: Record<string, AppInput> = {
  api: { runtime: 'node', path: 'apps/api' },
  client: { runtime: 'web', path: 'apps/client', servedBy: 'api' },
  console: { runtime: 'web', path: 'apps/console', servedBy: 'api' },
  ai: { runtime: 'python', path: 'apps/ai' },
};

/** The parts of a project config that the apps read. */
export interface AppsSource {
  modules?: Record<string, unknown>;
  apps?: Record<string, AppInput> | undefined;
}

export interface ResolveAppsOptions {
  /** True when module `m` has a package for `runtime`. Default: every module has one. */
  hasPackage?: (m: string, runtime: AppRuntime) => boolean;
  /** The modules that module `m` requires, from its manifest. Default: none. */
  requires?: (m: string) => readonly string[];
}

/**
 * `modules` and every module that one of them requires, transitively, in that order. A required
 * module joins only when `keep` accepts it, such as a module of the project with a package for
 * the runtime. `added` lists the modules that joined.
 */
export function closeOverRequires(modules: readonly string[], requires: (m: string) => readonly string[], keep: (m: string) => boolean): { modules: string[]; added: string[] } {
  const out = [...modules];
  for (let i = 0; i < out.length; i++) {
    for (const r of requires(out[i]!)) {
      if (r !== 'kernel' && !out.includes(r) && keep(r)) out.push(r);
    }
  }
  return { modules: out, added: out.slice(modules.length) };
}

/** The fields of an app and its processes that `processModules` reads. */
export interface ProcessModulesSource {
  modules?: readonly string[];
  processes?: readonly { name: string; modules?: readonly string[] }[];
}

/** The modules that process `process` of `app` starts: its own list, else the modules of the app. */
export function processModules(app: ProcessModulesSource, process?: string): string[] {
  const own = process === undefined ? undefined : app.processes?.find((p) => p.name === process)?.modules;
  return [...(own ?? app.modules ?? [])];
}

/** The default process of an app: one process named after the app, with the entry of its runtime. */
function defaultProcess(name: string, runtime: AppRuntime): AppProcess {
  if (runtime === 'node') return { name, command: 'node --import tsx src/main.mts', port: true };
  if (runtime === 'web') return { name, command: 'vite --configLoader runner', port: true };
  return { name, command: `python -m ${name.replaceAll('-', '_')}` };
}

/** One problem of the `apps` section. `key` is the config path, such as `apps.api.modules`. */
export interface AppFinding {
  key: string;
  message: string;
}

/**
 * The problems of the `apps` section that the config alone shows: a module that `modules` does
 * not hold, two apps with one path, and a `servedBy` that names no `node` app.
 */
export function checkApps(project: AppsSource): AppFinding[] {
  const installed = new Set(Object.keys(project.modules ?? {}));
  const entries = Object.entries(project.apps ?? DEFAULT_APPS);
  const findings: AppFinding[] = [];
  const paths = new Map<string, string>();
  const nodeApps = entries.filter(([, a]) => a.runtime === 'node').map(([n]) => n);
  for (const [name, app] of entries) {
    for (const m of app.modules ?? []) {
      if (!installed.has(m) && m !== 'kernel') findings.push({ key: `apps.${name}.modules`, message: `app ${name} names module ${m}, which modules does not hold` });
    }
    const path = app.path ?? `apps/${name}`;
    const other = paths.get(path);
    if (other !== undefined) findings.push({ key: `apps.${name}.path`, message: `apps ${other} and ${name} share the path ${path}` });
    paths.set(path, name);
    if (app.servedBy !== undefined && !nodeApps.includes(app.servedBy)) findings.push({ key: `apps.${name}.servedBy`, message: `app ${name} is served by ${app.servedBy}, which is not a node app` });
    if (app.runtime === 'web' && app.servedBy === undefined && nodeApps.length > 1) findings.push({ key: `apps.${name}.servedBy`, message: `web app ${name} needs servedBy: the project has the node apps ${nodeApps.join(', ')}` });
  }
  return findings;
}

/**
 * The apps of the project, in config order, with the defaults of spec 2.2.1. A project with no
 * `apps` section gets `DEFAULT_APPS`. With `opts.requires`, each module list closes over
 * `requires` (`closeOverRequires`): a required module of the project with a package for the
 * runtime joins, and `added` names it. The `modules` of a process close the same way, inside
 * the modules of its app. Throws `kernel.apps.invalid` that names every finding of
 * `checkApps`, and a process module that the modules of its app do not hold.
 */
export function resolveApps(project: AppsSource, opts: ResolveAppsOptions = {}): ResolvedApp[] {
  const parsed = appsSchema.safeParse(project.apps ?? DEFAULT_APPS);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => `apps.${i.path.map(String).join('.')} ${i.message}`);
    throw new LaunchwrightError('kernel.apps.invalid', `The apps section is invalid: ${keys.join('; ')}`, { cause: parsed.error, context: { keys } });
  }
  const findings = checkApps({ ...project, apps: parsed.data });
  if (findings.length > 0) {
    throw new LaunchwrightError('kernel.apps.invalid', `The apps section is invalid: ${findings.map((f) => f.message).join('; ')}`, { context: { keys: findings.map((f) => f.key) } });
  }
  const installed = Object.keys(project.modules ?? {});
  const hasPackage = opts.hasPackage ?? (() => true);
  const requires = opts.requires ?? (() => []);
  const nodeApps = Object.entries(parsed.data).filter(([, a]) => a.runtime === 'node').map(([n]) => n);
  const apps = Object.entries(parsed.data).map(([name, app]): ResolvedApp => {
    const processes = app.processes === undefined ? [defaultProcess(name, app.runtime)] : Object.entries(app.processes).map(([p, v]) => ({ name: p, ...v }));
    const listed = app.modules ?? (app.runtime === 'web' ? [] : installed.filter((m) => hasPackage(m, app.runtime)));
    const { modules, added } = closeOverRequires(listed, requires, (m) => installed.includes(m) && hasPackage(m, app.runtime));
    const servedBy = app.runtime === 'web' ? (app.servedBy ?? nodeApps[0]) : undefined;
    return { name, runtime: app.runtime, path: app.path ?? `apps/${name}`, modules, processes: processes.map((p) => closeProcess(p, modules, requires)), ...(servedBy === undefined ? {} : { servedBy }), ...(added.length === 0 ? {} : { added }) };
  });
  const outside = apps.flatMap((a) => a.processes.flatMap((p) => (p.modules ?? []).filter((m) => !a.modules.includes(m)).map((m) => ({ key: `apps.${a.name}.processes.${p.name}.modules`, m }))));
  if (outside.length > 0) {
    throw new LaunchwrightError('kernel.apps.invalid', `The apps section is invalid: ${outside.map((o) => `${o.key} names module ${o.m}, which its app does not hold`).join('; ')}`, {
      context: { keys: outside.map((o) => o.key) },
    });
  }
  return apps;
}

/** `process` with its own `modules` closed over `requires`, keeping only modules of `appModules`. */
function closeProcess(process: AppProcess, appModules: readonly string[], requires: (m: string) => readonly string[]): AppProcess {
  if (process.modules === undefined) return process;
  const { modules, added } = closeOverRequires(process.modules, requires, (m) => appModules.includes(m));
  return { ...process, modules, ...(added.length === 0 ? {} : { added }) };
}

/** The app named `name`. Throws `kernel.apps.unknown` that names the apps. */
export function resolveApp(project: AppsSource, name: string, opts: ResolveAppsOptions = {}): ResolvedApp {
  const apps = resolveApps(project, opts);
  const app = apps.find((a) => a.name === name);
  if (app === undefined) throw new LaunchwrightError('kernel.apps.unknown', `The project has no app "${name}". Apps: ${apps.map((a) => a.name).join(', ')}.`, { context: { app: name } });
  return app;
}

/**
 * The apps of config section `apps`, which `projectSections` fills. Sections with no `apps` (a
 * test or a hand-built config) give the default apps with no modules.
 */
export function sectionApps(sections: Record<string, unknown>): ResolvedApp[] {
  return Array.isArray(sections.apps) ? (sections.apps as ResolvedApp[]) : resolveApps({});
}

/** The apps of an app's config store: section `apps`, else the default apps with no modules. */
export function storeApps(store: { section<T>(name: string): T }): ResolvedApp[] {
  try {
    return sectionApps({ apps: store.section<unknown>('apps') });
  } catch (err) {
    if (err instanceof LaunchwrightError && err.code === 'kernel.config.missing') return resolveApps({});
    throw err;
  }
}

const APP_DIR = /\{app:([A-Za-z0-9][A-Za-z0-9-]*)\}/g;

/**
 * `template` with each `{app:<name>}` replaced by the folder of app `<name>`, or `apps/<name>`
 * when the project has no such app. A module config default such as `{app:client}/public` reads
 * the folder from section `apps` this way.
 */
export function appDir(template: string, apps: ResolvedApp[]): string {
  return template.replace(APP_DIR, (_m, name: string) => apps.find((a) => a.name === name)?.path ?? `apps/${name}`);
}

/** The path of the first app of `runtime`, or `fallback` when the project has none. */
export function appPath(sections: Record<string, unknown>, runtime: AppRuntime, fallback: string): string {
  return sectionApps(sections).find((a) => a.runtime === runtime)?.path ?? fallback;
}

/**
 * The JSON of `contracts/apps.json`, which Python reads with `launchwright.kernel.load_apps`. A
 * process lists `modules` only when it sets them. With `sections`, the file holds them as
 * `sections`, the module sections that Python `load_settings` reads when its caller passes none.
 * A section value that comes from an env key is `{ "$env": "<KEY>" }`; write no secret value.
 * With `environments`, the file holds the partial sections of each environment as `environments`,
 * which `load_settings` merges over `sections` (round 6d N100).
 */
export function appsContract(
  apps: ResolvedApp[],
  sections?: Record<string, unknown>,
  environments?: Record<string, unknown>,
): { apps: Record<string, unknown>; sections?: Record<string, unknown>; environments?: Record<string, unknown> } {
  const out: Record<string, unknown> = {};
  for (const a of apps) {
    const processes = Object.fromEntries(
      a.processes.map((p) => [p.name, { command: p.command, port: p.port ?? false, lanes: p.lanes ?? [], count: p.count ?? 1, ...(p.modules === undefined ? {} : { modules: p.modules }) }]),
    );
    out[a.name] = { runtime: a.runtime, path: a.path, modules: a.modules, processes, ...(a.servedBy === undefined ? {} : { servedBy: a.servedBy }) };
  }
  return { apps: out, ...(sections === undefined ? {} : { sections }), ...(environments === undefined ? {} : { environments }) };
}
