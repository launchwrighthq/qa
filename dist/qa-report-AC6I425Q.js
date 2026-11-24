import {
  buildViewer
} from "./chunk-CHZAXL2Z.js";
import {
  RENDERER_DIR,
  checkReport,
  renderReport,
  scoreReport,
  updateReport
} from "./chunk-5VUYK3ZQ.js";
import "./chunk-JYL7CKWM.js";
import {
  qaConfigOf
} from "./chunk-X6J22AIF.js";
import "./chunk-RFUDK5EX.js";
import "./chunk-OF544TQR.js";
import "./chunk-3OHR7PBT.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import {
  legDefinitions
} from "./chunk-TQCRYULZ.js";
import "./chunk-SA2YN55L.js";
import "./chunk-5AJ7M7K5.js";
import {
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-report.mts
import { isAbsolute, resolve } from "path";
var ACTIONS = ["check", "update", "render", "viewer"];
var USAGE = [
  "usage: lw qa report <check|update|render|viewer> <report.md>",
  "  check   exit 1 and list every problem: missing, blank, unembedded or edited evidence, a wrong Status, an issue with no statement, a CONFIRMED finding with no severity",
  "  update  write section 3, the section 5 lines and the Status, Legs and Coverage lines from the ledger, and print the score",
  "  render  write <reportDir>/dist/<slug>.html with the spec renderer",
  "  viewer  write the interactive multi-page viewer under <reportDir>/dist/<slug>-viewer/"
];
var report = {
  name: "report",
  summary: "Check, update or render a QA report",
  async run(args, opts) {
    const [action, file, ...rest] = args;
    if (!action || !file || rest.length > 0 || !ACTIONS.includes(action)) {
      for (const line of USAGE) opts.err(line);
      return 2;
    }
    const md = isAbsolute(file) ? file : resolve(opts.cwd, file);
    const config = qaConfigOf(opts.config);
    const legs = legDefinitions(config).map((l) => l.name);
    try {
      if (action === "check") {
        const problems = await checkReport(md, { legs, blankStdDev: config.evidence.blankStdDev, root: opts.cwd });
        if (problems.length === 0) {
          opts.out(`lw qa report check: ${file} passes`);
          return 0;
        }
        opts.err(`lw qa report check: ${file} has ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
        for (const p of problems) opts.err(`  ${p.code}: ${p.message}`);
        return 1;
      }
      const score = config.score;
      if (action === "update") {
        const status = await updateReport(md, { legs });
        const scored = await scoreReport(md, { legs, score });
        const scoreText = scored ? `, score ${scored.result.score} of 100, confidence ${Math.round(scored.result.confidence * 100)}%` : "";
        opts.out(`lw qa report update: ${file} Status: ${status}${scoreText}`);
        return 0;
      }
      if (action === "viewer") {
        const result = await buildViewer(md, { legs, weights: score.weights, gaugeColor: score.gaugeColor });
        opts.out(`lw qa report viewer: wrote ${result.pages.length} pages, open ${result.index}`);
        return 0;
      }
      const page = await renderReport(md, RENDERER_DIR, opts.cwd, { legs, score });
      opts.out(`lw qa report render: wrote ${page}`);
      return 0;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa report ${action}: ${cause.code}: ${cause.message}`);
      return 1;
    }
  }
};
var qa_report_default = report;
export {
  qa_report_default as default
};
//# sourceMappingURL=qa-report-AC6I425Q.js.map