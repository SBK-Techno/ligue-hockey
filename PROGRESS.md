# Progress and open work

This file tracks the current milestone, verified evidence, and the work that is deliberately deferred. It is not part of the published documentation site.

## Release 1.6.0 (shipped)

- `feat/legends-1.6.0` merged into `main` at `e6aaa20` (PR #18). The auto-release version pull request #19 merged at `e34a3ac` and produced tag `v1.6.0` and the GHCR image without a manual tag.
- Final tree: `npm run gate` exit 0, 1069 tests in 146 files, svelte-check 0/0, architecture 383 files, 93 client chunks without zod, precached shell 7,785 B. The container smoke measured all 18 static pages; the seven admin pages carry the shared `chrome-inset` request.
- Live: image `ghcr.io/sbk-techno/ligue-hockey:1.6.0`, host digest `sha256:1d07cb4223547278598a0766f9c35c39e65953d55ab8d87daa639562f70d5b07`, healthy since 2026-11-17T08:44:01Z; public health reports `ok`/`ok`/`applied` with HSTS.
- Migration: 29 active players, 29 unique stored identities, zero duplicates. The backfill distributed the tribute legends by position: 15 forwards, 10 defence, 4 goalies. The pre-update database copy is `/app/data/ligue.db.pre-1.6.0`; the 1.5.0 compose file is `/home/jadorais/compose.ligue-hockey.yml.1.5.0.bak`.
- Deliberately deferred to 1.7.0: a true browser route-graph budget (P1: the smoke counts HTML script tags and undercounts post-hydration imports), and an axe run on the auth routes (the landmark is asserted structurally). Both limitations are recorded in the 1.6.0 pull request body and `OPERATIONS.md`.
- Round-1 batches 1 to 7 end at `ef1f1c3`; the last round-1 batch is `b5455e7`, and round-2 block 1 starts at `86329da`. Round-3 blocks run from `8f7f82d` to `f173831` and fixed the 18 confirmed mediums across auth, domain atomicity, home and match UI, delivery and test truth.
- Shipped in `1.3.0`: identity, navigation, evaluations, smart sheet, locations; initial-paint fix; shared Black/White sheet; warm theme and dressing-room login.
- Verified on the round-2 block-4 tree after the nineteen fixes: `npm run gate` green (930 tests, 124 files), generated assets and documentation site current, architecture check green over 356 files, and the client bundle holds 92 chunks without zod.

## Triple-check round 1 (closed)

Eight read-only auditors covered distinct surfaces, and one consolidator rechecked every finding before a single writer touched code. Confirmed findings were fixed across Batches 1 to 7. A16 was rechecked and already matched the documented retained-legend behaviour, so it was not rewritten.

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

## 1.6.0 shipped

- **Rink board.** `config/rink.ts` owns the geometry and presentation roles; `LineupBoard.svelte` renders both team halves, and the `?/lineup` action saves through `saveManualLineup` with the generation token. Pure placement rules live in `src/lib/ui/match/lineup-board.ts`; the board names every slot, keeps a stable key per place, and the manual save no longer publishes a lineup before teams exist.
- **Identity catalogue.** `config/legends.ts` holds 30 Canadiens tribute legends (15 forwards, 11 defense, 4 goalies) with name, number, position and era; `config/identities.ts` composes them with the 28 league faces into one catalogue of 58. The picker offers the legends of the selected position and keeps a saved legend from another position visible and flagged; the server enforces the same rule.
- **Identity uniqueness and active accounts.** `players_active_avatar_unique` is a partial unique index over active players; assignment, activation and profile writes reserve the identity in the same transaction. Reactivation revalidates a retired or taken identity. A deactivated account no longer acts with an old session, and a deactivated player is removed from future lineups.
- **Player peek.** Every avatar and player name opens one shared card from `getPlayerPeek`; season totals and position are public, ratings stay behind the ratings capability. The card is a hover popover on desktop and a sheet on mobile, and its cache policy follows the session policy.
- **Game-day correctness.** The match page reads the live roster and presence, the sheet appears only in a phase where it can accept events, a cancelled game cannot be scored, and the sheet and the ratings share one playability rule.
- **Security hardening.** Throttle buckets are bounded, member writes are rate-limited, lineup payloads are validated, and finance, settings and player writes are atomic with their audit entries. CSP is enabled, and response headers and cache policy have one owner.
- **Delivery budgets.** SSR HTML and JSON are compressed, critical CSS is inlined within its budget, the measured pages stay at the JavaScript request budget, and the client graph contains no zod. Content-hashed assets are served immutable for one year; a replaced name stays on disk for the retention window owned by `GENERATED_ASSET_RETENTION_DAYS`, so a document already in flight can finish loading it.
- **Operator signals.** `/api/health` and `/admin` share one queue snapshot (pending, failed, oldest due, suppression reasons, last-tick push counts); a `manageSettings` operator can retry a failed job with an audit entry, and the scheduler emits one `notification.queue_snapshot` per tick.

## Remaining after 1.6.0

- Team season page `/equipe`: roster, attendance history, Black/White history and a past-game timeline, ratings only behind the ratings capability.
- Connection-lost banner for the discussion.

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

## Deferred to a later milestone

- Finance model rewrite: N installments, charges, allocations, credits, refunds, receipts, interest-only arrears, no fixed late fee, no card surcharge, trust-sum flag. Legal constraints are in `/tmp/opencode/finance-legal.md`.
- Archive pagination and admin dashboard payload trimming.
- Cancelled-game metrics.
- Gitea migration of the publication contract (explicit platform gap).

## Environment and operations

- The GHCR package is private (anonymous manifest requests return 401); the host must authenticate with a token that can `read:packages` before pulling.
- The verified production target, update, rollback, backup and preview rules are in `OPERATIONS.md`.
