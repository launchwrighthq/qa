import type { Container } from './services/container.mts';
import { LaunchwrightError, messageOf } from './services/errors.mts';

export interface EventDef<T> {
  readonly name: string;
  readonly __type?: T;
}

export function defineEvent<T>(name: string): EventDef<T> {
  return Object.freeze({ name }) as EventDef<T>;
}

export type EventHandler<T> = (payload: T, c: Container) => void | Promise<void>;
export type EventTransport = (name: string, payload: unknown) => Promise<void>;

export interface EventBus {
  /** Adds a handler. Returns a function that removes it. */
  on<T>(e: EventDef<T>, h: EventHandler<T>): () => void;
  /**
   * Runs every in-process handler in order, in one new container scope, then
   * forwards the event to the transport when one is set. A failed handler does
   * not stop the others; emit() then throws LaunchwrightError('kernel.event.handler').
   */
  emit<T>(e: EventDef<T>, payload: T): Promise<void>;
  /** Sets the transport that forwards each event out of the process (the queue module's outbox). */
  setTransport(t: EventTransport): void;
}

export function createEventBus(container: Container): EventBus {
  const handlers = new Map<string, Array<EventHandler<unknown>>>();
  let transport: EventTransport | undefined;

  return {
    on<T>(e: EventDef<T>, h: EventHandler<T>): () => void {
      const list = handlers.get(e.name) ?? [];
      list.push(h as EventHandler<unknown>);
      handlers.set(e.name, list);
      return () => {
        const current = handlers.get(e.name) ?? [];
        handlers.set(
          e.name,
          current.filter((x) => x !== h),
        );
      };
    },

    async emit<T>(e: EventDef<T>, payload: T): Promise<void> {
      const list = [...(handlers.get(e.name) ?? [])];
      const errors: unknown[] = [];
      if (list.length > 0) {
        const scope = container.createScope();
        for (const h of list) {
          try {
            await h(payload, scope);
          } catch (err) {
            errors.push(err);
          }
        }
        await scope.dispose();
      }
      if (transport) await transport(e.name, payload);
      if (errors.length > 0) {
        throw new LaunchwrightError(
          'kernel.event.handler',
          `${errors.length} handler(s) of event "${e.name}" failed: ${errors.map(messageOf).join('; ')}`,
          { cause: errors.length === 1 ? errors[0] : new AggregateError(errors), context: { event: e.name } },
        );
      }
    },

    setTransport(t: EventTransport): void {
      transport = t;
    },
  };
}
