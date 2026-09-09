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
