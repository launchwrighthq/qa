---
name: lw-qa-world
description: Use to make a feature testable by QA. Add a persona (a user in a named state) or a fact (a state of the product data) in a .world.mts file, make a state union reachable live, mounted or intercepted, or fix a finding of lw qa check (C1, C3, C4, S1, S3, wait). Use for "add a QA persona", "seed this state for QA", "lw qa check fails", "make this state triggerable", "QA cannot reach this screen".
---

# The QA world

A QA pass reaches a state by being a different user or by changing the data, never by telling a
component that it is under test. This skill adds the personas, facts and mounts that make each
state reachable. The rule `qa-testability` lists the rules, and `lw qa check` enforces them.

## 1. Add a world file

A feature with a visible state has `<feature>.world.mts` beside its `.feature.mts`, or in a
`qa/` folder. `lw qa world` finds each file by its suffix.

```ts
import { defineWorld } from '@launchwrighthq/qa/world';

export default defineWorld({
  personas: [
    {
      id: 'member-expiring',
      summary: 'A member whose plan ends in two days',
      seed: async (ctx, ids) => {
        const users = ctx.app.get(USERS);
        const user = await users.upsertByIdentity(ctx.tenantId, { provider: 'qa', subject: ids.accountId, telegramId: ids.telegramId });
        await ctx.app.get(PLANS).grant(ctx.tenantId, user.id, { endsInDays: 2 });
        return { userId: user.id, telegramId: ids.telegramId };
      },
    },
  ],
  facts: [
    {
      id: 'catalog.empty-shelf',
      summary: 'A shelf with no item',
      handleKeys: ['shelfId'],
      seed: async (ctx) => ({ shelfId: (await ctx.app.get(SHELVES).create(ctx.tenantId, { name: 'Empty' })).id }),
    },
  ],
});
```

`USERS`, `PLANS` and `SHELVES` stand for the project's own service tokens.

| Rule | Detail |
|---|---|
| Services only | A seed writes through `ctx.app` services. Raw SQL (`sql`, `db.execute`, `sql` from `drizzle-orm`) fails `lw qa check` as S1. If no service can write a state, the feature owes that service. |
| Ids | Kebab case or dotted, unique in the registry, each with a one-line summary. |
| Persona ids | The account id is `qa:<persona>` (`ids.accountId`). The Telegram id is `qaTelegramId(persona)` (`ids.telegramId`). Use both, so the web sign-in and the Mini App launch find the same user. |
| Handles | A seed returns the handles that a row needs, so no row holds a magic id. A fact declares its `handleKeys`, and `lw qa world reset` refuses a seed that does not return each one. |
| Undo | A fact that `lw qa fixture arm` arms has `arm(ctx)` and `undo(ctx, step)`. `arm` calls `ctx.record(step)` before each change. |

```sh
lw qa world list          # the registry, and why it is not seedable
lw qa world reset         # seed it on the QA database
lw qa world status        # whether the QA database holds this registry
```

The registry needs at least one persona and one fact.

## 2. Make each state union reachable

`lw qa states scan` reads the client roots (`qa.clientRoots`). A state union is a type whose name
ends in `State`, `Mark`, `Status`, `Kind`, `Phase` or `Variant`. Each union needs a trigger.

| Provenance | How to give it | Use when |
|---|---|---|
| `live` | a persona and facts that put the real route in that state | always first |
| `mounted` | a component that takes the union as a serializable prop, registered in `qaStatesPage({ components })` of `client`, so `/__states?c=<Component>&props=<json>` mounts it | the state renders from props alone |
| `intercepted` | a row in `.lw/qa/delivery.json` (union name to `{ route, intercept, settle }`) so the runner rewrites the API response | the last choice, when no seed can write the state |

A finding of `lw qa check`, and its fix:

| Finding | Fix |
|---|---|
| C1: a union is neither an input nor an output | Give a component a prop of the type, or return it from an exported function. A type that is not a visible state gets `/** @qa-states ignore <reason> */` with a real reason. |
| C1: an ignore tag without a reason | Write the reason. |
| C4: a union with no route and no mount | Add its page to the route table (`qa.routeTables`), or give a component a prop of the type so `/__states` can mount it. |
| C3: a component reads `?qa=` or a QA flag | Remove the branch. Add a persona or a fact that puts the real code in the state. |
| S1: raw SQL in a world file | Call a service of `ctx.app`. Add the service when it is missing. |
| S1: a feature with a client route and no world file | Add `<feature>.world.mts` beside it, with a persona or a fact for each state that it shows. |
| S3: the build holds `lw-qa-dev-only` | Dev-only QA code reached the production bundle. Import it only from the dev server or the Vite dev plugin. |
| wait: `waitForTimeout` in a QA file | Settle on a selector, artwork, a video or `aria-busy`. |

## 3. States that depend on time or jobs

- A state that depends on time reads the kernel `CLOCK`. `POST /__qa/clock {shift}` on the QA API
  moves that clock, so an expiry or a reminder window is reachable.
- A job that changes visible state is registered as a project job. `lw qa job run <name>` runs it
  once on the QA app, so a row can reach the state that the job writes.
- A screen that loads data sets `aria-busy="true"` until it paints. Controls have a role and an
  accessible name, so a row selects by role.

## 4. Check

```sh
lw qa check
lw qa world list
lw qa states scan
```

`lw qa check` prints each finding as `<rule> <file>:<line> <message>` and exits 1 on any.
`lw verify` runs it in the project gate.
