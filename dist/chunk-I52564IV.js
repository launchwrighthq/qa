import {
  optionalPeer
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError,
  isCodedError,
  messageOf
} from "./chunk-KK6DCU3O.js";

// src/services/peers.mts
function isViteMissingPeer(err, spec) {
  if (!isCodedError(err) || err.code !== "kernel.peer.load") return false;
  return messageOf(err.cause).startsWith(`Could not resolve "${spec}" imported by`);
}
async function peerOrUndefined(spec) {
  try {
    return await optionalPeer(spec, () => import(spec));
  } catch (err) {
    if (isViteMissingPeer(err, spec)) return void 0;
    throw err;
  }
}
async function loadPeer(spec, module) {
  const mod = await peerOrUndefined(spec);
  if (!mod) throw new LaunchwrightError(`qa.${module}.module`, `This lw qa command needs the ${module} module. Run lw add ${module}.`);
  return mod;
}
var DB_PEER = "@launchwrighthq/db";
var loadDb = () => loadPeer(DB_PEER, "db");
var optionalDb = () => peerOrUndefined(DB_PEER);
var HTTP_PEER = "@launchwrighthq/http";
var optionalHttp = () => peerOrUndefined(HTTP_PEER);
var loadAuth = () => loadPeer("@launchwrighthq/auth", "auth");
var loadStorage = () => loadPeer("@launchwrighthq/storage", "storage");
var loadDev = () => loadPeer("@launchwrighthq/dev", "dev");
var loadTunnel = () => loadPeer("@launchwrighthq/tunnel", "tunnel");

export {
  loadDb,
  optionalDb,
  optionalHttp,
  loadAuth,
  loadStorage,
  loadDev,
  loadTunnel
};
//# sourceMappingURL=chunk-I52564IV.js.map