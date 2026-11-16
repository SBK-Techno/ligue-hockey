# Opérations

Cette application est un conteneur unique : SvelteKit (Node 24), SQLite en mode WAL sur un volume, notifications par courriel et Web Push. Une seule ligue par déploiement.

## Prérequis

- Docker 24+ et Docker Compose.
- Un nom de domaine et un proxy HTTPS devant le conteneur (Caddy, Traefik ou nginx).
- Un serveur SMTP pour les courriels transactionnels.
- Une paire de clés VAPID pour les notifications push.

## Variables d'environnement

Le schéma fait foi : `config/env-schema.ts`. Le fichier `.env.example` contient un modèle complet.

| Variable | Rôle |
|---|---|
| `ORIGIN` | URL publique exacte, sans barre oblique finale. Utilisée dans les liens de courriel. |
| `BETTER_AUTH_SECRET` | Secret de session, 32 caractères minimum. Ne jamais le changer sans invalider les sessions. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Premier administrateur, créé au démarrage s'il n'existe aucun compte. |
| `DATABASE_URL` | Chemin SQLite. En conteneur : `/app/data/ligue.db`. |
| `SMTP_*` | Courriel. Sans SMTP en production, les envois échouent et sont réessayés. |
| `VAPID_*` | Push. Sans clés, les abonnements push ne peuvent pas être créés. |
| `SESSION_DAYS`, `INVITE_DAYS`, `LOGIN_WINDOW_MINUTES`, `MAX_LOGIN_ATTEMPTS`, `PASSWORD_MIN_LENGTH` | Politique de connexion. |
| `NOTIFICATION_TICK_MS`, `NOTIFICATION_MAX_ATTEMPTS`, `NOTIFICATION_BATCH_SIZE`, `NOTIFICATION_CLAIM_TIMEOUT_MS` | File de notifications. |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`. |

Génération des secrets :

```bash
openssl rand -base64 48          # BETTER_AUTH_SECRET
npx web-push generate-vapid-keys # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

## Première mise en service

```bash
cp .env.example .env
# Remplir ORIGIN, BETTER_AUTH_SECRET, ADMIN_*, SMTP_*, VAPID_*
docker compose up -d --build
docker compose ps
curl -fsS https://votre-domaine/api/health
```

Au démarrage, le conteneur applique les migrations Drizzle, crée l'administrateur initial si nécessaire, puis démarre le planificateur de notifications. Le volume nommé `ligue-data` contient la base et, en développement seulement, la boîte d'envoi locale. `docker compose down` le conserve; `docker compose down -v` le supprime.

Le premier administrateur se connecte avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`, puis invite les joueurs depuis **Administration → Joueurs**. Chaque invitation produit un lien d'activation valide `INVITE_DAYS` jours.

## Santé et supervision

- `GET /api/health` retourne `status`, `database`, `migrations` (`applied`/`missing`) et le dernier battement du planificateur (`scheduler.lastTickAt`).
- Les journaux sont des lignes JSON uniques avec `event`, `requestId`, et redaction des secrets. `docker compose logs -f ligue`.
- Le planificateur tourne toutes les `NOTIFICATION_TICK_MS` millisecondes. Un `lastTickAt` qui vieillit indique un processus bloqué.
- Les actions administratives et les notifications sont tracées dans `audit_log` et consultables en base.

## Mise à jour et retour arrière

```bash
docker compose build --pull
docker compose up -d
curl -fsS https://votre-domaine/api/health
```

Les migrations sont appliquées automatiquement et ne sont pas réversibles. Avant chaque mise à jour :

```bash
mkdir -p backups
docker compose exec -T --user app ligue node scripts/backup.mjs /app/data/backup.db
docker cp ligue-hockey:/app/data/backup.db "backups/ligue-$(date +%Y%m%dT%H%M%S).db"
docker compose exec -T --user app ligue rm /app/data/backup.db
```

Pour revenir à une version précédente, conservez une image étiquetée par version et relancez-la avec la sauvegarde correspondante. Ne rétrogradez jamais le schéma sans restaurer la base.

## Sauvegarde et restauration

Sauvegarde à chaud, sans arrêter l'application :

```bash
docker compose exec -T --user app ligue node scripts/backup.mjs /app/data/backup.db
docker cp ligue-hockey:/app/data/backup.db "backups/ligue-$(date +%Y%m%dT%H%M%S).db"
docker compose exec -T --user app ligue rm /app/data/backup.db
```

Restauration :

```bash
docker compose stop ligue
docker cp backups/ligue-AAAAmmjjTHHMMSS.db ligue-hockey:/app/data/ligue.db
docker compose run --rm --entrypoint sh ligue -c \
  'rm -f /app/data/ligue.db-wal /app/data/ligue.db-shm && chown -R app:app /app/data'
docker compose start ligue
curl -fsS https://votre-domaine/api/health
```

Ne copiez jamais une base WAL active fichier par fichier : utilisez `.backup` ou arrêtez le conteneur.

## Notifications

- Les demandes de remplaçants sont créées par une absence ou manuellement par un administrateur.
- Les favoris sont avisés `notifications.priorityGapHours` avant la liste générale; les deux délais se règlent dans **Administration → Paramètres**.
- Les liens de notification pointent vers `/matchs/<id>`.
- En développement sans SMTP, les courriels sont écrits dans `data/outbox/` avec un mode `0600`. En production, l'absence de SMTP fait échouer la tâche et la réessaie.
- Un abonnement push iOS exige l'installation de la PWA sur l'écran d'accueil.

## Dépannage

| Symptôme | Vérification |
|---|---|
| `health` en 503 | Lire les journaux; vérifier les permissions du volume `./data`. |
| Connexion impossible | Vérifier `ORIGIN`, `BETTER_AUTH_SECRET`, l'horloge système et `MAX_LOGIN_ATTEMPTS`. |
| Courriels absents | Vérifier `SMTP_*`, `notifications.emailEnabled`, et `notification_jobs.last_error`. |
| Push absent | Vérifier les clés VAPID, l'installation de la PWA et l'autorisation du navigateur. |
| Lien d'activation expiré | Un administrateur renvoie l'invitation depuis la fiche du joueur. |
| Équipes refusées | Vérifier que tous les joueurs retenus ont leurs quatre notes; les règles de paires peuvent rendre l'alignement impossible. |

## Limites connues

- Une seule ligue par déploiement; pas de multi-tenant.
- Pas de sauvegarde/restauration depuis l'interface; ces opérations restent des commandes d'exploitation.
- Pas de récupération autonome du mot de passe administrateur; prévoyez un second compte administrateur.
- Aucun SMS.
- Les notes et les soldes des autres joueurs ne quittent jamais les services sous forme de DTO pour un joueur.
