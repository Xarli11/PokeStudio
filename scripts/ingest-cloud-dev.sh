#!/usr/bin/env bash
# pnpm ingest:cloud-dev — runs the existing pokemon-data ingestion pipeline
# (packages/pokemon-data/scripts/ingest.ts) against Supabase Cloud
# "PokeStudio Dev" (project ref tofhupgwxsexrburoqys) instead of the Pi.
#
# Deliberately separate from scripts/ingest-pi.sh rather than a shared flag:
# ingest-pi.sh's guard actively refuses a Supabase Cloud SUPABASE_URL, so a
# single parameterized script would need to weaken that guard. Keeping them
# apart means neither script can ever be pointed at the other's target by a
# typo or copy/paste.
#
# Uses SUPABASE_CLOUD_DEV_SECRET_KEY (kept separate from the Pi's
# SUPABASE_SECRET_KEY in .env.local so neither can silently overwrite the
# other) only for this process's environment — never written to .env.local by
# this script, never configured on the deployed web Worker.
#
# Also exports INGEST_LOCK_DB_URL (the direct Postgres connection string,
# reused from SUPABASE_CLOUD_DEV_DB_URL) so ingest.ts can hold a Postgres
# advisory lock for the run's duration — see src/ingest-lock.ts. This exists
# because two concurrent `ingest:cloud-dev` runs raced on 2026-09-15, each
# independently clearing and re-inserting pokemon_form_move.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=./load-env.sh
source scripts/load-env.sh
# shellcheck source=./db-cloud-dev-guard.sh
source scripts/db-cloud-dev-guard.sh

export SUPABASE_URL="$CLOUD_DEV_API_URL"
require_cloud_dev_api_url
require_cloud_dev_db_url
export INGEST_LOCK_DB_URL="$SUPABASE_CLOUD_DEV_DB_URL"

if [ -z "${SUPABASE_CLOUD_DEV_SECRET_KEY:-}" ]; then
  echo "error: SUPABASE_CLOUD_DEV_SECRET_KEY is not set." >&2
  echo "  Add it to .env.local (never commit it, never paste it in chat)." >&2
  exit 1
fi
export SUPABASE_SECRET_KEY="$SUPABASE_CLOUD_DEV_SECRET_KEY"

echo "Ingesting into Supabase Cloud PokeStudio Dev ($SUPABASE_URL)..."
pnpm --filter @pokelab/pokemon-data ingest "$@"
