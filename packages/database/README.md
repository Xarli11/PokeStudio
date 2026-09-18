# @pokelab/database

PostgreSQL/Supabase boundary: migrations, local dev workflow, and a typed connection adapter.

## Local workflow (Raspberry Pi — normal development)

Normal local development targets the Raspberry Pi self-hosted Supabase instance, not a Mac-local
stack (CLAUDE.md §21 "Local Development Database"; docs/engineering/DATABASE.md "Raspberry Pi
local development" has the full architecture). From the repo root, with `.env.local` pointing at
the Pi:

```bash
pnpm db:pi:check     # read-only identity check — confirms .env.local really points at the Pi
pnpm db:pi:migrate   # apply supabase/migrations/*.sql to the Pi via `supabase db push --db-url`
pnpm db:pi:types      # regenerate src/generated-database-types.ts from the Pi's live schema
```

`db:pi:migrate` no longer seeds Pokémon data — `supabase/seed.sql` is reserved for small static
lookup data (none exists yet). After `db:pi:migrate`, run `pnpm ingest:pi` to populate
`species`/`pokemon_form`/etc. (docs/engineering/DATABASE.md "Seed vs. ingestion"). All three `db:pi:*`
scripts (`scripts/db-pi-*.sh`) refuse to run against anything but `192.168.1.236:5434/postgres` —
see `scripts/db-pi-guard.sh`.

After a schema change: write the migration, `pnpm db:pi:migrate` to apply it to the Pi, then
`pnpm db:pi:types` to regenerate `src/generated-database-types.ts` (the authoritative `Database`
type since Phase 1B; `src/types.ts` just re-exports it) from the Pi's now-updated schema.

## Isolated local Supabase (exceptional)

A Mac-local Supabase stack via the Supabase CLI is **not** the normal dev workflow — use it only
for something that genuinely needs an isolated, disposable instance (e.g. a throwaway schema
experiment, or CI). Requires Docker (the CLI runs Postgres, GoTrue, PostgREST, etc. in containers).

```bash
pnpm --filter @pokelab/database db:start   # supabase start
pnpm --filter @pokelab/database db:reset   # apply migrations (schema/constraints/indexes only)
pnpm --filter @pokelab/database db:diff    # generate a new migration from schema changes
pnpm --filter @pokelab/database db:stop
```

These scripts run with this package (`packages/database`) as the working directory, which is
where `supabase/config.toml` lives — do not add `--workdir supabase` to them or to any ad hoc
`supabase` CLI invocation here. That flag tells the CLI cwd itself is `packages/database/supabase`
and to look for `supabase/migrations` and `supabase/seed.sql` one level below that (which don't
exist), so `db:start`/`db:reset` silently skip the real migrations and seed and stand up an empty
database under a stray nested `supabase/supabase/` directory instead.

## Migrations

Schema changes live in `supabase/migrations/*.sql` (docs/engineering/DATABASE.md "Migration policy").
Never hand-edit a production schema outside a migration.

## RLS

Every table exposed to `anon`/`authenticated` must ship with an explicit policy and a
corresponding test in `tests/rls.integration.test.ts`. That suite requires a reachable Supabase
instance (normally the Pi; an isolated local stack works too) and is skipped otherwise — it is the
executable spec for the RLS guarantee, not optional documentation.
