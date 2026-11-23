import {
  optionalPeer
} from "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/services/peers.mts
async function loadPeer(spec, module) {
  const mod = await optionalPeer(spec, () => import(spec));
  if (!mod) throw new LaunchwrightError(`qa.${module}.module`, `This lw qa command needs the ${module} module. Run lw add ${module}.`);
  return mod;
}
var loadDb = () => loadPeer("@launchwrighthq/db", "db");
var loadHttp = () => loadPeer("@launchwrighthq/http", "http");
var loadAuth = () => loadPeer("@launchwrighthq/auth", "auth");
var loadStorage = () => loadPeer("@launchwrighthq/storage", "storage");
var loadDev = () => loadPeer("@launchwrighthq/dev", "dev");
var loadTunnel = () => loadPeer("@launchwrighthq/tunnel", "tunnel");

export {
  loadDb,
  loadHttp,
  loadAuth,
  loadStorage,
  loadDev,
  loadTunnel
};
//# sourceMappingURL=chunk-CNY6SOD7.js.map