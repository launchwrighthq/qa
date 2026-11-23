// The MTProto user client of the library: a thin wrapper over GramJS (the public npm package
// `telegram`), for what the Bot API cannot do: a user account that reads a chat for intake, and the
// BotFather dialog of the throwaway bot. GramJS is an optional peer. It loads on first use through a
// variable specifier, so a project that never connects a user client does not need it. The session
// string is a secret: it never passes through a log line here.
import { LaunchwrightError } from '../kernel/index.mts';

/** The part of a GramJS client that this wrapper uses. */
export interface GramJsClient {
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  getMe(): Promise<unknown>;
  sendMessage(peer: unknown, params: { message: string }): Promise<unknown>;
  /** GramJS `getMessages`: history with `limit`, `minId`, `maxId`, `offsetDate`, `reverse`, or `ids`. */
  getMessages(peer: unknown, params: Record<string, unknown>): Promise<unknown[]>;
  /** GramJS `downloadMedia`: the bytes of the media of a message. */
  downloadMedia(message: unknown, params?: Record<string, unknown>): Promise<unknown>;
  invoke(request: unknown): Promise<unknown>;
  session: { save(): unknown };
}

/** The part of the GramJS package that this wrapper uses. */
export interface GramJsModule {
  TelegramClient: new (session: unknown, apiId: number, apiHash: string, opts: Record<string, unknown>) => GramJsClient;
  StringSession: new (session: string) => unknown;
}

/** The window of `UserClient.history`: the GramJS `getMessages` parameters it passes on. */
export interface HistoryOptions {
  limit?: number;
  /** Only messages with a greater id. */
  minId?: number;
  /** Only messages with a smaller id. */
  maxId?: number;
  /** Unix seconds. With `reverse`, messages from this date on. */
  offsetDate?: number;
  /** Oldest first. */
  reverse?: boolean;
}

export interface UserClientOptions {
  /** From my.telegram.org. */
  apiId: number;
  apiHash: string;
  /** A GramJS string session of a signed-in account. */
  session: string;
  connectionRetries?: number;
  /** A SOCKS5 proxy as `socks5://[user:password@]host:port`. A secret when it holds a password. */
  proxy?: string;
  /** Loads GramJS. Tests pass a fake. */
  loader?: () => Promise<GramJsModule>;
}

/** Imports a package by name. `loadGramJs` takes it, so a test can give a fake package. */
export type PackageImporter = (name: string) => Promise<unknown>;

/** Loads GramJS. Throws `telegram.mtproto.missing` when the `telegram` package is not installed. */
export async function loadGramJs(importer: PackageImporter = (name) => import(name)): Promise<GramJsModule> {
  // Names in variables, so neither the type checker nor the bundler needs the optional package.
  const main = 'telegram';
  const sessions = 'telegram/sessions';
  try {
    const lib = (await importer(main)) as { TelegramClient: GramJsModule['TelegramClient'] };
    const sess = (await importer(sessions)) as { StringSession: GramJsModule['StringSession'] };
    return { TelegramClient: lib.TelegramClient, StringSession: sess.StringSession };
  } catch (cause) {
    throw new LaunchwrightError('telegram.mtproto.missing', 'The MTProto user client needs GramJS: add the npm package "telegram" (2.26 or later) to the project.', { cause });
  }
}

/** The GramJS proxy option of a `socks5://` URL. The error names no part of the URL, which can hold a password. */
export function socksProxy(url: string): { ip: string; port: number; socksType: 5; username?: string; password?: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch (cause) {
    throw new LaunchwrightError('telegram.mtproto.proxy', 'The proxy is not a URL. Write socks5://[user:password@]host:port.', { cause });
  }
  const port = Number(u.port);
  if (u.protocol !== 'socks5:' || u.hostname === '' || !Number.isInteger(port) || port <= 0) {
    throw new LaunchwrightError('telegram.mtproto.proxy', 'The proxy must be socks5://[user:password@]host:port.');
  }
  return {
    ip: u.hostname,
    port,
    socksType: 5,
    ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
  };
}

export class UserClient {
  private constructor(readonly raw: GramJsClient) {}

  /** Connects with a saved session. Sign-in (phone code, 2FA) is a step outside this wrapper. */
  static async connect(opts: UserClientOptions): Promise<UserClient> {
    if (!Number.isInteger(opts.apiId) || opts.apiId <= 0 || opts.apiHash === '') {
      throw new LaunchwrightError('telegram.mtproto.config', 'The user client needs apiId and apiHash from my.telegram.org.', { context: { key: 'apiId' } });
    }
    const proxy = opts.proxy === undefined ? undefined : socksProxy(opts.proxy);
    const gram = await (opts.loader ?? loadGramJs)();
    const client = new gram.TelegramClient(new gram.StringSession(opts.session), opts.apiId, opts.apiHash, {
      connectionRetries: opts.connectionRetries ?? 5,
      ...(proxy ? { proxy } : {}),
    });
    try {
      await client.connect();
    } catch (cause) {
      throw new LaunchwrightError('telegram.mtproto.connect', 'The MTProto user client cannot connect.', { cause });
    }
    return new UserClient(client);
  }

  sendMessage(peer: string | number, text: string): Promise<unknown> {
    return this.raw.sendMessage(peer, { message: text });
  }

  /** Reads messages of a chat. `reverse: true` gives the oldest first, from `minId` or `offsetDate` on. */
  async history(peer: string | number, opts: HistoryOptions = {}): Promise<unknown[]> {
    return [...(await this.raw.getMessages(peer, { ...opts }))];
  }

  /** Reads the messages with these ids. A missing message is absent from the result. */
  async messages(peer: string | number, ids: number[]): Promise<unknown[]> {
    const found = await this.raw.getMessages(peer, { ids });
    return [...found].filter((m) => m !== undefined && m !== null);
  }

  /** Downloads the media of a message into memory. Throws `telegram.mtproto.download`. */
  async downloadMedia(message: unknown): Promise<Uint8Array> {
    let data: unknown;
    try {
      data = await this.raw.downloadMedia(message, {});
    } catch (cause) {
      throw new LaunchwrightError('telegram.mtproto.download', 'The MTProto user client cannot download the media of a message.', { cause });
    }
    if (!(data instanceof Uint8Array)) {
      throw new LaunchwrightError('telegram.mtproto.download', 'The message has no media to download.', { context: { result: typeof data } });
    }
    return data;
  }

  async close(): Promise<void> {
    await this.raw.disconnect();
  }
}

/** Connects a user client. */
export function connectUserClient(opts: UserClientOptions): Promise<UserClient> {
  return UserClient.connect(opts);
}
