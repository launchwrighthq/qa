---
name: lw-qa-intake
description: Use to read bug reports into local issue records before a QA pass. A GitHub issue by its link, or a Telegram chat by its chat id, with the screenshots, videos and voice notes in them. Use for "look at this issue", "read the bug chat", "what did testers report since Monday", "reproduce what they sent". Reads only, posts nothing, keeps every record local, then hands the issues to lw-qa-pass.
---

# Issue intake

Intake reads a source and writes local issue records. It never posts to the source: no comment,
no label, no reaction and no reply.

```sh
lw qa intake github <issue-url>
lw qa intake telegram --chat <id> [--since <date|message-id>] [--until <date|message-id>] [--driver <d>] [--follow]
lw qa intake telegram --chat <id> --apply
lw qa intake list
```

## Privacy

Chat text, reporter names and media are personal data.

- Records stay in `.lw/qa/intake/<id>/` (`issue.json`, `issue.md`, `assets/`). `.lw/` is out of
  git.
- Never copy chat text, a reporter name or a reporter's file into `docs/`, a commit, a log line,
  a spec or a published bundle. `lw qa publish` leaves intake content out.
- In a QA report, state the claim in your own words and name the issue id. Link a reporter's
  file at its intake path in section 4. The file stays in `.lw/qa/intake/`.
- An MTProto user session can do anything that its account can do. The read-only method
  allowlist is an accident guard, not a sandbox. Use only a session that the user supplies for QA.
- Never print a session string, a token or an API hash. Ask `{{lw:envCommand}}` whether a key is
  set.

## GitHub

`lw qa intake github <issue-url>` reads the issue with the operator's `gh` login. It downloads
every image and video that the body and the comments link, from the GitHub media hosts only. The
token goes only to GitHub upload URLs, never into a log or an argument list.

| Error | Meaning |
|---|---|
| `qa.intake.github.not-issue` | The link is a pull request. Give an issue link. |
| `qa.intake.github.access` | The `gh` login cannot read the repository. |

## Telegram

| Driver | Reads | Limits |
|---|---|---|
| `telegram-mtproto` (default) | the chat history through a user session: photos, videos, documents and voice notes | Read-only allowlist: history, messages and file download. Any other method fails with `qa.intake.telegram.method`. Files up to `qa.intake.maxFileMb` (default 200). |
| `telegram-bot` | the updates that a QA bot gets in the chat; `--follow` waits for more until Ctrl-C | No history from before the bot joined. Privacy mode must be off. A file over 20 MB is `skipped: too-large`. |

The keys of `telegram-mtproto` are `QA_TELEGRAM_API_ID`, `QA_TELEGRAM_API_HASH` and
`QA_TELEGRAM_SESSION` in the secret store. The project maps them to
`qa.intake.drivers.telegram-mtproto.{apiId, apiHash, session}`.

A cursor per chat makes a second read take only new messages. `--since` replaces the cursor for
one read.

### Review the grouping

A read stages the messages and proposes groups in
`.lw/qa/intake/telegram/<chat>/groups.proposed.json`: one group per reply chain, and messages of
one author less than 15 minutes apart join one group. The proposal is a start, not an answer.

1. Read each proposed group and its media.
2. Split a group that holds two problems. Join two groups that report one problem. Drop a group
   that reports no problem, such as a thank-you or a question.
3. Give each group a short title in your own words.
4. Write `groups.json` beside the proposal: `{ "groups": [{ "title": "...", "messages": ["412", "415"] }] }`,
   the first message first.
5. Run `lw qa intake telegram --chat <id> --apply`. It writes one issue record per group. A
   message id that was not staged fails with `qa.intake.telegram.groups`.

## Hand-off to a QA pass

```sh
lw qa intake list
lw qa session resolve --issue <id> [<id> ...]
```

Then follow the `lw-qa-pass` skill. Each row of an issue has `source: issue:<id>`, and the report
header has `Issues: <id>, <id>`. Section 4 of the report holds one line per issue:
`- issue <id>: REPRODUCED` or `- issue <id>: NOT REPRODUCED`. A row of that issue must have
evidence in the ledger. Section 4 links the reporter's media at its intake path, relative from
the report file, for example `[reporter screenshot](../../.lw/qa/intake/<id>/assets/<file>)`.
Never copy a reporter's file into the report folder. `lw qa report check` refuses a media link
outside section 4, and `lw qa publish` replaces each one with plain text.

The device hints in the reporter's text (a phone model, an OS, Telegram or a browser) pick the
legs. A hint that no leg serves goes in section 5.

Voice notes arrive as files. Intake does not transcribe them. Ask the user what a voice note
says, or name it in section 5 as not read.
