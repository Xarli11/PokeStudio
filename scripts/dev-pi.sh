#!/usr/bin/env bash
# pnpm dev:pi — starts the web app for normal local development. Does NOT
# start any local Supabase/Docker stack (CLAUDE.md §21) — it only refuses to
# run against a leftover localhost Supabase URL, since NEXT_PUBLIC_* values
# come from .env.local, not from this script.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=./load-env.sh
source scripts/load-env.sh

case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
  http://127.0.0.1:*|http://localhost:*)
    echo "error: NEXT_PUBLIC_SUPABASE_URL points at localhost ($NEXT_PUBLIC_SUPABASE_URL)." >&2
    echo "  Normal PokeStudio development uses the Raspberry Pi (http://192.168.1.236:8002)," >&2
    echo "  not a local Supabase stack. Update .env.local — see CLAUDE.md §21." >&2
    exit 1
    ;;
  "")
    echo "error: NEXT_PUBLIC_SUPABASE_URL is not set. See .env.example and CLAUDE.md §21." >&2
    exit 1
    ;;
esac

echo "Starting web dev server against Raspberry Pi Supabase ($NEXT_PUBLIC_SUPABASE_URL)..."
pnpm --filter @pokestudio/web dev
