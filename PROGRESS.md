# Progress and open work

This file tracks the current milestone, verified evidence, and the work that is deliberately deferred. It is not part of the published documentation site.

## Release 1.11.0 (in progress)

- **Rink tokens.** The decorative centre faceoff ring is gone. A filled token clips only its painted portrait: the jersey number sits outside that clip and the last name below it, without ellipsis or an inserted hyphen. A rink narrower than 560 px switches to a three-column, two-row formation grid, so the six tokens never overlap at 320 px or in the 400 px rink at 900 px; empty slots keep their role initials. Long names keep their full markup and wrap only at a real hyphen.
- **Menus.** An open `<details>` that owns a `.sheet` is lifted through the utilities layer above the row's `z-20`, so a three-dot menu paints above later rows instead of under them. The `menuUp` rule still flips the last two rows.
- **Identity picker.** One catalogue only: 38 tribute legends (16 forwards, 16 defence, 6 goalies) cover the largest roster, while the 28 league faces remain as the current-identity fallback for existing profiles. Cards are single-column and names wrap instead of truncating. A taken identity is greyed, disabled and marked with a lock, never with an “Indisponible” label. The non-affiliation sentence is gone from the picker, dictionary and product docs.
- **New tributes.** Georges Vézina, Bill Durnan, Tom Johnson, Jean-Guy Talbot, Rod Langway, Craig Ludwig, Patrice Brisebois and Guy Carbonneau join the catalogue with verified number, position and era facts; Vézina's career is corrected to 1910-1925. The regenerated identity sheet is 165 624 bytes, under the 220 KB budget.
- **Locations.** The visible map URL field is gone. The address field searches Photon/OpenStreetMap after three characters, lets the member pick a suggestion, and writes the OpenStreetMap marker link into a hidden `mapUrl`; editing the address clears it, and a form reset clears the address and the hidden link together. The create form keeps only name, address and optional note. The internal `/api/address-search` route requires `manageGames`, allows 60 searches per minute per manager, caches results for ten minutes and returns the shared error envelope when the provider is down. Provider, limits and timeout live in `config/maps.ts`; the browser never calls Photon.
- **Migration.** `0010_hesitant_lila_cheney.sql` is regenerated from the 66-identity catalogue, and the migration fixtures now assign all 66 identities or refuse an incomplete position.
- **Gate.** `npm run gate` exit 0: 1187 tests in 165 files, svelte-check 0/0, architecture 418 files, generated assets and documentation current, 95 client chunks without zod.
- **Browser evidence.** Chrome at 1440, 1024, 900, 640 and 320 reports zero horizontal overflow, zero console errors, zero rink-token overlaps and zero overflowing names. The three-dot menu paints above the next row at 900 and opens upward in the last row at 320. The defence picker shows 17 cards (16 legends plus the current face) with no clipped text and no “Indisponible” string. Address create, update and reset flows set and clear the hidden marker URL correctly; a saved location opens its marker link.
- **Release.** Pending.
- **Live.** Pending.
- **Rollback.** Pending.

## Release 1.10.0 (shipped)

- **One owner.** `/equipes/[id]` is the canonical team surface: next-match card, manager preparation, lineup editor, read-only teams and the last 20 past matches with their stored per-game team counts. `/equipes` redirects to the first relevant game, so every entry point owns a real game id. `/matchs/[id]` and `/admin/matchs/[id]` link to it and no longer render a lineup editor or a second team view. `TeamLineup.svelte` and the old match editor tests are removed.
- **History.** Past teams come from the stored `game_slots` of each game, never from the current live pool. `listTeamHistory` reads the bounded list and the per-game team counts in one grouped query; counts stay attached to the match that was published even after later lineup changes.
- **Players and managers.** A player sees the published two-team board, the read-only bench and the history. A manager editing an upcoming generated game also sees balance, regenerate, swap and fill. Cancelled, started and past games are read-only; an ungenerated editable game offers the single generate action to a manager.
- **Navigation and entry points.** `Équipes` is a primary member surface; players gain it in the five-slot mobile bar and managers reach it from the home preparation panel, the admin dashboard, the match header and the admin match page. The shared `nav-icons.ts` owner now carries the shield icon that Gestion declared.
- **Evidence.** Visual audits at 1440, 1024, 900 and 320 for player, manager, no-lineup, cancelled, cancelled-only, started, off-season and no-profile admin variants report no horizontal overflow and no console errors. The off-season home shows no next match, `/equipes` falls back to the last past game, and a started game is labelled “Match passé” without an “À venir” badge. Functional preview runs recorded a manual save (`game.lineup_manual`), regeneration (`game.generate`, manual marker cleared), one filled slot (`game.fill`) and an applied swap (`game.swap`), each with the matching confirmation copy. Players see the published teams and the read-only bench; unrated players are named on the manager panel and stay on the bench.
- **Gate.** `npm run gate` exit 0: 1156 tests in 159 files, svelte-check 0/0, architecture 409 files, generated assets and documentation current, 94 client chunks without zod.
- **Release.** PR #38 merged at `b1d599e`; release PR #39 merged at `de87a56`. The automatic workflow produced tag `v1.10.0`, the GitHub release and the GHCR image without a manual tag. GitHub Actions cannot open the release pull request, so the documented recovery was used: the operator opened #39 from the pushed `release/next` branch.
- **Live.** Image `ghcr.io/sbk-techno/ligue-hockey:1.10.0`, host digest `sha256:ee76fb5c17abac50654d61a5435fc955a0798731520f3464bf264fbd9d6bb340`, local id `sha256:dad41440fefeabdef7a4c81cb5edf86ea1db533bfa2cc5f362eb65bac98b5c2a`, healthy since 2026-11-17T18:20:18Z with zero restarts. Public health reports `ok`/`ok`/`applied` with HSTS, the container applied its migrations (15 recorded), and the startup logs carry no error. A read-only check with the live sessions confirms `/equipes` redirects to the next scheduled game, the preparation panel appears only for an account that can manage games, `/matchs/...` and `/admin/matchs/...` link to the team page without an editor, and a past game stays read-only.
- **Rollback.** The pre-update database copy is `/home/jadorais/backups/ligue-20261117T131955.db`; the 1.9.1 compose file is `/home/jadorais/compose.ligue-hockey.yml.1.9.1.bak`.

## Release 1.9.1 (shipped)

- **Admin Accueil.** An account without a player profile has no presence, poll or discussion, so 1.9.0 collapsed its home to one full-width column. The manager preparation panel and the season now share the 12-column main grid at 1024 px and up: the match to prepare takes 5 columns and the season 7, instead of stacking two wide bands. The 900 to 1023 px board uses the same 5/7 split. A no-profile player still receives the single profile surface.
- **Mode marker.** The dashboard exposes its composed mode through `data-mode` so the layout audit can name the variant it rendered.
- **Evidence.** Every home composition was audited at 1440 and 900 px: presence, announced, lineup with a slot, lineup on the bench, absent, game-day, cancelled, no-game, substitute, manager, no-profile manager, no-profile player and an unvoted poll. The no-profile manager home now places the match to prepare at 511 px beside a 721 px season at 1440, and 352 px beside 500 px at 900; its 900 px height drops from 1389 to 1130. No audited variant overflows horizontally or logs a console error, and the 320 px variants stay one column.
- **Functionalities.** On the local preview, answering presence recorded `present` and showed the confirmation, voting moved the poll from Samedi to Vendredi, claiming a substitute place filled the request and moved the player into the lineup, the hero, season, discussion and account links reached their routes, and logout returned to the connection page.
- **Gate.** `npm run gate` exit 0: 1129 tests in 156 files, svelte-check 0/0, architecture 396 files, generated assets and documentation current, 92 client chunks without zod.
- **Release.** PR #35 merged at `a0841bd`; release PR #36 merged at `91c80dc`. The automatic workflow produced tag `v1.9.1`, the GitHub release and the GHCR image without a manual tag.
- **Live.** Image `ghcr.io/sbk-techno/ligue-hockey:1.9.1`, host digest `sha256:0c7415e1ac9dd4d0feef9c89bb121f3db0d184d30bfbfdf73d4f5ccdf5f8dfd3`, local id `sha256:eb7558c44c0fdd9f5e45b040b4e784647a02f0558d4e7bf726a2f76c328acfef`, healthy since 2026-11-17T16:24:53Z with zero restarts. Public health reports `ok`/`ok`/`applied`, and the first three minutes of logs carry no error. Carl's live session at 1440 renders the 511 px match preparation panel beside the 721 px season, `/admin/matchs/...` and `/admin` open without a refusal, logout returns to `/connexion`, and no console error appears.
- **Rollback.** The pre-update database copy is `/home/jadorais/backups/ligue-20261117T112430.db`; the 1.9.0 compose file is `/home/jadorais/compose.ligue-hockey.yml.1.9.0.bak`.

## Release 1.9.0 (shipped)

- **Desktop Accueil.** At 1024 px and up, the home is a two-column situation board: the next match and the season in a 2fr main column, presence, poll and discussion in a 1fr rail. The scoreboard and presence now start on the same row instead of stacking, and the rail keeps the status surfaces together.
- **Phone unchanged.** The composition owns each panel's column (`zone`): main for the match, manager preparation, team, actions, season and next games; rail for presence, poll, substitutes, discussion and install. Below 1024 px the two containers use `display: contents`, so the phone keeps the composition order and the 900 to 1023 px board keeps its 12-column spans exactly. A test asserts that flattening the columns reproduces the composition order.
- **Wide season.** When no rail content exists beside the main column (an account without a player profile), the season splits upcoming and recent results into two columns through a container query instead of stretching one wide list.
- **Evidence.** At 1440 px the player home drops from 1671 to 1437 px and the scoreboard and presence share the first row; at 1024 px it drops from 1668 to 1477. The 900 px layout is unchanged (1724 px), the 320 px home has no horizontal overflow (scroll width 320) and no audited width reports a console error. The manager home at 1440 px reads as a 2fr/1fr board with the manager panel, team and actions in the main column. The no-profile admin home at 1440 px uses the full width with the season split into upcoming and results.
- **Gate.** `npm run gate` exit 0: 1129 tests in 156 files, svelte-check 0/0, architecture 396 files, generated assets and documentation current, 92 client chunks without zod.
- **Release.** PR #32 merged at `d6c5fac`; release PR #33 merged at `5497835`. The automatic workflow produced tag `v1.9.0`, the GitHub release and the GHCR image without a manual tag.
- **Live.** Image `ghcr.io/sbk-techno/ligue-hockey:1.9.0`, host digest `sha256:cb975fc72e1e8740b94209f4c8ab532bb6ec3699364999e54dec323fd87ba1b4`, local id `sha256:e155d7e725a60181ce9aef578e7da6a3f46a8655814f7d34ccf000df103f3fe9`, healthy since 2026-11-17T15:34:08Z with zero restarts. Public health reports `ok`/`ok`/`applied`, and the first three minutes of logs carry no error. At 1440 px the live home renders an 818 px main column and a 409 px rail, with the scoreboard and presence on the same row; the live 900 px home keeps the 1.8.2 paired board (team 352, actions 500, season 500, presence 352, poll 426, discussion 426) with no overflow and no console error.
- **Rollback.** The pre-update database copy is `/home/jadorais/backups/ligue-20261117T103333.db`; the 1.8.2 compose file is `/home/jadorais/compose.ligue-hockey.yml.1.8.2.bak`.

## Release 1.8.2 (shipped)

- **Home last row.** The poll and the discussion each took the full row on a wide home, so the page still ended as a single column of two panels. In lineup, announced, presence and absent modes, when no substitute list owns its own row, the poll and the discussion now share the last row at 6 and 6. The game-day poll keeps its place beside attendance, and the substitute list keeps its own row.
- **Evidence.** At 900 px the manager home drops from 2337 to 2136 px and the player home from 1925 to 1724; at 1440 px the player home drops from 1872 to 1671. The last row shows the poll and the discussion side by side, with no horizontal overflow and no console errors at either width.
- **Gate.** `npm run gate` exit 0: 1127 tests in 156 files, svelte-check 0/0, architecture 396 files, generated assets and documentation current, 92 client chunks without zod.
- **Release.** PR #29 merged at `ad6b160`; release PR #30 merged at `d6758fd`. The automatic workflow produced tag `v1.8.2`, the GitHub release and the GHCR image without a manual tag.
- **Live.** Image `ghcr.io/sbk-techno/ligue-hockey:1.8.2`, host digest `sha256:32b1a052b504f5c765fca39e71cd12208060cbaa2982ffaf4044b5d0daf79c82`, local id `sha256:252205812ea5d1b170bcd8c3e9f94b812d840076be4b6c9a276bb2f8b8518a9f`, healthy since 2026-11-17T14:55:23Z with zero restarts. Public health reports `ok`/`ok`/`applied` with HSTS, the first three minutes of logs carry no error, and the live manager home at 900 px shows the poll and the discussion side by side.
- **Rollback.** The pre-update database copy is `/home/jadorais/backups/ligue-20261117T095459.db`; the 1.8.1 compose file is `/home/jadorais/compose.ligue-hockey.yml.1.8.1.bak`.

## Release 1.8.1 (shipped)

- **Desktop threshold.** The desktop composition started at 1024 px, so a 900 to 1023 px desktop window still received the phone column even though the shell is a desktop. The `lg` breakpoint in `tokens.css` is now 900 px and the authored media queries in `layout.css` and `critical.css` follow it. The shell, navigation, page grids, chat rows and rink labels compose from 900 px.
- **Dense grids.** The two-column ledger and the collapsed assessment cards keep a 1024 px threshold; below it their rows keep the full width, so a name no longer breaks into syllables. The dashboard right rail and the four rating criteria use one column until 1280 px.
- **Service worker.** A page that was already controlled reloads once when a new worker takes over. The old page kept its route manifest after a deploy and the hashed chunks it referenced were gone; the first install still does not reload. The decision is covered by a unit test.
- **Evidence.** Every authenticated and public route rendered at 900 px with no horizontal overflow and no console errors. The manager navigation keeps all six items on one line, the admin ledger and assessment rows are single-column, and the admin dashboard stacks its rail. The 900 px home drops from 2773 to 1925 px. The densest routes were rechecked at 1024 and 1440 px, where the ledger, assessment cards, dashboard and rating criteria return to their two-column compositions.
- **Gate.** `npm run gate` exit 0: 1125 tests in 156 files, svelte-check 0/0, architecture 396 files, generated assets and documentation current, 92 client chunks without zod.
- **Release.** PR #26 merged at `36d8a37`; release PR #27 merged at `5a4567e`. The automatic workflow produced tag `v1.8.1`, the GitHub release and the GHCR image without a manual tag.
- **Live.** Image `ghcr.io/sbk-techno/ligue-hockey:1.8.1`, host digest `sha256:abf141ebd7284c136f9f20c648a0c8b88fcf226e59a552b9ad5b3e648749db10`, local id `sha256:61b6c92e66af7e9e0b554f2eb7bbf4c61cf7676bd04c0fccec5ece6bac60a2a6`, healthy since 2026-11-17T14:21:08Z with zero restarts. Public health reports `ok`/`ok`/`applied` with HSTS, the database serves 29 active players across 15 migrations, and the first three minutes of logs carry no error. At 900 px the live manager home shows the six-item navigation, the two-column season panel and no horizontal overflow.
- **Rollback.** The pre-update database copy is `/home/jadorais/backups/ligue-20261117T092041.db`; the 1.8.0 compose file is `/home/jadorais/compose.ligue-hockey.yml.1.8.0.bak`.

## Release 1.8.0 (shipped)

- PR #21 merged at `27d303c`, PR #22 at `83677e8`, release PR #23 (`1.7.0`) at `867bbcd` and release PR #24 (`1.8.0`) at `0a1137c`. The automatic workflow produced tags `v1.7.0` and `v1.8.0`, both GitHub releases and both GHCR images; no tag was created by hand.
- Final tree: `npm run gate` exit 0 on the merged 1.7.0 tree, then every required check passed on #22 and on release PR #24. The gate reports 1123 tests in 155 files, svelte-check 0/0, architecture 394 files, generated assets and documentation current, 92 client chunks without zod, and `npm audit` reports zero vulnerabilities.
- Live: image `ghcr.io/sbk-techno/ligue-hockey:1.8.0`, host digest `sha256:900c91ba5b11315b1a92a0c341d24e40adb6e96f08f78d11c5e33783e5254679`, local id `sha256:3e34e5bf577999265d5b3927fe837cb35038c8009433a710c5d2b3df986e775e`, healthy since 2026-11-17T12:57:22Z, zero restarts. Public health reports `ok`/`ok`/`applied` with HSTS; the database serves 29 active players across 15 applied migrations, and the first three minutes of logs carry no error.
- Backup: `/home/jadorais/backups/ligue-20261117T075657.db`. The pre-update compose file is `/home/jadorais/compose.ligue-hockey.yml.1.6.0.bak`, with the verified `1.6.0` digest `sha256:1d07cb4223547278598a0766f9c35c39e65953d55ab8d87daa639562f70d5b07` and local id `sha256:236b44753bdc1fbf46ce6998429d29194d3fda4b5b87ed16b877465c38e858b6`.
- **Environment vault.** The deployment secrets moved from `/tmp` to `/home/jadorais/.env.ligue-hockey` with mode `0600`; `OPERATIONS.md` names that path in every Compose command.
- **Forge gap.** The organization policy forbids GitHub Actions from creating pull requests. `auto-release.yml` pushes `release/next` and stops at `createPullRequest`; the operator opens the release PR with the prepared title and body, then re-runs the failed job. Tags, GitHub releases and images remain automatic, and the recovery is documented in `OPERATIONS.md`.
- `1.7.0` shipped the realistic painted identities, the lineup gestures and the dependency override. `1.8.0` shipped the A1 design pass below.

## A1 design pass (shipped in 1.8.0)

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
- **Next.** Merged at `83677e8` and shipped in `1.8.0`; no further design work is planned on this pass.

## Release 1.7.0 (shipped)

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
