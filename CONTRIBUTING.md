# Contribuer

## Prérequis

- Node 24, la version de `.nvmrc`.
- npm 11 ou plus récent.
- Docker pour vérifier l'image de production.

## Installation

```bash
npm ci
cp .env.example .env
# Renseigner ORIGIN, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run generate
npm run dev
```

Sans SMTP, les courriels sont écrits dans `data/outbox/`. Sans clés VAPID, le push reste désactivé.

## Commandes

```bash
npm run check        # types et diagnostics Svelte
npm run lint         # ESLint
npm run test         # Vitest
npm run verify       # porte complète, sans le build
npm run verify:release # versions cohérentes entre package.json, le lock et .env.example
npm run gate         # verify + build, la porte de CI
npm run docs:build   # génère le site de documentation
npm run docs:check   # génère et valide liens, ancres et métadonnées
```

## Branches et demandes de fusion

- `main` est protégée. Toute modification passe par une demande de fusion.
- Une branche par changement: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
- La vérification `required` doit être verte avant la fusion.
- `CODEOWNERS` demande une revue des propriétaires du dépôt.
- Ne poussez jamais directement sur `main` et n'approuvez jamais votre propre changement.

## Tests

Les règles métier ont leurs tests à côté du module, dans `src/lib/domain/`. Les contrats de publication vivent dans `scripts/lib/ci-contract.spec.ts` et `scripts/docs/lib.spec.ts`. Un bogue reproduit exige un test de régression qui échoue avant le correctif et passe après.

Les tests doivent rester déterministes, isolés et bornés. Une porte rouge est un travail inachevé.

## Documentation

Les sources canoniques sont `README.md`, `ARCHITECTURE.md`, `OPERATIONS.md`, `CONTRIBUTING.md` et `SECURITY.md`. `scripts/docs/build.ts` les rend dans `site/`, avec la palette de `config/branding.json`, les polices du projet, les liens internes réécrits et un sommaire par page. `scripts/docs/check.ts` refuse un lien mort, une ancre absente, une métadonnée manquante ou un tiret cadratin.

Le site est publié par GitHub Pages à `https://sbk-techno.github.io/ligue-hockey/`. La source n'est jamais dupliquée dans un second dossier de documentation.

## Publication

La version de `package.json` est l'unique source. Ne créez pas d'étiquette à la main.

`auto-release.yml` calcule la prochaine version à chaque poussée vers `main`, prépare ou met à jour la branche `release/next` avec `package.json`, `package-lock.json` et `.env.example`, ouvre la demande de fusion et lance la porte dessus. La fusion de cette demande approuve la version; `auto-release.yml` crée alors l'étiquette `v<version>` et appelle `release.yml`, qui publie l'image et la version GitHub.

Les règles de montée vivent dans `config/release.ts`; `npm run release:plan` les applique et `npm run verify:release` contrôle les trois surfaces de version.

Le déploiement, la sauvegarde et le retour arrière sont décrits dans [OPERATIONS.md](OPERATIONS.md).

## Conventions

- L'interface, les courriels et la documentation sont en français québécois, à la phrase.
- Les identifiants, les types et les commentaires de code sont en anglais.
- Pas de tiret cadratin, pas de tiret demi-cadratin, pas de double trait d'union comme ponctuation.
- Une seule source de vérité par fait, aucun doublon de logique, aucun secret dans le dépôt.
- Les notes, les écarts d'alignement et les soldes des autres joueurs ne quittent jamais le service pour un joueur.

## Sécurité

Consultez [SECURITY.md](SECURITY.md) avant de signaler une vulnérabilité.
