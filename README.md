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
    "@launchwrighthq/qa": "github:launchwrighthq/qa#v0.1.5"
  }
}
```

The `lw-qa` command runs through `tsx`, which depends on `esbuild`. pnpm 11 runs no dependency
build script by default, so allow the one `esbuild` needs in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

A Python consumer adds the same tag as a uv git dependency.

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

`lw-qa session run` exits 1 when a row failed, and also when no row and leg pair ran (every pair is
`not-run`), so CI never reads an empty run as green.

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

## License

MIT.
