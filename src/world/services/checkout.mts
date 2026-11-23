// Where a project root sits in git, read from the file system: the folder that holds `.git` (a
// folder in the main checkout, a file in a linked worktree) and the common dir of every worktree.
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import { pathKind } from '@launchwrighthq/kernel/fs';

export interface CheckoutFacts {
  /** The project root: the folder of `launchwright.config.ts`. */
  root: string;
  /** The folder that holds `.git`. The root when the project is not in git. */
  toplevel: string;
  /** The git common dir: the `.git` folder of the main checkout. The root outside git. */
  commonDir: string;
  /** True in a linked worktree, false in the main checkout or outside git. */
  linked: boolean;
  /** The project root in the main checkout. */
  mainRoot: string;
}

async function text(path: string): Promise<string> {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch (cause) {
    throw new LaunchwrightError('qa.checkout.read', `Cannot read ${path}. The git worktree is broken; run git worktree repair.`, { cause });
  }
}

/** The checkout facts of the project at `root`. */
export async function readCheckout(root: string): Promise<CheckoutFacts> {
  const start = resolve(root);
  for (let dir = start; ; dir = dirname(dir)) {
    const kind = await pathKind(join(dir, '.git'));
    if (kind === 'dir') return { root: start, toplevel: dir, commonDir: join(dir, '.git'), linked: false, mainRoot: start };
    if (kind === 'file') {
      const line = await text(join(dir, '.git'));
      const match = /^gitdir:\s*(.+)$/.exec(line);
      if (!match) throw new LaunchwrightError('qa.checkout.read', `${join(dir, '.git')} does not name a git dir.`);
      const gitDir = resolve(dir, match[1]!);
      const commonDir = resolve(gitDir, await text(join(gitDir, 'commondir')));
      const mainTop = basename(commonDir) === '.git' ? dirname(commonDir) : commonDir;
      return { root: start, toplevel: dir, commonDir, linked: true, mainRoot: join(mainTop, relative(dir, start)) };
    }
    if (dirname(dir) === dir) return { root: start, toplevel: start, commonDir: start, linked: false, mainRoot: start };
  }
}

/**
 * The project name of `lw dev`: config `dev.project`, else the folder of the main checkout, so the
 * worktrees of one project get one name.
 */
export function devProjectName(sections: Record<string, unknown>, checkout: CheckoutFacts): string {
  const dev = sections.dev as { project?: unknown } | undefined;
  if (typeof dev?.project === 'string' && dev.project !== '') return dev.project;
  return basename(basename(checkout.commonDir) === '.git' ? dirname(checkout.commonDir) : checkout.root);
}
