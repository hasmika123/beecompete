#!/usr/bin/env bash
# Starts the API locally with apps/api/.env.s3.local (and .env.local) loaded into the environment.
#
# `./gradlew bootRun` does NOT read .env files — the API has no dotenv dependency and no
# spring.config.import, so every value must already be in the process environment (see
# apps/api/README.md). That left apps/api/.env.s3.local unread even though setup-runbook.md §6a
# tells you to put the S3 credentials there, so POST /api/v1/admin/uploads/cover returned 503
# "cover upload isn't configured" and every cover-image upload in /admin failed.
#
# This script does the missing step: it puts those KEY=VALUE pairs into the environment, where both
# Spring's ${S3_BUCKET:} placeholders and the AWS SDK's default credential chain look for them.
#
# Usage:  scripts/dev-api.sh [--check]
#   --check  load the files, report what was set, and exit without starting the API.
set -euo pipefail

check_only=0
[ "${1:-}" = "--check" ] && check_only=1

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_dir="$repo_root/apps/api"

# Later files win, so a general .env.local can override the S3-only one.
for name in .env.s3.local .env.local; do
  file="$api_dir/$name"
  if [ ! -f "$file" ]; then
    echo "skip   $name (not present)"
    continue
  fi
  # `set -a` exports everything the file assigns. Sourcing (rather than parsing) keeps quoting
  # semantics identical to the shell the values were written for.
  set -a
  # shellcheck disable=SC1090
  . "$file"
  set +a
  echo "loaded $name"
done

# The four the cover-upload endpoint needs before it will mint a presigned URL. Named individually
# because a partial .env file 503s exactly like an absent one.
missing=""
for var in S3_BUCKET AWS_REGION S3_PUBLIC_BASE_URL AWS_ACCESS_KEY_ID; do
  [ -z "${!var:-}" ] && missing="$missing $var"
done
if [ -n "$missing" ]; then
  echo "WARNING: cover-image uploads will 503 — missing:$missing. See docs/setup-runbook.md §6a." >&2
else
  echo "cover-image uploads: configured"
fi

[ "$check_only" = "1" ] && exit 0

cd "$api_dir"
exec ./gradlew bootRun
