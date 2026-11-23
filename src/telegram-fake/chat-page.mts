// The `/__tg` chat page of the fake Telegram server (QA spec 2.10). It is one HTML file with inline
// CSS and JS and no framework. It reads `/__tg/api/state` and posts the persona's actions to
// `/__tg/api/<action>`. Playwright finds each part by a `data-qa-*` attribute or by its role and name.

const CSS = `
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

const JS = `
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

/** The HTML of `/__tg`. */
export function chatPageHtml(): string {
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
