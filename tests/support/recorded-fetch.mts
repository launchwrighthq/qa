// A `fetch` that answers from a recorded HTTP file (format 1 of the framework testing module). The
// device and intake tests read the recordings under `fixtures/http/`.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { LaunchwrightError } from '../../src/kernel/index.mts';

interface HttpExchange {
  request: { method: string; url: string; body?: string | object };
  response: { status: number; headers: Record<string, string>; body?: string | object };
}

function sameBody(recorded: string | object | undefined, text: string): boolean {
  if (recorded === undefined) return true;
  if (typeof recorded === 'string') return recorded === text;
  if (text === '') return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    // A request body that is not JSON cannot equal a recorded JSON body: no match.
    if (err instanceof SyntaxError) return false;
    throw err;
  }
  return isDeepStrictEqual(parsed, recorded);
}

/**
 * Each request takes the first unused exchange with the same method, URL and body, so equal
 * requests get the answers in order. An unmatched request rejects with `testing.http`.
 */
export function recordedFetch(path: string): typeof fetch & { remaining(): number } {
  const recording = JSON.parse(readFileSync(path, 'utf8')) as { format: number; exchanges: HttpExchange[] };
  if (recording.format !== 1 || !Array.isArray(recording.exchanges)) {
    throw new LaunchwrightError('testing.http', `${path} is not a recorded HTTP file of format 1.`, { context: { path } });
  }
  const exchanges = recording.exchanges;
  const used = new Set<number>();

  const answer = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const method = request.method.toUpperCase();
    const body = await request.text();
    const index = exchanges.findIndex((e, i) => !used.has(i) && e.request.method.toUpperCase() === method && e.request.url === request.url && sameBody(e.request.body, body));
    const found = exchanges[index];
    if (!found) {
      throw new LaunchwrightError('testing.http', `No recorded exchange in ${path} matches ${method} ${request.url}.`, { context: { path, method, url: request.url } });
    }
    used.add(index);
    const { status, headers, body: recorded } = found.response;
    const text = recorded === undefined ? null : typeof recorded === 'string' ? recorded : JSON.stringify(recorded);
    return new Response(text, { status, headers });
  };

  return Object.assign(answer as typeof fetch, { remaining: () => exchanges.length - used.size });
}
