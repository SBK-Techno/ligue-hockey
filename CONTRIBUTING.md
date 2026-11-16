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

La version de `package.json` est l'unique source. La montée de version passe par une demande de fusion, puis l'étiquette est créée sur le commit fusionné:

```bash
npm version patch --no-git-tag-version   # ou minor, major
git switch -c chore/version-x.y.z
git commit -am "chore(version): x.y.z"
git push -u origin chore/version-x.y.z
# Ouvrir et fusionner la demande de fusion.
git switch main && git pull --ff-only
version="$(node -p "require('./package.json').version")"
git tag -a "v$version" -m "Version $version"
git push origin "v$version"
```

Le workflow `release.yml` vérifie que l'étiquette `v<version>` correspond à `package.json`, construit l'image, la pousse sur `ghcr.io/sbk-techno/ligue-hockey` avec les étiquettes de version, de révision et `latest`, puis crée la version GitHub avec les notes générées.

Le déploiement, la sauvegarde et le retour arrière sont décrits dans [OPERATIONS.md](OPERATIONS.md).

## Conventions

- L'interface, les courriels et la documentation sont en français québécois, à la phrase.
- Les identifiants, les types et les commentaires de code sont en anglais.
- Pas de tiret cadratin, pas de tiret demi-cadratin, pas de double trait d'union comme ponctuation.
- Une seule source de vérité par fait, aucun doublon de logique, aucun secret dans le dépôt.
- Les notes, les écarts d'alignement et les soldes des autres joueurs ne quittent jamais le service pour un joueur.

## Sécurité

Consultez [SECURITY.md](SECURITY.md) avant de signaler une vulnérabilité.
