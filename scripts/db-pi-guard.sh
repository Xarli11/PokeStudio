#!/usr/bin/env bash
# Shared guard for scripts that touch the Raspberry Pi Postgres instance
# (db:pi:check, db:pi:migrate, db:pi:types). Not meant to be run directly —
# `source` it and call `require_pi_db_url` before doing anything with
# POKELAB_PI_DB_URL. Exists so an accidental localhost/other-host URL
# can never silently run a migration (CLAUDE.md §21).
set -euo pipefail

PI_DB_HOST="192.168.1.236"
PI_DB_PORT="5434"
PI_DB_NAME="postgres"

require_pi_db_url() {
  if [ -z "${POKELAB_PI_DB_URL:-}" ]; then
    echo "error: POKELAB_PI_DB_URL is not set." >&2
    echo "  Expected a Postgres connection string to the Raspberry Pi (host=$PI_DB_HOST port=$PI_DB_PORT db=$PI_DB_NAME)." >&2
    echo "  See .env.example and CLAUDE.md §21 'Local Development Database'." >&2
    exit 1
  fi

  # Parse postgres(ql)://[user[:pass]@]host:port/db[?...] without ever
  # echoing the URL itself, since it may carry a password.
  local url="$POKELAB_PI_DB_URL"
  local after_scheme="${url#*://}"
  local hostport="${after_scheme##*@}"
  hostport="${hostport%%/*}"
  local host="${hostport%%:*}"
  local port="${hostport##*:}"
  local db="${after_scheme#*/}"
  db="${db%%\?*}"

  if [ "$host" != "$PI_DB_HOST" ] || [ "$port" != "$PI_DB_PORT" ] || [ "$db" != "$PI_DB_NAME" ]; then
    echo "error: POKELAB_PI_DB_URL does not point at the canonical Raspberry Pi database." >&2
    echo "  expected: host=$PI_DB_HOST port=$PI_DB_PORT database=$PI_DB_NAME" >&2
    echo "  got:      host=${host:-?} port=${port:-?} database=${db:-?}" >&2
    echo "  Refusing to run — this guard exists to stop an accidental localhost/other-host" >&2
    echo "  migration or admin command. See CLAUDE.md §21 'Local Development Database'." >&2
    exit 1
  fi
}

# The Pi's self-hosted Postgres has no SSL configured, but Supabase CLI's Go
# driver (unlike psql's "prefer" default) refuses a plaintext fallback and
# requires `sslmode=disable` explicitly. Only used by CLI invocations
# (db:pi:migrate, db:pi:types) — plain `psql` (db:pi:check) doesn't need it.
pi_db_url_no_ssl() {
  case "$POKELAB_PI_DB_URL" in
    *\?*) echo "${POKELAB_PI_DB_URL}&sslmode=disable" ;;
    *) echo "${POKELAB_PI_DB_URL}?sslmode=disable" ;;
  esac
}
