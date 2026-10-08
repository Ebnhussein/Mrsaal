#!/usr/bin/env bash
set -euo pipefail
umask 077
# Install restic on the VPS; configure /etc/mrsaal-backup.env, mode 600.
source /etc/mrsaal-backup.env
: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD_FILE:?}" "${POSTGRES_CONTAINER:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${APP_SOURCE:?}"
exec 9>/var/lock/mrsaal-backup.lock
flock -n 9 || exit 0
backup_workdir="$(mktemp -d)"
trap 'rm -rf "$backup_workdir"' EXIT
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc > "$backup_workdir/database.dump"
test -s "$backup_workdir/database.dump"
# Encryption keys are essential for Gmail, AI credentials, WhatsApp and push restore.
install -m 600 "$APP_ENV_FILE" "$backup_workdir/app.env"
restic backup --tag mrsaal "$backup_workdir" "$APP_SOURCE" --exclude '**/node_modules' --exclude '**/.git'
restic forget --tag mrsaal --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
restic check
