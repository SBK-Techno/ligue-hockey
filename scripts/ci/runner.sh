#!/usr/bin/env bash
# Gère le coureur Gitea autohébergé de ce dépôt.
# À exécuter sur l'hôte Docker qui héberge le coureur, jamais dans le conteneur applicatif.
set -euo pipefail

readonly CONTAINER_NAME="ligue-hockey-runner"
readonly RUNNER_IMAGE="gitea/act_runner:0.2.11"
readonly INSTANCE_URL="https://git.localserver.ca"
readonly RUNNER_NAME="ligue-hockey-linux"
readonly TAIL_LINES="${TAIL_LINES:-100}"

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

container_running() {
	[ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]
}

install_runner() {
	require_docker
	mkdir -p "$DATA/work" "$SECRETS"
	chmod 700 "$RUNNER_HOME" "$SECRETS"
	[ -f "$TEMPLATE" ] || fail "modèle introuvable: $TEMPLATE"
	local workdir_parent="${RUNNER_HOME#/}/data/work"
	sed "s|__WORKDIR_PARENT__|$workdir_parent|" "$TEMPLATE" >"$CONFIG"
	if grep -q '__WORKDIR_PARENT__' "$CONFIG"; then
		fail "substitution incomplète dans $CONFIG"
	fi
	chmod 600 "$CONFIG"
	printf 'configuration installée: %s\n' "$CONFIG"
}

require_registration_material() {
	if [ -s "$DATA/.runner" ]; then
		if [ -f "$TOKEN_FILE" ]; then
			rm -f "$TOKEN_FILE"
			printf 'jeton enregistré inutile supprimé\n'
		fi
		return 0
	fi
	[ -s "$TOKEN_FILE" ] || fail "jeton d'enregistrement absent: écrivez-le dans $TOKEN_FILE (0600)"
}

wait_for_registration() {
	local container="$1"
	for _ in $(seq 1 120); do
		if [ -s "$DATA/.runner" ]; then
			return 0
		fi
		if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != "true" ]; then
			docker logs --tail "$TAIL_LINES" "$container" >&2 || true
			return 1
		fi
		sleep 1
	done
	docker logs --tail "$TAIL_LINES" "$container" >&2 || true
	return 1
}

start_runner() {
	require_docker
	[ -f "$CONFIG" ] || fail "configuration absente; exécutez d'abord: $0 install"
	require_registration_material

	if container_exists; then
		if container_running; then
			if [ -s "$DATA/.runner" ]; then
				printf 'le coureur est déjà démarré\n'
				return 0
			fi
			if wait_for_registration "$CONTAINER_NAME"; then
				rm -f "$TOKEN_FILE"
				printf 'coureur enregistré\n'
				return 0
			fi
			docker stop --time 60 "$CONTAINER_NAME" >/dev/null || true
			fail "enregistrement non terminé; conteneur arrêté"
		fi
		docker start "$CONTAINER_NAME" >/dev/null
	else
		docker run -d \
			--name "$CONTAINER_NAME" \
			--restart no \
			--volume /var/run/docker.sock:/var/run/docker.sock \
			--volume "$DATA:/data" \
			--volume "$DATA/work:$RUNNER_HOME/data/work" \
			--volume "$CONFIG:/config.yaml:ro" \
			--volume "$SECRETS:/run/secrets:ro" \
			--env CONFIG_FILE=/config.yaml \
			--env GITEA_INSTANCE_URL="$INSTANCE_URL" \
			--env GITEA_RUNNER_NAME="$RUNNER_NAME" \
			--env GITEA_RUNNER_REGISTRATION_TOKEN_FILE=/run/secrets/registration-token \
			"$RUNNER_IMAGE" >/dev/null
	fi

	if [ ! -s "$DATA/.runner" ]; then
		if ! wait_for_registration "$CONTAINER_NAME"; then
			docker stop --time 60 "$CONTAINER_NAME" >/dev/null || true
			docker rm "$CONTAINER_NAME" >/dev/null || true
			fail "enregistrement non terminé; conteneur retiré"
		fi
		rm -f "$TOKEN_FILE"
		printf 'coureur enregistré; jeton supprimé\n'
	fi

	docker update --restart unless-stopped "$CONTAINER_NAME" >/dev/null
	printf 'coureur démarré\n'
}

stop_runner() {
	require_docker
	if ! container_exists; then
		printf 'aucun coureur installé\n'
		return 0
	fi
	docker stop --time 60 "$CONTAINER_NAME" >/dev/null
	printf 'coureur arrêté\n'
}

recreate_runner() {
	stop_runner
	if container_exists; then
		docker rm "$CONTAINER_NAME" >/dev/null
	fi
	start_runner
}

reset_runner() {
	stop_runner
	if container_exists; then
		docker rm "$CONTAINER_NAME" >/dev/null
	fi
	rm -f "$DATA/.runner"
	printf 'enregistrement supprimé; écrivez un nouveau jeton puis exécutez start\n'
}

status_runner() {
	require_docker
	if ! container_exists; then
		printf 'absent\n'
		return 1
	fi
	docker inspect --format \
		'état: {{.State.Status}} redémarrage: {{.HostConfig.RestartPolicy.Name}} image: {{.Config.Image}}' \
		"$CONTAINER_NAME"
	if [ -s "$DATA/.runner" ]; then
		printf 'enregistrement: présent\n'
	else
		printf 'enregistrement: absent\n'
	fi
	container_running
}

logs_runner() {
	require_docker
	container_exists || fail "aucun coureur installé"
	docker logs --tail "$TAIL_LINES" "$CONTAINER_NAME"
}

case "${1:-}" in
install) install_runner ;;
start) start_runner ;;
stop) stop_runner ;;
recreate) recreate_runner ;;
reset) reset_runner ;;
status) status_runner ;;
logs) logs_runner ;;
*)
	printf 'usage: %s {install|start|stop|recreate|reset|status|logs}\n' "$0" >&2
	exit 2
	;;
esac
