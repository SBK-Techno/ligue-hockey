# Architecture

> Ce document technique est en anglais pour rester aligné avec le code et les identifiants.

## Runtime

Single-container SvelteKit application, Node 24, SQLite (WAL) on a mounted volume, served behind the operator's HTTPS reverse proxy. One league per deployment. No multi-tenancy.

```
Browser (PWA)
  │  HTML + form actions + periodic refresh
  ▼
SvelteKit routes  ──►  domain services  ──►  repositories / Drizzle  ──►  SQLite
                        │
                        ├─► policy (authorization)
                        ├─► notify() ──► channel adapters (email, push, in-app)
                        ├─► settings service
                        └─► clock / logger / ids
```

Routes never touch the database, environment, SMTP, or APNs directly. Domain services never render UI.

## One owner per fact

| Fact | Owner | Consumers | Gate |
|---|---|---|---|
| App name, manifest colours, icons, locale, timezone, social image, crawl policy | `config/branding.json` | manifest, icons, app shell, robots, layout, emails, OG metadata, offline page, service-worker cache | `verify:generated` |
| Application palette, type families, radii, shadows, spacing | `src/lib/ui/tokens.css` | every component, emails, docs, social image, offline page | `verify:architecture` + `verify:generated` |
| Global type scale and primitive classes (card, button, badge, list, field, stat, tear line) | `src/routes/layout.css` | every route and UI component | `verify:architecture` |
| League-editable settings (roster, fees, lead times, limits) | `config/settings-registry.ts` | settings service, admin form, services | registry test + `verify` |
| Positions | `config/positions.ts` | schema checks, forms, roster templates, notifications | architecture check |
| Roles and capabilities | `config/capabilities.ts`, `config/roles.ts` | policy, navigation, admin role editor | policy tests |
| Navigation surfaces | `config/surfaces.ts` | header, mobile bar, mobile priorities | surface tests |
| Admin screens and their capability | `config/admin-tabs.ts` | admin sidebar, admin mobile selector | typecheck |
| Game status label and tone | `config/game-status.ts` | schedule rows, game detail, admin game lists | typecheck |
| Reusable game locations (name, address, map URL, notes) | `src/lib/domain/locations/schema.ts` | admin locations, game picker, game detail, location metrics | locations tests + migration test |
| Map provider URL template and fallback | `config/maps.ts` | game detail, admin locations | map-link test |
| Historical game location label | `games.location` snapshot | schedule, game detail, notifications, history | migration test |
| Alignment rule modes | `config/rule-modes.ts` | rule form, rule list, generator, badges | mode round-trip test |
| Rating attributes, position criteria and game criteria | `config/rating-attributes.ts` | ratings service, evaluation sheets, overall calculation | registry test |
| Recent-form window | `config/ratings.ts` | ratings service | rating tests |
| Penalty infractions and default minutes | `config/infractions.ts` | schema checks, game sheet form, totals | migration test |
| Periods and overtime label | `config/periods.ts` | game sheet, game detail | typecheck |
| Rink geometry and the six presentation roles | `config/rink.ts` | lineup board, match page, admin game views | rink test |
| Game sheet goals, penalties and totals | `src/lib/domain/gamesheet/` | match sheet, game detail | service tests + migration test |
| Manual lineup marker and CAS token | `games.lineup_manual_at`, `games.generated_at` | regeneration policy, lineup editor | lineup tests |
| Notification events and payload schemas | `config/notification-events.ts` | `notify()`, templates, tests | coverage test |
| French copy | `config/i18n/fr.ts` | all UI, emails, errors | French-literal check + `verify:language` |
| Application version | `package.json` | `package-lock.json` root, `.env.example` image suffix, Docker OCI label, GHCR tags, GitHub release | `verify:release` + release workflow |
| Release bump policy | `config/release.ts` | release planner, auto-release workflow | release tests + `verify:architecture` |
| Deployment configuration (names, bounds, defaults) | `config/env-schema.ts` → `src/lib/shared/config/env.ts` | adapters, bootstrap | no `process.env` elsewhere |
| Repository and documentation URLs | `package.json` (`repository`) | docs build, docs publish | `docs:check` |
| Roster template | settings registry → game snapshot | slot generation, team generator | generator test |
| Theme tokens | `src/lib/ui/tokens.css` | every component | no raw colours elsewhere |
| Player identity catalogue (league faces, tribute legends, colours, appearance) | `config/avatars.ts` and `config/legends.ts` → `config/identities.ts` | profile picker, lineups, admin lists | catalogue tests + no-raw-colour scan |
| Database shape | `src/lib/domain/*/schema.ts` | migrations, services, types | `migrations.spec.ts` drift guard |

Static literals for these facts are prohibited. A repeated value gets an owner and a derived consumer; it is never copied.

## Layers

- `src/lib/shared/`: kernel. Config, clock, ids, i18n, logging, errors, validation, result helpers. No domain imports.
- `src/lib/domain/<module>/`: `schema.ts` (Drizzle), `service.ts` (use cases + policy), `queries.ts` (SQL), `policy.ts` (pure rules), `types.ts`, tests. Domain modules may import the kernel and their own files; cross-module calls go through the other module's service, never its queries.
- `src/lib/server/`: infrastructure only: database client, migrations, adapters.
- `src/routes/`: transport. Load functions produce view models; form actions parse input with the module's schema, call one service, map `AppError` to a message. No business rules.
- `src/lib/ui/`: presentational components. They receive props, emit events, and read only i18n + tokens.

One write-boundary exception is explicit: a query module may import another module's `queries.ts` when a multi-table write must share the caller's transaction. `scripts/lib/architecture.ts` owns the allowlist, each entry carrying its reason; `npm run verify:architecture` rejects any undeclared cross-module query import. The audit queries are the transaction log and are allowed everywhere. Today the declared exceptions are the availability write in `availability/queries.ts`, the lineup purge in `games/queries.ts`, the role write in `players/service.ts` and the notification audience in `subs/service.ts`. Schema imports are table vocabulary, not calls; they stay readable across modules.

## Visual system

The interface takes its materials from a Québec rink, warmed: cream paper, deep navy, denim blue, brick red and soft rounded sheets. The structure is a modern scoreboard, not a printed match sheet: rounded cards, ruled lists, blue for every action and red for the league mark and urgency. It carries its identity through two type families and three voices.

- **Display and text: Anybody Variable.** Display uses the wider optical range for page titles, the wordmark, the match-sheet date and section headings; text uses the same family at reading sizes for body, labels and buttons. Its digits are tabular, so money, clock times, jersey numbers and counts align without extra rules. `.numeric` and `.stat-value` are the only numeral classes.
- **Data: Spline Sans Mono Variable** for measured stamps only: micro-labels, dates in ruled lists, jersey plates. Never for body copy.

Surfaces are warm white sheets: `--radius-card` 1rem, `--radius-sheet` 1rem, `--radius-control` 0.75rem, a 1px border and a soft card shadow. A lifted panel adds `--shadow-lift`, a diffuse shadow rather than a halo or a hard offset. Lists are ruled with `divide-y`; card stacks are reserved for genuinely separate objects. The page carries two faint radial washes, blue at the top left and red at the top right.

Colour is semantic:

- `ink` is deep navy and `paper` is warm cream: structure, body text and surfaces, never a cold white dashboard.
- `ice` is denim blue: every primary action, link, focus ring and selected state.
- `accent` is brick red: the league mark, today and unread. It is a line and fill colour, not ordinary body text. The photo caption is `paper` on the ink scrim.
- `alert` is a deeper red, reserved for overdue, cancellation, validation and destructive confirmation. `ok` is a restrained green for success only.

`src/routes/layout.css` owns the primitives so a page cannot invent a parallel button or card: `.card`, `.card-flush`, `.btn-*`, `.badge-*`, `.label`, `.input`, `.hint`, `.micro-label`, `.numeric`, `.scoreboard`. Focus rings switch to paper on ink surfaces, dialogs lock body scroll, and `prefers-reduced-motion` disables transitions and the card lift.

Dark surfaces use an opacity ladder on `paper` (55% to 90%) rather than ad-hoc greys; every step was checked against `ink` for 4.5:1 body contrast.

The page and the rink are material surfaces, not flat fills. `config/branding.json` owns the two painted sources, `config/materials.ts` owns their full-bleed dimensions, quality, gamma and highlight compression, and `scripts/lib/branding.ts` writes two content-hashed WebP images under `static/textures/` within the `paperTextureBytes` and `rinkTextureBytes` budgets. `.page-ground` uses the paper sheet at `cover` under a paper-colour veil; `.rink` uses the ice sheet at `cover` beneath the functional rink lines. Nothing tiles, so no mirror seam or repeated motif can appear.

The anonymous auth shell uses one generated photograph as its only visual: a dressing room at dawn with two beers, gloves, a white jersey and the rink window. The source is `config/branding/auth-source.jpg`, the served form is the content-hashed WebP under `static/auth/`, and `config/branding.json` owns the source. The brand lockup and the short `auth.afterGame` caption are the only identity text; the shell never repeats the league name or promises features already stated by the form.

## Player identity

Every player shows one of 58 curated painted identities. `config/avatars.ts` owns the 28 league faces; `config/legends.ts` owns the 30 tribute legends, distributed 15 forwards, 11 defense and 4 goalies to follow the league roster ratio. `config/identities.ts` is the one catalogue that composes them, indexes them and colours them. `config/identity-sheet.ts` owns the sheet layout, `config/branding/portraits/<id>.webp` holds one painted source per identity, and `scripts/lib/branding.ts` composes the single content-hashed WebP sheet under `static/identities/` within the `identitySheetBytes` budget. The generator also derives a compact identity index (ids, player colours and league-face count) into `src/lib/generated/branding.ts`; avatar lookups read that index, while automatic assignment and the legend picker read the full catalogue, so a page that only paints an avatar never ships the names, numbers and eras. `src/lib/ui/IdentityPortrait.svelte` positions one tile; `src/lib/ui/Avatar.svelte` owns sizing and accessibility. The lineup, profile and admin surfaces consume the same sheet without a per-portrait file or their own colour map.

A legend is an identity, not a decoration: its name, jersey number, position and era are historical facts about a Montréal Canadiens alumnus, and its portrait is an original painted image, recognizable as the real player through likeness, era and equipment. No photograph, logo or official mark is used. The picker offers only the legends that played the position currently selected in the form, so the list always matches the player; a saved legend from another position stays visible and flagged rather than silently disappearing. The server enforces the same rule through `identityAllowedForPosition`: a new choice, a position change or an activation cannot persist a legend outside the player's position. The disclaimer next to the list is the single notice for the whole family.

`players.avatar_id` stores the chosen id. Every active player has exactly one stored identity: `players_active_avatar_unique` is a partial unique index over `active = 1 and avatar_id is not null`, and the migration that introduces it assigns a deterministic free catalogue entry to every active row before creating the index. A new profile, an activation and a profile write reserve their identity inside the same transaction as the row write, so availability cannot be read and then stolen before the write. An inactive row may keep an identity that an active player now holds; reactivation revalidates it rather than duplicating it. A missing or retired id still resolves through FNV-1a from the account id in `src/lib/domain/players/identity.ts`, but that is a legacy read path, not a write path. Automatic assignment takes the first free catalogue entry for the player's position, league faces before legends, and refuses with `error.noIdentityAvailable` instead of storing null.

`players.jersey_number` follows the same reservation rule: `players_active_jersey_unique` is a partial unique index over `active = 1 and jersey_number is not null`. A profile write, an admin save and an activation revalidate the number inside the write transaction; two concurrent claims leave one winner and the loser gets `error.jerseyTaken`, never a read-then-write race. Deactivation keeps the stored number but releases it from the index, and an inactive row may keep a number an active player now holds until reactivation revalidates it. Migration `0014` creates the index and therefore fails loudly when existing active rows already share a number, instead of silently choosing a winner; the operator resolves the duplicates before deploying. The index and its reservation are the single owner of jersey uniqueness, exactly like the avatar index.

## Configuration

Three explicit layers, each with one owner:

1. **Branding** (build time, checked in): `config/branding.json` with the palette owned by `src/lib/ui/tokens.css`. Generates `src/app.html`, `src/lib/generated/branding.ts`, `src/lib/generated/critical-style.ts`, `static/manifest.webmanifest`, `static/robots.txt`, `static/offline.html`, `static/generated-assets.json`, and every content-named file under `static/icons/`, `static/auth/`, `static/textures/`, `static/identities/` and `static/social/`. `scripts/lib/generated-surfaces.ts` is the declared list: the generator refuses an undeclared path and `docs:check` refuses a surface missing from this section.
2. **League settings** (database): typed registry with a Zod schema, default, French label, and optional min/max. `settings.get()` validates on read and fails loudly on drift. The admin form is generated from the registry. Services ask the settings service; they never read the table.
3. **Deployment** (environment): `src/lib/shared/config/env.ts` parses once at boot, reports every invalid key, and exports a frozen object. Secrets never enter logs or the client bundle.

No module may define its own default for a value owned by one of these layers.

## Authorization

One policy surface: `src/lib/domain/auth/policy.ts`. It answers capability questions (`canManageGames`, `canManagePlayers`, `canModerateChat`, …) from an `Actor` value. A role is only a named set of capabilities in `config/roles.ts`; services ask for a capability, never for a role. Adding a role therefore touches one declaration, not the domain. Current roles: joueur, responsable, admin.

Navigation is derived the same way. `config/surfaces.ts` declares each destination with the capabilities that open it and a mobile priority, and `src/lib/domain/auth/surfaces.ts` filters that registry for the current actor. The header renders the primary surfaces; the mobile bar keeps the five lowest priorities, so Gestion replaces Mon profil for a manager. A surface cannot appear for a role that cannot use it.

Services call policy before every read/write; routes call the same functions only to hide controls. The `/admin` layout calls `requireAdmin` once, but services still enforce it, so an API call cannot bypass the UI. `requireUser` is not enough when the action changes league data.

Ratings and other players' balances are removed from view models in the service, not hidden in the template. Player-facing DTOs carry no rating fields and no other player's money fields. Profile presence (`hasPlayerProfile`, `isSubstitute`) is resolved once in the root layout load and consumed by pages; a page must never infer "player" from a role.

Better Auth's HTTP router is a read-only plane for this app: `hooks.server.ts` refuses every non-GET `/api/auth/*` request with the shared `{ok, key, message}` envelope, so the admin plugin and `/update-user` cannot become a second mutation owner, while the reset-password GET link stays available. Every auth use case goes through `auth.api` in a domain service, including the invitation. The provider rate limiter is disabled; `consumeAttempt` in `src/lib/domain/auth/service.ts` is the only sign-in limiter. Member writes share one limit in `src/lib/server/security/member-action.ts`, applied once in the hook with the declared auth and health exemptions.

Deactivation writes four things in one transaction: the player row becomes inactive, future `game_slots` are emptied, future attendance rows are deleted and future substitute claims are reopened. The account loses every capability immediately, not at commit: `hooks.server.ts` reads the player's active flag on each page, data or API request and builds an anonymous actor for an inactive account, so an old cookie cannot keep a capability; public immutable assets skip both lookups. Two independent provider attempts follow the committed transaction: `setAccountState` closes the account and `revokeSessions` removes its sessions, and each is attempted even when the other fails. Their failures are logged as `players.account_state_failed` and `players.session_revoke_failed`; reactivation uses its own attempt and logs `players.account_reactivate_failed`. Any of those failures returns `admin.playerAccessFailed`, so the partial state is observable instead of being retried inside the transaction. Self-deactivation and deactivation of the last active administrator are refused.

Deletion follows a retention rule owned by `src/lib/domain/players/queries.ts` and stated here: the player row is never removed. Its name becomes the neutral `player.deletedName` copy, its email, password, sessions and substitute profile are erased, and `deleted_at` marks it as unrecoverable. Payments, payment plans, past `game_slots`, goals and past substitute requests keep their foreign keys, so the ledger and the historical sheets remain readable; the public and admin reads resolve the row to the neutral name and never print the raw id. The same transaction rewrites every stored goal, assist and penalty name snapshot that references the deleted player, and deletes the season and per-game rating rows: evaluations are not a played fact and do not survive the account. Future slots, future attendance and future substitute requests are released in the same transaction, exactly like deactivation. A deleted row is excluded from the admin lists, cannot be reactivated, and its identity is free for another visible row.

## Evaluations

Two layers, never merged:

- **Season sheet.** `player_ratings` keeps the four league notes that drive team balancing (Passeur, Rapidité, Agilité, Replis défensif) plus optional position criteria: three for forwards, three for defence, six for goalies. The season overall is the mean of the four league notes only; position criteria are descriptive and never block lineup generation.
- **Game sheet.** `game_player_ratings` stores four observations from 1 to 5 per dressed player and game, adapted to the position (impact, engagement, décisions, discipline for skaters; positionnement, rebonds, manipulation, sang-froid for goalies). A missing observation means “pas vu”, never zero. Game sheets never overwrite or average into the season sheet.

The recent-form value is a derived mean of the last `RATING_FORM_WINDOW` evaluated games and is shown separately from the season overall. Every write requires `editRatings`; every read that exposes ratings does the same. The evaluation hub, season sheet and game sheet are the only editing surfaces; the player admin page links to the season sheet instead of duplicating it.

## Locations

A location is a reusable league entity in `locations`: name, optional address, optional map URL and notes. Games reference it through `location_id` with `ON DELETE RESTRICT`, so a location used by a game cannot be deleted. The admin screen at `/admin/lieux` owns create, edit and delete; the game form only selects an existing location.

`games.location` remains on the row as a historical snapshot label. It is written from the location name when a game is created or its location changes, and it is never edited independently. Renaming a location changes future pickers and map links, but it does not rewrite past game labels or notification payloads.

Map links come from `config/maps.ts`: an explicit location map URL wins, otherwise the address fills the provider-agnostic search template, otherwise there is no link. Location metrics (game count, completed count, next and last game dates) are one grouped query in `locations/queries.ts`; the admin screen reads that result and never queries per row.

## Game sheet

A game is completed only when `games.completed_at` is set; the `completed` status alone is not the record. Goals and penalties live in `game_goals` and `game_penalties`, written with a manager capability once the game has started. Each row keeps the player name and jersey as a snapshot, so renaming an account never rewrites a played sheet; deleting an account rewrites those names to the neutral name and purges its ratings in the delete transaction, as stated above. An own goal is recorded with the team credited with the goal and the last attacking player as scorer; it counts for that team in the score. Player totals are derived on read from the dressed slots: one row per dressed player, zeros included.

## Manual lineup

The lineup editor sends `expectedGeneratedAt`, the `games.generated_at` value it read. `saveAssignments` performs the conditional update first and aborts before touching a slot when the token no longer matches, so two managers cannot overwrite each other. A manual save sets `games.lineup_manual_at` and the same snapshot builder as automatic generation. `regenerateIfGenerated` and `regenerateUpcomingGeneratedGames` skip a manual lineup; an explicit `regenerateGame` clears the flag. Swaps and slot filling are user actions, so they also set it.

## Notifications

```
domain event ──► notify(eventKey, recipients, payload)
                   │ validates payload against the event registry
                   ├─ resolves each recipient's channel preferences
                   ├─ renders French subject/body from the dictionary
                   ├─ inserts idempotent notification_jobs (dedupe_key)
                   └─ scheduler claims due jobs and calls one adapter per channel
```

- `notification_jobs` is the durable queue and the in-app inbox. A job is claimed with a conditional update, so a second tick cannot double-send.
- Email and push adapters implement one interface. Web Push uses VAPID and always shows a notification; iOS requires installation and `userVisibleOnly: true`.
- Wave policy is pure and tested: favourites are notified `priorityGapHours` before the general list, never after the game starts. If a request is created late, the remaining window is compressed; favourites still go first.
- No module sends email or push directly. `notify()` is the only entry point.

## Team generation

Pure function in `src/lib/domain/teams/generator.ts`:

- Input validated by schema: players (id, position, age, overall), slot template, pair rules, objective settings.
- Hard constraints: slot counts, one player per slot, strict pair rules.
- Preferences: non-strict pair rules do not block a better distribution; they break ties once size and skill are equal.
- League limits (settings, 0 = no limit): maximum combined-overall spread, cumulative-age spread, and player-count spread. Age is compared as the sum of the team's ages, never as an average, so one very young player cannot mask an older roster. Candidates outside a limit are excluded; when none qualify, the best effort is returned with a `rule-limit` warning.
- Objective: minimise combined-overall difference; within `skillTolerance`, minimise combined-age difference; then unmet preferences; deterministic tie-break by stable player id.
- Exhaustive over position-scoped combinations. The search space is bounded by the roster cap in settings; the cap is enforced before generation.
- If the strict pair rules make the roster infeasible, return `violations` naming the rules. Hard violations produce `rule-conflict`; unmet preferences produce `rule-preference`, a warning rather than a conflict.
- The game snapshot stores the violations (rule, kind, strength, player ids) so the admin view can name both players after a reload, without re-running the generator.
- Table-driven generator tests assert: exact slot counts, no duplicate assignment, every hard rule honoured, determinism, and that a better skill split cannot be found by a single swap.

## Mechanical gates

`npm run verify` is the local gate; `npm run gate` adds the production build. The script list, order and checks belong to `package.json`. The architecture and publication contract live in `scripts/verify-architecture.ts`, `scripts/lib/ci-contract.ts` and `config/release.ts`; this document does not restate their contents, so run the gate or read those owners.

The gate refuses forbidden direct access in source (environment, console, ambient clock, Drizzle outside its layer, raw colours, provider imports, database access from routes), a missing or weakened publication contract, a version surface disagreement, a stale generated asset, an unparsable smoke script and a broken documentation site. Each rule is implemented and tested in its owner.

CI runs `npm run gate` through `.github/workflows/ci.yml`; the workflow files are the only owner of triggers, jobs and required status. A red gate blocks the merge.

## Release automation

`package.json` owns the application version. `scripts/release/plan.ts` applies `config/release.ts`; `scripts/release/apply.ts` is the only writer of the version surfaces. The workflows in `.github/workflows/` own the triggers, the release pull request, tagging and publication; read them instead of copying their steps. No module writes a version literal outside these owners.

## Web delivery

- Every route is server-rendered and reads its data per request; there is no shared client cache of league data.
- Assets under `/_app/immutable` and every content-named generated asset declared in `static/generated-assets.json` (icons, auth photos, textures, identity sheet, social image) are served with a one-year immutable cache. The policy is installed by `serve.js` before the adapter listens; `serve.js` is the only supported entrypoint for the container and the preview, while `node build` and `vite preview` bypass the policy. The manifest, offline page, robots file and service worker use a short or no-cache policy; the superseded unhashed social path keeps a short cache. On a host that served the previous build, the generator retains replaced hashed assets already on disk for `GENERATED_ASSET_RETENTION_DAYS` (`scripts/lib/asset-retention.ts`) before cleanup. A fresh checkout or a new image starts with only the current names, so a longer window requires keeping `static/` across deployments; the build cannot reconstruct an asset that is not on disk. The service worker precaches only public static assets and `offline.html`; authenticated HTML, `__data.json`, and API responses are never written to the shared cache. Offline navigation falls back to the static page.
- The manifest and icon URLs are generated with content hashes and regenerated by `npm run generate`; the HTML never hardcodes them.
- The documentation site is rendered from the canonical Markdown at the repository root by `scripts/docs/`; publication is owned by `.github/workflows/pages.yml`. There is no second copy of the documentation.
- Container images carry OCI version, revision and source labels. `package.json` is the version owner; a release tag must match it.

## Data and migrations

- SQLite in WAL mode, foreign keys on, busy timeout from deployment config.
- Drizzle schema is the database owner; `drizzle-kit generate` produces SQL migrations. Migrations run once at startup through one module-level promise.
- `src/lib/server/db/migrations.spec.ts` is the drift guard. It applies the committed migrations to an in-memory SQLite database, compares every registry-backed `CHECK` constraint with `config/settings-registry.ts`, proves every setting key can be inserted, and replays the latest migration against data seeded from the previous schema. A setting added to code without its migration, a stale `CHECK`, or a migration that loses rows fails the suite, not production.
- Adding or removing a setting therefore requires three edits in one change: the registry entry, the Drizzle schema, and a generated migration. The guard rejects any partial state.
- Every mutation that spans rows uses a transaction. Slot claims use a conditional update so two substitutes cannot claim the same slot.
- Timestamps are epoch milliseconds from the clock; game dates are local `YYYY-MM-DD` + `HH:mm` in the league timezone, never derived from the server's zone.

## Operations

- `/api/health` reports database reachability, whether migrations are applied, and the scheduler heartbeat.
- Structured logs only. `src/lib/shared/logging/redact.ts` is the single redaction owner: sensitive keys at any depth, password-reset tokens in `path` fields, and stack traces outside production. The logger applies it to every record, so no call site can bypass it.
- Graceful shutdown stops the scheduler, closes the HTTP server, then closes SQLite.
- Backups: copy the SQLite file with `sqlite3 .backup` (documented in `OPERATIONS.md`), not by copying a live WAL file.
