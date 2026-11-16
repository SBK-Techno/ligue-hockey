# Ligue de hockey du dimanche matin

PWA installable pour une ligue de hockey récréatif du dimanche matin, en français québécois. Elle réunit l'horaire, les présences, les équipes équilibrées, la banque de remplaçants, les frais de saison et la discussion avec sondages.

## Fonctionnalités

- **Horaire** : matchs à venir et passés, notes, aréna, heure de la ligue.
- **Présences** : chaque joueur confirme ou signale son absence avant la fermeture configurée.
- **Équipes** : deux équipes recomposées après chaque changement, équilibrées par note globale, puis par âge dans la tolérance configurée, en respectant les règles de paires.
- **Remplaçants** : demandes par position, favoris avisés 4 h avant la liste générale par défaut, réclamation et retrait en libre-service.
- **Frais** : deux versements, rabais gardien, ajustement individuel, retard en rouge. Chaque joueur ne voit que son solde.
- **Discussion** : messages et sondages avec clôture et dépouillement.
- **Notifications** : Web Push et courriel, file durable avec préférences par membre.
- **Confidentialité** : les quatre notes (passe, vitesse, agilité, retour défensif) et les soldes des autres joueurs ne quittent jamais le service pour un joueur.

## Démarrage local

```bash
npm ci
cp .env.example .env
# Renseigner ORIGIN, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev
```

Le serveur applique les migrations et crée l'administrateur au démarrage. Sans SMTP, les courriels sont écrits dans `data/outbox/`. Sans clés VAPID, le push reste désactivé.

## Vérification

```bash
npm run verify   # types, lint, tests, architecture, actifs générés
npm run build    # build de production (adapter-node)
```

Les tests couvrent la sélection d'alignement, le générateur, les vagues de remplaçants, les frais, les descriptions dérivées des réglages et le formatage français.

## Déploiement

Docker et Compose sont la voie supportée :

```bash
mkdir -p data
docker compose up -d --build
curl -fsS https://votre-domaine/api/health
```

Toutes les valeurs d'exploitation, la sauvegarde, les mises à jour et le dépannage sont décrits dans [OPERATIONS.md](OPERATIONS.md). L'architecture et les frontières de modules sont dans [ARCHITECTURE.md](ARCHITECTURE.md).

## Pile

TypeScript de bout en bout : SvelteKit 3, Svelte 5, Tailwind 4, SQLite + Drizzle, Better Auth, Vitest, service worker natif SvelteKit, `adapter-node`.
