// The extension modules of `lw qa` (audit fixes spec 2.8). An extension is a module named `qa-<x>`
// whose package root exports `qaExtension`. `lw qa` loads each one that the project config enables
// from the project folder, so the core imports no file of an extension.
import { pathToFileURL } from 'node:url';
import { LaunchwrightError, resolveImport } from '../kernel/index.mts';
import type { QaConfig } from '../config.mts';
import type { QaTarget } from '../drivers/target/contract.mts';
import type { QaSubcommand } from './qa.command.mts';

/** What an extension module exports as `qaExtension`. */
export interface QaExtension {
  /** The module name, for example `qa-device`. */
  name: string;
  /** The `lw qa <sub>` subcommands of the module, by name. Each loads on first use. */
  subcommands?: Readonly<Record<string, () => Promise<QaSubcommand>>>;
  /** The `qa.target` drivers of the module, built from config section `qa`, the project root and the process env. */
  targets?(config: QaConfig, root: string, env?: Readonly<Record<string, string | undefined>>): Record<string, QaTarget>;
}

/** The prefix of an extension module name. */
export const EXTENSION_PREFIX = 'qa-';

/** The extension modules that the config sections enable: each section named `qa-<x>`, sorted. */
export function extensionNames(sections: Record<string, unknown> = {}): string[] {
  return Object.keys(sections)
    .filter((name) => name.startsWith(EXTENSION_PREFIX))
    .sort();
}

function isExtension(value: unknown): value is QaExtension {
  return typeof value === 'object' && value !== null && typeof (value as { name?: unknown }).name === 'string';
}

/**
 * Loads `qaExtension` of each enabled extension module from the project at `root`. A module that
 * is not installed or exports no extension fails with `qa.extension`.
 */
export async function loadExtensions(root: string, sections: Record<string, unknown> = {}): Promise<QaExtension[]> {
  const out: QaExtension[] = [];
  for (const name of extensionNames(sections)) {
    const specifier = `@launchwrighthq/${name}`;
    let ns: { qaExtension?: unknown };
    try {
      ns = (await import(pathToFileURL(resolveImport(specifier, root)).href)) as { qaExtension?: unknown };
    } catch (cause) {
      throw new LaunchwrightError('qa.extension', `The config enables module ${name}, and ${specifier} does not load from ${root}. Install the package or remove section ${name}.`, {
        cause,
        context: { module: name },
      });
    }
    if (!isExtension(ns.qaExtension)) {
      throw new LaunchwrightError('qa.extension', `${specifier} exports no qaExtension, so lw qa cannot use module ${name}.`, { context: { module: name } });
    }
    out.push(ns.qaExtension);
  }
  return out;
}

/** The targets of every extension, later extensions over earlier ones. */
export function extensionTargets(
  extensions: readonly QaExtension[],
  config: QaConfig,
  root: string,
  env?: Readonly<Record<string, string | undefined>>,
): Record<string, QaTarget> {
  return Object.assign({}, ...extensions.map((e) => e.targets?.(config, root, env) ?? {})) as Record<string, QaTarget>;
}
