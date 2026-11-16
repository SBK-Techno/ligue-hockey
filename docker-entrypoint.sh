#!/bin/sh
set -eu

database="${DATABASE_URL:-/app/data/ligue.db}"
directory="$(dirname "$database")"

if [ "$(id -u)" = "0" ]; then
	mkdir -p "$directory"
	chown -R app:app "$directory"
	exec setpriv --reuid=app --regid=app --init-groups "$@"
fi

exec "$@"
