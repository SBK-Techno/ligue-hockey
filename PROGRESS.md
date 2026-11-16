# Progress and open work

This file tracks the current milestone, verified evidence, and the work that is deliberately deferred. It is not part of the published documentation site.

## Release in progress

- Branch: `design/identity-v2`.
- Target version: `1.3.0`.
- Shipped: identity, navigation, evaluations, smart sheet, locations.
- In flight: release-blocker polish pass (season partial/clear, schedule split, balance status, payment gating, row menu, copy glossary).
- Next: independent verifier, round-3 triple check, merge, tag, promote.

## Verified milestones

| Commit | Scope | Evidence |
|---|---|---|
| `dc113f8` | Design foundation, fonts, tokens | `npm run gate` |
| `3194fbb` | Season and per-game evaluations | 18 rating tests + migration |
| `690098a` | Navigation and copy cleanup | `npm run gate` |
| `44d8414` | Upcoming games first, shared schedule row | `npm run gate` |
| `6f7d215` | Smart sheet v1 | `npm run gate` |
| `9a726a3` | Locations, maps, metrics, migration guard | 211 tests, 28 files |
| `400855e` | Evaluation save reset, played policy, scoped counts | 235 tests, 29 files |
| `71605a4` | Smart sheet live pool, strict rules, typed warnings, ratings purge | 289 tests, 33 files |
| `f681365` | Architecture document corrections | review |
| `5bbbb46` | Notification links resolve to real routes | 5 tests |

## Confirmed open defects (release blockers)

Tracked in `/tmp/opencode/fixer-polish.md` and `/tmp/opencode/recheck-round2.md`. The main ones:

- A season rating sheet cannot save a partial sheet or clear a note.
- "Pas vu ce match" erases every row with no confirmation.
- A cleared empty sheet does not visibly clear.
- Schedule splits and the hero use the date, not the zoned start time.
- The payment form renders when no plan exists and always fails.
- "Mark all read" only covers the first page of the inbox.
- The admin row menu is clipped by `overflow-hidden`.
- Overall balance status is re-derived in four places and disagrees.
- Editing a game rewrites the frozen location label.
- Login forgets the email; invitation and reset share one message.
- Solde clips money at 390 px; several targets are below 44 px.
- Evaluation saves lose keyboard focus.
- `#solde` links land at the top of the player page.

## Smart-sheet verifier (confirmed)

- Regeneration bypasses the editable policy: a started `scheduled` game can be regenerated and its ratings purged. Gate `regenerateGame`, `regenerateAsAdmin` and `regenerateUpcomingGeneratedGames` on `isLineupEditable` and future start.
- The admin edit page never renders persisted warnings, so `rule-limit` is invisible after a manual edit.
- Warning order has secondary owners: the generator hardcodes keys, the service persists without registry order, and the public page compares literals.
- The bench is rendered from the snapshot on the public page and from the live pool on the admin page.
- An unrated bench player is named by the alert but the link opens the game sheet, which only lists dressed players.
- The generate audit is outside the slot transaction.
- The smart-sheet test calls `fillSuggestions` with a hand-built pool, not the live pool; `fc.assert` is unseeded.
- A locked game with a swap prints "already balanced".
- Dead exports: `isGameWarning`, `gameWarningLabelKey`, `requireCompleteRatings`.


## Deferred to the next milestone

- Finance model rewrite: N installments, charges, allocations, credits, refunds, receipts, interest-only arrears, no fixed late fee, no card surcharge, trust-sum flag. Legal constraints are in `/tmp/opencode/finance-legal.md`.
- Archive pagination, batch game reads, admin dashboard payload trimming.
- Cancelled-game metrics and the `completed` status writer.
- Chat history pagination and connection-lost UI.
- Full copy glossary pass and the remaining accessibility polish.

## Environment and operations

- Live SMTP is still misconfigured.
- The GHCR package is private; the server needs a classic PAT with `read:packages`.
- SMS notifications need a phone column, a provider and an adapter; no provider chosen.
- Availability reminders to non-responders do not exist.
- PR #11 (`feat/auto-release`) is open and must be reviewed separately.

## Verification contract

`npm run gate` is the only release gate: type check, lint, tests, language, architecture, generated assets, shell, docs and production build. A commit is releasable only when the gate is green on the final tree and an independent verifier finds no confirmed defect in the changed surfaces.
