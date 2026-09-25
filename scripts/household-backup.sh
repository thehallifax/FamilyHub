#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ] || [ ! -d "$1" ]; then
  echo "Usage: $0 EXISTING_BACKUP_DIRECTORY" >&2
  exit 2
fi

backup_dir="$(cd -- "$1" && pwd)"
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/familyhub-$timestamp.dump"

if [ -e "$backup_file" ]; then
  echo "Backup already exists: $backup_file" >&2
  exit 1
fi

umask 077
temporary_file="$(mktemp "$backup_dir/.familyhub-$timestamp.XXXXXX")"
trap 'rm -f -- "$temporary_file"' EXIT

cd "$repo_dir"
docker compose exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U familyhub -d familyhub -Fc --no-owner --no-acl' \
  > "$temporary_file"

# Check the archive is readable. The deployment guide also requires a restore
# rehearsal in a separate database before treating a backup as recoverable.
docker compose exec -T db pg_restore --list < "$temporary_file" > /dev/null

mv -- "$temporary_file" "$backup_file"
trap - EXIT
echo "$backup_file"
