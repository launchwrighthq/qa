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
    "@launchwrighthq/qa": "github:launchwrighthq/qa#v0.1.3"
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
lw-qa world status
lw-qa report render docs/qa/<slug>.md
```

`lw-qa --help` lists every subcommand.

## Configure

The library reads a plain local file, `qa.toml` (or `.lw/qa.toml`), in the project root. Every
field has a default, so a project with no file runs against the built-in fake drivers. The config
section names the legs, the QA database, the app entry, the score weights and the consent store
path.

```toml
reportDir = "docs/qa"
apiPort = 9101

[legs.desktop]
surface = "web"
target = "playwright"
```

## Agent assets

The `lw-qa-*` skills, the `qa-testability` rule and the QA hooks install through `agent-harness`,
the way the framework and a product repository install theirs. A consumer runs the harness
installer to place them. The library declares them in `harness.toml`. A consumer that does not use
`agent-harness` still runs the CLI; it only lacks the installed skills.

## Library imports

A consumer that embeds the engine imports the compiled build:

```ts
import { computeScore, renderScoreGauge } from '@launchwrighthq/qa';
import { buildViewer } from '@launchwrighthq/qa/render';
```

The device targets and the issue intake are subpath exports, `@launchwrighthq/qa/device` and
`@launchwrighthq/qa/intake`.

## License

MIT.
