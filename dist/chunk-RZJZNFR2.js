import {
  ShiftClock,
  qaConfig
} from "./chunk-APXO3KTC.js";
import {
  MIN_VIDEO_S,
  QA_TARGET_SPEC_VERSION,
  createFakeTarget,
  mimeOfExtension,
  pngSize
} from "./chunk-7DHZXG6M.js";
import {
  readTextOrNull,
  sha256
} from "./chunk-6LHTNS5B.js";
import {
  CLOCK,
  CONFIG,
  provider,
  resolveImport,
  systemClock,
  token
} from "./chunk-WUOHAWEI.js";
import {
  BootError,
  LaunchwrightError
} from "./chunk-L57WEOVE.js";

// src/commands/extensions.mts
import { pathToFileURL } from "url";
var EXTENSION_PREFIX = "qa-";
function extensionNames(sections = {}) {
  return Object.keys(sections).filter((name) => name.startsWith(EXTENSION_PREFIX)).sort();
}
function isExtension(value) {
  return typeof value === "object" && value !== null && typeof value.name === "string";
}
async function loadExtensions(root, sections = {}) {
  const out = [];
  for (const name of extensionNames(sections)) {
    const specifier = `@launchwrighthq/${name}`;
    let ns;
    try {
      ns = await import(pathToFileURL(resolveImport(specifier, root)).href);
    } catch (cause) {
      throw new LaunchwrightError("qa.extension", `The config enables module ${name}, and ${specifier} does not load from ${root}. Install the package or remove section ${name}.`, {
        cause,
        context: { module: name }
      });
    }
    if (!isExtension(ns.qaExtension)) {
      throw new LaunchwrightError("qa.extension", `${specifier} exports no qaExtension, so lw qa cannot use module ${name}.`, { context: { module: name } });
    }
    out.push(ns.qaExtension);
  }
  return out;
}
function extensionTargets(extensions, config, root) {
  return Object.assign({}, ...extensions.map((e) => e.targets?.(config, root) ?? {}));
}

// src/drivers/target/playwright.mts
import { mkdirSync } from "fs";
import { dirname } from "path";
var PERSONA_SESSION_ROUTE = "/__qa/session";
var CAPABILITIES = ["input", "screenshot", "video", "webview"];
var MIN_CLIP_MS = MIN_VIDEO_S * 1e3 + 500;
var importPlaywright = () => import("@playwright/test");
async function loadPlaywright() {
  try {
    return await importPlaywright();
  } catch (err) {
    throw new LaunchwrightError("qa.target.playwright", "The playwright target needs @playwright/test. Run: pnpm add -D @playwright/test", { cause: err });
  }
}
function browserOf(pw, leg, descriptor) {
  const name = leg.browser ?? descriptor?.defaultBrowserType ?? "chromium";
  return pw[name];
}
function contextOptions(pw, leg) {
  let base = {};
  if (leg.descriptor !== void 0) {
    const found = pw.devices[leg.descriptor];
    if (!found) {
      throw new LaunchwrightError("qa.target.descriptor", `Leg ${leg.name} names the device descriptor "${leg.descriptor}", which Playwright does not know.`, {
        context: { leg: leg.name, descriptor: leg.descriptor }
      });
    }
    base = { ...found };
  }
  return {
    ...base,
    ...leg.viewport ? { viewport: leg.viewport } : {},
    ...leg.deviceScaleFactor !== void 0 ? { deviceScaleFactor: leg.deviceScaleFactor } : {},
    ...leg.userAgent !== void 0 ? { userAgent: leg.userAgent } : {}
  };
}
function basePath(baseUrl) {
  return new URL(baseUrl).pathname.replace(/\/+$/, "");
}
function routeUrl(baseUrl, route, persona) {
  const base = new URL(baseUrl);
  const url = new URL(`${base.origin}${basePath(baseUrl)}${route.startsWith("/") ? route : `/${route}`}`);
  if (persona !== void 0) url.searchParams.set("qa", persona);
  return url.href;
}
function relativeRoute(baseUrl, pageUrl) {
  const base = basePath(baseUrl);
  let path = new URL(pageUrl).pathname;
  if (base !== "" && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length);
  path = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return path === "" ? "/" : path;
}
var SETTLE_SCRIPTS = {
  artwork: () => {
    const images = [...document.images];
    if (images.length > 0) return images.every((i) => i.complete && i.naturalWidth > 0);
    return [...document.querySelectorAll("body *")].some((el) => getComputedStyle(el).backgroundImage.includes("url("));
  },
  video: () => [...document.querySelectorAll("video")].some((v) => v.readyState >= 2 && v.videoWidth > 0 && !v.paused),
  busy: () => document.querySelector('[aria-busy="true"]') === null
};
var PlaywrightSession = class {
  constructor(target, opts, browser, context, page) {
    this.target = target;
    this.opts = opts;
    this.browser = browser;
    this.context = context;
    this.page = page;
    const at = () => target.clock.date().toISOString();
    page.on("pageerror", (err) => this.lines.push({ at: at(), kind: "page-error", text: err.message }));
    page.on("console", (msg) => {
      if (msg.type() === "error") this.lines.push({ at: at(), kind: "console-error", text: msg.text() });
    });
    page.on(
      "requestfailed",
      (req) => this.lines.push({ at: at(), kind: "request-failed", text: `${req.method()} ${req.url()}: ${req.failure()?.errorText ?? "failed"}` })
    );
    page.on("response", (res) => {
      if (res.status() >= 500) this.lines.push({ at: at(), kind: "response-5xx", text: `${res.status()} ${res.request().method()} ${res.url()}` });
    });
  }
  target;
  opts;
  browser;
  context;
  page;
  lines = [];
  tracing = true;
  videoPath = null;
  videoStart = 0;
  closed = false;
  /**
   * `?qa=<persona>` launches a persona on the miniapp surface (spec 2.6). On the bot surface the
   * row's route opens the persona's chat on `/__tg`.
   */
  queryPersona() {
    return this.opts.leg.surface === "miniapp" ? this.opts.persona : void 0;
  }
  fail(code, message, err, context = {}) {
    return new LaunchwrightError(code, message, { cause: err, context: { leg: this.opts.leg.name, ...context } });
  }
  async navigate(route) {
    const url = routeUrl(this.opts.baseUrl, route, this.queryPersona());
    try {
      await this.page.goto(url, { waitUntil: "load" });
    } catch (err) {
      throw this.fail("qa.target.navigate", `Leg ${this.opts.leg.name} could not open ${route}.`, err, { route });
    }
  }
  async act(step) {
    const timeout = this.target.actTimeoutMs;
    const what = `${step.kind}${step.target ? ` ${step.target}` : ""}`;
    try {
      switch (step.kind) {
        case "click":
          await this.page.locator(required(step.target, "click")).first().click({ timeout });
          return;
        case "type":
          await this.page.locator(required(step.target, "type")).first().fill(step.text ?? "", { timeout });
          return;
        case "press": {
          const key = required(step.key ?? step.text, "press");
          if (step.target) await this.page.locator(step.target).first().press(key, { timeout });
          else await this.page.keyboard.press(key);
          return;
        }
        case "scroll":
          await this.scroll(step.dx ?? 0, step.dy ?? 0);
          return;
        case "wait":
          await this.target.clock.sleep(step.ms ?? 0);
          return;
        case "back":
          await this.page.goBack({ waitUntil: "load" });
          return;
      }
    } catch (err) {
      if (err instanceof LaunchwrightError && err.code === "qa.target.act") throw err;
      throw this.fail("qa.target.act", `Leg ${this.opts.leg.name} could not run the act ${what}.`, err, { act: step });
    }
  }
  /** Scrolls the app's own scroll root `[data-page-scroll]`, else the document, and checks that it moved. */
  async scroll(dx, dy) {
    const moved = await this.page.evaluate(
      ([x, y]) => {
        const root = document.querySelector("[data-page-scroll]");
        const el = root ?? document.scrollingElement ?? document.documentElement;
        const before = [el.scrollLeft, el.scrollTop];
        el.scrollBy(x, y);
        return { marked: root !== null, moved: el.scrollLeft !== before[0] || el.scrollTop !== before[1] };
      },
      [dx, dy]
    );
    if (!moved.marked && !moved.moved) {
      throw new LaunchwrightError("qa.target.act", `The act scroll ${dx},${dy} found no [data-page-scroll] root and the document did not move.`, {
        context: { leg: this.opts.leg.name }
      });
    }
  }
  async settle(rule) {
    const timeout = rule.timeout ?? this.target.settleTimeoutMs;
    try {
      if (rule.selector !== void 0) await this.page.locator(rule.selector).first().waitFor({ state: "visible", timeout });
      if (rule.artwork) await this.page.waitForFunction(SETTLE_SCRIPTS.artwork, void 0, { timeout });
      if (rule.video) await this.page.waitForFunction(SETTLE_SCRIPTS.video, void 0, { timeout });
      if (rule.busy) await this.page.waitForFunction(SETTLE_SCRIPTS.busy, void 0, { timeout });
    } catch (err) {
      throw this.fail("qa.target.settle", `Leg ${this.opts.leg.name} did not settle in ${timeout} ms on ${JSON.stringify(rule)}.`, err, { rule });
    }
  }
  async currentRoute() {
    return relativeRoute(this.opts.baseUrl, this.page.url());
  }
  async screenshot(path) {
    mkdirSync(dirname(path), { recursive: true });
    const png = await this.page.screenshot({ path, animations: "disabled", fullPage: false });
    const size = pngSize(png);
    if (size === null) throw new LaunchwrightError("qa.target.screenshot", `Leg ${this.opts.leg.name} wrote a screenshot that is not a PNG: ${path}.`);
    return { path, ...size };
  }
  async startVideo(path) {
    if (this.videoPath !== null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} already records ${this.videoPath}.`);
    mkdirSync(dirname(path), { recursive: true });
    const size = this.page.viewportSize() ?? void 0;
    await this.page.screencast.start({ path, ...size ? { size } : {} });
    this.videoPath = path;
    this.videoStart = this.target.clock.now();
  }
  async stopVideo() {
    if (this.videoPath === null) throw new LaunchwrightError("qa.target.video", `Leg ${this.opts.leg.name} records no video; call startVideo first.`);
    const path = this.videoPath;
    this.videoPath = null;
    const held = this.target.clock.now() - this.videoStart;
    if (held < MIN_CLIP_MS) await this.target.clock.sleep(MIN_CLIP_MS - held);
    await this.page.screencast.stop();
    return { path, durationMs: this.target.clock.now() - this.videoStart };
  }
  async trace(path) {
    if (!this.tracing) return null;
    this.tracing = false;
    mkdirSync(dirname(path), { recursive: true });
    await this.context.tracing.stop({ path });
    return path;
  }
  /** The browser target has no accessibility dump file; Android rows carry one (spec 2.11.1). */
  async dump(_path) {
    return null;
  }
  async logs() {
    return [...this.lines];
  }
  async evaluate(expression) {
    return this.page.evaluate(expression);
  }
  routable() {
    return this.page;
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.videoPath !== null) await this.page.screencast.stop();
      if (this.tracing) await this.context.tracing.stop();
      await this.context.close();
    } finally {
      await this.browser.close();
    }
  }
};
function required(value, kind) {
  if (value === void 0 || value === "") {
    throw new LaunchwrightError("qa.target.act", `The act ${kind} needs a ${kind === "press" ? "key" : "target"}.`, { context: { kind } });
  }
  return value;
}
var PlaywrightTarget = class {
  name = "playwright";
  specVersion = QA_TARGET_SPEC_VERSION;
  capabilities = new Set(CAPABILITIES);
  clock;
  actTimeoutMs;
  settleTimeoutMs;
  executablePath;
  constructor(opts) {
    this.clock = opts.clock ?? systemClock;
    this.actTimeoutMs = opts.actTimeoutMs ?? 15e3;
    this.settleTimeoutMs = opts.settleTimeoutMs ?? 2e4;
    this.executablePath = opts.executablePath;
  }
  supports(cap) {
    return this.capabilities.has(cap);
  }
  async launch(pw, leg) {
    const { defaultBrowserType, ...options } = contextOptions(pw, leg);
    const type = browserOf(pw, leg, { defaultBrowserType });
    const browser = await type.launch({ headless: true, ...this.executablePath ? { executablePath: this.executablePath } : {} });
    return { browser, options };
  }
  /** Ready when the leg's browser launches. The reason names the install command. */
  async ready(leg) {
    let pw;
    try {
      pw = await loadPlaywright();
    } catch (err) {
      return { ready: false, reason: err.message };
    }
    try {
      const { browser } = await this.launch(pw, leg);
      await browser.close();
      return { ready: true };
    } catch (err) {
      const first = (err.message ?? String(err)).split("\n")[0];
      return { ready: false, reason: `${first}. Run: npx playwright install ${leg.browser ?? "chromium"}` };
    }
  }
  async open(opts) {
    const pw = await loadPlaywright();
    const { browser, options } = await this.launch(pw, opts.leg).catch((err) => {
      throw new LaunchwrightError("qa.target.launch", `Leg ${opts.leg.name} could not launch ${opts.leg.browser ?? "chromium"}.`, { cause: err });
    });
    try {
      const context = await browser.newContext(options);
      await context.tracing.start({ screenshots: true, snapshots: true });
      if (opts.persona !== void 0 && opts.leg.surface === "web") await signIn(context, opts);
      const page = await context.newPage();
      return new PlaywrightSession(this, opts, browser, context, page);
    } catch (err) {
      await browser.close();
      throw err;
    }
  }
};
async function signIn(context, opts) {
  const url = new URL(PERSONA_SESSION_ROUTE, opts.baseUrl).href;
  const res = await context.request.post(url, { data: { persona: opts.persona } });
  if (!res.ok()) {
    throw new LaunchwrightError("qa.target.persona", `POST ${PERSONA_SESSION_ROUTE} for persona ${opts.persona} answered ${res.status()}.`, {
      context: { leg: opts.leg.name, persona: opts.persona, status: res.status() }
    });
  }
}
function createPlaywrightTarget(opts = {}) {
  return new PlaywrightTarget(opts);
}

// src/services/targets.mts
function createTargetRegistry(_config, extra = {}, clock = systemClock) {
  const targets = {
    playwright: createPlaywrightTarget({ clock }),
    fake: createFakeTarget({ clock }),
    ...extra
  };
  return {
    names: () => Object.keys(targets).sort(),
    get(name) {
      const target = targets[name];
      if (!target) {
        throw new LaunchwrightError("qa.target.unknown", `No qa.target driver is named ${name}. Targets: ${Object.keys(targets).sort().join(", ") || "none"}.`, {
          context: { target: name }
        });
      }
      return target;
    },
    add(more) {
      for (const [name, target] of Object.entries(more)) {
        if (targets[name]) throw new LaunchwrightError("qa.target.duplicate", `A qa.target driver named ${name} is already registered.`, { context: { target: name } });
        targets[name] = target;
      }
    }
  };
}

// src/tokens.mts
var QA_TARGETS = token("qa.targets");

// src/provider.mts
var qaProvider = provider({
  name: "qa",
  requires: ["kernel"],
  config: { section: "qa", schema: qaConfig },
  register(app) {
    const cfg = app.get(CONFIG).section("qa");
    if (cfg.routes && app.config.env === "production") {
      throw new BootError(
        "qa.routes.production",
        `Boot failed in module "qa": key "qa.routes" is on in the production environment. The /__qa routes sign any persona in; turn qa.routes off. Check ${app.config.envFile}.`,
        { context: { module: "qa", key: "qa.routes", envFile: app.config.envFile } }
      );
    }
    if (cfg.routes) app.instance(CLOCK, new ShiftClock(app.get(CLOCK)));
    app.singleton(QA_TARGETS, (c) => createTargetRegistry(c.get(CONFIG).section("qa")));
  }
});

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
  const fileFor2 = (hash) => {
    if (!HEX64.test(hash)) throw new LaunchwrightError("qa.consent.hash", `A consent hash is 64 hex characters, not "${hash}".`, { context: { hash } });
    return join(dir, `${hash}.json`);
  };
  return {
    async read(hash) {
      const file = fileFor2(hash);
      const text = await readTextOrNull(file);
      if (text === null) return null;
      try {
        return JSON.parse(text);
      } catch (cause) {
        throw new LaunchwrightError("qa.consent.read", `The consent record ${file} is not JSON.`, { cause, context: { hash } });
      }
    },
    async write(hash, record) {
      const file = fileFor2(hash);
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify(record, null, 2)}
`);
    }
  };
}

// src/services/botfather.mts
var BOTFATHER = "BotFather";
var DELETE_CONFIRM = "Yes, I am totally sure.";
var BOT_TOKEN = /(\d{6,12}:[A-Za-z0-9_-]{30,})/;
var WAIT = /(?:try again in|retry after)\s+(\d+)\s*(seconds?|minutes?|hours?)?/i;
var REFUSAL = /cannot create new bots|can't create new bots|too many (?:requests|attempts)|try again later|@SpamBot|^\s*sorry\b/im;
var HELP_MENU = /I can help you create and manage Telegram bots/i;
var UNIT_SECONDS = { s: 1, m: 60, h: 3600 };
function parseBotToken(reply) {
  const match = BOT_TOKEN.exec(reply);
  if (!match) {
    throw new LaunchwrightError("qa.bot.token", "BotFather returned no bot token. The /newbot flow did not finish, or the wording changed.");
  }
  return match[1];
}
function botIdOf(token2) {
  const id = Number.parseInt(token2.slice(0, token2.indexOf(":")), 10);
  if (!Number.isInteger(id) || id <= 0) throw new LaunchwrightError("qa.bot.token", "The bot token has no numeric bot id before the colon.");
  return id;
}
function refusalOf(reply) {
  if (BOT_TOKEN.test(reply)) return null;
  const text = reply.replace(/\s+/g, " ").trim();
  const wait = WAIT.exec(reply);
  if (wait) {
    const seconds = Number(wait[1]) * (UNIT_SECONDS[(wait[2] ?? "s").charAt(0).toLowerCase()] ?? 1);
    return new LaunchwrightError("qa.bot.limit", `BotFather limits this account: wait ${seconds} seconds, then run the command again. BotFather said: "${text}"`, { context: { seconds } });
  }
  if (REFUSAL.test(reply)) return new LaunchwrightError("qa.bot.refused", `BotFather refused the step. BotFather said: "${text}"`);
  if (HELP_MENU.test(reply)) {
    return new LaunchwrightError("qa.bot.refused", `BotFather sent its help menu where a prompt was due, so it dropped the dialog. BotFather said: "${text.slice(0, 200)}"`);
  }
  return null;
}
async function exchange(chat, text) {
  await chat.send(text);
  const reply = await chat.reply();
  const refusal = refusalOf(reply);
  if (refusal) throw refusal;
  return reply;
}
function handleOf(username) {
  return username.startsWith("@") ? username : `@${username}`;
}
async function newBot(chat, opts) {
  if (!/bot$/i.test(opts.username)) {
    throw new LaunchwrightError("qa.bot.username", `A bot username must end in "bot", not "${opts.username}".`, { context: { username: opts.username } });
  }
  await exchange(chat, "/newbot");
  await exchange(chat, opts.name);
  const reply = await exchange(chat, opts.username);
  const token2 = parseBotToken(reply);
  return { botId: botIdOf(token2), username: opts.username, token: token2 };
}
async function configureBot(chat, opts) {
  const handle2 = handleOf(opts.username);
  if (opts.commands && opts.commands.length > 0) {
    await exchange(chat, "/setcommands");
    await exchange(chat, handle2);
    await exchange(chat, opts.commands.map((c) => `${c.command} - ${c.description}`).join("\n"));
  }
  await exchange(chat, "/setprivacy");
  await exchange(chat, handle2);
  await exchange(chat, opts.privacy ?? true ? "Enable" : "Disable");
}
async function destroyBot(chat, getMe, record) {
  const handle2 = handleOf(record.username);
  await exchange(chat, "/revoke");
  await exchange(chat, handle2);
  await exchange(chat, "/deletebot");
  await exchange(chat, handle2);
  await exchange(chat, DELETE_CONFIRM);
  const me = await getMe(record.token);
  if (me.status !== 401) {
    throw new LaunchwrightError("qa.bot.alive", `The throwaway bot ${record.botId} still answers getMe with ${me.status}, so it is not deleted. Run destroy again.`, { context: { botId: record.botId, status: me.status } });
  }
  return { botId: record.botId, username: record.username, status: me.status };
}

// src/services/bot-store.mts
import { mkdir as mkdir2, readdir, rm, writeFile as writeFile2 } from "fs/promises";
import { join as join2 } from "path";
var BOT_STORE_DIR = ".lw/qa/bots";
function fileFor(dir, botId) {
  if (!Number.isInteger(botId) || botId <= 0) throw new LaunchwrightError("qa.bot.id", `A bot id is a positive integer, not "${botId}".`, { context: { botId } });
  return join2(dir, `${botId}.json`);
}
function parse(dir, botId, text) {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LaunchwrightError("qa.bot.record", `The bot record ${fileFor(dir, botId)} is not JSON.`, { cause, context: { botId } });
  }
}
function fileBotStore(dir) {
  return {
    async read(botId) {
      const text = await readTextOrNull(fileFor(dir, botId));
      return text === null ? null : parse(dir, botId, text);
    },
    async write(record) {
      const file = fileFor(dir, record.botId);
      await mkdir2(dir, { recursive: true });
      await writeFile2(file, `${JSON.stringify(record, null, 2)}
`);
    },
    async list() {
      let names;
      try {
        names = (await readdir(dir)).filter((n) => /^\d+\.json$/.test(n));
      } catch (cause) {
        if (cause.code === "ENOENT") return [];
        throw new LaunchwrightError("qa.bot.record", `Cannot read the bot run store ${dir}.`, { cause });
      }
      const out = [];
      for (const name of names.sort()) {
        const botId = Number.parseInt(name, 10);
        const text = await readTextOrNull(join2(dir, name));
        if (text !== null) out.push(parse(dir, botId, text));
      }
      return out;
    },
    async remove(botId) {
      await rm(fileFor(dir, botId), { force: true });
    }
  };
}

// src/services/comments.mts
import { randomUUID } from "crypto";
import { mkdir as mkdir3, writeFile as writeFile3 } from "fs/promises";
import { join as join3 } from "path";
var COMMENTS_DIR = ".lw/qa/comments";
var ANCHOR_KINDS = ["step", "text", "region", "time", "flow"];
var SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isFraction = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
var isText = (v) => typeof v === "string" && v.trim() !== "";
function validateAnchor(anchor) {
  if (!isObject(anchor)) return ["the anchor is not an object"];
  const kind = anchor.kind;
  if (typeof kind !== "string" || !ANCHOR_KINDS.includes(kind)) {
    return [`kind "${String(kind)}" is not one of ${ANCHOR_KINDS.join(", ")}`];
  }
  const out = [];
  const need = (field, ok, why) => {
    if (!ok) out.push(`${kind} anchor: ${field} ${why}`);
  };
  if (kind === "step") {
    need("row", isText(anchor.row), "is missing");
    need("leg", isText(anchor.leg), "is missing");
    need("attempt", Number.isInteger(anchor.attempt) && anchor.attempt > 0, "must be a positive integer");
    need("step", Number.isInteger(anchor.step) && anchor.step > 0, "must be a positive integer");
  } else if (kind === "text") {
    need("section", isText(anchor.section), "is missing");
    need("quote", isText(anchor.quote), "is missing");
  } else if (kind === "region") {
    need("screenshot", isText(anchor.screenshot), "is missing");
    need("row", isText(anchor.row), "is missing");
    for (const f of ["x", "y", "w", "h"]) need(f, isFraction(anchor[f]), "must be a fraction from 0 to 1");
  } else if (kind === "time") {
    need("video", isText(anchor.video), "is missing");
    need("row", isText(anchor.row), "is missing");
    need("start", typeof anchor.start === "number" && anchor.start >= 0, "must be a number of seconds");
  } else {
    need("name", isText(anchor.name), "is missing");
  }
  return out;
}
function makeComment(input) {
  const problems = validateAnchor(input.anchor);
  if (problems.length > 0) {
    throw new LaunchwrightError("qa.comment.anchor", `The comment anchor is invalid: ${problems.join("; ")}`, { context: { problems } });
  }
  return { id: input.id ?? randomUUID(), anchor: input.anchor, author: input.author, body: input.body, createdAt: input.createdAt, status: "open", replies: [] };
}
function addComment(list, comment) {
  if (list.some((c) => c.id === comment.id)) {
    throw new LaunchwrightError("qa.comment.duplicate", `A comment with id ${comment.id} already exists.`, { context: { id: comment.id } });
  }
  return [...list, comment];
}
function replyToComment(list, id, reply) {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to reply to.`, { context: { id } });
  return list.map((c) => c.id === id ? { ...c, replies: [...c.replies, reply] } : c);
}
function setStatus(list, id, status) {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError("qa.comment.missing", `No comment ${id} to update.`, { context: { id } });
  return list.map((c) => c.id === id ? { ...c, status } : c);
}
function commentsFile(dir, slug) {
  if (!SLUG.test(slug)) throw new LaunchwrightError("qa.comment.slug", `A report slug is "${slug}", which is not a safe file name.`, { context: { slug } });
  return join3(dir, `${slug}.json`);
}
function fileCommentStore(dir) {
  return {
    async read(slug) {
      const text = await readTextOrNull(commentsFile(dir, slug));
      if (text === null) return [];
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug)} is not JSON.`, { cause, context: { slug } });
      }
      if (!isObject(parsed) || !Array.isArray(parsed.comments)) {
        throw new LaunchwrightError("qa.comment.read", `The comment store ${commentsFile(dir, slug)} has no comments array.`, { context: { slug } });
      }
      return parsed.comments;
    },
    async write(slug, comments) {
      const file = commentsFile(dir, slug);
      await mkdir3(dir, { recursive: true });
      await writeFile3(file, `${JSON.stringify({ slug, comments }, null, 2)}
`);
    }
  };
}

// src/services/comment-export.mts
import { mkdir as mkdir4, readFile, writeFile as writeFile4 } from "fs/promises";
import { join as join4, relative } from "path";
var oneLine = (text) => text.replace(/\s+/g, " ").trim();
var shotOf = (manifest, row) => manifest.shots.find((s) => s.id === row);
var screenState = (shot) => shot ? `${shot.screen} ${shot.state}` : "";
var inLedger = (entries, path) => entries.some((e) => e.path === path);
function stepOfPath(path) {
  const m = /\.(\d+)\.png$/i.exec(path);
  return m ? Number(m[1]) : null;
}
function stepScreenshot(entries, row, leg, attempt, step) {
  const stepShot = entries.find((e) => e.kind === "step" && e.row === row && e.leg === leg && e.attempt === attempt && stepOfPath(e.path) === step);
  if (stepShot) return stepShot.path;
  return entries.find((e) => e.kind === "screenshot" && e.row === row && e.leg === leg)?.path;
}
var pct = (v) => Math.round(v * 100);
function resolveAnchor(anchor, ctx) {
  if (anchor.kind === "text") {
    const shot2 = shotOf(ctx.manifest, anchor.section);
    const where = shot2 ? `section ${anchor.section} (${screenState(shot2)})` : `section ${anchor.section}`;
    return { target: where, located: `the words "${oneLine(anchor.quote)}"`, orphaned: false };
  }
  if (anchor.kind === "step") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const file = stepScreenshot(ctx.entries, anchor.row, anchor.leg, anchor.attempt, anchor.step);
    return { target: file ?? `${anchor.row} on ${anchor.leg}`, located: `step ${anchor.step} of ${screenState(shot2) || anchor.row} on ${anchor.leg}`, orphaned: false };
  }
  if (anchor.kind === "region") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const near = stepOfPath(anchor.screenshot);
    const rect = `rectangle ${pct(anchor.x)}%,${pct(anchor.y)}% ${pct(anchor.w)}x${pct(anchor.h)}%`;
    const step = near === null ? "the settle screenshot" : `step ${near}`;
    return { target: anchor.screenshot, located: `${rect} of ${screenState(shot2) || anchor.row}, nearest ${step}`, orphaned: !inLedger(ctx.entries, anchor.screenshot) };
  }
  if (anchor.kind === "time") {
    const shot2 = shotOf(ctx.manifest, anchor.row);
    const span = anchor.end === void 0 ? `t=${anchor.start}s` : `t=${anchor.start}s to ${anchor.end}s`;
    const active = anchor.step === void 0 ? "" : `, step ${anchor.step} then active`;
    return { target: anchor.video, located: `${span} of ${screenState(shot2) || anchor.row}${active}`, orphaned: !inLedger(ctx.entries, anchor.video) };
  }
  const shot = shotOf(ctx.manifest, anchor.name);
  return { target: shot ? `${screenState(shot)} (${anchor.name})` : `flow ${anchor.name}`, located: `flow ${anchor.name}`, orphaned: false };
}
function resolveComments(comments, ctx) {
  return comments.filter((c) => c.status === "open").map((c) => {
    const crop = ctx.crops?.get(c.id);
    return { id: c.id, kind: c.anchor.kind, ...resolveAnchor(c.anchor, ctx), note: oneLine(c.body), ...crop ? { crop } : {} };
  });
}
function exportTaskList(comments, ctx) {
  const resolved = resolveComments(comments, ctx);
  if (resolved.length === 0) return "No open comments to act on.";
  const lines = [`${resolved.length} open comment${resolved.length === 1 ? "" : "s"} to act on:`, ""];
  for (const r of resolved) {
    const orphan = r.orphaned ? " (orphaned: the ledger no longer holds this file)" : "";
    const crop = r.crop ? ` Crop: ${r.crop.path} (${r.crop.width}x${r.crop.height} px).` : "";
    lines.push(`- [${r.kind}] ${r.target}${orphan}: ${r.located}.${crop} Note: ${r.note}`);
  }
  return lines.join("\n");
}

// src/services/comment-server.mts
import { createServer } from "http";
import { readFile as readFile2 } from "fs/promises";
import { resolve, sep } from "path";
var MAX_BODY = 1024 * 1024;
var sendJson = (res, status, value) => {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
};
var sendText = (res, status, text) => {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
};
function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes <= MAX_BODY) chunks.push(c);
    });
    req.on("end", () => bytes > MAX_BODY ? fail(new LaunchwrightError("qa.comment.body", "The request body is over 1 MiB.")) : ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
}
async function applyOp(body, store, slug, clock) {
  let op;
  try {
    op = JSON.parse(body || "{}");
  } catch (cause) {
    throw new LaunchwrightError("qa.comment.body", "The POST body is not JSON.", { cause });
  }
  if (typeof op !== "object" || op === null) throw new LaunchwrightError("qa.comment.body", "The POST body is not an object.");
  const req = op;
  const list = await store.read(slug);
  const at = clock.date().toISOString();
  let next;
  if (req.op === "add") {
    const c = req.comment;
    next = addComment(list, makeComment({ anchor: c.anchor, author: String(c.author ?? "reviewer"), body: String(c.body ?? ""), createdAt: at }));
  } else if (req.op === "reply") {
    const r = req.reply;
    next = replyToComment(list, String(req.id), { author: String(r.author ?? "reviewer"), body: String(r.body ?? ""), createdAt: at });
  } else if (req.op === "resolve" || req.op === "reopen") {
    next = setStatus(list, String(req.id), req.op === "resolve" ? "resolved" : "open");
  } else {
    throw new LaunchwrightError("qa.comment.op", `The op "${String(req.op)}" is not add, reply, resolve or reopen.`, { context: { op: req.op } });
  }
  await store.write(slug, next);
  return next;
}
async function serveStatic(res, reportDir, pathname) {
  const target = resolve(reportDir, `.${pathname}`);
  if (target !== reportDir && !target.startsWith(reportDir + sep)) {
    sendText(res, 403, "forbidden");
    return;
  }
  let bytes;
  try {
    bytes = await readFile2(target);
  } catch {
    sendText(res, 404, "not found");
    return;
  }
  const mime = mimeOfExtension(target) ?? "application/octet-stream";
  res.writeHead(200, { "content-type": mime, "content-length": bytes.length });
  res.end(bytes);
}
async function handle(req, res, opts, clock) {
  const base = `/${opts.viewerDir}/`;
  const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (pathname === "/" || pathname === base) {
    res.writeHead(302, { location: `${base}index.html` });
    res.end();
    return;
  }
  if (pathname === `${base}comments`) {
    if (req.method === "GET") return sendJson(res, 200, { slug: opts.slug, comments: await opts.store.read(opts.slug) });
    if (req.method === "POST") return sendJson(res, 200, { slug: opts.slug, comments: await applyOp(await readBody(req), opts.store, opts.slug, clock) });
    return sendText(res, 405, "method not allowed");
  }
  if (pathname.startsWith(base)) {
    const name = pathname.slice(base.length);
    const page = opts.renderPages(await opts.store.read(opts.slug)).get(name);
    if (page !== void 0) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
  }
  await serveStatic(res, opts.reportDir, pathname);
}
async function startCommentServer(opts) {
  const host = opts.host ?? "127.0.0.1";
  const clock = opts.clock ?? systemClock;
  const reportDir = resolve(opts.reportDir);
  const server = createServer((req, res) => {
    void handle(req, res, { ...opts, reportDir }, clock).catch((cause) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const code = cause instanceof LaunchwrightError ? cause.code : "qa.comment.server";
      sendJson(res, 400, { error: code });
    });
  });
  await new Promise((ok, fail) => {
    server.once("error", (cause) => fail(new LaunchwrightError("qa.comment.listen", `The comment server cannot listen on ${host}:${opts.port ?? 0}: ${cause.message}`, { cause })));
    server.listen(opts.port ?? 0, host, ok);
  });
  const port = server.address().port;
  const url = `http://${host}:${port}`;
  return {
    port,
    url,
    indexUrl: `${url}/${opts.viewerDir}/index.html`,
    async close() {
      server.closeAllConnections();
      await new Promise((ok, fail) => server.close((err) => err ? fail(err) : ok()));
    }
  };
}

export {
  EXTENSION_PREFIX,
  extensionNames,
  loadExtensions,
  extensionTargets,
  QA_TARGETS,
  qaProvider,
  computeManifest,
  manifestHash,
  grant,
  diff,
  fileConsentStore,
  BOTFATHER,
  DELETE_CONFIRM,
  parseBotToken,
  botIdOf,
  newBot,
  configureBot,
  destroyBot,
  BOT_STORE_DIR,
  fileBotStore,
  COMMENTS_DIR,
  ANCHOR_KINDS,
  validateAnchor,
  makeComment,
  addComment,
  replyToComment,
  setStatus,
  commentsFile,
  fileCommentStore,
  resolveComments,
  exportTaskList,
  startCommentServer
};
//# sourceMappingURL=chunk-RZJZNFR2.js.map