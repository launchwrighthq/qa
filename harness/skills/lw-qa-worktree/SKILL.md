---
name: lw-qa-worktree
description: Use to run the branch of a worktree as the live dev stack, so a person can test it on a phone or in Telegram. Use for "start the worktree so I can test it", "run this branch with a tunnel", "test my branch against real data", "put the dev bot on my branch", and to tear that down again. It copies the dev database, never borrows it, and drops the copy on exit.
---

# Run a worktree's branch as the dev stack

A framework project can also run each `lw-qa <sub>` command as `lw qa <sub>`.

```sh
lw-qa worktree                          # copy the dev database, migrate the copy, run lw dev --replace
lw-qa worktree --set-menu               # also point the dev bot's menu button at the tunnel URL
lw-qa worktree --keep-db                # keep the copy after the run
lw-qa worktree --cleanup                # drop the copies of runs that died
```

`--set-menu` takes `--bot <name>` (a bot of `telegram.bots`), `--menu-text <text>` and
`--surface <name>` (the dev surface whose tunnel URL the button opens).

## What it does, and why

| Step | Why |
|---|---|
| Copies the env file from the main checkout when the worktree has none | A new worktree has no gitignored file, so it has no env at all. |
| Copies the dev database to `<dev.project>_wt_<worktree>` | The branch under test writes real rows. In a database that another person uses, those rows are the same as theirs afterwards. |
| Migrates the copy | The copy has the schema of the main checkout. The branch's own migrations are usually what you test. |
| Points `DATABASE_URL` of the worktree env file at the copy | The run reads the copy, and the main checkout keeps its own database. |
| Runs `lw dev --replace` in the foreground | `--replace` stops the run that holds the bot, because long polling has one consumer. Ctrl-C reaches the cleanup. |
| With `--set-menu`, calls `setChatMenuButton` with the tunnel URL | The Mini App opens this branch from the bot's menu button. |
| On exit, restores the env file and drops the copy | `--keep-db` keeps the copy when its data is worth it. |

## What it refuses

Each one is a refusal with an error code, not a warning.

| Code | Refusal | Reason |
|---|---|---|
| `qa.worktree.main` | the main checkout | Without this test, it points the main checkout at a copy and drops the copy on exit. |
| `qa.worktree.host` | a database host that is not this machine | It creates and drops databases. |
| `qa.worktree.driver` | a PGlite project | A PGlite project gives each worktree its own data folder. |
| `qa.worktree.source` | a source database that is itself a worktree copy | Point `DATABASE_URL` of the main checkout at the dev database. |
| a name outside `<dev.project>_wt_` | any create or drop | The prefix is the fence. Every other database is outside what it can reach. |

## After it starts

It prints the tunnel URL of each surface. Without `--set-menu`, set the Mini App URL yourself.
A web app URL that BotFather holds (the main Mini App of the bot) does not change from a build.
Set it in BotFather when a test needs it.

For a browser instead of a phone, open the Mini App on the dev server with the fake Telegram
host of the `client` module. A QA persona launch needs the QA world: use `lw-qa world api` and
the `lw-qa-pass` skill, not this skill.

## Cleanup

A run that dies without its cleanup leaves its copy. `lw-qa worktree --cleanup` drops every copy
of this project whose worktree has no live `lw dev` run. A copy of a live run stays.
