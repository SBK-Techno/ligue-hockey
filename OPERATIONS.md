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

### SMTP et TLS

Le port 587 utilise STARTTLS : garde `SMTP_SECURE=false`, nodemailer négocie le chiffrement sur la connexion existante. `SMTP_SECURE=true` réserve le TLS implicite au port 465. Un `true` sur 587 fait échouer chaque envoi avec `wrong version number`, et la tâche reste en échec dans `notification_jobs.last_error`.

Après un changement dans `.env`, recrée le conteneur pour que l'application relise la valeur. Vérifie ensuite l'envoi réel depuis l'écran d'invitation ou de réinitialisation, puis `notification_jobs.last_error`.

Génération des secrets :

```bash
openssl rand -base64 48          # BETTER_AUTH_SECRET
npx web-push generate-vapid-keys # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

## Proxy TLS et HSTS

L'application ne termine pas TLS et n'émet jamais `Strict-Transport-Security` : le proxy HTTPS en est le seul propriétaire. Le contrat du proxy est le suivant.

- Terminer TLS et transmettre `X-Forwarded-Proto: https` et `Host` au conteneur, sur le port applicatif interne. Ne pas exposer le conteneur en clair.
- Ajouter sur toute réponse HTTPS : `Strict-Transport-Security: max-age=31536000; includeSubDomains`. N'ajouter `preload` qu'après inscription du domaine; ne jamais envoyer HSTS sur une réponse HTTP en clair.
- Ne pas retirer ni remplacer les en-têtes produits par l'application : `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. La CSP est configurée dans `vite.config.ts` et non dans le proxy.
- Activer HTTP/2 (h2) vers les navigateurs. L'origine Node sert du HTTP/1.1; le proxy négocie h2 avec le client et multiplexe les requêtes. Sans h2, le graphe JavaScript d'une page coûte plus de connexions que le budget ne le permet.
- Préserver `Vary: Accept-Encoding`. Le serveur compresse lui-même le HTML et le JSON en br ou gzip et pose cet en-tête. Si le proxy compresse à son tour, il ne doit ni retirer `Vary`, ni réencoder une réponse qui porte déjà `Content-Encoding`.
- Ne pas remplacer les politiques de cache : les médias générés nommés par contenu sortent en `public, max-age=31536000, immutable`, le manifeste et la page hors ligne en `public, max-age=300`, le service worker en `no-cache`. Le propriétaire est `scripts/lib/static-cache.js` et le manifeste `static/generated-assets.json`.
- Le préchargement des données utilise `tap`, jamais `hover` : une page privée en `no-store` ne doit pas être demandée au simple survol.
- Vérifier après chaque changement de proxy :
  `curl -sI https://votre-domaine/ | grep -i '^strict-transport-security'`
  `curl -sS --compressed -D - -o /dev/null https://votre-domaine/connexion | grep -i '^content-encoding'`
  puis charger une page connectée et confirmer l'absence d'erreur CSP dans la console.

## Budgets de livraison

Le smoke de conteneur et les tests de contrat lisent `config/performance.ts`; aucun script ne recopie un seuil ni la liste des pages. `MEASURED_PAGES` est le seul propriétaire des routes mesurées : l'accueil, le profil et la discussion partagent le budget de 20 requêtes JavaScript initiales. Les valeurs protégées sont la page de connexion (60 Ko, 20 Ko de CSS critique), le profil (120 Ko), la discussion avec 20 messages (150 Ko), les textures (5 Ko chacune), la photo de connexion mobile (35 Ko) et la planche d'identités (220 Ko). Une page de 376 Ko fait échouer `scripts/ci/container-smoke.sh`.

Les actifs générés nommés par contenu (icônes, photo de connexion, textures, planche d'identités, image sociale) sont servis immuables. Une régénération conserve les anciens noms pendant sept jours avant de les supprimer, pour qu'un document encore en cache ne demande jamais un fichier absent.

Les panneaux sous la ligne de flottaison sont des îlots : ils sont importés au niveau du module de la page et rendus par le serveur, puis chargés par le navigateur après la peinture initiale. Ce rendu asynchrone est activé par `compilerOptions.experimental.async` dans `vite.config.ts`; le retirer viderait les îlots du HTML serveur.

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

- `GET /api/health` retourne `status`, `database`, `migrations` (`applied`/`missing`), le dernier battement du planificateur (`scheduler.lastTickAt`) et un instantané de la file (`notifications.pending`, `.failed`, `.oldestDueAt`, `.suppressed`, `.push`). Aucun destinataire, sujet ou corps de message n'y figure. Les compteurs de suppression et de livraison push repartent à zéro au redémarrage du processus.
- Le tableau de bord `/admin` affiche le même instantané et la liste des envois en échec; un opérateur avec `manageSettings` peut relancer un envoi. Chaque relance est tracée dans `audit_log` sous `notification.retry`.
- Les journaux sont des lignes JSON uniques avec `event`, `requestId`, et redaction des secrets. `docker compose logs -f ligue`.
- Le planificateur tourne toutes les `NOTIFICATION_TICK_MS` millisecondes. Un `lastTickAt` qui vieillit indique un processus bloqué.
- Les actions administratives et les notifications sont tracées dans `audit_log` et consultables en base.

## Intégration continue et publication

Le dépôt est publié sur GitHub à `https://github.com/SBK-Techno/ligue-hockey`. Les workflows sont la seule voie de publication:

- `ci.yml` s'exécute sur chaque demande de fusion, sur chaque poussée vers `main` et manuellement. `verify` installe Node depuis `.nvmrc` et exécute `npm run gate`; `container` construit l'image et vérifie `/api/health`; `required` agrège les deux et constitue le statut requis par la protection de `main`.
- `docs.yml` valide le site quand la documentation, la marque ou le générateur changent.
- `pages.yml` publie le site sur `https://sbk-techno.github.io/ligue-hockey/`.
- `auto-release.yml` s'exécute à chaque poussée vers `main`. Il calcule la prochaine version depuis les commits, prépare ou met à jour la branche `release/next`, ouvre la demande de fusion et lance la porte dessus. Après la fusion de cette demande, il crée l'étiquette `v<version>` et appelle `release.yml`.
- `release.yml` publie une version, sur une étiquette `v*` ou par appel de `auto-release.yml`: il vérifie que l'étiquette correspond à `package.json`, construit l'image, la pousse sur `ghcr.io/sbk-techno/ligue-hockey` avec les étiquettes de version, de révision et `latest`, puis crée la version GitHub.
- `security.yml` audite les dépendances d'exécution chaque semaine; `codeql.yml` analyse le code; `dependency-review.yml` bloque les changements à risque élevé; Dependabot propose les mises à jour.

`npm run verify:architecture` analyse les workflows et le dépôt, et refuse: un déclencheur manquant, une tâche `verify`, `container` ou `required` absente, une étape `npm run gate` absente ou enveloppée, un `npm ci` absent, un `setup-node` sans `.nvmrc` ou sans cache, une action non épinglée à un SHA complet, une publication Pages sans permission OIDC, une publication qui n'écoute pas les étiquettes `v*` ou qui ne pousse pas sur GHCR, un plan de version sans porte, sans demande de fusion ou sans appel à `release.yml`, un script `gate` ou `verify` affaibli, un major Node différent entre `package.json`, `.nvmrc` et le Dockerfile, ou une métadonnée OCI absente.

La protection de `main` refuse les poussées directes et exige le statut `required`. Le statut porte sur la tête de la demande de fusion, pas sur un commit de fusion.

## Publication d'une version

La version de `package.json` est l'unique source. `auto-release.yml` prépare la publication à chaque poussée vers `main`:

1. `scripts/release/plan.ts` lit l'étiquette la plus récente et les commits depuis celle-ci. `config/release.ts` décide de la montée: une rupture passe en majeure, `feat` en mineure, le reste en correctrice; `chore`, `docs`, `test`, `ci`, `build` et `style` ne déclenchent rien.
2. Si une version est à préparer, le workflow met à jour `release/next` avec `scripts/release/apply.ts`, qui synchronise `package.json`, `package-lock.json` et `.env.example`. Il ouvre ou actualise la demande de fusion et lance `ci.yml` sur la branche.
3. La fusion de cette demande approuve la version. La poussée suivante crée l'étiquette `v<version>` et appelle `release.yml`, qui publie l'image et la version GitHub.

La fusion de la demande de version est la seule approbation humaine. Ne créez pas d'étiquette à la main.

`npm run verify:release` refuse trois surfaces de version désaccordées. En cas de reprise manuelle:

```bash
npm run release:plan
npm run release:apply -- --version x.y.z
git switch -c chore/release-x.y.z
git commit -am "chore(release): x.y.z"
git push -u origin chore/release-x.y.z
# Ouvrir et fusionner la demande de fusion; auto-release.yml crée l'étiquette.
```

Vérifiez ensuite la version GitHub et l'image:

```bash
version="$(node -p "require('./package.json').version")"
gh release view "v$version"
docker pull "ghcr.io/sbk-techno/ligue-hockey:$version"
```

## Mise à jour et retour arrière

L'image de production vient de GHCR. `LIGUE_IMAGE` est obligatoire et porte la version publiée. `package.json` est la source de la version; le suffixe de `.env.example` est une surface générée par `npm run release:apply` et contrôlée par `npm run verify:release`.

```bash
version="$(node -p "require('./package.json').version")"
export LIGUE_IMAGE="ghcr.io/sbk-techno/ligue-hockey:$version"
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
