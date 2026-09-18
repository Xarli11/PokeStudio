#!/usr/bin/env bash
# pnpm db:pi:migrate — applies packages/database/supabase/migrations/*.sql to
# the Raspberry Pi's direct Postgres port via `supabase db push --db-url`.
# Deliberately does not depend on a linked Supabase project — --db-url talks
# to any Postgres directly, tracked idempotently via the remote's own
# supabase_migrations history table (already-applied migrations are skipped).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=./load-env.sh
source scripts/load-env.sh
# shellcheck source=./db-pi-guard.sh
source scripts/db-pi-guard.sh

require_pi_db_url

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql is not installed (brew install libpq, or postgresql)." >&2
  exit 1
fi

echo "Read-only identity check before migrating..."
psql "$POKELAB_PI_DB_URL" -X -q -c "select current_database(), current_user, version();" >/dev/null
echo "OK — confirmed target is the Raspberry Pi ($PI_DB_HOST:$PI_DB_PORT/$PI_DB_NAME)."

# supabase/config.toml lives in packages/database — running from anywhere
# else (or with --workdir supabase) makes the CLI look one level too deep
# and silently skip the real migrations (packages/database/README.md).
cd packages/database
db_url_no_ssl="$(pi_db_url_no_ssl)"

echo ""
echo "Migrations that would be applied (dry run):"
pnpm exec supabase db push --db-url "$db_url_no_ssl" --dry-run

echo ""
echo "Applying..."
pnpm exec supabase db push --db-url "$db_url_no_ssl"
