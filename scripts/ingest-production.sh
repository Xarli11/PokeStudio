#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/ci/target.mjs production
if [[ "${POKELAB_PRODUCTION_APPROVED_SHA:-}" != "$(git rev-parse HEAD)" || -z "${SUPABASE_INGEST_KEY:-}" ]]; then
  echo 'error: approved production SHA and ingestion key required.' >&2
  exit 1
fi
SUPABASE_URL="$(node --input-type=module -e 'import {targetFor} from "./scripts/ci/target.mjs"; console.log(`https://${targetFor("production").projectRef}.supabase.co`)')"
export SUPABASE_URL
export SUPABASE_SECRET_KEY="$SUPABASE_INGEST_KEY"
export INGEST_LOCK_DB_URL="$SUPABASE_DB_URL"
pnpm --filter @pokelab/pokemon-data ingest "$@"
