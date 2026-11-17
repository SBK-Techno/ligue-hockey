# Progress and open work

This file tracks the current milestone, verified evidence, and the work that is deliberately deferred. It is not part of the published documentation site.

## Release in progress

- Branch: `feat/match-1.5.0`, based on `1.4.0` (merged, tagged, released, live).
- Target version: `1.5.0`.
- Shipped in `1.4.0`: identity, navigation, evaluations, smart sheet, locations; initial-paint fix; shared Black/White sheet; warm theme and dressing-room login.
- In flight for `1.5.0`: season agenda replacing the month calendar; chat rebuilt around player colour, avatar and jersey with grouped days, menus and readable polls; phase-aware game sheet with goals, penalties, totals and finalization; player avatars with unique colours and jerseys; paper and ice material pass; desktop compositions for home, match, schedule, balance, notifications, substitutes and profile.
- Verified in this slice: `npm run gate` green (452 tests, 51 files), generated assets and documentation site current, production build served against a copy of the seeded database, home/discussion/match/schedule/admin pages fetched, and a goal written through the real action then read back from the sheet.
- Next release step: commit, push, open the PR, merge after review, tag `v1.5.0`, release, promote and verify health.

## Triple-check round 1 (in progress)

Eight read-only auditors run in parallel, each on a distinct surface, then one consolidator rechecks every finding before a single writer touches code:

| Auditor | Surface |
|---|---|
| Home and personalization | hero, agenda, panels, member modes, Québec garage-league usage |
| Chat and polls | day groups, menus, voting, scroll, identity, keyboard |
| Match and sheet | phase guards, scorekeeper friction, rink gap, player view |
| Responsive and space | 320 to 1536, overflow, touch targets, density |
| Copy and language | `tu`, sentence case, vocabulary, redundancy, CAD |
| Domain and privacy | past-game guards, balances, ratings, permissions, atomicity, duplication |
| Visual identity | materials, buttons, imagery, typography, AI tells, player colour |
| Accessibility, performance, tests | semantics, contrast, bundles, N+1, missing regression coverage |

Findings are confirmed against source before any edit; the round is only closed when a recheck agent returns no confirmed finding.

## 1.5.0 decisions

- `config/goal-kinds.ts` is the single owner of goal kinds and their labels; the sheet schema re-exports it.
- `availability.myAvailabilityByGame` and `gamesheet.listGameScores` read many games in one query for the home agenda.
- `ChatMessageView` carries `authorAvatarId`, `authorJerseyNumber`, `authorPosition` and `isOwn`; deleted polls reject votes at the service.
- `SectionCard` takes `clip` and `class`: a menu-bearing sheet can let its menu escape, and every route composes spans on the existing 12-column grid.

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
| `b54d7c8` | `1.4.0` home board, admin surfaces, shared UI system | gate, PR 16, live |

## Next: 1.6.0

- Rink placement board on the match page: `config/rink.ts` owns the geometry, but no surface renders it yet. A manager should place players, see pair-rule lines and save with the generation token.
- Team season page `/equipe`: roster, attendance history, Black/White history and a past-game timeline, ratings only behind the ratings capability.
- Chat history pagination and the connection-lost banner.
- Admin row menus beyond the player list: move the remaining absolutely positioned menus out of clipped sheets where they still exist.

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
