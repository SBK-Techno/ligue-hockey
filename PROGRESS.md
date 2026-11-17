# Progress and open work

This file tracks the current milestone, verified evidence, and the work that is deliberately deferred. It is not part of the published documentation site.

## Release in progress

- Branch: `feat/legends-1.6.0`, based on `1.5.0` (Batch 5 committed and in review).
- Target version: `1.6.0`.
- Shipped in `1.4.0`: identity, navigation, evaluations, smart sheet, locations; initial-paint fix; shared Black/White sheet; warm theme and dressing-room login.
- In flight for `1.6.0`: see the section below; the remaining work is the team season page, chat history pagination and the confirmed triple-check findings.
- Verified after Batch 7: `npm run gate` green (811 tests, 95 files), generated assets and documentation site current, architecture check green over 326 files, and the client bundle holds 90 chunks without zod.

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

## 1.6.0 in progress

- Rink placement board: `config/rink.ts` owns the geometry, `LineupBoard.svelte` renders both team halves, and the `?/lineup` action saves through `saveManualLineup` with the generation token. Pure placement rules live in `src/lib/ui/match/lineup-board.ts` with seven tests.
- Legend identities: `config/legends.ts` owns the curated Canadiens alumni facts (name, number, position, era) and their stylised art variants; `config/identities.ts` composes them with the 28 league avatars behind one catalogue of 58 identities. The 30 legends follow the league ratio (15 forwards, 11 defense, 4 goalies), and the picker only offers legends that played the player's position.
- Player peek: every avatar and player name opens a shared card with season totals and position. Skills stay behind the ratings capability, so players never receive them. The data comes from one `getPlayerPeek` use case and a private short-lived API; the card is a hover popover on desktop and a sheet on mobile.
- Remaining: team season page `/equipe`, chat history pagination and connection-lost banner, and the confirmed triple-check findings for 1.6.0.

## Next: 1.6.0

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
