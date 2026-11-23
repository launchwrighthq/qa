import {
  loadStorage
} from "./chunk-CNY6SOD7.js";
import {
  checkReport,
  intakeStaysLocal,
  intakeTarget,
  withoutIntakeLinks
} from "./chunk-NXLWKAIO.js";
import "./chunk-JYL7CKWM.js";
import {
  qaConfigOf
} from "./chunk-7OHVK72J.js";
import "./chunk-ZXEFVZDQ.js";
import "./chunk-XZN5EDSR.js";
import {
  reportPaths
} from "./chunk-3OHR7PBT.js";
import {
  legDefinitions
} from "./chunk-H3DGWSMZ.js";
import {
  INTAKE_DIR
} from "./chunk-SA2YN55L.js";
import {
  pathKind
} from "./chunk-GZ2IEQDP.js";
import "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError
} from "./chunk-KK6DCU3O.js";

// src/services/publish.mts
import { readdir, readFile, realpath } from "fs/promises";
import { dirname, join, relative, resolve, sep } from "path";
var PUBLISH_PREFIX = "qa";
var LINK_TTL_S = 604800;
var CONTENT_TYPES = {
  ".md": "text/markdown; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".jsonl": "application/x-ndjson",
  ".png": "image/png",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
  ".xml": "application/xml"
};
var contentType = (file) => CONTENT_TYPES[/\.[^./]+$/.exec(file)?.[0] ?? ""] ?? "application/octet-stream";
async function walk(dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, d.name);
    if (d.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}
function pageWithoutIntakeLinks(html, pageDir, root) {
  return html.replace(/<a href="([^"]*)">[\s\S]*?<\/a>|<img src="([^"]*)"[^>]*>|<video src="([^"]*)"[^>]*>[\s\S]*?<\/video>/g, (m, a, img, video) => {
    const target = intakeTarget(pageDir, root, a ?? img ?? video);
    return target === null ? m : intakeStaysLocal(target.id);
  });
}
async function publishReport(input) {
  const dir = resolve(input.root, input.reportDir);
  const paths = reportPaths(dir, input.slug);
  if (!("missing" !== await pathKind(paths.md))) {
    throw new LaunchwrightError("qa.publish.missing", `No report ${paths.md}`, { context: { slug: input.slug } });
  }
  const problems = await checkReport(paths.md, { ...input.check, root: input.root });
  if (problems.length > 0) {
    throw new LaunchwrightError("qa.publish.check", `The report ${input.slug} fails lw qa report check:
  ${problems.map((p) => p.message).join("\n  ")}`, {
      context: { slug: input.slug, problems: problems.length }
    });
  }
  const files = [paths.md, paths.plan];
  if ("missing" !== await pathKind(paths.html)) files.push(paths.html);
  if ("missing" !== await pathKind(paths.assets)) files.push(...await walk(paths.assets));
  const intake = resolve(input.root, INTAKE_DIR);
  const intakeReal = "missing" !== await pathKind(intake) ? await realpath(intake) : intake;
  for (const file of files) {
    const real = await realpath(file);
    if (real === intakeReal || real.startsWith(intakeReal + sep) || real.startsWith(intake + sep)) {
      throw new LaunchwrightError("qa.publish.intake", `${relative(input.root, file)} is intake content, which never leaves ${INTAKE_DIR}/`, {
        context: { file: relative(input.root, file) }
      });
    }
  }
  const bodies = /* @__PURE__ */ new Map();
  for (const file of files) {
    let body = await readFile(file);
    if (file === paths.md || file === paths.html) {
      const text = body.toString("utf8");
      const published = file === paths.md ? withoutIntakeLinks(text, dir, input.root) : pageWithoutIntakeLinks(text, dirname(paths.html), input.root);
      if (published.includes(INTAKE_DIR)) {
        throw new LaunchwrightError("qa.publish.intake", `${relative(input.root, file)} names ${INTAKE_DIR}/ outside a section 4 link to reporter media. Intake content stays local.`, {
          context: { file: relative(input.root, file) }
        });
      }
      body = Buffer.from(published, "utf8");
    }
    bodies.set(file, body);
  }
  const out = [];
  const presign = input.driver.supports("presign");
  for (const file of files) {
    const rel = relative(dir, file).split(sep).join("/");
    const key = `${PUBLISH_PREFIX}/${rel}`;
    const body = bodies.get(file);
    try {
      await input.driver.put(key, body, { contentType: contentType(file) });
    } catch (cause) {
      throw new LaunchwrightError("qa.publish.put", `Cannot publish ${rel} as ${key}`, { cause, context: { key } });
    }
    const url = presign ? await input.driver.presign(key, { method: "GET", expiresIn: LINK_TTL_S }) : void 0;
    out.push({ key, bytes: body.length, ...url !== void 0 ? { url } : {} });
  }
  return out;
}

// src/commands/qa-publish.mts
var publish = {
  name: "publish",
  summary: "Copy a report, its ledger and its evidence to the qa.publish.storage disk",
  async run(args, opts) {
    const [slug, ...rest] = args;
    if (!slug || rest.length > 0) {
      opts.err("usage: lw qa publish <slug>   the slug is the report file name without .md");
      return 2;
    }
    const config = qaConfigOf(opts.config);
    const disk = config.publish.storage;
    if (!disk) {
      opts.err("lw qa publish: set qa.publish.storage to a storage disk name in launchwright.config.ts");
      return 1;
    }
    const app = opts.app;
    if (!app) {
      opts.err("lw qa publish: the command needs the booted app with the storage module");
      return 1;
    }
    try {
      const { STORAGE } = await loadStorage();
      const driver = app.get(STORAGE).driver(disk);
      const files = await publishReport({
        root: opts.cwd,
        reportDir: config.reportDir,
        slug,
        driver,
        check: { legs: legDefinitions(config).map((l) => l.name), blankStdDev: config.evidence.blankStdDev }
      });
      for (const f of files) opts.out(`${f.key}  ${f.bytes} bytes${f.url ? `  ${f.url}` : ""}`);
      opts.out(`lw qa publish: ${files.length} files to storage disk ${disk}`);
      return 0;
    } catch (cause) {
      if (!isCodedError(cause)) throw cause;
      opts.err(`lw qa publish: ${cause.code}: ${cause.message}`);
      return 1;
    }
  }
};
var qa_publish_default = publish;
export {
  qa_publish_default as default
};
//# sourceMappingURL=qa-publish-TJQB7BXK.js.map