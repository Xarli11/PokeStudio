#!/usr/bin/env bash
# pnpm db:cloud-dev:migrate — applies packages/database/supabase/migrations/*.sql
# to Supabase Cloud "PokeStudio Dev" (project ref tofhupgwxsexrburoqys) via
# `supabase db push --db-url`, same approach as scripts/db-pi-migrate.sh.
#
# Known remote/local migration-history aliasing: on 2026-09-14, six
# migrations from the 2026-09-12 move/machine schema work were applied to
# Cloud DEV directly through Supabase's connected tooling (Studio/MCP),
# which recorded each of them in supabase_migrations.schema_migrations under
# a different ("alias") version number than the repo's own filename
# ("canonical"). The schema itself (move/version_group/move_learn_method/
# pokemon_form_move/machine/move_stat_change) is real and correct — only the
# remote history bookkeeping disagrees with the repo. Verified read-only
# 2026-09-16 against live Cloud DEV:
#
#   alias version    | name                                   | canonical version | evidence table
#   20260914004733    move_version_reference                   20260912140000       move
#   20260914005703    pokemon_form_move                        20260912141000       pokemon_form_move
#   20260914005712    machines                                 20260912142000       machine
#   20260914005718    pokemon_form_move_version_group_index     20260912143000       pokemon_form_move
#   20260914005723    move_meta_nullable                        20260912144000       move
#   20260914005733    move_stat_change                          20260912150000       move_stat_change
#
# A prior version of this script only marked the canonical version as
# applied and left the alias row in place — that is NOT sufficient: as long
# as the alias version remains in remote history with no matching local
# file, `supabase db push` refuses to run at all
# (`LegacyDbPushMissingLocalError`, since it finds a remote version it can't
# match to any local migration and stops rather than guess). Reconciling a
# pair requires BOTH steps, bookkeeping-only, zero SQL executed:
#   1. `migration repair --status reverted <alias>`    — removes the alias
#      version from remote history (it corresponds to no local file)
#   2. `migration repair --status applied <canonical>` — records the repo's
#      own filename version as applied, without running its SQL (the
#      table/column/index it would create already exists — confirmed via
#      the evidence table above before ever repairing)
# This script only ever repairs a version it can positively match by name
# to a still-existing table of that migration's own creation — it never
# guesses, and never touches a version outside this known list.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=./load-env.sh
source scripts/load-env.sh
# shellcheck source=./db-cloud-dev-guard.sh
source scripts/db-cloud-dev-guard.sh

require_cloud_dev_db_url

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql is not installed (brew install libpq, or postgresql)." >&2
  exit 1
fi

echo "Read-only identity check before migrating..."
psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "select current_database(), current_user, version();" >/dev/null
echo "OK — confirmed target is Supabase Cloud PokeStudio Dev ($CLOUD_DEV_PROJECT_REF)."

cd packages/database

# alias_version:name:canonical_version:evidence_table
KNOWN_ALIASES=(
  "20260914004733:move_version_reference:20260912140000:move"
  "20260914005703:pokemon_form_move:20260912141000:pokemon_form_move"
  "20260914005712:machines:20260912142000:machine"
  "20260914005718:pokemon_form_move_version_group_index:20260912143000:pokemon_form_move"
  "20260914005723:move_meta_nullable:20260912144000:move"
  "20260914005733:move_stat_change:20260912150000:move_stat_change"
)

reverted_versions=()
applied_versions=()

for entry in "${KNOWN_ALIASES[@]}"; do
  IFS=':' read -r alias_version name canonical_version evidence_table <<< "$entry"

  canonical_recorded="$(psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -v ON_ERROR_STOP=1 -t -A -c \
    "select 1 from supabase_migrations.schema_migrations where version = '${canonical_version}';")"
  if [ -n "$canonical_recorded" ]; then
    continue # already reconciled in a prior run — nothing to do for this pair
  fi

  alias_recorded="$(psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -v ON_ERROR_STOP=1 -t -A -c \
    "select 1 from supabase_migrations.schema_migrations where version = '${alias_version}' and name = '${name}';")"
  table_exists="$(psql "$SUPABASE_CLOUD_DEV_DB_URL" -X -q -v ON_ERROR_STOP=1 -t -A -c \
    "select 1 from information_schema.tables where table_schema = 'public' and table_name = '${evidence_table}';")"

  if [ -n "$alias_recorded" ] && [ -n "$table_exists" ]; then
    echo "Detected known history alias: '${name}' recorded remotely under" \
      "${alias_version}, not the repo's ${canonical_version}; ${evidence_table} already exists."
    reverted_versions+=("$alias_version")
    applied_versions+=("$canonical_version")
  elif [ -n "$table_exists" ]; then
    echo "error: ${evidence_table} exists but neither ${canonical_version} nor a matching" >&2
    echo "  '${name}' alias entry was found in schema_migrations. Refusing to guess —" >&2
    echo "  inspect supabase_migrations.schema_migrations manually." >&2
    exit 1
  fi
  # else: evidence table doesn't exist and canonical isn't recorded either —
  # genuinely pending migration, left for the normal `db push` below to apply.
done

if [ "${#reverted_versions[@]}" -gt 0 ]; then
  echo ""
  echo "Repairing history only (no SQL executed):"
  echo "  revert alias versions:     ${reverted_versions[*]}"
  echo "  mark canonical versions applied: ${applied_versions[*]}"
  pnpm exec supabase migration repair --db-url "$SUPABASE_CLOUD_DEV_DB_URL" --status reverted "${reverted_versions[@]}"
  pnpm exec supabase migration repair --db-url "$SUPABASE_CLOUD_DEV_DB_URL" --status applied "${applied_versions[@]}"
fi

echo ""
echo "Migrations that would be applied (dry run):"
pnpm exec supabase db push --db-url "$SUPABASE_CLOUD_DEV_DB_URL" --dry-run --skip-vault

echo ""
echo "Applying..."
pnpm exec supabase db push --db-url "$SUPABASE_CLOUD_DEV_DB_URL" --yes --skip-vault
