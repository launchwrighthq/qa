// Telegram intake steps (spec 2.15.3). A read stages the messages and their media under
// `.lw/qa/intake/telegram/<chat>/` and proposes groups. The agent reviews the proposal and writes
// `groups.json`. The apply step then writes one issue record per group.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchwrightError, z } from '@launchwrighthq/kernel';
import { readJsonOrNull } from '@launchwrighthq/kernel/fs';
import { extensionOf, INTAKE_DIR, type QaIssue, recordId, writeIssue } from '@launchwrighthq/qa';
import type { IntakeBatch, RawItem, RawMedia } from '../drivers/intake/contract.mts';

/** Messages of one author less than this far apart join one group. */
export const JOIN_GAP_MS = 15 * 60 * 1000;

/** A staged media: the media without its bytes, and the file that holds them. */
export type StoredMedia = Omit<RawMedia, 'data'> & { file?: string };
export type StoredMessage = Omit<RawItem, 'media'> & { media: StoredMedia[] };

export interface Group {
  title: string;
  /** Message ids, the first message first. */
  messages: string[];
}

const groupsFile = z.object({
  groups: z.array(z.object({ title: z.string().min(1).optional(), messages: z.array(z.union([z.string(), z.number()]).transform(String)).min(1) })),
});

function chatName(chat: string): string {
  return recordId(chat);
}

/** The staging folder of one chat. */
export function chatDir(root: string, chat: string): string {
  return join(root, INTAKE_DIR, 'telegram', chatName(chat));
}

/** The cursor file of one chat: `.lw/qa/intake/telegram/<chat>.cursor`. */
export function cursorFile(root: string, chat: string): string {
  return join(root, INTAKE_DIR, 'telegram', `${chatName(chat)}.cursor`);
}

/** The JSON of `file`, or `fallback` when it does not exist. */
async function jsonOr<T>(file: string, fallback: T): Promise<T> {
  return ((await readJsonOrNull(file)) as T | null) ?? fallback;
}

/** The cursor of a driver for a chat, or undefined. */
export async function readCursor(root: string, chat: string, driver: string): Promise<string | undefined> {
  const all = await jsonOr<Record<string, string>>(cursorFile(root, chat), {});
  return all[driver];
}

export async function writeCursor(root: string, chat: string, driver: string, cursor: string): Promise<void> {
  const file = cursorFile(root, chat);
  const all = await jsonOr<Record<string, string>>(file, {});
  all[driver] = cursor;
  await mkdir(join(root, INTAKE_DIR, 'telegram'), { recursive: true });
  await writeFile(file, `${JSON.stringify(all, null, 2)}\n`);
}

/** The staged messages of a chat, oldest first. */
export function readMessages(root: string, chat: string): Promise<StoredMessage[]> {
  return jsonOr<StoredMessage[]>(join(chatDir(root, chat), 'messages.json'), []);
}

const byId = (a: { id: string }, b: { id: string }): number => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);

/** Adds the items of a batch to the staged messages of the chat. A message read again replaces the old copy. */
export async function stageBatch(root: string, chat: string, batch: IntakeBatch): Promise<StoredMessage[]> {
  const dir = chatDir(root, chat);
  await mkdir(join(dir, 'media'), { recursive: true });
  const all = new Map((await readMessages(root, chat)).map((m) => [m.id, m]));
  for (const item of batch.items) {
    const media: StoredMedia[] = [];
    for (const [i, m] of item.media.entries()) {
      const { data, ...rest } = m;
      if (data === undefined) {
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
  await writeFile(join(dir, 'messages.json'), `${JSON.stringify(messages, null, 2)}\n`);
  return messages;
}

/**
 * Proposes one group per reply chain, and joins messages of one author less than 15 minutes
 * apart. The title names the chat and the first message, so no chat text reaches a listing.
 */
export function proposeGroups(chat: string, messages: Pick<StoredMessage, 'id' | 'at' | 'author' | 'replyTo'>[]): Group[] {
  const sorted = [...messages].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byId(a, b));
  const parent = new Map(sorted.map((m) => [m.id, m.id]));
  const find = (id: string): string => {
    let at = id;
    while (parent.get(at) !== at) at = parent.get(at) as string;
    parent.set(id, at);
    return at;
  };
  const join = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const lastOf = new Map<string, { id: string; at: number }>();
  for (const m of sorted) {
    if (m.replyTo !== undefined && parent.has(m.replyTo)) join(m.replyTo, m.id);
    const at = Date.parse(m.at);
    const prev = lastOf.get(m.author);
    if (prev && at - prev.at < JOIN_GAP_MS) join(prev.id, m.id);
    lastOf.set(m.author, { id: m.id, at });
  }
  const groups = new Map<string, string[]>();
  for (const m of sorted) {
    const root = find(m.id);
    groups.set(root, [...(groups.get(root) ?? []), m.id]);
  }
  return [...groups.values()].map((ids) => ({ title: `Telegram report ${chat}/${ids[0]} (${ids.length} ${ids.length === 1 ? 'message' : 'messages'})`, messages: ids }));
}

/** Writes `groups.proposed.json` and returns its path. */
export async function writeProposal(root: string, chat: string, groups: Group[]): Promise<string> {
  const file = join(chatDir(root, chat), 'groups.proposed.json');
  await mkdir(chatDir(root, chat), { recursive: true });
  await writeFile(file, `${JSON.stringify({ chat, groups }, null, 2)}\n`);
  return file;
}

/** Reads `groups.json`, which the agent writes after the review. */
export async function readGroups(root: string, chat: string): Promise<Group[]> {
  const file = join(chatDir(root, chat), 'groups.json');
  const raw = await jsonOr<unknown>(file, null);
  if (raw === null) {
    throw new LaunchwrightError('qa.intake.telegram.groups', `No groups.json for chat ${chat}. Review groups.proposed.json and write groups.json beside it.`, { context: { chat } });
  }
  const parsed = groupsFile.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new LaunchwrightError('qa.intake.telegram.groups', `groups.json of chat ${chat} is not valid: ${problems}`, { context: { chat } });
  }
  return parsed.data.groups.map((g, i) => ({ title: g.title ?? `Telegram report ${chat} group ${i + 1}`, messages: g.messages }));
}

/** Writes one issue record per group of `groups.json`. An unknown message id fails `qa.intake.telegram.groups`. */
export async function applyGroups(root: string, chat: string): Promise<QaIssue[]> {
  const groups = await readGroups(root, chat);
  const messages = new Map((await readMessages(root, chat)).map((m) => [m.id, m]));
  const dir = chatDir(root, chat);
  const out: QaIssue[] = [];
  for (const g of groups) {
    const missing = g.messages.filter((id) => !messages.has(id));
    if (missing.length > 0) {
      throw new LaunchwrightError('qa.intake.telegram.groups', `groups.json of chat ${chat} names messages that are not staged: ${missing.join(', ')}.`, { context: { chat, missing } });
    }
    const list = g.messages.map((id) => messages.get(id) as StoredMessage).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byId(a, b));
    const [first, ...rest] = list as [StoredMessage, ...StoredMessage[]];
    const media: RawMedia[] = [];
    for (const m of list) {
      for (const s of m.media) {
        const { file, ...meta } = s;
        media.push(file === undefined ? meta : { ...meta, data: new Uint8Array(await readFile(join(dir, file))) });
      }
    }
    out.push(
      await writeIssue(root, {
        id: recordId('tg', chat, first.id),
        source: 'telegram',
        ref: `${chat}#${list.map((m) => m.id).join(',')}`,
        title: g.title,
        reportedAt: first.at,
        reporter: first.author,
        text: first.text,
        thread: rest.map((m) => ({ at: m.at, author: m.author, text: m.text })),
        media,
      }),
    );
  }
  return out;
}
