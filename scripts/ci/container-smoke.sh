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
readonly COOKIES="$(mktemp)"
readonly TMP="$(mktemp -d)"
readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
	docker stop --time 20 "$NAME" >/dev/null 2>&1 || true
	docker rm "$NAME" >/dev/null 2>&1 || true
	docker volume rm "$VOLUME" >/dev/null 2>&1 || true
	rm -f "$COOKIES"
	rm -rf "$TMP"
}
trap cleanup EXIT

budget() {
	(cd "$ROOT" && npx tsx scripts/ci/budget.ts "$@")
}

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

fetch_session() {
	local path="$1" name="$2"
	curl -sS --compressed --max-time 15 \
		-H "Cookie: $session_cookie" \
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
budget size "$TMP/connexion.body" authHtmlBytes

signin_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
	-c "$COOKIES" \
	-H 'Content-Type: application/json' \
	--data "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
	"$BASE/api/auth/sign-in/email")"
if [ "$signin_status" != 200 ]; then
	docker logs "$NAME" >&2 || true
	printf 'erreur: connexion admin refusée (%s)\n' "$signin_status" >&2
	exit 1
fi

# Le cookie de production porte l'attribut Secure (ORIGIN est en https).
# curl refuse de le renvoyer sur http, donc on l'envoie comme en-tête explicite.
session_cookie="$(awk 'NF >= 7 { printf "%s%s=%s", sep, $6, $7; sep="; " }' "$COOKIES")"
if [ -z "$session_cookie" ]; then
	printf 'erreur: aucun cookie de session après la connexion\n' >&2
	exit 1
fi

# P3 : 21 messages garantissent une page de 20 et un curseur « plus anciens ».
for index in $(seq 1 21); do
	status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
		-H "Cookie: $session_cookie" \
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
while IFS=$'\t' read -r page_name page_path page_mode; do
	[ -n "$page_name" ] || continue
	if [ "$page_mode" = 'anon' ]; then
		fetch "$page_path" "$page_name"
	else
		fetch_session "$page_path" "$page_name"
	fi
	ASSET_BASE="$BASE" budget page "$TMP/$page_name.body" "$page_name"
done <<< "$pages"

expect_header "$TMP/discussion.headers" 'content-encoding' '\(gzip\|br\)' 'discussion compressée'
budget size "$TMP/profil.body" profileHtmlBytes
budget size "$TMP/discussion.body" discussionHtmlBytes
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
expect_header "$TMP/texture.headers" 'cache-control' 'public, max-age=31536000, immutable' 'texture immuable'
social="$(curl -sS "$BASE/generated-assets.json" \
	| jq -r '.files | keys[] | select(startswith("static/social/"))' \
	| head -n 1 | sed 's/^static//')"
if [ -z "$social" ]; then
	printf 'erreur: aucune image sociale dans generated-assets.json\n' >&2
	exit 1
fi
curl -sS -D "$TMP/social.headers" -o /dev/null "$BASE$social"
expect_header "$TMP/social.headers" 'cache-control' 'public, max-age=31536000, immutable' 'image sociale immuable'
curl -sS -D "$TMP/manifest.headers" -o /dev/null "$BASE/manifest.webmanifest"
expect_header "$TMP/manifest.headers" 'cache-control' 'public, max-age=300' 'manifeste court'
curl -sS -D "$TMP/sw.headers" -o /dev/null "$BASE/service-worker.js"
expect_header "$TMP/sw.headers" 'cache-control' 'no-cache' 'service worker sans cache'
immutable_asset="$(grep -o '/_app/immutable/[^"]*\.js' "$TMP/discussion.body" | head -n 1)"
curl -sS -D "$TMP/immutable.headers" -o /dev/null "$BASE$immutable_asset"
expect_header "$TMP/immutable.headers" 'cache-control' 'public,max-age=31536000,immutable' 'actif immuable du framework'

printf 'profil admin: 200\n'
printf 'discussion: %s octets, %s requêtes JavaScript\n' \
	"$(wc -c < "$TMP/discussion.body" | tr -d ' ')" \
	"$(grep -o '/_app/immutable/[^"]*\.js' "$TMP/discussion.body" | sort -u | wc -l | tr -d ' ')"
