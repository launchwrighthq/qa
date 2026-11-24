import {
  scanStates
} from "./chunk-D46OJBIP.js";

// src/states/services/check.mts
function c1Findings(inventory, problems) {
  const findings = [];
  for (const union of inventory.unions) {
    if (union.kind !== "neither") continue;
    findings.push({
      rule: "C1",
      union: union.name,
      file: union.file,
      line: union.line,
      message: `${union.file}:${union.line} ${union.name} is neither an input nor an output, so no trigger reaches its ${union.members.length} state(s). Give a component a prop of this type, return it from an exported function, or mark it @qa-states ignore <reason>.`
    });
  }
  for (const problem of problems) {
    if (problem.code === "invalid-shape") continue;
    findings.push({ rule: "C1", union: problem.union, file: problem.file, line: problem.line, message: problem.message });
  }
  return findings;
}
function c4Findings(inventory) {
  const findings = [];
  for (const union of inventory.unions) {
    if (union.kind === "neither") continue;
    if ((union.routes ?? []).length > 0) continue;
    if (union.inputs.some((site) => site.component !== null)) continue;
    findings.push({
      rule: "C4",
      union: union.name,
      file: union.file,
      line: union.line,
      message: `${union.file}:${union.line} ${union.name} has no route and no mount: ${union.why ?? "no route table row reaches it"}. Add its page to the route table, or give a component a prop of this type so /__states can mount it.`
    });
  }
  return findings;
}
function stateFindings(projectRoot, config, generated) {
  const { inventory, problems } = scanStates(projectRoot, config, generated);
  return [...c1Findings(inventory, problems), ...c4Findings(inventory)].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}

export {
  c1Findings,
  c4Findings,
  stateFindings
};
//# sourceMappingURL=chunk-P6OTXJJ2.js.map