import {
  readTextOrNull,
  sha256
} from "./chunk-GZ2IEQDP.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/contract.mts
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
var GROUP_ORDER = { credentials: 0, devices: 1, outward: 2, data: 3 };
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
    items.set(item.id, item);
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
function diff(prior, manifest) {
  const granted = new Set((prior?.grants ?? []).map((g) => g.id));
  return manifest.items.filter((item) => !granted.has(item.id));
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
    }
  };
}

export {
  computeManifest,
  manifestHash,
  grant,
  diff,
  fileConsentStore
};
//# sourceMappingURL=chunk-SYG32WE6.js.map