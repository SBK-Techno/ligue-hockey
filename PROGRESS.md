# Progress and open work

This file tracks the current milestone, verified evidence, and the work that is deliberately deferred. It is not part of the published documentation site.

## Release in progress

- Branch: `feat/home-1.4.0`.
- Target version: `1.4.0`.
- Shipped: identity, navigation, evaluations, smart sheet, locations, `1.3.0`; initial-paint fix, `1.3.1`; natural rink, auth hero, shared Black/White sheet, `1.3.2`; warm blue-white-red theme, dressing-room login, inline substitute actions, `1.3.3` (live).
- In flight: the home situation board and month calendar, plus one shared UI system across every route: one page header, one section body, one type scale, one chip, one empty state, one sticky bar, one row rhythm.
- Next: the phase-aware match sheet and rink lineup board (`1.5.0`); avatars, evaluation redesign and the real-ice material pass (`1.6.0`).
- Verification: `npm run gate` green at `e202dd6`, 393 tests in 46 files, 242 architecture files, generated assets and the documentation site; the admin surface migration lands on top and runs the gate again.
- Next release step: final gate, PR, merge, tag `v1.4.0`, release, promote and verify health.

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
| `6a1d315` | `1.3.0` identity, navigation, evaluations, smart sheet, locations | gate, PR 12 |
| `1a00cf7` | `1.3.1` initial-paint flash fix | gate, PR 13, live |
| `3b50ec4` | `1.3.2` natural rink, auth hero, shared team sheet, recalibration test | 340 tests, live health `ok` |
| `3728997` | `1.3.3` `/remplacants` inline pool and request actions | 350 tests, check, lint |

## Next: 1.3.4 correctness

- Freeze game records and availability after the start time; make cancellation atomic; filter recent form by playability.
- Notification inbox: mark every unread item, cursor pagination, anchor rows with a separate read action.
- One invitation/reset mode token; keep the email after a wrong password; correct resend purpose.
- Chat: initial scroll to the latest message, true new-message count, growing composer, focus return.
- Evaluation: return the actual `canRate` reason, show failures near the form, expose older played games.
- Remaining navigation checks: header at 768 and the bottom-bar reserve on admin and tablet (the profile destination and the 320 admin grid ship in 1.3.3).

## Next: 1.3.5 input and administration

- Finance input guards only: real dates, ordered dates, non-zero installments, no future payments, cap at outstanding.
- Admin schedule: reverse archive, exclude completed games from the draft reference, no silent location fallback, configured limits.
- Admin and accessibility polish: self-role reason, shared filter counts and reset, `#solde` anchors, one inactive label, profile fieldsets, 44 px standalone links, row-menu direction, paid amount.
- Copy/glossary pass and `PROGRESS.md` upkeep.
- Test isolation: `.env.test` database, scripts typecheck, language in the CI contract, one DB opener, strict config validators, own-property key lookups.

## Next: 1.4.0 member surfaces

- Home situation board: the hero and the panel spans change with game phase, presence, lineup state, absence, manager slots, balance, substitute requests, polls and profile presence. Month calendar with game days, today and multiple games per day.
- Team section `/equipe`: season roster with position, games, attendance and Black/White history; ratings only behind the ratings capability. Rink board with placement for managers, pair-rule lines, live balance and a past-game timeline.

## Deferred to a later milestone

- Finance model rewrite: N installments, charges, allocations, credits, refunds, receipts, interest-only arrears, no fixed late fee, no card surcharge, trust-sum flag. Legal constraints are in `/tmp/opencode/finance-legal.md`.
- Archive pagination, batch game reads, admin dashboard payload trimming.
- Cancelled-game metrics and the `completed` status writer.
- Chat history pagination and connection-lost UI.
- Gitea migration of the publication contract (explicit platform gap).

## Environment and operations

- Live SMTP is still misconfigured.
- The GHCR package is private; the server needs a classic PAT with `read:packages`.
- Live promotion: pull the pinned image, map the existing container environment, recreate, then verify `/api/health`, the version label and the revision label.
