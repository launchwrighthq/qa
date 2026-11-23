import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/kernel/services/fs.mts
import { createHash } from "crypto";
import { createReadStream, readFileSync, statSync } from "fs";
import { readFile, stat } from "fs/promises";
import { parse as parseToml } from "smol-toml";
var MISSING = /* @__PURE__ */ new Set(["ENOENT", "ENOTDIR"]);
function isMissing(err) {
  return MISSING.has(String(err?.code));
}
function readError(path, cause) {
  return new LaunchwrightError("kernel.fs.read", `Cannot read ${path}`, { cause, context: { path } });
}
async function pathKind(path) {
  try {
    return (await stat(path)).isDirectory() ? "dir" : "file";
  } catch (cause) {
    if (isMissing(cause)) return "missing";
    throw readError(path, cause);
  }
}
async function readTextOrNull(path) {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    if (isMissing(cause)) return null;
    throw readError(path, cause);
  }
}
function readTextOrNullSync(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (cause) {
    if (isMissing(cause)) return null;
    throw readError(path, cause);
  }
}
async function readJsonOrNull(path) {
  const text = await readTextOrNull(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError("kernel.fs.json", `${path} is not valid JSON`, { cause, context: { path } });
  }
}
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
async function hashFile(path) {
  const hash = createHash("sha256");
  try {
    for await (const chunk of createReadStream(path)) hash.update(chunk);
  } catch (cause) {
    throw readError(path, cause);
  }
  return hash.digest("hex");
}

export {
  pathKind,
  readTextOrNull,
  readTextOrNullSync,
  readJsonOrNull,
  sha256,
  hashFile
};
//# sourceMappingURL=chunk-GZ2IEQDP.js.map