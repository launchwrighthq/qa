import { LaunchwrightError } from './errors.mts';

/** `@scope/name` or `name`: the package part of a specifier such as `@scope/name/sub`. */
function packageOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/** The first quoted specifier of a module-not-found message: Node writes `Cannot find package 'x' imported from ...`. */
function missingSpecifier(message: string): string | undefined {
  return /['"]([^'"]+)['"]/.exec(message)?.[1];
}

/** True when `cause` says that the peer itself is not installed, not a module that the peer imports. */
function isMissingPeer(cause: unknown, name: string): boolean {
  if ((cause as { code?: unknown } | null)?.code !== 'ERR_MODULE_NOT_FOUND') return false;
  const missing = missingSpecifier(String((cause as { message?: unknown }).message ?? ''));
  return missing === name || missing === packageOf(name);
}

/**
 * The module of optional peer `name`, or undefined when the peer is not installed. Any other
 * failure, such as a missing module inside the peer, throws `kernel.peer.load` with the cause.
 * `load` imports the peer from the caller's own file, so resolution starts at the package that
 * lists the peer. Without `load`, the kernel imports `name`, which resolves only from the kernel
 * package. A variable specifier keeps the peer out of a bundle that does not need it.
 */
export async function optionalPeer<T>(name: string, load?: () => Promise<T>): Promise<T | undefined> {
  try {
    return await (load ? load() : (import(/* @vite-ignore */ name) as Promise<T>));
  } catch (cause) {
    if (isMissingPeer(cause, name)) return undefined;
    throw new LaunchwrightError('kernel.peer.load', `Cannot load the optional peer ${name}`, { cause, context: { name } });
  }
}
