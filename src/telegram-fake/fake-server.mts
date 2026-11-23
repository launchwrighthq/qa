// The fake Telegram server of `lw qa telegram` (QA spec 2.10). One loopback HTTP server serves the
// Bot API on the shared `FakeBotApi` state, the files that the bots sent, and the `/__tg` chat page.
// The chat page acts as each persona's Telegram user: it makes the updates, and the server sends
// them to the bot's webhook or keeps them for `getUpdates`.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type Clock, LaunchwrightError, messageOf, safeEqual, systemClock } from '../kernel/index.mts';
import { chatPageHtml } from './chat-page.mts';
import { FakeBotApi, readParams } from './fake-bot-api.mts';
import { botIdOfToken, type InlineKeyboardButton, type KeyboardButton, signInitData, type TgMessage, type TgUpdate, type TgUser, webhookSecret } from './protocol.mts';

export interface FakeTelegramBot {
  username: string;
  /** `<bot id>:<secret>`. The server never logs it and never puts it in the chat page. */
  token: string;
}

export interface FakeTelegramPersona {
  /** The persona name of the QA world, for example `owner`. */
  id: string;
  telegramId: number;
  firstName: string;
}

export interface FakeTelegramOptions {
  /** Default 0: a free port. */
  port?: number;
  /** Default `127.0.0.1`. Only a loopback host is allowed. */
  host?: string;
  bots: FakeTelegramBot[];
  personas: FakeTelegramPersona[];
  /**
   * The app's webhook. `{botId}` in `url` becomes the bot id. `secret` is the master secret of
   * `telegram.webhook.secret`: each bot gets the header that the engine derives from it. A bot that
   * calls `setWebhook` gets its own URL and `secret_token` instead. Without a webhook, the server
   * keeps the updates for `getUpdates`.
   */
  webhook?: { url: string; secret: string } | undefined;
  /** The kernel environment. The server refuses to start in `production`. */
  env: string;
  /** The clock of `auth_date`, message dates and the long poll. Default the system clock. */
  clock?: Clock;
}

export interface FakeTelegram {
  /** The origin of the server, for example `http://127.0.0.1:43123`. Set `telegram.apiUrl` to it. */
  url: string;
  /** The shared state: every Bot API call, scripted answers and failures. */
  api: FakeBotApi;
  close(): Promise<void>;
}

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const BODY_LIMIT = 20 * 1024 * 1024;
const MEDIA_FIELDS = ['photo', 'document', 'video', 'animation', 'audio'] as const;
const THEME = { bg_color: '#ffffff', text_color: '#000000', hint_color: '#707579', link_color: '#3390ec', button_color: '#3390ec', button_text_color: '#ffffff', secondary_bg_color: '#f4f4f5' };

interface Bot {
  id: number;
  username: string;
  token: string;
}

interface StoredFile {
  fileId: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
  name: string;
}

interface Invoice {
  title: string;
  description: string;
  payload: string;
  currency: string;
  total: number;
  paid?: boolean;
}

interface Entry {
  id: number;
  from: 'bot' | 'user' | 'service';
  text?: string;
  parseMode?: string;
  photo?: string;
  document?: { name: string; url?: string };
  buttons?: InlineKeyboardButton[][];
  invoice?: Invoice;
}

interface MenuButton {
  text: string;
  url: string;
}

interface Chat {
  entries: Entry[];
  replyKeyboard?: { rows: KeyboardButton[][]; oneTime: boolean };
  notice?: string;
  error?: string;
  menuButton?: MenuButton;
}

interface Checkout {
  bot: Bot;
  persona: FakeTelegramPersona;
  invoice: Invoice;
}

function fakeError(code: string, message: string, context: Record<string, unknown> = {}, cause?: unknown): LaunchwrightError {
  return new LaunchwrightError(`telegram.fake.${code}`, message, { context, ...(cause === undefined ? {} : { cause }) });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > BODY_LIMIT) throw fakeError('body', `The request body is larger than ${BODY_LIMIT} bytes.`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** The request as `RequestInit` for `FakeBotApi.fetch`: JSON as a string, any form as `FormData`. */
async function botApiInit(req: IncomingMessage, url: URL): Promise<RequestInit> {
  const raw = await readBody(req);
  const type = (req.headers['content-type'] ?? '').toLowerCase();
  if (raw.length === 0) {
    if ([...url.searchParams.keys()].length === 0) return { method: 'POST' };
    const form = new FormData();
    for (const [k, v] of url.searchParams) form.append(k, v);
    return { method: 'POST', body: form };
  }
  if (type.startsWith('multipart/form-data') || type.startsWith('application/x-www-form-urlencoded')) {
    const body = await new Request(url, { method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(raw) }).formData();
    return { method: 'POST', body };
  }
  return { method: 'POST', body: raw.toString('utf8') };
}

class FakeTelegramServer {
  readonly api = new FakeBotApi();
  private readonly bots = new Map<number, Bot>();
  private readonly personas = new Map<string, FakeTelegramPersona>();
  private readonly chats = new Map<string, Chat>();
  private readonly files = new Map<string, StoredFile>();
  private readonly invoiceLinks = new Map<string, Invoice>();
  private readonly callbacks = new Map<string, string>();
  private readonly checkouts = new Map<string, Checkout>();
  private readonly botMenus = new Map<number, MenuButton>();
  private readonly waiters = new Set<AbortController>();
  private readonly clock: Clock;
  private version = 0;
  private sequence = 0;
  private updateId = 0;

  constructor(private readonly opts: FakeTelegramOptions) {
    this.clock = opts.clock ?? systemClock;
    for (const b of opts.bots) {
      if (!b.username) throw fakeError('config', 'Each fake bot needs a username.');
      const id = botIdOfToken(b.token);
      if (this.bots.has(id)) throw fakeError('config', `Two fake bots have the bot id ${id}.`, { botId: id });
      this.bots.set(id, { id, username: b.username, token: b.token });
      this.api.describeBot(id, { username: b.username, firstName: b.username });
    }
    for (const p of opts.personas) {
      if (!Number.isSafeInteger(p.telegramId) || p.telegramId <= 0) throw fakeError('config', `Persona ${p.id} needs a positive telegramId.`, { persona: p.id });
      if (this.personas.has(p.id)) throw fakeError('config', `Two personas have the id ${p.id}.`, { persona: p.id });
      this.personas.set(p.id, p);
    }
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://fake-telegram.invalid');
    const path = url.pathname;
    const botCall = /^\/bot([^/]+)\/(\w+)$/.exec(path);
    if (botCall) return this.botApi(req, res, url, botCall[1] as string, botCall[2] as string);
    const fileGet = /^\/file\/bot([^/]+)\/(.+)$/.exec(path);
    if (fileGet && req.method === 'GET') return this.botFile(res, fileGet[1] as string, fileGet[2] as string);
    if (path === '/__tg' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(chatPageHtml());
      return;
    }
    const pageFile = /^\/__tg\/files\/([\w-]+)$/.exec(path);
    if (pageFile && req.method === 'GET') return this.serveFile(res, this.files.get(pageFile[1] as string));
    if (path === '/__tg/api/state' && req.method === 'GET') return sendJson(res, 200, this.state(url.searchParams.get('bot'), url.searchParams.get('persona')));
    const action = /^\/__tg\/api\/(send|callback|webapp|pay)$/.exec(path);
    if (action && req.method === 'POST') return this.pageAction(req, res, action[1] as string);
    sendJson(res, 404, { ok: false, error_code: 404, description: 'Not Found' });
  }

  // The Bot API.

  private botOf(token: string): Bot | undefined {
    const at = token.indexOf(':');
    const bot = this.bots.get(Number(token.slice(0, at)));
    return bot && safeEqual(bot.token, token) ? bot : undefined;
  }

  private async botApi(req: IncomingMessage, res: ServerResponse, url: URL, token: string, method: string): Promise<void> {
    const bot = this.botOf(token);
    if (!bot) return sendJson(res, 401, { ok: false, error_code: 401, description: 'Unauthorized' });
    const init = await botApiInit(req, url);
    let params: Record<string, unknown>;
    try {
      params = await readParams(init);
    } catch (cause) {
      return sendJson(res, 400, { ok: false, error_code: 400, description: `Bad Request: ${messageOf(cause)}` });
    }
    const uploads = init.body instanceof FormData ? await this.storeUploads(init.body) : {};
    if (method === 'getUpdates') await this.waitForUpdates(bot.id, params, res);
    if (res.destroyed) return;
    let response: Response;
    try {
      response = await this.api.fetch(`${this.api.apiUrl}/bot${token}/${method}`, init);
    } catch (cause) {
      // A scripted network failure: the client sees a dropped connection.
      if (cause instanceof TypeError) {
        res.destroy();
        return;
      }
      throw cause;
    }
    const answer = (await response.json()) as { ok: boolean; result?: unknown };
    if (answer.ok) this.apply(bot, method, params, answer.result, uploads);
    sendJson(res, response.status, answer);
  }

  /** Waits for an update when `getUpdates` has a `timeout` and nothing is queued: the long poll. */
  private async waitForUpdates(botId: number, params: Record<string, unknown>, res: ServerResponse): Promise<void> {
    const timeoutSec = typeof params.timeout === 'number' ? params.timeout : 0;
    const offset = typeof params.offset === 'number' ? params.offset : 0;
    if (timeoutSec <= 0 || this.api.hasUpdates(botId, offset)) return;
    const stop = new AbortController();
    const unsubscribe = this.api.onQueue((id) => {
      if (id === botId) stop.abort();
    });
    const onClose = (): void => stop.abort();
    res.on('close', onClose);
    this.waiters.add(stop);
    try {
      await this.clock.sleep(timeoutSec * 1000, stop.signal);
    } catch (cause) {
      if (!stop.signal.aborted) throw cause;
    } finally {
      unsubscribe();
      res.off('close', onClose);
      this.waiters.delete(stop);
    }
  }

  /** Keeps each uploaded file, so `/file/bot<token>/<path>` and the chat page can serve it. */
  private async storeUploads(form: FormData): Promise<Record<string, StoredFile>> {
    const out: Record<string, StoredFile> = {};
    for (const [field, value] of form.entries()) {
      if (typeof value === 'string') continue;
      this.sequence += 1;
      const fileId = `fake-file-${this.sequence}`;
      const ext = /\.[A-Za-z0-9]{1,8}$/.exec(value.name)?.[0] ?? '';
      const path = `${field === 'photo' ? 'photos' : `${field}s`}/file_${this.sequence}${ext}`;
      const stored: StoredFile = { fileId, path, bytes: new Uint8Array(await value.arrayBuffer()), contentType: value.type || 'application/octet-stream', name: value.name };
      this.files.set(fileId, stored);
      this.api.registerFile({ file_id: fileId, file_unique_id: `u-${fileId}`, file_size: value.size, file_path: path });
      out[field] = stored;
    }
    return out;
  }

  private botFile(res: ServerResponse, token: string, path: string): void {
    const bot = this.botOf(token);
    if (!bot) return sendJson(res, 401, { ok: false, error_code: 401, description: 'Unauthorized' });
    this.serveFile(res, [...this.files.values()].find((f) => f.path === path));
  }

  private serveFile(res: ServerResponse, file: StoredFile | undefined): void {
    if (!file) return sendJson(res, 404, { ok: false, error_code: 404, description: 'Not Found: file' });
    res.writeHead(200, { 'content-type': file.contentType, 'content-length': String(file.bytes.byteLength) });
    res.end(file.bytes);
  }

  /** The chat page effect of one Bot API call that succeeded. */
  private apply(bot: Bot, method: string, p: Record<string, unknown>, result: unknown, uploads: Record<string, StoredFile>): void {
    const chatId = Number(p.chat_id);
    const sent = record(result);
    const messageId = typeof sent?.message_id === 'number' ? sent.message_id : Number(p.message_id);
    switch (method) {
      case 'sendMessage':
        this.addEntry(bot.id, chatId, { id: messageId, from: 'bot', text: str(p.text) ?? '', ...(str(p.parse_mode) ? { parseMode: str(p.parse_mode) as string } : {}) }, p.reply_markup);
        break;
      case 'sendPhoto':
      case 'sendDocument':
      case 'sendVideo':
      case 'sendAnimation':
      case 'sendAudio': {
        const field = MEDIA_FIELDS.find((f) => p[f] !== undefined) ?? 'document';
        const media = this.mediaOf(uploads[field], p[field]);
        const entry: Entry = { id: messageId, from: 'bot', ...(str(p.caption) ? { text: str(p.caption) as string } : {}), ...(str(p.parse_mode) ? { parseMode: str(p.parse_mode) as string } : {}) };
        if (method === 'sendPhoto' && media.url) entry.photo = media.url;
        else entry.document = { name: media.name, ...(media.url ? { url: media.url } : {}) };
        this.addEntry(bot.id, chatId, entry, p.reply_markup);
        break;
      }
      case 'sendInvoice':
        this.addEntry(bot.id, chatId, { id: messageId, from: 'bot', invoice: this.invoiceOf(p) }, p.reply_markup);
        break;
      case 'createInvoiceLink':
        if (typeof result === 'string') this.invoiceLinks.set(result, this.invoiceOf(p));
        break;
      case 'editMessageText':
      case 'editMessageCaption':
      case 'editMessageReplyMarkup': {
        const entry = this.chat(bot.id, chatId).entries.find((e) => e.id === Number(p.message_id));
        if (!entry) break;
        if (method === 'editMessageText') entry.text = str(p.text) ?? '';
        if (method === 'editMessageCaption') entry.text = str(p.caption) ?? '';
        if (method === 'editMessageReplyMarkup' || p.reply_markup !== undefined) {
          const rows = record(p.reply_markup)?.inline_keyboard;
          if (Array.isArray(rows)) entry.buttons = rows as InlineKeyboardButton[][];
          else delete entry.buttons;
        }
        this.touch();
        break;
      }
      case 'deleteMessage': {
        const chat = this.chat(bot.id, chatId);
        chat.entries = chat.entries.filter((e) => e.id !== Number(p.message_id));
        this.touch();
        break;
      }
      case 'answerCallbackQuery': {
        const key = this.callbacks.get(String(p.callback_query_id));
        if (key === undefined) break;
        this.callbacks.delete(String(p.callback_query_id));
        const text = str(p.text);
        const chat = this.chats.get(key);
        if (chat && text) chat.notice = text;
        this.touch();
        break;
      }
      case 'answerPreCheckoutQuery':
        this.answerCheckout(String(p.pre_checkout_query_id), p.ok === true, str(p.error_message));
        break;
      case 'setChatMenuButton': {
        const button = record(p.menu_button);
        const webApp = record(button?.web_app);
        const menu = button?.type === 'web_app' && typeof webApp?.url === 'string' ? { text: str(button.text) ?? 'Open', url: webApp.url } : undefined;
        if (p.chat_id === undefined) {
          if (menu) this.botMenus.set(bot.id, menu);
          else this.botMenus.delete(bot.id);
        } else {
          const chat = this.chat(bot.id, chatId);
          if (menu) chat.menuButton = menu;
          else delete chat.menuButton;
        }
        this.touch();
        break;
      }
      default:
        break;
    }
  }

  private mediaOf(upload: StoredFile | undefined, value: unknown): { name: string; url?: string } {
    if (upload) return { name: upload.name, url: `/__tg/files/${upload.fileId}` };
    if (typeof value === 'string' && /^https?:\/\//.test(value)) return { name: value, url: value };
    if (typeof value === 'string' && this.files.has(value)) return { name: (this.files.get(value) as StoredFile).name, url: `/__tg/files/${value}` };
    return { name: typeof value === 'string' ? value : 'file' };
  }

  private invoiceOf(p: Record<string, unknown>): Invoice {
    const prices = Array.isArray(p.prices) ? (p.prices as Array<{ amount?: unknown }>) : [];
    return {
      title: str(p.title) ?? '',
      description: str(p.description) ?? '',
      payload: str(p.payload) ?? '',
      currency: str(p.currency) ?? 'XTR',
      total: prices.reduce((sum, price) => sum + (typeof price.amount === 'number' ? price.amount : 0), 0),
    };
  }

  // Chats.

  private key(botId: number, chatId: number): string {
    return `${botId}:${chatId}`;
  }

  private chat(botId: number, chatId: number): Chat {
    const key = this.key(botId, chatId);
    let chat = this.chats.get(key);
    if (!chat) {
      chat = { entries: [] };
      this.chats.set(key, chat);
    }
    return chat;
  }

  private touch(): void {
    this.version += 1;
  }

  private addEntry(botId: number, chatId: number, entry: Entry, markup: unknown): void {
    const chat = this.chat(botId, chatId);
    const m = record(markup);
    if (Array.isArray(m?.inline_keyboard)) entry.buttons = m.inline_keyboard as InlineKeyboardButton[][];
    if (Array.isArray(m?.keyboard)) chat.replyKeyboard = { rows: m.keyboard as KeyboardButton[][], oneTime: m.one_time_keyboard === true };
    if (m?.remove_keyboard === true) delete chat.replyKeyboard;
    chat.entries.push(entry);
    this.touch();
  }

  private userOf(persona: FakeTelegramPersona): TgUser {
    return { id: persona.telegramId, is_bot: false, first_name: persona.firstName, language_code: 'en' };
  }

  private nowSec(): number {
    return Math.floor(this.clock.now() / 1000);
  }

  private nextUpdateId(): number {
    this.updateId += 1;
    return this.updateId;
  }

  /** Sends an update to the bot's webhook, or keeps it for `getUpdates`. */
  private async deliver(bot: Bot, update: TgUpdate): Promise<void> {
    const set = this.api.webhookOf(bot.id);
    const hook = set ?? (this.opts.webhook ? { url: this.opts.webhook.url.replaceAll('{botId}', String(bot.id)), secretToken: webhookSecret(this.opts.webhook.secret, bot.id) } : undefined);
    if (!hook) {
      this.api.queueUpdates(bot.id, [update]);
      return;
    }
    let response: Response;
    try {
      response = await fetch(hook.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(hook.secretToken ? { 'x-telegram-bot-api-secret-token': hook.secretToken } : {}) },
        body: JSON.stringify(update),
      });
    } catch (cause) {
      throw fakeError('webhook', `The webhook ${hook.url} of bot ${bot.username} does not answer.`, { url: hook.url, botId: bot.id }, cause);
    }
    await response.arrayBuffer();
    if (!response.ok) throw fakeError('webhook', `The webhook ${hook.url} of bot ${bot.username} answered HTTP ${response.status}.`, { url: hook.url, botId: bot.id, status: response.status });
  }

  // The chat page.

  private state(botName: string | null, personaId: string | null): unknown {
    const bot = [...this.bots.values()].find((b) => b.username === botName);
    const persona = personaId === null ? undefined : this.personas.get(personaId);
    const chat = bot && persona ? this.chats.get(this.key(bot.id, persona.telegramId)) : undefined;
    return {
      version: this.version,
      bots: [...this.bots.values()].map((b) => ({ username: b.username })),
      personas: [...this.personas.values()].map((p) => ({ id: p.id, firstName: p.firstName, telegramId: p.telegramId })),
      chat:
        bot && persona
          ? {
              bot: bot.username,
              persona: persona.id,
              messages: (chat?.entries ?? []).map((e) => this.view(e)),
              replyKeyboard: chat?.replyKeyboard ?? null,
              notice: chat?.notice ?? null,
              error: chat?.error ?? null,
              menuButton: chat?.menuButton ?? this.botMenus.get(bot.id) ?? null,
            }
          : null,
    };
  }

  private view(e: Entry): unknown {
    const buttons = e.buttons?.map((row) =>
      row.map((b) => {
        if (b.callback_data !== undefined) return { text: b.text, kind: 'callback', data: b.callback_data };
        if (b.web_app) return { text: b.text, kind: 'web_app', url: b.web_app.url };
        if (b.pay === true || (b.url !== undefined && this.invoiceLinks.has(b.url))) return { text: b.text, kind: 'pay', ...(b.url ? { url: b.url } : {}) };
        if (b.url !== undefined) return { text: b.text, kind: 'url', url: b.url };
        return { text: b.text, kind: 'other' };
      }),
    );
    return { ...e, ...(buttons ? { buttons } : {}) };
  }

  private async pageAction(req: IncomingMessage, res: ServerResponse, action: string): Promise<void> {
    let body: Record<string, unknown>;
    try {
      body = record(JSON.parse((await readBody(req)).toString('utf8'))) ?? {};
    } catch (cause) {
      return sendJson(res, 400, { ok: false, error: `The body is not a JSON object: ${messageOf(cause)}` });
    }
    const bot = [...this.bots.values()].find((b) => b.username === body.bot);
    const persona = typeof body.persona === 'string' ? this.personas.get(body.persona) : undefined;
    if (!bot || !persona) return sendJson(res, 404, { ok: false, error: `No chat of bot ${String(body.bot)} and persona ${String(body.persona)}.` });
    const chat = this.chat(bot.id, persona.telegramId);
    delete chat.error;
    try {
      const result = await this.runAction(action, bot, persona, chat, body);
      sendJson(res, 200, { ok: true, ...result });
    } catch (cause) {
      chat.error = messageOf(cause);
      this.touch();
      const status = cause instanceof LaunchwrightError && cause.code === 'telegram.fake.webhook' ? 502 : 400;
      sendJson(res, status, { ok: false, error: chat.error, code: cause instanceof LaunchwrightError ? cause.code : 'telegram.fake.action' });
    }
  }

  private async runAction(action: string, bot: Bot, persona: FakeTelegramPersona, chat: Chat, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const from = this.userOf(persona);
    const tgChat = { id: persona.telegramId, type: 'private' as const, first_name: persona.firstName };
    if (action === 'send') {
      const text = str(body.text)?.trim();
      if (!text) throw fakeError('action', 'The message is empty.');
      const message: TgMessage = { message_id: this.api.nextMessageId(), date: this.nowSec(), chat: tgChat, from, text };
      const command = /^\/\w+(@\w+)?/.exec(text);
      if (command) message.entities = [{ type: 'bot_command', offset: 0, length: command[0].length }];
      chat.entries.push({ id: message.message_id, from: 'user', text });
      if (chat.replyKeyboard?.oneTime && chat.replyKeyboard.rows.some((row) => row.some((b) => b.text === text))) delete chat.replyKeyboard;
      delete chat.notice;
      this.touch();
      await this.deliver(bot, { update_id: this.nextUpdateId(), message });
      return { messageId: message.message_id };
    }
    if (action === 'callback') {
      const entry = chat.entries.find((e) => e.id === Number(body.messageId));
      const data = str(body.data);
      if (!entry || data === undefined) throw fakeError('action', `Message ${String(body.messageId)} has no button with this data.`);
      this.sequence += 1;
      const id = `fake-cq-${this.sequence}`;
      this.callbacks.set(id, this.key(bot.id, persona.telegramId));
      delete chat.notice;
      this.touch();
      const message: TgMessage = { message_id: entry.id, date: this.nowSec(), chat: tgChat, ...(entry.text !== undefined ? { text: entry.text } : {}) };
      await this.deliver(bot, { update_id: this.nextUpdateId(), callback_query: { id, from, message, chat_instance: String(persona.telegramId), data } });
      return { callbackQueryId: id };
    }
    if (action === 'webapp') {
      const url = str(body.url);
      if (!url || !/^https?:\/\//.test(url)) throw fakeError('action', 'A web_app button needs an http(s) URL.');
      return { url: this.miniAppUrl(bot, persona, url, body.source === 'inline') };
    }
    const link = str(body.link);
    const entry = body.messageId === undefined ? undefined : chat.entries.find((e) => e.id === Number(body.messageId));
    const invoice = entry?.invoice ?? (link ? this.invoiceLinks.get(link) : undefined);
    if (!invoice) throw fakeError('action', 'No invoice to pay: give the message id of an invoice or a link from createInvoiceLink.');
    this.sequence += 1;
    const id = `fake-pcq-${this.sequence}`;
    this.checkouts.set(id, { bot, persona, invoice });
    await this.deliver(bot, { update_id: this.nextUpdateId(), pre_checkout_query: { id, from, currency: invoice.currency, total_amount: invoice.total, invoice_payload: invoice.payload } });
    return { preCheckoutQueryId: id };
  }

  /** The Mini App URL with launch parameters in the hash and `initData` signed with the bot token. */
  private miniAppUrl(bot: Bot, persona: FakeTelegramPersona, url: string, inline: boolean): string {
    this.sequence += 1;
    const fields: Record<string, string> = {
      user: JSON.stringify({ id: persona.telegramId, first_name: persona.firstName, language_code: 'en', allows_write_to_pm: true }),
      auth_date: String(this.nowSec()),
      chat_type: 'sender',
      chat_instance: String(persona.telegramId),
      ...(inline ? { query_id: `fake-q-${this.sequence}` } : {}),
    };
    const target = new URL(url);
    target.hash = new URLSearchParams({
      tgWebAppData: signInitData(fields, bot.token),
      tgWebAppVersion: '8.0',
      tgWebAppPlatform: 'android',
      tgWebAppThemeParams: JSON.stringify(THEME),
    }).toString();
    return target.toString();
  }

  private answerCheckout(id: string, ok: boolean, errorMessage: string | undefined): void {
    const checkout = this.checkouts.get(id);
    if (!checkout) return;
    this.checkouts.delete(id);
    const { bot, persona, invoice } = checkout;
    const chat = this.chat(bot.id, persona.telegramId);
    if (!ok) {
      chat.notice = errorMessage ?? 'The payment was refused.';
      this.touch();
      return;
    }
    invoice.paid = true;
    this.sequence += 1;
    const message: TgMessage = {
      message_id: this.api.nextMessageId(),
      date: this.nowSec(),
      chat: { id: persona.telegramId, type: 'private' },
      from: this.userOf(persona),
      successful_payment: { currency: invoice.currency, total_amount: invoice.total, invoice_payload: invoice.payload, telegram_payment_charge_id: `fake-charge-${this.sequence}`, provider_payment_charge_id: '' },
    };
    chat.entries.push({ id: message.message_id, from: 'service', text: `Paid ${invoice.total} ${invoice.currency === 'XTR' ? 'Stars' : invoice.currency} for ${invoice.title || invoice.payload}` });
    this.touch();
    // The bot is waiting for the answer of answerPreCheckoutQuery, so the payment goes out after it.
    setImmediate(() => {
      this.deliver(bot, { update_id: this.nextUpdateId(), message }).catch((cause: unknown) => {
        chat.error = messageOf(cause);
        this.touch();
      });
    });
  }

  stopWaiting(): void {
    for (const stop of this.waiters) stop.abort();
  }
}

/**
 * Starts the fake Telegram server on loopback (QA spec 2.10). Throws `telegram.fake.production` in
 * the production environment and `telegram.fake.host` for a host that is not loopback.
 */
export async function serveFakeTelegram(opts: FakeTelegramOptions): Promise<FakeTelegram> {
  if (opts.env === 'production') throw fakeError('production', 'The fake Telegram server does not start in the production environment.', { env: opts.env });
  const host = opts.host ?? '127.0.0.1';
  if (!LOOPBACK.has(host)) throw fakeError('host', `The fake Telegram server binds loopback only, not ${host}.`, { host });
  const fake = new FakeTelegramServer(opts);
  // The loopback names of this server. A request for another Host (DNS rebinding) or a page action
  // from another origin, or not sent as JSON (a cross-site form post), is refused.
  const allowedHosts = new Set<string>();
  const server: Server = createServer((req, res) => {
    if (!allowedHosts.has(req.headers.host ?? '')) {
      sendJson(res, 421, { ok: false, error_code: 421, description: 'Misdirected Request: the Host is not this loopback server' });
      return;
    }
    if (req.method === 'POST' && (req.url ?? '').startsWith('/__tg/api/')) {
      const origin = req.headers.origin;
      const json = (req.headers['content-type'] ?? '').split(';')[0]?.trim() === 'application/json';
      if (!json || (origin !== undefined && !allowedHosts.has(origin.replace(/^http:\/\//, '')))) {
        sendJson(res, 403, { ok: false, error_code: 403, description: 'Forbidden: a page action needs a JSON body from this origin' });
        return;
      }
    }
    fake.handle(req, res).catch((cause: unknown) => {
      sendJson(res, 500, { ok: false, error_code: 500, description: `Internal Server Error: ${messageOf(cause)}` });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', (cause) => reject(fakeError('listen', `The fake Telegram server cannot listen on ${host}:${opts.port ?? 0}.`, { host, port: opts.port ?? 0 }, cause)));
    server.listen(opts.port ?? 0, host, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  const origin = `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
  for (const name of [host.includes(':') ? `[${host}]` : host, 'localhost', '127.0.0.1', '[::1]']) allowedHosts.add(`${name}:${port}`);
  return {
    url: origin,
    api: fake.api,
    close: () =>
      new Promise<void>((resolve, reject) => {
        fake.stopWaiting();
        server.close((cause) => (cause ? reject(fakeError('close', 'The fake Telegram server did not close.', {}, cause)) : resolve()));
        server.closeAllConnections();
      }),
  };
}
