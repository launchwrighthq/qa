import {
  serveFakeTelegram
} from "./chunk-WYFTYWQP.js";
import {
  QA_TELEGRAM_PORT,
  guarded,
  parseArgs,
  processSignal,
  qaFakeBots,
  worldContext
} from "./chunk-RCXD64CA.js";
import "./chunk-ZJ35OYFC.js";
import "./chunk-CNY6SOD7.js";
import {
  qaTelegramId
} from "./chunk-I4K4P4GZ.js";
import "./chunk-YDFQPHPI.js";
import "./chunk-4B5GWDFB.js";
import "./chunk-GZ2IEQDP.js";
import "./chunk-2VQTE6KZ.js";
import "./chunk-5AJ7M7K5.js";
import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/commands/qa-telegram.mts
var USAGE = [
  "usage: lw qa telegram [--port <p>]",
  "  serves the fake Bot API and the /__tg chat page on 127.0.0.1 until Ctrl-C.",
  `  --port  default: the port of qa.telegramUrl (${QA_TELEGRAM_PORT})`,
  "usage: lw qa telegram bot <create|destroy>  the throwaway bot lifecycle (spec 2.7)"
];
var WEBHOOK_PATH = "/tg/bots";
function firstNameOf(persona) {
  const words = persona.replace(/[-.]+/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
function fakePersonas(registry) {
  return registry.personas.map((p) => ({ id: p.id, telegramId: qaTelegramId(p.id), firstName: firstNameOf(p.id) }));
}
function qaWebhook(sections, apiPort) {
  const telegram2 = sections.telegram;
  const bots = Object.values(telegram2?.bots ?? {});
  if (!bots.some((b) => (b.transport ?? "webhook") === "webhook")) return void 0;
  const secret = telegram2?.webhook?.secret;
  if (typeof secret !== "string" || secret === "") {
    throw new LaunchwrightError(
      "qa.telegram.webhook",
      "A bot of telegram.bots uses the webhook transport, and telegram.webhook.secret is not set, so the fake server cannot sign its updates. Set the secret, or set transport: polling on each bot."
    );
  }
  const path = typeof telegram2?.webhook?.path === "string" ? telegram2.webhook.path : WEBHOOK_PATH;
  return { url: `http://127.0.0.1:${apiPort}${path}/{botId}`, secret };
}
function telegramPort(option, telegramUrl) {
  if (option === void 0) {
    const url = new URL(telegramUrl);
    return url.port === "" ? url.protocol === "https:" ? 443 : 80 : Number(url.port);
  }
  const n = Number(option);
  if (typeof option !== "string" || !/^\d+$/.test(option) || n > 65535) {
    throw new LaunchwrightError("qa.telegram.usage", `--port must be an integer from 0 (a free port) to 65535, not ${String(option)}.`);
  }
  return n;
}
async function run(args, opts) {
  if (args[0] === "bot") {
    const { runTelegramBot } = await import("./qa-telegram-bot-4GHQMHOH.js");
    return runTelegramBot(args.slice(1), opts);
  }
  const { words, options } = parseArgs(args, ["help"], ["port"]);
  if (options.help === true || words.length > 0 || Object.keys(options).some((k) => k !== "port")) {
    for (const line of USAGE) opts.err(line);
    return options.help === true ? 0 : 2;
  }
  const env = opts.env ?? "local";
  if (env === "production") {
    throw new LaunchwrightError("qa.telegram.production", "lw qa telegram does not start in the production environment (spec 2.14 rule S3).");
  }
  const ctx = await worldContext(opts);
  const bots = qaFakeBots(ctx.sections, ctx.overlay.registryHash);
  if (bots.length === 0) {
    throw new LaunchwrightError("qa.telegram.no-bot", "Config telegram.bots has no bot with a token or an id, so the fake server has nothing to serve.");
  }
  const port = telegramPort(options.port, ctx.qa.telegramUrl);
  const webhook = qaWebhook(ctx.sections, ctx.qa.apiPort);
  const fake = await serveFakeTelegram({ port, host: "127.0.0.1", bots, personas: fakePersonas(ctx.registry), webhook, env });
  const stop = processSignal(opts.signal);
  try {
    opts.out(fake.url);
    opts.out(`${fake.url}/__tg`);
    opts.err(`lw qa telegram: ${bots.length} bot(s), ${ctx.registry.personas.length} persona(s), ${webhook ? `updates to the webhook ${webhook.url}` : "updates kept for getUpdates"}; Ctrl-C stops it`);
    if (options.port !== void 0 && fake.url !== new URL(ctx.qa.telegramUrl).origin) {
      opts.err(`lw qa telegram: the QA API calls qa.telegramUrl ${ctx.qa.telegramUrl}, not this server.`);
    }
    if (!stop.signal.aborted) await new Promise((resolve) => stop.signal.addEventListener("abort", () => resolve(), { once: true }));
  } finally {
    stop.dispose();
    await fake.close();
  }
  return 0;
}
var telegram = {
  name: "telegram",
  summary: "Serve the fake Bot API and the /__tg chat page on loopback for the QA API",
  run: (args, opts) => guarded("telegram", opts, () => run(args, opts))
};
var qa_telegram_default = telegram;
export {
  qa_telegram_default as default,
  fakePersonas,
  firstNameOf,
  qaWebhook,
  telegramPort
};
//# sourceMappingURL=qa-telegram-DBNCCMZQ.js.map