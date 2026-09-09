# @pokestudio/database

PostgreSQL/Supabase boundary: migrations, local dev workflow, and a typed connection adapter.

## Local workflow

Requires Docker (the Supabase CLI runs Postgres, GoTrue, PostgREST, etc. in containers).

```bash
pnpm --filter @pokestudio/database db:start   # supabase start
pnpm --filter @pokestudio/database db:reset   # apply migrations (schema/constraints/indexes only)
pnpm --filter @pokestudio/database db:diff    # generate a new migration from schema changes
pnpm --filter @pokestudio/database db:stop
```

`db:reset` no longer seeds Pokémon data — `supabase/seed.sql` is reserved for small static
lookup data (none exists yet). After `db:reset`, run
`pnpm --filter @pokestudio/pokemon-data ingest` to populate `species`/`pokemon_form`
(DATABASE.md "Seed vs. ingestion").

These scripts run with this package (`packages/database`) as the working directory, which is
where `supabase/config.toml` lives — do not add `--workdir supabase` to them or to any ad hoc
`supabase` CLI invocation here. That flag tells the CLI cwd itself is `packages/database/supabase`
and to look for `supabase/migrations` and `supabase/seed.sql` one level below that (which don't
exist), so `db:start`/`db:reset` silently skip the real migrations and seed and stand up an empty
database under a stray nested `supabase/supabase/` directory instead.

After a schema change, regenerate `src/generated-database-types.ts` — it is the authoritative
`Database` type (Phase 1B; `src/types.ts` just re-exports it), not hand-maintained:

```bash
pnpm --filter @pokestudio/database exec supabase gen types typescript --local > src/generated-database-types.ts
```

## Migrations

Schema changes live in `supabase/migrations/*.sql` (DATABASE.md "Migration policy").
Never hand-edit a production schema outside a migration.

## RLS

Every table exposed to `anon`/`authenticated` must ship with an explicit policy and a
corresponding test in `tests/rls.integration.test.ts`. That suite requires a running local
Supabase instance and is skipped otherwise — it is the executable spec for the RLS
guarantee, not optional documentation.
