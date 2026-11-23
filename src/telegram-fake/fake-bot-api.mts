// A fake Bot API at the `fetch` level: no network, no real Telegram. It answers each method with a
// default result, a scripted result, or a scripted failure, and records every call.
import type { FetchFn, TgUpdate } from './protocol.mts';

export const FAKE_API_URL = 'https://bot-api.test';

export interface RecordedCall {
  botId: number;
  method: string;
  params: Record<string, unknown>;
  /** The fake clock time of the call, when the test gave a clock. */
  at?: number;
}

export interface ScriptedFailure {
  error_code: number;
  description?: string;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
}

type Answer = unknown | ((params: Record<string, unknown>, call: RecordedCall) => unknown);

/**
 * A failed `fetch`. `network` has no error code (a bare `fetch failed`). `not_connected` has the
 * code of a connection that never opened (`ECONNREFUSED`). `reset` has `ECONNRESET`: the
 * connection opened, so Telegram may have taken the call.
 */
export type NetworkFailure = 'network' | 'not_connected' | 'reset';

interface FailureRule {
  method: string;
  failure: ScriptedFailure | NetworkFailure;
  times: number;
  match?: (params: Record<string, unknown>) => boolean;
}

/** The parameters of one Bot API request body: JSON or multipart. A file becomes its description. */
export async function readParams(init: RequestInit | undefined): Promise<Record<string, unknown>> {
  const body = init?.body;
  if (body === undefined || body === null) return {};
  if (typeof body === 'string') return JSON.parse(body) as Record<string, unknown>;
  if (body instanceof FormData) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of body.entries()) {
      if (typeof value === 'string') {
        try {
          out[key] = JSON.parse(value);
        } catch {
          out[key] = value;
        }
      } else out[key] = { filename: value.name, size: value.size, type: value.type };
    }
    return out;
  }
  throw new TypeError('The fake Bot API reads JSON and multipart bodies only.');
}

/** The webhook that a bot set with `setWebhook`. */
export interface FakeWebhook {
  url: string;
  secretToken?: string;
}

/** A Bot API `File`: what `getFile` answers. */
export interface FakeFile {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  file_path: string;
}

export class FakeBotApi {
  readonly calls: RecordedCall[] = [];
  private readonly answers = new Map<string, Answer>();
  private readonly failures: FailureRule[] = [];
  private readonly updates = new Map<number, TgUpdate[]>();
  private readonly webhooks = new Map<number, FakeWebhook>();
  private readonly profiles = new Map<number, { username: string; firstName: string }>();
  private readonly queueListeners = new Set<(botId: number) => void>();
  private readonly files = new Map<string, FakeFile>();
  private messageId = 1000;
  /** The time source of `RecordedCall.at`. */
  now: (() => number) | undefined;

  constructor(readonly apiUrl = FAKE_API_URL) {}

  /** Sets the result of a method: a value, or a function of the parameters. */
  on(method: string, answer: (params: Record<string, any>, call: RecordedCall) => unknown): this;
  on(method: string, answer: unknown): this;
  on(method: string, answer: Answer): this {
    this.answers.set(method, answer);
    return this;
  }

  /** The next `times` calls of `method` (that `match`) fail with `failure`. */
  fail(method: string, failure: ScriptedFailure | NetworkFailure, opts: { times?: number; match?: (params: Record<string, unknown>) => boolean } = {}): this {
    this.failures.push({ method, failure, times: opts.times ?? 1, ...(opts.match ? { match: opts.match } : {}) });
    return this;
  }

  /** Queues updates for `getUpdates` of a bot. */
  queueUpdates(botId: number, updates: TgUpdate[]): this {
    this.updates.set(botId, [...(this.updates.get(botId) ?? []), ...updates]);
    for (const listener of this.queueListeners) listener(botId);
    return this;
  }

  /** True when `getUpdates` of the bot with this offset has an update to return. */
  hasUpdates(botId: number, offset = 0): boolean {
    return (this.updates.get(botId) ?? []).some((u) => u.update_id >= offset);
  }

  /** Calls `listener` with the bot id after each `queueUpdates`. Returns the function that removes it. */
  onQueue(listener: (botId: number) => void): () => void {
    this.queueListeners.add(listener);
    return () => this.queueListeners.delete(listener);
  }

  /** The names that `getMe` answers for a bot. */
  describeBot(botId: number, profile: { username: string; firstName: string }): this {
    this.profiles.set(botId, profile);
    return this;
  }

  /** The webhook of a bot after `setWebhook`, or undefined after `deleteWebhook`. */
  webhookOf(botId: number): FakeWebhook | undefined {
    return this.webhooks.get(botId);
  }

  /** A file that `getFile` answers for its `file_id`. */
  registerFile(file: FakeFile): this {
    this.files.set(file.file_id, file);
    return this;
  }

  /** The next message id. The bot messages and the messages of a fake user share one sequence. */
  nextMessageId(): number {
    this.messageId += 1;
    return this.messageId;
  }

  callsOf(method: string): Array<Record<string, unknown>> {
    return this.calls.filter((c) => c.method === method).map((c) => c.params);
  }

  reset(): void {
    this.calls.length = 0;
    this.answers.clear();
    this.failures.length = 0;
    this.updates.clear();
    this.webhooks.clear();
  }

  private message(p: Record<string, unknown>): Record<string, unknown> {
    return { message_id: this.nextMessageId(), date: 1_700_000_000, chat: { id: p.chat_id, type: Number(p.chat_id) < 0 ? 'supergroup' : 'private' }, ...(p.text ? { text: p.text } : {}) };
  }

  private defaultAnswer(call: RecordedCall): unknown {
    const p = call.params;
    switch (call.method) {
      case 'getMe': {
        const profile = this.profiles.get(call.botId);
        return { id: call.botId, is_bot: true, first_name: profile?.firstName ?? `Bot ${call.botId}`, username: profile?.username ?? `bot${call.botId}_bot`, can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false };
      }
      case 'sendMessage':
      case 'sendPhoto':
      case 'sendVideo':
      case 'sendAnimation':
      case 'sendDocument':
      case 'sendAudio':
      case 'sendInvoice':
        return this.message(p);
      case 'copyMessage':
        return { message_id: this.nextMessageId() };
      case 'editMessageText':
        return { message_id: p.message_id, date: 1_700_000_000, chat: { id: p.chat_id, type: 'private' }, text: p.text };
      case 'editMessageReplyMarkup':
      case 'editMessageCaption':
        return p.inline_message_id === undefined ? { message_id: p.message_id, date: 1_700_000_000, chat: { id: p.chat_id, type: 'private' } } : true;
      case 'setWebhook':
        this.webhooks.set(call.botId, { url: String(p.url), ...(typeof p.secret_token === 'string' ? { secretToken: p.secret_token } : {}) });
        if (p.drop_pending_updates === true) this.updates.delete(call.botId);
        return true;
      case 'deleteWebhook':
        this.webhooks.delete(call.botId);
        if (p.drop_pending_updates === true) this.updates.delete(call.botId);
        return true;
      case 'getFile':
        return this.files.get(String(p.file_id)) ?? true;
      case 'getWebhookInfo':
        return { url: this.webhooks.get(call.botId)?.url ?? '', has_custom_certificate: false, pending_update_count: 0 };
      case 'getMyCommands':
        return [];
      case 'getUpdates': {
        const queued = this.updates.get(call.botId) ?? [];
        const offset = typeof p.offset === 'number' ? p.offset : 0;
        const pending = queued.filter((u) => u.update_id >= offset);
        this.updates.set(call.botId, pending);
        return pending.slice(0, typeof p.limit === 'number' ? p.limit : 100);
      }
      case 'getManagedBotToken':
        return `${p.user_id}:MANAGED-${p.user_id}-token-abcdefghijklmnop`;
      case 'createInvoiceLink':
        return `https://t.me/$invoice-${String(p.payload)}`;
      case 'getStarTransactions':
        return { transactions: [] };
      default:
        return true;
    }
  }

  /** The `fetch` to pass as `BotApiOptions.fetch`. */
  readonly fetch: FetchFn = async (input, init) => {
    const url = new URL(input);
    const m = /^\/bot(\d+):[^/]+\/(\w+)$/.exec(url.pathname);
    if (!m) return Response.json({ ok: false, error_code: 404, description: 'Not Found' }, { status: 404 });
    const call: RecordedCall = { botId: Number(m[1]), method: m[2] as string, params: await readParams(init), ...(this.now ? { at: this.now() } : {}) };
    this.calls.push(call);
    const rule = this.failures.find((f) => f.method === call.method && f.times > 0 && (!f.match || f.match(call.params)));
    if (rule) {
      rule.times -= 1;
      if (rule.failure === 'network') throw new TypeError('fetch failed');
      if (rule.failure === 'not_connected') throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });
      if (rule.failure === 'reset') throw new TypeError('fetch failed', { cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) });
      return Response.json({ ok: false, ...rule.failure }, { status: rule.failure.error_code });
    }
    const answer = this.answers.get(call.method);
    const result = answer === undefined ? this.defaultAnswer(call) : typeof answer === 'function' ? (answer as (p: Record<string, unknown>, c: RecordedCall) => unknown)(call.params, call) : answer;
    return Response.json({ ok: true, result });
  };
}
