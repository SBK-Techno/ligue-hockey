#!/usr/bin/env bash
# Démarre l'image dans un conteneur jetable, vérifie /api/health, puis ouvre
# /profil avec une vraie session admin. Le 404 du profil admin ne peut donc
# plus revenir sans faire échouer la CI.
# Usage: scripts/ci/container-smoke.sh <image>
set -euo pipefail

readonly IMAGE="${1:?usage: container-smoke.sh <image>}"
readonly NAME="ligue-hockey-ci-$$"
readonly VOLUME="ligue-hockey-ci-data-$$"
readonly PORT="${SMOKE_PORT:-3917}"
readonly ADMIN_EMAIL="ci@example.com"
readonly ADMIN_PASSWORD="$(openssl rand -base64 18)"
readonly COOKIES="$(mktemp)"

cleanup() {
	docker stop --time 20 "$NAME" >/dev/null 2>&1 || true
	docker rm "$NAME" >/dev/null 2>&1 || true
	docker volume rm "$VOLUME" >/dev/null 2>&1 || true
	rm -f "$COOKIES"
}
trap cleanup EXIT

docker volume create "$VOLUME" >/dev/null
docker run -d \
	--name "$NAME" \
	--publish "127.0.0.1:$PORT:3000" \
	--volume "$VOLUME:/app/data" \
	--env ORIGIN=https://example.com \
	--env APP_ENV=production \
	--env "BETTER_AUTH_SECRET=$(openssl rand -base64 48)" \
	--env "ADMIN_EMAIL=$ADMIN_EMAIL" \
	--env "ADMIN_PASSWORD=$ADMIN_PASSWORD" \
	--env LOG_LEVEL=error \
	"$IMAGE" >/dev/null

healthy=false
for attempt in $(seq 1 60); do
	if body="$(curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" 2>/dev/null)"; then
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

signin_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
	-c "$COOKIES" \
	-H 'Content-Type: application/json' \
	--data "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
	"http://127.0.0.1:$PORT/api/auth/sign-in/email")"
if [ "$signin_status" != 200 ]; then
	docker logs "$NAME" >&2 || true
	printf 'erreur: connexion admin refusée (%s)\n' "$signin_status" >&2
	exit 1
fi

profile_body="$(curl -sS --max-time 10 -b "$COOKIES" -w '\n%{http_code}' \
	"http://127.0.0.1:$PORT/profil")"
profile_status="${profile_body##*$'\n'}"
if [ "$profile_status" != 200 ]; then
	printf '%s\n' "$profile_body" >&2
	printf 'erreur: /profil admin répond %s\n' "$profile_status" >&2
	exit 1
fi
if ! printf '%s' "$profile_body" | grep -q 'Ton compte'; then
	printf 'erreur: /profil admin ne contient pas le dossier de membre\n' >&2
	exit 1
fi

printf 'profil admin: %s\n' "$profile_status"
