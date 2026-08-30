#!/usr/bin/env bash
# scripts/restore-test.sh — B14. Monthly proof that the encrypted off-site copy
# (scripts/backup-to-r2.sh) is actually restorable, not merely uploaded — an unread backup
# is not a backup (ADR-INV-003 §D5: "חודשי: בדיקת שחזור"). Downloads the most recent daily
# backup (falls back to the most recent monthly backup if no daily backups exist yet —
# e.g. right after go-live), decrypts it, restores it into a disposable database, and runs
# the sanity checks from the B14 task brief: table count + `select count(*) from
# documents`. Never touches the live/production database — only the encrypted copy in R2
# and a throwaway database on the restore target.
#
# Required secrets (a subset of backup-to-r2.sh's — SUPABASE_DB_URL is deliberately NOT
# required here; restore-test never connects to the live database):
#   BACKUP_ENCRYPTION_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
#
# RESTORE_TARGET_URL is not a secret — it points at a scratch/CI Postgres instance to
# restore into (defaults to the same local/CI Postgres convention already used by
# scripts/migrate-down-up-roundtrip.sh). It must never be set to SUPABASE_DB_URL.
#
# Clean skip (exit 0) if any of the five R2/encryption secrets is unset — same contract as
# backup-to-r2.sh ("Skip נקי בלי secrets").
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-r2.sh
source "$ROOT_DIR/scripts/lib-r2.sh"

REQUIRED_VARS=(BACKUP_ENCRYPTION_KEY R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET)
missing=()
for v in "${REQUIRED_VARS[@]}"; do
  [ -z "${!v:-}" ] && missing+=("$v")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "restore-test: skipping — not configured yet (missing: ${missing[*]}). See docs/ops-runbook.md."
  exit 0
fi

r2::ensure_cli

ADMIN_URL="${RESTORE_TARGET_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB_NAME="inv_restore_test_$$"

admin_psql() { psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }
restore_db_url() { echo "$ADMIN_URL" | sed -E "s#/[a-zA-Z0-9_]+\$#/${DB_NAME}#"; }
restore_psql() { psql "$(restore_db_url)" -v ON_ERROR_STOP=1 -X -q "$@"; }

WORK_DIR="$(mktemp -d)"
cleanup() {
  admin_psql -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '${DB_NAME}' and pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  admin_psql -c "drop database if exists ${DB_NAME};" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "==> finding most recent backup"
LATEST_DAILY="$(r2::list_filenames "daily" | tail -n1)"
if [ -n "$LATEST_DAILY" ]; then
  SOURCE_KEY="daily/${LATEST_DAILY}"
else
  LATEST_MONTHLY="$(r2::list_filenames "monthly" | tail -n1)"
  if [ -z "$LATEST_MONTHLY" ]; then
    echo "restore-test: FAILED — no daily/ or monthly/ backups found in bucket ${R2_BUCKET}." >&2
    exit 1
  fi
  SOURCE_KEY="monthly/${LATEST_MONTHLY}"
fi
echo "   using ${SOURCE_KEY}"

ENC_FILE="$WORK_DIR/dump.sql.enc"
DUMP_FILE="$WORK_DIR/dump.sql"

echo "==> downloading"
r2::get "$SOURCE_KEY" "$ENC_FILE"

echo "==> decrypting"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  -in "$ENC_FILE" -out "$DUMP_FILE"

echo "==> restoring into disposable database ${DB_NAME}"
admin_psql -c "create database ${DB_NAME};"
restore_psql -f "$DUMP_FILE" >/dev/null

echo "==> sanity checks"
TABLE_COUNT="$(restore_psql -t -A -c "select count(*) from information_schema.tables where table_schema = 'public';")"
echo "   public tables: ${TABLE_COUNT}"
if [ "${TABLE_COUNT:-0}" -lt 1 ]; then
  echo "restore-test: FAILED — restored database has 0 tables in the public schema." >&2
  exit 1
fi

DOCUMENT_COUNT="$(restore_psql -t -A -c "select count(*) from documents;")"
echo "   documents rows: ${DOCUMENT_COUNT}"

echo "==> restore-test OK (${SOURCE_KEY}, ${TABLE_COUNT} public tables, ${DOCUMENT_COUNT} documents rows)"
