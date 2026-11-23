// `GET /__qa/persona/<id>` (spec 2.6): the user that the QA world seeded for a persona, so both
// persona checks compare a session route answer with that user id. 404 for an unseeded persona.
import { isCodedError } from '../kernel/index.mts';
import { type HandlerArgs, loadAuth, loadDb, loadHttp, type RequestContext } from '../services/peers.mts';
import { idProblem, personaIds, QA_PROVIDER } from '../world/services/ids.mts';

/** The body of `GET /__qa/persona/<id>`. */
export interface QaPersonaBody {
  persona: string;
  userId: string;
  telegramId: number;
}

/** The seeded auth user of `persona` and its tenant. Throws 400 for a bad id, 404 `qa.persona.unseeded`, 403 for a blocked user. */
export async function seededUser(ctx: RequestContext, persona: string): Promise<{ userId: string; tenantId: string }> {
  const { HttpError } = await loadHttp();
  const bad = idProblem(persona);
  if (bad) throw new HttpError(400, 'qa.persona.id', `${persona} is not a persona id: ${bad}.`);
  const auth = await loadAuth();
  const { DEFAULT_TENANT_ID } = await loadDb();
  const tenantId = auth.requestTenant(ctx) ?? DEFAULT_TENANT_ID;
  const account = personaIds(persona).accountId;
  try {
    const { user } = await ctx.get(auth.USERS).resolve(tenantId, { provider: QA_PROVIDER, subject: persona }, { mergeVerifiedEmail: false, signUp: false });
    if (user.status !== 'active') throw new HttpError(403, 'qa.persona.blocked', `The user of ${account} is blocked.`);
    return { userId: user.id, tenantId };
  } catch (cause) {
    if (isCodedError(cause) && cause.code === 'auth.signup.closed') {
      throw new HttpError(404, 'qa.persona.unseeded', `Persona ${persona} has no account ${account} in the QA world. Run lw qa world reset.`, { cause });
    }
    throw cause;
  }
}

export async function showPersona({ ctx }: HandlerArgs): Promise<QaPersonaBody> {
  const persona = ctx.params.id ?? '';
  const { userId } = await seededUser(ctx, persona);
  return { persona, userId, telegramId: personaIds(persona).telegramId };
}
