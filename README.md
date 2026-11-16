# Ligue de hockey du dimanche matin

<!-- docs:site:start -->
[![CI](https://github.com/SBK-Techno/ligue-hockey/actions/workflows/ci.yml/badge.svg)](https://github.com/SBK-Techno/ligue-hockey/actions/workflows/ci.yml)
[![Documentation](https://img.shields.io/badge/documentation-en%20ligne-2453BB)](https://sbk-techno.github.io/ligue-hockey/)
[![Image](https://img.shields.io/badge/image-ghcr.io%2Fsbk--techno%2Fligue--hockey-2453BB)](https://github.com/SBK-Techno/ligue-hockey/pkgs/container/ligue-hockey)
<!-- docs:site:end -->

PWA installable pour une ligue de hockey récréatif du dimanche matin, en français québécois. Elle réunit l'horaire, les présences, les équipes équilibrées, la banque de remplaçants, les frais de saison et la discussion avec sondages.

## Fonctionnalités

- **Horaire** : matchs à venir et passés, notes, aréna, heure de la ligue.
- **Présences** : chaque joueur confirme ou signale son absence avant la fermeture configurée.
- **Équipes** : deux équipes recomposées après chaque changement, équilibrées par note globale, puis par âge dans la tolérance configurée, en respectant les règles de paires.
- **Remplaçants** : demandes par position, favoris avisés 4 h avant la liste générale par défaut, réclamation et retrait en libre-service.
- **Frais** : deux versements, rabais gardien, ajustement individuel, retard en rouge. Chaque joueur ne voit que son solde.
- **Discussion** : messages et sondages avec clôture et dépouillement.
- **Notifications** : Web Push et courriel, file durable avec préférences par membre. Invitations et réinitialisations ont leurs propres courriels HTML et texte.
- **Identité SBK** : icônes, manifeste, image de partage et courriels dérivés de `config/branding.json`.
- **Confidentialité** : les quatre notes (passe, vitesse, agilité, retour défensif), les écarts d'alignement et les soldes des autres joueurs ne quittent jamais le service pour un joueur.

## Démarrage local

```bash
npm ci
cp .env.example .env
# Renseigner ORIGIN, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run generate   # icônes, manifeste et image sociale
npm run dev
```

Le modèle `.env.example` cible `https://hockey.sbktechno.com`. En production, `ORIGIN` doit être en HTTPS et `APP_ENV=production`. Le serveur applique les migrations et crée l'administrateur au démarrage. Sans SMTP, les courriels sont écrits dans `data/outbox/`. Sans clés VAPID, le push reste désactivé.

## Vérification

```bash
npm run verify   # types, lint, tests, architecture, actifs générés, documentation
npm run gate     # verify + build, la porte exacte de CI
npm run docs:check
```

Les tests couvrent la sélection d'alignement, le générateur, les vagues de remplaçants, les frais, les descriptions dérivées des réglages, le formatage français, la sécurité des courriels et la politique d'abonnement push. `npm run verify:generated` vérifie chaque actif de marque octet par octet. `npm run docs:check` valide le site de documentation et ses liens.

## Documentation

Le guide complet est publié à <https://sbk-techno.github.io/ligue-hockey/>. Les sources canoniques sont [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [OPERATIONS.md](OPERATIONS.md), [CONTRIBUTING.md](CONTRIBUTING.md) et [SECURITY.md](SECURITY.md); le site est généré par `scripts/docs/`.

## Déploiement

L'image est publiée sur GHCR:

```bash
cp .env.example .env
# Remplir ORIGIN, BETTER_AUTH_SECRET, ADMIN_*, SMTP_*, VAPID_*
docker compose pull
docker compose up -d
curl -fsS https://votre-domaine/api/health
```

Pour construire l'image depuis les sources, utilisez la surcharge prévue:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
``` Toutes les valeurs d'exploitation, la sauvegarde, les mises à jour, le retour arrière et le dépannage sont décrits dans [OPERATIONS.md](OPERATIONS.md). L'architecture et les frontières de modules sont dans [ARCHITECTURE.md](ARCHITECTURE.md).

## Pile

TypeScript de bout en bout : SvelteKit 3, Svelte 5, Tailwind 4, SQLite + Drizzle, Better Auth, Vitest, service worker natif SvelteKit, `adapter-node`.
