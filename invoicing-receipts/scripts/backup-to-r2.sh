#!/usr/bin/env bash
# scripts/backup-to-r2.sh — B14. Daily encrypted off-site copy of the whole Supabase
# Postgres database, per ADR-INV-003 §D5 ("עותק חוץ עצמאי הוא חלק מ-Phase 0, לא שיפור
# עתידי"): Supabase Free retains zero backups and suspends projects after 7 days of
# inactivity, so this is the only durable copy of the 7-years-retention tax documents this
# project is legally required to keep, until/unless the founder moves to Supabase Pro
# (ADR-INV-003 §C3, a founder financial decision, not made here).
#
# Required secrets (all six — see docs/ops-runbook.md for exactly how the founder creates
# each one during the live-Supabase setup session):
#   SUPABASE_DB_URL          postgresql:// connection string (direct, non-pooled connection
#                             — pg_dump needs a stable session, not PgBouncer transaction mode)
#   BACKUP_ENCRYPTION_KEY    passphrase for the encrypted dump. Any long random string is
#                             fine; the runbook's suggested generation command happens to
#                             produce base64, but this script treats the value as an opaque
#                             OpenSSL passphrase (PBKDF2-stretched), never base64-decodes it.
#   R2_ACCOUNT_ID             Cloudflare account ID (endpoint = https://<id>.r2.cloudflarestorage.com)
#   R2_ACCESS_KEY_ID          R2 API token access key
#   R2_SECRET_ACCESS_KEY     R2 API token secret key
#   R2_BUCKET                 target bucket name
#
# Clean skip (exit 0, no error) if ANY of the six is unset/empty. Deliberate: the cron
# workflow runs regardless of whether the founder has connected a live Supabase project yet
# (see B14 task brief — "Skip נקי בלי secrets"), and a permanently-red unattended cron job
# is worse than a silent, clearly-logged no-op.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-r2.sh
source "$ROOT_DIR/scripts/lib-r2.sh"

REQUIRED_VARS=(SUPABASE_DB_URL BACKUP_ENCRYPTION_KEY R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET)
missing=()
for v in "${REQUIRED_VARS[@]}"; do
  [ -z "${!v:-}" ] && missing+=("$v")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "backup-to-r2: skipping — not configured yet (missing: ${missing[*]}). See docs/ops-runbook.md."
  exit 0
fi

r2::ensure_cli

# Retention window (days for the daily/ prefix, months for the monthly/ prefix). Overridable
# only for testing — production always uses the B14 spec's defaults (30 days + 12 months).
DAILY_RETENTION_DAYS="${BACKUP_DAILY_RETENTION_DAYS:-30}"
MONTHLY_RETENTION_MONTHS="${BACKUP_MONTHLY_RETENTION_MONTHS:-12}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

TODAY="$(date -u +%Y-%m-%d)"
DAY_OF_MONTH="$(date -u +%d)"
MONTH_KEY="$(date -u +%Y-%m)"

DUMP_FILE="$WORK_DIR/dump.sql"
ENC_FILE="$WORK_DIR/dump.sql.enc"

echo "==> pg_dump (full database, plain SQL, no owner/privileges)"
pg_dump "$SUPABASE_DB_URL" --format=plain --no-owner --no-privileges --file="$DUMP_FILE"

echo "==> encrypting with AES-256-CBC (PBKDF2, 200000 iterations)"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  -in "$DUMP_FILE" -out "$ENC_FILE"

echo "==> uploading daily/${TODAY}.sql.enc"
r2::put "$ENC_FILE" "daily/${TODAY}.sql.enc"

if [ "$DAY_OF_MONTH" = "01" ]; then
  echo "==> first of the month — also uploading monthly/${MONTH_KEY}.sql.enc"
  r2::put "$ENC_FILE" "monthly/${MONTH_KEY}.sql.enc"
fi

echo "==> rotating daily/ (retain ${DAILY_RETENTION_DAYS} days)"
DAILY_CUTOFF="$(date -u -d "${DAILY_RETENTION_DAYS} days ago" +%Y-%m-%d)"
while IFS= read -r filename; do
  [ -z "$filename" ] && continue
  file_date="${filename%.sql.enc}"
  if [[ "$file_date" < "$DAILY_CUTOFF" ]]; then
    echo "   deleting daily/${filename} (older than ${DAILY_CUTOFF})"
    r2::rm "daily/${filename}"
  fi
done < <(r2::list_filenames "daily")

echo "==> rotating monthly/ (retain ${MONTHLY_RETENTION_MONTHS} months)"
MONTHLY_CUTOFF="$(date -u -d "${MONTHLY_RETENTION_MONTHS} months ago" +%Y-%m)"
while IFS= read -r filename; do
  [ -z "$filename" ] && continue
  file_month="${filename%.sql.enc}"
  if [[ "$file_month" < "$MONTHLY_CUTOFF" ]]; then
    echo "   deleting monthly/${filename} (older than ${MONTHLY_CUTOFF})"
    r2::rm "monthly/${filename}"
  fi
done < <(r2::list_filenames "monthly")

echo "==> backup-to-r2 OK (${TODAY})"
