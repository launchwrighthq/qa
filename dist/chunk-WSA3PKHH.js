import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/telegram/mtproto.mts
async function loadGramJs(importer = (name) => import(name)) {
  const main = "telegram";
  const sessions = "telegram/sessions";
  try {
    const lib = await importer(main);
    const sess = await importer(sessions);
    return { TelegramClient: lib.TelegramClient, StringSession: sess.StringSession };
  } catch (cause) {
    throw new LaunchwrightError("telegram.mtproto.missing", 'The MTProto user client needs GramJS: add the npm package "telegram" (2.26 or later) to the project.', { cause });
  }
}
function socksProxy(url) {
  let u;
  try {
    u = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError("telegram.mtproto.proxy", "The proxy is not a URL. Write socks5://[user:password@]host:port.", { cause });
  }
  const port = Number(u.port);
  if (u.protocol !== "socks5:" || u.hostname === "" || !Number.isInteger(port) || port <= 0) {
    throw new LaunchwrightError("telegram.mtproto.proxy", "The proxy must be socks5://[user:password@]host:port.");
  }
  return {
    ip: u.hostname,
    port,
    socksType: 5,
    ...u.username ? { username: decodeURIComponent(u.username) } : {},
    ...u.password ? { password: decodeURIComponent(u.password) } : {}
  };
}
var UserClient = class _UserClient {
  constructor(raw) {
    this.raw = raw;
  }
  raw;
  /** Connects with a saved session. Sign-in (phone code, 2FA) is a step outside this wrapper. */
  static async connect(opts) {
    if (!Number.isInteger(opts.apiId) || opts.apiId <= 0 || opts.apiHash === "") {
      throw new LaunchwrightError("telegram.mtproto.config", "The user client needs apiId and apiHash from my.telegram.org.", { context: { key: "apiId" } });
    }
    const proxy = opts.proxy === void 0 ? void 0 : socksProxy(opts.proxy);
    const gram = await (opts.loader ?? loadGramJs)();
    const client = new gram.TelegramClient(new gram.StringSession(opts.session), opts.apiId, opts.apiHash, {
      connectionRetries: opts.connectionRetries ?? 5,
      ...proxy ? { proxy } : {}
    });
    try {
      await client.connect();
    } catch (cause) {
      throw new LaunchwrightError("telegram.mtproto.connect", "The MTProto user client cannot connect.", { cause });
    }
    return new _UserClient(client);
  }
  sendMessage(peer, text) {
    return this.raw.sendMessage(peer, { message: text });
  }
  /** Reads messages of a chat. `reverse: true` gives the oldest first, from `minId` or `offsetDate` on. */
  async history(peer, opts = {}) {
    return [...await this.raw.getMessages(peer, { ...opts })];
  }
  /** Reads the messages with these ids. A missing message is absent from the result. */
  async messages(peer, ids) {
    const found = await this.raw.getMessages(peer, { ids });
    return [...found].filter((m) => m !== void 0 && m !== null);
  }
  /** Downloads the media of a message into memory. Throws `telegram.mtproto.download`. */
  async downloadMedia(message) {
    let data;
    try {
      data = await this.raw.downloadMedia(message, {});
    } catch (cause) {
      throw new LaunchwrightError("telegram.mtproto.download", "The MTProto user client cannot download the media of a message.", { cause });
    }
    if (!(data instanceof Uint8Array)) {
      throw new LaunchwrightError("telegram.mtproto.download", "The message has no media to download.", { context: { result: typeof data } });
    }
    return data;
  }
  async close() {
    await this.raw.disconnect();
  }
};
function connectUserClient(opts) {
  return UserClient.connect(opts);
}

export {
  loadGramJs,
  UserClient,
  connectUserClient
};
//# sourceMappingURL=chunk-WSA3PKHH.js.map