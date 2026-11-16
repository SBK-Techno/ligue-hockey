#!/usr/bin/env bash
# Gère le coureur Gitea autohébergé de ce dépôt.
# À exécuter sur l'hôte Docker qui héberge le coureur, jamais dans le conteneur applicatif.
set -euo pipefail

readonly CONTAINER_NAME="ligue-hockey-runner"
readonly RUNNER_IMAGE="gitea/act_runner:0.2.11"
readonly INSTANCE_URL="https://git.localserver.ca"
readonly RUNNER_NAME="ligue-hockey-linux"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly REPO_ROOT
readonly TEMPLATE="$REPO_ROOT/scripts/ci/act-runner.yaml"
readonly RUNNER_HOME="${RUNNER_HOME:-$HOME/ci/ligue-hockey-runner}"
readonly CONFIG="$RUNNER_HOME/config.yaml"
readonly DATA="$RUNNER_HOME/data"
readonly SECRETS="$RUNNER_HOME/secrets"
readonly TOKEN_FILE="$SECRETS/registration-token"

fail() {
	printf 'erreur: %s\n' "$*" >&2
	exit 1
}

require_docker() {
	command -v docker >/dev/null 2>&1 || fail "docker est requis"
	docker info >/dev/null 2>&1 || fail "le démon Docker est inaccessible"
}

container_exists() {
	docker inspect "$CONTAINER_NAME" >/dev/null 2>&1
}

install_runner() {
	require_docker
	mkdir -p "$DATA/work" "$SECRETS"
	chmod 700 "$RUNNER_HOME" "$SECRETS"
	[ -f "$TEMPLATE" ] || fail "modèle introuvable: $TEMPLATE"
	local workdir_parent="${RUNNER_HOME#/}/data/work"
	sed "s|@WORKDIR_PARENT@|$workdir_parent|" "$TEMPLATE" >"$CONFIG"
	if grep -q '@WORKDIR_PARENT@' "$CONFIG"; then
		fail "substitution incomplète dans $CONFIG"
	fi
	chmod 600 "$CONFIG"
	printf 'configuration installée: %s\n' "$CONFIG"
}

runner_label() {
	local label
	label="$(grep -E '^[[:space:]]+- "[a-z0-9._-]+:docker://' "$CONFIG" | head -n 1 | sed -E 's/^[[:space:]]+- "(.*)"$/\1/')"
	[ -n "$label" ] || fail "aucune étiquette de coureur dans $CONFIG"
	printf '%s' "$label"
}

start_runner() {
	require_docker
	[ -f "$CONFIG" ] || fail "configuration absente; exécutez d'abord: $0 install"

	if container_exists; then
		if [ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
			printf 'le coureur est déjà démarré\n'
			return 0
		fi
		docker start "$CONTAINER_NAME" >/dev/null
		printf 'coureur redémarré\n'
		return 0
	fi

	if [ ! -s "$DATA/.runner" ] && [ ! -s "$TOKEN_FILE" ]; then
		fail "jeton d'enregistrement absent: écrivez-le dans $TOKEN_FILE (0600)"
	fi

	local label
	label="$(runner_label)"

	docker run -d \
		--name "$CONTAINER_NAME" \
		--restart unless-stopped \
		--volume /var/run/docker.sock:/var/run/docker.sock \
		--volume "$DATA:/data" \
		--volume "$DATA/work:$RUNNER_HOME/data/work" \
		--volume "$CONFIG:/config.yaml:ro" \
		--volume "$SECRETS:/run/secrets:ro" \
		--env CONFIG_FILE=/config.yaml \
		--env GITEA_INSTANCE_URL="$INSTANCE_URL" \
		--env GITEA_RUNNER_NAME="$RUNNER_NAME" \
		--env GITEA_RUNNER_LABELS="$label" \
		--env GITEA_RUNNER_REGISTRATION_TOKEN_FILE=/run/secrets/registration-token \
		"$RUNNER_IMAGE" >/dev/null

	for _ in $(seq 1 30); do
		if [ -s "$DATA/.runner" ]; then
			rm -f "$TOKEN_FILE"
			printf 'coureur enregistré; jeton supprimé\n'
			return 0
		fi
		sleep 1
	done

	docker logs --tail 40 "$CONTAINER_NAME" >&2 || true
	fail "enregistrement non terminé"
}

stop_runner() {
	require_docker
	if ! container_exists; then
		printf 'aucun coureur installé\n'
		return 0
	fi
	docker stop --time 30 "$CONTAINER_NAME" >/dev/null
	printf 'coureur arrêté\n'
}

status_runner() {
	require_docker
	if ! container_exists; then
		printf 'absent\n'
		return 1
	fi
	local state
	state="$(docker inspect --format '{{.State.Status}}' "$CONTAINER_NAME")"
	printf 'état: %s\n' "$state"
	if [ -s "$DATA/.runner" ]; then
		printf 'enregistrement: présent\n'
	else
		printf 'enregistrement: absent\n'
	fi
	[ "$state" = "running" ]
}

logs_runner() {
	require_docker
	container_exists || fail "aucun coureur installé"
	docker logs --tail "${LINES:-100}" "$CONTAINER_NAME"
}

case "${1:-}" in
install) install_runner ;;
start) start_runner ;;
stop) stop_runner ;;
status) status_runner ;;
logs) logs_runner ;;
*)
	printf 'usage: %s {install|start|stop|status|logs}\n' "$0" >&2
	exit 2
	;;
esac
