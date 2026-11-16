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
| `ORIGIN` | URL publique exacte, sans barre oblique finale. Doit utiliser `https://` lorsque `APP_ENV=production`. Utilisée dans les liens de courriel et les cookies de session. |
| `APP_ENV` | `production` en déploiement. Active les erreurs génériques, exige HTTPS et désactive la boîte d'envoi locale. Compose le fixe déjà à `production`. |
| `BETTER_AUTH_SECRET` | Secret de session, 32 caractères minimum. Ne jamais le changer sans invalider les sessions. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Premier administrateur, créé au démarrage s'il n'existe aucun compte. Mot de passe de 12 caractères minimum. |
| `DATABASE_URL` | Chemin SQLite. En conteneur : `/app/data/ligue.db`. |
| `SMTP_*` | Courriel. Sans SMTP en production, les envois échouent et sont réessayés. |
| `VAPID_*` | Push. Sans clés, les abonnements push ne peuvent pas être créés. |
| `SESSION_DAYS`, `INVITE_DAYS`, `LOGIN_WINDOW_MINUTES`, `MAX_LOGIN_ATTEMPTS`, `RESET_REQUESTS_PER_HOUR`, `PASSWORD_CHANGES_PER_HOUR`, `PASSWORD_MIN_LENGTH` | Politique de connexion et limites de récupération de mot de passe. |
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

Le premier administrateur se connecte avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`, puis invite les joueurs depuis **Administration → Joueurs**. Chaque invitation produit un courriel d'activation valide `INVITE_DAYS` jours. Un joueur qui a déjà un compte peut utiliser **Mot de passe oublié?** sur la page de connexion; le lien reçu est distinct du courriel d'invitation.

## Santé et supervision

- `GET /api/health` retourne `status`, `database`, `migrations` (`applied`/`missing`) et le dernier battement du planificateur (`scheduler.lastTickAt`).
- Les journaux sont des lignes JSON uniques avec `event`, `requestId`, et redaction des secrets. `docker compose logs -f ligue`.
- Le planificateur tourne toutes les `NOTIFICATION_TICK_MS` millisecondes. Un `lastTickAt` qui vieillit indique un processus bloqué.
- Les actions administratives et les notifications sont tracées dans `audit_log` et consultables en base.

## Intégration continue

Le dépôt vit sur Gitea à `https://git.localserver.ca/SBK_Techno/ligue-hockey`. Chaque demande de fusion et chaque poussée sur `main` déclenche `.gitea/workflows/verification.yml`, qui exécute `npm run gate` sur le coureur autohébergé étiqueté `linux`. La porte est identique à celle exécutée localement; le workflow n'en copie aucune étape.

Le coureur tourne dans un conteneur `gitea/act_runner`, lance chaque tâche dans l'image Node déclarée par `scripts/ci/act-runner.yaml` et ne monte que le socket Docker requis pour démarrer ces conteneurs de tâche. Son cycle de vie passe par `scripts/ci/runner.sh` :

```bash
scripts/ci/runner.sh install
install -m 600 /dev/stdin "$HOME/ci/ligue-hockey-runner/secrets/registration-token" <<<"$JETON_GITEA"
scripts/ci/runner.sh start
scripts/ci/runner.sh status
scripts/ci/runner.sh logs
scripts/ci/runner.sh stop
```

Le jeton d'enregistrement se crée dans **Paramètres du dépôt → Actions → Coureurs**. Il n'est jamais commité ni écrit dans un journal; `start` le supprime dès l'enregistrement terminé. Le conteneur redémarre avec Docker grâce à `--restart unless-stopped`.

Le major Node de l'image du coureur et celui de `package.json` (`engines.node`) doivent rester identiques. `npm run verify:architecture` refuse la dérive, une étiquette de coureur mal alignée avec `runs-on`, une action non épinglée à un SHA complet ou un workflow qui n'appelle pas `npm run gate`.

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
- Les liens de notification pointent vers `/matchs/<id>`, sauf les avis de compte qui mènent à l'accueil ou au profil.
- Les invitations et les réinitialisations de mot de passe utilisent des courriels HTML et texte distincts, avec identité de la ligue, lien de secours et durée de validité.
- En développement sans SMTP, les courriels sont écrits dans `data/outbox/` avec un mode `0600`. En production, l'absence de SMTP fait échouer la tâche et la réessaie.
- Un abonnement push iOS exige l'installation de la PWA sur l'écran d'accueil.
- Les icônes, le manifeste, l'image de partage sociale et le module de marque sont générés par `npm run generate` depuis `config/branding.json` et `config/branding/`. `npm run verify:generated` refuse un actif périmé.

## Dépannage

| Symptôme | Vérification |
|---|---|
| `health` en 503 | Lire les journaux; vérifier les permissions du volume `./data`. |
| Connexion impossible | Vérifier `ORIGIN`, `BETTER_AUTH_SECRET`, l'horloge système et `MAX_LOGIN_ATTEMPTS`. |
| Courriels absents | Vérifier `SMTP_*`, `notifications.emailEnabled`, et `notification_jobs.last_error`. |
| Push absent | Vérifier les clés VAPID, l'installation de la PWA et l'autorisation du navigateur. |
| Lien d'activation expiré | Le joueur utilise **Mot de passe oublié?** ou un administrateur renvoie un lien depuis la fiche du joueur. |
| Mot de passe oublié sans courriel | Vérifier `SMTP_*`, `RESET_REQUESTS_PER_HOUR` et `notification_jobs.last_error`; les réponses restent génériques pour ne pas révéler les comptes. |
| Équipes refusées | Vérifier que tous les joueurs retenus ont leurs quatre notes; les règles de paires peuvent rendre l'alignement impossible. |

## Limites connues

- Une seule ligue par déploiement; pas de multi-tenant.
- Pas de sauvegarde/restauration depuis l'interface; ces opérations restent des commandes d'exploitation.
- Le courriel de contact de la ligue et les instructions de paiement détaillées ne sont pas encore des réglages; elles restent à ajouter si la ligue les veut dans l'application.
- Aucun SMS.
- Les notes et les soldes des autres joueurs ne quittent jamais les services sous forme de DTO pour un joueur.
