// The state rules of `lw qa check` (spec 2.14): C1 and C4. The check command calls
// `stateFindings` and fails on any finding.
import type { QaConfig } from '../../config.mts';
import type { Inventory } from './inventory.mts';
import { scanStates } from './project.mts';
import type { ScanProblem } from './scan.mts';

export interface StateFinding {
  rule: 'C1' | 'C4';
  union: string;
  file: string;
  line: number;
  message: string;
}

/**
 * Rule C1: every visible state comes from a named state union, or carries
 * `@qa-states ignore <reason>`. It fails a `neither` union, an ignore tag without a reason or with
 * another directive, a repeated tag, and two unions of one name.
 */
export function c1Findings(inventory: Pick<Inventory, 'unions'>, problems: readonly ScanProblem[]): StateFinding[] {
  const findings: StateFinding[] = [];
  for (const union of inventory.unions) {
    if (union.kind !== 'neither') continue;
    findings.push({
      rule: 'C1',
      union: union.name,
      file: union.file,
      line: union.line,
      message:
        `${union.file}:${union.line} ${union.name} is neither an input nor an output, so no trigger reaches its ` +
        `${union.members.length} state(s). Give a component a prop of this type, return it from an exported function, ` +
        'or mark it @qa-states ignore <reason>.',
    });
  }
  for (const problem of problems) {
    if (problem.code === 'invalid-shape') continue;
    findings.push({ rule: 'C1', union: problem.union, file: problem.file, line: problem.line, message: problem.message });
  }
  return findings;
}

/**
 * Rule C4: every route sits in the route table. It fails a union that no route in the tables
 * delivers and no harness can mount: nothing reaches its states. A `neither` union is C1's.
 * The inventory must carry the routes of `scanStates`.
 */
export function c4Findings(inventory: Pick<Inventory, 'unions'>): StateFinding[] {
  const findings: StateFinding[] = [];
  for (const union of inventory.unions) {
    if (union.kind === 'neither') continue;
    if ((union.routes ?? []).length > 0) continue;
    if (union.inputs.some((site) => site.component !== null)) continue;
    findings.push({
      rule: 'C4',
      union: union.name,
      file: union.file,
      line: union.line,
      message:
        `${union.file}:${union.line} ${union.name} has no route and no mount: ${union.why ?? 'no route table row reaches it'}. ` +
        'Add its page to the route table, or give a component a prop of this type so /__states can mount it.',
    });
  }
  return findings;
}

/** Runs the scan of a project and returns every C1 and C4 finding, sorted by file and line. */
export function stateFindings(projectRoot: string, config: Pick<QaConfig, 'clientRoots' | 'typeRoots' | 'routeTables'>, generated: string): StateFinding[] {
  const { inventory, problems } = scanStates(projectRoot, config, generated);
  return [...c1Findings(inventory, problems), ...c4Findings(inventory)].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}
