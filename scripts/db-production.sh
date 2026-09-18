#!/usr/bin/env bash
# Production is intentionally unconfigured until targets.json is approved in a PR.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/ci/target.mjs production
if [[ "${POKESTUDIO_PRODUCTION_APPROVED_SHA:-}" != "$(git rev-parse HEAD)" ]]; then
  echo 'error: production requires the exact approved GitHub Environment release SHA.' >&2
  exit 1
fi
case "${1:-}" in
  check)
    pnpm --filter @pokelab/database exec supabase db push --db-url "$SUPABASE_DB_URL" --dry-run --skip-vault
    ;;
  migrate)
    pnpm --filter @pokelab/database exec supabase db push --db-url "$SUPABASE_DB_URL" --yes --skip-vault
    ;;
  *) echo 'error: expected check or migrate.' >&2; exit 1 ;;
esac
