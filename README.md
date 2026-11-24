# Launchwright QA

A standalone, public QA library for AI products. It runs QA passes that photograph every state on
each leg, film what moves, and write one report with evidence. It carries personas and state
triggers, device and emulator targets, a fake Telegram server, issue intake, a reviewer-comment
viewer and a 0-100 score. It needs no framework: its only hard dependencies are third-party
libraries. Every framework package is an optional peer.

## Install

The library is distributed as a public GitHub repository, consumed by a git tag, like
`agent-harness`. It is not on a package registry.

A TypeScript or Node consumer pins the tag:

```json
{
  "devDependencies": {
    "@launchwrighthq/qa": "github:launchwrighthq/qa#v0.3.0"
  }
}
```

The `lw-qa` command runs through `tsx`, which depends on `esbuild`. pnpm 11 runs no dependency
build script by default, so allow the one `esbuild` needs in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

The library is pure Node. It has no Python package.

## The `lw-qa` command

The package ships a real `bin`, `lw-qa`. A consumer runs a pass without the framework CLI:

```bash
lw-qa session run docs/qa/<slug>.shots.json
lw-qa session run docs/qa/<slug>.shots.json --legs desktop,mobile-web --allow-all
lw-qa consent show
lw-qa world status
lw-qa report render docs/qa/<slug>.md
```

`lw-qa --help` lists every subcommand.

## Configure

The library reads a plain local file, `qa.toml` (or `.lw/qa.toml`), in the project root. The config
names the legs, the base URLs, the QA database, the app entry and the score weights. The consent
records go to `.lw/qa/consent`. With no file, the default `desktop` leg uses the `playwright` target, and each row is
`not-run: no base URL` until you set `[baseUrls]`.

The smallest config that passes with no browser runs one leg on the built-in `fake` target:

```toml
[baseUrls]
web = "http://127.0.0.1:1"

[legs.desktop]
surface = "web"
target = "fake"
```

The `fake` target opens no connection, so any loopback URL works. A pass also needs two things:

- A git repository with at least one commit. The run records the commit it ran on.
- A plan file named `YYYY-MM-DD-<name>.shots.json`, for example `docs/qa/2026-11-23-smoke.shots.json`.
  The report beside it is `docs/qa/2026-11-23-smoke.md`.

A leg may have any name, for example `[legs.fake-web]`. Every command that reads a plan accepts the
legs of the config.

### Env values

A string value of `qa.toml` can name a process env key, so a password stays out of the file:

```toml
[db]
url = "${QA_DATABASE_URL}"

[qa]
database = "${QA_DATABASE:-shop_qa}"
```

`${NAME}` takes the value of `NAME`. `${NAME:-default}` takes `default` when `NAME` is unset or
empty. `$${` writes a literal `${`. A key that names an unset env key with no default stops
`lw-qa` with exit 2 and `qa.config.env`. The message names the key and the file, never a value.

The BrowserStack keys come from `[qa.device.browserstack]` (`username`, `accessKey`). When the config
names none, `lw-qa` reads the env keys `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`. The run
contract lists both keys as set or empty and never prints a value.

### The score

`lw-qa report render` and `lw-qa report viewer` draw a 0-100 score as a circular gauge, with a
breakdown table beside it. `lw-qa report update` prints the score. The score is the weighted average
of the dimensions that the run tested:

| Dimension | Score | Default weight |
|---|---|---|
| `findings` | 100, minus 25, 15, 8 or 3 per `CONFIRMED` finding of section 4 (critical, high, medium, low). Floor 0. | 0.35 |
| `console` | 100 with no row leg that had a page error; 70 for 1 to 3; 40 for 4 to 10; 10 for more. | 0.1 |
| `coverage` | The percent of planned row legs with `live` or `mounted` evidence. | 0.15 |
| `evidence` | The percent of planned row legs that passed with a file. | 0.1 |
| `accessibility` | Untested: the ledger holds no accessibility finding. | 0.15 |
| `performance` | Untested: the ledger holds no timing measure. | 0.15 |

An untested dimension drops from the average, and the breakdown marks it `untested`. The findings
and console dimensions count once a row ran.

A finding of section 4 starts its line with `CONFIRMED` or `SUSPECTED`, then a severity tag:

```markdown
- CONFIRMED [high] The checkout button stays disabled after a valid card.
### SUSPECTED [low] The empty cart copy is cut on a narrow phone.
```

The tags are `[critical]`, `[high]`, `[medium]` and `[low]`. `lw-qa report check` fails a
`CONFIRMED` finding with no tag. A `SUSPECTED` finding is read from the code and not reproduced, so
it deducts nothing.

The `[score]` table of `qa.toml` sets the weights and the gauge colour:

```toml
[score]
gaugeColor = "#0ea5e9"

[score.weights]
findings = 0.5
performance = 0
```

A weight is a number of 0 or more, and a weight left out keeps its default. `gaugeColor` is a CSS
colour: `#rgb`, `#rrggbb`, `rgb(...)`, `hsl(...)`, `oklch(...)` or a named colour. The default is
purple, `#7c3aed`.

`lw-qa session run` exits 1 when a row failed, and also when no row and leg pair ran (every pair is
`not-run`), so CI never reads an empty run as green.

## States and paths

`lw-qa states run` photographs each member of each state union, and `lw-qa paths crawl` finds the
taps that reach each route that renders one. Both read the route tables of `qa.routeTables`. These
keys tune them:

```toml
[qa.routeWrappers]
localized = "/:lang?"

[qa.states]
delivery = "qa/delivery.json"
mounts = "qa/mounts.json"
```

### Route wrappers and optional segments

A route table row may wrap its path in a one-argument function, for example
`<Route path={localized(ROUTES.hot)} />`. When the client sources hold the body of the wrapper, the
scan reads the body with the argument. The body ``(p) => p === '/' ? '/:lang?' : `/:lang?${p}` ``
gives `/:lang?/hot`. The scan follows an `if` and `return` body, a `?:` on a string comparison, a
template, a `+` join, and a wrapper that the table imports. `qa.routeWrappers` gives the prefix of a
wrapper whose body the scan cannot read, such as one from a package. With no body and no key, the
scan keeps the bare path.

An optional segment `/:x?` matches an address with the segment and without it. A run opens the
route without it, so `/:lang?/hot` opens `/hot`. A crawl takes the most specific route that matches
a landing: `/en/hot` resolves to `/:lang?/hot`, not to `/:lang?`.

### Descriptor files

`qa.states.delivery` names a JSON file that maps a union name to its delivery descriptor:
`route`, `leg`, `intercept` (`url`, `container`), `settle`, `act`, `verifyArgs`, `pivotModules`,
`limit`, `batchSize`, `contrast`, `diffRoot`, `ignoreAttributes`, `maxSubjectAreaRatio` and
`fixture`. `qa.states.mounts` names a JSON file that maps a union name to its mount hints:
`component`, `leg`, `width`, `props`, `members` (props per member), `settle` and `fixture`. Both
paths are project-relative, so the files can be tracked in git.

A run checks each file before it starts. A key outside the schema, a bad value, a union the scan
does not find, or a named file that does not exist stops the run with `qa.states.descriptors`. The
message names the file and each bad key. Without a key, the run reads `.lw/qa/delivery.json` and
`.lw/qa/mounts.json` when they exist.

### Personas and crashes

`fixture.persona` of a descriptor or of mount hints signs a persona in before the capture, as on a
session row. A web leg posts the persona to `/__qa/session` when the session opens. A Mini App leg
first opens the surface root with `?qa=<persona>`, which is the persona launch. Each persona gets
its own session.

When the browser, the context or the page closes during a capture, that capture fails as
`crashed` with the reason. The next capture opens a new session, and the run goes on.

### Crawl bounds

A navigation of the `playwright` target waits for `DOMContentLoaded` (15 s at most), then up to
2 s for `load`. A page that holds a request open never fires `load`, so the settle rule of the row
or of the crawl decides when the page is ready. A crawl step, one navigation or one press, has
30 s at most. A step that fails or runs out is marked and skipped. The crawl always ends with a row
per target in `.lw/qa/paths/<slug>/targets.<leg>.json`, and each failed step goes to stderr.

When the browser, the context or the page closes during a crawl step, the crawl opens a new session
and goes on with the next step. The row of the route that the crawl worked on gets `crashed` with the
reason, and the run exits 1. After 5 restarts, one more crash stops the crawl, and each unreached
target gets `error` with the reason.

### Overlays and the crawl reader

The crawl lists only the controls that a person can press. A control under another element, outside
an open modal dialog, or inside an `inert` or `aria-hidden` subtree is left out. A launch sheet
over the root therefore hides the links under it, and the crawl clears it first:

```toml
[qa.paths]
dismiss = ["[data-sheet-close]", { role = "button", name = "Not now" }, { key = "Escape" }]
overlayWaitMs = 3000

[qa.paths.fixture]
persona = "reader"
```

After each settle, the crawl waits up to `overlayWaitMs` (default 0) for an overlay or a control of
the dismiss list to show. Set it to the delay of a sheet that opens a few seconds after load. Then
it presses each entry of `dismiss` in order. A string is a CSS selector, `{ role, name }` is a
control by its accessible name, and `{ key }` is a key that is pressed while an overlay shows. When
an overlay stays, the crawl presses `Escape`. An overlay is an open `dialog`, an element with role
`dialog` or `alertdialog` or with `aria-modal="true"`, or a fixed layer of 90 % of the viewport
that lies over a control outside it. Up to 3 overlays in a row are cleared.

A dismiss is no path step. Each one goes to `dismissals` in `targets.<leg>.json` with the page, the
press, the overlay and `cleared`. A dismiss that leaves an overlay goes to stderr. A press that moves
the app to another pathname is logged as failed, and the crawl opens the page again and reads it as
it is. `lw-qa paths record` clears the root in the same way before the recorder starts.

`fixture.persona` signs a persona in before the crawl and each recording, as on a session row. Pick
the persona whose launch state the crawl must see.

### The state page

`qaStatesPage` serves `/__states` through the `transformIndexHtml` hooks of Vite and its official
plugins only (plugin names that start with `vite:`). A project hook that rewrites the app page
leaves the state page alone. `htmlTransforms: 'all'` runs every hook, and a list of plugin names
runs the named ones too:

```ts
qaStatesPage({ framework: 'react', components: { Tile: './src/Tile.tsx' }, htmlTransforms: ['app-fonts'] });
```

## Consent

Before a pass opens a browser or touches a device, it prints a run contract. The contract lists
every need of the selected rows and legs in four groups, each item with an id:

| Group | Items |
|---|---|
| `credentials` | The keys that a leg's target declares, as set or empty, for example `BROWSERSTACK_ACCESS_KEY`. |
| `devices` | The device or rig of each device leg. |
| `outward` | An action that reaches outside, for example `outward:throwaway-bot-create`. |
| `data` | `data:qa-world-arm` (states on the QA world database), `data:qa-database-fork` (a fork per row group). |

An empty credential stops the pass with exit 2 and names the key and the leg. Set the key, or drop
the leg with `--legs`. The contract never prints a value: a set key shows a short hash only.

Each item needs a grant. `--allow-all` grants every item that the contract prints, and
`--allow <item-id>` grants one item (repeat it per item). Without a grant the command exits 2 and
lists the items. A grant is per item and persists under `.lw/qa/consent`. A rerun asks nothing,
and a rerun with more needs asks only the new items.

`lw-qa telegram bot create|destroy` and `lw-qa publish` are outward actions. They print their own
contract and take the same flags.

```bash
lw-qa session run docs/qa/<slug>.shots.json --allow devices:android-adb --allow data:qa-world-arm
lw-qa consent show                      # each record, its items and their grants
lw-qa consent grant outward:throwaway-bot-create
lw-qa consent reset [<hash>]            # every record, or one manifest hash
```

`lw-qa consent grant` grants only an item that a printed contract listed.

## The QA world

`lw-qa world reset` drops and creates the QA database (`qa.database`), migrates it, runs the base
seed, then every fact and persona seed of the `*.world.mts` files, and copies the seeded database
to the snapshot that each fork copies. The module of config `qa.app` exports `qaApp`, the
`QaAppEntry` of `@launchwrighthq/qa/world`. The world boots that app on the QA database.

An app without the framework db and auth modules gives these hooks on `qaApp`. Each hook runs in
place of the framework module that it names:

| Hook | Runs | In place of |
|---|---|---|
| `migrate(ctx)` | Before the app boots, on the empty QA database. `ctx.sections.db` points at it. | `migrate` of the db module |
| `seed(ctx, names)` | After `migrate`, before the app boots. `names` are the words of `qa.seed`. | `runSeeds` of the db module |
| `linkPersona(world, link)` | After each persona seed. It creates or finds the user and records the sign-in identity `link.accountId` (`qa:<persona>`). A returned id is the persona's `userId`. | `USERS` of the auth module |
| `connect(url)` | For the create, copy and drop statements on a Postgres server of this machine. It gives an object with `execute(sql)` and `close()`. | `createDb` of the db module |
| `tenantId` | The tenant of every seeded row. | `DEFAULT_TENANT_ID` of the db module |

A PGlite world (`[db] driver = "pglite"`) needs no `connect`. Without the http module, `lw-qa world
api` and each fork group serve the app on a plain `node:http` server. The app then serves its own
`POST /__qa/session {persona}` route: it finds the user of identity `qa:<persona>`, sets the session
cookie and answers `{ userId }`.

## Agent assets

The `lw-qa-*` skills and the `qa-testability` rule install through `agent-harness`. The library
declares them in its `harness.toml`. Install them once with the manifest of the installed package:

```bash
ah install --project --manifest node_modules/@launchwrighthq/qa/harness.toml
```

To keep them on every install, name the manifest in `.agents/harness.toml`:

```toml
[harness]
manifests = ["node_modules/@launchwrighthq/qa/harness.toml"]
```

A consumer that does not use `agent-harness` still runs the CLI. It only lacks the installed skills.

## Telegram

The Telegram commands need no framework package. The library has its own Bot API client and its own
MTProto user client. The user client loads GramJS, the npm package `telegram` (2.26 or later), which
is an optional peer. Add it only when you use the throwaway bot or the `telegram-mtproto` intake:

```bash
pnpm add -D telegram
```

The throwaway bot lifecycle drives BotFather through a user account that you authorize. Set
`QA_TELEGRAM_API_ID`, `QA_TELEGRAM_API_HASH` and `QA_TELEGRAM_SESSION` (a GramJS string session), and
`QA_TELEGRAM_PROXY` (`socks5://host:port`) when the account dials through a proxy. The token goes only
to `.lw/qa/bots`.

```bash
lw-qa telegram bot create --name "QA bot" --username my_qa_bot --allow outward:throwaway-bot-create
lw-qa telegram bot destroy --allow outward:throwaway-bot-destroy
```

When BotFather refuses a step or asks for a wait, the command stops at once and sends nothing more.
It fails with `qa.bot.refused` (with BotFather's reply) or `qa.bot.limit` (with the wait in seconds).

Issue intake reads a chat into local issue records and posts nothing. The `telegram-bot` driver
reads the updates of a QA bot (privacy mode off). The `telegram-mtproto` driver reads the chat
history through the user account and needs GramJS:

```bash
lw-qa intake telegram --chat <id> --driver telegram-bot
lw-qa intake telegram --chat <id> --driver telegram-mtproto --since 2026-11-01
```

The driver config is `[intake.drivers.telegram-bot]` (`token`) or `[intake.drivers.telegram-mtproto]`
(`apiId`, `apiHash`, `session`, `proxy`) in `qa.toml`.

## Review comments

`lw-qa comments serve <slug>` serves the viewer and a comment store on `127.0.0.1`. A reviewer marks a
step, a phrase, a screenshot region, a video time or a flow. `lw-qa comments export <slug>` prints
the task list of the open comments. For a region comment it writes the crop of the screenshot to
`.lw/qa/comments/<slug>/<id>.crop.png` and names it on the line. `lw-qa comments resolve <slug> <id>
[--reply <text>]` marks one comment resolved.

## Library imports

A consumer that embeds the engine imports the compiled build:

```ts
import { computeScore, renderScoreGauge } from '@launchwrighthq/qa';
import { render } from '@launchwrighthq/qa/render';
```

The device targets and the issue intake are subpath exports, `@launchwrighthq/qa/device` and
`@launchwrighthq/qa/intake`.

A CLI that embeds the `lw-qa` command imports it and its parts from the package root:

```ts
import { createPlaywrightTarget, createStatesCommand, createTargetRegistry, qaCommand, SUBCOMMANDS } from '@launchwrighthq/qa';

const code = await qaCommand.run(['session', '--help'], { cwd: process.cwd(), out: console.log, err: console.error });
```

The contract suites of the `qa.target` and `qa.intake` drivers are in `@launchwrighthq/qa/testing`.
They run under Vitest, an optional peer, so import the subpath only from a test file. They read the
case files in the `fixtures/contract/` folder of the package.

A thrown error with a dotted string `code`, such as `qa.target.act`, is a Launchwright error. The
library prints it as one line, also when it comes from the kernel copy of a framework app. The
package root exports the check as `isCodedError`.

## Develop

```bash
pnpm install
pnpm typecheck   # the source and the tests
pnpm test        # Vitest over tests/
pnpm compile     # tsup writes dist/, which the repository commits
```

The build script is `compile`. The package has no `build`, `prepare`, `prepack` or `install` script.
npm runs `prepare` for a git dependency, and with a `build` script it installs the dev dependencies
to build first. So an npm consumer of the git tag installs the committed `dist/` as it is.

Turn on the versioned git hooks once per clone:

```bash
git config core.hooksPath .githooks
```

The `pre-push` hook runs the publish scan on the commits you push, and on the whole tree and the
tag object of a pushed tag. It refuses the push on a hit. `pnpm scan <file ...>` scans files, and
`pnpm scan --help` lists the git modes.

## Release

The repository is public, so a tag is public at once. Release only with the release script, from a
clean `main`:

```bash
pnpm release patch --dry-run   # every check, then the plan; changes nothing
pnpm release patch             # commit chore(release): vX.Y.Z and tag it
pnpm release 0.2.0 --push      # the same, then push main and the tag in one atomic push
```

The script runs these checks before it writes the release commit, and stops at the first failure:

- HEAD is on `main`, the tree is clean, and the tag is new.
- The git author and committer use the GitHub noreply mail form.
- The publish scan passes on the tree of `HEAD` and on each commit since the last tag: the files,
  the messages, the identities and the tag messages.
- `pnpm typecheck`, `pnpm test` and `pnpm compile` pass, and `compile` leaves `dist/` unchanged.

The publish scan (`scripts/scan.mjs`) refuses credential shapes, phone numbers, product words, IPv4
addresses other than `127.0.0.1` and `0.0.0.0`, `<name>.local` hosts, home folders other than
`/home/user` and `/home/dev`, and private mail addresses. It prints each hit as `path:line kind` and
never the value. Build a synthetic test sample from parts, or end its line with
`publish-audit: allow`. The guard test `tests/guards/public-boundary.test.mts` uses the same rules.

## License

MIT.
