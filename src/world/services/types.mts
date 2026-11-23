// The shapes of the QA world (spec 2.5.1): a persona is a state of a user, a fact is a state of
// the product data. A QA row names a persona, facts and a route.
import type { App } from '@launchwrighthq/kernel';

/** What a seed gets: the booted QA app and the tenant of the world. */
export interface WorldCtx {
  /** The QA app, booted on the QA database. A seed writes through its services, never raw SQL. */
  app: App;
  /** The tenant of every seeded row. One world is one tenant. */
  tenantId: string;
}

/** The ids that the world gives a persona. They are pure functions of the persona id. */
export interface PersonaIds {
  persona: string;
  /** `qa:<persona>`: the subject of the `qa` identity that `POST /__qa/session` signs in. */
  accountId: string;
  /** `qaTelegramId(persona)`: the Telegram id of the persona's Mini App launch. */
  telegramId: number;
}

/** What a persona seed returns. `userId` is the auth user that the seed made or reused. */
export interface PersonaHandles {
  userId: string;
  readonly [key: string]: string | number;
}

/** The handles that a fact seed returns, for the route parameters of a row (`/shelf/{shelfId}`). */
export type FactHandles = Readonly<Record<string, string | number>>;

/** A user in a named state. */
export interface Persona {
  /** Kebab case or dotted, unique in the registry, for example `member-expiring`. */
  id: string;
  /** One line in a user's words. The report prints it beside the shot. */
  summary: string;
  seed(ctx: WorldCtx, ids: PersonaIds): Promise<PersonaHandles>;
}

/** What `arm` gets: the world context, the persona of the row, and the undo recorder. */
export interface ArmCtx extends WorldCtx {
  persona?: PersonaIds;
  /**
   * Persists one undo step before the change that it undoes. A process that stops between the
   * two leaves a step that undoes nothing, never a change that no step names.
   */
  record(step: unknown): Promise<void>;
}

/** A state of the product data. */
export interface Fact {
  /** Kebab case or dotted, unique in the registry, for example `catalog.empty-shelf`. */
  id: string;
  summary: string;
  /**
   * The handle names that the seed returns, declared so a planner can match route parameters
   * without a database. `lw qa world reset` refuses a seed that does not return each one.
   */
  handleKeys: readonly string[];
  seed(ctx: WorldCtx): Promise<FactHandles>;
  /** Makes the fact true on a live QA world (`lw qa fixture arm`). Each change records its undo step first. */
  arm?(ctx: ArmCtx): Promise<void>;
  /** Replays one undo step that `arm` recorded (`lw qa fixture disarm`). */
  undo?(ctx: WorldCtx, step: unknown): Promise<void>;
}

/** What one `<feature>.world.mts` exports as default. */
export interface FeatureWorld {
  personas?: readonly Persona[];
  facts?: readonly Fact[];
}

/** A persona or a fact with the feature of its world file. */
export type Owned<T> = T & { feature: string; file: string };

/** Every persona and fact of the project, in seed order. */
export interface WorldRegistry {
  personas: readonly Owned<Persona>[];
  facts: readonly Owned<Fact>[];
}

/** One registry entry as plain data: what `lw qa world list --json` prints. */
export interface WorldEntry {
  kind: 'persona' | 'fact';
  id: string;
  summary: string;
  feature: string;
  /** A fact's declared handle names. */
  handleKeys?: readonly string[];
  /** What the seed returned. Present in the stamp of a reset. */
  handles?: Readonly<Record<string, string | number>>;
}
