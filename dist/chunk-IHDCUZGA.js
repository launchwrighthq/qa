import {
  LaunchwrightError,
  optionalPeer
} from "./chunk-2ITTLG7O.js";

// src/intake/services/telegram-peers.mts
async function loadTelegramPeer(spec, message) {
  const mod = await optionalPeer(spec, () => import(spec));
  if (mod === void 0) throw new LaunchwrightError("qa.intake.telegram.peer", message);
  return mod;
}
var loadBotApi = () => loadTelegramPeer(
  "@launchwrighthq/telegram/bot-api",
  "The telegram-bot intake driver calls the Bot API through module telegram. Install @launchwrighthq/telegram."
);
var loadMtproto = () => loadTelegramPeer(
  "@launchwrighthq/telegram/mtproto",
  "The telegram-mtproto intake driver reads the chat through module telegram. Install @launchwrighthq/telegram."
);

export {
  loadBotApi,
  loadMtproto
};
//# sourceMappingURL=chunk-IHDCUZGA.js.map