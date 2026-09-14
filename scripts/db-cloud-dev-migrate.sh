#!/usr/bin/env bash
# pnpm db:cloud-dev:migrate — applies packages/database/supabase/migrations/*.sql
# to Supabase Cloud "PokeStudio Dev" (project ref tofhupgwxsexrburoqys) via
# `supabase db push --db-url`, same approach as scripts/db-pi-migrate.sh.
#
# One extra step versus the Pi script: on 2026-09-14, migration
# 20260912140000_move_version_reference.sql was applied to Cloud DEV directly
# through Supabase's connected tooling (Studio/MCP), which recorded it in
# supabase_migrations.schema_migrations under a different version
# (20260914004733) than the repo's filename timestamp. The schema it created
# (public.move/version_group/move_learn_method) is real and correct — only the
# remote history bookkeeping disagrees with the repo — so a plain `db push`
# would try to re-run that migration's `create table` statements and fail with
# "relation already exists". The supported fix for exactly this situation is
# `supabase migration repair --status applied <version>`, which records a
# version as applied in the remote history WITHOUT executing its SQL. This
# script checks for that specific mismatch and repairs only that one version
# before pushing whatever is genuinely still pending — it does not touch any
# other history entry, and does not run repair unconditionally.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=./load-env.sh
source scripts/load-env.sh
# shellcheck source=./db-cloud-dev-guard.sh
source scripts/db-cloud-dev-guard.sh

require_cloud_dev_db_url

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql is not installed (brew install libpq, or postgresql)." >&2
  exit 1
fi

echo "Read-only identity check before migrating..."
psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -c "select current_database(), current_user, version();" >/dev/null
echo "OK — confirmed target is Supabase Cloud PokeStudio Dev ($CLOUD_DEV_PROJECT_REF)."

cd packages/database

KNOWN_MISMATCH_VERSION="20260912140000"
KNOWN_MISMATCH_NAME="move_version_reference"

already_recorded="$(psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -t -A -c \
  "select 1 from supabase_migrations.schema_migrations where version = '${KNOWN_MISMATCH_VERSION}';")"

if [ -z "$already_recorded" ]; then
  applied_under_other_version="$(psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -t -A -c \
    "select version from supabase_migrations.schema_migrations where name = '${KNOWN_MISMATCH_NAME}' and version <> '${KNOWN_MISMATCH_VERSION}';")"
  table_exists="$(psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -t -A -c \
    "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'move';")"

  if [ -n "$applied_under_other_version" ] && [ -n "$table_exists" ]; then
    echo ""
    echo "Detected known history mismatch: '${KNOWN_MISMATCH_NAME}' is applied"
    echo "remotely under version ${applied_under_other_version}, not the repo's"
    echo "${KNOWN_MISMATCH_VERSION}, and public.move already exists — repairing"
    echo "history only (no SQL executed) for version ${KNOWN_MISMATCH_VERSION}..."
    pnpm exec supabase migration repair --db-url "$SUPABASE_CLOUD_DEV_DB_URL" --status applied "$KNOWN_MISMATCH_VERSION"
  elif [ -n "$table_exists" ]; then
    echo "error: public.move exists but ${KNOWN_MISMATCH_VERSION} is not recorded and no" >&2
    echo "  matching '${KNOWN_MISMATCH_NAME}' entry was found under another version either." >&2
    echo "  Refusing to guess — inspect supabase_migrations.schema_migrations manually." >&2
    exit 1
  fi
fi

echo ""
echo "Migrations that would be applied (dry run):"
pnpm exec supabase db push --db-url "$SUPABASE_CLOUD_DEV_DB_URL" --dry-run

echo ""
echo "Applying..."
pnpm exec supabase db push --db-url "$SUPABASE_CLOUD_DEV_DB_URL"
