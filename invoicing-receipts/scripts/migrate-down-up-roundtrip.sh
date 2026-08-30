#!/usr/bin/env bash
# scripts/migrate-down-up-roundtrip.sh — B13.
#
# Applies every migration in supabase/migrations/ forward, then every down migration in
# supabase/migrations_down/ in REVERSE order, then every up migration forward again — proving
# every migration this project has actually has a working `down` (invariant #4, CLAUDE.md),
# not just an up. Finishes by running scripts/ci-schema-checks.sql against the final
# (twice-forward-migrated) database.
#
# Runs every migration as `db_owner` — a real non-superuser owner of every object, matching
# Supabase's actual `postgres` project role (a powerful role, but never a true Postgres
# superuser) rather than the bootstrap superuser `postgres:16`'s default `postgres` role
# would otherwise give this script. See tests/db/harness.ts's `OWNER_ROLE` comment for why
# this distinction is not cosmetic — it is what let this round's `compute_line` and
# `business_has_signing_key` bugs (both real, both invisible under a literal superuser) be
# caught at all.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB_NAME="inv_ci_roundtrip_$$"
OWNER_ROLE="db_owner"
OWNER_PASSWORD="db_owner"

admin_psql() { psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }
db_url() { echo "postgresql://${OWNER_ROLE}:${OWNER_PASSWORD}@$(echo "$ADMIN_URL" | sed -E 's#^[a-zA-Z]+://[^@]*@##;s#/[^/]*$##')/${DB_NAME}"; }
db_psql() { psql "$(db_url)" -v ON_ERROR_STOP=1 -X -q "$@"; }
admin_db_url() { echo "$ADMIN_URL" | sed -E "s#/[a-zA-Z0-9_]+\$#/${DB_NAME}#"; }
superuser_on_new_db_psql() { psql "$(admin_db_url)" -v ON_ERROR_STOP=1 -X -q "$@"; }

cleanup() {
  admin_psql -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '${DB_NAME}' and pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  admin_psql -c "drop database if exists ${DB_NAME};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating ${DB_NAME} (owner: ${OWNER_ROLE})"
admin_psql -c "create role ${OWNER_ROLE} login password '${OWNER_PASSWORD}' createrole;" >/dev/null 2>&1 || true
admin_psql -c "create role anon nologin;" >/dev/null 2>&1 || true
admin_psql -c "create role authenticated nologin;" >/dev/null 2>&1 || true
admin_psql -c "create role service_role nologin bypassrls;" >/dev/null 2>&1 || true
admin_psql -c "grant anon, authenticated, service_role to ${OWNER_ROLE};"
admin_psql -c "create database ${DB_NAME} owner ${OWNER_ROLE};"
superuser_on_new_db_psql -c "alter schema public owner to ${OWNER_ROLE};"
for ext in pgcrypto citext moddatetime; do
  superuser_on_new_db_psql -c "create extension if not exists \"${ext}\";"
done

db_psql -f "$ROOT_DIR/tests/db/auth-stub.sql"
db_psql -f "$ROOT_DIR/tests/db/storage-stub.sql"

echo "==> up (forward, 0001..latest)"
for f in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "   applying $(basename "$f")"
  db_psql -f "$f"
done

echo "==> down (reverse order, latest..0001)"
for f in $(ls "$ROOT_DIR"/supabase/migrations_down/*.sql | sort -r); do
  echo "   reverting $(basename "$f")"
  if [[ "$(basename "$f")" == "0001_extensions_down.sql" ]]; then
    # `DROP EXTENSION` requires being the extension's owner, and Postgres has no
    # `ALTER EXTENSION ... OWNER TO` (verified empirically — no such clause exists) to move
    # ownership to `db_owner` after the fact. The three extensions here were installed by the
    # superuser admin connection in the first place (see the pre-install loop above, and its
    # comment) precisely because they are not `trusted` in a vanilla, non-Supabase-managed
    # Postgres install, so they must also be dropped by that same superuser connection.
    superuser_on_new_db_psql -f "$f"
  else
    db_psql -f "$f"
  fi
done

echo "==> re-installing extensions dropped by 0001_extensions_down.sql (superuser, same as initial setup)"
for ext in pgcrypto citext moddatetime; do
  superuser_on_new_db_psql -c "create extension if not exists \"${ext}\";"
done

echo "==> up again (forward, 0001..latest)"
for f in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "   applying $(basename "$f")"
  db_psql -f "$f"
done

echo "==> schema checks"
db_psql -f "$ROOT_DIR/scripts/ci-schema-checks.sql"

echo "==> roundtrip OK"
