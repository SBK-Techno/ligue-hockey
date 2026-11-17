# Opérations

Cette application est un conteneur unique : SvelteKit (Node 24), SQLite en mode WAL sur un volume, notifications par courriel et Web Push. Une seule ligue par déploiement.

## Prérequis

- Docker avec le plugin Compose.
- Un nom de domaine et un proxy HTTPS devant le conteneur (Caddy, Traefik ou nginx).
- Un serveur SMTP pour les courriels transactionnels.
- Une paire de clés VAPID pour les notifications push.
- Un accès HTTPS sortant vers `photon.komoot.io` pour la recherche d'adresses des lieux.

## Variables d'environnement

Le schéma `config/env-schema.ts` est l'unique propriétaire des noms, des bornes et des valeurs par défaut; `.env.example` est le modèle complet à copier. La liste ci-dessous n'est qu'un index par usage, sans valeur; ne recopiez pas les contraintes ou les valeurs par défaut dans un autre document ou script.

Les variables se regroupent ainsi :

- `ORIGIN` et `APP_ENV` : origine publique exacte et mode d'exécution. En production, `ORIGIN` utilise `https://` et `APP_ENV=production`; le compose du dépôt fixe déjà `APP_ENV`.
- `BETTER_AUTH_SECRET` : secret de session. Le changer invalide les sessions.
- `ADMIN_EMAIL` et `ADMIN_PASSWORD` : premier administrateur, créé au démarrage s'il n'existe aucun compte.
- `DATABASE_URL`, `MIGRATIONS_DIR` et `DATABASE_BUSY_TIMEOUT_MS` : base SQLite et migrations. En conteneur, la base est `/app/data/ligue.db`.
- `SMTP_*` : courriel transactionnel. Sans SMTP en production, les envois échouent et sont réessayés.
- `VAPID_*` : push. Sans clés, les abonnements push ne peuvent pas être créés.
- `SESSION_DAYS`, `INVITE_DAYS`, `LOGIN_WINDOW_MINUTES`, `MAX_LOGIN_ATTEMPTS`, `RESET_REQUESTS_PER_HOUR`, `PASSWORD_CHANGES_PER_HOUR` et `PASSWORD_MIN_LENGTH` : sessions et limites de connexion.
- `NOTIFICATION_TICK_MS`, `NOTIFICATION_MAX_ATTEMPTS`, `NOTIFICATION_BATCH_SIZE` et `NOTIFICATION_CLAIM_TIMEOUT_MS` : file de notifications.
- `LOG_LEVEL` : niveau de journalisation.

Les contraintes et les valeurs par défaut sont dans le schéma, pas ici.

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
- Réécrire `X-Forwarded-For` avec l'adresse réelle du client, une seule entrée : le compose lit cet en-tête (`ADDRESS_HEADER: X-Forwarded-For`, `XFF_DEPTH: "1"`) pour que les limiteurs de connexion et de réinitialisation comptent par client, pas par proxy. Un en-tête fourni par le navigateur qui n'est pas réécrit permet à un anonyme de changer de seau à volonté; un en-tête absent fait échouer la lecture de l'adresse.
- Ajouter sur toute réponse HTTPS : `Strict-Transport-Security: max-age=31536000; includeSubDomains`. N'ajouter `preload` qu'après inscription du domaine; ne jamais envoyer HSTS sur une réponse HTTP en clair.
- Ne pas retirer ni remplacer les en-têtes produits par l'application : `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. La CSP est configurée dans `vite.config.ts` et non dans le proxy.
- Activer HTTP/2 (h2) vers les navigateurs. L'origine Node sert du HTTP/1.1; le proxy négocie h2 avec le client et multiplexe les requêtes. Sans h2, le graphe JavaScript d'une page coûte plus de connexions que le budget ne le permet.
- Préserver `Vary: Accept-Encoding`. Le serveur compresse lui-même le HTML et le JSON en br ou gzip et pose cet en-tête. Si le proxy compresse à son tour, il ne doit ni retirer `Vary`, ni réencoder une réponse qui porte déjà `Content-Encoding`. Le manifeste `/manifest.webmanifest` reste en identité : l'adaptateur ne précompresse pas cette extension et le fichier fait moins d'un kilo-octet; il n'est pas déclaré compressible par `src/lib/server/compression.ts`.
- Ne pas remplacer les politiques de cache : `scripts/lib/static-cache.js` est le propriétaire des en-têtes et `static/generated-assets.json` celui des noms. Les actifs nommés par contenu sont immuables, le manifeste et la page hors ligne ont un cache court, le service worker n'est jamais mis en cache.
- Le préchargement des données utilise `tap`, jamais `hover` : une page privée en `no-store` ne doit pas être demandée au simple survol.

Vérifier après chaque changement de proxy :
`curl -sI https://votre-domaine/ | grep -i '^strict-transport-security'`
`curl -sS --compressed -D - -o /dev/null https://votre-domaine/connexion | grep -i '^content-encoding'`
puis charger une page connectée et confirmer l'absence d'erreur CSP dans la console.

## Budgets de livraison

Le smoke de conteneur et les tests de contrat lisent `config/performance.ts`; aucun script ne recopie un seuil ni la liste des pages. `MEASURED_PAGES` est le seul propriétaire de toutes les routes, statiques et paramétrées, et de leur plafond de fragmentation; `jsRequestsPerPage` est le plafond par défaut d'une page qui ne déclare pas le sien et `jsBytesPerPage` mesure le vrai coût du graphe initial. Le smoke ne demande que les routes statiques; les cinq routes à paramètre se mesurent en préversion avec les données de démonstration. Une nouvelle route échoue au contrat tant que son budget n'est pas déclaré. Les tailles, les plafonds et les valeurs protégées vivent dans ce fichier; ne les recopiez pas ici. `scripts/ci/container-smoke.sh` refuse une page qui dépasse son budget de requêtes ou d'octets, une réponse non compressée ou une politique de cache divergente.

Les actifs générés nommés par contenu (icônes, photo de connexion, textures, planche d'identités, image sociale) sont servis immuables par `serve.js`, le seul point d'entrée supporté. Le compte de requêtes du smoke lit les liens du HTML serveur : il ne voit ni les îlots asynchrones ni les imports imbriqués chargés après la peinture, et aucun artefact du build ne porte le graphe complet d'une route. L'audit navigateur a mesuré 31 à 38 requêtes sur l'accueil et le détail de match; les plafonds déclarés restent donc des planchers conservateurs tant qu'une nouvelle mesure navigateur ne les remplace pas. `node build` et `vite preview` servent les mêmes fichiers sans la politique de cache : ne les utilisez pas pour une préversion. Une régénération conserve les anciens noms dont le fichier est déjà présent sur le disque et date de moins de `GENERATED_ASSET_RETENTION_DAYS` (`scripts/lib/asset-retention.ts`), puis supprime les plus anciens. Cette rétention ne reconstitue rien : sur un checkout neuf ou dans une image fraîche, seuls les noms de la génération courante existent, et un actif absent du disque ne peut pas être conservé. Après la fenêtre, une requête vers un ancien nom renvoie 404 : un document ou un robot qui l'a mis en cache plus longtemps peut afficher un actif absent. Pour une fenêtre plus longue, conservez ou archivez le répertoire `static/` entre les déploiements avant de régénérer; le générateur supprimera tout de même les fichiers au-delà de cette fenêtre. Le nom courant est celui de `src/lib/generated/branding.ts`; ne figez jamais un ancien nom dans une configuration ou une documentation.

Les panneaux sous la ligne de flottaison sont des îlots : ils sont importés au niveau du module de la page et rendus par le serveur, puis chargés par le navigateur après la peinture initiale. Ce rendu asynchrone est activé par `compilerOptions.experimental.async` dans `vite.config.ts`; le retirer viderait les îlots du HTML serveur.

## Première mise en service

Cette séquence vaut pour une installation autonome avec le compose du dépôt. L'hôte de référence est décrit à la section suivante.

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

## Cible de production vérifiée

La cible ci-dessous a été vérifiée le 17 novembre 2026 sur l'hôte de référence :

- Hôte : `home.backend.localserver.ca`, accès `ssh home`.
- Répertoire Compose : `/home/jadorais`; fichier `/home/jadorais/compose.ligue-hockey.yml`; service et conteneur `ligue-hockey`.
- Données : `/mnt/Docker/DockerApps/LigueHockey` monté sur `/app/data` (SQLite WAL).
- URL publique : `https://hockey.sbktechno.com`.
- CDN : Cloudflare répond devant l'hôte (`server: cloudflare`); les actifs à nom haché restent servis depuis le cache de bord après une mise à jour, ce qui couvre les documents encore ouverts.
- Image déployée : `ghcr.io/sbk-techno/ligue-hockey:1.12.0`, publiée sur GHCR. Digest de l'hôte : `sha256:dbf942fec29bc7c9c076b48b1083345500f54165f335a61d0fce836022bb7d31`; identifiant local : `sha256:0c37c70b91389b55393730d689742324373da50a3b1bf987deba4786f2336e5b`. Le conteneur est sain depuis le 17 novembre 2026 à 21:05:15 UTC, sans redémarrage, avec les 15 migrations appliquées. Le compose du dépôt épingle l'image par `LIGUE_IMAGE`; le fichier de l'hôte porte la même étiquette de version. Ne déployez jamais `latest`.
- Retour vérifié : `1.11.0`, digest hôte `sha256:09008039a6ad82c5e440efdb1f747cc3a7f8a229ab8409d17402ef4c462298e7`, identifiant local `sha256:3fe39b9da3ab6b6c5c31ebff284dc11acf41c093bc7506d84617d1b6c30d1dcc`. Le fichier compose d'avant la mise à jour est conservé à `/home/jadorais/compose.ligue-hockey.yml.1.11.0.bak`; la base d'avant la mise à jour est `/home/jadorais/backups/ligue-20261117T155832.db`, vérifiée avec `integrity_check: ok`, 29 joueurs actifs, 30 comptes et 50 messages.
- Environnement : le déploiement fournit un fichier `--env-file` hors dépôt, qui contient les secrets et n'est jamais versionné. Le coffre de l'hôte est `/home/jadorais/.env.ligue-hockey`, lisible par le seul propriétaire (`0600`), et toutes les commandes ci-dessous le passent à `--env-file`.

Le projet Compose de l'hôte porte le nom `jadorais` et contient d'autres services. `docker compose up -d` peut afficher un avertissement d'orphelins; ne lancez jamais `--remove-orphans`, qui supprimerait ces autres conteneurs.

Mise à jour. Sauvegardez la base avec la séquence de la section **Sauvegarde et restauration** avant de tirer la nouvelle image.

```bash
cd /home/jadorais
# Épingler l'étiquette publiée dans compose.ligue-hockey.yml.
# Le compose du dépôt, lui, reçoit cette étiquette par LIGUE_IMAGE.
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey pull
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey up -d
# Le proxy peut répondre 502 pendant le démarrage du conteneur.
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS https://hockey.sbktechno.com/api/health \
    | jq -e '.status == "ok" and .database == "ok" and .migrations == "applied"'; then
    break
  fi
  test "$attempt" -lt 10 || exit 1
  sleep 3
done
docker inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' ligue-hockey
```

Le contrôle de santé est le même prédicat que celui de `scripts/ci/container-smoke.sh` : requête `curl -fsS`, puis `jq` sur `status`, `database` et `migrations`. La boucle couvre les quelques secondes où le proxy répond encore 502 pendant le démarrage. La dernière commande doit afficher l'étiquette attendue, par exemple `1.12.0`.

Les migrations Drizzle sont appliquées au démarrage du conteneur. Elles ne sont pas réversibles : sauvegardez la base avant chaque mise à jour, et restaurez la sauvegarde correspondante lors d'un retour arrière.

Retour arrière :

```bash
cd /home/jadorais
# Épingler l'étiquette ou le digest de la version précédente.
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey pull
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey up -d
# Restaurer la base sauvegardée avant la mise à jour, puis vérifier /api/health.
```

Ne rétrogradez jamais le schéma sans restaurer la base. Si le fichier d'environnement n'est plus présent, reconstruisez-le depuis le coffre de l'hôte avant toute commande Compose; un fichier absent laisse les variables vides.

## Aperçu de démonstration

Une base d'aperçu est construite sur une base vide avec la commande du propriétaire du jeu de démonstration :

```bash
npm run seed:demo -- --yes --password <secret>
```

Sur une base vide, le script crée uniquement des lignes `demo_` et des comptes `@demo.liguehockey.local`. Sur une base déjà peuplée, il remplace son propre jeu de démonstration, conserve les autres comptes et met à jour les matchs existants avec une présence et un alignement. Il ne faut donc jamais le lancer sur une copie de la production. Ne copiez jamais une base de production pour un aperçu : aucune identité, adresse, note ou credential réel ne doit y figurer. La commande lit `ORIGIN`, `BETTER_AUTH_SECRET` et `DATABASE_URL` dans l'environnement; pointez `DATABASE_URL` vers une base vide et fournissez un secret de test.

Le mot de passe est fourni en argument et n'est pas journalisé. Aucun secret, jeton, mot de passe ou adresse réelle ne doit être écrit dans le dépôt, un document, une image ou un rapport.

## Santé et supervision

- `GET /api/health` retourne `status`, `database`, `migrations` (`applied`/`missing`), le dernier battement du planificateur (`scheduler.lastTickAt`) et un instantané de la file (`notifications.pending`, `.failed`, `.oldestDueAt`, `.suppressed`, `.push`). Aucun destinataire, sujet ou corps de message n'y figure.
- Les compteurs `suppressed` cumulent depuis le démarrage du processus. Les compteurs `push` ne couvrent que le dernier tick planifié. Les deux sont en mémoire et repartent à zéro au redémarrage du conteneur : une valeur nulle après un redémarrage ne prouve pas une absence d'activité, recoupez avec les journaux et `notification_jobs`.
- Le tableau de bord `/admin` affiche le même instantané et la liste des envois en échec; un opérateur avec `manageSettings` peut relancer un envoi. Chaque relance est tracée dans `audit_log` sous `notification.retry`.
- Les journaux sont des lignes JSON uniques avec `event`, `requestId`, et redaction des secrets. `docker logs -f ligue-hockey`.
- Le planificateur tourne toutes les `NOTIFICATION_TICK_MS` millisecondes. Un `lastTickAt` qui vieillit indique un processus bloqué.
- Les actions administratives et les notifications sont tracées dans `audit_log` et consultables en base.

## Intégration continue et publication

Le dépôt est publié sur GitHub à `https://github.com/SBK-Techno/ligue-hockey`. Les fichiers de `.github/workflows/` sont l'unique propriétaire des déclencheurs, des tâches, des actions et des commandes de publication; ce document ne les recopie pas. Ouvrez le workflow concerné :

- [`ci.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/ci.yml) : porte de vérification et smoke du conteneur.
- [`docs.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/docs.yml) : validation de la documentation.
- [`pages.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/pages.yml) : publication du site.
- [`auto-release.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/auto-release.yml) : préparation de la version et de la demande `release/next`.
- [`release.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/release.yml) : publication de l'image et de la version.
- [`security.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/security.yml), [`codeql.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/codeql.yml) et [`dependency-review.yml`](https://github.com/SBK-Techno/ligue-hockey/blob/main/.github/workflows/dependency-review.yml) : analyses de sécurité.

`npm run verify:architecture` lit ces workflows et `config/release.ts`; il refuse toute divergence avec le contrat de publication. Ses règles appartiennent au script, pas à ce document.

La protection de `main` refuse les poussées directes et exige le statut agrégé de la porte sur la tête de la demande de fusion, pas sur un commit de fusion.

## Publication d'une version

La version de `package.json` est l'unique source. `auto-release.yml` prépare la publication à chaque poussée vers `main`; ses étapes appartiennent au workflow. Les règles de montée appartiennent à `config/release.ts`, et `scripts/release/plan.ts` les applique. Ne recopiez ni les types de commit ni les seuils dans un autre document.

Le seul geste d'approbation est de fusionner la demande `release/next` après une porte verte. Cette fusion approuve la version; la poussée suivante crée l'étiquette `v<version>` et appelle `release.yml`.

La politique de l'organisation interdit à GitHub Actions de créer des demandes de fusion. Quand `auto-release.yml` a poussé `release/next` mais s'arrête sur `createPullRequest`, ouvrez la demande avec un compte opérateur en reprenant le titre et le corps prévus, puis relancez le travail échoué de ce run. L'étiquette, la version GitHub et l'image restent produites par le workflow; ne créez jamais l'étiquette à la main.

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

## Sauvegarde et restauration

Sauvegarde à chaud, sans arrêter l'application. Les commandes utilisent le fichier Compose et le service de l'hôte de référence. Pour une installation autonome avec le compose du dépôt, remplacez `compose.ligue-hockey.yml` par `docker-compose.yml`, le service `ligue-hockey` par `ligue`, le chemin des données par le volume déclaré et omettez `--env-file`.

```bash
cd /home/jadorais
mkdir -p backups
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey exec -T --user app ligue-hockey node scripts/backup.mjs /app/data/backup.db
docker cp ligue-hockey:/app/data/backup.db "backups/ligue-$(date +%Y%m%dT%H%M%S).db"
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey exec -T --user app ligue-hockey rm /app/data/backup.db
```

Restauration :

```bash
cd /home/jadorais
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey stop ligue-hockey
docker cp backups/ligue-AAAAmmjjTHHMMSS.db ligue-hockey:/app/data/ligue.db
image="$(docker inspect --format '{{.Config.Image}}' ligue-hockey)"
docker run --rm --entrypoint sh -v /mnt/Docker/DockerApps/LigueHockey:/app/data "$image" -c \
  'rm -f /app/data/ligue.db-wal /app/data/ligue.db-shm && chown -R app:app /app/data'
docker compose -f compose.ligue-hockey.yml --env-file /home/jadorais/.env.ligue-hockey start ligue-hockey
curl -fsS https://hockey.sbktechno.com/api/health
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
| `health` en 503 | Lire les journaux; vérifier les permissions du volume de données (`/app/data`). |
| Connexion impossible | Vérifier `ORIGIN`, `BETTER_AUTH_SECRET`, l'horloge système et `MAX_LOGIN_ATTEMPTS`. |
| Courriels absents | Vérifier `SMTP_*`, `notifications.emailEnabled`, et `notification_jobs.last_error`. |
| Push absent | Vérifier les clés VAPID, l'installation de la PWA et l'autorisation du navigateur. |
| Recherche d'adresses indisponible | Vérifier l'accès HTTPS sortant vers `photon.komoot.io` et la limite de 60 recherches par minute et par gestionnaire; l'adresse reste saisissable à la main. |
| Lien d'activation expiré | Le joueur utilise **Mot de passe oublié?** ou un administrateur renvoie un lien depuis la fiche du joueur. |
| Mot de passe oublié sans courriel | Vérifier `SMTP_*`, `RESET_REQUESTS_PER_HOUR` et `notification_jobs.last_error`; les réponses restent génériques pour ne pas révéler les comptes. |
| Équipes refusées | Vérifier que tous les joueurs retenus ont leurs quatre notes; les règles de paires peuvent rendre l'alignement impossible. |

## Limites connues

- Une seule ligue par déploiement; pas de multi-tenant.
- Pas de sauvegarde/restauration depuis l'interface; ces opérations restent des commandes d'exploitation.
- Le courriel de contact de la ligue et les instructions de paiement détaillées ne sont pas encore des réglages; elles restent à ajouter si la ligue les veut dans l'application.
- Aucun SMS.
- Les notes et les soldes des autres joueurs ne quittent jamais les services sous forme de DTO pour un joueur.
