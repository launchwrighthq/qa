// Reviewer comments and their anchors (spec 2.9, R9). A comment points at a step, a text range, a
// screenshot region, a video time or a named flow. The store is one JSON file per report slug under
// `.lw/qa/comments/<slug>.json`, out of git. Every reader and writer uses these shapes.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LaunchwrightError } from '../kernel/index.mts';
import { readTextOrNull } from '../kernel/services/fs.mts';

/** The store folder, relative to the project root. `.lw/` is out of git. */
export const COMMENTS_DIR = '.lw/qa/comments';

/** The anchor kinds a comment may carry (spec 2.9). */
export const ANCHOR_KINDS = ['step', 'text', 'region', 'time', 'flow'] as const;

/** A comment on a row, a leg, an attempt and an act step index (spec 2.9). */
export interface StepAnchor {
  kind: 'step';
  row: string;
  leg: string;
  attempt: number;
  step: number;
}

/** A comment on a word or phrase range in a report section (spec 2.9). */
export interface TextAnchor {
  kind: 'text';
  section: string;
  quote: string;
  /** Character offsets of the range in the section, when the viewer knows them. */
  start?: number;
  end?: number;
}

/** A comment on a normalized rectangle of a screenshot (spec 2.9). Each of `x`, `y`, `w`, `h` is 0..1. */
export interface RegionAnchor {
  kind: 'region';
  /** The report-relative screenshot path, `assets/<slug>/<file>`. */
  screenshot: string;
  row: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A comment on a timestamp range of a video, in seconds (spec 2.9). */
export interface TimeAnchor {
  kind: 'time';
  /** The report-relative video path, `assets/<slug>/<file>`. */
  video: string;
  row: string;
  start: number;
  end?: number;
  /** The act step active at that time, when the viewer knows it. */
  step?: number;
}

/** A comment on a named row or path (spec 2.9). */
export interface FlowAnchor {
  kind: 'flow';
  name: string;
}

export type CommentAnchor = StepAnchor | TextAnchor | RegionAnchor | TimeAnchor | FlowAnchor;

/** One reply under a comment. */
export interface CommentReply {
  author: string;
  body: string;
  createdAt: string;
}

/** One reviewer comment (spec 2.9). `status` stays `open` until an agent or reviewer resolves it. */
export interface Comment {
  id: string;
  anchor: CommentAnchor;
  author: string;
  body: string;
  createdAt: string;
  status: 'open' | 'resolved';
  replies: CommentReply[];
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFraction = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Every problem of an anchor, each a short line. An empty list means the anchor is valid. */
export function validateAnchor(anchor: unknown): string[] {
  if (!isObject(anchor)) return ['the anchor is not an object'];
  const kind = anchor.kind;
  if (typeof kind !== 'string' || !(ANCHOR_KINDS as readonly string[]).includes(kind)) {
    return [`kind "${String(kind)}" is not one of ${ANCHOR_KINDS.join(', ')}`];
  }
  const out: string[] = [];
  const need = (field: string, ok: boolean, why: string): void => {
    if (!ok) out.push(`${kind} anchor: ${field} ${why}`);
  };
  if (kind === 'step') {
    need('row', isText(anchor.row), 'is missing');
    need('leg', isText(anchor.leg), 'is missing');
    need('attempt', Number.isInteger(anchor.attempt) && (anchor.attempt as number) > 0, 'must be a positive integer');
    need('step', Number.isInteger(anchor.step) && (anchor.step as number) > 0, 'must be a positive integer');
  } else if (kind === 'text') {
    need('section', isText(anchor.section), 'is missing');
    need('quote', isText(anchor.quote), 'is missing');
  } else if (kind === 'region') {
    need('screenshot', isText(anchor.screenshot), 'is missing');
    need('row', isText(anchor.row), 'is missing');
    for (const f of ['x', 'y', 'w', 'h'] as const) need(f, isFraction(anchor[f]), 'must be a fraction from 0 to 1');
  } else if (kind === 'time') {
    need('video', isText(anchor.video), 'is missing');
    need('row', isText(anchor.row), 'is missing');
    need('start', typeof anchor.start === 'number' && anchor.start >= 0, 'must be a number of seconds');
  } else {
    need('name', isText(anchor.name), 'is missing');
  }
  return out;
}

/** The fields a caller gives to create a comment. The server supplies `createdAt` from its clock. */
export interface NewComment {
  anchor: CommentAnchor;
  author: string;
  body: string;
  createdAt: string;
  /** A test passes a stable id; otherwise a random uuid. */
  id?: string;
}

/** A full comment from the fields of `NewComment`. Throws `qa.comment.anchor` for a bad anchor. */
export function makeComment(input: NewComment): Comment {
  const problems = validateAnchor(input.anchor);
  if (problems.length > 0) {
    throw new LaunchwrightError('qa.comment.anchor', `The comment anchor is invalid: ${problems.join('; ')}`, { context: { problems } });
  }
  return { id: input.id ?? randomUUID(), anchor: input.anchor, author: input.author, body: input.body, createdAt: input.createdAt, status: 'open', replies: [] };
}

/** `list` with `comment` appended. Throws `qa.comment.duplicate` when its id is already present. */
export function addComment(list: readonly Comment[], comment: Comment): Comment[] {
  if (list.some((c) => c.id === comment.id)) {
    throw new LaunchwrightError('qa.comment.duplicate', `A comment with id ${comment.id} already exists.`, { context: { id: comment.id } });
  }
  return [...list, comment];
}

/** `list` with `reply` added under comment `id`. Throws `qa.comment.missing` when no such comment. */
export function replyToComment(list: readonly Comment[], id: string, reply: CommentReply): Comment[] {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError('qa.comment.missing', `No comment ${id} to reply to.`, { context: { id } });
  return list.map((c) => (c.id === id ? { ...c, replies: [...c.replies, reply] } : c));
}

/** `list` with the status of comment `id` set. Throws `qa.comment.missing` when no such comment. */
export function setStatus(list: readonly Comment[], id: string, status: Comment['status']): Comment[] {
  if (!list.some((c) => c.id === id)) throw new LaunchwrightError('qa.comment.missing', `No comment ${id} to update.`, { context: { id } });
  return list.map((c) => (c.id === id ? { ...c, status } : c));
}

/** The persistence of the comments of one slug, injected so a test uses a temp folder. */
export interface CommentStore {
  read(slug: string): Promise<Comment[]>;
  write(slug: string, comments: readonly Comment[]): Promise<void>;
}

/** The store file of a slug, `<dir>/<slug>.json`. Throws `qa.comment.slug` for an unsafe slug. */
export function commentsFile(dir: string, slug: string): string {
  if (!SLUG.test(slug)) throw new LaunchwrightError('qa.comment.slug', `A report slug is "${slug}", which is not a safe file name.`, { context: { slug } });
  return join(dir, `${slug}.json`);
}

/** A comment store that writes one JSON file per slug under `dir`. The file holds `{ slug, comments }`. */
export function fileCommentStore(dir: string): CommentStore {
  return {
    async read(slug) {
      const text = await readTextOrNull(commentsFile(dir, slug));
      if (text === null) return [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new LaunchwrightError('qa.comment.read', `The comment store ${commentsFile(dir, slug)} is not JSON.`, { cause, context: { slug } });
      }
      if (!isObject(parsed) || !Array.isArray(parsed.comments)) {
        throw new LaunchwrightError('qa.comment.read', `The comment store ${commentsFile(dir, slug)} has no comments array.`, { context: { slug } });
      }
      return parsed.comments as Comment[];
    },
    async write(slug, comments) {
      const file = commentsFile(dir, slug);
      await mkdir(dir, { recursive: true });
      await writeFile(file, `${JSON.stringify({ slug, comments }, null, 2)}\n`);
    },
  };
}
