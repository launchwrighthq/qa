# QA testability

Every state that a user can see must be reachable by a QA run. A state is reachable through a
persona or a fact of the QA world, through a mount on `/__states`, or through an intercepted
response. Follow these rules when you change client code, server code, a `.feature.mts` or a
`.world.mts` file. `lw qa check` enforces the rules that a machine can check, and `lw verify`
runs it.

The `lw-qa-world` skill shows how to add a persona, a fact or a mount. The `lw-qa-pass` skill
runs a QA pass.

## Client rules

| ID | Rule | The check |
|---|---|---|
| C1 | Give every visible state a named state union: a type whose name ends in `State`, `Mark`, `Status`, `Kind`, `Phase` or `Variant`. A union that is not a state carries `@qa-states ignore <reason>`, and the reason is not empty. | `lw qa check` fails a union that is neither an input nor an output, and an ignore tag without a reason. |
| C2 | A component that renders a state union takes serializable props. It reaches services through providers that `/__states` fills with fakes. | A `mounted` capture of each union member in `lw qa states run`. |
| C3 | No component reads `?qa=` or branches on a QA flag. A persona is a different user, never a test mode. | `lw qa check` lints `qa.clientRoots`: `?qa=`, `URLSearchParams` `get('qa')`, `QA_PERSONA_PARAM`, a QA env flag or a QA global. A file that holds `lw-qa-dev-only` is dev-only code and passes. |
| C4 | Every page sits in the route table. A component that is not a page has a route that renders it, or a prop of its union so `/__states` can mount it. | `lw qa check` fails a union that no route delivers and no harness mounts. |
| C5 | A screen that loads data sets `aria-busy="true"` until it paints. Every control has a role and an accessible name. | The runner settles on `busy`. A row that selects by CSS class fails review in `lw-qa-pass`. |
| C6 | Time and random values come from the kernel `CLOCK` and the seeded random source. | The testing module guards (testing spec T7). |

## Server rules

| ID | Rule | The check |
|---|---|---|
| S1 | A persona or a fact seed can write every user-visible state of a feature. A seed calls the app's own services through `ctx.app`, never raw SQL. A feature with a client route has a `<feature>.world.mts` beside its `.feature.mts`. | `lw qa check` fails `sql`, `db.execute` and a `drizzle-orm` `sql` import in a `.world.mts`. It fails a `.feature.mts` that names `web_app`, `webApp` or `miniApp` and has no world file beside it. |
| S2 | Every external service sits behind a driver with a `fake`. | `lw module check`. |
| S3 | QA routes and the fake Telegram server never run in production. Import dev-only QA code only from the dev server. | Boot fails with `qa.routes.production`. `lw qa telegram` refuses production. `lw qa check` fails a file in `qa.buildDirs` that holds `lw-qa-dev-only`. |
| S4 | A job that changes visible state runs on demand. Register it, so `lw qa job run <name>` runs it on the QA API. | `lw qa job list` lists every registered job. |
| S5 | Every bot flow works against `telegram.apiUrl`. Send through the `telegram` module, never with a raw `fetch` to the Bot API. | The `telegram-fake` leg drives the bot through `lw qa telegram`. |

## Capture rules

- Capture evidence only through `lw qa session run`, `lw qa states run` or `lw qa paths record`.
  A script that drives a browser by hand produces evidence that the ledger does not list, and
  `lw qa report check` refuses it.
- Never call `waitForTimeout` in a QA file: a `.world.mts`, a `.shots.json` or a file under a
  `qa/` folder. Settle on a selector, on artwork, on a video or on `aria-busy`. `lw qa check`
  fails each call.
- A row names its persona in `fixture.persona`. Never write `?qa=` into a route.
