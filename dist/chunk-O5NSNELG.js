import {
  extensionOf
} from "./chunk-B7UB2WOJ.js";
import {
  INTAKE_DIR
} from "./chunk-SA2YN55L.js";
import {
  sha256
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/records.mts
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
var ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
function recordId(...parts) {
  return parts.map((p) => String(p).replace(/^@/, "").replace(/[^A-Za-z0-9_.-]+/g, "-")).join("-");
}
function recordDir(root, id) {
  if (!ID.test(id) || id.includes("..")) throw new LaunchwrightError("qa.intake.id", `The intake id "${id}" has a character outside A-Z, a-z, 0-9, _, . and -.`, { context: { id } });
  return join(root, INTAKE_DIR, id);
}
function fileName(index, m) {
  const ext = extensionOf(m.mime);
  const stem = (m.name ?? m.kind).replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40) || m.kind;
  return `${String(index).padStart(2, "0")}-${stem}.${ext}`;
}
function quote(text) {
  return text === "" ? "> (no text)" : text.split("\n").map((l) => `> ${l}`).join("\n");
}
function issueMarkdown(issue) {
  const lines = [
    `# ${issue.title}`,
    "",
    `- Id: ${issue.id}`,
    `- Source: ${issue.source}`,
    `- Ref: ${issue.ref}`,
    `- Reported at: ${issue.reportedAt}`,
    `- Reporter: ${issue.reporter}`,
    "",
    quote(issue.text)
  ];
  if (issue.thread.length > 0) {
    lines.push("", "## Thread");
    for (const t of issue.thread) lines.push("", `${t.at}, ${t.author}:`, "", quote(t.text));
  }
  if (issue.attachments.length > 0) {
    lines.push("", "## Attachments", "");
    for (const a of issue.attachments) {
      const link = a.kind === "image" ? `![${a.path}](${a.path})` : `[${a.path}](${a.path})`;
      lines.push(`- ${a.kind}, ${a.mime}, ${a.bytes} bytes: ${link}`);
    }
  }
  if (issue.skipped.length > 0) {
    lines.push("", "## Skipped", "");
    for (const s of issue.skipped) lines.push(`- ${s.reason}: ${s.from}`);
  }
  return `${lines.join("\n")}
`;
}
async function writeIssue(root, draft) {
  const dir = recordDir(root, draft.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, "assets"), { recursive: true });
  const { media, ...rest } = draft;
  const issue = { ...rest, attachments: [], skipped: [] };
  let index = 0;
  for (const m of media) {
    if (m.data === void 0) {
      issue.skipped.push({ from: m.from, reason: m.skipped ?? "unreachable" });
      continue;
    }
    index += 1;
    const path = `assets/${fileName(index, m)}`;
    await writeFile(join(dir, path), m.data);
    issue.attachments.push({
      kind: m.kind,
      path,
      sha256: sha256(m.data),
      bytes: m.data.byteLength,
      mime: m.mime,
      from: m.from
    });
  }
  await writeFile(join(dir, "issue.json"), `${JSON.stringify(issue, null, 2)}
`);
  await writeFile(join(dir, "issue.md"), issueMarkdown(issue));
  return issue;
}
async function readIssue(root, id) {
  const file = join(recordDir(root, id), "issue.json");
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (cause) {
    throw new LaunchwrightError("qa.intake.missing", `No intake record ${id}. Run lw qa intake list.`, { cause, context: { id } });
  }
  return JSON.parse(text);
}
async function listIssues(root) {
  const base = join(root, INTAKE_DIR);
  let names;
  try {
    names = (await readdir(base, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.intake.read", `Cannot read ${INTAKE_DIR}.`, { cause });
  }
  const out = [];
  for (const name of names.sort()) {
    let text;
    try {
      text = await readFile(join(base, name, "issue.json"), "utf8");
    } catch (cause) {
      if (cause.code === "ENOENT") continue;
      throw new LaunchwrightError("qa.intake.read", `Cannot read the intake record ${name}.`, { cause });
    }
    out.push(JSON.parse(text));
  }
  return out;
}

export {
  recordId,
  recordDir,
  issueMarkdown,
  writeIssue,
  readIssue,
  listIssues
};
//# sourceMappingURL=chunk-O5NSNELG.js.map