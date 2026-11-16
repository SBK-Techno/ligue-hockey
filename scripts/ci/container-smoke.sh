#!/usr/bin/env bash
# Démarre l'image dans un conteneur jetable et vérifie /api/health.
# Usage: scripts/ci/container-smoke.sh <image>
set -euo pipefail

readonly IMAGE="${1:?usage: container-smoke.sh <image>}"
readonly NAME="ligue-hockey-ci-$$"
readonly VOLUME="ligue-hockey-ci-data-$$"
readonly PORT="${SMOKE_PORT:-3917}"

cleanup() {
	docker stop --time 20 "$NAME" >/dev/null 2>&1 || true
	docker rm "$NAME" >/dev/null 2>&1 || true
	docker volume rm "$VOLUME" >/dev/null 2>&1 || true
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
	--env ADMIN_EMAIL=ci@example.com \
	--env "ADMIN_PASSWORD=$(openssl rand -base64 18)" \
	--env LOG_LEVEL=error \
	"$IMAGE" >/dev/null

for _ in $(seq 1 60); do
	if body="$(curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" 2>/dev/null)"; then
		printf '%s' "$body" | jq -e \
			'.status == "ok" and .database == "ok" and .migrations == "applied"' >/dev/null
		printf 'conteneur sain: %s\n' "$body"
		exit 0
	fi
	sleep 1
done

docker logs "$NAME" >&2 || true
printf 'erreur: /api/health ne répond pas correctement\n' >&2
exit 1
