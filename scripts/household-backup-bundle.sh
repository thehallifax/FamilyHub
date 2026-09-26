#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ] || [ ! -d "$1" ]; then
  echo "Usage: $0 EXISTING_BACKUP_DIRECTORY" >&2
  exit 2
fi

backup_dir="$(cd -- "$1" && pwd)"
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
bundle="$backup_dir/familyhub-complete-$timestamp.tar.gz"
if [ -e "$bundle" ]; then
  echo "Backup already exists: $bundle" >&2
  exit 1
fi

umask 077
work_dir="$(mktemp -d "$backup_dir/.familyhub-complete-$timestamp.XXXXXX")"
temporary_bundle="$(mktemp "$backup_dir/.familyhub-complete-$timestamp.XXXXXX")"
cleanup() {
  rm -f -- "$work_dir/database.dump" "$work_dir/media.tar" "$work_dir/README.txt" "$temporary_bundle"
  rmdir -- "$work_dir"
}
trap cleanup EXIT

cd "$repo_dir"
docker compose exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U familyhub -d familyhub -Fc --no-owner --no-acl' \
  > "$work_dir/database.dump"
docker compose exec -T db pg_restore --list < "$work_dir/database.dump" > /dev/null
docker compose exec -T backend tar -C /app/media -cf - . > "$work_dir/media.tar"
tar -tf "$work_dir/media.tar" > /dev/null

printf '%s\n' \
  'FamilyHub complete backup' \
  'database.dump: PostgreSQL custom-format archive (includes Flyway history)' \
  'media.tar: processed private household images from the backend media volume' \
  'Restore with the same application version and the separately secured .env.' \
  > "$work_dir/README.txt"
tar -czf "$temporary_bundle" -C "$work_dir" README.txt database.dump media.tar
tar -tzf "$temporary_bundle" > /dev/null
mv -- "$temporary_bundle" "$bundle"
echo "$bundle"
