## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# Project instructions

Read `ARCHITECTURE.md` before changing code. The ownership table there is binding.

## Commands

```bash
npm run dev              # local development
npm run check            # svelte-check
npm run lint             # eslint
npm run test             # vitest
npm run verify           # check, lint, tests, language, architecture, version, generated, shell, docs
npm run verify:release   # package.json, package-lock.json et .env.example portent la même version
npm run release:plan     # calcule la prochaine version depuis les commits
npm run release:apply -- --version x.y.z  # applique la version aux surfaces générées
npm run docs:check       # génère et valide le site de documentation
npm run gate             # verify + build, la porte exacte de CI
npm run build            # production build
npm run db:generate      # generate a migration from schema changes
```

Demo data is created through the admin screens; there is no seed command.

## Intégration continue et publication

GitHub Actions exécute `.github/workflows/ci.yml` sur chaque demande de fusion, sur chaque poussée vers `main` et manuellement. `verify` installe Node depuis `.nvmrc` et appelle `npm run gate`; `container` construit l'image et vérifie `/api/health`; `required` agrège les deux résultats et constitue le statut exigé par la protection de `main`. Aucune étape de vérification n'est copiée dans un workflow.

`pages.yml` publie le site généré par `scripts/docs/` sur `https://sbk-techno.github.io/ligue-hockey/`. `auto-release.yml` calcule la prochaine version, prépare ou met à jour la demande de fusion `release/next` et lance la porte dessus. La fusion de cette demande approuve la version; `auto-release.yml` crée alors l'étiquette `v*` et appelle `release.yml`, qui publie l'image sur GHCR et crée la version GitHub. La politique de montée vit dans `config/release.ts`; les surfaces de version sont écrites par `scripts/release/apply.ts` et contrôlées par `npm run verify:release`. Ne créez pas d'étiquette à la main.

`npm run verify:architecture` valide le contrat de publication dans `scripts/lib/ci-contract.ts`: déclencheurs, tâches `verify`, `container` et `required`, étape exacte `npm run gate`, `npm ci`, `setup-node` avec `.nvmrc` et cache, actions épinglées, permissions Pages, plan de version avec porte et demande de fusion, appel unique à `release.yml`, cible GHCR, scripts `gate`, `verify` et `verify:release`, major Node identique dans `package.json`, `.nvmrc` et le Dockerfile, et métadonnées OCI de l'image.

## Boundaries

- Routes: transport only. Parse with the module schema, call one service, map errors. No SQL, no `process.env`, no adapter calls.
- Domain services: use cases, policy, invariants, transactions. No Svelte, no HTTP, no SMTP.
- Authorization: ask for a capability (`can(actor, 'manageGames')`), never for a role. Declare roles in `config/roles.ts`, destinations in `config/surfaces.ts`.
- `queries.ts`: SQL only. No policy, no formatting.
- Adapters: email, push, clock, ids, logger. One implementation per concern; selected once by config.
- UI components: props in, events out. Copy comes from `t()`. Colours come from tokens.

## Forbidden

- `process.env` outside `src/lib/shared/config/env.ts` (scripts may read env only through that module or explicit CLI args).
- `console.*` outside the logger.
- `new Date()` / `Date.now()` outside `src/lib/shared/time/clock.ts`.
- Drizzle imports outside `src/lib/server/db/` and `src/lib/domain/*/queries.ts` / `schema.ts`.
- Hex or `rgb()`/`hsl()` colours outside `src/lib/ui/tokens.css` and the manifest colours in `config/branding.json`.
- French literals outside `config/i18n/fr.ts` and data fixtures.
- Hand-maintained static text assets: every text file under `static/` must be generated and listed in `static/generated-assets.json`.
- Duplicated defaults or generated asset names: every tunable and every generated filename belongs to one config layer or manifest.
- Role checks in UI or services (`actor.role === 'admin'`) outside `config/roles.ts` and `policy.ts`.
- Direct `fetch` to email/push providers; use the adapters.

## Adding a feature

1. Add or change the domain schema and generate a migration.
2. Add the service use case and policy check.
3. Add the Zod-derived input schema, then the route action.
4. Add the view model and UI, with copy in the dictionary. Gate navigation and actions by capability, and player-only content by profile presence.
5. Add tests for the rule, the permission, and the failure path.
6. Run `npm run verify`.

## Data rules

- Ratings and other players' balances never leave the service layer for a player actor.
- All multi-row mutations are transactional.
- Slot claims are conditional updates, not read-then-write.
- Game times are league-local; use the clock/timezone module.
- Notification sends go through `notify()` only.
