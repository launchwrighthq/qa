import {
  readTextOrNull,
  sha256
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/contract.mts
import { mkdir, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
var GROUP_ORDER = { credentials: 0, devices: 1, outward: 2, data: 3 };
var FINGERPRINT_LENGTH = 12;
function credentialNeed(envKey, value, legs) {
  const present = value !== void 0 && value !== "";
  return {
    key: envKey,
    present,
    ...present ? { fingerprint: sha256(value).slice(0, FINGERPRINT_LENGTH) } : {},
    ...legs && legs.length > 0 ? { legs: [...legs] } : {}
  };
}
var CONSENT_DIR = ".lw/qa/consent";
var DEVICE_RIGS = {
  "android-adb": "An Android device over adb",
  "android-emulator": "The Android emulator",
  "ios-webkit": "An iOS device over WebKit",
  "ios-simulator": "The iOS simulator",
  browserstack: "A BrowserStack slot"
};
var NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FINGERPRINT = /^[0-9a-f]{1,16}$/;
var HEX64 = /^[0-9a-f]{64}$/;
function credentialItem(need) {
  if (Object.hasOwn(need, "value")) {
    throw new LaunchwrightError("qa.consent.secret", `The credential ${need.key} carries a value. Pass set/empty and a short hash only, never the secret.`, { context: { key: need.key } });
  }
  if (need.fingerprint !== void 0 && !FINGERPRINT.test(need.fingerprint)) {
    throw new LaunchwrightError("qa.consent.fingerprint", `The fingerprint of ${need.key} is not a short sha256 of 1 to 16 hex characters. It must never be the value.`, { context: { key: need.key } });
  }
  const item = { id: `credentials:${need.key}`, group: "credentials", title: `${need.key} (${need.present ? "set" : "empty"})`, outward: false, key: need.key, present: need.present };
  if (need.present && need.fingerprint !== void 0) item.fingerprint = need.fingerprint;
  if (need.legs !== void 0 && need.legs.length > 0) item.legs = [...new Set(need.legs)].sort();
  return item;
}
function deviceItems(legs) {
  const items = /* @__PURE__ */ new Map();
  for (const leg of legs) {
    const rig = DEVICE_RIGS[leg.target];
    if (rig === void 0) continue;
    const id = leg.device ? `devices:${leg.target}:${leg.device}` : `devices:${leg.target}`;
    items.set(id, { id, group: "devices", title: leg.device ? `${rig} (${leg.device})` : rig, outward: false });
  }
  return [...items.values()];
}
function namedItem(group, need) {
  if (!NAME.test(need.id)) {
    throw new LaunchwrightError("qa.consent.id", `The ${group} id "${need.id}" is not kebab case, for example "throwaway-bot".`, { context: { id: need.id } });
  }
  return { id: `${group}:${need.id}`, group, title: need.title, outward: group === "outward" };
}
function computeManifest(input) {
  const items = /* @__PURE__ */ new Map();
  const add = (item) => {
    const legs = [.../* @__PURE__ */ new Set([...items.get(item.id)?.legs ?? [], ...item.legs ?? []])].sort();
    items.set(item.id, legs.length > 0 ? { ...item, legs } : item);
  };
  for (const need of input.credentials ?? []) add(credentialItem(need));
  for (const item of deviceItems(input.legs ?? [])) add(item);
  for (const need of input.outward ?? []) add(namedItem("outward", need));
  for (const need of input.data ?? []) add(namedItem("data", need));
  const sorted = [...items.values()].sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { title: input.title, items: sorted };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v !== void 0) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}
function manifestHash(manifest) {
  return sha256(JSON.stringify(canonical(manifest)));
}
function grant(manifest, choices) {
  const grants = [];
  for (const item of manifest.items) {
    if (choices === "all") grants.push({ id: item.id, via: "all" });
    else if (choices[item.id] === true) grants.push({ id: item.id, via: "item" });
  }
  return { hash: manifestHash(manifest), grants };
}
function grantedIds(prior) {
  const records = prior === null ? [] : Array.isArray(prior) ? prior : [prior];
  return new Set(records.flatMap((record) => record.grants.map((g) => g.id)));
}
function diff(prior, manifest) {
  const granted = grantedIds(prior);
  return manifest.items.filter((item) => !granted.has(item.id));
}
function recordGrants(manifest, prior, choice) {
  const listed = new Set(manifest.items.map((item) => item.id));
  const unlisted = choice === "all" ? [] : choice.filter((id) => !listed.has(id));
  if (unlisted.length > 0) {
    throw new LaunchwrightError("qa.consent.unlisted", `The manifest "${manifest.title}" does not list ${unlisted.join(", ")}. Grant only an item it lists: ${[...listed].join(", ") || "none"}.`, {
      context: { unlisted }
    });
  }
  const before = new Map(prior.flatMap((record) => record.grants.map((g) => [g.id, g.via])));
  const grants = [];
  for (const item of manifest.items) {
    const via = before.get(item.id) ?? (choice === "all" ? "all" : choice.includes(item.id) ? "item" : void 0);
    if (via !== void 0) grants.push({ id: item.id, via });
  }
  return { hash: manifestHash(manifest), title: manifest.title, items: manifest.items, grants };
}
function missingCredentials(manifest) {
  return manifest.items.filter((item) => item.group === "credentials" && item.present === false);
}
function fileConsentStore(dir) {
  const fileFor = (hash) => {
    if (!HEX64.test(hash)) throw new LaunchwrightError("qa.consent.hash", `A consent hash is 64 hex characters, not "${hash}".`, { context: { hash } });
    return join(dir, `${hash}.json`);
  };
  return {
    async read(hash) {
      const file = fileFor(hash);
      const text = await readTextOrNull(file);
      if (text === null) return null;
      try {
        return JSON.parse(text);
      } catch (cause) {
        throw new LaunchwrightError("qa.consent.read", `The consent record ${file} is not JSON.`, { cause, context: { hash } });
      }
    },
    async write(hash, record) {
      const file = fileFor(hash);
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify(record, null, 2)}
`);
    },
    async list() {
      const records = [];
      for (const hash of await recordHashes(dir)) {
        const record = await this.read(hash);
        if (record !== null) records.push(record);
      }
      return records;
    },
    async remove(hash) {
      const hashes = hash === void 0 ? await recordHashes(dir) : [hash];
      let removed = 0;
      for (const h of hashes) {
        const file = fileFor(h);
        if (await readTextOrNull(file) === null) continue;
        await rm(file);
        removed += 1;
      }
      return removed;
    }
  };
}
async function recordHashes(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch (cause) {
    if (cause.code === "ENOENT") return [];
    throw new LaunchwrightError("qa.consent.list", `Cannot list the consent records in ${dir}.`, { cause });
  }
  return names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length)).filter((hash) => HEX64.test(hash)).sort();
}

export {
  credentialNeed,
  CONSENT_DIR,
  computeManifest,
  manifestHash,
  grant,
  diff,
  recordGrants,
  missingCredentials,
  fileConsentStore
};
//# sourceMappingURL=chunk-N6G3DBRC.js.map