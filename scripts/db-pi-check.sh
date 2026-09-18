#!/usr/bin/env bash
# pnpm db:pi:check — read-only identity check against the Raspberry Pi's
# direct Postgres port. Confirms POKELAB_PI_DB_URL actually reaches the
# canonical local-dev database before anyone trusts it for real work.
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

echo "Connecting to Raspberry Pi Postgres ($PI_DB_HOST:$PI_DB_PORT/$PI_DB_NAME)..."
psql "$POKELAB_PI_DB_URL" -X -q -c "select current_database(), current_user, version();"
echo "OK — this is the canonical Raspberry Pi local-development database."
