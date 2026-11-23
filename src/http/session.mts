// `POST /__qa/session {persona}` (spec 2.6): signs a seeded persona in on the web surface. It
// issues a session through the `auth` service for the user of account `qa:<persona>`, then asks
// the session route (config `qa.sessionRoute`, default the `auth` route `session.current`) which
// user the new cookie opens. `qaSessionProblem` compares it with the seeded user, the same
// comparison as the Mini App launch. That check is the source `qaAssertSeeded`.
import { request } from 'node:http';
import { CONFIG } from '../kernel/index.mts';
import type { QaConfig } from '../config.mts';
import { type HandlerArgs, loadAuth, loadHttp } from '../services/peers.mts';
import { personaIds, QA_PROVIDER, qaAccountId } from '../world/services/ids.mts';
import { isLoopbackHost } from '../world/services/stack.mts';
import { seededUser } from './persona.mts';

/** Why a session route answer is not the seeded persona. */
interface QaSessionProblem {
  kind: 'created' | 'mismatch';
  message: string;
}

/**
 * The one comparison of both persona checks: the session route must open the user that the QA world
 * seeded. Null when it does. Inlined from client (services/qa-persona.mts), identical in behaviour,
 * so the engine needs no client peer.
 */
function qaSessionProblem(persona: string, expectedUserId: string, answer: { userId?: unknown; created?: unknown }): QaSessionProblem | null {
  if (typeof answer.userId === 'string' && answer.userId === expectedUserId) return null;
  const account = qaAccountId(persona);
  if (answer.created === true) {
    return { kind: 'created', message: `The sign-in created a new user instead of opening ${account}. Seed the QA world again with \`lw qa world reset\`` };
  }
  return { kind: 'mismatch', message: `The sign-in opens user ${String(answer.userId)}, not user ${expectedUserId} of ${account}. Seed the QA world again with \`lw qa world reset\`` };
}

/** The longest wait for the session route. */
const CHECK_TIMEOUT_MS = 10_000;

/** The body of a persona sign-in. The response also carries the session cookie. */
export interface QaSessionBody {
  persona: string;
  accountId: string;
  userId: string;
  telegramId: number;
}

/** The user that a session route answers: `userId`, `user.id` or `session.userId`. */
function userIdOf(body: unknown): unknown {
  const b = (body ?? {}) as { userId?: unknown; user?: { id?: unknown }; session?: { userId?: unknown } };
  return b.userId ?? b.user?.id ?? b.session?.userId;
}

/** A GET over node:http on loopback, with no keep-alive socket and no timer that outlives it. */
function get(url: string, headers: Record<string, string>): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers, agent: false, timeout: CHECK_TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 502, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`no answer in ${CHECK_TIMEOUT_MS} ms`)));
    req.on('error', reject);
    req.end();
  });
}

async function askSessionRoute(url: string, cookie: string): Promise<unknown> {
  const { HttpError } = await loadHttp();
  const path = new URL(url).pathname;
  let res: { status: number; text: string };
  try {
    res = await get(url, { cookie, accept: 'application/json' });
  } catch (cause) {
    throw new HttpError(502, 'qa.session.check', `The session route ${path} did not answer.`, { cause });
  }
  if (res.status < 200 || res.status > 299) throw new HttpError(502, 'qa.session.check', `The session route ${path} answered ${res.status} for the new session. Check config qa.sessionRoute.`);
  try {
    return userIdOf(JSON.parse(res.text));
  } catch (cause) {
    throw new HttpError(502, 'qa.session.check', `The session route ${path} did not answer JSON.`, { cause });
  }
}

export async function startSession({ ctx, input }: HandlerArgs<{ persona?: unknown }>): Promise<Response> {
  const { HttpError } = await loadHttp();
  const persona = typeof input?.persona === 'string' ? input.persona : '';
  // The check sends the new session cookie to this origin, so the origin must be this machine.
  if (!isLoopbackHost(ctx.url.hostname)) throw new HttpError(403, 'qa.session.origin', 'Call /__qa/session on a loopback address of the QA API.');
  const { userId, tenantId } = await seededUser(ctx, persona);
  const auth = await loadAuth();
  const sessions = ctx.get(auth.SESSIONS);
  const { token, session } = await sessions.create({ tenantId, userId, method: QA_PROVIDER, place: auth.placeOf(ctx.req, ctx.ip) });
  const route = ctx.get(CONFIG).section<QaConfig>('qa').sessionRoute;
  const seen = await askSessionRoute(new URL(route, ctx.url.origin).toString(), `${sessions.settings.cookie}=${token}`);
  const problem = qaSessionProblem(persona, userId, { userId: seen });
  if (problem) throw new HttpError(409, 'qa.session.mismatch', problem.message);
  const ids = personaIds(persona);
  const body: QaSessionBody = { persona, accountId: ids.accountId, userId, telegramId: ids.telegramId };
  return Response.json(body, { headers: { 'set-cookie': sessions.cookie(token, session) } });
}
