import { IncomingHttpHeaders } from 'node:http';
import { C as Clock } from './clock-BUdCJ9bN.js';

/** The kinds of fault. `slow` holds the answer and then answers 200. */
type FaultKind = '503' | '429' | '410' | '302' | 'slow';
/** One parsed rule. `count` or `ratio` limits it; without both it fires on every request. */
interface FaultRule {
    /** The rule as written, for the record and the messages. */
    text: string;
    kind: FaultKind;
    /** The `Location` of a `302` rule. */
    location?: string;
    /** The hold time of a `slow` rule in ms. */
    ms?: number;
    /** The rule fires on this many requests, then stops. */
    count?: number;
    /** The rule fires on each request with this probability, drawn from the seeded random source. */
    ratio?: number;
}
/** What the sink answers to one request. */
interface Reply {
    status: number;
    headers: Record<string, string>;
    body: string;
    /** The time the sink holds the answer, in ms. */
    holdMs: number;
}
/** The `Retry-After` value of a `429` answer, in seconds. */
declare const RETRY_AFTER_S = 30;
/** The answer when no rule fires. */
declare const OK_REPLY: Reply;
/**
 * Parses one rule: `503`, `429`, `410`, `302:<url>` or `slow:<ms>`, then `x<count>` or
 * `@<ratio from 0 to 1>`. A `302` URL must not end in `x<digits>` or `@<number>`: that text is read
 * as the count or the ratio. Throws `qa.sink.fault`.
 */
declare function parseFault(text: string): FaultRule;
/** Parses each rule. Throws `qa.sink.fault` for the first bad one. */
declare function parseFaults(texts: readonly string[]): FaultRule[];
/** The answer of a rule that fires. */
declare function replyOf(rule: FaultRule): Reply;
/**
 * A repeatable random source in [0, 1) (mulberry32), so a ratio rule gives the same answers for the
 * same seed. `@launchwrighthq/testing` has the same function for tests; product code does not import
 * the testing package.
 */
declare function seededSource(seed: number): () => number;
/**
 * The rules of one sink run. `next()` walks the rules in order for each request and the first rule
 * that fires answers. A count rule fires on its first N turns. A ratio rule draws one random value
 * on each turn. Without a firing rule the answer is 200 `ok`.
 */
declare class FaultPlan {
    private readonly rules;
    private readonly random;
    private readonly used;
    constructor(rules: readonly FaultRule[], random: () => number);
    next(): {
        rule: FaultRule | null;
        reply: Reply;
    };
    private fires;
}

/** The text that replaces a masked header value. */
declare const MASK = "[masked]";
/**
 * Header names whose values are secrets: credentials, cookies, every `x-*-token`, the Telegram
 * webhook secret, and any name that holds `secret`, `token`, `key` or `signature`.
 */
declare const SECRET_HEADER: RegExp;
/** Header names that a tunnel adds with the address of the sender. Their values are masked too. */
declare const ADDRESS_HEADER: RegExp;
/** The body bytes that a record keeps. A longer body is cut and the record says so. */
declare const MAX_BODY_BYTES: number;
/** The headers of a request, with each secret or address value replaced by `[masked]`. */
declare function maskHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]>;
/** One request as the sink records it: one line of the JSON Lines file. */
interface SinkRecord {
    /** The number of the request in this run, from 1. */
    n: number;
    /** The time the request arrived, ISO 8601. */
    at: string;
    method: string;
    url: string;
    path: string;
    headers: Record<string, string | string[]>;
    body: string;
    bodyBytes: number;
    bodyTruncated?: true;
    /** The rule that answered, as written, or null for the plain 200. */
    fault: string | null;
    answered: {
        status: number;
        headers: Record<string, string>;
        heldMs: number;
    };
    /** True when the sender closed the connection before the sink answered. */
    closedEarly?: true;
}
interface SinkOptions {
    /** The fault rules, parsed or as text. */
    faults?: ReadonlyArray<FaultRule | string>;
    /** The JSON Lines file. Without it the sink keeps the records in memory only. */
    file?: string;
    /** The port on 127.0.0.1. Default 0: a free port. */
    port?: number;
    /** The seed of the random source of ratio rules. Default 1. */
    seed?: number;
    /** The clock of the timestamps and of the `slow` hold. Default `systemClock`. */
    clock?: Clock;
    /** The body bytes that a record keeps. Default 1 MiB. */
    maxBodyBytes?: number;
    /** Called when a request arrives (`'arrived'`) and when its record is final (`'done'`). */
    onRecord?: (record: SinkRecord, phase: 'arrived' | 'done') => void;
}
/** A running sink. `close()` stops it and waits for the last record line. */
interface Sink {
    port: number;
    /** `http://127.0.0.1:<port>`. */
    url: string;
    records: SinkRecord[];
    file?: string;
    close(): Promise<void>;
}
/**
 * Starts the sink on 127.0.0.1. Rejects with `qa.sink.listen` when the port is taken, and with
 * `qa.sink.fault` for a bad rule. A failed write of the record file closes nothing: `close()` then
 * rejects with `qa.sink.write`.
 */
declare function startSink(opts?: SinkOptions): Promise<Sink>;

export { ADDRESS_HEADER, type FaultKind, FaultPlan, type FaultRule, MASK, MAX_BODY_BYTES, OK_REPLY, RETRY_AFTER_S, type Reply, SECRET_HEADER, type Sink, type SinkOptions, type SinkRecord, maskHeaders, parseFault, parseFaults, replyOf, seededSource, startSink };
