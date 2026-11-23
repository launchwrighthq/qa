---
name: lw-qa-pass
description: Use for a QA pass. Find what changed, what a spec promised or what an issue reports, then open each state, photograph it and film what moves. Use for "what shipped since a date", a QA pass or test plan over a commit range, a walkthrough of new screens and states, "did we build what this spec asked for", "does this work", "show me what it looks like now", "reproduce this issue", "prove the fix landed". Writes one report under the QA report folder. The pass is done only when lw-qa report check exits 0.
---

# QA pass

A framework project can also run each `lw-qa <sub>` command as `lw qa <sub>`.

One skill, two jobs, one report.

| Job | What it does |
|---|---|
| Read | Find what changed, what a spec promised or an issue reports, and what the code claims to do. |
| Run | Open every state on each leg, photograph it, and film each state that moves. |

Section 2 of the report is the reading. Section 3 is the looking. Keep them apart. A claim that
you read from the code is `SUSPECTED`. A claim with a screenshot, a failing assertion or a query
result in the ledger is `CONFIRMED`.

The QA spec is the authority on every field name and rule. This skill does not restate it.

## The procedure

```text
range, spec or issues -> sections 1 and 2, before any browser -> the world -> the rows -> run -> videos -> report -> language -> finish
```

## 1. Resolve what this pass is about

A pass covers a commit range, a spec, intake issues, or a mix. Never guess one.

### A range

```sh
lw-qa changes --since 2026-08-21
lw-qa changes --since "2026-08-21 14:00"
lw-qa changes --since 6f2ab1c
lw-qa changes --last          # continue from the Range line of the newest report
lw-qa changes --last --json   # the form to read
```

`--last` reads the end commit from the `Range:` line of the newest report. When there is no
report, or its `Range:` line does not parse, and the caller named no date, ask for a date.

The tool collects and you interpret. It groups the commits by workspace area and lists the
signals of a visible change: new client routes, new pages, new API routes, new i18n keys, and
the specs and plans that landed. Read only the diffs that the signals point at. A signal with
no visible surface goes in section 5, by name.

### A spec

```sh
lw-qa session resolve docs/specs/<name>.md
```

It prints JSON: the header, the section headings, the commits with the source of each commit,
the files that those commits touched, and the legs that the spec selects with the evidence for
each. Read three fields with care.

- `commits.count: 0` is an answer. A `draft` spec has nothing built. Say so in section 2, and
  still photograph the screens that the spec names: the author wants to see what is there today.
- `legs.evidence` splits `fromSpec` from `fromCommits`. A leg that only `fromCommits` selects
  comes from a wide `git log`. Check it, and narrow with `--legs` when it is wrong.
- `paths.unknown` names paths that the spec cites and the repository does not have. That is
  usually a section 2 finding.

### Issues

```sh
lw-qa intake list
lw-qa session resolve --issue <id> [<id> ...]
```

The `lw-qa-intake` skill reads issues from a GitHub link or a Telegram chat. `resolve --issue`
gives one row seed per issue: the reporter's text as the claim, the reporter's media as the
reference, and legs from the device hints in the text. You write the rows. Each row has
`source: issue:<id>`.

Issue records stay in `.lw/qa/intake/`. Never copy the reporter's name, chat text or files into
the report. Describe the claim in your own words, and name the issue id on the `Issues:` line.
Section 4 links the reporter's media at its intake path (step 7).

## 2. Write sections 1 and 2 before any browser opens

Section 1: what this pass covered. For a range, one item per screen, state, feature or change,
in a user's words. For a spec, one line per spec section, in the spec's own words. For an issue,
one item per issue. A section that promises nothing observable says so.

Each item in section 1 has the same five lines.

| Line | Holds |
|---|---|
| What | One sentence in a user's words. |
| Where | The surface, then the address that opens it. |
| Trigger | The persona or fact that the state needs, then the steps. |
| Expect | The observable result, including what must not appear. |
| Source | The commits, the spec section or the issue id, on one line. |

`Trigger` decides whether the item is worth writing. A state that a tester cannot force is a
state that nobody checks. A state with no seed is a red line in section 5 that names the feature
that owes the seed.

Section 2: what the code claims. This is the review, read and not yet reproduced.

- `CONFIRMED` means reproduced: evidence in the ledger, a failing assertion or a query result.
- `SUSPECTED` means read from the code and not reproduced.

A finding has four lines: Claim (one sentence in the spec's words), Evidence (the row id, the
failing assertion, or the query and its rows), Breaks (the spec section) and Where
(`path:line`). A `SUSPECTED` finding has a fifth line: what must be true to reproduce it, and
why this pass could not. "Not tested" is not a fifth line.

Neither list is a verdict. A finding that you suspect and can reproduce at low cost belongs in
the rows below. That is why section 2 comes before the run.

## 3. The world, and an address for every state

```sh
lw-qa world status      # what is seeded, and the hash of the registry
lw-qa world reset       # drop, create, migrate and seed the QA database
lw-qa world api         # the project API on qa.apiPort against the QA database
lw-qa telegram          # the fake Bot API and the /__tg chat page, for bot rows and the Mini App
```

The pass runs on the QA database (`qa.database`), never on a database that a person uses. The
undo of any change is `lw-qa world reset`. `lw-qa fixture arm <fact>` arms one fact on the QA
database for a row, and `lw-qa fixture disarm` undoes it.

A persona is a user in a named state. A fact is a state of the product data. Both live in
`<feature>.world.mts` files, and both return the handles that a row needs, so no row holds a
magic id. The `lw-qa-world` skill adds them.

Three kinds of address, in the order of what they prove. The report labels each shot with the
provenance that produced it.

| Provenance | Address | What it proves |
|---|---|---|
| `live` | the real route with `fixture.persona` and `fixture.facts` on the QA world | the real route, the real server, real rows. The default. |
| `mounted` | `/__states?c=<Component>&props=<json>` on the client dev server | the component renders with these props. Nothing about routes, data or how a user gets there. |
| `intercepted` | a rewritten API response | the last choice. It proves the render of that response only. |

The row field is the contract. A row names its user in `fixture.persona`. The runner turns it
into the persona launch. Never write `?qa=` into a route.

A persona is a different user. If a state appears only when a component branches on a test
flag, that is a finding about the product (rule C3), not a state to fake.

## 4. Derive the rows from prose

A spec names screens in sentences. The rows are your reading of those sentences, written before
any browser opens. Then they are reviewable, one line can be corrected, and one row can be run
again with `--only`.

### Which sentences give a row

| In the spec or issue | What it gives |
|---|---|
| A measured defect: "Pressing X calls only `handleOpen()`." | one row per state that it names |
| A decision heading: "While not connected", "Once there is an account" | one row per branch |
| A table of cases | one row per case that has a screen |
| An explicit removal: "The banner goes away" | a row whose `expect` is an absence |
| A reporter's screenshot | one row that opens the same screen, to put beside it |

Prose that names a component but no observable result is not a row. Section 1 then says that the
section promises nothing observable.

A state is any condition that a sentence puts on the user or the data: signed in or out, a
plan, an empty list, a width, a first visit or a return. Each one is its own row.

### Find the route

A route is relative to the surface base: `/settings`, never `<base>/settings`. Each leg applies
its own base, and `lw-qa session check` refuses a row that holds one.

1. Read the route tables that `qa.routeTables` names. The adapter folder (see "Product facts")
   names the route vocabulary of this project.
2. The web and the Mini App can differ. A row on a leg whose table has no such route is `n/a`
   with the table that refused it.
3. A component that is not a page has no route of its own. Find the page that renders it.

### Choose `settle`

`settle` decides whether a screenshot is worth having. A grid is "loaded" while every tile is
still blank.

| The row is about | Use |
|---|---|
| a control, a card, a sheet | `{ "selector": "role=button[name=\"Save\"]" }`, an element only that state draws |
| a screen that loads data | `{ "busy": true }`: no element has `aria-busy="true"` (rule C5) |
| anything with images | `{ "artwork": true }`: an image or a CSS background has painted |
| a player | `{ "video": true, "timeout": 30000 }` |
| an absence | a selector for what is there, never for what is not |

Select by role and accessible name first. A row that selects by CSS class fails review.

Check a selector before you write it into a row. Read the component and the i18n dictionary, and
take a real string from them. Follow an attribute to where the code uses it, not to where it is
named. A prop such as `analyticsId` often becomes `${analyticsId}-${part}` in the element.

### A row

```json
{
  "id": "account-card.guest-expanded",
  "screen": "the account card",
  "state": "a guest, card expanded, desktop",
  "specRef": "3",
  "source": ["spec:docs/specs/<name>.md#R4"],
  "legs": ["desktop"],
  "route": "/",
  "fixture": { "arm": [], "persona": "guest" },
  "act": [{ "kind": "click", "target": "role=button[name=\"Open account\"]" }],
  "settle": { "selector": "role=dialog[name=\"Account\"]" },
  "expect": "the dialog shows the sign-in choices and no balance"
}
```

- Two faces of one control are two rows. One shot carries one claim.
- A row about a narrow width is a `mobile-web` row. The width is the state, so the leg is the
  fixture.
- A row whose `expect` is an absence settles on the page's own content.
- A `wait` step needs a `why`. Never wait on time in a QA file.
- `expect.pageErrors` lists the page errors that a row expects. Any other page error fails the row.

```sh
lw-qa session check docs/qa/<slug>.shots.json
```

It validates the rows and prints every problem at once.

## 5. Run

Start the QA world once, in another terminal, and keep it up for the whole pass.

| Leg | Surface | Target |
|---|---|---|
| `desktop` | web | Playwright Chromium, 1440x900 |
| `mobile-web` | web | Playwright, Pixel 7 |
| `miniapp` | Mini App | Playwright, Pixel 7, fake Telegram launch |
| `telegram-fake` | bot | Playwright on the `/__tg` chat page |
| `telegram-android` | Mini App in real Telegram | `android-adb` or `android-emulator` |
| `safari-ios` | web | `ios-webkit` or `browserstack` |

`qa.legs` can add, remove or change a leg. A leg whose target is not configured is `n/a` with the
reason "no target".

```sh
lw-qa session run docs/qa/<slug>.shots.json
lw-qa session run docs/qa/<slug>.shots.json --legs desktop,mobile-web
lw-qa session run docs/qa/<slug>.shots.json --only account-card.guest-expanded
lw-qa states run --slug <slug>     # each union member, mounted or intercepted
lw-qa paths crawl --slug <slug>    # can a user get there, and a video of the taps
```

Before the first row, `session run` prints the run contract: credentials, devices, outward actions
and data steps, each with an item id. It exits 2 on an empty credential or an item with no grant.
Show the list to the user, then rerun with `--allow <id>` per item or `--allow-all`, only when the
user agrees. `lw-qa consent show|reset|grant <id>` reads and changes the records.

The runner records the evidence of spec 2.11 for each row and leg, and nothing else may:

| Evidence | When |
|---|---|
| a screenshot after settle | every row on every leg that runs it |
| a screenshot after each act step | every row with `act` |
| a video | every row with `act`, every device row, every row with `video: true` |
| a trace | every browser row |
| a console and network log | every browser row |
| an accessibility dump | every Android row |

The runner fails a row as `blank`, `not-booted`, `route-drift`, `blank-video`, `over-budget` or
`page-error`. A leg that cannot record an item (video on `ios-webkit`) is `n/a` for that item,
with the capability name. A device row has up to three attempts, and each attempt stays in the
ledger.

Read the run summary for three things, and carry each one into section 5:

- a leg that did not run, with its reason;
- a row that failed or produced no evidence;
- a state that the world could not seed, so its rows ran in the wrong state.

A row that fails as `not-booted` is not a product defect. The stack is wrong: fix it and run the
row again with `--only`. A screenshot of a refusal is worse than a missing screenshot, because
section 5 names the missing one and a reader believes the wrong one.

A pass on the Telegram surface is not finished in a browser. The `miniapp` leg runs the Mini
App's own code and none of its host: the Telegram header, the safe-area values, the back gesture
and the WebView engine exist only on `telegram-android`. A claim about any of them stays
`SUSPECTED` until that leg photographs it. The `lw-qa-device` skill drives the device.

## 6. Videos

A still cannot show a transition, a meter that fills, a control that comes and goes, or a
flicker. Those get a video. Each video carries its provenance.

| Kind | Provenance | May claim |
|---|---|---|
| a path video (`lw-qa paths record`) | `live` always | a user can get there with these taps |
| a state video | `mounted` or `intercepted`, never `live` | how the state behaves over time, nothing about how a user gets there |

## 7. The report

The report is `docs/qa/YYYY-MM-DD-<slug>.md` (`qa.reportDir`). Its plan is
`<slug>.shots.json`, and its evidence and ledger are under `assets/<slug>/`. Reports and assets
stay out of git.

```text
# QA: <what this pass covered>
Date: 2026-09-02
Status: planned
Range: <commits> | Spec: <path> | Issues: <ids>
Legs: desktop mobile-web miniapp, telegram-android n/a (no target)
Coverage: 63 of 79 states, 11 owe a seed

## 1 What this run covered
## 2 What the code claims
## 3 What was seen
## 4 Findings
## 5 Not covered
## 6 How to retest
```

- `lw-qa report update docs/qa/<slug>.md` writes section 3 between `<!-- qa:evidence:start -->`
  and `<!-- qa:evidence:end -->`, the section 5 lines, and the `Status`, `Legs` and `Coverage`
  lines from the ledger. Never type section 3 and never edit the generated block. Write your
  judgement in section 4.
- `Status` is computed: `planned`, `passed`, `failed` or `partial`. Never type another value.
- Section 4 states each finding as `CONFIRMED` or `SUSPECTED`. The finding line starts with that
  word, then a severity tag, then the claim:
  `- CONFIRMED [high] The checkout button stays disabled after a valid card.` The line may also be
  a `###` heading. The tags are `[critical]`, `[high]`, `[medium]` and `[low]`, in English in every
  report language. The finding's four lines of section 2 follow under it.
- Every `CONFIRMED` finding has a tag. `lw-qa report check` names a `CONFIRMED` line with no tag
  and any unknown tag. A `SUSPECTED` finding may carry a tag.
- The 0-100 score deducts per `CONFIRMED` finding: critical 25, high 15, medium 8, low 3. A
  `SUSPECTED` finding is not reproduced, so it deducts nothing. The breakdown beside the gauge
  counts it.
- An issue pass has the header line `Issues: <id>, <id>`. For each id, section 4 holds exactly
  one line `- issue <id>: REPRODUCED` or `- issue <id>: NOT REPRODUCED`, alone on its line.
  Write the reason on the next lines. A row of the plan with `source: issue:<id>` must have a
  file in the ledger.
- Section 3 already embeds the run's screenshot. In section 4, link the reporter's media at its
  intake path, relative from the report file:
  `[reporter screenshot](../../.lw/qa/intake/<id>/assets/<file>)` for a report in `docs/qa/`.
  Take `<file>` from the `reference` paths of `lw-qa session resolve --issue`. Never copy the
  file into `assets/<slug>/`.
- `lw-qa report update` keeps section 4 as you wrote it.
- `lw-qa report render` turns the media link into a link on the page. `lw-qa publish` replaces it with
  `reporter media of issue <id> stays local` and copies no intake file.
- Section 5 is not optional. It names every leg that did not run, every row that failed, every
  state that owes a seed with its feature, and everything in the range that the report does not
  cover. A report without it looks like a report that covered everything.
- A state that renders and that no user can reach goes in section 3 as a finding about the
  product, not in section 5.

The layout of section 3 stays as `lw-qa report update` writes it: a landscape shot on its own
line, portrait shots two per table row, never mixed in one table, and a video on its own line.

## 8. Language

The caller names a language, in any form. The default is the language of the request. Prose and
section headings are translated. The six sections keep their order and count, and the report
check matches each section by its number.

Never translate a technical name. A path, an identifier, a route, an env key, a command, a commit
subject and the whole `Source` line stay as they are. The report folder is out of git, so a
report in another language never enters the repository.

## 9. Finish

```sh
lw-qa report update docs/qa/<slug>.md
lw-qa report check docs/qa/<slug>.md
lw-qa report render docs/qa/<slug>.md
```

1. Run `lw-qa report check`. It exits 1 and names each problem: a planned row and leg with no
   evidence and no section 5 line, a file that is not embedded once, an embed with no ledger
   entry, a hash that does not match, an edited generated block, an embed outside
   `assets/<slug>/`, a missing header line or section, and a `Status` line that differs from
   the computed status. For an issue pass it also names a missing or malformed statement
   (`issue-statement`), a statement for an id that the `Issues:` line does not list
   (`issue-unknown`), a statement with no ledger evidence (`issue-evidence`), and a media link
   outside section 4, for another issue or to a file that the record does not list
   (`intake-link`).
2. Fix each problem at its cause: run the row again, add the section 5 line with its reason, or
   run `lw-qa report update`. Never edit the ledger or the generated block by hand.
3. Run `lw-qa report check` again. The pass is done only when it exits 0. Until then, report the
   pass as not done, and name each problem that is left.
4. Run `lw-qa report render`, then print the page path as `file://<absolute path>` on a line of
   its own. Print it again after each revision.

`lw-qa publish <slug>` copies the report, the ledger and the assets to the `qa.publish.storage`
disk and prints the links. Run it only when the caller asks to share the report.

## Product facts

The skill holds the procedure only. Facts about this project sit in
`{{lw:adapterDir}}/qa-pass/`: the route vocabulary and the route tables, the i18n dictionary
path, the bot usernames, the session routes, the personas that most rows need, and the known
gaps of the QA world. No adapter means no product facts are known. Say that, and do not invent
them.

## What this skill does not do

- It draws nothing. A pass has photographs, so it needs no mockup.
- It fixes nothing. It writes a finding, never a repair. A pass writes only in the report folder,
  in `.lw/qa/` and in the QA database.
- It touches no database that a person uses. The world is the QA database, and `lw-qa world
  reset` is the undo.
- It does not run against staging or production. Local only.
- It does not post to GitHub or Telegram.
- It does not sweep locales. One locale per pass: the one the stack runs.
