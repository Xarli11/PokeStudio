#!/usr/bin/env bash
# pnpm db:cloud-dev:check — read-only identity + migration-state check against
# Supabase Cloud "PokeStudio Dev" (project ref tofhupgwxsexrburoqys). Confirms
# SUPABASE_CLOUD_DEV_DB_URL actually reaches that project, then lists applied
# vs. pending migrations without changing anything — same intent as
# scripts/db-pi-check.sh for the Pi.
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

echo "Connecting to Supabase Cloud PokeStudio Dev ($CLOUD_DEV_PROJECT_REF)..."
psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "select current_database(), current_user, version();"
echo "OK — this is Supabase Cloud PokeStudio Dev."

echo ""
echo "Migration history (supabase_migrations.schema_migrations):"
psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -v ON_ERROR_STOP=1 -c \
  "select version, name from supabase_migrations.schema_migrations order by version;"

cd packages/database
echo ""
echo "Repository migrations vs. remote history (dry run, no changes applied):"
pnpm exec supabase db push --db-url "$SUPABASE_CLOUD_DEV_DB_URL" --dry-run --skip-vault
