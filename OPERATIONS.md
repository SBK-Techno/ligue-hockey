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
docker compose pull
docker compose up -d
docker compose ps
curl -fsS https://votre-domaine/api/health
```

Pour construire l'image depuis les sources au lieu de la tirer de GHCR:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Au démarrage, le conteneur applique les migrations Drizzle, crée l'administrateur initial si nécessaire, puis démarre le planificateur de notifications. Le volume nommé `ligue-data` contient la base et, en développement seulement, la boîte d'envoi locale. `docker compose down` le conserve; `docker compose down -v` le supprime.

Le premier administrateur se connecte avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`, puis invite les joueurs depuis **Administration → Joueurs**. Chaque invitation produit un courriel d'activation valide `INVITE_DAYS` jours. Un joueur qui a déjà un compte peut utiliser **Mot de passe oublié?** sur la page de connexion; le lien reçu est distinct du courriel d'invitation.

## Santé et supervision

- `GET /api/health` retourne `status`, `database`, `migrations` (`applied`/`missing`) et le dernier battement du planificateur (`scheduler.lastTickAt`).
- Les journaux sont des lignes JSON uniques avec `event`, `requestId`, et redaction des secrets. `docker compose logs -f ligue`.
- Le planificateur tourne toutes les `NOTIFICATION_TICK_MS` millisecondes. Un `lastTickAt` qui vieillit indique un processus bloqué.
- Les actions administratives et les notifications sont tracées dans `audit_log` et consultables en base.

## Intégration continue et publication

Le dépôt est publié sur GitHub à `https://github.com/SBK-Techno/ligue-hockey`. Les workflows sont la seule voie de publication:

- `ci.yml` s'exécute sur chaque demande de fusion, sur chaque poussée vers `main` et manuellement. `verify` installe Node depuis `.nvmrc` et exécute `npm run gate`; `container` construit l'image et vérifie `/api/health`; `required` agrège les deux et constitue le statut requis par la protection de `main`.
- `docs.yml` valide le site quand la documentation, la marque ou le générateur changent.
- `pages.yml` publie le site sur `https://sbk-techno.github.io/ligue-hockey/`.
- `release.yml` s'exécute sur une étiquette `v*`: il vérifie que l'étiquette correspond à `package.json`, construit l'image, la pousse sur `ghcr.io/sbk-techno/ligue-hockey` avec les étiquettes de version, de révision et `latest`, puis crée la version GitHub.
- `security.yml` audite les dépendances d'exécution chaque semaine; `codeql.yml` analyse le code; `dependency-review.yml` bloque les changements à risque élevé; Dependabot propose les mises à jour.

`npm run verify:architecture` analyse les workflows et le dépôt, et refuse: un déclencheur manquant, une tâche `verify`, `container` ou `required` absente, une étape `npm run gate` absente ou enveloppée, un `npm ci` absent, un `setup-node` sans `.nvmrc` ou sans cache, une action non épinglée à un SHA complet, une publication Pages sans permission OIDC, une publication qui n'écoute pas les étiquettes `v*` ou qui ne pousse pas sur GHCR, un script `gate` ou `verify` affaibli, un major Node différent entre `package.json`, `.nvmrc` et le Dockerfile, ou une métadonnée OCI absente.

La protection de `main` refuse les poussées directes et exige le statut `required`. Le statut porte sur la tête de la demande de fusion, pas sur un commit de fusion.

## Publication d'une version

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

Vérifiez ensuite la version GitHub et l'image:

```bash
gh release view "v$(node -p "require('./package.json').version")"
docker pull ghcr.io/sbk-techno/ligue-hockey:1.0.0
```

## Mise à jour et retour arrière

L'image de production vient de GHCR. `LIGUE_IMAGE` choisit la version déployée; la valeur par défaut est `ghcr.io/sbk-techno/ligue-hockey:1.0.0`.

```bash
docker compose pull
docker compose up -d
curl -fsS https://votre-domaine/api/health
docker inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' ligue-hockey
```

Pour construire localement, utilisez `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`. Les migrations sont appliquées automatiquement et ne sont pas réversibles. Avant chaque mise à jour :

```bash
mkdir -p backups
docker compose exec -T --user app ligue node scripts/backup.mjs /app/data/backup.db
docker cp ligue-hockey:/app/data/backup.db "backups/ligue-$(date +%Y%m%dT%H%M%S).db"
docker compose exec -T --user app ligue rm /app/data/backup.db
```

Pour revenir à une version précédente, épinglez son étiquette ou son digest dans `LIGUE_IMAGE`, relancez `docker compose pull` et `docker compose up -d`, puis restaurez la base correspondante. Ne rétrogradez jamais le schéma sans restaurer la base.

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
