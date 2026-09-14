#!/usr/bin/env bash
# Shared guard for scripts that touch Supabase Cloud "PokeStudio Dev"
# (db:cloud-dev:check, db:cloud-dev:migrate, ingest:cloud-dev). Not meant to be
# run directly — `source` it and call the relevant require_* function before
# doing anything. Exists so an accidental Pi/localhost/other-project target
# can never silently receive a Cloud DEV migration or ingestion run, mirroring
# scripts/db-pi-guard.sh's pattern for the Raspberry Pi (CLAUDE.md §21).
set -euo pipefail

CLOUD_DEV_PROJECT_REF="tofhupgwxsexrburoqys"
CLOUD_DEV_API_URL="https://${CLOUD_DEV_PROJECT_REF}.supabase.co"

# Supabase direct/pooled Postgres URLs vary in shape (db.<ref>.supabase.co on
# :5432, or a pooler host with user postgres.<ref>) — rather than matching one
# exact host like the Pi guard does, require the project ref to appear
# somewhere in the URL and explicitly reject known-wrong targets. Never echo
# the URL itself, since it carries a password.
require_cloud_dev_db_url() {
  if [ -z "${SUPABASE_CLOUD_DEV_DB_URL:-}" ]; then
    echo "error: SUPABASE_CLOUD_DEV_DB_URL is not set." >&2
    echo "  Expected a direct Postgres connection string for Supabase Cloud PokeStudio Dev" >&2
    echo "  (project ref: $CLOUD_DEV_PROJECT_REF). Add it to .env.local — never commit it." >&2
    exit 1
  fi

  local url="$SUPABASE_CLOUD_DEV_DB_URL"
  case "$url" in
    *192.168.1.236*|*localhost*|*127.0.0.1*)
      echo "error: SUPABASE_CLOUD_DEV_DB_URL points at the Raspberry Pi or localhost." >&2
      echo "  Refusing to run — this guard exists to stop an accidental Pi/local target" >&2
      echo "  from receiving a Cloud DEV migration. See CLAUDE.md §21." >&2
      exit 1
      ;;
  esac
  case "$url" in
    *"$CLOUD_DEV_PROJECT_REF"*) ;;
    *)
      echo "error: SUPABASE_CLOUD_DEV_DB_URL does not reference project ref $CLOUD_DEV_PROJECT_REF." >&2
      echo "  Refusing to run — this guard exists to stop an accidental wrong-project target." >&2
      exit 1
      ;;
  esac
}

require_cloud_dev_api_url() {
  if [ -z "${SUPABASE_URL:-}" ]; then
    echo "error: SUPABASE_URL is not set." >&2
    echo "  Expected the Supabase Cloud PokeStudio Dev API gateway ($CLOUD_DEV_API_URL)." >&2
    exit 1
  fi

  if [ "$SUPABASE_URL" != "$CLOUD_DEV_API_URL" ]; then
    echo "error: SUPABASE_URL does not point at Supabase Cloud PokeStudio Dev." >&2
    echo "  expected: $CLOUD_DEV_API_URL" >&2
    echo "  got:      $SUPABASE_URL" >&2
    echo "  Refusing to run — this guard exists to stop an accidental Pi/localhost/wrong-project" >&2
    echo "  ingestion. See CLAUDE.md §21 'Local Development Database'." >&2
    exit 1
  fi
}
