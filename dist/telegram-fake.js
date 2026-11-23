import {
  hmacHex,
  safeEqual,
  systemClock
} from "./chunk-WUOHAWEI.js";
import {
  LaunchwrightError,
  messageOf
} from "./chunk-L57WEOVE.js";

// src/telegram-fake/chat-page.mts
var CSS = `
:root { color-scheme: light; --bg: #e6ebee; --panel: #ffffff; --line: #d9dee2; --text: #111111; --hint: #707579; --accent: #3390ec; --mine: #e3fee0; --error: #c0392b; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; height: 100%; }
body { background: var(--bg); color: var(--text); font: 15px/1.4 system-ui, sans-serif; display: flex; }
nav { width: 240px; flex: none; background: var(--panel); border-right: 1px solid var(--line); overflow-y: auto; }
nav h1 { font-size: 16px; margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--line); }
nav ul { list-style: none; margin: 0; padding: 0; }
nav .bot { padding: 8px 16px 4px; color: var(--hint); font-size: 13px; }
nav a { display: block; padding: 8px 16px 8px 24px; color: inherit; text-decoration: none; }
nav a[aria-current="page"] { background: var(--accent); color: #ffffff; }
main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
header { background: var(--panel); border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; gap: 12px; align-items: center; }
header h2 { font-size: 16px; margin: 0; flex: 1; }
#log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 75%; background: var(--panel); border-radius: 12px; padding: 8px 12px; align-self: flex-start; }
.msg.user { align-self: flex-end; background: var(--mine); }
.msg.service { align-self: center; background: transparent; color: var(--hint); font-size: 13px; }
.msg p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.msg img { display: block; max-width: 100%; border-radius: 8px; margin-bottom: 4px; }
.keyboard { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.row { display: flex; gap: 4px; }
.row > * { flex: 1; }
button, .row a { font: inherit; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: #f4f4f5; color: var(--accent); cursor: pointer; text-align: center; text-decoration: none; }
.invoice h3 { margin: 0 0 4px; font-size: 15px; }
#notice, #error { padding: 6px 16px; }
#notice:empty, #error:empty { display: none; }
#notice { background: #fffbe6; }
#error { background: #fdecea; color: var(--error); }
#reply { padding: 6px 16px; background: var(--panel); border-top: 1px solid var(--line); }
#reply:empty { display: none; }
form { display: flex; gap: 8px; padding: 10px 16px; background: var(--panel); border-top: 1px solid var(--line); }
form input { flex: 1; font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }
@media (max-width: 640px) { nav { width: 140px; } .msg { max-width: 92%; } }
`;
var JS = `
(function () {
  var query = new URLSearchParams(location.search);
  var sel = { bot: query.get('bot'), persona: query.get('persona') };
  var shown = '';
  var byId = function (id) { return document.getElementById(id); };

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showError(text) { byId('error').textContent = text || ''; }

  function plain(text, mode) {
    if (mode !== 'HTML') return text;
    return new DOMParser().parseFromString(text, 'text/html').body.textContent || '';
  }

  function act(action, body) {
    var payload = Object.assign({ bot: sel.bot, persona: sel.persona }, body);
    return fetch('/__tg/api/' + action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (answer) {
        showError(answer.ok ? '' : answer.error);
        refresh(true);
        return answer.ok ? answer : null;
      }, function (cause) {
        showError('The fake Telegram server does not answer: ' + cause);
        return null;
      });
  }

  function openApp(url, source) {
    // The window opens at the click, so no popup blocker stops it. The signed URL follows.
    var win = window.open('about:blank', 'lw-tg-miniapp');
    act('webapp', { url: url, source: source }).then(function (answer) {
      if (!answer) { if (win) win.close(); return; }
      byId('app').setAttribute('data-qa-webapp-opened', url);
      if (win) win.location.href = answer.url;
      else showError('The browser blocked the Mini App window.');
    });
  }

  function select(bot, persona) {
    sel = { bot: bot, persona: persona };
    history.replaceState(null, '', '?bot=' + encodeURIComponent(bot) + '&persona=' + encodeURIComponent(persona));
    showError('');
    refresh(true);
  }

  function inlineButton(m, b) {
    if (b.kind === 'url') {
      return el('a', { href: b.url, target: '_blank', rel: 'noopener', 'data-qa-inline-button': b.text, 'data-qa-kind': 'url' }, b.text);
    }
    var button = el('button', { type: 'button', 'data-qa-inline-button': b.text, 'data-qa-kind': b.kind }, b.text);
    button.addEventListener('click', function () {
      if (b.kind === 'callback') act('callback', { messageId: m.id, data: b.data });
      else if (b.kind === 'web_app') openApp(b.url, 'inline');
      else if (b.kind === 'pay') act('pay', { messageId: m.id, link: b.url });
    });
    return button;
  }

  function renderNav(s) {
    var list = byId('chats');
    list.textContent = '';
    s.bots.forEach(function (b) {
      var group = el('li', { 'data-qa-bot': b.username });
      group.appendChild(el('div', { class: 'bot' }, '@' + b.username));
      var chats = el('ul');
      s.personas.forEach(function (p) {
        var current = sel.bot === b.username && sel.persona === p.id;
        var link = el('a', { href: '?bot=' + encodeURIComponent(b.username) + '&persona=' + encodeURIComponent(p.id), 'data-qa-chat': b.username + ':' + p.id, 'aria-current': current ? 'page' : 'false' }, p.firstName + ' (' + p.id + ')');
        link.addEventListener('click', function (event) { event.preventDefault(); select(b.username, p.id); });
        var item = el('li');
        item.appendChild(link);
        chats.appendChild(item);
      });
      group.appendChild(chats);
      list.appendChild(group);
    });
  }

  function renderMessage(m) {
    var who = m.from === 'user' ? 'You' : m.from === 'bot' ? 'Bot' : 'Service';
    var item = el('article', { class: 'msg ' + m.from, 'data-qa-message': String(m.id), 'data-qa-from': m.from, 'aria-label': who });
    if (m.photo) item.appendChild(el('img', { src: m.photo, alt: m.text || 'Photo', 'data-qa-photo': '' }));
    if (m.document) {
      var doc = m.document.url ? el('a', { href: m.document.url, target: '_blank', rel: 'noopener', 'data-qa-document': '' }, m.document.name) : el('span', { 'data-qa-document': '' }, m.document.name);
      item.appendChild(doc);
    }
    if (m.invoice) {
      var invoice = el('div', { class: 'invoice', 'data-qa-invoice': m.invoice.payload });
      invoice.appendChild(el('h3', null, m.invoice.title));
      invoice.appendChild(el('p', null, m.invoice.description));
      if (m.invoice.paid) invoice.appendChild(el('p', { 'data-qa-paid': '' }, 'Paid'));
      else {
        var unit = m.invoice.currency === 'XTR' ? 'Stars' : m.invoice.currency;
        var pay = el('button', { type: 'button', 'data-qa-pay': m.invoice.payload }, 'Pay ' + m.invoice.total + ' ' + unit);
        pay.addEventListener('click', function () { act('pay', { messageId: m.id }); });
        invoice.appendChild(pay);
      }
      item.appendChild(invoice);
    }
    if (m.text !== undefined) item.appendChild(el('p', { 'data-qa-text': '' }, plain(m.text, m.parseMode)));
    if (m.buttons && !(m.invoice && m.invoice.paid)) {
      var keyboard = el('div', { class: 'keyboard', role: 'group', 'aria-label': 'Inline keyboard', 'data-qa-inline-keyboard': '' });
      m.buttons.forEach(function (row) {
        var line = el('div', { class: 'row' });
        row.forEach(function (b) { line.appendChild(inlineButton(m, b)); });
        keyboard.appendChild(line);
      });
      item.appendChild(keyboard);
    }
    return item;
  }

  function renderReply(keyboard) {
    var reply = byId('reply');
    reply.textContent = '';
    if (!keyboard) return;
    var group = el('div', { class: 'keyboard', role: 'group', 'aria-label': 'Reply keyboard', 'data-qa-reply-keyboard': '' });
    keyboard.rows.forEach(function (row) {
      var line = el('div', { class: 'row' });
      row.forEach(function (b) {
        var button = el('button', { type: 'button', 'data-qa-reply-button': b.text, 'data-qa-kind': b.web_app ? 'web_app' : 'text' }, b.text);
        button.addEventListener('click', function () {
          if (b.web_app) openApp(b.web_app.url, 'keyboard');
          else act('send', { text: b.text });
        });
        line.appendChild(button);
      });
      group.appendChild(line);
    });
    reply.appendChild(group);
  }

  function render(s) {
    if (!sel.bot && s.bots.length > 0 && s.personas.length > 0) {
      select(s.bots[0].username, s.personas[0].id);
      return;
    }
    renderNav(s);
    var chat = s.chat;
    var log = byId('log');
    log.textContent = '';
    byId('title').textContent = chat ? '@' + chat.bot + ' with ' + chat.persona : 'Pick a chat';
    byId('composer').hidden = !chat;
    var menu = byId('menu');
    menu.hidden = !(chat && chat.menuButton);
    if (chat && chat.menuButton) {
      menu.textContent = chat.menuButton.text;
      menu.setAttribute('data-qa-url', chat.menuButton.url);
    }
    byId('notice').textContent = chat && chat.notice ? chat.notice : '';
    if (chat && chat.error) showError(chat.error);
    renderReply(chat && chat.replyKeyboard);
    if (chat) chat.messages.forEach(function (m) { log.appendChild(renderMessage(m)); });
    log.scrollTop = log.scrollHeight;
    document.body.setAttribute('data-qa-version', String(s.version));
  }

  function refresh(force) {
    var qs = sel.bot ? '?bot=' + encodeURIComponent(sel.bot) + '&persona=' + encodeURIComponent(sel.persona || '') : '';
    return fetch('/__tg/api/state' + qs)
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var key = s.version + '|' + sel.bot + '|' + sel.persona;
        if (force || key !== shown) { shown = key; render(s); }
      }, function (cause) { showError('The fake Telegram server does not answer: ' + cause); });
  }

  byId('menu').addEventListener('click', function () { openApp(byId('menu').getAttribute('data-qa-url'), 'menu'); });
  byId('composer').addEventListener('submit', function (event) {
    event.preventDefault();
    var input = byId('input');
    var text = input.value;
    if (!text.trim()) return;
    input.value = '';
    act('send', { text: text });
  });
  refresh(true);
  setInterval(function () { refresh(false); }, 300);
})();
`;
function chatPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fake Telegram</title>
<style>${CSS}</style>
</head>
<body>
<nav aria-label="Chats"><h1>Fake Telegram</h1><ul id="chats"></ul></nav>
<main id="app">
<header><h2 id="title">Pick a chat</h2><button type="button" id="menu" data-qa-menu-button hidden></button></header>
<div id="log" role="log" aria-label="Messages" data-qa-log></div>
<div id="notice" role="status" data-qa-notice></div>
<div id="error" role="alert" data-qa-error></div>
<div id="reply"></div>
<form id="composer" data-qa-composer hidden><input id="input" aria-label="Message" placeholder="Message or /command" autocomplete="off" data-qa-input><button type="submit" data-qa-send>Send</button></form>
</main>
<script>${JS}</script>
</body>
</html>
`;
}

// src/telegram-fake/fake-bot-api.mts
var FAKE_API_URL = "https://bot-api.test";
async function readParams(init) {
  const body = init?.body;
  if (body === void 0 || body === null) return {};
  if (typeof body === "string") return JSON.parse(body);
  if (body instanceof FormData) {
    const out = {};
    for (const [key, value] of body.entries()) {
      if (typeof value === "string") {
        try {
          out[key] = JSON.parse(value);
        } catch {
          out[key] = value;
        }
      } else out[key] = { filename: value.name, size: value.size, type: value.type };
    }
    return out;
  }
  throw new TypeError("The fake Bot API reads JSON and multipart bodies only.");
}
var FakeBotApi = class {
  constructor(apiUrl = FAKE_API_URL) {
    this.apiUrl = apiUrl;
  }
  apiUrl;
  calls = [];
  answers = /* @__PURE__ */ new Map();
  failures = [];
  updates = /* @__PURE__ */ new Map();
  webhooks = /* @__PURE__ */ new Map();
  profiles = /* @__PURE__ */ new Map();
  queueListeners = /* @__PURE__ */ new Set();
  files = /* @__PURE__ */ new Map();
  messageId = 1e3;
  /** The time source of `RecordedCall.at`. */
  now;
  on(method, answer) {
    this.answers.set(method, answer);
    return this;
  }
  /** The next `times` calls of `method` (that `match`) fail with `failure`. */
  fail(method, failure, opts = {}) {
    this.failures.push({ method, failure, times: opts.times ?? 1, ...opts.match ? { match: opts.match } : {} });
    return this;
  }
  /** Queues updates for `getUpdates` of a bot. */
  queueUpdates(botId, updates) {
    this.updates.set(botId, [...this.updates.get(botId) ?? [], ...updates]);
    for (const listener of this.queueListeners) listener(botId);
    return this;
  }
  /** True when `getUpdates` of the bot with this offset has an update to return. */
  hasUpdates(botId, offset = 0) {
    return (this.updates.get(botId) ?? []).some((u) => u.update_id >= offset);
  }
  /** Calls `listener` with the bot id after each `queueUpdates`. Returns the function that removes it. */
  onQueue(listener) {
    this.queueListeners.add(listener);
    return () => this.queueListeners.delete(listener);
  }
  /** The names that `getMe` answers for a bot. */
  describeBot(botId, profile) {
    this.profiles.set(botId, profile);
    return this;
  }
  /** The webhook of a bot after `setWebhook`, or undefined after `deleteWebhook`. */
  webhookOf(botId) {
    return this.webhooks.get(botId);
  }
  /** A file that `getFile` answers for its `file_id`. */
  registerFile(file) {
    this.files.set(file.file_id, file);
    return this;
  }
  /** The next message id. The bot messages and the messages of a fake user share one sequence. */
  nextMessageId() {
    this.messageId += 1;
    return this.messageId;
  }
  callsOf(method) {
    return this.calls.filter((c) => c.method === method).map((c) => c.params);
  }
  reset() {
    this.calls.length = 0;
    this.answers.clear();
    this.failures.length = 0;
    this.updates.clear();
    this.webhooks.clear();
  }
  message(p) {
    return { message_id: this.nextMessageId(), date: 17e8, chat: { id: p.chat_id, type: Number(p.chat_id) < 0 ? "supergroup" : "private" }, ...p.text ? { text: p.text } : {} };
  }
  defaultAnswer(call) {
    const p = call.params;
    switch (call.method) {
      case "getMe": {
        const profile = this.profiles.get(call.botId);
        return { id: call.botId, is_bot: true, first_name: profile?.firstName ?? `Bot ${call.botId}`, username: profile?.username ?? `bot${call.botId}_bot`, can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false };
      }
      case "sendMessage":
      case "sendPhoto":
      case "sendVideo":
      case "sendAnimation":
      case "sendDocument":
      case "sendAudio":
      case "sendInvoice":
        return this.message(p);
      case "copyMessage":
        return { message_id: this.nextMessageId() };
      case "editMessageText":
        return { message_id: p.message_id, date: 17e8, chat: { id: p.chat_id, type: "private" }, text: p.text };
      case "editMessageReplyMarkup":
      case "editMessageCaption":
        return p.inline_message_id === void 0 ? { message_id: p.message_id, date: 17e8, chat: { id: p.chat_id, type: "private" } } : true;
      case "setWebhook":
        this.webhooks.set(call.botId, { url: String(p.url), ...typeof p.secret_token === "string" ? { secretToken: p.secret_token } : {} });
        if (p.drop_pending_updates === true) this.updates.delete(call.botId);
        return true;
      case "deleteWebhook":
        this.webhooks.delete(call.botId);
        if (p.drop_pending_updates === true) this.updates.delete(call.botId);
        return true;
      case "getFile":
        return this.files.get(String(p.file_id)) ?? true;
      case "getWebhookInfo":
        return { url: this.webhooks.get(call.botId)?.url ?? "", has_custom_certificate: false, pending_update_count: 0 };
      case "getMyCommands":
        return [];
      case "getUpdates": {
        const queued = this.updates.get(call.botId) ?? [];
        const offset = typeof p.offset === "number" ? p.offset : 0;
        const pending = queued.filter((u) => u.update_id >= offset);
        this.updates.set(call.botId, pending);
        return pending.slice(0, typeof p.limit === "number" ? p.limit : 100);
      }
      case "getManagedBotToken":
        return `${p.user_id}:MANAGED-${p.user_id}-token-abcdefghijklmnop`;
      case "createInvoiceLink":
        return `https://t.me/$invoice-${String(p.payload)}`;
      case "getStarTransactions":
        return { transactions: [] };
      default:
        return true;
    }
  }
  /** The `fetch` to pass as `BotApiOptions.fetch`. */
  fetch = async (input, init) => {
    const url = new URL(input);
    const m = /^\/bot(\d+):[^/]+\/(\w+)$/.exec(url.pathname);
    if (!m) return Response.json({ ok: false, error_code: 404, description: "Not Found" }, { status: 404 });
    const call = { botId: Number(m[1]), method: m[2], params: await readParams(init), ...this.now ? { at: this.now() } : {} };
    this.calls.push(call);
    const rule = this.failures.find((f) => f.method === call.method && f.times > 0 && (!f.match || f.match(call.params)));
    if (rule) {
      rule.times -= 1;
      if (rule.failure === "network") throw new TypeError("fetch failed");
      if (rule.failure === "not_connected") throw new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
      if (rule.failure === "reset") throw new TypeError("fetch failed", { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
      return Response.json({ ok: false, ...rule.failure }, { status: rule.failure.error_code });
    }
    const answer = this.answers.get(call.method);
    const result = answer === void 0 ? this.defaultAnswer(call) : typeof answer === "function" ? answer(call.params, call) : answer;
    return Response.json({ ok: true, result });
  };
};

// src/telegram-fake/fake-server.mts
import { createServer } from "http";

// src/telegram-fake/protocol.mts
import { createHmac as createHmac2 } from "crypto";

// src/kernel/services/init-data.mts
import { createHmac } from "crypto";
function initDataCheckString(params, skip = ["hash"]) {
  return [...params.entries()].filter(([k]) => !skip.includes(k)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("\n");
}

// src/telegram-fake/protocol.mts
function botIdOfToken(token) {
  const at = token.indexOf(":");
  const id2 = Number(token.slice(0, at));
  if (at <= 0 || !Number.isSafeInteger(id2) || id2 <= 0 || token.length - at < 2) {
    throw new LaunchwrightError("telegram.token.invalid", "A bot token has the form <bot id>:<secret>.", { context: { key: "token" } });
  }
  return id2;
}
function webhookSecret(master, botId) {
  if (master.length < 32) throw new LaunchwrightError("telegram.webhook.secret", "The webhook master secret must be at least 32 characters.", { context: { key: "webhook.secret" } });
  return createHmac2("sha256", master).update(String(botId)).digest("hex");
}
function signInitData(fields, botToken) {
  const params = new URLSearchParams(fields);
  const secret = createHmac2("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", hmacHex(secret, initDataCheckString(params)));
  return params.toString();
}

// src/telegram-fake/fake-server.mts
var LOOPBACK = /* @__PURE__ */ new Set(["127.0.0.1", "::1", "localhost"]);
var BODY_LIMIT = 20 * 1024 * 1024;
var MEDIA_FIELDS = ["photo", "document", "video", "animation", "audio"];
var THEME = { bg_color: "#ffffff", text_color: "#000000", hint_color: "#707579", link_color: "#3390ec", button_color: "#3390ec", button_text_color: "#ffffff", secondary_bg_color: "#f4f4f5" };
function fakeError(code, message, context = {}, cause) {
  return new LaunchwrightError(`telegram.fake.${code}`, message, { context, ...cause === void 0 ? {} : { cause } });
}
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function str(value) {
  return typeof value === "string" ? value : void 0;
}
function sendJson(res, status, body) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw fakeError("body", `The request body is larger than ${BODY_LIMIT} bytes.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function botApiInit(req, url) {
  const raw = await readBody(req);
  const type = (req.headers["content-type"] ?? "").toLowerCase();
  if (raw.length === 0) {
    if ([...url.searchParams.keys()].length === 0) return { method: "POST" };
    const form = new FormData();
    for (const [k, v] of url.searchParams) form.append(k, v);
    return { method: "POST", body: form };
  }
  if (type.startsWith("multipart/form-data") || type.startsWith("application/x-www-form-urlencoded")) {
    const body = await new Request(url, { method: "POST", headers: { "content-type": type }, body: new Uint8Array(raw) }).formData();
    return { method: "POST", body };
  }
  return { method: "POST", body: raw.toString("utf8") };
}
var FakeTelegramServer = class {
  constructor(opts) {
    this.opts = opts;
    this.clock = opts.clock ?? systemClock;
    for (const b of opts.bots) {
      if (!b.username) throw fakeError("config", "Each fake bot needs a username.");
      const id2 = botIdOfToken(b.token);
      if (this.bots.has(id2)) throw fakeError("config", `Two fake bots have the bot id ${id2}.`, { botId: id2 });
      this.bots.set(id2, { id: id2, username: b.username, token: b.token });
      this.api.describeBot(id2, { username: b.username, firstName: b.username });
    }
    for (const p of opts.personas) {
      if (!Number.isSafeInteger(p.telegramId) || p.telegramId <= 0) throw fakeError("config", `Persona ${p.id} needs a positive telegramId.`, { persona: p.id });
      if (this.personas.has(p.id)) throw fakeError("config", `Two personas have the id ${p.id}.`, { persona: p.id });
      this.personas.set(p.id, p);
    }
  }
  opts;
  api = new FakeBotApi();
  bots = /* @__PURE__ */ new Map();
  personas = /* @__PURE__ */ new Map();
  chats = /* @__PURE__ */ new Map();
  files = /* @__PURE__ */ new Map();
  invoiceLinks = /* @__PURE__ */ new Map();
  callbacks = /* @__PURE__ */ new Map();
  checkouts = /* @__PURE__ */ new Map();
  botMenus = /* @__PURE__ */ new Map();
  waiters = /* @__PURE__ */ new Set();
  clock;
  version = 0;
  sequence = 0;
  updateId = 0;
  async handle(req, res) {
    const url = new URL(req.url ?? "/", "http://fake-telegram.invalid");
    const path = url.pathname;
    const botCall = /^\/bot([^/]+)\/(\w+)$/.exec(path);
    if (botCall) return this.botApi(req, res, url, botCall[1], botCall[2]);
    const fileGet = /^\/file\/bot([^/]+)\/(.+)$/.exec(path);
    if (fileGet && req.method === "GET") return this.botFile(res, fileGet[1], fileGet[2]);
    if (path === "/__tg" && req.method === "GET") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(chatPageHtml());
      return;
    }
    const pageFile = /^\/__tg\/files\/([\w-]+)$/.exec(path);
    if (pageFile && req.method === "GET") return this.serveFile(res, this.files.get(pageFile[1]));
    if (path === "/__tg/api/state" && req.method === "GET") return sendJson(res, 200, this.state(url.searchParams.get("bot"), url.searchParams.get("persona")));
    const action = /^\/__tg\/api\/(send|callback|webapp|pay)$/.exec(path);
    if (action && req.method === "POST") return this.pageAction(req, res, action[1]);
    sendJson(res, 404, { ok: false, error_code: 404, description: "Not Found" });
  }
  // The Bot API.
  botOf(token) {
    const at = token.indexOf(":");
    const bot = this.bots.get(Number(token.slice(0, at)));
    return bot && safeEqual(bot.token, token) ? bot : void 0;
  }
  async botApi(req, res, url, token, method) {
    const bot = this.botOf(token);
    if (!bot) return sendJson(res, 401, { ok: false, error_code: 401, description: "Unauthorized" });
    const init = await botApiInit(req, url);
    let params;
    try {
      params = await readParams(init);
    } catch (cause) {
      return sendJson(res, 400, { ok: false, error_code: 400, description: `Bad Request: ${messageOf(cause)}` });
    }
    const uploads = init.body instanceof FormData ? await this.storeUploads(init.body) : {};
    if (method === "getUpdates") await this.waitForUpdates(bot.id, params, res);
    if (res.destroyed) return;
    let response;
    try {
      response = await this.api.fetch(`${this.api.apiUrl}/bot${token}/${method}`, init);
    } catch (cause) {
      if (cause instanceof TypeError) {
        res.destroy();
        return;
      }
      throw cause;
    }
    const answer = await response.json();
    if (answer.ok) this.apply(bot, method, params, answer.result, uploads);
    sendJson(res, response.status, answer);
  }
  /** Waits for an update when `getUpdates` has a `timeout` and nothing is queued: the long poll. */
  async waitForUpdates(botId, params, res) {
    const timeoutSec = typeof params.timeout === "number" ? params.timeout : 0;
    const offset = typeof params.offset === "number" ? params.offset : 0;
    if (timeoutSec <= 0 || this.api.hasUpdates(botId, offset)) return;
    const stop = new AbortController();
    const unsubscribe = this.api.onQueue((id2) => {
      if (id2 === botId) stop.abort();
    });
    const onClose = () => stop.abort();
    res.on("close", onClose);
    this.waiters.add(stop);
    try {
      await this.clock.sleep(timeoutSec * 1e3, stop.signal);
    } catch (cause) {
      if (!stop.signal.aborted) throw cause;
    } finally {
      unsubscribe();
      res.off("close", onClose);
      this.waiters.delete(stop);
    }
  }
  /** Keeps each uploaded file, so `/file/bot<token>/<path>` and the chat page can serve it. */
  async storeUploads(form) {
    const out = {};
    for (const [field, value] of form.entries()) {
      if (typeof value === "string") continue;
      this.sequence += 1;
      const fileId = `fake-file-${this.sequence}`;
      const ext = /\.[A-Za-z0-9]{1,8}$/.exec(value.name)?.[0] ?? "";
      const path = `${field === "photo" ? "photos" : `${field}s`}/file_${this.sequence}${ext}`;
      const stored = { fileId, path, bytes: new Uint8Array(await value.arrayBuffer()), contentType: value.type || "application/octet-stream", name: value.name };
      this.files.set(fileId, stored);
      this.api.registerFile({ file_id: fileId, file_unique_id: `u-${fileId}`, file_size: value.size, file_path: path });
      out[field] = stored;
    }
    return out;
  }
  botFile(res, token, path) {
    const bot = this.botOf(token);
    if (!bot) return sendJson(res, 401, { ok: false, error_code: 401, description: "Unauthorized" });
    this.serveFile(res, [...this.files.values()].find((f) => f.path === path));
  }
  serveFile(res, file) {
    if (!file) return sendJson(res, 404, { ok: false, error_code: 404, description: "Not Found: file" });
    res.writeHead(200, { "content-type": file.contentType, "content-length": String(file.bytes.byteLength) });
    res.end(file.bytes);
  }
  /** The chat page effect of one Bot API call that succeeded. */
  apply(bot, method, p, result, uploads) {
    const chatId = Number(p.chat_id);
    const sent = record(result);
    const messageId = typeof sent?.message_id === "number" ? sent.message_id : Number(p.message_id);
    switch (method) {
      case "sendMessage":
        this.addEntry(bot.id, chatId, { id: messageId, from: "bot", text: str(p.text) ?? "", ...str(p.parse_mode) ? { parseMode: str(p.parse_mode) } : {} }, p.reply_markup);
        break;
      case "sendPhoto":
      case "sendDocument":
      case "sendVideo":
      case "sendAnimation":
      case "sendAudio": {
        const field = MEDIA_FIELDS.find((f) => p[f] !== void 0) ?? "document";
        const media = this.mediaOf(uploads[field], p[field]);
        const entry = { id: messageId, from: "bot", ...str(p.caption) ? { text: str(p.caption) } : {}, ...str(p.parse_mode) ? { parseMode: str(p.parse_mode) } : {} };
        if (method === "sendPhoto" && media.url) entry.photo = media.url;
        else entry.document = { name: media.name, ...media.url ? { url: media.url } : {} };
        this.addEntry(bot.id, chatId, entry, p.reply_markup);
        break;
      }
      case "sendInvoice":
        this.addEntry(bot.id, chatId, { id: messageId, from: "bot", invoice: this.invoiceOf(p) }, p.reply_markup);
        break;
      case "createInvoiceLink":
        if (typeof result === "string") this.invoiceLinks.set(result, this.invoiceOf(p));
        break;
      case "editMessageText":
      case "editMessageCaption":
      case "editMessageReplyMarkup": {
        const entry = this.chat(bot.id, chatId).entries.find((e) => e.id === Number(p.message_id));
        if (!entry) break;
        if (method === "editMessageText") entry.text = str(p.text) ?? "";
        if (method === "editMessageCaption") entry.text = str(p.caption) ?? "";
        if (method === "editMessageReplyMarkup" || p.reply_markup !== void 0) {
          const rows = record(p.reply_markup)?.inline_keyboard;
          if (Array.isArray(rows)) entry.buttons = rows;
          else delete entry.buttons;
        }
        this.touch();
        break;
      }
      case "deleteMessage": {
        const chat = this.chat(bot.id, chatId);
        chat.entries = chat.entries.filter((e) => e.id !== Number(p.message_id));
        this.touch();
        break;
      }
      case "answerCallbackQuery": {
        const key = this.callbacks.get(String(p.callback_query_id));
        if (key === void 0) break;
        this.callbacks.delete(String(p.callback_query_id));
        const text = str(p.text);
        const chat = this.chats.get(key);
        if (chat && text) chat.notice = text;
        this.touch();
        break;
      }
      case "answerPreCheckoutQuery":
        this.answerCheckout(String(p.pre_checkout_query_id), p.ok === true, str(p.error_message));
        break;
      case "setChatMenuButton": {
        const button = record(p.menu_button);
        const webApp = record(button?.web_app);
        const menu = button?.type === "web_app" && typeof webApp?.url === "string" ? { text: str(button.text) ?? "Open", url: webApp.url } : void 0;
        if (p.chat_id === void 0) {
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
  mediaOf(upload, value) {
    if (upload) return { name: upload.name, url: `/__tg/files/${upload.fileId}` };
    if (typeof value === "string" && /^https?:\/\//.test(value)) return { name: value, url: value };
    if (typeof value === "string" && this.files.has(value)) return { name: this.files.get(value).name, url: `/__tg/files/${value}` };
    return { name: typeof value === "string" ? value : "file" };
  }
  invoiceOf(p) {
    const prices = Array.isArray(p.prices) ? p.prices : [];
    return {
      title: str(p.title) ?? "",
      description: str(p.description) ?? "",
      payload: str(p.payload) ?? "",
      currency: str(p.currency) ?? "XTR",
      total: prices.reduce((sum, price) => sum + (typeof price.amount === "number" ? price.amount : 0), 0)
    };
  }
  // Chats.
  key(botId, chatId) {
    return `${botId}:${chatId}`;
  }
  chat(botId, chatId) {
    const key = this.key(botId, chatId);
    let chat = this.chats.get(key);
    if (!chat) {
      chat = { entries: [] };
      this.chats.set(key, chat);
    }
    return chat;
  }
  touch() {
    this.version += 1;
  }
  addEntry(botId, chatId, entry, markup) {
    const chat = this.chat(botId, chatId);
    const m = record(markup);
    if (Array.isArray(m?.inline_keyboard)) entry.buttons = m.inline_keyboard;
    if (Array.isArray(m?.keyboard)) chat.replyKeyboard = { rows: m.keyboard, oneTime: m.one_time_keyboard === true };
    if (m?.remove_keyboard === true) delete chat.replyKeyboard;
    chat.entries.push(entry);
    this.touch();
  }
  userOf(persona) {
    return { id: persona.telegramId, is_bot: false, first_name: persona.firstName, language_code: "en" };
  }
  nowSec() {
    return Math.floor(this.clock.now() / 1e3);
  }
  nextUpdateId() {
    this.updateId += 1;
    return this.updateId;
  }
  /** Sends an update to the bot's webhook, or keeps it for `getUpdates`. */
  async deliver(bot, update) {
    const set = this.api.webhookOf(bot.id);
    const hook = set ?? (this.opts.webhook ? { url: this.opts.webhook.url.replaceAll("{botId}", String(bot.id)), secretToken: webhookSecret(this.opts.webhook.secret, bot.id) } : void 0);
    if (!hook) {
      this.api.queueUpdates(bot.id, [update]);
      return;
    }
    let response;
    try {
      response = await fetch(hook.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...hook.secretToken ? { "x-telegram-bot-api-secret-token": hook.secretToken } : {} },
        body: JSON.stringify(update)
      });
    } catch (cause) {
      throw fakeError("webhook", `The webhook ${hook.url} of bot ${bot.username} does not answer.`, { url: hook.url, botId: bot.id }, cause);
    }
    await response.arrayBuffer();
    if (!response.ok) throw fakeError("webhook", `The webhook ${hook.url} of bot ${bot.username} answered HTTP ${response.status}.`, { url: hook.url, botId: bot.id, status: response.status });
  }
  // The chat page.
  state(botName, personaId) {
    const bot = [...this.bots.values()].find((b) => b.username === botName);
    const persona = personaId === null ? void 0 : this.personas.get(personaId);
    const chat = bot && persona ? this.chats.get(this.key(bot.id, persona.telegramId)) : void 0;
    return {
      version: this.version,
      bots: [...this.bots.values()].map((b) => ({ username: b.username })),
      personas: [...this.personas.values()].map((p) => ({ id: p.id, firstName: p.firstName, telegramId: p.telegramId })),
      chat: bot && persona ? {
        bot: bot.username,
        persona: persona.id,
        messages: (chat?.entries ?? []).map((e) => this.view(e)),
        replyKeyboard: chat?.replyKeyboard ?? null,
        notice: chat?.notice ?? null,
        error: chat?.error ?? null,
        menuButton: chat?.menuButton ?? this.botMenus.get(bot.id) ?? null
      } : null
    };
  }
  view(e) {
    const buttons = e.buttons?.map(
      (row) => row.map((b) => {
        if (b.callback_data !== void 0) return { text: b.text, kind: "callback", data: b.callback_data };
        if (b.web_app) return { text: b.text, kind: "web_app", url: b.web_app.url };
        if (b.pay === true || b.url !== void 0 && this.invoiceLinks.has(b.url)) return { text: b.text, kind: "pay", ...b.url ? { url: b.url } : {} };
        if (b.url !== void 0) return { text: b.text, kind: "url", url: b.url };
        return { text: b.text, kind: "other" };
      })
    );
    return { ...e, ...buttons ? { buttons } : {} };
  }
  async pageAction(req, res, action) {
    let body;
    try {
      body = record(JSON.parse((await readBody(req)).toString("utf8"))) ?? {};
    } catch (cause) {
      return sendJson(res, 400, { ok: false, error: `The body is not a JSON object: ${messageOf(cause)}` });
    }
    const bot = [...this.bots.values()].find((b) => b.username === body.bot);
    const persona = typeof body.persona === "string" ? this.personas.get(body.persona) : void 0;
    if (!bot || !persona) return sendJson(res, 404, { ok: false, error: `No chat of bot ${String(body.bot)} and persona ${String(body.persona)}.` });
    const chat = this.chat(bot.id, persona.telegramId);
    delete chat.error;
    try {
      const result = await this.runAction(action, bot, persona, chat, body);
      sendJson(res, 200, { ok: true, ...result });
    } catch (cause) {
      chat.error = messageOf(cause);
      this.touch();
      const status = cause instanceof LaunchwrightError && cause.code === "telegram.fake.webhook" ? 502 : 400;
      sendJson(res, status, { ok: false, error: chat.error, code: cause instanceof LaunchwrightError ? cause.code : "telegram.fake.action" });
    }
  }
  async runAction(action, bot, persona, chat, body) {
    const from = this.userOf(persona);
    const tgChat = { id: persona.telegramId, type: "private", first_name: persona.firstName };
    if (action === "send") {
      const text = str(body.text)?.trim();
      if (!text) throw fakeError("action", "The message is empty.");
      const message = { message_id: this.api.nextMessageId(), date: this.nowSec(), chat: tgChat, from, text };
      const command = /^\/\w+(@\w+)?/.exec(text);
      if (command) message.entities = [{ type: "bot_command", offset: 0, length: command[0].length }];
      chat.entries.push({ id: message.message_id, from: "user", text });
      if (chat.replyKeyboard?.oneTime && chat.replyKeyboard.rows.some((row) => row.some((b) => b.text === text))) delete chat.replyKeyboard;
      delete chat.notice;
      this.touch();
      await this.deliver(bot, { update_id: this.nextUpdateId(), message });
      return { messageId: message.message_id };
    }
    if (action === "callback") {
      const entry2 = chat.entries.find((e) => e.id === Number(body.messageId));
      const data = str(body.data);
      if (!entry2 || data === void 0) throw fakeError("action", `Message ${String(body.messageId)} has no button with this data.`);
      this.sequence += 1;
      const id3 = `fake-cq-${this.sequence}`;
      this.callbacks.set(id3, this.key(bot.id, persona.telegramId));
      delete chat.notice;
      this.touch();
      const message = { message_id: entry2.id, date: this.nowSec(), chat: tgChat, ...entry2.text !== void 0 ? { text: entry2.text } : {} };
      await this.deliver(bot, { update_id: this.nextUpdateId(), callback_query: { id: id3, from, message, chat_instance: String(persona.telegramId), data } });
      return { callbackQueryId: id3 };
    }
    if (action === "webapp") {
      const url = str(body.url);
      if (!url || !/^https?:\/\//.test(url)) throw fakeError("action", "A web_app button needs an http(s) URL.");
      return { url: this.miniAppUrl(bot, persona, url, body.source === "inline") };
    }
    const link = str(body.link);
    const entry = body.messageId === void 0 ? void 0 : chat.entries.find((e) => e.id === Number(body.messageId));
    const invoice = entry?.invoice ?? (link ? this.invoiceLinks.get(link) : void 0);
    if (!invoice) throw fakeError("action", "No invoice to pay: give the message id of an invoice or a link from createInvoiceLink.");
    this.sequence += 1;
    const id2 = `fake-pcq-${this.sequence}`;
    this.checkouts.set(id2, { bot, persona, invoice });
    await this.deliver(bot, { update_id: this.nextUpdateId(), pre_checkout_query: { id: id2, from, currency: invoice.currency, total_amount: invoice.total, invoice_payload: invoice.payload } });
    return { preCheckoutQueryId: id2 };
  }
  /** The Mini App URL with launch parameters in the hash and `initData` signed with the bot token. */
  miniAppUrl(bot, persona, url, inline) {
    this.sequence += 1;
    const fields = {
      user: JSON.stringify({ id: persona.telegramId, first_name: persona.firstName, language_code: "en", allows_write_to_pm: true }),
      auth_date: String(this.nowSec()),
      chat_type: "sender",
      chat_instance: String(persona.telegramId),
      ...inline ? { query_id: `fake-q-${this.sequence}` } : {}
    };
    const target = new URL(url);
    target.hash = new URLSearchParams({
      tgWebAppData: signInitData(fields, bot.token),
      tgWebAppVersion: "8.0",
      tgWebAppPlatform: "android",
      tgWebAppThemeParams: JSON.stringify(THEME)
    }).toString();
    return target.toString();
  }
  answerCheckout(id2, ok, errorMessage) {
    const checkout = this.checkouts.get(id2);
    if (!checkout) return;
    this.checkouts.delete(id2);
    const { bot, persona, invoice } = checkout;
    const chat = this.chat(bot.id, persona.telegramId);
    if (!ok) {
      chat.notice = errorMessage ?? "The payment was refused.";
      this.touch();
      return;
    }
    invoice.paid = true;
    this.sequence += 1;
    const message = {
      message_id: this.api.nextMessageId(),
      date: this.nowSec(),
      chat: { id: persona.telegramId, type: "private" },
      from: this.userOf(persona),
      successful_payment: { currency: invoice.currency, total_amount: invoice.total, invoice_payload: invoice.payload, telegram_payment_charge_id: `fake-charge-${this.sequence}`, provider_payment_charge_id: "" }
    };
    chat.entries.push({ id: message.message_id, from: "service", text: `Paid ${invoice.total} ${invoice.currency === "XTR" ? "Stars" : invoice.currency} for ${invoice.title || invoice.payload}` });
    this.touch();
    setImmediate(() => {
      this.deliver(bot, { update_id: this.nextUpdateId(), message }).catch((cause) => {
        chat.error = messageOf(cause);
        this.touch();
      });
    });
  }
  stopWaiting() {
    for (const stop of this.waiters) stop.abort();
  }
};
async function serveFakeTelegram(opts) {
  if (opts.env === "production") throw fakeError("production", "The fake Telegram server does not start in the production environment.", { env: opts.env });
  const host = opts.host ?? "127.0.0.1";
  if (!LOOPBACK.has(host)) throw fakeError("host", `The fake Telegram server binds loopback only, not ${host}.`, { host });
  const fake = new FakeTelegramServer(opts);
  const allowedHosts = /* @__PURE__ */ new Set();
  const server = createServer((req, res) => {
    if (!allowedHosts.has(req.headers.host ?? "")) {
      sendJson(res, 421, { ok: false, error_code: 421, description: "Misdirected Request: the Host is not this loopback server" });
      return;
    }
    if (req.method === "POST" && (req.url ?? "").startsWith("/__tg/api/")) {
      const origin2 = req.headers.origin;
      const json = (req.headers["content-type"] ?? "").split(";")[0]?.trim() === "application/json";
      if (!json || origin2 !== void 0 && !allowedHosts.has(origin2.replace(/^http:\/\//, ""))) {
        sendJson(res, 403, { ok: false, error_code: 403, description: "Forbidden: a page action needs a JSON body from this origin" });
        return;
      }
    }
    fake.handle(req, res).catch((cause) => {
      sendJson(res, 500, { ok: false, error_code: 500, description: `Internal Server Error: ${messageOf(cause)}` });
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", (cause) => reject(fakeError("listen", `The fake Telegram server cannot listen on ${host}:${opts.port ?? 0}.`, { host, port: opts.port ?? 0 }, cause)));
    server.listen(opts.port ?? 0, host, () => resolve());
  });
  const { port } = server.address();
  const origin = `http://${host.includes(":") ? `[${host}]` : host}:${port}`;
  for (const name of [host.includes(":") ? `[${host}]` : host, "localhost", "127.0.0.1", "[::1]"]) allowedHosts.add(`${name}:${port}`);
  return {
    url: origin,
    api: fake.api,
    close: () => new Promise((resolve, reject) => {
      fake.stopWaiting();
      server.close((cause) => cause ? reject(fakeError("close", "The fake Telegram server did not close.", {}, cause)) : resolve());
      server.closeAllConnections();
    })
  };
}

// src/telegram-fake/updates.mts
var nextId = 1;
var TEST_USER = { id: 4242, is_bot: false, first_name: "Ada", username: "ada", language_code: "en" };
function chatOf(user, chat) {
  return { id: chat?.id ?? user.id, type: chat?.type ?? "private", ...chat };
}
function id(opts) {
  return opts.updateId ?? nextId++;
}
var makeUpdate = {
  message(text, opts = {}) {
    const from = opts.from ?? TEST_USER;
    return { update_id: id(opts), message: { message_id: nextId + 500, date: 17e8, chat: chatOf(from, opts.chat), from, text } };
  },
  command(name, args = "", opts = {}) {
    return makeUpdate.message(args ? `/${name} ${args}` : `/${name}`, opts);
  },
  callback(data, opts = {}) {
    const from = opts.from ?? TEST_USER;
    return {
      update_id: id(opts),
      callback_query: {
        id: `cq${nextId}`,
        from,
        data,
        chat_instance: "1",
        message: { message_id: opts.messageId ?? 77, date: 17e8, chat: chatOf(from, opts.chat), text: "menu" }
      }
    };
  },
  preCheckout(payload, stars, opts = {}) {
    return { update_id: id(opts), pre_checkout_query: { id: `pcq${nextId}`, from: opts.from ?? TEST_USER, currency: "XTR", total_amount: stars, invoice_payload: payload } };
  },
  successfulPayment(payload, stars, chargeId, opts = {}) {
    const from = opts.from ?? TEST_USER;
    return {
      update_id: id(opts),
      message: {
        message_id: nextId + 500,
        date: 17e8,
        chat: chatOf(from, opts.chat),
        from,
        successful_payment: {
          currency: "XTR",
          total_amount: stars,
          invoice_payload: payload,
          telegram_payment_charge_id: chargeId,
          ...opts.recurring ? { is_recurring: true, is_first_recurring: opts.recurring.first, subscription_expiration_date: opts.recurring.expiresAt } : {}
        }
      }
    };
  },
  managedBot(owner, bot, opts = {}) {
    return { update_id: id(opts), managed_bot: { user: owner, bot: { id: bot.id, is_bot: true, username: bot.username, first_name: bot.username } } };
  }
};
export {
  FAKE_API_URL,
  FakeBotApi,
  TEST_USER,
  botIdOfToken,
  chatPageHtml,
  makeUpdate,
  readParams,
  serveFakeTelegram,
  signInitData,
  webhookSecret
};
//# sourceMappingURL=telegram-fake.js.map