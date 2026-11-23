// Who acts (spec 2.11.4). One shape for `rbac`, `audit`, `approvals`, `auth`, `api` and `console`.

/** The channel of a call. `system` is a job or a command of the project. */
export type ActorVia = 'session' | 'api-key' | 'mcp' | 'system';

/** The channels of `ActorVia`, in a fixed order. */
export const ACTOR_VIAS: readonly ActorVia[] = ['session', 'api-key', 'mcp', 'system'];

/**
 * Who acts. The `auth` and `api` guards build it per request. Never build it from request input.
 * During an impersonation, `userId` is the impersonated user and `impersonatorId` is the real
 * user; the permissions are those of `userId`. A system actor holds every leaf.
 */
export interface Actor {
  userId: string;
  tenantId: string;
  via?: ActorVia;
  /** The real user during an impersonation. */
  impersonatorId?: string;
  /** The leaves that a key or token may use. Absent: every leaf of the user. */
  scopes?: readonly string[];
}

/** The state of a user account. `deleted`: the user row is gone. */
export type AccountStatus = 'active' | 'blocked' | 'deleted';

/**
 * Reads the state of a user account. The `auth` provider binds it under `ACCOUNTS`. The `api`
 * module reads it, so the key or token of a blocked or deleted user stops working (F1).
 */
export interface AccountStatusReader {
  status(tenantId: string, userId: string): Promise<AccountStatus>;
}
