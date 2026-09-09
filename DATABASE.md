# PokeStudio — Database Strategy

## Decision

Initial managed database/auth platform: **Supabase**, using PostgreSQL as the durable data model.

PokeStudio must remain PostgreSQL-centric rather than spreading Supabase-specific assumptions throughout domain code.

## Principles

- migrations live in source control,
- local development is reproducible,
- RLS protects exposed user-owned data,
- private-by-default user resources,
- structured Pokémon reference data is separate from user-generated/synced data,
- provenance/versioning exists for imported datasets,
- do not design tables for hypothetical features years away.

## Implementation status (Phase 1B)

`species` and `pokemon_form` are implemented (`supabase/migrations/20260909150000_pokemon_species_forms.sql`,
`20260909160000_pokemon_identity_upsert_constraints.sql`), superseding the Phase 0 flattened
`species` spike table. Species (canonical identity: slug, dex number, localized name) and forms
(default/regional/battle/cosmetic — types and base stats live here, since they can differ by form)
are separate tables, per ADR-0010. Reference data is public-read (`anon`/`authenticated`) via RLS
policy; writes are service-role only, same pattern as `data_sources`. Fully populated: the complete
PokéAPI species/form dataset (~1025 species, ~1580 forms) via `pnpm --filter @pokestudio/pokemon-data
ingest`, not a hand-picked sample. Not yet implemented from "Likely early domains" below:
generations/games as their own tables, abilities, moves, items, evolutions, learnsets — deferred
until a real feature needs them (YAGNI).

### Seed vs. ingestion

`supabase/seed.sql` (run by `db:reset`) is schema-adjacent bootstrap data only — small, genuinely
static, deterministic lookup tables, if any ever exist. It is _not_ how Pokémon reference data gets
into the database. `species`/`pokemon_form`/`data_sources` are populated exclusively by
`packages/pokemon-data`'s ingestion pipeline (`pnpm --filter @pokestudio/pokemon-data ingest`),
which upserts its own `data_sources` provenance row too. Phase 1A briefly hand-mirrored a 3-species
sample into `seed.sql`; that stopped being viable once the dataset became the real ~1025-species
Pokédex (see `packages/pokemon-data/README.md`) and was deliberately not continued at scale.

Local workflow is therefore two steps: `db:reset` (schema only) then `pnpm --filter
@pokestudio/pokemon-data ingest` (data). `db:reset` alone no longer produces a Pokédex-ready
database — this is intentional, not a regression from Phase 1A.

### Ingestion write strategy

Species/forms are upserted by upstream identity (`(source_id, external_id)`, unique-constrained —
not by slug), and an existing row's `slug` is preserved verbatim on every re-sync — only other
columns (name, types, stats, category) refresh. Each batch (500 rows) is one upsert statement,
atomic per Postgres; the ingestion run as a whole is not wrapped in one cross-batch transaction. If
a run fails partway, already-committed batches remain and the failure is reported with the exact
species/stage that failed — the fix is simply re-running ingestion, which is idempotent and
resumes/completes correctly rather than duplicating anything. A bespoke Postgres function/RPC for
true single-transaction, all-or-nothing ingestion was deliberately not built: for a dev ingestion
tool, "resumable via idempotent re-run" is a materially simpler correct answer to the same failure
mode (a mid-run crash) than the RPC would be. See `packages/pokemon-data/src/persist.ts`.

### Generated database types

`packages/database/src/generated-database-types.ts` (generated via `supabase gen types typescript
--local`) is the authoritative `Database` type as of Phase 1B — `src/types.ts` now only re-exports
it. Phase 0/1A hand-maintained a subset and hit real bugs from small omissions (a missing
`Relationships: []`, missing `Views`/`Functions`/`Enums`/`CompositeTypes` silently degrading query
results to `never`); with two real migrations now, that manual-sync risk outweighs avoiding a
generator step. Regenerate after every schema change (`packages/database/README.md`).

PostgREST's default 1000-row response cap (`max_rows` in `supabase/config.toml`) is a separate,
real constraint the full dataset exposed: any `.select()` without explicit `.range()` pagination
silently truncates past 1000 rows rather than erroring. Both the ingestion write path
(`packages/pokemon-data/src/persist.ts`) and `listSpecies` (`packages/database/src/queries.ts`)
paginate their reads past it.

### Supabase API keys

Supabase issues two key types per project (superseding the legacy `anon`/`service_role` JWTs,
which local `supabase start` still also prints and remain valid — nothing here requires migrating
an already-issued legacy key):

- **publishable key** (`sb_publishable_...`) — safe in browser code, RLS-governed. Client code
  uses `SupabasePublicConfig.publishableKey` (`packages/database/src/client.ts`).
- **secret key** (`sb_secret_...`) — server-only, bypasses RLS. Client code uses
  `SupabaseSecretConfig.secretKey`. Never expose to a client bundle; never log it (CLAUDE.md §15).

Environment variable naming is standardized on the key's _role_, not its exact format, so a
project can hold either a modern key or a legacy JWT in the same variable without a code change:

| Variable                               | Used by                                         | Key type    |
| -------------------------------------- | ----------------------------------------------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `apps/web` (browser + server)                   | —           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `apps/web` (browser + server)                   | publishable |
| `SUPABASE_URL`                         | tooling (`packages/database`, ingestion, tests) | —           |
| `SUPABASE_PUBLISHABLE_KEY`             | tooling reading with anon-equivalent privilege  | publishable |
| `SUPABASE_SECRET_KEY`                  | ingestion writes, any privileged server task    | secret      |

`SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` (no `NEXT_PUBLIC_` prefix) are
deliberately separate from the web app's variables, even though local dev points both at the same
project — this lets ingestion/tooling target a different environment (e.g. the remote DEV Supabase
project) without touching `apps/web`'s configuration (the `SUPABASE_URL`-for-tooling split dates
to Phase 1B's ingestion pipeline; this change only renames the key variables, not that split).

## Likely early domains

Reference/data domains may include:

- generations,
- games,
- species,
- Pokémon/forms,
- types,
- abilities,
- moves,
- items,
- evolutions,
- learnsets,
- localized names/text,
- data source/version provenance.

User domains later:

- profiles,
- teams,
- team versions,
- collections,
- battle/replay metadata,
- preferences,
- sharing metadata.

Do not create all of these in Phase 0 unless required by the first real slice.

## Context modeling

Avoid assuming a Pokémon/move/item has one timeless definition.

Where relevant, preserve:

- generation,
- game,
- format/regulation,
- source version,
- effective time range.

Normalize only where normalization improves correctness and querying.

## Supabase Auth boundary

Application identity should expose a PokeStudio user identifier and capabilities rather than leaking auth-provider-specific assumptions everywhere.

Initial providers may include:

- Google,
- Discord,
- email/magic link.

## RLS

Any table exposed through Supabase APIs that contains user-owned/private data requires explicit RLS/grant review.

Tests should prove:

- anonymous users cannot read private teams,
- users cannot read/write another user's private resources,
- explicitly public resources are readable under intended rules,
- service-only operations are not accidentally available client-side.

## Migration policy

- schema changes through migrations,
- no manual production-only schema drift,
- destructive migrations require explicit review,
- backfills separated from schema changes when operationally safer,
- seed data is deterministic and clearly distinguished from production imports.

## Portability

Avoid making PostgreSQL migration impossible by:

- keeping core schema SQL-compatible where reasonable,
- documenting Supabase-specific extensions/functions,
- isolating storage/auth/realtime-specific integrations,
- maintaining export/backup procedures before public beta.
