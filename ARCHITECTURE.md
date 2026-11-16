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
| Application palette | `src/lib/ui/tokens.css` | every component, emails, docs, social image, offline page | `verify:architecture` + `verify:generated` |
| League-editable settings (roster, fees, lead times, limits) | `config/settings-registry.ts` | settings service, admin form, services | registry test + `verify` |
| Positions | `config/positions.ts` | schema checks, forms, roster templates, notifications | architecture check |
| Roles and capabilities | `config/capabilities.ts`, `config/roles.ts` | policy, navigation, admin role editor | policy tests |
| Navigation surfaces | `config/surfaces.ts` | header, bottom bar, account menu | surface tests |
| Alignment rule modes | `config/rule-modes.ts` | rule form, rule list, generator, badges | mode round-trip test |
| Rating attributes and weights | `config/rating-attributes.ts` | ratings service, admin form, overall calculation | registry test |
| Notification events and payload schemas | `config/notification-events.ts` | `notify()`, templates, tests | coverage test |
| French copy | `config/i18n/fr.ts` | all UI, emails, errors | French-literal check + `verify:language` |
| Deployment configuration | `src/lib/shared/config/env.ts` | adapters, bootstrap | no `process.env` elsewhere |
| Repository and documentation URLs | `package.json` (`repository`) | docs build, docs publish | `docs:check` |
| Roster template | settings registry → game snapshot | slot generation, team generator | generator test |
| Theme tokens | `src/lib/ui/tokens.css` | every component | no raw colours elsewhere |
| Database shape | `src/lib/domain/*/schema.ts` | migrations, services, types | drizzle-kit diff |
| Derived validation | `drizzle-zod` from the schema | routes and services | typecheck |

Static literals for these facts are prohibited. A repeated value gets an owner and a derived consumer; it is never copied.

## Layers

- `src/lib/shared/`: kernel. Config, clock, ids, i18n, logging, errors, validation, result helpers. No domain imports.
- `src/lib/domain/<module>/`: `schema.ts` (Drizzle), `service.ts` (use cases + policy), `queries.ts` (SQL), `policy.ts` (pure rules), `types.ts`, tests. Domain modules may import the kernel and their own files; cross-module calls go through the other module's service, never its queries.
- `src/lib/server/`: infrastructure only: database client, migrations, adapters.
- `src/routes/`: transport. Load functions produce view models; form actions parse input with the module's schema, call one service, map `AppError` to a message. No business rules.
- `src/lib/ui/`: presentational components. They receive props, emit events, and read only i18n + tokens.

## Configuration

Three explicit layers, each with one owner:

1. **Branding** (build time, checked in): `config/branding.json` with the palette owned by `src/lib/ui/tokens.css`. Generates `src/app.html`, `static/manifest.webmanifest`, `static/robots.txt`, `static/offline.html`, `static/icons/*`, `static/social/apercu.jpg`, and `src/lib/generated/branding.ts`.
2. **League settings** (database): typed registry with a Zod schema, default, French label, and optional min/max. `settings.get()` validates on read and fails loudly on drift. The admin form is generated from the registry. Services ask the settings service; they never read the table.
3. **Deployment** (environment): `src/lib/shared/config/env.ts` parses once at boot, reports every invalid key, and exports a frozen object. Secrets never enter logs or the client bundle.

No module may define its own default for a value owned by one of these layers.

## Authorization

One policy surface: `src/lib/domain/auth/policy.ts`. It answers capability questions (`canManageGames`, `canManagePlayers`, `canModerateChat`, …) from an `Actor` value. A role is only a named set of capabilities in `config/roles.ts`; services ask for a capability, never for a role. Adding a role therefore touches one declaration, not the domain. Current roles: joueur, responsable, admin.

Navigation is derived the same way. `config/surfaces.ts` declares each destination with the capabilities that open it, and `src/lib/domain/auth/surfaces.ts` filters that registry for the current actor. `AppNav` and the account menu render the result, so a surface cannot appear for a role that cannot use it.

Services call policy before every read/write; routes call the same functions only to hide controls. The `/admin` layout calls `requireAdmin` once, but services still enforce it, so an API call cannot bypass the UI. `requireUser` is not enough when the action changes league data.

Ratings and other players' balances are removed from view models in the service, not hidden in the template. Player-facing DTOs carry no rating fields and no other player's money fields. Profile presence (`hasPlayerProfile`, `isSubstitute`) is resolved once in the root layout load and consumed by pages; a page must never infer "player" from a role.

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
- League limits (settings, 0 = no limit): maximum average skill spread, age spread, and player-count spread. Candidates outside a limit are excluded; when none qualify, the best effort is returned with a `rule-limit` warning.
- Objective: minimise combined-overall difference; within `skillTolerance`, minimise combined-age difference; then unmet preferences; deterministic tie-break by stable player id.
- Exhaustive over position-scoped combinations. The search space is bounded by the roster cap in settings; the cap is enforced before generation.
- If the strict pair rules make the roster infeasible, return `violations` naming the rules. Hard violations produce `rule-conflict`; unmet preferences produce `rule-preference`, a warning rather than a conflict.
- The game snapshot stores the violations (rule, kind, strength, player ids) so the admin view can name both players after a reload, without re-running the generator.
- Property tests assert: exact slot counts, no duplicate assignment, every hard rule honoured, determinism, and that a better skill split cannot be found by a single swap.

## Mechanical gates

`npm run verify` runs, in order:

1. `svelte-check`: types and Svelte diagnostics.
2. `eslint`: import boundaries and restricted syntax.
3. `vitest run`: unit, property, and contract tests.
4. `verify:language`: rejects vouvoiement, second-person plural imperatives, em dashes and malformed placeholders in the French dictionary.
5. `verify:architecture`: scans source for forbidden direct access: `process.env`, `console.*`, `new Date()`/`Date.now()` outside the clock, Drizzle imports outside `server/db` and `*/queries.ts`/`schema.ts`, hex colours outside tokens, provider imports outside the notification adapters, database access from routes, unreturned `actionError`, and dictionary keys that do not exist. It also enforces the publication contract from `scripts/lib/ci-contract.ts`: workflow triggers, the `verify`, `container` and `required` jobs, the exact `npm run gate` step, `npm ci`, the Node version file, pinned actions, Pages deployment permissions, release tags and GHCR publishing, the gate and verify scripts, and matching Node majors in `package.json`, `.nvmrc` and the Dockerfile.
6. `verify:generated`: regenerates every branding asset, manifest, app shell, robots file, offline page, social image, and generated module in memory and fails if the checked-in bytes differ, or if a static text asset has no declared generator. A registry test asserts every notification event has French title/body copy, declared channels, and a link to an existing route.
7. `verify:shell`: parses `scripts/ci/container-smoke.sh` with `bash -n`.
8. `docs:check`: builds the documentation site and rejects missing files, broken local links, missing anchors, missing metadata and dash punctuation.

CI runs `npm run gate`, which is the same verify plus `npm run build`. The `required` job aggregates `verify` and `container`, and branch protection on `main` requires that check and refuses direct pushes. A red gate blocks the merge. The check runs on the pull request head, not on a merge commit.

## Web delivery

- Every route is server-rendered and reads its data per request; there is no shared client cache of league data.
- Content-hashed assets are served immutable. The service worker precaches only public static assets and `offline.html`; authenticated HTML, `__data.json`, and API responses are never written to the shared cache. Offline navigation falls back to the static page.
- The manifest and icon URLs are generated with content hashes and regenerated by `npm run generate`; the HTML never hardcodes them.
- The documentation site is rendered from the canonical Markdown at the repository root by `scripts/docs/` and published by GitHub Pages. There is no second copy of the documentation.
- Container images carry OCI version, revision and source labels, and are published to GHCR by the release workflow. `package.json` is the version owner; a release tag must match it.

## Data and migrations

- SQLite in WAL mode, foreign keys on, busy timeout from deployment config.
- Drizzle schema is the database owner; `drizzle-kit generate` produces SQL migrations. Migrations run once at startup through one module-level promise.
- Every mutation that spans rows uses a transaction. Slot claims use a conditional update so two substitutes cannot claim the same slot.
- Timestamps are epoch milliseconds from the clock; game dates are local `YYYY-MM-DD` + `HH:mm` in the league timezone, never derived from the server's zone.

## Operations

- `/api/health` reports database reachability, whether migrations are applied, and the scheduler heartbeat.
- Structured logs only. `src/lib/shared/logging/redact.ts` is the single redaction owner: sensitive keys at any depth, password-reset tokens in `path` fields, and stack traces outside production. The logger applies it to every record, so no call site can bypass it.
- Graceful shutdown stops the scheduler, closes the HTTP server, then closes SQLite.
- Backups: copy the SQLite file with `sqlite3 .backup` (documented in `OPERATIONS.md`), not by copying a live WAL file.
