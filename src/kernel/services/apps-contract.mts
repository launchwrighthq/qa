// `contracts/apps.json`: the apps of the project for the Python loader. The text and the drift
// check live here. The kernel also builds for edge runtimes, so the file reads and writes live in
// the CLI (`cli/src/services/apps-contract.mts`).
import { appsContract, type ResolvedApp } from './apps.mts';

/** The path of the apps contract, relative to the project root. */
export const APPS_CONTRACT_FILE = 'contracts/apps.json';

/** The text of `contracts/apps.json`: two-space JSON with a final newline. `sections` and `environments` as in `appsContract`. */
export function appsContractText(apps: ResolvedApp[], sections?: Record<string, unknown>, environments?: Record<string, unknown>): string {
  return `${JSON.stringify(appsContract(apps, sections, environments), null, 2)}\n`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The first JSON path where `actual` differs from `expected`, or undefined when they are equal. A
 * list counts as one value, so the path names the list, such as `apps.api.modules`.
 */
function firstDifference(expected: unknown, actual: unknown, at: string): string | undefined {
  if (!isRecord(expected) || !isRecord(actual) || Array.isArray(expected) || Array.isArray(actual)) {
    return JSON.stringify(expected) === JSON.stringify(actual) ? undefined : at;
  }
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])];
  for (const key of keys) {
    const found = firstDifference(expected[key], actual[key], `${at}.${key}`);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Why the file text `text` differs from the contract of `apps`, or undefined when it is current.
 * The reason names the first differing JSON path, such as `apps.api.processes`.
 */
export function appsContractDifference(text: string, apps: ResolvedApp[], sections?: Record<string, unknown>, environments?: Record<string, unknown>): string | undefined {
  const expected = appsContractText(apps, sections, environments);
  if (text === expected) return undefined;
  let actual: unknown;
  try {
    actual = JSON.parse(text);
  } catch (cause) {
    if (cause instanceof SyntaxError) return `${APPS_CONTRACT_FILE} is not valid JSON`;
    throw cause;
  }
  const at = firstDifference(JSON.parse(expected), actual, '$');
  return at === undefined ? `${APPS_CONTRACT_FILE} differs in layout` : `${APPS_CONTRACT_FILE} differs at ${at.replace(/^\$\.?/, '') || 'the top level'}`;
}
