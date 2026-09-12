#!/usr/bin/env bash
# pnpm db:pi:types — regenerates packages/database/src/generated-database-types.ts
# from the Raspberry Pi's live schema (same flow as the old `supabase gen
# types typescript --local`, just pointed at the Pi via --db-url instead).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=./load-env.sh
source scripts/load-env.sh
# shellcheck source=./db-pi-guard.sh
source scripts/db-pi-guard.sh

require_pi_db_url

cd packages/database
echo "Generating types from the Raspberry Pi schema ($PI_DB_HOST:$PI_DB_PORT/$PI_DB_NAME)..."
pnpm exec supabase gen types typescript --db-url "$(pi_db_url_no_ssl)" > src/generated-database-types.ts
echo "OK — wrote packages/database/src/generated-database-types.ts"
