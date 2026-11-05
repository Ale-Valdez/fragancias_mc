#!/usr/bin/env bash
# Backup diario: base de datos + archivos (buckets). Ejecutar desde cron en el servidor.
#   0 3 * * * cd /opt/fmc && ./backup.sh >> backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env}"
set -a; source "$ENV_FILE"; set +a

COMPOSE="docker compose --env-file $ENV_FILE"
DEST="${BACKUP_DIR:-$PWD/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
NETWORK="${COMPOSE_PROJECT_NAME}_default"

mkdir -p "$DEST/db" "$DEST/storage"

echo "[$STAMP] Dump de PostgreSQL..."
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$DEST/db/$STAMP.dump"

echo "[$STAMP] Copia de buckets (media + private)..."
for bucket in "${S3_BUCKET_MEDIA:-media}" "${S3_BUCKET_PRIVATE:-private}"; do
  docker run --rm --user "$(id -u):$(id -g)" --network "$NETWORK" \
    -v "$DEST/storage:/backup" \
    -e RCLONE_CONFIG_SRC_TYPE=s3 \
    -e RCLONE_CONFIG_SRC_PROVIDER=Other \
    -e RCLONE_CONFIG_SRC_ENDPOINT="${S3_ENDPOINT:-http://storage:9000}" \
    -e RCLONE_CONFIG_SRC_ACCESS_KEY_ID="$S3_ACCESS_KEY" \
    -e RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    rclone/rclone:1.75 sync "src:$bucket" "/backup/$bucket"
done

echo "[$STAMP] Rotación (> $KEEP_DAYS días)..."
find "$DEST/db" -name '*.dump' -mtime +"$KEEP_DAYS" -delete

# Copia fuera del servidor (opcional): configurar antes con `rclone config` en el host.
if [ -n "${OFFSITE_REMOTE:-}" ]; then
  echo "[$STAMP] Copia externa a $OFFSITE_REMOTE..."
  rclone sync "$DEST" "$OFFSITE_REMOTE"
fi

echo "[$STAMP] Backup OK"