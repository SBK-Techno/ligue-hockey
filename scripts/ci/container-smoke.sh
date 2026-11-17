#!/usr/bin/env bash
# Démarre l'image dans un conteneur jetable, vérifie la santé, la connexion et
# les budgets de livraison. Une page de 376 Ko ou une réponse non compressée
# fait échouer la CI avant la publication.
# Usage: scripts/ci/container-smoke.sh <image>
set -euo pipefail

readonly IMAGE="${1:?usage: container-smoke.sh <image>}"
readonly NAME="ligue-hockey-ci-$$"
readonly VOLUME="ligue-hockey-ci-data-$$"
readonly PORT="${SMOKE_PORT:-3917}"
readonly BASE="http://127.0.0.1:$PORT"
readonly ORIGIN="https://example.com"
readonly ADMIN_EMAIL="ci@example.com"
readonly ADMIN_PASSWORD="$(openssl rand -base64 18)"
readonly PLAYER_EMAIL="ci-player@example.com"
readonly PLAYER_PASSWORD="$(openssl rand -base64 18)"
readonly COOKIES="$(mktemp)"
readonly PLAYER_COOKIES="$(mktemp)"
readonly TMP="$(mktemp -d)"
readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
	docker stop --time 20 "$NAME" >/dev/null 2>&1 || true
	docker rm "$NAME" >/dev/null 2>&1 || true
	docker volume rm "$VOLUME" >/dev/null 2>&1 || true
	rm -f "$COOKIES" "$PLAYER_COOKIES"
	rm -rf "$TMP"
}
trap cleanup EXIT

budget() {
	(cd "$ROOT" && npx tsx scripts/ci/budget.ts "$@")
}

owner() {
	(cd "$ROOT" && npx tsx scripts/ci/owners.ts "$@")
}

readonly CHAT_PAGE_SIZE="$(owner chat-page-size)"
readonly CACHE_IMMUTABLE="$(owner cache-immutable)"
readonly CACHE_SHORT="$(owner cache-short)"
readonly CACHE_NONE="$(owner cache-none)"
readonly CACHE_FRAMEWORK_IMMUTABLE="$(owner cache-framework-immutable)"

expect_header() {
	local file="$1" name="$2" pattern="$3" label="$4"
	if ! grep -qi "^${name}: .*${pattern}" "$file"; then
		printf 'erreur: %s (%s: %s attendu)\n' "$label" "$name" "$pattern" >&2
		sed -n '1,40p' "$file" >&2
		exit 1
	fi
}

expect_body() {
	local file="$1" pattern="$2" label="$3"
	if ! grep -q "$pattern" "$file"; then
		printf 'erreur: %s (%s absent)\n' "$label" "$pattern" >&2
		exit 1
	fi
}

fetch() {
	local path="$1" name="$2"
	curl -sS --compressed --max-time 15 \
		-D "$TMP/$name.headers" -o "$TMP/$name.body" "$BASE$path"
}

fetch_as() {
	local cookie="$1" path="$2" name="$3"
	curl -sS --compressed --max-time 15 \
		-H "Cookie: $cookie" \
		-D "$TMP/$name.headers" -o "$TMP/$name.body" "$BASE$path"
}

docker volume create "$VOLUME" >/dev/null
docker run -d \
	--name "$NAME" \
	--publish "127.0.0.1:$PORT:3000" \
	--volume "$VOLUME:/app/data" \
	--env ORIGIN="$ORIGIN" \
	--env APP_ENV=production \
	--env "BETTER_AUTH_SECRET=$(openssl rand -base64 48)" \
	--env "ADMIN_EMAIL=$ADMIN_EMAIL" \
	--env "ADMIN_PASSWORD=$ADMIN_PASSWORD" \
	--env LOG_LEVEL=error \
	"$IMAGE" >/dev/null

healthy=false
for attempt in $(seq 1 60); do
	if body="$(curl -fsS --max-time 3 "$BASE/api/health" 2>/dev/null)"; then
		printf '%s' "$body" | jq -e \
			'.status == "ok" and .database == "ok" and .migrations == "applied"' >/dev/null
		printf 'conteneur sain: %s\n' "$body"
		healthy=true
		break
	fi
	sleep 1
done
if [ "$healthy" != true ]; then
	docker logs "$NAME" >&2 || true
	printf 'erreur: /api/health ne répond pas correctement après %s tentatives\n' "$attempt" >&2
	exit 1
fi

# P1 : le JSON de santé est compressé et porte Vary.
fetch /api/health health
expect_header "$TMP/health.headers" 'content-encoding' '\(gzip\|br\)' 'santé compressée'
expect_header "$TMP/health.headers" 'vary' 'accept-encoding' 'santé et Vary'

# C4 : la santé expose la file sans destinataire ni contenu.
jq -e '
	.notifications
	| (.pending | type == "number")
	and (.failed | type == "number")
	and (.oldestDueAt == null or (.oldestDueAt | type == "number"))
	and (.suppressed | type == "object")
	and (.push | type == "object")
' "$TMP/health.body" >/dev/null
if grep -q '@' "$TMP/health.body"; then
	printf 'erreur: /api/health expose une adresse\n' >&2
	exit 1
fi

# P1/P2/P11 : la coquille anonyme est compressée, sa tranche critique reste
# petite et le préchargement n'utilise plus le survol.
fetch /connexion connexion
expect_header "$TMP/connexion.headers" 'content-encoding' '\(gzip\|br\)' 'connexion compressée'
expect_header "$TMP/connexion.headers" 'vary' 'accept-encoding' 'connexion et Vary'
expect_body "$TMP/connexion.body" 'data-sveltekit-preload-data="tap"' 'préchargement au tap'
budget inline-css "$TMP/connexion.body" authInlineCssBytes

signin_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
	-c "$COOKIES" \
	-H "Origin: $ORIGIN" \
	-H 'Content-Type: application/x-www-form-urlencoded' \
	--data-urlencode "email=$ADMIN_EMAIL" \
	--data-urlencode "password=$ADMIN_PASSWORD" \
	"$BASE/connexion")"
if [ "$signin_status" != 200 ] && [ "$signin_status" != 303 ]; then
	docker logs "$NAME" >&2 || true
	printf 'erreur: connexion admin refusée (%s)\n' "$signin_status" >&2
	exit 1
fi

# Le cookie de production porte l'attribut Secure (ORIGIN est en https).
# curl refuse de le renvoyer sur http, donc on l'envoie comme en-tête explicite.
admin_cookie="$(awk 'NF >= 7 { printf "%s%s=%s", sep, $6, $7; sep="; " }' "$COOKIES")"
if [ -z "$admin_cookie" ]; then
	printf 'erreur: aucun cookie de session après la connexion\n' >&2
	exit 1
fi

# R2-40 : le budget du profil se mesure sur un vrai joueur. Le smoke invite un
# joueur par l'écran d'administration, lit le lien d'invitation dans la file de
# notifications du conteneur, choisit son mot de passe, puis ouvre sa session.
invite_status="$(curl -sS -o "$TMP/invite.body" -w '%{http_code}' --max-time 10 \
	-H "Cookie: $admin_cookie" \
	-H "Origin: $ORIGIN" \
	-H 'x-sveltekit-action: true' \
	-H 'Content-Type: application/x-www-form-urlencoded' \
	--data-urlencode 'firstName=Joueur' \
	--data-urlencode 'lastName=CI' \
	--data-urlencode "email=$PLAYER_EMAIL" \
	--data-urlencode 'position=forward' \
	--data-urlencode 'age=30' \
	--data-urlencode 'jerseyNumber=12' \
	"$BASE/admin/joueurs?/invite")"
if [ "$invite_status" != 200 ]; then
	printf 'erreur: invitation du joueur refusée (%s)\n' "$invite_status" >&2
	sed -n '1,20p' "$TMP/invite.body" >&2
	exit 1
fi

if ! invite_url="$(docker exec "$NAME" node --input-type=commonjs -e '
const Database = require("better-sqlite3");
const db = new Database("/app/data/ligue.db", { readonly: true });
const row = db
	.prepare("select payload_json from notification_jobs where event_key = ? order by created_at desc limit 1")
	.get("account_access");
if (!row) process.exit(2);
process.stdout.write(JSON.parse(row.payload_json).url);
')"; then
	printf "erreur: lien d'invitation absent de la file de notifications\n" >&2
	exit 1
fi
invite_token="$(printf '%s' "$invite_url" | sed -n 's#.*/reset-password/\([^?]*\).*#\1#p')"
if [ -z "$invite_token" ]; then
	invite_token="$(printf '%s' "$invite_url" | sed -n 's/.*[?&]token=\([^&]*\).*/\1/p')"
fi
if [ -z "$invite_token" ]; then
	printf "erreur: jeton absent du lien d'invitation\n" >&2
	exit 1
fi

reset_status="$(curl -sS -o "$TMP/reset.body" -w '%{http_code}' --max-time 10 \
	-H "Origin: $ORIGIN" \
	-H 'Content-Type: application/x-www-form-urlencoded' \
	--data-urlencode "token=$invite_token" \
	--data-urlencode "password=$PLAYER_PASSWORD" \
	--data-urlencode "confirm=$PLAYER_PASSWORD" \
	--data-urlencode 'mode=invite' \
	"$BASE/reinitialiser-mot-de-passe")"
if [ "$reset_status" != 200 ] && [ "$reset_status" != 303 ]; then
	printf 'erreur: choix du mot de passe refusé (%s)\n' "$reset_status" >&2
	sed -n '1,20p' "$TMP/reset.body" >&2
	exit 1
fi

player_signin="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
	-c "$PLAYER_COOKIES" \
	-H "Origin: $ORIGIN" \
	-H 'Content-Type: application/x-www-form-urlencoded' \
	--data-urlencode "email=$PLAYER_EMAIL" \
	--data-urlencode "password=$PLAYER_PASSWORD" \
	"$BASE/connexion")"
if [ "$player_signin" != 200 ] && [ "$player_signin" != 303 ]; then
	printf 'erreur: connexion du joueur refusée (%s)\n' "$player_signin" >&2
	exit 1
fi
player_cookie="$(awk 'NF >= 7 { printf "%s%s=%s", sep, $6, $7; sep="; " }' "$PLAYER_COOKIES")"
if [ -z "$player_cookie" ]; then
	printf 'erreur: aucun cookie de session pour le joueur\n' >&2
	exit 1
fi

# P3 : un message de plus que la page garantit le curseur « plus anciens ».
messages=$((CHAT_PAGE_SIZE + 1))
for index in $(seq 1 "$messages"); do
	status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
		-H "Cookie: $admin_cookie" \
		-H "Origin: $ORIGIN" \
		-H 'x-sveltekit-action: true' \
		-H 'Content-Type: application/x-www-form-urlencoded' \
		--data-urlencode "body=Message de vérification $index" \
		"$BASE/discussion?/send")"
	if [ "$status" != 200 ]; then
		printf 'erreur: envoi du message %s refusé (%s)\n' "$index" "$status" >&2
		exit 1
	fi
done

# P10 : chaque page déclarée par le propriétaire des budgets est mesurée,
# en requêtes selon sa route et en octets JavaScript selon le propriétaire.
# La liste des routes et leurs plafonds vivent dans config/performance.ts;
# le shell ne recopie ni route, ni seuil.
pages="$(budget pages)"
while IFS=$'\t' read -r page_name page_path page_audience; do
	[ -n "$page_name" ] || continue
	case "$page_audience" in
		anonymous) fetch "$page_path" "$page_name" ;;
		admin) fetch_as "$admin_cookie" "$page_path" "$page_name" ;;
		player) fetch_as "$player_cookie" "$page_path" "$page_name" ;;
		*) printf 'erreur: audience inconnue %s\n' "$page_audience" >&2; exit 1 ;;
	esac
	ASSET_BASE="$BASE" budget page "$TMP/$page_name.body" "$page_name"
done <<< "$pages"

expect_header "$TMP/discussion.headers" 'content-encoding' '\(gzip\|br\)' 'discussion compressée'
budget inline-css "$TMP/discussion.body" authInlineCssBytes
expect_body "$TMP/discussion.body" 'Afficher les messages plus anciens' 'curseur de discussion'

# Le dialogue de confirmation partagé est monté à la demande, donc zéro est
# normal sur le premier rendu. Ce qui reste interdit, c'est un dialogue par
# message: deux ou plus font échouer la porte.
dialogs="$({ grep -o '<dialog' "$TMP/discussion.body" || true; } | wc -l | tr -d ' ')"
if [ "$dialogs" -gt 1 ]; then
	printf 'erreur: %s boîtes de dialogue sur /discussion (un dialogue par message interdit)\n' "$dialogs" >&2
	exit 1
fi

# P5/P6/V3 : les médias nommés par contenu sont immuables; le manifeste et le
# service worker gardent une politique courte et explicite.
texture="$(curl -sS "$BASE/generated-assets.json" \
	| jq -r '.files | keys[] | select(startswith("static/textures/"))' \
	| head -n 1 | sed 's/^static//')"
if [ -z "$texture" ]; then
	printf 'erreur: aucune texture dans generated-assets.json\n' >&2
	exit 1
fi
curl -sS -D "$TMP/texture.headers" -o /dev/null "$BASE$texture"
expect_header "$TMP/texture.headers" 'cache-control' "$CACHE_IMMUTABLE" 'texture immuable'
social="$(curl -sS "$BASE/generated-assets.json" \
	| jq -r '.files | keys[] | select(startswith("static/social/"))' \
	| head -n 1 | sed 's/^static//')"
if [ -z "$social" ]; then
	printf 'erreur: aucune image sociale dans generated-assets.json\n' >&2
	exit 1
fi
curl -sS -D "$TMP/social.headers" -o /dev/null "$BASE$social"
expect_header "$TMP/social.headers" 'cache-control' "$CACHE_IMMUTABLE" 'image sociale immuable'
curl -sS -D "$TMP/manifest.headers" -o /dev/null "$BASE/manifest.webmanifest"
expect_header "$TMP/manifest.headers" 'cache-control' "$CACHE_SHORT" 'manifeste court'
curl -sS -D "$TMP/sw.headers" -o /dev/null "$BASE/service-worker.js"
expect_header "$TMP/sw.headers" 'cache-control' "$CACHE_NONE" 'service worker sans cache'
immutable_asset="$(grep -o '/_app/immutable/[^"]*\.js' "$TMP/discussion.body" | head -n 1)"
curl -sS -D "$TMP/immutable.headers" -o /dev/null "$BASE$immutable_asset"
expect_header "$TMP/immutable.headers" 'cache-control' "$CACHE_FRAMEWORK_IMMUTABLE" 'actif immuable du framework'

printf 'profil joueur: 200\n'
printf 'discussion: %s octets, %s requêtes JavaScript\n' \
	"$(wc -c < "$TMP/discussion.body" | tr -d ' ')" \
	"$(grep -o '/_app/immutable/[^"]*\.js' "$TMP/discussion.body" | sort -u | wc -l | tr -d ' ')"
