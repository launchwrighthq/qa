import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LaunchwrightError } from '../services/errors.mts';
import type { Driver } from '../services/driver.mts';

/** One check of a driver kind's contract. */
export interface ContractCase<D> {
  name: string;
  run(driver: D): Promise<void> | void;
}

/** The cases file of a driver kind: `fixtures/contract/<kind>.cases.json` (spec 2.12). */
export interface CasesFile {
  kind: string;
  specVersion: string;
  cases: { name: string; input?: unknown; expect?: unknown }[];
}

export interface ContractOptions<D> {
  /** The cases file. Each case in code names a case in the file. */
  casesFile?: URL;
  /** Runs a file case that has `input` and `expect` and no code. An object `expect` is a partial match. Any other `expect` is a strict equal. */
  data?: (driver: D, input: unknown) => Promise<unknown>;
}

function readCasesFile(file: URL, kind: string, specVersion: string): CasesFile {
  const invalid = (reason: string): LaunchwrightError =>
    new LaunchwrightError('kernel.contract.invalid', `The cases file ${file.pathname} ${reason}.`, { context: { file: file.pathname, kind } });
  let parsed: CasesFile;
  try {
    parsed = JSON.parse(readFileSync(fileURLToPath(file), 'utf8')) as CasesFile;
  } catch (err) {
    throw new LaunchwrightError('kernel.contract.invalid', `Cannot read the cases file ${file.pathname}.`, {
      cause: err,
      context: { file: file.pathname, kind },
    });
  }
  if (parsed.kind !== kind) throw invalid(`has kind "${parsed.kind}", the suite has kind "${kind}"`);
  if (parsed.specVersion !== specVersion) throw invalid(`has specVersion "${parsed.specVersion}", the suite has specVersion "${specVersion}"`);
  if (!Array.isArray(parsed.cases)) throw invalid('has no cases array');
  const names = parsed.cases.map((c) => c.name);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate !== undefined) throw invalid(`lists the case "${duplicate}" twice`);
  return parsed;
}

/**
 * The contract suite of one driver kind (spec 2.5 rule 3).
 * With `opts.casesFile`, the suite lists the cases in file order. A file case that has no code
 * runs through `opts.data` when it has `input` and `expect`, and fails with `kernel.contract.missing` otherwise.
 */
export function defineContract<D>(
  kind: string,
  specVersion: string,
  cases: ContractCase<D>[],
  opts: ContractOptions<D> = {},
): { kind: string; specVersion: string; cases: ContractCase<D>[] } {
  if (!opts.casesFile) return { kind, specVersion, cases };
  const file = readCasesFile(opts.casesFile, kind, specVersion);
  const inFile = new Set(file.cases.map((c) => c.name));
  for (const c of cases) {
    if (!inFile.has(c.name)) {
      throw new LaunchwrightError(
        'kernel.contract.case',
        `The ${kind} contract has the case "${c.name}", which the cases file ${opts.casesFile.pathname} lacks. Add it to the file.`,
        { context: { kind, case: c.name, file: opts.casesFile.pathname } },
      );
    }
  }
  const byName = new Map(cases.map((c) => [c.name, c]));
  const merged = file.cases.map((fc): ContractCase<D> => {
    const code = byName.get(fc.name);
    if (code) return code;
    return {
      name: fc.name,
      async run(driver) {
        if (!opts.data || fc.input === undefined || fc.expect === undefined) {
          throw new LaunchwrightError(
            'kernel.contract.missing',
            `The ${kind} case "${fc.name}" has no code and no data. Add code to the suite, or add input and expect to the cases file and pass data.`,
            { context: { kind, case: fc.name, file: opts.casesFile?.pathname } },
          );
        }
        const actual = await opts.data(driver, fc.input);
        if (typeof fc.expect === 'object' && fc.expect !== null && !Array.isArray(fc.expect)) {
          expect(actual).toMatchObject(fc.expect);
        } else {
          expect(actual).toEqual(fc.expect);
        }
      },
    };
  });
  return { kind, specVersion, cases: merged };
}

/**
 * Registers a vitest `describe` block that runs every case against a new driver from `make`.
 * A first case checks that the driver's specVersion equals the suite's specVersion.
 */
export function runContract<D extends Driver>(suite: ReturnType<typeof defineContract<D>>, make: () => D | Promise<D>): void {
  describe(`${suite.kind} contract (spec ${suite.specVersion})`, () => {
    it(`driver specVersion is ${suite.specVersion}`, async () => {
      const driver = await make();
      expect(driver.specVersion).toBe(suite.specVersion);
    });
    for (const c of suite.cases) {
      it(c.name, async () => {
        await c.run(await make());
      });
    }
  });
}
