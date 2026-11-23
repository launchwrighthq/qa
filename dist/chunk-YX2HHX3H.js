import {
  CONSENT_DIR,
  diff,
  fileConsentStore,
  missingCredentials,
  recordGrants
} from "./chunk-N6G3DBRC.js";

// src/services/consent-gate.mts
import { join } from "path";
function itemLine(item) {
  const legs = item.legs ? `  (leg ${item.legs.join(", ")})` : "";
  return `  ${item.group.padEnd(11)} ${item.id}  ${item.title}${item.outward ? "  [outward]" : ""}${legs}`;
}
function consentStoreOf(opts) {
  return opts.store ?? fileConsentStore(join(opts.cwd, CONSENT_DIR));
}
async function consentGate(manifest, opts) {
  if (manifest.items.length === 0) return true;
  const store = consentStoreOf(opts);
  opts.out(`run contract for "${manifest.title}": ${manifest.items.length} item(s) need consent`);
  for (const item of manifest.items) opts.out(itemLine(item));
  const listed = new Set(manifest.items.map((item) => item.id));
  const unlisted = opts.allow.filter((id) => !listed.has(id));
  if (unlisted.length > 0) {
    opts.err(`run contract: --allow ${unlisted.join(", ")} names no item of this manifest. Grant only an item it lists.`);
    return false;
  }
  const prior = await store.list();
  const missing = missingCredentials(manifest);
  const record = recordGrants(manifest, prior, missing.length > 0 ? [] : opts.allowAll ? "all" : opts.allow);
  await store.write(record.hash, record);
  if (missing.length > 0) {
    opts.err(`run contract: ${missing.length} credential(s) are empty, so nothing starts:`);
    for (const item of missing) opts.err(`  ${item.key ?? item.id}${item.legs ? `  needed by leg ${item.legs.join(", ")}` : ""}`);
    opts.err(`Set each key from the secret store${missing.some((item) => item.legs) ? ", or drop the leg that needs it with --legs" : ""}.`);
    return false;
  }
  const pending = diff(prior, manifest);
  if (pending.length === 0) {
    opts.out("run contract: every item is granted; asking nothing");
    return true;
  }
  const remaining = diff(record, manifest);
  const recorded = pending.length - remaining.length;
  if (opts.allowAll) opts.out(`run contract: allow all recorded ${recorded} grant(s) under ${CONSENT_DIR}`);
  else if (recorded > 0) opts.out(`run contract: recorded ${recorded} grant(s) under ${CONSENT_DIR}`);
  if (remaining.length === 0) return true;
  opts.err(`run contract: ${remaining.length} item(s) need a grant. Re-run with --allow <id> for each, or --allow-all to grant every listed item:`);
  for (const item of remaining) opts.err(`  ${item.outward ? "outward " : ""}${item.id}  ${item.title}`);
  opts.err("Or grant one item with: lw qa consent grant <id>");
  return false;
}

export {
  itemLine,
  consentStoreOf,
  consentGate
};
//# sourceMappingURL=chunk-YX2HHX3H.js.map