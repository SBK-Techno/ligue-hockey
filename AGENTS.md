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
npm run verify           # check + lint + tests + architecture + generated
npm run gate             # verify + build, the exact CI gate
npm run build            # production build
npm run db:generate      # generate a migration from schema changes
```

Demo data is created through the admin screens; there is no seed command.

## Integration continue

Gitea exécute `.gitea/workflows/verification.yml` sur chaque demande de fusion, sur chaque poussée vers `main` et manuellement. La tâche installe avec `npm ci` puis appelle `npm run gate`; elle ne copie aucune étape de vérification. La protection de `main` refuse les poussées directes et exige le statut `Vérification`.

`npm run verify:architecture` valide le contrat CI dans `scripts/lib/ci-contract.ts`: déclencheurs, tâche unique `gate`, étape exacte, actions épinglées, scripts `gate` et `verify`, major Node identique dans `package.json`, le coureur et le Dockerfile, et absence du socket Docker ou de volumes hôte dans les conteneurs de tâche. Le coureur se gère avec `scripts/ci/runner.sh` (voir `OPERATIONS.md`).

## Boundaries

- Routes: transport only. Parse with the module schema, call one service, map errors. No SQL, no `process.env`, no adapter calls.
- Domain services: use cases, policy, invariants, transactions. No Svelte, no HTTP, no SMTP.
- `queries.ts`: SQL only. No policy, no formatting.
- Adapters: email, push, clock, ids, logger. One implementation per concern; selected once by config.
- UI components: props in, events out. Copy comes from `t()`. Colours come from tokens.

## Forbidden

- `process.env` outside `src/lib/shared/config/env.ts` (scripts may read env only through that module or explicit CLI args).
- `console.*` outside the logger.
- `new Date()` / `Date.now()` outside `src/lib/shared/time/clock.ts`.
- Drizzle imports outside `src/lib/server/db/` and `src/lib/domain/*/queries.ts` / `schema.ts`.
- Hex colours outside `src/lib/ui/tokens.css` and `config/branding.json`.
- French literals outside `config/i18n/fr.ts` and data fixtures.
- Duplicated defaults: every tunable belongs to one config layer.
- Direct `fetch` to email/push providers; use the adapters.

## Adding a feature

1. Add or change the domain schema and generate a migration.
2. Add the service use case and policy check.
3. Add the Zod-derived input schema, then the route action.
4. Add the view model and UI, with copy in the dictionary.
5. Add tests for the rule, the permission, and the failure path.
6. Run `npm run verify`.

## Data rules

- Ratings and other players' balances never leave the service layer for a player actor.
- All multi-row mutations are transactional.
- Slot claims are conditional updates, not read-then-write.
- Game times are league-local; use the clock/timezone module.
- Notification sends go through `notify()` only.
