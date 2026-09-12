#!/usr/bin/env bash
# pnpm ingest:pi — runs the existing pokemon-data ingestion pipeline against
# the Raspberry Pi's Supabase API gateway. Reuses
# packages/pokemon-data/scripts/ingest.ts as-is (SUPABASE_URL/SUPABASE_SECRET_KEY
# driven) — this only guards which target it's allowed to point at.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=./load-env.sh
source scripts/load-env.sh

PI_API_URL="http://192.168.1.236:8002"

if [ -z "${SUPABASE_URL:-}" ]; then
  echo "error: SUPABASE_URL is not set." >&2
  echo "  Expected the Raspberry Pi's API gateway ($PI_API_URL). See .env.example and CLAUDE.md §21." >&2
  exit 1
fi

if [ "$SUPABASE_URL" != "$PI_API_URL" ]; then
  echo "error: SUPABASE_URL does not point at the canonical Raspberry Pi API gateway." >&2
  echo "  expected: $PI_API_URL" >&2
  echo "  got:      $SUPABASE_URL" >&2
  echo "  Refusing to run — this guard exists to stop an accidental localhost/Supabase-Cloud" >&2
  echo "  ingestion. See CLAUDE.md §21 'Local Development Database'." >&2
  exit 1
fi

if [ -z "${SUPABASE_SECRET_KEY:-}" ]; then
  echo "error: SUPABASE_SECRET_KEY is not set. See .env.example." >&2
  exit 1
fi

echo "Ingesting into the Raspberry Pi ($SUPABASE_URL)..."
pnpm --filter @pokestudio/pokemon-data ingest "$@"
