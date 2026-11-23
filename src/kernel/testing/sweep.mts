import { LaunchwrightError, messageOf } from '../services/errors.mts';

function describeRow(row: unknown): string {
  const text = JSON.stringify(row);
  return text === undefined ? String(row) : text;
}

/**
 * Runs `fn` for every row and reports every failing row in one error (spec 2.14). Use it for
 * a table of more than 12 rows, where `it.each` is a lint error.
 */
export async function sweep<C>(cases: C[], fn: (c: C) => void | Promise<void>): Promise<void> {
  const failed: string[] = [];
  for (const [index, row] of cases.entries()) {
    try {
      await fn(row);
    } catch (err) {
      const message = messageOf(err);
      failed.push(`row ${index} ${describeRow(row)}: ${message}`);
    }
  }
  if (failed.length > 0) {
    throw new LaunchwrightError('testing.sweep', `${failed.length} of ${cases.length} rows failed:\n${failed.join('\n')}`, {
      context: { failed: failed.length, rows: cases.length },
    });
  }
}
