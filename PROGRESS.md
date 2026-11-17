# Progress and open work

This file tracks the current milestone, verified evidence, and the work that is deliberately deferred. It is not part of the published documentation site.

## A1 design pass 1.8.0 (in progress)

- Branch `feat/a1-pass-1.8.0`, branched from `feat/realism-1.7.0` (PR #21, merged). The pass follows the independent critique that scored the app 22/40: the login, home hero and desktop rink were reference-grade, while the mobile lineup, admin tables, settings, notifications and profile body were not.
- **Milestone 1, mobile lineup.** An upcoming match now opens with the alignment, not the attendance roster. Presence is a compact strip above the board, with the deadline and the two responses; the named attendance list follows the alignment. The board shows a "Ton poste" summary (team, position, trio or pair), a visible role label on every filled token, a "Toi" ring and hidden accessible marker, and a "Toi" stamp in the bench and the text roster.
- **Mobile adaptation.** Under 640 px the board shows one team at a time with a two-button switcher and a named roster grouped by position under the rink. Names remain on the rink tokens. The canonical roster was extracted to `TeamRoster.svelte`; `TeamLineup.svelte` keeps the admin text roster, and the board reuses the same component.
- **Evidence.** `npm run gate` exit 0 after the milestone: 1108 tests in 149 files, svelte-check 0/0, architecture 387 files, generated assets current, 93 client chunks without zod. Headless Chromium at 1440, 390 and 320 verified the order, the compact presence strip, the one-team switcher, the named roster, the "Ton poste" summary for a player in the lineup, and the "Toi" ring and stamp.
- **Milestone 2, admin exceptions.** Évaluations opens on the files to complete, with the complete files behind a counted toggle; played games put the incomplete ones first and show how many remain. Soldes opens on amounts due, every filter carries its count, and a fully paid league gets a positive empty state. The dashboard separates balances from open requests with counts, the notification card speaks human language and hides the technical event key behind a disclosure, and the mobile admin selector became a two-row tab strip with short labels. Joueurs, Soldes and Lieux lost their duplicate card titles, and player names remain whole at 320.
- **Milestone 3, composition and type.** The shell is a column: the footer closes short pages at the bottom of the viewport without overlapping content. Stat strips respond to their own container, so a strip in a narrow column lays out in two rows even on a wide screen. Captions rise to a 12 px floor and stamps to 11 px. The desktop navigation targets 44 px. The profile section links keep a single current section, driven by the URL hash and the scroll position. Notifications gain a visible "Nouvel avis" stamp, a secondary mark-all action and a one-line page description. Match cards size to their content, the home attendance names open by default, and the admin rule rows keep a two-column grid without repeating the page title. The mobile bar uses the short "Profil" label so all five slots stay whole at 320.
- **Milestone 4, mechanical pass.** The push preference has a bounded wait for the service worker, an explicit unavailable state instead of an endless "Chargement…", and a status that describes the disabled control. The skip link, the chat avatar that opens a player sheet, and the standalone "Voir le match" and "Voir sur la carte" links all reach 44 px. On the wide profile layout, the section links follow the hash instead of a scroll observer that cannot tell two columns apart; the server no longer claims a current section before the client resolves it. Rule deletion names its player pair in both the trigger and the confirmation. The dead colour and appearance layer is gone: the write-only `--player-color` property, the 58 `--color-player-*` tokens, `avatarColor`, the generated identity colour index, the player family in the palette helper, and the unused appearance fields on the 58 identities. The catalogue now carries only the facts it serves, and `ARCHITECTURE.md` matches it.
- **Evidence.** `npm run gate` exit 0 after the review fixes: 1118 tests in 155 files, svelte-check 0/0, architecture 394 files, generated assets current, 93 client chunks without zod. Headless Chromium verified the 44 px skip link by focus (`160 × 44`, focused), the 44 px chat avatar, the two standalone links at 390, unchanged portraits, the profile section state after clicking Notifications at 1440, the initial `#securite` hash, and the mobile scroll-spy at 390.
- **Milestone 5, desktop composition.** Every authenticated route now composes for the wide screen instead of stretching the phone column. The completed sheet puts goals and penalties beside the totals; the match page reads as two panes. Admin lists fold into two ledger columns (players, balances, open requests), matches put upcoming beside past, and the player page puts account, profile, ratings, balance and payments into a two-column page with a collapsed identity picker. The evaluation match keeps collapsed rows in two columns with the open sheet spanning both, the dashboard shows the five most urgent balances and three open requests with direct links, and locations put the create form beside the list. Rink labels reach 12 px at desktop. Below 640 px a record row moves its state, amount and arrow under the title, so a name never breaks into syllables at 320.
- **Desktop evidence.** At 1440 the completed sheet drops from 2612 to 2004 px, admin Joueurs from 2484 to 1372, the player page from 3286 to 2168, Soldes from 1450 to 995, Matchs from 1775 to 1195, the evaluation match from 1806 to 1216, Lieux to 900 and the dashboard from 2192 to 1337. Headless Chromium at 1440, 1024, 390 and 320 reports no document overflow and no console errors; the only flagged overflow entries belong to the intentional horizontally scrolling admin tab strip.
- **Gate.** `npm run gate` exit 0 after the desktop pass: 1123 tests in 155 files, svelte-check 0/0, architecture 394 files, generated assets and documentation current, 92 client chunks without zod.
- **Review fixes.** The independent review closed six minor findings: odd ledgers now keep the penultimate row's rule, an empty upcoming or past list takes the full width, player rows keep all badges on the metadata line so both columns align, the location form stacks once it sits in its narrow column, the assessment grid moved to the single layout owner, and the sheet test no longer duplicates the full class list.
- **Next.** PR #21 merged and `1.7.0` was released; this branch merges that release and targets `main` directly. Merging it lets the automatic release produce `1.8.0`; no further design work is planned in this branch.

## Release 1.7.0 (in progress)

- **Dependency override.** `drizzle-kit@0.31.11` still depends on the deprecated `@esbuild-kit/esm-loader`, which pins `esbuild@0.18.20` through `@esbuild-kit/core-utils`. The root `overrides` entry lifts that nested copy to `0.25.12`, the version `drizzle-kit` already resolves at its own level, so the development server advisory disappears and `npm audit` reports zero vulnerabilities. Generated migrations were rechecked after the change: `drizzle-kit generate` reads the TypeScript config and reports no schema changes.
- **Override exit.** Remove the `overrides` entry once `drizzle-kit` drops `@esbuild-kit/esm-loader`; until then the nested copy stays on the patched line.

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
