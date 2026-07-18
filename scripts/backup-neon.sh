#!/usr/bin/env bash
#
# Logical backup of the prod Neon Postgres DB — the R1-17 "Neon free-tier" safety net
# (docs/setup-runbook.md §5). Neon's free tier has only a short PITR window, so we keep our own
# off-box logical dumps. This is a manual/cron `pg_dump`, NOT a replacement for paid-tier PITR —
# which becomes mandatory at R2 (user PII). See memory: cloudflare vs neon re-scope.
#
# Reads the DIRECT (non-pooler) Neon creds straight from the prod stack .env and dumps through a
# pinned postgres image, so nothing but the .env needs to live on the box.
#
#   Usage:   ./backup-neon.sh [path-to-.env]        # defaults to ~/beecompete-prod/.env
#   Env:     BACKUP_DIR   (default ~/backups)
#            BACKUP_KEEP  (default 14 — most recent N dumps kept, older pruned)
#            PG_IMAGE     (default postgres:18-alpine — MUST be >= the Neon server major, currently 18)
#
#   Nightly cron (as the deploy user), e.g. 03:15 UTC:
#     15 3 * * * /home/deploy/scripts/backup-neon.sh >> /home/deploy/backups/backup.log 2>&1
#
set -euo pipefail

ENV_FILE="${1:-$HOME/beecompete-prod/.env}"
OUT_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP="${BACKUP_KEEP:-14}"
# pg_dump refuses to dump a server newer than itself — keep this >= the Neon server major (18.x).
PG_IMAGE="${PG_IMAGE:-postgres:18-alpine}"

# Load the stack env (DIRECT_* = the non-pooler branch creds Liquibase uses; safe for a full dump).
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${DIRECT_URL:?DIRECT_URL missing from $ENV_FILE}"
: "${DIRECT_USERNAME:?DIRECT_USERNAME missing from $ENV_FILE}"
: "${DIRECT_PASSWORD:?DIRECT_PASSWORD missing from $ENV_FILE}"

# jdbc:postgresql://<host>/<db>?... -> host and db
HOST="$(printf '%s' "$DIRECT_URL" | sed -E 's#^jdbc:postgresql://([^/]+)/.*#\1#')"
DB="$(printf '%s' "$DIRECT_URL" | sed -E 's#^jdbc:postgresql://[^/]+/([^?]+).*#\1#')"

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
OUT="$OUT_DIR/beecompete-prod-$(date -u +%Y%m%d-%H%M%SZ).dump"

echo "Dumping $DB @ $HOST -> $OUT"
docker run --rm -e PGPASSWORD="$DIRECT_PASSWORD" -e PGSSLMODE=require "$PG_IMAGE" \
  pg_dump -h "$HOST" -U "$DIRECT_USERNAME" -d "$DB" --no-owner --no-privileges -Fc >"$OUT"
chmod 600 "$OUT"
echo "OK: $(du -h "$OUT" | cut -f1) -> $OUT"

# Retention: keep the newest $KEEP dumps, delete the rest.
ls -1t "$OUT_DIR"/beecompete-prod-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f
