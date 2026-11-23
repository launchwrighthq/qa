// src/services/findings.mts
var SEVERITIES = ["critical", "high", "medium", "low"];
var FINDING_RE = /^(?:[-*+]\s+|#{3,6}\s+)?\**(CONFIRMED|SUSPECTED)\b\**:?\s*(.*)$/;
var TAG_RE = /^\[([^\]]*)\]\s*(.*)$/;
var isSeverity = (tag) => SEVERITIES.includes(tag);
function parseFindings(lines, from = 0, to = lines.length) {
  const out = [];
  let fence = false;
  for (let i = from; i < to; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith("```")) fence = !fence;
    if (fence) continue;
    const m = FINDING_RE.exec(line);
    if (!m) continue;
    const rest = m[2].trim();
    const t = TAG_RE.exec(rest);
    const tag = t ? t[1].trim().toLowerCase() : null;
    out.push({ line: i, status: m[1], tag, severity: tag !== null && isSeverity(tag) ? tag : null, claim: t ? t[2].trim() : rest });
  }
  return out;
}
function tallyFindings(findings) {
  const confirmed = { critical: 0, high: 0, medium: 0, low: 0 };
  let suspected = 0;
  for (const f of findings) {
    if (f.status === "SUSPECTED") suspected += 1;
    else if (f.severity) confirmed[f.severity] += 1;
  }
  return { confirmed, suspected };
}
function findingProblems(findings) {
  const out = [];
  const form = `"CONFIRMED [${SEVERITIES.join("|")}] <claim>"`;
  for (const f of findings) {
    const at = `line ${f.line + 1}`;
    if (f.tag !== null && f.severity === null) out.push(`${at}: the ${f.status} finding has the tag [${f.tag}], which is not a severity. Write ${form}.`);
    else if (f.status === "CONFIRMED" && f.tag === null) out.push(`${at}: the CONFIRMED finding "${f.claim}" has no severity tag. Write ${form}.`);
  }
  return out;
}

export {
  SEVERITIES,
  parseFindings,
  tallyFindings,
  findingProblems
};
//# sourceMappingURL=chunk-RFUDK5EX.js.map