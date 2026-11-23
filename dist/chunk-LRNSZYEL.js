import {
  INTAKE_DIR,
  extensionOf,
  recordId,
  writeIssue
} from "./chunk-JHXOJGHS.js";
import {
  readJsonOrNull
} from "./chunk-6LHTNS5B.js";
import {
  z
} from "./chunk-WUOHAWEI.js";
import {
  LaunchwrightError
} from "./chunk-L57WEOVE.js";

// src/intake/config.mts
var qaIntakeConfig = z.object({
  default: z.string().default("github"),
  maxFileMb: z.number().positive().default(200),
  drivers: z.record(z.string(), z.record(z.string(), z.unknown())).default({})
}).prefault({});

// src/intake/services/registry.mts
var INTAKE_DRIVERS = ["github", "telegram-mtproto", "telegram-bot", "fake"];
function maxBytesOf(intake) {
  return Math.floor(intake.maxFileMb * 1024 * 1024);
}
async function createIntakeDriver(name, intake, deps = {}) {
  const ready = deps.drivers?.[name];
  if (ready) return ready;
  const cfg = intake.drivers[name] ?? {};
  const maxBytes = maxBytesOf(intake);
  switch (name) {
    case "github": {
      const { GithubIntakeDriver } = await import("./github-DP3GKC7B.js");
      return new GithubIntakeDriver({ maxBytes, ...deps.gh ? { gh: deps.gh } : {}, ...deps.fetch ? { fetch: deps.fetch } : {} });
    }
    case "telegram-mtproto": {
      const { TelegramMtprotoIntakeDriver } = await import("./telegram-mtproto-HV3DVPR4.js");
      return new TelegramMtprotoIntakeDriver(cfg, { maxBytes, ...deps.loadGramJs ? { loader: deps.loadGramJs } : {} });
    }
    case "telegram-bot": {
      const { loadBotApi, TelegramBotIntakeDriver } = await import("./telegram-bot-LV7E5GAW.js");
      return new TelegramBotIntakeDriver(cfg, { maxBytes, botApi: await loadBotApi(), ...deps.fetch ? { fetch: deps.fetch } : {} });
    }
    case "fake": {
      const { FakeIntakeDriver } = await import("./fake-66UCHHNN.js");
      return new FakeIntakeDriver({ maxBytes });
    }
    default:
      throw new LaunchwrightError("qa.intake.driver", `No intake driver "${name}". Use ${INTAKE_DRIVERS.join(", ")}.`, { context: { driver: name } });
  }
}

// src/intake/services/telegram.mts
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
var JOIN_GAP_MS = 15 * 60 * 1e3;
var groupsFile = z.object({
  groups: z.array(z.object({ title: z.string().min(1).optional(), messages: z.array(z.union([z.string(), z.number()]).transform(String)).min(1) }))
});
function chatName(chat) {
  return recordId(chat);
}
function chatDir(root, chat) {
  return join(root, INTAKE_DIR, "telegram", chatName(chat));
}
function cursorFile(root, chat) {
  return join(root, INTAKE_DIR, "telegram", `${chatName(chat)}.cursor`);
}
async function jsonOr(file, fallback) {
  return await readJsonOrNull(file) ?? fallback;
}
async function readCursor(root, chat, driver) {
  const all = await jsonOr(cursorFile(root, chat), {});
  return all[driver];
}
async function writeCursor(root, chat, driver, cursor) {
  const file = cursorFile(root, chat);
  const all = await jsonOr(file, {});
  all[driver] = cursor;
  await mkdir(join(root, INTAKE_DIR, "telegram"), { recursive: true });
  await writeFile(file, `${JSON.stringify(all, null, 2)}
`);
}
function readMessages(root, chat) {
  return jsonOr(join(chatDir(root, chat), "messages.json"), []);
}
var byId = (a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);
async function stageBatch(root, chat, batch) {
  const dir = chatDir(root, chat);
  await mkdir(join(dir, "media"), { recursive: true });
  const all = new Map((await readMessages(root, chat)).map((m) => [m.id, m]));
  for (const item of batch.items) {
    const media = [];
    for (const [i, m] of item.media.entries()) {
      const { data, ...rest } = m;
      if (data === void 0) {
        media.push(rest);
        continue;
      }
      const file = `media/${recordId(item.id)}-${i + 1}.${extensionOf(m.mime)}`;
      await writeFile(join(dir, file), data);
      media.push({ ...rest, file });
    }
    all.set(item.id, { ...item, media });
  }
  const messages = [...all.values()].sort(byId);
  await writeFile(join(dir, "messages.json"), `${JSON.stringify(messages, null, 2)}
`);
  return messages;
}
function proposeGroups(chat, messages) {
  const sorted = [...messages].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byId(a, b));
  const parent = new Map(sorted.map((m) => [m.id, m.id]));
  const find = (id) => {
    let at = id;
    while (parent.get(at) !== at) at = parent.get(at);
    parent.set(id, at);
    return at;
  };
  const join2 = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const lastOf = /* @__PURE__ */ new Map();
  for (const m of sorted) {
    if (m.replyTo !== void 0 && parent.has(m.replyTo)) join2(m.replyTo, m.id);
    const at = Date.parse(m.at);
    const prev = lastOf.get(m.author);
    if (prev && at - prev.at < JOIN_GAP_MS) join2(prev.id, m.id);
    lastOf.set(m.author, { id: m.id, at });
  }
  const groups = /* @__PURE__ */ new Map();
  for (const m of sorted) {
    const root = find(m.id);
    groups.set(root, [...groups.get(root) ?? [], m.id]);
  }
  return [...groups.values()].map((ids) => ({ title: `Telegram report ${chat}/${ids[0]} (${ids.length} ${ids.length === 1 ? "message" : "messages"})`, messages: ids }));
}
async function writeProposal(root, chat, groups) {
  const file = join(chatDir(root, chat), "groups.proposed.json");
  await mkdir(chatDir(root, chat), { recursive: true });
  await writeFile(file, `${JSON.stringify({ chat, groups }, null, 2)}
`);
  return file;
}
async function readGroups(root, chat) {
  const file = join(chatDir(root, chat), "groups.json");
  const raw = await jsonOr(file, null);
  if (raw === null) {
    throw new LaunchwrightError("qa.intake.telegram.groups", `No groups.json for chat ${chat}. Review groups.proposed.json and write groups.json beside it.`, { context: { chat } });
  }
  const parsed = groupsFile.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new LaunchwrightError("qa.intake.telegram.groups", `groups.json of chat ${chat} is not valid: ${problems}`, { context: { chat } });
  }
  return parsed.data.groups.map((g, i) => ({ title: g.title ?? `Telegram report ${chat} group ${i + 1}`, messages: g.messages }));
}
async function applyGroups(root, chat) {
  const groups = await readGroups(root, chat);
  const messages = new Map((await readMessages(root, chat)).map((m) => [m.id, m]));
  const dir = chatDir(root, chat);
  const out = [];
  for (const g of groups) {
    const missing = g.messages.filter((id) => !messages.has(id));
    if (missing.length > 0) {
      throw new LaunchwrightError("qa.intake.telegram.groups", `groups.json of chat ${chat} names messages that are not staged: ${missing.join(", ")}.`, { context: { chat, missing } });
    }
    const list = g.messages.map((id) => messages.get(id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byId(a, b));
    const [first, ...rest] = list;
    const media = [];
    for (const m of list) {
      for (const s of m.media) {
        const { file, ...meta } = s;
        media.push(file === void 0 ? meta : { ...meta, data: new Uint8Array(await readFile(join(dir, file))) });
      }
    }
    out.push(
      await writeIssue(root, {
        id: recordId("tg", chat, first.id),
        source: "telegram",
        ref: `${chat}#${list.map((m) => m.id).join(",")}`,
        title: g.title,
        reportedAt: first.at,
        reporter: first.author,
        text: first.text,
        thread: rest.map((m) => ({ at: m.at, author: m.author, text: m.text })),
        media
      })
    );
  }
  return out;
}

export {
  qaIntakeConfig,
  INTAKE_DRIVERS,
  maxBytesOf,
  createIntakeDriver,
  JOIN_GAP_MS,
  chatDir,
  cursorFile,
  readCursor,
  writeCursor,
  readMessages,
  stageBatch,
  proposeGroups,
  writeProposal,
  readGroups,
  applyGroups
};
//# sourceMappingURL=chunk-LRNSZYEL.js.map